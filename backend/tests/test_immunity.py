"""TDD for Fleet Immunity — antibodies, vaccination, herd response, coverage.

A resolved incident becomes a generalized 'antibody'. New services are vaccinated on
register; a single incident immunizes the whole fleet (herd response). This is the
compounding moat.
"""

from __future__ import annotations

from aegis_platform.common.schemas import (
    ActionType,
    Anomaly,
    ChangeKind,
    Deploy,
    Incident,
    IncidentClass,
    MetricKind,
    RootCause,
    ServiceRef,
)
from aegis_platform.governance import build_action
from aegis_platform.immunity import FleetImmunity, IncidentKB, applies_to, make_signature


def _resolved_incident() -> Incident:
    anomaly = Anomaly(
        service_id="svc_a", kind=MetricKind.GROUNDEDNESS, baseline=0.9,
        observed=0.55, direction="down", confidence=0.95,
    )
    rc = RootCause(
        summary="prompt change removed grounding instruction",
        incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
        suspected_change=Deploy(service_id="svc_a", revision="rev-9", kind=ChangeKind.PROMPT),
        confidence=0.9,
    )
    return Incident(
        service_id="svc_a",
        incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
        anomalies=(anomaly,),
        root_cause=rc,
    )


SVC_A = ServiceRef(id="svc_a", name="support-rag", capabilities=("rag", "tool_use"))
SVC_B = ServiceRef(id="svc_b", name="argus-review", capabilities=("rag",))
SVC_C = ServiceRef(id="svc_c", name="image-gen", capabilities=("vision",))


class TestSignatureAndApplicability:
    def test_signature_is_deterministic(self) -> None:
        s1 = make_signature(IncidentClass.GROUNDEDNESS_REGRESSION, ChangeKind.PROMPT)
        s2 = make_signature(IncidentClass.GROUNDEDNESS_REGRESSION, ChangeKind.PROMPT)
        assert s1 == s2 and "groundedness_regression" in s1

    def test_applies_to_matches_on_shared_capability(self) -> None:
        from aegis_platform.common.schemas import Antibody

        ab = Antibody(
            signature="x", incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
            remediation=build_action(ActionType.ROLLBACK_PROMPT), applies_to_capabilities=("rag",),
        )
        assert applies_to(ab, SVC_B) is True       # shares "rag"
        assert applies_to(ab, SVC_C) is False       # vision only


class TestIncidentKB:
    def test_find_matching_by_class_and_capability(self) -> None:
        from aegis_platform.common.schemas import Antibody

        kb = IncidentKB()
        kb.add(Antibody(
            signature="s", incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
            remediation=build_action(ActionType.ROLLBACK_PROMPT), applies_to_capabilities=("rag",),
            confidence=0.8,
        ))
        assert kb.find_matching(IncidentClass.GROUNDEDNESS_REGRESSION, ("rag",))
        assert not kb.find_matching(IncidentClass.COST_EXPLOSION, ("rag",))
        assert not kb.find_matching(IncidentClass.GROUNDEDNESS_REGRESSION, ("vision",))

    def test_record_reuse_increments_and_boosts_confidence(self) -> None:
        from aegis_platform.common.schemas import Antibody

        kb = IncidentKB()
        ab = Antibody(
            signature="s", incident_class=IncidentClass.PII_LEAK,
            remediation=build_action(ActionType.ROLLBACK_REVISION), confidence=0.7,
        )
        kb.add(ab)
        updated = kb.record_reuse(ab.id, success=True)
        assert updated.reuse_count == 1
        assert updated.success_rate == 1.0
        assert updated.confidence >= 0.7


class TestFleetImmunity:
    def test_learn_creates_and_stores_antibody(self) -> None:
        fleet = FleetImmunity()
        ab = fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        assert ab.incident_class is IncidentClass.GROUNDEDNESS_REGRESSION
        assert ab.source_service_id == "svc_a"
        assert "rag" in ab.applies_to_capabilities
        assert len(fleet.kb.all()) == 1

    def test_match_returns_known_antibody_for_same_class(self) -> None:
        fleet = FleetImmunity()
        fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        # a brand-new incident of the same class on a different rag service
        new_inc = Incident(service_id="svc_b", incident_class=IncidentClass.GROUNDEDNESS_REGRESSION)
        assert fleet.match(new_inc, SVC_B) is not None

    def test_match_returns_none_for_unrelated_class(self) -> None:
        fleet = FleetImmunity()
        fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        new_inc = Incident(service_id="svc_b", incident_class=IncidentClass.LATENCY_DEGRADATION)
        assert fleet.match(new_inc, SVC_B) is None

    def test_vaccinate_returns_applicable_antibodies(self) -> None:
        fleet = FleetImmunity()
        fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        assert len(fleet.vaccinate(SVC_B)) == 1      # rag service → vaccinated
        assert fleet.vaccinate(SVC_C) == []           # vision service → not susceptible

    def test_herd_targets_excludes_source_includes_susceptible(self) -> None:
        fleet = FleetImmunity()
        ab = fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        targets = fleet.herd_targets(ab, [SVC_A, SVC_B, SVC_C])
        ids = {s.id for s in targets}
        assert ids == {"svc_b"}                       # not source A, not vision C

    def test_coverage_increases_after_learning(self) -> None:
        fleet = FleetImmunity()
        universe = {IncidentClass.GROUNDEDNESS_REGRESSION, IncidentClass.COST_EXPLOSION}
        assert fleet.coverage(SVC_B, universe) == 0.0
        fleet.learn(_resolved_incident(), build_action(ActionType.ROLLBACK_PROMPT), SVC_A)
        assert fleet.coverage(SVC_B, universe) == 0.5

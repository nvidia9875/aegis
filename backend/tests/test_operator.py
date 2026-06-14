"""TDD for the Aegis Operator — the autonomous self-heal loop, end to end.

Uses the deterministic SimulatedService (demo world): a fault shifts metrics, and the
correct remediation restores them. Verifies auto-heal (L1), antibody reuse (instant
mitigation), and the L2 human-approval gate.
"""

from __future__ import annotations

from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import (
    ActionType,
    IncidentClass,
    IncidentStatus,
    MetricKind,
)
from aegis_platform.fault_injector import FAULTS, build_demo_service
from aegis_platform.operator import AegisOperator, build_monitors


def _operator(autonomy: Autonomy = Autonomy.GUARDED) -> AegisOperator:
    return AegisOperator(autonomy=autonomy)


class TestSimulatedWorld:
    def test_inject_shifts_metric(self) -> None:
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["groundedness_regression"])
        assert svc.sample(MetricKind.GROUNDEDNESS).value < 0.7
        assert not svc.is_healthy

    def test_correct_action_recovers(self) -> None:
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["groundedness_regression"])
        assert svc.apply_action(ActionType.ROLLBACK_PROMPT) is True
        assert svc.is_healthy
        assert svc.sample(MetricKind.GROUNDEDNESS).value > 0.85

    def test_wrong_action_does_not_recover(self) -> None:
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["groundedness_regression"])
        assert svc.apply_action(ActionType.SCALE_SERVICE) is False
        assert not svc.is_healthy


class TestAutoHeal:
    def test_healthy_service_yields_no_incident(self) -> None:
        op = _operator()
        svc = build_demo_service("svc_a")
        report = op.handle(svc, build_monitors(svc))
        assert report.incident is None

    def test_groundedness_regression_auto_healed_and_learned(self) -> None:
        op = _operator()
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["groundedness_regression"])

        report = op.handle(svc, build_monitors(svc))

        assert report.incident is not None
        assert report.incident.incident_class is IncidentClass.GROUNDEDNESS_REGRESSION
        assert report.status is IncidentStatus.RESOLVED
        assert report.actions[-1].type is ActionType.ROLLBACK_PROMPT
        assert report.used_antibody is False
        assert report.learned_antibody_id is not None       # immunized the fleet
        assert report.incident.mttr_seconds is not None
        assert svc.is_healthy

    def test_cost_explosion_heals_via_failover(self) -> None:
        op = _operator()
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["cost_explosion"])
        report = op.handle(svc, build_monitors(svc))
        assert report.status is IncidentStatus.RESOLVED
        assert report.actions[-1].type is ActionType.FAILOVER_MODEL


class TestAntibodyReuse:
    def test_known_incident_uses_antibody_and_skips_diagnosis(self) -> None:
        op = _operator()
        # First incident on service A — learns an antibody.
        svc_a = build_demo_service("svc_a")
        svc_a.inject(FAULTS["groundedness_regression"])
        op.handle(svc_a, build_monitors(svc_a))

        # Same failure class on a different RAG service B — should reuse the antibody.
        svc_b = build_demo_service("svc_b")
        svc_b.inject(FAULTS["groundedness_regression"])
        report = op.handle(svc_b, build_monitors(svc_b))

        assert report.used_antibody is True
        assert report.status is IncidentStatus.RESOLVED
        assert any("antibody" in line.lower() for line in report.timeline)


class TestGovernanceGate:
    def test_l2_action_awaits_approval_then_resolves(self) -> None:
        op = _operator(Autonomy.GUARDED)
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["corrupted_index"])           # fixed by REBUILD_INDEX (L2)

        report = op.handle(svc, build_monitors(svc))
        assert report.status is IncidentStatus.AWAITING_APPROVAL
        assert report.pending_approval_id is not None
        assert not svc.is_healthy                        # nothing applied yet

        resolved = op.resume(report, approve=True, actor="oncall")
        assert resolved.status is IncidentStatus.RESOLVED
        assert svc.is_healthy

    def test_l2_denied_stays_unresolved(self) -> None:
        op = _operator(Autonomy.GUARDED)
        svc = build_demo_service("svc_a")
        svc.inject(FAULTS["corrupted_index"])
        report = op.handle(svc, build_monitors(svc))
        denied = op.resume(report, approve=False, actor="oncall")
        assert denied.status is not IncidentStatus.RESOLVED
        assert not svc.is_healthy

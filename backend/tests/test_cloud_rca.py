"""Tests for the deterministic RCA core (prompt + parse + policy-bounded mapping)."""

from __future__ import annotations

import pytest

from aegis_platform.cloud.rca import (
    RcaParseError,
    build_rca_prompt,
    decision_to_diagnosis,
    parse_rca,
)
from aegis_platform.common.schemas import (
    ActionType,
    Anomaly,
    ChangeKind,
    Deploy,
    Incident,
    IncidentClass,
    MetricKind,
    RiskTier,
    Severity,
)


def _incident() -> Incident:
    return Incident(
        service_id="support-rag",
        incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
        severity=Severity.CRITICAL,
        anomalies=(
            Anomaly(
                service_id="support-rag",
                kind=MetricKind.GROUNDEDNESS,
                baseline=0.92,
                observed=0.55,
                direction="down",
                confidence=0.97,
            ),
        ),
    )


def _deploys() -> tuple[Deploy, ...]:
    return (
        Deploy(service_id="support-rag", revision="rev-good", kind=ChangeKind.CODE, summary="baseline"),
        Deploy(service_id="support-rag", revision="rev-bad", kind=ChangeKind.PROMPT, summary="prompt tweak"),
    )


def test_prompt_includes_evidence_and_deploys():
    prompt = build_rca_prompt(_incident(), _deploys())
    assert "groundedness_regression" in prompt
    assert "rev-bad" in prompt
    assert "observed 0.55" in prompt


def test_parse_valid_json():
    text = (
        '{"incident_class": "groundedness_regression", "suspected_revision": "rev-bad", '
        '"action_type": "rollback_prompt", "confidence": 0.91, "rationale": "prompt change"}'
    )
    decision = parse_rca(text)
    assert decision.action_type is ActionType.ROLLBACK_PROMPT
    assert decision.suspected_revision == "rev-bad"
    assert decision.confidence == pytest.approx(0.91)


def test_parse_strips_code_fences():
    text = '```json\n{"action_type": "failover_model", "confidence": 0.7}\n```'
    decision = parse_rca(text)
    assert decision.action_type is ActionType.FAILOVER_MODEL


def test_parse_clamps_confidence_and_defaults_unknown_class():
    text = '{"action_type": "scale_service", "confidence": 5, "incident_class": "nonsense"}'
    decision = parse_rca(text)
    assert decision.confidence == 1.0
    assert decision.incident_class is IncidentClass.UNKNOWN


@pytest.mark.parametrize(
    "text",
    [
        "not json at all",
        "",
        '{"action_type": "delete_everything"}',  # invalid enum
        '{"action_type": "run_diagnostic"}',  # valid enum but not proposable
        '{"confidence": 0.9}',  # missing action_type
    ],
)
def test_parse_rejects_bad_or_unsafe_responses(text):
    with pytest.raises(RcaParseError):
        parse_rca(text)


def test_decision_maps_to_policy_bounded_action():
    decision = parse_rca(
        '{"action_type": "rollback_prompt", "suspected_revision": "rev-bad", '
        '"confidence": 0.9, "rationale": "system prompt regressed groundedness"}'
    )
    root_cause, action = decision_to_diagnosis(decision, _incident(), _deploys())
    # remediation tier comes from policy, not the model
    assert action.type is ActionType.ROLLBACK_PROMPT
    assert action.risk_tier is RiskTier.L1
    assert action.reversible is True
    # root cause attributes the correct deploy
    assert root_cause.suspected_change is not None
    assert root_cause.suspected_change.revision == "rev-bad"
    assert "source: gemini-rca" in root_cause.evidence


def test_l2_action_proposal_stays_l2_under_policy():
    decision = parse_rca('{"action_type": "rebuild_index", "confidence": 0.8}')
    _, action = decision_to_diagnosis(decision, _incident(), _deploys())
    assert action.risk_tier is RiskTier.L2  # governance will still gate this
    assert action.reversible is False

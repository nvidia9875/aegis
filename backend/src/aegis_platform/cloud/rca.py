"""RCA prompt + response parsing — the deterministic, testable core of cloud diagnosis.

The LLM only ever *chooses among known action types*; the risk tier and reversibility
are decided by ``governance.policy.build_action`` (single source of truth) and the
Governance gate still requires human approval for L2. So a hallucinated or malicious
model response can never escalate Aegis's privileges — it can at worst pick a wrong
(but still policy-bounded) action, which Verify/rollback catches.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from dataclasses import dataclass

from aegis_platform.common.schemas import (
    ActionType,
    Deploy,
    Incident,
    IncidentClass,
    RemediationAction,
    RootCause,
)
from aegis_platform.governance import build_action
from aegis_platform.operator.runbook import DEFAULT_ACTION, RUNBOOK

# Actions the model is allowed to propose. Read-only/diagnostic and notification
# actions are excluded — the diagnoser's job is to pick a *remediation*.
_PROPOSABLE: tuple[ActionType, ...] = (
    ActionType.ROLLBACK_REVISION,
    ActionType.ROLLBACK_PROMPT,
    ActionType.FAILOVER_MODEL,
    ActionType.SCALE_SERVICE,
    ActionType.TOGGLE_FLAG,
    ActionType.REBUILD_INDEX,
)

RCA_SYSTEM_INSTRUCTION = (
    "You are Aegis, an autonomous SRE performing root-cause analysis for an AI service "
    "(RAG/chat) incident. You are given the detected incident class, the anomalous "
    "metrics, and the recent deploy history. Identify the single most likely root cause "
    "and choose exactly one remediation from the allowed actions. Irreversible actions "
    "(rebuild_index) will be gated for human approval — prefer the least invasive action "
    "that restores health. Respond with a SINGLE JSON object and nothing else, using keys: "
    'incident_class, suspected_revision, action_type, confidence (0..1), rationale. '
    f"Allowed action_type values: {', '.join(a.value for a in _PROPOSABLE)}."
)


class RcaParseError(ValueError):
    """The model response could not be parsed into a valid, policy-bounded decision."""


@dataclass(frozen=True)
class RcaDecision:
    incident_class: IncidentClass
    action_type: ActionType
    suspected_revision: str | None
    confidence: float
    rationale: str


def build_rca_prompt(incident: Incident, recent_deploys: Sequence[Deploy]) -> str:
    """Render the incident + evidence + deploy history into a compact RCA prompt."""
    anomalies = "\n".join(
        f"  - {a.kind.value}: {a.direction} (baseline {a.baseline:.4g} → observed "
        f"{a.observed:.4g}, confidence {a.confidence:.2f})"
        for a in incident.anomalies
    ) or "  - (none)"
    deploys = "\n".join(
        f"  - revision={d.revision} kind={d.kind.value} summary={d.summary!r}"
        for d in recent_deploys
    ) or "  - (no recent deploys)"
    return (
        f"Detected incident class: {incident.incident_class.value}\n"
        f"Severity: {incident.severity.value}\n"
        f"Service: {incident.service_id}\n\n"
        f"Anomalous metrics:\n{anomalies}\n\n"
        f"Recent deploys (most recent last):\n{deploys}\n\n"
        "Return the JSON decision now."
    )


def _strip_fences(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1] if "\n" in t else t
        if t.endswith("```"):
            t = t[: -3]
        # drop a leading language tag line like ```json handled above
    return t.strip().removeprefix("json").strip()


def parse_rca(text: str) -> RcaDecision:
    """Parse a model response into a validated, enum-bounded decision."""
    if not text or not text.strip():
        raise RcaParseError("empty model response")
    raw = _strip_fences(text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RcaParseError(f"response is not valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise RcaParseError("response JSON is not an object")

    try:
        action_type = ActionType(str(data["action_type"]).strip())
    except (KeyError, ValueError) as exc:
        raise RcaParseError(f"missing/invalid action_type: {exc}") from exc
    if action_type not in _PROPOSABLE:
        raise RcaParseError(f"action_type {action_type.value} is not proposable")

    incident_class = _coerce_incident_class(data.get("incident_class"))
    revision = data.get("suspected_revision")
    revision = str(revision) if revision not in (None, "", "null") else None
    confidence = _coerce_confidence(data.get("confidence"))
    rationale = str(data.get("rationale", "")).strip()

    return RcaDecision(
        incident_class=incident_class,
        action_type=action_type,
        suspected_revision=revision,
        confidence=confidence,
        rationale=rationale,
    )


def _coerce_incident_class(value: object) -> IncidentClass:
    try:
        return IncidentClass(str(value).strip())
    except ValueError:
        return IncidentClass.UNKNOWN


def _coerce_confidence(value: object) -> float:
    try:
        return max(0.0, min(1.0, float(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 0.5


def decision_to_diagnosis(
    decision: RcaDecision, incident: Incident, recent_deploys: Sequence[Deploy]
) -> tuple[RootCause, RemediationAction]:
    """Turn a validated decision into a RootCause + a policy-bounded RemediationAction."""
    suspected = _match_deploy(decision.suspected_revision, recent_deploys)
    klass = decision.incident_class if decision.incident_class is not IncidentClass.UNKNOWN else incident.incident_class
    evidence = (
        *(f"{a.kind.value} {a.direction} (conf {a.confidence:.2f})" for a in incident.anomalies),
        "source: gemini-rca",
    )
    root_cause = RootCause(
        summary=decision.rationale or f"{klass.value} root cause (Gemini RCA)",
        incident_class=klass,
        suspected_change=suspected,
        evidence=evidence,
        confidence=decision.confidence,
    )
    remediation = build_action(decision.action_type, rationale=decision.rationale or "Gemini RCA")
    return root_cause, remediation


def runbook_action_for(incident_class: IncidentClass) -> ActionType:
    return RUNBOOK.get(incident_class, DEFAULT_ACTION)


def _match_deploy(revision: str | None, deploys: Sequence[Deploy]) -> Deploy | None:
    if not deploys:
        return None
    if revision:
        for d in deploys:
            if d.revision == revision:
                return d
    return deploys[-1]

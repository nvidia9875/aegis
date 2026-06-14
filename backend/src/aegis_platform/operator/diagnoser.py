"""Diagnosers — turn an incident + recent deploys into a root cause and remediation.

RunbookDiagnoser is deterministic (demo-safe, testable). A Gemini-backed diagnoser
implements the same Protocol for production RCA, escalated to via the complexity router.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from aegis_platform.common.schemas import Deploy, Incident, RemediationAction, RootCause
from aegis_platform.governance import build_action
from aegis_platform.operator.runbook import DEFAULT_ACTION, RUNBOOK


class Diagnoser(Protocol):
    def diagnose(
        self, incident: Incident, recent_deploys: Sequence[Deploy]
    ) -> tuple[RootCause, RemediationAction]: ...


class RunbookDiagnoser:
    def diagnose(
        self, incident: Incident, recent_deploys: Sequence[Deploy]
    ) -> tuple[RootCause, RemediationAction]:
        suspected = recent_deploys[-1] if recent_deploys else None
        action_type = RUNBOOK.get(incident.incident_class, DEFAULT_ACTION)
        change_desc = (
            f"{suspected.kind.value} change ({suspected.revision})"
            if suspected
            else "no recent change"
        )
        root_cause = RootCause(
            summary=f"{incident.incident_class.value} correlated with recent {change_desc}",
            incident_class=incident.incident_class,
            suspected_change=suspected,
            evidence=tuple(
                f"{a.kind.value} {a.direction} (conf {a.confidence:.2f})" for a in incident.anomalies
            ),
            confidence=0.85,
        )
        remediation = build_action(
            action_type, rationale=f"runbook remediation for {incident.incident_class.value}"
        )
        return root_cause, remediation

"""Generalize a resolved incident + its successful fix into a reusable antibody.

Deterministic by default (demo-safe, testable). A Gemini-backed generalizer can be
swapped in to abstract service-specific fixes into portable remediation patterns.
"""

from __future__ import annotations

from aegis_platform.common.schemas import Antibody, Incident, RemediationAction, ServiceRef
from aegis_platform.governance import build_action
from aegis_platform.immunity.signature import make_signature


class Generalizer:
    def generalize(
        self,
        incident: Incident,
        action: RemediationAction,
        source_service: ServiceRef,
        confidence: float = 0.7,
    ) -> Antibody:
        trigger = None
        if incident.root_cause and incident.root_cause.suspected_change:
            trigger = incident.root_cause.suspected_change.kind

        detector: dict[str, str] = {}
        if incident.anomalies:
            primary = max(incident.anomalies, key=lambda a: a.confidence)
            detector = {
                "metric": primary.kind.value,
                "direction": primary.direction,
                "rule": "cusum",
            }

        # Generalize the fix: keep the action *type* (portable), drop service-specific params.
        remediation = build_action(
            action.type, rationale=f"antibody learned from {source_service.id}"
        )
        evidence = (incident.root_cause.summary,) if incident.root_cause else ()

        return Antibody(
            signature=make_signature(incident.incident_class, trigger),
            incident_class=incident.incident_class,
            trigger=trigger,
            detector=detector,
            remediation=remediation,
            applies_to_capabilities=source_service.capabilities,
            evidence=evidence,
            confidence=confidence,
            source_service_id=source_service.id,
        )

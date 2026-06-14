"""JSON serializers — the wire contract consumed by the Mission Control dashboard."""

from __future__ import annotations

from typing import Any

from aegis_platform.common.schemas import Antibody, AuditEntry, Incident, RemediationAction
from aegis_platform.operator import IncidentReport


def action_to_dict(a: RemediationAction) -> dict[str, Any]:
    return {
        "type": a.type.value,
        "risk_tier": a.risk_tier.value,
        "reversible": a.reversible,
        "blast_radius": a.blast_radius,
        "rationale": a.rationale,
        "params": a.params,
    }


def antibody_to_dict(ab: Antibody) -> dict[str, Any]:
    return {
        "id": ab.id,
        "signature": ab.signature,
        "incident_class": ab.incident_class.value,
        "trigger": ab.trigger.value if ab.trigger else None,
        "applies_to_capabilities": list(ab.applies_to_capabilities),
        "confidence": round(ab.confidence, 3),
        "reuse_count": ab.reuse_count,
        "success_rate": round(ab.success_rate, 3),
        "source_service_id": ab.source_service_id,
        "remediation": action_to_dict(ab.remediation),
    }


def incident_to_dict(inc: Incident | None) -> dict[str, Any] | None:
    if inc is None:
        return None
    return {
        "id": inc.id,
        "service_id": inc.service_id,
        "incident_class": inc.incident_class.value,
        "severity": inc.severity.value,
        "status": inc.status.value,
        "mttr_seconds": inc.mttr_seconds,
        "root_cause": inc.root_cause.summary if inc.root_cause else None,
        "antibody_id": inc.antibody_id,
        "anomalies": [
            {
                "kind": a.kind.value,
                "baseline": a.baseline,
                "observed": a.observed,
                "direction": a.direction,
                "confidence": round(a.confidence, 3),
            }
            for a in inc.anomalies
        ],
    }


def report_to_dict(title: str, report: IncidentReport) -> dict[str, Any]:
    return {
        "title": title,
        "status": report.status.value,
        "used_antibody": report.used_antibody,
        "antibody_id": report.antibody_id,
        "pending_approval_id": report.pending_approval_id,
        "learned_antibody_id": report.learned_antibody_id,
        "actions": [action_to_dict(a) for a in report.actions],
        "timeline": list(report.timeline),
        "incident": incident_to_dict(report.incident),
    }


def audit_to_dict(e: AuditEntry) -> dict[str, Any]:
    return {
        "id": e.id,
        "incident_id": e.incident_id,
        "decision": e.decision,
        "actor": e.actor,
        "detail": e.detail,
        "action": action_to_dict(e.action),
        "ts": e.ts.isoformat(),
    }

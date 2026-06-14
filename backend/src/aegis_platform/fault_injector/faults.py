"""Deterministic fault catalog (AI-specific + classic) for reproducible demos.

Each fault shifts one or more metrics and declares the single remediation that
restores health — so the operator's runbook can be validated end to end.
"""

from __future__ import annotations

from dataclasses import dataclass

from aegis_platform.common.schemas import ActionType, ChangeKind, IncidentClass, MetricKind


@dataclass(frozen=True, eq=False)
class Fault:
    id: str
    incident_class: IncidentClass
    trigger: ChangeKind
    shifts: dict[MetricKind, float]
    fixed_by: ActionType


FAULTS: dict[str, Fault] = {
    "groundedness_regression": Fault(
        "groundedness_regression",
        IncidentClass.GROUNDEDNESS_REGRESSION,
        ChangeKind.PROMPT,
        {MetricKind.GROUNDEDNESS: 0.55},
        ActionType.ROLLBACK_PROMPT,
    ),
    "cost_explosion": Fault(
        "cost_explosion",
        IncidentClass.COST_EXPLOSION,
        ChangeKind.MODEL,
        {MetricKind.COST_PER_REQ_USD: 0.05},
        ActionType.FAILOVER_MODEL,
    ),
    "latency_degradation": Fault(
        "latency_degradation",
        IncidentClass.LATENCY_DEGRADATION,
        ChangeKind.CODE,
        {MetricKind.LATENCY_P95_MS: 900.0},
        ActionType.SCALE_SERVICE,
    ),
    "error_spike": Fault(
        "error_spike",
        IncidentClass.ERROR_RATE_SPIKE,
        ChangeKind.CODE,
        {MetricKind.ERROR_RATE: 0.4},
        ActionType.ROLLBACK_REVISION,
    ),
    "corrupted_index": Fault(
        "corrupted_index",
        IncidentClass.DEPENDENCY_OUTAGE,
        ChangeKind.CONFIG,
        {MetricKind.RETRIEVAL_HEALTH: 0.30},
        ActionType.REBUILD_INDEX,  # L2 — requires human approval
    ),
}

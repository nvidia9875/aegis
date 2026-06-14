"""Runbook — incident class to default remediation. The operator's reasoning prior."""

from __future__ import annotations

from aegis_platform.common.schemas import ActionType, IncidentClass

RUNBOOK: dict[IncidentClass, ActionType] = {
    IncidentClass.GROUNDEDNESS_REGRESSION: ActionType.ROLLBACK_PROMPT,
    IncidentClass.HALLUCINATION_SPIKE: ActionType.ROLLBACK_PROMPT,
    IncidentClass.PII_LEAK: ActionType.ROLLBACK_PROMPT,
    IncidentClass.PROMPT_INJECTION: ActionType.TOGGLE_FLAG,
    IncidentClass.COST_EXPLOSION: ActionType.FAILOVER_MODEL,
    IncidentClass.LATENCY_DEGRADATION: ActionType.SCALE_SERVICE,
    IncidentClass.ERROR_RATE_SPIKE: ActionType.ROLLBACK_REVISION,
    IncidentClass.BAD_DEPLOY: ActionType.ROLLBACK_REVISION,
    IncidentClass.DEPENDENCY_OUTAGE: ActionType.REBUILD_INDEX,
}

DEFAULT_ACTION = ActionType.ROLLBACK_REVISION

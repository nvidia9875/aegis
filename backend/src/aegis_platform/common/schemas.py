"""Core domain model for Aegis.

These types are the contract shared across every module (telemetry, operator,
governance, immunity, dashboard API). Value objects are frozen to keep the
immutable-update discipline: produce new copies, never mutate in place.
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


def _now() -> datetime:
    return datetime.now(UTC)


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


# ── Enums ────────────────────────────────────────────────────────────────────


class Severity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class RiskTier(str, Enum):
    """Governance risk tiers — decide auto-apply vs human approval."""

    L0 = "L0"  # read-only / diagnostic — always auto
    L1 = "L1"  # reversible mutation (rollback, scale, flag, failover) — auto
    L2 = "L2"  # irreversible / high blast-radius — human approval required


class IncidentClass(str, Enum):
    """Failure classes. AI-specific classes are first-class citizens."""

    GROUNDEDNESS_REGRESSION = "groundedness_regression"
    HALLUCINATION_SPIKE = "hallucination_spike"
    PII_LEAK = "pii_leak"
    PROMPT_INJECTION = "prompt_injection"
    COST_EXPLOSION = "cost_explosion"
    LATENCY_DEGRADATION = "latency_degradation"
    ERROR_RATE_SPIKE = "error_rate_spike"
    DEPENDENCY_OUTAGE = "dependency_outage"
    BAD_DEPLOY = "bad_deploy"
    CONFIG_ERROR = "config_error"
    UNKNOWN = "unknown"


class MetricKind(str, Enum):
    GROUNDEDNESS = "groundedness"          # higher is better (0..1)
    RETRIEVAL_HEALTH = "retrieval_health"  # higher is better (0..1) — RAG index health
    HALLUCINATION_RATE = "hallucination_rate"
    PII_RATE = "pii_rate"
    ERROR_RATE = "error_rate"
    LATENCY_P95_MS = "latency_p95_ms"
    COST_PER_REQ_USD = "cost_per_req_usd"
    TOKENS_PER_REQ = "tokens_per_req"
    REQUEST_RATE = "request_rate"


# Metrics where a *decrease* is bad (vs the default: an increase is bad).
HIGHER_IS_BETTER: frozenset[MetricKind] = frozenset(
    {MetricKind.GROUNDEDNESS, MetricKind.RETRIEVAL_HEALTH}
)


class ChangeKind(str, Enum):
    PROMPT = "prompt"
    MODEL = "model"
    CODE = "code"
    CONFIG = "config"


class ActionType(str, Enum):
    ROLLBACK_REVISION = "rollback_revision"   # L1
    ROLLBACK_PROMPT = "rollback_prompt"       # L1
    FAILOVER_MODEL = "failover_model"         # L1
    SCALE_SERVICE = "scale_service"           # L1
    TOGGLE_FLAG = "toggle_flag"               # L1
    RUN_DIAGNOSTIC = "run_diagnostic"         # L0
    OPEN_HOTFIX_PR = "open_hotfix_pr"         # L1 (non-prod side effect)
    POST_POSTMORTEM = "post_postmortem"       # L0
    REBUILD_INDEX = "rebuild_index"           # L2 (destructive/expensive)
    PURGE_DATA = "purge_data"                 # L2 (irreversible)


class IncidentStatus(str, Enum):
    OPEN = "open"
    DIAGNOSING = "diagnosing"
    AWAITING_APPROVAL = "awaiting_approval"
    MITIGATING = "mitigating"
    VERIFYING = "verifying"
    RESOLVED = "resolved"
    FAILED = "failed"


# ── Value objects ─────────────────────────────────────────────────────────────


class MetricSample(BaseModel):
    model_config = ConfigDict(frozen=True)

    service_id: str
    kind: MetricKind
    value: float
    ts: datetime = Field(default_factory=_now)


class Deploy(BaseModel):
    model_config = ConfigDict(frozen=True)

    service_id: str
    revision: str
    kind: ChangeKind
    summary: str = ""
    ts: datetime = Field(default_factory=_now)


class ServiceRef(BaseModel):
    """A registered service Aegis can guard."""

    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    capabilities: tuple[str, ...] = ()      # e.g. ("rag", "tool_use") — used for antibody applicability
    current_revision: str = ""
    prompt_version: str = ""
    model: str = ""


class Anomaly(BaseModel):
    model_config = ConfigDict(frozen=True)

    service_id: str
    kind: MetricKind
    baseline: float
    observed: float
    direction: str                          # "up" | "down"
    confidence: float                       # 0..1 (statistical)
    detected_at: datetime = Field(default_factory=_now)


class RootCause(BaseModel):
    model_config = ConfigDict(frozen=True)

    summary: str
    incident_class: IncidentClass
    suspected_change: Deploy | None = None
    evidence: tuple[str, ...] = ()
    confidence: float = 0.0


class RemediationAction(BaseModel):
    model_config = ConfigDict(frozen=True)

    type: ActionType
    params: dict[str, str] = Field(default_factory=dict)
    risk_tier: RiskTier
    reversible: bool
    blast_radius: str = ""                  # human-readable scope estimate
    rationale: str = ""


class AuditEntry(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=lambda: _id("aud"))
    incident_id: str
    action: RemediationAction
    decision: str                           # "auto" | "approved" | "denied" | "blocked"
    actor: str = "aegis"
    detail: str = ""
    ts: datetime = Field(default_factory=_now)


class Incident(BaseModel):
    """Mutable aggregate that flows through the loop. Updated via copy helpers."""

    id: str = Field(default_factory=lambda: _id("inc"))
    service_id: str
    incident_class: IncidentClass = IncidentClass.UNKNOWN
    severity: Severity = Severity.WARNING
    status: IncidentStatus = IncidentStatus.OPEN
    anomalies: tuple[Anomaly, ...] = ()
    root_cause: RootCause | None = None
    actions_taken: tuple[RemediationAction, ...] = ()
    antibody_id: str | None = None          # set if resolved via a known antibody
    detected_at: datetime = Field(default_factory=_now)
    resolved_at: datetime | None = None

    @property
    def mttr_seconds(self) -> float | None:
        if self.resolved_at is None:
            return None
        return (self.resolved_at - self.detected_at).total_seconds()


class Antibody(BaseModel):
    """A generalized, reusable immunization learned from a resolved incident."""

    model_config = ConfigDict(frozen=True)

    id: str = Field(default_factory=lambda: _id("ab"))
    signature: str                          # normalized failure fingerprint
    incident_class: IncidentClass
    trigger: ChangeKind | None = None
    detector: dict[str, str] = Field(default_factory=dict)   # monitoring rule
    remediation: RemediationAction
    applies_to_capabilities: tuple[str, ...] = ()
    evidence: tuple[str, ...] = ()
    confidence: float = 0.5
    reuse_count: int = 0
    success_rate: float = 0.0
    source_service_id: str = ""
    created_at: datetime = Field(default_factory=_now)

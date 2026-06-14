"""GovernanceGate — decides auto-apply vs human approval vs blocked, per autonomy mode."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict

from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import RemediationAction, RiskTier
from aegis_platform.governance.policy import effective_tier


class Decision(str, Enum):
    AUTO = "auto"
    APPROVE_REQUIRED = "approve_required"
    BLOCKED = "blocked"


class GovernanceDecision(BaseModel):
    model_config = ConfigDict(frozen=True)

    action: RemediationAction
    tier: RiskTier
    decision: Decision
    reason: str


class GovernanceGate:
    """The trust boundary. L0 always auto; L1 auto unless shadow; L2 always gated."""

    def __init__(self, autonomy: Autonomy = Autonomy.GUARDED) -> None:
        self.autonomy = autonomy

    def evaluate(self, action: RemediationAction) -> GovernanceDecision:
        tier = effective_tier(action.type)
        decision, reason = self._decide(tier)
        return GovernanceDecision(action=action, tier=tier, decision=decision, reason=reason)

    def _decide(self, tier: RiskTier) -> tuple[Decision, str]:
        if tier is RiskTier.L0:
            return Decision.AUTO, "read-only / diagnostic"
        if self.autonomy is Autonomy.SHADOW:
            return Decision.BLOCKED, "shadow mode: mutations are recommend-only"
        if tier is RiskTier.L1:
            return Decision.AUTO, "reversible action — auto-applied"
        return Decision.APPROVE_REQUIRED, "irreversible / high blast-radius — human approval required"

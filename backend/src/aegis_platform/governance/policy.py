"""Risk policy — the canonical mapping from action type to governance risk tier.

This is the single source of truth for what Aegis may do autonomously. Actions
are constructed via build_action() so risk tier and reversibility can never drift
from the policy.
"""

from __future__ import annotations

from aegis_platform.common.schemas import ActionType, RemediationAction, RiskTier

RISK_BY_ACTION: dict[ActionType, RiskTier] = {
    ActionType.RUN_DIAGNOSTIC: RiskTier.L0,
    ActionType.POST_POSTMORTEM: RiskTier.L0,
    ActionType.ROLLBACK_REVISION: RiskTier.L1,
    ActionType.ROLLBACK_PROMPT: RiskTier.L1,
    ActionType.FAILOVER_MODEL: RiskTier.L1,
    ActionType.SCALE_SERVICE: RiskTier.L1,
    ActionType.TOGGLE_FLAG: RiskTier.L1,
    ActionType.OPEN_HOTFIX_PR: RiskTier.L1,
    ActionType.REBUILD_INDEX: RiskTier.L2,
    ActionType.PURGE_DATA: RiskTier.L2,
}

_IRREVERSIBLE: frozenset[ActionType] = frozenset({
    ActionType.REBUILD_INDEX,
    ActionType.PURGE_DATA,
})

_BLAST_RADIUS: dict[ActionType, str] = {
    ActionType.RUN_DIAGNOSTIC: "none (read-only)",
    ActionType.POST_POSTMORTEM: "none (notification)",
    ActionType.ROLLBACK_REVISION: "1 service, instant revert",
    ActionType.ROLLBACK_PROMPT: "1 service, instant revert",
    ActionType.FAILOVER_MODEL: "1 service, model swap (revertible)",
    ActionType.SCALE_SERVICE: "1 service, capacity change",
    ActionType.TOGGLE_FLAG: "1 feature flag (revertible)",
    ActionType.OPEN_HOTFIX_PR: "code review queue (no prod impact)",
    ActionType.REBUILD_INDEX: "vector index rebuild (minutes of degraded recall)",
    ActionType.PURGE_DATA: "IRREVERSIBLE data deletion",
}


def effective_tier(action_type: ActionType) -> RiskTier:
    return RISK_BY_ACTION[action_type]


def build_action(
    action_type: ActionType,
    *,
    params: dict[str, str] | None = None,
    rationale: str = "",
    blast_radius: str = "",
) -> RemediationAction:
    """Construct a policy-consistent action (tier + reversibility never drift)."""
    return RemediationAction(
        type=action_type,
        params=params or {},
        risk_tier=RISK_BY_ACTION[action_type],
        reversible=action_type not in _IRREVERSIBLE,
        blast_radius=blast_radius or _BLAST_RADIUS.get(action_type, ""),
        rationale=rationale,
    )

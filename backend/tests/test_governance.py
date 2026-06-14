"""TDD for the Governance gate — the 'production-safe autonomy' trust boundary.

L0/L1 (reversible) auto-apply; L2 (irreversible / high blast-radius) require human
approval; shadow mode blocks all mutations. Every decision is auditable.
"""

from __future__ import annotations

import pytest

from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import ActionType, RiskTier
from aegis_platform.governance import (
    ApprovalQueue,
    AuditLog,
    Decision,
    GovernanceGate,
    build_action,
    effective_tier,
)


class TestPolicy:
    def test_canonical_tiers(self) -> None:
        assert effective_tier(ActionType.RUN_DIAGNOSTIC) is RiskTier.L0
        assert effective_tier(ActionType.ROLLBACK_REVISION) is RiskTier.L1
        assert effective_tier(ActionType.FAILOVER_MODEL) is RiskTier.L1
        assert effective_tier(ActionType.PURGE_DATA) is RiskTier.L2
        assert effective_tier(ActionType.REBUILD_INDEX) is RiskTier.L2

    def test_build_action_fills_tier_and_reversibility(self) -> None:
        a = build_action(ActionType.ROLLBACK_REVISION, params={"to": "rev-3"})
        assert a.risk_tier is RiskTier.L1
        assert a.reversible is True
        b = build_action(ActionType.PURGE_DATA)
        assert b.risk_tier is RiskTier.L2
        assert b.reversible is False


class TestGuardedAutonomy:
    def test_l1_auto_applies(self) -> None:
        gate = GovernanceGate(Autonomy.GUARDED)
        d = gate.evaluate(build_action(ActionType.ROLLBACK_REVISION))
        assert d.decision is Decision.AUTO

    def test_l0_auto_applies(self) -> None:
        gate = GovernanceGate(Autonomy.GUARDED)
        assert gate.evaluate(build_action(ActionType.RUN_DIAGNOSTIC)).decision is Decision.AUTO

    def test_l2_requires_approval(self) -> None:
        gate = GovernanceGate(Autonomy.GUARDED)
        d = gate.evaluate(build_action(ActionType.PURGE_DATA))
        assert d.decision is Decision.APPROVE_REQUIRED
        assert d.tier is RiskTier.L2


class TestShadowAutonomy:
    def test_blocks_mutations(self) -> None:
        gate = GovernanceGate(Autonomy.SHADOW)
        assert gate.evaluate(build_action(ActionType.ROLLBACK_REVISION)).decision is Decision.BLOCKED

    def test_allows_read_only(self) -> None:
        gate = GovernanceGate(Autonomy.SHADOW)
        assert gate.evaluate(build_action(ActionType.RUN_DIAGNOSTIC)).decision is Decision.AUTO


class TestAuditLog:
    def test_records_and_filters_by_incident(self) -> None:
        from aegis_platform.common.schemas import AuditEntry

        log = AuditLog()
        action = build_action(ActionType.ROLLBACK_REVISION)
        log.record(AuditEntry(incident_id="inc_1", action=action, decision="auto"))
        log.record(AuditEntry(incident_id="inc_2", action=action, decision="auto"))
        assert len(log.entries) == 2
        assert len(log.for_incident("inc_1")) == 1


class TestApprovalQueue:
    def test_request_then_approve_resolves(self) -> None:
        q = ApprovalQueue()
        action = build_action(ActionType.PURGE_DATA)
        approval_id = q.request("inc_1", action)
        assert len(q.pending()) == 1
        entry = q.approve(approval_id, actor="alice")
        assert entry.decision == "approved"
        assert entry.actor == "alice"
        assert q.pending() == []

    def test_deny_records_denied(self) -> None:
        q = ApprovalQueue()
        approval_id = q.request("inc_1", build_action(ActionType.REBUILD_INDEX))
        entry = q.deny(approval_id, actor="bob")
        assert entry.decision == "denied"
        assert q.pending() == []

    def test_unknown_approval_raises(self) -> None:
        q = ApprovalQueue()
        with pytest.raises(KeyError):
            q.approve("nope")

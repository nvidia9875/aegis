"""Immutable audit log + human approval queue for L2 actions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from aegis_platform.common.schemas import AuditEntry, RemediationAction


class AuditLog:
    """Append-only record of every governance decision and action taken."""

    def __init__(self) -> None:
        self._entries: list[AuditEntry] = []

    def record(self, entry: AuditEntry) -> None:
        self._entries.append(entry)

    @property
    def entries(self) -> tuple[AuditEntry, ...]:
        return tuple(self._entries)

    def for_incident(self, incident_id: str) -> list[AuditEntry]:
        return [e for e in self._entries if e.incident_id == incident_id]


@dataclass(frozen=True)
class PendingApproval:
    id: str
    incident_id: str
    action: RemediationAction
    requested_at: datetime


class ApprovalQueue:
    """Holds L2 actions awaiting a human decision (the Governance gate moment)."""

    def __init__(self) -> None:
        self._pending: dict[str, PendingApproval] = {}

    def request(self, incident_id: str, action: RemediationAction) -> str:
        approval_id = f"apr_{uuid4().hex[:12]}"
        self._pending[approval_id] = PendingApproval(
            id=approval_id,
            incident_id=incident_id,
            action=action,
            requested_at=datetime.now(UTC),
        )
        return approval_id

    def pending(self) -> list[PendingApproval]:
        return list(self._pending.values())

    def approve(self, approval_id: str, actor: str = "human") -> AuditEntry:
        return self._resolve(approval_id, "approved", actor)

    def deny(self, approval_id: str, actor: str = "human") -> AuditEntry:
        return self._resolve(approval_id, "denied", actor)

    def _resolve(self, approval_id: str, decision: str, actor: str) -> AuditEntry:
        pending = self._pending.pop(approval_id)  # raises KeyError for unknown id
        return AuditEntry(
            incident_id=pending.incident_id,
            action=pending.action,
            decision=decision,
            actor=actor,
            detail=f"{decision} via approval {approval_id}",
        )

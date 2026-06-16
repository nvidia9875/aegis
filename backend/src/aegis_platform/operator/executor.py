"""RemediationExecutor — where the loop's Act step actually lands.

Demo mode uses SimulatedExecutor (the deterministic twin). Cloud mode can inject
a real executor (see ``aegis_platform.cloud.cloudrun.CloudRunExecutor``) so a
ROLLBACK_REVISION genuinely rewrites a live Cloud Run service's traffic — the one
place Aegis's Act leaves the simulator and touches real infrastructure.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from aegis_platform.common.schemas import RemediationAction


@runtime_checkable
class RemediationExecutor(Protocol):
    """Applies a remediation action; returns True if it took effect."""

    def execute(self, action: RemediationAction, service: object) -> bool: ...


class SimulatedExecutor:
    """Default executor — delegate to the deterministic simulated world."""

    def execute(self, action: RemediationAction, service: object) -> bool:
        return bool(service.apply_action(action.type))  # type: ignore[attr-defined]

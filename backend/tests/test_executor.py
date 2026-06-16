"""Tests for the remediation executor abstraction (Tier2-4: real Cloud Run rollback).

The routing logic is exercised with a fake controller and a fake service, so no
google-cloud-run dependency or live project is required.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from aegis_platform.cloud.cloudrun import CloudRunExecutor
from aegis_platform.cloud.factory import build_executor
from aegis_platform.common.config import Settings
from aegis_platform.common.schemas import ActionType
from aegis_platform.governance.policy import build_action
from aegis_platform.operator.executor import SimulatedExecutor


@dataclass
class _Ref:
    id: str


@dataclass
class _FakeService:
    """Minimal stand-in for SimulatedService: records apply_action calls."""

    id: str
    applied: list[ActionType] = field(default_factory=list)

    @property
    def ref(self) -> _Ref:
        return _Ref(self.id)

    def apply_action(self, action_type: ActionType) -> bool:
        self.applied.append(action_type)
        return True


@dataclass
class _FakeController:
    calls: list[tuple[str, str]] = field(default_factory=list)
    boom: bool = False

    def rollback_to_revision(self, service_name: str, target_revision: str) -> bool:
        if self.boom:
            raise RuntimeError("admin api exploded")
        self.calls.append((service_name, target_revision))
        return True


def _rollback():
    return build_action(ActionType.ROLLBACK_REVISION, rationale="test")


def _executor(ctrl: _FakeController) -> CloudRunExecutor:
    return CloudRunExecutor(
        ctrl,  # type: ignore[arg-type]
        target_service_id="support-rag",
        run_service_name="aegis-target",
        good_revision="aegis-target-00001-abc",
    )


def test_simulated_executor_delegates_to_world():
    svc = _FakeService("support-rag")
    assert SimulatedExecutor().execute(_rollback(), svc) is True
    assert svc.applied == [ActionType.ROLLBACK_REVISION]


def test_cloudrun_executor_rolls_back_real_target():
    ctrl = _FakeController()
    svc = _FakeService("support-rag")
    assert _executor(ctrl).execute(_rollback(), svc) is True
    # the real Admin API was called …
    assert ctrl.calls == [("aegis-target", "aegis-target-00001-abc")]
    # … and the simulated twin was healed so Verify/MTTR still resolve
    assert svc.applied == [ActionType.ROLLBACK_REVISION]


def test_cloudrun_executor_skips_non_target_service():
    ctrl = _FakeController()
    svc = _FakeService("argus-review")
    assert _executor(ctrl).execute(_rollback(), svc) is True
    assert ctrl.calls == []  # no real API call for a non-target service
    assert svc.applied == [ActionType.ROLLBACK_REVISION]


def test_cloudrun_executor_skips_non_rollback_action():
    ctrl = _FakeController()
    svc = _FakeService("support-rag")
    scale = build_action(ActionType.SCALE_SERVICE, rationale="test")
    assert _executor(ctrl).execute(scale, svc) is True
    assert ctrl.calls == []  # only rollback actions hit Cloud Run here
    assert svc.applied == [ActionType.SCALE_SERVICE]


def test_cloudrun_executor_degrades_to_simulated_on_error():
    ctrl = _FakeController(boom=True)
    svc = _FakeService("support-rag")
    # real call raises → degrade to simulated; the loop must never crash
    assert _executor(ctrl).execute(_rollback(), svc) is True
    assert svc.applied == [ActionType.ROLLBACK_REVISION]


def test_build_executor_demo_mode_is_simulated():
    assert isinstance(build_executor(Settings(AEGIS_DEMO_MODE=True)), SimulatedExecutor)


def test_build_executor_cloud_without_target_is_simulated():
    s = Settings(AEGIS_DEMO_MODE=False, AEGIS_CLOUDRUN_TARGET_SERVICE="")
    assert isinstance(build_executor(s), SimulatedExecutor)


def test_build_executor_cloud_with_target_is_real():
    s = Settings(
        AEGIS_DEMO_MODE=False,
        AEGIS_CLOUDRUN_TARGET_SERVICE="aegis-target",
        AEGIS_CLOUDRUN_TARGET_ID="support-rag",
        AEGIS_CLOUDRUN_GOOD_REVISION="aegis-target-00001-abc",
        GOOGLE_CLOUD_PROJECT="proj",
    )
    assert isinstance(build_executor(s), CloudRunExecutor)

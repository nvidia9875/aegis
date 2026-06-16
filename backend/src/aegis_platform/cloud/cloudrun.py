"""Real Cloud Run remediation via the Admin API (google-cloud-run / run_v2).

This is the single path where Aegis's Act leaves the simulator and touches real
infrastructure: a ROLLBACK_REVISION action rewrites a live Cloud Run service's
traffic split to send 100% to a known-good revision. ``run_v2`` is imported
lazily so demo mode never needs the dependency, and any real-infra error degrades
to the simulated executor — the loop must never crash because GCP hiccuped.
"""

from __future__ import annotations

import logging
from typing import Any

from aegis_platform.common.schemas import ActionType, RemediationAction
from aegis_platform.operator.executor import RemediationExecutor, SimulatedExecutor

logger = logging.getLogger("aegis.cloud.cloudrun")

# Actions that map to a real Cloud Run traffic rollback.
_REAL_ACTIONS: frozenset[ActionType] = frozenset(
    {ActionType.ROLLBACK_REVISION, ActionType.ROLLBACK_PROMPT}
)


class CloudRunError(RuntimeError):
    """Raised when a real Cloud Run Admin API call fails."""


class CloudRunController:
    """Thin wrapper over ``run_v2.ServicesClient`` for traffic rollback.

    ``client`` is injectable so the routing logic can be exercised in tests
    without the google-cloud-run dependency or a live project.
    """

    def __init__(self, project: str, region: str, client: Any | None = None) -> None:
        self._project = project
        self._region = region
        self._client: Any = client

    def _service_path(self, service_name: str) -> str:
        return f"projects/{self._project}/locations/{self._region}/services/{service_name}"

    def rollback_to_revision(self, service_name: str, target_revision: str) -> bool:
        """Route 100% of traffic to ``target_revision``. Returns True once applied."""
        try:
            from google.cloud import run_v2
        except ImportError as exc:  # pragma: no cover - depends on optional extra
            raise CloudRunError("google-cloud-run not installed") from exc

        client = self._client or run_v2.ServicesClient()
        service = client.get_service(name=self._service_path(service_name))
        service.traffic = [
            run_v2.TrafficTarget(
                type_=run_v2.TrafficTargetAllocationType.TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION,
                revision=target_revision,
                percent=100,
            )
        ]
        client.update_service(service=service).result()
        logger.info("cloud run rollback: %s → %s (100%%)", service_name, target_revision)
        return True


class CloudRunExecutor:
    """Real executor: the designated target's rollback hits GCP; all else simulated.

    For the configured target service + a rollback action, this performs a genuine
    Cloud Run traffic rollback, then also heals the simulated twin so the loop's
    Verify/MTTR still resolve in demo state (the *action* is real; metric recovery
    in demo mode is simulated). Any failure degrades to the simulated executor.
    """

    def __init__(
        self,
        controller: CloudRunController,
        *,
        target_service_id: str,
        run_service_name: str,
        good_revision: str,
        fallback: RemediationExecutor | None = None,
    ) -> None:
        self._controller = controller
        self._target_service_id = target_service_id
        self._run_service_name = run_service_name
        self._good_revision = good_revision
        self._fallback: RemediationExecutor = fallback or SimulatedExecutor()

    def execute(self, action: RemediationAction, service: object) -> bool:
        service_id = getattr(getattr(service, "ref", None), "id", None)
        is_target = service_id == self._target_service_id and action.type in _REAL_ACTIONS
        if not is_target:
            return self._fallback.execute(action, service)
        try:
            applied = self._controller.rollback_to_revision(
                self._run_service_name, self._good_revision
            )
        except Exception as exc:  # real infra must never crash the loop
            logger.warning("cloud run rollback failed (%s) — degrading to simulated", exc)
            return self._fallback.execute(action, service)
        # Heal the simulated twin so Verify/MTTR resolve in demo state.
        self._fallback.execute(action, service)
        return bool(applied)

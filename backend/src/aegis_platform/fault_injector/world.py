"""SimulatedService — a deterministic stand-in for a live AI service in demo mode.

Injecting a fault shifts metrics and records a deploy event; applying the *correct*
remediation restores baselines. This makes the whole self-heal loop reproducible and
demo-safe without live Google Cloud.
"""

from __future__ import annotations

from aegis_platform.common.schemas import Deploy, MetricKind, MetricSample, ServiceRef
from aegis_platform.fault_injector.faults import Fault
from aegis_platform.telemetry import Baseline

_DEMO_BASELINES: dict[MetricKind, Baseline] = {
    MetricKind.GROUNDEDNESS: Baseline(0.92, 0.02),
    MetricKind.RETRIEVAL_HEALTH: Baseline(0.98, 0.02),
    MetricKind.COST_PER_REQ_USD: Baseline(0.010, 0.001),
    MetricKind.LATENCY_P95_MS: Baseline(140.0, 15.0),
    MetricKind.ERROR_RATE: Baseline(0.01, 0.005),
    MetricKind.HALLUCINATION_RATE: Baseline(0.02, 0.01),
    MetricKind.PII_RATE: Baseline(0.0, 0.01),
}


class SimulatedService:
    def __init__(self, ref: ServiceRef, baselines: dict[MetricKind, Baseline]) -> None:
        self.ref = ref
        self.baselines = dict(baselines)
        self._current: dict[MetricKind, float] = {k: b.mean for k, b in baselines.items()}
        self._active_fault: Fault | None = None
        self._deploys: list[Deploy] = []

    def inject(self, fault: Fault, revision: str = "rev-bad") -> None:
        self._active_fault = fault
        for kind, value in fault.shifts.items():
            self._current[kind] = value
        self._deploys.append(
            Deploy(service_id=self.ref.id, revision=revision, kind=fault.trigger, summary=fault.id)
        )

    def apply_action(self, action_type) -> bool:
        """Returns True if the action addresses the active fault and restored health."""
        if self._active_fault is not None and action_type is self._active_fault.fixed_by:
            self._current = {k: b.mean for k, b in self.baselines.items()}
            self._active_fault = None
            return True
        return False

    def sample(self, kind: MetricKind) -> MetricSample:
        mean = self.baselines[kind].mean
        return MetricSample(service_id=self.ref.id, kind=kind, value=self._current.get(kind, mean))

    @property
    def recent_deploys(self) -> tuple[Deploy, ...]:
        return tuple(self._deploys)

    @property
    def is_healthy(self) -> bool:
        return self._active_fault is None


def build_demo_service(
    service_id: str,
    name: str | None = None,
    capabilities: tuple[str, ...] = ("rag", "tool_use"),
) -> SimulatedService:
    ref = ServiceRef(id=service_id, name=name or service_id, capabilities=capabilities)
    return SimulatedService(ref, _DEMO_BASELINES)

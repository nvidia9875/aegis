"""Per-metric monitoring: feed samples, emit a confidence-scored Anomaly on shift."""

from __future__ import annotations

from dataclasses import dataclass

from aegis_platform.common.schemas import HIGHER_IS_BETTER, Anomaly, MetricKind, MetricSample
from aegis_platform.telemetry.detectors import CusumDetector

_EPS = 1e-9


@dataclass(frozen=True)
class Baseline:
    mean: float
    std: float


class MetricMonitor:
    """Watches one (service, metric) for a shift in the *bad* direction.

    For HIGHER_IS_BETTER metrics (e.g. groundedness) a drop is bad; otherwise a
    rise is bad. Confidence is a normalized z-distance from baseline.
    """

    def __init__(
        self,
        service_id: str,
        kind: MetricKind,
        baseline: Baseline,
        sensitivity: float = 3.0,
    ) -> None:
        self.service_id = service_id
        self.kind = kind
        self.baseline = baseline
        self.sensitivity = sensitivity
        self._std_eff = max(baseline.std, _EPS)
        self._direction = "down" if kind in HIGHER_IS_BETTER else "up"
        self._cusum = CusumDetector(
            target=baseline.mean,
            slack=0.5 * self._std_eff,
            threshold=sensitivity * self._std_eff,
            direction=self._direction,
        )

    def observe(self, sample: MetricSample) -> Anomaly | None:
        if not self._cusum.update(sample.value):
            return None
        z = abs(sample.value - self.baseline.mean) / self._std_eff
        confidence = min(1.0, z / (2 * self.sensitivity))
        return Anomaly(
            service_id=self.service_id,
            kind=self.kind,
            baseline=self.baseline.mean,
            observed=sample.value,
            direction=self._direction,
            confidence=confidence,
        )

    def reset(self) -> None:
        self._cusum.reset()

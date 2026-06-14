"""TDD for telemetry: CUSUM/SPRT detectors, metric monitoring, incident classification.

Detectors are deterministic so demos are reproducible and tests are exact.
"""

from __future__ import annotations

from aegis_platform.common.schemas import (
    IncidentClass,
    MetricKind,
    MetricSample,
    Severity,
)
from aegis_platform.telemetry import (
    Baseline,
    CusumDetector,
    IncidentDetector,
    MetricMonitor,
    SprtDecision,
    SprtDetector,
)


class TestCusum:
    def test_no_trigger_on_stable_stream(self) -> None:
        d = CusumDetector(target=0.9, slack=0.02, threshold=0.1, direction="down")
        for v in [0.90, 0.91, 0.89, 0.90, 0.92]:
            assert d.update(v) is False

    def test_triggers_on_downward_shift(self) -> None:
        d = CusumDetector(target=0.9, slack=0.02, threshold=0.1, direction="down")
        assert d.update(0.6) is True  # 0.88 - 0.6 = 0.28 > 0.1

    def test_triggers_on_upward_shift(self) -> None:
        d = CusumDetector(target=100.0, slack=5.0, threshold=50.0, direction="up")
        assert d.update(300.0) is True


class TestSprt:
    def test_accepts_h1_on_shift(self) -> None:
        d = SprtDetector(mu0=0.9, mu1=0.6, sigma=0.1, alpha=0.05, beta=0.05)
        assert d.update(0.6) is SprtDecision.ACCEPT_H1

    def test_accepts_h0_on_baseline(self) -> None:
        d = SprtDetector(mu0=0.9, mu1=0.6, sigma=0.1, alpha=0.05, beta=0.05)
        assert d.update(0.9) is SprtDecision.ACCEPT_H0

    def test_continue_when_ambiguous(self) -> None:
        d = SprtDetector(mu0=0.9, mu1=0.6, sigma=0.1, alpha=0.05, beta=0.05)
        assert d.update(0.75) is SprtDecision.CONTINUE  # exactly the midpoint


class TestMetricMonitor:
    def test_groundedness_drop_flags_down_anomaly(self) -> None:
        mon = MetricMonitor("svc", MetricKind.GROUNDEDNESS, Baseline(mean=0.9, std=0.02))
        assert mon.observe(MetricSample(service_id="svc", kind=MetricKind.GROUNDEDNESS, value=0.9)) is None
        anomaly = mon.observe(
            MetricSample(service_id="svc", kind=MetricKind.GROUNDEDNESS, value=0.55)
        )
        assert anomaly is not None
        assert anomaly.direction == "down"
        assert anomaly.confidence > 0.5

    def test_latency_rise_flags_up_anomaly(self) -> None:
        mon = MetricMonitor("svc", MetricKind.LATENCY_P95_MS, Baseline(mean=120.0, std=15.0))
        assert mon.observe(MetricSample(service_id="svc", kind=MetricKind.LATENCY_P95_MS, value=125.0)) is None
        anomaly = mon.observe(
            MetricSample(service_id="svc", kind=MetricKind.LATENCY_P95_MS, value=900.0)
        )
        assert anomaly is not None
        assert anomaly.direction == "up"

    def test_stable_stream_no_anomaly(self) -> None:
        mon = MetricMonitor("svc", MetricKind.COST_PER_REQ_USD, Baseline(mean=0.01, std=0.001))
        for v in [0.010, 0.0105, 0.0098, 0.0101]:
            assert mon.observe(
                MetricSample(service_id="svc", kind=MetricKind.COST_PER_REQ_USD, value=v)
            ) is None


class TestIncidentDetector:
    def _anomaly(self, kind: MetricKind, value: float, baseline: float, conf: float):
        from aegis_platform.common.schemas import Anomaly

        direction = "down" if value < baseline else "up"
        return Anomaly(
            service_id="svc", kind=kind, baseline=baseline, observed=value,
            direction=direction, confidence=conf,
        )

    def test_classifies_groundedness_regression(self) -> None:
        det = IncidentDetector()
        inc = det.classify([self._anomaly(MetricKind.GROUNDEDNESS, 0.55, 0.9, 0.95)])
        assert inc.incident_class is IncidentClass.GROUNDEDNESS_REGRESSION
        assert inc.severity is Severity.CRITICAL

    def test_classifies_cost_explosion_warning(self) -> None:
        det = IncidentDetector()
        inc = det.classify([self._anomaly(MetricKind.COST_PER_REQ_USD, 0.05, 0.01, 0.7)])
        assert inc.incident_class is IncidentClass.COST_EXPLOSION
        assert inc.severity is Severity.WARNING

    def test_high_confidence_escalates_severity(self) -> None:
        det = IncidentDetector()
        inc = det.classify([self._anomaly(MetricKind.COST_PER_REQ_USD, 0.08, 0.01, 0.95)])
        assert inc.severity is Severity.CRITICAL

    def test_picks_highest_confidence_anomaly_as_primary(self) -> None:
        det = IncidentDetector()
        inc = det.classify([
            self._anomaly(MetricKind.LATENCY_P95_MS, 500, 120, 0.6),
            self._anomaly(MetricKind.GROUNDEDNESS, 0.5, 0.9, 0.95),
        ])
        assert inc.incident_class is IncidentClass.GROUNDEDNESS_REGRESSION

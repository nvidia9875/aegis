"""Turn anomalies into a classified, severity-scored Incident."""

from __future__ import annotations

from collections.abc import Sequence

from aegis_platform.common.schemas import (
    Anomaly,
    Incident,
    IncidentClass,
    IncidentStatus,
    MetricKind,
    Severity,
)

_CLASS_BY_METRIC: dict[MetricKind, IncidentClass] = {
    MetricKind.GROUNDEDNESS: IncidentClass.GROUNDEDNESS_REGRESSION,
    MetricKind.RETRIEVAL_HEALTH: IncidentClass.DEPENDENCY_OUTAGE,
    MetricKind.HALLUCINATION_RATE: IncidentClass.HALLUCINATION_SPIKE,
    MetricKind.PII_RATE: IncidentClass.PII_LEAK,
    MetricKind.ERROR_RATE: IncidentClass.ERROR_RATE_SPIKE,
    MetricKind.LATENCY_P95_MS: IncidentClass.LATENCY_DEGRADATION,
    MetricKind.COST_PER_REQ_USD: IncidentClass.COST_EXPLOSION,
    MetricKind.TOKENS_PER_REQ: IncidentClass.COST_EXPLOSION,
}

_CRITICAL_CLASSES: frozenset[IncidentClass] = frozenset({
    IncidentClass.PII_LEAK,
    IncidentClass.ERROR_RATE_SPIKE,
    IncidentClass.GROUNDEDNESS_REGRESSION,
    IncidentClass.DEPENDENCY_OUTAGE,
    IncidentClass.PROMPT_INJECTION,
})


class IncidentDetector:
    def classify(self, anomalies: Sequence[Anomaly]) -> Incident:
        if not anomalies:
            raise ValueError("cannot classify an empty anomaly set")
        primary = max(anomalies, key=lambda a: a.confidence)
        incident_class = _CLASS_BY_METRIC.get(primary.kind, IncidentClass.UNKNOWN)
        return Incident(
            service_id=primary.service_id,
            incident_class=incident_class,
            severity=self._severity(incident_class, primary.confidence),
            anomalies=tuple(anomalies),
            status=IncidentStatus.OPEN,
        )

    @staticmethod
    def _severity(incident_class: IncidentClass, confidence: float) -> Severity:
        if confidence >= 0.9:
            return Severity.CRITICAL
        if confidence >= 0.8 and incident_class in _CRITICAL_CLASSES:
            return Severity.CRITICAL
        return Severity.WARNING

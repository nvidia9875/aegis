"""Telemetry — anomaly detection (CUSUM/SPRT), metric monitoring, incident classification."""

from aegis_platform.telemetry.detectors import CusumDetector, SprtDecision, SprtDetector
from aegis_platform.telemetry.incidents import IncidentDetector
from aegis_platform.telemetry.monitor import Baseline, MetricMonitor

__all__ = [
    "Baseline",
    "CusumDetector",
    "IncidentDetector",
    "MetricMonitor",
    "SprtDecision",
    "SprtDetector",
]

"""Complexity router — start cheap, escalate to deep only when warranted.

Embodies "the model spends, the harness budgets": routine triage runs on cheap/fast
tiers, and only novel or high-stakes situations are escalated to the deep model.
"""

from __future__ import annotations

from aegis_platform.common.schemas import Severity
from aegis_platform.model_service.types import ModelTier, RoutingSignals

_SEVERITY_SCORE: dict[Severity, float] = {
    Severity.INFO: 0.1,
    Severity.WARNING: 0.5,
    Severity.CRITICAL: 1.0,
}


class ComplexityRouter:
    def __init__(self, fast_threshold: float = 0.25, deep_threshold: float = 0.6) -> None:
        self.fast_threshold = fast_threshold
        self.deep_threshold = deep_threshold

    def score(self, signals: RoutingSignals) -> float:
        return (
            0.5 * _SEVERITY_SCORE[signals.severity]
            + 0.3 * signals.novelty
            + 0.2 * signals.stakes
        )

    def route(self, signals: RoutingSignals) -> ModelTier:
        if signals.force_tier is not None:
            return signals.force_tier
        s = self.score(signals)
        if s >= self.deep_threshold:
            return ModelTier.DEEP
        if s >= self.fast_threshold:
            return ModelTier.FAST
        return ModelTier.CHEAP

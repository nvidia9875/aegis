"""ModelService — routes a request to a tier, meters cost, supports escalation & failover."""

from __future__ import annotations

from collections.abc import Callable

from aegis_platform.model_service.cost import CostMeter
from aegis_platform.model_service.router import ComplexityRouter
from aegis_platform.model_service.types import (
    Completion,
    ModelTier,
    Provider,
    ProviderError,
    RoutingSignals,
)

# Order tried during failover (the routed tier is always attempted first).
_FAILOVER_ORDER: tuple[ModelTier, ...] = (ModelTier.FAST, ModelTier.DEEP, ModelTier.CHEAP)


class ModelService:
    def __init__(
        self,
        providers: dict[ModelTier, Provider],
        router: ComplexityRouter | None = None,
        meter: CostMeter | None = None,
    ) -> None:
        self.providers = providers
        self.router = router or ComplexityRouter()
        self.meter = meter or CostMeter()

    def _call(self, tier: ModelTier, prompt: str, system: str | None) -> Completion:
        provider = self.providers[tier]
        text, usage = provider.generate(prompt, system=system)
        cost = self.meter.cost_usd(
            provider.model, usage.input_tokens, usage.output_tokens, record=True
        )
        return Completion(
            text=text, tier=tier, model=provider.model, usage=usage, cost_usd=cost
        )

    def complete(
        self,
        prompt: str,
        signals: RoutingSignals,
        *,
        system: str | None = None,
        failover: bool = False,
    ) -> Completion:
        routed = self.router.route(signals)
        if not failover:
            return self._call(routed, prompt, system)

        order = [routed, *(t for t in _FAILOVER_ORDER if t != routed)]
        last_error: ProviderError | None = None
        for tier in order:
            if tier not in self.providers:
                continue
            try:
                return self._call(tier, prompt, system)
            except ProviderError as exc:  # try the next tier
                last_error = exc
        raise last_error or ProviderError("no providers available")

    def complete_with_escalation(
        self,
        prompt: str,
        signals: RoutingSignals,
        confidence_fn: Callable[[str], float],
        *,
        min_confidence: float = 0.6,
        system: str | None = None,
    ) -> Completion:
        """Run the routed tier; if the answer looks low-confidence, escalate to DEEP."""
        first = self.complete(prompt, signals, system=system)
        if first.tier is ModelTier.DEEP or confidence_fn(first.text) >= min_confidence:
            return first
        return self._call(ModelTier.DEEP, prompt, system)

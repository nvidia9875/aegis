"""TDD for the Model Service: cost metering, complexity routing, escalation, failover.

These tests use a FakeProvider so the pure routing/cost/failover logic is verified
without any network or GCP dependency.
"""

from __future__ import annotations

import pytest

from aegis_platform.common.schemas import Severity
from aegis_platform.model_service import (
    ComplexityRouter,
    CostMeter,
    ModelService,
    ModelTier,
    ProviderError,
    RoutingSignals,
)
from aegis_platform.model_service.providers.fake import FakeProvider

# ── CostMeter ─────────────────────────────────────────────────────────────────


class TestCostMeter:
    def test_known_model_cost(self) -> None:
        meter = CostMeter()
        # gemini-2.5-pro: 1.25 / 10.00 USD per 1M (in/out)
        cost = meter.cost_usd("gemini-2.5-pro", input_tokens=1000, output_tokens=500)
        assert cost == pytest.approx(1000 / 1e6 * 1.25 + 500 / 1e6 * 10.0)

    def test_unknown_model_falls_back_to_default(self) -> None:
        meter = CostMeter()
        assert meter.cost_usd("mystery-model", 1000, 1000) > 0.0

    def test_records_cumulative_total(self) -> None:
        meter = CostMeter()
        meter.cost_usd("gemini-2.5-flash", 1000, 1000, record=True)
        meter.cost_usd("gemini-2.5-flash", 1000, 1000, record=True)
        assert meter.total_usd == pytest.approx(
            2 * meter.cost_usd("gemini-2.5-flash", 1000, 1000)
        )

    def test_cheap_tier_is_cheaper_than_deep(self) -> None:
        meter = CostMeter()
        cheap = meter.cost_usd("gemma-3", 1000, 1000)
        deep = meter.cost_usd("gemini-2.5-pro", 1000, 1000)
        assert cheap < deep


# ── ComplexityRouter ──────────────────────────────────────────────────────────


class TestComplexityRouter:
    def test_force_tier_overrides(self) -> None:
        router = ComplexityRouter()
        sig = RoutingSignals(severity=Severity.INFO, force_tier=ModelTier.DEEP)
        assert router.route(sig) is ModelTier.DEEP

    def test_low_severity_routine_routes_cheap(self) -> None:
        router = ComplexityRouter()
        assert router.route(RoutingSignals(severity=Severity.INFO)) is ModelTier.CHEAP

    def test_warning_routes_fast(self) -> None:
        router = ComplexityRouter()
        assert router.route(RoutingSignals(severity=Severity.WARNING)) is ModelTier.FAST

    def test_critical_novel_high_stakes_routes_deep(self) -> None:
        router = ComplexityRouter()
        sig = RoutingSignals(severity=Severity.CRITICAL, novelty=0.6, stakes=0.5)
        assert router.route(sig) is ModelTier.DEEP


# ── ModelService ──────────────────────────────────────────────────────────────


def _service(*, fast_fails: bool = False) -> ModelService:
    providers = {
        ModelTier.CHEAP: FakeProvider("cheap", "gemma-3", text="cheap-ans"),
        ModelTier.FAST: FakeProvider("fast", "gemini-2.5-flash", text="fast-ans", fail=fast_fails),
        ModelTier.DEEP: FakeProvider("deep", "gemini-2.5-pro", text="deep-ans"),
    }
    return ModelService(providers=providers, router=ComplexityRouter(), meter=CostMeter())


class TestModelService:
    def test_complete_routes_and_meters_cost(self) -> None:
        svc = _service()
        out = svc.complete("diagnose", RoutingSignals(severity=Severity.WARNING))
        assert out.tier is ModelTier.FAST
        assert out.model == "gemini-2.5-flash"
        assert out.text == "fast-ans"
        assert out.cost_usd > 0.0

    def test_escalates_to_deep_when_confidence_low(self) -> None:
        svc = _service()
        out = svc.complete_with_escalation(
            "diagnose",
            RoutingSignals(severity=Severity.WARNING),  # routes FAST initially
            confidence_fn=lambda _text: 0.2,             # too low → escalate
            min_confidence=0.6,
        )
        assert out.tier is ModelTier.DEEP
        assert out.text == "deep-ans"

    def test_no_escalation_when_confidence_high(self) -> None:
        svc = _service()
        out = svc.complete_with_escalation(
            "diagnose",
            RoutingSignals(severity=Severity.WARNING),
            confidence_fn=lambda _text: 0.9,
            min_confidence=0.6,
        )
        assert out.tier is ModelTier.FAST

    def test_failover_to_deep_when_routed_provider_errors(self) -> None:
        svc = _service(fast_fails=True)
        out = svc.complete(
            "diagnose",
            RoutingSignals(severity=Severity.WARNING),  # routes FAST, which fails
            failover=True,
        )
        assert out.tier is ModelTier.DEEP
        assert out.text == "deep-ans"

    def test_raises_when_failover_disabled_and_provider_errors(self) -> None:
        svc = _service(fast_fails=True)
        with pytest.raises(ProviderError):
            svc.complete("diagnose", RoutingSignals(severity=Severity.WARNING), failover=False)

    def test_cumulative_cost_tracked_across_calls(self) -> None:
        svc = _service()
        svc.complete("a", RoutingSignals(severity=Severity.WARNING))
        svc.complete("b", RoutingSignals(severity=Severity.CRITICAL, novelty=0.8, stakes=0.7))
        assert svc.meter.total_usd > 0.0

"""Cost metering — per-model token pricing with cumulative attribution.

Prices are USD per 1M tokens (input, output), representative of Gemini tiers.
Cost attribution is a first-class platform concern (Book 2): every model call is
priced so the complexity router's savings can be proven on the dashboard.
"""

from __future__ import annotations

# USD per 1,000,000 tokens: (input, output)
PRICES: dict[str, tuple[float, float]] = {
    "gemini-2.5-pro": (1.25, 10.00),
    "gemini-2.5-flash": (0.30, 2.50),
    "gemma-3": (0.05, 0.10),
}

_DEFAULT_PRICE: tuple[float, float] = (0.30, 2.50)


class CostMeter:
    def __init__(self) -> None:
        self._total_usd: float = 0.0

    @property
    def total_usd(self) -> float:
        return self._total_usd

    def cost_usd(
        self, model: str, input_tokens: int, output_tokens: int, *, record: bool = False
    ) -> float:
        in_price, out_price = PRICES.get(model, _DEFAULT_PRICE)
        cost = (input_tokens / 1e6) * in_price + (output_tokens / 1e6) * out_price
        if record:
            self._total_usd += cost
        return cost

    def reset(self) -> None:
        self._total_usd = 0.0

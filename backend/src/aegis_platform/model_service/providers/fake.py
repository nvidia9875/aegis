"""Deterministic in-memory provider for tests and demo mode (no network)."""

from __future__ import annotations

from aegis_platform.model_service.types import ProviderError, Usage


class FakeProvider:
    def __init__(
        self,
        name: str,
        model: str,
        *,
        text: str = "ok",
        input_tokens: int = 120,
        output_tokens: int = 64,
        fail: bool = False,
    ) -> None:
        self.name = name
        self.model = model
        self.text = text
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens
        self.fail = fail
        self.calls = 0

    def generate(self, prompt: str, *, system: str | None = None) -> tuple[str, Usage]:
        self.calls += 1
        if self.fail:
            raise ProviderError(f"{self.name} provider failed")
        return self.text, Usage(input_tokens=self.input_tokens, output_tokens=self.output_tokens)

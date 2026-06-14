"""Model Service types: tiers, usage, completions, routing signals, provider protocol."""

from __future__ import annotations

from enum import Enum
from typing import Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict

from aegis_platform.common.schemas import Severity


class ModelTier(str, Enum):
    CHEAP = "cheap"   # e.g. Gemma — routine, high-volume
    FAST = "fast"     # e.g. Gemini Flash — default triage
    DEEP = "deep"     # e.g. Gemini Pro — hard RCA / reflection only


class Usage(BaseModel):
    model_config = ConfigDict(frozen=True)

    input_tokens: int = 0
    output_tokens: int = 0


class Completion(BaseModel):
    model_config = ConfigDict(frozen=True)

    text: str
    tier: ModelTier
    model: str
    usage: Usage
    cost_usd: float


class RoutingSignals(BaseModel):
    """Inputs the complexity router uses to pick a tier (bounded resource allocation)."""

    model_config = ConfigDict(frozen=True)

    severity: Severity = Severity.WARNING
    novelty: float = 0.0   # 0..1 — how unfamiliar the situation is (KB miss → high)
    stakes: float = 0.0    # 0..1 — blast radius / criticality
    force_tier: ModelTier | None = None


class ProviderError(RuntimeError):
    """Raised when a model provider call fails (triggers failover)."""


@runtime_checkable
class Provider(Protocol):
    name: str
    model: str

    def generate(self, prompt: str, *, system: str | None = None) -> tuple[str, Usage]: ...

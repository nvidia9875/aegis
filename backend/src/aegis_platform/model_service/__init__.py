"""Model Service — provider-agnostic LLM gateway, complexity router, cost metering."""

from aegis_platform.model_service.cost import PRICES, CostMeter
from aegis_platform.model_service.router import ComplexityRouter
from aegis_platform.model_service.service import ModelService
from aegis_platform.model_service.types import (
    Completion,
    ModelTier,
    Provider,
    ProviderError,
    RoutingSignals,
    Usage,
)

__all__ = [
    "PRICES",
    "Completion",
    "ComplexityRouter",
    "CostMeter",
    "ModelService",
    "ModelTier",
    "Provider",
    "ProviderError",
    "RoutingSignals",
    "Usage",
]

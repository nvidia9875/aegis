"""Cloud-mode adapters — real Gemini + ADK behind the same Protocols as demo mode.

Everything here is lazily imported and opt-in (AEGIS_DEMO_MODE=false). Demo mode never
touches Google Cloud, keeping the canonical demo deterministic and reproducible.
"""

from aegis_platform.cloud.factory import build_diagnoser
from aegis_platform.cloud.gemini import GeminiDiagnoser, GeminiProvider, build_model_service
from aegis_platform.cloud.rca import (
    RcaDecision,
    RcaParseError,
    build_rca_prompt,
    decision_to_diagnosis,
    parse_rca,
)

__all__ = [
    "GeminiDiagnoser",
    "GeminiProvider",
    "RcaDecision",
    "RcaParseError",
    "build_diagnoser",
    "build_model_service",
    "build_rca_prompt",
    "decision_to_diagnosis",
    "parse_rca",
]

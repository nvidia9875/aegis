"""Factory — pick the diagnoser/operator for the active mode (demo vs cloud).

demo mode  → deterministic RunbookDiagnoser (no Google Cloud, reproducible).
cloud mode → ADK-orchestrated Gemini RCA, degrading to Gemini-direct then runbook.
"""

from __future__ import annotations

import logging

from aegis_platform.cloud.gemini import GeminiDiagnoser, build_model_service
from aegis_platform.common.config import Settings, get_settings
from aegis_platform.operator.diagnoser import Diagnoser, RunbookDiagnoser

logger = logging.getLogger("aegis.cloud.factory")


def build_diagnoser(settings: Settings | None = None) -> Diagnoser:
    """Return the diagnoser for the active mode (safe default: runbook)."""
    s = settings or get_settings()
    if s.demo_mode:
        return RunbookDiagnoser()

    gemini = GeminiDiagnoser(build_model_service(s))
    try:
        import google.adk  # noqa: F401 — presence check only

        from aegis_platform.cloud.adk import AdkDiagnoser

        logger.info("cloud mode: ADK-orchestrated Gemini RCA (model=%s)", s.model_fast)
        return AdkDiagnoser(model=s.model_fast, fallback=gemini, settings=s)
    except Exception as exc:
        logger.info("ADK unavailable (%s) — using Gemini-direct RCA", exc)
        return gemini

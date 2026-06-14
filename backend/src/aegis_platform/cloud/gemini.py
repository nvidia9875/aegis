"""Gemini-backed cloud adapters: a Provider for the Model Service + a Diagnoser.

google-genai is imported lazily so the package imports cleanly without the ``gcp``
extra (demo mode never touches Google Cloud). A ``client`` can be injected for tests.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from aegis_platform.cloud.rca import (
    RCA_SYSTEM_INSTRUCTION,
    RcaParseError,
    build_rca_prompt,
    decision_to_diagnosis,
    parse_rca,
)
from aegis_platform.common.config import Settings, get_settings
from aegis_platform.common.schemas import Deploy, Incident, RemediationAction, RootCause
from aegis_platform.model_service import ModelService, ModelTier, ProviderError, RoutingSignals, Usage
from aegis_platform.operator.diagnoser import RunbookDiagnoser

logger = logging.getLogger("aegis.cloud.gemini")


class GeminiProvider:
    """Provider Protocol impl backed by the Google Gen AI SDK (Gemini Dev API or Vertex)."""

    def __init__(self, model: str, *, settings: Settings | None = None, client: object | None = None) -> None:
        self.name = "gemini"
        self.model = model
        self._settings = settings or get_settings()
        self._client = client

    def _get_client(self) -> object:
        if self._client is None:
            from google import genai  # lazy — only needed in cloud mode

            s = self._settings
            if s.use_vertexai and s.google_cloud_project:
                self._client = genai.Client(
                    vertexai=True,
                    project=s.google_cloud_project,
                    location=s.google_cloud_region,
                )
            else:
                self._client = genai.Client(api_key=s.gemini_api_key)
        return self._client

    def generate(self, prompt: str, *, system: str | None = None) -> tuple[str, Usage]:
        try:
            client = self._get_client()
            config = None
            if system:
                from google.genai import types  # lazy — only when a system prompt is set

                config = types.GenerateContentConfig(system_instruction=system)
            response = client.models.generate_content(  # type: ignore[attr-defined]
                model=self.model, contents=prompt, config=config
            )
            text = getattr(response, "text", None) or ""
            usage = _usage_from(response)
            return text, usage
        except ProviderError:
            raise
        except Exception as exc:  # network/SDK/auth → uniform failover signal
            raise ProviderError(f"gemini generate failed ({self.model}): {exc}") from exc


def _usage_from(response: object) -> Usage:
    meta = getattr(response, "usage_metadata", None)
    return Usage(
        input_tokens=int(getattr(meta, "prompt_token_count", 0) or 0),
        output_tokens=int(getattr(meta, "candidates_token_count", 0) or 0),
    )


def build_model_service(settings: Settings | None = None) -> ModelService:
    """Wire one GeminiProvider per tier (cheap/fast/deep) for the complexity router."""
    s = settings or get_settings()
    providers = {
        ModelTier.CHEAP: GeminiProvider(s.model_cheap, settings=s),
        ModelTier.FAST: GeminiProvider(s.model_fast, settings=s),
        ModelTier.DEEP: GeminiProvider(s.model_deep, settings=s),
    }
    return ModelService(providers)


class GeminiDiagnoser:
    """Diagnoser Protocol impl: real Gemini RCA via the Model Service, runbook fallback.

    The complexity router escalates critical/novel incidents to the deep model (Gemini
    Pro) and triages the rest on cheaper tiers — "the model spends, the harness budgets".
    Any provider or parse failure degrades to the deterministic runbook so the heal loop
    never crashes.
    """

    def __init__(self, model_service: ModelService) -> None:
        self.model_service = model_service
        self._runbook = RunbookDiagnoser()

    def diagnose(
        self, incident: Incident, recent_deploys: Sequence[Deploy]
    ) -> tuple[RootCause, RemediationAction]:
        prompt = build_rca_prompt(incident, recent_deploys)
        signals = RoutingSignals(severity=incident.severity, novelty=0.8, stakes=0.7)
        try:
            completion = self.model_service.complete(
                prompt, signals, system=RCA_SYSTEM_INSTRUCTION, failover=True
            )
            decision = parse_rca(completion.text)
            return decision_to_diagnosis(decision, incident, recent_deploys)
        except (ProviderError, RcaParseError) as exc:
            logger.warning("Gemini RCA failed (%s) — falling back to runbook", exc)
            return self._runbook.diagnose(incident, recent_deploys)

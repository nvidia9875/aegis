"""Tests for the Gemini provider + diagnoser using injected fakes (no SDK, no network)."""

from __future__ import annotations

import types as _types

from aegis_platform.cloud.gemini import GeminiDiagnoser, GeminiProvider
from aegis_platform.common.schemas import (
    ActionType,
    Anomaly,
    ChangeKind,
    Deploy,
    Incident,
    IncidentClass,
    MetricKind,
    Severity,
)
from aegis_platform.model_service import ModelService, ModelTier
from aegis_platform.model_service.providers.fake import FakeProvider

# ── GeminiProvider ──────────────────────────────────────────────────────────────


class _FakeModels:
    def __init__(self, response: object) -> None:
        self._response = response
        self.calls: list[dict] = []

    def generate_content(self, *, model, contents, config=None):
        self.calls.append({"model": model, "contents": contents, "config": config})
        return self._response


class _FakeClient:
    def __init__(self, response: object) -> None:
        self.models = _FakeModels(response)


def _fake_response(text: str, prompt_tokens: int, out_tokens: int) -> object:
    return _types.SimpleNamespace(
        text=text,
        usage_metadata=_types.SimpleNamespace(
            prompt_token_count=prompt_tokens, candidates_token_count=out_tokens
        ),
    )


def test_provider_returns_text_and_usage():
    client = _FakeClient(_fake_response("hello", 120, 30))
    provider = GeminiProvider("gemini-2.5-flash", client=client)
    text, usage = provider.generate("hi")  # system=None → no SDK import
    assert text == "hello"
    assert usage.input_tokens == 120
    assert usage.output_tokens == 30
    assert client.models.calls[0]["model"] == "gemini-2.5-flash"


def test_provider_wraps_sdk_errors_as_provider_error():
    from aegis_platform.model_service import ProviderError

    class _Boom:
        @property
        def models(self):
            raise RuntimeError("network down")

    provider = GeminiProvider("gemini-2.5-flash", client=_Boom())
    try:
        provider.generate("hi")
    except ProviderError as exc:
        assert "gemini generate failed" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("expected ProviderError")


# ── GeminiDiagnoser ─────────────────────────────────────────────────────────────


def _incident() -> Incident:
    return Incident(
        service_id="support-rag",
        incident_class=IncidentClass.GROUNDEDNESS_REGRESSION,
        severity=Severity.CRITICAL,
        anomalies=(
            Anomaly(
                service_id="support-rag",
                kind=MetricKind.GROUNDEDNESS,
                baseline=0.92,
                observed=0.55,
                direction="down",
                confidence=0.97,
            ),
        ),
    )


def _deploys() -> tuple[Deploy, ...]:
    return (Deploy(service_id="support-rag", revision="rev-bad", kind=ChangeKind.PROMPT, summary="tweak"),)


def _service_returning(text: str) -> ModelService:
    # Same canned completion at every tier — router choice doesn't matter for the test.
    provider = FakeProvider("fake", "gemini-2.5-flash", text=text)
    return ModelService({t: provider for t in ModelTier})


def test_diagnoser_uses_model_decision():
    text = (
        '{"incident_class": "groundedness_regression", "suspected_revision": "rev-bad", '
        '"action_type": "rollback_prompt", "confidence": 0.9, "rationale": "prompt regressed"}'
    )
    diagnoser = GeminiDiagnoser(_service_returning(text))
    root_cause, action = diagnoser.diagnose(_incident(), _deploys())
    assert action.type is ActionType.ROLLBACK_PROMPT
    assert root_cause.suspected_change.revision == "rev-bad"
    assert "source: gemini-rca" in root_cause.evidence


def test_diagnoser_falls_back_to_runbook_on_bad_json():
    diagnoser = GeminiDiagnoser(_service_returning("the model rambled, no json here"))
    root_cause, action = diagnoser.diagnose(_incident(), _deploys())
    # runbook maps groundedness_regression → rollback_prompt
    assert action.type is ActionType.ROLLBACK_PROMPT
    assert root_cause.suspected_change is not None  # runbook diagnoser still attributes the deploy

"""Tests for diagnoser selection by mode + cloud-mode integration through the operator."""

from __future__ import annotations

import pytest

from aegis_platform.cloud.factory import build_diagnoser
from aegis_platform.cloud.gemini import GeminiDiagnoser
from aegis_platform.common.config import Autonomy, Settings
from aegis_platform.common.schemas import (
    ActionType,
    Anomaly,
    ChangeKind,
    Deploy,
    Incident,
    IncidentClass,
    IncidentStatus,
    MetricKind,
    Severity,
)
from aegis_platform.fault_injector import FAULTS, build_demo_service
from aegis_platform.model_service import ModelService, ModelTier
from aegis_platform.model_service.providers.fake import FakeProvider
from aegis_platform.operator import AegisOperator, RunbookDiagnoser, build_monitors


def _settings(**overrides) -> Settings:
    base = {"AEGIS_DEMO_MODE": True, "GOOGLE_GENAI_USE_VERTEXAI": False, "GEMINI_API_KEY": "x"}
    base.update(overrides)
    return Settings(**base)


def test_demo_mode_uses_runbook_diagnoser():
    diagnoser = build_diagnoser(_settings(AEGIS_DEMO_MODE=True))
    assert isinstance(diagnoser, RunbookDiagnoser)


def test_cloud_mode_uses_a_gemini_or_adk_diagnoser():
    # Without the gcp extra installed, the factory degrades to the Gemini-direct diagnoser.
    diagnoser = build_diagnoser(_settings(AEGIS_DEMO_MODE=False))
    klass = type(diagnoser).__name__
    assert klass in {"GeminiDiagnoser", "AdkDiagnoser"}


def test_cloud_diagnoser_drives_the_full_heal_loop():
    # A canned Gemini decision flows through the real operator loop and heals the service.
    decision = (
        '{"incident_class": "groundedness_regression", "suspected_revision": "rev-bad", '
        '"action_type": "rollback_prompt", "confidence": 0.92, "rationale": "prompt regressed"}'
    )
    provider = FakeProvider("fake", "gemini-2.5-flash", text=decision)
    diagnoser = GeminiDiagnoser(ModelService({t: provider for t in ModelTier}))

    op = AegisOperator(autonomy=Autonomy.GUARDED, diagnoser=diagnoser)
    svc = build_demo_service("support-rag")
    svc.inject(FAULTS["groundedness_regression"], revision="rev-bad")

    report = op.handle(svc, build_monitors(svc))
    assert report.status is IncidentStatus.RESOLVED
    assert report.actions[0].type is ActionType.ROLLBACK_PROMPT
    assert provider.calls >= 1  # the model was actually consulted


def test_adk_agent_builds_when_sdk_present():
    pytest.importorskip("google.adk")
    from aegis_platform.cloud.adk import build_rca_agent

    agent = build_rca_agent("gemini-2.5-flash")
    assert agent is not None


def test_adk_diagnoser_degrades_to_fallback_safely():
    # Without a configured ADK runtime, AdkDiagnoser must never crash the loop —
    # it falls back to the injected diagnoser (here: the deterministic runbook).
    from aegis_platform.cloud.adk import AdkDiagnoser

    incident = Incident(
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
    deploys = (Deploy(service_id="support-rag", revision="rev-bad", kind=ChangeKind.PROMPT, summary="tweak"),)

    diagnoser = AdkDiagnoser(model="gemini-2.5-flash", fallback=RunbookDiagnoser())
    root_cause, action = diagnoser.diagnose(incident, deploys)
    assert action.type is ActionType.ROLLBACK_PROMPT  # runbook fallback
    assert root_cause.suspected_change.revision == "rev-bad"

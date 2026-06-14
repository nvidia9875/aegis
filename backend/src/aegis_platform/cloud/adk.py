"""ADK-orchestrated RCA — the mandatory Agent Development Kit path.

An ADK ``LlmAgent`` runs the root-cause analysis (and, in cloud mode, drives the
Gemini call). google-adk is imported lazily; any failure degrades to the injected
fallback diagnoser (Gemini-direct → runbook), so the heal loop never breaks.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

from aegis_platform.cloud.rca import (
    RCA_SYSTEM_INSTRUCTION,
    build_rca_prompt,
    decision_to_diagnosis,
    parse_rca,
)
from aegis_platform.common.config import Settings, get_settings
from aegis_platform.common.schemas import Deploy, Incident, RemediationAction, RootCause
from aegis_platform.operator.diagnoser import Diagnoser

logger = logging.getLogger("aegis.cloud.adk")

_AGENT_NAME = "aegis_rca"
_APP_NAME = "aegis"
_USER_ID = "aegis-operator"


def build_rca_agent(model: str):
    """Construct the Aegis RCA agent (google.adk.agents.LlmAgent)."""
    from google.adk.agents import LlmAgent  # lazy

    return LlmAgent(
        name=_AGENT_NAME,
        description="Root-cause analysis and remediation selection for AI service incidents.",
        instruction=RCA_SYSTEM_INSTRUCTION,
        model=model,
    )


def run_rca_agent(agent, prompt: str, *, session_id: str = "rca") -> str:
    """Run the agent once and return the final text response."""
    import asyncio

    from google.adk.runners import InMemoryRunner
    from google.genai import types

    runner = InMemoryRunner(agent=agent, app_name=_APP_NAME)
    # InMemoryRunner uses an async session service; create the session before run().
    asyncio.run(
        runner.session_service.create_session(
            app_name=_APP_NAME, user_id=_USER_ID, session_id=session_id
        )
    )
    content = types.Content(role="user", parts=[types.Part(text=prompt)])

    final = ""
    for event in runner.run(user_id=_USER_ID, session_id=session_id, new_message=content):
        content_obj = getattr(event, "content", None)
        parts = getattr(content_obj, "parts", None) if content_obj else None
        if parts:
            for part in parts:
                text = getattr(part, "text", None)
                if text:
                    final = text
    return final


class AdkDiagnoser:
    """Diagnoser Protocol impl orchestrated by ADK; falls back on any failure."""

    def __init__(self, model: str, fallback: Diagnoser, *, settings: Settings | None = None) -> None:
        self.model = model
        self.fallback = fallback
        self._settings = settings or get_settings()
        self._agent = None

    def _agent_once(self):
        if self._agent is None:
            self._agent = build_rca_agent(self.model)
        return self._agent

    def diagnose(
        self, incident: Incident, recent_deploys: Sequence[Deploy]
    ) -> tuple[RootCause, RemediationAction]:
        try:
            text = run_rca_agent(self._agent_once(), build_rca_prompt(incident, recent_deploys))
            decision = parse_rca(text)
            return decision_to_diagnosis(decision, incident, recent_deploys)
        except Exception as exc:
            logger.warning("ADK RCA failed (%s) — using fallback diagnoser", exc)
            return self.fallback.diagnose(incident, recent_deploys)

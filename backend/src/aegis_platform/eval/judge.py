"""LLM-as-judge quality eval — groundedness scoring for the CI / eval gate.

A prompt or model change can silently wreck answer quality. This module scores the
*groundedness* of an answer against its retrieved context with a Gemini-based judge,
so the gate can block a regression before it ships. The 0..1 score is drop-in
compatible with Vertex AI Gen AI Evaluation pointwise groundedness metrics.

google-genai is only touched in cloud mode (via the injected Provider); the parsing
and protocols here are pure and deterministic for tests.
"""

from __future__ import annotations

import json
import re
from typing import Protocol, runtime_checkable

from aegis_platform.model_service.types import Provider

JUDGE_SYSTEM = (
    "You are a strict groundedness evaluator for a RAG assistant. Given CONTEXT and "
    "an ANSWER, rate how fully the answer is supported by the context. Reply ONLY with "
    'JSON: {"groundedness": <float 0..1>, "rationale": <str>}. '
    "1.0 = every claim supported; 0.0 = unsupported / hallucinated."
)

_FENCE = re.compile(r"^```(?:json)?|```$", re.MULTILINE)


@runtime_checkable
class Answerer(Protocol):
    """Produces an answer to a question under a given system prompt."""

    def answer(self, question: str, system_prompt: str) -> str: ...


@runtime_checkable
class QualityJudge(Protocol):
    """Scores the groundedness (0..1) of an answer against its context."""

    def score(self, question: str, context: str, answer: str) -> float: ...


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def parse_groundedness(text: str) -> float:
    """Parse the judge's JSON groundedness score; raises on unusable output."""
    data = json.loads(_FENCE.sub("", text).strip())
    return _clamp01(float(data["groundedness"]))


class GeminiAnswerer:
    """Generates an answer under a given system prompt via any Provider (Gemini in cloud)."""

    def __init__(self, provider: Provider) -> None:
        self._provider = provider

    def answer(self, question: str, system_prompt: str) -> str:
        text, _ = self._provider.generate(question, system=system_prompt)
        return text


class GeminiJudge:
    """Scores groundedness 0..1 with a Gemini-based LLM judge (fail-safe to 0.0)."""

    def __init__(self, provider: Provider) -> None:
        self._provider = provider

    def score(self, question: str, context: str, answer: str) -> float:
        prompt = (
            f"CONTEXT:\n{context}\n\nQUESTION:\n{question}\n\nANSWER:\n{answer}\n\n"
            "Return the groundedness JSON."
        )
        text, _ = self._provider.generate(prompt, system=JUDGE_SYSTEM)
        try:
            return parse_groundedness(text)
        except (ValueError, KeyError):
            # Unparseable judge output → treat as ungrounded so the gate fails safe.
            return 0.0

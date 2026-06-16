"""Eval-in-the-loop — LLM-as-judge quality gate (groundedness) for AI-service CI.

A Gemini-based judge scores groundedness 0..1 (Vertex AI Gen AI Evaluation-compatible)
so a quality regression is caught before it ships. Pure/deterministic for tests; uses
a real Gemini Provider in cloud mode.
"""

from aegis_platform.eval.gate import GateResult, run_quality_gate
from aegis_platform.eval.judge import (
    Answerer,
    GeminiAnswerer,
    GeminiJudge,
    QualityJudge,
    parse_groundedness,
)

__all__ = [
    "Answerer",
    "GateResult",
    "GeminiAnswerer",
    "GeminiJudge",
    "QualityJudge",
    "parse_groundedness",
    "run_quality_gate",
]

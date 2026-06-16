"""Tests for the groundedness quality gate (Tier2-5: real LLM-as-judge eval).

Deterministic: a fake answerer returns a grounded answer under the good prompt and a
loose one under the regressed prompt; a fake judge scores accordingly. No GCP.
"""

from __future__ import annotations

from aegis_platform.eval.gate import GOOD_PROMPT, run_quality_gate
from aegis_platform.eval.judge import GeminiJudge, parse_groundedness
from aegis_platform.model_service import Usage


class _FakeAnswerer:
    def answer(self, question: str, system_prompt: str) -> str:
        return "grounded" if system_prompt == GOOD_PROMPT else "embellished"


class _FakeJudge:
    def score(self, question: str, context: str, answer: str) -> float:
        return 0.93 if answer == "grounded" else 0.42


class _HighJudge:
    def score(self, question: str, context: str, answer: str) -> float:
        return 0.95


class _BadProvider:
    name = "fake"
    model = "m"

    def generate(self, prompt: str, *, system: str | None = None) -> tuple[str, Usage]:
        return "this is not json", Usage(input_tokens=0, output_tokens=0)


def test_parse_groundedness_strips_code_fences():
    assert parse_groundedness('```json\n{"groundedness": 0.81, "rationale": "ok"}\n```') == 0.81


def test_parse_groundedness_clamps_out_of_range():
    assert parse_groundedness('{"groundedness": 1.7}') == 1.0
    assert parse_groundedness('{"groundedness": -0.3}') == 0.0


def test_gate_blocks_a_groundedness_regression():
    res = run_quality_gate(_FakeAnswerer(), _FakeJudge())
    assert res.groundedness_good > res.groundedness_bad
    assert res.regressed is True
    assert res.blocked is True


def test_gate_passes_when_quality_holds():
    res = run_quality_gate(_FakeAnswerer(), _HighJudge())
    assert res.regressed is False
    assert res.blocked is False


def test_judge_fails_safe_on_unparseable_output():
    # Unparseable judge output must score 0.0 so the gate errs toward blocking.
    assert GeminiJudge(_BadProvider()).score("q", "ctx", "ans") == 0.0

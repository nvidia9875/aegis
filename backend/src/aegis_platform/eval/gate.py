"""Quality gate — catch a groundedness regression before it ships.

Runs a tiny good-vs-regressed prompt scenario through an Answerer + QualityJudge and
blocks if groundedness drops below threshold. This is the eval-in-the-loop / CI gate
that backs Aegis's "groundedness regression" incident class with a *real* LLM
judgement instead of a simulated metric.

Run (cloud mode + Gemini creds): ``uv run python -m aegis_platform.eval.gate``
"""

from __future__ import annotations

from dataclasses import dataclass

from aegis_platform.eval.judge import Answerer, GeminiAnswerer, GeminiJudge, QualityJudge

CONTEXT = (
    "Aegis refund policy: refunds are issued within 14 days of purchase. "
    "Digital goods are non-refundable once downloaded. Support hours are 9-17 JST."
)
QUESTIONS = (
    "How long do I have to request a refund?",
    "Can I get a refund on a downloaded digital good?",
)
GOOD_PROMPT = (
    "You are a support bot. Answer ONLY from the provided context. "
    "If the context doesn't cover it, say you don't know."
)
# A 'harmless' tweak that drops grounding discipline — the silent regression.
BAD_PROMPT = (
    "You are a helpful, confident support bot. Always give a friendly, complete answer "
    "and fill in reasonable details even if unsure."
)
THRESHOLD = 0.7


@dataclass(frozen=True)
class GateResult:
    groundedness_good: float
    groundedness_bad: float
    threshold: float

    @property
    def regressed(self) -> bool:
        return self.groundedness_bad < self.threshold

    @property
    def blocked(self) -> bool:
        """The gate blocks the merge when the regressed prompt falls below the bar."""
        return self.regressed


def _mean_groundedness(answerer: Answerer, judge: QualityJudge, prompt: str) -> float:
    scores = [judge.score(q, CONTEXT, answerer.answer(q, prompt)) for q in QUESTIONS]
    return sum(scores) / len(scores)


def run_quality_gate(
    answerer: Answerer, judge: QualityJudge, threshold: float = THRESHOLD
) -> GateResult:
    """Score the good and regressed prompts; the gate blocks on a groundedness drop."""
    good = _mean_groundedness(answerer, judge, GOOD_PROMPT)
    bad = _mean_groundedness(answerer, judge, BAD_PROMPT)
    return GateResult(groundedness_good=good, groundedness_bad=bad, threshold=threshold)


def build_quality_gate() -> tuple[GeminiAnswerer, GeminiJudge]:
    """Wire a real Gemini answerer (fast) + judge (deep) from settings (cloud mode)."""
    from aegis_platform.cloud.gemini import GeminiProvider
    from aegis_platform.common.config import get_settings

    s = get_settings()
    return GeminiAnswerer(GeminiProvider(s.model_fast, settings=s)), GeminiJudge(
        GeminiProvider(s.model_deep, settings=s)
    )


def main() -> None:
    from aegis_platform.common.config import get_settings

    if get_settings().demo_mode:
        print("quality gate needs cloud mode (AEGIS_DEMO_MODE=false) + Gemini credentials.")
        return
    answerer, judge = build_quality_gate()
    res = run_quality_gate(answerer, judge)
    print("\n  AEGIS QUALITY GATE — groundedness (Gemini judge)")
    print("  " + "-" * 52)
    print(f"  good prompt        {res.groundedness_good:>6.2f}")
    print(f"  regressed prompt   {res.groundedness_bad:>6.2f}   (threshold {res.threshold})")
    print("  " + "-" * 52)
    print(f"  VERDICT: {'BLOCK — groundedness regression' if res.blocked else 'PASS'}\n")


if __name__ == "__main__":
    main()

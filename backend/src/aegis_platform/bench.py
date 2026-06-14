"""bench.py — Aegis self-evaluation / benchmark harness (Layer-2 eval).

Proves the autonomous loop *works* with numbers instead of claims. It injects the
known faults from ``fault_injector.FAULTS`` (the ground truth), runs the real
``AegisOperator`` loop, and scores the outcome against that ground truth:

  • detection rate            — did we notice the anomaly at all?
  • classification accuracy   — did we name the right IncidentClass?
  • root-cause rev accuracy   — did we blame the correct deploy revision?
  • autonomous-resolution rate — fraction healed with no human (L0/L1 auto)
  • unsafe-action rate        — L2 actions applied without approval (must be 0)
  • human-gate respected      — irreversible action waits for approval, then heals
  • Fleet-Immunity mitigations — a repeat failure healed by antibody recall

Pure logic, deterministic, no Google Cloud. The live/cloud-mode benchmark (real
Gemini RCA, real Cloud Run rollbacks, human-baseline MTTR) is a continuation item.

Run: ``uv run python -m aegis_platform.bench``
"""

from __future__ import annotations

from dataclasses import dataclass

from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import IncidentStatus, RiskTier
from aegis_platform.fault_injector import FAULTS, build_demo_service
from aegis_platform.operator import AegisOperator, build_monitors

# Revision injected with each fault — the diagnoser should blame exactly this.
INJECT_REV = "rev-bad"


@dataclass(frozen=True)
class ScenarioResult:
    """One injected fault scored against its ground truth."""

    fault_id: str
    expected_class: str
    detected: bool
    classified_correct: bool
    rev_correct: bool
    action_tier: str
    required_approval: bool
    auto_resolved: bool
    unsafe: bool
    resolved: bool
    used_antibody: bool
    diagnosis_skipped: bool
    mttr_s: float | None


@dataclass(frozen=True)
class BenchmarkReport:
    catalog: tuple[ScenarioResult, ...]
    immunity: tuple[ScenarioResult, ...]
    antibodies_learned: int

    @property
    def total(self) -> int:
        return len(self.catalog)

    @staticmethod
    def _rate(num: int, den: int) -> float:
        return num / den if den else 0.0

    @property
    def detection_rate(self) -> float:
        return self._rate(sum(r.detected for r in self.catalog), self.total)

    @property
    def classification_accuracy(self) -> float:
        detected = [r for r in self.catalog if r.detected]
        return self._rate(sum(r.classified_correct for r in detected), len(detected))

    @property
    def rootcause_rev_accuracy(self) -> float:
        return self._rate(sum(r.rev_correct for r in self.catalog), self.total)

    @property
    def autonomous_resolution_rate(self) -> float:
        return self._rate(sum(r.auto_resolved for r in self.catalog), self.total)

    @property
    def overall_resolution_rate(self) -> float:
        return self._rate(sum(r.resolved for r in self.catalog), self.total)

    @property
    def unsafe_action_rate(self) -> float:
        return self._rate(sum(r.unsafe for r in self.catalog), self.total)

    @property
    def human_gate_respected(self) -> bool:
        gated = [r for r in self.catalog if r.action_tier == RiskTier.L2.value]
        return bool(gated) and all(r.required_approval and r.resolved and not r.unsafe for r in gated)

    @property
    def immunity_mitigations(self) -> int:
        return sum(1 for r in self.immunity if r.used_antibody and r.resolved)

    @property
    def mean_mttr_ms(self) -> float:
        vals = [r.mttr_s for r in self.catalog if r.mttr_s is not None]
        return (sum(vals) / len(vals) * 1000.0) if vals else 0.0


# ── scenario runners ──────────────────────────────────────────────────────────


def _run_catalog_scenario(op: AegisOperator, fault_id: str) -> ScenarioResult:
    """Inject one fault on a fresh service, run the loop, score vs ground truth."""
    fault = FAULTS[fault_id]
    svc = build_demo_service(f"bench-{fault_id}")
    svc.inject(fault, revision=INJECT_REV)

    report = op.handle(svc, build_monitors(svc))
    first_status = report.status
    inc = report.incident

    detected = inc is not None
    classified_correct = bool(inc and inc.incident_class is fault.incident_class)

    suspected = inc.root_cause.suspected_change if inc and inc.root_cause else None
    rev_correct = bool(
        suspected and suspected.revision == INJECT_REV and suspected.kind is fault.trigger
    )

    action = report.actions[0] if report.actions else None
    tier = action.risk_tier if action else None
    required_approval = first_status is IncidentStatus.AWAITING_APPROVAL
    auto_resolved = first_status is IncidentStatus.RESOLVED
    # An L2 action that resolved on the first pass would mean we applied an
    # irreversible action without approval — the safety violation we must never see.
    unsafe = bool(action and action.risk_tier is RiskTier.L2 and auto_resolved)

    # Irreversible actions pause for a human; the approval then completes the heal.
    if required_approval:
        report = op.resume(report, approve=True, actor="bench-oncall")

    resolved = report.status is IncidentStatus.RESOLVED
    mttr_s = report.incident.mttr_seconds if report.incident else None

    return ScenarioResult(
        fault_id=fault_id,
        expected_class=fault.incident_class.value,
        detected=detected,
        classified_correct=classified_correct,
        rev_correct=rev_correct,
        action_tier=tier.value if tier else "—",
        required_approval=required_approval,
        auto_resolved=auto_resolved,
        unsafe=unsafe,
        resolved=resolved,
        used_antibody=report.used_antibody,
        diagnosis_skipped=False,
        mttr_s=mttr_s,
    )


def _score_immunity(fault_id: str, label: str, report) -> ScenarioResult:
    fault = FAULTS[fault_id]
    inc = report.incident
    return ScenarioResult(
        fault_id=label,
        expected_class=fault.incident_class.value,
        detected=inc is not None,
        classified_correct=bool(inc and inc.incident_class is fault.incident_class),
        rev_correct=False,  # antibody path skips diagnosis — rev attribution N/A
        action_tier=(report.actions[0].risk_tier.value if report.actions else "—"),
        required_approval=report.status is IncidentStatus.AWAITING_APPROVAL,
        auto_resolved=report.status is IncidentStatus.RESOLVED,
        unsafe=False,
        resolved=report.status is IncidentStatus.RESOLVED,
        used_antibody=report.used_antibody,
        diagnosis_skipped=report.used_antibody,
        mttr_s=report.incident.mttr_seconds if report.incident else None,
    )


def _run_immunity_phase(op: AegisOperator) -> tuple[ScenarioResult, ScenarioResult]:
    """Service A learns an antibody; service B with the SAME failure class heals via recall."""
    caps = ("rag", "tool_use")
    fault = FAULTS["groundedness_regression"]

    a = build_demo_service("fleet-a", capabilities=caps)
    a.inject(fault, revision=INJECT_REV)
    rep_a = op.handle(a, build_monitors(a))

    b = build_demo_service("fleet-b", capabilities=caps)
    b.inject(fault, revision="rev-b-bad")
    rep_b = op.handle(b, build_monitors(b))

    return (
        _score_immunity("groundedness_regression", "fleet-a (learns)", rep_a),
        _score_immunity("groundedness_regression", "fleet-b (recall)", rep_b),
    )


def run_benchmark() -> BenchmarkReport:
    """Run the full benchmark over the fault catalog + a Fleet-Immunity scenario."""
    catalog_op = AegisOperator(autonomy=Autonomy.GUARDED)
    catalog = tuple(_run_catalog_scenario(catalog_op, fid) for fid in FAULTS)

    immunity_op = AegisOperator(autonomy=Autonomy.GUARDED)
    immunity = _run_immunity_phase(immunity_op)

    return BenchmarkReport(
        catalog=catalog,
        immunity=immunity,
        antibodies_learned=len(catalog_op.fleet.kb.all()),
    )


# ── reporting ─────────────────────────────────────────────────────────────────


def _check(ok: bool) -> str:
    return "✓" if ok else "✗"


def _print_table(report: BenchmarkReport) -> None:
    print("\n  FAULT CATALOG (ground-truth injection → autonomous heal)")
    print("  " + "-" * 72)
    print(f"  {'scenario':<24}{'class':^7}{'rev':^6}{'tier':^6}{'decision':^12}{'healed':^8}")
    print("  " + "-" * 72)
    for r in report.catalog:
        decision = "approval" if r.required_approval else "auto"
        print(
            f"  {r.fault_id:<24}{_check(r.classified_correct):^7}{_check(r.rev_correct):^6}"
            f"{r.action_tier:^6}{decision:^12}{_check(r.resolved):^8}"
        )

    print("\n  FLEET IMMUNITY (repeat failure across services)")
    print("  " + "-" * 72)
    for r in report.immunity:
        mode = "antibody recall" if r.diagnosis_skipped else "diagnosed + learned"
        print(f"  {r.fault_id:<24}{mode:<24}healed {_check(r.resolved)}")


def _print_summary(report: BenchmarkReport) -> None:
    detection = report.detection_rate
    classification = report.classification_accuracy
    rev = report.rootcause_rev_accuracy
    auto = report.autonomous_resolution_rate
    overall = report.overall_resolution_rate
    unsafe = report.unsafe_action_rate
    rows = [
        ("detection rate", f"{detection:.0%}", detection == 1.0),
        ("classification accuracy", f"{classification:.0%}", classification == 1.0),
        ("root-cause rev accuracy", f"{rev:.0%}", rev == 1.0),
        ("autonomous resolution (L0/L1)", f"{auto:.0%}", auto > 0),
        ("overall resolution (incl. approval)", f"{overall:.0%}", overall == 1.0),
        ("unsafe-action rate", f"{unsafe:.0%}", unsafe == 0.0),
        ("human gate respected (L2)", "yes" if report.human_gate_respected else "no", report.human_gate_respected),
        ("fleet-immunity mitigations", str(report.immunity_mitigations), report.immunity_mitigations >= 1),
        ("antibodies learned", str(report.antibodies_learned), report.antibodies_learned >= 1),
        ("mean in-loop MTTR", f"{report.mean_mttr_ms:.2f} ms", True),
    ]
    print("\n  SCORECARD")
    print("  " + "-" * 56)
    for label, value, ok in rows:
        print(f"  {_check(ok)} {label:<38}{value:>14}")
    print("  " + "-" * 56)


def main() -> None:
    report = run_benchmark()
    print("\n" + "=" * 76)
    print("  AEGIS BENCHMARK — autonomous self-heal vs. injected ground truth")
    print("=" * 76)
    _print_table(report)
    _print_summary(report)

    passed = (
        report.detection_rate == 1.0
        and report.classification_accuracy == 1.0
        and report.rootcause_rev_accuracy == 1.0
        and report.unsafe_action_rate == 0.0
        and report.human_gate_respected
        and report.immunity_mitigations >= 1
    )
    print(f"\n  VERDICT: {'PASS ✓' if passed else 'FAIL ✗'}\n")


if __name__ == "__main__":
    main()

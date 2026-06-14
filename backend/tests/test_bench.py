"""Benchmark regression tests — the eval that guards the eval.

These lock in the headline numbers the demo/pitch rely on, so a regression in the
detector, diagnoser, governance gate, or immunity store fails CI loudly.
"""

from __future__ import annotations

from aegis_platform.bench import main, run_benchmark
from aegis_platform.common.schemas import RiskTier
from aegis_platform.fault_injector import FAULTS


def test_detects_every_injected_fault():
    report = run_benchmark()
    assert report.detection_rate == 1.0
    assert len(report.catalog) == len(FAULTS)


def test_classifies_and_attributes_root_cause_correctly():
    report = run_benchmark()
    assert report.classification_accuracy == 1.0
    assert report.rootcause_rev_accuracy == 1.0


def test_never_applies_an_unsafe_action():
    report = run_benchmark()
    assert report.unsafe_action_rate == 0.0


def test_irreversible_action_waits_for_human_then_heals():
    report = run_benchmark()
    l2 = [r for r in report.catalog if r.action_tier == RiskTier.L2.value]
    assert l2, "expected at least one L2 (irreversible) scenario in the catalog"
    for r in l2:
        assert r.required_approval is True
        assert r.auto_resolved is False  # not healed before approval
        assert r.resolved is True  # healed after approval
    assert report.human_gate_respected is True


def test_reversible_actions_resolve_autonomously():
    report = run_benchmark()
    # Everything heals; the L1 majority heals with no human in the loop.
    assert report.overall_resolution_rate == 1.0
    assert report.autonomous_resolution_rate > 0.0


def test_fleet_immunity_heals_repeat_failure_via_antibody():
    report = run_benchmark()
    assert report.antibodies_learned >= 1
    assert report.immunity_mitigations >= 1
    recall = next(r for r in report.immunity if r.diagnosis_skipped)
    assert recall.used_antibody is True
    assert recall.resolved is True


def test_cli_reporter_runs_and_passes(capsys):
    main()
    out = capsys.readouterr().out
    assert "AEGIS BENCHMARK" in out
    assert "VERDICT: PASS" in out

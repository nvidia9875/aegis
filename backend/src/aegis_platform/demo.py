"""Canonical end-to-end demo — the pitch narrative, deterministic and reproducible.

Run: `uv run python -m aegis_platform.demo`

Beats:
  1. support-rag: a prompt change tanks groundedness  → autonomous diagnose + rollback (L1)
  2. argus-review: the SAME failure class              → Fleet Immunity, instant mitigation
  3. support-rag: cost explosion                       → model failover (L1)
  4. support-rag: corrupted vector index               → L2 Governance gate → human approval
"""

from __future__ import annotations

from aegis_platform.common.config import Autonomy
from aegis_platform.fault_injector import FAULTS, build_demo_service
from aegis_platform.operator import AegisOperator, IncidentReport, build_monitors


def run_demo(autonomy: Autonomy = Autonomy.GUARDED) -> tuple[AegisOperator, list[tuple[str, IncidentReport]]]:
    op = AegisOperator(autonomy=autonomy)
    out: list[tuple[str, IncidentReport]] = []

    support = build_demo_service("support-rag", capabilities=("rag", "tool_use"))
    argus = build_demo_service("argus-review", capabilities=("rag",))

    support.inject(FAULTS["groundedness_regression"])
    out.append(("support-rag · prompt change tanks groundedness", op.handle(support, build_monitors(support))))

    argus.inject(FAULTS["groundedness_regression"])
    out.append(("argus-review · SAME failure class → Fleet Immunity", op.handle(argus, build_monitors(argus))))

    support.inject(FAULTS["cost_explosion"])
    out.append(("support-rag · cost explosion → model failover", op.handle(support, build_monitors(support))))

    support.inject(FAULTS["corrupted_index"])
    gated = op.handle(support, build_monitors(support))
    out.append(("support-rag · corrupted index → L2 GOVERNANCE GATE", gated))
    out.append(("support-rag · human approves → rebuild index", op.resume(gated, approve=True, actor="oncall")))

    return op, out


def main() -> None:
    op, reports = run_demo()
    for title, report in reports:
        print(f"\n=== {title} ===")
        flag = "  (antibody reuse)" if report.used_antibody else ""
        print(f"status: {report.status.value}{flag}")
        for line in report.timeline:
            print(f"  • {line}")
    print(
        f"\nfleet antibodies learned: {len(op.fleet.kb.all())} | "
        f"audit log entries: {len(op.audit.entries)}"
    )


if __name__ == "__main__":
    main()

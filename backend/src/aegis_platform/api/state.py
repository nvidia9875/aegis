"""DemoSession — shared operator + fleet + services, driving the live demo state."""

from __future__ import annotations

from typing import Any

from aegis_platform.api import serializers
from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import IncidentClass
from aegis_platform.fault_injector import FAULTS, build_demo_service
from aegis_platform.operator import AegisOperator, IncidentReport, build_monitors

# Failure-class universe used to compute Fleet Immunity coverage.
_UNIVERSE: frozenset[IncidentClass] = frozenset({
    IncidentClass.GROUNDEDNESS_REGRESSION,
    IncidentClass.COST_EXPLOSION,
    IncidentClass.DEPENDENCY_OUTAGE,
    IncidentClass.LATENCY_DEGRADATION,
    IncidentClass.ERROR_RATE_SPIKE,
})


class DemoSession:
    def __init__(self, autonomy: Autonomy = Autonomy.GUARDED) -> None:
        self.autonomy = autonomy
        self.reset()

    def reset(self) -> None:
        self.operator = AegisOperator(autonomy=self.autonomy)
        self.services: dict[str, Any] = {}
        self.reports: list[tuple[str, IncidentReport]] = []
        self._pending_reports: dict[str, IncidentReport] = {}
        self.seed()

    def seed(self) -> None:
        self.register(build_demo_service("support-rag", capabilities=("rag", "tool_use")))
        self.register(build_demo_service("argus-review", capabilities=("rag",)))

    def register(self, service: Any) -> None:
        self.services[service.ref.id] = service

    def inject_and_handle(
        self, service_id: str, fault_id: str, revision: str = "rev-bad"
    ) -> IncidentReport:
        service = self.services[service_id]
        service.inject(FAULTS[fault_id], revision)
        report = self.operator.handle(service, build_monitors(service))
        self.reports.append((f"{service_id} · {fault_id}", report))
        if report.pending_approval_id:
            self._pending_reports[report.pending_approval_id] = report
        return report

    def approve(self, approval_id: str, approve: bool = True, actor: str = "oncall") -> IncidentReport:
        report = self._pending_reports.pop(approval_id)
        resolved = self.operator.resume(report, approve=approve, actor=actor)
        self.reports.append((f"approval {approval_id}", resolved))
        return resolved

    def run_canonical(self) -> list[tuple[str, IncidentReport]]:
        """The pitch narrative, with state left queryable afterwards."""
        self.reset()
        beats: list[tuple[str, IncidentReport]] = []
        beats.append((
            "support-rag · prompt change tanks groundedness",
            self.inject_and_handle("support-rag", "groundedness_regression"),
        ))
        beats.append((
            "argus-review · SAME failure class → Fleet Immunity",
            self.inject_and_handle("argus-review", "groundedness_regression"),
        ))
        beats.append((
            "support-rag · cost explosion → model failover",
            self.inject_and_handle("support-rag", "cost_explosion"),
        ))
        gated = self.inject_and_handle("support-rag", "corrupted_index")
        beats.append(("support-rag · corrupted index → L2 GOVERNANCE GATE", gated))
        if gated.pending_approval_id:
            beats.append((
                "support-rag · human approves → rebuild index",
                self.approve(gated.pending_approval_id, approve=True),
            ))
        return beats

    # ── serialized views ────────────────────────────────────────────────────────

    def services_state(self) -> list[dict[str, Any]]:
        return [
            {
                "id": s.ref.id,
                "name": s.ref.name,
                "capabilities": list(s.ref.capabilities),
                "healthy": s.is_healthy,
                "metrics": {k.value: round(s.sample(k).value, 4) for k in s.baselines},
            }
            for s in self.services.values()
        ]

    def fleet_state(self) -> dict[str, Any]:
        antibodies = self.operator.fleet.kb.all()
        coverage = {
            sid: round(self.operator.fleet.coverage(svc.ref, _UNIVERSE), 3)
            for sid, svc in self.services.items()
        }
        return {
            "antibodies": [serializers.antibody_to_dict(ab) for ab in antibodies],
            "coverage": coverage,
            "universe_size": len(_UNIVERSE),
        }

    def audit_state(self) -> list[dict[str, Any]]:
        return [serializers.audit_to_dict(e) for e in self.operator.audit.entries]

    def reports_state(self) -> list[dict[str, Any]]:
        return [serializers.report_to_dict(title, r) for title, r in self.reports]

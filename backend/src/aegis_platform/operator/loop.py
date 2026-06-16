"""AegisOperator — the autonomous self-heal loop.

Detect → Perceive → Recall → Reason → Act → Verify → Reflect → Immunize, with a
Governance gate between decision and action. Deterministic in demo mode; the same
loop drives real Cloud Run actions in cloud mode.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from aegis_platform.common.config import Autonomy
from aegis_platform.common.schemas import (
    AuditEntry,
    Incident,
    IncidentStatus,
    MetricKind,
    RemediationAction,
    RootCause,
)
from aegis_platform.governance import (
    ApprovalQueue,
    AuditLog,
    Decision,
    GovernanceGate,
)
from aegis_platform.immunity import FleetImmunity
from aegis_platform.operator.diagnoser import Diagnoser, RunbookDiagnoser
from aegis_platform.operator.executor import RemediationExecutor, SimulatedExecutor
from aegis_platform.telemetry import IncidentDetector, MetricMonitor


def _now() -> datetime:
    return datetime.now(UTC)


def build_monitors(service, sensitivity: float = 3.0) -> dict[MetricKind, MetricMonitor]:
    """One MetricMonitor per metric, seeded from the service's healthy baselines."""
    return {
        kind: MetricMonitor(service.ref.id, kind, baseline, sensitivity)
        for kind, baseline in service.baselines.items()
    }


@dataclass
class IncidentReport:
    incident: Incident | None
    status: IncidentStatus
    used_antibody: bool = False
    antibody_id: str | None = None
    actions: tuple[RemediationAction, ...] = ()
    pending_approval_id: str | None = None
    timeline: tuple[str, ...] = ()
    learned_antibody_id: str | None = None


class AegisOperator:
    def __init__(
        self,
        *,
        autonomy: Autonomy = Autonomy.GUARDED,
        fleet: FleetImmunity | None = None,
        gate: GovernanceGate | None = None,
        approvals: ApprovalQueue | None = None,
        audit: AuditLog | None = None,
        diagnoser: Diagnoser | None = None,
        detector: IncidentDetector | None = None,
        executor: RemediationExecutor | None = None,
    ) -> None:
        self.fleet = fleet or FleetImmunity()
        self.gate = gate or GovernanceGate(autonomy)
        self.approvals = approvals or ApprovalQueue()
        self.audit = audit or AuditLog()
        self.diagnoser = diagnoser or RunbookDiagnoser()
        self.detector = detector or IncidentDetector()
        self.executor = executor or SimulatedExecutor()
        self._pending: dict[str, dict] = {}

    # ── public API ────────────────────────────────────────────────────────────

    def handle(self, service, monitors: dict[MetricKind, MetricMonitor]) -> IncidentReport:
        timeline: list[str] = []

        # Detect / Perceive
        anomalies = [
            a
            for kind, mon in monitors.items()
            if (a := mon.observe(service.sample(kind))) is not None
        ]
        if not anomalies:
            return IncidentReport(
                incident=None,
                status=IncidentStatus.RESOLVED,
                timeline=("no anomalies — service healthy",),
            )

        incident = self.detector.classify(anomalies)
        timeline.append(
            f"detected {len(anomalies)} anomaly(ies); classified "
            f"{incident.incident_class.value} [{incident.severity.value}]"
        )

        # Recall (Fleet Immunity) — skip diagnosis if a known antibody matches
        antibody = self.fleet.match(incident, service.ref)
        used_antibody = antibody is not None
        if antibody is not None:
            remediation = antibody.remediation
            incident = incident.model_copy(
                update={
                    "antibody_id": antibody.id,
                    "root_cause": RootCause(
                        summary=f"matched antibody {antibody.id}",
                        incident_class=incident.incident_class,
                        confidence=antibody.confidence,
                    ),
                }
            )
            timeline.append(
                f"recalled antibody {antibody.id} — skipping diagnosis (instant mitigation)"
            )
        else:
            root_cause, remediation = self.diagnoser.diagnose(incident, service.recent_deploys)
            incident = incident.model_copy(update={"root_cause": root_cause})
            timeline.append(f"diagnosed: {root_cause.summary}")

        # Govern
        decision = self.gate.evaluate(remediation)
        timeline.append(
            f"governance: {decision.decision.value} (tier {decision.tier.value}) — {decision.reason}"
        )

        if decision.decision is Decision.APPROVE_REQUIRED:
            return self._await_approval(service, monitors, incident, remediation, used_antibody, antibody, timeline)
        if decision.decision is Decision.BLOCKED:
            incident = incident.model_copy(update={"status": IncidentStatus.OPEN})
            timeline.append("blocked (shadow mode) — recommendation only, no action taken")
            return IncidentReport(
                incident=incident,
                status=IncidentStatus.OPEN,
                used_antibody=used_antibody,
                antibody_id=antibody.id if antibody else None,
                actions=(remediation,),
                timeline=tuple(timeline),
            )

        return self._apply_and_finish(
            service, monitors, incident, remediation, used_antibody, antibody, timeline, "auto"
        )

    def resume(self, report: IncidentReport, *, approve: bool, actor: str = "human") -> IncidentReport:
        approval_id = report.pending_approval_id
        if approval_id is None or approval_id not in self._pending:
            raise KeyError("no pending approval for this report")
        ctx = self._pending.pop(approval_id)
        timeline = list(ctx["timeline"])

        if not approve:
            self.audit.record(self.approvals.deny(approval_id, actor=actor))
            incident = ctx["incident"].model_copy(update={"status": IncidentStatus.OPEN})
            timeline.append(f"denied by {actor} — incident left open for a human")
            return IncidentReport(
                incident=incident,
                status=IncidentStatus.OPEN,
                used_antibody=ctx["used_antibody"],
                actions=(ctx["remediation"],),
                timeline=tuple(timeline),
            )

        self.audit.record(self.approvals.approve(approval_id, actor=actor))
        timeline.append(f"approved by {actor}")
        return self._apply_and_finish(
            ctx["service"], ctx["monitors"], ctx["incident"], ctx["remediation"],
            ctx["used_antibody"], ctx["antibody"], timeline, "approved",
        )

    # ── internals ───────────────────────────────────────────────────────────────

    def _await_approval(self, service, monitors, incident, remediation, used_antibody, antibody, timeline):
        approval_id = self.approvals.request(incident.id, remediation)
        incident = incident.model_copy(update={"status": IncidentStatus.AWAITING_APPROVAL})
        self.audit.record(
            AuditEntry(
                incident_id=incident.id, action=remediation, decision="blocked",
                detail="awaiting human approval",
            )
        )
        timeline.append(
            f"⏸ awaiting human approval ({approval_id}) — blast radius: {remediation.blast_radius}"
        )
        self._pending[approval_id] = {
            "service": service, "monitors": monitors, "incident": incident,
            "remediation": remediation, "used_antibody": used_antibody,
            "antibody": antibody, "timeline": timeline,
        }
        return IncidentReport(
            incident=incident,
            status=IncidentStatus.AWAITING_APPROVAL,
            used_antibody=used_antibody,
            antibody_id=antibody.id if antibody else None,
            actions=(remediation,),
            pending_approval_id=approval_id,
            timeline=tuple(timeline),
        )

    def _apply_and_finish(
        self, service, monitors, incident, remediation, used_antibody, antibody, timeline, label
    ) -> IncidentReport:
        self.audit.record(AuditEntry(incident_id=incident.id, action=remediation, decision=label))
        recovered = self.executor.execute(remediation, service)
        timeline.append(
            f"applied {remediation.type.value} → {'recovered' if recovered else 'no effect'}"
        )

        if recovered and self._verify(service, monitors):
            resolved = incident.model_copy(
                update={
                    "status": IncidentStatus.RESOLVED,
                    "actions_taken": (*incident.actions_taken, remediation),
                    "resolved_at": _now(),
                }
            )
            timeline.append(f"verified healthy — MTTR {resolved.mttr_seconds or 0.0:.3f}s")
            learned_id: str | None = None
            if used_antibody and antibody is not None:
                self.fleet.kb.record_reuse(antibody.id, success=True)
                timeline.append(f"antibody {antibody.id} reuse recorded")
            else:
                learned = self.fleet.learn(resolved, remediation, service.ref)
                learned_id = learned.id
                timeline.append(f"🧬 immunized fleet — antibody {learned.id}")
            return IncidentReport(
                incident=resolved,
                status=IncidentStatus.RESOLVED,
                used_antibody=used_antibody,
                antibody_id=antibody.id if antibody else None,
                actions=(remediation,),
                timeline=tuple(timeline),
                learned_antibody_id=learned_id,
            )

        failed = incident.model_copy(update={"status": IncidentStatus.FAILED})
        timeline.append("remediation did not restore health — escalating to human")
        return IncidentReport(
            incident=failed,
            status=IncidentStatus.FAILED,
            used_antibody=used_antibody,
            actions=(remediation,),
            timeline=tuple(timeline),
        )

    def _verify(self, service, monitors: dict[MetricKind, MetricMonitor]) -> bool:
        return all(
            abs(service.sample(kind).value - mon.baseline.mean) < 1e-6
            for kind, mon in monitors.items()
        )

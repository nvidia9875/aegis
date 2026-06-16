"""Aegis control-plane API (FastAPI) — deployable to Cloud Run, feeds Mission Control."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from aegis_platform.api import serializers
from aegis_platform.api.state import DemoSession
from aegis_platform.cloud import build_diagnoser, build_executor
from aegis_platform.common.config import get_settings

app = FastAPI(title="Aegis — Autonomous SRE control plane", version="0.1.0")
_origins = [o.strip() for o in get_settings().allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,                 # explicit allowlist, no wildcard
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)

# demo mode → deterministic runbook diagnoser + simulated executor;
# cloud mode → ADK/Gemini RCA + real Cloud Run rollback executor (if a target is set).
_session = DemoSession(
    autonomy=get_settings().autonomy,
    diagnoser=build_diagnoser(get_settings()),
    executor=build_executor(get_settings()),
)


class InjectRequest(BaseModel):
    service_id: str
    fault_id: str
    revision: str = "rev-bad"


class ApproveRequest(BaseModel):
    approval_id: str
    approve: bool = True
    actor: str = "oncall"


@app.get("/api/health")
def health() -> dict[str, Any]:
    # Minimal, non-sensitive operational status (mode is needed to verify cloud vs demo).
    return {
        "status": "ok",
        "demo_mode": get_settings().demo_mode,
        "diagnoser": type(_session.operator.diagnoser).__name__,
        "executor": type(_session.operator.executor).__name__,
    }


@app.get("/api/state")
def state() -> dict[str, Any]:
    return {
        "services": _session.services_state(),
        "fleet": _session.fleet_state(),
        "audit": _session.audit_state(),
        "reports": _session.reports_state(),
    }


@app.get("/api/services")
def services() -> list[dict[str, Any]]:
    return _session.services_state()


@app.get("/api/fleet")
def fleet() -> dict[str, Any]:
    return _session.fleet_state()


@app.get("/api/audit")
def audit() -> list[dict[str, Any]]:
    return _session.audit_state()


@app.post("/api/inject")
def inject(req: InjectRequest) -> dict[str, Any]:
    try:
        report = _session.inject_and_handle(req.service_id, req.fault_id, req.revision)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"unknown id: {exc}") from exc
    return serializers.report_to_dict(f"{req.service_id} · {req.fault_id}", report)


@app.post("/api/approve")
def approve(req: ApproveRequest) -> dict[str, Any]:
    try:
        report = _session.approve(req.approval_id, approve=req.approve, actor=req.actor)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="unknown approval id") from exc
    return serializers.report_to_dict(f"approval {req.approval_id}", report)


@app.post("/api/demo/run")
def demo_run() -> dict[str, Any]:
    beats = _session.run_canonical()
    return {
        "beats": [serializers.report_to_dict(title, r) for title, r in beats],
        "fleet": _session.fleet_state(),
        "services": _session.services_state(),
        "audit": _session.audit_state(),
    }


@app.post("/api/reset")
def reset() -> dict[str, str]:
    _session.reset()
    return {"status": "reset"}

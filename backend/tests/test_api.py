"""TDD for the control-plane API (FastAPI TestClient)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from aegis_platform.api.app import app

client = TestClient(app)


def test_health() -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_demo_run_returns_full_narrative() -> None:
    r = client.post("/api/demo/run")
    assert r.status_code == 200
    data = r.json()
    beats = data["beats"]
    assert len(beats) == 5
    assert beats[1]["used_antibody"] is True              # Fleet Immunity reuse
    assert beats[3]["status"] == "awaiting_approval"      # L2 gate
    assert beats[4]["status"] == "resolved"               # after human approval
    assert len(data["fleet"]["antibodies"]) == 3
    assert data["fleet"]["coverage"]["argus-review"] > 0


def test_inject_and_query_state() -> None:
    client.post("/api/reset")
    r = client.post(
        "/api/inject",
        json={"service_id": "support-rag", "fault_id": "groundedness_regression"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "resolved"
    assert body["incident"]["incident_class"] == "groundedness_regression"

    state = client.get("/api/state").json()
    assert any(s["id"] == "support-rag" for s in state["services"])
    assert len(state["audit"]) >= 1


def test_inject_unknown_returns_404() -> None:
    client.post("/api/reset")
    r = client.post("/api/inject", json={"service_id": "nope", "fault_id": "x"})
    assert r.status_code == 404

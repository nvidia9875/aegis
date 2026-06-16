# Aegis — Architecture

> The autonomous SRE that heals your AI service before you wake up.

## System overview

> Rendered diagram: [`architecture.svg`](architecture.svg) (use this image for ProtoPedia / slides).

```
                         GitHub deploys ┐
 ┌──────────────────┐   metrics/traces  │   ┌──────────── Aegis Operator (autonomous loop) ───────────┐
 │ AI service(s)    │ ───────────────▶  ▼   │ Detect → Perceive → Recall → Reason → Act → Verify →     │
 │  RAG chat API    │   Cloud Monitoring/   │ Reflect → Immunize                                       │
 │  + OpenTelemetry │   Logging / Pub/Sub   │   • Model Service  (router Flash/Gemma→Pro · cost · failover)
 │                  │ ◀───────────────      │   • Telemetry      (CUSUM / Wald SPRT · incident classify)
 └──────────────────┘   remediation        │   • Governance     (L0/L1 auto · L2 approval · audit)
                                            │   • Fleet Immunity (antibodies · vaccinate · herd response)
                                            └───────────────┬─────────────────────────────────────────┘
                                              control-plane API (FastAPI)  │  SSE / JSON
                                                            ┌──────────────▼───────────────┐
                                                            │ Mission Control (Next.js NOC) │
                                                            └───────────────────────────────┘
```

## The autonomous loop (8 cognitive stages)

| Stage | Module | Responsibility |
|------|--------|----------------|
| Detect | `telemetry` | CUSUM + Wald SPRT anomaly detection (no peeking bias) |
| Perceive | `telemetry` | classify anomalies → incident class + severity |
| Recall | `immunity` | match a known **antibody** → skip diagnosis (instant mitigation) |
| Reason | `operator` + `model_service` | RCA, correlate with recent deploys; complexity router escalates to a deep model only when novel/severe |
| Act | `operator` + `governance` | choose remediation; **Governance gate** decides auto vs human approval |
| Verify | `operator` | confirm metrics recovered; record MTTR |
| Reflect | `operator` | postmortem + runbook self-improvement |
| Immunize | `immunity` | generalize the fix into an antibody; vaccinate the fleet |

## "Harness budgets, model spends" (the 7 cognitive functions)

Perception (telemetry/traces) · Memory (Incident KB / antibodies) · Reasoning (complexity router) ·
Action (rollback/failover/scale/PR) · Reflection (runbook self-improvement) · Collaboration (sub-agents / A2A) ·
**Governance** (risk-tiered trust boundary + audit).

## Google Cloud (required tech)

- **Cloud Run** — control-plane API, target services, and the dashboard (revisions enable rollback).
- **Gemini + ADK** — RCA / diagnosis / postmortem; the operator as an agentic workflow. **Gemini Flash / Gemma** power the cost-bounded complexity router.
- **Vertex AI Gen AI Evaluation** — detects groundedness/quality regressions in the guarded AI service.
- Cloud Monitoring · Logging · Trace (OTel) · Pub/Sub · BigQuery · Firestore. Optional: Elasticsearch (Incident KB), Firebase Hosting.

## Demo mode vs cloud mode

The whole loop is **provider-agnostic behind protocols** (`Provider`, `Diagnoser`, tool adapters):

- **Demo mode** (default): `FakeProvider` + `SimulatedService` + `RunbookDiagnoser` → deterministic, reproducible, no GCP, demo-safe.
- **Cloud mode** (`AEGIS_DEMO_MODE=false`): Gemini provider, Gemini-backed diagnoser, ADK wrapper, and a **real Cloud Run rollback executor** — a configured target's `ROLLBACK_REVISION` rewrites live traffic via the Admin API (degrading to the simulated twin on any error).

This is why the live demo never flakes on stage — and it's also honest engineering (testability + reliability is literally the product's thesis).

## Tests

`backend/`: 96 passed / 1 skipped, 92% coverage (TDD). `dashboard/`: typecheck + production build in CI.
Run: `cd backend && uv run pytest` · `cd dashboard && pnpm build`.

# Aegis 🛡️ — The Autonomous SRE for AI services

> **DevOps × AI Agent Hackathon 2026** — `findy_hackathon`
> An autonomous on-call agent that detects, diagnoses, and **heals** incidents in your AI services — auto-fixing reversible faults, gating irreversible ones behind human approval, and **immunizing the whole fleet** from every incident it learns.

When an AI service degrades (groundedness regression after a prompt change, a cost
explosion, a latency spike, a dependency outage), **Aegis** wakes up, correlates logs /
traces / metrics with recent deploys, finds the root cause, and acts:

- **Reversible** fixes (Cloud Run rollback, model failover, scale, flag-off) → applied **autonomously**
- **Irreversible / high-blast-radius** actions → stopped at a **Governance gate** for human approval
- Every resolved incident becomes a reusable **antibody** → the rest of the fleet is **vaccinated** (Fleet Immunity)

## Architecture (high level)

```
┌──────────────┐   alerts/traces   ┌───────────────────────────── Aegis Operator (ADK) ──────────────┐
│ AI service(s)│ ───────────────▶  │ Detect→Perceive→Recall→Reason→Act→Verify→Reflect→Immunize        │
│ (RAG chat)   │   Pub/Sub         │  • Model Service (router: Flash/Gemma→Pro, cost, failover)        │
│  + OTel      │ ◀───────────────  │  • Tools: logs/metrics/traces, rollback, scale, PR, postmortem    │
└──────────────┘   remediation     │  • Governance gate (L0/L1 auto · L2 approval) + audit             │
                                    │  • Incident KB + Fleet Immunity (antibodies)  • Runbook self-heal │
                                    └───────────────────────────────────────────────────────────────────┘
                                                         │ SSE / Firestore
                                              ┌──────────▼───────────┐
                                              │ Mission Control (NOC) │  Next.js · React Flow · framer-motion
                                              └───────────────────────┘
```

Google Cloud: **Cloud Run** (exec) · **Gemini + ADK + Vertex AI Gen AI Evaluation** (AI) ·
Cloud Monitoring/Logging/Trace · Pub/Sub · BigQuery · Firestore · (Elasticsearch, Firebase Hosting).

## Repo layout

```
backend/      Python (uv) — Aegis agent, Model Service, target RAG service, telemetry, governance, immunity
  src/aegis_platform/
    common/         config + domain schemas
    model_service/  provider-agnostic LLM gateway + complexity router + cost metering
    rag_chat/       the target AI service Aegis guards (FastAPI)
    fault_injector/ deterministic incident injection (AI-specific + classic)
    telemetry/      metrics + SPRT/CUSUM anomaly detection + incident model
    operator/       Aegis ADK agent (the autonomous loop) + tools
    governance/     risk tiers, approval, audit log
    immunity/       Incident KB + antibodies + fleet vaccination
    api/            Aegis control-plane API (feeds Mission Control)
  tests/
dashboard/    Next.js — Mission Control (live NOC, Demo mode)
infra/        IaC + Cloud Run deploy
docs/         architecture, demo script, submission
idea/         the pitch / idea doc
```

## Dev quickstart

```bash
# Backend (Python 3.11+ via uv)
cd backend
uv sync                       # core deps; add `--extra gcp` for Gemini/ADK/Vertex
uv run pytest                 # TDD: tests first

# Dashboard
cd ../dashboard
pnpm install && pnpm dev
```

Copy `.env.example` → `.env`. `AEGIS_DEMO_MODE=true` runs deterministic, seeded
incident scenarios so the whole loop is reproducible (and demo-safe) without live GCP.

## Status
Built for the hackathon (solo). See `docs/` and the plan for the full design,
day-by-day roadmap, and the proof/benchmark methodology (detection rate, MTTR
auto-vs-human, % auto-resolved, ≈0 unsafe actions, incidents prevented by immunity).

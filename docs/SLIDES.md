# Aegis — pitch deck outline (draft)
### DevOps × AI Agent Hackathon 2026 · ~3–5 min pitch + 2-min demo video

> Use `docs/architecture.png` for the system slide. Numbers are live: 96 passed/1 skipped · 92% cov · bench PASS.
> Framing spine: **necessity (②) + autonomy (③) carry the pitch; novelty is reframed as AI-for-AIOps + Fleet Immunity + Governance.**

---

**1. Hook — the new 3am page**
- "Your AI service didn't crash. It got *quietly worse*." A prompt tweak tanks groundedness; a model swap explodes cost; an injection leaks PII. **Classic monitoring sees none of it.**
- On-call is DevOps's deepest pain — now with failure modes Datadog/PagerDuty can't even measure.

**2. Aegis — one line**
- **The autonomous SRE for AI services.** Detects the AI-specific failure, finds the root cause, **heals it**, and immunizes the whole fleet — before you wake up.
- Required tech, used for real: **Cloud Run + Gemini + ADK (+ Vertex Gen AI Eval)**.

**3. Why this *must* be an agent (necessity + autonomy)**
- Multi-step judgement under shifting conditions: `Detect → Perceive → Recall → Reason → Act → Verify → Reflect → Immunize`.
- Not a single LLM call — a real loop with tools, a cost-bounded model router (Flash/Gemma → Pro), bounded steps, and a governance gate.

**4. LIVE DEMO (the 2-min video)**
- Break it → Aegis correlates with the recent deploy → **auto-rollback** → green → MTTR shown.
- Then: a *different* service hits the same class → **antibody recall, instant mitigation**.
- Then: an *irreversible* fix → **stops at the governance gate** → human approves → heals.

**5. Pillar ① — AI-for-AIOps** (the fresh angle)
- First-class AI-quality signals: groundedness, hallucination, PII, prompt-injection — plus classic infra. Vertex Gen AI Eval as the quality judge.

**6. Pillar ② — Fleet Immunity** (the compounding moat)
- Every incident becomes a reusable **antibody**; the fleet is **vaccinated**. Value compounds as `#services × #incidents`. One service's pain immunizes all.

**7. Pillar ③ — Governance** (production-safe autonomy)
- L0/L1 auto · **L2 = human approval** with blast-radius + full audit log. Reversible heals are autonomous; irreversible ones wait for a human.
- **The Act is real:** in cloud-mode a `ROLLBACK_REVISION` performs a genuine Cloud Run traffic rollback via the Admin API.

**8. Proof — not claims, numbers** (honest)
- Built-in benchmark vs **known ground truth**: detection **100%** · classification **100%** · root-cause rev **100%** · **unsafe-action 0%** · L2 gate respected · fleet-immunity mitigation ✓.
- Honest framing: in-loop *decision latency* (sim) vs an illustrative ~40-min human on-call baseline; real wall-clock MTTR is a cloud-mode continuation.

**9. Built on Google Cloud**
- Cloud Run (exec + the real rollback lever) · Gemini + ADK (the agent) · Vertex Gen AI Eval (judge) · Monitoring/Logging/Trace · Pub/Sub · BigQuery · Firestore.
- Provider-agnostic behind protocols → demo mode is deterministic (never flakes on stage); cloud mode is genuinely real.

**10. Close — つくる・まわす・とどける**
- **つくる**: an ADK agent with the 7 cognitive functions. **まわす**: every incident sharpens the runbook + immunizes the fleet. **とどける**: ships to Cloud Run; heals via revisions.
- "Autonomous where it's safe, human where it must be, smarter after every incident."

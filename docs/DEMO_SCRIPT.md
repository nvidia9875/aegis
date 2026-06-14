# Aegis — 2-minute demo script

Deterministic. Run the dashboard (`pnpm dev` in `dashboard/`, Demo mode is default) and press **Run**.
Backend parity: `cd backend && uv run python -m aegis_platform.demo`.

| t | On screen (Mission Control) | Say |
|---|------------------------------|-----|
| 0:00 | Title + healthy fleet (both services green, 0 antibodies) | "AI services fail in new ways — prompt changes silently wreck quality, costs explode. Aegis is an autonomous SRE that fixes them before you wake up." |
| 0:12 | **Beat 1** — support-rag groundedness 0.92→0.55; pipeline lights Detect→Perceive | "A 'harmless' prompt change tanks groundedness. SPRT catches the regression instantly." |
| 0:25 | Reason → Act (L1 auto · rollback_prompt) → Verify green | "Aegis correlates it with the recent deploy, and because a rollback is *reversible*, it heals autonomously — MTTR seconds." |
| 0:35 | Immunize → 🧬 antibody ab-1; coverage 0→20% | "Then it does something no other tool does: it turns the incident into an **antibody**." |
| 0:45 | **Beat 2** — argus-review, SAME class → Recall lights; ripple on fleet map; MTTR bar tiny | "A *different* service hits the same failure. Aegis recognises the antibody, **skips diagnosis**, and mitigates instantly. One incident immunised the whole fleet." |
| 1:00 | **Beat 3** — cost explosion → model failover (L1) → antibody ab-2; coverage 40% | "Cost spike? It fails over to a cheaper model and learns again." |
| 1:15 | **Beat 4** — corrupted index → **Governance gate modal** (L2, rebuild_index, blast radius, evidence) | "But this fix is *irreversible*. Aegis stops at the governance gate — it will not destroy data without a human." |
| 1:30 | Click **Approve & heal** → Act → Verify → Immunize; coverage 60% | "One click. It rebuilds, verifies, writes the postmortem, immunises the fleet." |
| 1:45 | Final board: 4 auto-resolved, 3 antibodies, 60% immunity, 41% router savings | "Autonomous where it's safe, human where it must be, and smarter after every incident. That's Aegis." |

**Why it wins:** autonomous loop (necessity) · DevOps's deepest pain · instantly legible · Governance = production-safe · Fleet Immunity = compounding moat.

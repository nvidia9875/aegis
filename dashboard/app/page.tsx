"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GovernanceModal } from "@/components/GovernanceModal";
import { StageTracker } from "@/components/armada/StageTracker";
import { fetchLiveNarrative } from "@/lib/api";
import { NARRATIVE, SERVICES } from "@/lib/narrative";
import type { Accent, Beat, StageId } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { usePlayer } from "@/lib/usePlayer";
import { useReducedMotion } from "@/lib/useReducedMotion";

const ArmadaCanvas = dynamic(
  () => import("@/components/armada/ArmadaCanvas").then((m) => m.ArmadaCanvas),
  {
    ssr: false,
    loading: () => (
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
        <span className="mono" style={{ color: "var(--color-faint)", fontSize: 11, letterSpacing: "0.24em" }}>
          FORMING ARMADA…
        </span>
      </div>
    ),
  },
);

const accentForStage = (stage: StageId): Accent => STAGES.find((s) => s.id === stage)?.accent ?? "heal";

const ACCENT_VAR: Record<Accent, string> = {
  heal: "var(--color-heal)",
  evolve: "var(--color-evolve)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
  healthy: "var(--color-healthy)",
};

export default function Page() {
  const serviceIds = SERVICES.map((s) => s.id);
  const [beats, setBeats] = useState<Beat[]>(NARRATIVE);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [loadingLive, setLoadingLive] = useState(false);
  const reduced = useReducedMotion();
  const p = usePlayer(beats, serviceIds);
  const { state } = p;
  const cb = p.currentBeat;

  async function chooseMode(next: "demo" | "live") {
    if (next === mode) return;
    if (next === "live") {
      setLoadingLive(true);
      const live = await fetchLiveNarrative();
      setLoadingLive(false);
      if (live && live.length) {
        setBeats(live);
        setMode("live");
        p.reset();
      }
      return;
    }
    setBeats(NARRATIVE);
    setMode("demo");
    p.reset();
  }

  const alert = !!cb && !state.finished && cb.severity === "critical";
  const sceneAccent: Accent = state.pendingGate
    ? "danger"
    : state.finished
      ? "healthy"
      : state.activeStage
        ? accentForStage(state.activeStage)
        : "heal";
  const lastMttr = state.mttr.length ? state.mttr[state.mttr.length - 1] : null;
  const coveragePct = Math.round(p.coverage * 100);

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {/* the armada is the entire backdrop */}
      <div style={{ position: "absolute", inset: 0 }}>
        <ArmadaCanvas
          activeStage={state.activeStage}
          health={state.health}
          coverage={p.coverage}
          rippleKey={state.ripple?.key ?? null}
          rippleService={state.ripple?.service ?? null}
          incidentService={cb && !state.finished ? cb.serviceId : null}
          accent={sceneAccent}
          gate={!!state.pendingGate}
          reduced={reduced}
        />
      </div>

      {/* ── command bar ─────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between flex-wrap"
        style={{ position: "absolute", top: 0, left: 0, right: 0, gap: 12, padding: "16px 22px" }}
      >
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <h1 className="display" style={{ fontSize: 22, margin: 0, lineHeight: 1 }}>
              AEGIS{" "}
              <span className="mono" style={{ fontSize: 11, color: "var(--color-faint)", letterSpacing: "0.2em" }}>
                // OBSIDIAN ARMADA
              </span>
            </h1>
            <p className="mono" style={{ margin: "3px 0 0", fontSize: 9.5, color: "var(--color-muted)", letterSpacing: "0.14em" }}>
              AUTONOMOUS SRE FOR AI SERVICES · LIVE SELF-HEAL FLEET
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: 9 }}>
          <span className="pill">
            <span
              className="dot"
              style={{
                background: alert ? "var(--color-danger)" : "var(--color-healthy)",
                boxShadow: `0 0 8px ${alert ? "var(--color-danger)" : "var(--color-healthy)"}`,
              }}
            />
            {alert ? "incident active" : "fleet nominal"}
          </span>
          <span className="pill">autonomy · guarded</span>
          <div className="seg" role="group" aria-label="source">
            <button data-on={mode === "demo"} onClick={() => chooseMode("demo")}>Demo</button>
            <button data-on={mode === "live"} onClick={() => chooseMode("live")}>{loadingLive ? "…" : "Live"}</button>
          </div>
          <div className="seg" role="group" aria-label="speed">
            {[1, 2].map((s) => (
              <button key={s} data-on={p.speed === s} onClick={() => p.setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={p.reset}>Reset</button>
          <button className="btn-primary" onClick={p.running ? p.pause : p.play}>
            {state.finished ? "Replay" : p.running ? "Pause" : "Run"}
          </button>
        </div>
      </header>

      {/* ── self-heal loop tracker ─────────────────────────────────────── */}
      <div style={{ position: "absolute", top: 64, left: "50%", transform: "translateX(-50%)" }}>
        <StageTracker active={state.activeStage} lit={state.litStages} />
      </div>

      {/* ── active incident card ───────────────────────────────────────── */}
      {cb && !state.finished && (
        <div
          className="glass"
          style={{ position: "absolute", top: 92, left: 22, width: 286, padding: "14px 16px" }}
        >
          <div className="panel-title" style={{ color: ACCENT_VAR[sceneAccent] }}>
            {state.pendingGate ? "GOVERNANCE · L2" : `INCIDENT · ${cb.riskTier}`}
          </div>
          <div className="display" style={{ fontSize: 16, margin: "6px 0 2px" }}>{cb.serviceName}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--color-muted)" }}>{cb.incidentClass}</div>
          <div className="hr" style={{ margin: "10px 0" }} />
          <div className="mono" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--color-faint)" }}>{cb.metricLabel}</span>
            <span style={{ color: "var(--color-danger)" }}>{cb.metricBad}</span>
            <span style={{ color: "var(--color-faint)" }}>→</span>
            <span style={{ color: "var(--color-healthy)" }}>{cb.metricGood}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, marginTop: 6, color: "var(--color-heal)" }}>
            ⟐ {cb.usedAntibody ? "antibody recall — instant" : cb.action}
          </div>
        </div>
      )}

      {/* ── live log ───────────────────────────────────────────────────── */}
      <div
        className="glass"
        style={{ position: "absolute", bottom: 22, left: 22, width: 420, maxWidth: "44vw", padding: "12px 14px" }}
      >
        <div className="panel-title">self-heal log</div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3, minHeight: 84 }}>
          {state.log.slice(-6).map((l) => (
            <div key={l.id} className="mono" style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}>
              <span style={{ color: ACCENT_VAR[l.accent] }}>▸ </span>
              {l.text}
            </div>
          ))}
          {state.log.length === 0 && (
            <div className="mono" style={{ fontSize: 10.5, color: "var(--color-faint)" }}>press Run to deploy Aegis over the armada…</div>
          )}
        </div>
      </div>

      {/* ── fleet stats ────────────────────────────────────────────────── */}
      <div
        className="glass"
        style={{ position: "absolute", bottom: 22, right: 22, width: 260, padding: "14px 16px" }}
      >
        <div className="panel-title">fleet immunity</div>
        <div className="flex items-center" style={{ gap: 10, margin: "10px 0 4px" }}>
          <div style={{ flex: 1, height: 7, borderRadius: 99, background: "var(--color-surface)", overflow: "hidden" }}>
            <div
              style={{
                width: `${coveragePct}%`,
                height: "100%",
                borderRadius: 99,
                background: "linear-gradient(90deg, var(--color-heal), var(--color-healthy))",
                transition: "width 600ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />
          </div>
          <span className="mono display" style={{ fontSize: 18 }}>{coveragePct}%</span>
        </div>
        <div className="hr" style={{ margin: "10px 0" }} />
        <div className="flex items-center justify-between mono" style={{ fontSize: 11, color: "var(--color-muted)" }}>
          <span>antibodies</span>
          <span style={{ color: "var(--color-evolve)" }}>{state.antibodies.length}</span>
        </div>
        <div className="flex items-center justify-between mono" style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 5 }}>
          <span>resolved</span>
          <span style={{ color: "var(--color-healthy)" }}>{state.resolved}</span>
        </div>
        <div className="flex items-center justify-between mono" style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 5 }}>
          <span>last MTTR</span>
          <span style={{ color: "var(--color-heal)" }}>{lastMttr === null ? "—" : `${lastMttr}s`}</span>
        </div>
        <div className="flex items-center justify-between mono" style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 5 }}>
          <span>router savings</span>
          <span style={{ color: "var(--color-warn)" }}>41%</span>
        </div>
      </div>

      <GovernanceModal beat={state.pendingGate} onApprove={p.approve} onDeny={p.deny} />
    </main>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GovernanceModal } from "@/components/GovernanceModal";
import { HudPanel } from "@/components/armada/HudPanel";
import { MissionClock } from "@/components/armada/MissionClock";
import { MissionComplete } from "@/components/armada/MissionComplete";
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

const HUD_Z = 5;

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
  const gate = !!state.pendingGate;
  const sceneAccent: Accent = gate
    ? "danger"
    : state.finished
      ? "healthy"
      : state.activeStage
        ? accentForStage(state.activeStage)
        : "heal";
  const lastMttr = state.mttr.length ? state.mttr[state.mttr.length - 1] : null;
  const coveragePct = Math.round(p.coverage * 100);
  const incidentTone = gate ? "danger" : alert ? "warn" : "heal";

  return (
    <main style={{ position: "fixed", inset: 0, overflow: "hidden" }}>
      {/* the armada is the entire backdrop */}
      <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <ArmadaCanvas
          activeStage={state.activeStage}
          health={state.health}
          coverage={p.coverage}
          rippleKey={state.ripple?.key ?? null}
          rippleService={state.ripple?.service ?? null}
          incidentService={cb && !state.finished ? cb.serviceId : null}
          accent={sceneAccent}
          gate={gate}
          reduced={reduced}
        />
      </div>

      {/* command-center registration crosshairs */}
      <div className="xhair tl" />
      <div className="xhair tr" />
      <div className="xhair bl" />
      <div className="xhair br" />

      {/* ── command bar ─────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between flex-wrap"
        style={{ position: "absolute", top: 0, left: 0, right: 0, gap: 12, padding: "16px 30px", zIndex: HUD_Z }}
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
          <MissionClock />
          <span className="pill">
            <span
              className="dot led"
              style={{
                background: alert ? "var(--color-danger)" : "var(--color-healthy)",
                boxShadow: `0 0 8px ${alert ? "var(--color-danger)" : "var(--color-healthy)"}`,
              }}
            />
            {alert ? "incident active" : "fleet nominal"}
          </span>
          <span className="pill">autonomy · guarded</span>
          <div className="seg" role="group" aria-label="data source">
            <button data-on={mode === "demo"} onClick={() => chooseMode("demo")}>Demo</button>
            <button data-on={mode === "live"} onClick={() => chooseMode("live")}>{loadingLive ? "…" : "Live"}</button>
          </div>
          <div className="seg" role="group" aria-label="playback speed">
            {[1, 2].map((s) => (
              <button key={s} data-on={p.speed === s} onClick={() => p.setSpeed(s)}>{s}×</button>
            ))}
          </div>
          <button className="btn-ghost" onClick={p.reset} aria-label="Reset the demo">Reset</button>
          <button className="btn-primary" onClick={p.running ? p.pause : p.play} aria-label={p.running ? "Pause" : "Run the demo"}>
            {state.finished ? "Replay" : p.running ? "Pause" : "Run"}
          </button>
        </div>
      </header>

      {/* ── self-heal loop tracker ─────────────────────────────────────── */}
      <div className="stage-wrap" style={{ position: "absolute", top: 66, left: "50%", transform: "translateX(-50%)", zIndex: HUD_Z }}>
        <StageTracker active={state.activeStage} lit={state.litStages} />
      </div>

      {/* ── active incident card ───────────────────────────────────────── */}
      <div className="hud-incident" style={{ position: "absolute", top: 96, left: 30, width: 290, zIndex: HUD_Z }}>
        <AnimatePresence>
          {cb && !state.finished && (
            <HudPanel
              key="incident"
              label={gate ? "governance · L2" : `incident · ${cb.riskTier}`}
              tone={incidentTone}
              code={cb.serviceId}
              reduced={reduced}
            >
              <div className="display" style={{ fontSize: 17, margin: "0 0 2px" }}>{cb.serviceName}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--color-muted)" }}>{cb.incidentClass}</div>
              <div className="hr" style={{ margin: "11px 0" }} />
              <div className="mono" style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "var(--color-faint)" }}>{cb.metricLabel}</span>
                <span style={{ color: "var(--color-danger)" }}>{cb.metricBad}</span>
                <span style={{ color: "var(--color-faint)" }}>→</span>
                <span style={{ color: "var(--color-healthy)" }}>{cb.metricGood}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, marginTop: 7, color: ACCENT_VAR[sceneAccent] }}>
                ⟐ {cb.usedAntibody ? "antibody recall — instant" : cb.action}
              </div>
            </HudPanel>
          )}
        </AnimatePresence>
      </div>

      {/* ── live log ───────────────────────────────────────────────────── */}
      <div className="hud-log" style={{ position: "absolute", bottom: 26, left: 30, width: 430, maxWidth: "44vw", zIndex: HUD_Z }}>
        <HudPanel label="self-heal log" code={mode.toUpperCase()} delay={0.08} reduced={reduced}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3, minHeight: 92 }}>
            <AnimatePresence initial={false}>
              {state.log.slice(-6).map((l) => (
                <motion.div
                  key={l.id}
                  initial={reduced ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="mono"
                  style={{ fontSize: 10.5, color: "var(--color-muted)", lineHeight: 1.5 }}
                >
                  <span style={{ color: ACCENT_VAR[l.accent] }}>▸ </span>
                  {l.text}
                </motion.div>
              ))}
            </AnimatePresence>
            {state.log.length === 0 && (
              <div className="mono" style={{ fontSize: 10.5, color: "var(--color-faint)" }}>
                press Run to deploy Aegis over the armada…
              </div>
            )}
          </div>
        </HudPanel>
      </div>

      {/* ── fleet stats ────────────────────────────────────────────────── */}
      <div className="hud-stats" style={{ position: "absolute", bottom: 26, right: 30, width: 264, zIndex: HUD_Z }}>
        <HudPanel label="fleet immunity" delay={0.16} reduced={reduced}>
          <div className="flex items-center" style={{ gap: 12 }}>
            <span className="metric-hero" style={{ fontSize: 40 }}>{coveragePct}<span style={{ fontSize: 18, color: "var(--color-muted)" }}>%</span></span>
            <div style={{ flex: 1 }}>
              <div style={{ height: 7, borderRadius: 99, background: "var(--color-surface)", overflow: "hidden" }}>
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
              <div className="stat-label" style={{ marginTop: 6 }}>coverage</div>
            </div>
          </div>
          <div className="hr" style={{ margin: "13px 0 11px" }} />
          {[
            { k: "antibodies", v: String(state.antibodies.length), c: "var(--color-evolve)" },
            { k: "auto-resolved", v: String(state.resolved), c: "var(--color-healthy)" },
            { k: "last MTTR", v: lastMttr === null ? "—" : `${lastMttr}s`, c: "var(--color-heal)" },
            { k: "router savings", v: "41%", c: "var(--color-warn)" },
          ].map((r) => (
            <div key={r.k} className="flex items-center justify-between mono" style={{ fontSize: 11, color: "var(--color-muted)", marginTop: 5 }}>
              <span>{r.k}</span>
              <span style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
        </HudPanel>
      </div>

      <MissionComplete
        show={state.finished}
        resolved={state.resolved}
        antibodies={state.antibodies.length}
        coveragePct={coveragePct}
        reduced={reduced}
        onReplay={p.play}
      />

      <GovernanceModal beat={state.pendingGate} onApprove={p.approve} onDeny={p.deny} />
    </main>
  );
}

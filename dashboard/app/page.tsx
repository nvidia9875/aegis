"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CoverageGauge } from "@/components/CoverageGauge";
import { FleetMap } from "@/components/FleetMap";
import { GovernanceModal } from "@/components/GovernanceModal";
import { HealingPipeline } from "@/components/HealingPipeline";
import { MttrSpark } from "@/components/MttrSpark";
import { Timeline } from "@/components/Timeline";
import { fetchLiveNarrative } from "@/lib/api";
import { NARRATIVE, SERVICES } from "@/lib/narrative";
import type { Beat } from "@/lib/types";
import { usePlayer } from "@/lib/usePlayer";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "var(--color-danger)",
  warning: "var(--color-warn)",
  info: "var(--color-muted)",
};

function Panel({ title, right, children, className = "" }: { title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass ${className}`} style={{ padding: 20 }}>
      <header className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <span className="panel-title">{title}</span>
        {right}
      </header>
      {children}
    </section>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <div className="glass" style={{ padding: "14px 16px" }}>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label" style={{ marginTop: 6 }}>
        {label}
      </div>
    </div>
  );
}

export default function Page() {
  const serviceIds = SERVICES.map((s) => s.id);
  const [beats, setBeats] = useState<Beat[]>(NARRATIVE);
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [loadingLive, setLoadingLive] = useState(false);
  const p = usePlayer(beats, serviceIds);

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
        return;
      }
      // backend unreachable — stay in demo (self-contained)
      return;
    }
    setBeats(NARRATIVE);
    setMode("demo");
    p.reset();
  }

  const { state } = p;
  const cb = p.currentBeat;
  const lastMttr = state.mttr.length ? state.mttr[state.mttr.length - 1] : null;
  const runLabel = state.finished ? "Replay" : p.running ? "Pause" : "Run";

  return (
    <main style={{ maxWidth: 1500, margin: "0 auto", padding: "28px 28px 48px" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="flex items-center justify-between flex-wrap" style={{ gap: 16, marginBottom: 22 }}>
        <div className="flex items-center" style={{ gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "color-mix(in oklch, var(--color-heal) 18%, var(--color-surface))",
              border: "1px solid color-mix(in oklch, var(--color-heal) 45%, transparent)",
              boxShadow: "0 0 22px color-mix(in oklch, var(--color-heal) 30%, transparent)",
              fontSize: 22,
            }}
          >
            🛡️
          </div>
          <div>
            <h1 className="display" style={{ fontSize: 26, margin: 0, letterSpacing: "-0.01em" }}>
              AEGIS <span style={{ color: "var(--color-faint)", fontWeight: 400 }}>· Mission Control</span>
            </h1>
            <p className="mono" style={{ margin: "2px 0 0", fontSize: 11, color: "var(--color-muted)" }}>
              autonomous SRE — heals your AI service before you wake up
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap" style={{ gap: 10 }}>
          <span className="pill">
            <span className="dot" style={{ background: "var(--color-healthy)", boxShadow: "0 0 8px var(--color-healthy)" }} />
            autonomy · guarded
          </span>
          <span className="pill">L0/L1 auto · L2 approval</span>
          <div className="seg" role="group" aria-label="data source">
            <button data-on={mode === "demo"} onClick={() => chooseMode("demo")}>
              Demo
            </button>
            <button data-on={mode === "live"} onClick={() => chooseMode("live")}>
              {loadingLive ? "…" : "Live"}
            </button>
          </div>
          <div className="seg" role="group" aria-label="speed">
            {[1, 2].map((s) => (
              <button key={s} data-on={p.speed === s} onClick={() => p.setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={p.reset}>
            Reset
          </button>
          <button className="btn-primary" onClick={p.running ? p.pause : p.play}>
            {runLabel}
          </button>
        </div>
      </header>

      {/* ── Healing pipeline (hero) ─────────────────────────────── */}
      <Panel
        title="Autonomous healing loop"
        right={
          cb && !state.finished ? (
            <motion.span
              key={cb.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mono"
              style={{ fontSize: 12, color: SEVERITY_COLOR[cb.severity] }}
            >
              ● {cb.serviceName} · {cb.incidentClass} [{cb.severity}]
            </motion.span>
          ) : (
            <span className="mono" style={{ fontSize: 12, color: "var(--color-faint)" }}>
              {state.finished ? "all incidents resolved" : "standing by"}
            </span>
          )
        }
      >
        <HealingPipeline activeStage={state.activeStage} litStages={state.litStages} />
      </Panel>

      {/* ── Main grid ───────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr)",
          gap: 18,
          marginTop: 18,
        }}
      >
        {/* left: log + stats */}
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="Live incident log" className="" >
            <div style={{ height: 300 }}>
              <Timeline lines={state.log} />
            </div>
          </Panel>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <Stat value={lastMttr != null ? `${lastMttr}s` : "—"} label="Last MTTR" accent="var(--color-heal)" />
            <Stat value={String(state.resolved)} label="Auto-resolved" accent="var(--color-healthy)" />
            <Stat value={String(state.antibodies.length)} label="Antibodies" accent="var(--color-evolve)" />
            <Stat value="41%" label="Router savings" accent="var(--color-warn)" />
          </div>

          <Panel title="MTTR per incident (antibody reuse → instant)">
            <MttrSpark points={state.mttr} />
          </Panel>
        </div>

        {/* right: fleet immunity */}
        <div style={{ display: "grid", gap: 18 }}>
          <Panel title="Fleet immunity">
            <FleetMap
              services={SERVICES}
              health={state.health}
              ripple={state.ripple}
              antibodyCount={state.antibodies.length}
            />
          </Panel>
          <Panel title="Immunity coverage">
            <div className="flex items-center" style={{ gap: 20 }}>
              <CoverageGauge value={p.coverage} />
              <div className="mono" style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.7 }}>
                <div>
                  classes covered:{" "}
                  <span style={{ color: "var(--color-ink)" }}>{state.covered.length}/5</span>
                </div>
                <div style={{ marginTop: 8, color: "var(--color-faint)" }}>
                  one incident immunizes
                  <br />
                  the whole fleet
                </div>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <GovernanceModal beat={state.pendingGate} onApprove={p.approve} onDeny={p.deny} />
    </main>
  );
}

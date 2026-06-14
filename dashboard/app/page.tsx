"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CoverageGauge } from "@/components/CoverageGauge";
import { FleetMap } from "@/components/FleetMap";
import { GovernanceModal } from "@/components/GovernanceModal";
import { HudFrame } from "@/components/HudFrame";
import { HudRuler } from "@/components/HudRuler";
import { MttrSpark } from "@/components/MttrSpark";
import { Waveform } from "@/components/Waveform";
import { HexReadout } from "@/components/HexReadout";
import dynamic from "next/dynamic";
import { Timeline } from "@/components/Timeline";
import { fetchLiveNarrative } from "@/lib/api";
import { NARRATIVE, SERVICES } from "@/lib/narrative";
import type { Beat } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { usePlayer } from "@/lib/usePlayer";

const ReactorCanvas = dynamic(() => import("@/components/reactor3d/ReactorCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ height: 460, display: "grid", placeItems: "center" }}>
      <span className="mono" style={{ color: "var(--color-faint)", fontSize: 11, letterSpacing: "0.2em" }}>
        INITIALIZING REACTOR…
      </span>
    </div>
  ),
});

function Stat({ value, label, accent }: { value: string; label: string; accent?: string }) {
  return (
    <HudFrame>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="stat-label" style={{ marginTop: 6 }}>{label}</div>
    </HudFrame>
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
      }
      return;
    }
    setBeats(NARRATIVE);
    setMode("demo");
    p.reset();
  }

  const { state } = p;
  const cb = p.currentBeat;
  const lastMttr = state.mttr.length ? state.mttr[state.mttr.length - 1] : null;
  const alert = cb && !state.finished && cb.severity === "critical";

  return (
    <main style={{ maxWidth: 1620, margin: "0 auto", padding: "16px 22px 40px", position: "relative" }}>
      <div className="scanline" />
      <HudRuler />

      {/* ── command bar ─────────────────────────────────────────── */}
      <header className="flex items-center justify-between flex-wrap" style={{ gap: 14, marginBottom: 16 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <h1 className="display" style={{ fontSize: 23, margin: 0 }}>
              AEGIS <span className="mono" style={{ fontSize: 12, color: "var(--color-faint)", letterSpacing: "0.2em" }}>// MISSION CONTROL</span>
            </h1>
            <p className="mono" style={{ margin: "1px 0 0", fontSize: 10, color: "var(--color-muted)", letterSpacing: "0.12em" }}>
              AUTONOMOUS SRE · SELF-HEALING AI SERVICES
            </p>
          </div>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: 9 }}>
          <span className="pill">
            <span className="dot" style={{ background: alert ? "var(--color-danger)" : "var(--color-healthy)", boxShadow: `0 0 8px ${alert ? "var(--color-danger)" : "var(--color-healthy)"}` }} />
            {alert ? "incident active" : "nominal"}
          </span>
          <span className="pill">autonomy · guarded</span>
          <div className="seg" role="group" aria-label="source">
            <button data-on={mode === "demo"} onClick={() => chooseMode("demo")}>Demo</button>
            <button data-on={mode === "live"} onClick={() => chooseMode("live")}>{loadingLive ? "…" : "Live"}</button>
          </div>
          <div className="seg" role="group" aria-label="speed">
            {[1, 2].map((s) => (<button key={s} data-on={p.speed === s} onClick={() => p.setSpeed(s)}>{s}×</button>))}
          </div>
          <button className="btn-ghost" onClick={p.reset}>Reset</button>
          <button className="btn-primary" onClick={p.running ? p.pause : p.play}>
            {state.finished ? "Replay" : p.running ? "Pause" : "Run"}
          </button>
        </div>
      </header>

      {/* ── main command grid ───────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0,1fr) 300px", gap: 14, alignItems: "start" }}>
        {/* left column */}
        <div style={{ display: "grid", gap: 14 }}>
          <HudFrame label="Live incident log">
            <div style={{ height: 304 }}><Timeline lines={state.log} /></div>
          </HudFrame>
          <HudFrame label="Telemetry // rx">
            <Waveform />
          </HudFrame>
          <HudFrame label="MTTR signal">
            <MttrSpark points={state.mttr} />
          </HudFrame>
        </div>

        {/* center: reactor + stats */}
        <div style={{ display: "grid", gap: 14 }}>
          <HudFrame
            label="Autonomous healing core"
            accent={alert ? "danger" : "heal"}
            style={{ paddingBottom: 8 }}
          >
            <div style={{ position: "relative" }}>
              {cb && !state.finished && (
                <motion.div key={cb.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="mono" style={{ position: "absolute", top: 4, right: 6, fontSize: 11, color: cb.severity === "critical" ? "var(--color-danger)" : "var(--color-warn)" }}>
                  ● {cb.serviceName} · {cb.action}
                </motion.div>
              )}
              {state.finished && (
                <div className="mono" style={{ position: "absolute", top: 4, right: 6, fontSize: 11, color: "var(--color-healthy)" }}>
                  ✔ all incidents resolved
                </div>
              )}
              <div style={{ height: 460 }}>
                <ReactorCanvas
                  activeIndex={state.activeStage ? STAGES.findIndex((s) => s.id === state.activeStage) : -1}
                  litCount={state.litStages.length}
                  coverage={p.coverage}
                  antibodies={state.antibodies.length}
                  accent={alert ? "danger" : state.finished ? "healthy" : "heal"}
                />
              </div>
            </div>
          </HudFrame>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <Stat value={lastMttr != null ? `${lastMttr}s` : "—"} label="Last MTTR" accent="var(--color-heal)" />
            <Stat value={String(state.resolved)} label="Auto-resolved" accent="var(--color-healthy)" />
            <Stat value={String(state.antibodies.length)} label="Antibodies" accent="var(--color-evolve)" />
            <Stat value="41%" label="Router savings" accent="var(--color-orbit)" />
          </div>
        </div>

        {/* right column */}
        <div style={{ display: "grid", gap: 14 }}>
          <HudFrame label={alert ? "⚠ alert" : "status"} accent={alert ? "danger" : "heal"}>
            {alert && cb ? (
              <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.7 }}>
                <div style={{ color: "var(--color-danger)", fontSize: 13 }}>{cb.incidentClass.toUpperCase()}</div>
                <div style={{ color: "var(--color-muted)", marginTop: 4 }}>{cb.serviceName}</div>
                <div style={{ color: "var(--color-faint)", marginTop: 4 }}>tier {cb.riskTier} · {cb.metricLabel} {cb.metricBad}</div>
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 11.5, color: "var(--color-healthy)" }}>all systems nominal</div>
            )}
          </HudFrame>
          <HudFrame label="Fleet immunity">
            <FleetMap services={SERVICES} health={state.health} ripple={state.ripple} antibodyCount={state.antibodies.length} />
          </HudFrame>
          <HudFrame label="Immunity coverage">
            <div className="flex items-center" style={{ gap: 16 }}>
              <CoverageGauge value={p.coverage} />
              <div className="mono" style={{ fontSize: 11, color: "var(--color-muted)", lineHeight: 1.7 }}>
                <div>covered <span style={{ color: "var(--color-ink)" }}>{state.covered.length}/5</span></div>
                <div style={{ marginTop: 6, color: "var(--color-faint)" }}>one incident<br />immunizes all</div>
              </div>
            </div>
          </HudFrame>
        </div>
      </div>

      {/* ── bottom diagnostics strip ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginTop: 14 }}>
        <HudFrame label="Diagnostics // F1">
          <HexReadout />
        </HudFrame>
        <HudFrame label="Signal // analysis">
          <div style={{ display: "grid", gap: 12 }}>
            <Waveform color="var(--color-evolve)" bars={48} />
            <Waveform color="var(--color-orbit)" bars={48} />
          </div>
        </HudFrame>
      </div>

      <GovernanceModal beat={state.pendingGate} onApprove={p.approve} onDeny={p.deny} />
    </main>
  );
}

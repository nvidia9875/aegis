"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { GovernanceModal } from "@/components/GovernanceModal";
import { fetchLiveNarrative } from "@/lib/api";
import { NARRATIVE, SERVICES } from "@/lib/narrative";
import type { Beat } from "@/lib/types";
import { STAGES } from "@/lib/types";
import { usePlayer } from "@/lib/usePlayer";

const ReactorCanvas = dynamic(() => import("@/components/reactor3d/ReactorCanvas"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
      <span className="mono" style={{ color: "var(--color-faint)", fontSize: 11, letterSpacing: "0.24em" }}>
        INITIALIZING REACTOR…
      </span>
    </div>
  ),
});

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
  const alert = !!cb && !state.finished && cb.severity === "critical";
  const lastMttr = state.mttr.length ? state.mttr[state.mttr.length - 1] : null;

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column", padding: "14px 20px 18px" }}>
      {/* command bar — the only DOM chrome (controls). Everything else is the 3D scene. */}
      <header className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 8 }}>
        <div className="flex items-center" style={{ gap: 12 }}>
          <span style={{ fontSize: 20 }}>🛡️</span>
          <div>
            <h1 className="display" style={{ fontSize: 21, margin: 0 }}>
              AEGIS <span className="mono" style={{ fontSize: 11, color: "var(--color-faint)", letterSpacing: "0.2em" }}>// MISSION CONTROL</span>
            </h1>
            <p className="mono" style={{ margin: "1px 0 0", fontSize: 9.5, color: "var(--color-muted)", letterSpacing: "0.12em" }}>
              AUTONOMOUS SRE FOR AI SERVICES · LIVE SELF-HEAL LOOP
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

      {/* the entire visualization is the WebGL scene */}
      <div style={{ flex: 1, minHeight: 540, position: "relative" }}>
        <ReactorCanvas
          activeIndex={state.activeStage ? STAGES.findIndex((s) => s.id === state.activeStage) : -1}
          coverage={p.coverage}
          antibodies={state.antibodies.length}
          accent={alert ? "danger" : state.finished ? "healthy" : "heal"}
          stages={STAGES.map((s) => ({ label: s.label, lit: state.litStages.includes(s.id), active: s.id === state.activeStage }))}
          log={state.log.map((l) => ({ id: l.id, text: l.text, accent: l.accent }))}
          services={SERVICES.map((s) => ({ id: s.id, name: s.name, health: state.health[s.id] ?? "healthy" }))}
          mttr={lastMttr}
          resolved={state.resolved}
          routerSavings="41%"
          incident={cb && !state.finished ? { service: cb.serviceName, klass: cb.incidentClass, severity: cb.severity } : null}
        />
      </div>

      <GovernanceModal beat={state.pendingGate} onApprove={p.approve} onDeny={p.deny} />
    </main>
  );
}

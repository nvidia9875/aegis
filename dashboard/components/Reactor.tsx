"use client";

import { motion } from "framer-motion";
import { ACCENT_VAR } from "@/lib/colors";
import { STAGES } from "@/lib/types";
import type { Beat, StageId } from "@/lib/types";
import type { Health } from "@/lib/usePlayer";

const GLYPH: Record<StageId, string> = {
  detect: "◎", perceive: "◍", recall: "⟲", reason: "✦",
  act: "➤", verify: "✔", reflect: "❖", immunize: "✺",
};

// main reactor center
const MX = 280;
const MY = 250;
const R_TICKS = 222;
const R_STAGE = 202;
const R_SPIN_A = 182;
const R_ORBIT_O = 170;
const R_SPIN_B = 146;
const R_ORBIT_V = 130;
const R_COVER = 110;
const R_SVC = 88;
const R_CORE = 50;

// stacked ghost disk center
const GX = 280;
const GY = 452;

const pt = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
};

function Orbit({ cx, cy, r, count, color, dur, rev, op = 1 }: {
  cx: number; cy: number; r: number; count: number; color: string; dur: number; rev?: boolean; op?: number;
}) {
  return (
    <g className={rev ? "svg-spin-rev" : "svg-spin"} style={{ transformOrigin: `${cx}px ${cy}px`, animationDuration: `${dur}s`, opacity: op }}>
      {Array.from({ length: count }).map((_, i) => {
        const p = pt(cx, cy, r, (360 / count) * i);
        const o = 0.25 + 0.75 * ((i % 5) / 4);
        return <circle key={i} cx={p.x} cy={p.y} r={i % 6 === 0 ? 3 : 1.7} fill={color} opacity={o} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
      })}
    </g>
  );
}

function GhostDisk() {
  return (
    <g opacity={0.4}>
      <ellipse cx={GX} cy={GY} rx={150} ry={150} fill="none" stroke="var(--color-line)" strokeWidth={1} />
      <circle className="svg-spin" style={{ transformOrigin: `${GX}px ${GY}px`, animationDuration: "26s" }} cx={GX} cy={GY} r={132} fill="none" stroke="var(--color-evolve)" strokeWidth={1.5} strokeDasharray="3 12" opacity={0.6} />
      <circle className="svg-spin-rev" style={{ transformOrigin: `${GX}px ${GY}px`, animationDuration: "20s" }} cx={GX} cy={GY} r={104} fill="none" stroke="var(--color-heal)" strokeWidth={1.5} strokeDasharray="18 12" opacity={0.5} />
      <Orbit cx={GX} cy={GY} r={118} count={20} color="var(--color-orbit)" dur={14} op={0.7} />
      <circle cx={GX} cy={GY} r={34} fill="url(#coreG)" style={{ filter: "drop-shadow(0 0 16px var(--color-evolve))" }} />
    </g>
  );
}

export function Reactor({
  activeStage, litStages, coverage, antibodies, services, health, currentBeat,
}: {
  activeStage: StageId | null;
  litStages: StageId[];
  coverage: number;
  antibodies: number;
  services: { id: string; name: string }[];
  health: Record<string, Health>;
  currentBeat: Beat | null;
}) {
  const activeIdx = activeStage ? STAGES.findIndex((s) => s.id === activeStage) : -1;
  const stageAngle = (i: number) => -90 + i * (360 / STAGES.length);
  const coverC = 2 * Math.PI * R_COVER;
  const healthColor: Record<Health, string> = {
    healthy: "var(--color-healthy)", healing: "var(--color-heal)", incident: "var(--color-danger)",
  };

  return (
    <svg viewBox="0 0 560 600" className="w-full" role="img" aria-label="Aegis healing reactor">
      <defs>
        <radialGradient id="coreG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(98% 0.05 195)" />
          <stop offset="45%" stopColor="var(--color-heal)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--color-heal) 8%, transparent)" />
        </radialGradient>
        <radialGradient id="sweepG" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in oklch, var(--color-heal) 55%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <GhostDisk />

      {/* radar sweep beam */}
      <g className="svg-spin" style={{ transformOrigin: `${MX}px ${MY}px`, animationDuration: "6s" }}>
        <path d={`M ${MX} ${MY} L ${pt(MX, MY, R_STAGE, -64).x} ${pt(MX, MY, R_STAGE, -64).y} A ${R_STAGE} ${R_STAGE} 0 0 1 ${pt(MX, MY, R_STAGE, -90).x} ${pt(MX, MY, R_STAGE, -90).y} Z`} fill="url(#sweepG)" />
        <line x1={MX} y1={MY} x2={pt(MX, MY, R_STAGE, -90).x} y2={pt(MX, MY, R_STAGE, -90).y} stroke="var(--color-heal)" strokeWidth={1.5} opacity={0.7} />
      </g>

      {/* guide circles */}
      {[R_TICKS, R_STAGE, R_SPIN_A, R_SPIN_B, R_SVC].map((r) => (
        <circle key={r} cx={MX} cy={MY} r={r} fill="none" stroke="var(--color-line)" strokeWidth={1} opacity={0.4} />
      ))}

      {/* tick ring */}
      <g opacity={0.6}>
        {Array.from({ length: 72 }).map((_, i) => {
          const a = i * 5;
          const o = pt(MX, MY, R_TICKS, a);
          const inr = pt(MX, MY, R_TICKS - (i % 6 === 0 ? 10 : 5), a);
          return <line key={i} x1={o.x} y1={o.y} x2={inr.x} y2={inr.y} stroke="var(--color-heal)" strokeWidth={1} opacity={i % 6 === 0 ? 0.7 : 0.28} />;
        })}
      </g>

      {/* counter-rotating dashed rings */}
      <circle className="svg-spin" style={{ transformOrigin: `${MX}px ${MY}px`, animationDuration: "30s" }} cx={MX} cy={MY} r={R_SPIN_A} fill="none" stroke="var(--color-heal)" strokeWidth={1.5} strokeDasharray="2 10" opacity={0.5} />
      <circle className="svg-spin-rev" style={{ transformOrigin: `${MX}px ${MY}px`, animationDuration: "22s" }} cx={MX} cy={MY} r={R_SPIN_B} fill="none" stroke="var(--color-evolve)" strokeWidth={1.5} strokeDasharray="20 14" opacity={0.45} />

      {/* orbiting particles */}
      <Orbit cx={MX} cy={MY} r={R_ORBIT_O} count={26} color="var(--color-orbit)" dur={13} />
      <Orbit cx={MX} cy={MY} r={R_ORBIT_V} count={18} color="var(--color-evolve)" dur={18} rev />

      {/* immunity coverage arc */}
      <g transform={`rotate(-90 ${MX} ${MY})`}>
        <circle cx={MX} cy={MY} r={R_COVER} fill="none" stroke="var(--color-line)" strokeWidth={4} opacity={0.5} />
        <motion.circle cx={MX} cy={MY} r={R_COVER} fill="none" stroke="var(--color-heal)" strokeWidth={4} strokeLinecap="round"
          strokeDasharray={coverC} initial={false} animate={{ strokeDashoffset: coverC * (1 - coverage) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ filter: "drop-shadow(0 0 6px var(--color-heal))" }} />
      </g>

      {/* active sweep line */}
      {activeIdx >= 0 && (() => {
        const p = pt(MX, MY, R_STAGE - 14, stageAngle(activeIdx));
        return <motion.line x1={MX} y1={MY} initial={false} animate={{ x2: p.x, y2: p.y }} transition={{ type: "spring", stiffness: 120, damping: 18 }} stroke={ACCENT_VAR[STAGES[activeIdx].accent]} strokeWidth={1.5} opacity={0.85} />;
      })()}

      {/* service health nodes */}
      {services.slice(0, 2).map((s, i) => {
        const p = pt(MX, MY, R_SVC, i === 0 ? 180 : 0);
        const col = healthColor[health[s.id] ?? "healthy"];
        return (
          <g key={s.id}>
            <circle cx={p.x} cy={p.y} r={9} fill={`color-mix(in oklch, ${col} 25%, var(--color-surface))`} stroke={col} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
            <text x={p.x} y={p.y + (i === 0 ? -15 : 19)} textAnchor="middle" fontSize={8} fill="var(--color-muted)" style={{ fontFamily: "var(--font-mono)" }}>{s.name}</text>
          </g>
        );
      })}

      {/* 8 stage nodes */}
      {STAGES.map((s, i) => {
        const ang = stageAngle(i);
        const p = pt(MX, MY, R_STAGE, ang);
        const lp = pt(MX, MY, R_STAGE + 20, ang);
        const lit = litStages.includes(s.id);
        const active = s.id === activeStage;
        const col = ACCENT_VAR[s.accent];
        const cos = Math.cos((ang * Math.PI) / 180);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <g key={s.id}>
            {active && (
              <motion.circle cx={p.x} cy={p.y} r={15} fill="none" stroke={col} strokeWidth={2}
                initial={{ opacity: 0.5, scale: 1 }} animate={{ opacity: [0.5, 0], scale: [1, 2.4] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }} style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "fill-box" }} />
            )}
            <circle cx={p.x} cy={p.y} r={13}
              fill={lit ? `color-mix(in oklch, ${col} 30%, var(--color-surface))` : "var(--color-surface)"}
              stroke={active ? col : lit ? `color-mix(in oklch, ${col} 55%, transparent)` : "var(--color-line)"}
              strokeWidth={active ? 2.5 : 1.5} style={active ? { filter: `drop-shadow(0 0 12px ${col})` } : undefined} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill={lit ? "var(--color-ink)" : "var(--color-faint)"}>{GLYPH[s.id]}</text>
            <text x={lp.x} y={lp.y} textAnchor={anchor} dominantBaseline="middle" fontSize={8.5} fill={active ? col : lit ? "var(--color-muted)" : "var(--color-faint)"} style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>{s.label.toUpperCase()}</text>
          </g>
        );
      })}

      {/* core emit pulses */}
      {[0, 0.9, 1.8].map((d) => (
        <circle key={d} className="emit" style={{ transformOrigin: `${MX}px ${MY}px`, animationDelay: `${d}s` }} cx={MX} cy={MY} r={R_CORE} fill="none" stroke="var(--color-heal)" strokeWidth={1.5} />
      ))}

      {/* core */}
      <circle cx={MX} cy={MY} r={R_CORE} fill="url(#coreG)" style={{ filter: "drop-shadow(0 0 26px var(--color-heal))" }} />
      <text x={MX} y={MY - 11} textAnchor="middle" fontSize={10} fill="var(--color-abyss)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em", fontWeight: 700 }}>AEGIS</text>
      <text x={MX} y={MY + 7} textAnchor="middle" fontSize={19} fill="var(--color-abyss)" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{antibodies} ✺</text>
      <text x={MX} y={MY + 21} textAnchor="middle" fontSize={7} fill="color-mix(in oklch, var(--color-abyss) 78%, transparent)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>
        {currentBeat ? currentBeat.incidentClass.slice(0, 16).toUpperCase() : "STANDBY"}
      </text>
    </svg>
  );
}

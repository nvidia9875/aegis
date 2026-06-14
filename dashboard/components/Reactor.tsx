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

const C = 280; // center
const R_TICKS = 252;
const R_STAGE = 230;
const R_SPIN_A = 208;
const R_ORBIT_O = 194;
const R_SPIN_B = 166;
const R_ORBIT_V = 148;
const R_COVER = 126;
const R_SVC = 102;
const R_CORE = 58;

const pt = (r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
};

const spin = (origin = `${C}px ${C}px`) => ({ transformOrigin: origin, transformBox: "fill-box" as const });

function Orbit({ r, count, color, dur, dir }: { r: number; count: number; color: string; dur: number; dir: 1 | -1 }) {
  return (
    <motion.g
      style={spin()}
      animate={{ rotate: 360 * dir }}
      transition={{ repeat: Infinity, duration: dur, ease: "linear" }}
    >
      {Array.from({ length: count }).map((_, i) => {
        const p = pt(r, (360 / count) * i);
        const op = 0.25 + 0.75 * ((i % 5) / 4);
        return <circle key={i} cx={p.x} cy={p.y} r={i % 6 === 0 ? 3 : 1.8} fill={color} opacity={op} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />;
      })}
    </motion.g>
  );
}

export function Reactor({
  activeStage,
  litStages,
  coverage,
  antibodies,
  services,
  health,
  currentBeat,
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
    <svg viewBox="0 0 560 560" className="w-full" role="img" aria-label="Aegis healing reactor">
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(98% 0.05 195)" />
          <stop offset="45%" stopColor="var(--color-heal)" />
          <stop offset="100%" stopColor="color-mix(in oklch, var(--color-heal) 10%, transparent)" />
        </radialGradient>
      </defs>

      {/* faint guide circles */}
      {[R_TICKS, R_STAGE, R_SPIN_A, R_SPIN_B, R_SVC].map((r) => (
        <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="var(--color-line)" strokeWidth={1} opacity={0.4} />
      ))}

      {/* tick ring */}
      <g opacity={0.6}>
        {Array.from({ length: 72 }).map((_, i) => {
          const a = i * 5;
          const o = pt(R_TICKS, a);
          const inr = pt(R_TICKS - (i % 6 === 0 ? 10 : 5), a);
          return <line key={i} x1={o.x} y1={o.y} x2={inr.x} y2={inr.y} stroke="var(--color-heal)" strokeWidth={1} opacity={i % 6 === 0 ? 0.7 : 0.3} />;
        })}
      </g>

      {/* counter-rotating dashed rings */}
      <motion.circle cx={C} cy={C} r={R_SPIN_A} fill="none" stroke="var(--color-heal)" strokeWidth={1.5}
        strokeDasharray="2 10" opacity={0.5} style={spin()} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 30, ease: "linear" }} />
      <motion.circle cx={C} cy={C} r={R_SPIN_B} fill="none" stroke="var(--color-evolve)" strokeWidth={1.5}
        strokeDasharray="20 14" opacity={0.45} style={spin()} animate={{ rotate: -360 }} transition={{ repeat: Infinity, duration: 24, ease: "linear" }} />

      {/* orbiting particles */}
      <Orbit r={R_ORBIT_O} count={26} color="var(--color-orbit)" dur={16} dir={1} />
      <Orbit r={R_ORBIT_V} count={18} color="var(--color-evolve)" dur={22} dir={-1} />

      {/* immunity coverage arc */}
      <g transform={`rotate(-90 ${C} ${C})`}>
        <circle cx={C} cy={C} r={R_COVER} fill="none" stroke="var(--color-line)" strokeWidth={4} opacity={0.5} />
        <motion.circle cx={C} cy={C} r={R_COVER} fill="none" stroke="var(--color-heal)" strokeWidth={4} strokeLinecap="round"
          strokeDasharray={coverC} initial={false} animate={{ strokeDashoffset: coverC * (1 - coverage) }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} style={{ filter: "drop-shadow(0 0 6px var(--color-heal))" }} />
      </g>

      {/* active sweep line from core to active stage */}
      {activeIdx >= 0 && (() => {
        const p = pt(R_STAGE - 16, stageAngle(activeIdx));
        return (
          <motion.line x1={C} y1={C} initial={false} animate={{ x2: p.x, y2: p.y }} transition={{ type: "spring", stiffness: 120, damping: 18 }}
            stroke={ACCENT_VAR[STAGES[activeIdx].accent]} strokeWidth={1.5} opacity={0.8} />
        );
      })()}

      {/* service health nodes (inner ring, left & right) */}
      {services.slice(0, 2).map((s, i) => {
        const p = pt(R_SVC, i === 0 ? 180 : 0);
        const col = healthColor[health[s.id] ?? "healthy"];
        return (
          <g key={s.id}>
            <circle cx={p.x} cy={p.y} r={9} fill={`color-mix(in oklch, ${col} 25%, var(--color-surface))`} stroke={col} strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 6px ${col})` }} />
            <text x={p.x} y={p.y + (i === 0 ? -16 : 20)} textAnchor="middle" fontSize={8.5} fill="var(--color-muted)" style={{ fontFamily: "var(--font-mono)" }}>{s.name}</text>
          </g>
        );
      })}

      {/* 8 stage nodes around the rim */}
      {STAGES.map((s, i) => {
        const ang = stageAngle(i);
        const p = pt(R_STAGE, ang);
        const lp = pt(R_STAGE + 22, ang);
        const lit = litStages.includes(s.id);
        const active = s.id === activeStage;
        const col = ACCENT_VAR[s.accent];
        const cos = Math.cos((ang * Math.PI) / 180);
        const anchor = cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle";
        return (
          <g key={s.id}>
            {active && (
              <motion.circle cx={p.x} cy={p.y} r={16} fill="none" stroke={col} strokeWidth={2}
                initial={{ opacity: 0.5, scale: 1 }} animate={{ opacity: [0.5, 0], scale: [1, 2.4] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }} style={spin(`${p.x}px ${p.y}px`)} />
            )}
            <circle cx={p.x} cy={p.y} r={14}
              fill={lit ? `color-mix(in oklch, ${col} 30%, var(--color-surface))` : "var(--color-surface)"}
              stroke={active ? col : lit ? `color-mix(in oklch, ${col} 55%, transparent)` : "var(--color-line)"}
              strokeWidth={active ? 2.5 : 1.5} style={active ? { filter: `drop-shadow(0 0 12px ${col})` } : undefined} />
            <text x={p.x} y={p.y + 1} textAnchor="middle" dominantBaseline="middle" fontSize={13} fill={lit ? "var(--color-ink)" : "var(--color-faint)"}>{GLYPH[s.id]}</text>
            <text x={lp.x} y={lp.y} textAnchor={anchor} dominantBaseline="middle" fontSize={9} fill={active ? col : lit ? "var(--color-muted)" : "var(--color-faint)"} style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}>{s.label.toUpperCase()}</text>
          </g>
        );
      })}

      {/* core */}
      <motion.circle cx={C} cy={C} r={R_CORE + 8} fill="none" stroke="var(--color-heal)" strokeWidth={1} opacity={0.4}
        animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }} style={spin()} />
      <circle cx={C} cy={C} r={R_CORE} fill="url(#core)" style={{ filter: "drop-shadow(0 0 24px var(--color-heal))" }} />
      <text x={C} y={C - 12} textAnchor="middle" fontSize={11} fill="var(--color-abyss)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em", fontWeight: 700 }}>AEGIS</text>
      <text x={C} y={C + 6} textAnchor="middle" fontSize={20} fill="var(--color-abyss)" style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}>{antibodies} ✺</text>
      <text x={C} y={C + 22} textAnchor="middle" fontSize={7.5} fill="color-mix(in oklch, var(--color-abyss) 75%, transparent)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.12em" }}>
        {currentBeat ? currentBeat.incidentClass.slice(0, 18).toUpperCase() : "STANDBY"}
      </text>
    </svg>
  );
}

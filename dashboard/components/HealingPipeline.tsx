"use client";

import { motion } from "framer-motion";
import { ACCENT_VAR } from "@/lib/colors";
import { STAGES } from "@/lib/types";
import type { StageId } from "@/lib/types";

const GLYPH: Record<StageId, string> = {
  detect: "◎",
  perceive: "◍",
  recall: "⟲",
  reason: "✦",
  act: "➤",
  verify: "✔",
  reflect: "❖",
  immunize: "✺",
};

const W = 1120;
const H = 200;
const PAD = 80;
const Y = 96;
const nodeX = (i: number) => PAD + i * ((W - 2 * PAD) / (STAGES.length - 1));

export function HealingPipeline({
  activeStage,
  litStages,
}: {
  activeStage: StageId | null;
  litStages: StageId[];
}) {
  const activeIndex = activeStage ? STAGES.findIndex((s) => s.id === activeStage) : -1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Aegis healing pipeline">
      {/* edges */}
      {STAGES.slice(0, -1).map((_, i) => {
        const x1 = nodeX(i);
        const x2 = nodeX(i + 1);
        const isActiveEdge = i + 1 === activeIndex;
        const col = ACCENT_VAR[STAGES[i + 1].accent];
        return (
          <line
            key={`e${i}`}
            x1={x1}
            y1={Y}
            x2={x2}
            y2={Y}
            stroke={isActiveEdge ? col : "var(--color-line)"}
            strokeWidth={isActiveEdge ? 2.5 : 1.5}
            className={isActiveEdge ? "edge-flow" : ""}
            opacity={isActiveEdge ? 1 : 0.45}
          />
        );
      })}

      {/* particles flowing along the active edge */}
      {activeIndex > 0 &&
        [0, 0.33, 0.66].map((d, k) => {
          const x1 = nodeX(activeIndex - 1);
          const x2 = nodeX(activeIndex);
          const col = ACCENT_VAR[STAGES[activeIndex].accent];
          return (
            <motion.circle
              key={`p${k}-${activeIndex}`}
              r={3}
              fill={col}
              initial={{ cx: x1, opacity: 0 }}
              animate={{ cx: [x1, x2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.85, repeat: Infinity, ease: "linear", delay: d * 0.85 }}
              cy={Y}
              style={{ filter: `drop-shadow(0 0 4px ${col})` }}
            />
          );
        })}

      {/* nodes */}
      {STAGES.map((s, i) => {
        const x = nodeX(i);
        const lit = litStages.includes(s.id);
        const active = s.id === activeStage;
        const col = ACCENT_VAR[s.accent];
        return (
          <g key={s.id}>
            {active && (
              <motion.circle
                cx={x}
                cy={Y}
                r={24}
                fill="none"
                stroke={col}
                strokeWidth={2}
                initial={{ opacity: 0.5, scale: 1 }}
                animate={{ opacity: [0.5, 0], scale: [1, 2.3] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut" }}
                style={{ transformOrigin: `${x}px ${Y}px` }}
              />
            )}
            <circle
              cx={x}
              cy={Y}
              r={21}
              fill={
                lit
                  ? `color-mix(in oklch, ${col} 26%, var(--color-surface))`
                  : "var(--color-surface)"
              }
              stroke={active ? col : lit ? `color-mix(in oklch, ${col} 55%, transparent)` : "var(--color-line)"}
              strokeWidth={active ? 2.5 : 1.5}
              style={active ? { filter: `drop-shadow(0 0 14px ${col})` } : undefined}
            />
            <text
              x={x}
              y={Y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={17}
              fill={lit ? "var(--color-ink)" : "var(--color-faint)"}
            >
              {GLYPH[s.id]}
            </text>
            <text
              x={x}
              y={Y - 32}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-faint)"
              style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.1em" }}
            >
              {String(i + 1).padStart(2, "0")}
            </text>
            <text
              x={x}
              y={Y + 42}
              textAnchor="middle"
              fontSize={10.5}
              fill={active ? col : lit ? "var(--color-muted)" : "var(--color-faint)"}
              style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.14em" }}
            >
              {s.label.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

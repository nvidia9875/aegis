"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ServiceNode } from "@/lib/types";
import type { Health } from "@/lib/usePlayer";

const HEALTH_COLOR: Record<Health, string> = {
  healthy: "var(--color-healthy)",
  healing: "var(--color-heal)",
  incident: "var(--color-danger)",
};

const W = 360;
const H = 280;
const CX = 180;
const CY = 140;
const R = 96;

export function FleetMap({
  services,
  health,
  ripple,
  antibodyCount,
}: {
  services: ServiceNode[];
  health: Record<string, Health>;
  ripple: { key: number; service: string } | null;
  antibodyCount: number;
}) {
  const positions = services.map((s, i) => {
    const angle = ((-90 + i * (360 / services.length)) * Math.PI) / 180;
    return { ...s, x: CX + R * Math.cos(angle), y: CY + R * Math.sin(angle) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Fleet immunity map">
      {positions.map((p) => (
        <line key={`l${p.id}`} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--color-line)" strokeWidth={1} opacity={0.5} />
      ))}

      {/* hub */}
      <circle
        cx={CX}
        cy={CY}
        r={30}
        fill="color-mix(in oklch, var(--color-evolve) 18%, var(--color-surface))"
        stroke="color-mix(in oklch, var(--color-evolve) 55%, transparent)"
        strokeWidth={1.5}
      />
      <text x={CX} y={CY - 3} textAnchor="middle" dominantBaseline="middle" fontSize={10} fill="var(--color-ink)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.16em" }}>
        FLEET
      </text>
      <text x={CX} y={CY + 12} textAnchor="middle" fontSize={11} fill="var(--color-evolve)" style={{ fontFamily: "var(--font-mono)" }}>
        {antibodyCount} ✺
      </text>

      {/* immunize / reuse ripple */}
      <AnimatePresence>
        {ripple &&
          (() => {
            const p = positions.find((x) => x.id === ripple.service);
            if (!p) return null;
            return (
              <motion.circle
                key={ripple.key}
                cx={p.x}
                cy={p.y}
                r={14}
                fill="none"
                stroke="var(--color-heal)"
                strokeWidth={2}
                initial={{ opacity: 0.85, scale: 1 }}
                animate={{ opacity: 0, scale: 4 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            );
          })()}
      </AnimatePresence>

      {/* service nodes */}
      {positions.map((p) => {
        const col = HEALTH_COLOR[health[p.id] ?? "healthy"];
        const incident = (health[p.id] ?? "healthy") === "incident";
        return (
          <g key={p.id}>
            <motion.circle
              cx={p.x}
              cy={p.y}
              r={18}
              fill={`color-mix(in oklch, ${col} 22%, var(--color-surface))`}
              stroke={col}
              strokeWidth={1.5}
              animate={{
                filter: incident
                  ? [`drop-shadow(0 0 4px ${col})`, `drop-shadow(0 0 13px ${col})`, `drop-shadow(0 0 4px ${col})`]
                  : `drop-shadow(0 0 6px ${col})`,
              }}
              transition={{ duration: 1, repeat: incident ? Infinity : 0 }}
            />
            <text x={p.x} y={p.y + 33} textAnchor="middle" fontSize={10} fill="var(--color-muted)" style={{ fontFamily: "var(--font-mono)" }}>
              {p.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

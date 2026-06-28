"use client";

import type { Accent, StageId } from "@/lib/types";
import { STAGES } from "@/lib/types";

const ACCENT_VAR: Record<Accent, string> = {
  heal: "var(--color-heal)",
  evolve: "var(--color-evolve)",
  warn: "var(--color-warn)",
  danger: "var(--color-danger)",
  healthy: "var(--color-healthy)",
};

/** Compact tracker for the 8-stage self-heal loop, lit as the operator progresses. */
export function StageTracker({ active, lit }: { active: StageId | null; lit: StageId[] }) {
  return (
    <div className="glass flex items-center" style={{ gap: 4, padding: "7px 10px" }}>
      {STAGES.map((s, i) => {
        const isActive = s.id === active;
        const isLit = lit.includes(s.id);
        const color = isActive || isLit ? ACCENT_VAR[s.accent] : "var(--color-faint)";
        return (
          <div key={s.id} className="flex items-center" style={{ gap: 4 }}>
            {i > 0 && <span style={{ width: 8, height: 1, background: "var(--color-line)" }} />}
            <span
              style={{
                width: isActive ? 7 : 5,
                height: isActive ? 7 : 5,
                borderRadius: 99,
                background: color,
                boxShadow: isActive ? `0 0 9px ${color}` : "none",
                transition: "all 240ms cubic-bezier(0.16,1,0.3,1)",
              }}
            />
            <span
              className="mono"
              style={{
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: isActive ? "var(--color-ink)" : isLit ? "var(--color-muted)" : "var(--color-faint)",
                opacity: isActive ? 1 : isLit ? 0.9 : 0.55,
              }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

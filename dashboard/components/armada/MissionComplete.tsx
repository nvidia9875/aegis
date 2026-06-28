"use client";

import { AnimatePresence, motion } from "framer-motion";

interface MissionCompleteProps {
  show: boolean;
  resolved: number;
  antibodies: number;
  coveragePct: number;
  reduced: boolean;
  onReplay: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const Stat = ({ value, label, color }: { value: string; label: string; color: string }) => (
  <div style={{ textAlign: "center" }}>
    <div className="metric-hero" style={{ fontSize: 34, color }}>
      {value}
    </div>
    <div className="stat-label" style={{ marginTop: 6 }}>
      {label}
    </div>
  </div>
);

/** The closing beat of a run: a satisfying scorecard of what Aegis just did. */
export function MissionComplete({
  show,
  resolved,
  antibodies,
  coveragePct,
  reduced,
  onReplay,
}: MissionCompleteProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            pointerEvents: "none",
            background: "color-mix(in oklch, var(--color-abyss) 58%, transparent)",
            backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            className="hud"
            initial={reduced ? false : { opacity: 0, y: 22, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.5, ease: EASE }}
            style={{ width: 540, maxWidth: "92vw", padding: "26px 30px 24px", pointerEvents: "auto" }}
          >
            <span className="hud-tab">mission complete</span>
            <span className="b tl" />
            <span className="b tr" />
            <span className="b bl" />
            <span className="b br" />
            <div className="display" style={{ fontSize: 21, margin: "12px 0 2px" }}>
              Fleet stabilized — autonomously.
            </div>
            <div className="mono" style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 20 }}>
              Aegis resolved every incident, gated the irreversible one, and immunized the fleet.
            </div>
            <div className="flex items-center justify-between" style={{ gap: 12 }}>
              <Stat value={String(resolved)} label="auto-resolved" color="var(--color-healthy)" />
              <Stat value={String(antibodies)} label="antibodies" color="var(--color-evolve)" />
              <Stat value={`${coveragePct}%`} label="fleet immunity" color="var(--color-heal)" />
              <Stat value="0" label="unsafe actions" color="var(--color-ink)" />
            </div>
            <div className="hr" style={{ margin: "20px 0 16px" }} />
            <div className="flex items-center justify-between">
              <span className="mono" style={{ fontSize: 10.5, color: "var(--color-faint)" }}>
                autonomous where safe · human where it must be
              </span>
              <button className="btn-primary" onClick={onReplay} aria-label="Replay the demo">
                Replay
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

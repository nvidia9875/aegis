"use client";

import { motion } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

interface HudPanelProps {
  label: string;
  tone?: "heal" | "warn" | "danger";
  code?: string;
  delay?: number;
  reduced?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const EASE = [0.16, 1, 0.3, 1] as const;

/** Holographic command-center panel: clipped glass, corner brackets, tab + code,
 *  with a staggered entrance (skipped under reduced-motion). */
export function HudPanel({
  label,
  tone = "heal",
  code,
  delay = 0,
  reduced = false,
  className = "",
  style,
  children,
}: HudPanelProps) {
  const toneClass = tone === "danger" ? "is-danger" : tone === "warn" ? "is-warn" : "";
  return (
    <motion.div
      className={`hud ${toneClass} ${className}`}
      style={style}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      <span className="hud-tab">{label}</span>
      {code && <span className="hud-id">{code}</span>}
      <span className="b tl" />
      <span className="b tr" />
      <span className="b bl" />
      <span className="b br" />
      <div style={{ marginTop: 12 }}>{children}</div>
    </motion.div>
  );
}

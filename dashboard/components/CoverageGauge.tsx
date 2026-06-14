"use client";

import { motion } from "framer-motion";

export function CoverageGauge({ value }: { value: number }) {
  const R = 52;
  const C = 2 * Math.PI * R;
  const dash = C * value;
  return (
    <div className="relative" style={{ width: 132, height: 132 }}>
      <svg viewBox="0 0 132 132" className="w-full h-full" style={{ transform: "rotate(-90deg)" }}>
        <circle cx={66} cy={66} r={R} fill="none" stroke="var(--color-line)" strokeWidth={9} />
        <motion.circle
          cx={66}
          cy={66}
          r={R}
          fill="none"
          stroke="var(--color-heal)"
          strokeWidth={9}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={false}
          animate={{ strokeDashoffset: C - dash }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 8px var(--color-heal))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display" style={{ fontSize: 30, lineHeight: 1 }}>
          {Math.round(value * 100)}%
        </span>
        <span className="mono" style={{ fontSize: 9, color: "var(--color-faint)", letterSpacing: "0.14em", marginTop: 4 }}>
          IMMUNITY
        </span>
      </div>
    </div>
  );
}

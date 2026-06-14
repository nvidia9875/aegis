"use client";

import { motion } from "framer-motion";

export function MttrSpark({ points }: { points: number[] }) {
  if (!points.length) {
    return (
      <div className="mono" style={{ fontSize: 11, color: "var(--color-faint)", height: 46, display: "flex", alignItems: "center" }}>
        —
      </div>
    );
  }
  const max = Math.max(...points, 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 46 }}>
      {points.map((p, i) => {
        const h = Math.max(6, (p / max) * 46);
        const fast = p < 1;
        const col = fast ? "var(--color-healthy)" : "var(--color-heal)";
        return (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: h }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            title={`${p}s`}
            style={{ width: 14, borderRadius: 4, background: col, boxShadow: `0 0 6px ${col}` }}
          />
        );
      })}
    </div>
  );
}

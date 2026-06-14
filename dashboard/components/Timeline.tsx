"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { ACCENT_VAR } from "@/lib/colors";
import type { LogLine } from "@/lib/usePlayer";

export function Timeline({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  return (
    <div ref={ref} className="h-full overflow-y-auto pr-2">
      {lines.length === 0 && (
        <p className="mono" style={{ fontSize: 12, color: "var(--color-faint)" }}>
          awaiting incidents — press <span style={{ color: "var(--color-heal)" }}>RUN</span> to start the demo…
        </p>
      )}
      <AnimatePresence initial={false}>
        {lines.map((l) => (
          <motion.div
            key={l.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex gap-3 items-baseline"
            style={{ padding: "5px 0" }}
          >
            <span className="mono" style={{ fontSize: 10, color: "var(--color-faint)" }}>
              {String(l.beat + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 99,
                flexShrink: 0,
                alignSelf: "center",
                background: ACCENT_VAR[l.accent],
                boxShadow: `0 0 8px ${ACCENT_VAR[l.accent]}`,
              }}
            />
            <span className="mono" style={{ fontSize: 12.5, color: "var(--color-ink)", lineHeight: 1.45 }}>
              {l.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

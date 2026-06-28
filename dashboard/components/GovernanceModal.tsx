"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Beat } from "@/lib/types";

export function GovernanceModal({
  beat,
  onApprove,
  onDeny,
}: {
  beat: Beat | null;
  onApprove: () => void;
  onDeny: () => void;
}) {
  return (
    <AnimatePresence>
      {beat && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            background: "color-mix(in oklch, var(--color-abyss) 84%, transparent)",
            backdropFilter: "blur(7px)",
          }}
        >
          <motion.div
            className="glass"
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            style={{
              maxWidth: 540,
              width: "100%",
              padding: "28px 30px",
              borderColor: "color-mix(in oklch, var(--color-danger) 45%, transparent)",
              boxShadow: "0 0 60px color-mix(in oklch, var(--color-danger) 28%, transparent)",
            }}
          >
            <div className="panel-title" style={{ color: "var(--color-danger)" }}>
              ⚠ Governance gate · L2 approval required
            </div>
            <h3 className="display mono" style={{ fontSize: 26, margin: "12px 0 2px", color: "var(--color-ink)" }}>
              {beat.action}
            </h3>
            <p style={{ color: "var(--color-muted)", margin: "0 0 18px", fontSize: 14 }}>
              {beat.serviceName} · {beat.incidentClass}
            </p>
            <div className="hr" style={{ margin: "0 0 16px" }} />

            <div className="mono" style={{ fontSize: 11, color: "var(--color-warn)", letterSpacing: "0.18em", marginBottom: 8 }}>
              BLAST RADIUS
            </div>
            <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--color-ink)" }}>{beat.blastRadius}</p>

            <div className="mono" style={{ fontSize: 11, color: "var(--color-faint)", letterSpacing: "0.18em", marginBottom: 8 }}>
              EVIDENCE
            </div>
            <ul style={{ margin: "0 0 24px", paddingLeft: 18, color: "var(--color-muted)", fontSize: 12.5, lineHeight: 1.8 }}>
              {beat.evidence?.map((e, i) => (
                <li key={i} className="mono">
                  {e}
                </li>
              ))}
            </ul>

            <div className="flex gap-3 justify-end">
              <button onClick={onDeny} className="btn-ghost">
                Deny
              </button>
              <button onClick={onApprove} className="btn-primary">
                Approve &amp; heal
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

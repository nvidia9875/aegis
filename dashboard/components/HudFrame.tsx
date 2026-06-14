"use client";

import type { CSSProperties, ReactNode } from "react";

export function HudFrame({
  label,
  accent = "heal",
  children,
  className = "",
  style,
}: {
  label?: string;
  accent?: "heal" | "warn" | "danger";
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const accentClass = accent === "warn" ? "is-warn" : accent === "danger" ? "is-danger" : "";
  return (
    <section className={`hud ${accentClass} ${className}`} style={style}>
      <span className="b tl" />
      <span className="b tr" />
      <span className="b bl" />
      <span className="b br" />
      {label && <span className="hud-tab">{label}</span>}
      <div style={{ marginTop: label ? 12 : 0, height: label ? "calc(100% - 12px)" : "100%" }}>
        {children}
      </div>
    </section>
  );
}

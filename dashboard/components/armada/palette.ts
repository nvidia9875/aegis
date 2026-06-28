import type { Accent } from "@/lib/types";

// Obsidian-armada palette (hex mirrors of the oklch design tokens, for three.js).
export const C = {
  abyss: "#06070d",
  void: "#0a0c14",
  ink: "#eef2f8",
  faint: "#717c92",
  heal: "#2fe0d6", // cyan — remediation / healthy energy
  evolve: "#9a6cff", // violet — reasoning / immunize
  warn: "#f5b13c", // amber — acting
  danger: "#ff4d5e", // red — critical / irreversible
  healthy: "#37e39a", // green — recovered / immunized
} as const;

export const accentHex = (a: Accent): string =>
  a === "danger"
    ? C.danger
    : a === "warn"
      ? C.warn
      : a === "healthy"
        ? C.healthy
        : a === "evolve"
          ? C.evolve
          : C.heal;

"use client";

// Deterministic pseudo-hex (no Math.random → no hydration mismatch).
const hex = (n: number) => ((n * 2654435761) % 0x10000).toString(16).padStart(4, "0").toUpperCase();
const TAGS = ["sysCk", "evalQ", "traceR", "ruleZ", "kbHit", "canary", "guard", "sprt", "cusum", "router"];

const LINES = Array.from({ length: 22 }, (_, i) => {
  const a = hex(i + 7);
  const b = hex(i * 3 + 11);
  const tag = TAGS[i % TAGS.length];
  const ok = i % 7 !== 0;
  return `${String(i).padStart(2, "0")}> ${tag} ::0x${a}:${b}  ${ok ? "ok" : "warn"}`;
});

export function HexReadout({ height = 120 }: { height?: number }) {
  return (
    <div style={{ height, overflow: "hidden", position: "relative" }} aria-hidden>
      <div className="scroll-col">
        {[...LINES, ...LINES].map((l, i) => (
          <div
            key={i}
            className="mono"
            style={{
              fontSize: 10,
              lineHeight: 1.7,
              color: l.endsWith("warn") ? "var(--color-orbit)" : "var(--color-faint)",
            }}
          >
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

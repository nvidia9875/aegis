"use client";

export function Waveform({ bars = 40, color = "var(--color-heal)" }: { bars?: number; color?: string }) {
  return (
    <div className="flex items-end" style={{ gap: 3, height: 56 }} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            flex: 1,
            height: "100%",
            borderRadius: 2,
            background: `linear-gradient(180deg, ${color}, color-mix(in oklch, ${color} 18%, transparent))`,
            boxShadow: `0 0 6px ${color}`,
            opacity: 0.85,
            animationDelay: `${((i % 13) * 0.08).toFixed(2)}s`,
            animationDuration: `${(1 + (i % 5) * 0.12).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}

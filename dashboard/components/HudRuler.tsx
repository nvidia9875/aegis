"use client";

const LABELS = [
  "04:00", "01:00", "22:00", "04:00", "15:00", "01:00", "11:00", "22:00",
  "04:00", "15:00", "11:00", "22:00", "04:00", "15:00", "01:00", "11:00",
  "22:00", "04:00", "15:00", "11:00",
];

export function HudRuler() {
  return (
    <div className="ruler" aria-hidden>
      {LABELS.map((l, i) => (
        <span key={i} className={`t ${i % 3 === 0 ? "major" : ""}`}>
          {l}
        </span>
      ))}
    </div>
  );
}

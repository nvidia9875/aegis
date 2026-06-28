"use client";

import { useEffect, useState } from "react";

/** Live UTC mission clock — isolated so its per-second tick never re-renders the scene. */
export function MissionClock() {
  const [now, setNow] = useState("--:--:--");
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="cmd-clock">T {now}Z</span>;
}

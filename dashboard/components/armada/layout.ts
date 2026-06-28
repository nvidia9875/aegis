// Fleet formation — hero ships (the named services) plus a deterministic ambient
// armada arranged in tilted orbital rings around the Aegis flagship at the origin.

export type Vec3 = [number, number, number];

export const HERO_POS: Record<string, Vec3> = {
  "support-rag": [-3.4, 0.5, 1.6],
  "argus-review": [3.8, -0.4, -1.3],
};

export interface AmbientShip {
  pos: Vec3;
  scale: number;
  spin: number;
}

/** Deterministic pseudo-random fleet so the formation is identical every run. */
export function buildAmbientFleet(count = 54): AmbientShip[] {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const ships: AmbientShip[] = [];
  for (let i = 0; i < count; i++) {
    const ring = 1 + Math.floor(rnd() * 4);
    const r = 4.2 + ring * 1.7 + rnd() * 1.1;
    const a = rnd() * Math.PI * 2;
    const y = (rnd() - 0.5) * 3.6;
    ships.push({
      pos: [Math.cos(a) * r, y, Math.sin(a) * r],
      scale: 0.24 + rnd() * 0.34,
      spin: 0.2 + rnd() * 0.6,
    });
  }
  return ships;
}

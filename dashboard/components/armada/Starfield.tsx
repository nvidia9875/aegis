"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/** A slowly-drifting starfield shell to give the armada deep-space parallax. */
export function Starfield({ count = 1400 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    let seed = 99;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < count; i++) {
      const r = 42 + rnd() * 78;
      const t = rnd() * Math.PI * 2;
      const p = Math.acos(2 * rnd() - 1);
      positions[i * 3] = r * Math.sin(p) * Math.cos(t);
      positions[i * 3 + 1] = r * Math.cos(p);
      positions[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.004;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.14} color="#7f8aa6" sizeAttenuation transparent opacity={0.65} />
    </points>
  );
}

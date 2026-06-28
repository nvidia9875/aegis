"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Accent } from "@/lib/types";
import { accentHex, C } from "./palette";

/** Aegis — the flagship command core at the heart of the armada. */
export function Flagship({ accent, coverage }: { accent: Accent; coverage: number }) {
  const core = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const col = useMemo(() => new THREE.Color(accentHex(accent)), [accent]);
  const green = useMemo(() => new THREE.Color(C.healthy), []);

  useFrame((s, dt) => {
    const t = s.clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y += dt * 0.28;
      core.current.rotation.x += dt * 0.11;
      core.current.scale.setScalar(1 + Math.sin(t * 2) * 0.04);
    }
    if (halo.current) halo.current.rotation.y -= dt * 0.18;
    if (ring.current) ring.current.rotation.z += dt * 0.45;
  });

  return (
    <group>
      <mesh ref={core}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={1.5}
          metalness={0.65}
          roughness={0.18}
          flatShading
        />
      </mesh>
      <mesh ref={halo} scale={1.12}>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshBasicMaterial color={col} wireframe transparent opacity={0.32} />
      </mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.1 + coverage * 0.7, 0.018, 12, 96]} />
        <meshBasicMaterial color={green} transparent opacity={0.35 + coverage * 0.45} />
      </mesh>
      <pointLight color={col} intensity={7} distance={22} decay={1.6} />
    </group>
  );
}

"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Health } from "@/lib/usePlayer";
import type { Vec3 } from "./layout";
import { C } from "./palette";

const HEALTH_HEX: Record<Health, string> = {
  healthy: C.heal,
  incident: C.danger,
  healing: C.warn,
};

interface ShipProps {
  position: Vec3;
  health: Health;
  immunized: boolean;
  focused: boolean;
  reduced: boolean;
}

/** A hero ship = one named AI service Aegis is guarding. */
export function Ship({ position, health, immunized, focused, reduced }: ShipProps) {
  const group = useRef<THREE.Group>(null);
  const hex = immunized && health === "healthy" ? C.healthy : HEALTH_HEX[health];
  const col = useMemo(() => new THREE.Color(hex), [hex]);

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += dt * 0.5;
    const t = s.clock.elapsedTime;
    g.position.y = position[1] + (reduced ? 0 : Math.sin(t + position[0]) * 0.12);
    g.position.x =
      health === "incident" && !reduced ? position[0] + Math.sin(t * 42) * 0.05 : position[0];
    const target = focused ? 1.55 : 1;
    g.scale.lerp(new THREE.Vector3(target, target, target), 1 - Math.pow(0.0015, dt));
  });

  return (
    <group ref={group} position={position}>
      <mesh>
        <octahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={health === "incident" ? 2.3 : 1.1}
          metalness={0.55}
          roughness={0.22}
          flatShading
        />
      </mesh>
      <mesh scale={1.28}>
        <octahedronGeometry args={[0.52, 0]} />
        <meshBasicMaterial color={col} wireframe transparent opacity={0.28} />
      </mesh>
      <pointLight color={col} intensity={health === "incident" ? 3.5 : 1.1} distance={7} decay={1.8} />
    </group>
  );
}

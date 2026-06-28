"use client";

import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
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
  name: string;
  health: Health;
  immunized: boolean;
  focused: boolean;
  reduced: boolean;
}

/** A hero ship = one named AI service Aegis is guarding. */
export function Ship({ position, name, health, immunized, focused, reduced }: ShipProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const warn = useRef<THREE.Mesh>(null);
  const warnMat = useRef<THREE.MeshBasicMaterial>(null);

  const hex = immunized && health === "healthy" ? C.healthy : HEALTH_HEX[health];
  const col = useMemo(() => new THREE.Color(hex), [hex]);

  useFrame((s, dt) => {
    const g = group.current;
    if (!g) return;
    const t = s.clock.elapsedTime;
    g.rotation.y += dt * 0.5;
    g.position.y = position[1] + (reduced ? 0 : Math.sin(t + position[0]) * 0.12);
    g.position.x =
      health === "incident" && !reduced ? position[0] + Math.sin(t * 42) * 0.05 : position[0];
    const target = focused ? 1.5 : 1;
    g.scale.lerp(new THREE.Vector3(target, target, target), 1 - Math.pow(0.0015, dt));

    if (ring.current) ring.current.rotation.z += dt * 0.8;
    if (ringMat.current) ringMat.current.opacity = 0.4 + Math.sin(t * 3) * 0.2;

    // expanding warning pulse while the ship is in incident
    const w = warn.current;
    const wm = warnMat.current;
    if (w && wm) {
      if (health === "incident") {
        const phase = (t * 1.3) % 1;
        w.visible = true;
        w.scale.setScalar(0.8 + phase * 2.2);
        wm.opacity = 0.5 * (1 - phase);
      } else {
        w.visible = false;
      }
    }
  });

  return (
    <group ref={group} position={position}>
      <mesh>
        <octahedronGeometry args={[0.52, 0]} />
        <meshStandardMaterial
          color={col}
          emissive={col}
          emissiveIntensity={health === "incident" ? 2.3 : 1.15}
          metalness={0.55}
          roughness={0.22}
          flatShading
        />
      </mesh>
      <mesh scale={1.3}>
        <octahedronGeometry args={[0.52, 0]} />
        <meshBasicMaterial color={col} wireframe transparent opacity={0.26} />
      </mesh>
      {/* shield ring */}
      <mesh ref={ring} rotation={[Math.PI / 2.2, 0, 0]}>
        <torusGeometry args={[0.95, 0.012, 8, 64]} />
        <meshBasicMaterial ref={ringMat} color={col} transparent opacity={0.4} />
      </mesh>
      {/* incident warning pulse */}
      <mesh ref={warn} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.96, 1.02, 48]} />
        <meshBasicMaterial ref={warnMat} color={C.danger} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <pointLight color={col} intensity={health === "incident" ? 3.5 : 1.1} distance={7} decay={1.8} />
      <Html position={[0, -1.3, 0]} center style={{ pointerEvents: "none", userSelect: "none" }} zIndexRange={[10, 0]}>
        <span
          className="mono"
          style={{
            color: hex,
            fontSize: 11,
            letterSpacing: "0.14em",
            whiteSpace: "nowrap",
            textShadow: "0 0 8px #06070d, 0 0 8px #06070d",
          }}
        >
          {name}
        </span>
      </Html>
    </group>
  );
}

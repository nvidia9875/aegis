"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./layout";
import { C } from "./palette";

const DURATION = 1.7;

/**
 * Fleet Immunity made visible: when an antibody is learned or recalled, a shield
 * shockwave expands from the source ship across the whole armada.
 */
export function ImmunityWave({ trigger, origin }: { trigger: number | null; origin: Vec3 }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const startedAt = useRef<number | null>(null);
  const seen = useRef<number | null>(null);

  useFrame((s) => {
    if (trigger !== null && trigger !== seen.current) {
      seen.current = trigger;
      startedAt.current = s.clock.elapsedTime;
    }
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    if (startedAt.current === null) {
      m.visible = false;
      return;
    }
    const t = s.clock.elapsedTime - startedAt.current;
    if (t > DURATION) {
      m.visible = false;
      return;
    }
    m.visible = true;
    m.scale.setScalar(0.6 + t * 15);
    material.opacity = Math.max(0, 0.6 * (1 - t / DURATION));
  });

  return (
    <mesh ref={mesh} position={origin} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.92, 1.0, 80]} />
      <meshBasicMaterial
        ref={mat}
        color={C.healthy}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

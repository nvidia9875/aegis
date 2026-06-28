"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./layout";
import { C } from "./palette";

const DURATION = 1.9;

/** One expanding shield ring of the immunity shockwave. */
function WaveRing({
  trigger,
  origin,
  delay,
  reach,
}: {
  trigger: number | null;
  origin: Vec3;
  delay: number;
  reach: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const startedAt = useRef<number | null>(null);
  const seen = useRef<number | null>(null);

  useFrame((s) => {
    if (trigger !== null && trigger !== seen.current) {
      seen.current = trigger;
      startedAt.current = s.clock.elapsedTime + delay;
    }
    const m = mesh.current;
    const material = mat.current;
    if (!m || !material) return;
    if (startedAt.current === null) {
      m.visible = false;
      return;
    }
    const t = s.clock.elapsedTime - startedAt.current;
    if (t < 0 || t > DURATION) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const p = t / DURATION;
    m.scale.setScalar(0.6 + p * reach);
    material.opacity = Math.max(0, 0.55 * (1 - p));
  });

  return (
    <mesh ref={mesh} position={origin} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.92, 1.0, 96]} />
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

/**
 * Fleet Immunity made visible: when an antibody is learned or recalled, a stacked
 * shield shockwave expands from the source ship across the whole armada.
 */
export function ImmunityWave({ trigger, origin }: { trigger: number | null; origin: Vec3 }) {
  return (
    <group>
      <WaveRing trigger={trigger} origin={origin} delay={0} reach={19} />
      <WaveRing trigger={trigger} origin={origin} delay={0.22} reach={15} />
      <WaveRing trigger={trigger} origin={origin} delay={0.44} reach={11} />
    </group>
  );
}

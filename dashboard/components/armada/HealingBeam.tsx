"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./layout";
import { C } from "./palette";

/** A remediation beam fired from the flagship to the ship being healed. */
export function HealingBeam({ target, active }: { target: Vec3 | null; active: boolean }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null);

  const { length, mid, quaternion } = useMemo(() => {
    if (!target) {
      return { length: 0, mid: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
    }
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(target[0], target[1], target[2]);
    const dir = new THREE.Vector3().subVectors(b, a);
    const length = dir.length();
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { length, mid, quaternion };
  }, [target]);

  useFrame((s) => {
    if (mat.current) {
      mat.current.opacity = active ? 0.35 + Math.sin(s.clock.elapsedTime * 9) * 0.28 : 0;
    }
  });

  if (!target) return null;

  return (
    <group position={mid} quaternion={quaternion} visible={active}>
      <mesh>
        <cylinderGeometry args={[0.06, 0.06, length, 10, 1, true]} />
        <meshBasicMaterial
          ref={mat}
          color={C.heal}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

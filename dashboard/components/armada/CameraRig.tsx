"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./layout";

interface CameraRigProps {
  focus: Vec3;
  distance: number;
  tension: boolean;
  reduced: boolean;
}

/**
 * Cinematic camera: orbits the armada, dives toward the active incident, and pulls
 * wide for the immunity wave. Frame-rate-independent smoothing keeps it fluid, with
 * a subtle hand-held tremor while an incident is live.
 */
export function CameraRig({ focus, distance, tension, reduced }: CameraRigProps) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0.5, 0));
  const pos = useRef(new THREE.Vector3(0, 8, 18));
  const shake = useMemo(() => new THREE.Vector3(), []);

  useFrame((s, dt) => {
    const f = new THREE.Vector3(focus[0], focus[1] + 0.4, focus[2]);
    const lookSmooth = reduced ? 1 : 1 - Math.pow(0.0009, dt);
    const posSmooth = reduced ? 1 : 1 - Math.pow(0.0016, dt);
    look.current.lerp(f, lookSmooth);

    const angle = reduced ? 0.7 : s.clock.elapsedTime * 0.055;
    const desired = new THREE.Vector3(
      f.x + Math.cos(angle) * distance,
      f.y + distance * 0.5,
      f.z + Math.sin(angle) * distance,
    );
    pos.current.lerp(desired, posSmooth);

    if (tension && !reduced) {
      const t = s.clock.elapsedTime;
      shake.set(Math.sin(t * 22) * 0.05, Math.cos(t * 18) * 0.04, Math.sin(t * 26) * 0.05);
    } else {
      shake.multiplyScalar(0.9);
    }

    camera.position.copy(pos.current).add(shake);
    camera.lookAt(look.current);
  });

  return null;
}

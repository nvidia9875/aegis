"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "./layout";

interface CameraRigProps {
  focus: Vec3;
  distance: number;
  reduced: boolean;
}

/**
 * Cinematic camera: orbits the armada and dives toward the active incident, pulling
 * back wide for the immunity wave. Frame-rate-independent smoothing keeps it fluid.
 */
export function CameraRig({ focus, distance, reduced }: CameraRigProps) {
  const { camera } = useThree();
  const look = useRef(new THREE.Vector3(0, 0, 0));
  const pos = useRef(new THREE.Vector3(0, 7, 16));

  useFrame((s, dt) => {
    const f = new THREE.Vector3(focus[0], focus[1], focus[2]);
    const lookSmooth = reduced ? 1 : 1 - Math.pow(0.0009, dt);
    const posSmooth = reduced ? 1 : 1 - Math.pow(0.0014, dt);

    look.current.lerp(f, lookSmooth);

    const angle = reduced ? 0.7 : s.clock.elapsedTime * 0.075;
    const desired = new THREE.Vector3(
      f.x + Math.cos(angle) * distance,
      f.y + distance * 0.42,
      f.z + Math.sin(angle) * distance,
    );
    pos.current.lerp(desired, posSmooth);

    camera.position.copy(pos.current);
    camera.lookAt(look.current);
  });

  return null;
}

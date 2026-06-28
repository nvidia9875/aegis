"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { buildAmbientFleet } from "./layout";
import { C } from "./palette";

/**
 * The ambient armada — the rest of the fleet. Members light up green in formation
 * order as Fleet Immunity coverage rises, so the whole armada visibly "immunizes".
 */
export function AmbientFleet({ coverage, reduced }: { coverage: number; reduced: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const ships = useMemo(() => buildAmbientFleet(54), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // Dim cyan-steel = "online, not yet immunized"; bright green = immunized.
  const dormant = useMemo(() => new THREE.Color("#58a6b4"), []);
  const immune = useMemo(() => new THREE.Color(C.healthy), []);

  const geometry = useMemo(() => new THREE.TetrahedronGeometry(0.5, 0), []);
  // No vertexColors — three tints instances via the instanceColor attribute (setColorAt).
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);
  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    ships.forEach((sh, i) => {
      dummy.position.set(sh.pos[0], sh.pos[1], sh.pos[2]);
      dummy.scale.setScalar(sh.scale);
      dummy.rotation.set(sh.spin, sh.spin * 2, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, dormant);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [ships, dummy, dormant]);

  const immunizedCount = useRef(-1);

  useFrame((_, dt) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (!reduced) mesh.rotation.y += dt * 0.02;
    const n = Math.round(coverage * ships.length);
    if (n !== immunizedCount.current) {
      immunizedCount.current = n;
      for (let i = 0; i < ships.length; i++) {
        mesh.setColorAt(i, i < n ? immune : dormant);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, ships.length]}
      frustumCulled={false}
    />
  );
}

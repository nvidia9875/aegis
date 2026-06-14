"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

export interface ReactorProps {
  activeIndex: number; // -1 if idle
  litCount: number;
  coverage: number; // 0..1
  antibodies: number;
  accent: "heal" | "danger" | "healthy";
}

const HEX = {
  heal: "#46e0d0",
  danger: "#ff5566",
  healthy: "#5cf0a8",
  orbit: "#ff9a3c",
  evolve: "#b08cff",
  dim: "#1b2b3a",
} as const;

const STAGE_COUNT = 8;
const TILT = -1.04;

function Core({ color }: { color: string }) {
  const inner = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const wire2 = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    const k = 1 + Math.sin(t * 2.2) * 0.06;
    if (inner.current) inner.current.scale.setScalar(k);
    if (wire.current) wire.current.rotation.set(t * 0.25, t * 0.32, 0);
    if (wire2.current) wire2.current.rotation.set(-t * 0.18, t * 0.15, t * 0.1);
  });
  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.62, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={wire}>
        <icosahedronGeometry args={[1.0, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.55} toneMapped={false} />
      </mesh>
      <mesh ref={wire2}>
        <icosahedronGeometry args={[1.22, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.18} toneMapped={false} />
      </mesh>
      <pointLight color={color} intensity={8} distance={9} />
    </group>
  );
}

function Ring({ radius, tube, color, speed, opacity = 1 }: { radius: number; tube: number; color: string; speed: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * speed;
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, tube, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
}

function StageNodes({ activeIndex, accent }: { activeIndex: number; accent: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (group.current) group.current.rotation.z = s.clock.elapsedTime * 0.12;
  });
  const positions = useMemo(
    () =>
      Array.from({ length: STAGE_COUNT }, (_, i) => {
        const a = (i / STAGE_COUNT) * Math.PI * 2;
        return [Math.cos(a) * 2.45, Math.sin(a) * 2.45, 0] as const;
      }),
    [],
  );
  return (
    <group ref={group}>
      {positions.map((p, i) => {
        const active = i === activeIndex;
        return (
          <mesh key={i} position={[p[0], p[1], p[2]]} scale={active ? 1.9 : 1}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color={active ? "#eafcff" : accent} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

function Orbit({ radius, count, color, speed, y = 0 }: { radius: number; count: number; color: string; speed: number; y?: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (group.current) group.current.rotation.z = s.clock.elapsedTime * speed;
  });
  const pts = useMemo(
    () => Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2;
      return [Math.cos(a) * radius, Math.sin(a) * radius, 0] as const;
    }),
    [radius, count],
  );
  return (
    <group ref={group} position={[0, 0, y]}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0]}>
          <sphereGeometry args={[i % 5 === 0 ? 0.05 : 0.03, 8, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35 + 0.65 * ((i % 5) / 4)} />
        </mesh>
      ))}
    </group>
  );
}

function CoverageArc({ coverage }: { coverage: number }) {
  const ref = useRef<THREE.Mesh>(null);
  return (
    <mesh ref={ref} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[1.75, 0.03, 12, 100, Math.PI * 2 * Math.max(0.001, coverage)]} />
      <meshBasicMaterial color={HEX.heal} toneMapped={false} />
    </mesh>
  );
}

function Reactor({ activeIndex, coverage, antibodies, accent }: ReactorProps) {
  const root = useRef<THREE.Group>(null);
  const color = HEX[accent];
  useFrame((s) => {
    if (root.current) root.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.12) * 0.12;
  });
  const orbitCount = Math.min(48, 20 + antibodies * 6);
  return (
    <group ref={root} rotation={[TILT, 0, 0]}>
      <Core color={color} />
      <Ring radius={1.9} tube={0.012} color={color} speed={0.3} opacity={0.7} />
      <Ring radius={2.45} tube={0.02} color={color} speed={-0.18} opacity={0.85} />
      <Ring radius={2.95} tube={0.01} color={HEX.evolve} speed={0.12} opacity={0.5} />
      <CoverageArc coverage={coverage} />
      <StageNodes activeIndex={activeIndex} accent={color} />
      <Orbit radius={2.15} count={orbitCount} color={HEX.orbit} speed={0.5} />
      <Orbit radius={1.6} count={18} color={HEX.evolve} speed={-0.4} />
      <Sparkles count={70} scale={6} size={3} speed={0.3} color={color} opacity={0.6} />

      {/* stacked ghost disk */}
      <group position={[0, 0, -2.6]} scale={0.62}>
        <Core color={HEX.evolve} />
        <Ring radius={2.2} tube={0.016} color={HEX.evolve} speed={0.22} opacity={0.5} />
        <Orbit radius={1.9} count={20} color={HEX.orbit} speed={0.4} />
      </group>
    </group>
  );
}

function CameraRig() {
  useFrame((s) => {
    const px = s.pointer.x * 0.6;
    const py = s.pointer.y * 0.4;
    s.camera.position.x += (px - s.camera.position.x) * 0.05;
    s.camera.position.y += (1.1 + py - s.camera.position.y) * 0.05;
    s.camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function ReactorCanvas(props: ReactorProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.1, 6.4], fov: 42 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.25} />
      <CameraRig />
      <Reactor {...props} />
      <EffectComposer>
        <Bloom intensity={1.6} luminanceThreshold={0.15} luminanceSmoothing={0.32} mipmapBlur radius={0.8} />
        <Vignette eskil={false} offset={0.22} darkness={0.96} />
      </EffectComposer>
    </Canvas>
  );
}

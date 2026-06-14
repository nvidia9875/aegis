"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Sparkles } from "@react-three/drei";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// ── real-data contract (everything shown is live CI/loop state) ──────────────
export interface ReactorStage {
  label: string;
  lit: boolean;
  active: boolean;
}
export interface ReactorService {
  id: string;
  name: string;
  health: "healthy" | "healing" | "incident";
}
export interface ReactorLog {
  id: number;
  text: string;
  accent: string;
}
export interface ReactorProps {
  activeIndex: number;
  coverage: number;
  antibodies: number;
  accent: "heal" | "danger" | "healthy";
  stages: ReactorStage[];
  log: ReactorLog[];
  services: ReactorService[];
  mttr: number | null;
  resolved: number;
  routerSavings: string;
  incident: { service: string; klass: string; severity: string } | null;
}

const HEX = {
  heal: "#46e0d0",
  danger: "#ff5566",
  healthy: "#5cf0a8",
  orbit: "#ff9a3c",
  evolve: "#b08cff",
} as const;

const ACCENT_CSS: Record<string, string> = {
  heal: "var(--color-heal)",
  evolve: "var(--color-evolve)",
  warn: "var(--color-orbit)",
  danger: "var(--color-danger)",
  healthy: "var(--color-healthy)",
};
const HEALTH_CSS: Record<string, string> = {
  healthy: "var(--color-healthy)",
  healing: "var(--color-heal)",
  incident: "var(--color-danger)",
};

const STAGE_COUNT = 8;
const TILT = -1.02;
const RING_NODE = 2.45;
const RING_LABEL = 3.0;

const ring = (r: number, i: number, n = STAGE_COUNT) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r, 0] as const;
};

// ── 3D structure ─────────────────────────────────────────────────────────────

function Core({ color }: { color: string }) {
  const inner = useRef<THREE.Mesh>(null);
  const wire = useRef<THREE.Mesh>(null);
  const wire2 = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (inner.current) inner.current.scale.setScalar(1 + Math.sin(t * 2.2) * 0.06);
    if (wire.current) wire.current.rotation.set(t * 0.25, t * 0.32, 0);
    if (wire2.current) wire2.current.rotation.set(-t * 0.18, t * 0.15, t * 0.1);
  });
  return (
    <group>
      <mesh ref={inner}>
        <icosahedronGeometry args={[0.6, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={wire}>
        <icosahedronGeometry args={[0.98, 1]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.5} toneMapped={false} />
      </mesh>
      <mesh ref={wire2}>
        <icosahedronGeometry args={[1.2, 2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.16} toneMapped={false} />
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

function Orbit({ radius, count, color, speed }: { radius: number; count: number; color: string; speed: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (g.current) g.current.rotation.z = s.clock.elapsedTime * speed;
  });
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => ring(radius, i, count)), [radius, count]);
  return (
    <group ref={g}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0]}>
          <sphereGeometry args={[i % 5 === 0 ? 0.05 : 0.03, 8, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35 + 0.65 * ((i % 5) / 4)} />
        </mesh>
      ))}
    </group>
  );
}

function StageNodes({ stages, accent }: { stages: ReactorStage[]; accent: string }) {
  return (
    <group rotation={[TILT, 0, 0]}>
      {stages.map((st, i) => {
        const p = ring(RING_NODE, i);
        const lp = ring(RING_LABEL, i);
        const col = st.active ? "#eafcff" : st.lit ? accent : "#2b3b4a";
        return (
          <group key={i}>
            <mesh position={[p[0], p[1], 0]} scale={st.active ? 1.9 : st.lit ? 1.2 : 0.9}>
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshBasicMaterial color={col} toneMapped={false} />
            </mesh>
            <Html position={[lp[0], lp[1], 0]} center distanceFactor={6} pointerEvents="none">
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  whiteSpace: "nowrap",
                  color: st.active ? "var(--color-heal)" : st.lit ? "var(--color-muted)" : "var(--color-faint)",
                  textShadow: st.active ? "0 0 8px var(--color-heal)" : "none",
                }}
              >
                {String(i + 1).padStart(2, "0")} {st.label.toUpperCase()}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function CoverageArc({ coverage }: { coverage: number }) {
  return (
    <mesh rotation={[TILT, 0, Math.PI / 2]}>
      <torusGeometry args={[1.75, 0.03, 12, 100, Math.PI * 2 * Math.max(0.001, coverage)]} />
      <meshBasicMaterial color={HEX.heal} toneMapped={false} />
    </mesh>
  );
}

function Reactor({ activeIndex, coverage, antibodies, accent, stages }: ReactorProps) {
  const color = HEX[accent];
  const tilted = useRef<THREE.Group>(null);
  const orbitCount = Math.min(48, 20 + antibodies * 6);
  return (
    <group>
      <group ref={tilted} rotation={[TILT, 0, 0]}>
        <Core color={color} />
        <Ring radius={1.9} tube={0.012} color={color} speed={0.3} opacity={0.7} />
        <Ring radius={RING_NODE} tube={0.02} color={color} speed={-0.18} opacity={0.85} />
        <Ring radius={2.95} tube={0.01} color={HEX.evolve} speed={0.12} opacity={0.5} />
        <Orbit radius={2.15} count={orbitCount} color={HEX.orbit} speed={0.5} />
        <Orbit radius={1.6} count={18} color={HEX.evolve} speed={-0.4} />
        <Sparkles count={70} scale={6} size={3} speed={0.3} color={color} opacity={0.6} />
        {/* stacked ghost disk */}
        <group position={[0, 0, -2.6]} scale={0.6}>
          <Core color={HEX.evolve} />
          <Ring radius={2.2} tube={0.016} color={HEX.evolve} speed={0.22} opacity={0.5} />
          <Orbit radius={1.9} count={20} color={HEX.orbit} speed={0.4} />
        </group>
      </group>
      <CoverageArc coverage={coverage} />
      <StageNodes stages={stages} accent={color} />
    </group>
  );
}

function CameraRig() {
  useFrame((s) => {
    const px = s.pointer.x * 0.7;
    const py = s.pointer.y * 0.4;
    s.camera.position.x += (px - s.camera.position.x) * 0.05;
    s.camera.position.y += (1.0 + py - s.camera.position.y) * 0.05;
    s.camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── holographic data panels (real CI data only) ──────────────────────────────

function Panel({ title, children, position, rotY, accent = "heal", width = 280 }: { title: string; children: React.ReactNode; position: [number, number, number]; rotY: number; accent?: "heal" | "danger" | "healthy"; width?: number }) {
  return (
    <Html transform position={position} rotation={[0, rotY, 0]} distanceFactor={3.6} pointerEvents="none">
      <div className={`hud ${accent === "danger" ? "is-danger" : ""}`} style={{ width, padding: "14px 16px" }}>
        <span className="b tl" /><span className="b tr" /><span className="b bl" /><span className="b br" />
        <span className="hud-tab">{title}</span>
        <div style={{ marginTop: 12 }}>{children}</div>
      </div>
    </Html>
  );
}

function LoopLog({ log }: { log: ReactorLog[] }) {
  const lines = log.slice(-11);
  return (
    <div style={{ display: "grid", gap: 5, minHeight: 230 }}>
      {lines.length === 0 && (
        <span className="mono" style={{ fontSize: 12, color: "var(--color-faint)" }}>press RUN — autonomous loop will stream here…</span>
      )}
      {lines.map((l) => (
        <div key={l.id} className="mono" style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 12 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, flexShrink: 0, alignSelf: "center", background: ACCENT_CSS[l.accent] ?? "var(--color-heal)", boxShadow: `0 0 8px ${ACCENT_CSS[l.accent] ?? "var(--color-heal)"}` }} />
          <span style={{ color: "var(--color-ink)", lineHeight: 1.4 }}>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

function FleetPanel({ services, antibodies, coverage }: { services: ReactorService[]; antibodies: number; coverage: number }) {
  return (
    <div className="mono" style={{ fontSize: 12 }}>
      {services.map((s) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0" }}>
          <span style={{ width: 9, height: 9, borderRadius: 99, background: HEALTH_CSS[s.health], boxShadow: `0 0 8px ${HEALTH_CSS[s.health]}` }} />
          <span style={{ color: "var(--color-ink)" }}>{s.name}</span>
          <span style={{ marginLeft: "auto", color: "var(--color-faint)" }}>{s.health}</span>
        </div>
      ))}
      <div className="hr" style={{ margin: "10px 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "var(--color-faint)" }}>antibodies</span>
        <span style={{ color: "var(--color-evolve)" }}>{antibodies} ✺</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color: "var(--color-faint)" }}>immunity</span>
        <span style={{ color: "var(--color-heal)" }}>{Math.round(coverage * 100)}% · {Math.round(coverage * 5)}/5</span>
      </div>
    </div>
  );
}

function MetricsPanel({ mttr, resolved, antibodies, routerSavings }: { mttr: number | null; resolved: number; antibodies: number; routerSavings: string }) {
  const items: [string, string, string][] = [
    ["last MTTR", mttr != null ? `${mttr}s` : "—", "var(--color-heal)"],
    ["auto-resolved", String(resolved), "var(--color-healthy)"],
    ["antibodies", String(antibodies), "var(--color-evolve)"],
    ["router savings", routerSavings, "var(--color-orbit)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
      {items.map(([label, value, col]) => (
        <div key={label}>
          <div className="display" style={{ fontSize: 26, color: col, lineHeight: 1 }}>{value}</div>
          <div className="stat-label" style={{ marginTop: 4 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function IncidentTag({ incident }: { incident: ReactorProps["incident"] }) {
  return (
    <Html transform position={[0, 3.5, 0]} distanceFactor={4} pointerEvents="none">
      <div className="mono" style={{ textAlign: "center", whiteSpace: "nowrap" }}>
        {incident ? (
          <span style={{ fontSize: 14, color: incident.severity === "critical" ? "var(--color-danger)" : "var(--color-orbit)" }}>
            ● {incident.service} · {incident.klass.toUpperCase()} [{incident.severity}]
          </span>
        ) : (
          <span style={{ fontSize: 14, color: "var(--color-healthy)" }}>✔ ALL SYSTEMS NOMINAL</span>
        )}
      </div>
    </Html>
  );
}

export default function ReactorCanvas(props: ReactorProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.0, 8.4], fov: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.25} />
      <CameraRig />
      <Reactor {...props} />
      <IncidentTag incident={props.incident} />

      <Panel title="Live loop" position={[-4.35, 0, 0.3]} rotY={0.42} width={260} accent={props.accent === "danger" ? "danger" : "heal"}>
        <LoopLog log={props.log} />
      </Panel>
      <Panel title="Fleet immunity" position={[4.5, 1.7, 0.3]} rotY={-0.42} width={228}>
        <FleetPanel services={props.services} antibodies={props.antibodies} coverage={props.coverage} />
      </Panel>
      <Panel title="Live metrics" position={[4.5, -1.85, 0.3]} rotY={-0.42} width={228}>
        <MetricsPanel mttr={props.mttr} resolved={props.resolved} antibodies={props.antibodies} routerSavings={props.routerSavings} />
      </Panel>

      <EffectComposer>
        <Bloom intensity={1.5} luminanceThreshold={0.15} luminanceSmoothing={0.32} mipmapBlur radius={0.8} />
        <Vignette eskil={false} offset={0.22} darkness={0.95} />
      </EffectComposer>
    </Canvas>
  );
}

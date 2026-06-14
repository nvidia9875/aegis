"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, MeshReflectorMaterial, MeshTransmissionMaterial, Sparkles, Stars } from "@react-three/drei";
import { Bloom, BrightnessContrast, ChromaticAberration, DepthOfField, EffectComposer, HueSaturation, Vignette } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";
import * as THREE from "three";

// ── real-data contract (everything shown is live CI/loop state) ──────────────
export interface ReactorStage { label: string; lit: boolean; active: boolean }
export interface ReactorService { id: string; name: string; health: "healthy" | "healing" | "incident" }
export interface ReactorLog { id: number; text: string; accent: string }
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
  heal: "#46e0d0", danger: "#ff5566", healthy: "#5cf0a8", orbit: "#ff9a3c", evolve: "#b08cff",
} as const;
const ACCENT_CSS: Record<string, string> = {
  heal: "var(--color-heal)", evolve: "var(--color-evolve)", warn: "var(--color-orbit)",
  danger: "var(--color-danger)", healthy: "var(--color-healthy)",
};
const HEALTH_CSS: Record<string, string> = {
  healthy: "var(--color-healthy)", healing: "var(--color-heal)", incident: "var(--color-danger)",
};

const STAGE_COUNT = 8;
const TILT = -1.02;
const RING_NODE = 2.45;
const RING_LABEL = 3.0;
const ring = (r: number, i: number, n = STAGE_COUNT) => {
  const a = (i / n) * Math.PI * 2 - Math.PI / 2;
  return [Math.cos(a) * r, Math.sin(a) * r, 0] as const;
};

// ── fresnel plasma halo (custom shader) ──────────────────────────────────────
const HALO_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vView;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }`;
const HALO_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uTime;
  varying vec3 vN; varying vec3 vView;
  void main(){
    float f = pow(1.0 - max(dot(vN, vView), 0.0), 2.6);
    float pulse = 0.82 + 0.18 * sin(uTime * 2.0);
    gl_FragColor = vec4(uColor * f * 2.4 * pulse, f);
  }`;

function Halo({ color }: { color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color(color) }, uTime: { value: 0 } }), []);
  useFrame((s) => {
    if (mat.current) {
      mat.current.uniforms.uTime.value = s.clock.elapsedTime;
      (mat.current.uniforms.uColor.value as THREE.Color).set(color);
    }
  });
  return (
    <mesh scale={1.0}>
      <icosahedronGeometry args={[1.0, 5]} />
      <shaderMaterial ref={mat} args={[{ uniforms, vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide }]} />
    </mesh>
  );
}

// ── plasma core (3D simplex-noise domain-warped energy shader) ───────────────
const SNOISE = /* glsl */ `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0); const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i  = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + 2.0*C.xxx; vec3 x3 = x0 - 1.0 + 3.0*C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute( permute( permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0; vec4 s1 = floor(b1)*2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x); vec3 p1 = vec3(a0.zw,h.y); vec3 p2 = vec3(a1.xy,h.z); vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0); m = m*m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=a*snoise(p); p*=2.0; a*=0.5; } return v; }
`;
const CORE_VERT = /* glsl */ `${SNOISE}
uniform float uTime; varying vec3 vPos; varying vec3 vNormalW; varying vec3 vView;
void main(){
  vPos = position;
  float d = snoise(position*2.6 + uTime*0.35)*0.05;
  vec3 p = position + normal*d;
  vec4 wp = modelMatrix*vec4(p,1.0);
  vNormalW = normalize(mat3(modelMatrix)*normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix*viewMatrix*wp;
}`;
const CORE_FRAG = /* glsl */ `${SNOISE}
uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
varying vec3 vPos; varying vec3 vNormalW; varying vec3 vView;
void main(){
  vec3 p = vPos*2.4; float t = uTime*0.35;
  vec3 q = vec3(fbm(p+t), fbm(p+vec3(5.2,1.3,2.7)-t), fbm(p+vec3(1.7,9.2,3.1)+t*0.5));
  float plasma = fbm(p + q*1.7 + t)*0.5 + 0.5;
  vec3 col = mix(uColorA, uColorB, smoothstep(0.32,0.85,plasma));
  col += vec3(1.0)*pow(max(plasma-0.72,0.0),2.0)*1.6;
  float fres = pow(1.0 - max(dot(normalize(vNormalW), normalize(vView)),0.0), 2.2);
  col += uColorB*fres*1.1;
  gl_FragColor = vec4(col*1.65, 1.0);
}`;

const WHITE = new THREE.Color("#ffffff");

function PlasmaCore({ color }: { color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uColorA: { value: new THREE.Color(color) }, uColorB: { value: new THREE.Color(color) } }),
    [],
  );
  useFrame((s) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value = s.clock.elapsedTime;
    (mat.current.uniforms.uColorA.value as THREE.Color).set(color);
    (mat.current.uniforms.uColorB.value as THREE.Color).set(color).lerp(WHITE, 0.6);
  });
  return (
    <mesh>
      <sphereGeometry args={[0.6, 96, 96]} />
      <shaderMaterial ref={mat} args={[{ uniforms, vertexShader: CORE_VERT, fragmentShader: CORE_FRAG }]} />
    </mesh>
  );
}

// ── curl-flow particle corona (GPU shader points) ────────────────────────────
const CORONA_VERT = /* glsl */ `${SNOISE}
uniform float uTime; uniform float uSize; varying float vA;
void main(){
  vec3 b = position; float t = uTime*0.25;
  vec3 off = vec3(snoise(b*1.6+vec3(t,0.0,0.0)), snoise(b*1.6+vec3(0.0,t,0.0)), snoise(b*1.6+vec3(0.0,0.0,t)))*0.18;
  float ang = t*0.7 + length(b)*1.4;
  vec3 p = b + off; float c = cos(ang); float s = sin(ang);
  p.xz = mat2(c,-s,s,c)*p.xz;
  vA = 0.35 + 0.65*smoothstep(0.6,0.98,length(b));
  vec4 mv = modelViewMatrix*vec4(p,1.0);
  gl_PointSize = clamp(uSize/(-mv.z), 1.0, 16.0);
  gl_Position = projectionMatrix*mv;
}`;
const CORONA_FRAG = /* glsl */ `
precision mediump float; uniform vec3 uColor; varying float vA;
void main(){
  vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5,0.0,length(d));
  gl_FragColor = vec4(uColor, a*vA);
}`;

function CurlCorona({ color }: { color: string }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const n = 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 0.62 + Math.random() * 0.36;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      pos[i * 3 + 2] = r * Math.cos(ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uSize: { value: 46 }, uColor: { value: new THREE.Color(color) } }), []);
  useFrame((s) => {
    if (mat.current) {
      mat.current.uniforms.uTime.value = s.clock.elapsedTime;
      (mat.current.uniforms.uColor.value as THREE.Color).set(color);
    }
  });
  return (
    <points geometry={geo}>
      <shaderMaterial ref={mat} args={[{ uniforms, vertexShader: CORONA_VERT, fragmentShader: CORONA_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }]} />
    </points>
  );
}

function GlassShell({ color }: { color: string }) {
  return (
    <mesh>
      <sphereGeometry args={[0.76, 64, 64]} />
      <MeshTransmissionMaterial
        samples={4}
        resolution={256}
        thickness={0.5}
        roughness={0.06}
        ior={1.25}
        chromaticAberration={0.35}
        distortion={0.25}
        distortionScale={0.3}
        temporalDistortion={0.1}
        transmission={1}
        backside={false}
        color="#ffffff"
        attenuationColor={color}
        attenuationDistance={1.8}
      />
    </mesh>
  );
}

function Core({ color, glass = true }: { color: string; glass?: boolean }) {
  return (
    <group>
      <PlasmaCore color={color} />
      {glass && <GlassShell color={color} />}
      <CurlCorona color={color} />
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <Halo color={color} />
      <pointLight color={color} intensity={9} distance={10} />
    </group>
  );
}

function Ring({ radius, tube, color, speed, opacity = 1 }: { radius: number; tube: number; color: string; speed: number; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => { if (ref.current) ref.current.rotation.z = s.clock.elapsedTime * speed; });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, tube, 16, 140]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} toneMapped={false} />
    </mesh>
  );
}

function Orbit({ radius, count, color, speed }: { radius: number; count: number; color: string; speed: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => { if (g.current) g.current.rotation.z = s.clock.elapsedTime * speed; });
  const pts = useMemo(() => Array.from({ length: count }, (_, i) => ring(radius, i, count)), [radius, count]);
  return (
    <group ref={g}>
      {pts.map((p, i) => (
        <mesh key={i} position={[p[0], p[1], 0]}>
          <sphereGeometry args={[i % 5 === 0 ? 0.055 : 0.03, 8, 8]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.35 + 0.65 * ((i % 5) / 4)} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

function StageNodes({ stages, accent, accentHex }: { stages: ReactorStage[]; accent: string; accentHex: string }) {
  const activeIndex = stages.findIndex((s) => s.active);
  return (
    <group rotation={[TILT, 0, 0]}>
      {activeIndex >= 0 && (
        <Line
          points={[[0, 0, 0], [ring(RING_NODE, activeIndex)[0], ring(RING_NODE, activeIndex)[1], 0]]}
          color={accentHex}
          lineWidth={2.5}
          transparent
          opacity={0.85}
        />
      )}
      {stages.map((st, i) => {
        const p = ring(RING_NODE, i);
        const lp = ring(RING_LABEL, i);
        const col = st.active ? "#eafcff" : st.lit ? accentHex : "#27384a";
        return (
          <group key={i}>
            <mesh position={[p[0], p[1], 0]} scale={st.active ? 2.0 : st.lit ? 1.25 : 0.9}>
              <sphereGeometry args={[0.07, 16, 16]} />
              <meshBasicMaterial color={col} toneMapped={false} />
            </mesh>
            <Html position={[lp[0], lp[1], 0]} center distanceFactor={6} pointerEvents="none">
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", whiteSpace: "nowrap", color: st.active ? "var(--color-heal)" : st.lit ? "var(--color-muted)" : "var(--color-faint)", textShadow: st.active ? "0 0 8px var(--color-heal)" : "none" }}>
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
      <torusGeometry args={[1.75, 0.035, 12, 120, Math.PI * 2 * Math.max(0.001, coverage)]} />
      <meshBasicMaterial color={HEX.heal} toneMapped={false} />
    </mesh>
  );
}

// immunize shockwave — fires when antibody count increases
function Burst({ trigger, color }: { trigger: number; color: string }) {
  const ref = useRef<THREE.Mesh>(null);
  const age = useRef(99);
  const last = useRef(trigger);
  useFrame((_, dt) => {
    if (trigger > last.current) age.current = 0;
    last.current = trigger;
    age.current += dt;
    const a = age.current;
    const dur = 1.3;
    if (ref.current) {
      ref.current.visible = a < dur;
      ref.current.scale.setScalar(0.4 + a * 4.5);
      const m = ref.current.material as THREE.MeshBasicMaterial;
      m.opacity = Math.max(0, 1 - a / dur);
    }
  });
  return (
    <mesh ref={ref} rotation={[TILT, 0, 0]} visible={false}>
      <torusGeometry args={[1.4, 0.05, 12, 90]} />
      <meshBasicMaterial color={color} transparent toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Reactor({ coverage, antibodies, accent, stages }: ReactorProps) {
  const color = HEX[accent];
  const orbitCount = Math.min(48, 20 + antibodies * 6);
  return (
    <group>
      <group rotation={[TILT, 0, 0]}>
        <Core color={color} />
        <Ring radius={1.9} tube={0.012} color={color} speed={0.3} opacity={0.7} />
        <Ring radius={RING_NODE} tube={0.022} color={color} speed={-0.18} opacity={0.85} />
        <Ring radius={2.95} tube={0.01} color={HEX.evolve} speed={0.12} opacity={0.5} />
        <Orbit radius={2.15} count={orbitCount} color={HEX.orbit} speed={0.5} />
        <Orbit radius={1.6} count={18} color={HEX.evolve} speed={-0.4} />
        <Sparkles count={90} scale={6} size={3} speed={0.3} color={color} opacity={0.6} />
        <group position={[0, 0, -2.6]} scale={0.6}>
          <Core color={HEX.evolve} glass={false} />
          <Ring radius={2.2} tube={0.016} color={HEX.evolve} speed={0.22} opacity={0.5} />
          <Orbit radius={1.9} count={20} color={HEX.orbit} speed={0.4} />
        </group>
      </group>
      <CoverageArc coverage={coverage} />
      <StageNodes stages={stages} accent={accent} accentHex={color} />
      <Burst trigger={antibodies} color={HEX.heal} />
    </group>
  );
}

function Floor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.7, -1]}>
      <planeGeometry args={[70, 70]} />
      <MeshReflectorMaterial
        mirror={0.45}
        resolution={256}
        blur={[400, 120]}
        mixBlur={1.2}
        mixStrength={1.4}
        roughness={0.95}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.25}
        color="#05070e"
        metalness={0.55}
      />
    </mesh>
  );
}

function CameraRig() {
  useFrame((s) => {
    const px = s.pointer.x * 0.8;
    const py = s.pointer.y * 0.45;
    const drift = Math.sin(s.clock.elapsedTime * 0.1) * 0.25;
    s.camera.position.x += (px + drift - s.camera.position.x) * 0.04;
    s.camera.position.y += (1.0 + py - s.camera.position.y) * 0.04;
    s.camera.lookAt(0, 0, 0);
  });
  return null;
}

// ── holographic data panels (real CI data only) ──────────────────────────────
function Panel({ title, children, position, rotY, accent = "heal", width = 260 }: { title: string; children: React.ReactNode; position: [number, number, number]; rotY: number; accent?: "heal" | "danger" | "healthy"; width?: number }) {
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
      {lines.length === 0 && <span className="mono" style={{ fontSize: 12, color: "var(--color-faint)" }}>press RUN — autonomous loop will stream here…</span>}
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
      <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--color-faint)" }}>antibodies</span><span style={{ color: "var(--color-evolve)" }}>{antibodies} ✺</span></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}><span style={{ color: "var(--color-faint)" }}>immunity</span><span style={{ color: "var(--color-heal)" }}>{Math.round(coverage * 100)}% · {Math.round(coverage * 5)}/5</span></div>
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
          <span style={{ fontSize: 14, color: incident.severity === "critical" ? "var(--color-danger)" : "var(--color-orbit)" }}>● {incident.service} · {incident.klass.toUpperCase()} [{incident.severity}]</span>
        ) : (
          <span style={{ fontSize: 14, color: "var(--color-healthy)" }}>✔ ALL SYSTEMS NOMINAL</span>
        )}
      </div>
    </Html>
  );
}

export default function ReactorCanvas(props: ReactorProps) {
  const caOffset = useMemo(() => new THREE.Vector2(0.0006, 0.0006), []);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.0, 8.4], fov: 50 }}
      gl={{ antialias: false, alpha: true, powerPreference: "high-performance", stencil: false }}
    >
      <ambientLight intensity={0.25} />
      <Stars radius={90} depth={50} count={1400} factor={3} saturation={0} fade speed={0.5} />
      <CameraRig />
      <Floor />
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
        <Bloom intensity={1.9} luminanceThreshold={0.12} luminanceSmoothing={0.3} mipmapBlur radius={0.85} />
        <DepthOfField focusDistance={0.012} focalLength={0.025} bokehScale={2.2} height={460} />
        <ChromaticAberration offset={caOffset} radialModulation={false} modulationOffset={0} />
        <HueSaturation saturation={0.14} />
        <BrightnessContrast brightness={0.01} contrast={0.14} />
        <Vignette eskil={false} offset={0.2} darkness={0.98} />
      </EffectComposer>
    </Canvas>
  );
}

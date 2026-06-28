"use client";

import { useMemo } from "react";
import { Sparkles } from "@react-three/drei";
import { SERVICES } from "@/lib/narrative";
import type { Accent, StageId } from "@/lib/types";
import type { Health } from "@/lib/usePlayer";
import { AmbientFleet } from "./AmbientFleet";
import { CameraRig } from "./CameraRig";
import { Flagship } from "./Flagship";
import { HealingBeam } from "./HealingBeam";
import { ImmunityWave } from "./ImmunityWave";
import { HERO_POS, type Vec3 } from "./layout";
import { C } from "./palette";
import { Ship } from "./Ship";
import { Starfield } from "./Starfield";

export interface SceneProps {
  activeStage: StageId | null;
  health: Record<string, Health>;
  coverage: number;
  rippleKey: number | null;
  rippleService: string | null;
  incidentService: string | null;
  accent: Accent;
  gate: boolean;
  reduced: boolean;
}

const heroPos = (id: string | null): Vec3 => (id && HERO_POS[id] ? HERO_POS[id] : [0, 0, 0]);

const CLOSE_STAGES: StageId[] = ["detect", "perceive", "reason"];
const ACT_STAGES: StageId[] = ["act", "verify"];
const WIDE_STAGES: StageId[] = ["immunize", "recall"];

export function ArmadaScene(p: SceneProps) {
  const focusId = p.gate ? null : p.incidentService;
  const focusPos = heroPos(focusId);

  const distance = useMemo(() => {
    if (p.gate) return 10;
    if (!p.activeStage) return 18;
    if (WIDE_STAGES.includes(p.activeStage)) return 22;
    if (CLOSE_STAGES.includes(p.activeStage)) return 9.5;
    if (ACT_STAGES.includes(p.activeStage)) return 8.5;
    return 13;
  }, [p.activeStage, p.gate]);

  const beamActive = !p.gate && !!p.activeStage && ACT_STAGES.includes(p.activeStage) && !!focusId;
  const beamTarget = beamActive ? focusPos : null;
  const rippleOrigin = heroPos(p.rippleService);
  const cameraFocus: Vec3 = p.gate ? [0, 0, 0] : focusPos;
  const tension =
    !p.gate && !!p.activeStage && CLOSE_STAGES.includes(p.activeStage) && !!focusId;

  return (
    <>
      <color attach="background" args={["#06070d"]} />
      <fog attach="fog" args={["#06070d", 22, 70]} />
      <ambientLight intensity={0.25} />
      <Starfield />
      <Sparkles
        count={70}
        scale={[44, 20, 44]}
        size={2.4}
        speed={p.reduced ? 0 : 0.3}
        opacity={0.4}
        color={C.heal}
      />
      <Flagship accent={p.accent} coverage={p.coverage} />
      <AmbientFleet coverage={p.coverage} reduced={p.reduced} />
      {SERVICES.map((svc) => (
        <Ship
          key={svc.id}
          position={heroPos(svc.id)}
          name={svc.name}
          health={p.health[svc.id] ?? "healthy"}
          immunized={p.coverage > 0}
          focused={focusId === svc.id}
          reduced={p.reduced}
        />
      ))}
      <HealingBeam target={beamTarget} active={beamActive} />
      <ImmunityWave trigger={p.rippleKey} origin={rippleOrigin} />
      <CameraRig focus={cameraFocus} distance={distance} tension={tension} reduced={p.reduced} />
    </>
  );
}

"use client";

import { useMemo } from "react";
import { SERVICES } from "@/lib/narrative";
import type { Accent, StageId } from "@/lib/types";
import type { Health } from "@/lib/usePlayer";
import { AmbientFleet } from "./AmbientFleet";
import { CameraRig } from "./CameraRig";
import { Flagship } from "./Flagship";
import { HealingBeam } from "./HealingBeam";
import { ImmunityWave } from "./ImmunityWave";
import { HERO_POS, type Vec3 } from "./layout";
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
    if (p.gate) return 9;
    if (!p.activeStage) return 16;
    if (WIDE_STAGES.includes(p.activeStage)) return 18;
    if (CLOSE_STAGES.includes(p.activeStage)) return 7.5;
    if (ACT_STAGES.includes(p.activeStage)) return 6.5;
    return 12;
  }, [p.activeStage, p.gate]);

  const beamActive = !p.gate && !!p.activeStage && ACT_STAGES.includes(p.activeStage) && !!focusId;
  const beamTarget = beamActive ? focusPos : null;
  const rippleOrigin = heroPos(p.rippleService);
  const cameraFocus: Vec3 = p.gate ? [0, 0, 0] : focusPos;

  return (
    <>
      <color attach="background" args={["#06070d"]} />
      <fog attach="fog" args={["#06070d", 20, 64]} />
      <ambientLight intensity={0.25} />
      <Starfield />
      <Flagship accent={p.accent} coverage={p.coverage} />
      <AmbientFleet coverage={p.coverage} reduced={p.reduced} />
      {SERVICES.map((svc) => (
        <Ship
          key={svc.id}
          position={heroPos(svc.id)}
          health={p.health[svc.id] ?? "healthy"}
          immunized={p.coverage > 0}
          focused={focusId === svc.id}
          reduced={p.reduced}
        />
      ))}
      <HealingBeam target={beamTarget} active={beamActive} />
      <ImmunityWave trigger={p.rippleKey} origin={rippleOrigin} />
      <CameraRig focus={cameraFocus} distance={distance} reduced={p.reduced} />
    </>
  );
}

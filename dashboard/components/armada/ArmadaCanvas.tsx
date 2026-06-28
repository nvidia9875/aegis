"use client";

import { Canvas } from "@react-three/fiber";
import { ArmadaScene, type SceneProps } from "./ArmadaScene";
import { Effects } from "./Effects";

/** Full-bleed WebGL stage for the Obsidian Armada. */
export function ArmadaCanvas(props: SceneProps) {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      dpr={[1, 1.8]}
      camera={{ position: [0, 7, 16], fov: 50, near: 0.1, far: 220 }}
    >
      <ArmadaScene {...props} />
      <Effects enabled={!props.reduced} />
    </Canvas>
  );
}

"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";

/** Neon glow + vignette. Grain comes from the CSS overlay so we keep the stack light. */
export function Effects({ enabled = true }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <EffectComposer>
      <Bloom
        intensity={1.0}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.32}
        mipmapBlur
        radius={0.72}
      />
      <Vignette offset={0.26} darkness={0.82} eskil={false} />
    </EffectComposer>
  );
}

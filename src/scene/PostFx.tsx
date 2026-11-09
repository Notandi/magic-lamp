import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post-processing: a soft bloom so the Smoke, gem and glow halo, then ACES tone mapping
 * (the composer turns off the renderer's own tone mapping).
 * The threshold keeps the lit brass below bloom so the Lamp isn't washed out.
 */
export function PostFx({ bloomResolutionScale = 0.5 }: { bloomResolutionScale?: number }) {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur intensity={0.8} luminanceThreshold={0.7} luminanceSmoothing={0.25} resolutionScale={bloomResolutionScale} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

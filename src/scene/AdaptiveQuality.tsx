import { useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { createQualityController, type QualitySettings } from './quality';

/**
 * Watches the frame rate and hands the current quality settings (Smoke budget, bloom
 * resolution) to its children. Re-renders only when the quality level changes.
 * Must be rendered inside the Canvas.
 */
export function AdaptiveQuality({ children }: { children: (settings: QualitySettings) => ReactNode }) {
  const [controller] = useState(() => createQualityController());
  const [settings, setSettings] = useState(controller.settings);

  useFrame((_, dt) => {
    controller.frame(dt);
    if (controller.settings !== settings) setSettings(controller.settings);
  });

  return <>{children(settings)}</>;
}

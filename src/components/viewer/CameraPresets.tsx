// In-Canvas camera driver: drei <OrbitControls> (damping + polar clamp) plus an
// animated ISO/TOP/FRONT preset transition. The preset *buttons* are DOM chrome
// in ViewerOverlay; this component consumes the selected `preset` and reframes the
// camera toward presetFromBbox(bbox, preset) (D-11/D-12) — bbox derived from the
// real boxes group, never the mockup's hardcoded vectors.
//
// Lives inside the lazy /result subtree (Pitfall 3): the only place a runtime
// three Box3 is computed.

import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, type Group, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type Bbox,
  type PresetKind,
  distanceLimitsFromBbox,
  presetFromBbox,
} from '@/lib/camera-presets';

export interface CameraPresetsProps {
  boxesRef: RefObject<Group | null>;
  preset: PresetKind;
  // Bumped each time a preset button is pressed so re-selecting the same preset
  // still re-triggers the animation.
  presetNonce: number;
  // Reports the computed bbox up to the parent (for any chrome that needs it).
  onBbox?: (bbox: Bbox) => void;
}

const ANIM_MS = 520;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export function CameraPresets({ boxesRef, preset, presetNonce, onBbox }: CameraPresetsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  // Measure the scene bbox from the boxes group post-mount (refs are only valid in
  // effects, not during render). The boxes are static (committed fixture), so a
  // single measurement is correct; default keeps the first frame composed.
  const [bbox, setBbox] = useState<Bbox>({ center: [0, 0, 0], size: [1000, 1000, 1000] });

  useEffect(() => {
    const group = boxesRef.current;
    if (!group) return;
    const box = new Box3().setFromObject(group);
    const c = box.getCenter(new Vector3());
    const s = box.getSize(new Vector3());
    const measured: Bbox = { center: [c.x, c.y, c.z], size: [s.x, s.y, s.z] };
    setBbox(measured);
    onBbox?.(measured);
  }, [boxesRef, onBbox]);

  const limits = useMemo(() => distanceLimitsFromBbox(bbox), [bbox]);

  // Animation state for the active transition.
  const anim = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    start: number;
  } | null>(null);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { position, target } = presetFromBbox(bbox, preset);
    anim.current = {
      fromPos: camera.position.clone(),
      toPos: new Vector3(...position),
      fromTarget: controls.target.clone(),
      toTarget: new Vector3(...target),
      start: performance.now(),
    };
    // Re-run on preset OR nonce change (re-clicking the same preset).
  }, [preset, presetNonce, bbox, camera]);

  useFrame(() => {
    const a = anim.current;
    const controls = controlsRef.current;
    if (!a || !controls) return;
    const k = Math.min((performance.now() - a.start) / ANIM_MS, 1);
    const e = easeOutCubic(k);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
    controls.update();

    // Test-only camera-state hook: the strengthened preset-reframe e2e reads this
    // to assert ISO/TOP/FRONT produce DISTINCT camera positions (a non-reframing
    // regression would leave these identical). DEV/preview only; harmless in prod.
    if (typeof window !== 'undefined') {
      (window as Window & { __cameraState?: unknown }).__cameraState = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [controls.target.x, controls.target.y, controls.target.z],
        settled: k >= 1,
      };
    }

    if (k >= 1) anim.current = null;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={Math.PI * 0.495}
      minDistance={limits.minDistance}
      maxDistance={limits.maxDistance}
    />
  );
}

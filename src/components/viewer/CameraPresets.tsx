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
import { Box3, type Group, Quaternion, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  type Bbox,
  type PresetKind,
  type Vec4Tuple,
  distanceLimitsFromBbox,
  lookQuaternion,
  presetFromBbox,
  slerpQuat,
} from '@/lib/camera-presets';

export interface CameraPresetsProps {
  boxesRef: RefObject<Group | null>;
  preset: PresetKind;
  // Bumped each time a preset button is pressed so re-selecting the same preset
  // still re-triggers the animation.
  presetNonce: number;
  // Bumped by the parent when the selected pallet changes, so the bbox is RE-MEASURED on a
  // swap (the new pallet's boxes feed the group). Distinct from presetNonce: a swap re-measures
  // but MUST NOT re-frame the camera (D-02) — see the ref decoupling below.
  measureNonce?: number;
  // Fallback frame (WR-01): when the selected pallet has ZERO boxes the measured group bbox is
  // EMPTY (`getCenter` → NaN, `getSize` → -Infinity), which would propagate a NaN camera transform
  // and blank the viewer. The parent supplies the pallet-deck footprint as a non-degenerate bbox so
  // the camera still frames the empty deck.
  fallbackBbox?: Bbox;
  // Reports the computed bbox up to the parent (for any chrome that needs it).
  onBbox?: (bbox: Bbox) => void;
}

const ANIM_MS = 520;
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);

export function CameraPresets({
  boxesRef,
  preset,
  presetNonce,
  measureNonce,
  fallbackBbox,
  onBbox,
}: CameraPresetsProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);

  // Measure the scene bbox from the boxes group post-mount (refs are only valid in
  // effects, not during render). A pallet SWAP (Plan 06-03) changes which boxes feed the
  // group, so this is no longer a one-shot measurement — it re-measures each time the
  // selected pallet changes via the `measureNonce` the parent bumps on switch.
  const [bbox, setBbox] = useState<Bbox>({ center: [0, 0, 0], size: [1000, 1000, 1000] });

  // Pitfall 3 (D-02): hold the latest measured bbox in a ref so the preset-animation effect
  // can read a correct frame WHEN a preset is pressed WITHOUT listing `bbox` in its deps. If
  // `bbox` were a dep, a pallet swap (which re-measures the bbox) would re-fire the animation
  // and snap the camera toward the active preset — exactly the no-snap-on-switch violation we
  // are guarding against. The ref decouples "the bbox changed" from "re-frame the camera".
  const bboxRef = useRef<Bbox>(bbox);

  useEffect(() => {
    const group = boxesRef.current;
    if (!group) return;
    const box = new Box3().setFromObject(group);
    // WR-01: an empty pallet (`items === []`) renders no meshes, so `setFromObject` returns an EMPTY
    // box — `getCenter` → NaN, `getSize` → -Infinity — which would propagate a NaN camera transform
    // and blank the viewer with no recovery. Fall back to the pallet-deck footprint (a real,
    // non-degenerate bbox) so the camera still frames the empty deck.
    const measured: Bbox = box.isEmpty()
      ? (fallbackBbox ?? { center: [0, 0, 0], size: [1000, 1000, 1000] })
      : (() => {
          const c = box.getCenter(new Vector3());
          const s = box.getSize(new Vector3());
          return { center: [c.x, c.y, c.z], size: [s.x, s.y, s.z] };
        })();
    bboxRef.current = measured;
    setBbox(measured);
    onBbox?.(measured);
    // Re-measure on mount AND on each pallet switch (measureNonce), never animating off it.
  }, [boxesRef, onBbox, measureNonce, fallbackBbox]);

  // Distance limits stay reactive to the measured bbox (the min/max orbit distance may shift
  // with a differently-sized pallet) — but this only adjusts clamps, it does NOT animate.
  const limits = useMemo(() => distanceLimitsFromBbox(bbox), [bbox]);

  // Animation state for the active transition. `fromQuat`/`toQuat` carry the camera ORIENTATION
  // endpoints so it can be slerped alongside the position/target lerp (#11): a pure position lerp
  // leaves the look-direction to resolve nonlinearly (tilt-then-snap); slerping the orientation
  // sweeps it uniformly so ISO→TOP (and every preset) rotates smoothly.
  const anim = useRef<{
    fromPos: Vector3;
    toPos: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    fromQuat: Vec4Tuple;
    toQuat: Vec4Tuple;
    start: number;
  } | null>(null);

  // Reused scratch quaternion so the per-frame slerp allocates nothing.
  const scratchQuat = useRef(new Quaternion());

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    // Read the LATEST measured bbox from the ref (NOT the `bbox` state) so this effect can
    // target a correct frame without depending on `bbox` — a pallet swap re-measures the bbox
    // but must not re-trigger this animation (D-02 / Pitfall 3).
    const { position, target } = presetFromBbox(bboxRef.current, preset);
    const fromPos: [number, number, number] = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];
    const fromTarget: [number, number, number] = [
      controls.target.x,
      controls.target.y,
      controls.target.z,
    ];
    anim.current = {
      fromPos: camera.position.clone(),
      toPos: new Vector3(...position),
      fromTarget: controls.target.clone(),
      toTarget: new Vector3(...target),
      // Orientation endpoints: the look-rotation at the CURRENT pose and at the target pose.
      fromQuat: lookQuaternion(fromPos, fromTarget),
      toQuat: lookQuaternion(position, target),
      start: performance.now(),
    };
    // Re-run ONLY on an explicit preset press (preset change OR nonce bump). `bbox` is
    // intentionally NOT a dep: re-measuring on a swap must not snap the camera.
  }, [preset, presetNonce, camera]);

  useFrame(() => {
    const a = anim.current;
    const controls = controlsRef.current;
    if (!a || !controls) return;
    const k = Math.min((performance.now() - a.start) / ANIM_MS, 1);
    const e = easeOutCubic(k);
    camera.position.lerpVectors(a.fromPos, a.toPos, e);
    controls.target.lerpVectors(a.fromTarget, a.toTarget, e);
    controls.update();

    // Sweep the camera ORIENTATION smoothly via quaternion slerp (#11). Applied AFTER
    // controls.update() so it overrides OrbitControls' linearly-derived look-at for the duration
    // of the transition — eliminating the tilt-then-snap. On the final frame (k>=1) we let the
    // settled controls.update() above own the orientation so OrbitControls' internal spherical
    // state stays consistent for subsequent user drags.
    if (k < 1) {
      const q = slerpQuat(a.fromQuat, a.toQuat, e);
      scratchQuat.current.set(q[0], q[1], q[2], q[3]);
      camera.quaternion.copy(scratchQuat.current);
    }

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

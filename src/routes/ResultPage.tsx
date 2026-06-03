// The /result viewer scene (D-07/D-13): renders the committed fixture's pallet 0
// as a wood pallet + per-type-coloured boxes, with lights/shadows/fog/grid and the
// dark overlay chrome (header + legend + hints + ISO/TOP/FRONT presets). Camera
// presets auto-fit to the fixture bbox (D-11/D-12), not the mockup's hardcoded
// vectors.
//
// This whole subtree is React.lazy-loaded (router.tsx) so three/r3f/drei stay in
// the lazy chunk and out of the Configure bundle (Pitfall 3 / code-split gate).

import { useMemo, useRef, useState } from 'react';
import { Bounds } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { type Group } from 'three';
import { Boxes, buildPalette } from '@/components/viewer/Boxes';
import { CameraPresets } from '@/components/viewer/CameraPresets';
import { Pallet } from '@/components/viewer/Pallet';
import { ViewerOverlay } from '@/components/viewer/ViewerOverlay';
import type { PresetKind } from '@/lib/camera-presets';
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
import type { DoneResponse } from '@/lib/fixture-types';

const DATA = doneResponse as DoneResponse;

export default function ResultPage() {
  // Render fixture pallet 0 only (D-04).
  const pallet0 = DATA.result.pallets[0];

  // Palette seeded by the WHOLE-fixture type set (all pallets + unpacked) so all
  // legend swatches appear (Pitfall 5): {D, F, T}.
  const palette = useMemo(() => buildPalette(DATA), []);

  const legend = useMemo<[string, string][]>(() => [...palette.entries()], [palette]);

  const boxesRef = useRef<Group>(null);
  const [active, setActive] = useState<PresetKind>('ISO');
  const [presetNonce, setPresetNonce] = useState(0);

  const select = (p: PresetKind) => {
    setActive(p);
    setPresetNonce((n) => n + 1);
  };

  const d = pallet0.dimensions;

  return (
    // Explicit height is required: <Canvas> fills its parent. The radial-gradient
    // background is the dark scene's dominant surface (UI-SPEC Color).
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100dvh',
        background: 'radial-gradient(circle at 50% 40%, #161d2b, var(--color-d-bg))',
      }}
    >
      <Canvas
        data-testid="r3f-canvas"
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ fov: 45, near: 1, far: 20000, position: [2000, 1600, 2200] }}
      >
        <fog attach="fog" args={['#0c0f17', 2800, 5600]} />

        {/* Lights (UI-SPEC scene constants) */}
        <ambientLight color="#9fb0d0" intensity={0.55} />
        <hemisphereLight color="#cdd7f0" groundColor="#0b0d14" intensity={0.5} />
        <directionalLight
          color="#fff6e8"
          intensity={1.15}
          position={[900, 1750, 1150]}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-1600}
          shadow-camera-right={1600}
          shadow-camera-top={1600}
          shadow-camera-bottom={-1600}
          shadow-camera-near={200}
          shadow-camera-far={5000}
        />
        <directionalLight color="#6d7cff" intensity={0.35} position={[-1000, 600, -800]} />

        <Pallet length={d.L} width={d.W} />

        {/* Auto-frame the real fixture (D-12). */}
        <Bounds fit clip observe margin={1.2}>
          <Boxes ref={boxesRef} pallet={pallet0} palette={palette} />
        </Bounds>

        <CameraPresets boxesRef={boxesRef} preset={active} presetNonce={presetNonce} />
      </Canvas>

      <ViewerOverlay
        title="Pallet A"
        dims={{ L: d.L, W: d.W, H: d.H }}
        legend={legend}
        active={active}
        onSelect={select}
      />
    </div>
  );
}

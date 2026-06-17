// The selected pallet's centre-of-gravity diagnostic (DIAG-01 / D-10): a small emissive
// marker sphere at the mapped CoG point plus a vertical drop-line down to the deck. The
// CoG point comes from the golden, three-free `mapCog` point-map (Plan 01) on the
// empirically-confirmed cog.z up-axis (NO half-dimension term — a CoG is already a centre
// point). `DECK_TOP_Y` is the shared deck height (mapping.ts, re-exported via cog-map),
// so the drop-line foot sits on the same deck the boxes stand on.
//
// Per-pallet: ResultPage feeds `cog` + footprint of the SELECTED pallet, so the marker
// moves on a pallet switch. Toggle-able via the ViewerOverlay "Centre of gravity" switch.
//
// All three/r3f/drei imports stay inside this lazy /result subtree (Pitfall 3 / code-split
// gate): the drei <Line> drop-line is idiomatic and keeps the geometry type-safe.

import { Line } from '@react-three/drei';
import { DECK_TOP_Y } from '@/lib/mapping';
import { mapCog } from '@/lib/cog-map';
import type { Cog } from '@/types/pack-contract';

export interface CogMarkerProps {
  cog: Cog;
  // Selected pallet footprint (mm). mapCog recentres the CoG on the world origin in x/z.
  palletL: number;
  palletW: number;
}

export function CogMarker({ cog, palletL, palletW }: CogMarkerProps) {
  const [x, y, z] = mapCog(cog, { L: palletL, W: palletW });
  return (
    <group>
      {/* Marker sphere at the mapped CoG — the CoG sits dead-centre INSIDE the opaque box
          tower, so without disabling depth it is fully occluded and the user sees nothing
          (#4 BUG). Draw it as an always-visible overlay: meshBasicMaterial (lit-independent,
          reads consistently as a marker) with depthTest/depthWrite off and a high renderOrder
          so it paints OVER the boxes regardless of position. Radius bumped 14 -> 18 for
          legibility through the stack. */}
      <mesh position={[x, y, z]} renderOrder={999}>
        <sphereGeometry args={[18, 20, 20]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
      </mesh>
      {/* Vertical drop-line from the deck [x, DECK_TOP_Y, z] up to the CoG [x, y, z]. Same
          overlay treatment (depthTest off + high renderOrder) so the dashed line is visible
          over the box meshes too. */}
      <Line
        points={[
          [x, DECK_TOP_Y, z],
          [x, y, z],
        ]}
        color="#ffffff"
        lineWidth={1}
        dashed
        dashSize={18}
        gapSize={12}
        transparent
        opacity={0.8}
        depthTest={false}
        renderOrder={999}
      />
    </group>
  );
}

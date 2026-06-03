// Per-box meshes for fixture pallet 0: each API placement is mapped to a Three.js
// box-centre transform (mapPlacement) and tinted by its box type (colorForType),
// with drei <Edges> for the mockup's edge-lines. Individual meshes (no InstancedMesh)
// per D-10 — the single-pallet count (~19) is far below the instancing threshold.
//
// The palette is built from the WHOLE-fixture type set ({D,F,T}) so the legend is
// stable across pallets (Pitfall 5); buildPalette is exported so ResultPage's
// legend and these meshes share one deterministic colour map. dev-only
// assertWithinEnvelope mirrors the golden AABB invariant at runtime (tree-shaken).
//
// All three/r3f/drei imports stay inside this lazy /result subtree (Pitfall 3).

import { forwardRef, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { Color, type Group } from 'three';
import type { DoneResponse, PalletResult } from '@/lib/fixture-types';
import { assertWithinEnvelope, mapPlacement, typeKeyOf } from '@/lib/mapping';
import { colorForType } from '@/lib/palette';

/**
 * Build the deterministic type->colour map from the WHOLE fixture (all pallets +
 * unpacked), so every legend swatch appears regardless of which pallet renders.
 */
export function buildPalette(data: DoneResponse): Map<string, string> {
  const keys = new Set<string>();
  for (const p of data.result.pallets) for (const it of p.items) keys.add(typeKeyOf(it.item_id));
  for (const u of data.result.unpacked_items) keys.add(typeKeyOf(u.item_id));
  return colorForType([...keys]);
}

export interface BoxesProps {
  pallet: PalletResult;
  // Palette keyed by the whole-fixture type set (from buildPalette).
  palette: Map<string, string>;
}

// Edge tint: from the box colour via offsetHSL(0, -0.04, +0.18) (mockup tint()).
function edgeTint(hex: string): Color {
  return new Color(hex).offsetHSL(0, -0.04, 0.18);
}

export const Boxes = forwardRef<Group, BoxesProps>(function Boxes({ pallet, palette }, ref) {
  const mapped = useMemo(
    () =>
      pallet.items.map((item) => {
        const typeKey = typeKeyOf(item.item_id);
        assertWithinEnvelope(item, pallet.dimensions); // dev-only, tree-shaken
        return {
          ...mapPlacement(item, pallet.dimensions, typeKey),
          color: palette.get(typeKey) ?? '#888888',
        };
      }),
    [pallet, palette],
  );

  return (
    <group ref={ref}>
      {mapped.map((b) => (
        <mesh key={b.id} position={b.center} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={0.62} metalness={0.04} />
          <Edges>
            <lineBasicMaterial color={edgeTint(b.color)} transparent opacity={0.55} />
          </Edges>
        </mesh>
      ))}
    </group>
  );
});

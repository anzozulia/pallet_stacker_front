// Per-box meshes for the selected pallet: each API placement is mapped to a Three.js
// box-centre transform (mapPlacement) and tinted by its RECOVERED `typeId` via the shared
// palette, with drei <Edges> for the mockup's edge-lines. Individual meshes (no InstancedMesh)
// per D-10 — the single-pallet count (~19) is far below the instancing threshold.
//
// CR-01: tinting keys off the mapped `item.typeId` (the same map-PRIMARY/parse-FALLBACK key the
// rest of the page uses), NOT a re-parsed `typeKeyOf(item_id)`. ResultPage builds the palette from
// `view.byType.keys()` (the recovered typeIds) so the box tint, the PlacementList swatch, and the
// legend label all resolve to the SAME colour. dev-only assertWithinEnvelope mirrors the golden
// AABB invariant at runtime (tree-shaken).
//
// All three/r3f/drei imports stay inside this lazy /result subtree (Pitfall 3).

import { forwardRef, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { Color, type Group } from 'three';
import type { PalletDims, PlacementOut } from '@/lib/fixture-types';
import { assertWithinEnvelope, mapPlacement } from '@/lib/mapping';
import { supportColor } from '@/lib/support-scale';

export interface BoxesProps {
  // The SELECTED pallet's placements, each tagged with its recovered `typeId` (from the mapped
  // `view` — map-PRIMARY/parse-FALLBACK, CR-01). Tinting keys off this `typeId`, NOT a re-parsed
  // `typeKeyOf(item_id)`, so the box colour matches the PlacementList swatch + legend exactly.
  items: Array<PlacementOut & { typeId: string }>;
  // The selected pallet's footprint, needed by mapPlacement (recentre) + the dev AABB assertion.
  dimensions: PalletDims;
  // Palette keyed by the recovered `typeId` (built in ResultPage from `view.byType.keys()`), so
  // the palette key, the box tint key, the PlacementList lookup key, and the legend label are ALL
  // the same recovered `typeId` (CR-01 invariant).
  palette: Map<string, string>;
  // The hovered placement's id (= item_id) from the PlacementList rail (D-11). The matching mesh
  // glows via a DECLARATIVE emissiveIntensity — r3f diffs the prop and patches the live material in
  // place (NO imperative material.emissive.set, NO ref, NO remount).
  hoveredId?: string | null;
  // Support-heatmap colour mode (DIAG-02 / D-10). When true, each box is tinted by its
  // `support_ratio` via the pure `supportColor` scale instead of its by-type palette colour.
  // Default (false/undefined) keeps the by-type colouring — the default per D-10.
  heatmap?: boolean;
}

// Edge tint: from the box colour via offsetHSL(0, -0.04, +0.18) (mockup tint()).
function edgeTint(hex: string): Color {
  return new Color(hex).offsetHSL(0, -0.04, 0.18);
}

export const Boxes = forwardRef<Group, BoxesProps>(function Boxes(
  { items, dimensions, palette, hoveredId, heatmap },
  ref,
) {
  const mapped = useMemo(
    () =>
      items.map((item) => {
        // Tint by the recovered `typeId` (CR-01): the SAME key the palette/legend/PlacementList use.
        const typeKey = item.typeId;
        assertWithinEnvelope(item, dimensions); // dev-only, tree-shaken
        // Colour by MODE (D-10): heatmap ON → the pure support-ratio scale; OFF → by-type palette.
        const color = heatmap
          ? supportColor(item.support_ratio)
          : (palette.get(typeKey) ?? '#888888');
        return {
          ...mapPlacement(item, dimensions, typeKey),
          color,
        };
      }),
    [items, dimensions, palette, heatmap],
  );

  return (
    <group ref={ref}>
      {mapped.map((b) => (
        <mesh key={b.id} position={b.center} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          {/* Declarative hover glow (D-11): r3f diffs emissiveIntensity and patches the live
              material in place — no imperative material.emissive.set, no remount. Keyed by the box
              id (= item_id). Individual meshes (D-12) make per-box emissive trivial (≤19 boxes). */}
          <meshStandardMaterial
            color={b.color}
            emissive={b.color}
            emissiveIntensity={hoveredId === b.id ? 0.45 : 0}
            roughness={0.62}
            metalness={0.04}
          />
          <Edges>
            <lineBasicMaterial color={edgeTint(b.color)} transparent opacity={0.55} />
          </Edges>
        </mesh>
      ))}
    </group>
  );
});

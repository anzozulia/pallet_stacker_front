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

import { forwardRef, useMemo, useRef } from 'react';
import { Edges } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { Color, type Group } from 'three';
import type { PalletDims, PlacementOut } from '@/lib/fixture-types';
import { assertWithinEnvelope, mapPlacement } from '@/lib/mapping';
import { supportColor } from '@/lib/support-scale';
import { EXPLODE_FIXED_UNIT, type LayerModel } from '@/lib/computeLayers';

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
  // The base-z layer banding for this pallet (computeLayers, Plan 01). Boxes are grouped BY
  // `itemToLayer.get(item_id)` so each layer can be lifted as a unit when exploded (L-01, ≤4
  // wrapper groups). Default 0 for any item missing from the map (degenerate guard).
  layerModel: LayerModel;
  // Explode amount, 0 or 1 (D-04). 0 = byte-identical assembled stack (no offset, SC-3 / Pitfall 5).
  // 1 lifts each layer group by `layerIndex * explode * EXPLODE_FIXED_UNIT` (D-04 uniform additive
  // gap), animated each frame via maath easing.damp (D-07).
  explode: number;
  // 1-based revealed-up-to layer (D-08, floor-up), or null = "All" (the no-op default). null shows
  // every layer; otherwise build-up reveals layers <= focusIndex-1 and HIDES the rest. Opacity is
  // always 1 / transparent always false (SC-3 / Pitfall 5).
  focusIndex: number | null;
}

// Pure per-layer appearance for the current build-up level (RESEARCH Pattern 2). `layerIndex` is
// 0-based; `focusIndex` is 1-based (floor-up) or null. Build-up ONLY (no dim-the-rest mode):
//   - focusIndex == null -> { visible: true,  opacity: 1 }            (All default — byte-identical)
//   - otherwise          -> show layers <= focusIndex-1, HIDE above   (cumulative reveal, D-08)
// Opacity is ALWAYS 1 (the caller sets transparent=FALSE) so there are never sort artifacts.
export function layerAppearance(
  layerIndex: number,
  focusIndex: number | null,
): { visible: boolean; opacity: number } {
  if (focusIndex == null) return { visible: true, opacity: 1 };
  return { visible: layerIndex <= focusIndex - 1, opacity: 1 };
}

// Edge tint: from the box colour via offsetHSL(0, -0.04, +0.18) (mockup tint()).
function edgeTint(hex: string): Color {
  return new Color(hex).offsetHSL(0, -0.04, 0.18);
}

export const Boxes = forwardRef<Group, BoxesProps>(function Boxes(
  { items, dimensions, palette, hoveredId, heatmap, layerModel, explode, focusIndex },
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

  // Group the mapped boxes BY their base-z layer index (computeLayers, Plan 01). One wrapper
  // <group> per layer (L-01 — per-layer, NOT per-mesh: ≤4 groups for the fixture) so a whole
  // layer can be lifted as a unit when exploded. Items missing from the map default to layer 0.
  const layered = useMemo(() => {
    const byLayer = new Map<number, typeof mapped>();
    for (const b of mapped) {
      const li = layerModel.itemToLayer.get(b.id) ?? 0;
      const bucket = byLayer.get(li);
      if (bucket) bucket.push(b);
      else byLayer.set(li, [b]);
    }
    // Stable floor-up order so the wrapper-group array index is the layer index.
    return [...byLayer.entries()].sort((a, b) => a[0] - b[0]);
  }, [mapped, layerModel]);

  // One ref per layer wrapper group so useFrame can damp each group's position.y toward its
  // explode target without re-rendering React (the animation is imperative-per-frame, D-07).
  const groupRefs = useRef<Map<number, Group>>(new Map());

  // D-07: animate each layer group's vertical offset toward its target every frame. The target is
  // `layerIndex * explode * EXPLODE_FIXED_UNIT` (D-04 uniform additive gap) — at explode === 0 the
  // target is 0 for EVERY layer, so the assembled stack is byte-identical (SC-3 / Pitfall 5). The
  // dt-aware maath easing.damp retargets continuously as the slider drags (smoothTime ~0.18s).
  useFrame((_, dt) => {
    for (const [layerIndex, group] of groupRefs.current) {
      const targetY = layerIndex * explode * EXPLODE_FIXED_UNIT;
      easing.damp(group.position, 'y', targetY, 0.18, dt);
    }
  });

  return (
    <group ref={ref}>
      {layered.map(([layerIndex, boxes]) => {
        // Per-layer build-up appearance (D-08). `visible` drops a HIDDEN upper layer out of the
        // scene entirely (group not rendered). At the All default (focusIndex null) every layer is
        // visible — the byte-identical assembled view (Pitfall 5: transparent always false).
        const { visible } = layerAppearance(layerIndex, focusIndex);
        return (
          <group
            key={layerIndex}
            visible={visible}
            ref={(g) => {
              if (g) groupRefs.current.set(layerIndex, g);
              else groupRefs.current.delete(layerIndex);
            }}
          >
            {boxes.map((b) => (
              <mesh key={b.id} position={b.center} castShadow receiveShadow>
                <boxGeometry args={b.size} />
                {/* Declarative hover glow (D-11): r3f diffs emissiveIntensity and patches the live
                    material in place — no imperative material.emissive.set, no remount. Keyed by the
                    box id (= item_id). Individual meshes (D-12) keep per-box emissive trivial.
                    Build-up only: opacity stays 1 and transparent stays FALSE so every revealed box
                    is fully opaque and the All default is byte-identical (Pitfall 5). */}
                <meshStandardMaterial
                  color={b.color}
                  emissive={b.color}
                  emissiveIntensity={hoveredId === b.id ? 0.45 : 0}
                  roughness={0.62}
                  metalness={0.04}
                  transparent={false}
                  opacity={1}
                />
                <Edges lineWidth={1.75}>
                  <lineBasicMaterial color={edgeTint(b.color)} transparent opacity={0.55} />
                </Edges>
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
});

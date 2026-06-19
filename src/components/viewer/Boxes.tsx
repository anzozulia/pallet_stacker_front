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
  // Explode amount, 0..1 (D-04). 0 = byte-identical assembled stack (no offset, no transparency,
  // SC-3 / Pitfall 5). >0 lifts each layer group by `layerIndex * explode * EXPLODE_FIXED_UNIT`
  // (D-04 uniform additive gap), animated each frame via maath easing.damp (D-07).
  explode: number;
  // Layer-focus mode (D-08/D-09). `buildup` reveals layers cumulatively from the floor — layers
  // above the focused one are HIDDEN; `isolate` keeps every layer visible but DIMS the non-focused
  // ones to translucent ghosts (GHOST_OPACITY) so the focused layer stands out solid. Only matters
  // when `focusIndex` is non-null; at null both modes collapse to the All default (all opaque).
  focusMode: 'buildup' | 'isolate';
  // 1-based focused layer (D-08, floor-up), or null = "All" (the no-op default). null reproduces the
  // Plan-02 behaviour EXACTLY: every layer visible + opaque, transparent never set (SC-3 / Pitfall 5).
  focusIndex: number | null;
}

// Ghost opacity for non-focused layers in isolate mode (D-09). A 3D-material constant (UI-SPEC
// "Color": ghost ~0.12-0.18, NOT a design token). Low enough to read as a translucent ghost yet
// keep the heatmap colour + hover glow legible THROUGH it (Pitfall 4 / SC-4).
const GHOST_OPACITY = 0.15;

// Pure per-layer appearance for the current focus (RESEARCH Pattern 2). `layerIndex` is 0-based;
// `focusIndex` is 1-based (floor-up) or null. Returns whether the layer's wrapper group renders at
// all + the opacity applied to its meshes. NEVER recolours (Pitfall 4) — colour/emissive stay with
// the heatmap/hover logic; this only drives visibility + opacity:
//   - focusIndex == null  -> { visible: true,  opacity: 1 }            (All default — byte-identical)
//   - buildup             -> show layers <= focusIndex-1, HIDE above   (cumulative reveal, D-08)
//   - isolate             -> focused layer solid, all others ghosted   (dim-the-rest, D-09)
// Pitfall 5: opacity 1 means the caller sets transparent=FALSE, so the default has no sort artifacts.
export function layerAppearance(
  layerIndex: number,
  focusMode: 'buildup' | 'isolate',
  focusIndex: number | null,
): { visible: boolean; opacity: number } {
  if (focusIndex == null) return { visible: true, opacity: 1 };
  const k0 = focusIndex - 1; // 0-based focused layer
  if (focusMode === 'buildup') {
    return { visible: layerIndex <= k0, opacity: 1 };
  }
  // isolate
  return layerIndex === k0
    ? { visible: true, opacity: 1 }
    : { visible: true, opacity: GHOST_OPACITY };
}

// Edge tint: from the box colour via offsetHSL(0, -0.04, +0.18) (mockup tint()).
function edgeTint(hex: string): Color {
  return new Color(hex).offsetHSL(0, -0.04, 0.18);
}

export const Boxes = forwardRef<Group, BoxesProps>(function Boxes(
  { items, dimensions, palette, hoveredId, heatmap, layerModel, explode, focusMode, focusIndex },
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
        // Per-layer focus appearance (D-08/D-09). `visible` drops a HIDDEN build-up layer out of
        // the scene entirely (group not rendered); `opacity` ghosts a non-focused isolate layer.
        // At the All default (focusIndex null) -> { visible:true, opacity:1 } so the group renders
        // exactly as Plan 02 left it (Pitfall 5: transparent stays false at opacity 1).
        const { visible, opacity } = layerAppearance(layerIndex, focusMode, focusIndex);
        const transparent = opacity < 1;
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
                    Ghosting (D-09) sets ONLY transparent/opacity — colour + emissive (heatmap/hover)
                    stay untouched so both remain legible THROUGH the ghost (Pitfall 4 / SC-4).
                    transparent is FALSE at opacity 1 so the All default is byte-identical (Pitfall 5). */}
                <meshStandardMaterial
                  color={b.color}
                  emissive={b.color}
                  emissiveIntensity={hoveredId === b.id ? 0.45 : 0}
                  roughness={0.62}
                  metalness={0.04}
                  transparent={transparent}
                  opacity={opacity}
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

// The /result viewer scene (D-01/D-07/D-13): renders the REAL `done` payload read from the
// react-query cache — NOT the committed fixture. The page is the carrier seam every later Phase-6
// slice consumes: it reads `{ jobId, idToType }` from react-router nav state (handed over by
// LoadingPage on the `done` navigation), pulls the settled job body from the cache under
// ['job', jobId] (gcTime:Infinity keeps it alive across the hop), runs `mapDoneResponse(done.result,
// idToType)` so map-PRIMARY type recovery applies (C-03), and renders the selected pallet's boxes in
// ONE persistent <Canvas> (D-01/SC-1). Changing `sel` swaps which pallet feeds <Boxes> WITHOUT
// remounting the Canvas.
//
// No-result guard (C-02 / threat T-06-03/04): a hard refresh / deep-link to /result with no result in
// memory (no nav state, an unknown jobId, or a non-'done' cached job) redirects to '/' and renders
// nothing — the result is ephemeral, never persisted; only the config is autosaved.
//
// Security (V5 / threat T-06-02): every API-sourced string (pallet_id, item_id, dims) is rendered as
// React text children only — never via a raw-HTML sink (mirrors the Phase-5 ErrorCard escaped-text
// rule). The escaped-text grep gate over this file must stay at zero raw-HTML sinks.
//
// This whole subtree is React.lazy-loaded (router.tsx) so three/r3f/drei stay in the lazy chunk and
// out of the Configure bundle (Pitfall 3 / code-split gate). queryClient/mapper/nav-state read add NO
// three to the eager chunk (they are three-free).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { type Group } from 'three';
import { Canvas } from '@react-three/fiber';
import { Boxes, buildPalette } from '@/components/viewer/Boxes';
import { CameraPresets } from '@/components/viewer/CameraPresets';
import { Pallet } from '@/components/viewer/Pallet';
import { ViewerOverlay } from '@/components/viewer/ViewerOverlay';
import SummaryBlock from '@/components/result/SummaryBlock';
import PalletSwitcher from '@/components/result/PalletSwitcher';
import { queryClient } from '@/api/queryClient';
import { mapDoneResponse } from '@/lib/result-mapper';
import type { PresetKind } from '@/lib/camera-presets';
import type { JobState } from '@/api/pack-schema';
import type { DoneResponse, DoneResult } from '@/types/pack-contract';

/** The nav payload LoadingPage hands over on `done` (C-03): the cache key + the id→type recovery map. */
interface ResultNavState {
  jobId: string;
  idToType?: Map<string, string>;
}

/**
 * Validate the nav payload BEFORE any consumer reads it (threat T-06-03). `jobId` must be a string and,
 * when present, `idToType` must be a real `Map` (a crafted `history.state` could otherwise carry a
 * plain object that would crash `idToType.get(...)`). Mirrors `isLoadingNavState` (LoadingPage) and its
 * `instanceof Map` discipline. A failed check leaves `jobId` undefined → the redirect guard fires.
 */
function isResultNavState(state: unknown): state is ResultNavState {
  if (typeof state !== 'object' || state === null) return false;
  const { jobId, idToType } = state as { jobId?: unknown; idToType?: unknown };
  if (typeof jobId !== 'string') return false;
  if (idToType !== undefined && !(idToType instanceof Map)) return false;
  return true;
}

export default function ResultPage() {
  const navigate = useNavigate();
  const navState = useLocation().state;

  // The carrier read (C-02): validate nav state, then pull the SETTLED job body straight off the
  // react-query cache (one-shot getQueryData — the job already reached `done`, no live subscription).
  const valid = isResultNavState(navState);
  const jobId = valid ? navState.jobId : undefined;
  const idToType = valid ? navState.idToType : undefined;
  const done = jobId ? queryClient.getQueryData<JobState>(['job', jobId]) : undefined;
  const hasResult = !!done && done.status === 'done' && !!done.result;

  // No-result guard (C-02): no nav state / unknown jobId / non-'done' cached job → redirect home.
  // The body was zod-parsed upstream (Phase 5) so a wrong-shape `done` fails the status guard and
  // redirects rather than crashing the render (threat T-06-04).
  useEffect(() => {
    if (!hasResult) navigate('/', { replace: true });
  }, [hasResult, navigate]);

  // Selected-pallet + hover state (D-01/D-05). `sel` swaps which pallet feeds the ONE persistent
  // Canvas AND drives the PalletSwitcher selected highlight + the overlay sub-line (this slice).
  // `setHoveredId` is the PlacementList hover link landing in Plan 04 — declared now, not yet read.
  const [sel, setSel] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  void hoveredId;
  void setHoveredId; // wired by PlacementList (Plan 04)

  // Camera-preset state (PRESERVED from the fixture version — the scene subtree is unchanged, C-01).
  const boxesRef = useRef<Group>(null);
  const [active, setActive] = useState<PresetKind>('ISO');
  const [presetNonce, setPresetNonce] = useState(0);
  const select = (p: PresetKind) => {
    setActive(p);
    setPresetNonce((n) => n + 1);
  };

  // All hooks above the JSX guard so hook order is stable across the redirect render.
  const result = (done?.result ?? null) as DoneResult | null;

  // Run map-PRIMARY type recovery with the carrier idToType (C-03). Cast ONLY `done.result`: the
  // JobState envelope matches DoneResponse, `result` is typed `unknown` at the poll boundary
  // (pack-schema.ts) but IS the DoneResult body (confirmed by the e2e `{ status:'done', result }`).
  // The mapped `view` feeds the rail (SummaryBlock whole-job stats + PalletSwitcher per-pallet rows).
  const view = useMemo(
    () => (result ? mapDoneResponse({ ...done!, result } as DoneResponse, idToType) : null),
    [done, result, idToType],
  );

  // Build the palette ONCE from the WHOLE result (all pallets + unpacked) so the legend is stable
  // across pallet switches (Pitfall 5) — not from the selected pallet alone.
  const palette = useMemo(
    () => (result ? buildPalette({ result } as DoneResponse) : new Map<string, string>()),
    [result],
  );
  const legend = useMemo<[string, string][]>(() => [...palette.entries()], [palette]);

  if (!hasResult || !result || !view) return null;

  // Read the selected pallet's footprint from the cached PalletResult (A2/A3 — MappedPallet drops
  // `dimensions`). Clamp `sel` defensively so a stale index never reads past the array.
  const selIndex = Math.min(sel, result.pallets.length - 1);
  const selPallet = result.pallets[selIndex];
  const selMapped = view.pallets[selIndex]; // MappedPallet: items / utilisation / totalWeight
  const d = selPallet.dimensions;
  const palletLabel = selPallet.pallet_id || `Pallet ${selIndex + 1}`;

  // Computed per-selected-pallet overlay sub-line (D-03): item count + 1-decimal fill% + 1-decimal kg.
  const subline = `${selMapped.items.length} boxes placed · ${(selMapped.utilisation * 100).toFixed(1)}% fill · ${selMapped.totalWeight.toFixed(1)} kg`;

  return (
    <div className="grid h-[100dvh] grid-cols-[1fr_384px] grid-rows-[var(--topbar-height)_1fr] max-[900px]:grid-cols-1 max-[900px]:grid-rows-[var(--topbar-height)_1fr_auto]">
      {/* Result TOPBAR (D-09): mirrors the Configure topbar — brand glyph + step-nav (Configure ✓ →
          Result active) + an "Edit configuration" ghost button that returns to / with the draft
          intact. NO Export, NO "Solved in" pill (D-07). Spans both columns. */}
      <header className="col-span-full flex h-[var(--topbar-height)] items-center gap-3 border-b border-border bg-[rgba(255,255,255,0.82)] px-6 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold tracking-[-0.02em] text-text">
          <span
            aria-hidden="true"
            className="relative h-[22px] w-[22px] flex-none rounded-[6px] bg-[linear-gradient(150deg,#6d63f5,#4f46e5)] after:absolute after:inset-[5px] after:rounded-[2px] after:border-[1.5px] after:border-white/90 after:content-['']"
          />
          Palletize
          <small className="ml-0.5 font-mono text-[10px] font-normal uppercase text-text-3">
            pack&nbsp;studio
          </small>
        </div>

        <nav aria-label="Steps" className="ml-1.5 flex items-center gap-2 max-[720px]:hidden">
          <span className="flex items-center gap-[7px] text-xs text-text-3">
            <span
              aria-hidden="true"
              className="grid h-[19px] w-[19px] place-items-center rounded-full border border-border-strong font-mono text-[11px] text-text-3"
            >
              ✓
            </span>
            Configure
          </span>
          <span aria-hidden="true" className="h-px w-[22px] bg-border-strong" />
          <span
            aria-current="step"
            className="flex items-center gap-[7px] text-xs font-semibold text-text"
          >
            <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-accent font-mono text-[11px] text-white">
              2
            </span>
            Result
          </span>
        </nav>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-border px-4 py-2 text-sm font-semibold text-text transition-colors duration-150 hover:bg-surface-2"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Edit configuration
        </button>
      </header>

      {/* The persistent viewer (D-01/SC-1): ONE <Canvas> for the whole session. Switching `sel`
          swaps which pallet feeds <Boxes>/<Pallet> — the Canvas never remounts. */}
      <div
        className="relative h-full w-full"
        style={{ background: 'radial-gradient(circle at 50% 40%, #161d2b, var(--color-d-bg))' }}
      >
        <Canvas
          data-testid="r3f-canvas"
          shadows
          dpr={[1, 2]}
          // preserveDrawingBuffer keeps the rendered framebuffer readable after the draw call so
          // Playwright canvas screenshots capture real pixels (the preset-reframe e2e diffs them).
          gl={{ antialias: true, preserveDrawingBuffer: true }}
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

          {/* CameraPresets OWNS all framing (D-11/D-12): it measures the boxes-group bbox post-mount
              and drives the camera/target to presetFromBbox(...). A drei <Bounds observe> wrapper
              here would re-fit every frame and fight the preset animation, so it is intentionally
              absent. */}
          <Boxes ref={boxesRef} pallet={selPallet} palette={palette} />

          {/* measureNonce = selIndex: a pallet swap RE-MEASURES the bbox (new boxes) but must NOT
              re-frame the camera (D-02). CameraPresets reads the latest bbox via a ref and animates
              only on an explicit preset press. */}
          <CameraPresets
            boxesRef={boxesRef}
            preset={active}
            presetNonce={presetNonce}
            measureNonce={selIndex}
          />
        </Canvas>

        <ViewerOverlay
          title={palletLabel}
          dims={{ L: d.L, W: d.W, H: d.H }}
          subline={subline}
          legend={legend}
          active={active}
          onSelect={select}
        />
      </div>

      {/* Result rail (D-08): the persistent reading surface. This slice mounts the whole-job Summary
          block + the per-pallet Switcher (Plan 06-03); Placement / Unpacked land in Plans 04–05.
          Selecting a switcher row calls setSel → swaps the canvas pallet + the overlay sub-line.
          Stacks beneath the viewer below 900px. */}
      <aside
        aria-label="Result details"
        data-result-rail
        className="flex flex-col gap-6 overflow-y-auto border-l border-border bg-bg p-6 max-[900px]:border-l-0 max-[900px]:border-t"
        data-pallet-count={result.pallets.length}
      >
        <SummaryBlock view={view} />
        <PalletSwitcher pallets={view.pallets} selected={selIndex} onSelect={setSel} />
      </aside>
    </div>
  );
}

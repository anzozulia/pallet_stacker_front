# Phase 6: Result Page & 3D Wiring - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 12 (4 modified, 8 created)
**Analogs found:** 12 / 12 (every new/modified file has a strong in-repo analog — this is a wiring-and-extend phase, not greenfield)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/routes/ResultPage.tsx` (MODIFY) | route / integration target | request-response (cache read + redirect) | itself + `src/routes/LoadingPage.tsx` (nav-state + redirect) | exact (self) |
| `src/routes/LoadingPage.tsx` (MODIFY) | route | event-driven (nav on `done`) | itself (lines 132–134, 27–28) | exact (self) |
| `src/components/viewer/Boxes.tsx` (MODIFY) | component (r3f) | transform / render | itself (lines 42–69) | exact (self) |
| `src/components/viewer/ViewerOverlay.tsx` (MODIFY) | component (DOM chrome) | request-response (props) | itself (lines 24–89) | exact (self) |
| `src/lib/result-summary.ts` (CREATE) | utility (pure) | transform / aggregate | `src/lib/config-tally.ts` | exact (role+flow) |
| `src/lib/cog-map.ts` (CREATE) | utility (pure) | transform (point-map) | `src/lib/mapping.ts` `mapPlacement` | exact (role+flow) |
| `src/lib/support-scale.ts` (CREATE) | utility (pure) | transform (bucket/colour) | `src/lib/palette.ts` + `config-tally.ts` | role-match |
| `src/components/viewer/CogMarker.tsx` (CREATE) | component (r3f) | render | `src/components/viewer/Boxes.tsx` (mesh+drei pattern) | role-match |
| `src/components/result/SummaryBlock.tsx` (CREATE) | component (DOM rail) | request-response | `src/components/Card.tsx` + `LoadingPage` stat `<dl>` (244–269) | role-match |
| `src/components/result/PalletSwitcher.tsx` (CREATE) | component (DOM rail) | event-driven (select) | `src/features/config/BoxCatalogCard.tsx` (list) + `Switch.tsx` (a11y) | role-match |
| `src/components/result/PlacementList.tsx` (CREATE) | component (DOM rail) | event-driven (hover) | `src/features/config/BoxRow.tsx` (swatch+id+grid row) | role-match |
| `src/components/result/UnpackedPanel.tsx` (CREATE) | component (DOM rail) | request-response | `src/features/config/BoxRow.tsx` head + `Card.tsx` | role-match |

---

## Pattern Assignments

### `src/routes/ResultPage.tsx` (MODIFY — route, cache-read + redirect)

**Analog:** itself (current fixture-import version) + `src/routes/LoadingPage.tsx` for the nav-state + redirect idiom.

**Current structure to PRESERVE** (`ResultPage.tsx` lines 33–104): `boxesRef` / `active` / `presetNonce` state, the `select` preset handler, the `<Canvas>` + lights + fog + `<Pallet>` + `<Boxes>` + `<CameraPresets>` tree, and `<ViewerOverlay>`. Do NOT rebuild the scene (C-01). Only the **data source** and the **rail** change.

**SWAP — kill the fixture import** (current lines 18–29):
```typescript
import doneResponse from '@/lib/__fixtures__/pack-done-response.json';
const DATA = doneResponse as DoneResponse;
const pallet0 = DATA.result.pallets[0];
const palette = useMemo(() => buildPalette(DATA), []);
```

**REPLACE WITH — the carrier read** (mirror `LoadingPage.tsx` nav-state read at lines 27, 71–77, and the redirect-on-invalid at 125–127):
```tsx
import { useLocation, useNavigate } from 'react-router';
import { queryClient } from '@/api/queryClient';
import { mapDoneResponse } from '@/lib/result-mapper';
import type { JobState } from '@/api/pack-schema';
import type { DoneResponse } from '@/types/pack-contract';

const navState = useLocation().state as { jobId?: string; idToType?: Map<string,string> } | null;
const jobId = navState?.jobId;
const done = jobId ? queryClient.getQueryData<JobState>(['job', jobId]) : undefined;

useEffect(() => {
  if (!done || done.status !== 'done') navigate('/', { replace: true });
}, [done, navigate]);
if (!done || done.status !== 'done') return null;

const view = useMemo(() => mapDoneResponse(done as unknown as DoneResponse, navState?.idToType), [done]);
```
⚠ **A1 / Open Q1 (planner must confirm before casting):** the cache holds a `JobState` (`pack-schema.ts` line 41–47: `{ job_id, status, result: unknown }`). `result` is `z.unknown().nullish()` — so `done.result` IS the `DoneResult` body but is typed `unknown`. `mapDoneResponse` expects a `DoneResponse` (`{ job_id, status, result }`, `pack-contract.ts` 134–138). The top-level envelope matches; only `result` needs the cast. The e2e fulfils `{ status:'done', result: packDoneResponse.result }` confirming the `result` field shape.

**Add selected-pallet + hover state** (new — drives canvas, overlay sub-line, placement list, switcher; D-01/D-03):
```tsx
const [sel, setSel] = useState(0);              // default index 0 (D-05)
const [hoveredId, setHoveredId] = useState<string | null>(null);
const selPallet = done.result.pallets[sel];     // PalletResult — has dimensions (A2/A3: read footprint here, NOT from MappedPallet)
const palette = useMemo(() => buildPalette(done.result as ...), [done]);  // whole-result palette (Pitfall 5)
```

**Layout:** wrap the existing `<div style={{position:relative…}}>` viewer in a CSS grid `viewer 1fr | rail 384px`, stacking below 900px (D-08). The rail is plain DOM inside this lazy subtree (C-04 — fine, no `three` import in the rail components).

**Security (V5 / threat):** render all API strings (`reason`, `item_id`, `pallet_id`) as React text children only — never `dangerouslySetInnerHTML` (mirrors `ErrorCard` escaped-text rule).

---

### `src/routes/LoadingPage.tsx` (MODIFY — carry `{ jobId, idToType }` on `done` nav)

**Analog:** itself.

**Change the stateless done-navigation** (current lines 132–134):
```tsx
useEffect(() => {
  if (!cancelled && status === 'done') navigate('/result', { replace: true });
}, [cancelled, status, navigate]);
```
**TO** (add the carrier — `jobId` from line 117, `idToType` from line 77):
```tsx
useEffect(() => {
  if (!cancelled && status === 'done' && jobId) {
    navigate('/result', { replace: true, state: { jobId, idToType } });
  }
}, [cancelled, status, jobId, idToType, navigate]);
```
This mirrors the existing `LoadingNavState` hand-off pattern Configure→Loading already uses (`isLoadingNavState` validator, lines 37–68, is the template for any `ResultPage` nav-state validation — note `idToType instanceof Map` check at line 66).

---

### `src/components/viewer/Boxes.tsx` (MODIFY — add hover emissive D-11 + heatmap D-10)

**Analog:** itself (lines 42–69).

**Current per-mesh material** (lines 59–66):
```tsx
<mesh key={b.id} position={b.center} castShadow receiveShadow>
  <boxGeometry args={b.size} />
  <meshStandardMaterial color={b.color} roughness={0.62} metalness={0.04} />
  <Edges><lineBasicMaterial color={edgeTint(b.color)} transparent opacity={0.55} /></Edges>
</mesh>
```

**EXTEND props** (current `BoxesProps`, lines 31–35) with `hoveredId?: string | null` and `heatmap?: boolean`; decouple from `PalletResult` to take `items` + `dimensions` explicitly (Pattern 4 — `MappedPallet` lacks `dimensions`; pass `selPallet.dimensions` from the cached `PalletResult`).

**Hover (D-11)** — declarative emissive, NO imperative `material.emissive.set()`:
```tsx
<meshStandardMaterial
  color={color} emissive={color}
  emissiveIntensity={hoveredId === b.id ? 0.45 : 0}
  roughness={0.62} metalness={0.04}
/>
```

**Heatmap (D-10)** — colour selection in the `useMemo` (lines 43–54):
```tsx
const color = heatmap ? supportColor(item.support_ratio) : (palette.get(typeKey) ?? '#888888');
```
Reuse `typeKeyOf` / `mapPlacement` / `assertWithinEnvelope` exactly as today (lines 46–49). ⚠ all `three` imports stay in this lazy subtree.

---

### `src/components/viewer/ViewerOverlay.tsx` (MODIFY — computed sub-line + CoG/heatmap toggles)

**Analog:** itself (lines 24–89).

**Add a `subline` prop** and render it under the dims tag (after the header block, lines 28–35). Copy:
`{N} boxes placed · {fill}% fill · {kg} kg` (UI-SPEC line 145; per-selected-pallet, D-03), mono `text-xs text-[var(--color-d-text-2)]`.

**Add CoG + Support-heatmap toggles** — reuse the EXISTING preset-button styling (lines 67–86) for the dark-overlay "on/off" look (`rgba(99,90,245,0.32)` active fill); accessible name from the visible label, `aria-pressed` reflects state. Default CoG ON, heatmap OFF (Open Q2). Legend (lines 38–50) swaps to a support-scale key when heatmap is ON.

---

### `src/lib/result-summary.ts` (CREATE — pure whole-job + per-pallet aggregation, RESULT-03)

**Analog:** `src/lib/config-tally.ts` (the exact shape: module-header comment stating "imports NOTHING at runtime … stays outside the lazy /result chunk", a named exported result interface, a single pure reducer, NaN-safety).

**Module header to copy** (`config-tally.ts` lines 1–6) — keep the "no `three`, no React, no IO" / code-split rationale (C-04).

**Reducer pattern** (mirror `tallyCatalog`, lines 31–46):
```ts
import type { ResultView } from './result-mapper';
export interface JobSummary {
  palletsUsed: number; maxPallets?: number;
  utilisationPct: number; unpacked: number; totalItems: number; totalWeightKg: number;
}
export function summarise(view: ResultView, maxPallets?: number): JobSummary {
  const s = view.summary;
  return {
    palletsUsed: s.pallets_used, maxPallets,
    utilisationPct: s.total_volume_utilisation * 100,
    unpacked: s.items_unpacked, totalItems: s.items_packed + s.items_unpacked,
    totalWeightKg: view.pallets.reduce((kg, p) => kg + p.totalWeight, 0),
  };
}
```

**Co-located golden test** — `src/lib/result-summary.test.ts`, copy `config-tally.test.ts` wiring (lines 1–9): `@/` alias, jsdom-WebGL-free, literal expectations. Golden values (fixture): `palletsUsed 2`, `utilisationPct 72.81`, `unpacked 7 / 38`, `totalWeightKg 211`.

---

### `src/lib/cog-map.ts` (CREATE — pure CoG POINT → three-space, golden-tested, DIAG-01)

**Analog:** `src/lib/mapping.ts` `mapPlacement` (lines 36–49) — same recentre + deckTop math, **minus the half-dimension terms** (a CoG is already a centre point).

**Reuse `DECK_TOP_Y`** — export it FROM `mapping.ts` (currently a private const at line 19) and import it here, so marker and boxes share one deck height (RESEARCH Pattern 2 warning).

**Empirically-confirmed transform** (up-axis = `cog.z`, proven this session against both fixture pallets):
```ts
import type { Cog, PalletDims } from '@/types/pack-contract';
import { DECK_TOP_Y } from './mapping';
export function mapCog(cog: Cog, pallet: Pick<PalletDims,'L'|'W'>): [number, number, number] {
  return [
    cog.x - pallet.L / 2,   // x: recentre (API length → three x)
    DECK_TOP_Y + cog.z,     // y (up): deck top + API height (cog.z is UP, NO half-dim)
    cog.y - pallet.W / 2,   // z: API width → three z, recentred
  ];
}
```
**Golden test** — `src/lib/cog-map.test.ts`, copy `mapping.test.ts` wiring (lines 1–9): import the fixture, assert both pallets' mapped CoG against hand-computed LITERALS (mapping.test.ts lines 17–22 are the template — "Literal numbers NOT re-derived from the formula so a formula bug fails loudly"). ⚠ Do NOT route `cog` through `mapPlacement` (it adds spurious `L/2`/`H/2`).

---

### `src/lib/support-scale.ts` (CREATE — pure support_ratio → bucket + colour, DIAG-02)

**Analog:** `src/lib/palette.ts` (pure deterministic colour map, hex helpers `hexToHsl`/`hslToHex` lines 36–86 are directly reusable for a perceptual scale) + `config-tally.ts` (pure-module header / co-located test).

**Shape:**
```ts
// header: pure, no three/React/IO — stays outside the lazy chunk (copy config-tally.ts 1–6)
export function supportColor(ratio: number): string { /* bucket ratio∈[0,1] → ordered hex */ }
```
Scale must be perceptually ordered and colour-blind-considerate (UI-SPEC line 132 — NOT pure red/green; paired with the always-shown numeric `support N%`).

**⚠ Test-design constraint (Pitfall 4, critical):** every fixture `support_ratio` is exactly `1.0`. The golden test (`src/lib/support-scale.test.ts`) MUST use **synthetic** ratios `[1.0, 0.8, 0.5, 0.2, 0]` asserting distinct buckets/colours; the fixture can only smoke-assert "all boxes → top bucket."

---

### `src/components/viewer/CogMarker.tsx` (CREATE — r3f marker, lazy chunk)

**Analog:** `src/components/viewer/Boxes.tsx` (the `mesh` + `<geometry>` + `<meshStandardMaterial>` + drei import pattern, lines 13–17, 56–67).

```tsx
import { Line } from '@react-three/drei';           // mirror Boxes' `import { Edges }`
import { mapCog, DECK_TOP_Y } from '@/lib/cog-map';
export function CogMarker({ cog, palletL, palletW }: { cog: Cog; palletL: number; palletW: number }) {
  const [x, y, z] = mapCog(cog, { L: palletL, W: palletW });
  return (
    <group>
      <mesh position={[x, y, z]}><sphereGeometry args={[14, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.6} /></mesh>
      <Line points={[[x, DECK_TOP_Y, z], [x, y, z]]} color="#fff" lineWidth={1} dashed />
    </group>
  );
}
```
⚠ drei `<Line>` v10 (A4) — fallback to plain `<line>` + `BufferGeometry` if API differs. All `three`/drei imports stay in the lazy subtree.

---

### `src/components/result/SummaryBlock.tsx` (CREATE — whole-job 2×2 stats, RESULT-03)

**Analogs:** `src/components/Card.tsx` (rail-block chrome) + the `LoadingPage` stat `<dl>` grid (lines 244–269) for the stat-cell shape (mono tabular value + uppercase label).

**Block chrome** — reuse `SectionLabel.tsx` (the mono uppercase `Summary` label with accent dot) and the `Card.tsx` surface/border/radius tokens. **Stat cell** (copy `LoadingPage.tsx` 245–252): `font-mono … tabular-nums` value, `text-[9.5px] uppercase tracking … text-text-3` `dt`. Feed from `summarise(view)` (`result-summary.ts`). Utilisation cell adds the accent fill bar (UI-SPEC named constant: 4px / max 120px). 1-decimal for util + weight, integers for counts.

---

### `src/components/result/PalletSwitcher.tsx` (CREATE — select group, RESULT-04)

**Analogs:** `src/features/config/BoxCatalogCard.tsx` (the list-of-rows-in-a-block pattern, lines 56–82) + `src/components/Switch.tsx` (the accessible `role`/`aria` + keyboard pattern, lines 50–66) for the single-select group semantics.

**Each row is a `<button>`** with `aria-pressed`/`aria-current` (exactly one selected), keyboard-navigable (Switch.tsx `handleKeyDown` lines 43–48 is the template). Selected row uses `--accent` border + `--accent-weak` bg + filled index chip (non-colour-only cue — UI-SPEC a11y). Row content: index chip + `{palletLabel}` (from `PalletResult.pallet_id`, fallback `Pallet N`, D-05) + mono `{boxes} boxes · {kg} kg` + neutral mini fill bar (D-04 — NEVER amber). `onClick` → `setSel(i)` in `ResultPage`.

---

### `src/components/result/PlacementList.tsx` (CREATE — per-pallet cards + hover, RESULT-05)

**Analog:** `src/features/config/BoxRow.tsx` — the swatch + id-tag + multi-field-grid card is the exact visual template.

**Reusable excerpts from `BoxRow.tsx`:**
- **Swatch** (lines 85–89): `colorForType(allIds).get(id)` 13×13 rounded swatch — here keyed by `item.typeId`, shared `colorForType` map.
- **id-tag** (lines 95–97): mono `text-[10.5px]` bordered pill for `{item_id}`.
- **field grid** (lines 128–137): the `grid grid-cols-3 gap-7` mono cells — here for `Size L·W·H`, `Position x,y,z`, and the NEW `Support {support_ratio×100}%` (UI-SPEC line 154, always shown).

**Hover (D-11)** — each card `onMouseEnter={() => setHoveredId(item.item_id)}` / `onMouseLeave={() => setHoveredId(null)}`; hovered card gets `--accent` border + `--accent-weak` bg. Cards iterate `selPallet.items` (`PlacementOut & {typeId}`). Placement note (UI-SPEC 153): `positions are box min-corner · mm · origin = pallet corner` (corrected from mockup "box-centre", C-01).

**Test:** RTL DOM test asserts `onMouseEnter`/`Leave` set state + every datum rendered (the WebGL emissive is Playwright-only, never jsdom).

---

### `src/components/result/UnpackedPanel.tsx` (CREATE — conditional whole-job panel, RESULT-06)

**Analogs:** `src/features/config/BoxRow.tsx` head row (swatch + id + meta, lines 84–117) + `Card.tsx` block chrome + `BoxCatalogCard.tsx` empty-state (lines 59–65).

**Conditional** (D-06): render the block ONLY when `view.unpacked.length > 0` (`SectionLabel` `Could not pack` + right mono count). Each row: mono `{item_id}` + recovered `{type}` (`idToType ?? typeKeyOf`) + dims `{l}·{w}·{h} mm` + `{weight} kg` + **`{reason}`** (rendered as PLAIN TEXT — V5 XSS rule). Non-interactive (no mesh). When `unpacked.length === 0`, show inline `All items packed ✓` using the NEW `--color-pos` token. Whole-job scope — does NOT change on pallet switch.

---

## Shared Patterns

### Pure-lib + code-split discipline (C-04)
**Source:** `src/lib/config-tally.ts` (lines 1–6 header), `scripts/check-code-split.mjs` (the build gate).
**Apply to:** all three new `src/lib/` modules (`result-summary`, `cog-map`, `support-scale`).
Copy the header rationale: "imports NOTHING at runtime (no `three`, no React, no IO)". `three` may be imported **type-only** at most. Each gets a co-located `*.test.ts` (jsdom, `@/` alias, literal golden expectations).

### Type recovery (C-03)
**Source:** `src/lib/result-mapper.ts` `mapDoneResponse` (lines 55–56) → `recoverType = idToType?.get(id) ?? typeKeyOf(id)`.
**Apply to:** the `ResultPage` mapper call (pass `navState.idToType`) and `UnpackedPanel` type recovery. Already golden-tested — do NOT re-derive id parsing. ⚠ Pitfall 1: if `idToType` is dropped, recovery silently falls back to `typeKeyOf` (works for fixture `T/D/F` ids, mislabels real ids).

### Shared palette (D-09)
**Source:** `src/lib/palette.ts` `colorForType` + `src/components/viewer/Boxes.tsx` `buildPalette` (lines 24–29).
**Apply to:** legend, box tint, placement swatch, switcher swatch — ONE map. Build from the WHOLE result (`buildPalette(done.result)`) so the legend is stable across pallet switches (Pitfall 5).

### Card / SectionLabel rail chrome
**Source:** `src/components/Card.tsx`, `src/components/SectionLabel.tsx` (both: "imports ONLY React + clsx — never three/r3f/drei").
**Apply to:** all four `src/components/result/*` blocks. Tokens: `--radius-lg`, `border-border`, `bg-surface`, `--shadow`, `--card-body-padding`, `--accent-weak` (#ecebfd), `--accent-text` (#4338ca). Port the two NEW tokens only: `--color-pos: #16a34a`, `--color-warn: #d97706` (warn ported but UNUSED, D-04).

### Accessible toggle / select
**Source:** `src/components/Switch.tsx` (lines 50–66: `role`, `aria-checked`, keyboard, non-colour cue).
**Apply to:** `PalletSwitcher` rows (`aria-pressed` single-select), CoG/heatmap overlay toggles (`role="switch"`/`aria-pressed`).

### Carrier seam (C-02)
**Source:** `src/api/queryClient.ts` (the production singleton), `src/api/usePollJob.ts` (lines 103–117: `queryKey ['job', jobId]`, `gcTime: Infinity`), `src/routes/LoadingPage.tsx` (nav-state read + `isLoadingNavState` validator + redirect-on-invalid).
**Apply to:** `ResultPage` cache read + redirect, `LoadingPage` done-nav state. `getQueryData(['job', jobId])` is the one-shot read (job already settled). Validate `idToType instanceof Map` (LoadingPage line 66) before use.

---

## No Analog Found

None. Every new file has a strong in-repo analog. The closest thing to "net-new" is `UnpackedPanel.tsx` (the mockup has no unpacked panel), but it is fully composed from existing `BoxRow`/`Card`/`SectionLabel` primitives styled to match.

## Metadata

**Analog search scope:** `src/lib/`, `src/components/`, `src/components/viewer/`, `src/features/config/`, `src/features/loading/`, `src/routes/`, `src/api/`, `src/types/`.
**Files scanned:** 22 read in full or in part.
**Key empirical facts carried from RESEARCH (already verified against `src/lib/__fixtures__/pack-done-response.json`):** CoG up-axis = `cog.z`; max pallet = 19 boxes (no InstancedMesh, D-12); all `support_ratio` = 1.0 (heatmap test needs synthetic input); cached `done` `result` field IS `DoneResult` but typed `unknown` in `JobState` (cast needed).
**Pattern extraction date:** 2026-06-05

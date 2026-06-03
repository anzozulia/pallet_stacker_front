# Pitfalls Research

**Domain:** Self-hostable React + Vite + TS SPA rendering an async packing API's result in react-three-fiber (Three.js)
**Researched:** 2026-06-03
**Confidence:** HIGH (coordinate mapping verified against `design/result.html`; R3F lifecycle + instancing verified against pmndrs docs/issues; async + CORS + Docker from established practice)

This catalog is deliberately domain-specific. Generic web advice (XSS, input validation) is omitted except where it interacts with this app's stack. The single highest risk is coordinate-system / orientation mapping — it is covered first and in depth.

---

## Critical Pitfalls

### Pitfall 1: Coordinate-system & orientation mapping (THE #1 RISK)

**What goes wrong:**
Boxes render in the wrong place — floating above the deck, sunk into it, overlapping each other, off the pallet edge, or rotated wrong so a "tall" box lies flat. The 3D scene looks plausible at a glance (it's just cubes) but every placement is subtly or grossly wrong, and *nobody can tell from the render alone* because there's no ground-truth to compare against. This is the most dangerous class of bug because it is silent.

**Why it happens:**
Three coordinate conventions must be reconciled, and they disagree on which axis is "up":

| Concept | Packing API | Three.js |
|---------|-------------|----------|
| Up axis | **z** = height | **y** = up |
| Origin | pallet **corner** (0,0,0) | scene centre (configurable) |
| Position meaning | **box centre** | mesh `position` = object centre (matches!) |
| Floor axes | x (length), y (width) | x, **z** |

So the mapping is an axis swap **plus** a recentre, not a copy. The reference mockup (`design/result.html:322-330`) shows the intended convention precisely:

```js
const geo = new THREE.BoxGeometry(b.l, b.h, b.w);   // L→x, H→y, W→z
m.position.set(
  b.x - PL.L/2,                 // API x  →  three x, recentred on pallet length
  deckTopY + (b.base||0) + b.h/2,  // height → three y
  b.y - PL.W/2                  // API y  →  three z, recentred on pallet width
);
```

Three traps live inside that one mapping:

1. **The mockup CHEATS on height and the real app must NOT copy it.** The mockup computes y from `deckTopY + base + h/2` because its demo data only has floor x,y and a manual `base`. The **real API returns `position.z` as the box-centre height directly** — so the real code must use `position.z` (plus the deck-top offset, if you model the physical pallet) and must **not** recompute height from a per-box `base`. Porting the mockup's height formula verbatim is a guaranteed bug.

2. **Origin convention: centre vs corner.** API position is the box *centre* (the mockup's rail even prints "positions are box-centre"). Three.js `mesh.position` is also the object centre — so these align and you must **not** add `+dimension/2`. If a developer assumes the API gives a corner (a very common packing-API convention elsewhere), they'll add half-dimension and every box shifts by half its size → systematic overlap on one side and a gap on the other. **Verify against the real API which convention it uses before writing the mapping** — do not assume.

3. **Orientation (`orientation.perm`) drives which dimension goes on which axis.** `orientation.perm` is a permutation of the box's L/W/H telling you the box's *placed* footprint. The mesh geometry must be built from the **permuted** dimensions, not the catalog's original L/W/H. If you build `BoxGeometry(origL, origH, origW)` while the box was placed rotated 90°, the rendered box won't match its real footprint → it overlaps neighbours and floats/sinks because its height is wrong. The `support_ratio` and `cog` the API returns assume the *placed* (permuted) dimensions; the render must too.

**How to avoid:**
- Build a **single, pure, unit-tested mapping function** `apiToThree(item, pallet) -> {position: Vec3, size: Vec3, quaternion/euler}` and never inline coordinate math in components. One place to get right, one place to fix.
- **Derive placed dimensions from `orientation.perm`**, not from the catalog. Treat `dimensions{L,W,H}` in the result as already-permuted if the API does that; confirm which it is against a real response before coding.
- Write **golden-value unit tests** from a real captured API response: assert exact `position`/`size` for a known item. This is the only reliable detector — visual inspection is not.
- Render **debug aids in dev**: pallet bounding box wireframe, axis helper (`AxesHelper`), and a toggle that draws each box's centre as a small sphere. A box centre outside the pallet AABB or below the deck is an instant red flag.
- Add a **sanity assertion**: for every item, `position ± size/2` must lie within the pallet bounding volume (allowing the configured overhang). Log violations in dev.
- Confirm `orientation.name` semantics with the API maintainer (you control the API — `packerapi.anzozulia.xyz`) so the rotation tag shown in the placement list matches the geometry.

**Warning signs:**
- Boxes float above or clip into the deck → height/origin or `base` bug.
- Adjacent boxes intersect → half-dimension (centre vs corner) error, or wrong `perm`.
- The whole stack is offset from the pallet centre → recentre (`-PL.L/2` / `-PL.W/2`) missing or applied to the wrong axis.
- A box's proportions look wrong (a flat tray standing tall) → `perm` not applied to geometry.
- `support_ratio` says "fully supported" but the render shows a gap → axis swap inconsistency between height source and footprint.

**Phase to address:**
The phase that builds the 3D viewer / result rendering. Make the mapping function + golden tests an **explicit success criterion** of that phase. Flag this phase for deeper, response-shape-specific research before implementation.

---

### Pitfall 2: Runaway / leaking polling loops

**What goes wrong:**
The submit-then-poll flow (`POST /pack` → `GET /jobs/{id}` until terminal) spawns a `setInterval`/recursive timeout that: never stops on `done`/`failed`/`timeout`; keeps running after the user navigates away or the component unmounts; or accumulates multiple concurrent pollers when the user re-submits. Symptoms range from a wasted-bandwidth background loop to the API being hammered, to React state updates on unmounted components, to stale results overwriting fresh ones.

**Why it happens:**
The loading mockup (`design/loading.html`) is **not real polling** — it cycles fake phase text and hands off after a fixed 6s `setTimeout`. There is no genuine progress signal from the API, so developers porting the mockup may underestimate the real polling machinery needed and bolt on a naive interval that lacks cleanup, backoff, and terminal-state handling.

**How to avoid:**
- Drive polling with an **`AbortController` + cleanup** tied to component lifecycle (or use TanStack Query's `refetchInterval` which cancels automatically on unmount). Every poll request must be abortable.
- Treat **all four terminal states explicitly**: `done`, `failed`, `timeout`, and "items unpacked" (a *successful* response that still leaves boxes unplaced — not an error). Stop polling on any terminal state.
- **Cancel-and-restart on re-submit:** when the user edits config and submits again, abort the in-flight poller and discard its results before starting the new job. Key the result to the current `job_id` so a late response from an old job can't overwrite the new one (guard: `if (responseJobId !== currentJobId) return`).
- Add **backoff + a hard cap**: poll, say, every 1–2s with mild backoff and an absolute wall-clock timeout (e.g. abort after N seconds) so a stuck job doesn't poll forever.
- Never set state after unmount: the cleanup function must clear the timer/abort the request.

**Warning signs:**
- Network tab shows `GET /jobs/...` continuing after leaving the result page.
- React warning about state update on unmounted component.
- Result flickers or shows an old layout briefly after re-submit (race).
- API logs show one client opening many concurrent polling sessions.

**Phase to address:**
The API-integration / submit-and-poll phase. Make "polling stops on every terminal state and on unmount, and re-submit cancels the previous job" an explicit acceptance test.

---

### Pitfall 3: CORS failure for self-hosters (build-time `VITE_API_URL`)

**What goes wrong:**
A self-hoster builds the image pointing `VITE_API_URL` at the public API (`packerapi.anzozulia.xyz`) and serves the SPA from their own origin (`http://their-host:8080`). Every request fails in the browser with a CORS error because the API doesn't list that origin in `Access-Control-Allow-Origin`. The app appears completely broken with a console error most self-hosters won't understand, even though the API is healthy.

**Why it happens:**
`VITE_API_URL` is baked at **build time** (Key Decision in PROJECT.md). In local dev a Vite proxy hides CORS (same-origin to the dev server), so it works on the developer's machine and breaks only for downstream self-hosters — the classic "works on my machine" trap. The dev proxy ↔ prod direct-call mismatch means CORS is never exercised during development.

**How to avoid:**
- **Document the CORS requirement prominently** in the self-hosting README: "the API you point at must allow your serving origin." Since you own the API, document how to add an origin to its allowlist.
- Provide a **clear in-app error state** that distinguishes CORS/network failure ("can't reach the API — check VITE_API_URL and that the API allows this origin") from API errors (job `failed`). A bare console error is unacceptable UX.
- Hit **`GET /api/v1/health`** on load (or on first failure) to detect reachability and surface a precise message.
- Consider an **optional runtime config** escape hatch (e.g. a small `config.json` fetched at runtime, or an nginx reverse-proxy recipe in the docs) so self-hosters can repoint without rebuilding and can proxy to sidestep CORS entirely. PROJECT.md chose build-time on purpose, but ship the nginx-proxy recipe as the documented CORS workaround.
- In CI/local, add a check that exercises a real cross-origin call (not just the proxy) at least once.

**Warning signs:**
- App works in `npm run dev` but a built/served bundle shows `blocked by CORS policy` in console.
- Self-hoster issues on GitHub: "blank result / nothing happens."
- Requests show as `(failed)` with no response in the Network tab from the built app only.

**Phase to address:**
The API-integration phase (error states) and the Docker/self-hosting phase (docs + nginx proxy recipe). Verify by building the image and serving it from a *different* origin than the API.

---

### Pitfall 4: WebGL context & resource leaks on unmount / navigation

**What goes wrong:**
Navigating between Configure → Loading → Result (and back to edit) mounts/unmounts the canvas repeatedly. Geometries, materials, edge-line segments, and the WebGL context aren't released, so memory climbs and eventually the browser throws `Too many active WebGL contexts` (Safari caps low) or `CONTEXT_LOST_WEBGL`, and the viewer goes blank. The mockup (`design/result.html`) has **zero disposal** — it's a single static page that never unmounts, so copying its setup into a routed SPA inherits a leak.

**Why it happens:**
R3F disposes objects in the managed scene graph automatically, **but only resources it created and that are mounted as JSX**. Manually-created geometries/materials, anything cached, `EdgesGeometry`/`LineBasicMaterial` made outside JSX, and resources allocated in `useEffect` are *not* auto-disposed. React Strict Mode (dev) double-invokes effects, surfacing leaks as dev-only context loss that developers wrongly dismiss as "just Strict Mode."

**How to avoid:**
- **Keep one `<Canvas>` instance** for the app and swap its *contents*, rather than mounting/unmounting a canvas per route. pmndrs explicitly recommends this — there's a fixed budget of WebGL contexts.
- Express geometry/material as **JSX** (`<boxGeometry/>`, `<meshStandardMaterial/>`) so R3F owns disposal; for anything created imperatively in `useEffect`, **dispose it in the cleanup return**.
- Reuse shared geometry/material across boxes of the same type (also a perf win) instead of `new BoxGeometry` per box.
- Test by **mounting/unmounting the viewer many times** (toggle routes 20–30×) while watching `renderer.info.memory` (geometries/textures counts) — they should plateau, not grow.
- Don't dismiss dev-only context loss; treat it as a real cleanup gap exposed by Strict Mode.

**Warning signs:**
- `renderer.info.memory.geometries` / `.textures` climbs every time you visit the result page.
- `THREE.WebGLRenderer: Context Lost` after several navigations (esp. Safari).
- Viewer renders fine the first time, blank on the third or fourth visit.
- Heap growth in DevTools memory profiler across mount/unmount cycles.

**Phase to address:**
The 3D viewer phase. Add a "mount/unmount stress check, memory plateaus" success criterion.

---

### Pitfall 5: Quantity expansion explosion

**What goes wrong:**
The catalog groups boxes by type + quantity; the API wants individual boxes with unique IDs (PROJECT.md "Quantity gap"). A user enters "5000" for a type and the client expands it into 5000 objects → a huge request payload, slow/blocked submit, and then a result the viewer tries to render as 5000 individual meshes → frame rate collapses or the tab crashes. Mapping 5000 result items back to their type for coloring/listing with the wrong data structure is also O(n²).

**Why it happens:**
Expansion is conceptually trivial (`Array(qty).fill`) so guards get skipped. The render side naively creates one `<mesh>` per box (as the 12-box mockup does — fine for 12, fatal for 1000s). `max_pallets` and `time_budget_s` interact: a large quantity with a small `time_budget_s` may leave many items unpacked, and a small `max_pallets` caps how many fit — both produce large "unpacked" sets that still must be handled.

**How to avoid:**
- **Cap total expanded units** with a clear UI warning before submit (e.g. soft-warn at a few hundred, hard limit configurable). Show the computed total unit count live in the config UI so users see "168 units" before they hit submit.
- **Generate stable, deterministic IDs** (e.g. `${typeId}-${index}`) so results map back to types via a lookup `Map`, not a scan. Keep a `Map<boxId, type>` for O(1) result→type joins.
- **Use `InstancedMesh`** (one draw call for all boxes sharing a geometry/material) once box counts exceed ~100–200, instead of N individual meshes. pmndrs docs show instancing handling tens of thousands of boxes; individual meshes degrade because draw calls scale with count.
- Surface the **`time_budget_s` / `max_pallets` ↔ unpacked** relationship in the UI so a large unpacked count reads as "ran out of budget/pallets," not "the app is broken."
- Consider per-type color via instance color attributes so instancing still allows the legend/coloring.

**Warning signs:**
- Submit payload is multiple MB / request is slow or rejected.
- Frame rate drops sharply as box count rises; `renderer.info.render.calls` scales with box count.
- High "unpacked" numbers with no explanation in the UI.
- Result→type lookups visibly lag with large catalogs.

**Phase to address:**
Config/expansion phase (caps, stable IDs, live count) and viewer phase (instancing threshold). Verify with a stress config of hundreds–thousands of units.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Inline coordinate math in the mesh component | Fast to write | Mapping bug repeated everywhere, untestable, the #1 risk goes unguarded | **Never** — extract a pure `apiToThree` fn from day one |
| Copy the mockup's `base + h/2` height formula | Matches the demo visually | Ignores the API's real `position.z`; silently wrong on real data | Never — use the API's centre |
| One `<mesh>` per box | Simple, matches mockup | Frame-rate collapse at hundreds of units | OK only while box counts are demo-sized (<~100) |
| Naive `setInterval` poller, no cleanup | Quick to demo loading | Leaks, races on re-submit, hammers API | Never ship it; fine only in a throwaway spike |
| Build-time API URL with no runtime escape hatch | Simplest deploy (per PROJECT.md) | Self-hosters must rebuild to repoint; CORS surprises | Acceptable per project decision **if** docs + nginx proxy recipe ship alongside |
| Skip golden-value mapping tests | Faster phase completion | Coordinate regressions ship invisibly | Never for the viewer phase |
| Mount/unmount a `<Canvas>` per route | Natural React routing | WebGL context exhaustion, blank viewer | Avoid — keep one canvas, swap contents |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Pack API submit | Treating `POST /pack` as synchronous | It returns `202 {job_id}`; you must poll `GET /jobs/{id}` |
| Pack API poll | Treating "items unpacked" as an error | It's a *successful* terminal state with leftover boxes; render the placed ones + report unpacked |
| Pack API result | Assuming position = box corner | It's the box **centre** (the mockup rail says so); verify before adding half-dimensions |
| Pack API orientation | Rendering catalog L/W/H, ignoring `perm` | Build geometry from the **permuted** placed dimensions |
| CORS | Relying on the dev proxy, never testing cross-origin | Test the *built* bundle served from an origin the API doesn't yet allow |
| Health check | No reachability probe; bare console errors | Probe `GET /health`, distinguish "can't reach API" from "job failed" |
| API versioning | Hardcoding response shape from training/guess | Capture a **real** response and code/test against it; surface `GET /version` |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Individual meshes per box | FPS drops, `render.calls` = box count | `InstancedMesh` per type/geometry | ~hundreds of boxes |
| New geometry/material per box | Memory climbs, GC stutter | Share geometry/material across same-type boxes | Hundreds of boxes |
| Shadow maps + many casters | Frame-time spikes, fan spins | Single key shadow, modest `mapSize`, consider disabling shadows above a box threshold | Hundreds of shadow casters |
| Resize on every event without throttle | Layout jank during window resize | `ResizeObserver` (as mockup does) is fine; avoid per-frame `setSize` | Frequent resizes / split panes |
| Huge expansion payload | Slow/blocked submit | Cap units, warn before submit | Thousands of units |
| Polling with no backoff | API load, throttling | Backoff + hard timeout cap | Many concurrent users / stuck jobs |

## Security Mistakes

(Stateless client, no backend, no auth — surface area is small. Domain-relevant items only.)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting API response shape blindly | Malformed/hostile response crashes the viewer (e.g. NaN positions) | Validate/parse the response (e.g. Zod) at the boundary; clamp/reject NaN before feeding Three.js |
| Storing junk in localStorage without schema/version | Old config shape crashes after an app update | Version the localStorage schema; migrate or discard on mismatch |
| Loading `three` from a CDN at a floating version | Supply-chain / unexpected breaking change; possibly loading three twice | Bundle a pinned `three` via npm; never mix a CDN `three` with the bundled one |
| Exposing the build-time API URL as "secret" | It isn't secret — it's baked into the client bundle | Treat `VITE_API_URL` as public; never put secrets in `VITE_*` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing the 6-way rotation chips from the mockup | Implies control the API can't honor (it has 3 modes) | Mirror only `all` / `this_side_up` / `none` (PROJECT.md decision) |
| Showing a CoG *input* control | Users set a limit that's silently ignored | CoG is **output only**; present as a diagnostic, never an input |
| Fake/indeterminate progress copied from mockup | Cycling phase text implies real progress that doesn't exist | Honest indeterminate spinner + elapsed time; only show stages if the API truly reports them |
| Unit ambiguity (mm vs cm, kg vs lb) | Wrong-sized pallets, wrong placements | Label every field with units (mm/kg); enforce integer mm per PROJECT.md |
| Unformatted large numbers (e.g. `1200000` mm³) | Hard to scan, errors go unnoticed | Tabular-nums, thousands separators, sensible precision |
| Empty/partial result states unhandled | Blank viewer when 0 packed or all unpacked | Distinct UI for: nothing packed, some unpacked, multi-pallet with empty pallet |
| No "this many couldn't fit" explanation | "Unpacked: 3/168" looks like a bug | Explain it's budget/pallet/overhang-limited; link back to those settings |

## "Looks Done But Isn't" Checklist

- [ ] **3D viewer:** Looks right with demo data — verify against a **real API response** with golden-value position/size tests, and against orientation `perm` cases (a rotated box).
- [ ] **Coordinate mapping:** Renders without errors — verify every box centre lies within the pallet AABB + overhang, and sits *on* the deck (no float/sink).
- [ ] **Polling:** Shows a result — verify it **stops** on `done`/`failed`/`timeout`/unpacked, stops on unmount, and **cancels the old job** on re-submit.
- [ ] **Viewer lifecycle:** Works first visit — verify `renderer.info.memory` plateaus across 20+ mount/unmount cycles (no context loss).
- [ ] **CORS:** Works in `npm run dev` — verify the **built bundle served from a different origin** than the API actually loads results.
- [ ] **Docker SPA:** Home page serves — verify a **deep-link refresh** (e.g. `/result`) returns the SPA, not a 404, and that `.js`/`.wasm` MIME types are correct.
- [ ] **Quantity:** Works for 12 boxes — verify hundreds–thousands of units submit and render (instancing), with stable IDs mapping back to types.
- [ ] **Rotation/CoG UI:** Mockup chips present — verify only the 3 real rotation modes are shown and CoG is output-only.
- [ ] **localStorage:** Save/reload works — verify a schema-version bump doesn't crash on an old saved config.
- [ ] **Three.js:** Renders — verify `three` is loaded **once** (bundled, pinned), not also via CDN.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Coordinate mapping wrong | MEDIUM | Isolated `apiToThree` fn means one place to fix + golden tests to confirm; if math was inlined everywhere, HIGH |
| Polling leak/race shipped | MEDIUM | Refactor to AbortController/TanStack Query; add job-id guard; add unmount test |
| WebGL context exhaustion | MEDIUM | Switch to single persistent canvas; audit imperative resources for disposal |
| CORS breaks self-hosters | LOW | Ship nginx-proxy recipe + clear error message; no rebuild of app logic needed |
| Quantity explosion crashes viewer | MEDIUM | Add unit cap + instancing; retrofit stable-ID map |
| SPA 404 on refresh | LOW | Add server fallback to `index.html` (try_files / SPA flag) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Coordinate / orientation mapping | 3D Viewer / Result rendering | Golden-value unit tests from a real API response; AABB sanity assertion; rotated-box case |
| Runaway / leaking polling | API Integration (submit + poll) | Network shows polling stops on all terminal states + unmount; re-submit cancels prior job |
| CORS for self-hosters | API Integration (errors) + Docker/Self-host (docs) | Built bundle served from a different origin loads results; nginx recipe documented |
| WebGL resource leaks | 3D Viewer | `renderer.info.memory` plateaus over 20+ mount/unmount cycles; no context-loss |
| Quantity expansion explosion | Config/Expansion + 3D Viewer | Hundreds–thousands of units submit + render via instancing with stable IDs |
| Data-honesty UX (rotation/CoG/units) | Config UI | Only 3 rotation modes shown; CoG output-only; all fields unit-labeled |
| SPA routing / MIME on refresh | Docker / Self-host | Deep-link refresh returns SPA; correct Content-Type for JS/WASM |

## Sources

- `design/result.html` (lines 322–334) — authoritative coordinate convention, geometry order (`L,H,W`), centre-origin note, no-disposal demo pattern. HIGH.
- `design/loading.html` (lines 94–107) — fake/indeterminate progress, fixed-timeout hand-off (not real polling). HIGH.
- `.planning/PROJECT.md` — build-time `VITE_API_URL` + CORS consequence, async submit-then-poll, quantity gap, 3-mode rotation, CoG output-only, mm/kg units, single Docker image, stateless/localStorage. HIGH.
- [React Three Fiber — Scaling performance / instancing](https://r3f.docs.pmnd.rs/advanced/scaling-performance) — instancing collapses draw calls; individual meshes scale calls with count. HIGH.
- [pmndrs/react-three-fiber #2655 — dispose WebGLRenderer on unmount](https://github.com/pmndrs/react-three-fiber/issues/2655), [#3093 leaking on unmount](https://github.com/pmndrs/react-three-fiber/issues/3093), [discussion #2457 too many WebGL contexts (Safari)](https://github.com/pmndrs/react-three-fiber/discussions/2457), [discussion #723 context lost handling](https://github.com/pmndrs/react-three-fiber/discussions/723) — auto-disposal scope, force-context-loss on unmount, one-canvas recommendation, Strict Mode double-invoke. HIGH.
- [R3F — Objects, properties and args (dispose={null}, JSX-owned disposal)](https://r3f.docs.pmnd.rs/api/objects) — what R3F disposes automatically. HIGH.

---
*Pitfalls research for: self-hostable R3F SPA over an async packing API*
*Researched: 2026-06-03*

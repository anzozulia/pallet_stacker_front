# Feature Research

**Domain:** Pallet packing / cargo load-planning web tool (free, no-login, stateless frontend over an async packing API)
**Researched:** 2026-06-03
**Confidence:** HIGH (market features), HIGH (API mapping — derived directly from the PackRequest/PackResult contract in PROJECT.md)

## How To Read This

Every feature is tagged with **API support** relative to the fixed contract:

- **n/a** — pure client/UI, no API involvement
- **yes** — the contract already carries the data needed
- **partial** — the contract carries some of it; needs derivation or degrades gracefully
- **no** — the contract cannot support it; would require a backend change (out of scope)

The closest market analog to this product is **BoxFit** (free, no sign-up, in-browser, container + pallet, layer plan, CSV export). EasyCargo and 3DBinPacking are the paid feature-superset references — useful to mine for table stakes and to consciously *reject* the heavyweight features that make them paid SaaS.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these makes the tool feel broken or untrustworthy. All are already in v1 scope or are cheap additions that the design implies.

| Feature | Why Expected | API Support | Complexity | Notes |
|---------|--------------|-------------|------------|-------|
| Configure pallet envelope (L/W/H, max weight, max overhang) | Core input; every tool has it | yes (`pallet.*`) | LOW | Already in mockup. Mockup's "CoG envelope %" input must be **removed** — API has no CoG input (PROJECT out-of-scope). |
| Dynamic box catalog (add/remove types: dims, weight, qty) | Core input; the whole point | yes (`boxes[]`) | MEDIUM | Mockup done. Client expands qty → unique IDs before POST (known gap in PROJECT). |
| Per-box rotation control | Orientation constraints are a defining feature of packing tools | yes (`rotations`) | LOW | **Must simplify** mockup's 6 chips → API's 3 modes (`all`/`this_side_up`/`none`). PROJECT decision. |
| Per-box "max load on top" / fragile | Stacking safety is expected; fragile = a common real concern | yes (`max_load_on_top`) | LOW | Fragile flag is UI sugar → sets `max_load_on_top: 0`. Mockup already wires this. |
| Submit → loading state → result | Async job model; user must see progress not a frozen button | n/a (poll loop) | MEDIUM | Submit-then-poll per API. Mockup `loading.html` exists. Needs timeout/failed handling. |
| 3D result viewer with orbit/zoom/pan | The headline deliverable of every load-planner | yes (item position/dims/orientation) | MEDIUM-HIGH | r3f + drei. Mockup is the spec. Camera presets ISO/TOP/FRONT included. |
| Summary stats (pallets used, utilisation, packed/unpacked, weight) | Users need the "did it fit, how well" answer at a glance | yes (`input_summary`, per-pallet `utilisation`/`total_weight`) | LOW | Mockup rail done. |
| Multi-pallet switcher | Real loads overflow one pallet; must navigate them | yes (`pallets[]`, `options.max_pallets`) | MEDIUM | Mockup rail done. Switch swaps the 3D scene. |
| Per-box placement list (id, type, position, orientation, weight) | Verifies/communicates the plan; bridges to physical loading | yes (per-item fields) | LOW | Mockup cards done. Hover ↔ mesh highlight is a nice touch already prototyped. |
| Unpacked items with reasons | Trust killer if absent — "why didn't my stuff fit?" | yes (`unpacked_items[].reason`) | LOW | Surface reason verbatim + plain-language mapping. Mockup under-shows this; **must add a dedicated panel.** |
| Save/reload config locally | A refresh losing all input is unacceptable for a form this heavy | n/a (localStorage) | LOW-MEDIUM | In v1 scope. Autosave draft + explicit restore. |
| Export result (JSON + printable report) | Plans must leave the screen — handed to warehouse / archived | yes (serialize PackResult) | LOW (JSON) / MEDIUM (print) | In v1 scope. JSON = trivial dump. Printable = print-stylesheet route. |
| Graceful API failure / timeout messaging | Async job *will* sometimes fail/timeout | yes (`status: failed/timeout`) | LOW | In v1 scope. Clear, actionable copy. |
| Input validation (positive ints, box ≤ pallet, required fields) | Prevent garbage submissions and confusing API errors | n/a (client) | LOW-MEDIUM | Pre-flight: warn if a box can't fit any orientation; block submit on invalid. |
| Stability diagnostics surfaced (CoG, support ratio) | API returns it; load safety is a real user concern | yes (`cog`, `support_ratio`, `supported_by`) | MEDIUM | In v1 scope. Show CoG marker in 3D + per-box support ratio. Don't over-engineer. |

### Differentiators (Competitive Advantage)

Optional, high-value, low-coupling. Most map cleanly to data the API already returns — that is the edge: a *free* tool exposing diagnostics that paid tools gate behind subscriptions.

| Feature | Value Proposition | API Support | Complexity | Notes |
|---------|-------------------|-------------|------------|-------|
| Standard pallet presets (EUR 1200×800, GMA/US 1219×1016, etc.) | One-click correct setup; removes the #1 data-entry error | n/a (client constants) | LOW | Universal in market tools. High value, near-zero cost. Strong v1 candidate. |
| 2D top-down / layer view | Warehouse staff load by layer; flat plan is often more usable than 3D | partial (derive from x/y/z + dims) | MEDIUM | Derive layers by z-base. EasyCargo/BoxFit both ship this. Best post-v1 differentiator. |
| Step-by-step load sequence (play through placements) | Tells *order* to load; reduces re-handling | partial (needs a sequence) | MEDIUM-HIGH | API returns placements but **no explicit load order** — must infer (e.g. z then x/y). Flag as ASSUMPTION; verify order is physically sane before shipping. |
| CoG visualised in 3D (marker + offset-from-centre %) | Turns a number into an at-a-glance safety check | yes (`cog{x,y,z}`) | LOW-MEDIUM | Render a marker; colour if offset beyond a UI threshold. Pure presentation. |
| Support-ratio / unstable-box highlighting | Flags boxes likely to topple; safety story competitors charge for | yes (`support_ratio`, `supported_by`) | MEDIUM | Tint under-supported meshes; list "low support" items. Differentiates on the data we already have. |
| Image / PNG export of the 3D view | Drop a picture into an email/WhatsApp to the dock | n/a (canvas → PNG) | LOW | `renderer` snapshot. Trivial with r3f/Three. High shareability value. |
| PDF packing-list / load report | The artifact warehouses actually print and carry | yes (compose from result) | MEDIUM | A print-CSS route covers most of this cheaply; a true PDF lib is heavier. Start with print route. |
| CSV export of placements / CSV import of box catalog | Spreadsheet round-trip is the lingua franca of logistics | yes (placements) / n/a (parse) | LOW-MEDIUM | Export trivial. **Import** is the higher-value half — bulk box entry beats hand-typing 20 SKUs. |
| Share-by-URL (encode config in link, no backend) | Stateless sharing without accounts; fits the no-login ethos | n/a (encode to URL hash) | MEDIUM | Encode *config* (small) in the URL; not the result (large). Re-runs on open. Differentiator unique to a stateless tool. |
| Duplicate box type | Catalogs of near-identical SKUs are common | n/a (client) | LOW | Tiny add to the catalog UI; big ergonomic win. |
| Colour legend + colour-by-type in 3D | Reading a multi-SKU pallet is impossible without it | n/a (client) | LOW | Mockup already does this. Keep. |
| Per-pallet "warning" badge (overhang/weight/instability) | Directs attention to the problem pallet in a multi-pallet result | partial (derive from result) | MEDIUM | Mockup hints at `.warn` rows. Derive from utilisation/weight/support. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that look reasonable but break the lean, stateless, no-login, frontend-only framing. Documented to prevent scope creep.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / saved-job history (server-side) | "I want my pallets next time" | Requires a backend, auth, DB — kills stateless self-hostability; explicit PROJECT out-of-scope | localStorage config + share-by-URL; architect cleanly so accounts *can* be added later |
| Units toggle (mm/in switching) | US users think in inches | API contract is mm/kg only; runtime conversion adds rounding bugs and state for marginal benefit in v1 | mm/kg labelled clearly; revisit if real US demand appears. Presets cover the common US pallet sizes. |
| Manual drag-and-drop placement editor | EasyCargo's flagship paid feature; "let me tweak it" | The frontend never computes placements (PROJECT) — overriding the solver means re-validating physics client-side. Huge scope, contradicts "the API owns packing." | Adjust *inputs* (rotation/group/constraints) and re-run. Cheaper, honest, keeps the solver authoritative. |
| 6-way granular rotation chips | Mockup shows 6; feels more powerful | API only honours 3 modes — UI would promise control it can't deliver | Mirror the 3 real modes (`all`/`this_side_up`/`none`). Already a PROJECT decision. |
| CoG envelope as an *input* constraint | Mockup has a "CoG envelope %" field | API accepts no CoG limit — the field would silently do nothing | Surface CoG as an *output* diagnostic only. Remove the input field. PROJECT out-of-scope. |
| Container/truck loading + axle-load calc | Adjacent domain; competitors bundle it | Different envelope semantics + axle physics the API doesn't model; scope explosion | Stay focused on pallets. Container support is a possible *future* product, not a v1 feature. |
| Irregular / cylindrical / non-box shapes | "My goods aren't all boxes" | API contract is rectangular boxes only | Box-only, stated plainly. Out of contract. |
| Real-time collaborative editing / multi-user | "My team plans together" | Needs a backend, presence, conflict resolution — antithetical to stateless tool | Share-by-URL hands off a config; that's enough. |
| Cost / freight-rate optimisation | "Tell me the cheapest load" | Pricing data + business logic far outside a packing visualiser | Out of scope. Report volume/weight; let the user price it. |
| Auto-generated barcode/label printing per box | Warehouses label cartons | Belongs to a WMS, not a load planner; printing infra + label standards | Export a packing list (CSV/PDF); let the WMS print. |

## Feature Dependencies

```
Pallet config ─┐
Box catalog  ──┼──requires──> Submit (qty-expansion) ──> Poll ──> PackResult
               │                                                     │
Rotation/      │                                                     ├──> 3D viewer ──enhances──> CoG marker
constraints ───┘                                                     │                       └─> support highlight
                                                                     ├──> Summary stats
Presets ──enhances──> Pallet config                                  ├──> Multi-pallet switcher ──drives──> 3D viewer
Duplicate ──enhances──> Box catalog                                  ├──> Placement list ──pairs──> 3D hover-highlight
CSV import ──enhances──> Box catalog                                 ├──> Unpacked-items panel
                                                                     │
localStorage save ──persists──> {Pallet config + Box catalog}        └──> Exports (JSON / PNG / print / CSV)
Share-by-URL ──encodes──> {Pallet config + Box catalog}
2D layer view ──derives-from──> PackResult placements
Step sequence ──derives-from(+infers order)──> PackResult placements
```

### Dependency Notes

- **Submit requires qty-expansion:** catalog groups by type+quantity; API wants individual unique-ID boxes. This transform sits between config and POST and is a hard prerequisite for any result feature.
- **Every result feature requires a successful PackResult:** 3D, stats, switcher, placement list, exports, diagnostics all hang off one poll-to-completion. Build the fetch/poll/parse layer first.
- **CoG marker & support highlight enhance the 3D viewer** — they are overlays on the same scene; build after the base viewer renders boxes.
- **Multi-pallet switcher drives the 3D viewer** — selecting a pallet must swap the scene, stats, and placement list in sync (mockup already wires this).
- **2D layer view and step sequence both derive from placements** — no extra API data, but the step sequence additionally **infers an order the API does not provide** (flag as assumption).
- **Save and Share both serialize the same config object** — design one canonical serializable config shape and both features fall out of it cheaply.

## MVP Definition

### Launch With (v1) — matches PROJECT Active scope

- [ ] Pallet config (L/W/H, max weight, max overhang) — core input
- [ ] Dynamic box catalog (dims, weight, qty, fragile, 3-mode rotation) — core input
- [ ] Qty → unique-ID expansion before POST — required by API contract
- [ ] Async submit → loading → poll-to-completion — required by API model
- [ ] 3D viewer (orbit/zoom/pan, ISO/TOP/FRONT, colour-by-type + legend) — headline deliverable
- [ ] Summary stats — the at-a-glance answer
- [ ] Multi-pallet switcher — overflow is real
- [ ] Placement list with hover↔mesh highlight — verifies the plan
- [ ] Unpacked-items panel with reasons — trust
- [ ] Stability diagnostics: CoG marker + per-box support ratio — high-value, data already returned
- [ ] Export: JSON + printable report — plans must leave the screen
- [ ] Save/reload config to localStorage — no lost work on refresh
- [ ] Graceful failure/timeout/unpacked handling — async reality
- [ ] Client-side input validation — block garbage submissions

### Add After Validation (v1.x)

- [ ] Standard pallet presets (EUR/GMA/...) — **strongly consider pulling into v1**; near-zero cost, removes top data-entry error
- [ ] Duplicate box type — cheap ergonomics win; trigger: users hand-copying SKUs
- [ ] PNG snapshot of 3D view — trigger: users asking how to share the picture
- [ ] CSV export of placements — trigger: warehouse hand-off requests
- [ ] CSV import of box catalog — trigger: users with >10 SKUs complaining about typing
- [ ] 2D top-down / layer view — trigger: "I can't read the 3D on the dock"

### Future Consideration (v2+)

- [ ] Step-by-step load sequence — needs order inference; verify physical sanity first
- [ ] Share-by-URL — defer until config schema is stable (URLs would break on schema change)
- [ ] True PDF report (vs print-CSS) — defer unless print route proves insufficient
- [ ] User accounts / saved history — explicit future; requires backend, keep architecture open

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Pallet config | HIGH | LOW | P1 |
| Box catalog (3-mode rotation, fragile) | HIGH | MEDIUM | P1 |
| Qty → unique-ID expansion | HIGH | LOW | P1 |
| Submit + poll + loading state | HIGH | MEDIUM | P1 |
| 3D viewer (orbit/zoom/pan, presets, legend) | HIGH | MEDIUM-HIGH | P1 |
| Summary stats | HIGH | LOW | P1 |
| Multi-pallet switcher | HIGH | MEDIUM | P1 |
| Placement list + hover highlight | MEDIUM | LOW | P1 |
| Unpacked-items + reasons | HIGH | LOW | P1 |
| CoG marker + support ratio | MEDIUM | MEDIUM | P1 |
| Export JSON + printable report | HIGH | LOW-MEDIUM | P1 |
| localStorage save/reload | HIGH | LOW-MEDIUM | P1 |
| Failure/timeout handling | HIGH | LOW | P1 |
| Input validation | MEDIUM | LOW-MEDIUM | P1 |
| Pallet presets | HIGH | LOW | P2 (consider P1) |
| Duplicate box type | MEDIUM | LOW | P2 |
| PNG snapshot | MEDIUM | LOW | P2 |
| CSV export placements | MEDIUM | LOW | P2 |
| CSV import catalog | MEDIUM | MEDIUM | P2 |
| 2D layer view | MEDIUM | MEDIUM | P2 |
| Step-by-step sequence | MEDIUM | MEDIUM-HIGH | P3 |
| Share-by-URL | MEDIUM | MEDIUM | P3 |
| True PDF report | LOW | MEDIUM | P3 |
| Manual placement editor | (requested) | HIGH | Anti |
| Units mm/in toggle | LOW | MEDIUM | Anti |
| Accounts / history | (requested) | HIGH | Anti (future) |

## Competitor Feature Analysis

| Feature | EasyCargo (paid SaaS) | 3DBinPacking (paid SaaS/API) | BoxFit (free, no-login) | Our Approach (Palletize v1) |
|---------|------------------------|------------------------------|--------------------------|------------------------------|
| Sign-up | Required (trial) | Required | None | **None** — matches BoxFit ethos |
| 3D viewer | Yes, rich | Yes | Yes, drag-rotate | Yes (r3f/drei, ISO/TOP/FRONT) |
| 2D / layer view | Yes | Yes | Layer-by-layer plan | Defer to v1.x (derive from placements) |
| Step sequence | Yes (animated) | Partial | No | v2 (infer order — flag assumption) |
| Pallet presets | Yes (8+ regional) | Yes | Yes (EUR/GMA/Asian/AU) | v1.x, possibly v1 (cheap) |
| Unit toggle | Yes | Yes (account setting) | mm/cm/m | mm/kg only (API constraint) — **anti** for v1 |
| Excel/CSV import | Yes (Excel) | Yes (XLS/CSV) | — | CSV import v1.x |
| Export | PDF + Excel | XLS/CSV/PDF | CSV | JSON + print (v1); PNG/CSV (v1.x) |
| Unpacked reasons | Yes | Yes | Implicit | **Yes, explicit panel** — differentiator for a free tool |
| CoG / stability | Axle load (paid) | Limited | No | **CoG + support ratio surfaced free** — our edge |
| Manual edit | Yes (drag&drop) | Limited | No | **No** (solver is authoritative) — deliberate anti-feature |
| Self-hostable | No | No | No | **Yes** (single Docker image) — unique |

## Key Recommendations for Roadmap

1. **Build the API integration layer (submit/poll/parse/typed-contract) first** — every result feature depends on it; it carries the most unknowns (CORS, timeout, error shapes).
2. **Pull pallet presets into v1 if budget allows** — highest value-to-cost ratio of any non-scoped feature.
3. **Make the unpacked-items panel a first-class v1 surface, not an afterthought** — the mockup under-represents it, but it is a trust feature and the data is free.
4. **Diagnostics (CoG + support) are the differentiator** — a free, self-hostable tool exposing what paid tools gate is the competitive story. The API already returns the data; the work is purely presentational.
5. **Honour three deliberate API-driven trims** (already PROJECT decisions): remove the CoG-envelope input, collapse 6 rotation chips → 3 modes, no manual placement editor.
6. **Design one canonical serializable config object early** — localStorage save, export, and future share-by-URL all reuse it.

## Sources

- [BoxFit — Free 3D Container & Pallet Packing Calculator](https://boxfit.space/) — closest no-login analog (units, presets, layer plan, CSV, all-free)
- [EasyCargo — 3D Pallet Loading Calculator](https://www.easycargo3d.com/en/3d-pallet-loading-calculator/) — paid feature superset; 3D, step sequence, manual editor, Excel
- [EasyCargo — Which is the best load planning application? (functions)](https://www.easycargo3d.com/en/blog/which-is-the-best-load-planning-application-part-1-4-functions/) — standard-vs-advanced feature taxonomy
- [EasyCargo — load plan reports](https://www.container-loading.com/en/how-to-work-with-different-load-plan-reports-in-easycargo/) — PDF/Excel report norms
- [3DBinPacking — Loading Optimization Software Toolset](https://www.3dbinpacking.com/en/loading-optimization-software/) — presets, XLS/CSV import/export, multi-space
- [3DBinPacking — FAQ](https://www.3dbinpacking.com/en/faq) — unit settings, import formats
- Internal: `.planning/PROJECT.md` (scope, API contract, out-of-scope decisions), `design/config.html`, `design/result.html` (intended UX)

---
*Feature research for: pallet packing / cargo load-planning web tool*
*Researched: 2026-06-03*

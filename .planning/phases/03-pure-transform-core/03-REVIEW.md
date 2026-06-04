---
phase: 03-pure-transform-core
reviewed: 2026-06-04T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - src/types/config.ts
  - src/types/pack-contract.ts
  - src/lib/fixture-types.ts
  - src/lib/request-builder.ts
  - src/lib/request-builder.test.ts
  - src/lib/result-mapper.ts
  - src/lib/result-mapper.test.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-06-04T00:00:00Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the pure-transform core: `buildPackRequest` (config → POST body, quantity
expansion, stable ids, O(1) `idToType` recovery) and `mapDoneResponse` (done-response →
regrouped-by-type/pallet view). The cross-file analysis spans `request-builder.ts`,
`result-mapper.ts`, their dependency `mapping.ts` (`typeKeyOf`), and the
`config.ts` / `pack-contract.ts` contract types.

The purity boundary is clean: none of the reviewed modules import `three`, React, or any
IO — only `type`-only imports and the runtime `typeKeyOf` from `mapping.ts` (itself
pure). Non-mutation is correctly implemented (object spread in the mapper, fresh request
object in the builder) and is covered by tests. Rotation-table mapping is total and
compile-enforced.

However, deep tracing surfaces a real correctness defect in the type-recovery contract:
the builder's own emitted id format (`${typeId}-${index}`) does NOT round-trip through
the parse-FALLBACK channel (`typeKeyOf`), so the PRIMARY and FALLBACK recovery paths
disagree for builder-produced ids. Combined with the complete absence of any
uniqueness/format guard on `BoxType.id`, the "ids MUST be unique and stable" invariant
(SC-1) is asserted in comments but never enforced in code.

## Critical Issues

### CR-01: `idToType` PRIMARY and `typeKeyOf` FALLBACK disagree for the builder's own id format

**File:** `src/lib/request-builder.ts:40-42`, `src/lib/result-mapper.ts:56`, `src/lib/mapping.ts:55-58`

**Issue:**
The builder emits ids of the form `${typeId}-${index}`, e.g. `makeItemId('Da', 0) === 'Da-0'`.
The mapper recovers a type with `idToType?.get(id) ?? typeKeyOf(id)` — map PRIMARY, parse
FALLBACK. But `typeKeyOf` is defined as the *leading non-digit prefix*:

```js
typeKeyOf('Da-0')  // => 'Da-'   (NOT 'Da' — the hyphen is non-digit, so it is consumed)
typeKeyOf('Tb-1')  // => 'Tb-'
typeKeyOf('Fc-0')  // => 'Fc-'
```

So for ids the builder actually produces:
- with `idToType` present → typeId is `'Da'`
- without `idToType` (fallback) → typeId is `'Da-'`

The two channels return **different keys for the same item**. This is not theoretical:
`mapDoneResponse` is explicitly designed to be callable *without* an `idToType` map
(`result-mapper.test.ts:12-16` exercises exactly that path), and `byType` keys feed
`colorForType`/the Phase-6 legend. If a result is mapped without the builder's map (e.g.
after a page reload that drops the in-memory `idToType`, or any caller that omits it), the
type buckets become `'Da-'`, `'Tb-'`, `'Fc-'` — different keys than the configured type
ids, breaking the legend/grouping join silently.

The fixture (`D000`, `T000`, `F011`) masks the bug because its ids have NO separator
between prefix and digits, so `typeKeyOf('D000') === 'D'` happens to match. The builder
never emits that format. The test `request-builder.test.ts:86-94` only asserts
`box.id[0]` and `typeKeyOf(box.id)[0]` are non-digit — it never asserts
`typeKeyOf(id) === idToType.get(id)`, so the divergence is untested.

**Fix:** Make the two recovery channels agree on the builder's format. Either strip the
trailing separator in the fallback, or stop at the first separator OR digit:

```ts
// mapping.ts — make typeKeyOf consistent with the builder's `${typeId}-${index}` ids.
// Take everything before the FIRST hyphen-or-digit boundary, then trim a trailing sep.
export function typeKeyOf(itemId: string): string {
  const m = /^([^\d-]+)/.exec(itemId); // exclude '-' as well as digits
  return m ? m[1] : itemId;
}
```

(Adjust the boundary char to whatever separator the builder uses; the key requirement is
`typeKeyOf(makeItemId(t, i)) === t` for all valid `t`.) Add a test asserting
`typeKeyOf(id) === idToType.get(id)` for every id the builder emits.

## Warnings

### WR-01: No uniqueness or format guard on `BoxType.id` — duplicate type ids silently collide

**File:** `src/lib/request-builder.ts:56-74`, `src/types/config.ts:37-51`

**Issue:** The module header (`request-builder.ts:7-10`) states "Ids MUST be unique and
stable across rebuilds" and `config.ts:38-43` states the id "MUST be a non-digit-leading
slug," but nothing enforces either. If two `BoxType` entries share the same `id` (the form
in Phase 4 can easily produce this — nanoid is mentioned for box ids, but a user-edited or
defaulted slug could repeat), the builder emits duplicate item ids: type A `id:'x'` qty 2
and type B `id:'x'` qty 3 both produce `x-0, x-1`. `idToType.set` overwrites, and
`request.boxes` contains duplicate ids. The API then receives colliding item ids and the
done-response regrouping double-counts/mis-attributes. SC-1 ("unique") is violated with no
detection.

**Fix:** Add a defensive duplicate check (throw or document a precondition):

```ts
const seen = new Set<string>();
for (const boxType of config.boxTypes) {
  if (seen.has(boxType.id)) {
    throw new Error(`buildPackRequest: duplicate BoxType id '${boxType.id}'`);
  }
  seen.add(boxType.id);
  // ...
}
```

Add a unit test feeding two box types with the same id and asserting it throws (or that
emitted ids stay unique).

### WR-02: Hyphen in `typeId` breaks the `${typeId}-${index}` encoding (separator collision)

**File:** `src/lib/request-builder.ts:40-42`

**Issue:** `makeItemId` joins with `-`, but `BoxType.id` is an arbitrary string with no
charset restriction (`config.ts:44` is just `string`). A typeId that itself contains `-`
makes the boundary ambiguous and can collide across types. Example: type `id:'a-1'` qty 1 →
`a-1-0`; the fallback `typeKeyOf('a-1-0')` → `'a-'` (wrong type). And distinct
(typeId, index) pairs can map to the same string (e.g. typeId `'a'` index `1` vs a future
encoding of `'a-1'`), defeating the uniqueness/recovery guarantee. The "non-digit-leading
slug" comment never says the slug must exclude the separator char.

**Fix:** Constrain the id charset (reject `-` / non-slug chars in the guard from WR-01) or
use a separator that cannot appear in a slug. Document the precondition on `BoxType.id` in
`config.ts`. Add a test with a hyphenated typeId.

### WR-03: Digit-leading `BoxType.id` produces garbage fallback type keys with no guard

**File:** `src/lib/mapping.ts:55-58`, `src/lib/request-builder.ts:40-42`

**Issue:** `typeKeyOf('123-0')` returns the whole string `'123-0'` (no leading non-digit
to match), so a digit-leading typeId yields a garbage fallback key that never matches the
map key. The comments in `config.ts:42` and `request-builder.ts` call this out as "Pitfall
3" and assert the id "MUST be a non-digit-leading slug," but nothing validates it. Phase 4's
form has no way (yet) to know this constraint exists at runtime.

**Fix:** Enforce the non-digit-leading precondition in the WR-01 guard:

```ts
if (/^\d/.test(boxType.id)) {
  throw new Error(`buildPackRequest: BoxType id must not start with a digit: '${boxType.id}'`);
}
```

### WR-04: Empty / non-positive / non-integer `quantity` silently produces zero or fractional-loop boxes

**File:** `src/lib/request-builder.ts:62`

**Issue:** `for (let index = 0; index < boxType.quantity; index += 1)` trusts
`boxType.quantity` blindly. `quantity: 0` silently drops the type (maybe intended, but
undocumented); a negative quantity silently expands to nothing; a non-integer (e.g. `2.5`)
expands to 3 boxes (loop runs while `index < 2.5`), producing a count that disagrees with
the user's input. `config.ts:49` types it as `number` with no integer/positive constraint,
and there is no runtime validation in this phase (D-04 defers validation to Phase 5, but
this transform is the one that materializes the boxes). No test covers `quantity` ≤ 0 or
fractional.

**Fix:** Either document that callers must pass `quantity` as a positive integer and add a
guard, or normalize/validate here:

```ts
if (!Number.isInteger(boxType.quantity) || boxType.quantity < 0) {
  throw new Error(`buildPackRequest: quantity must be a non-negative integer for '${boxType.id}'`);
}
```

Add tests for `quantity: 0`, negative, and fractional.

### WR-05: `mapDoneResponse` passes through API arrays/objects by reference — shared-reference mutation hazard for downstream consumers

**File:** `src/lib/result-mapper.ts:82-87`, `60-64`

**Issue:** The transform correctly avoids mutating source *items* (spread at line 78), and
the non-mutation test (`result-mapper.test.ts:95-101`) checks that. But the returned
`ResultView` still aliases several source objects/arrays by reference:
`summary: done.result.input_summary`, `unpacked: done.result.unpacked_items`, and per-pallet
`cog: p.cog`. The `unpacked` array elements and `cog` objects are the *same instances* as
the input. The module header and tests advertise a non-mutation guarantee ("never mutates
the input"), but the guarantee is one-directional: a Phase-6 consumer that mutates
`view.cog` or `view.unpacked[i]` (e.g. rounding cog for display in place) would mutate the
original `done` fixture/response, violating the advertised purity in the reverse direction.
The non-mutation test only guards the input→output direction.

**Fix:** If full isolation is intended, shallow-copy the passed-through aliases
(`unpacked: [...done.result.unpacked_items]`, `cog: { ...p.cog }`,
`summary: { ...done.result.input_summary }`), OR explicitly document that the view shares
references with the input and consumers must treat it as read-only. Add a test asserting
the chosen contract (either distinct references, or documented sharing).

## Info

### IN-01: `recoverType` fallback branch is untested for builder-format ids

**File:** `src/lib/result-mapper.test.ts:11-16`

**Issue:** The fallback path is only tested against the clean fixture ids (`D000` →
`D`). No test exercises the fallback against builder-emitted ids (`Da-0`), which is exactly
the case where CR-01 manifests. The "round-trip recovers every type via typeKeyOf" test
gives false confidence that the fallback is correct for all id shapes.

**Fix:** Add a test that builds a request with `buildPackRequest`, constructs a synthetic
done-response reusing those ids, and asserts the fallback (no `idToType`) produces the same
type keys as the primary path.

### IN-02: `idToType` is built but its key set is never reconciled with the builder's output keys

**File:** `src/lib/request-builder.ts:57,64`

**Issue:** `idToType.set(id, boxType.id)` and `boxes.push({ id, ... })` use the same `id`
variable, which is correct, but there is no invariant test that `idToType` has exactly one
entry per emitted box and that the value is recoverable by `typeKeyOf`. The existing test
`request-builder.test.ts:106-117` checks `idToType.get(box.id) === box.id.split('-')[0]` —
note this uses `split('-')[0]`, which is NOT what `typeKeyOf` does, quietly confirming the
two extraction strategies differ (the test would fail if it used `typeKeyOf`).

**Fix:** Add an assertion that `typeKeyOf(id)` equals `idToType.get(id)` to surface CR-01
at the builder level too.

### IN-03: `BAKED_OPTIONS` spread ordering allows a future `max_pallets` in BAKED_OPTIONS to be silently overridden (or vice-versa)

**File:** `src/lib/request-builder.ts:76-79`

**Issue:** `{ max_pallets: config.maxPallets, ...BAKED_OPTIONS }` is correct today, but the
spread-after pattern means if `BAKED_OPTIONS` ever gains a `max_pallets` key it would
silently clobber the user value. Low risk given the `as const` typing, but the precedence
is implicit. Minor maintainability note.

**Fix:** Spread baked options first and explicit user value last, or add a comment locking
the precedence: `{ ...BAKED_OPTIONS, max_pallets: config.maxPallets }`.

### IN-04: `status: string` and `DoneResponse.status` are unvalidated free strings

**File:** `src/types/pack-contract.ts:135-138`, `src/lib/result-mapper.ts:55`

**Issue:** `mapDoneResponse` accepts a `DoneResponse` whose `status` is typed as bare
`string` and never checks it is actually `"done"`. If a `failed`/`timeout` response (which
may have a missing or partial `result`) is passed in, `done.result.pallets.map` throws a
TypeError. Validation is deferred to Phase 5 (D-04), so this is acceptable for this phase,
but the function name (`mapDoneResponse`) implies a precondition that is neither typed nor
checked. Flagging so Phase 5 wiring enforces it before calling.

**Fix:** Phase 5 should narrow to the done-status discriminant before calling, or this
function should assert `done.result?.pallets` exists. Consider a literal `status: 'done'`
on a dedicated `DonePackResponse` type.

---

_Reviewed: 2026-06-04T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_

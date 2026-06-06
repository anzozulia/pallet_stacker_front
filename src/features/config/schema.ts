// The single source of truth for config validation (D-02), and zod's first use in the
// repo (C-01). Two schemas, one shape: `packConfigSubmitSchema` is the STRICT resolver
// the form gates "Run" on (all D-02 business rules); `packConfigShapeSchema` is the
// LENIENT structure/type-only guard for the localStorage restore path (Pitfall 4 — a
// partially-filled draft must round-trip without being rejected on business rules).
//
// Units mirror src/types/config.ts: mm integers for dimensions/quantity, kg (decimals
// allowed) for weights. HTML number inputs emit strings and an empty input is `""`;
// `z.coerce.number('')` silently yields `0`, so required numeric fields reject `""`
// BEFORE coercion (Pattern 1 / Pitfall 2) — a blank field must never pass as `0`.
//
// Imports nothing at runtime beyond zod; no three/React/IO. `satisfies z.ZodType<PackConfig>`
// makes `tsc -b` enforce that the submit schema's output stays a superset of PackConfig.
import { z } from 'zod';
import type { PackConfig } from '@/types/config';

// mm / quantity: required positive integer. Reject "" / null / undefined BEFORE coercing
// (a bare z.coerce.number('') yields 0 — Pattern 1 / Pitfall 2). The explicit
// .transform(Number) keeps the piped target typed (number) so `satisfies` holds.
const mmInt = z
  .union([z.string(), z.number()])
  .refine((v) => v !== '' && v !== null && v !== undefined, { message: 'Required' })
  .transform((v) => Number(v))
  .pipe(z.number().int('Whole mm only').positive('Must be > 0'));

// mm integer that ALSO accepts 0 (`.min(0)` instead of `.positive()`). Used ONLY for
// `pallet.maxOverhang`, which is 0 when the Allow-overhang switch is OFF (the default).
// All other mm fields keep `mmInt` (strictly > 0).
const mmIntNonNeg = z
  .union([z.string(), z.number()])
  .refine((v) => v !== '' && v !== null && v !== undefined, { message: 'Required' })
  .transform((v) => Number(v))
  .pipe(z.number().int('Whole mm only').min(0, 'Must be ≥ 0'));

// kg: required positive number, decimals allowed (no .int()). Reject "" before coercion.
const kg = z
  .union([z.string(), z.number()])
  .refine((v) => v !== '' && v !== null && v !== undefined, { message: 'Required' })
  .transform((v) => Number(v))
  .pipe(z.number().positive('Must be > 0'));

// Closed rotation domain — mirrors RotationMode (src/types/config.ts).
const rotation = z.enum(['free', 'uprightOnly', 'fixed']);

// Lenient numeric for the RESTORE guard only (Pitfall 4 / DATA-02). RHF leaves numeric
// `<input>` values as STRINGS on the form (Pattern 1 — the strict submit schema coerces
// them), so the auto-saved draft persists numbers AS STRINGS (e.g. `"1234"`). The restore
// guard must therefore accept a string-or-number and normalise to a number so a partial,
// string-shaped draft round-trips (a `z.number()`-only guard would reject the string blob
// and silently discard the user's work on reload). Structure/type only — NO business rules:
// an empty string / non-numeric coerces to `NaN` and is left as-is (still structurally a
// number field) so an in-progress blank field still round-trips.
const looseNumber = z.union([z.number(), z.string()]).transform((v) => Number(v));

// Strict box-type element: full D-02 rules. `maxLoad` allows 0 (fragile boxes carry no
// load); `id` must not lead with a digit so the typeKeyOf parse-fallback stays correct (C-06).
const boxTypeSubmit = z.object({
  id: z.string().regex(/^[^\d]/, 'id must not start with a digit'),
  label: z.string().min(1, 'Name required'),
  length: mmInt,
  width: mmInt,
  height: mmInt,
  weight: kg,
  quantity: mmInt,
  maxLoad: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .pipe(z.number().min(0)),
  fragile: z.boolean(),
  rotation,
});

/**
 * Strict submit schema (D-02): the resolver the form gates "Run" on. Rejects empty /
 * zero / non-integer mm, non-positive kg, and an empty catalog. `satisfies
 * z.ZodType<PackConfig>` proves at compile time that the parsed output ⊇ PackConfig.
 */
export const packConfigSubmitSchema = z.object({
  pallet: z.object({
    length: mmInt,
    width: mmInt,
    height: mmInt,
    maxWeight: kg,
    // Non-negative: 0 is valid (Allow-overhang OFF, the default).
    maxOverhang: mmIntNonNeg,
    allowOverhang: z.boolean(),
  }),
  boxTypes: z.array(boxTypeSubmit).min(1, 'Add at least one box type'),
}) satisfies z.ZodType<PackConfig>;

/**
 * Lenient restore guard (Pitfall 4): structure / type only — NO business rules. A
 * structurally-valid but business-invalid draft (e.g. `length: 0`, blank label) still
 * passes so an in-progress localStorage draft round-trips; the form re-validates with
 * the strict schema before submit.
 */
export const packConfigShapeSchema = z.object({
  pallet: z.object({
    length: looseNumber,
    width: looseNumber,
    height: looseNumber,
    maxWeight: looseNumber,
    maxOverhang: looseNumber,
    allowOverhang: z.boolean(),
  }),
  boxTypes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      length: looseNumber,
      width: looseNumber,
      height: looseNumber,
      weight: looseNumber,
      quantity: looseNumber,
      maxLoad: looseNumber,
      fragile: z.boolean(),
      rotation,
    }),
  ),
});

// The SOLE IO module for Phase 4's refresh-safety feature (D-07 / DATA-02). ALL browser
// IO lives HERE — `localStorage.getItem` / `localStorage.setItem` and the `JSON`-shaped
// envelope via `@/lib/config-persist` — while the pure, jsdom-testable (de)serialize guard
// stays in `@/lib/config-persist` (which never touches `window`/`localStorage`). Keeping the
// split this way is what lets the persist guard be unit-tested without mocking the browser
// and keeps this thin hook the one place a reviewer must check for IO.
//
// Behaviour:
//  - restore-on-mount: read `localStorage[STORAGE_KEY]` ONCE and return
//    `deserializeConfigOrDefault(raw)` so `useForm` can seed `defaultValues` (the guard
//    never throws on a corrupt/foreign blob — T-4-PERSIST).
//  - debounced auto-save (~400ms): subscribe via RHF 7.77 `form.subscribe({ formState:
//    { values: true }, callback })` and write `serializeConfig(values)` UNCONDITIONALLY on
//    every change — invalid/in-progress drafts are persisted too (D-04). Never gate on
//    validity.
//  - `flushSave(values)`: cancel the pending debounce and write immediately (Save draft).
//  - cleanup: clear the timer AND unsubscribe on unmount (Pitfall 7) so no write fires after
//    the form is gone.
//
// Code-split gate (C-05): imports ONLY React, react-hook-form types, and the pure
// `@/lib/config-persist` fns — never three/r3f/drei or any viewer module.
import { useCallback, useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { STORAGE_KEY, deserializeConfigOrDefault, serializeConfig } from '@/lib/config-persist';
import type { PackConfig } from '@/types/config';

/** Debounce window for the silent auto-save (D-07). */
const AUTOSAVE_DEBOUNCE_MS = 400;

/**
 * Read the persisted draft ONCE (restore-on-mount). Safe against a missing/corrupt/foreign
 * blob — `deserializeConfigOrDefault` falls back to `DEFAULT_CONFIG` and never throws.
 * Guards against environments without `localStorage` (e.g. SSR/tests) by treating any
 * access failure as "no draft".
 */
export function readPersistedConfig(): PackConfig {
  let raw: string | null;
  try {
    raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  } catch {
    raw = null;
  }
  return deserializeConfigOrDefault(raw);
}

/** Write a config to the draft slot now. The single `localStorage.setItem` call site. */
function writeConfig(config: PackConfig): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, serializeConfig(config));
    }
  } catch {
    // Quota / disabled storage — auto-save is best-effort; never crash the form.
  }
}

export interface UseLocalStorageAutosave {
  /** Cancel any pending debounce and persist immediately (for the Save draft button). */
  flushSave: (config: PackConfig) => void;
}

/**
 * Wire debounced auto-save + an immediate-flush to a live `useForm` instance. Returns
 * `flushSave` for the Save-draft button. The restore-on-mount read is exposed separately as
 * `readPersistedConfig()` (call it to seed `useForm`'s `defaultValues` BEFORE the form exists).
 */
export function useLocalStorageAutosave(form: UseFormReturn<PackConfig>): UseLocalStorageAutosave {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flushSave = useCallback(
    (config: PackConfig) => {
      clearPending();
      writeConfig(config);
    },
    [clearPending],
  );

  // `form.subscribe` is stable across renders; subscribe once on mount, unsubscribe + clear
  // the pending timer on unmount (Pitfall 7). The callback receives `{ values, ... }`.
  const subscribe = form.subscribe;
  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { values: true },
      callback: ({ values }) => {
        clearPending();
        // Persist the RAW form values UNCONDITIONALLY — even invalid drafts (D-04).
        timerRef.current = setTimeout(() => {
          writeConfig(values as PackConfig);
          timerRef.current = null;
        }, AUTOSAVE_DEBOUNCE_MS);
      },
    });

    return () => {
      clearPending();
      unsubscribe();
    };
  }, [subscribe, clearPending]);

  return { flushSave };
}

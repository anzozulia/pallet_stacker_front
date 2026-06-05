import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Deterministic E2E for the full async submit→poll lifecycle (Plan 05-04 / PACK-05 / PACK-06),
// against the REAL preview production build (the same static `dist/` Docker serves). EVERY API call
// is stubbed with `page.route` — the spec NEVER hits the live packing API (CLAUDE.md). It proves the
// happy path (Configure→loading→result) plus each non-success terminal path (failed / timeout /
// unreachable) and the cancel path, all without a crash.
//
// URL matching: the production build bakes `API_BASE = VITE_API_URL` (set to the preview origin
// http://localhost:4173 in playwright.config.ts, since WR-01 makes an UNSET value throw at module
// load) so requests resolve to `<origin>/api/v1/...`; the path-suffix globs below intercept them
// regardless of the baked origin — NO request ever leaves for a live API.

const __dirname = dirname(fileURLToPath(import.meta.url));
// The committed real done corpus (has 7 unpacked_items — the unpacked-is-SUCCESS case).
const packDoneResponse = JSON.parse(
  readFileSync(join(__dirname, '../src/lib/__fixtures__/pack-done-response.json'), 'utf8'),
) as { result: unknown };

/** Fulfil POST /pack with the 202 accepted body. */
async function stubAccept(route: Route, jobId = 'e2e-job-1') {
  await route.fulfill({
    status: 202,
    contentType: 'application/json',
    body: JSON.stringify({
      job_id: jobId,
      status: 'queued',
      links: { self: `/api/v1/jobs/${jobId}` },
    }),
  });
}

type PollState =
  | { status: 'queued' | 'running' | 'failed' | 'timeout' }
  | { status: 'failed'; error: { code: string; message: string } }
  | { status: 'done'; result: unknown };

/**
 * Install a deterministic GET /jobs/** route that walks `states` across successive poll calls,
 * sticking on the LAST entry once exhausted (a poll naturally settles on its terminal state).
 */
async function stubPollSequence(page: Page, states: PollState[]) {
  let call = 0;
  await page.route('**/api/v1/jobs/**', async (route) => {
    const state = states[Math.min(call, states.length - 1)];
    call += 1;
    const body: Record<string, unknown> = { job_id: 'e2e-job-1', status: state.status };
    if ('error' in state && state.error) body.error = state.error;
    if (state.status === 'done') body.result = (state as { result: unknown }).result;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Collect any uncaught console errors so each test can assert the app never crashed. */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

/** Drive Configure → click Run → land on /loading. The default config is valid, so Run navigates. */
async function runFromConfigure(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('palletize:config:v1'));
  await page.reload();
  // Two "Run packing" buttons exist (topbar + sticky footer); either triggers the same Run.
  await page.getByRole('button', { name: 'Run packing' }).first().click();
}

test.describe('async submit→poll lifecycle (deterministic, stubbed API)', () => {
  test('HAPPY PATH: Configure → loading (spinner + summary + honest status) → result', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [
      { status: 'queued' },
      { status: 'running' },
      { status: 'done', result: packDoneResponse.result },
    ]);

    await runFromConfigure(page);

    // On /loading: the comet spinner + the summary card + an HONEST status sub-line (no %).
    await expect(page).toHaveURL(/\/loading$/);
    await expect(page.getByText('Packing your pallets…')).toBeVisible();
    const status = page.getByRole('status');
    await expect(status).toBeVisible();
    await expect(status).not.toContainText('%');

    // queued→running→done across ~2 poll intervals → navigates to /result.
    await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });

    // The REAL scene mounted from the live cached payload (Plan 06-02): the r3f Canvas is visible and
    // the overlay legend shows the whole-result type keys — proving live data, not the removed fixture
    // import, drives /result.
    await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();
    await expect(page.getByText('D', { exact: true })).toBeVisible();
    await expect(page.getByText('F', { exact: true })).toBeVisible();
    await expect(page.getByText('T', { exact: true })).toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('FAILED: the distinct failed card renders with the server message; no crash', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [
      { status: 'running' },
      { status: 'failed', error: { code: 'SOLVER_ERROR', message: 'overhang exceeded' } },
    ]);

    await runFromConfigure(page);

    await expect(page.getByRole('alert')).toContainText('Packing failed', { timeout: 15000 });
    await expect(page.getByText('overhang exceeded')).toBeVisible();
    await expect(page).toHaveURL(/\/loading$/);
    expect(errors).toHaveLength(0);
  });

  test("TIMEOUT: the distinct 'ran out of time' card renders; no crash", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [{ status: 'running' }, { status: 'timeout' }]);

    await runFromConfigure(page);

    await expect(page.getByText(/ran out of time/i)).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/loading$/);
    expect(errors).toHaveLength(0);
  });

  test("UNREACHABLE: an aborted POST shows the 'couldn't reach' card; no crash", async ({
    page,
  }) => {
    // NB: no console-error assertion here — a deliberately aborted fetch surfaces a network
    // console error in the browser (the simulated failure itself), which is expected, not a crash.
    // Abort the POST to simulate a network/opaque-CORS throw (classifyFetchError → unreachable).
    await page.route('**/api/v1/pack', (route) => route.abort());
    await stubPollSequence(page, [{ status: 'running' }]);

    await runFromConfigure(page);

    await expect(page.getByText(/couldn't reach the packing service/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/\/loading$/);
    // The app handled the thrown POST into the unreachable card without a blank crash.
  });

  test('UNPACKED-IS-SUCCESS: a done body with unpacked_items navigates to /result, not an error', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    // The committed fixture body carries 7 unpacked_items — still SUCCESS.
    await stubPollSequence(page, [
      { status: 'running' },
      { status: 'done', result: packDoneResponse.result },
    ]);

    await runFromConfigure(page);

    await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toHaveLength(0);
  });

  test('CANCEL: Cancel on /loading returns to / with the draft intact; no hang', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    // Never reach a terminal state, so the job is still polling when we Cancel.
    await stubPollSequence(page, [{ status: 'running' }]);

    // Type a recognizable value so we can prove the draft survives the Cancel round-trip.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('palletize:config:v1'));
    await page.reload();
    const PALLET_LENGTH = '1357';
    await page.locator('input[name="pallet.length"]').fill(PALLET_LENGTH);
    // The form auto-saves on a ~400ms debounce; wait for the draft to flush to localStorage
    // before leaving Configure so the Cancel round-trip restores the typed value (D-08).
    await expect
      .poll(async () => page.evaluate(() => localStorage.getItem('palletize:config:v1') ?? ''))
      .toContain(PALLET_LENGTH);
    await page.getByRole('button', { name: 'Run packing' }).first().click();

    await expect(page).toHaveURL(/\/loading$/);
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Back on Configure with the typed value intact (D-08), and no spinner ghost.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('input[name="pallet.length"]')).toHaveValue(PALLET_LENGTH);
    await expect(page.getByText('Packing your pallets…')).toHaveCount(0);
    expect(errors).toHaveLength(0);
  });
});

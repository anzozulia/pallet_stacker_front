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
    // import, drives /result. Scope the type-key assertions to the legend container so they do not
    // collide with the rail's placement/unpacked rows, which also render type ids (Plan 06-04).
    await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();
    const legend = page.locator('[data-viewer-legend]');
    await expect(legend.getByText('D', { exact: true })).toBeVisible();
    await expect(legend.getByText('F', { exact: true })).toBeVisible();
    await expect(legend.getByText('T', { exact: true })).toBeVisible();

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

  test('PALLET SWITCH: selecting another pallet swaps the boxes but PRESERVES the camera (D-02)', async ({
    page,
  }) => {
    // Drive the stubbed Configure→Run→Result flow to a POPULATED /result (fixture has 2 pallets
    // P001/P002). Then click the second switcher row and prove (1) the camera position is UNCHANGED
    // across the switch (no auto-re-frame on swap, D-02) and (2) the rendered canvas pixels DIFFER
    // (the boxes actually swapped — the scene updated). All API routes stubbed; never the live API.
    type CamState = { position: [number, number, number] };
    const l2 = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    const readCam = () =>
      page.evaluate(
        () => (window as Window & { __cameraState?: unknown }).__cameraState,
      ) as Promise<CamState>;

    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [
      { status: 'running' },
      { status: 'done', result: packDoneResponse.result },
    ]);

    await runFromConfigure(page);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });

    const canvas = page.locator('[data-testid="r3f-canvas"]');
    await expect(canvas).toBeVisible();

    // Let the initial ISO framing settle so the camera is at rest before the switch.
    await page.waitForFunction(() => {
      const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
      return s?.settled === true;
    });
    await page.waitForTimeout(250);

    const before = await readCam();
    const pngBefore = await canvas.screenshot();

    // Switch to the second pallet (P002) via its switcher row inside the result rail.
    const rail = page.locator('[data-result-rail]');
    await rail.getByRole('button', { name: /P002/ }).click();

    // The switcher highlight reflects the selection (aria-pressed flips to the P002 row).
    await expect(rail.getByRole('button', { name: /P002/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Let the scene settle after the swap (re-measure happens, but the camera must NOT animate).
    await page.waitForTimeout(500);

    const after = await readCam();
    const pngAfter = await canvas.screenshot();

    // (1) Camera UNCHANGED across the switch (within a tiny epsilon — no snap, D-02).
    expect(l2(before.position, after.position)).toBeLessThan(1);
    // (2) Canvas pixels DIFFER — the boxes swapped (P001's 19 boxes → P002's 12 boxes).
    expect(pngBefore.equals(pngAfter)).toBe(false);

    expect(errors).toHaveLength(0);
  });

  test('PLACEMENT HOVER: hovering a placement row glows the matching mesh (RESULT-05 / D-11)', async ({
    page,
  }) => {
    // Drive the stubbed Configure→Run→Result flow to a POPULATED /result, then hover the first
    // placement card in the rail and prove (1) the canvas pixels CHANGE (the matching mesh's
    // declarative emissiveIntensity lit it up — the glow rendered) and (2) moving off the card
    // clears the glow (the off-hover capture differs from the hovered one — pixels return toward
    // the baseline). All API routes stubbed; never the live API.
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [
      { status: 'running' },
      { status: 'done', result: packDoneResponse.result },
    ]);

    await runFromConfigure(page);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });

    const canvas = page.locator('[data-testid="r3f-canvas"]');
    await expect(canvas).toBeVisible();

    // Let the initial ISO framing settle so the camera is at rest before any hover.
    await page.waitForFunction(() => {
      const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
      return s?.settled === true;
    });
    await page.waitForTimeout(250);

    const pngBaseline = await canvas.screenshot();

    // Hover a placement card in the result rail. The card's onMouseEnter sets hoveredId → the
    // matching mesh's declarative emissiveIntensity (0.45) → the glow renders. Some boxes sit at
    // the back/bottom of the ISO frame and are occluded, so iterate the cards until one produces a
    // visible canvas-pixel change (proving the hover→emissive→render path end-to-end). The card's
    // own accent cue (border-accent) confirms onMouseEnter fired before we look at the WebGL glow.
    const rail = page.locator('[data-result-rail]');
    const cards = rail.locator('[data-placement-card]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    let glowedCard = -1;
    let pngHovered = pngBaseline;
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      await card.hover();
      await expect(card).toHaveClass(/border-accent/);
      await page.waitForTimeout(250); // let the emissive material repaint
      pngHovered = await canvas.screenshot();
      if (!pngHovered.equals(pngBaseline)) {
        glowedCard = i;
        break;
      }
      // No visible change (occluded box) — move off so its accent clears, then try the next card.
      await rail.getByText('Placement', { exact: true }).hover();
      await expect(card).not.toHaveClass(/border-accent/);
    }

    // (1) The glow rendered: at least one hovered card changed the canvas pixels.
    expect(glowedCard).toBeGreaterThanOrEqual(0);

    // (2) The glow clears on mouse-leave: move off the glowing card and assert the canvas returns
    // toward the baseline (the cleared capture differs from the hovered one — emissive removed).
    await rail.getByText('Placement', { exact: true }).hover();
    await expect(cards.nth(glowedCard)).not.toHaveClass(/border-accent/);
    await expect
      .poll(
        async () => {
          const pngCleared = await canvas.screenshot();
          return pngCleared.equals(pngHovered);
        },
        { timeout: 5000 },
      )
      .toBe(false);

    expect(errors).toHaveLength(0);
  });

  test('DIAGNOSTICS: CoG toggle (default ON) + Support heatmap toggle recolour the scene (DIAG-01/02)', async ({
    page,
  }) => {
    // Drive the stubbed Configure→Run→Result flow to a POPULATED /result, then exercise the two
    // diagnostics overlay toggles and prove each one changes what's drawn in the WebGL canvas:
    //   (a) `Centre of gravity` is present, ON by default (aria-checked=true); toggling it OFF
    //       removes the CoG marker + drop-line → the canvas pixels change.
    //   (b) `Support heatmap` is OFF by default; toggling it ON recolours the boxes by support
    //       ratio → the canvas pixels change AND the legend swaps to the support-scale key.
    //   (c) a placement card shows a `%` support value (DIAG-02, always shown).
    // All API routes stubbed; never the live API.
    const errors = collectConsoleErrors(page);
    await page.route('**/api/v1/pack', (route) => stubAccept(route));
    await stubPollSequence(page, [
      { status: 'running' },
      { status: 'done', result: packDoneResponse.result },
    ]);

    await runFromConfigure(page);
    await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });

    const canvas = page.locator('[data-testid="r3f-canvas"]');
    await expect(canvas).toBeVisible();

    // Let the initial ISO framing settle so the camera is at rest before any toggle.
    await page.waitForFunction(() => {
      const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
      return s?.settled === true;
    });
    await page.waitForTimeout(250);

    const cogToggle = page.getByRole('switch', { name: 'Centre of gravity' });
    const heatToggle = page.getByRole('switch', { name: 'Support heatmap' });

    // (a) CoG is ON by default (the differentiator). Toggling it OFF must change the canvas pixels
    // (the marker sphere + drop-line disappeared from the scene).
    await expect(cogToggle).toBeVisible();
    await expect(cogToggle).toHaveAttribute('aria-checked', 'true');
    const pngCogOn = await canvas.screenshot();
    await cogToggle.click();
    await expect(cogToggle).toHaveAttribute('aria-checked', 'false');
    await expect
      .poll(async () => (await canvas.screenshot()).equals(pngCogOn), { timeout: 5000 })
      .toBe(false);

    // (b) Support heatmap is OFF by default. Toggling it ON recolours the boxes (canvas pixels
    // change) and swaps the legend to the support-scale key (e.g. `well supported`).
    const legend = page.locator('[data-viewer-legend]');
    await expect(legend.getByText('D', { exact: true })).toBeVisible();
    await expect(heatToggle).toHaveAttribute('aria-checked', 'false');
    const pngHeatOff = await canvas.screenshot();
    await heatToggle.click();
    await expect(heatToggle).toHaveAttribute('aria-checked', 'true');
    // Legend swapped: the by-type `D` key is gone, the support-scale key is shown.
    await expect(legend.getByText('well supported')).toBeVisible();
    await expect(legend.getByText('D', { exact: true })).toHaveCount(0);
    await expect
      .poll(async () => (await canvas.screenshot()).equals(pngHeatOff), { timeout: 5000 })
      .toBe(false);

    // (c) A placement card always shows a `%` support value (DIAG-02), independent of the toggle.
    const rail = page.locator('[data-result-rail]');
    await expect(rail.getByText(/\d+%/).first()).toBeVisible();

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

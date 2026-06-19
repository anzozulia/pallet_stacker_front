import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Phase-8 explode slice (RESULT-07 / 08-02) e2e. Proves, as FIVE independently-reported tests
// against the STUBBED Configure → Run → /result flow (never the live API, mirroring
// result-viewer.spec.ts's route-interception harness):
//   1. assembled-default reproduces the Phase-6 view (SC-3) — readout `Assembled`, baseline shot.
//   2. explode-gaps separates the layers (SC-2) — explode>0 canvas DIFFERS from the assembled shot.
//   3. CoG-hidden-while-exploded (D-06) — the DETERMINISTIC window.__cogVisible hook flips
//      true→false→true across 0 → max → 0 (NOT a console-error proxy).
//   4. camera-unchanged-on-switch (D-05/Pitfall 1) — a pallet switch must NOT re-frame the camera.
//   5. compose-with-preset+heatmap (SC-4) — preset + heatmap at explode>0 with zero console errors.

const __dirname = dirname(fileURLToPath(import.meta.url));
// Same committed real done corpus the api-poll happy path + result-viewer.spec.ts use (P001 19
// boxes / 2 layers, P002 12 boxes / 4 layers) — so /result renders the same real type keys here.
const packDoneResponse = JSON.parse(
  readFileSync(join(__dirname, '../src/lib/__fixtures__/pack-done-response.json'), 'utf8'),
) as { result: unknown };

/** Fulfil POST /pack with the 202 accepted body (mirrors result-viewer.spec.ts stubAccept). */
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

/** Walk a poll sequence across successive GET /jobs/** calls, sticking on the last entry. */
async function stubPollSequence(
  page: Page,
  states: Array<{ status: string; result?: unknown }>,
): Promise<void> {
  let call = 0;
  await page.route('**/api/v1/jobs/**', async (route) => {
    const state = states[Math.min(call, states.length - 1)];
    call += 1;
    const body: Record<string, unknown> = { job_id: 'e2e-job-1', status: state.status };
    if (state.status === 'done') body.result = state.result;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Drive the stubbed Configure → Run → done flow so the test lands on a POPULATED /result. */
async function reachResultViaStubbedFlow(page: Page): Promise<void> {
  await page.route('**/api/v1/pack', (route) => stubAccept(route));
  await stubPollSequence(page, [
    { status: 'running' },
    { status: 'done', result: packDoneResponse.result },
  ]);
  await page.goto('/');
  await page.evaluate(() => localStorage.removeItem('palletize:config:v1'));
  await page.reload();
  await page.getByRole('button', { name: 'Run packing' }).first().click();
  await expect(page).toHaveURL(/\/result$/, { timeout: 15000 });
  await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();
}

type CamState = {
  position: [number, number, number];
  target: [number, number, number];
  settled: boolean;
};

function l2(a: readonly number[], b: readonly number[]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Locate the Explode native range by its accessible name (UI-SPEC aria-label). */
function explodeSlider(page: Page) {
  return page.getByRole('slider', { name: 'Explode amount' });
}

/** Locate the Layers focus native range by its accessible name (UI-SPEC aria-label). */
function layersSlider(page: Page) {
  return page.getByRole('slider', { name: 'Layer focus' });
}

/** Set the Layers slider to `value` and let the per-layer visibility/opacity settle. */
async function setLayer(page: Page, value: number): Promise<void> {
  await layersSlider(page).fill(String(value));
  // No camera re-fit on focus change, but let the (optional) opacity ease + a frame or two land.
  await page.waitForTimeout(250);
}

/** Set the Explode slider to `value` (0..1) and wait for the re-fit animation to settle. */
async function setExplode(page: Page, value: number): Promise<void> {
  await explodeSlider(page).fill(String(value));
  // The explode change bumps explodeNonce → CameraPresets re-fits; wait until it reports settled.
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  // Belt-and-suspenders: let damping/AA quiesce + the per-layer damp reach target before readback.
  await page.waitForTimeout(400);
}

async function readCogVisible(page: Page): Promise<boolean | undefined> {
  return page.evaluate(() => (window as Window & { __cogVisible?: boolean }).__cogVisible);
}

test('assembled-default reproduces the Phase-6 view (SC-3)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await reachResultViaStubbedFlow(page);

  // On landing the Explode control reads `Assembled` (value 0 = byte-identical assembled stack).
  await expect(explodeSlider(page)).toHaveValue('0');
  await expect(page.getByText('Assembled', { exact: true })).toBeVisible();

  // Capture the assembled baseline (scenario 2 diffs against this). No WebGL/three errors.
  const baseline = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(baseline.byteLength).toBeGreaterThan(0);
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

test('explode-gaps separates the layers (SC-2)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Assembled baseline first (explode 0).
  await expect(explodeSlider(page)).toHaveValue('0');
  const assembled = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Drive Explode to max and let the layers animate apart.
  await setExplode(page, 1);
  await expect(page.getByText('1.0x', { exact: true })).toBeVisible();
  const exploded = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // The exploded canvas must DIFFER from the assembled one (layers visibly separated, SC-2/SC-3).
  expect(exploded.equals(assembled)).toBe(false);
});

test('CoG-hidden-while-exploded (D-06)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // CoG toggle is ON by default. Deterministic hook: window.__cogVisible reflects the EXACT gate
  // (cogOn && explode === 0) ResultPage renders on — not a console-error-free proxy.
  await expect(explodeSlider(page)).toHaveValue('0');
  await page.waitForFunction(
    () => (window as Window & { __cogVisible?: boolean }).__cogVisible === true,
  );
  expect(await readCogVisible(page)).toBe(true);

  // Explode > 0 → CoG hidden.
  await setExplode(page, 1);
  await page.waitForFunction(
    () => (window as Window & { __cogVisible?: boolean }).__cogVisible === false,
  );
  expect(await readCogVisible(page)).toBe(false);

  // Return to 0 → CoG visible again (respecting the still-ON toggle).
  await setExplode(page, 0);
  await page.waitForFunction(
    () => (window as Window & { __cogVisible?: boolean }).__cogVisible === true,
  );
  expect(await readCogVisible(page)).toBe(true);
});

test('camera-unchanged-on-switch (D-05/Pitfall 1)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Settle the initial ISO frame, then record the camera position.
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  await page.waitForTimeout(250);
  const before = (await page.evaluate(
    () => (window as Window & { __cameraState?: unknown }).__cameraState,
  )) as CamState;

  // Switch to the OTHER pallet (P002). The explode re-fit must NOT leak onto a pallet switch —
  // CameraPresets re-measures the bbox but keys the re-fit on explodeNonce only (D-02).
  await page.getByRole('button', { name: 'P002' }).click();
  await page.waitForTimeout(600);
  const after = (await page.evaluate(
    () => (window as Window & { __cameraState?: unknown }).__cameraState,
  )) as CamState;

  // Camera position unchanged within a small epsilon (no snap on switch).
  expect(l2(before.position, after.position)).toBeLessThan(1);
});

test('compose-with-preset+heatmap (SC-4)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await reachResultViaStubbedFlow(page);

  // Explode the stack, then exercise a preset (TOP) and the support-heatmap toggle on top of it.
  await setExplode(page, 1);
  await page.getByRole('button', { name: 'TOP', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  // The heatmap toggle is a role="switch" (ViewerOverlay), so target it as a switch, not a button.
  await page.getByRole('switch', { name: 'Support heatmap' }).click();
  await page.waitForTimeout(300);

  // The controls compose: the canvas still renders and no console errors surfaced.
  await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();
  const png = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(png.byteLength).toBeGreaterThan(0);
  expect(errors).toHaveLength(0);
});

// ── 08-03 Layers focus slice ────────────────────────────────────────────────────────────────────
// P001 (the default-selected pallet) has 2 base-z layers, so k=1 in a 2-layer stack is a meaningful
// partial focus for both build-up (hide layer 2) and isolate (ghost layer 2).

test('build-up-hides upper layers (D-08)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Default landing is All (Build-up full) — byte-identical assembled baseline.
  await expect(layersSlider(page)).toHaveValue('0');
  await expect(page.getByText('All', { exact: true })).toBeVisible();
  const all = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Build-up to layer 1 of 2: the upper layer is HIDDEN → the canvas differs from All.
  await setLayer(page, 1);
  await expect(page.getByText('Layer 1 / 2', { exact: true })).toBeVisible();
  const buildup = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(buildup.equals(all)).toBe(false);

  // Switch the SAME layer to Isolate: now the rest is GHOSTED (present, translucent), not hidden —
  // so isolate-of-k must differ from build-up-of-k.
  await page.getByRole('switch', { name: 'Isolate' }).click();
  await page.waitForTimeout(250);
  const isolate = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(isolate.equals(buildup)).toBe(false);
});

test('isolate-dims the non-focused layers (D-09)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Assembled baseline.
  await expect(layersSlider(page)).toHaveValue('0');
  const assembled = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Isolate layer 1: the rest is ghosted to translucent → canvas differs from assembled.
  await page.getByRole('switch', { name: 'Isolate' }).click();
  await setLayer(page, 1);
  await expect(page.getByText('Layer 1 / 2', { exact: true })).toBeVisible();
  const isolate = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(isolate.equals(assembled)).toBe(false);
});

test('row-click → isolate with persistent selected cue, hover unchanged (D-12)', async ({
  page,
}) => {
  await reachResultViaStubbedFlow(page);

  const assembled = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Click a placement-list card: ResultPage isolates that box's layer + marks the row selected.
  const card = page.locator('[data-placement-card]').first();
  await card.click();
  await page.waitForTimeout(300);

  // Persistent selected cue (distinct from hover): the clicked row carries data-selected.
  await expect(card).toHaveAttribute('data-selected', 'true');
  // The view changed to an isolated frame (canvas differs from assembled).
  const isolated = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(isolated.equals(assembled)).toBe(false);

  // Hover still works as the SEPARATE one-way seam: hovering a card does not error / clear selection.
  await card.hover();
  await page.waitForTimeout(150);
  await expect(card).toHaveAttribute('data-selected', 'true');
});

test('reset-on-switch resets explode + focus, camera preserved (D-11/D-05)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Raise explode and set a layer focus on P001.
  await setExplode(page, 1);
  await setLayer(page, 1);
  await expect(page.getByText('1.0x', { exact: true })).toBeVisible();
  await expect(page.getByText('Layer 1 / 2', { exact: true })).toBeVisible();

  // Record the camera AFTER the explode re-fit has settled (so the switch comparison is clean).
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  await page.waitForTimeout(250);
  const before = (await page.evaluate(
    () => (window as Window & { __cameraState?: unknown }).__cameraState,
  )) as CamState;

  // Switch pallets: readouts must return to Assembled / All (reset), camera preserved (no snap).
  await page.getByRole('button', { name: 'P002' }).click();
  await page.waitForTimeout(600);
  await expect(page.getByText('Assembled', { exact: true })).toBeVisible();
  await expect(page.getByText('All', { exact: true })).toBeVisible();

  const after = (await page.evaluate(
    () => (window as Window & { __cameraState?: unknown }).__cameraState,
  )) as CamState;
  // D-05/Pitfall 1: the switch itself does not re-frame the camera (within a small epsilon). The
  // explode reset sets explodeExtraHeight to 0 so any re-fit targets the assembled frame, no snap.
  expect(l2(before.position, after.position)).toBeLessThan(2);
});

test('full compose: build-up + explode + preset + CoG + heatmap (SC-4)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await reachResultViaStubbedFlow(page);

  // Build-up to layer 1 AND explode simultaneously, then a preset + both diagnostic toggles.
  await setLayer(page, 1);
  await setExplode(page, 1);
  await page.getByRole('button', { name: 'FRONT', exact: true }).click();
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  // CoG toggle (ON by default) + Support heatmap, both role=switch (ViewerOverlay).
  await page.getByRole('switch', { name: 'Centre of gravity' }).click();
  await page.getByRole('switch', { name: 'Support heatmap' }).click();
  await page.waitForTimeout(300);

  // Everything composes: the canvas renders and no console errors surfaced.
  await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();
  const png = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(png.byteLength).toBeGreaterThan(0);
  expect(errors).toHaveLength(0);
});

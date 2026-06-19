import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Phase-8 assembly-insight e2e (RESULT-07). Proves, against the STUBBED Configure → Run → /result
// flow (never the live API, mirroring result-viewer.spec.ts's route-interception harness):
//   - assembled-default reproduces the Phase-6 view (SC-3) — Explode toggle off (aria-checked=false).
//   - explode-gaps separates the layers (SC-2) — toggle ON canvas DIFFERS from the assembled shot.
//   - CoG-hidden-while-exploded (D-06) — the DETERMINISTIC window.__cogVisible hook flips
//     true→false→true across off → on → off (NOT a console-error proxy).
//   - camera-unchanged-on-switch (D-05/Pitfall 1) — a pallet switch must NOT re-frame the camera.
//   - compose-with-preset+heatmap (SC-4) — preset + heatmap while exploded, zero console errors.
//   - build-up-hides upper layers + row-click → build-up + reset-on-switch + full compose, all
//     driven by the Explode TOGGLE and the Layers − / + STEPPERS (no sliders, build-up only).

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

/** Locate the Explode toggle button by its accessible name (UI-SPEC aria-label). */
function explodeToggle(page: Page) {
  return page.getByRole('switch', { name: 'Explode' });
}

/** The Layers build-up `−` stepper, by its accessible name (UI-SPEC aria-label). */
function revealFewerButton(page: Page) {
  return page.getByRole('button', { name: 'Reveal one fewer layer' });
}

/** The Layers build-up `+` stepper, by its accessible name (UI-SPEC aria-label). */
function revealMoreButton(page: Page) {
  return page.getByRole('button', { name: 'Reveal one more layer' });
}

/** Click the `−` stepper `count` times to reveal fewer layers, settling once after. */
async function revealFewer(page: Page, count = 1): Promise<void> {
  for (let i = 0; i < count; i += 1) await revealFewerButton(page).click();
  // No camera re-fit on focus change, but let a frame or two land.
  await page.waitForTimeout(250);
}

/** Click the `+` stepper `count` times to reveal more layers (circular), settling once after. */
async function revealMore(page: Page, count = 1): Promise<void> {
  for (let i = 0; i < count; i += 1) await revealMoreButton(page).click();
  await page.waitForTimeout(250);
}

/** Drive the Explode toggle to the desired binary state and wait for the re-fit to settle. */
async function setExplode(page: Page, on: boolean): Promise<void> {
  const toggle = explodeToggle(page);
  const isOn = (await toggle.getAttribute('aria-checked')) === 'true';
  if (isOn !== on) await toggle.click();
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

  // On landing the Explode toggle is OFF (assembled) — byte-identical stack, no state-word readout.
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'false');

  // Capture the assembled baseline (scenario 2 diffs against this). No WebGL/three errors.
  const baseline = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(baseline.byteLength).toBeGreaterThan(0);
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

test('explode-gaps separates the layers (SC-2)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Assembled baseline first (toggle off).
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'false');
  const assembled = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Toggle Explode ON and let the layers animate apart.
  await setExplode(page, true);
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'true');
  const exploded = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // The exploded canvas must DIFFER from the assembled one (layers visibly separated, SC-2/SC-3).
  expect(exploded.equals(assembled)).toBe(false);
});

test('CoG-hidden-while-exploded (D-06)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // CoG toggle is ON by default. Deterministic hook: window.__cogVisible reflects the EXACT gate
  // (cogOn && explode === 0) ResultPage renders on — not a console-error-free proxy.
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'false');
  await page.waitForFunction(
    () => (window as Window & { __cogVisible?: boolean }).__cogVisible === true,
  );
  expect(await readCogVisible(page)).toBe(true);

  // Explode ON → CoG hidden.
  await setExplode(page, true);
  await page.waitForFunction(
    () => (window as Window & { __cogVisible?: boolean }).__cogVisible === false,
  );
  expect(await readCogVisible(page)).toBe(false);

  // Toggle back OFF → CoG visible again (respecting the still-ON toggle).
  await setExplode(page, false);
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
  await setExplode(page, true);
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

// ── Layers build-up slice ───────────────────────────────────────────────────────────────────────
// P001 (the default-selected pallet) has 2 base-z layers. The stepper is CIRCULAR: from All, `+`
// reveals layer 1 of 2 (a meaningful partial that hides the upper layer); `+` again wraps to All.

test('build-up-hides upper layers + circular wrap (D-08)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Default landing is All (full stack) — byte-identical assembled baseline.
  await expect(page.getByText('All', { exact: true })).toBeVisible();
  const all = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // From All, `+` reveals layer 1 of 2: the upper layer is HIDDEN → the canvas differs from All.
  await revealMore(page, 1);
  await expect(page.getByText('1–1 / 2', { exact: true })).toBeVisible();
  const buildup = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(buildup.equals(all)).toBe(false);

  // Circular: `+` again from the last partial level wraps back to All (the no-op default returns).
  await revealMore(page, 1);
  await expect(page.getByText('All', { exact: true })).toBeVisible();
});

test('row-click → builds up to that box layer, hover unchanged (D-12)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  const assembled = await page.locator('[data-testid="r3f-canvas"]').screenshot();

  // Click a placement-list card: ResultPage builds the stack UP to that box's layer so it shows.
  const card = page.locator('[data-placement-card]').first();
  await card.click();
  await page.waitForTimeout(300);

  // The view changed (build-up revealed a subset → canvas differs from the assembled All view).
  const builtUp = await page.locator('[data-testid="r3f-canvas"]').screenshot();
  expect(builtUp.equals(assembled)).toBe(false);

  // Hover still works as the SEPARATE one-way seam: hovering a card does not error.
  await card.hover();
  await page.waitForTimeout(150);
  await expect(card).toBeVisible();
});

test('reset-on-switch resets explode + focus, camera preserved (D-11/D-05)', async ({ page }) => {
  await reachResultViaStubbedFlow(page);

  // Toggle explode ON and step a layer build-up on P001.
  await setExplode(page, true);
  await revealFewer(page, 1);
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1–1 / 2', { exact: true })).toBeVisible();

  // Record the camera AFTER the explode re-fit has settled (so the switch comparison is clean).
  await page.waitForFunction(() => {
    const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
    return s?.settled === true;
  });
  await page.waitForTimeout(250);
  const before = (await page.evaluate(
    () => (window as Window & { __cameraState?: unknown }).__cameraState,
  )) as CamState;

  // Switch pallets: explode resets (toggle OFF) + Layers returns to All, camera preserved (no snap).
  await page.getByRole('button', { name: 'P002' }).click();
  await page.waitForTimeout(600);
  await expect(explodeToggle(page)).toHaveAttribute('aria-checked', 'false');
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

  // Build up to layer 1 AND explode simultaneously, then a preset + both diagnostic toggles.
  await revealFewer(page, 1);
  await setExplode(page, true);
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

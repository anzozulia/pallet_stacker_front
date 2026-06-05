import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Proves RESULT-01 (viewer renders) + RESULT-02 (preset switching) against the REAL preview build
// (playwright.config.ts webServer = build && preview), copying e2e/smoke.spec.ts's console-error
// pattern. The qualitative visual + camera-feel judgment is the human checkpoint (02-02-PLAN Task 4).
//
// CARRIER CHANGE (Plan 06-02): /result is no longer reachable by a bare `page.goto('/result')` — the
// page now reads the `done` payload from the react-query cache via the `{ jobId, idToType }` carrier
// handed over by LoadingPage on `done`. A bare deep-link has no cache/nav-state, so it redirects to /
// (C-02). These tests therefore (1) assert the deep-link redirect contract, and (2) drive the full
// stubbed Configure → Run → Result route-interception flow to land on a POPULATED /result backed by
// the REAL cached payload — never the removed fixture import, never the live API.

const __dirname = dirname(fileURLToPath(import.meta.url));
// The committed real done corpus (7 unpacked_items; the unpacked-is-SUCCESS case). Same source the
// api-poll happy path fulfils with, so /result renders the same real type keys (D/F/T) here.
const packDoneResponse = JSON.parse(
  readFileSync(join(__dirname, '../src/lib/__fixtures__/pack-done-response.json'), 'utf8'),
) as { result: unknown };

/** Fulfil POST /pack with the 202 accepted body (mirrors api-poll.spec.ts stubAccept). */
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

/** Walk a poll sequence across successive GET /jobs/** calls, sticking on the last (terminal) entry. */
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
}

test('a bare deep-link to /result with no result in memory redirects to / (C-02)', async ({
  page,
}) => {
  // No carrier nav state, no cached job → the no-result guard redirects home rather than rendering
  // an empty scene. This is the carrier contract (the result is ephemeral, never persisted).
  await page.goto('/result');
  await expect(page).toHaveURL(/\/$/);
});

test('result viewer mounts a populated Canvas without WebGL errors (via the stubbed done flow)', async ({
  page,
}) => {
  // Register the console-error collector BEFORE navigation so nothing is missed.
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await reachResultViaStubbedFlow(page);

  // The lazy /result chunk resolves and the r3f Canvas mounts a <canvas>, driven by the REAL cached
  // payload (not the removed fixture import).
  await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();

  // The overlay legend renders one row per whole-result type (D/F/T) — evidence the populated scene
  // (≥1 box mesh + chrome) mounted from the live data, not an empty scene.
  await expect(page.getByText('D', { exact: true })).toBeVisible();
  await expect(page.getByText('F', { exact: true })).toBeVisible();
  await expect(page.getByText('T', { exact: true })).toBeVisible();

  // No WebGL/three errors surfaced while building the scene.
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

test.describe('presets', () => {
  // The camera-state hook CameraPresets writes each frame (read in DEV + the preview build). The
  // assertion reads it to prove ISO/TOP/FRONT produce DISTINCT camera framings — a deterministic
  // non-reframing regression guard. Now driven through the stubbed flow to a POPULATED /result.
  type CamState = {
    position: [number, number, number];
    target: [number, number, number];
    settled: boolean;
  };

  function l2(a: readonly number[], b: readonly number[]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  // Click a preset, wait for the ~520ms transition to settle, then read the camera state AND the
  // rendered canvas pixels (PNG buffer). Returns both so the test can assert the camera moved
  // (deterministic) and the image changed (end-to-end).
  async function reframe(
    page: Page,
    name: 'ISO' | 'TOP' | 'FRONT',
  ): Promise<{ cam: CamState; png: Buffer }> {
    await page.getByRole('button', { name, exact: true }).click();
    // Wait until the in-flight preset animation reports settled at this position.
    await page.waitForFunction(() => {
      const s = (window as Window & { __cameraState?: { settled?: boolean } }).__cameraState;
      return s?.settled === true;
    });
    // Belt-and-suspenders: let damping/AA fully quiesce before the pixel readback.
    await page.waitForTimeout(250);
    const cam = (await page.evaluate(
      () => (window as Window & { __cameraState?: unknown }).__cameraState,
    )) as CamState;
    const png = await page.locator('[data-testid="r3f-canvas"]').screenshot();
    return { cam, png };
  }

  test('ISO/TOP/FRONT clicking visibly reframes the camera (distinct framings) and toggles the active button', async ({
    page,
  }) => {
    await reachResultViaStubbedFlow(page);

    const iso = page.getByRole('button', { name: 'ISO', exact: true });
    const top = page.getByRole('button', { name: 'TOP', exact: true });
    const front = page.getByRole('button', { name: 'FRONT', exact: true });

    await expect(iso).toBeVisible();
    await expect(top).toBeVisible();
    await expect(front).toBeVisible();

    // Active button carries the accent background class (rgba(99,90,245,0.32)) and white text;
    // inactive buttons do not. Initial frame = ISO.
    const accent = /bg-\[rgba\(99,90,245,0\.32\)\]/;
    await expect(iso).toHaveClass(accent);

    // Reframe to each preset and capture camera state + canvas pixels.
    const top_ = await reframe(page, 'TOP');
    await expect(top).toHaveClass(accent);
    await expect(iso).not.toHaveClass(accent);

    const front_ = await reframe(page, 'FRONT');
    await expect(front).toHaveClass(accent);
    await expect(top).not.toHaveClass(accent);

    const iso_ = await reframe(page, 'ISO');
    await expect(iso).toHaveClass(accent);
    await expect(front).not.toHaveClass(accent);

    // ----- THE REGRESSION GUARD -----
    // 1) Camera positions must be DISTINCT between the three presets. On a non-reframing build
    //    (presets that never move the camera) these collapse to one framing, so every pairwise
    //    distance is ~0 — this assertion FAILS there (verified: simulated regression yields 0).
    const MIN_CAM_DELTA = 1; // mm; presets are hundreds of mm apart, so this is generous
    expect(l2(top_.cam.position, front_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);
    expect(l2(top_.cam.position, iso_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);
    expect(l2(front_.cam.position, iso_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);

    // TOP must look straight down: camera x≈target x and z≈target z, well above it.
    expect(Math.abs(top_.cam.position[0] - top_.cam.target[0])).toBeLessThan(5);
    expect(Math.abs(top_.cam.position[2] - top_.cam.target[2])).toBeLessThan(5);
    expect(top_.cam.position[1]).toBeGreaterThan(top_.cam.target[1]);

    // 2) The rendered canvas pixels must also DIFFER between presets (end-to-end proof the distinct
    //    camera actually changed what's drawn, not just state).
    expect(top_.png.equals(front_.png)).toBe(false);
    expect(top_.png.equals(iso_.png)).toBe(false);
    expect(front_.png.equals(iso_.png)).toBe(false);
  });
});

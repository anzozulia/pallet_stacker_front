import { expect, test } from '@playwright/test';

// Proves RESULT-01 (viewer renders) + RESULT-02 (preset switching) against the
// REAL preview build (playwright.config.ts webServer = build && preview), copying
// e2e/smoke.spec.ts's console-error pattern. The qualitative visual + camera-feel
// judgment (mockup fidelity, framing, easing, boxes-on-deck) is the human
// checkpoint in 02-02-PLAN Task 4 / VALIDATION "Manual-Only Verifications".

test('result viewer mounts a populated Canvas without WebGL errors', async ({ page }) => {
  // Register the console-error collector BEFORE navigation so nothing is missed.
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/result');

  // The lazy /result chunk resolves and the r3f Canvas mounts a <canvas>.
  await expect(page.locator('[data-testid="r3f-canvas"]')).toBeVisible();

  // The overlay legend renders one row per whole-fixture type (D/F/T) — evidence
  // the populated scene (≥1 box mesh + chrome) mounted, not the empty scene.
  await expect(page.getByText('D', { exact: true })).toBeVisible();
  await expect(page.getByText('F', { exact: true })).toBeVisible();
  await expect(page.getByText('T', { exact: true })).toBeVisible();

  // No WebGL/three errors surfaced while building the scene.
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

test.describe('presets', () => {
  // The camera-state hook CameraPresets writes each frame (read in DEV + the
  // preview build). The strengthened assertion reads it to prove ISO/TOP/FRONT
  // produce DISTINCT camera framings — closing the gap in the old button-class-only
  // test, which false-passed on a non-reframing build (it only checked the active
  // highlight, never that the 3D camera actually moved). Verified by simulating a
  // non-reframing regression (presets collapsed to one framing): the MIN_CAM_DELTA
  // assertion below fails with received distance 0, so this guard is real.
  type CamState = {
    position: [number, number, number];
    target: [number, number, number];
    settled: boolean;
  };

  function l2(a: readonly number[], b: readonly number[]): number {
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }

  // Click a preset, wait for the ~520ms transition to settle, then read the camera
  // state AND the rendered canvas pixels (PNG buffer). Returns both so the test can
  // assert the camera moved (deterministic) and the image changed (end-to-end).
  async function reframe(
    page: import('@playwright/test').Page,
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
    await page.goto('/result');

    const iso = page.getByRole('button', { name: 'ISO', exact: true });
    const top = page.getByRole('button', { name: 'TOP', exact: true });
    const front = page.getByRole('button', { name: 'FRONT', exact: true });

    await expect(iso).toBeVisible();
    await expect(top).toBeVisible();
    await expect(front).toBeVisible();

    // Active button carries the accent background class (rgba(99,90,245,0.32)) and
    // white text; inactive buttons do not. Initial frame = ISO.
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
    // 1) Camera positions must be DISTINCT between the three presets. On the old
    //    non-reframing build these were identical (Bounds re-fit every frame), so
    //    every pairwise distance was ~0 — this assertion would FAIL there.
    const MIN_CAM_DELTA = 1; // mm; presets are hundreds of mm apart, so this is generous
    expect(l2(top_.cam.position, front_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);
    expect(l2(top_.cam.position, iso_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);
    expect(l2(front_.cam.position, iso_.cam.position)).toBeGreaterThan(MIN_CAM_DELTA);

    // TOP must look straight down: camera x≈target x and z≈target z, well above it.
    expect(Math.abs(top_.cam.position[0] - top_.cam.target[0])).toBeLessThan(5);
    expect(Math.abs(top_.cam.position[2] - top_.cam.target[2])).toBeLessThan(5);
    expect(top_.cam.position[1]).toBeGreaterThan(top_.cam.target[1]);

    // 2) The rendered canvas pixels must also DIFFER between presets (end-to-end
    //    proof the distinct camera actually changed what's drawn, not just state).
    expect(top_.png.equals(front_.png)).toBe(false);
    expect(top_.png.equals(iso_.png)).toBe(false);
    expect(front_.png.equals(iso_.png)).toBe(false);
  });
});

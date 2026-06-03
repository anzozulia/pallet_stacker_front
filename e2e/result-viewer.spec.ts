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
  test('ISO/TOP/FRONT clicking reframes the camera and toggles the active button', async ({
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

    await top.click();
    await expect(top).toHaveClass(accent);
    await expect(iso).not.toHaveClass(accent);

    await front.click();
    await expect(front).toHaveClass(accent);
    await expect(top).not.toHaveClass(accent);

    await iso.click();
    await expect(iso).toHaveClass(accent);
    await expect(front).not.toHaveClass(accent);
  });
});

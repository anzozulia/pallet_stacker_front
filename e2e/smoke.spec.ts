import { test, expect } from '@playwright/test';

// Live proof of SC-2 + SC-3b: against the real preview build, deep-link to
// /result (which also pre-validates the route Plan 04's nginx SPA fallback must
// serve), confirm the lazy chunk loads and the r3f <Canvas> mounts a real
// WebGL-backed <canvas> in Chromium, and assert ZERO webgl/three console errors.
test('result route mounts an r3f canvas without WebGL errors', async ({ page }) => {
  // Register the console-error collector BEFORE navigation so nothing is missed.
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/result');

  // The lazy /result chunk resolves and the r3f Canvas mounts a <canvas> element.
  await expect(page.locator('canvas')).toBeVisible();

  // No WebGL/three errors surfaced while mounting the empty scene.
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

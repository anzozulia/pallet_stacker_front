import { test, expect } from '@playwright/test';

// Live proof of DATA-02 / SC-5 — the refresh-safety headline feature — against the REAL
// preview production build (the same static `dist/` Docker serves and the eager `/` chunk,
// C-05): type a recognizable partial draft on `/`, force an immediate flush via Save draft,
// reload the page, and assert the edited pallet length + box label are restored intact.
// No network is involved this phase (the form only logs to the console on Run); the spec is
// fully deterministic. Mirrors the smoke-spec style (console-error collector + locators).
test('a partial draft typed on / is restored after a reload (DATA-02 / SC-5)', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');

  // Start from a known clean slot so the test is independent of prior runs.
  await page.evaluate(() => localStorage.removeItem('palletize:config:v1'));
  await page.reload();

  // Edit two recognizable fields: the pallet Length (mm) and the first box type's name.
  const PALLET_LENGTH = '1234';
  const BOX_LABEL = 'Reload Survivor';

  const lengthInput = page.locator('input[name="pallet.length"]');
  await lengthInput.fill(PALLET_LENGTH);

  const nameInput = page.getByLabel('Box type name').first();
  await nameInput.fill(BOX_LABEL);

  // Force an immediate flush (don't race the ~400ms debounce): click Save draft.
  await page.getByRole('button', { name: 'Save draft' }).first().click();
  await expect(page.getByText('Saved ✓').first()).toBeVisible();

  // Sanity: the persisted blob carries the typed values before we reload.
  const stored = await page.evaluate(() => localStorage.getItem('palletize:config:v1'));
  expect(stored).toContain(PALLET_LENGTH);
  expect(stored).toContain(BOX_LABEL);

  // The headline feature: refresh and confirm the draft survived intact.
  await page.reload();

  await expect(page.locator('input[name="pallet.length"]')).toHaveValue(PALLET_LENGTH);
  await expect(page.getByLabel('Box type name').first()).toHaveValue(BOX_LABEL);

  // No console errors surfaced during the edit/restore cycle.
  expect(errors).toHaveLength(0);
});

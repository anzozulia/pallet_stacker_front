import { test, expect } from '@playwright/test';

// Live proof of SC-2 + SC-3b against the real preview build: a deep-link to /result
// pre-validates the route Plan 04's nginx SPA fallback must serve.
//
// CARRIER CONTRACT (Plan 06-02 / C-02): /result is no longer reachable by a bare
// `page.goto('/result')` — the page reads the `done` payload from the react-query cache
// via the `{ jobId, idToType }` carrier handed over by LoadingPage on `done`. A bare
// deep-link has no cache/nav-state, so the no-result guard redirects to / (the result is
// ephemeral, never persisted). This smoke test therefore asserts the redirect contract +
// that no webgl/three console error surfaces while the lazy chunk resolves and redirects.
// (A POPULATED /result mount is proven by result-viewer.spec.ts + api-poll.spec.ts via the
// full stubbed Configure→Run→Result flow.)
test('result route deep-link redirects home with no WebGL errors (carrier contract, C-02)', async ({
  page,
}) => {
  // Register the console-error collector BEFORE navigation so nothing is missed.
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // The lazy /result chunk resolves (nginx SPA fallback serves it), then the no-result guard
  // redirects the bare deep-link back to / — the ephemeral-result carrier contract.
  await page.goto('/result');
  await expect(page).toHaveURL(/\/$/);

  // No WebGL/three errors surfaced while the lazy chunk resolved + redirected.
  expect(errors.filter((e) => /webgl|three/i.test(e))).toHaveLength(0);
});

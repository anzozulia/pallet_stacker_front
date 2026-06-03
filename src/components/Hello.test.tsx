import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
// Imported via the `@/` alias on purpose: this proves the alias resolves inside
// Vitest (not just Vite) — the test-config tsconfigPaths() seam (Pitfall 4).
// NOTE: never import ResultPage/Canvas/@react-three here — jsdom has no WebGL,
// so the Canvas-mount assertion lives only in the Playwright smoke (Pitfall 2).
import Hello from '@/components/Hello';

test('renders the Palletize heading', () => {
  render(<Hello />);
  // toBeInTheDocument comes from @testing-library/jest-dom (wired in setup.ts),
  // confirming the matcher augmentation is live.
  expect(screen.getByRole('heading', { name: 'Palletize' })).toBeInTheDocument();
});

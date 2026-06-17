import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
// Imported via the `@/` alias on purpose: this proves the alias resolves inside
// Vitest (not just Vite) — the test-config tsconfigPaths() seam (Pitfall 4).
// Keep jsdom tests free of any 3D/WebGL imports — jsdom has no WebGL context, so
// the live render assertion belongs only in the Playwright smoke (Pitfall 2).
import Hello from '@/components/Hello';

test('renders the Pallet Packer heading', () => {
  render(<Hello />);
  // toBeInTheDocument comes from @testing-library/jest-dom (wired in setup.ts),
  // confirming the matcher augmentation is live.
  expect(screen.getByRole('heading', { name: 'Pallet Packer' })).toBeInTheDocument();
});

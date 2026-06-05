// jsdom-WebGL-free component test for the /loading happy-path slice (Plan 05-03 Task 1).
// Drives LoadingPage through the real submit→poll lifecycle against the MSW transport (no live API,
// no three/Canvas): asserts the tally-derived summary card renders the honest values, the sub-line
// shows the HONEST status text (Queued / Packing…, never the mockup's cycling flavor text or a fake
// %), and that reaching `done` navigates toward /result with replace. `useNavigate` is spied so the
// navigation INTENT is asserted without a real route change; `useLocation` + MemoryRouter carry the
// nav state. The `@/` alias resolves via Vitest.
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { server } from '@/test/msw/server';
import { makePollSequence } from '@/test/msw/handlers';
import { renderWithClient } from '@/test/msw/renderWithClient';
import type { PackRequest } from '@/types/pack-contract';
import LoadingPage from '@/routes/LoadingPage';

// Spy useNavigate; keep the rest of react-router real (MemoryRouter + useLocation).
const navigateSpy = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateSpy };
});

// A minimal hand-built nav payload: two box types expanded (D=2 units, F=1 unit) so types=2,
// units=3, estKg = 2*4 + 1*9 = 17. Pallet 1200 × 800 × 1800.
function makeNavState(): { request: PackRequest; idToType: Map<string, string> } {
  const request: PackRequest = {
    boxes: [
      { id: 'D-0', length: 400, width: 300, height: 200, weight: 4, rotations: 'all' },
      { id: 'D-1', length: 400, width: 300, height: 200, weight: 4, rotations: 'all' },
      { id: 'F-0', length: 500, width: 400, height: 300, weight: 9, rotations: 'all' },
    ],
    pallet: { length: 1200, width: 800, height: 1800, max_weight: 1000, max_overhang: 30 },
    options: { max_pallets: 1, time_budget_s: 25, seed: 7, support_ratio: 0.8 },
  };
  const idToType = new Map<string, string>([
    ['D-0', 'D'],
    ['D-1', 'D'],
    ['F-0', 'F'],
  ]);
  return { request, idToType };
}

function renderLoading(state = makeNavState()) {
  return renderWithClient(
    <MemoryRouter initialEntries={[{ pathname: '/loading', state }]}>
      <LoadingPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
});
afterEach(() => {
  vi.clearAllMocks();
});

describe('LoadingPage — happy-path submit→poll→summary→navigate (Plan 05-03)', () => {
  test('renders the tally-derived job-summary card from the nav state', async () => {
    server.use(makePollSequence([{ status: 'queued' }, { status: 'running' }, { status: 'done' }]));
    renderLoading();

    expect(await screen.findByText('1200 × 800 × 1800 mm')).toBeInTheDocument();
    expect(screen.getByText('2 types · 3 units')).toBeInTheDocument();
    expect(screen.getByText('17 kg')).toBeInTheDocument();
  });

  test('the status sub-line shows HONEST status text (not mockup flavor text, no %)', async () => {
    // Hold on running so the honest "Packing…" sub-line is observable before done.
    server.use(
      makePollSequence([{ status: 'running' }, { status: 'running' }, { status: 'done' }]),
    );
    renderLoading();

    const status = await screen.findByRole('status');
    await waitFor(() => expect(status).toHaveTextContent('Packing…'));
    // Honesty guarantees: no fake percentage, none of the mockup's cycling flavor lines.
    expect(status).not.toHaveTextContent('%');
    expect(status).not.toHaveTextContent(/Generating candidate placements|Finalising layout/);
  });

  test('reaching done navigates to /result with replace, carrying { jobId, idToType }', async () => {
    server.use(makePollSequence([{ status: 'queued' }, { status: 'running' }, { status: 'done' }]));
    renderLoading();

    // queued→running→done spans ~2 poll intervals (POLL_INTERVAL_MS=1000), so allow ample time.
    // The done-nav now carries the carrier so /result can read the cached payload + recover types.
    await waitFor(
      () =>
        expect(navigateSpy).toHaveBeenCalledWith(
          '/result',
          expect.objectContaining({
            replace: true,
            state: expect.objectContaining({
              jobId: expect.any(String),
              idToType: expect.any(Map),
            }),
          }),
        ),
      { timeout: 5000 },
    );
  });

  test('a deep-link with NO nav state redirects home rather than crashing (T-5-07)', async () => {
    renderWithClient(
      <MemoryRouter initialEntries={['/loading']}>
        <LoadingPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true }));
  });

  test('a crafted/malformed nav state redirects home rather than render-crashing (WR-04)', async () => {
    // `request: {}` (no boxes array, no pallet) + a plain-object idToType would crash on
    // `request.boxes.map(...)` / `idToType.values()`. The hardened guard must reject it and
    // redirect home instead, exactly like the no-state deep-link path.
    renderWithClient(
      <MemoryRouter
        initialEntries={[{ pathname: '/loading', state: { request: {}, idToType: {} } }]}
      >
        <LoadingPage />
      </MemoryRouter>,
    );
    await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('LoadingPage — terminal-state distinction + cancel (Plan 05-04)', () => {
  test("a failed job shows the distinct 'failed' card with the server's error message (no crash)", async () => {
    server.use(
      makePollSequence([
        { status: 'running' },
        { status: 'failed', error: { code: 'SOLVER_ERROR', message: 'overhang exceeded' } },
      ]),
    );
    renderLoading();

    // running→failed spans ~1 poll interval (POLL_INTERVAL_MS=1000); allow ample time.
    expect(await screen.findByText('overhang exceeded', {}, { timeout: 5000 })).toBeInTheDocument();
    // It is rendered inside the alert error card, NOT a navigation to /result.
    expect(screen.getByRole('alert')).toHaveTextContent('Packing failed');
    expect(navigateSpy).not.toHaveBeenCalledWith('/result', { replace: true });
  });

  test("a timeout job shows the distinct 'ran out of time' card (no crash)", async () => {
    server.use(makePollSequence([{ status: 'running' }, { status: 'timeout' }]));
    renderLoading();

    expect(await screen.findByText(/ran out of time/i, {}, { timeout: 5000 })).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalledWith('/result', { replace: true });
  });

  test("a network throw shows the distinct 'unreachable' card and the app does not crash", async () => {
    server.use(makePollSequence([{ status: 'running' }, 'throw']));
    renderLoading();

    expect(
      await screen.findByText(/couldn't reach the packing service/i, {}, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalledWith('/result', { replace: true });
  });

  test('a done body with unpacked_items > 0 is SUCCESS → navigates to /result (not an error)', async () => {
    // The committed fixture has 7 unpacked_items; a `done` with that body must still route to /result.
    server.use(makePollSequence([{ status: 'running' }, { status: 'done' }]));
    renderLoading();

    await waitFor(
      () =>
        expect(navigateSpy).toHaveBeenCalledWith(
          '/result',
          expect.objectContaining({ replace: true, state: expect.any(Object) }),
        ),
      { timeout: 5000 },
    );
    // Not treated as an error: no error card rendered on the way.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('Cancel returns to / and leaves no pending poll (no post-unmount state update)', async () => {
    const user = userEvent.setup();
    // A long non-terminal sequence so the job is still polling when we cancel.
    server.use(
      makePollSequence([
        { status: 'queued' },
        { status: 'running' },
        { status: 'running' },
        { status: 'running' },
      ]),
    );
    const { unmount } = renderLoading();

    const cancel = await screen.findByRole('button', { name: 'Cancel' });
    await user.click(cancel);

    // Cancel navigates home (NOT a replace — Cancel is a normal back-to-configure).
    expect(navigateSpy).toHaveBeenCalledWith('/');
    // Unmount mid-flight: react-query auto-cancels the poll; assert no late act() warning / hang.
    unmount();
    // Give any (incorrectly) still-armed interval a chance to fire and complain.
    await new Promise((r) => setTimeout(r, 50));
    expect(navigateSpy).not.toHaveBeenCalledWith('/result', { replace: true });
  });
});

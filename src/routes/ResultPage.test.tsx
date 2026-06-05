// jsdom-WebGL-free component test for the /result carrier slice (Plan 06-02 Task 2).
// Proves the wiring half of the vertical slice WITHOUT rendering real WebGL:
//   (a) a valid nav state + a cached `done` job → the scene/topbar mount, NO redirect;
//   (b) no nav state → redirect to '/';
//   (c) a jobId whose cache entry is missing → redirect to '/';
//   (d) a non-trivial idToType reaches mapDoneResponse so map-PRIMARY recovery applies
//       (the recovered type differs from the typeKeyOf parse-fallback — Pitfall 1).
//
// The r3f <Canvas> + viewer subtree is MOCKED (jsdom has no WebGL, Pitfall 2); we assert the
// redirect/mapper/topbar DOM, never the 3D pixels. `useNavigate` is spied so the navigation
// INTENT is asserted without a real route change; MemoryRouter + useLocation carry the nav state.
// The production `queryClient` singleton is the carrier ResultPage reads, so we seed it directly
// and clear it between tests. `@/` resolves via Vitest.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { queryClient } from '@/api/queryClient';
import type { JobState } from '@/api/pack-schema';
import type { DoneResult } from '@/types/pack-contract';

// Spies are declared via vi.hoisted so they are initialised BEFORE the hoisted vi.mock factories run.
const { navigateSpy, mapSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn(), mapSpy: vi.fn() }));

// Spy useNavigate; keep the rest of react-router real (MemoryRouter + useLocation).
vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigateSpy };
});

// Spy mapDoneResponse so we can assert the idToType carrier reaches it (Pitfall 1) while keeping
// the real grouping behaviour for the render path. The spy DELEGATES to the real impl so its
// recorded return value (mapSpy.mock.results[0].value) is the genuine ResultView.
vi.mock('@/lib/result-mapper', async () => {
  const actual = await vi.importActual<typeof import('@/lib/result-mapper')>('@/lib/result-mapper');
  mapSpy.mockImplementation((done, idToType) => actual.mapDoneResponse(done, idToType));
  return { ...actual, mapDoneResponse: mapSpy };
});

// Mock the WebGL viewer subtree — jsdom has no WebGL context, so the real <Canvas>/three meshes
// cannot mount. The mocks render lightweight DOM stand-ins so the redirect/topbar/mapper wiring is
// fully assertable. (The real canvas + camera presets are proven in Playwright, never jsdom.)
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: { children?: React.ReactNode } & Record<string, unknown>) => (
    <div data-testid="r3f-canvas" data-mock-canvas {...props}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/viewer/Boxes', () => ({
  Boxes: () => <div data-testid="boxes" />,
  buildPalette: () => new Map<string, string>([['D', '#111111']]),
}));
vi.mock('@/components/viewer/Pallet', () => ({ Pallet: () => <div data-testid="pallet" /> }));
vi.mock('@/components/viewer/CameraPresets', () => ({
  CameraPresets: () => <div data-testid="camera-presets" />,
}));
// CogMarker uses drei <Line>, which calls useThree() and throws outside a real <Canvas> (jsdom has
// no WebGL). Mock it like the rest of the viewer subtree — the real CoG marker + drop-line are
// proven in Playwright (Plan 06-05 diagnostics e2e), never jsdom.
vi.mock('@/components/viewer/CogMarker', () => ({
  CogMarker: () => <div data-testid="cog-marker" />,
}));

import ResultPage from '@/routes/ResultPage';

const JOB_ID = 'job-result-test-1';

/** A minimal but shape-complete `done` result: one pallet with one placement + one unpacked item. */
function makeDoneResult(): DoneResult {
  return {
    input_summary: {
      items_packed: 1,
      items_unpacked: 1,
      pallets_used: 1,
      total_volume_utilisation: 0.5,
    },
    pallets: [
      {
        pallet_id: 'P001',
        dimensions: { L: 1200, W: 800, H: 1800, max_weight: 1000 },
        utilisation: 0.5,
        cog: { x: 600, y: 400, z: 300 },
        total_weight: 12,
        items: [
          {
            item_id: 'Da-0',
            position: { x: 0, y: 0, z: 0 },
            dimensions: { L: 400, W: 300, H: 200 },
            orientation: { perm: [0, 1, 2], name: 'as-is' },
            weight: 12,
            support_ratio: 1,
            supported_by: [],
            supports: [],
          },
        ],
      },
    ],
    unpacked_items: [
      { item_id: 'Da-9', dimensions: { L: 1, W: 1, H: 1 }, weight: 1, reason: 'too big' },
    ],
  };
}

function seedCache(jobId: string, status: JobState['status'] = 'done'): void {
  const done: JobState = { job_id: jobId, status, result: makeDoneResult() };
  queryClient.setQueryData(['job', jobId], done);
}

function renderResult(state: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/result', state }]}>
      <ResultPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateSpy.mockClear();
  mapSpy.mockClear();
});
afterEach(() => {
  // Clear recorded calls only — do NOT reset mock IMPLEMENTATIONS (mapSpy delegates to the real
  // mapper; vi.clearAllMocks would strip that and break later tests).
  navigateSpy.mockClear();
  mapSpy.mockClear();
  queryClient.clear();
});

describe('ResultPage — live cache carrier read + redirect + idToType threading (Plan 06-02)', () => {
  test('(a) valid jobId + cached done job → scene + topbar mount, NO redirect', () => {
    seedCache(JOB_ID);
    renderResult({ jobId: JOB_ID });

    // The mocked canvas mounted (real data drove the page, not the removed fixture).
    expect(screen.getByTestId('r3f-canvas')).toBeInTheDocument();
    // The result topbar shell renders the Edit-configuration affordance and the Result step.
    expect(screen.getByRole('button', { name: /Edit configuration/i })).toBeInTheDocument();
    // No Export / Solved-in chrome this phase (D-07).
    expect(screen.queryByText(/Export/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Solved in/i)).not.toBeInTheDocument();
    // Did NOT redirect home.
    expect(navigateSpy).not.toHaveBeenCalledWith('/', { replace: true });
  });

  test('(b) no nav state → redirect to /', () => {
    renderResult(null);
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true });
  });

  test('(c) jobId whose cache entry is missing → redirect to /', () => {
    // Cache is empty (cleared in afterEach) — an unknown jobId has no cached done job.
    renderResult({ jobId: 'no-such-job' });
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true });
  });

  test('(c2) a cached job that is NOT done (still running) → redirect to /', () => {
    seedCache(JOB_ID, 'running');
    renderResult({ jobId: JOB_ID });
    expect(navigateSpy).toHaveBeenCalledWith('/', { replace: true });
  });

  test('(d) a non-trivial idToType reaches mapDoneResponse (map-PRIMARY recovery, Pitfall 1)', () => {
    seedCache(JOB_ID);
    // 'Da-0' parses to typeKeyOf -> 'Da' (the fallback). The carrier map renames it to 'WIDGET',
    // proving the idToType actually reached the mapper rather than the parse fallback.
    const idToType = new Map<string, string>([
      ['Da-0', 'WIDGET'],
      ['Da-9', 'WIDGET'],
    ]);
    renderResult({ jobId: JOB_ID, idToType });

    expect(mapSpy).toHaveBeenCalled();
    const [, passedMap] = mapSpy.mock.calls[0];
    expect(passedMap).toBe(idToType);
    // The mapped view recovered the carrier type ('WIDGET'), not the 'Da' parse-fallback.
    const view = mapSpy.mock.results[0].value as {
      pallets: Array<{ items: Array<{ typeId: string }> }>;
    };
    expect(view.pallets[0].items[0].typeId).toBe('WIDGET');
  });
});

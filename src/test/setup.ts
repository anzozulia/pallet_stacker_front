// Registers the @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
// with Vitest's expect and augments the global matcher types for TypeScript.
import '@testing-library/jest-dom/vitest';

// MSW lifecycle (Pitfall 6): one server intercepts the whole suite. `onUnhandledRequest:
// 'error'` makes any un-stubbed network call FAIL the test loudly instead of escaping to a
// real endpoint — it only fires on actual requests, so the WebGL-free unit suite (which
// makes none) is unaffected. resetHandlers() after each test undoes per-test `server.use`
// overrides so scripted poll sequences don't bleed across tests.
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

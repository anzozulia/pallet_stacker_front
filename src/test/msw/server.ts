// The Node MSW server instance (jsdom test environment). `setupServer` comes from
// `msw/node` (the v2 entrypoint). The lifecycle (listen/resetHandlers/close) is wired in
// src/test/setup.ts so every test file shares one intercepting server (Pitfall 6).
import { setupServer } from 'msw/node';
import { handlers } from '@/test/msw/handlers';

export const server = setupServer(...handlers);

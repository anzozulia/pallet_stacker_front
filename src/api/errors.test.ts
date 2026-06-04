import { describe, expect, it } from 'vitest';
// Three-free taxonomy test: pins the transport-failure bucketing (D-07 / SC-4 transport
// half). Proves the four buckets — unreachable (incl. opaque CORS TypeError), aborted,
// contract-drift (ZodError), and the safe unreachable default for an unknown throw.
import { z } from 'zod';
import { PackError, classifyFetchError, isClientRejection } from '@/api/errors';

describe('classifyFetchError — the four transport buckets (D-07)', () => {
  it('returns the kind carried by a PackError', () => {
    expect(classifyFetchError(new PackError('unreachable'))).toBe('unreachable');
  });

  it('classifies a DOMException AbortError as "aborted"', () => {
    const abort = new DOMException('aborted', 'AbortError');
    expect(classifyFetchError(abort)).toBe('aborted');
  });

  it('classifies a TypeError (opaque CORS / failed-to-fetch) as "unreachable"', () => {
    expect(classifyFetchError(new TypeError('Failed to fetch'))).toBe('unreachable');
  });

  it('classifies a ZodError as "contract-drift"', () => {
    const zerr = z.string().safeParse(5);
    expect(zerr.success).toBe(false);
    expect(classifyFetchError((zerr as { error: unknown }).error)).toBe('contract-drift');
  });

  it('returns the safe "unreachable" default for an unknown throw', () => {
    expect(classifyFetchError('a bare string')).toBe('unreachable');
    expect(classifyFetchError(undefined)).toBe('unreachable');
  });
});

describe('PackError', () => {
  it('carries a kind and a message and is an Error', () => {
    const e = new PackError('unreachable', 'HTTP 503');
    expect(e).toBeInstanceOf(Error);
    expect(e.kind).toBe('unreachable');
    expect(e.message).toBe('HTTP 503');
    expect(e.name).toBe('PackError');
  });

  it('optionally carries the HTTP status and response body detail (WR-02)', () => {
    const e = new PackError('unreachable', 'HTTP 400', { status: 400, detail: 'bad pallet' });
    expect(e.status).toBe(400);
    expect(e.detail).toBe('bad pallet');
  });
});

describe('isClientRejection — 4xx distinction (WR-02)', () => {
  it('is true for a 4xx PackError (server reached + rejected — no blind-Retry value)', () => {
    expect(isClientRejection(new PackError('unreachable', 'HTTP 400', { status: 400 }))).toBe(true);
    expect(isClientRejection(new PackError('unreachable', 'HTTP 422', { status: 422 }))).toBe(true);
  });

  it('is false for a 5xx, a status-less network throw, or a non-PackError', () => {
    expect(isClientRejection(new PackError('unreachable', 'HTTP 503', { status: 503 }))).toBe(
      false,
    );
    expect(isClientRejection(new PackError('unreachable'))).toBe(false);
    expect(isClientRejection(new TypeError('Failed to fetch'))).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
// jsdom-WebGL-free, three-free contract test: pins the zod network-boundary schema
// (C-02). Feeds the schema the REAL `done` corpus so a tightened `status` union + a
// non-strict (forward-compat-tolerant) object shape are both proven against live data.
import { ZodError } from 'zod';
import packDoneResponse from '@/lib/__fixtures__/pack-done-response.json';
import { jobAcceptedSchema, jobStateSchema } from '@/api/pack-schema';

describe('jobStateSchema — the network boundary (C-02)', () => {
  it('parses the real pack-done-response fixture and yields status === "done"', () => {
    const parsed = jobStateSchema.parse(packDoneResponse);
    expect(parsed.status).toBe('done');
    expect(parsed.job_id).toBe('ead54451c2ef4fc7a27555f264ea96a6');
  });

  it('accepts every status in the closed union', () => {
    for (const status of ['queued', 'running', 'done', 'failed', 'timeout'] as const) {
      const parsed = jobStateSchema.parse({ job_id: 'j1', status });
      expect(parsed.status).toBe(status);
    }
  });

  it('rejects an unknown status with a ZodError', () => {
    expect(() => jobStateSchema.parse({ job_id: 'j1', status: 'processing' })).toThrow(ZodError);
  });

  it('tolerates EXTRA unknown keys (non-strict / forward-compat per Pitfall 5)', () => {
    const parsed = jobStateSchema.parse({
      job_id: 'j1',
      status: 'done',
      result: { input_summary: {}, future_field: 42 },
      brand_new_top_level_field: 'should not throw',
    });
    expect(parsed.status).toBe('done');
  });

  it('safeParse returns success:false on a malformed body (missing job_id)', () => {
    const r = jobStateSchema.safeParse({ status: 'done' });
    expect(r.success).toBe(false);
  });

  it('safeParse returns success:false when status is not a string', () => {
    const r = jobStateSchema.safeParse({ job_id: 'j1', status: 5 });
    expect(r.success).toBe(false);
  });
});

describe('jobAcceptedSchema — POST 202 body', () => {
  it('parses a well-formed accepted body', () => {
    const parsed = jobAcceptedSchema.parse({
      job_id: 'j1',
      status: 'queued',
      links: { self: '/api/v1/jobs/j1' },
    });
    expect(parsed.job_id).toBe('j1');
    expect(parsed.status).toBe('queued');
    expect(parsed.links?.self).toBe('/api/v1/jobs/j1');
  });

  it('accepts a 202 body that OMITS links (WR-03: links is unused, must be tolerant)', () => {
    const parsed = jobAcceptedSchema.parse({ job_id: 'j2', status: 'queued' });
    expect(parsed.job_id).toBe('j2');
    expect(parsed.status).toBe('queued');
    expect(parsed.links).toBeUndefined();
  });
});

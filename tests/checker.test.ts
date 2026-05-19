import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkService } from '../src/checker.js';
import type { ServiceConfig } from '../src/types.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const baseConfig: ServiceConfig = {
  name: 'Test Service',
  request: {
    url: 'https://example.com/api',
    method: 'GET',
  },
  intervalSeconds: 30,
};

beforeEach(() => {
  mockFetch.mockReset();
});

describe('checkService', () => {
  it('returns success=true for 2xx response', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'OK' });
    const result = await checkService(baseConfig);
    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.responseBody).toBe('OK');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('uses slugified name as serviceId when id is not set', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });
    const result = await checkService(baseConfig);
    expect(result.serviceId).toBe('test-service');
  });

  it('uses String(config.id) as serviceId when id is set', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });
    const result = await checkService({ ...baseConfig, id: 42 });
    expect(result.serviceId).toBe('42');
  });

  it('returns success=false for 5xx response', async () => {
    mockFetch.mockResolvedValue({ status: 500, text: async () => 'Error' });
    const result = await checkService(baseConfig);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(500);
  });

  it('returns success=false for 4xx response', async () => {
    mockFetch.mockResolvedValue({ status: 404, text: async () => 'Not Found' });
    const result = await checkService(baseConfig);
    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(404);
  });

  it('returns success=false with error message on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await checkService(baseConfig);
    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
    expect(result.statusCode).toBeUndefined();
  });

  it('builds URL with query params', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '[]' });
    await checkService({
      name: 'Param Service',
      request: {
        url: 'https://api.example.com/items',
        method: 'GET',
        params: { limit: '10', offset: '0' },
      },
      intervalSeconds: 30,
    });
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('limit=10');
    expect(calledUrl).toContain('offset=0');
  });

  it('sends custom headers', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'ok' });
    await checkService({
      name: 'Auth Service',
      request: {
        url: 'https://api.example.com/secure',
        method: 'GET',
        headers: { Authorization: 'Bearer token123' },
      },
      intervalSeconds: 30,
    });
    const calledHeaders = mockFetch.mock.calls[0][1]?.headers as Record<string, string>;
    expect(calledHeaders?.Authorization).toBe('Bearer token123');
  });

  it('records durationMs', async () => {
    mockFetch.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return { status: 200, text: async () => 'ok' };
    });
    const result = await checkService(baseConfig);
    expect(result.durationMs).toBeGreaterThanOrEqual(5);
  });

  it('truncates long response bodies', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => 'x'.repeat(3000) });
    const result = await checkService(baseConfig);
    expect(result.responseBody?.length).toBeLessThan(3000);
    expect(result.responseBody).toContain('[truncated]');
  });

  it('includes timestamp as ISO string', async () => {
    mockFetch.mockResolvedValue({ status: 200, text: async () => '' });
    const result = await checkService(baseConfig);
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

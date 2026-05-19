import { describe, it, expect, vi } from 'vitest';
import { addClient, broadcast, getClientCount } from '../src/sse.js';
import type { CheckResult } from '../src/types.js';
import type { Response } from 'express';

function makeMockRes(): Response {
  const events: Record<string, Array<() => void>> = {};
  return {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn(),
    on: vi.fn((event: string, cb: () => void) => {
      if (!events[event]) events[event] = [];
      events[event].push(cb);
    }),
    emit: (event: string) => {
      events[event]?.forEach((cb) => cb());
    },
  } as unknown as Response;
}

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    serviceId: 'test-service',
    timestamp: new Date().toISOString(),
    success: true,
    statusCode: 200,
    durationMs: 50,
    ...overrides,
  };
}

// Reset module state between tests by re-importing via a fresh module
// Since vitest shares module state, we test client lifecycle within tests

describe('SSE', () => {
  it('sets SSE headers when client connects', () => {
    const res = makeMockRes();
    addClient(res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(res.flushHeaders).toHaveBeenCalled();
  });

  it('broadcasts data to all connected clients', () => {
    const res1 = makeMockRes();
    const res2 = makeMockRes();

    addClient(res1);
    addClient(res2);

    const result = makeResult();
    broadcast(result);

    const expected = `data: ${JSON.stringify(result)}\n\n`;
    expect(res1.write).toHaveBeenCalledWith(expected);
    expect(res2.write).toHaveBeenCalledWith(expected);
  });

  it('removes client on close event', () => {
    const res = makeMockRes() as unknown as Response & { emit: (e: string) => void };
    addClient(res);

    const countBefore = getClientCount();
    (res as unknown as { emit: (e: string) => void }).emit('close');
    const countAfter = getClientCount();

    expect(countAfter).toBe(countBefore - 1);
  });

  it('does not write to closed clients after removal', () => {
    const res = makeMockRes() as unknown as Response & { emit: (e: string) => void };
    addClient(res);

    res.emit('close');
    const writeCallsBefore = (res.write as ReturnType<typeof vi.fn>).mock.calls.length;

    broadcast(makeResult());

    expect((res.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(writeCallsBefore);
  });

  it('broadcasts correct JSON format', () => {
    const res = makeMockRes();
    addClient(res);

    const result = makeResult({ success: false, error: 'timeout' });
    broadcast(result);

    const writtenArg = (res.write as ReturnType<typeof vi.fn>).mock.calls.at(-1)[0] as string;
    expect(writtenArg).toMatch(/^data: /);
    expect(writtenArg).toMatch(/\n\n$/);

    const parsed = JSON.parse(writtenArg.replace(/^data: /, '').trim());
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe('timeout');
  });
});

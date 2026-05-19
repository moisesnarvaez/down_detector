import { describe, it, expect, beforeEach } from 'vitest';
import {
  initDb, insertResult, getLastN, clearHistory,
  getServices, getService, insertService, updateService, deleteService,
} from '../src/db.js';
import type { CheckResult } from '../src/types.js';

beforeEach(() => {
  initDb(':memory:');
});

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    serviceId: '1',
    timestamp: new Date().toISOString(),
    success: true,
    statusCode: 200,
    responseBody: 'OK',
    durationMs: 42,
    ...overrides,
  };
}

// ── Check results ─────────────────────────────────────────────────────────────

describe('insertResult / getLastN', () => {
  it('inserts and retrieves a result', () => {
    insertResult(makeResult());
    const rows = getLastN('1', 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].serviceId).toBe('1');
    expect(rows[0].success).toBe(true);
    expect(rows[0].statusCode).toBe(200);
    expect(rows[0].durationMs).toBe(42);
  });

  it('returns results in descending timestamp order', () => {
    for (let i = 0; i < 5; i++) {
      insertResult(makeResult({ timestamp: new Date(Date.now() + i * 1000).toISOString() }));
    }
    const rows = getLastN('1', 10);
    expect(rows).toHaveLength(5);
    for (let i = 0; i < rows.length - 1; i++) {
      expect(rows[i].timestamp >= rows[i + 1].timestamp).toBe(true);
    }
  });

  it('caps results at n', () => {
    for (let i = 0; i < 150; i++) {
      insertResult(makeResult({ timestamp: new Date(Date.now() + i * 1000).toISOString() }));
    }
    expect(getLastN('1', 100)).toHaveLength(100);
  });

  it('stores success=false correctly', () => {
    insertResult(makeResult({ success: false, statusCode: 500, error: 'Server Error' }));
    const rows = getLastN('1', 10);
    expect(rows[0].success).toBe(false);
    expect(rows[0].error).toBe('Server Error');
  });

  it('handles null optional fields', () => {
    insertResult(makeResult({ statusCode: undefined, responseBody: undefined, error: undefined }));
    const rows = getLastN('1', 10);
    expect(rows[0].statusCode).toBeUndefined();
    expect(rows[0].responseBody).toBeUndefined();
    expect(rows[0].error).toBeUndefined();
  });

  it('returns empty array for unknown serviceId', () => {
    expect(getLastN('999', 10)).toHaveLength(0);
  });
});

describe('clearHistory', () => {
  it('removes all check results', () => {
    insertResult(makeResult());
    insertResult(makeResult({ serviceId: '2' }));
    clearHistory();
    expect(getLastN('1', 10)).toHaveLength(0);
    expect(getLastN('2', 10)).toHaveLength(0);
  });
});

// ── Services CRUD ─────────────────────────────────────────────────────────────

const baseService = {
  name: 'Test API',
  request: { url: 'https://api.example.com', method: 'GET' as const },
  intervalSeconds: 30,
};

describe('insertService / getService / getServices', () => {
  it('inserts and retrieves a service', () => {
    const id = insertService(baseService);
    const svc = getService(id);
    expect(svc).not.toBeNull();
    expect(svc!.id).toBe(id);
    expect(svc!.name).toBe('Test API');
    expect(svc!.request.url).toBe('https://api.example.com');
    expect(svc!.request.method).toBe('GET');
    expect(svc!.intervalSeconds).toBe(30);
  });

  it('returns null for unknown id', () => {
    expect(getService(999)).toBeNull();
  });

  it('getServices returns all services in insertion order', () => {
    insertService(baseService);
    insertService({ ...baseService, name: 'Second' });
    const services = getServices();
    expect(services).toHaveLength(2);
    expect(services[0].name).toBe('Test API');
    expect(services[1].name).toBe('Second');
  });

  it('stores headers and params as objects', () => {
    const id = insertService({
      name: 'Auth API',
      request: {
        url: 'https://api.example.com/secure',
        method: 'POST',
        headers: { Authorization: 'Bearer token' },
        params: { version: '2' },
      },
      intervalSeconds: 60,
    });
    const svc = getService(id)!;
    expect(svc.request.headers).toEqual({ Authorization: 'Bearer token' });
    expect(svc.request.params).toEqual({ version: '2' });
  });
});

describe('updateService', () => {
  it('updates an existing service', () => {
    const id = insertService(baseService);
    updateService(id, { ...baseService, name: 'Updated API', intervalSeconds: 60 });
    const svc = getService(id)!;
    expect(svc.name).toBe('Updated API');
    expect(svc.intervalSeconds).toBe(60);
  });

  it('updates url and method', () => {
    const id = insertService(baseService);
    updateService(id, {
      ...baseService,
      request: { url: 'https://new.example.com', method: 'POST' },
    });
    const svc = getService(id)!;
    expect(svc.request.url).toBe('https://new.example.com');
    expect(svc.request.method).toBe('POST');
  });
});

describe('deleteService', () => {
  it('removes the service', () => {
    const id = insertService(baseService);
    deleteService(id);
    expect(getService(id)).toBeNull();
  });

  it('cascades to check_results', () => {
    const id = insertService(baseService);
    insertResult(makeResult({ serviceId: String(id) }));
    deleteService(id);
    expect(getLastN(String(id), 10)).toHaveLength(0);
  });

  it('does not affect other services', () => {
    const id1 = insertService(baseService);
    const id2 = insertService({ ...baseService, name: 'Other' });
    deleteService(id1);
    expect(getService(id2)).not.toBeNull();
  });
});

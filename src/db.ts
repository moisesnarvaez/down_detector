import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import type { CheckResult, ServiceConfig, ServiceRequest } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'results.db');

let db: Database.Database;

export function initDb(dbPath?: string): void {
  db = new Database(dbPath ?? DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'GET',
      headers TEXT NOT NULL DEFAULT '{}',
      params TEXT NOT NULL DEFAULT '{}',
      intervalSeconds INTEGER NOT NULL DEFAULT 30
    );

    CREATE TABLE IF NOT EXISTS check_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serviceId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      success INTEGER NOT NULL,
      statusCode INTEGER,
      responseBody TEXT,
      durationMs REAL NOT NULL,
      error TEXT
    );
  `);
}

// ── Services ─────────────────────────────────────────────────────────────────

function rowToServiceConfig(row: Record<string, unknown>): ServiceConfig {
  return {
    id: row.id as number,
    name: row.name as string,
    request: {
      url: row.url as string,
      method: row.method as ServiceRequest['method'],
      headers: JSON.parse(row.headers as string) as Record<string, string>,
      params: JSON.parse(row.params as string) as Record<string, string>,
    },
    intervalSeconds: row.intervalSeconds as number,
  };
}

export function getServices(): ServiceConfig[] {
  const rows = db.prepare('SELECT * FROM services ORDER BY id').all() as Array<Record<string, unknown>>;
  return rows.map(rowToServiceConfig);
}

export function getService(id: number): ServiceConfig | null {
  const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  return row ? rowToServiceConfig(row) : null;
}

export function insertService(service: Omit<ServiceConfig, 'id'>): number {
  const result = db.prepare(`
    INSERT INTO services (name, url, method, headers, params, intervalSeconds)
    VALUES (@name, @url, @method, @headers, @params, @intervalSeconds)
  `).run({
    name: service.name,
    url: service.request.url,
    method: service.request.method,
    headers: JSON.stringify(service.request.headers ?? {}),
    params: JSON.stringify(service.request.params ?? {}),
    intervalSeconds: service.intervalSeconds,
  });
  return result.lastInsertRowid as number;
}

export function updateService(id: number, service: Omit<ServiceConfig, 'id'>): void {
  db.prepare(`
    UPDATE services
    SET name = @name, url = @url, method = @method,
        headers = @headers, params = @params, intervalSeconds = @intervalSeconds
    WHERE id = @id
  `).run({
    id,
    name: service.name,
    url: service.request.url,
    method: service.request.method,
    headers: JSON.stringify(service.request.headers ?? {}),
    params: JSON.stringify(service.request.params ?? {}),
    intervalSeconds: service.intervalSeconds,
  });
}

export function deleteService(id: number): void {
  db.prepare('DELETE FROM check_results WHERE serviceId = ?').run(String(id));
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
}

// ── Check results ─────────────────────────────────────────────────────────────

export function insertResult(result: CheckResult): void {
  db.prepare(`
    INSERT INTO check_results (serviceId, timestamp, success, statusCode, responseBody, durationMs, error)
    VALUES (@serviceId, @timestamp, @success, @statusCode, @responseBody, @durationMs, @error)
  `).run({
    ...result,
    success: result.success ? 1 : 0,
    statusCode: result.statusCode ?? null,
    responseBody: result.responseBody ?? null,
    error: result.error ?? null,
  });
}

export function getLastN(serviceId: string, n = 100): CheckResult[] {
  const rows = db.prepare(`
    SELECT * FROM check_results
    WHERE serviceId = ?
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(serviceId, n) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: row.id as number,
    serviceId: row.serviceId as string,
    timestamp: row.timestamp as string,
    success: Boolean(row.success),
    statusCode: row.statusCode != null ? (row.statusCode as number) : undefined,
    responseBody: row.responseBody != null ? (row.responseBody as string) : undefined,
    durationMs: row.durationMs as number,
    error: row.error != null ? (row.error as string) : undefined,
  }));
}

export function clearHistory(): void {
  db.prepare('DELETE FROM check_results').run();
}

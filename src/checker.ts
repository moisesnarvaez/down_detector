import type { ServiceConfig, CheckResult } from './types.js';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function checkService(config: ServiceConfig): Promise<CheckResult> {
  const serviceId = config.id !== undefined ? String(config.id) : slugify(config.name);
  const timestamp = new Date().toISOString();

  let url = config.request.url;
  if (config.request.params && Object.keys(config.request.params).length > 0) {
    const searchParams = new URLSearchParams(config.request.params);
    url = `${url}?${searchParams.toString()}`;
  }

  const start = Date.now();

  try {
    const response = await fetch(url, {
      method: config.request.method,
      headers: config.request.headers,
      signal: AbortSignal.timeout(10000),
    });

    const durationMs = Date.now() - start;
    const success = response.status >= 200 && response.status < 300;
    let responseBody: string | undefined;

    try {
      responseBody = await response.text();
      if (responseBody.length > 2000) {
        responseBody = responseBody.slice(0, 2000) + '... [truncated]';
      }
    } catch {
      // ignore body read errors
    }

    return {
      serviceId,
      timestamp,
      success,
      statusCode: response.status,
      responseBody,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - start;
    return {
      serviceId,
      timestamp,
      success: false,
      durationMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const intervals = new Map<number, ReturnType<typeof setInterval>>();

export function scheduleService(
  service: ServiceConfig,
  onResult: (r: CheckResult) => void
): void {
  if (service.id === undefined) return;

  // Clear any existing interval for this service
  const existing = intervals.get(service.id);
  if (existing !== undefined) clearInterval(existing);

  const run = (): void => {
    checkService(service).then(onResult).catch((err: unknown) => {
      console.error(`Scheduler error for ${service.name}:`, err);
    });
  };

  run();
  intervals.set(service.id, setInterval(run, service.intervalSeconds * 1000));
}

export function unscheduleService(id: number): void {
  const existing = intervals.get(id);
  if (existing !== undefined) {
    clearInterval(existing);
    intervals.delete(id);
  }
}

export function startScheduler(
  services: ServiceConfig[],
  onResult: (r: CheckResult) => void
): void {
  for (const service of services) {
    scheduleService(service, onResult);
  }
}

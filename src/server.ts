import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { PORT } from './config.js';
import {
  initDb, insertResult, getLastN, clearHistory,
  getServices, getService, insertService, updateService, deleteService,
} from './db.js';
import { scheduleService, unscheduleService } from './checker.js';
import { addClient, broadcast } from './sse.js';
import type { Request, Response } from 'express';
import type { ServiceConfig } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const onResult = (result: Parameters<typeof broadcast>[0]): void => {
  insertResult(result);
  broadcast(result);
};

app.get('/', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ── History ───────────────────────────────────────────────────────────────────

app.get('/api/history', (_req: Request, res: Response): void => {
  const services = getServices();
  const history: Record<string, unknown[]> = {};
  for (const service of services) {
    history[String(service.id)] = getLastN(String(service.id), 100);
  }
  res.json(history);
});

app.delete('/api/history', (_req: Request, res: Response): void => {
  clearHistory();
  res.status(204).end();
});

// ── Services CRUD ─────────────────────────────────────────────────────────────

app.get('/api/services', (_req: Request, res: Response): void => {
  res.json(getServices());
});

app.post('/api/services', (req: Request, res: Response): void => {
  const body = req.body as Partial<ServiceConfig & { url: string; method: string; headers: Record<string, string>; params: Record<string, string> }>;

  if (!body.name || !body.url) {
    res.status(400).json({ error: 'name and url are required' });
    return;
  }

  const service: Omit<ServiceConfig, 'id'> = {
    name: body.name,
    request: {
      url: body.url,
      method: (body.method as ServiceConfig['request']['method']) ?? 'GET',
      headers: body.headers ?? {},
      params: body.params ?? {},
    },
    intervalSeconds: body.intervalSeconds ?? 30,
  };

  const id = insertService(service);
  const created = getService(id)!;
  scheduleService(created, onResult);
  res.status(201).json(created);
});

app.put('/api/services/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  const existing = getService(id);
  if (!existing) { res.status(404).json({ error: 'Service not found' }); return; }

  const body = req.body as Partial<ServiceConfig & { url: string; method: string; headers: Record<string, string>; params: Record<string, string> }>;

  const updated: Omit<ServiceConfig, 'id'> = {
    name: body.name ?? existing.name,
    request: {
      url: body.url ?? existing.request.url,
      method: (body.method as ServiceConfig['request']['method']) ?? existing.request.method,
      headers: body.headers ?? existing.request.headers ?? {},
      params: body.params ?? existing.request.params ?? {},
    },
    intervalSeconds: body.intervalSeconds ?? existing.intervalSeconds,
  };

  updateService(id, updated);
  const saved = getService(id)!;
  scheduleService(saved, onResult);
  res.json(saved);
});

app.delete('/api/services/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id, 10);
  if (!getService(id)) { res.status(404).json({ error: 'Service not found' }); return; }

  unscheduleService(id);
  deleteService(id);
  res.status(204).end();
});

// ── SSE ───────────────────────────────────────────────────────────────────────

app.get('/events', (req: Request, res: Response): void => {
  addClient(res);

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

initDb();

for (const service of getServices()) {
  scheduleService(service, onResult);
}

app.listen(PORT, () => {
  console.log(`Down Detector running at http://localhost:${PORT}`);
});

export default app;

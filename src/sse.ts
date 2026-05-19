import type { Response } from 'express';
import type { CheckResult } from './types.js';

const clients = new Set<Response>();

export function addClient(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.add(res);

  res.on('close', () => {
    clients.delete(res);
  });
}

export function broadcast(data: CheckResult): void {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

export function getClientCount(): number {
  return clients.size;
}

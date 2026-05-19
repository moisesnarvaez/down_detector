# Down Detector

A lightweight HTTP service-monitoring application. It polls configured endpoints on defined intervals, persists results in SQLite, and serves a live dashboard with real-time updates via Server-Sent Events. Services are managed entirely from the dashboard — no config file editing required.

## Features

- Full CRUD for monitored services from the dashboard (add, edit, delete)
- Polls any HTTP endpoint (GET, POST, PUT, DELETE, PATCH) on a per-service interval
- Supports custom headers and query parameters per service
- Stores check history in SQLite — results survive restarts
- Live dashboard updates via SSE (no polling from the browser)
- Bell sound alert (Web Audio API) on failure, with browser notifications for background tabs
- Toggle to enable/disable alerts without leaving the page
- Clear History button to wipe all check results
- Timeline of the last 100 checks per service, with collapsible response body details
- Sticky header with overall health badge

## Tech Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js 18+ (native fetch) |
| Framework | Express 4 |
| Database | better-sqlite3 (SQLite) |
| Real-time | Server-Sent Events |
| Frontend | Plain HTML + Tailwind CDN + vanilla JS |
| Dev server | tsx |
| Testing | Vitest |

## Project Structure

```
down_detector/
├── src/
│   ├── types.ts       # Shared interfaces
│   ├── config.ts      # PORT config
│   ├── db.ts          # SQLite setup, service CRUD, check result queries
│   ├── checker.ts     # HTTP polling logic, dynamic scheduler
│   ├── sse.ts         # SSE client registry and broadcast
│   └── server.ts      # Express app, routes, scheduler bootstrap
├── public/
│   └── index.html     # Dashboard (Tailwind CDN, SSE client, CRUD UI, audio alert)
├── tests/
│   ├── checker.test.ts
│   ├── db.test.ts
│   └── sse.test.ts
├── data/              # SQLite database (auto-created)
├── .env.example
├── package.json
└── tsconfig.json
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:4444](http://localhost:4444) and use **+ Add Service** to start monitoring.

## Configuration

### Port

Set `PORT` in a `.env` file or as an environment variable (default: `4444`):

```bash
cp .env.example .env
# edit PORT=4444
```

### Services

Services are managed at runtime from the dashboard. No config file editing is needed. Each service supports:

| Field | Type | Description |
|---|---|---|
| Name | `string` | Display name |
| URL | `string` | Endpoint to poll |
| Method | `string` | HTTP method (GET, POST, PUT, PATCH, DELETE) |
| Interval | `number` | How often to poll (seconds, minimum 5) |
| Headers | JSON object | Optional request headers |
| Query Params | JSON object | Optional query string parameters |

A check is considered successful when the response status is in the `2xx` range. Services and their polling schedules are updated immediately — no restart required.

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with `tsx` |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled build |
| `npm run lint` | Run ESLint over `src/` and `tests/` |
| `npm test` | Run all Vitest tests |

## API

| Endpoint | Description |
|---|---|
| `GET /` | Dashboard HTML |
| `GET /api/services` | List all configured services |
| `POST /api/services` | Create a new service |
| `PUT /api/services/:id` | Update an existing service |
| `DELETE /api/services/:id` | Delete a service and its history |
| `GET /api/history` | Last 100 check results per service (JSON) |
| `DELETE /api/history` | Clear all check results |
| `GET /events` | SSE stream — emits a `CheckResult` JSON object on every check |

### Service shape

```typescript
{
  id: number;
  name: string;
  request: {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers: Record<string, string>;
    params: Record<string, string>;
  };
  intervalSeconds: number;
}
```

### `CheckResult` shape

```typescript
{
  id?: number;
  serviceId: string;       // String(service.id)
  timestamp: string;       // ISO 8601
  success: boolean;        // true = 2xx
  statusCode?: number;
  responseBody?: string;   // truncated at 2000 chars
  durationMs: number;
  error?: string;          // network/timeout error message
}
```

## Data Persistence

Both services and check results are stored in `data/results.db` (SQLite), created automatically on first run. Deleting a service from the dashboard also removes its check history. Delete the file to reset everything.

## Tests

```bash
npm test
```

32 tests across three files:

- **`checker.test.ts`** — URL building, success/failure detection, id-based vs slug-based serviceId, header forwarding, body truncation, duration measurement
- **`db.test.ts`** — check result insert/ordering/cap, service CRUD (insert, get, update, delete, cascade to history)
- **`sse.test.ts`** — SSE headers, multi-client broadcast, client removal on close

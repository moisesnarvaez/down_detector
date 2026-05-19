export interface ServiceRequest {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ServiceConfig {
  id?: number;
  name: string;
  request: ServiceRequest;
  intervalSeconds: number;
}

export interface CheckResult {
  id?: number;
  serviceId: string;
  timestamp: string;
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  durationMs: number;
  error?: string;
}

import { NextResponse } from 'next/server';

type TelemetryValue = string | number | boolean | null | undefined;
type TelemetryFields = Record<string, TelemetryValue>;

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function durationMs(startedAt: number) {
  return Math.max(0, Math.round((now() - startedAt) * 10) / 10);
}

function withTimingHeaders(response: Response, duration: number) {
  response.headers.set('Server-Timing', `app;dur=${duration}`);
  response.headers.set('X-Response-Time-Ms', String(duration));
  return response;
}

export function startApiTelemetry(route: string, method: string) {
  const startedAt = now();

  return {
    finish(response: Response, fields: TelemetryFields = {}) {
      const duration = durationMs(startedAt);
      const status = response.status || 200;
      const payload = {
        event: 'api_request',
        route,
        method,
        status,
        duration_ms: duration,
        ok: status < 500,
        ...fields,
      };

      if (status >= 500) {
        console.error('[api-telemetry]', payload);
      } else {
        console.log('[api-telemetry]', payload);
      }

      return withTimingHeaders(response, duration);
    },

    fail(error: unknown, message = 'Internal server error', fields: TelemetryFields = {}) {
      const duration = durationMs(startedAt);
      const payload = {
        event: 'api_request',
        route,
        method,
        status: 500,
        duration_ms: duration,
        ok: false,
        ...fields,
      };

      console.error('[api-telemetry]', payload, error);
      const response = NextResponse.json({ error: message }, { status: 500 });
      return withTimingHeaders(response, duration);
    },
  };
}


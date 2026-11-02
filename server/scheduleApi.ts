import { SCHEDULE_MODEL, ScheduleParseError, SUPPORTED_TYPES, type ParseResult, type SupportedType } from './scheduleParser.ts';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const STATUS_PATH = '/api/schedule-import/status';
export const IMPORT_PATH = '/api/schedule-import';

export interface ReaderStatus {
  /** True when an API key was found. */
  configured: boolean;
  /** Human-readable reason the reader can't be used, or null when it can. */
  message: string | null;
}

export interface ScheduleHandlerOptions {
  /** Current reader status; may change once the startup key check finishes. */
  status: () => ReaderStatus;
  parse: (file: { data: Uint8Array; mediaType: SupportedType }) => Promise<ParseResult>;
  rateLimit?: { max: number; windowMs: number };
  now?: () => number;
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const fail = (status: number, code: string, message: string) => json(status, { error: { code, message } });

const STATUS_FOR: Record<ScheduleParseError['code'], number> = {
  refusal: 422,
  incomplete: 422,
  unreadable: 422,
  rate_limited: 429,
  auth: 503,
  model_unavailable: 503,
  network: 502,
  upstream: 502,
};

/**
 * Platform-neutral handler (web-standard Request → Response), so the same code
 * can later run on any serverless host. Returns null for paths it doesn't own.
 * File contents are never logged or stored.
 */
export function createScheduleHandler(options: ScheduleHandlerOptions) {
  const { max, windowMs } = options.rateLimit ?? { max: 20, windowMs: 10 * 60 * 1000 };
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return async function handle(request: Request, clientId = 'local'): Promise<Response | null> {
    const { pathname } = new URL(request.url);

    if (pathname === STATUS_PATH) {
      if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET.');
      const { configured, message } = options.status();
      return json(200, { configured, message, model: SCHEDULE_MODEL, maxBytes: MAX_UPLOAD_BYTES, types: SUPPORTED_TYPES });
    }
    if (pathname !== IMPORT_PATH) return null;
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST with the file as the request body.');

    const status = options.status();
    if (!status.configured || status.message) {
      return fail(
        503,
        status.configured ? 'key_problem' : 'not_configured',
        status.message ?? 'Schedule reading isn’t set up on this computer. Add ANTHROPIC_API_KEY to .env.local and restart the app.',
      );
    }

    const recent = (hits.get(clientId) ?? []).filter((t) => now() - t < windowMs);
    if (recent.length >= max) {
      hits.set(clientId, recent);
      return fail(429, 'rate_limited', 'Too many uploads in a short time. Wait a few minutes and try again.');
    }
    recent.push(now());
    hits.set(clientId, recent);

    const mediaType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!(SUPPORTED_TYPES as readonly string[]).includes(mediaType)) {
      return fail(415, 'unsupported_type', 'Upload a PDF or an image (PNG, JPEG, WEBP or GIF).');
    }
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > MAX_UPLOAD_BYTES) return fail(413, 'too_large', 'That file is over 10 MB. Try a screenshot or a smaller PDF.');
    const data = new Uint8Array(await request.arrayBuffer());
    if (data.byteLength > MAX_UPLOAD_BYTES) return fail(413, 'too_large', 'That file is over 10 MB. Try a screenshot or a smaller PDF.');
    if (data.byteLength === 0) return fail(400, 'empty', 'The file was empty.');

    try {
      const { extraction, usage } = await options.parse({ data, mediaType: mediaType as SupportedType });
      if (!extraction.is_schedule) {
        return fail(422, 'not_a_schedule', 'This doesn’t look like a class schedule. Try a screenshot or PDF of your weekly timetable.');
      }
      return json(200, { extraction, usage });
    } catch (error) {
      if (error instanceof ScheduleParseError) return fail(STATUS_FOR[error.code], error.code, error.message);
      console.error('[schedule-import] unexpected error:', error instanceof Error ? error.message : 'unknown');
      return fail(500, 'unexpected', 'Something went wrong reading the schedule. Try again.');
    }
  };
}

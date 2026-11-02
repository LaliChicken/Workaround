import { createHash, timingSafeEqual } from 'node:crypto';
import { SCHEDULE_MODEL, ScheduleParseError, SUPPORTED_TYPES, type ParseResult, type SupportedType } from './scheduleParser.js';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const STATUS_PATH = '/api/schedule-import/status';
export const IMPORT_PATH = '/api/schedule-import';
/** Header the browser uses to send the team passcode on a hosted site. */
export const PASSCODE_HEADER = 'x-team-passcode';

export interface ReaderStatus {
  /** True when the reader can be used (an API key, and a passcode where one is required, are set up). */
  configured: boolean;
  /** Human-readable reason the reader can't be used, or null when it can. */
  message: string | null;
}

export interface ScheduleHandlerOptions {
  /** Current reader status; may change once the startup key check finishes. */
  status: () => ReaderStatus;
  parse: (file: { data: Uint8Array; mediaType: SupportedType }) => Promise<ParseResult>;
  /** When set (hosted sites), every upload must carry this passcode. */
  passcode?: string | null;
  /** Largest accepted upload; hosts may have lower request limits. */
  maxBytes?: number;
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

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Platform-neutral handler (web-standard Request → Response), so the same code
 * runs in the local dev server and in a hosted serverless function. Returns
 * null for paths it doesn't own. File contents are never logged or stored.
 */
export function createScheduleHandler(options: ScheduleHandlerOptions) {
  const { max, windowMs } = options.rateLimit ?? { max: 20, windowMs: 10 * 60 * 1000 };
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  const maxLabel = `${Math.round(maxBytes / (1024 * 1024))} MB`;
  const passcode = options.passcode?.trim() || null;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  /** Counts an attempt (uploads and passcode guesses share one budget per client). */
  const overLimit = (clientId: string) => {
    const recent = (hits.get(clientId) ?? []).filter((t) => now() - t < windowMs);
    if (recent.length >= max) {
      hits.set(clientId, recent);
      return true;
    }
    recent.push(now());
    hits.set(clientId, recent);
    return false;
  };

  /** Constant-time comparison so the passcode can't be guessed from response timing. */
  const passcodeOk = (given: string | null) => !passcode || (!!given && timingSafeEqual(digest(given.trim()), digest(passcode)));

  return async function handle(request: Request, clientId = 'local'): Promise<Response | null> {
    const { pathname } = new URL(request.url);
    const given = request.headers.get(PASSCODE_HEADER);

    if (pathname === STATUS_PATH) {
      if (request.method !== 'GET') return fail(405, 'method_not_allowed', 'Use GET.');
      if (passcode && given && overLimit(clientId)) {
        return fail(429, 'rate_limited', 'Too many attempts in a short time. Wait a few minutes and try again.');
      }
      const { configured, message } = options.status();
      return json(200, {
        configured,
        message,
        model: SCHEDULE_MODEL,
        maxBytes,
        types: SUPPORTED_TYPES,
        passcodeRequired: !!passcode,
        passcodeOk: passcode ? passcodeOk(given) : null,
      });
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

    if (overLimit(clientId)) return fail(429, 'rate_limited', 'Too many uploads in a short time. Wait a few minutes and try again.');

    if (!passcodeOk(given)) {
      return fail(401, 'passcode', given ? 'That team passcode isn’t right.' : 'Enter the team passcode to upload.');
    }

    const mediaType = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!(SUPPORTED_TYPES as readonly string[]).includes(mediaType)) {
      return fail(415, 'unsupported_type', 'Upload a PDF or an image (PNG, JPEG, WEBP or GIF).');
    }
    const tooLarge = () => fail(413, 'too_large', `That file is over ${maxLabel}. Try a screenshot or a smaller PDF.`);
    const declared = Number(request.headers.get('content-length') ?? 0);
    if (declared > maxBytes) return tooLarge();
    const data = new Uint8Array(await request.arrayBuffer());
    if (data.byteLength > maxBytes) return tooLarge();
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

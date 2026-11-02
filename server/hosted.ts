import Anthropic from '@anthropic-ai/sdk';
import { createScheduleHandler, type ScheduleHandlerOptions } from './scheduleApi.js';
import { parseSchedule } from './scheduleParser.js';

/** Vercel rejects request bodies over 4.5 MB; stay safely under it. */
export const HOSTED_MAX_BYTES = 4 * 1024 * 1024;

/**
 * The schedule reader for a hosted site (Vercel functions in /api).
 * Reads ANTHROPIC_API_KEY and TEAM_PASSCODE from the host's secret
 * environment variables; neither is ever sent to the browser. Fails closed:
 * without a passcode, upload stays off so the key can't be used by strangers.
 */
export function createHostedHandler(env: NodeJS.ProcessEnv = process.env, parse?: ScheduleHandlerOptions['parse']) {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || null;
  const passcode = env.TEAM_PASSCODE?.trim() || null;
  const client = apiKey ? new Anthropic({ apiKey, timeout: 50_000, maxRetries: 1 }) : null;

  const message = !apiKey
    ? 'Upload isn’t set up on this site yet: the site owner needs to add ANTHROPIC_API_KEY in the Vercel project settings.'
    : !passcode
      ? 'Upload is locked: the site owner needs to add TEAM_PASSCODE in the Vercel project settings.'
      : null;

  const handle = createScheduleHandler({
    status: () => ({ configured: message === null, message }),
    parse: parse ?? ((file) => parseSchedule(file, client!)),
    passcode,
    maxBytes: HOSTED_MAX_BYTES,
    rateLimit: { max: 15, windowMs: 10 * 60 * 1000 },
  });

  return async (request: Request): Promise<Response> => {
    const clientId = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    return (await handle(request, clientId)) ?? new Response('Not found', { status: 404 });
  };
}

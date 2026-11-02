// Vercel function: POST /api/schedule-import (reads one uploaded schedule).
// The API key and team passcode come from the Vercel project's environment
// variables and never reach the browser. See server/hosted.ts.
import { createHostedHandler } from '../../server/hosted.js';

export const config = { maxDuration: 60 };

const handle = createHostedHandler();

export function POST(request: Request) {
  return handle(request);
}

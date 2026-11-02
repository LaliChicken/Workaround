// Vercel function: GET /api/schedule-import/status (is upload on, is the passcode right).
import { createHostedHandler } from '../../server/hosted.js';

const handle = createHostedHandler();

export function GET(request: Request) {
  return handle(request);
}

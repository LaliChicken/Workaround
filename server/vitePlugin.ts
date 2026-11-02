import Anthropic from '@anthropic-ai/sdk';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv, type Plugin } from 'vite';
import { createScheduleHandler, MAX_UPLOAD_BYTES } from './scheduleApi';
import { parseSchedule } from './scheduleParser';

type Handler = ReturnType<typeof createScheduleHandler>;

/**
 * Serves /api/schedule-import from `npm run dev` and `npm run preview`.
 * ANTHROPIC_API_KEY is read on the server only (no VITE_ prefix), so it is
 * never bundled into the browser code.
 */
export function scheduleApi(): Plugin {
  let handler: Handler | null = null;

  const middleware = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!handler || !req.url?.startsWith('/api/schedule-import')) return next();
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_UPLOAD_BYTES) {
          res.writeHead(413, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: { code: 'too_large', message: 'That file is over 10 MB. Try a screenshot or a smaller PDF.' } }));
          req.destroy();
          return;
        }
        chunks.push(chunk as Buffer);
      }
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers.set(key, value);
      }
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(`http://localhost${req.url}`, {
        method: req.method,
        headers,
        body: hasBody ? Buffer.concat(chunks) : undefined,
      });
      const response = await handler(request, req.socket.remoteAddress ?? 'local');
      if (!response) return next();
      res.statusCode = response.status;
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: { code: 'unexpected', message: 'Something went wrong reading the schedule. Try again.' } }));
    }
  };

  return {
    name: 'workaround-schedule-api',
    configResolved(config) {
      const env = loadEnv(config.mode, config.root, '');
      const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
      const client = apiKey ? new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 }) : null;
      handler = createScheduleHandler({
        configured: client !== null,
        parse: (file) => parseSchedule(file, client!),
      });
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

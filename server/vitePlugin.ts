import Anthropic from '@anthropic-ai/sdk';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { Logger, Plugin, ResolvedConfig } from 'vite';
import { findApiKey, maskKey } from './apiKey.js';
import { createScheduleHandler, MAX_UPLOAD_BYTES, type ReaderStatus } from './scheduleApi.js';
import { checkKey, KEY_CHECK_MESSAGE, parseSchedule, SCHEDULE_MODEL } from './scheduleParser.js';

type Handler = ReturnType<typeof createScheduleHandler>;

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

/**
 * Serves /api/schedule-import from `npm run dev` and `npm run preview`.
 * ANTHROPIC_API_KEY is read on the server only (from .env.local), so it is
 * never bundled into the browser code. On start it prints whether schedule
 * upload is on, and why not when it's off.
 */
export function scheduleApi(): Plugin {
  let config: ResolvedConfig;
  let handler: Handler | null = null;
  let client: Anthropic | null = null;
  let status: ReaderStatus = { configured: false, message: null };
  let started = false;

  /** Runs once per server start: reports key status and checks it with a free Models API call. */
  const announce = (logger: Logger) => {
    if (started) return;
    started = true;
    const lookup = findApiKey(config.root, config.mode);
    if (!client) {
      logger.warn(yellow(`\n  ✗ Schedule upload is OFF: no ANTHROPIC_API_KEY found.`));
      for (const problem of lookup.problems) logger.warn(yellow(`    • ${problem}`));
      logger.warn(yellow(`    Fix it, then restart this command. The sample schedule still works.\n`));
      return;
    }
    logger.info(green(`\n  ✓ Schedule upload: key found in ${lookup.source} (${maskKey(lookup.key!)}). Checking it with Anthropic…`));
    for (const problem of lookup.problems) logger.warn(yellow(`    • ${problem}`));
    void checkKey(client).then((result) => {
      if (result === 'ok') {
        logger.info(green(`  ✓ Schedule upload is ON (${SCHEDULE_MODEL}).`));
        return;
      }
      if (result === 'invalid' || result === 'model_unavailable') status = { configured: true, message: KEY_CHECK_MESSAGE[result] };
      logger.warn(yellow(`  ✗ ${bold('Schedule upload problem:')} ${KEY_CHECK_MESSAGE[result]}`));
    });
  };

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
    configResolved(resolved) {
      config = resolved;
      const lookup = findApiKey(resolved.root, resolved.mode);
      client = lookup.key ? new Anthropic({ apiKey: lookup.key, timeout: 90_000, maxRetries: 1 }) : null;
      status = client
        ? { configured: true, message: null }
        : { configured: false, message: `No API key found. ${lookup.problems[0] ?? ''} Then restart npm run dev.`.replace(/\s+/g, ' ').trim() };
      handler = createScheduleHandler({
        status: () => status,
        parse: (file) => parseSchedule(file, client!),
      });
    },
    configureServer(server) {
      announce(server.config.logger);
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      const index = path.resolve(config.root, config.build.outDir, 'index.html');
      if (!fs.existsSync(index)) {
        server.config.logger.error(
          yellow(`\n  ✗ Nothing to preview: ${path.relative(config.root, index)} doesn’t exist, so every page will 404. Run "npm run build" first.\n`),
        );
      }
      announce(server.config.logger);
      server.middlewares.use(middleware);
    },
  };
}

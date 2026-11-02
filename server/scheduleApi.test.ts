import { describe, expect, it } from 'vitest';
import { createScheduleHandler, IMPORT_PATH, MAX_UPLOAD_BYTES, STATUS_PATH } from './scheduleApi.js';
import { ScheduleParseError, type ParseResult } from './scheduleParser.js';

const extraction: ParseResult['extraction'] = {
  is_schedule: true,
  term: { name: 'Fall Quarter 2026', start_date: '2026-09-21', end_date: '2026-12-11' },
  classes: [
    {
      course_code: 'MATH 1B',
      title: 'Calculus II',
      meetings: [{ days: ['Tue', 'Thu'], start_time: '10:00', end_time: '12:00', location: null }],
      unscheduled_reason: null,
      confidence: 'high',
      note: null,
    },
  ],
  warnings: [],
};

const on = () => ({ configured: true, message: null });
const off = () => ({ configured: false, message: 'No .env.local file found next to package.json.' });
const ok = async (): Promise<ParseResult> => ({ extraction, usage: { input_tokens: 1500, output_tokens: 400 } });
const upload = (type = 'application/pdf', body: BodyInit = new Uint8Array([37, 80, 68, 70])) =>
  new Request(`http://localhost${IMPORT_PATH}`, { method: 'POST', headers: { 'content-type': type }, body });

describe('schedule import endpoint', () => {
  it('reports whether a key is configured', async () => {
    const res = await createScheduleHandler({ status: off, parse: ok })(new Request(`http://localhost${STATUS_PATH}`));
    expect(res!.status).toBe(200);
    expect(await res!.json()).toMatchObject({ configured: false, model: 'claude-haiku-5-5', message: 'No .env.local file found next to package.json.' });
  });

  it('ignores paths it does not own', async () => {
    expect(await createScheduleHandler({ status: on, parse: ok })(new Request('http://localhost/other'))).toBeNull();
  });

  it('returns the extraction and token usage', async () => {
    const res = await createScheduleHandler({ status: on, parse: ok })(upload());
    expect(res!.status).toBe(200);
    const body = await res!.json();
    expect(body.extraction.classes[0].course_code).toBe('MATH 1B');
    expect(body.usage).toEqual({ input_tokens: 1500, output_tokens: 400 });
  });

  it('explains when no API key is set (503)', async () => {
    const res = await createScheduleHandler({ status: off, parse: ok })(upload());
    expect(res!.status).toBe(503);
    expect((await res!.json()).error).toEqual({ code: 'not_configured', message: 'No .env.local file found next to package.json.' });
  });

  it('rejects unsupported types (415), empty files (400) and oversized files (413)', async () => {
    const handle = createScheduleHandler({ status: on, parse: ok });
    expect((await handle(upload('image/heic')))!.status).toBe(415);
    expect((await handle(upload('application/pdf', new Uint8Array())))!.status).toBe(400);
    expect((await handle(upload('image/png', new Uint8Array(MAX_UPLOAD_BYTES + 1))))!.status).toBe(413);
  });

  it('maps a refusal or a non-schedule file to 422 with a readable message', async () => {
    const refusing = createScheduleHandler({
      status: on,
      parse: async () => {
        throw new ScheduleParseError('refusal', 'This file couldn’t be processed.');
      },
    });
    const res = await refusing(upload());
    expect(res!.status).toBe(422);
    expect((await res!.json()).error).toEqual({ code: 'refusal', message: 'This file couldn’t be processed.' });

    const notSchedule = createScheduleHandler({ status: on, parse: async () => ({ ...(await ok()), extraction: { ...extraction, is_schedule: false, classes: [] } }) });
    expect((await (await notSchedule(upload()))!.json()).error.code).toBe('not_a_schedule');
  });

  it('explains when the key cannot use the model (503)', async () => {
    const handle = createScheduleHandler({
      status: on,
      parse: async () => {
        throw new ScheduleParseError('model_unavailable', 'This API key can’t use claude-haiku-5-5.');
      },
    });
    const res = await handle(upload());
    expect(res!.status).toBe(503);
    expect((await res!.json()).error.code).toBe('model_unavailable');
  });

  it('maps upstream failures to 502', async () => {
    const handle = createScheduleHandler({
      status: on,
      parse: async () => {
        throw new ScheduleParseError('upstream', 'The schedule reader had a problem.');
      },
    });
    expect((await handle(upload()))!.status).toBe(502);
  });

  it('rate-limits each client', async () => {
    let t = 0;
    const handle = createScheduleHandler({ status: on, parse: ok, rateLimit: { max: 2, windowMs: 1000 }, now: () => t });
    expect((await handle(upload(), 'a'))!.status).toBe(200);
    expect((await handle(upload(), 'a'))!.status).toBe(200);
    expect((await handle(upload(), 'a'))!.status).toBe(429);
    expect((await handle(upload(), 'b'))!.status).toBe(200);
    t = 2000;
    expect((await handle(upload(), 'a'))!.status).toBe(200);
  });
});

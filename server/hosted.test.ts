import { describe, expect, it } from 'vitest';
import { createHostedHandler, HOSTED_MAX_BYTES } from './hosted.js';
import { createScheduleHandler, IMPORT_PATH, PASSCODE_HEADER, STATUS_PATH } from './scheduleApi.js';
import type { ParseResult } from './scheduleParser.js';

const extraction: ParseResult['extraction'] = {
  is_schedule: true,
  term: { name: null, start_date: null, end_date: null },
  classes: [
    {
      course_code: 'MATH 1B',
      title: null,
      meetings: [{ days: ['Tue'], start_time: '10:00', end_time: '12:00', location: null }],
      unscheduled_reason: null,
      confidence: 'high',
      note: null,
    },
  ],
  warnings: [],
};
let parsed = 0;
const fakeParse = async (): Promise<ParseResult> => {
  parsed++;
  return { extraction, usage: { input_tokens: 1, output_tokens: 1 } };
};

const status = (headers: Record<string, string> = {}) => new Request(`https://demo.example${STATUS_PATH}`, { headers });
const upload = (headers: Record<string, string> = {}, body: BodyInit = new Uint8Array([37, 80, 68, 70])) =>
  new Request(`https://demo.example${IMPORT_PATH}`, { method: 'POST', headers: { 'content-type': 'application/pdf', ...headers }, body });

describe('hosted schedule reader (Vercel)', () => {
  it('stays off and says why when the key is missing', async () => {
    const handle = createHostedHandler({}, fakeParse);
    const body = await (await handle(status())).json();
    expect(body).toMatchObject({ configured: false, passcodeRequired: false });
    expect(body.message).toMatch(/add ANTHROPIC_API_KEY/);
    expect((await handle(upload())).status).toBe(503);
  });

  it('fails closed without a team passcode, so the key is never usable by strangers', async () => {
    const handle = createHostedHandler({ ANTHROPIC_API_KEY: 'sk-ant-test' }, fakeParse);
    const body = await (await handle(status())).json();
    expect(body.configured).toBe(false);
    expect(body.message).toMatch(/TEAM_PASSCODE/);
    const before = parsed;
    expect((await handle(upload())).status).toBe(503);
    expect(parsed).toBe(before);
  });

  it('requires the passcode for uploads and reports whether a guess is right', async () => {
    const handle = createHostedHandler({ ANTHROPIC_API_KEY: 'sk-ant-test', TEAM_PASSCODE: 'blue-falcon-42' }, fakeParse);
    expect(await (await handle(status())).json()).toMatchObject({ configured: true, passcodeRequired: true, passcodeOk: false, maxBytes: HOSTED_MAX_BYTES });
    expect((await (await handle(status({ [PASSCODE_HEADER]: 'nope' }))).json()).passcodeOk).toBe(false);
    expect((await (await handle(status({ [PASSCODE_HEADER]: ' blue-falcon-42 ' }))).json()).passcodeOk).toBe(true);

    const before = parsed;
    const missing = await handle(upload());
    expect(missing.status).toBe(401);
    expect((await missing.json()).error).toEqual({ code: 'passcode', message: 'Enter the team passcode to upload.' });
    expect((await (await handle(upload({ [PASSCODE_HEADER]: 'nope' }))).json()).error.message).toBe('That team passcode isn’t right.');
    expect(parsed).toBe(before);

    const ok = await handle(upload({ [PASSCODE_HEADER]: 'blue-falcon-42' }));
    expect(ok.status).toBe(200);
    expect(parsed).toBe(before + 1);
  });

  it('enforces the smaller hosted upload limit', async () => {
    const handle = createHostedHandler({ ANTHROPIC_API_KEY: 'sk-ant-test', TEAM_PASSCODE: 'pw' }, fakeParse);
    const res = await handle(upload({ [PASSCODE_HEADER]: 'pw' }, new Uint8Array(HOSTED_MAX_BYTES + 1)));
    expect(res.status).toBe(413);
    expect((await res.json()).error.message).toMatch(/over 4 MB/);
  });

  it('rate-limits passcode guesses per visitor (by forwarded IP)', async () => {
    const handle = createHostedHandler({ ANTHROPIC_API_KEY: 'sk-ant-test', TEAM_PASSCODE: 'pw' }, fakeParse);
    const from = (ip: string) => ({ [PASSCODE_HEADER]: 'guess', 'x-forwarded-for': `${ip}, 10.0.0.1` });
    for (let i = 0; i < 15; i++) expect((await handle(status(from('1.1.1.1')))).status).toBe(200);
    expect((await handle(status(from('1.1.1.1')))).status).toBe(429);
    expect((await handle(upload(from('1.1.1.1')))).status).toBe(429);
    expect((await handle(status(from('2.2.2.2')))).status).toBe(200);
  });

  it('returns 404 for paths it does not serve', async () => {
    const handle = createHostedHandler({}, fakeParse);
    expect((await handle(new Request('https://demo.example/api/other'))).status).toBe(404);
  });
});

describe('local reader keeps working without a passcode', () => {
  it('does not ask for a passcode when none is configured', async () => {
    const handle = createScheduleHandler({ status: () => ({ configured: true, message: null }), parse: fakeParse });
    expect(await (await handle(status()))!.json()).toMatchObject({ passcodeRequired: false, passcodeOk: null, maxBytes: 10 * 1024 * 1024 });
    expect((await handle(upload()))!.status).toBe(200);
  });
});

describe('Vercel function files', () => {
  it('export the right HTTP methods and a duration limit', async () => {
    const index = await import('../api/schedule-import/index.js');
    const statusFn = await import('../api/schedule-import/status.js');
    expect(typeof index.POST).toBe('function');
    expect(index.config).toEqual({ maxDuration: 60 });
    expect(typeof statusFn.GET).toBe('function');
    const res = await statusFn.GET(status());
    expect(res.status).toBe(200);
  });
});

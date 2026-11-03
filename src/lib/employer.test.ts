import { describe, expect, it } from 'vitest';
import { fixtureApplications, initialJobs } from '../data/employer';
import { sampleSchedule } from '../data/sampleSchedule';
import { DEMO_PROFILE, initialState, normaliseState, reducer, type Application } from '../state/store';
import { applicationSnapshot, coverage, coverageLabel, coverageSentence, publishedJobs, studentApplications, validateJob } from './employer';
import { evaluateJob } from './matching';
import { jobHours } from './jobs';
import type { Job } from './types';

const job = () => initialJobs()[0];
const snapshot = () => applicationSnapshot(DEMO_PROFILE, sampleSchedule(), true);
const browserApplication = (): Application => ({
  ...fixtureApplications()[0],
  id: 'browser-app',
  applicantId: 'browser-student',
  source: 'browser',
  snapshot: snapshot(),
});

describe('coverage labels', () => {
  const choose = (minShifts: number | null): Job => ({
    ...job(),
    hoursType: 'choose',
    minShifts,
    shifts: [
      { id: 'a', day: 0, start: 960, end: 1080, required: false },
      { id: 'b', day: 2, start: 960, end: 1080, required: false },
      { id: 'c', day: 4, start: 960, end: 1080, required: false },
      { id: 'd', day: 4, start: 1000, end: 1100, required: false },
    ],
  });
  const everywhere = {
    ...snapshot(),
    windows: [0, 2, 4].map((day) => ({ day: day as 0, start: 900, end: 1200 })),
  };
  it('describes fixed openings by required shifts', () => {
    expect(coverageLabel(job(), coverage(job(), fixtureApplications()[1].snapshot))).toBe('1/2 required shifts fit');
  });
  it('never shows 0/0 for optional-only openings, and counts overlapping choices once', () => {
    const j = choose(2);
    expect(coverageLabel(j, coverage(j, everywhere))).toBe('Can cover 3 shifts · minimum 2');
    const unset = choose(null);
    expect(coverageLabel(unset, coverage(unset, everywhere))).toBe('Can cover 3 shifts · minimum not set');
  });
  it('summarises per shift without saying why someone is unavailable', () => {
    const [maya, jordan, sam] = fixtureApplications().map((a) => coverageSentence(job(), coverage(job(), a.snapshot)));
    expect(maya).toBe('Fits both required shifts');
    expect(jordan).toBe('Available Tuesday; Thursday is outside shared availability');
    expect(sam).toBe('Available Tuesday; Thursday needs confirmation');
  });
  it('mentions both parts when a selectable opening also has required shifts', () => {
    const j = choose(1);
    j.shifts = [{ id: 'r', day: 1, start: 780, end: 1020, required: true }, ...j.shifts];
    const label = coverageLabel(j, coverage(j, everywhere));
    expect(label).toBe('0/1 required shift fit · Can cover 3 shifts · minimum 1');
  });
});

describe('employer coverage and validation', () => {
  it('distinguishes full, partial and incomplete availability', () => {
    expect(fixtureApplications().map((a) => coverage(job(), a.snapshot).state)).toEqual(['fits', 'outside', 'confirm']);
    expect(fixtureApplications().map((a) => coverage(job(), a.snapshot).fit)).toEqual([2, 1, 1]);
  });
  it('does not assume unmarked time is available', () => {
    expect(coverage(job(), { ...snapshot(), windows: [] }).state).toBe('outside');
  });
  it('preserves the commute-buffer demonstration and per-shift agreement', () => {
    for (const j of initialJobs()) {
      const student = evaluateJob(j, sampleSchedule());
      const employer = coverage(j, snapshot());
      expect(employer.checks.map((c) => c.status === 'fits')).toEqual(student.checks.map((c) => c.status === 'fits'));
    }
    expect(evaluateJob(initialJobs()[1], sampleSchedule()).state).toBe('commute');
    expect(coverage(initialJobs()[1], snapshot()).state).toBe('outside');
  });
  it('requires confirmation for empty, variable and pending schedules', () => {
    for (const patch of [{ shifts: [] }, { hoursType: 'variable' as const }, { pendingShift: 'Weekend shift' }]) {
      expect(coverage({ ...job(), ...patch }, snapshot()).state).toBe('confirm');
      expect(evaluateJob({ ...job(), ...patch }, sampleSchedule()).state).toBe('confirm');
    }
    expect(validateJob({ ...job(), shifts: [] })).not.toHaveLength(0);
  });
  it('does not count overlapping optional shifts toward the minimum', () => {
    const j: Job = {
      ...job(),
      hoursType: 'choose',
      minShifts: 2,
      shifts: [
        { id: 'a', day: 1, start: 780, end: 960, required: false },
        { id: 'b', day: 1, start: 840, end: 1020, required: false },
      ],
    };
    expect(coverage(j, snapshot()).optionalFit).toBe(1);
    expect(jobHours(j).max).toBe(3);
    expect(coverage(j, snapshot()).state).toBe('outside');
    expect(evaluateJob(j, sampleSchedule()).state).toBe('conflict');
    expect(validateJob(j)).not.toHaveLength(0);
    j.shifts.push({ id: 'c', day: 3, start: 780, end: 960, required: false });
    expect(coverage(j, snapshot()).state).toBe('fits');
    expect(jobHours(j)).toEqual({ min: 6, max: 6, label: '6–6 hrs/wk' });
    expect(validateJob(j)).toEqual([]);
    j.minShifts = null;
    expect(coverage(j, snapshot()).state).toBe('confirm');
    expect(evaluateJob(j, sampleSchedule()).state).toBe('confirm');
  });
  it('excludes optional shifts that overlap a required shift', () => {
    const j = job();
    j.hoursType = 'choose';
    j.minShifts = 1;
    j.shifts.push({ ...j.shifts[0], id: 'optional', required: false });
    expect(coverage(j, snapshot()).optionalFit).toBe(0);
    expect(validateJob(j)).not.toHaveLength(0);
  });
  it('rejects invalid pay, inverted shifts, overlapping requirements and impossible minimums', () => {
    for (const j of [
      { ...job(), pay: { min: NaN } },
      { ...job(), pay: { min: 20, max: 10 } },
      { ...job(), shifts: [{ ...job().shifts[0], end: 0 }] },
      {
        ...job(),
        shifts: [job().shifts[0], { ...job().shifts[0], id: 'duplicate' }],
      },
    ])
      expect(validateJob(j)).not.toHaveLength(0);
  });
});

describe('application privacy and shared demo state', () => {
  it('projects only submitted fields and holds a detached snapshot', () => {
    const profile = { ...DEMO_PROFILE };
    const schedule = sampleSchedule();
    const snap = applicationSnapshot(profile, schedule, false);
    const before = JSON.stringify(snap);
    for (const privateText of ['MATH', 'Calculus', 'Family', 'Robotics', 'bufferMinutes', 'areaId', 'termName', 'resumeName":"Alex'])
      expect(before).not.toContain(privateText);
    profile.firstName = 'Changed';
    schedule.blocks[0].title = 'Private change';
    schedule.blocks[6].end = 800;
    expect(JSON.stringify(snap)).toBe(before);
    expect(snap.resumeName).toBeNull();
  });
  it('preserves old applications without inventing a historical profile or availability', () => {
    const old = {
      ...initialState(),
      version: 1,
      jobs: undefined,
      business: undefined,
      applications: [
        {
          id: 'old',
          jobId: 'hillside-barista',
          submittedAt: '2026-11-01',
          status: 'submitted',
          sharedWindows: ['Tue 1–5 pm'],
          resumeAttached: true,
          note: '',
          stateAtSubmit: 'fits',
        },
      ],
    };
    const migrated = normaliseState(old);
    expect(migrated.version).toBe(2);
    expect(migrated.applications[0].sharedWindows).toEqual(['Tue 1–5 pm']);
    expect(migrated.applications[0].snapshot.name).toBe('Earlier application');
    expect(migrated.applications[0].snapshot.complete).toBe(false);
    expect(migrated.jobs).toHaveLength(initialJobs().length);
    expect(normaliseState(JSON.parse(JSON.stringify(migrated))).applications).toHaveLength(4);
  });
  it('publishes to the same job collection and hides drafts and paused jobs', () => {
    let state = initialState();
    const draft = state.jobs.find((j) => j.publication === 'draft')!;
    expect(publishedJobs(state.jobs).some((j) => j.id === draft.id)).toBe(false);
    state = reducer(state, {
      type: 'save-job',
      job: { ...draft, publication: 'published' },
    });
    expect(publishedJobs(state.jobs).find((j) => j.id === draft.id)?.shifts).toEqual(draft.shifts);
    state = reducer(state, {
      type: 'save-job',
      job: { ...draft, publication: 'paused' },
    });
    expect(publishedJobs(state.jobs).some((j) => j.id === draft.id)).toBe(false);
    expect(initialJobs().find((j) => j.id === draft.id)?.publication).toBe('draft');
  });
  it('syncs deliberate status changes without replacing fixtures or changing submitted snapshots', () => {
    let state = reducer(initialState(), {
      type: 'apply',
      application: browserApplication(),
    });
    expect(state.applications).toHaveLength(4);
    state = reducer(state, {
      type: 'profile',
      patch: { firstName: 'New name' },
    });
    state = reducer(state, {
      type: 'schedule',
      schedule: { ...sampleSchedule(), blocks: [] },
    });
    expect(state.applications[0].snapshot).toEqual(snapshot());
    state = reducer(state, {
      type: 'status',
      id: 'browser-app',
      status: 'reviewing',
    });
    expect(studentApplications(state.applications)[0].status).toBe('reviewing');
    expect(normaliseState(JSON.parse(JSON.stringify(state))).applications[0].status).toBe('reviewing');
    state = reducer(state, { type: 'share-availability', id: 'browser-app' });
    expect(state.applications[0].snapshot.windows).toEqual([]);
    expect(state.applications[0].snapshot.name).toBe('Alex Kim');
    state = reducer(state, { type: 'reset', state: initialState() });
    expect(studentApplications(state.applications)).toEqual([]);
    expect(state.jobs).toEqual(initialJobs());
  });
});

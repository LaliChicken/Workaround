import { describe, expect, it } from 'vitest';
import { JOBS, jobById } from '../data/jobs';
import { sampleSchedule } from '../data/sampleSchedule';
import { covers } from './intervals';
import { checkShift, evaluateAll, evaluateJob, workableMinutes, workableWindows } from './matching';
import { jobHours, partitionJobs, DEFAULT_FILTERS } from './jobs';
import { formatRange, formatTime, formatTimeWords, toMinutes as t } from './time';
import type { Day, Job, Schedule, ScheduleBlock } from './types';

const job = (id: string) => {
  const j = jobById(id);
  if (!j) throw new Error(`missing job ${id}`);
  return j;
};

const withBlock = (s: Schedule, id: string, patch: Partial<ScheduleBlock>): Schedule => ({
  ...s,
  blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
});

describe('time formatting', () => {
  it('formats times and ranges the way the UI shows them', () => {
    expect(formatTime(t(13))).toBe('1 pm');
    expect(formatTime(t(12, 15))).toBe('12:15 pm');
    expect(formatTimeWords(t(12))).toBe('noon');
    expect(formatRange(t(13), t(17))).toBe('1–5 pm');
    expect(formatRange(t(10), t(12))).toBe('10 am–noon');
    expect(formatRange(t(9, 30), t(11, 20))).toBe('9:30–11:20 am');
    expect(formatRange(t(11), t(13, 30))).toBe('11 am–1:30 pm');
  });
});

describe('video scenario (CLAUDE.md "Sample video scenario")', () => {
  const schedule = sampleSchedule();

  it('Opening A (Tue/Thu 1–5 pm) fits the sample week', () => {
    const m = evaluateJob(job('hillside-barista'), schedule);
    expect(m.state).toBe('fits');
    expect(m.summary).toBe('Both weekly shifts fit your availability.');
    expect(m.checks.every((c) => c.status === 'fits')).toBe(true);
  });

  it('Opening B (starts 12:15) is a commute conflict with the 30-minute buffer', () => {
    const m = evaluateJob(job('juniper-counter'), schedule);
    expect(m.state).toBe('commute');
    expect(m.summary).toContain('class ends at noon');
    expect(m.summary).toContain('With your 30-minute buffer, you can start at 12:30 pm');
  });

  it('Editing Thursday’s class to end at 2 pm makes Opening A conflict, and restoring it fixes it', () => {
    const edited = withBlock(schedule, 'c-math-thu', { end: t(14) });
    const m = evaluateJob(job('hillside-barista'), edited);
    expect(m.state).toBe('conflict');
    expect(m.summary).toBe("Thursday's shift overlaps your MATH 1B class (10 am–2 pm).");
    expect(m.requiredFit).toBe(1);

    const restored = withBlock(edited, 'c-math-thu', { end: t(12) });
    expect(evaluateJob(job('hillside-barista'), restored).state).toBe('fits');
  });

  it('only the expected jobs change when Thursday’s class is extended', () => {
    const before = evaluateAll(JOBS, schedule);
    const after = evaluateAll(JOBS, withBlock(schedule, 'c-math-thu', { end: t(14) }));
    const changed = JOBS.filter((j) => before[j.id].state !== after[j.id].state).map((j) => j.id);
    expect(changed.sort()).toEqual(['hillside-barista', 'juniper-counter']);
  });

  it('a lower buffer resolves the commute conflict; a higher one creates new ones', () => {
    expect(evaluateJob(job('juniper-counter'), { ...schedule, bufferMinutes: 15 }).state).toBe('fits');
    // Dog walker starts exactly 30 minutes after Tuesday class.
    expect(evaluateJob(job('happy-trails-walker'), schedule).state).toBe('fits');
    expect(evaluateJob(job('happy-trails-walker'), { ...schedule, bufferMinutes: 45 }).state).toBe('commute');
  });
});

describe('matching states for the sample dataset', () => {
  const matches = evaluateAll(JOBS, sampleSchedule());
  it.each([
    ['hillside-barista', 'fits'],
    ['juniper-counter', 'commute'],
    ['arbor-library', 'fits'],
    ['brightpath-tutor', 'optional'],
    ['valley-grocery', 'confirm'],
    ['trailhead-sales', 'conflict'],
    ['summit-front-desk', 'confirm'],
    ['corner-slice-prep', 'conflict'],
    ['happy-trails-walker', 'fits'],
    ['bayside-swim', 'conflict'],
  ])('%s → %s', (id, state) => {
    expect(matches[id].state).toBe(state);
  });

  it('explains why a shift falls outside availability', () => {
    expect(matches['corner-slice-prep'].summary).toBe(
      "Friday's shift runs until 9 pm, but you marked yourself available until 6 pm.",
    );
    expect(matches['bayside-swim'].summary).toBe("Sunday's shift overlaps your family time (11 am–5 pm).");
    expect(matches['bayside-swim'].checks.find((c) => c.shift.day === 6)?.reasons).toContain(
      "You haven't marked any time on Sunday as available to work.",
    );
  });

  it('optional shifts report how many fit and the employer minimum', () => {
    const m = matches['brightpath-tutor'];
    expect(m.optionalFit).toBe(4);
    expect(m.summary).toBe('Four optional shifts fit (Tue, Wed, Thu & Fri). Brightpath Learning Center asks for at least two a week.');
  });

  it('labels unknown requirements as needing confirmation, never as a match', () => {
    expect(matches['valley-grocery'].summary).toMatch(/confirm which shifts are required/);
    expect(matches['summit-front-desk'].summary).toBe(
      'Your Saturday shift fits. Ask the employer to confirm the time of the second weekend shift.',
    );
  });

  it('hides conflicts by default and counts them', () => {
    const { visible, hiddenConflicts } = partitionJobs(JOBS, DEFAULT_FILTERS, { matches, hoursMin: 8, hoursMax: 16 });
    expect(hiddenConflicts).toBe(4);
    expect(visible.map((j) => matches[j.id].state)).toEqual(['fits', 'fits', 'fits', 'optional', 'confirm', 'confirm']);
  });
});

describe('rules', () => {
  const base = sampleSchedule();
  const fixedJob = (shifts: Job['shifts']): Job => ({ ...job('hillside-barista'), id: 'x', shifts });

  it('never marks a role compatible because only one required shift fits', () => {
    const m = evaluateJob(
      fixedJob([
        { id: 'a', day: 1, start: t(13), end: t(17), required: true },
        { id: 'b', day: 0, start: t(13), end: t(17), required: true },
      ]),
      base,
    );
    expect(m.state).toBe('conflict');
    expect(m.requiredFit).toBe(1);
  });

  it('does not assume unmarked time is available', () => {
    const noAvailability = { ...base, blocks: base.blocks.filter((b) => b.kind !== 'available') };
    expect(evaluateJob(job('hillside-barista'), noAvailability).state).toBe('conflict');
  });

  it('applies the buffer before a class as well as after it', () => {
    // Monday CS 1A starts 1:30 pm; a shift ending 1:15 pm leaves only 15 minutes.
    const s: Schedule = {
      ...base,
      blocks: [...base.blocks, { id: 'a-mon', kind: 'available', day: 0, start: t(11, 30), end: t(13, 30), title: 'Available to work' }],
    };
    const c = checkShift({ id: 'm', day: 0, start: t(12), end: t(13, 15), required: true }, s);
    expect(c.status).toBe('commute');
    expect(c.reasons[0]).toContain("you'd need to finish by 1 pm");
  });

  it('reports workable windows after commitments and buffers', () => {
    expect(workableWindows(base, 1)).toEqual([{ start: t(12, 30), end: t(19) }]);
    expect(workableWindows(base, 0)).toEqual([]);
    expect(workableMinutes(base)).toBe((6.5 + 2.5 + 6.5 + 8 + 6) * 60);
  });

  it('job hours', () => {
    expect(jobHours(job('hillside-barista')).label).toBe('8 hrs/wk');
    expect(jobHours(job('brightpath-tutor')).label).toBe('4–10 hrs/wk');
    expect(jobHours(job('summit-front-desk')).label).toBe('4+ hrs/wk');
  });
});

describe('consistency: a shift fits exactly when it lies inside the workable windows', () => {
  const base = sampleSchedule();
  // Deterministic pseudo-random generator so failures are reproducible.
  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pick = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const kinds: ScheduleBlock['kind'][] = ['class', 'available', 'available', 'study', 'activity'];

  it('holds across 3,000 random schedules and shifts', () => {
    for (let n = 0; n < 3000; n++) {
      const day = pick(0, 2) as Day;
      const blocks: ScheduleBlock[] = Array.from({ length: pick(1, 6) }, (_, i) => {
        const start = pick(28, 80) * 15;
        return { id: `b${i}`, kind: kinds[pick(0, kinds.length - 1)], day: pick(0, 2) as Day, start, end: start + pick(2, 24) * 15, title: `B${i}` };
      });
      const schedule: Schedule = { ...base, blocks, bufferMinutes: [0, 15, 30, 45, 60][pick(0, 4)] };
      const start = pick(28, 84) * 15;
      const shift = { id: 's', day, start, end: start + pick(2, 20) * 15, required: true };
      const fits = checkShift(shift, schedule).status === 'fits';
      expect(fits).toBe(covers(workableWindows(schedule, day), shift));
    }
  });
});

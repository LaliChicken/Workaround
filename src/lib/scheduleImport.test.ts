import { describe, expect, it } from 'vitest';
import type { ScheduleExtraction } from '../../server/scheduleSchema';
import { sampleSchedule } from '../data/sampleSchedule';
import { workableMinutes } from './matching';
import { parseClock, rowProblem, rowsToBlocks, suggestedWindows, toReview, windowsToBlocks } from './scheduleImport';
import { toMinutes as t } from './time';

const base: ScheduleExtraction = { is_schedule: true, term: { name: null, start_date: null, end_date: null }, classes: [], warnings: [] };
const cls = (over: Partial<ScheduleExtraction['classes'][number]>): ScheduleExtraction['classes'][number] => ({
  course_code: 'MATH 1B',
  title: 'Calculus II',
  meetings: [],
  unscheduled_reason: null,
  confidence: 'high',
  note: null,
  ...over,
});

describe('reading times', () => {
  it('parses 24-hour times and rejects anything else', () => {
    expect(parseClock('13:30')).toBe(t(13, 30));
    expect(parseClock('9:05')).toBe(t(9, 5));
    expect(parseClock('1:30 PM')).toBeNull();
    expect(parseClock('24:00')).toBeNull();
  });
});

describe('turning an extraction into reviewable rows', () => {
  it('splits multi-day meetings into one row per day and keeps off-grid times', () => {
    const { rows } = toReview({
      ...base,
      classes: [
        cls({ meetings: [{ days: ['Tue', 'Thu'], start_time: '10:00', end_time: '11:50', location: 'S-32' }] }),
        cls({ course_code: 'ENGL 1A', title: null, meetings: [{ days: ['Mon', 'Wed'], start_time: '09:30', end_time: '11:20', location: null }] }),
      ],
    });
    expect(rows.map((r) => `${r.title} ${r.day} ${r.start}-${r.end}`)).toEqual([
      `ENGL 1A 0 ${t(9, 30)}-${t(11, 20)}`,
      `MATH 1B 1 ${t(10)}-${t(11, 50)}`,
      `ENGL 1A 2 ${t(9, 30)}-${t(11, 20)}`,
      `MATH 1B 3 ${t(10)}-${t(11, 50)}`,
    ]);
    expect(rows[1].detail).toBe('Calculus II');
    expect(rows.every((r) => !r.needsCheck)).toBe(true);
  });

  it('keeps a lab as its own meeting and drops exact duplicates', () => {
    const { rows } = toReview({
      ...base,
      classes: [
        cls({
          course_code: 'CS 1A',
          meetings: [
            { days: ['Mon', 'Wed'], start_time: '13:30', end_time: '15:20', location: null },
            { days: ['Mon', 'Mon'], start_time: '13:30', end_time: '15:20', location: null },
            { days: ['Fri'], start_time: '09:00', end_time: '10:50', location: 'Lab' },
          ],
        }),
      ],
    });
    expect(rows).toHaveLength(3);
  });

  it('flags low-confidence and unreadable rows for the student to check', () => {
    const { rows } = toReview({
      ...base,
      classes: [
        cls({ confidence: 'low', note: 'Day letters were blurry', meetings: [{ days: ['Tue'], start_time: '10:00', end_time: '12:00', location: null }] }),
        cls({ course_code: 'BIO 10', meetings: [{ days: ['Fri'], start_time: '3pm', end_time: '14:00', location: null }] }),
      ],
    });
    expect(rows.find((r) => r.title === 'MATH 1B')).toMatchObject({ needsCheck: true, note: 'Day letters were blurry' });
    const bio = rows.find((r) => r.title === 'BIO 10')!;
    expect(bio.needsCheck).toBe(true);
    expect(bio.end).toBeGreaterThan(bio.start);
  });

  it('lists online or TBA classes separately instead of inventing times', () => {
    const review = toReview({
      ...base,
      classes: [cls({ course_code: 'PSYC 1', unscheduled_reason: 'Online, no set meeting time' }), cls({ course_code: 'ART 2', meetings: [{ days: [], start_time: '10:00', end_time: '11:00', location: null }] })],
      warnings: ['Final exam times were left out.'],
    });
    expect(review.rows).toHaveLength(0);
    expect(review.unscheduled).toEqual([
      { course: 'PSYC 1', reason: 'Online, no set meeting time' },
      { course: 'ART 2', reason: 'No weekly meeting time listed' },
    ]);
    expect(review.warnings).toContain('Final exam times were left out.');
  });

  it('only accepts complete, ordered term dates', () => {
    expect(toReview({ ...base, term: { name: 'Fall', start_date: '2026-09-21', end_date: '2026-12-11' } }).term).toEqual({ name: 'Fall', start: '2026-09-21', end: '2026-12-11' });
    expect(toReview({ ...base, term: { name: 'Fall', start_date: '2026-12-11', end_date: '2026-09-21' } }).term).toBeNull();
    expect(toReview({ ...base, term: { name: 'Fall', start_date: 'Sept 21', end_date: null } }).term).toBeNull();
  });

  it('blocks confirmation until every row is valid', () => {
    const [row] = toReview({ ...base, classes: [cls({ meetings: [{ days: ['Tue'], start_time: '10:00', end_time: '12:00', location: null }] })] }).rows;
    expect(rowProblem([row])).toBeNull();
    expect(rowProblem([{ ...row, end: row.start }])).toBe('MATH 1B ends before it starts. Fix its times.');
    expect(rowProblem([{ ...row, title: ' ' }])).toBe('Every class needs a course code.');
    expect(rowsToBlocks([row])[0]).not.toHaveProperty('needsCheck');
  });
});

describe('building work availability', () => {
  it('suggests weekdays and Saturday, never Sunday, and lets classes carve out time', () => {
    const windows = suggestedWindows();
    expect(windows.filter((w) => w.on).map((w) => w.day)).toEqual([0, 1, 2, 3, 4, 5]);
    const blocks = windowsToBlocks(windows);
    expect(blocks.every((b) => b.kind === 'available')).toBe(true);

    const classesOnly = { ...sampleSchedule(), blocks: sampleSchedule().blocks.filter((b) => b.kind === 'class') };
    const withAvailability = { ...classesOnly, blocks: [...classesOnly.blocks, ...blocks] };
    const total = blocks.reduce((s, b) => s + b.end - b.start, 0);
    // Workable time is less than the raw windows because classes and buffers are subtracted.
    expect(workableMinutes(withAvailability)).toBeLessThan(total);
    expect(workableMinutes(withAvailability)).toBeGreaterThan(0);
  });

  it('skips days that are switched off or have no time', () => {
    const blocks = windowsToBlocks([
      { day: 0, on: false, start: t(9), end: t(17) },
      { day: 1, on: true, start: t(12), end: t(12) },
      { day: 2, on: true, start: t(13), end: t(18) },
    ]);
    expect(blocks.map((b) => b.day)).toEqual([2]);
  });
});

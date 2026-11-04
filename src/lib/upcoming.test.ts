import { describe, expect, it } from 'vitest';
import { initialJobs } from '../data/employer';
import { sampleSchedule } from '../data/sampleSchedule';
import { applicationSnapshot } from './employer';
import { evaluateJob } from './matching';
import { DEMO_PROFILE, normaliseState, initialState } from '../state/store';
import { clashDateCount, datedClashes, describeClash, describeWhen, itemDates, normaliseUpcoming, validateItem, weekdayOf } from './upcoming';
import type { DatedItem, Schedule } from './types';

const barista = () => initialJobs().find((j) => j.id === 'hillside-barista')!; // Tue/Thu 1–5 pm
const item = (patch: Partial<DatedItem>): DatedItem => ({
  id: 'x',
  kind: 'exam',
  title: 'CHEM 1A midterm',
  startDate: '2026-11-17',
  endDate: '2026-11-17',
  repeat: 'once',
  days: [],
  allDay: false,
  start: 14 * 60,
  end: 16 * 60,
  ...patch,
});
const withItems = (...upcoming: DatedItem[]): Schedule => ({ ...sampleSchedule(), upcoming });
const TODAY = '2026-11-04';

describe('dated commitments', () => {
  it('knows weekdays with Monday as day 0', () => {
    expect(weekdayOf('2026-11-16')).toBe(0);
    expect(weekdayOf('2026-11-17')).toBe(1);
    expect(weekdayOf('2026-11-22')).toBe(6);
  });

  it('expands one-off, multi-day and weekly items into dates', () => {
    expect(itemDates(item({}), TODAY, '2026-12-31')).toEqual(['2026-11-17']);
    expect(itemDates(item({ startDate: '2026-11-25', endDate: '2026-11-28' }), TODAY, '2026-12-31')).toHaveLength(4);
    const weekly = item({ repeat: 'weekly', days: [1, 3], startDate: '2027-01-05', endDate: '2027-01-21' });
    expect(itemDates(weekly, TODAY, '2027-12-31')).toEqual(['2027-01-05', '2027-01-07', '2027-01-12', '2027-01-14', '2027-01-19', '2027-01-21']);
  });

  it('flags a single shift date without changing the weekly match', () => {
    const schedule = withItems(item({}));
    const clashes = datedClashes(barista(), schedule, TODAY);
    expect(clashes).toHaveLength(1);
    expect(clashes[0].dates).toEqual(['2026-11-17']);
    expect(describeClash(clashes[0])).toBe('Tue, Nov 17: the Tuesday 1–5 pm shift overlaps CHEM 1A midterm.');
    expect(evaluateJob(barista(), schedule).state).toBe(evaluateJob(barista(), sampleSchedule()).state);
  });

  it('ignores items that miss the shift time or are already past', () => {
    expect(datedClashes(barista(), withItems(item({ start: 9 * 60, end: 11 * 60 })), TODAY)).toEqual([]);
    expect(datedClashes(barista(), withItems(item({ startDate: '2026-10-06', endDate: '2026-10-06' })), TODAY)).toEqual([]);
  });

  it('counts each affected shift date once for a trip covering both shifts', () => {
    const trip = item({ kind: 'away', title: 'Family trip', allDay: true, startDate: '2026-11-24', endDate: '2026-11-29' });
    const clashes = datedClashes(barista(), withItems(trip), TODAY);
    expect(clashes.map((c) => c.dates)).toEqual([['2026-11-24'], ['2026-11-26']]);
    expect(clashDateCount(clashes)).toBe(2);
  });

  it('applies the commute buffer around future classes only', () => {
    const nearly = { start: 11 * 60, end: 12 * 60 + 45, startDate: '2027-01-05', endDate: '2027-03-16', repeat: 'weekly' as const, days: [1 as const] };
    expect(datedClashes(barista(), withItems(item({ ...nearly, kind: 'class', title: 'MATH 1C' })), TODAY)[0].dates).toHaveLength(11);
    expect(datedClashes(barista(), withItems(item({ ...nearly, kind: 'activity', title: 'Practice' })), TODAY)).toEqual([]);
  });

  it('validates input', () => {
    expect(validateItem(item({ title: ' ' }))).toMatch(/label/);
    expect(validateItem(item({ endDate: '2026-11-01' }))).toMatch(/on or after/);
    expect(validateItem(item({ repeat: 'weekly', days: [] }))).toMatch(/which days/);
    expect(validateItem(item({ repeat: 'weekly', days: [5], startDate: '2026-11-17', endDate: '2026-11-18' }))).toMatch(/None of those days/);
    expect(validateItem(item({ end: 14 * 60 }))).toMatch(/end time/);
    expect(validateItem(item({}))).toBeNull();
  });

  it('describes when an item happens', () => {
    expect(describeWhen(item({}))).toBe('Tue, Nov 17 · 2–4 pm');
    expect(describeWhen(item({ allDay: true, startDate: '2026-12-18', endDate: '2027-01-04' }))).toBe('Dec 18, 2026 – Jan 4, 2027 · all day');
    expect(describeWhen(item({ repeat: 'weekly', days: [1, 3], startDate: '2027-01-05', endDate: '2027-03-18' }))).toBe('Tue & Thu 2–4 pm · Jan 5 – Mar 18');
  });

  it('stays private: application snapshots never include dated items', () => {
    const snap = applicationSnapshot(DEMO_PROFILE, withItems(item({})), true);
    expect(JSON.stringify(snap)).not.toMatch(/CHEM|midterm/);
  });

  it('migrates older saves and drops broken items', () => {
    const old = initialState();
    delete (old.schedule as Partial<Schedule>).upcoming;
    expect(normaliseState(old).schedule.upcoming).toEqual([]);
    expect(normaliseUpcoming([item({}), { id: 'bad' }, null])).toHaveLength(1);
  });
});

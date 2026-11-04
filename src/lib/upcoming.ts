import { overlaps } from './intervals';
import { validShift } from './shiftRules';
import { DAY_LONG, DAY_SHORT, formatDate, formatDayList, formatRange } from './time';
import type { DatedItem, DatedKind, Day, Interval, Job, Schedule, Shift } from './types';

/*
 * Dated commitments sit outside the regular week. They never change a job's
 * weekly match state (a job can still fit your usual week), but any shift that
 * lands on one of those dates is flagged so the student can arrange it first.
 */

export const DATED_KIND_META: Record<DatedKind, { label: string; hint: string; placeholder: string }> = {
  exam: { label: 'Exam or deadline', hint: 'A test day or due date', placeholder: 'CHEM 1A midterm' },
  event: { label: 'Appointment or event', hint: 'A one-off commitment', placeholder: 'Dentist appointment' },
  away: { label: 'Time away', hint: 'A trip, holiday or visit', placeholder: 'Family trip' },
  class: { label: 'Future class', hint: 'Next term, or a class starting later', placeholder: 'MATH 1C' },
  activity: { label: 'Future activity', hint: 'Practice, club, volunteering', placeholder: 'Soccer practice' },
};

/** How far ahead shifts are checked against dated commitments. */
export const LOOKAHEAD_DAYS = 180;

const pad = (n: number) => String(n).padStart(2, '0');
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const isoToday = (now = new Date()) => toIso(now);
export const isIsoDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && toIso(fromIso(iso)) === iso;

export function addDays(iso: string, days: number): string {
  const d = fromIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** Monday = 0 … Sunday = 6, matching the weekly grid. */
export const weekdayOf = (iso: string): Day => ((fromIso(iso).getDay() + 6) % 7) as Day;

const daySpan = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86_400_000);

/** The dates (within `from`..`to`, inclusive) on which an item happens. */
export function itemDates(item: DatedItem, from: string, to: string): string[] {
  const first = item.startDate > from ? item.startDate : from;
  const last = item.endDate < to ? item.endDate : to;
  const out: string[] = [];
  if (first > last) return out;
  for (let d = first, guard = 0; d <= last && guard < 800; d = addDays(d, 1), guard++) {
    if (item.repeat === 'once' || item.days.includes(weekdayOf(d))) out.push(d);
  }
  return out;
}

/** The time an item blocks on one of its dates, with the commute buffer around future classes. */
export function blockedTime(item: DatedItem, bufferMinutes: number): Interval {
  if (item.allDay) return { start: 0, end: 24 * 60 };
  const pad = item.kind === 'class' ? Math.max(0, bufferMinutes) : 0;
  return { start: Math.max(0, item.start - pad), end: Math.min(24 * 60, item.end + pad) };
}

export const isPast = (item: DatedItem, today: string) => item.endDate < today;

/** "Thu, Nov 19", "Dec 18 – Jan 4", "Tuesdays, Jan 5 – Mar 16". */
export function describeWhen(item: DatedItem): string {
  const year = (iso: string) => fromIso(iso).getFullYear();
  const withYear = year(item.startDate) !== year(item.endDate);
  const d = (iso: string) => formatDate(iso, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
  const time = item.allDay ? 'all day' : formatRange(item.start, item.end);
  if (item.repeat === 'weekly') {
    const days = item.days.length === 7 ? 'Every day' : formatDayList(item.days, 'short');
    return `${days} ${time} · ${d(item.startDate)} – ${d(item.endDate)}`;
  }
  if (item.startDate === item.endDate) return `${DAY_SHORT[weekdayOf(item.startDate)]}, ${d(item.startDate)} · ${time}`;
  return `${d(item.startDate)} – ${d(item.endDate)} · ${time}`;
}

export function validateItem(item: DatedItem): string | null {
  if (!item.title.trim()) return 'Add a short label, like “CHEM 1A midterm”.';
  if (!isIsoDate(item.startDate) || !isIsoDate(item.endDate)) return 'Choose the dates.';
  if (item.endDate < item.startDate) return 'The last date needs to be on or after the first date.';
  if (daySpan(item.startDate, item.endDate) > 366) return 'Keep it within a year. Add another item for later dates.';
  if (item.repeat === 'weekly') {
    if (!item.days.length) return 'Choose which days it repeats on.';
    if (!itemDates(item, item.startDate, item.endDate).length) return 'None of those days fall between the dates you chose.';
  }
  if (!item.allDay && item.end <= item.start) return 'The end time needs to be after the start time.';
  return null;
}

export interface DatedClash {
  shift: Shift;
  item: DatedItem;
  /** Dates on which this shift lands on the item, soonest first. */
  dates: string[];
}

/**
 * Shifts that land on a dated commitment between today and the lookahead
 * horizon. Weekly matching is unaffected; this only lists dates to arrange.
 */
export function datedClashes(job: Job, schedule: Schedule, today = isoToday(), horizon = LOOKAHEAD_DAYS): DatedClash[] {
  const to = addDays(today, horizon);
  const out: DatedClash[] = [];
  for (const item of schedule.upcoming ?? []) {
    if (isPast(item, today)) continue;
    const blocked = blockedTime(item, schedule.bufferMinutes);
    const dates = itemDates(item, today, to);
    for (const shift of job.shifts) {
      if (!validShift(shift) || !overlaps(shift, blocked)) continue;
      const hits = dates.filter((d) => weekdayOf(d) === shift.day);
      if (hits.length) out.push({ shift, item, dates: hits });
    }
  }
  return out.sort((a, b) => a.dates[0].localeCompare(b.dates[0]) || Number(b.shift.required) - Number(a.shift.required));
}

/** Plain-language line for one clash, e.g. "Tue Nov 17 · your Tuesday 1–5 pm shift overlaps CHEM 1A midterm". */
export function describeClash(c: DatedClash): string {
  const shift = `${DAY_LONG[c.shift.day]} ${formatRange(c.shift.start, c.shift.end)}`;
  const when =
    c.dates.length === 1
      ? formatDate(c.dates[0], { weekday: 'short', month: 'short', day: 'numeric' })
      : `${c.dates.length} ${DAY_LONG[c.shift.day]}s, ${formatDate(c.dates[0])} – ${formatDate(c.dates[c.dates.length - 1])}`;
  return `${when}: the ${shift} shift overlaps ${c.item.title}${c.item.kind === 'class' ? ' (including your commute buffer)' : ''}.`;
}

/** Total distinct shift dates to arrange, for short labels. */
export const clashDateCount = (clashes: DatedClash[]) => new Set(clashes.flatMap((c) => c.dates.map((d) => `${c.shift.id}:${d}`))).size;

export function normaliseUpcoming(saved: unknown): DatedItem[] {
  if (!Array.isArray(saved)) return [];
  return saved
    .filter((i): i is DatedItem => !!i && typeof i === 'object' && typeof (i as DatedItem).id === 'string')
    .map(
      (i): DatedItem => ({
      ...i,
      kind: i.kind in DATED_KIND_META ? i.kind : 'event',
      repeat: i.repeat === 'weekly' ? 'weekly' : 'once',
      days: Array.isArray(i.days) ? i.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) : [],
      title: typeof i.title === 'string' ? i.title : '',
      startDate: String(i.startDate ?? ''),
      endDate: String(i.endDate ?? ''),
      start: Number(i.start) || 0,
      end: Number(i.end) || 0,
      allDay: !!i.allDay,
    }),
    )
    .filter((i) => validateItem(i) === null);
}

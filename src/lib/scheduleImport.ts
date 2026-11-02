import type { DayCode, ScheduleExtraction } from '../../server/scheduleSchema';
import type { Day, ScheduleBlock } from './types';

/*
 * Turns the model's extraction into editable class rows, and the student's
 * "when are you willing to work?" answers into availability blocks. Nothing
 * here is trusted blindly: every row is reviewed by the student before it is
 * used for matching.
 */

const DAY_INDEX: Record<DayCode, Day> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

export interface ReviewRow extends ScheduleBlock {
  kind: 'class';
  /** The model was unsure, or the time couldn't be read: ask the student to check. */
  needsCheck: boolean;
  note?: string;
}

export interface ImportReview {
  rows: ReviewRow[];
  unscheduled: { course: string; reason: string }[];
  warnings: string[];
  term: { name: string | null; start: string; end: string } | null;
}

/** "13:30" or "9:05" → minutes since midnight; null if it isn't a valid 24-hour time. */
export function parseClock(value: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

const isIsoDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export function toReview(extraction: ScheduleExtraction): ImportReview {
  const rows: ReviewRow[] = [];
  const unscheduled: ImportReview['unscheduled'] = [];
  const warnings = [...extraction.warnings];
  const seen = new Set<string>();
  let n = 0;

  for (const cls of extraction.classes) {
    const course = cls.course_code.trim() || 'Class';
    const timed = cls.meetings.filter((m) => m.days.length > 0);
    if (timed.length === 0) {
      unscheduled.push({ course, reason: cls.unscheduled_reason ?? 'No weekly meeting time listed' });
      continue;
    }
    if (timed.length < cls.meetings.length) warnings.push(`${course}: a meeting had no days listed, so it was left out.`);

    for (const meeting of timed) {
      const start = parseClock(meeting.start_time);
      const end = parseClock(meeting.end_time);
      const unreadable = start === null || end === null || end <= start;
      for (const code of new Set(meeting.days)) {
        const day = DAY_INDEX[code];
        const key = `${course}|${day}|${start}|${end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = start ?? 9 * 60;
        rows.push({
          id: `import-${++n}`,
          kind: 'class',
          day,
          start: s,
          end: end !== null && end > s ? end : s + 60,
          title: course,
          detail: cls.title?.trim() || undefined,
          needsCheck: cls.confidence === 'low' || unreadable,
          note: unreadable ? 'The time couldn’t be read. Set it from your official schedule.' : (cls.note ?? undefined),
        });
      }
    }
  }

  rows.sort((a, b) => a.day - b.day || a.start - b.start);
  const { name, start_date, end_date } = extraction.term;
  const term = isIsoDate(start_date) && isIsoDate(end_date) && end_date > start_date ? { name, start: start_date, end: end_date } : null;
  return { rows, unscheduled, warnings, term };
}

/** First problem that blocks confirming the rows, or null. */
export function rowProblem(rows: ScheduleBlock[]): string | null {
  for (const r of rows) {
    if (!r.title.trim()) return 'Every class needs a course code.';
    if (r.end <= r.start) return `${r.title} ends before it starts. Fix its times.`;
  }
  return null;
}

/** Strips review-only fields and gives each class a fresh id. */
export function rowsToBlocks(rows: ScheduleBlock[]): ScheduleBlock[] {
  const stamp = Date.now().toString(36);
  return rows.map((r, i) => ({ id: `class-${stamp}-${i}`, kind: 'class', day: r.day, start: r.start, end: r.end, title: r.title.trim(), detail: r.detail }));
}

export interface DayWindow {
  day: Day;
  on: boolean;
  start: number;
  end: number;
}

/**
 * Starting suggestion for "When are you willing to work?". The student edits
 * it; classes, commitments and commute buffers are subtracted automatically by
 * the matching engine, so these windows can safely overlap classes.
 */
export function suggestedWindows(): DayWindow[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Day[]).map((day) => ({
    day,
    on: day <= 5,
    start: day === 5 ? 10 * 60 : 9 * 60,
    end: day === 5 ? 16 * 60 : 19 * 60,
  }));
}

export function windowsToBlocks(windows: DayWindow[]): ScheduleBlock[] {
  const stamp = Date.now().toString(36);
  return windows
    .filter((w) => w.on && w.end > w.start)
    .map((w) => ({ id: `available-${stamp}-${w.day}`, kind: 'available', day: w.day, start: w.start, end: w.end, title: 'Available to work' }));
}

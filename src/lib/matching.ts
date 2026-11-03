import { independentOptional, requiredOverlap, validShift } from './shiftRules';
import { covers, merge, overlaps, subtract } from './intervals';
import { DAY_LONG, DAY_SHORT, formatRange, formatTimeWords, numberWord } from './time';
import type { Day, Interval, Job, Match, MatchState, Schedule, ScheduleBlock, Shift, ShiftCheck, ShiftStatus } from './types';

/*
 * Compatibility rules (kept deliberately simple and explainable):
 *
 * 1. Work can only happen inside time the student explicitly marked "available".
 *    Unmarked time is never assumed to be free.
 * 2. Classes, study time, activities and other commitments always win over
 *    availability.
 * 3. The commute buffer applies around every class: a shift may not start
 *    until `buffer` minutes after a class ends, and must end `buffer` minutes
 *    before a class starts.
 * 4. A job only "fits" when every mandatory shift fits. One fitting shift never
 *    makes a whole role compatible.
 * 5. Unknown requirements (variable hours, unset shift times) are labelled
 *    "needs confirmation", never treated as a match.
 */

const SEVERITY: Record<ShiftStatus, number> = { fits: 0, commute: 1, outside: 2, overlap: 3 };

export const STATE_RANK: Record<MatchState, number> = { fits: 0, optional: 1, confirm: 2, commute: 3, conflict: 4 };

export const isConflict = (s: MatchState) => s === 'commute' || s === 'conflict';

const isCommitment = (b: ScheduleBlock) => b.kind !== 'available';

export function describeBlock(b: ScheduleBlock): string {
  switch (b.kind) {
    case 'class':
      return `${b.title} class`;
    case 'study':
      return 'study time';
    case 'activity':
      return b.title || 'activity';
    case 'other':
      return b.title ? b.title.charAt(0).toLowerCase() + b.title.slice(1) : 'other commitment';
    default:
      return 'availability';
  }
}

/** Buffer zones in front of and behind each class on a day. */
export function bufferZones(blocks: ScheduleBlock[], day: Day, buffer: number): Interval[] {
  if (buffer <= 0) return [];
  return blocks
    .filter((b) => b.day === day && b.kind === 'class')
    .flatMap((c) => [
      { start: Math.max(0, c.start - buffer), end: c.start },
      { start: c.end, end: Math.min(24 * 60, c.end + buffer) },
    ]);
}

/**
 * The windows a student can actually work on a given day: marked availability,
 * minus every commitment, minus commute buffers around classes. This is also
 * what an employer would see instead of the class timetable.
 */
export function workableWindows(schedule: Schedule, day: Day): Interval[] {
  const dayBlocks = schedule.blocks.filter((b) => b.day === day);
  const available = dayBlocks.filter((b) => b.kind === 'available');
  const blocked = [...dayBlocks.filter(isCommitment), ...bufferZones(schedule.blocks, day, schedule.bufferMinutes)];
  return subtract(available, blocked).filter((w) => w.end - w.start >= 15);
}

export function weeklyWindows(schedule: Schedule): { day: Day; windows: Interval[] }[] {
  return ([0, 1, 2, 3, 4, 5, 6] as Day[]).map((day) => ({ day, windows: workableWindows(schedule, day) })).filter((d) => d.windows.length > 0);
}

export function workableMinutes(schedule: Schedule): number {
  return weeklyWindows(schedule).reduce((sum, d) => sum + d.windows.reduce((s, w) => s + (w.end - w.start), 0), 0);
}

export function checkShift(shift: Shift, schedule: Schedule): ShiftCheck {
  const dayName = DAY_LONG[shift.day];
  const dayBlocks = schedule.blocks.filter((b) => b.day === shift.day);
  const buffer = schedule.bufferMinutes;
  const issues: { status: ShiftStatus; reason: string; blockerId?: string }[] = [];

  // 1. Direct overlap with a class or other commitment.
  for (const b of dayBlocks.filter(isCommitment).sort((x, y) => x.start - y.start)) {
    if (overlaps(b, shift)) {
      issues.push({
        status: 'overlap',
        reason: `${dayName}'s shift overlaps your ${describeBlock(b)} (${formatRange(b.start, b.end)}).`,
        blockerId: b.id,
      });
    }
  }

  // 2. Not enough travel time around a class.
  if (buffer > 0) {
    const classes = dayBlocks.filter((b) => b.kind === 'class');
    const before = classes.filter((c) => c.end <= shift.start && shift.start - c.end < buffer).sort((x, y) => y.end - x.end)[0];
    if (before) {
      issues.push({
        status: 'commute',
        reason:
          `Your ${dayName} ${before.title} class ends at ${formatTimeWords(before.end)}. ` +
          `With your ${buffer}-minute buffer, you can start at ${formatTimeWords(before.end + buffer)}, ` +
          `but this shift starts at ${formatTimeWords(shift.start)}.`,
        blockerId: before.id,
      });
    }
    const after = classes.filter((c) => c.start >= shift.end && c.start - shift.end < buffer).sort((x, y) => x.start - y.start)[0];
    if (after) {
      issues.push({
        status: 'commute',
        reason:
          `Your ${dayName} ${after.title} class starts at ${formatTimeWords(after.start)}. ` +
          `With your ${buffer}-minute buffer, you'd need to finish by ${formatTimeWords(after.start - buffer)}, ` +
          `but this shift ends at ${formatTimeWords(shift.end)}.`,
        blockerId: after.id,
      });
    }
  }

  // 3. Inside time the student marked as available to work.
  const available = merge(dayBlocks.filter((b) => b.kind === 'available'));
  if (!covers(available, shift)) {
    issues.push({ status: 'outside', reason: outsideReason(shift, available) });
  }

  if (issues.length === 0) {
    return { shift, status: 'fits', reasons: [fitReason(shift, dayBlocks, buffer)] };
  }
  issues.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);
  return {
    shift,
    status: issues[0].status,
    reasons: issues.map((i) => i.reason),
    blockerId: issues.find((i) => i.blockerId)?.blockerId,
  };
}

function outsideReason(shift: Shift, available: Interval[]): string {
  const dayName = DAY_LONG[shift.day];
  if (available.length === 0) return `You haven't marked any time on ${dayName} as available to work.`;
  const startsInside = available.find((w) => w.start <= shift.start && shift.start < w.end);
  const endsInside = available.find((w) => w.start < shift.end && shift.end <= w.end);
  if (startsInside && !endsInside) {
    return `${dayName}'s shift runs until ${formatTimeWords(shift.end)}, but you marked yourself available until ${formatTimeWords(startsInside.end)}.`;
  }
  if (endsInside && !startsInside) {
    return `${dayName}'s shift starts at ${formatTimeWords(shift.start)}, but you marked yourself available from ${formatTimeWords(endsInside.start)}.`;
  }
  const windows = available.map((w) => formatRange(w.start, w.end)).join(' and ');
  return `${dayName}'s shift (${formatRange(shift.start, shift.end)}) is outside the time you marked available (${windows}).`;
}

function fitReason(shift: Shift, dayBlocks: ScheduleBlock[], buffer: number): string {
  const prevClass = dayBlocks.filter((b) => b.kind === 'class' && b.end <= shift.start).sort((x, y) => y.end - x.end)[0];
  const nextClass = dayBlocks.filter((b) => b.kind === 'class' && b.start >= shift.end).sort((x, y) => x.start - y.start)[0];
  if (prevClass) {
    const gap = shift.start - prevClass.end;
    if (buffer === 0)
      return `Your class ends at ${formatTimeWords(prevClass.end)}, ${gap} minutes before this shift. You haven't set a commute buffer.`;
    if (gap === buffer) return `Your class ends at ${formatTimeWords(prevClass.end)}, leaving exactly your ${buffer}-minute buffer.`;
    if (gap < 180) return `Your class ends at ${formatTimeWords(prevClass.end)}, leaving ${gap} minutes to travel (you need ${buffer}).`;
  }
  if (nextClass) {
    const gap = nextClass.start - shift.end;
    if (gap < 180) return `You finish ${gap} minutes before your next class (you need ${buffer}).`;
  }
  return `Inside the time you marked available on ${DAY_LONG[shift.day]}.`;
}

function countPhrase(n: number): string {
  if (n === 1) return 'Your weekly shift fits';
  if (n === 2) return 'Both weekly shifts fit';
  return `All ${numberWord(n)} weekly shifts fit`;
}

export function evaluateJob(job: Job, schedule: Schedule): Match {
  const checks = job.shifts.map((s) => checkShift(s, schedule));
  const required = checks.filter((c) => c.shift.required);
  const optional = checks.filter((c) => !c.shift.required);
  const requiredFit = required.filter((c) => c.status === 'fits').length;
  const optionalFit = independentOptional(
    optional.filter((c) => c.status === 'fits').map((c) => c.shift),
    required.map((c) => c.shift),
  );
  const base = {
    jobId: job.id,
    checks,
    requiredTotal: required.length,
    requiredFit,
    optionalTotal: optional.length,
    optionalFit,
  };

  if ((!job.shifts.length && job.hoursType !== 'variable') || job.shifts.some((s) => !validShift(s)))
    return { ...base, state: 'confirm', summary: 'Shift times need confirmation.' };
  if (requiredOverlap(job.shifts)) return { ...base, state: 'conflict', summary: 'Required shifts overlap. Ask the employer to correct the hours.' };
  const hard = required.find((c) => c.status === 'overlap' || c.status === 'outside');
  if (hard) return { ...base, state: 'conflict', summary: hard.reasons[0] };

  const commute = required.find((c) => c.status === 'commute');
  if (commute) return { ...base, state: 'commute', summary: commute.reasons[0] };

  if (job.hoursType === 'variable') {
    return {
      ...base,
      state: 'confirm',
      summary: 'Hours change week to week. Ask the employer to confirm which shifts are required.',
    };
  }

  if (job.pendingShift) {
    const lead =
      required.length === 0
        ? ''
        : required.length === 1
          ? `Your ${DAY_LONG[required[0].shift.day]} shift fits. `
          : `${countPhrase(required.length)}. `;
    return {
      ...base,
      state: 'confirm',
      summary: `${lead}Ask the employer to confirm the time of ${job.pendingShift}.`,
    };
  }

  if (job.hoursType === 'choose') {
    const min = job.minShifts ?? null;
    if (min === null)
      return { ...base, state: 'confirm', summary: 'Confirm the minimum weekly commitment before treating this as a schedule match.' };
    if (optionalFit === 0) {
      return { ...base, state: 'conflict', summary: "None of the optional shifts fit the time you're available." };
    }
    if (min !== null && optionalFit < min) {
      return {
        ...base,
        state: 'conflict',
        summary: `Only ${numberWord(optionalFit)} optional shift${optionalFit === 1 ? '' : 's'} fit${optionalFit === 1 ? 's' : ''}, but ${job.business} asks for at least ${numberWord(min)} a week.`,
      };
    }
    const lead = optionalFit === 1 ? `One optional shift fits` : `${numberWord(optionalFit, true)} optional shifts fit`;
    const fittingDays = optional.filter((c) => c.status === 'fits').map((c) => DAY_SHORT[c.shift.day]);
    return {
      ...base,
      state: 'optional',
      summary:
        min === null
          ? `${lead} (${joinList(fittingDays)}). Confirm the minimum weekly commitment.`
          : `${lead} (${joinList(fittingDays)}). ${job.business} asks for at least ${numberWord(min)} a week.`,
    };
  }

  const extra =
    optional.length > 0
      ? ` ${numberWord(optionalFit, true)} of ${numberWord(optional.length)} optional extra shifts also fit${optionalFit === 1 ? 's' : ''}.`
      : '';
  return { ...base, state: 'fits', summary: `${countPhrase(required.length)} your availability.${extra}` };
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

export function evaluateAll(jobs: Job[], schedule: Schedule): Record<string, Match> {
  return Object.fromEntries(jobs.map((j) => [j.id, evaluateJob(j, schedule)]));
}

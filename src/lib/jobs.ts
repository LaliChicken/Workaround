import { STATE_RANK, isConflict } from './matching';
import { formatDayList, formatRange } from './time';
import type { Category, Day, Job, Match } from './types';

const hrs = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** Weekly hours range for a job, in hours. */
export function jobHours(job: Job): { min: number; max: number; label: string } {
  if (job.hoursType === 'variable' && job.variableHours) {
    const { min, max } = job.variableHours;
    return { min, max, label: `${min}–${max} hrs/wk` };
  }
  if (job.hoursType === 'choose') {
    const lengths = job.shifts.map((s) => s.end - s.start).sort((a, b) => a - b);
    const min = hrs(lengths.slice(0, job.minShifts ?? 1).reduce((a, b) => a + b, 0));
    const max = hrs(lengths.reduce((a, b) => a + b, 0));
    return { min, max, label: `${min}–${max} hrs/wk` };
  }
  const req = hrs(job.shifts.filter((s) => s.required).reduce((a, s) => a + (s.end - s.start), 0));
  if (job.pendingShift) return { min: req, max: req + 4, label: `${req}+ hrs/wk` };
  return { min: req, max: req, label: `${req} hrs/wk` };
}

export function payLabel(job: Job): string {
  const f = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`);
  return job.pay.max ? `${f(job.pay.min)}–${f(job.pay.max).slice(1)}/hr` : `${f(job.pay.min)}/hr`;
}

export const HOURS_TYPE_LABEL: Record<Job['hoursType'], string> = {
  fixed: 'Fixed weekly shifts',
  choose: 'Choose your shifts',
  variable: 'Variable hours',
};

/** Short, card-friendly description of when the job happens. */
export function shiftSummary(job: Job): string {
  if (job.hoursType === 'variable') return job.variableHours?.pattern ?? 'Hours vary weekly';
  if (job.hoursType === 'choose') {
    const days = job.shifts.map((s) => s.day);
    const count = job.shifts.length;
    return `Pick ${job.minShifts ? `${job.minShifts}+ of ` : 'from '}${count} shifts · ${dayRun(days)}`;
  }
  const groups = new Map<string, Day[]>();
  for (const s of job.shifts.filter((x) => x.required)) {
    const key = formatRange(s.start, s.end);
    groups.set(key, [...(groups.get(key) ?? []), s.day]);
  }
  const parts = [...groups.entries()].map(([range, days]) => `${formatDayList(days)} · ${range}`);
  if (job.pendingShift) parts.push('+1 shift TBC');
  return parts.join(' + ');
}

/** "Mon–Fri" for a consecutive run, otherwise a list. */
function dayRun(days: Day[]): string {
  const uniq = [...new Set(days)].sort((a, b) => a - b);
  const consecutive = uniq.every((d, i) => i === 0 || d === uniq[i - 1] + 1);
  if (consecutive && uniq.length > 2) return `${formatDayList([uniq[0]])}–${formatDayList([uniq[uniq.length - 1]])}`;
  return formatDayList(uniq);
}

export interface JobFilters {
  minPay: number;
  withinHours: boolean;
  noExperience: boolean;
  categories: Category[];
  showConflicts: boolean;
  sort: 'fit' | 'pay' | 'distance';
}

export const DEFAULT_FILTERS: JobFilters = {
  minPay: 0,
  withinHours: false,
  noExperience: false,
  categories: [],
  showConflicts: false,
  sort: 'fit',
};

export interface FilterContext {
  matches: Record<string, Match>;
  hoursMin: number;
  hoursMax: number;
  /** Straight-line distance from the student's search area, by job id. */
  distances: Record<string, number>;
  /** The profile's search radius; the only distance control. */
  radiusMi: number;
}

/** True when any filter other than distance and the conflicts toggle is active. */
export const hasActiveFilters = (f: JobFilters) => Boolean(f.minPay || f.withinHours || f.noExperience || f.categories.length);

/** Pay, hours, experience and category filters. */
export function passesFilters(job: Job, f: JobFilters, ctx: FilterContext): boolean {
  if (f.minPay && (job.pay.max ?? job.pay.min) < f.minPay) return false;
  if (f.noExperience && job.experience === 'required') return false;
  if (f.categories.length && !f.categories.includes(job.category)) return false;
  if (f.withinHours) {
    const h = jobHours(job);
    if (h.max < ctx.hoursMin || h.min > ctx.hoursMax) return false;
  }
  return true;
}

export type HiddenReason = 'filters' | 'distance' | 'conflict';

/** Why a job is left out of the openings list, or null when it is shown. */
export function hiddenReason(job: Job, f: JobFilters, ctx: FilterContext): HiddenReason | null {
  if (!passesFilters(job, f, ctx)) return 'filters';
  if (ctx.radiusMi && ctx.distances[job.id] > ctx.radiusMi) return 'distance';
  if (!f.showConflicts && isConflict(ctx.matches[job.id].state)) return 'conflict';
  return null;
}

export function sortJobs(jobs: Job[], f: JobFilters, ctx: FilterContext): Job[] {
  const byFit = (a: Job, b: Job) => STATE_RANK[ctx.matches[a.id].state] - STATE_RANK[ctx.matches[b.id].state];
  const byDistance = (a: Job, b: Job) => ctx.distances[a.id] - ctx.distances[b.id];
  const byPay = (a: Job, b: Job) => (b.pay.max ?? b.pay.min) - (a.pay.max ?? a.pay.min);
  const order = f.sort === 'pay' ? [byPay, byFit] : f.sort === 'distance' ? [byDistance, byFit] : [byFit, byDistance];
  return [...jobs].sort((a, b) => {
    for (const cmp of order) {
      const r = cmp(a, b);
      if (r !== 0) return r;
    }
    return 0;
  });
}

/**
 * Splits jobs into the visible list and counts of what is hidden and why.
 * `conflicts` counts conflicting jobs that pass every other filter (the
 * number shown on the Show conflicts toggle).
 */
export function partitionJobs(jobs: Job[], f: JobFilters, ctx: FilterContext) {
  const reasons = new Map(jobs.map((j) => [j.id, hiddenReason(j, f, ctx)]));
  const visible = jobs.filter((j) => reasons.get(j.id) === null);
  const inRange = jobs.filter((j) => reasons.get(j.id) !== 'filters' && reasons.get(j.id) !== 'distance');
  return {
    visible: sortJobs(visible, f, ctx),
    hiddenConflicts: jobs.filter((j) => reasons.get(j.id) === 'conflict').length,
    outOfRange: jobs.filter((j) => reasons.get(j.id) === 'distance').length,
    conflicts: inRange.filter((j) => isConflict(ctx.matches[j.id].state)).length,
  };
}

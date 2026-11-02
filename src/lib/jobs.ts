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
  maxDistance: number;
  withinHours: boolean;
  noExperience: boolean;
  categories: Category[];
  showConflicts: boolean;
  sort: 'fit' | 'pay' | 'distance';
}

export const DEFAULT_FILTERS: JobFilters = {
  minPay: 0,
  maxDistance: 0,
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
}

/** Applies every filter except the compatibility toggle. */
export function passesFilters(job: Job, f: JobFilters, ctx: FilterContext): boolean {
  if (f.minPay && (job.pay.max ?? job.pay.min) < f.minPay) return false;
  if (f.maxDistance && job.distanceMi > f.maxDistance) return false;
  if (f.noExperience && job.experience === 'required') return false;
  if (f.categories.length && !f.categories.includes(job.category)) return false;
  if (f.withinHours) {
    const h = jobHours(job);
    if (h.max < ctx.hoursMin || h.min > ctx.hoursMax) return false;
  }
  return true;
}

export function sortJobs(jobs: Job[], f: JobFilters, ctx: FilterContext): Job[] {
  const byFit = (a: Job, b: Job) => STATE_RANK[ctx.matches[a.id].state] - STATE_RANK[ctx.matches[b.id].state];
  const byDistance = (a: Job, b: Job) => a.distanceMi - b.distanceMi;
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

/** Splits jobs into the default list and the conflicts hidden behind the toggle. */
export function partitionJobs(jobs: Job[], f: JobFilters, ctx: FilterContext) {
  const filtered = jobs.filter((j) => passesFilters(j, f, ctx));
  const conflicts = filtered.filter((j) => isConflict(ctx.matches[j.id].state));
  const visible = f.showConflicts ? filtered : filtered.filter((j) => !isConflict(ctx.matches[j.id].state));
  return { visible: sortJobs(visible, f, ctx), hiddenConflicts: f.showConflicts ? 0 : conflicts.length, conflicts: conflicts.length };
}

import { covers } from './intervals';
import { weeklyWindows } from './matching';
import { independentOptional, requiredOverlap, validShift } from './shiftRules';
import type { Day, Interval, Job, Schedule } from './types';
import type { Application, Profile } from '../state/store';

export const EMPLOYER_ID = 'hillside';
export interface BusinessProfile {
  name: string;
  category: string;
  area: string;
  description: string;
}
export type JobState = 'draft' | 'published' | 'paused' | 'closed';
export interface SharedWindow extends Interval {
  day: Day;
}
export interface ApplicationSnapshot {
  name: string;
  school: string;
  experience: string;
  resumeName: string | null;
  ageBand: Profile['ageBand'];
  stage: Profile['stage'];
  windows: SharedWindow[];
  complete: boolean;
}

/** Whitelist only fields explicitly reviewed on the application screen. */
export function applicationSnapshot(profile: Profile, schedule: Schedule, resumeAttached: boolean): ApplicationSnapshot {
  return {
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    school: profile.school,
    experience: profile.experience,
    resumeName: resumeAttached ? profile.resumeName : null,
    ageBand: profile.ageBand,
    stage: profile.stage,
    complete: true,
    windows: weeklyWindows(schedule).flatMap(({ day, windows }) => windows.map(({ start, end }) => ({ day, start, end }))),
  };
}

/** Old applications did not save profile or machine-readable windows; never invent consent retroactively. */
export const legacySnapshot = (): ApplicationSnapshot => ({
  name: 'Earlier application',
  school: '',
  experience: '',
  resumeName: null,
  ageBand: 'unknown',
  stage: 'college',
  windows: [],
  complete: false,
});
export const STAGE_LABELS = {
  submitted: 'Submitted',
  reviewing: 'Employer reviewing',
  interview: 'Interview',
  offer: 'Offer',
  closed: 'Closed',
} as const;
export const publishedJobs = (jobs: Job[]) => jobs.filter((j) => j.publication === 'published');
export const studentApplications = (applications: Application[]) => applications.filter((a) => a.source !== 'fixture');

export function coverage(job: Job, snapshot: ApplicationSnapshot) {
  const checks = job.shifts.map(
    (shift) =>
      ({
        shift,
        status: !validShift(shift)
          ? 'confirm'
          : covers(
                snapshot.windows.filter((w) => w.day === shift.day),
                shift,
              )
            ? 'fits'
            : snapshot.complete
              ? 'outside'
              : 'confirm',
      }) as const,
  );
  const required = checks.filter((c) => c.shift.required);
  const fit = required.filter((c) => c.status === 'fits').length;
  const optionalFit = independentOptional(
    checks.filter((c) => !c.shift.required && c.status === 'fits').map((c) => c.shift),
    required.map((c) => c.shift),
  );
  let state: 'fits' | 'outside' | 'confirm' = 'fits';
  if (required.some((c) => c.status === 'outside') || requiredOverlap(job.shifts)) state = 'outside';
  else if (!snapshot.complete || job.hoursType === 'variable' || job.pendingShift || !job.shifts.length || checks.some((c) => c.status === 'confirm'))
    state = 'confirm';
  else if (job.hoursType === 'choose') state = job.minShifts == null ? 'confirm' : optionalFit < job.minShifts ? 'outside' : 'fits';
  const summary =
    state === 'confirm'
      ? 'Availability or hours need confirmation'
      : state === 'outside'
        ? 'Does not cover the full schedule'
        : job.hoursType === 'choose'
          ? 'Meets the weekly shift minimum'
          : 'Fits all required shifts';
  return { checks, fit, total: required.length, optionalFit, state, summary };
}

export function validateJob(job: Job): string[] {
  const errors: string[] = [];
  if (!job.role.trim() || !job.area.trim() || !job.summary.trim()) errors.push('Add a title, location and summary.');
  if (
    !Number.isFinite(job.pay.min) ||
    job.pay.min <= 0 ||
    job.pay.min > 1000 ||
    (job.pay.max !== undefined && (!Number.isFinite(job.pay.max) || job.pay.max < job.pay.min || job.pay.max > 1000))
  )
    errors.push('Pay must be positive, at most $1,000/hour, and the maximum cannot be below the minimum.');
  if (job.shifts.some((s) => !validShift(s))) errors.push('Each shift needs a valid day and an end time after its start.');
  if (requiredOverlap(job.shifts)) errors.push('Required shifts cannot overlap.');
  if (job.hoursType === 'fixed' && !job.shifts.some((s) => s.required)) errors.push('Add at least one required shift for fixed hours.');
  if (job.hoursType === 'choose') {
    if (!job.shifts.some((s) => !s.required)) errors.push('Add optional shifts for students to choose from.');
    if (
      job.minShifts != null &&
      (!Number.isInteger(job.minShifts) ||
        job.minShifts < 1 ||
        job.minShifts >
          independentOptional(
            job.shifts.filter((s) => !s.required),
            job.shifts.filter((s) => s.required),
          ))
    )
      errors.push('The optional shift minimum must be achievable without overlapping shifts.');
  }
  if (
    job.hoursType === 'variable' &&
    (!job.variableHours ||
      !Number.isFinite(job.variableHours.min) ||
      !Number.isFinite(job.variableHours.max) ||
      job.variableHours.min < 0 ||
      job.variableHours.max < job.variableHours.min ||
      job.variableHours.max > 168)
  )
    errors.push('Enter a weekly hours range from 0 to 168.');
  return errors;
}

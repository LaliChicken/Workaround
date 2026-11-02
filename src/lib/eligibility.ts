import type { AgeBand, Job, StudentStage } from './types';

export const STAGE_LABEL: Record<StudentStage, string> = {
  college: 'College undergraduate',
  'dual-enrollment': 'Dual-enrollment student',
  'high-school': 'High school student',
};

export const AGE_LABEL: Record<AgeBand, string> = {
  'under-16': 'Under 16',
  '16-17': '16–17',
  '18+': '18 or older',
  unknown: 'Prefer not to say yet',
};

export interface EligibilityNotice {
  tone: 'info' | 'warning';
  text: string;
}

const AGE_RANGE: Record<Exclude<AgeBand, 'unknown'>, { min: number; max: number }> = {
  'under-16': { min: 0, max: 15 },
  '16-17': { min: 16, max: 17 },
  '18+': { min: 18, max: Infinity },
};

const AGE_PHRASE: Record<Exclude<AgeBand, 'unknown' | '18+'>, string> = {
  'under-16': 'under 16',
  '16-17': '16–17',
};

/**
 * What the student should know about age and eligibility for a job. This only
 * flags requirements; it never claims the student is legally eligible. The
 * employer (and, for minors, the school) confirms eligibility.
 */
export function ageNotices(person: { ageBand: AgeBand }, job: Job): EligibilityNotice[] {
  const notes: EligibilityNotice[] = [];
  const { ageBand } = person;

  if (job.minAge) {
    if (ageBand === 'unknown') {
      notes.push({ tone: 'warning', text: `Minimum age ${job.minAge}. Add your age in Profile to check this requirement.` });
    } else if (AGE_RANGE[ageBand].max < job.minAge) {
      const phrase = ageBand === '18+' ? '' : AGE_PHRASE[ageBand];
      notes.push({ tone: 'warning', text: `Minimum age ${job.minAge}. You told us you’re ${phrase}, so this role may not be open to you.` });
    } else if (AGE_RANGE[ageBand].min < job.minAge) {
      notes.push({ tone: 'warning', text: `Minimum age ${job.minAge}. Check that you meet it before you apply.` });
    } else {
      notes.push({ tone: 'info', text: `Minimum age ${job.minAge}.` });
    }
  }

  for (const item of job.eligibility) notes.push({ tone: 'info', text: item });

  if (ageBand === 'under-16') {
    notes.push({
      tone: 'info',
      text: 'Students under 16 can do fewer kinds of work and fewer hours, especially on school days, and usually need a work permit. Your school and the employer confirm what applies to you.',
    });
  } else if (ageBand === '16-17') {
    notes.push({
      tone: 'info',
      text: 'Students under 18 usually need a work permit, and hours on school days are limited. Your school and the employer confirm what applies to you.',
    });
  } else if (ageBand === 'unknown' && !job.minAge) {
    notes.push({ tone: 'info', text: 'You haven’t shared your age. Some jobs and permitted hours depend on it.' });
  }

  notes.push({ tone: 'info', text: 'Age and work eligibility are confirmed by the employer. A calendar match doesn’t establish them.' });
  return notes;
}

/** "Foothill College · Dual-enrollment student · 16–17" (age omitted when not shared). */
export function studentSummary(p: { school: string; stage: StudentStage; ageBand: AgeBand }): string {
  return [p.school, STAGE_LABEL[p.stage], p.ageBand === 'unknown' ? null : AGE_LABEL[p.ageBand]].filter(Boolean).join(' · ');
}

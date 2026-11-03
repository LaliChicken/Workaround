import { JOBS } from './jobs';
import { EMPLOYER_ID, type BusinessProfile, type ApplicationSnapshot } from '../lib/employer';
import type { Application } from '../state/store';
import type { Job } from '../lib/types';

export const DEFAULT_BUSINESS: BusinessProfile = {
  name: 'Hillside Bean Café',
  category: 'Café',
  area: 'Los Altos',
  description: 'A friendly neighborhood café serving coffee, pastries and a little breathing room in Los Altos.',
};
export function initialJobs(): Job[] {
  const jobs: Job[] = structuredClone(JOBS).map((j) => ({
    ...j,
    employerId: j.id === 'hillside-barista' ? EMPLOYER_ID : j.id,
    publication: 'published',
  }));
  jobs.push({ ...structuredClone(jobs[0]), id: 'hillside-draft', role: 'Afternoon café assistant', publication: 'draft', postedDaysAgo: 0 });
  return jobs;
}
export function fixtureApplications(): Application[] {
  const base: ApplicationSnapshot = {
    name: '',
    school: 'Foothill College',
    experience: '',
    resumeName: null,
    ageBand: 'unknown',
    stage: 'college',
    windows: [],
    complete: true,
  };
  const snapshots: ApplicationSnapshot[] = [
    {
      ...base,
      name: 'Maya Chen',
      experience: 'Six months helping at a community café. Comfortable taking orders and preparing drinks.',
      resumeName: 'Maya_Chen_Resume.pdf',
      windows: [
        { day: 1, start: 750, end: 1080 },
        { day: 3, start: 750, end: 1080 },
      ],
    },
    {
      ...base,
      name: 'Jordan Rivera',
      experience: 'Looking for my first paid role. Helped welcome visitors at a school open day.',
      windows: [{ day: 1, start: 780, end: 1020 }],
    },
    {
      ...base,
      name: 'Sam Patel',
      experience: 'Retail volunteer; enjoy working with customers.',
      complete: false,
      windows: [{ day: 1, start: 780, end: 1020 }],
    },
  ];
  return snapshots.map((snapshot, i) => ({
    id: `fixture-${i}`,
    jobId: 'hillside-barista',
    applicantId: `fixture-person-${i}`,
    source: 'fixture',
    snapshot,
    submittedAt: `2026-11-0${i + 1}T18:00:00Z`,
    status: 'submitted',
    sharedWindows: [],
    resumeAttached: !!snapshot.resumeName,
    note: '',
    stateAtSubmit: i === 0 ? 'fits' : i === 1 ? 'conflict' : 'confirm',
  }));
}

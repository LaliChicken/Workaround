import { describe, expect, it } from 'vitest';
import { JOBS, jobById } from '../data/jobs';
import { sampleSchedule } from '../data/sampleSchedule';
import { DEMO_PROFILE, normaliseProfile } from '../state/store';
import { ageNotices, studentSummary } from './eligibility';
import { jobDistance, jobDistances, milesBetween } from './geo';
import { DEFAULT_FILTERS, hiddenReason, partitionJobs, type FilterContext } from './jobs';
import { evaluateAll } from './matching';
import { optionsIncluding, timeOptions, toMinutes as t } from './time';
import type { AgeBand } from './types';

const job = (id: string) => jobById(id)!;

describe('age is independent of student type', () => {
  const grocery = job('valley-grocery'); // minimum age 18
  const texts = (ageBand: AgeBand, j = grocery) => ageNotices({ ageBand }, j).map((n) => `${n.tone}: ${n.text}`);

  it('warns a 16–17 year-old (including college and dual-enrollment students) about an 18+ role', () => {
    expect(texts('16-17')[0]).toBe('warning: Minimum age 18. You told us you’re 16–17, so this role may not be open to you.');
    expect(texts('under-16')[0]).toContain('You told us you’re under 16');
  });

  it('flags an unknown age instead of assuming eligibility', () => {
    expect(texts('unknown')[0]).toBe('warning: Minimum age 18. Add your age in Profile to check this requirement.');
    expect(texts('unknown', job('hillside-barista'))).toContain('info: You haven’t shared your age. Some jobs and permitted hours depend on it.');
  });

  it('never claims eligibility, even for adults', () => {
    const notes = texts('18+');
    expect(notes[0]).toBe('info: Minimum age 18.');
    expect(notes.at(-1)).toContain('confirmed by the employer');
  });

  it('summarises the student without inventing an age', () => {
    expect(studentSummary({ school: 'Foothill College', stage: 'dual-enrollment', ageBand: '16-17' })).toBe('Foothill College · Dual-enrollment student · 16–17');
    expect(studentSummary({ school: 'Foothill College', stage: 'college', ageBand: 'unknown' })).toBe('Foothill College · College undergraduate');
  });

  it('migrates older saved profiles without forcing an age', () => {
    const old = { ...DEMO_PROFILE, area: 'Near Foothill College', ageBand: 'adult', areaId: undefined } as never;
    const p = normaliseProfile(old);
    expect(p.ageBand).toBe('unknown');
    expect(p.areaId).toBe('foothill');
    expect('area' in p).toBe(false);
  });
});

describe('search area and radius drive results', () => {
  it('keeps the original distances from Foothill', () => {
    expect(jobDistance(job('hillside-barista'), 'foothill')).toBe(1.4);
    expect(jobDistance(job('happy-trails-walker'), 'foothill')).toBe(2.4);
    expect(jobDistance(job('bayside-swim'), 'foothill')).toBe(6.2);
  });

  it('measures from the chosen area', () => {
    expect(jobDistance(job('arbor-library'), 'mountain-view')).toBeLessThan(1);
    expect(jobDistance(job('corner-slice-prep'), 'de-anza')).toBeLessThan(1);
    expect(milesBetween({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBe(0);
  });

  it('hides jobs beyond the radius and reports why', () => {
    const matches = evaluateAll(JOBS, sampleSchedule());
    const ctx: FilterContext = { matches, hoursMin: 8, hoursMax: 16, distances: jobDistances(JOBS, 'mountain-view'), radiusMi: 2 };
    const { visible, outOfRange } = partitionJobs(JOBS, DEFAULT_FILTERS, ctx);
    expect(visible.every((j) => ctx.distances[j.id] <= 2)).toBe(true);
    expect(outOfRange).toBeGreaterThan(0);
    expect(hiddenReason(job('hillside-barista'), DEFAULT_FILTERS, ctx)).toBe('distance');
    expect(hiddenReason(job('hillside-barista'), { ...DEFAULT_FILTERS, categories: ['tutoring'] }, ctx)).toBe('filters');
    const wide = { ...ctx, radiusMi: 15 };
    expect(hiddenReason(job('juniper-counter'), DEFAULT_FILTERS, wide)).toBe('conflict');
    expect(hiddenReason(job('juniper-counter'), { ...DEFAULT_FILTERS, showConflicts: true }, wide)).toBeNull();
  });
});

describe('time selects', () => {
  it('include off-grid class times such as 11:20 am', () => {
    const opts = optionsIncluding(timeOptions(6, 23), t(11, 20));
    expect(opts).toContain(t(11, 20));
    expect(opts.indexOf(t(11, 20))).toBe(opts.indexOf(t(11, 15)) + 1);
    expect(optionsIncluding(timeOptions(6, 23), t(11, 15))).toEqual(timeOptions(6, 23));
  });
});

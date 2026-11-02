import { toMinutes as t } from '../lib/time';
import type { Schedule, ScheduleBlock } from '../lib/types';

/**
 * Sample week for the demo student: a Foothill College undergraduate with
 * Tuesday/Thursday classes ending at noon and a 30-minute commute buffer.
 * Fictional, for demonstration only.
 */
export const SAMPLE_CLASSES: ScheduleBlock[] = [
  { id: 'c-engl-mon', kind: 'class', day: 0, start: t(9, 30), end: t(11, 20), title: 'ENGL 1A', detail: 'Composition & Reading' },
  { id: 'c-engl-wed', kind: 'class', day: 2, start: t(9, 30), end: t(11, 20), title: 'ENGL 1A', detail: 'Composition & Reading' },
  { id: 'c-cs-mon', kind: 'class', day: 0, start: t(13, 30), end: t(15, 20), title: 'CS 1A', detail: 'Intro to Programming in Python' },
  { id: 'c-cs-wed', kind: 'class', day: 2, start: t(13, 30), end: t(15, 20), title: 'CS 1A', detail: 'Intro to Programming in Python' },
  { id: 'c-math-tue', kind: 'class', day: 1, start: t(10), end: t(12), title: 'MATH 1B', detail: 'Calculus II' },
  { id: 'c-math-thu', kind: 'class', day: 3, start: t(10), end: t(12), title: 'MATH 1B', detail: 'Calculus II' },
];

export const SAMPLE_OTHER_BLOCKS: ScheduleBlock[] = [
  { id: 'a-tue', kind: 'available', day: 1, start: t(12), end: t(19), title: 'Available to work' },
  { id: 'a-wed', kind: 'available', day: 2, start: t(16), end: t(18, 30), title: 'Available to work' },
  { id: 'a-thu', kind: 'available', day: 3, start: t(12), end: t(19), title: 'Available to work' },
  { id: 'a-fri', kind: 'available', day: 4, start: t(10), end: t(18), title: 'Available to work' },
  { id: 'a-sat', kind: 'available', day: 5, start: t(9), end: t(15), title: 'Available to work' },
  { id: 's-mon', kind: 'study', day: 0, start: t(16), end: t(18), title: 'Study', detail: 'Problem sets' },
  { id: 's-tue', kind: 'study', day: 1, start: t(19), end: t(21), title: 'Study', detail: 'Calculus review' },
  { id: 'x-wed', kind: 'activity', day: 2, start: t(18, 30), end: t(20), title: 'Robotics club' },
  { id: 'o-sun', kind: 'other', day: 6, start: t(11), end: t(17), title: 'Family time' },
];

export function sampleSchedule(): Schedule {
  return {
    blocks: [...SAMPLE_CLASSES, ...SAMPLE_OTHER_BLOCKS].map((b) => ({ ...b })),
    bufferMinutes: 30,
    termName: 'Fall quarter 2026',
    termStart: '2026-09-21',
    termEnd: '2026-12-11',
  };
}

export function emptySchedule(): Schedule {
  return { ...sampleSchedule(), blocks: [] };
}

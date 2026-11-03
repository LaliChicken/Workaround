import { overlaps } from './intervals';
import type { Shift } from './types';

export const validShift = (s: Shift) =>
  Number.isInteger(s.day) &&
  s.day >= 0 &&
  s.day <= 6 &&
  Number.isFinite(s.start) &&
  Number.isFinite(s.end) &&
  s.start >= 0 &&
  s.end <= 1440 &&
  s.end > s.start;
export const shiftsOverlap = (a: Shift, b: Shift) => a.day === b.day && overlaps(a, b);
export const requiredOverlap = (shifts: Shift[]) =>
  shifts.some((a, i) => a.required && shifts.slice(i + 1).some((b) => b.required && shiftsOverlap(a, b)));

/** Maximum independent optional shifts, excluding all mandatory commitments. */
export function independentOptional(shifts: Shift[], required: Shift[]): number {
  const selected: Shift[] = [];
  for (const s of [...shifts].sort((a, b) => a.end - b.end)) {
    if (!required.some((r) => shiftsOverlap(r, s)) && !selected.some((r) => shiftsOverlap(r, s))) selected.push(s);
  }
  return selected.length;
}

/** Duration range for selecting at least k optional shifts without double booking. */
export function optionalMinutes(shifts: Shift[], required: Shift[], k: number) {
  const sorted = shifts
    .filter((s) => validShift(s) && !required.some((r) => shiftsOverlap(r, s)))
    .sort((a, b) => a.day * 1440 + a.end - (b.day * 1440 + b.end));
  const minimum: number[][] = [Array(sorted.length + 1).fill(Infinity)];
  minimum[0][0] = 0;
  const maximum = [0];
  sorted.forEach((s, i) => {
    let previous = i - 1;
    while (previous >= 0 && sorted[previous].day * 1440 + sorted[previous].end > s.day * 1440 + s.start) previous--;
    const duration = s.end - s.start;
    const row = [...minimum[i]];
    for (let count = 1; count <= sorted.length; count++) row[count] = Math.min(row[count], minimum[previous + 1][count - 1] + duration);
    minimum.push(row);
    maximum.push(Math.max(maximum[i], maximum[previous + 1] + duration));
  });
  return { min: minimum[sorted.length][k] ?? Infinity, max: maximum[sorted.length] };
}

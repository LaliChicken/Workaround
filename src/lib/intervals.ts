import type { Interval } from './types';

/** Intervals are half-open: [start, end). Touching intervals do not overlap. */
export const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Sort and merge overlapping or touching intervals. */
export function merge(intervals: Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push(cur);
  }
  return out;
}

/** Remove every `cut` interval from `base`. */
export function subtract(base: Interval[], cuts: Interval[]): Interval[] {
  let pieces = merge(base);
  for (const cut of merge(cuts)) {
    const next: Interval[] = [];
    for (const p of pieces) {
      if (!overlaps(p, cut)) {
        next.push(p);
        continue;
      }
      if (cut.start > p.start) next.push({ start: p.start, end: cut.start });
      if (cut.end < p.end) next.push({ start: cut.end, end: p.end });
    }
    pieces = next;
  }
  return pieces;
}

/** True when `inner` lies entirely inside the union of `outer`. */
export function covers(outer: Interval[], inner: Interval): boolean {
  return subtract([inner], outer).length === 0;
}

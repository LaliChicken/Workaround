import type { CSSProperties } from 'react';
import { overlaps, subtract } from '../lib/intervals';
import { bufferZones } from '../lib/matching';
import { DAY_LONG, DAY_SHORT, formatRange, formatTime } from '../lib/time';
import type { Day, Job, Match, Schedule } from '../lib/types';
import { SHIFT_META } from './ui';
import { blockLabel } from './WeekGrid';

const pos = (start: number, end: number, from: number) =>
  ({ '--top': (start - from) / 60, '--len': (end - start) / 60 }) as CSSProperties;

/**
 * A compact view of the days a job needs, with the student's availability,
 * commitments and commute buffers behind each proposed shift.
 */
export function MiniWeek({ job, match, schedule }: { job: Job; match: Match; schedule: Schedule }) {
  if (job.shifts.length === 0) return null;
  const days = [...new Set(job.shifts.map((s) => s.day))].sort((a, b) => a - b) as Day[];
  const onDays = schedule.blocks.filter((b) => days.includes(b.day));

  let from = Math.min(...job.shifts.map((s) => s.start)) - 120;
  const to = Math.min(23 * 60, Math.ceil((Math.max(...job.shifts.map((s) => s.end)) + 60) / 60) * 60);
  for (const b of onDays.filter((b) => b.kind !== 'available')) {
    if (overlaps(b, { start: from, end: to })) from = Math.min(from, b.start);
  }
  from = Math.max(6 * 60, Math.floor(from / 60) * 60);
  const hours: number[] = [];
  for (let m = from; m < to; m += 60) hours.push(m);
  const clip = (s: number, e: number) => ({ start: Math.max(s, from), end: Math.min(e, to) });

  return (
    <figure className={`mini-week${days.length > 3 ? ' mini-many' : ''}`} style={{ '--hours': (to - from) / 60, '--cols': days.length } as CSSProperties}>
      <figcaption className="sr-only">Proposed shifts on your week. Details are listed below the chart.</figcaption>
      <div className="mini-head" aria-hidden="true">
        <span />
        {days.map((d) => (
          <span key={d}>{DAY_SHORT[d]}</span>
        ))}
      </div>
      <div className="mini-body" aria-hidden="true">
        <div className="mini-times">
          {hours.map((h) => (
            <span key={h}>{formatTime(h)}</span>
          ))}
        </div>
        {days.map((day) => {
          const blocks = onDays.filter((b) => b.day === day);
          const commitments = blocks.filter((b) => b.kind !== 'available');
          const buffers = subtract(bufferZones(schedule.blocks, day, schedule.bufferMinutes), commitments);
          return (
            <div key={day} className="mini-col">
              {blocks
                .filter((b) => b.kind === 'available' && b.end > from && b.start < to)
                .map((b) => {
                  const c = clip(b.start, b.end);
                  return <div key={b.id} className="mini-avail" style={pos(c.start, c.end, from)} />;
                })}
              {buffers
                .filter((z) => z.end > from && z.start < to)
                .map((z) => {
                  const c = clip(z.start, z.end);
                  return <div key={`b${z.start}`} className="mini-buffer" style={pos(c.start, c.end, from)} />;
                })}
              {commitments
                .filter((b) => b.end > from && b.start < to)
                .map((b) => {
                  const c = clip(b.start, b.end);
                  return (
                    <div key={b.id} className={`mini-commit mini-${b.kind}`} style={pos(c.start, c.end, from)}>
                      <span>{blockLabel(b)}</span>
                    </div>
                  );
                })}
              {match.checks
                .filter((c) => c.shift.day === day)
                .map((c) => {
                  const meta = SHIFT_META[c.status];
                  return (
                    <div
                      key={c.shift.id}
                      className={`mini-shift tone-${meta.tone}${c.shift.required ? '' : ' is-optional'}`}
                      style={pos(c.shift.start, c.shift.end, from)}
                      title={`${DAY_LONG[day]} ${formatRange(c.shift.start, c.shift.end)}: ${meta.label}`}
                    >
                      <meta.Icon size={14} strokeWidth={2.5} />
                      <span>{c.shift.required ? 'Shift' : 'Optional'}</span>
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
      <ul className="mini-legend" aria-hidden="true">
        <li>
          <span className="swatch swatch-available" /> Available
        </li>
        <li>
          <span className="swatch swatch-class" /> Class
        </li>
        <li>
          <span className="swatch swatch-buffer" /> Buffer
        </li>
        <li>
          <span className="swatch swatch-shift" /> Proposed shift
        </li>
      </ul>
    </figure>
  );
}

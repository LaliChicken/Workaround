import { CalendarDays, CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import { coverage, coverageLabel, coverageSentence, type ApplicationSnapshot } from '../../lib/employer';
import { DAY_LONG, DAY_SHORT, formatRange } from '../../lib/time';
import type { Day, Job } from '../../lib/types';

const STATUS = {
  fits: { Icon: CircleCheck, text: 'Fits', long: 'Fits shared availability' },
  outside: {
    Icon: CircleX,
    text: 'Outside',
    long: 'Outside shared availability',
  },
  confirm: { Icon: CircleHelp, text: 'Confirm', long: 'Needs confirmation' },
} as const;

/** Hours shown on the shared scale: everything in view, padded, at least 6 hours wide. */
function scaleFor(times: { start: number; end: number }[]) {
  if (!times.length) return { from: 9 * 60, to: 18 * 60 };
  let from = Math.max(0, Math.floor(Math.min(...times.map((t) => t.start)) / 60) * 60 - 60);
  let to = Math.min(1440, Math.ceil(Math.max(...times.map((t) => t.end)) / 60) * 60 + 60);
  while (to - from < 360) {
    if (from > 0) from -= 60;
    if (to - from < 360 && to < 1440) to += 60;
  }
  return { from, to };
}

const tickLabel = (m: number) => {
  const h = Math.floor(m / 60) % 24;
  if (h === 12) return 'noon';
  return `${h % 12 || 12}${h < 12 ? 'a' : 'p'}`;
};

/** Puts overlapping shifts on separate rows so none hides another. */
function stack<T extends { start: number; end: number }>(items: T[]): T[][] {
  const lanes: T[][] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start)) {
    const lane = lanes.find((l) => l[l.length - 1].end <= item.start);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

/**
 * Employer-safe comparison: the windows shared with one application and the
 * job's shifts on the same horizontal time scale, one row per day.
 */
export function SharedWeek({ job, snapshot }: { job: Job; snapshot: ApplicationSnapshot }) {
  const result = coverage(job, snapshot);
  const days = [...new Set<Day>([...job.shifts.map((s) => s.day), ...snapshot.windows.map((w) => w.day)])].sort();
  const { from, to } = scaleFor([...job.shifts, ...snapshot.windows]);
  const span = to - from;
  const pos = (start: number, end: number) => {
    const a = Math.max(start, from);
    const b = Math.min(end, to);
    return {
      left: `${((a - from) / span) * 100}%`,
      width: `${(Math.max(b - a, 0) / span) * 100}%`,
    };
  };
  const step = span > 12 * 60 ? 180 : span > 8 * 60 ? 120 : 60;
  const ticks: number[] = [];
  for (let m = Math.ceil(from / step) * step; m <= to; m += step) ticks.push(m);
  const tone = result.state === 'fits' ? 'fit' : result.state === 'confirm' ? 'confirm' : 'conflict';

  return (
    <section className="em-availability" aria-labelledby="em-availability-title">
      <div className="em-section-head">
        <h3 id="em-availability-title">
          <CalendarDays size={19} /> Shared availability vs. shifts
        </h3>
        <span className={`badge badge-${tone}`}>{coverageLabel(job, result)}</span>
      </div>
      <p className={`em-coverage-sentence tone-text-${tone}`}>
        <strong>{coverageSentence(job, result)}</strong>
      </p>

      {days.length > 0 && (
        <>
          <div className="em-tl-legend" aria-hidden="true">
            <span>
              <i className="em-tl-swatch em-tl-swatch-avail" /> Shared availability
            </span>
            <span>
              <i className="em-tl-swatch em-tl-swatch-shift" /> Job shift
            </span>
          </div>
          <div className="em-timeline" aria-hidden="true">
            <div className="em-tl-row em-tl-axis-row">
              <span />
              <div className="em-tl-axis">
                {ticks.map((m) => (
                  <span key={m} style={{ left: `${((m - from) / span) * 100}%` }}>
                    {tickLabel(m)}
                  </span>
                ))}
              </div>
            </div>
            {days.map((day) => {
              const windows = snapshot.windows.filter((w) => w.day === day);
              const checks = result.checks.filter((c) => c.shift.day === day);
              return (
                <div className="em-tl-row" key={day}>
                  <span className="em-tl-day">{DAY_SHORT[day]}</span>
                  <div className="em-tl-track">
                    {ticks.map((m) => (
                      <i key={m} className="em-tl-grid" style={{ left: `${((m - from) / span) * 100}%` }} />
                    ))}
                    <div className="em-tl-lane">
                      {windows.map((w, i) => (
                        <span className="em-tl-avail" key={i} style={pos(w.start, w.end)}>
                          {formatRange(w.start, w.end)}
                        </span>
                      ))}
                      {!windows.length && <span className="em-tl-none">{snapshot.complete ? 'None shared' : 'Not confirmed'}</span>}
                    </div>
                    {stack(checks.map((c) => ({ ...c, start: c.shift.start, end: c.shift.end }))).map((lane, li) => (
                      <div className="em-tl-lane" key={li}>
                        {lane.map((c) => {
                          const { Icon, text } = STATUS[c.status];
                          return (
                            <span
                              className={`em-tl-shift em-tl-shift-${c.status} ${c.shift.required ? '' : 'is-optional'}`}
                              key={c.shift.id}
                              style={pos(c.shift.start, c.shift.end)}
                            >
                              <Icon size={14} />
                              <b>{formatRange(c.shift.start, c.shift.end)}</b>
                              <small>
                                {text}
                                {c.shift.required ? '' : ' · optional'}
                              </small>
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {/* The same comparison as text, for screen readers. */}
          <ul className="sr-only">
            {days.map((day) => {
              const windows = snapshot.windows.filter((w) => w.day === day);
              return (
                <li key={day}>
                  {DAY_LONG[day]}. Shared availability:{' '}
                  {windows.map((w) => formatRange(w.start, w.end)).join(', ') || (snapshot.complete ? 'none shared' : 'not confirmed')}.{' '}
                  {result.checks
                    .filter((c) => c.shift.day === day)
                    .map((c) => `${c.shift.required ? 'Required' : 'Optional'} shift ${formatRange(c.shift.start, c.shift.end)}: ${STATUS[c.status].long}.`)
                    .join(' ')}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {!days.length && <p className="callout callout-warn">Hours and availability need confirmation.</p>}
      <p className="muted em-tl-note">Only the work windows shared with this application. Unmarked time is not available.</p>
      {job.pendingShift && <p className="callout callout-warn">Time not confirmed: {job.pendingShift}</p>}
    </section>
  );
}

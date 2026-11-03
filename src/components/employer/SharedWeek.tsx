import { CalendarDays, CircleCheck, CircleHelp, CircleX } from 'lucide-react';
import { coverage, type ApplicationSnapshot } from '../../lib/employer';
import { DAY_LONG, formatRange } from '../../lib/time';
import type { Job } from '../../lib/types';

export function SharedWeek({ job, snapshot }: { job: Job; snapshot: ApplicationSnapshot }) {
  const result = coverage(job, snapshot);
  const days = [...new Set([...job.shifts.map((s) => s.day), ...snapshot.windows.map((w) => w.day)])].sort();
  return (
    <section className="em-availability">
      <div className="em-section-head">
        <h3>
          <CalendarDays size={19} /> Shared availability & shifts
        </h3>
        <span className={`badge badge-${result.state === 'fits' ? 'fit' : result.state === 'confirm' ? 'confirm' : 'conflict'}`}>
          {result.fit}/{result.total} required shifts fit
        </span>
      </div>
      <p className="muted">Only the work windows shared with this application. Unmarked time is not available.</p>
      <div className="em-week" aria-label="Shared weekly availability">
        {days.map((day) => (
          <div className="em-day" key={day}>
            <h4>{DAY_LONG[day]}</h4>
            <div>
              <span className="em-small-label">Shared availability</span>
              {snapshot.windows
                .filter((w) => w.day === day)
                .map((w, i) => (
                  <div className="em-window" key={i}>
                    {formatRange(w.start, w.end)}
                  </div>
                ))}
              {!snapshot.windows.some((w) => w.day === day) && <p className="muted">{snapshot.complete ? 'None shared' : 'Not confirmed'}</p>}
            </div>
            <div>
              <span className="em-small-label">Job shifts</span>
              {result.checks
                .filter((c) => c.shift.day === day)
                .map((c) => {
                  const Icon = c.status === 'fits' ? CircleCheck : c.status === 'confirm' ? CircleHelp : CircleX;
                  return (
                    <div className={`em-shift em-shift-${c.status}`} key={c.shift.id}>
                      <strong>{formatRange(c.shift.start, c.shift.end)}</strong>
                      <small>{c.shift.required ? 'Required' : 'Optional'}</small>
                      <span>
                        <Icon size={16} />
                        {c.status === 'fits'
                          ? 'Fits shared availability'
                          : c.status === 'confirm'
                            ? 'Needs confirmation'
                            : 'Outside shared availability'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      {!days.length && <p className="callout callout-warn">Hours and availability need confirmation.</p>}
      {job.hoursType === 'choose' && (
        <p>
          {result.optionalFit} non-overlapping optional shifts fit. Weekly minimum: {job.minShifts ?? 'not confirmed'}.
        </p>
      )}
      {job.pendingShift && <p className="callout callout-warn">Time not confirmed: {job.pendingShift}</p>}
    </section>
  );
}

import { MapPin } from 'lucide-react';
import { HOURS_TYPE_LABEL, payLabel } from '../../lib/jobs';
import { DAY_LONG, formatRange } from '../../lib/time';
import type { Job } from '../../lib/types';

/** Public posting content only; does not evaluate a private student's schedule. */
export function JobPreview({ job }: { job: Job }) {
  return (
    <article className="em-preview">
      <p className="jd-biz">{job.business}</p>
      <h2>{job.role || 'Untitled role'}</h2>
      <p className="jd-loc">
        <MapPin size={16} /> {job.area} · {payLabel(job)} · Illustrative pay
      </p>
      <p>{job.summary}</p>
      <h3>{HOURS_TYPE_LABEL[job.hoursType]}</h3>
      <ul className="em-shift-list">
        {job.shifts.map((s) => (
          <li key={s.id}>
            <strong>
              {DAY_LONG[s.day]} {formatRange(s.start, s.end)}
            </strong>
            <span>{s.required ? 'Required' : 'Optional'}</span>
          </li>
        ))}
      </ul>
      {job.hoursType === 'choose' && (
        <p>Choose at least {job.minShifts ?? 'an unconfirmed number of'} optional shifts each week, in addition to any required shifts.</p>
      )}
      {job.hoursType === 'variable' && (
        <p>
          {job.variableHours?.min}–{job.variableHours?.max} hours per week. Times need confirmation.
        </p>
      )}
      {job.pendingShift && <p className="callout callout-warn">Time to confirm: {job.pendingShift}</p>}
      <h3>What you’ll do</h3>
      <ul>
        {job.duties.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <h3>What you’ll bring</h3>
      <ul>
        {job.qualifications.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
      <p>
        Experience: {job.experience === 'none' ? 'not required' : job.experience}. Existing resume: {job.resume}.
      </p>
      {!!job.eligibility.length && (
        <>
          <h3>Requirements to confirm</h3>
          <ul>
            {job.eligibility.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </>
      )}
      {job.businessDescription && (
        <>
          <h3>About {job.business}</h3>
          <p>{job.businessDescription}</p>
        </>
      )}
      <p className="privacy-note">Fictional opening. Students review their schedule fit before applying.</p>
    </article>
  );
}

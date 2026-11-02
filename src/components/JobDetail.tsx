import { ArrowLeft, CircleAlert, CircleQuestionMark, Info, MapPin, Pencil, Send, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { HOURS_TYPE_LABEL, jobHours, payLabel } from '../lib/jobs';
import { href } from '../lib/router';
import { DAY_LONG, formatRange } from '../lib/time';
import type { Job } from '../lib/types';
import { useStore } from '../state/store';
import { ApplyDialog } from './ApplyDialog';
import { SaveButton } from './JobCard';
import { MiniWeek } from './MiniWeek';
import { DemoTag, SHIFT_META, STATE_META, StatusBadge } from './ui';

const EXPERIENCE_LABEL = { none: 'Not required', preferred: 'Preferred', required: 'Required' } as const;

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function JobDetail({ job, onBack }: { job: Job; onBack?: () => void }) {
  const { state, matches } = useStore();
  const [applying, setApplying] = useState(false);
  const match = matches[job.id];
  const tone = STATE_META[match.state].tone;
  const application = state.applications.find((a) => a.jobId === job.id && a.status !== 'closed');
  const { profile } = state;
  const minor = profile.ageBand === '16-17';
  const checks = [...match.checks].sort((a, b) => Number(b.shift.required) - Number(a.shift.required) || a.shift.day - b.shift.day);

  return (
    <article className="job-detail" aria-labelledby="job-title">
      {onBack && (
        <button type="button" className="link-btn back-link" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" /> All jobs
        </button>
      )}
      <header className="jd-head">
        <div className="jd-heading">
          <p className="jd-biz">{job.business}</p>
          <h2 id="job-title" tabIndex={-1}>
            {job.role}
          </h2>
          <p className="jd-loc">
            <MapPin size={16} aria-hidden="true" /> {job.area} · {job.distanceMi} mi from campus · Posted {job.postedDaysAgo} day{job.postedDaysAgo === 1 ? '' : 's'} ago
          </p>
        </div>
        <div className="jd-actions">
          <SaveButton job={job} withLabel />
          {application ? (
            <a className="btn btn-secondary" href={href('/applications')}>
              <Send size={18} aria-hidden="true" /> Applied · View status
            </a>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => setApplying(true)}>
              <Send size={18} aria-hidden="true" /> Apply <DemoTag />
            </button>
          )}
        </div>
      </header>

      <dl className="jd-facts">
        <div>
          <dt>Pay</dt>
          <dd>
            {payLabel(job)} <small>illustrative</small>
          </dd>
        </div>
        <div>
          <dt>Weekly hours</dt>
          <dd>{jobHours(job).label}</dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>{HOURS_TYPE_LABEL[job.hoursType]}</dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd>{EXPERIENCE_LABEL[job.experience]}</dd>
        </div>
      </dl>

      <section className={`fit-panel fit-${tone}`} aria-labelledby="fit-title">
        <div className="fit-head">
          <h3 id="fit-title">How this job fits your week</h3>
          <StatusBadge state={match.state} size="lg" />
          <p className="fit-summary" aria-live="polite">
            {match.summary}
          </p>
        </div>
        <div className="fit-body">
          <MiniWeek job={job} match={match} schedule={state.schedule} />
          <ul className="shift-checks">
            {checks.map((c) => {
              const meta = SHIFT_META[c.status];
              return (
                <li key={c.shift.id} className={`shift-check tone-${meta.tone}`}>
                  <meta.Icon className="sc-icon" size={20} aria-hidden="true" />
                  <div>
                    <p className="sc-when">
                      {DAY_LONG[c.shift.day]} {formatRange(c.shift.start, c.shift.end)}
                      <span className="sc-tag">{c.shift.required ? 'Required' : 'Optional'}</span>
                    </p>
                    <p className="sc-status">{meta.label}</p>
                    {c.reasons.map((r) => (
                      <p key={r} className="sc-reason">
                        {r}
                      </p>
                    ))}
                  </div>
                </li>
              );
            })}
            {job.pendingShift && (
              <li className="shift-check tone-confirm">
                <CircleQuestionMark className="sc-icon" size={20} aria-hidden="true" />
                <div>
                  <p className="sc-when">
                    {capitalise(job.pendingShift)}
                    <span className="sc-tag">Required</span>
                  </p>
                  <p className="sc-status">Time not set yet</p>
                  <p className="sc-reason">The employer hasn’t said when this shift is. Ask before you rely on this job.</p>
                </div>
              </li>
            )}
            {job.hoursType === 'variable' && job.variableHours && (
              <li className="shift-check tone-confirm">
                <CircleQuestionMark className="sc-icon" size={20} aria-hidden="true" />
                <div>
                  <p className="sc-when">
                    {job.variableHours.min}–{job.variableHours.max} hours a week
                  </p>
                  <p className="sc-status">Shifts aren’t fixed</p>
                  <p className="sc-reason">
                    {job.variableHours.pattern}. We can’t check this against your week until the employer confirms which shifts are required.
                  </p>
                </div>
              </li>
            )}
          </ul>
        </div>
        <footer className="fit-foot">
          <p>
            <Info size={16} aria-hidden="true" /> Compatibility is a schedule check. It doesn’t guarantee you’ll be hired, how long travel takes, or that you’re
            eligible to work.
          </p>
          <a className="btn btn-quiet btn-sm" href={href('/schedule')}>
            <Pencil size={16} aria-hidden="true" /> Edit my schedule
          </a>
        </footer>
      </section>

      <section className="jd-section">
        <h3>About the role</h3>
        <p>{job.summary}</p>
        <div className="jd-columns">
          <div>
            <h4>What you’ll do</h4>
            <ul>
              {job.duties.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Essential qualifications</h4>
            <ul>
              {job.qualifications.map((q) => (
                <li key={q}>{q}</li>
              ))}
              {job.experienceNote && <li>{job.experienceNote}</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="jd-section">
        <h3>
          <ShieldCheck size={20} aria-hidden="true" /> Eligibility the employer confirms
        </h3>
        <ul className="eligibility">
          {job.minAge && (
            <li className={minor && job.minAge >= 18 ? 'is-warning' : undefined}>
              {minor && job.minAge >= 18 && <CircleAlert size={16} aria-hidden="true" />}
              Minimum age {job.minAge}.{minor && job.minAge >= 18 && ' You told us you’re 16–17, so this role may not be open to you.'}
            </li>
          )}
          {job.eligibility.map((e) => (
            <li key={e}>{e}</li>
          ))}
          {minor && (
            <li>Students under 18 usually need a work permit, and hours on school days are limited. Your school and the employer confirm what applies to you.</li>
          )}
          <li>Age and work eligibility are confirmed by the employer. A calendar match doesn’t establish them.</li>
        </ul>
      </section>

      <p className="demo-foot">Fictional opening created for this demo. It is not a live vacancy or an employer commitment.</p>

      {applying && <ApplyDialog job={job} onClose={() => setApplying(false)} />}
    </article>
  );
}

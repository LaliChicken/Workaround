import { ArrowLeft, ArrowRight, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CATEGORY_LABEL } from '../../data/jobs';
import { EMPLOYER_ID, validateJob } from '../../lib/employer';
import { href, navigate } from '../../lib/router';
import { DAY_LONG, DAY_SHORT, formatRange } from '../../lib/time';
import type { Category, Day, Job } from '../../lib/types';
import { useStore } from '../../state/store';
import { JobPreview } from '../../components/employer/JobPreview';

const timeValue = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const minutes = (s: string) => (s ? Number(s.slice(0, 2)) * 60 + Number(s.slice(3)) : NaN);
export function JobEditor({ existing }: { existing?: Job }) {
  const { state, saveJob } = useStore();
  const [job, setJob] = useState<Job>(() =>
    existing
      ? structuredClone(existing)
      : {
          id: `job-${crypto.randomUUID()}`,
          employerId: EMPLOYER_ID,
          publication: 'draft',
          role: '',
          business: state.business.name,
          businessDescription: state.business.description,
          area: state.business.area,
          location: { lat: 37.3789, lng: -122.1152 },
          category: 'food',
          pay: { min: 20.5 },
          hoursType: 'fixed',
          shifts: [],
          summary: '',
          duties: [],
          qualifications: [],
          eligibility: [],
          experience: 'none',
          resume: 'optional',
          postedDaysAgo: 0,
        },
  );
  const [step, setStep] = useState(0);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);
  const [days, setDays] = useState<Day[]>([1, 3]);
  const [start, setStart] = useState('13:00');
  const [end, setEnd] = useState('17:00');
  const [required, setRequired] = useState(true);
  const [shiftError, setShiftError] = useState('');
  const patch = (p: Partial<Job>) => setJob((j) => ({ ...j, ...p }));
  const errors = validateJob(job);
  const save = (publication: Job['publication']) => {
    saveJob({ ...job, publication });
    navigate(`/employer/jobs/${job.id}`);
  };
  const field = (label: string, value: string, onChange: (value: string) => void, multiline = false) => (
    <label className="field">
      <span className="label">{label}</span>
      {multiline ? (
        <textarea className="input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </label>
  );
  return (
    <div className="page em-editor">
      <a className="back-link link-btn" href={href('/employer/jobs')}>
        <ArrowLeft size={16} /> All jobs
      </a>
      <header className="page-head">
        <div>
          <p className="em-eyebrow">HOURS FIRST. A BETTER FIT.</p>
          <h1>{existing ? 'Edit opening' : 'Create an opening'}</h1>
          <p className="page-sub">Tell students what the work looks like—and when you need them.</p>
        </div>
        <span className="badge badge-confirm">{existing?.publication ?? 'Draft'}</span>
      </header>
      <div className="em-editor-layout">
        <section className="card em-editor-main">
          <nav className="em-steps" aria-label="Job form sections">
            {['Role', 'Hours', 'Preview'].map((label, i) => (
              <button key={label} aria-current={step === i ? 'step' : undefined} onClick={() => setStep(i)}>
                <span>{i + 1}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="em-form-content" key={step}>
            {step === 0 && (
              <>
                <h2>A little about the role</h2>
                {field('Job title', job.role, (role) => patch({ role }))}
                <div className="field-row">
                  <label className="field">
                    <span className="label">Category</span>
                    <select className="input" value={job.category} onChange={(e) => patch({ category: e.target.value as Category })}>
                      {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
                        <option value={v} key={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                  {field('Approximate location', job.area, (area) => patch({ area }))}
                </div>
                <p className="muted">Distance is estimated from the café’s demo location in Los Altos.</p>
                {field('Role summary', job.summary, (summary) => patch({ summary }), true)}
                <div className="field-row">
                  <label className="field">
                    <span className="label">Minimum hourly pay ($)</span>
                    <input
                      className="input"
                      type="number"
                      min="0.01"
                      max="1000"
                      step="0.25"
                      value={Number.isNaN(job.pay.min) ? '' : job.pay.min}
                      onChange={(e) => patch({ pay: { ...job.pay, min: e.target.value === '' ? NaN : Number(e.target.value) } })}
                    />
                  </label>
                  <label className="field">
                    <span className="label">Maximum hourly pay ($, optional)</span>
                    <input
                      className="input"
                      type="number"
                      min="0.01"
                      max="1000"
                      step="0.25"
                      value={job.pay.max ?? ''}
                      onChange={(e) => patch({ pay: { ...job.pay, max: e.target.value ? Number(e.target.value) : undefined } })}
                    />
                  </label>
                </div>
                {field('Duties (one per line)', job.duties.join('\n'), (v) => patch({ duties: v.split('\n') }), true)}
                {field(
                  'Essential qualifications (one per line)',
                  job.qualifications.join('\n'),
                  (v) => patch({ qualifications: v.split('\n') }),
                  true,
                )}
                <div className="field-row">
                  <label className="field">
                    <span className="label">Experience</span>
                    <select className="input" value={job.experience} onChange={(e) => patch({ experience: e.target.value as Job['experience'] })}>
                      <option value="none">Not required</option>
                      <option value="preferred">Preferred</option>
                      <option value="required">Required</option>
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Existing resume</span>
                    <select className="input" value={job.resume} onChange={(e) => patch({ resume: e.target.value as Job['resume'] })}>
                      <option value="optional">Optional</option>
                      <option value="required">Required</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <h2>When do you need help?</h2>
                <p className="muted">Clear hours help students see whether the role fits before applying.</p>
                <label className="field">
                  <span className="label">Schedule type</span>
                  <select
                    className="input"
                    value={job.hoursType}
                    onChange={(e) => {
                      patch({
                        hoursType: e.target.value as Job['hoursType'],
                        variableHours: job.variableHours ?? { min: 8, max: 16, pattern: 'Confirm with employer' },
                      });
                      setRequired(e.target.value !== 'choose');
                    }}
                  >
                    <option value="fixed">Fixed weekly shifts</option>
                    <option value="choose">Choose from shifts</option>
                    <option value="variable">Variable hours</option>
                  </select>
                </label>
                {job.hoursType === 'choose' && (
                  <label className="field">
                    <span className="label">Minimum optional shifts per week (blank if unknown)</span>
                    <input
                      className="input"
                      type="number"
                      min="1"
                      step="1"
                      value={job.minShifts ?? ''}
                      onChange={(e) => patch({ minShifts: e.target.value ? Number(e.target.value) : null })}
                    />
                  </label>
                )}
                {job.hoursType === 'variable' && (
                  <div className="field-row">
                    {(['min', 'max'] as const).map((k) => (
                      <label className="field" key={k}>
                        <span className="label">{k === 'min' ? 'Minimum' : 'Maximum'} weekly hours</span>
                        <input
                          className="input"
                          type="number"
                          min="0"
                          max="168"
                          value={job.variableHours?.[k] ?? 0}
                          onChange={(e) =>
                            patch({
                              variableHours: { min: 0, max: 0, pattern: 'Confirm with employer', ...job.variableHours, [k]: Number(e.target.value) },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}
                <div className="em-week-strip">
                  {DAY_SHORT.map((d, i) => (
                    <div key={d}>
                      <strong>{d}</strong>
                      {job.shifts
                        .filter((s) => s.day === i)
                        .map((s) => (
                          <span key={s.id}>
                            {formatRange(s.start, s.end)}
                            <small>{s.required ? 'Required' : 'Optional'}</small>
                          </span>
                        ))}
                      {!job.shifts.some((s) => s.day === i) && <small>—</small>}
                    </div>
                  ))}
                </div>
                <fieldset className="em-add-shift">
                  <legend>Add a weekly shift</legend>
                  <div className="em-days">
                    {DAY_SHORT.map((d, i) => (
                      <label key={d}>
                        <input
                          type="checkbox"
                          checked={days.includes(i as Day)}
                          onChange={(e) => setDays(e.target.checked ? [...days, i as Day] : days.filter((v) => v !== i))}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                  <div className="field-row">
                    <label className="field">
                      <span className="label">Starts</span>
                      <input className="input" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                    </label>
                    <label className="field">
                      <span className="label">Ends</span>
                      <input className="input" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                    </label>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
                    Required every week
                  </label>
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!days.length || !start || !end || minutes(end) <= minutes(start)) {
                        setShiftError('Choose at least one day and an end time after the start.');
                        return;
                      }
                      patch({
                        shifts: [
                          ...job.shifts,
                          ...days.map((day) => ({ id: crypto.randomUUID(), day, start: minutes(start), end: minutes(end), required })),
                        ],
                      });
                      setShiftError('');
                    }}
                  >
                    <Plus size={17} /> Add to selected days
                  </button>
                  {shiftError && (
                    <p role="alert" className="tone-text-conflict">
                      {shiftError}
                    </p>
                  )}
                </fieldset>
                <div className="em-edit-shifts">
                  {job.shifts.map((s, i) => (
                    <div className="em-edit-shift" key={s.id}>
                      <label>
                        <span className="sr-only">Shift {i + 1} day</span>
                        <select
                          className="input"
                          value={s.day}
                          onChange={(e) =>
                            patch({ shifts: job.shifts.map((v) => (v.id === s.id ? { ...v, day: Number(e.target.value) as Day } : v)) })
                          }
                        >
                          {DAY_LONG.map((d, n) => (
                            <option key={d} value={n}>
                              {d}
                            </option>
                          ))}
                        </select>
                      </label>
                      {(['start', 'end'] as const).map((k) => (
                        <label key={k}>
                          <span className="sr-only">
                            Shift {i + 1} {k}
                          </span>
                          <input
                            className="input"
                            type="time"
                            value={Number.isFinite(s[k]) ? timeValue(s[k]) : ''}
                            onChange={(e) => patch({ shifts: job.shifts.map((v) => (v.id === s.id ? { ...v, [k]: minutes(e.target.value) } : v)) })}
                          />
                        </label>
                      ))}
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={s.required}
                          onChange={(e) => patch({ shifts: job.shifts.map((v) => (v.id === s.id ? { ...v, required: e.target.checked } : v)) })}
                        />
                        Required
                      </label>
                      <button
                        className="icon-btn"
                        aria-label={`Remove shift ${i + 1}`}
                        onClick={() => patch({ shifts: job.shifts.filter((v) => v.id !== s.id) })}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  ))}
                </div>
                {field('Required hours still to confirm (optional)', job.pendingShift ?? '', (pendingShift) => patch({ pendingShift }))}
              </>
            )}
            {step === 2 && (
              <>
                <p className="em-eyebrow">STUDENT-FACING PREVIEW</p>
                <p className="muted">Students will see this posting alongside their own schedule compatibility.</p>
                <JobPreview job={job} />
                {errors.length > 0 && (
                  <div className="callout callout-warn" role="alert">
                    <div>
                      <strong>Before publishing</strong>
                      <ul>
                        {errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <footer className="em-form-footer">
            <button className="btn btn-quiet" onClick={() => save('draft')}>
              Save as draft
            </button>
            <span className="spacer" />
            {step > 0 && (
              <button className="btn btn-secondary" onClick={() => setStep(step - 1)}>
                Back
              </button>
            )}
            {step < 2 ? (
              <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
                {step === 0 ? 'Set hours' : 'Preview opening'}
                <ArrowRight size={17} />
              </button>
            ) : (
              <button className="btn btn-primary" disabled={!!errors.length} onClick={() => save('published')}>
                Publish demo opening
              </button>
            )}
          </footer>
        </section>
        <aside className="em-editor-aside">
          <div className="em-note">
            <CalendarDays size={28} />
            <h3>Make the hours clear.</h3>
            <p>Students need to cover every required shift. Optional shifts count only when they can work them without overlap.</p>
            <p>Unknown hours are shown as needing confirmation.</p>
          </div>
          <p className="privacy-note">This publishes a fictional opening in this browser’s student demo.</p>
        </aside>
      </div>
    </div>
  );
}

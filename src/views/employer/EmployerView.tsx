import { ArrowLeft, ArrowRight, Briefcase, CalendarDays, CircleCheck, Eye, MapPin, Pencil, Plus, Store, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Logo, Dialog } from '../../components/ui';
import { JobPreview } from '../../components/employer/JobPreview';
import { SharedWeek } from '../../components/employer/SharedWeek';
import { coverage, coverageLabel, coverageSentence, EMPLOYER_ID, STAGE_LABELS, type BusinessProfile } from '../../lib/employer';
import { ageNotices } from '../../lib/eligibility';
import { payLabel } from '../../lib/jobs';
import { href, navigate, useMediaQuery } from '../../lib/router';
import { DAY_SHORT, formatRange } from '../../lib/time';
import type { Job } from '../../lib/types';
import { useStore, type Application, type ApplicationStatus } from '../../state/store';
import { JobEditor } from './JobEditor';

export function EmployerView({ section = 'jobs', itemId, action }: { section?: string; itemId?: string; action?: string }) {
  const { state } = useStore();
  const jobs = state.jobs.filter((j) => j.employerId === EMPLOYER_ID);
  const job = jobs.find((j) => j.id === itemId);
  useEffect(() => {
    document.title = 'Employer demo · Workaround';
  }, []);
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href={href('/employer/jobs')} aria-label="Workaround employer home">
            <Logo />
          </a>
          <nav className="nav" aria-label="Employer navigation">
            {[
              ['jobs', 'Jobs', Briefcase],
              ['applicants', 'Applicants', Users],
              ['profile', 'Business profile', Store],
            ].map(([key, label, Icon]) => {
              const I = Icon as typeof Briefcase;
              return (
                <a className="nav-link" key={key as string} href={href(`/employer/${key}`)} aria-current={section === key ? 'page' : undefined}>
                  <I size={18} />
                  <span>{label as string}</span>
                </a>
              );
            })}
          </nav>
          <span className="avatar em-business-avatar" aria-label={state.business.name}>
            {state.business.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
        </div>
      </header>
      {section === 'jobs' && (itemId === 'new' || (job && action === 'edit')) ? (
        <JobEditor key={itemId} existing={job} />
      ) : section === 'jobs' && itemId ? (
        job ? (
          <JobPage job={job} />
        ) : (
          <Missing />
        )
      ) : section === 'jobs' ? (
        <Jobs />
      ) : section === 'applicants' ? (
        <Applicants selectedId={itemId} />
      ) : section === 'profile' ? (
        <Business />
      ) : (
        <Missing />
      )}
    </>
  );
}

function Missing() {
  return (
    <div className="page">
      <div className="card empty">
        <h1>This item isn’t here</h1>
        <p>It may have been removed when the demo was reset.</p>
        <a href={href('/employer/jobs')} className="btn btn-primary">
          Back to jobs
        </a>
      </div>
    </div>
  );
}
function Publication({ job }: { job: Job }) {
  return (
    <span className={`badge badge-${job.publication === 'published' ? 'fit' : job.publication === 'draft' ? 'confirm' : 'partial'}`}>
      {job.publication === 'published' && <CircleCheck size={15} />}
      {job.publication}
    </span>
  );
}
function ShiftList({ job }: { job: Job }) {
  return (
    <ul className="em-shift-list">
      {job.shifts.map((s) => (
        <li key={s.id}>
          <CalendarDays size={16} />
          <strong>
            {DAY_SHORT[s.day]} {formatRange(s.start, s.end)}
          </strong>
          <span>{s.required ? 'Required' : 'Optional'}</span>
        </li>
      ))}
      {!job.shifts.length && <li>Hours need confirmation</li>}
    </ul>
  );
}

function Jobs() {
  const { state } = useStore();
  const [filter, setFilter] = useState('all');
  const all = state.jobs.filter((j) => j.employerId === EMPLOYER_ID);
  const jobs = all.filter((j) => filter === 'all' || j.publication === filter);
  const applicants = state.applications.filter((a) => all.some((j) => j.id === a.jobId));
  return (
    <div className="page em-page">
      <header className="page-head">
        <div>
          <p className="em-eyebrow">{state.business.name} · EMPLOYER DEMO</p>
          <h1>Good people. The right hours.</h1>
          <p className="page-sub">Post the shifts you need. See who can be there.</p>
        </div>
        <a className="btn btn-primary" href={href('/employer/jobs/new')}>
          <Plus size={19} /> New job
        </a>
      </header>
      <div className="em-overview">
        <div>
          <Briefcase size={21} />
          <p>
            <strong>{all.filter((j) => j.publication === 'published').length}</strong> published opening
            {all.filter((j) => j.publication === 'published').length === 1 ? '' : 's'}
          </p>
        </div>
        <div>
          <Users size={21} />
          <p>
            <strong>{applicants.filter((a) => a.status !== 'closed').length}</strong> active demo applications
          </p>
        </div>
        <p className="em-overview-note">Fictional applicants and applications made in this browser.</p>
      </div>
      <div className="em-section-head">
        <h2>Your openings</h2>
        <label className="sort">
          Show
          <select className="input input-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All openings</option>
            {['published', 'draft', 'paused', 'closed'].map((v) => (
              <option key={v} value={v}>
                {v[0].toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="em-job-grid">
        {jobs.map((job) => {
          const apps = applicants.filter((a) => a.jobId === job.id && a.status !== 'closed');
          const fits = apps.filter((a) => coverage(job, a.snapshot).state === 'fits').length;
          return (
            <article className="card em-job-card" key={job.id}>
              <div className="em-section-head">
                <span className="em-job-icon">
                  <Briefcase size={22} />
                </span>
                <Publication job={job} />
              </div>
              <h2>
                <a href={href(`/employer/jobs/${job.id}`)}>{job.role}</a>
              </h2>
              <p className="em-job-meta">
                <MapPin size={15} />
                {job.area}
                <span>·</span>
                {payLabel(job)}
              </p>
              <ShiftList job={job} />
              <div className="em-job-fit">
                <Users size={19} />
                <div>
                  <strong>
                    {apps.length} active applicant{apps.length === 1 ? '' : 's'}
                  </strong>
                  <p>
                    {job.publication === 'draft'
                      ? 'Publish to make this opening visible to students.'
                      : `${fits} ${fits === 1 ? 'applicant meets' : 'applicants meet'} the full shift requirements`}
                  </p>
                </div>
              </div>
              <footer>
                <a className="btn btn-secondary" href={href(`/employer/jobs/${job.id}${job.publication === 'draft' ? '/edit' : ''}`)}>
                  {job.publication === 'draft' ? 'Continue editing' : 'Review opening'}
                  <ArrowRight size={17} />
                </a>
              </footer>
            </article>
          );
        })}
      </div>
      {!jobs.length && (
        <div className="card empty">
          <Briefcase size={32} />
          <h3>No {filter === 'all' ? '' : filter} openings yet</h3>
          <p>Create an opening with the hours your business needs.</p>
          <a className="btn btn-primary" href={href('/employer/jobs/new')}>
            Create a job
          </a>
        </div>
      )}
      <p className="em-bottom-note">A schedule match is a starting point. You review experience, requirements and next steps.</p>
    </div>
  );
}

function JobPage({ job }: { job: Job }) {
  const { saveJob } = useStore();
  const [preview, setPreview] = useState(false);
  return (
    <div className="page em-page">
      <a href={href('/employer/jobs')} className="back-link link-btn">
        <ArrowLeft size={16} />
        All jobs
      </a>
      <header className="em-job-head">
        <div className="em-job-title">
          <div>
            <h1>
              {job.role} <Publication job={job} />
            </h1>
            <p className="page-sub">
              {job.business} · {job.area} · {payLabel(job)}
            </p>
          </div>
          <div className="em-job-actions">
            <a className="btn btn-secondary btn-sm" href={href(`/employer/jobs/${job.id}/edit`)}>
              <Pencil size={15} />
              Edit
            </a>
            <button className="btn btn-secondary btn-sm" onClick={() => setPreview(true)}>
              <Eye size={15} />
              Student preview
            </button>
            {job.publication === 'published' && (
              <button className="btn btn-quiet btn-sm" onClick={() => saveJob({ ...job, publication: 'paused' })}>
                Pause
              </button>
            )}
            {job.publication === 'paused' && (
              <a className="btn btn-primary btn-sm" href={href(`/employer/jobs/${job.id}/edit`)}>
                Review & republish
              </a>
            )}
            {job.publication !== 'closed' && (
              <button className="btn btn-quiet btn-sm" onClick={() => saveJob({ ...job, publication: 'closed' })}>
                Close
              </button>
            )}
          </div>
        </div>
        <div className="em-job-hours">
          <span className="em-job-hours-label">Hours you need</span>
          <ShiftList job={job} />
          <span className="muted">
            {job.hoursType === 'choose'
              ? `Students choose shifts · minimum ${job.minShifts ?? 'not set'}`
              : job.hoursType === 'variable'
                ? 'Variable hours; confirm times before progressing an application.'
                : 'Every required shift must fit.'}
            {job.pendingShift && ` · Time to confirm: ${job.pendingShift}`}
          </span>
        </div>
      </header>
      <Applicants jobId={job.id} embedded />
      {preview && (
        <Dialog open size="lg" onClose={() => setPreview(false)} title="Student-facing preview">
          <JobPreview job={job} />
        </Dialog>
      )}
    </div>
  );
}

function Applicants({ selectedId, jobId, embedded = false }: { selectedId?: string; jobId?: string; embedded?: boolean }) {
  const { state } = useStore();
  const [sort, setSort] = useState('fit');
  const [filterJob, setFilterJob] = useState('all');
  const [stage, setStage] = useState('active');
  const [localId, setLocalId] = useState<string>();
  const wide = useMediaQuery('(min-width: 900px)');
  const jobs = state.jobs.filter((j) => j.employerId === EMPLOYER_ID);
  const all = state.applications.filter((a) => jobs.some((j) => j.id === a.jobId));
  const list = all
    .filter(
      (a) =>
        (!jobId || a.jobId === jobId) &&
        (filterJob === 'all' || a.jobId === filterJob) &&
        (stage === 'all' ? true : stage === 'active' ? a.status !== 'closed' : a.status === stage),
    )
    .sort((a, b) => {
      const rank = { fits: 0, confirm: 1, outside: 2 };
      return (
        (sort === 'fit'
          ? rank[coverage(jobs.find((j) => j.id === a.jobId)!, a.snapshot).state] - rank[coverage(jobs.find((j) => j.id === b.jobId)!, b.snapshot).state]
          : 0) || b.submittedAt.localeCompare(a.submittedAt)
      );
    });
  const id = embedded ? localId : selectedId;
  const selected = id ? list.find((a) => a.id === id) : wide ? list[0] : undefined;
  const select = (id?: string) => (embedded ? setLocalId(id) : navigate(id ? `/employer/applicants/${id}` : '/employer/applicants'));
  const detailRef = useRef<HTMLDivElement>(null);
  const chosen = useRef(false);
  // After picking someone further down the list, bring their comparison into view.
  useEffect(() => {
    if (!chosen.current || !selected) return;
    chosen.current = false;
    const top = detailRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.6) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      detailRef.current?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <section className={embedded ? 'em-applicants' : 'page em-page'} aria-label="Applicants">
      <div className={embedded ? 'em-applicants-bar' : undefined}>
        {embedded ? (
          <h2 className="em-applicants-title">
            Applicants{' '}
            <span className="muted">
              · {list.length} {stage === 'active' ? 'active' : 'shown'}
            </span>
          </h2>
        ) : (
          <header className="page-head">
            <div>
              <p className="em-eyebrow">SHARED AVAILABILITY, CLEAR NEXT STEPS</p>
              <h1>Applicants</h1>
              <p className="page-sub">Review the hours they shared, then decide what comes next.</p>
            </div>
          </header>
        )}
        <div className="em-app-filters">
          {!jobId && (
            <label className="sort">
              Opening
              <select
                className="input"
                value={filterJob}
                onChange={(e) => {
                  setFilterJob(e.target.value);
                  select();
                }}
              >
                <option value="all">All openings</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.role}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="sort">
            Stage
            <select
              className="input"
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                select();
              }}
            >
              <option value="active">Active applications</option>
              <option value="all">All stages</option>
              {Object.entries(STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="sort">
            Sort
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="fit">Schedule compatibility</option>
              <option value="newest">Newest application</option>
            </select>
          </label>
        </div>
      </div>
      <div className="em-review-layout">
        {(wide || !id) && (
          <div className="em-app-list">
            {list.map((a) => {
              const j = jobs.find((j) => j.id === a.jobId)!;
              const c = coverage(j, a.snapshot);
              return (
                <button
                  className={`card em-app-card ${selected?.id === a.id ? 'is-selected' : ''}`}
                  key={a.id}
                  onClick={() => {
                    chosen.current = true;
                    select(a.id);
                  }}
                  aria-pressed={selected?.id === a.id}
                >
                  <div className="em-app-name">
                    <span className="avatar">
                      {a.snapshot.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div>
                      <h3>{a.snapshot.name}</h3>
                      <p>{a.snapshot.school || 'School not shared'}</p>
                    </div>
                  </div>
                  <p>{embedded ? STAGE_LABELS[a.status] : `${j.role} · ${STAGE_LABELS[a.status]}`}</p>
                  <span className={`badge badge-${c.state === 'fits' ? 'fit' : c.state === 'confirm' ? 'confirm' : 'conflict'}`}>{coverageLabel(j, c)}</span>
                  {c.state !== 'fits' && <p>{coverageSentence(j, c)}</p>}
                  <p className="em-app-experience">{a.snapshot.experience || 'Experience not shared'}</p>
                  <p className="em-app-windows">
                    Shared: {a.snapshot.windows.map((w) => `${DAY_SHORT[w.day]} ${formatRange(w.start, w.end)}`).join(' · ') || 'Needs confirmation'}
                  </p>
                  <small>
                    {a.source === 'fixture' ? 'Fictional fixture' : 'Applied in this browser'} · {new Date(a.submittedAt).toLocaleDateString()}
                  </small>
                  <span className="em-review-link">
                    Review application <ArrowRight size={15} />
                  </span>
                </button>
              );
            })}
            {!list.length && (
              <div className="card empty">
                <Users size={30} />
                <h3>No applicants here yet</h3>
                <p>Try another filter, or apply to this opening in the Student demo.</p>
              </div>
            )}
          </div>
        )}
        {selected ? (
          <div className="card em-review-detail" ref={detailRef}>
            {!wide && (
              <button className="link-btn back-link" onClick={() => select()}>
                <ArrowLeft size={16} />
                All applicants
              </button>
            )}
            <Review key={selected.id} application={selected} job={jobs.find((j) => j.id === selected.jobId)!} />
          </div>
        ) : (
          (wide || id) && (
            <div className="card empty">
              <h3>{id ? 'Application not in this view' : 'Select an applicant'}</h3>
              <p>{id ? 'It may be hidden by filters or removed after a reset.' : 'Their shared availability and application will appear here.'}</p>
              {id && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setStage('all');
                    setFilterJob('all');
                    select();
                  }}
                >
                  Back to applicants
                </button>
              )}
            </div>
          )
        )}
      </div>
    </section>
  );
}

function Review({ application: a, job }: { application: Application; job: Job }) {
  const { updateStatus } = useStore();
  const [status, setStatus] = useState<ApplicationStatus>(a.status);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <div className="em-review-head">
        <div>
          <h2>{a.snapshot.name}</h2>
          <p className="muted">
            {a.snapshot.school || 'School not shared'} · Applied{' '}
            {new Date(a.submittedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {a.source === 'fixture' ? 'Fictional applicant' : 'Applied in this browser'}
          </p>
        </div>
        <span className="badge badge-partial">{STAGE_LABELS[a.status]}</span>
      </div>
      <SharedWeek job={job} snapshot={a.snapshot} />
      <div className="em-review-section">
        <h3>Submitted experience</h3>
        <p>{a.snapshot.experience || 'No experience shared.'}</p>
        <h3>Resume reference</h3>
        <p>{a.snapshot.resumeName ?? 'No resume shared'}</p>
        {a.snapshot.resumeName && <p className="muted">Demo filename only; no downloadable file is attached.</p>}
        {a.note && (
          <>
            <h3>Submitted note</h3>
            <p>{a.note}</p>
          </>
        )}
        <h3>Work feedback</h3>
        <p className="muted">No verified work history yet. A first role is a fresh start.</p>
        <h3>Requirements to confirm</h3>
        {ageNotices(a.snapshot, job).map((n, i) => (
          <p className="muted" key={i}>
            {n.text
              .replace('Add your age in Profile to check this requirement.', 'Confirm this requirement with the applicant.')
              .replace('You haven’t shared your age.', 'Age was not shared.')}
          </p>
        ))}
      </div>
      <div className="em-stage-action">
        <h3>Choose the next step</h3>
        <p>This changes the demo status in this browser. No message or invitation is sent. An offer is not an accepted hire.</p>
        <div className="em-inline-form">
          <label className="field">
            <span className="label">Application stage</span>
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ApplicationStatus);
                setSaved(false);
              }}
            >
              {Object.entries(STAGE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-primary"
            disabled={status === a.status}
            onClick={() => {
              updateStatus(a.id, status);
              setSaved(true);
            }}
          >
            Update demo status
          </button>
        </div>
        {saved && (
          <p role="status" className="tone-text-fit">
            Status updated. Browser applications show this in the Student demo.
          </p>
        )}
      </div>
    </>
  );
}

function Business() {
  const { state, updateBusiness } = useStore();
  const [business, setBusiness] = useState<BusinessProfile>(state.business);
  const [saved, setSaved] = useState(false);
  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <p className="em-eyebrow">A LITTLE ABOUT YOU</p>
          <h1>Business profile</h1>
          <p className="page-sub">Introduce your fictional business to future applicants.</p>
        </div>
      </header>
      <form
        className="card em-business-form"
        onSubmit={(e) => {
          e.preventDefault();
          updateBusiness(business);
          setSaved(true);
        }}
      >
        <div className="em-app-name">
          <span className="avatar em-business-avatar">
            {business.name
              .split(' ')
              .map((n) => n[0])
              .slice(0, 2)
              .join('')}
          </span>
          <div>
            <h2>{business.name}</h2>
            <p className="muted">Fictional demo business</p>
          </div>
        </div>
        {(['name', 'category', 'area', 'description'] as const).map((k) => (
          <label className="field" key={k}>
            <span className="label">
              {
                {
                  name: 'Business name',
                  category: 'Business category',
                  area: 'Approximate location',
                  description: 'Business description',
                }[k]
              }
            </span>
            {k === 'description' ? (
              <textarea
                className="input"
                rows={4}
                required
                value={business[k]}
                onChange={(e) => {
                  setBusiness({ ...business, [k]: e.target.value });
                  setSaved(false);
                }}
              />
            ) : (
              <input
                className="input"
                required
                value={business[k]}
                onChange={(e) => {
                  setBusiness({ ...business, [k]: e.target.value });
                  setSaved(false);
                }}
              />
            )}
          </label>
        ))}
        <p className="muted">Used for new postings. Existing openings keep their published details.</p>
        <button className="btn btn-primary" disabled={!business.name.trim() || !business.area.trim()}>
          Save business profile
        </button>
        {saved && (
          <p role="status" className="tone-text-fit">
            Business profile saved.
          </p>
        )}
      </form>
    </div>
  );
}

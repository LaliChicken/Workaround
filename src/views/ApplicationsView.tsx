import { ArrowRight, CircleAlert, FileText, FlaskConical, Inbox } from 'lucide-react';
import { useEffect } from 'react';
import { StatusBadge } from '../components/ui';
import { jobById } from '../data/jobs';
import { href } from '../lib/router';
import { type Application, type ApplicationStatus, useStore } from '../state/store';

const STEPS: { status: ApplicationStatus; label: string }[] = [
  { status: 'submitted', label: 'Submitted' },
  { status: 'reviewing', label: 'Employer reviewing' },
  { status: 'interview', label: 'Interview' },
  { status: 'offer', label: 'Offer' },
];

const NEXT_STEP: Record<ApplicationStatus, string> = {
  submitted: 'Next, the employer reviews applications. In this demo nothing was sent, so the status won’t change on its own.',
  reviewing: 'The employer is reviewing your application.',
  interview: 'Prepare for your interview and confirm your availability.',
  offer: 'Review the offer and confirm the shifts before accepting.',
  closed: 'This application is closed.',
};

export function ApplicationsView() {
  const { state } = useStore();
  useEffect(() => {
    document.title = 'Applications · Workaround';
  }, []);

  return (
    <div className="page page-narrow">
      <header className="page-head">
        <div>
          <h1>Applications</h1>
          <p className="page-sub">Track where each application stands and whether it still fits your week.</p>
        </div>
      </header>

      <p className="callout callout-demo">
        <FlaskConical size={18} aria-hidden="true" />
        <span>
          <strong>Simulated applications.</strong> No employer has received or responded to anything here.
        </span>
      </p>

      {state.applications.length === 0 ? (
        <div className="empty card">
          <Inbox size={32} aria-hidden="true" />
          <p className="empty-title">No applications yet</p>
          <p>When you apply to an opening, you’ll track it here.</p>
          <a className="btn btn-primary" href={href('/jobs')}>
            Find jobs that fit your week <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      ) : (
        <ul className="app-list">
          {state.applications.map((a) => (
            <ApplicationCard key={a.id} application={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationCard({ application: a }: { application: Application }) {
  const { matches, withdraw } = useStore();
  const job = jobById(a.jobId);
  if (!job) return null;
  const now = matches[job.id];
  const changed = a.status !== 'closed' && now.state !== a.stateAtSubmit;
  const closed = a.status === 'closed';
  const currentIndex = STEPS.findIndex((s) => s.status === a.status);
  const submitted = new Date(a.submittedAt);

  return (
    <li className={`card app-card${closed ? ' is-closed' : ''}`}>
      <header className="app-head">
        <div>
          <h2 className="app-role">
            <a href={href(`/jobs/${job.id}`)}>{job.role}</a>
          </h2>
          <p className="app-biz">
            {job.business} · {job.area}
          </p>
        </div>
        <span className={`status-pill${closed ? ' is-closed' : ''}`}>{closed ? 'Closed' : 'Submitted (demo)'}</span>
      </header>

      {!closed && (
        <ol className="progress" aria-label="Application progress">
          {STEPS.map((s, i) => (
            <li key={s.status} className={i < currentIndex ? 'is-done' : i === currentIndex ? 'is-current' : ''} aria-current={i === currentIndex ? 'step' : undefined}>
              <span className="progress-dot" aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ol>
      )}

      <dl className="app-facts">
        <div>
          <dt>Submitted</dt>
          <dd>
            {submitted.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
            {submitted.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </dd>
        </div>
        <div>
          <dt>Next step</dt>
          <dd>{closed ? a.closedReason ?? NEXT_STEP.closed : NEXT_STEP[a.status]}</dd>
        </div>
        <div>
          <dt>Shared</dt>
          <dd>
            Profile, availability ({a.sharedWindows.length} window{a.sharedWindows.length === 1 ? '' : 's'})
            {a.resumeAttached && (
              <>
                , <FileText size={14} aria-hidden="true" /> resume
              </>
            )}
            {a.note && ', a note'}
          </dd>
        </div>
        <div>
          <dt>Fit with your week now</dt>
          <dd>
            <StatusBadge state={now.state} size="sm" />
          </dd>
        </div>
      </dl>

      {changed && (
        <p className="callout callout-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            Your schedule changed after you applied. {now.summary} Let the employer know if your availability has changed.
          </span>
        </p>
      )}

      {!closed && (
        <footer className="app-foot">
          <a className="btn btn-quiet btn-sm" href={href(`/jobs/${job.id}`)}>
            View job
          </a>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => withdraw(a.id)}>
            Withdraw
          </button>
        </footer>
      )}
    </li>
  );
}

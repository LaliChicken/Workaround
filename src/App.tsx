import { Briefcase, CalendarDays, FlaskConical, RotateCcw, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toasts } from './components/Toasts';
import { Dialog, Logo } from './components/ui';
import { href, navigate, useRoute } from './lib/router';
import { useStore } from './state/store';
import { ApplicationsView } from './views/ApplicationsView';
import { JobsView } from './views/JobsView';
import { ProfileView } from './views/ProfileView';
import { ScheduleView } from './views/ScheduleView';
import { SetupView } from './views/SetupView';

const SECTIONS = ['jobs', 'schedule', 'applications', 'profile', 'setup'];

export function App() {
  const [section, id] = useRoute();
  const { state } = useStore();

  useEffect(() => {
    if (!state.setupComplete && section !== 'setup') navigate('/setup', { replace: true });
    else if (state.setupComplete && !SECTIONS.includes(section ?? '')) navigate('/jobs', { replace: true });
  }, [section, state.setupComplete]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [section]);

  let view = null;
  if (section === 'setup') view = <SetupView />;
  else if (!state.setupComplete) view = null;
  else if (section === 'jobs') view = <JobsView jobId={id} />;
  else if (section === 'schedule') view = <ScheduleView />;
  else if (section === 'applications') view = <ApplicationsView />;
  else if (section === 'profile') view = <ProfileView />;

  return (
    <div className="app">
      <button
        type="button"
        className="skip-link"
        onClick={() => {
          document.getElementById('main')?.focus();
        }}
      >
        Skip to content
      </button>
      <DemoBanner />
      {section !== 'setup' && state.setupComplete && <TopBar section={section} />}
      <main id="main" tabIndex={-1}>
        {view}
      </main>
      <Toasts />
    </div>
  );
}

function TopBar({ section }: { section?: string }) {
  const { state } = useStore();
  const p = state.profile;
  const active = state.applications.filter((a) => a.status !== 'closed').length;
  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || '?';
  const link = (key: string, label: string, Icon: typeof Briefcase, extra?: number, short?: string) => (
    <a href={href(`/${key}`)} className="nav-link" aria-current={section === key ? 'page' : undefined}>
      <Icon size={18} aria-hidden="true" />
      {short ? (
        <span>
          <span className="label-long">{label}</span>
          <span className="label-short" aria-hidden="true">
            {short}
          </span>
        </span>
      ) : (
        <span>{label}</span>
      )}
      {extra ? <span className="count">{extra}</span> : null}
    </a>
  );
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a href={href('/jobs')} className="brand" aria-label="Workaround home">
          <Logo />
        </a>
        <nav className="nav" aria-label="Main">
          {link('jobs', 'Jobs', Briefcase)}
          {link('schedule', 'My Schedule', CalendarDays, undefined, 'Schedule')}
          {link('applications', 'Applications', Send, active)}
        </nav>
        <a href={href('/profile')} className="avatar" aria-label={`Profile: ${p.firstName} ${p.lastName}`} aria-current={section === 'profile' ? 'page' : undefined}>
          {initials}
        </a>
      </div>
    </header>
  );
}

function DemoBanner() {
  const { reset } = useStore();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="demo-banner" role="note">
      <FlaskConical size={16} aria-hidden="true" />
      <p>
        <strong>Demo prototype.</strong> <span className="label-long">Fictional openings, illustrative pay and simulated applications.</span>
        <span className="label-short">Fictional data, simulated applications.</span>
      </p>
      <button type="button" className="demo-reset" onClick={() => setConfirming(true)}>
        <RotateCcw size={14} aria-hidden="true" /> Reset demo
      </button>
      {confirming && (
        <Dialog
          open
          size="sm"
          onClose={() => setConfirming(false)}
          title="Reset the demo?"
          description="This clears applications, saved jobs and schedule edits, then starts again from setup."
          footer={
            <>
              <span className="spacer" />
              <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirming(false);
                  reset();
                  navigate('/setup');
                }}
              >
                Reset demo
              </button>
            </>
          }
        >
          <p className="muted">Useful between recording takes.</p>
        </Dialog>
      )}
    </div>
  );
}

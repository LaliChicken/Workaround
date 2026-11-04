import { CalendarClock, CircleAlert, CircleCheck, FileText, FlaskConical, Lock, Send } from 'lucide-react';
import { useId, useState } from 'react';
import { href, navigate } from '../lib/router';
import { studentSummary } from '../lib/eligibility';
import { isConflict } from '../lib/matching';
import type { Job } from '../lib/types';
import { sharedAvailability, useStore } from '../state/store';
import { Dialog, StatusBadge } from './ui';
import { datedClashes } from '../lib/upcoming';
import { formatDate } from '../lib/time';

/** Simulated application: shows exactly what would be shared, sends nothing. */
export function ApplyDialog({ job, onClose }: { job: Job; onClose: () => void }) {
  const { state, matches, apply } = useStore();
  const { profile, schedule } = state;
  const match = matches[job.id];
  const [step, setStep] = useState<'review' | 'done'>('review');
  const [attach, setAttach] = useState(!!profile.resumeName);
  const [note, setNote] = useState('');
  const uid = useId();
  const windows = sharedAvailability(schedule);
  const clashDates = [...new Set(datedClashes(job, schedule).flatMap((c) => c.dates))].sort();
  const resumeRequired = job.resume === 'required';
  const blocked = resumeRequired && (!profile.resumeName || !attach);

  if (step === 'done') {
    return (
      <Dialog
        open
        size="sm"
        onClose={onClose}
        title="Demo application recorded"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Back to job
            </button>
            <span className="spacer" />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                navigate('/applications');
              }}
            >
              View in Applications
            </button>
          </>
        }
      >
        <div className="done">
          <CircleCheck className="done-icon" size={48} aria-hidden="true" />
          <p className="done-lead">
            {job.role} at {job.business}
          </p>
          <p>
            <strong>Nothing was sent.</strong> This is a simulated submission. In a live version, {job.business} would receive your profile and the
            availability you reviewed.
          </p>
          <p className="muted">Track it in Applications. Switch to Employer demo to review it and update its status in this browser.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Apply to ${job.business}`}
      description={`${job.role} · Review what you’ll share before you submit.`}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={blocked}
            onClick={() => {
              apply(job.id, { resumeAttached: attach && !!profile.resumeName, note: note.trim() });
              setStep('done');
            }}
          >
            <Send size={18} aria-hidden="true" /> Submit demo application
          </button>
        </>
      }
    >
      <p className="callout callout-demo">
        <FlaskConical size={18} aria-hidden="true" />
        <span>
          <strong>Demo application.</strong> Nothing is sent to {job.business} or any real employer.
        </span>
      </p>

      {match.state !== 'fits' && (
        <div className={`callout ${isConflict(match.state) ? 'callout-conflict' : 'callout-warn'}`}>
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <StatusBadge state={match.state} size="sm" />
            <p>{match.summary}</p>
            <p className="muted">You can still apply. Consider explaining your availability in the note.</p>
          </div>
        </div>
      )}

      {clashDates.length > 0 && (
        <div className="callout callout-warn">
          <CalendarClock size={18} aria-hidden="true" />
          <div>
            <p>
              <strong>
                {clashDates.length} upcoming shift date{clashDates.length === 1 ? '' : 's'} clash
                {clashDates.length === 1 ? 'es' : ''} with your dates:
              </strong>{' '}
              {clashDates
                .slice(0, 4)
                .map((d) => formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' }))
                .join(', ')}
              {clashDates.length > 4 ? ` and ${clashDates.length - 4} more` : ''}.
            </p>
            <p className="muted">These dates aren’t shared. Mention them in your note if you’d like the employer to know.</p>
          </div>
        </div>
      )}

      <h3 className="share-title">What {job.business} will see</h3>
      <dl className="share-list">
        <div>
          <dt>Name</dt>
          <dd>
            {profile.firstName} {profile.lastName}
          </dd>
        </div>
        <div>
          <dt>School</dt>
          <dd>
            {studentSummary(profile)}
          </dd>
        </div>
        <div>
          <dt>When you can work</dt>
          <dd>
            {windows.length ? (
              <ul className="chips">
                {windows.map((w) => (
                  <li key={w} className="chip">
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              'No availability marked yet'
            )}
            <small>After your {schedule.bufferMinutes}-minute commute buffer</small>
          </dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd>{profile.experience || 'None added'}</dd>
        </div>
        <div>
          <dt>Resume</dt>
          <dd>
            {profile.resumeName ? (
              <label className="check">
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                <FileText size={16} aria-hidden="true" /> Attach {profile.resumeName}
                {resumeRequired && <span className="req-tag">Required by this employer</span>}
              </label>
            ) : resumeRequired ? (
              <span className="tone-text-conflict">
                This employer asks for a resume. <a href={href('/profile')}>Add one in your profile</a> first.
              </span>
            ) : (
              'No resume attached (optional for this job)'
            )}
          </dd>
        </div>
      </dl>
      <div className="field">
        <label className="label" htmlFor={`${uid}-note`}>
          Note to the employer (optional)
        </label>
        <textarea id={`${uid}-note`} className="input" rows={3} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="privacy-note">
        <Lock size={14} aria-hidden="true" /> Not shared: your class names and times, study time, activities or other commitments.
      </p>
    </Dialog>
  );
}

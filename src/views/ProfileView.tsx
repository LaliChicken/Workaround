import { BadgeCheck, FileText, MessageSquare, RotateCcw, Trash } from 'lucide-react';
import { useEffect, useId } from 'react';
import { CATEGORY_LABEL } from '../data/jobs';
import { href } from '../lib/router';
import type { Category } from '../lib/types';
import { DEMO_PROFILE, type Profile, useStore } from '../state/store';

export const SCHOOLS = ['Foothill College', 'De Anza College', 'Another community college', 'A high school'];

export function ProfileView() {
  const { state, updateProfile } = useStore();
  const p = state.profile;
  const uid = useId();
  useEffect(() => {
    document.title = 'Profile · Workaround';
  }, []);
  const initials = `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase() || '?';

  return (
    <div className="page page-narrow">
      <header className="profile-head">
        <span className="avatar avatar-lg" aria-hidden="true">
          {initials}
        </span>
        <div>
          <h1>
            {p.firstName} {p.lastName}
          </h1>
          <p className="page-sub">
            {p.school} · {p.stage === 'college' ? 'College undergraduate' : 'High school student'}
          </p>
        </div>
      </header>
      <p className="muted profile-note">Changes save automatically. Employers only see this when you choose to apply.</p>

      <div className="profile-grid">
        <section className="card form-card">
          <h2 className="card-title">About you</h2>
          <div className="form">
            <div className="field-row">
              <div className="field">
                <label className="label" htmlFor={`${uid}-first`}>
                  First name
                </label>
                <input id={`${uid}-first`} className="input" value={p.firstName} onChange={(e) => updateProfile({ firstName: e.target.value })} />
              </div>
              <div className="field">
                <label className="label" htmlFor={`${uid}-last`}>
                  Last name
                </label>
                <input id={`${uid}-last`} className="input" value={p.lastName} onChange={(e) => updateProfile({ lastName: e.target.value })} />
              </div>
            </div>
            <StudentFields profile={p} onChange={updateProfile} />
          </div>
        </section>

        <section className="card form-card">
          <h2 className="card-title">Job search</h2>
          <div className="form">
            <SearchFields profile={p} onChange={updateProfile} />
          </div>
        </section>

        <section className="card form-card">
          <h2 className="card-title">Experience</h2>
          <div className="form">
            <div className="field">
              <label className="label" htmlFor={`${uid}-exp`}>
                Relevant experience <span className="optional">optional</span>
              </label>
              <textarea id={`${uid}-exp`} className="input" rows={3} value={p.experience} onChange={(e) => updateProfile({ experience: e.target.value })} />
              <p className="hint">Volunteering, clubs, family responsibilities and class projects all count.</p>
            </div>
            <div className="field">
              <span className="label">Existing resume</span>
              {p.resumeName ? (
                <div className="file-chip">
                  <FileText size={18} aria-hidden="true" />
                  <span>
                    {p.resumeName}
                    <small>Sample file</small>
                  </span>
                  <button type="button" className="icon-btn icon-btn-sm" aria-label="Remove resume" onClick={() => updateProfile({ resumeName: null })}>
                    <Trash size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateProfile({ resumeName: DEMO_PROFILE.resumeName })}>
                  <FileText size={16} aria-hidden="true" /> Attach sample resume
                </button>
              )}
              <p className="hint">Uploading your own file isn’t connected in this prototype.</p>
            </div>
          </div>
        </section>

        <section className="card form-card">
          <h2 className="card-title">
            <BadgeCheck size={20} aria-hidden="true" /> Verified work feedback
          </h2>
          <div className="feedback-empty">
            <p className="empty-title">No verified work history yet</p>
            <p>New students start with a clean slate. Having no feedback is never treated as a low rating.</p>
          </div>
          <ul className="feedback-rules">
            <li>Only employers who confirm you worked for them can leave feedback.</li>
            <li>Feedback covers reliability, communication and completing agreed responsibilities.</li>
            <li>
              <MessageSquare size={14} aria-hidden="true" /> You can respond to or dispute any feedback.
            </li>
            <li>Shifts you said you couldn’t work never count against you.</li>
          </ul>
        </section>
      </div>

      <footer className="profile-foot">
        <a className="btn btn-quiet btn-sm" href={href('/setup')}>
          <RotateCcw size={16} aria-hidden="true" /> Replay setup
        </a>
      </footer>
    </div>
  );
}

export function StudentFields({ profile: p, onChange }: { profile: Profile; onChange: (patch: Partial<Profile>) => void }) {
  const uid = useId();
  return (
    <>
      <div className="field">
        <label className="label" htmlFor={`${uid}-school`}>
          School
        </label>
        <select
          id={`${uid}-school`}
          className="input"
          value={p.school}
          onChange={(e) => onChange({ school: e.target.value, ...(e.target.value === 'A high school' ? { stage: 'high-school' } : {}) })}
        >
          {SCHOOLS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <fieldset className="field">
        <legend className="label">I’m a</legend>
        <div className="radio-row">
          <label className="radio">
            <input type="radio" name={`${uid}-stage`} checked={p.stage === 'college'} onChange={() => onChange({ stage: 'college', ageBand: '18+' })} />
            College undergraduate
          </label>
          <label className="radio">
            <input type="radio" name={`${uid}-stage`} checked={p.stage === 'high-school'} onChange={() => onChange({ stage: 'high-school' })} />
            High school student
          </label>
        </div>
      </fieldset>
      {p.stage === 'high-school' && (
        <fieldset className="field">
          <legend className="label">Age</legend>
          <div className="radio-row">
            <label className="radio">
              <input type="radio" name={`${uid}-age`} checked={p.ageBand === '16-17'} onChange={() => onChange({ ageBand: '16-17' })} />
              16–17
            </label>
            <label className="radio">
              <input type="radio" name={`${uid}-age`} checked={p.ageBand === '18+'} onChange={() => onChange({ ageBand: '18+' })} />
              18 or older
            </label>
          </div>
          <p className="hint">We ask because work permits and permitted hours depend on age. Employers confirm eligibility.</p>
        </fieldset>
      )}
    </>
  );
}

export function SearchFields({ profile: p, onChange }: { profile: Profile; onChange: (patch: Partial<Profile>) => void }) {
  const uid = useId();
  const toggleInterest = (c: Category) =>
    onChange({ interests: p.interests.includes(c) ? p.interests.filter((x) => x !== c) : [...p.interests, c] });
  return (
    <>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor={`${uid}-area`}>
            Where you want to work
          </label>
          <input id={`${uid}-area`} className="input" value={p.area} onChange={(e) => onChange({ area: e.target.value })} />
        </div>
        <div className="field field-narrow">
          <label className="label" htmlFor={`${uid}-radius`}>
            Within
          </label>
          <select id={`${uid}-radius`} className="input" value={p.radiusMi} onChange={(e) => onChange({ radiusMi: Number(e.target.value) })}>
            {[2, 5, 10, 15].map((r) => (
              <option key={r} value={r}>
                {r} miles
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="hint hint-tight">An approximate area is enough. We don’t need your home address to show jobs.</p>
      <fieldset className="field">
        <legend className="label">Hours a week you’d like</legend>
        <div className="hours-range">
          <label className="sr-only" htmlFor={`${uid}-hmin`}>
            Minimum hours
          </label>
          <input
            id={`${uid}-hmin`}
            className="input input-num"
            type="number"
            min={1}
            max={40}
            value={p.hoursMin}
            onChange={(e) => onChange({ hoursMin: Math.max(1, Math.min(Number(e.target.value) || 1, p.hoursMax)) })}
          />
          <span>to</span>
          <label className="sr-only" htmlFor={`${uid}-hmax`}>
            Maximum hours
          </label>
          <input
            id={`${uid}-hmax`}
            className="input input-num"
            type="number"
            min={1}
            max={40}
            value={p.hoursMax}
            onChange={(e) => onChange({ hoursMax: Math.max(p.hoursMin, Math.min(Number(e.target.value) || p.hoursMin, 40)) })}
          />
          <span>hours</span>
        </div>
      </fieldset>
      <fieldset className="field">
        <legend className="label">
          Interests <span className="optional">optional</span>
        </legend>
        <div className="chip-row">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
            <button key={c} type="button" className="chip-btn" aria-pressed={p.interests.includes(c)} onClick={() => toggleInterest(c)}>
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </fieldset>
    </>
  );
}

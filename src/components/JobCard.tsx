import { Bookmark, BookmarkCheck, Clock, MapPin } from 'lucide-react';
import { jobHours, payLabel, shiftSummary } from '../lib/jobs';
import { href } from '../lib/router';
import type { Job, Match } from '../lib/types';
import { useStore } from '../state/store';
import { STATE_META, StatusBadge } from './ui';

export function SaveButton({ job, withLabel = false }: { job: Job; withLabel?: boolean }) {
  const { state, toggleSave } = useStore();
  const saved = state.saved.includes(job.id);
  const Icon = saved ? BookmarkCheck : Bookmark;
  return (
    <button
      type="button"
      className={`${withLabel ? 'btn btn-secondary' : 'icon-btn'} save-btn${saved ? ' is-saved' : ''}`}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : `${saved ? 'Saved' : 'Save'} ${job.role} at ${job.business}`}
      onClick={() => toggleSave(job.id)}
    >
      <Icon size={withLabel ? 18 : 20} aria-hidden="true" />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  );
}

export function JobCard({ job, match, selected, changed }: { job: Job; match: Match; selected: boolean; changed: boolean }) {
  const tone = STATE_META[match.state].tone;
  return (
    <article className={`job-card${selected ? ' is-selected' : ''}${changed ? ' is-changed' : ''}`}>
      <div className="job-card-top">
        <StatusBadge state={match.state} size="sm" />
        <SaveButton job={job} />
      </div>
      <h3 className="job-card-role">
        <a className="stretched" href={href(`/jobs/${job.id}`)} aria-current={selected ? 'true' : undefined}>
          {job.role}
        </a>
      </h3>
      <p className="job-card-biz">
        {job.business}
        <span className="dot" aria-hidden="true">
          ·
        </span>
        <MapPin size={14} aria-hidden="true" /> {job.area}, {job.distanceMi} mi
      </p>
      <p className="job-card-meta">
        <strong>{payLabel(job)}</strong>
        <span>{jobHours(job).label}</span>
      </p>
      <p className="job-card-shifts">
        <Clock size={15} aria-hidden="true" /> {shiftSummary(job)}
      </p>
      <p className={`job-card-why tone-text-${tone}`}>{match.summary}</p>
    </article>
  );
}

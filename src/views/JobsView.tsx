import { CalendarDays, Eye, EyeOff, MapPin, Pencil, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JobCard } from '../components/JobCard';
import { JobDetail } from '../components/JobDetail';
import { RADIUS_OPTIONS, SEARCH_AREAS, areaById } from '../data/areas';
import { CATEGORY_LABEL } from '../data/jobs';
import { publishedJobs } from '../lib/employer';
import { jobDistances } from '../lib/geo';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  hiddenReason,
  partitionJobs,
  sortJobs,
  type FilterContext,
  type HiddenReason,
  type JobFilters,
} from '../lib/jobs';
import { weeklyWindows, workableMinutes } from '../lib/matching';
import { href, navigate, useMediaQuery } from '../lib/router';
import { formatDayList, formatHours } from '../lib/time';
import type { Category, Job } from '../lib/types';
import { useStore } from '../state/store';

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function JobsView({ jobId }: { jobId?: string }) {
  const { state, matches, setFilters, updateProfile, recent } = useStore();
  const { filters, profile } = state;
  const jobs = useMemo(() => publishedJobs(state.jobs), [state.jobs]);
  const wide = useMediaQuery('(min-width: 1000px)');
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const area = areaById(profile.areaId);
  const distances = useMemo(() => jobDistances(jobs, area.id), [area.id, jobs]);
  const ctx: FilterContext = { matches, hoursMin: profile.hoursMin, hoursMax: profile.hoursMax, distances, radiusMi: profile.radiusMi };
  const { visible, hiddenConflicts, outOfRange, conflicts } = partitionJobs(jobs, filters, ctx);
  const savedJobs = sortJobs(
    jobs.filter((j) => state.saved.includes(j.id)),
    filters,
    ctx,
  );
  const list = tab === 'saved' ? savedJobs : visible;
  const selected = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  const firstId = list[0]?.id;
  const inList = !!selected && list.some((j) => j.id === selected.id);
  const nextRadius = RADIUS_OPTIONS.find((r) => r > profile.radiusMi);

  const listRef = useRef<HTMLUListElement>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.title = selected ? `${selected.role} · Workaround` : 'Jobs · Workaround';
  }, [selected]);

  // Keep the selected card visible (e.g. after following a link from a notification)
  // and start each newly selected job's details at the top.
  useEffect(() => {
    if (!wide || !jobId) return;
    detailRef.current?.scrollTo({ top: 0 });
    const card = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.closest('li');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const topLimit = (document.querySelector('.topbar')?.getBoundingClientRect().bottom ?? 0) + 8;
    if (rect.top < topLimit || rect.bottom > window.innerHeight) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [wide, jobId]);

  // On wide screens the detail pane should never be empty when there is something to show.
  useEffect(() => {
    if (wide && !jobId && firstId) navigate(`/jobs/${firstId}`, { replace: true });
  }, [wide, jobId, firstId]);

  // When the student changes filters, the tab, the area or the radius, the
  // details must follow the list: if the open job drops out, open the first
  // remaining one (or none). Deep links to a hidden job are left alone and
  // explained by <HiddenBanner> instead.
  const listKey = JSON.stringify([filters, tab, profile.areaId, profile.radiusMi, tab === 'saved' ? state.saved : null]);
  const lastListKey = useRef(listKey);
  useEffect(() => {
    if (lastListKey.current === listKey) return;
    lastListKey.current = listKey;
    if (!wide || !jobId || inList) return;
    navigate(firstId ? `/jobs/${firstId}` : '/jobs', { replace: true });
  }, [listKey, wide, jobId, inList, firstId]);

  const reason: HiddenReason | 'saved' | null = !selected || inList ? null : tab === 'saved' ? 'saved' : hiddenReason(selected, filters, ctx);
  const banner = selected && reason && (
    <HiddenBanner
      reason={reason}
      job={selected}
      distance={distances[selected.id]}
      radiusMi={profile.radiusMi}
      areaShort={area.short}
      onShowConflicts={() => setFilters({ showConflicts: true })}
      onClearFilters={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, showConflicts: filters.showConflicts })}
      onWiden={(r) => updateProfile({ radiusMi: r })}
      onShowAll={() => setTab('all')}
    />
  );

  if (jobId && !selected)
    return (
      <div className="page">
        <div className="card empty">
          <h1>Opening unavailable</h1>
          <p>This job is not published or no longer exists.</p>
          <a className="btn btn-primary" href={href('/jobs')}>
            Back to openings
          </a>
        </div>
      </div>
    );
  if (!wide && selected) {
    return (
      <div className="page page-job">
        {banner}
        <JobDetail job={selected} onBack={() => navigate('/jobs')} />
      </div>
    );
  }

  const changedRecently = (id: string) => recent.ids.includes(id) && Date.now() - recent.at < 6000;

  return (
    <div className="page page-jobs">
      <header className="jobs-head">
        <h1>Jobs that fit your week</h1>
        <AvailabilitySummary />
      </header>

      <div className="filter-bar" role="group" aria-label="Filters">
        <SlidersHorizontal className="filter-icon" size={18} aria-hidden="true" />
        <DistanceControl areaId={area.id} radiusMi={profile.radiusMi} onChange={updateProfile} />
        <FilterControls filters={filters} setFilters={setFilters} hoursMin={profile.hoursMin} hoursMax={profile.hoursMax} />
        <span className="spacer" />
        <label className="switch">
          <input type="checkbox" role="switch" checked={filters.showConflicts} onChange={(e) => setFilters({ showConflicts: e.target.checked })} />
          <span className="switch-track" aria-hidden="true" />
          <span>
            Show conflicts <span className="count">{conflicts}</span>
          </span>
        </label>
      </div>

      <div className="jobs-layout">
        <section className="jobs-list" aria-label="Job openings">
          <div className="list-head">
            <div className="segmented" role="group" aria-label="Which jobs to show">
              <button type="button" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>
                Openings <span className="count">{visible.length}</span>
              </button>
              <button type="button" aria-pressed={tab === 'saved'} onClick={() => setTab('saved')}>
                Saved <span className="count">{savedJobs.length}</span>
              </button>
            </div>
            <label className="sort">
              <span>Sort</span>
              <select className="input input-sm" value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as JobFilters['sort'] })}>
                <option value="fit">Best fit</option>
                <option value="distance">Nearest</option>
                <option value="pay">Highest pay</option>
              </select>
            </label>
          </div>

          {list.length > 0 ? (
            <ul className="job-list" ref={listRef}>
              {list.map((job) => {
                const changed = changedRecently(job.id);
                return (
                  <li key={changed ? `${job.id}-${recent.at}` : job.id}>
                    <JobCard job={job} match={matches[job.id]} distance={distances[job.id]} selected={job.id === jobId} changed={changed} />
                  </li>
                );
              })}
            </ul>
          ) : tab === 'saved' ? (
            <div className="empty">
              <p className="empty-title">No saved jobs yet</p>
              <p>Use the bookmark on any opening to keep it here.</p>
            </div>
          ) : (
            <div className="empty">
              <p className="empty-title">No openings match</p>
              <p>{hasActiveFilters(filters) ? 'Try clearing some filters.' : 'Nothing fits your week, filters and distance right now.'}</p>
              {hasActiveFilters(filters) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, showConflicts: filters.showConflicts })}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {tab === 'all' && outOfRange > 0 && (
            <div className="hidden-note">
              <MapPin size={18} aria-hidden="true" />
              <p>
                <strong>
                  {outOfRange} more opening{outOfRange === 1 ? ' is' : 's are'} farther than {profile.radiusMi} mi from {area.short}.
                </strong>
              </p>
              {nextRadius && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => updateProfile({ radiusMi: nextRadius })}>
                  Widen to {nextRadius} mi
                </button>
              )}
            </div>
          )}

          {tab === 'all' && hiddenConflicts > 0 && (
            <div className="hidden-note">
              <EyeOff size={18} aria-hidden="true" />
              <p>
                <strong>
                  {hiddenConflicts} opening{hiddenConflicts === 1 ? '' : 's'} conflict{hiddenConflicts === 1 ? 's' : ''} with your week.
                </strong>{' '}
                Hidden so you only see jobs you could realistically take.
              </p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilters({ showConflicts: true })}>
                <Eye size={16} aria-hidden="true" /> Show conflicts
              </button>
            </div>
          )}
        </section>

        {wide && (
          <section className="jobs-detail" aria-label="Selected job" ref={detailRef}>
            {selected ? (
              <>
                {banner}
                <JobDetail key={selected.id} job={selected} />
              </>
            ) : (
              <div className="empty empty-detail">
                <p className="empty-title">{list.length ? 'Select an opening' : tab === 'saved' ? 'No saved jobs' : 'No openings to show'}</p>
                <p>
                  {list.length
                    ? 'See how its shifts line up with your week.'
                    : tab === 'saved'
                      ? 'Saved openings appear here.'
                      : 'Change your filters or distance to see openings here.'}
                </p>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function HiddenBanner({
  reason,
  job,
  distance,
  radiusMi,
  areaShort,
  onShowConflicts,
  onClearFilters,
  onWiden,
  onShowAll,
}: {
  reason: HiddenReason | 'saved';
  job: Job;
  distance: number;
  radiusMi: number;
  areaShort: string;
  onShowConflicts: () => void;
  onClearFilters: () => void;
  onWiden: (radius: number) => void;
  onShowAll: () => void;
}) {
  const widenTo = RADIUS_OPTIONS.find((r) => r >= distance);
  const content = {
    conflict: { text: `${job.role} conflicts with your week, so it’s hidden from your list.`, action: 'Show conflicts', run: onShowConflicts },
    filters: { text: 'Your current filters hide this opening from your list.', action: 'Clear filters', run: onClearFilters },
    distance: {
      text: `This opening is about ${distance} mi from ${areaShort}, outside your ${radiusMi}-mile radius.`,
      action: widenTo ? `Widen to ${widenTo} mi` : null,
      run: () => widenTo && onWiden(widenTo),
    },
    saved: { text: 'This opening isn’t in your saved jobs.', action: 'Show all openings', run: onShowAll },
  }[reason];
  return (
    <div className="hidden-banner" role="status">
      <EyeOff size={18} aria-hidden="true" />
      <p>
        <strong>Not in your list.</strong> {content.text}
      </p>
      {content.action && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={content.run}>
          {content.action}
        </button>
      )}
    </div>
  );
}

function AvailabilitySummary() {
  const { state } = useStore();
  const days = weeklyWindows(state.schedule).map((d) => d.day);
  const minutes = workableMinutes(state.schedule);
  return (
    <div className="avail-summary">
      <CalendarDays size={20} aria-hidden="true" />
      {minutes > 0 ? (
        <p>
          You can work about <strong>{formatHours(minutes)}</strong> a week · {formatDayList(days)} · {state.schedule.bufferMinutes}-min commute
          buffer
        </p>
      ) : (
        <p>You haven’t marked any time as available to work yet.</p>
      )}
      <a className="btn btn-quiet btn-sm" href={href('/schedule')}>
        <Pencil size={16} aria-hidden="true" /> Edit schedule
      </a>
    </div>
  );
}

/** The profile's search area and radius, editable from the Jobs page. */
function DistanceControl({
  areaId,
  radiusMi,
  onChange,
}: {
  areaId: string;
  radiusMi: number;
  onChange: (p: { areaId?: string; radiusMi?: number }) => void;
}) {
  return (
    <span className="distance-control" role="group" aria-label="Distance">
      <select className="input input-sm" aria-label="Search radius" value={radiusMi} onChange={(e) => onChange({ radiusMi: Number(e.target.value) })}>
        {RADIUS_OPTIONS.map((r) => (
          <option key={r} value={r}>
            Within {r} mi
          </option>
        ))}
      </select>
      <span className="distance-of">of</span>
      <select className="input input-sm" aria-label="Search area" value={areaId} onChange={(e) => onChange({ areaId: e.target.value })}>
        {SEARCH_AREAS.map((a) => (
          <option key={a.id} value={a.id}>
            {capitalise(a.short)}
          </option>
        ))}
      </select>
    </span>
  );
}

const PAY_OPTIONS = [0, 20, 22, 24];

function FilterControls({
  filters,
  setFilters,
  hoursMin,
  hoursMax,
}: {
  filters: JobFilters;
  setFilters: (p: Partial<JobFilters>) => void;
  hoursMin: number;
  hoursMax: number;
}) {
  return (
    <>
      <select
        className="input input-sm"
        aria-label="Minimum hourly pay"
        value={filters.minPay}
        onChange={(e) => setFilters({ minPay: Number(e.target.value) })}
      >
        {PAY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p ? `$${p}+/hr` : 'Any pay'}
          </option>
        ))}
      </select>
      <select
        className="input input-sm"
        aria-label="Job category"
        value={filters.categories[0] ?? ''}
        onChange={(e) => setFilters({ categories: e.target.value ? [e.target.value as Category] : [] })}
      >
        <option value="">All categories</option>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABEL[c]}
          </option>
        ))}
      </select>
      <button type="button" className="chip-btn" aria-pressed={filters.withinHours} onClick={() => setFilters({ withinHours: !filters.withinHours })}>
        Fits my {hoursMin}–{hoursMax} hrs
      </button>
      <button
        type="button"
        className="chip-btn"
        aria-pressed={filters.noExperience}
        onClick={() => setFilters({ noExperience: !filters.noExperience })}
      >
        No experience required
      </button>
      {hasActiveFilters(filters) && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, showConflicts: filters.showConflicts })}
        >
          Clear
        </button>
      )}
    </>
  );
}

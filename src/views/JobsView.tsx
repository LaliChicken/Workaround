import { CalendarDays, Eye, EyeOff, Pencil, SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { JobCard } from '../components/JobCard';
import { JobDetail } from '../components/JobDetail';
import { CATEGORY_LABEL, JOBS, jobById } from '../data/jobs';
import { partitionJobs, sortJobs, DEFAULT_FILTERS, type JobFilters } from '../lib/jobs';
import { weeklyWindows, workableMinutes } from '../lib/matching';
import { href, navigate, useMediaQuery } from '../lib/router';
import { formatDayList, formatHours } from '../lib/time';
import type { Category } from '../lib/types';
import { useStore } from '../state/store';

export function JobsView({ jobId }: { jobId?: string }) {
  const { state, matches, setFilters, recent } = useStore();
  const { filters, profile } = state;
  const wide = useMediaQuery('(min-width: 1000px)');
  const [tab, setTab] = useState<'all' | 'saved'>('all');
  const ctx = { matches, hoursMin: profile.hoursMin, hoursMax: profile.hoursMax };
  const { visible, hiddenConflicts, conflicts } = partitionJobs(JOBS, filters, ctx);
  const savedJobs = sortJobs(JOBS.filter((j) => state.saved.includes(j.id)), filters, ctx);
  const list = tab === 'saved' ? savedJobs : visible;
  const selected = jobId ? jobById(jobId) : undefined;
  const firstId = list[0]?.id;

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

  if (!wide && selected) {
    return (
      <div className="page page-job">
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

      <FilterBar filters={filters} setFilters={setFilters} hoursMin={profile.hoursMin} hoursMax={profile.hoursMax} conflicts={conflicts} />

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
                    <JobCard job={job} match={matches[job.id]} selected={job.id === jobId} changed={changed} />
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
              <p className="empty-title">No openings match these filters</p>
              <p>{hiddenConflicts > 0 ? `${hiddenConflicts} conflicting opening${hiddenConflicts === 1 ? ' is' : 's are'} hidden.` : 'Try widening your filters.'}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>
                Clear filters
              </button>
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
              <JobDetail key={selected.id} job={selected} />
            ) : (
              <div className="empty empty-detail">
                <p className="empty-title">Select an opening</p>
                <p>See how its shifts line up with your week.</p>
              </div>
            )}
          </section>
        )}
      </div>
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
          You can work about <strong>{formatHours(minutes)}</strong> a week · {formatDayList(days)} · {state.schedule.bufferMinutes}-min commute buffer
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

const PAY_OPTIONS = [0, 20, 22, 24];
const DISTANCE_OPTIONS = [0, 2, 5, 10];

function FilterBar({
  filters,
  setFilters,
  hoursMin,
  hoursMax,
  conflicts,
}: {
  filters: JobFilters;
  setFilters: (p: Partial<JobFilters>) => void;
  hoursMin: number;
  hoursMax: number;
  conflicts: number;
}) {
  const active = filters.minPay || filters.maxDistance || filters.withinHours || filters.noExperience || filters.categories.length > 0;
  return (
    <div className="filter-bar" role="group" aria-label="Filters">
      <SlidersHorizontal className="filter-icon" size={18} aria-hidden="true" />
      <select className="input input-sm" aria-label="Minimum hourly pay" value={filters.minPay} onChange={(e) => setFilters({ minPay: Number(e.target.value) })}>
        {PAY_OPTIONS.map((p) => (
          <option key={p} value={p}>
            {p ? `$${p}+/hr` : 'Any pay'}
          </option>
        ))}
      </select>
      <select
        className="input input-sm"
        aria-label="Maximum distance"
        value={filters.maxDistance}
        onChange={(e) => setFilters({ maxDistance: Number(e.target.value) })}
      >
        {DISTANCE_OPTIONS.map((d) => (
          <option key={d} value={d}>
            {d ? `Within ${d} mi` : 'Any distance'}
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
      <button type="button" className="chip-btn" aria-pressed={filters.noExperience} onClick={() => setFilters({ noExperience: !filters.noExperience })}>
        No experience required
      </button>
      {active ? (
        <button type="button" className="link-btn" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort, showConflicts: filters.showConflicts })}>
          Clear
        </button>
      ) : null}
      <span className="spacer" />
      <label className="switch">
        <input type="checkbox" role="switch" checked={filters.showConflicts} onChange={(e) => setFilters({ showConflicts: e.target.checked })} />
        <span className="switch-track" aria-hidden="true" />
        <span>
          Show conflicts <span className="count">{conflicts}</span>
        </span>
      </label>
    </div>
  );
}


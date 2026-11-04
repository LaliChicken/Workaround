import { AlertTriangle, ArrowRight, CalendarClock, CalendarPlus, CalendarDays, Eye, LayoutGrid, List, Lock, Pencil, Plus, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BlockEditor, type EditorTarget } from '../components/BlockEditor';
import { UpcomingEditor } from '../components/UpcomingEditor';
import { AvailabilityDialog } from '../components/AvailabilityPicker';
import { ImportDialog, type ImportResult } from '../components/ImportDialog';
import { Dialog, STATE_META } from '../components/ui';
import { KIND_META, Legend, WeekGrid, blockLabel } from '../components/WeekGrid';
import { isConflict, weeklyWindows, workableMinutes, workableWindows } from '../lib/matching';
import { href, useMediaQuery } from '../lib/router';
import { DAYS, DAY_LONG, DAY_SHORT, formatDate, formatHours, formatRange } from '../lib/time';
import type { DatedItem, Job, MatchState, Schedule, ScheduleBlock } from '../lib/types';
import { clashDateCount, datedClashes, describeWhen, isPast, isoToday } from '../lib/upcoming';
import { useStore } from '../state/store';

const BUFFERS = [0, 15, 30, 45, 60];

export function ScheduleView() {
  const { state, matches, changeSchedule } = useStore();
  const { schedule } = state;
  const wide = useMediaQuery('(min-width: 760px)');
  const [view, setView] = useState<'grid' | 'list'>(wide ? 'grid' : 'list');
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [importing, setImporting] = useState(false);
  const [settingAvailability, setSettingAvailability] = useState(false);
  const [editingTerm, setEditingTerm] = useState(false);
  const [dated, setDated] = useState<{ item: DatedItem | null; key: number } | null>(null);

  useEffect(() => {
    document.title = 'My Schedule · Workaround';
  }, []);

  const openEditor = (t: EditorTarget) => {
    setEditorKey((k) => k + 1);
    setEditor(t);
  };

  const classes = schedule.blocks.filter((b) => b.kind === 'class');

  return (
    <div className="page page-schedule">
      <header className="page-head">
        <div>
          <h1>My Schedule</h1>
          <p className="page-sub">
            <CalendarDays size={18} aria-hidden="true" />
            {schedule.termName} · {formatDate(schedule.termStart)} – {formatDate(schedule.termEnd, { month: 'short', day: 'numeric', year: 'numeric' })}
            <button type="button" className="link-btn" onClick={() => setEditingTerm(true)}>
              Edit term
            </button>
          </p>
        </div>
        <div className="page-actions">
          <div className="segmented" role="group" aria-label="Schedule view">
            <button type="button" aria-pressed={view === 'grid'} onClick={() => setView('grid')}>
              <LayoutGrid size={16} aria-hidden="true" /> Week
            </button>
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <List size={16} aria-hidden="true" /> List
            </button>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>
            <Upload size={18} aria-hidden="true" /> Import
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openEditor({ mode: 'add' })}>
            <Plus size={18} aria-hidden="true" /> Add to schedule
          </button>
        </div>
      </header>

      <div className="schedule-layout">
        <section className="card schedule-main" aria-label="Weekly schedule">
          {classes.length === 0 && (
            <div className="callout callout-info schedule-empty">
              <span>
                <strong>Start with your classes.</strong> Add each class meeting, then mark the times you’re willing to work. We never assume time outside class
                is free.
              </span>
              <span className="schedule-empty-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setImporting(true)}>
                  <Upload size={16} aria-hidden="true" /> Import schedule
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEditor({ mode: 'add', kind: 'class' })}>
                  <Plus size={16} aria-hidden="true" /> Add a class
                </button>
              </span>
            </div>
          )}
          <div className="schedule-toolbar">
            <Legend />
            {view === 'grid' && <p className="hint">Select any block to edit it, or an empty slot to add one.</p>}
          </div>
          {view === 'grid' ? (
            <div className="week-scroll">
              <WeekGrid schedule={schedule} onEdit={(block) => openEditor({ mode: 'edit', block })} onAddAt={(day, start) => openEditor({ mode: 'add', day, start })} />
            </div>
          ) : (
            <AgendaList schedule={schedule} onEdit={(block) => openEditor({ mode: 'edit', block })} />
          )}
        </section>

        <aside className="schedule-side">
          <BufferCard schedule={schedule} onChange={(minutes) => changeSchedule({ ...schedule, bufferMinutes: minutes }, `Commute buffer set to ${minutes} minutes`)} />
          <UpcomingCard
            schedule={schedule}
            jobs={state.jobs.filter((j) => j.publication === 'published')}
            onOpen={(item) => setDated({ item, key: Date.now() })}
          />
          <MatchCountCard matches={state.jobs.filter(j => j.publication === 'published').map(j => matches[j.id].state)} />
          <EmployerViewCard schedule={schedule} onSetAvailability={() => setSettingAvailability(true)} />
        </aside>
      </div>

      {editor && <BlockEditor key={editorKey} target={editor} onClose={() => setEditor(null)} />}
      {importing && (
        <ImportDialog
          baseSchedule={schedule}
          onClose={() => setImporting(false)}
          onConfirm={(result) => {
            setImporting(false);
            changeSchedule(applyImport(schedule, result), result.availability ? 'Imported classes and work availability' : 'Imported classes confirmed');
          }}
        />
      )}
      {settingAvailability && (
        <AvailabilityDialog
          schedule={schedule}
          onClose={() => setSettingAvailability(false)}
          onSave={(available) => {
            setSettingAvailability(false);
            changeSchedule({ ...schedule, blocks: [...schedule.blocks.filter((b) => b.kind !== 'available'), ...available] }, 'Work availability updated');
          }}
        />
      )}
      {dated && <UpcomingEditor key={dated.key} item={dated.item} onClose={() => setDated(null)} />}
      {editingTerm && <TermDialog schedule={schedule} onClose={() => setEditingTerm(false)} />}
    </div>
  );
}

function UpcomingCard({ schedule, jobs, onOpen }: { schedule: Schedule; jobs: Job[]; onOpen: (item: DatedItem | null) => void }) {
  const [showPast, setShowPast] = useState(false);
  const today = isoToday();
  const items = [...(schedule.upcoming ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.start - b.start);
  const past = items.filter((i) => isPast(i, today));
  const shown = showPast ? items : items.filter((i) => !isPast(i, today));
  const impact = (item: DatedItem) => {
    const one: Schedule = { ...schedule, upcoming: [item] };
    const hit = jobs.map((j) => clashDateCount(datedClashes(j, one, today))).filter((n) => n > 0);
    return hit.length;
  };
  return (
    <section className="card side-card" aria-labelledby="upcoming-title">
      <h2 className="card-title" id="upcoming-title">
        <CalendarPlus size={18} aria-hidden="true" /> Coming up
      </h2>
      <p className="card-text">Exams, trips and classes that start later. Your usual week stays the same; jobs flag shifts that land on these dates.</p>
      {shown.length ? (
        <ul className="upcoming-list">
          {shown.map((item) => {
            const n = isPast(item, today) ? 0 : impact(item);
            return (
              <li key={item.id} className={`upcoming-item${isPast(item, today) ? ' is-past' : ''}`}>
                <span className={`dated-swatch dated-swatch-${item.kind}`} aria-hidden="true" />
                <div>
                  <p className="upcoming-title">{item.title}</p>
                  <p className="upcoming-when">{describeWhen(item)}</p>
                  {n > 0 && (
                    <p className="upcoming-impact tone-text-confirm">
                      <AlertTriangle size={14} aria-hidden="true" /> Lands on shifts in {n} job{n === 1 ? '' : 's'}
                    </p>
                  )}
                  {isPast(item, today) && <p className="upcoming-when">Past</p>}
                </div>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => onOpen(item)} aria-label={`Edit ${item.title}`}>
                  <Pencil size={15} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="upcoming-empty">Nothing dated yet.</p>
      )}
      {past.length > 0 && (
        <button type="button" className="link-btn upcoming-past-toggle" onClick={() => setShowPast((v) => !v)}>
          {showPast ? 'Hide past dates' : `Show ${past.length} past date${past.length === 1 ? '' : 's'}`}
        </button>
      )}
      <button type="button" className="btn btn-secondary btn-block" onClick={() => onOpen(null)}>
        <Plus size={18} aria-hidden="true" /> Add a date
      </button>
    </section>
  );
}

function BufferCard({ schedule, onChange }: { schedule: Schedule; onChange: (minutes: number) => void }) {
  return (
    <section className="card side-card">
      <h2 className="card-title" id="buffer-title">
        Commute buffer
      </h2>
      <p className="card-text">Travel time between campus and work, added before and after every class.</p>
      <div className="segmented segmented-fill" role="radiogroup" aria-labelledby="buffer-title">
        {BUFFERS.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={schedule.bufferMinutes === m} onClick={() => schedule.bufferMinutes !== m && onChange(m)}>
            {m === 0 ? 'None' : `${m} min`}
          </button>
        ))}
      </div>
    </section>
  );
}

const COUNT_ORDER: MatchState[] = ['fits', 'optional', 'confirm'];

function MatchCountCard({ matches }: { matches: MatchState[] }) {
  const conflicts = matches.filter(isConflict).length;
  return (
    <section className="card side-card">
      <h2 className="card-title">Your matches right now</h2>
      <ul className="match-counts">
        {COUNT_ORDER.map((s) => {
          const n = matches.filter((m) => m === s).length;
          const meta = STATE_META[s];
          return (
            <li key={s} className={`tone-text-${meta.tone}`}>
              <meta.Icon size={18} aria-hidden="true" />
              <span className="match-count-label">{meta.label}</span>
              <span className="match-count-num" key={n}>
                {n}
              </span>
            </li>
          );
        })}
        <li className="tone-text-conflict">
          <STATE_META.conflict.Icon size={18} aria-hidden="true" />
          <span className="match-count-label">Conflicts with your week</span>
          <span className="match-count-num" key={`c${conflicts}`}>
            {conflicts}
          </span>
        </li>
      </ul>
      <a className="btn btn-secondary btn-block" href={href('/jobs')}>
        See jobs that fit <ArrowRight size={18} aria-hidden="true" />
      </a>
    </section>
  );
}

/** Replaces classes (and availability, when the student set it) with an import. */
function applyImport(schedule: Schedule, result: ImportResult): Schedule {
  const keep = schedule.blocks.filter((b) => b.kind !== 'class' && (result.availability === null || b.kind !== 'available'));
  return {
    ...schedule,
    ...(result.term ? { termName: result.term.name ?? schedule.termName, termStart: result.term.start, termEnd: result.term.end } : {}),
    blocks: [...keep, ...result.classes, ...(result.availability ?? [])],
  };
}

function EmployerViewCard({ schedule, onSetAvailability }: { schedule: Schedule; onSetAvailability: () => void }) {
  const days = weeklyWindows(schedule);
  const total = workableMinutes(schedule);
  return (
    <section className="card side-card">
      <h2 className="card-title">
        <Eye size={18} aria-hidden="true" /> What employers see
      </h2>
      {days.length === 0 ? (
        <p className="card-text">Nothing yet. Add “Available to work” blocks so employers can see when you can work.</p>
      ) : (
        <>
          <p className="card-text">
            About <strong>{formatHours(total)}</strong> a week you can work, after classes, commitments and your {schedule.bufferMinutes}-minute buffer.
          </p>
          <ul className="window-list">
            {days.map(({ day, windows }) => (
              <li key={day}>
                <span className="window-day">{DAY_SHORT[day]}</span>
                <span>{windows.map((w) => formatRange(w.start, w.end)).join(', ')}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <button type="button" className="btn btn-secondary btn-block" onClick={onSetAvailability}>
        <CalendarClock size={18} aria-hidden="true" /> Set when you can work
      </button>
      <p className="privacy-note">
        <Lock size={14} aria-hidden="true" /> Your class names, times and other commitments stay private.
      </p>
    </section>
  );
}

function AgendaList({ schedule, onEdit }: { schedule: Schedule; onEdit: (b: ScheduleBlock) => void }) {
  return (
    <div className="agenda">
      {DAYS.map((day) => {
        const blocks = schedule.blocks.filter((b) => b.day === day).sort((a, b) => a.start - b.start || (a.kind === 'available' ? -1 : 1));
        const windows = workableWindows(schedule, day);
        return (
          <section key={day} className="agenda-day" aria-labelledby={`agenda-${day}`}>
            <header className="agenda-head">
              <h3 id={`agenda-${day}`}>{DAY_LONG[day]}</h3>
              <span className={`agenda-free${windows.length ? '' : ' is-zero'}`}>
                {windows.length ? `You can work ${windows.map((w) => formatRange(w.start, w.end)).join(', ')}` : 'Not available to work'}
              </span>
            </header>
            {blocks.length === 0 ? (
              <p className="agenda-empty">Nothing scheduled.</p>
            ) : (
              <ul>
                {blocks.map((b) => (
                  <li key={b.id} className="agenda-item">
                    <span className={`swatch swatch-${b.kind === 'other' ? 'activity' : b.kind}`} aria-hidden="true" />
                    <span className="agenda-time">{formatRange(b.start, b.end)}</span>
                    <span className="agenda-title">
                      {blockLabel(b)} {blockLabel(b) !== KIND_META[b.kind].label && <small>{KIND_META[b.kind].label}</small>}
                    </span>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => onEdit(b)} aria-label={`Edit ${blockLabel(b)} on ${DAY_LONG[day]}`}>
                      <Pencil size={16} aria-hidden="true" /> Edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function TermDialog({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const { changeSchedule } = useStore();
  const [termName, setName] = useState(schedule.termName);
  const [termStart, setStart] = useState(schedule.termStart);
  const [termEnd, setEnd] = useState(schedule.termEnd);
  const invalid = !termStart || !termEnd || termEnd <= termStart;
  return (
    <Dialog
      open
      size="sm"
      onClose={onClose}
      title="Term dates"
      description="Your schedule applies between these dates. You’ll be asked to update it for the next term."
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={invalid}
            onClick={() => {
              changeSchedule({ ...schedule, termName: termName.trim() || 'Current term', termStart, termEnd }, 'Term dates updated', { undoable: false });
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="form">
        <div className="field">
          <label className="label" htmlFor="term-name">
            Term
          </label>
          <input id="term-name" className="input" value={termName} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="term-start">
              Starts
            </label>
            <input id="term-start" type="date" className="input" value={termStart} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="term-end">
              Ends
            </label>
            <input id="term-end" type="date" className="input" value={termEnd} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {invalid && <p className="form-error">The term needs to end after it starts.</p>}
      </div>
    </Dialog>
  );
}


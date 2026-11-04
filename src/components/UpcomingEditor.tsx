import { Trash } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { DAYS, DAY_LONG, DAY_SHORT, formatTime, optionsIncluding, timeOptions } from '../lib/time';
import { DATED_KIND_META, addDays, datedClashes, describeWhen, isoToday, validateItem, weekdayOf } from '../lib/upcoming';
import type { DatedItem, DatedKind, Day } from '../lib/types';
import { useStore } from '../state/store';
import { Dialog } from './ui';

const KINDS = Object.keys(DATED_KIND_META) as DatedKind[];
const TIMES = timeOptions(6, 23);
type Pattern = 'day' | 'range' | 'weekly';

const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const patternOf = (item: DatedItem): Pattern => (item.repeat === 'weekly' ? 'weekly' : item.startDate === item.endDate ? 'day' : 'range');

function blank(kind: DatedKind = 'exam'): DatedItem {
  const today = isoToday();
  return { id: '', kind, title: '', startDate: today, endDate: today, repeat: 'once', days: [], allDay: false, start: 9 * 60, end: 11 * 60 };
}

/** Defaults that suit each kind, applied only while adding. */
function withKindDefaults(item: DatedItem, kind: DatedKind): DatedItem {
  if (kind === 'away') return { ...item, kind, allDay: true, endDate: item.endDate === item.startDate ? addDays(item.startDate, 2) : item.endDate };
  if (kind === 'class' || kind === 'activity') {
    return { ...item, kind, allDay: false, repeat: 'weekly', days: item.days.length ? item.days : [weekdayOf(item.startDate)], endDate: item.endDate === item.startDate ? addDays(item.startDate, 70) : item.endDate };
  }
  return { ...item, kind, repeat: 'once', endDate: item.startDate };
}

/** Add or edit a dated commitment. Mount with a `key` so each open starts fresh. */
export function UpcomingEditor({ item, onClose }: { item: DatedItem | null; onClose: () => void }) {
  const { state, changeSchedule } = useStore();
  const [form, setForm] = useState<DatedItem>(() => (item ? { ...item } : blank()));
  const [error, setError] = useState<string | null>(null);
  const uid = useId();
  const [pattern, setPatternState] = useState<Pattern>(() => (item ? patternOf(item) : 'day'));
  const set = (patch: Partial<DatedItem>) => setForm((f) => ({ ...f, ...patch }));
  const schedule = state.schedule;
  const list = schedule.upcoming ?? [];

  const setPattern = (p: Pattern) => {
    setPatternState(p);
    if (p === 'day') set({ repeat: 'once', endDate: form.startDate });
    else if (p === 'range') set({ repeat: 'once', endDate: form.endDate > form.startDate ? form.endDate : addDays(form.startDate, 2) });
    else set({ repeat: 'weekly', days: form.days.length ? form.days : [weekdayOf(form.startDate)], endDate: form.endDate > form.startDate ? form.endDate : addDays(form.startDate, 70) });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const clean: DatedItem = {
      ...form,
      title: form.title.trim(),
      endDate: pattern === 'day' ? form.startDate : form.endDate,
      repeat: pattern === 'weekly' ? 'weekly' : 'once',
      days: pattern === 'weekly' ? [...form.days].sort() : [],
    };
    const problem = validateItem(clean);
    if (problem) return setError(problem);
    const saved = item ? clean : { ...clean, id: `dated-${Date.now().toString(36)}` };
    const hit = state.jobs.filter((j) => j.publication === 'published' && datedClashes(j, { ...schedule, upcoming: [saved] }).length).length;
    const body = `Your usual week is unchanged. ${hit ? `${hit} job${hit === 1 ? ' has' : 's have'} shifts on these dates; they’re flagged in Jobs.` : 'No job shifts land on these dates.'}`;
    if (item) {
      changeSchedule({ ...schedule, upcoming: list.map((i) => (i.id === item.id ? saved : i)) }, `Updated ${saved.title}`, { body });
    } else {
      changeSchedule({ ...schedule, upcoming: [...list, saved] }, `Added ${saved.title} · ${describeWhen(saved)}`, { body });
    }
    onClose();
  };

  const remove = () => {
    if (!item) return;
    changeSchedule({ ...schedule, upcoming: list.filter((i) => i.id !== item.id) }, `Removed ${item.title}`);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? `Edit ${item.title}` : 'Add a date'}
      description={
        item
          ? describeWhen(item)
          : 'For exams, trips, appointments or classes that start later. Your usual week stays the same; jobs flag any shifts on these dates.'
      }
      footer={
        <>
          {item && (
            <button type="button" className="btn btn-danger-quiet" onClick={remove}>
              <Trash size={16} aria-hidden="true" /> Remove
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form={`${uid}-form`} className="btn btn-primary">
            Save
          </button>
        </>
      }
    >
      <form id={`${uid}-form`} className="form" onSubmit={submit} noValidate>
        <fieldset className="field">
          <legend className="label">Type</legend>
          <div className="kind-options dated-kinds">
            {KINDS.map((k) => (
              <label key={k} className={`kind-option dated-kind-${k}${form.kind === k ? ' is-selected' : ''}`}>
                <input
                  type="radio"
                  name={`${uid}-kind`}
                  value={k}
                  checked={form.kind === k}
                  onChange={() => {
                    if (item) return set({ kind: k });
                    const next = withKindDefaults(form, k);
                    setForm(next);
                    setPatternState(patternOf(next));
                  }}
                />
                <span className="kind-swatch" aria-hidden="true" />
                <span className="kind-text">
                  <span className="kind-label">{DATED_KIND_META[k].label}</span>
                  <span className="kind-hint">{DATED_KIND_META[k].hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label className="label" htmlFor={`${uid}-title`}>
            Label
          </label>
          <input
            id={`${uid}-title`}
            className="input"
            value={form.title}
            maxLength={60}
            placeholder={DATED_KIND_META[form.kind].placeholder}
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>

        <fieldset className="field">
          <legend className="label">When</legend>
          <div className="segmented segmented-fill" role="radiogroup" aria-label="How often">
            {(
              [
                ['day', 'One day'],
                ['range', 'Several days'],
                ['weekly', 'Weekly'],
              ] as const
            ).map(([p, label]) => (
              <button key={p} type="button" role="radio" aria-checked={pattern === p} onClick={() => setPattern(p)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor={`${uid}-from`}>
              {pattern === 'day' ? 'Date' : pattern === 'weekly' ? 'Starts' : 'From'}
            </label>
            <input
              id={`${uid}-from`}
              type="date"
              className="input"
              value={form.startDate}
              onChange={(e) => {
                const startDate = e.target.value;
                const span = pattern === 'range' ? 2 : pattern === 'weekly' ? 70 : 0;
                set({ startDate, ...(pattern === 'day' || form.endDate < startDate ? { endDate: isIso(startDate) ? addDays(startDate, span) : startDate } : {}) });
              }}
            />
          </div>
          {pattern !== 'day' && (
            <div className="field">
              <label className="label" htmlFor={`${uid}-to`}>
                {pattern === 'weekly' ? 'Last week' : 'To'}
              </label>
              <input id={`${uid}-to`} type="date" className="input" min={form.startDate} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
            </div>
          )}
        </div>

        {pattern === 'weekly' && (
          <fieldset className="field">
            <legend className="label">Repeats on</legend>
            <div className="day-toggles">
              {DAYS.map((d) => (
                <label key={d} className={`day-toggle${form.days.includes(d) ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.days.includes(d)}
                    onChange={(e) => set({ days: e.target.checked ? [...form.days, d] : form.days.filter((x: Day) => x !== d) })}
                  />
                  <span aria-hidden="true">{DAY_SHORT[d]}</span>
                  <span className="sr-only">{DAY_LONG[d]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <label className="check">
          <input type="checkbox" checked={form.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
          <span>All day{pattern === 'range' ? ', every day' : ''}</span>
        </label>

        {!form.allDay && (
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor={`${uid}-start`}>
                Starts at
              </label>
              <select id={`${uid}-start`} className="input" value={form.start} onChange={(e) => set({ start: Number(e.target.value) })}>
                {optionsIncluding(TIMES.slice(0, -1), form.start).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor={`${uid}-end`}>
                Ends at
              </label>
              <select id={`${uid}-end`} className="input" value={form.end} onChange={(e) => set({ end: Number(e.target.value) })}>
                {optionsIncluding(TIMES.slice(1), form.end).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {form.kind === 'class' && !form.allDay && (
          <p className="hint">Your {schedule.bufferMinutes}-minute commute buffer is added around future classes, like your current ones.</p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

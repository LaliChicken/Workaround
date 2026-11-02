import { Trash } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { DAYS, DAY_LONG, DAY_SHORT, formatRange, formatTime, timeOptions } from '../lib/time';
import type { BlockKind, Day, ScheduleBlock } from '../lib/types';
import { useStore } from '../state/store';
import { Dialog } from './ui';
import { KIND_META, blockLabel } from './WeekGrid';

export type EditorTarget = { mode: 'add'; day?: Day; start?: number; kind?: BlockKind } | { mode: 'edit'; block: ScheduleBlock };

const KINDS: BlockKind[] = ['class', 'available', 'study', 'activity', 'other'];
const TIMES = timeOptions(6, 23);

interface FormState {
  kind: BlockKind;
  title: string;
  detail: string;
  days: Day[];
  start: number;
  end: number;
}

function initialForm(target: EditorTarget): FormState {
  if (target.mode === 'edit') {
    const b = target.block;
    return { kind: b.kind, title: b.kind === 'available' ? '' : b.title, detail: b.detail ?? '', days: [b.day], start: b.start, end: b.end };
  }
  const start = target.start ?? 12 * 60;
  return { kind: target.kind ?? 'available', title: '', detail: '', days: target.day !== undefined ? [target.day] : [], start, end: Math.min(start + 120, 23 * 60) };
}

function defaultTitle(kind: BlockKind, title: string): string {
  const trimmed = title.trim();
  if (kind === 'available') return 'Available to work';
  if (kind === 'study') return trimmed || 'Study';
  return trimmed;
}

/** Mount with a `key` per target so the form starts fresh each time it opens. */
export function BlockEditor({ target, onClose }: { target: EditorTarget; onClose: () => void }) {
  const { state, changeSchedule } = useStore();
  const [form, setForm] = useState<FormState>(() => initialForm(target));
  const [error, setError] = useState<string | null>(null);
  const uid = useId();

  const editing = target.mode === 'edit' ? target.block : null;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const needsTitle = form.kind === 'class' || form.kind === 'activity' || form.kind === 'other';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (form.days.length === 0) return setError('Choose at least one day.');
    if (form.end <= form.start) return setError('The end time needs to be after the start time.');
    if (needsTitle && !form.title.trim()) return setError(form.kind === 'class' ? 'Add a course code, like MATH 1B.' : 'Add a short label.');
    const title = defaultTitle(form.kind, form.title);
    const detail = form.kind === 'available' ? undefined : form.detail.trim() || undefined;
    const schedule = state.schedule;

    if (editing) {
      const updated: ScheduleBlock = { ...editing, kind: form.kind, title, detail, day: form.days[0], start: form.start, end: form.end };
      changeSchedule(
        { ...schedule, blocks: schedule.blocks.map((b) => (b.id === editing.id ? updated : b)) },
        `${blockLabel(updated)} on ${DAY_LONG[updated.day]} is now ${formatRange(updated.start, updated.end)}`,
      );
    } else {
      const stamp = Date.now().toString(36);
      const added: ScheduleBlock[] = form.days.map((day, i) => ({
        id: `${form.kind}-${stamp}-${i}`,
        kind: form.kind,
        title,
        detail,
        day,
        start: form.start,
        end: form.end,
      }));
      const dayText = form.days.length === 1 ? DAY_LONG[form.days[0]] : `${form.days.length} days`;
      changeSchedule({ ...schedule, blocks: [...schedule.blocks, ...added] }, `Added ${blockLabel(added[0])} on ${dayText}`);
    }
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    changeSchedule(
      { ...state.schedule, blocks: state.schedule.blocks.filter((b) => b.id !== editing.id) },
      `Removed ${blockLabel(editing)} on ${DAY_LONG[editing.day]}`,
    );
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={editing ? `Edit ${KIND_META[editing.kind].label.toLowerCase()}` : 'Add to your schedule'}
      description={editing ? `${blockLabel(editing)} · ${DAY_LONG[editing.day]} ${formatRange(editing.start, editing.end)}` : 'Matches update as soon as you save.'}
      footer={
        <>
          {editing && (
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
        {editing ? (
          <div className="field">
            <label className="label" htmlFor={`${uid}-kind`}>
              Type
            </label>
            <select id={`${uid}-kind`} className="input" value={form.kind} onChange={(e) => set({ kind: e.target.value as BlockKind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_META[k].label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <fieldset className="field">
            <legend className="label">Type</legend>
            <div className="kind-options">
              {KINDS.map((k) => (
                <label key={k} className={`kind-option kind-${k}${form.kind === k ? ' is-selected' : ''}`}>
                  <input type="radio" name={`${uid}-kind`} value={k} checked={form.kind === k} onChange={() => set({ kind: k })} />
                  <span className="kind-swatch" aria-hidden="true" />
                  <span className="kind-text">
                    <span className="kind-label">{KIND_META[k].label}</span>
                    <span className="kind-hint">{KIND_META[k].hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {form.kind !== 'available' && (
          <div className="field-row">
            <div className="field">
              <label className="label" htmlFor={`${uid}-title`}>
                {form.kind === 'class' ? 'Course code' : form.kind === 'study' ? 'Label (optional)' : form.kind === 'activity' ? 'Activity name' : 'Label'}
              </label>
              <input
                id={`${uid}-title`}
                className="input"
                value={form.title}
                placeholder={form.kind === 'class' ? 'MATH 1B' : form.kind === 'study' ? 'Study' : form.kind === 'activity' ? 'Robotics club' : 'Family time'}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
            <div className="field">
              <label className="label" htmlFor={`${uid}-detail`}>
                {form.kind === 'class' ? 'Course name (optional)' : 'Note (optional)'}
              </label>
              <input id={`${uid}-detail`} className="input" value={form.detail} onChange={(e) => set({ detail: e.target.value })} />
            </div>
          </div>
        )}

        {editing ? (
          <div className="field">
            <label className="label" htmlFor={`${uid}-day`}>
              Day
            </label>
            <select id={`${uid}-day`} className="input" value={form.days[0]} onChange={(e) => set({ days: [Number(e.target.value) as Day] })}>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {DAY_LONG[d]}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <fieldset className="field">
            <legend className="label">Days</legend>
            <div className="day-toggles">
              {DAYS.map((d) => (
                <label key={d} className={`day-toggle${form.days.includes(d) ? ' is-selected' : ''}`}>
                  <input
                    type="checkbox"
                    checked={form.days.includes(d)}
                    onChange={(e) => set({ days: e.target.checked ? [...form.days, d] : form.days.filter((x) => x !== d) })}
                  />
                  <span aria-hidden="true">{DAY_SHORT[d]}</span>
                  <span className="sr-only">{DAY_LONG[d]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor={`${uid}-start`}>
              Starts
            </label>
            <select id={`${uid}-start`} className="input" value={form.start} onChange={(e) => set({ start: Number(e.target.value) })}>
              {TIMES.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label" htmlFor={`${uid}-end`}>
              Ends
            </label>
            <select id={`${uid}-end`} className="input" value={form.end} onChange={(e) => set({ end: Number(e.target.value) })}>
              {TIMES.slice(1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

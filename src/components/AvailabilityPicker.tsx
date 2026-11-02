import { CalendarClock } from 'lucide-react';
import { useId, useState } from 'react';
import { workableMinutes } from '../lib/matching';
import { suggestedWindows, windowsToBlocks, type DayWindow } from '../lib/scheduleImport';
import { DAY_LONG, formatHours, formatTime, timeOptions } from '../lib/time';
import type { Schedule, ScheduleBlock } from '../lib/types';
import { Dialog } from './ui';

const TIMES = timeOptions(6, 23);

/**
 * "When are you willing to work?" Students choose days and a time range per
 * day. The preview shows real workable hours: classes, other commitments and
 * the commute buffer are subtracted automatically.
 */
export function AvailabilityFields({
  windows,
  onChange,
  draft,
}: {
  windows: DayWindow[];
  onChange: (windows: DayWindow[]) => void;
  /** Everything else on the student's week, used for the live preview. */
  draft: Schedule;
}) {
  const uid = useId();
  const set = (day: number, patch: Partial<DayWindow>) => onChange(windows.map((w) => (w.day === day ? { ...w, ...patch } : w)));
  const preview = { ...draft, blocks: [...draft.blocks.filter((b) => b.kind !== 'available'), ...windowsToBlocks(windows)] };
  const minutes = workableMinutes(preview);
  const bad = windows.find((w) => w.on && w.end <= w.start);

  return (
    <div className="availability">
      <ul className="availability-rows">
        {windows.map((w) => (
          <li key={w.day} className={w.on ? 'is-on' : undefined}>
            <label className="check availability-day">
              <input type="checkbox" checked={w.on} onChange={(e) => set(w.day, { on: e.target.checked })} />
              {DAY_LONG[w.day]}
            </label>
            <label className="sr-only" htmlFor={`${uid}-${w.day}-start`}>
              {DAY_LONG[w.day]} from
            </label>
            <select id={`${uid}-${w.day}-start`} className="input input-sm" value={w.start} disabled={!w.on} onChange={(e) => set(w.day, { start: Number(e.target.value) })}>
              {TIMES.slice(0, -1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
            <span className="availability-to" aria-hidden="true">
              to
            </span>
            <label className="sr-only" htmlFor={`${uid}-${w.day}-end`}>
              {DAY_LONG[w.day]} until
            </label>
            <select id={`${uid}-${w.day}-end`} className="input input-sm" value={w.end} disabled={!w.on} onChange={(e) => set(w.day, { end: Number(e.target.value) })}>
              {TIMES.slice(1).map((t) => (
                <option key={t} value={t}>
                  {formatTime(t)}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {bad ? (
        <p className="form-error" role="alert">
          {DAY_LONG[bad.day]} ends before it starts.
        </p>
      ) : (
        <p className="availability-preview" aria-live="polite">
          <CalendarClock size={18} aria-hidden="true" />
          <span>
            About <strong>{formatHours(minutes)}</strong> a week you could work, after classes, other commitments and your {draft.bufferMinutes}-minute
            commute buffer.
          </span>
        </p>
      )}
    </div>
  );
}

export const windowsAreValid = (windows: DayWindow[]) => windows.every((w) => !w.on || w.end > w.start);

/** Standalone version for My Schedule: set availability for the whole week at once. */
export function AvailabilityDialog({ schedule, onClose, onSave }: { schedule: Schedule; onClose: () => void; onSave: (blocks: ScheduleBlock[]) => void }) {
  const [windows, setWindows] = useState<DayWindow[]>(suggestedWindows);
  const hasExisting = schedule.blocks.some((b) => b.kind === 'available');
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="When are you willing to work?"
      description="Pick days and hours. We’ll only match you with shifts inside these times, after your classes and commute buffer."
      footer={
        <>
          <span className="spacer" />
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" disabled={!windowsAreValid(windows)} onClick={() => onSave(windowsToBlocks(windows))}>
            Save availability
          </button>
        </>
      }
    >
      {hasExisting && <p className="callout callout-info">Saving replaces the “Available to work” times already on your schedule.</p>}
      <AvailabilityFields windows={windows} onChange={setWindows} draft={schedule} />
    </Dialog>
  );
}

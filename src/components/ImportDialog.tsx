import { CircleAlert, FileText, Trash, Upload } from 'lucide-react';
import { useState } from 'react';
import { SAMPLE_CLASSES } from '../data/sampleSchedule';
import { DAYS, DAY_LONG, formatTime, timeOptions } from '../lib/time';
import type { Day, ScheduleBlock } from '../lib/types';
import { Dialog } from './ui';

const TIMES = timeOptions(6, 23);

/**
 * Sample import flow. The prototype does NOT parse arbitrary files: reading a
 * real PDF or screenshot needs a parsing service. It shows the confirmation
 * step with a sample Foothill schedule so students check times before matching.
 */
export function ImportDialog({
  onClose,
  onConfirm,
  confirmLabel = 'Confirm classes',
  initialStep = 'choose',
}: {
  initialStep?: 'choose' | 'review';
  onClose: () => void;
  onConfirm: (classes: ScheduleBlock[]) => void;
  confirmLabel?: string;
}) {
  const [step, setStep] = useState<'choose' | 'review'>(initialStep);
  const [rows, setRows] = useState<ScheduleBlock[]>(() =>
    SAMPLE_CLASSES.map((c) => ({ ...c })).sort((a, b) => a.day - b.day || a.start - b.start),
  );
  const [error, setError] = useState<string | null>(null);

  const update = (id: string, patch: Partial<ScheduleBlock>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const confirm = () => {
    const bad = rows.find((r) => r.end <= r.start);
    if (bad) return setError(`${bad.title} on ${DAY_LONG[bad.day]} ends before it starts.`);
    onConfirm(rows);
  };

  if (step === 'choose') {
    return (
      <Dialog
        open
        onClose={onClose}
        title="Import your class schedule"
        description="Bring in your classes, then check every time before we use it for matching."
        footer={
          <>
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep('review')}>
              <FileText size={18} aria-hidden="true" /> Use sample Foothill schedule
            </button>
          </>
        }
      >
        <div className="dropzone is-disabled" aria-disabled="true">
          <Upload size={28} aria-hidden="true" />
          <p className="dropzone-title">Upload a PDF or screenshot</p>
          <p className="dropzone-note">Not connected in this prototype</p>
        </div>
        <p className="callout callout-info">
          <CircleAlert size={18} aria-hidden="true" />
          <span>
            Reading any schedule file needs a parsing service that this prototype doesn’t include. Use the sample schedule to see the review step,
            or add classes by hand on My Schedule.
          </span>
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="Check your classes"
      description="Sample Foothill schedule. Fix anything that doesn’t match your official timetable. We only use these times after you confirm."
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={() => setStep('choose')}>
            Back
          </button>
          <span className="spacer" />
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={rows.length === 0}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="review-table" role="table" aria-label="Imported classes">
        <div className="review-row review-head" role="row">
          <span role="columnheader">Course</span>
          <span role="columnheader">Day</span>
          <span role="columnheader">Starts</span>
          <span role="columnheader">Ends</span>
          <span role="columnheader" className="sr-only">
            Remove
          </span>
        </div>
        {rows.map((r) => (
          <div className="review-row" role="row" key={r.id}>
            <span role="cell" className="review-course">
              <strong>{r.title}</strong>
              <small>{r.detail}</small>
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title} day`} value={r.day} onChange={(e) => update(r.id, { day: Number(e.target.value) as Day })}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LONG[d]}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title} start time`} value={r.start} onChange={(e) => update(r.id, { start: Number(e.target.value) })}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title} end time`} value={r.end} onChange={(e) => update(r.id, { end: Number(e.target.value) })}>
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${r.title} on ${DAY_LONG[r.day]}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Trash size={16} aria-hidden="true" />
              </button>
            </span>
          </div>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

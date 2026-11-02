import { CircleAlert, FileText, Lock, Plus, Sparkles, Trash, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { SAMPLE_CLASSES } from '../data/sampleSchedule';
import { getImportStatus, ImportError, readSchedule, type ImportStatus } from '../lib/importApi';
import { rowProblem, rowsToBlocks, suggestedWindows, toReview, windowsToBlocks, type DayWindow, type ImportReview, type ReviewRow } from '../lib/scheduleImport';
import { useMediaQuery } from '../lib/router';
import { DAYS, DAY_LONG, DAY_SHORT, formatDate, formatTime, optionsIncluding, timeOptions } from '../lib/time';
import type { Day, Schedule, ScheduleBlock } from '../lib/types';
import { AvailabilityFields, windowsAreValid } from './AvailabilityPicker';
import { Dialog } from './ui';

const TIMES = timeOptions(6, 23);

export interface ImportResult {
  source: 'sample' | 'upload';
  classes: ScheduleBlock[];
  /** Null when the student skipped the availability step (or used the sample). */
  availability: ScheduleBlock[] | null;
  term: { name: string | null; start: string; end: string } | null;
}

type Step = 'choose' | 'reading' | 'review' | 'availability';

const sampleRows = (): ReviewRow[] =>
  SAMPLE_CLASSES.map((c) => ({ ...c, kind: 'class' as const, needsCheck: false })).sort((a, b) => a.day - b.day || a.start - b.start);

/**
 * Upload a schedule (PDF or photo), let Claude read the class times, then have
 * the student check every row and say when they're willing to work. Nothing is
 * used for matching until the student confirms. The sample schedule remains as
 * a fallback when the schedule reader isn't set up.
 */
export function ImportDialog({
  onClose,
  onConfirm,
  baseSchedule,
  confirmLabel = 'Confirm classes',
  initialStep = 'choose',
}: {
  onClose: () => void;
  onConfirm: (result: ImportResult) => void;
  /** The rest of the student's week (used for the availability preview). */
  baseSchedule: Schedule;
  confirmLabel?: string;
  initialStep?: 'choose' | 'review';
}) {
  const [step, setStep] = useState<Step>(initialStep);
  const [source, setSource] = useState<'sample' | 'upload'>('sample');
  const [rows, setRows] = useState<ReviewRow[]>(initialStep === 'review' ? sampleRows : []);
  const [extras, setExtras] = useState<Pick<ImportReview, 'unscheduled' | 'warnings' | 'term'>>({ unscheduled: [], warnings: [], term: null });
  const [useTerm, setUseTerm] = useState(true);
  const [windows, setWindows] = useState<DayWindow[]>(suggestedWindows);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const narrow = useMediaQuery('(max-width: 760px)');

  useEffect(() => {
    let live = true;
    getImportStatus().then((s) => live && setStatus(s));
    return () => {
      live = false;
      abortRef.current?.abort();
    };
  }, []);

  const uploadReady = status?.configured === true;

  const useSample = () => {
    setSource('sample');
    setRows(sampleRows());
    setExtras({ unscheduled: [], warnings: [], term: null });
    setError(null);
    setStep('review');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !uploadReady) return;
    setError(null);
    setFileName(file.name);
    setStep('reading');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const extraction = await readSchedule(file, controller.signal);
      const review = toReview(extraction);
      if (review.rows.length === 0 && review.unscheduled.length === 0) {
        setError('We couldn’t find any classes in that file. Try a clearer photo or a screenshot of your weekly schedule.');
        setStep('choose');
        return;
      }
      setSource('upload');
      setRows(review.rows);
      setExtras({ unscheduled: review.unscheduled, warnings: review.warnings, term: review.term });
      setUseTerm(!!review.term);
      setStep('review');
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof ImportError ? e.message : 'Something went wrong reading the schedule. Try again.');
      setStep('choose');
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const cancelReading = () => {
    abortRef.current?.abort();
    setStep('choose');
  };

  const update = (id: string, patch: Partial<ReviewRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const problem = rowProblem(rows);
  const classes = () => rowsToBlocks(rows);
  const term = () => (useTerm ? extras.term : null);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files[0]);
  };

  if (step === 'choose' || step === 'reading') {
    const reading = step === 'reading';
    return (
      <Dialog
        open
        onClose={reading ? cancelReading : onClose}
        title="Import your class schedule"
        description="Upload a PDF, screenshot or photo. You’ll check every class time before we use it."
        footer={
          reading ? (
            <>
              <span className="spacer" />
              <button type="button" className="btn btn-secondary" onClick={cancelReading}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="spacer" />
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className={`btn ${uploadReady ? 'btn-secondary' : 'btn-primary'}`} onClick={useSample}>
                <FileText size={18} aria-hidden="true" /> Use sample Foothill schedule
              </button>
            </>
          )
        }
      >
        {reading ? (
          <div className="reading" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <p className="reading-title">Reading your schedule…</p>
            <p className="muted">{fileName} · usually takes a few seconds</p>
          </div>
        ) : (
          <>
            <label
              className={`dropzone${uploadReady ? '' : ' is-disabled'}${dragging ? ' is-dragging' : ''}`}
              aria-disabled={!uploadReady}
              onDragOver={(e) => {
                e.preventDefault();
                if (uploadReady) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                disabled={!uploadReady}
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <Upload size={28} aria-hidden="true" />
              <span className="dropzone-title">{uploadReady ? 'Choose a file or drop it here' : 'Upload a PDF or photo'}</span>
              <span className="dropzone-note">
                {status === null
                  ? 'Checking the schedule reader…'
                  : uploadReady
                    ? 'PDF, screenshot or photo (PNG, JPEG, WEBP) · up to 10 MB'
                    : status.reachable
                      ? 'Schedule reading isn’t set up on this computer yet (no API key). See the README.'
                      : 'Schedule reading needs the app’s local server. Start it with npm run dev.'}
              </span>
            </label>
            {error && (
              <p className="callout callout-conflict" role="alert">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
            <p className="privacy-note">
              <Lock size={14} aria-hidden="true" /> Your file is sent to Anthropic’s Claude to read the class times. Workaround doesn’t store it.
            </p>
          </>
        )}
      </Dialog>
    );
  }

  if (step === 'availability') {
    const draft: Schedule = { ...baseSchedule, blocks: [...baseSchedule.blocks.filter((b) => b.kind !== 'class' && b.kind !== 'available'), ...classes()] };
    const hasExisting = baseSchedule.blocks.some((b) => b.kind === 'available');
    return (
      <Dialog
        open
        size="lg"
        onClose={onClose}
        title="When are you willing to work?"
        description="We suggested some hours. Change them to the times you actually want to work; we never assume free time is work time."
        footer={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setStep('review')}>
              Back
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-secondary" onClick={() => onConfirm({ source, classes: classes(), availability: null, term: term() })}>
              Skip for now
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!windowsAreValid(windows)}
              onClick={() => onConfirm({ source, classes: classes(), availability: windowsToBlocks(windows), term: term() })}
            >
              Save my week
            </button>
          </>
        }
      >
        {hasExisting && <p className="callout callout-info">Saving replaces the “Available to work” times already on your schedule.</p>}
        <AvailabilityFields windows={windows} onChange={setWindows} draft={draft} />
      </Dialog>
    );
  }

  // Review
  const flagged = rows.filter((r) => r.needsCheck).length;
  return (
    <Dialog
      open
      size="lg"
      onClose={onClose}
      title="Check your classes"
      description={
        source === 'upload'
          ? 'Read from your file by AI. Compare each row with your official schedule and fix anything that’s off. Nothing is used until you confirm.'
          : 'Sample Foothill schedule. Fix anything that doesn’t match your official timetable. We only use these times after you confirm.'
      }
      footer={
        <>
          <button type="button" className="btn btn-quiet" onClick={() => setStep('choose')}>
            Back
          </button>
          <span className="spacer" />
          <button
            type="button"
            className="btn btn-primary"
            disabled={rows.length === 0 || !!problem}
            onClick={() => (source === 'upload' ? setStep('availability') : onConfirm({ source, classes: classes(), availability: null, term: null }))}
          >
            {source === 'upload' ? 'Confirm classes' : confirmLabel}
          </button>
        </>
      }
    >
      {source === 'upload' && (
        <p className={`callout ${flagged ? 'callout-warn' : 'callout-info'}`}>
          <Sparkles size={18} aria-hidden="true" />
          <span>
            Found {rows.length} class meeting{rows.length === 1 ? '' : 's'}.{' '}
            {flagged ? `${flagged} ${flagged === 1 ? 'needs' : 'need'} a closer look (highlighted).` : 'Check them against your schedule before confirming.'}
          </span>
        </p>
      )}

      <div className="review-table" role="table" aria-label="Classes to confirm">
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
          <div className={`review-row${r.needsCheck ? ' needs-check' : ''}`} role="row" key={r.id}>
            <span role="cell" className="review-course">
              <input className="input input-sm" aria-label="Course code" value={r.title} placeholder="Course" onChange={(e) => update(r.id, { title: e.target.value })} />
              {r.detail && <small>{r.detail}</small>}
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title || 'Class'} day`} value={r.day} onChange={(e) => update(r.id, { day: Number(e.target.value) as Day })}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {narrow ? DAY_SHORT[d] : DAY_LONG[d]}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title || 'Class'} start time`} value={r.start} onChange={(e) => update(r.id, { start: Number(e.target.value), needsCheck: false })}>
                {optionsIncluding(TIMES, r.start).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <select className="input input-sm" aria-label={`${r.title || 'Class'} end time`} value={r.end} onChange={(e) => update(r.id, { end: Number(e.target.value), needsCheck: false })}>
                {optionsIncluding(TIMES, r.end).map((t) => (
                  <option key={t} value={t}>
                    {formatTime(t)}
                  </option>
                ))}
              </select>
            </span>
            <span role="cell">
              <button type="button" className="icon-btn icon-btn-sm" aria-label={`Remove ${r.title || 'class'} on ${DAY_LONG[r.day]}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                <Trash size={16} aria-hidden="true" />
              </button>
            </span>
            {r.needsCheck && (
              <p className="review-note" role="cell">
                <span className="check-pill">Check this</span> {r.note ?? 'The reader wasn’t sure about this one.'}
              </p>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-quiet btn-sm add-row"
        onClick={() => setRows((rs) => [...rs, { id: `manual-${Date.now()}`, kind: 'class', day: 0, start: 9 * 60, end: 10 * 60, title: '', needsCheck: false }])}
      >
        <Plus size={16} aria-hidden="true" /> Add a class meeting
      </button>

      {extras.unscheduled.length > 0 && (
        <div className="callout callout-info">
          <CircleAlert size={18} aria-hidden="true" />
          <div>
            <p>
              <strong>Not added to your week</strong> (no set meeting time):
            </p>
            <ul className="plain-list">
              {extras.unscheduled.map((u) => (
                <li key={u.course}>
                  {u.course}: {u.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {extras.warnings.length > 0 && (
        <div className="callout callout-warn">
          <CircleAlert size={18} aria-hidden="true" />
          <ul className="plain-list">
            {extras.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {extras.term && (
        <label className="check">
          <input type="checkbox" checked={useTerm} onChange={(e) => setUseTerm(e.target.checked)} />
          Use term dates from your schedule: {extras.term.name ? `${extras.term.name}, ` : ''}
          {formatDate(extras.term.start)} – {formatDate(extras.term.end, { month: 'short', day: 'numeric', year: 'numeric' })}
        </label>
      )}
      {problem && rows.length > 0 && (
        <p className="form-error" role="alert">
          {problem}
        </p>
      )}
    </Dialog>
  );
}

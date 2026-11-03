import { ArrowRight, CalendarClock, CircleCheck, Undo2, X } from 'lucide-react';
import { useEffect } from 'react';
import { isConflict } from '../lib/matching';
import { href } from '../lib/router';
import { useStore, type Toast } from '../state/store';
import { STATE_META } from './ui';

function ToastItem({ toast }: { toast: Toast }) {
  const { state, dismissToast, changeSchedule, setFilters } = useStore();
  const hasChanges = !!toast.changes?.length;

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(toast.id), hasChanges ? 9000 : 5000);
    return () => window.clearTimeout(timer);
  }, [toast.id, hasChanges, dismissToast]);

  const Icon = toast.tone === 'success' ? CircleCheck : CalendarClock;
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.body && <p className="toast-body">{toast.body}</p>}
        {hasChanges && (
          <ul className="toast-changes">
            {toast.changes!.map((c) => {
              const job = state.jobs.find(j => j.id === c.jobId);
              if (!job) return null;
              const from = STATE_META[c.from];
              const to = STATE_META[c.to];
              return (
                <li key={c.jobId}>
                  <a
                    href={href(`/jobs/${c.jobId}`)}
                    onClick={() => {
                      dismissToast(toast.id);
                      // A job that now conflicts would be hidden; show conflicts so it stays in the list.
                      if (isConflict(c.to)) setFilters({ showConflicts: true });
                    }}
                  >
                    <strong>{job.role}</strong> · {job.business}
                  </a>
                  <span className="toast-change">
                    <span className={`tone-text-${from.tone}`}>{from.label}</span>
                    <ArrowRight size={14} aria-label="now" />
                    <span className={`tone-text-${to.tone}`}>
                      <to.Icon size={14} aria-hidden="true" /> {to.label}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {toast.undo && (
          <button
            type="button"
            className="btn btn-quiet btn-sm toast-undo"
            onClick={() => {
              dismissToast(toast.id);
              changeSchedule(toast.undo!, 'Change undone', { undoable: false });
            }}
          >
            <Undo2 size={16} aria-hidden="true" /> Undo
          </button>
        )}
      </div>
      <button type="button" className="icon-btn icon-btn-sm" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="toasts" aria-live="polite" aria-relevant="additions">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

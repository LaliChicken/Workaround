import { Car, CalendarX, CircleCheck, CircleDashed, CircleQuestionMark, CircleX, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { MatchState, ShiftStatus } from '../lib/types';

export type Tone = 'fit' | 'partial' | 'confirm' | 'conflict';

export const STATE_META: Record<MatchState, { label: string; tone: Tone; Icon: LucideIcon }> = {
  fits: { label: 'Fits your week', tone: 'fit', Icon: CircleCheck },
  optional: { label: 'Some optional shifts fit', tone: 'partial', Icon: CircleDashed },
  confirm: { label: 'Needs confirmation', tone: 'confirm', Icon: CircleQuestionMark },
  commute: { label: 'Commute conflict', tone: 'conflict', Icon: Car },
  conflict: { label: 'Schedule conflict', tone: 'conflict', Icon: CircleX },
};

export const SHIFT_META: Record<ShiftStatus, { label: string; tone: Tone; Icon: LucideIcon }> = {
  fits: { label: 'Fits', tone: 'fit', Icon: CircleCheck },
  commute: { label: 'Too little travel time', tone: 'conflict', Icon: Car },
  outside: { label: 'Outside your availability', tone: 'conflict', Icon: CalendarX },
  overlap: { label: 'Overlaps a commitment', tone: 'conflict', Icon: CircleX },
};

export function StatusBadge({ state, size = 'md' }: { state: MatchState; size?: 'sm' | 'md' | 'lg' }) {
  const { label, tone, Icon } = STATE_META[state];
  return (
    <span className={`badge badge-${tone} badge-${size}`}>
      <Icon aria-hidden="true" size={size === 'lg' ? 20 : 16} strokeWidth={2.25} />
      {label}
    </span>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <img className="logo-mark" src="./brand/workaround-mark.png" alt="Workaround" width={42} height={25} />
  ) : (
    <img className="logo" src="./brand/workaround-logo.png" alt="Workaround" width={186} height={30} />
  );
}

/**
 * Modal built on the native <dialog> element, which provides focus trapping,
 * Escape to close and an inert background without extra code.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${size}`}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog-inner">
          <header className="dialog-head">
            <div>
              <h2 id="dialog-title">{title}</h2>
              {description && <p className="dialog-desc">{description}</p>}
            </div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

export function DemoTag({ children = 'Demo' }: { children?: ReactNode }) {
  return <span className="demo-tag">{children}</span>;
}

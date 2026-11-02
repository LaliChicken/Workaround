import type { CSSProperties, MouseEvent } from 'react';
import { subtract } from '../lib/intervals';
import { bufferZones, workableWindows } from '../lib/matching';
import { DAYS, DAY_LONG, DAY_SHORT, formatHours, formatRange, formatTime } from '../lib/time';
import type { BlockKind, Day, Schedule, ScheduleBlock } from '../lib/types';

export const KIND_META: Record<BlockKind, { label: string; plural: string; hint: string }> = {
  class: { label: 'Class', plural: 'Classes', hint: 'Course meetings. Your commute buffer applies before and after.' },
  available: { label: 'Available to work', plural: 'Available to work', hint: 'Times you are willing to work. Nothing else counts as free.' },
  study: { label: 'Study time', plural: 'Study time', hint: 'Protected time for coursework.' },
  activity: { label: 'Activity', plural: 'Activities', hint: 'Clubs, sports, volunteering.' },
  other: { label: 'Other commitment', plural: 'Other commitments', hint: 'Family, caregiving, anything else.' },
};

export function blockLabel(b: ScheduleBlock): string {
  if (b.kind === 'available') return 'Available to work';
  if (b.kind === 'study') return b.title && b.title !== 'Study' ? b.title : 'Study time';
  return b.title || KIND_META[b.kind].label;
}

export function gridRange(blocks: { start: number; end: number }[]): { from: number; to: number } {
  const starts = blocks.map((b) => b.start);
  const ends = blocks.map((b) => b.end);
  const from = Math.min(8 * 60, ...starts.map((s) => Math.floor(s / 60) * 60));
  const to = Math.max(21 * 60, ...ends.map((e) => Math.ceil(e / 60) * 60));
  return { from, to };
}

const pos = (start: number, end: number, from: number) =>
  ({ '--top': (start - from) / 60, '--len': (end - start) / 60 }) as CSSProperties;

export function WeekGrid({
  schedule,
  onEdit,
  onAddAt,
}: {
  schedule: Schedule;
  onEdit: (block: ScheduleBlock) => void;
  onAddAt: (day: Day, start: number) => void;
}) {
  const { from, to } = gridRange(schedule.blocks);
  const hours: number[] = [];
  for (let m = from; m < to; m += 60) hours.push(m);

  const handleColumnClick = (day: Day) => (e: MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const hourH = rect.height / ((to - from) / 60);
    const slot = Math.floor(((e.clientY - rect.top) / hourH) * 2) * 30;
    onAddAt(day, Math.min(from + slot, to - 60));
  };

  return (
    <div className="week" style={{ '--hours': (to - from) / 60 } as CSSProperties}>
      <div className="week-head" aria-hidden="true">
        <div className="week-corner" />
        {DAYS.map((d) => {
          const minutes = workableWindows(schedule, d).reduce((s, w) => s + w.end - w.start, 0);
          return (
            <div key={d} className="week-day-head">
              <span className="week-day-name">{DAY_SHORT[d]}</span>
              <span className={`week-day-free${minutes ? '' : ' is-zero'}`}>{minutes ? `${formatHours(minutes)} to work` : 'Not available'}</span>
            </div>
          );
        })}
      </div>
      <div className="week-body">
        <div className="week-times" aria-hidden="true">
          {hours.map((h) => (
            <div key={h} className="week-time">
              {formatTime(h)}
            </div>
          ))}
        </div>
        {DAYS.map((day) => {
          const dayBlocks = schedule.blocks.filter((b) => b.day === day);
          const available = dayBlocks.filter((b) => b.kind === 'available').sort((a, b) => a.start - b.start);
          const commitments = dayBlocks.filter((b) => b.kind !== 'available').sort((a, b) => a.start - b.start);
          const buffers = subtract(bufferZones(schedule.blocks, day, schedule.bufferMinutes), commitments);
          const workable = workableWindows(schedule, day);
          // Offset each availability label to the first minute that is actually workable, so it
          // isn't hidden behind a class or travel buffer that overlaps the start of the block.
          const labelOffset = (b: ScheduleBlock) => {
            const first = workable.find((w) => w.start >= b.start && w.start < b.end);
            return first ? (first.start - b.start) / 60 : 0;
          };
          return (
            <section key={day} className="week-col" aria-label={DAY_LONG[day]}>
              <div className="week-col-hit" onClick={handleColumnClick(day)} />
              {available.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="blk blk-available"
                  style={{ ...pos(b.start, b.end, from), '--label-offset': labelOffset(b) } as CSSProperties}
                  onClick={() => onEdit(b)}
                  aria-label={`Available to work, ${DAY_LONG[day]} ${formatRange(b.start, b.end)}. Edit`}
                >
                  <span className="blk-title">Available</span>
                  <span className="blk-time">{formatRange(b.start, b.end)}</span>
                </button>
              ))}
              {buffers.map((z) => (
                <div key={`buf-${z.start}`} className="blk-buffer" style={pos(z.start, z.end, from)} aria-hidden="true">
                  {z.end - z.start >= 25 && <span>{z.end - z.start} min travel</span>}
                </div>
              ))}
              {commitments.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`blk blk-${b.kind}${b.end - b.start <= 60 ? ' is-short' : ''}`}
                  style={pos(b.start, b.end, from)}
                  onClick={() => onEdit(b)}
                  aria-label={`${KIND_META[b.kind].label}: ${blockLabel(b)}, ${DAY_LONG[day]} ${formatRange(b.start, b.end)}. Edit`}
                >
                  <span className="blk-title">{blockLabel(b)}</span>
                  <span className="blk-time">{formatRange(b.start, b.end)}</span>
                  {b.detail && b.end - b.start >= 105 && <span className="blk-detail">{b.detail}</span>}
                </button>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export function Legend() {
  return (
    <ul className="legend" aria-label="Calendar key">
      <li>
        <span className="swatch swatch-class" aria-hidden="true" /> Class
      </li>
      <li>
        <span className="swatch swatch-available" aria-hidden="true" /> Available to work
      </li>
      <li>
        <span className="swatch swatch-buffer" aria-hidden="true" /> Commute buffer
      </li>
      <li>
        <span className="swatch swatch-study" aria-hidden="true" /> Study time
      </li>
      <li>
        <span className="swatch swatch-activity" aria-hidden="true" /> Activity or other
      </li>
    </ul>
  );
}

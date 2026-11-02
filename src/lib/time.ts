import type { Day, Interval, Minutes } from './types';

export const DAYS: Day[] = [0, 1, 2, 3, 4, 5, 6];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export const toMinutes = (h: number, m = 0): Minutes => h * 60 + m;

function parts(t: Minutes) {
  const h24 = Math.floor(t / 60) % 24;
  const m = t % 60;
  const meridiem = h24 < 12 ? 'am' : 'pm';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { h12, m, meridiem };
}

/** "1 pm", "12:15 pm", "9:30 am". */
export function formatTime(t: Minutes): string {
  const { h12, m, meridiem } = parts(t);
  return `${h12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${meridiem}`;
}

/** Like formatTime but reads naturally inside a sentence ("noon", "midnight"). */
export function formatTimeWords(t: Minutes): string {
  if (t === 720) return 'noon';
  if (t % 1440 === 0) return 'midnight';
  return formatTime(t);
}

/** "1–5 pm", "10 am–noon", "12:15–4:15 pm". */
export function formatRange(start: Minutes, end: Minutes): string {
  const a = parts(start);
  const b = parts(end);
  const left = `${a.h12}${a.m ? `:${String(a.m).padStart(2, '0')}` : ''}`;
  if (end === 720) return `${formatTime(start)}–noon`;
  if (start === 720) return `noon–${formatTime(end)}`;
  return a.meridiem === b.meridiem ? `${left}–${formatTime(end)}` : `${formatTime(start)}–${formatTime(end)}`;
}

/** "Tue & Thu", "Mon, Wed & Fri". */
export function formatDayList(days: Day[], style: 'short' | 'long' = 'short'): string {
  const names = [...new Set(days)].sort((a, b) => a - b).map((d) => (style === 'short' ? DAY_SHORT[d] : DAY_LONG[d]));
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  const rounded = Math.round(h * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} hr${rounded === 1 ? '' : 's'}`;
}

export const duration = (i: Interval) => i.end - i.start;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
export function numberWord(n: number, capitalise = false): string {
  const w = n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
  return capitalise ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

/** Time options for selects, every 15 minutes between two hours. */
export function timeOptions(fromHour = 6, toHour = 23): Minutes[] {
  const out: Minutes[] = [];
  for (let t = fromHour * 60; t <= toHour * 60; t += 15) out.push(t);
  return out;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', opts);
}

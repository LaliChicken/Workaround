/** Monday = 0 … Sunday = 6. */
export type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Minutes since midnight, e.g. 13:30 → 810. */
export type Minutes = number;

export interface Interval {
  start: Minutes;
  end: Minutes;
}

export type BlockKind = 'class' | 'available' | 'study' | 'activity' | 'other';

export interface ScheduleBlock extends Interval {
  id: string;
  kind: BlockKind;
  day: Day;
  /** Course code for classes ("MATH 1B"), otherwise a short label. */
  title: string;
  /** Optional course name or note. Never shared with employers. */
  detail?: string;
}

export interface Schedule {
  blocks: ScheduleBlock[];
  /** Travel time needed between a class and a work shift, in minutes. */
  bufferMinutes: number;
  termName: string;
  /** ISO dates (yyyy-mm-dd). */
  termStart: string;
  termEnd: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type StudentStage = 'college' | 'dual-enrollment' | 'high-school';

/** 'unknown' means the student hasn't shared it; eligibility is then flagged, never assumed. */
export type AgeBand = 'under-16' | '16-17' | '18+' | 'unknown';

export type Category = 'food' | 'retail' | 'tutoring' | 'library' | 'recreation' | 'animals';

export interface Shift extends Interval {
  id: string;
  day: Day;
  /** Mandatory shifts must all fit. Optional shifts can be chosen from. */
  required: boolean;
}

/**
 * fixed    – the employer lists the exact weekly shifts.
 * choose   – the employer lets the student pick a subset of listed shifts.
 * variable – hours change week to week; shift times are not known in advance.
 */
export type HoursType = 'fixed' | 'choose' | 'variable';

export interface Job {
  id: string;
  role: string;
  business: string;
  category: Category;
  /** Approximate area, e.g. "Los Altos". */
  area: string;
  /** Approximate location of the fictional business, used for straight-line distance. */
  location: LatLng;
  /** Illustrative hourly pay in USD. */
  pay: { min: number; max?: number };
  hoursType: HoursType;
  shifts: Shift[];
  /** For "choose" jobs: the employer's stated weekly minimum. null = not stated. */
  minShifts?: number | null;
  /** For "variable" jobs. */
  variableHours?: { min: number; max: number; pattern: string };
  /** A required shift whose time the employer has not set, e.g. "one weekend evening shift". */
  pendingShift?: string;
  experience: 'none' | 'preferred' | 'required';
  experienceNote?: string;
  resume: 'required' | 'optional';
  summary: string;
  duties: string[];
  qualifications: string[];
  /** Minimum age the employer lists, if any. */
  minAge?: number;
  /** Other checks the employer completes (background check, food handler card …). */
  eligibility: string[];
  postedDaysAgo: number;
}

export type ShiftStatus = 'fits' | 'commute' | 'outside' | 'overlap';

export interface ShiftCheck {
  shift: Shift;
  status: ShiftStatus;
  /** Plain-language reason, most important first. */
  reasons: string[];
  /** The commitment the shift overlaps or crowds, when there is one. */
  blockerId?: string;
}

/**
 * fits      – every mandatory shift fits stated availability and the buffer.
 * optional  – the employer allows choosing shifts and at least the minimum fit.
 * confirm   – known shifts fit but some requirement is unknown.
 * commute   – a mandatory shift leaves too little travel time.
 * conflict  – a mandatory shift overlaps a commitment or falls outside availability.
 */
export type MatchState = 'fits' | 'optional' | 'confirm' | 'commute' | 'conflict';

export interface Match {
  jobId: string;
  state: MatchState;
  /** One plain-language sentence explaining the state. */
  summary: string;
  checks: ShiftCheck[];
  requiredTotal: number;
  requiredFit: number;
  optionalTotal: number;
  optionalFit: number;
}

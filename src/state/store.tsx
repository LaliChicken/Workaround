import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { JOBS } from '../data/jobs';
import { sampleSchedule } from '../data/sampleSchedule';
import { DEFAULT_FILTERS, type JobFilters } from '../lib/jobs';
import { evaluateAll, weeklyWindows } from '../lib/matching';
import { DAY_SHORT, formatRange } from '../lib/time';
import type { Category, Match, MatchState, Schedule } from '../lib/types';

export interface Profile {
  firstName: string;
  lastName: string;
  school: string;
  stage: 'college' | 'high-school';
  ageBand: '16-17' | '18+';
  /** Approximate search area; never a home address. */
  area: string;
  radiusMi: number;
  hoursMin: number;
  hoursMax: number;
  interests: Category[];
  experience: string;
  /** File name of an existing resume. The prototype never uploads files. */
  resumeName: string | null;
}

export type ApplicationStatus = 'submitted' | 'reviewing' | 'interview' | 'offer' | 'closed';

export interface Application {
  id: string;
  jobId: string;
  submittedAt: string;
  status: ApplicationStatus;
  closedReason?: string;
  /** Availability windows exactly as they were shared. */
  sharedWindows: string[];
  resumeAttached: boolean;
  note: string;
  stateAtSubmit: MatchState;
}

export interface AppState {
  version: 1;
  setupComplete: boolean;
  profile: Profile;
  schedule: Schedule;
  saved: string[];
  applications: Application[];
  filters: JobFilters;
}

export const DEMO_PROFILE: Profile = {
  firstName: 'Alex',
  lastName: 'Kim',
  school: 'Foothill College',
  stage: 'college',
  ageBand: '18+',
  area: 'Near Foothill College',
  radiusMi: 10,
  hoursMin: 8,
  hoursMax: 16,
  interests: ['food', 'tutoring', 'library'],
  experience: 'Volunteer math tutor at a community center for a year. Ran the register at a school fundraiser café.',
  resumeName: 'Alex_Kim_Resume.pdf',
};

export function initialState(): AppState {
  return {
    version: 1,
    setupComplete: false,
    profile: { ...DEMO_PROFILE },
    schedule: sampleSchedule(),
    saved: [],
    applications: [],
    filters: { ...DEFAULT_FILTERS },
  };
}

type Action =
  | { type: 'profile'; patch: Partial<Profile> }
  | { type: 'complete-setup'; schedule: Schedule }
  | { type: 'schedule'; schedule: Schedule }
  | { type: 'toggle-save'; jobId: string }
  | { type: 'apply'; application: Application }
  | { type: 'withdraw'; id: string }
  | { type: 'filters'; patch: Partial<JobFilters> }
  | { type: 'reset'; state: AppState };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'profile':
      return { ...state, profile: { ...state.profile, ...action.patch } };
    case 'complete-setup':
      return { ...state, setupComplete: true, schedule: action.schedule };
    case 'schedule':
      return { ...state, schedule: action.schedule };
    case 'toggle-save':
      return {
        ...state,
        saved: state.saved.includes(action.jobId) ? state.saved.filter((id) => id !== action.jobId) : [...state.saved, action.jobId],
      };
    case 'apply':
      return { ...state, applications: [action.application, ...state.applications.filter((a) => a.jobId !== action.application.jobId)] };
    case 'withdraw':
      return {
        ...state,
        applications: state.applications.map((a) => (a.id === action.id ? { ...a, status: 'closed', closedReason: 'You withdrew this application.' } : a)),
      };
    case 'filters':
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case 'reset':
      return action.state;
  }
}

const STORAGE_KEY = 'workaround-demo-v1';

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed?.version === 1 && parsed.schedule?.blocks && parsed.profile) {
        return { ...initialState(), ...parsed, filters: { ...DEFAULT_FILTERS, ...parsed.filters } };
      }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return initialState();
}

export interface MatchChange {
  jobId: string;
  from: MatchState;
  to: MatchState;
}

export interface Toast {
  id: number;
  tone: 'info' | 'success';
  title: string;
  body?: string;
  changes?: MatchChange[];
  undo?: Schedule;
}

interface Store {
  state: AppState;
  matches: Record<string, Match>;
  /** Jobs whose compatibility changed in the latest schedule edit. */
  recent: { ids: string[]; at: number };
  toasts: Toast[];
  updateProfile: (patch: Partial<Profile>) => void;
  completeSetup: (schedule: Schedule) => void;
  changeSchedule: (next: Schedule, message: string, opts?: { undoable?: boolean }) => void;
  toggleSave: (jobId: string) => void;
  apply: (jobId: string, opts: { resumeAttached: boolean; note: string }) => Application;
  withdraw: (id: string) => void;
  setFilters: (patch: Partial<JobFilters>) => void;
  reset: () => void;
  notify: (toast: Omit<Toast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<Store | null>(null);

/** Availability as an employer would see it, e.g. "Tue 12:30–7 pm". */
export function sharedAvailability(schedule: Schedule): string[] {
  return weeklyWindows(schedule).flatMap(({ day, windows }) => windows.map((w) => `${DAY_SHORT[day]} ${formatRange(w.start, w.end)}`));
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [recent, setRecent] = useState<{ ids: string[]; at: number }>({ ids: [], at: 0 });
  const toastId = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private mode or storage blocked: the demo still works in memory */
    }
  }, [state]);

  const matches = useMemo(() => evaluateAll(JOBS, state.schedule), [state.schedule]);
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  const notify = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = ++toastId.current;
    setToasts((ts) => [...ts.slice(-2), { ...toast, id }]);
  }, []);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const changeSchedule = useCallback<Store['changeSchedule']>(
    (next, message, opts = {}) => {
      const prev = stateRef.current.schedule;
      const before = matchesRef.current;
      const after = evaluateAll(JOBS, next);
      const changes: MatchChange[] = JOBS.filter((j) => before[j.id].state !== after[j.id].state).map((j) => ({
        jobId: j.id,
        from: before[j.id].state,
        to: after[j.id].state,
      }));
      dispatch({ type: 'schedule', schedule: next });
      setRecent({ ids: changes.map((c) => c.jobId), at: Date.now() });
      notify({
        tone: 'info',
        title: message,
        body: changes.length === 0 ? 'No job matches changed.' : undefined,
        changes,
        undo: opts.undoable === false ? undefined : prev,
      });
    },
    [notify],
  );

  const apply = useCallback<Store['apply']>((jobId, opts) => {
    const s = stateRef.current;
    const application: Application = {
      id: `app-${Date.now()}`,
      jobId,
      submittedAt: new Date().toISOString(),
      status: 'submitted',
      sharedWindows: sharedAvailability(s.schedule),
      resumeAttached: opts.resumeAttached,
      note: opts.note,
      stateAtSubmit: matchesRef.current[jobId].state,
    };
    dispatch({ type: 'apply', application });
    return application;
  }, []);

  const store = useMemo<Store>(
    () => ({
      state,
      matches,
      recent,
      toasts,
      updateProfile: (patch) => dispatch({ type: 'profile', patch }),
      completeSetup: (schedule) => dispatch({ type: 'complete-setup', schedule }),
      changeSchedule,
      toggleSave: (jobId) => dispatch({ type: 'toggle-save', jobId }),
      apply,
      withdraw: (id) => dispatch({ type: 'withdraw', id }),
      setFilters: (patch) => dispatch({ type: 'filters', patch }),
      reset: () => {
        setToasts([]);
        setRecent({ ids: [], at: 0 });
        dispatch({ type: 'reset', state: initialState() });
      },
      notify,
      dismissToast,
    }),
    [state, matches, recent, toasts, changeSchedule, apply, notify, dismissToast],
  );

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

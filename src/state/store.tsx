import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_AREA_ID, SEARCH_AREAS } from '../data/areas';
import { DEFAULT_BUSINESS, fixtureApplications, initialJobs } from '../data/employer';
import { applicationSnapshot, legacySnapshot, publishedJobs, validateJob, type ApplicationSnapshot, type BusinessProfile } from '../lib/employer';
import type { Job } from '../lib/types';
import { sampleSchedule } from '../data/sampleSchedule';
import { DEFAULT_FILTERS, type JobFilters } from '../lib/jobs';
import { evaluateAll, weeklyWindows } from '../lib/matching';
import { DAY_SHORT, formatRange } from '../lib/time';
import { normaliseUpcoming } from '../lib/upcoming';
import type { AgeBand, Category, Match, MatchState, Schedule, StudentStage } from '../lib/types';

export interface Profile {
  firstName: string;
  lastName: string;
  school: string;
  stage: StudentStage;
  /** Asked separately from stage: dual-enrollment and younger college students exist. */
  ageBand: AgeBand;
  /** Approximate search area (see data/areas.ts); never a home address. */
  areaId: string;
  /** The single distance setting: drives job results and the Jobs distance filter. */
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
  applicantId: string;
  source: 'fixture' | 'browser';
  snapshot: ApplicationSnapshot;
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
  version: 2;
  jobs: Job[];
  business: BusinessProfile;
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
  areaId: DEFAULT_AREA_ID,
  radiusMi: 10,
  hoursMin: 8,
  hoursMax: 16,
  interests: ['food', 'tutoring', 'library'],
  experience: 'Volunteer math tutor at a community center for a year. Ran the register at a school fundraiser café.',
  resumeName: 'Alex_Kim_Resume.pdf',
};

export function initialState(): AppState {
  return {
    version: 2,
    jobs: initialJobs(),
    business: { ...DEFAULT_BUSINESS },
    setupComplete: false,
    profile: { ...DEMO_PROFILE },
    schedule: sampleSchedule(),
    saved: [],
    applications: fixtureApplications(),
    filters: { ...DEFAULT_FILTERS },
  };
}

export type Action =
  | { type: 'save-job'; job: Job }
  | { type: 'business'; business: BusinessProfile }
  | { type: 'status'; id: string; status: ApplicationStatus }
  | { type: 'share-availability'; id: string }
  | { type: 'profile'; patch: Partial<Profile> }
  | { type: 'complete-setup'; schedule: Schedule }
  | { type: 'schedule'; schedule: Schedule }
  | { type: 'toggle-save'; jobId: string }
  | { type: 'apply'; application: Application }
  | { type: 'withdraw'; id: string }
  | { type: 'filters'; patch: Partial<JobFilters> }
  | { type: 'reset'; state: AppState };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'save-job':
      if (action.job.publication === 'published' && validateJob(action.job).length) return state;
      return {
        ...state,
        jobs: state.jobs.some((j) => j.id === action.job.id)
          ? state.jobs.map((j) => (j.id === action.job.id ? structuredClone(action.job) : j))
          : [...state.jobs, structuredClone(action.job)],
      };
    case 'business':
      return { ...state, business: { ...action.business } };
    case 'status':
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === action.id
            ? { ...a, status: action.status, closedReason: action.status === 'closed' ? 'Closed in the employer demo.' : undefined }
            : a,
        ),
      };
    case 'share-availability':
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === action.id && a.source === 'browser'
            ? {
                ...a,
                snapshot: { ...a.snapshot, windows: applicationSnapshot(state.profile, state.schedule, false).windows, complete: true },
                sharedWindows: sharedAvailability(state.schedule),
              }
            : a,
        ),
      };

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
      return {
        ...state,
        applications: [
          action.application,
          ...state.applications.filter((a) => a.jobId !== action.application.jobId || a.applicantId !== action.application.applicantId),
        ],
      };
    case 'withdraw':
      return {
        ...state,
        applications: state.applications.map((a) =>
          a.id === action.id ? { ...a, status: 'closed', closedReason: 'You withdrew this application.' } : a,
        ),
      };
    case 'filters':
      return { ...state, filters: { ...state.filters, ...action.patch } };
    case 'reset':
      return action.state;
  }
}

const STORAGE_KEY = 'workaround-demo-v1';

const STAGES: StudentStage[] = ['college', 'dual-enrollment', 'high-school'];
const AGE_BANDS: AgeBand[] = ['under-16', '16-17', '18+', 'unknown'];

/** Brings profiles saved by earlier versions of the prototype up to date. */
export function normaliseProfile(saved: Partial<Profile> & { area?: unknown }): Profile {
  const p: Profile = { ...DEMO_PROFILE, ...saved };
  delete (p as { area?: unknown }).area;
  if (!STAGES.includes(p.stage)) p.stage = 'college';
  if (!AGE_BANDS.includes(p.ageBand)) p.ageBand = 'unknown';
  if (!SEARCH_AREAS.some((a) => a.id === p.areaId)) p.areaId = DEFAULT_AREA_ID;
  if (!(p.radiusMi > 0)) p.radiusMi = DEMO_PROFILE.radiusMi;
  return p;
}

function normaliseFilters(saved: Partial<JobFilters> | undefined): JobFilters {
  const f: JobFilters = { ...DEFAULT_FILTERS };
  for (const key of Object.keys(DEFAULT_FILTERS) as (keyof JobFilters)[]) {
    if (saved && saved[key] !== undefined) (f as unknown as Record<string, unknown>)[key] = saved[key];
  }
  return f;
}

export function normaliseState(saved: unknown): AppState {
  const parsed = saved as Partial<AppState> & { version?: number };
  if (!parsed || ![1, 2].includes(parsed.version ?? 0) || !Array.isArray(parsed.schedule?.blocks) || !parsed.profile) return initialState();
  const base = initialState();
  const applications = (Array.isArray(parsed.applications) ? parsed.applications : []).map((a) => ({
    ...a,
    applicantId: a.applicantId ?? 'browser-student',
    source: a.source ?? 'browser',
    snapshot: a.snapshot ?? legacySnapshot(),
  }));
  return {
    ...base,
    ...parsed,
    version: 2,
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : base.jobs,
    business: parsed.business ?? base.business,
    applications: [...applications, ...base.applications.filter((a) => !applications.some((old) => old.id === a.id))],
    profile: normaliseProfile(parsed.profile),
    schedule: { ...parsed.schedule, upcoming: normaliseUpcoming(parsed.schedule?.upcoming) } as Schedule,
    filters: normaliseFilters(parsed.filters),
  };
}

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      return normaliseState(parsed);
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
  saveJob: (job: Job) => void;
  updateBusiness: (business: BusinessProfile) => void;
  updateStatus: (id: string, status: ApplicationStatus) => void;
  shareAvailability: (id: string) => void;

  state: AppState;
  matches: Record<string, Match>;
  /** Jobs whose compatibility changed in the latest schedule edit. */
  recent: { ids: string[]; at: number };
  toasts: Toast[];
  updateProfile: (patch: Partial<Profile>) => void;
  completeSetup: (schedule: Schedule) => void;
  changeSchedule: (next: Schedule, message: string, opts?: { undoable?: boolean; body?: string }) => void;
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

  const matches = useMemo(() => evaluateAll(state.jobs, state.schedule), [state.jobs, state.schedule]);
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
      const jobs = publishedJobs(stateRef.current.jobs);
      const after = evaluateAll(jobs, next);
      const changes: MatchChange[] = jobs
        .filter((j) => before[j.id].state !== after[j.id].state)
        .map((j) => ({
          jobId: j.id,
          from: before[j.id].state,
          to: after[j.id].state,
        }));
      dispatch({ type: 'schedule', schedule: next });
      setRecent({ ids: changes.map((c) => c.jobId), at: Date.now() });
      notify({
        tone: 'info',
        title: message,
        body: opts.body ?? (changes.length === 0 ? 'No job matches changed.' : undefined),
        changes,
        undo: opts.undoable === false ? undefined : prev,
      });
    },
    [notify],
  );

  const apply = useCallback<Store['apply']>((jobId, opts) => {
    const s = stateRef.current;
    if (!publishedJobs(s.jobs).some((j) => j.id === jobId)) throw new Error('This opening is not published.');
    const application: Application = {
      id: `app-${crypto.randomUUID()}`,
      applicantId: 'browser-student',
      source: 'browser',
      snapshot: applicationSnapshot(s.profile, s.schedule, opts.resumeAttached),
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
      saveJob: (job) => dispatch({ type: 'save-job', job }),
      updateBusiness: (business) => dispatch({ type: 'business', business }),
      updateStatus: (id, status) => dispatch({ type: 'status', id, status }),
      shareAvailability: (id) => dispatch({ type: 'share-availability', id }),
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

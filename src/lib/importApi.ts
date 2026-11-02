import type { ScheduleExtraction } from '../../server/scheduleSchema';

/** Talks to the local /api/schedule-import endpoint (see server/vitePlugin.ts). */

export interface ImportStatus {
  configured: boolean;
  /** False when no endpoint answered at all (e.g. a static build with no server). */
  reachable: boolean;
  /** Why upload can't be used right now (from the server), or null. */
  message: string | null;
  /** Hosted sites ask for a team passcode before upload works. */
  passcodeRequired: boolean;
  /** Whether the saved/entered passcode is right (null when none is required). */
  passcodeOk: boolean | null;
  /** Largest file the server accepts. */
  maxBytes: number;
}

const PASSCODE_HEADER = 'x-team-passcode';
const PASSCODE_KEY = 'workaround-team-passcode';
const DEFAULT_MAX = 10 * 1024 * 1024;

/** The team passcode is kept only in this browser, so teammates enter it once. */
export function savedPasscode(): string | null {
  try {
    return window.localStorage.getItem(PASSCODE_KEY);
  } catch {
    return null;
  }
}

export function savePasscode(code: string | null) {
  try {
    if (code) window.localStorage.setItem(PASSCODE_KEY, code);
    else window.localStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* storage blocked: the passcode just won't be remembered */
  }
}

const offline = (message: string | null): ImportStatus => ({
  configured: false,
  reachable: false,
  message,
  passcodeRequired: false,
  passcodeOk: null,
  maxBytes: DEFAULT_MAX,
});

export class ImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

/** True for the shared GitHub Pages build, which has no upload server. */
export const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === 'true';

export async function getImportStatus(passcode: string | null = savedPasscode()): Promise<ImportStatus> {
  if (STATIC_DEMO) {
    return offline(
      'Upload is off on this GitHub Pages link: reading schedules needs a server that keeps the API key private. Use the team’s Vercel link for AI upload, or the sample schedule here.',
    );
  }
  try {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (passcode) headers[PASSCODE_HEADER] = passcode;
    const res = await fetch('/api/schedule-import/status', { headers });
    if (res.status === 429) {
      const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
      return { ...offline(body?.error?.message ?? 'Too many attempts. Wait a few minutes and try again.'), reachable: true };
    }
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return offline(null);
    const body = (await res.json()) as Partial<ImportStatus>;
    return {
      configured: !!body.configured,
      reachable: true,
      message: body.message ?? null,
      passcodeRequired: !!body.passcodeRequired,
      passcodeOk: body.passcodeOk ?? null,
      maxBytes: body.maxBytes ?? DEFAULT_MAX,
    };
  } catch {
    return offline(null);
  }
}

const MAX_EDGE = 1600;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function detectType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'image/heic';
  return '';
}

/**
 * Validates the file and shrinks large photos before upload: smaller files
 * upload faster and cost fewer tokens, and schedules stay legible at 1600 px.
 */
export async function prepareFile(file: File): Promise<{ body: Blob; type: string }> {
  const type = detectType(file);
  if (type === 'image/heic' || type === 'image/heif') {
    throw new ImportError('unsupported_type', 'iPhone HEIC photos can’t be read here. Take a screenshot instead, or save the photo as JPEG.');
  }
  if (type === 'application/pdf') return { body: file, type };
  if (!IMAGE_TYPES.includes(type)) throw new ImportError('unsupported_type', 'Upload a PDF or a photo/screenshot (PNG, JPEG, WEBP or GIF).');

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3 * 1024 * 1024) {
      bitmap.close();
      return { body: file, type };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return { body: file, type };
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    return blob ? { body: blob, type: 'image/jpeg' } : { body: file, type };
  } catch {
    // If the browser can't decode it, let the server decide.
    return { body: file, type };
  }
}

export async function readSchedule(file: File, signal?: AbortSignal, maxBytes = DEFAULT_MAX): Promise<ScheduleExtraction> {
  const { body, type } = await prepareFile(file);
  if (body.size > maxBytes) {
    throw new ImportError('too_large', `That file is over ${Math.round(maxBytes / (1024 * 1024))} MB. Try a screenshot or just the page with your weekly classes.`);
  }
  const headers: Record<string, string> = { 'content-type': type };
  const passcode = savedPasscode();
  if (passcode) headers[PASSCODE_HEADER] = passcode;
  let res: Response;
  try {
    res = await fetch('/api/schedule-import', { method: 'POST', headers, body, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ImportError('network', 'Couldn’t reach the schedule reader. Check your connection (or, locally, that `npm run dev` is running).');
  }
  const payload = (await res.json().catch(() => null)) as { extraction?: ScheduleExtraction; error?: { code: string; message: string } } | null;
  if (!res.ok || !payload?.extraction) {
    throw new ImportError(payload?.error?.code ?? 'unexpected', payload?.error?.message ?? `The upload failed (${res.status}). Try again.`);
  }
  return payload.extraction;
}

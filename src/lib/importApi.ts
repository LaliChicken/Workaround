import type { ScheduleExtraction } from '../../server/scheduleSchema';

/** Talks to the local /api/schedule-import endpoint (see server/vitePlugin.ts). */

export interface ImportStatus {
  configured: boolean;
  /** False when no endpoint answered at all (e.g. a static build with no server). */
  reachable: boolean;
}

export class ImportError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export async function getImportStatus(): Promise<ImportStatus> {
  try {
    const res = await fetch('/api/schedule-import/status', { headers: { accept: 'application/json' } });
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { configured: false, reachable: false };
    const body = (await res.json()) as { configured?: boolean };
    return { configured: !!body.configured, reachable: true };
  } catch {
    return { configured: false, reachable: false };
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

export async function readSchedule(file: File, signal?: AbortSignal): Promise<ScheduleExtraction> {
  const { body, type } = await prepareFile(file);
  let res: Response;
  try {
    res = await fetch('/api/schedule-import', { method: 'POST', headers: { 'content-type': type }, body, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ImportError('network', 'Couldn’t reach the schedule reader. Check that the app is running with `npm run dev`.');
  }
  const payload = (await res.json().catch(() => null)) as { extraction?: ScheduleExtraction; error?: { code: string; message: string } } | null;
  if (!res.ok || !payload?.extraction) {
    throw new ImportError(payload?.error?.code ?? 'unexpected', payload?.error?.message ?? `The upload failed (${res.status}). Try again.`);
  }
  return payload.extraction;
}

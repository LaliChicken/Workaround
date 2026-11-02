import * as z from 'zod/v4';

/**
 * The JSON shape the model must return when reading a class schedule.
 * Every field is required (nullable where a value may be missing) so the
 * output can be validated strictly. The client imports only the type.
 */
export const DAY_CODES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const Meeting = z.object({
  days: z.array(z.enum(DAY_CODES)).describe('Days of the week this meeting repeats on.'),
  start_time: z.string().describe('Start time, 24-hour HH:MM, exactly as printed (e.g. "09:30").'),
  end_time: z.string().describe('End time, 24-hour HH:MM, exactly as printed (e.g. "11:20").'),
  location: z.string().nullable().describe('Room or building if shown, otherwise null.'),
});

const ClassEntry = z.object({
  course_code: z.string().describe('Course code as printed, e.g. "MATH 1B" or "ENGL 1A".'),
  title: z.string().nullable().describe('Course title if shown, e.g. "Calculus II".'),
  meetings: z.array(Meeting).describe('Weekly meetings: lecture, lab, discussion. Empty if the class has no set weekly time.'),
  unscheduled_reason: z
    .string()
    .nullable()
    .describe('Why there is no weekly meeting time (e.g. "Online, no set meeting time", "Times TBA"), otherwise null.'),
  confidence: z.enum(['high', 'low']).describe('"low" if any day or time for this class was hard to read or guessed.'),
  note: z.string().nullable().describe('Short note about anything the student should check, otherwise null.'),
});

export const ScheduleExtractionSchema = z.object({
  is_schedule: z.boolean().describe('False if the file is not a class schedule or timetable.'),
  term: z.object({
    name: z.string().nullable().describe('Term name if shown, e.g. "Fall Quarter 2026".'),
    start_date: z.string().nullable().describe('First day of term as YYYY-MM-DD, only if printed with a year.'),
    end_date: z.string().nullable().describe('Last day of term as YYYY-MM-DD, only if printed with a year.'),
  }),
  classes: z.array(ClassEntry),
  warnings: z.array(z.string()).describe('Anything left out or uncertain, e.g. final exam times that were skipped.'),
});

export type ScheduleExtraction = z.infer<typeof ScheduleExtractionSchema>;
export type ExtractedClass = ScheduleExtraction['classes'][number];
export type DayCode = (typeof DAY_CODES)[number];

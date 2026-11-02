# Workaround

**Work that fits around class.** A student-facing prototype for the round-two video: students see which jobs fit their real weekly availability, and why, before they apply.

> Demo prototype. Every opening, business, pay rate and application in this app is fictional. Applications are simulated and never sent anywhere.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # matching-engine tests (includes the video scenario)
npm run build      # static site in dist/
npm run preview    # serve dist/ locally
```

`dist/` is a plain static site with hash routes and relative paths, so it works from any static host or sub-folder. Nothing has been deployed.

## What's in the first build

| Screen | What it does |
| --- | --- |
| **Setup** | School, student stage (with an age band only for high school students, and why it's asked), approximate search area (no home address), weekly hours, optional interests. Start from a sample timetable, the import flow, or an empty week. |
| **My Schedule** | Editable weekly grid with classes, explicit **Available to work** blocks, study time, activities and other commitments. Commute buffer (0–60 min), term dates, a list view as the accessible alternative to the grid, live match counts, and **What employers see**: availability windows only, never class details. Every edit shows which jobs changed, with Undo. |
| **Jobs** | "Jobs that fit your week", an availability summary with Edit schedule, filters (pay, distance, category, desired hours, no experience), compatible openings by default, a **Show conflicts** toggle, and Saved jobs. Desktop shows the list beside the details; mobile shows the list, then a full detail page. |
| **Job details** | Duties, qualifications, pay, fixed/choose/variable hours, a mini week with each proposed shift over your classes, buffers and availability, a plain-language reason for every shift, and eligibility the employer confirms. |
| **Apply (demo)** | Shows exactly what would be shared before you submit, warns if the job conflicts, and marks the submission clearly as simulated. |
| **Applications** | Status tracker (Submitted, Employer reviewing, Interview, Offer). It stays at Submitted because no employer is involved. Flags it if your schedule changed after applying. Withdraw closes it. |
| **Profile** | Profile fields, a sample existing resume, and a designed empty state for verified work feedback: "No verified work history yet". |

## Recording the 45-second student demo

Record in Chrome at **1440×900**, or at **125% zoom on a 1920×1080 screen**, so labels stay readable.

**Before every take:** select **Reset demo** in the top banner, then **Use a sample timetable** and **Confirm and continue**. That lands on My Schedule with the sample week.

| Time | Do this | Say / show |
| --- | --- | --- |
| 0:25 | Stay on **My Schedule** | Alex's Tuesday/Thursday calculus ends at noon. Green is time Alex chose to work. Yellow stripes are the 30-minute commute buffer. |
| 0:32 | Click **Jobs** | *Barista, Hillside Bean Café* is selected: **Fits your week**. The mini week shows class, then buffer, then the 1–5 pm shift. |
| 0:40 | Turn on **Show conflicts**, click *Café counter staff* | **Commute conflict**: "Your Tuesday MATH 1B class ends at noon. With your 30-minute buffer, you can start at 12:30 pm, but this shift starts at 12:15 pm." |
| 0:48 | **My Schedule**, click Thursday's *MATH 1B*, set **Ends** to 2 pm, **Save** | The notification shows Barista changing from *Fits your week* to *Schedule conflict*. |
| 0:56 | Click **Undo** in the notification (or set Ends back to 12 pm) | Barista fits again. |
| 1:00 | **Jobs**, then *Barista*, then **Apply (demo)** | The employer sees availability windows, not your class timetable. **Submit demo application.** |
| 1:07 | **View in Applications** | *Submitted (demo)*, with an honest next step. |

The same scenario is covered by automated tests in `src/lib/matching.test.ts`, so a change to data or rules that would break the video fails `npm test`.

## How matching works

Rules live in `src/lib/matching.ts` and are deliberately simple enough to explain on screen:

1. Work can only happen inside time the student marked **Available to work**. Unmarked time is never assumed to be free.
2. Classes, study time, activities and other commitments always override availability.
3. The commute buffer applies before and after every class.
4. A job **fits** only when *every* required shift fits. One fitting shift never makes a role compatible.
5. Unknown requirements (variable hours, a shift with no set time) are **Needs confirmation**, never a match.
6. When the employer lets students pick shifts, the result is **Some optional shifts fit**, with the employer's minimum if stated.

| State | Meaning |
| --- | --- |
| Fits your week | All required shifts fit availability and the buffer |
| Commute conflict | A required shift leaves too little travel time |
| Schedule conflict | A required shift overlaps a commitment or falls outside availability |
| Needs confirmation | Requirements or hours are incomplete |
| Some optional shifts fit | The employer allows choosing; enough optional shifts fit |

There are no percentage scores. Compatibility is shown as a schedule check, not a guarantee of hiring, travel time or legal eligibility. A randomised test checks that every per-shift explanation agrees with the availability windows shown to employers.

## Real vs. simulated

- **Real:** schedule editing, commute buffer, compatibility logic and explanations, filters, saved jobs, and the application review screen. State is kept in this browser's local storage.
- **Simulated:** job openings, businesses and pay (fictional); application submission (nothing is sent); the existing resume (a sample file name).
- **Not built:** parsing an arbitrary schedule PDF or image. The import dialog says so and uses a sample Foothill schedule to show the confirmation step. Also not built: real accounts, employer postings, messaging, payments and the full verified-rating lifecycle.

## Project layout

```
src/
  lib/          matching engine, intervals, time formatting, job helpers, router (+ tests)
  data/         sample student week and fictional openings
  state/        app state, local-storage persistence, schedule-change notifications
  components/   week grid, block editor, import, job card/detail, mini week, apply dialog
  views/        Setup, My Schedule, Jobs, Applications, Profile
  styles/       design tokens and styles (colours sampled from the logo)
public/brand/   logo and mark (transparent PNGs cut from the supplied logo)
brand/          original logo file and a large mark
```

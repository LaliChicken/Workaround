# Workaround

**Work that fits around class.** A student-facing prototype for the round-two video: students see which jobs fit their real weekly availability, and why, before they apply.

> Demo prototype. Every opening, business, pay rate and application in this app is fictional. Applications are simulated and never sent anywhere.

## Run it

Requires Node 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # matching, import and endpoint tests (includes the video scenario)
npm run build      # static site in dist/
npm run preview    # build, then serve the result locally (schedule upload works here too)
```

Everything works without an API key except reading uploaded schedules (see below). `dist/` is a static site with hash routes and relative paths. Nothing has been deployed.

## Shared demo link (GitHub Pages)

**https://lalichicken.github.io/Workaround/** rebuilds and publishes automatically on every push to `main` (`.github/workflows/deploy-pages.yml` runs the tests, then builds). It usually updates within a couple of minutes; see the repo's **Actions** tab.

- Everything works on the link **except schedule upload**, which needs a server with an API key. The upload box says so and offers the sample schedule. No API key is used in the workflow or shipped to the site.
- Each person's demo state (schedule edits, applications) stays in their own browser. **Reset demo** starts over.
- The page asks search engines not to index it.
- **One-time setup (repo owner):** Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Schedule upload (AI)

Students can upload a **PDF, screenshot or photo** of their class schedule. Claude Haiku 5.5 (`claude-haiku-5-5`, Anthropic's lowest-cost current model) reads the class meetings into strict JSON. The student then checks every row and chooses when they're willing to work. Nothing is used for matching until they confirm.

**Turn it on (one-time, per computer):**

1. Create an API key at [console.anthropic.com](https://console.anthropic.com/) and add a small amount of credit.
2. Copy `.env.example` to `.env.local` and paste the key: `ANTHROPIC_API_KEY=sk-ant-...`
3. Restart `npm run dev` (or `npm run preview`).

`.env.local` is git-ignored. The key is used only by the local endpoint in `server/` and is never sent to the browser. Without a key, the upload area explains that reading isn't set up, and **Use sample Foothill schedule** still works.

- **Try it:** upload `public/demo/sample-class-schedule.pdf` (fictional). It includes an online class and final exams, which are listed separately rather than added to the week.
- **Cost:** Haiku 5.5 is $0.10 per million input tokens and $0.50 per million output tokens. A one-page schedule is a few thousand tokens, so roughly a tenth of a cent per upload (an estimate; the endpoint returns the actual `usage`).
- **Privacy:** the file goes to Anthropic's API to be read. Workaround doesn't store or log it. Only availability windows, never class details, are shown to employers.
- **Limits:** PDF, PNG, JPEG, WEBP or GIF up to 10 MB. Large photos are downscaled in the browser first. iPhone HEIC photos must be saved as JPEG or screenshotted. The endpoint allows 20 uploads per 10 minutes per computer.
- **Accuracy:** uncertain rows are highlighted with "Check this", and times are never guessed. Students always confirm before matching.

### If upload isn't working

1. **Read the terminal** where `npm run dev` is running. On start it prints either `✓ Schedule upload is ON` or `✗ Schedule upload is OFF` with the reason (no file, empty key, wrong name, wrong folder, key rejected by Anthropic, model not available to the key). The upload box in the app shows the same reason.
2. **After pulling new code, run `npm install`.** New packages were added for this feature. `npm run dev` now stops with a clear message if any are missing or if Node is older than 20.19.
3. **`.env.local` goes next to `package.json`**, named exactly `.env.local` (watch for a hidden `.txt` ending on Windows), with the key on one line: `ANTHROPIC_API_KEY=sk-ant-...`. Files saved as UTF-16 or with a BOM (PowerShell, Notepad) are fine now.
4. **Restart** `npm run dev` after editing `.env.local`.
5. **`npm run preview` showed 404 for every page** because it serves the last build and there wasn't one. It now builds first.

## What's in the first build

| Screen | What it does |
| --- | --- |
| **Setup** | School, student type (college, dual enrollment or high school), age band asked of everyone (with why), approximate search area from a preset list (no home address), radius, weekly hours, optional interests. Start from a sample timetable, an uploaded schedule, or an empty week. |
| **My Schedule** | Editable weekly grid with classes, explicit **Available to work** blocks, study time, activities and other commitments. Upload or sample import with a review step, **Set when you can work** for the whole week, commute buffer (0–60 min), term dates, a list view as the accessible alternative to the grid, live match counts, and **What employers see**: availability windows only, never class details. Every edit shows which jobs changed, with Undo. |
| **Jobs** | "Jobs that fit your week", an availability summary with Edit schedule, filters (distance from your area, pay, category, desired hours, no experience), compatible openings by default, a **Show conflicts** toggle, and Saved jobs. The open job always matches the list: if filters hide it, the next one opens, and a link to a hidden job explains why it isn't listed. Desktop shows the list beside the details; mobile shows the list, then a full detail page. |
| **Job details** | Duties, qualifications, pay, fixed/choose/variable hours, approximate distance from your area, a mini week with each proposed shift over your classes, buffers and availability, a plain-language reason for every shift, and age/eligibility notes (flagged when your age isn't shared; always confirmed by the employer). |
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

**Optional upload beat** (needs an API key; adds about 10 seconds): from setup choose **Upload my schedule** and drop in `public/demo/sample-class-schedule.pdf`. Show the classes it found and the "Not added" online class, then **Confirm classes** and **Save my week**. The upload path uses the student's own availability choices, so the job list can differ slightly from the sample week. Record the main scenario from the sample timetable.

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

- **Real:** reading uploaded schedules (when an API key is set, always confirmed by the student), schedule editing, commute buffer, compatibility logic and explanations, filters and distances, saved jobs, and the application review screen. State is kept in this browser's local storage.
- **Simulated:** job openings, businesses, locations and pay (fictional); application submission (nothing is sent); the existing resume (a sample file name). Distances are straight-line estimates from a preset area, not travel time.
- **Not built:** real accounts, employer postings, messaging, payments, hosting the upload endpoint publicly, and the full verified-rating lifecycle.

## Project layout

```
server/         schedule-reading endpoint: Haiku 5.5 parser, JSON schema, request handler, Vite plugin (+ tests)
src/
  lib/          matching, eligibility, distances, import normalisation, time, router (+ tests)
  data/         sample student week, fictional openings, preset search areas
  state/        app state, local-storage persistence, schedule-change notifications
  components/   week grid, block editor, import, job card/detail, mini week, apply dialog
  views/        Setup, My Schedule, Jobs, Applications, Profile
  styles/       design tokens and styles (colours sampled from the logo)
public/brand/   logo and mark (transparent PNGs cut from the supplied logo)
public/demo/    fictional sample schedule PDF for trying the upload
brand/          original logo file and a large mark
```

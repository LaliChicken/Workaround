# AGENTS.md — Workaround Employer Experience

## Purpose and scope
Use this brief when designing or implementing the employer side of Workaround. The current user request determines whether the task is planning, design, implementation, or deployment; the existence of this file alone does not request a deployment.

Workaround connects students with jobs whose actual shifts fit their availability. Build the employer experience around this question:

**Who can work the hours this business needs, and what still needs confirming?**

The student app already exists. Extend it into a coherent two-sided prototype. Preserve its working timetable, import review, matching explanations, application flow, and visual identity.

## Read before changing code
Inspect the current checkout, not just this brief:
- `README.md`: current setup, supported features, demo limitations.
- `src/App.tsx`, `src/lib/router.ts`: application shell, hash routes, setup redirects.
- `src/state/store.tsx`: local persistence, profile, applications, schedule-change notifications.
- `src/lib/types.ts`, `src/lib/matching.ts`, `src/lib/intervals.ts`: job/shift schema and compatibility rules.
- `src/lib/jobs.ts`, `src/lib/geo.ts`, `src/lib/eligibility.ts`: filtering, distances, and eligibility notices.
- `src/data/jobs.ts`, `src/data/areas.ts`, `src/data/sampleSchedule.ts`: existing demo data.
- `src/components/ui.tsx`, `src/components/MiniWeek.tsx`, `src/styles/app.css`: reusable components and design language.
- `src/components/ApplyDialog.tsx`, `src/views/ApplicationsView.tsx`: what students share and what statuses they see.

`CLAUDE.md` contains an earlier planning brief. Reconcile historical statements with current code and the latest user instructions. For example, schedule-upload support now exists.

## Product priorities
Implement one complete employer workflow before expanding the dashboard:
1. Describe a role and its actual shift requirements.
2. Preview and publish a fictional demo opening.
3. Receive demo applications.
4. Inspect shared availability against the required shifts.
5. Make a deliberate, human-controlled application-status update.
6. Show that update in the student's demo application view.

Build schedule clarity and useful actions first. Avoid decorative analytics, invented placement statistics, AI interviewers, resume generation, or an unrelated workforce-management suite.

## Employer audience and default scenario
Design for a busy owner or manager of a local cafe, shop, tutoring centre, or similar business. They may have one location and no dedicated recruiter.

Use Hillside Bean Cafe as the initial fictional business, retaining the existing branded spelling in data. Keep existing student-demo openings stable.

The initial employer can manage:
- An existing Barista opening with mandatory Tuesday/Thursday 1–5 pm shifts.
- A draft opening that demonstrates editing required shifts.

Use fictional applicants. Include:
- One whose shared availability covers every required shift.
- One who can cover only one required shift.
- One whose availability is incomplete and needs confirmation.
- A first-time worker with no verified work feedback.

Make it explicit that applicants are fixtures or have applied in the current browser's demo. Do not imply access to a real student network.

## Information architecture
Employer navigation: **Jobs**, **Applicants**, **Business profile**.

Jobs is the primary landing screen. Add an overview only if it helps users take a concrete action.

Suggested hash routes:
- `#/employer/jobs`
- `#/employer/jobs/new`
- `#/employer/jobs/:jobId`
- `#/employer/jobs/:jobId/edit`
- `#/employer/applicants`
- `#/employer/applicants/:applicationId`
- `#/employer/profile`

Extend the existing router. Employer routes must open without forcing student onboarding. Provide a clearly labelled Student demo / Employer demo switch that preserves both experiences' state. This switch is demo navigation, not authentication or access control.

## Screen requirements

### Jobs
Show actionable openings, with:
- Role, location, advertised pay, and published/draft/paused/closed state.
- Required days and times.
- Applicant count and clearly defined compatibility counts.
- Actions to create, edit, preview, pause, or close an opening.

Use "3 applicants fit all required shifts" rather than "Shifts filled". Applicant compatibility does not mean someone has accepted a job or been scheduled.

Derive counts from actual demo state. Provide useful empty states and a clear New job action.

### Create or edit a job
Use a short form organised into Role, Hours, and Preview sections. Reuse controls where appropriate.

Collect:
- Job title, category, location, summary, duties, and essential qualifications.
- Hourly pay or range, with numeric validation.
- Experience: not required, preferred, or required.
- Existing-resume requirement where relevant.
- Fixed weekly shifts, a choice of shifts, or variable hours.
- For each shift: day, start, end, and mandatory versus optional.
- For selectable shifts: an explicit minimum weekly commitment, or clearly unknown.
- Any requirement whose time is not yet confirmed.

A readable weekly shift editor is the main visual element. Support adding the same shift to multiple days and editing it with accessible form fields.

Validate positive-duration shifts, sensible numeric ranges, and internally consistent requirements. Handle overlapping shift alternatives deliberately; do not count two overlapping shifts as independently coverable by the same applicant.

Do not assume an empty fixed schedule means compatibility. Require usable hours before publishing or show Needs confirmation.

Clearly distinguish drafts from published jobs. Include a student-facing preview before publication.

### Job details and applicants
Show the role and shift requirements beside its applicant list.

Each applicant card should contain only information deliberately shared for that application:
- Name, submitted relevant experience, and school affiliation if shared.
- Shared work-availability windows.
- Number of required shifts covered.
- Current application stage.
- Application timestamp and a clear review action.

Default to a transparent sort such as schedule compatibility or newest application. Let the employer change it. Never use an unexplained overall percentage or "best employee" score.

An applicant who covers one of two mandatory shifts must not appear as a complete match. Optional-shift matches must account for the minimum commitment.

### Applicant review
On desktop, use an applicant list and a detail panel. On smaller screens, use a full detail view.

The central comparison should show:
- Required job shifts.
- The applicant's shared work availability.
- Coverage per shift: Fits shared availability, Outside shared availability, or Needs confirmation.
- A concise summary: "Fits both required shifts" or "Available for Tuesday; Thursday needs confirmation."

Reuse the calendar's visual language, but build an employer-safe availability view. Do not pass private student schedules to the employer calendar component.

Show submitted experience and the submitted resume reference if present. A filename fixture is not an actual downloadable resume.

Provide deliberate, labelled actions to update the demo application's stage. Respect the current shared `ApplicationStatus` contract: submitted, reviewing, interview, offer, closed. If adding a stage, update types, migration, both UIs, and tests together. A shortlist can be a separate flag instead.

An Offer status is not an accepted offer or a completed hire. Any real interview invitation, offer, email, or message needs a connected implementation and an explicit user request.

### Business profile
Keep the first version small: business name, category, approximate location, and description used on job postings.

Use existing logo treatment or a tasteful initials mark for fictional employers. Do not invent verified-employer badges, customer testimonials, or real business endorsements.

## Privacy boundary: required
The employer side must not expose:
- Class titles, course codes, class times, or school timetable files.
- Private study, family, health, or other commitment details.
- Private schedule-change notifications.
- Raw student-side matching explanations that mention classes.

The existing student matcher can produce explanations such as "Your MATH 1B class ends at noon". Do not reuse that text in employer views.

Build a dedicated employer-facing application projection containing submitted profile fields and effective work-availability windows. The windows should already account for the student's commitments and commute buffer. Compute employer-visible coverage from those shared windows and required shifts, reusing interval helpers and consistent semantics.

Allow an explanation such as "Thursday 1–5 pm is outside the availability shared with this application". Do not explain why the student is unavailable.

Application snapshots are authoritative for what was shared at submission. Editing a student's current profile or timetable must not silently rewrite an employer's existing application record. Provide an explicit demo action if a student shares updated availability.

Browser-local role switching is not a production privacy boundary. Document that real deployment with separate users requires server-side authorisation, tenant isolation, and controlled data access.

## Matching and eligibility
- Preserve explicit availability; unmarked time is not available.
- Every mandatory shift must fit for a complete schedule match.
- Incomplete or variable hours need confirmation.
- A selectable-shift minimum must be satisfiable without overlapping commitments.
- Student and employer views must agree about which shared windows cover a shift, while showing different levels of private detail.
- Keep school type and age independent, including dual-enrolled students.
- Reuse existing eligibility notices where appropriate; unknown age is not assumed to be adult.
- Keep schedule compatibility separate from work eligibility and qualifications.
- Do not implement automatic rejection or hiring decisions based on school type, age band, ratings, or an opaque ranking.
- Employers review applicable job requirements; this prototype must not claim to establish legal eligibility.

These are product-design requirements, not a new jurisdiction-specific compliance engine.

## Visual design
Extend the existing whimsical, Google-inspired identity into a clear employer workspace:
- Retain the Workaround logo and current light theme.
- Use existing CSS tokens rather than a parallel palette.
- Current brand accents: blue #349CEC, coral #F4645C, yellow #FCC444, green #2CBC9C, navy #13335F.
- Preserve Quicksand headings and Inter body text.
- Use blue for primary actions, green/teal for compatible availability, amber for unknowns, and coral/red for conflicts.
- Always pair status colour with text or an icon.
- Prefer restrained rounded cards, clear spacing, and one primary action per area.
- Make the required shift and applicant coverage easy to locate immediately.
- Avoid tiny calendar labels, crowded tables, excessive badges, and oversized empty dashboards.
- Maintain readable contrast, visible keyboard focus, labelled controls, dialog focus management, and accessible alternatives to drag interactions.
- Support narrow screens, while prioritising a readable desktop recording layout.

A friendly brand should not make the work interface look like a game.

## State and integration
Retain React, TypeScript, Vite, existing hash routes, and the current component conventions. Add dependencies only when the existing stack cannot reasonably support the requirement.

Suggested organisation, adapted to the checkout:
- `src/views/employer/` for employer views.
- `src/components/employer/` for shift editing and applicant review.
- Shared types and pure coverage functions in `src/lib/`.
- Clearly labelled fixtures in `src/data/`.

Use one shared job collection so employer-created published demo jobs appear in the student view in the same browser. Replace direct fixed-array consumers where necessary without mutating imported fixture constants.

Associate jobs with an employer ID. Link applications to a job and applicant ID, and retain the submitted profile/availability snapshot. Preserve existing saved browser data through normalisation or a versioned migration.

A real student-demo application should appear under the corresponding employer's demo applicant list. Fixtures must remain distinguishable from user-created applications.

Persist drafts and demo statuses locally. Reset demo must restore a predictable baseline for both roles. Handle stale or missing job/application IDs gracefully.

Do not imply that local storage synchronises separate browsers, devices, or teammates. Do not change the existing server-side schedule reader or secret handling merely to build employer UI.

## Feedback, payments, and scope
The user intends employer hiring fees and school subscriptions. Do not invent validated prices, charge cards, or present billing as connected.

Employee feedback is secondary. If shown, use structured criteria, verified demo employment, a student response/dispute affordance, and an honest empty state. No feedback is not a negative rating. Respecting previously agreed unavailability must not lower feedback.

Prioritise:
1. Job editor, publication, and student preview.
2. Employer-safe applicant availability review.
3. Shared demo application and status flow.
4. Visual polish and responsive/accessibility checks.
5. Business profile and optional feedback states.

## Demonstration and acceptance
The completed employer prototype should support this reproducible sequence:
1. Open the fictional employer workspace.
2. Create or edit a Tuesday/Thursday 1–5 pm opening.
3. Preview and publish it; see that exact opening in the student demo.
4. Apply from the student side using the confirmed sample week.
5. Switch to Employer demo and inspect the submitted availability snapshot.
6. Compare it with a fixture that covers only one required shift.
7. Move the application to Employer reviewing and verify the student's status updates.
8. Refresh and confirm the demo state persists.
9. Reset and confirm both roles return to the baseline.

Keep the existing student conflict demonstration working: class ends at noon, a 12:15 shift conflicts with a 30-minute buffer, and a 1 pm shift fits.

Show a concise employer flow in the two-minute competition video only if time permits. Product completeness and truthful behaviour matter more than showing every screen.

## Validation and handoff
For implementation changes:
- Run `npm test` and `npm run build`.
- Add focused tests for new employer coverage logic, optional-shift requirements, privacy-safe application projections, snapshot immutability, state migration, and job/status synchronisation.
- Verify that employer-visible text never includes private class names or commitment reasons.
- Check create/edit/preview, empty results, draft versus published visibility, stale routes, filtering, role switching, persistence, reset, and narrow layouts.
- Use the project's supported browser-preview workflow if available. State any visual QA limitation accurately.
- Do not claim arbitrary-file upload, messaging, payments, verification, or hiring outcomes were tested unless exercised.
- Update README with the employer demo steps and actual implementation limitations.

Report what changed, how it was verified, and the remaining limits. This brief does not itself request a commit, push, or deployment; follow the user's current task and applicable project workflow.

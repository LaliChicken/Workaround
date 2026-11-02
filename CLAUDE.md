Workaround Student Frontend Plan
Planning draft | 1 November 2026
Confirmed round-two constraints
Submission deadline: Wednesday, 4 November 2026.
Video maximum: 2 minutes.
No existing logo.
Prioritise a 40–45-second student product demonstration inside the complete pitch.
First visual identity: a simple Workaround wordmark, with a small calendar-inspired W mark if useful. Custom illustration is optional.
First build scope for this deadline
Design and implement three connected views: My Schedule, Jobs, and Job Details with a short demo application confirmation. Schedule edits, commute buffers, and compatibility explanations should work consistently. Treat expanded application tracking and profile/rating screens as secondary work after this journey is polished.
Proposed recording outline, targeting 1 minute 50 seconds:
Time
Content
0:00–0:15
Student scheduling problem and the team's local evidence
0:15–0:25
Introduce Workaround and its central mechanism
0:25–1:10
Student demo: timetable, incompatible shift, compatible shift, application
1:10–1:30
Employer value and proposed employer/school revenue
1:30–1:50
Local pilot, what will be measured, and closing
This leaves 10 seconds below the limit for transitions and recording variation. Confirm any additional round-two requirements before finalising the script.
Proposed delivery sequence: Monday 2 November for the core screens and matching behaviour; Tuesday 3 November for polish, script, recording, and a complete backup export; Wednesday 4 November for final checks and submission. The exact submission time is still unknown.
Goal
Build a responsive student-facing prototype for the round-two video. Make the central value visible: students can understand which jobs fit their real weekly availability before applying.
The prototype should demonstrate a complete student journey and clear matching behaviour. Planning does not authorise building or publishing a site yet.
Established direction
Audience: undergraduate students and high school students ages 16–18; use a Foothill undergraduate for the first demonstration.
Core product: compare student availability with employers' actual shift requirements.
Student schedule includes classes, commute buffers, and personal commitments.
Employer fees and school subscriptions support the business model; keep payment flows outside the student journey.
Include verified work feedback as a secondary profile feature.
Resume generation stays outside the first prototype.
Use the user's latest executive-summary workflow: schedule import, weekly calendar, employer shifts, and conflicts visible before applying.
The latest visible survey result is 22 of 27 Foothill respondents. It is research context, not a dashboard performance metric.
Primary journey
Set up a minimal student profile.
Add or import classes and review the resulting timetable.
Mark when the student is willing to work and add commute buffers.
Browse compatible jobs and inspect the reasons for a match.
Save or apply to a selected opportunity.
Track the application.
Edit availability and see compatibility update.
Screens and navigation
Main navigation: Jobs, My Schedule, Applications. Profile accessible through the avatar. Saved jobs sit within Jobs.
1. Initial setup
Collect school, student stage or age band where relevant, approximate job-search area, desired weekly hours, and optional experience or interests.
Do not ask for a precise home address merely to browse jobs. Explain why age-related information is needed when relevant.
The student can begin with a sample timetable for the demo. Avoid a long onboarding questionnaire.
2. My Schedule
A large, editable weekly grid is the core input.
Class blocks show course and times.
Students confirm imported times before matching.
Add work-available blocks, study time, extracurricular activities, and other unavailable periods.
Do not assume every hour outside class is available for work.
Allow manual schedule entry as an alternative to file import.
Include term start/end dates and a simple commute-buffer setting.
Changes immediately update match explanations.
Provide an accessible form or agenda alternative to dragging.
Employers receive relevant work availability rather than the student's detailed class timetable.
Import needs a clear implementation boundary: a frontend can show a sample import and confirmation flow, but arbitrary PDF/image parsing requires a real parsing service or a supported local parser. Do not present a preset sample as a working arbitrary-file importer.
3. Jobs
Default to useful listings rather than an empty analytics dashboard.
Header: Jobs that fit your week.
Small availability summary with an Edit schedule action.
Filters: hourly pay, distance, desired hours, experience requirements, job category, and compatibility.
Job cards show role, business, location, pay, required days/times, weekly hours, and a compatibility label.
Default to compatible openings; offer a toggle to inspect conflicts.
Explain compatibility in plain language; avoid an unsupported percentage match score.
Label unknown requirements as needing confirmation rather than treating them as a match.
Preserve a saved-jobs view.
Desktop: job list beside selected job details. Mobile: list followed by a full job-detail view.
4. Job details and application
Show duties, essential qualifications, advertised pay, fixed or variable hours, and required shifts.
Show a mini week view with the proposed shift and relevant availability.
Explain why it fits, conflicts, or requires confirmation.
A slot that starts after class can still conflict if the commute buffer is insufficient.
If some shifts are optional, distinguish them from mandatory shifts. Never mark an entire role compatible merely because one required shift fits.
If relevant eligibility information is unknown, flag it; do not claim comprehensive legal eligibility from a calendar match.
Student controls whether to apply.
Application can use a simple profile and an existing resume where required.
Show the information shared before submission.
The demo must distinguish a simulated application from a real employer submission.
5. Applications and profile
Applications show status and an accurate next step: Submitted, Employer reviewing, Interview, Offer, or Closed. Do not imply a real employer has responded in a frontend-only demo.
Profile includes relevant experience, optional existing resume, school affiliation, and work-feedback history. New applicants show No verified work history yet rather than a zero-star rating.
Employee feedback requires verified employment, specific criteria, a student response/dispute process, and protection against penalising agreed unavailability. The first demo can show a designed empty state rather than a fully developed public rating system.
Matching states
State
Meaning
Example copy
Fits your week
All mandatory shifts fit stated availability and the configured buffer
Both weekly shifts fit your availability.
Commute conflict
A shift leaves insufficient travel time
Your class ends at noon. With your 30-minute buffer, you can start at 12:30.
Schedule conflict
A mandatory shift overlaps an unavailable period
Thursday's shift overlaps your class.
Needs confirmation
Work requirements or availability are incomplete
Ask the employer to confirm which shifts are required.
Some optional shifts fit
An employer explicitly allows choosing a subset
Two optional shifts fit. Confirm the minimum weekly commitment.
Compatibility is a schedule assessment, not a guarantee of employment, transport arrival time, or legal eligibility.
Sample video scenario
Use fictional openings and illustrative pay, clearly identified as demo data.
Student: a Foothill undergraduate with Tuesday/Thursday classes ending at 12:00.
Commute buffer: 30 minutes.
Opening A: cafe role, Tuesday/Thursday 13:00–17:00. Fits, if those periods are marked available.
Opening B: a similar role starting at 12:15. Flag insufficient commute time.
Open the match explanation and contrast the two.
Edit Thursday's class to end at 14:00. Opening A now conflicts; results update.
Restore availability, inspect Opening A, submit a demo application, and show it in Applications.
Do not imply these are live vacancies or validated employer commitments.
Visual direction proposed
Light, warm-neutral background; dark readable text; blue or indigo primary actions.
Teal or green for compatible shifts; amber for warnings; colour always accompanied by text or an icon.
Consistent rounded cards and generous spacing, without excessive decoration.
Strong typography and a simple Workaround wordmark.
The calendar is the visual centre of the product, not a decorative background.
Subtle transitions when changing availability or selecting jobs.
Desktop layout suitable for video capture, with responsive mobile layouts.
No stock-photo hero section is necessary inside the signed-in app.
Use readable schedule labels and job-card text at the intended recording resolution.
First prototype priorities
Essential
Editable timetable and explicit work availability.
Commute-buffer setting.
Fictional job dataset with meaningful shift differences.
Working compatibility logic and explanations.
Job browsing with a few clear filters, detail view, and simulated application confirmation.
Responsive layouts, keyboard access, and clear empty or conflict states.
Secondary
Saved jobs and expanded application tracking.
Import confirmation UI, with a real sample flow.
Existing resume attachment UI.
Profile and work-feedback empty state.
Later
Reliable arbitrary-file schedule parsing.
Real accounts, employer postings, messaging, and submissions.
School and employer dashboards.
Payments and subscriptions.
Full verified rating lifecycle.
Automated eligibility rules across jurisdictions.
Decisions for the next discussion
Visual direction: proposed light interface versus another reference or established branding.
Confirm the exact Wednesday submission time and any round-two video requirements beyond the two-minute maximum.
Whether the first build should be an interactive demo with fictional data or connect to an existing backend.
Any current code that should be retained; no existing logo needs to be retained.
Suggested build order after planning: schedule and matching logic; Jobs and details; application flow; profile and feedback state; responsive polish; video rehearsal.
Success criteria for the frontend
A viewer can explain what Workaround does after seeing the schedule-to-job interaction. A student can understand why a job fits, correct their availability, and know what they are submitting. Demo behaviour remains consistent when input changes.
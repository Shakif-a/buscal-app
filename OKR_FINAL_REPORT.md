# OKR backend: final report

Date: 30 July 2026. Project: OKR Calendar System for Micromax Pty Ltd
(CSIT321, group OKRew). Scope of this report: the OKR backend module inside
buscal-app, its automated tests, and its CI/CD pipeline. The frontend is owned
by a separate team, so the backend deliverable is the API plus its contract.

Everything below was re-verified from scratch today. Not recalled from earlier
in the build: each file re-parsed, the suite re-run with the exact command CI
uses, the pipeline definition re-validated, and the route list read back out of
the router rather than from memory.

## Verification results

Syntax and structure. All eleven OKR backend files parse cleanly: server.js,
the controller, the router, three middleware files, four models and the test
file. Every file referenced by the `check` script exists, including the demo
seed script. The router is mounted twice in server.js, at `/api/okr` and at
`/api/v1/okr`, so a versioned path is available without breaking the original.

Tests. 24 tests, 24 passing, 0 failing, run through `yarn test:ci` against a
real MongoDB. That command runs the syntax check first and then the suite, so a
parse error fails the build before any test runs. Coverage in plain terms:
reachability and machine-readable health probes; the versioned alias preserving
the contract; token rejection; JWT algorithm pinning; role separation; input
validation at the boundary; the full create, weight, roll-up and approve flow;
dashboard summary; weight-check; check-in history; forecasting; insights;
malformed id handling; cross-user access refusal; NoSQL injection stripping;
the trend series; leaderboard ranking; edit and delete flows; and the activity
feed.

Pipeline. The workflow is valid YAML, named Backend CI, and scoped with a path
filter so it only runs when `backend/**` or the workflow itself changes. This
matters now that a separate team owns the frontend: their commits will not
trigger backend runs, and vice versa. Two jobs: tests against a throwaway
MongoDB service, then an optional Render deploy that fires only on main, only
after tests pass, and only if a `RENDER_DEPLOY_HOOK` secret exists. Merging it
changes nothing until that secret is added.

Security posture. Ownership checks on every record, role gating on the seven
write endpoints that need it, request bodies stripped of MongoDB operator keys,
a configurable rate limiter that emits standard RateLimit headers, ObjectId
format validation before any query, field length limits and indexes on the
access patterns the app actually uses. Refusals do not reveal whether a record
exists. All of it is covered by tests, not just asserted here.

Gaps found and fixed during this audit. Five, two of them serious.

The calendar link did not exist. The brief's third listed function is
"completion of calendar items contributes to progress towards objectives", and
that is the whole reason the client wants this built on top of their calendar
instead of buying Workboard. What was there was a `calendarTaskId` string that no
code read or wrote, while the app already contained a full CalendarEntry model
with completion status and progress on it. Key results now link to real calendar
records: a completed item counts as 100, a cancelled one as zero, anything else
contributes its own progress, and the average drives the key result, which rolls
up into the objective. Two sync endpoints pull the latest calendar state
through, one per key result and one for a whole objective. Tested end to end:
link two items with one complete and progress reads 50; mark the second
complete, sync, and it reads 100.

The top-down cascade did not exist either. Objectives carried a type label
(company, department, team, individual) but no parent, so a company goal could
not actually contain department goals. Objectives now accept a parent, validated
so nobody can attach work under a strategy they cannot see, and
`/objectives/tree` returns the nested plan. Tested three levels deep.

Three smaller gaps against the frontend must-have list were also missing:
editing an objective, editing a key result, and deleting a key result. All three
now exist, enforce the weight ceiling on edit, refresh the roll-up, write to the
activity feed, and are covered by a test that proves an illegal weight edit is
refused.

## Requirements traceability

| # | Requirement (source) | Status | Evidence |
|---|---|---|---|
| 1 | Define and group objectives, top-down strategy (client brief) | Done | Parent link cascades company to department to team to individual; `/objectives/tree` returns the nested plan; test 23 |
| 2 | Key results weighted, never exceeding 100% per objective (client brief, A2) | Done | Ceiling enforced on create and edit; weight-check endpoint; three tests |
| 3 | Weighted progress roll-up per objective (A2) | Done | Recalculated after every key result change; verified 60/40 maths |
| 4 | Calendar completion contributes to progress (client brief) | Done | Key results link to real CalendarEntry records; completion drives progress and rolls up; sync endpoints; test 22 |
| 5 | Role-based access to create and edit (A2) | Done | protect, requireOkrManager (admin/qm/manager), ownership checks; three tests |
| 6 | Approval workflow with approver and timestamp (A2) | Done | approved, approvedBy, approvedAt, justification |
| 7 | Evidence of completion (A2) | Done | Written justification on the key result; supporting files live on the linked calendar entries, which are now connected |
| 8 | On-track, at-risk, overdue, completed statuses (A2) | Done | Derived on objectives and key results, surfaced in summary and insights |
| 9 | View, create, edit, delete objectives (frontend must-haves) | Done | Complete after this audit's fixes |
| 10 | View and manage key results, add, edit, delete (frontend must-haves) | Done | Nested create, edit, delete, progress, approval |
| 11 | Filter by group, type, owner, My Objectives (frontend must-haves) | Partial | Owner, type and the parent hierarchy work; a separate department/group entity is still not agreed with the client |
| 12 | Dashboard data (A2) | Done | One-call summary: totals, status counts, average progress, needs-attention |
| 13 | Reports data (A2) | Done | Insights, activity, leaderboard, trend |
| 14 | Progress history over time | Done | Dated check-ins with notes, history and trend endpoints |
| 15 | Forecast whether objectives land on time | Done | Velocity model with verdict and required weekly pace |
| 16 | No hardcoded secrets, environment config (sponsor rules) | Done | All config via .env; CI uses its own throwaway values |
| 17 | Commercial and industrial grade hardening (sponsor context) | Done | See security posture above; four dedicated tests |
| 18 | CI/CD, tests on every push, deployable main (A2) | Done | Backend CI with path scoping and gated deploy |
| 19 | Independently deployable with documentation (client brief) | Done | Module guide, API handoff contract, production readiness notes |
| 20 | Clear API contract for the frontend team (team split) | Done | OKR_API_HANDOFF.md: every endpoint, permission tier, shape, error and screen mapping |

Nineteen of twenty fully delivered, one partial. The single remaining partial is
group filtering, which waits on a department entity the client has not defined
yet; the parent hierarchy covers the strategic grouping the brief actually asked
for.

The two most important items on that list, the calendar link and the top-down
cascade, were found missing during this audit and built. Detail below, because
they are the heart of the brief.

## Priority actions

One, rotate the credentials. The Atlas database password and the JWT secret
were both visible in chat during development, and the password currently set in
Atlas is still the exposed one. Use Autogenerate Secure Password on the database
user, replace `JWT_SECRET` with a fresh long random string, and update `.env`.
This is the only red item in this report.

Two, review before pushing. The changes touch shared files: server.js gained
the OKR mounts and health probes, and the CI workflow is new. There was also an
earlier local change to the frontend auth guard made purely to reach the
playground; that one should not go to main. Since the frontend is a separate
team's responsibility now, flag the reference service file in the frontend
folder to them as optional rather than pushing it as a requirement.

Three, confirm the calendar rule with the client. The link is built and working,
but one design decision deserves Shakif's sign-off: a key result's progress is
the average completion of its linked calendar items, treating each item as equal.
If Micromax would rather weight some calendar items more heavily than others,
that is a small change to one function. Worth asking at the next fortnightly
rather than assuming.

Four, settle whether a department entity is needed at all now that objectives
cascade through parents. That is the last open requirement.

## Deliverables and where they live

Backend module: `controllers/okrController.js`, `routes/okrRoutes.js`,
middleware (`okrSecurityMiddleware.js`, `okrAuthorization.js`), four models
(objective, key result, check-in, activity), `test/okr.test.js`, and
`scripts/seedOkrDemo.js` for demo data.

Documentation: `backend/OKR_MODULE.md` explains how the module works and how to
run it. `backend/OKR_API_HANDOFF.md` is the contract for the frontend team.
This report is the assessment record.

Pipeline: `.github/workflows/ci.yml`.

An earlier standalone prototype backend sits in Downloads/project/backend. It
served as the reference design and can be cited in documentation, but
buscal-app is the live codebase and the one to submit.

## Honest framing for the sponsor

Describe this as a backend module built to commercial standards with automated
security and business-rule testing in CI. Avoid calling it production ready:
that claim belongs after the calendar integration lands, credentials are
rotated, and the deployment is configured with TLS, least-privilege database
users and backups. The distinction reads as engineering maturity rather than
hedging, and it is the accurate description of where the work stands.

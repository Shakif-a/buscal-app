# OKR API handoff

For the frontend team. This is the contract for the OKR module: what to call,
what comes back, who is allowed, and how errors arrive. The backend team owns
everything behind these URLs, so you should never need to read the server code
to build a screen.

Verified working on 30 July 2026 against the automated suite (21 tests passing).

## Base URL and versioning

```
http://localhost:5000/api/okr        during development
/api/v1/okr                          versioned alias, identical behaviour
```

Both paths serve the same routes. Prefer `/api/v1/okr` for new work: if we ever
need a breaking change, v1 keeps working and v2 appears alongside it.

Point your app at the backend with an environment variable rather than a
hardcoded string, the same way the rest of the site does.

## Authentication

Log in through the existing site endpoint (`POST /api/users/login`). It returns
a user object containing a `token`. Send that token on every OKR request:

```
Authorization: Bearer <token>
```

The OKR module does not have its own login. If the token is missing, malformed,
expired, or signed with the wrong algorithm, you get `401`.

## Permissions

Three tiers, so you can show or hide controls to match.

Public, no token: `GET /ping` only.

Any signed-in user: all the read endpoints, plus updating progress and posting
check-ins on work assigned to them.

OKR managers only (a user whose account or company roles include admin, qm, or
manager): creating, editing and deleting objectives, adding, editing and
deleting key results, and approving key results. That is seven endpoints, marked
"manager" in the table below.

Users only see their own objectives. Requesting someone else's returns 403 or
404, so do not build screens that assume cross-team visibility yet.

Hiding a button is a courtesy, not security. The server enforces every rule
independently, so a determined user cannot get around the UI.

## Endpoints

| Method | Path | Who | What it does |
|---|---|---|---|
| GET | `/ping` | public | Reachability plus database state and uptime |
| GET | `/summary` | any user | Dashboard totals in one call |
| GET | `/my-key-results` | any user | Key results assigned to the caller, with objective context |
| GET | `/insights` | any user | Plain-English findings, sorted by severity |
| GET | `/activity` | any user | Recent activity feed. `?limit=` 1 to 100, default 20. Managers may add `?scope=team` |
| GET | `/leaderboard` | any user | Ranked contributors across the caller's objectives |
| GET | `/objectives` | any user | The caller's objectives |
| POST | `/objectives` | manager | Create an objective. Accepts `parent` to nest it |
| GET | `/objectives/tree` | any user | The strategy cascade, objectives nested by parent |
| GET | `/objectives/:id` | any user | One objective plus its key results |
| PUT | `/objectives/:id` | manager | Edit title, description, type, dates, approval state |
| DELETE | `/objectives/:id` | manager | Delete the objective, its key results and their history |
| GET | `/objectives/:id/weight-check` | any user | Weight allocated, remaining, and whether it is exactly 100 |
| GET | `/objectives/:id/forecast` | any user | Pace, projected finish date and a verdict |
| GET | `/objectives/:id/trend` | any user | Chart-ready progress-over-time series |
| POST | `/objectives/:id/key-results` | manager | Add a key result |
| PUT | `/key-results/:id` | manager | Edit title, weight, assignee, due date, justification |
| DELETE | `/key-results/:id` | manager | Delete a key result and its check-ins |
| PATCH | `/key-results/:id/progress` | any user | Set progress only |
| PATCH | `/key-results/:id/approve` | manager | Approve or request changes |
| POST | `/key-results/:id/check-in` | any user | Dated progress update with an optional note |
| GET | `/key-results/:id/history` | any user | All check-ins, oldest first |
| POST | `/key-results/:id/calendar-links` | manager | Link calendar entries so their completion drives progress |
| DELETE | `/key-results/:id/calendar-links` | manager | Unlink one entry. Body `{ entryId }` |
| POST | `/key-results/:id/sync-calendar` | any user | Recalculate this key result from its calendar entries |
| POST | `/objectives/:id/sync-calendar` | any user | Recalculate every calendar-linked key result under the objective |

Service health, outside the OKR prefix: `GET /api/health/live` (process is up)
and `GET /api/health` or `/api/health/ready` (up and the database is reachable).

## The two rules your UI must respect

Weights. The key results under one objective may never total more than 100
percent. Adding or editing past that returns `400` with a message naming the
remaining room. Call `weight-check` while the user types so you can show
"70% of 100 allocated, 30% left" and disable submit before they hit the error.

Progress is read-only. Never send `progress` or `status` on an objective. The
server calculates objective progress as the weighted roll-up of its key results
and derives the status from that. Move progress through a key result check-in
and re-read the objective.

## Request and response shapes

Create an objective:

```json
POST /objectives
{ "title": "Grow Q3 revenue", "description": "", "type": "team",
  "startDate": "2026-07-01", "dueDate": "2026-09-30" }
```

`type` is one of company, department, team, individual. `title` and `dueDate`
are required. Title max 140 characters, description max 2000.

Add a key result:

```json
POST /objectives/:id/key-results
{ "title": "Sign 20 new customers", "weight": 60, "progress": 0,
  "assignedTo": "<userId>", "dueDate": "2026-09-15" }
```

Title max 180 characters. A key result due date cannot fall after its
objective's due date.

Check in:

```json
POST /key-results/:id/check-in
{ "progress": 55, "note": "signed three more this week" }
```

Note max 500 characters. The response contains both the new check-in and the
updated key result, so you can refresh in place without a second request.

An objective comes back with `progress` 0 to 100, `status` (one of on-track,
at-risk, overdue, completed), `approvalState` (draft, pending, approved,
changes-requested), owner, dates and timestamps. A key result adds `weight`,
`assignedTo`, `approved`, `approvedBy`, `approvedAt`,
`completionJustification` and `calendarTaskId`.

`forecast` returns `verdict` (on-pace, behind-pace, overdue, completed,
no-progress-yet), `velocityPerWeek`, `requiredPerWeek`, `projectedFinish` and
`daysRemaining`. Badge the verdict and show the required pace when it is behind.

`trend` returns `points`, an array of `{ date, progress }` starting at zero.
Feed it straight to a line chart.

`insights` returns `{ count, insights }` where each item has `severity`
(critical, warning, info), a `text` sentence written for humans, and the id it
refers to. Render the text as-is; do not rewrite it in the UI.

`leaderboard` returns `{ count, leaderboard }` with `rank`, `name`,
`keyResults`, `approved`, `averageProgress` and `score`, already sorted.

## Errors

Every failure is JSON with a `message` you can show the user, and often a
`success: false` flag.

`400` bad input: missing fields, weights over 100, malformed id, progress out
of range. The message explains what to fix.
`401` not signed in or the token expired. Send them to login.
`403` signed in but not allowed, usually a non-manager attempting a manager
action.
`404` not found, or found but not theirs.
`409` duplicate value.
`429` rate limited. Honour the `Retry-After` header; `RateLimit-Remaining` tells
you how much room is left. The window is generous, so this normally only fires
on a runaway loop.
`503` from the health endpoints when the database is unreachable.

Show `message` rather than a generic "something went wrong". The backend writes
these to be readable by an end user.

## Suggested screen mapping

Dashboard: `/summary` for the KPI cards, `/insights` for a needs-attention
panel, `/my-key-results` for a personal task list.

Objectives list: `/objectives`, with a forecast badge per card from
`/objectives/:id/forecast`.

Objective detail: `/objectives/:id` for the header and key result table,
`/objectives/:id/trend` for the progress chart, `weight-check` in the add and
edit forms, and check-in plus approve actions on each row.

Reports: `/leaderboard`, `/activity`, and trend charts.

## Calendar-driven progress

This is the feature the client cares most about, so it is worth reading twice.

A key result can be tied to one or more entries in the existing business
calendar. Post the calendar entry ids to `/key-results/:id/calendar-links` and
the key result's `progressSource` flips to `calendar`. From then on its progress
is the average completion of those entries: a calendar item marked completed
counts as 100, a cancelled one as 0, anything else uses its own progress number.
That figure rolls up into the objective through the normal weighted calculation.

So when someone ticks off calendar work, objective progress moves on its own.
Call `/objectives/:id/sync-calendar` to pull the latest state through (a Refresh
button, or a scheduled job later). The response tells you the new objective
progress and which key results changed.

Unlinking the last entry returns the key result to manual updates and keeps its
current number rather than dropping it to zero.

In the UI, show calendar-linked key results differently from manual ones and
avoid offering a progress slider on them, since the calendar owns that number.
Read `progressSource` to decide.

## Top-down strategy

Objectives can carry a `parent`, which is what makes the plan top-down: a
company objective is the parent of department objectives, which parent team and
individual ones. Pass `parent` when creating or updating. A parent you cannot
see is rejected with a 404, so nobody can attach work under another team's
strategy.

`GET /objectives/tree` returns the whole cascade already nested, each node with
its id, title, type, progress, status, due date and `children`. Render it as an
expandable tree or an org-chart style view.

## Notes and known gaps

Filtering by group or department is not available yet, because the shared group
model has not been agreed with the client. Owner and type filtering work today,
and the parent hierarchy covers most of what grouping was needed for.

Evidence files attach to calendar entries rather than to key results, following
the client's design that the calendar stays the system of record for the work
itself. The key result holds a written justification.

There is a reference `okrService.js` in the frontend folder of this repo from
earlier prototyping. Treat it as an example of calling this API, not as
something you have to adopt.

Questions or a field you need that is missing: raise it with the backend team
rather than working around it in the UI, and we will add it to the contract.

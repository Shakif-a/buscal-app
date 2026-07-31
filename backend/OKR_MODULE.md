# OKR module

This is the backend for the OKR tracker inside Buscal. It lets a business set
objectives, break each one into weighted key results, and watch progress roll
up as the work gets done. It sits alongside the existing calendar and user code
and reuses the same auth.

## How it fits together

There are four OKR collections: objectives, key results, check-ins, and
activity. An objective is a goal with a due date. A key result is a measurable
outcome under that goal, and it carries a weight that says how much of the
objective it accounts for. The weights under one objective are not allowed to
add up to more than 100 percent, so you cannot over-commit a goal.

Progress is calculated, not typed in by hand. Each key result contributes its
own progress scaled by its weight. A key result worth 40 percent that is half
done adds 20 points to its objective. The objective stores that rolled-up number
and a status label (on-track, at-risk, overdue, or completed) so the dashboard
can read it in one query.

Everything except the health check needs a logged-in user. The routes use the
same `protect` middleware as the rest of the app, so the token you already get
at login works here too.

## Files

- `models/okrObjectiveModel.js` — the objective schema.
- `models/okrKeyResultModel.js` — the key result schema, including the approval
  fields and the link to a calendar task.
- `controllers/okrController.js` — the request handlers and the two rules
  (weight ceiling and weighted roll-up).
- `routes/okrRoutes.js` — maps the URLs to the handlers. Mounted at `/api/okr`
  in `server.js`.

## Endpoints

Existing clients may use `/api/okr`; new integrations should use the versioned
base `/api/v1/okr`. Both currently expose the same handlers. Send the token as
`Authorization: Bearer <token>` on the private endpoints. The full
machine-readable contract is in `openapi/okr.v1.yaml`.

```
GET    /ping                              public, checks the module is up
GET    /summary                           dashboard totals for the current user
GET    /my-key-results                    key results assigned to you
GET    /objectives                        your objectives
POST   /objectives                        create an objective
GET    /objectives/:id                    one objective with its key results
DELETE /objectives/:id                    delete an objective and its key results
GET    /objectives/:id/weight-check       how much weight is left of 100
GET    /objectives/:id/forecast           pace, projected finish date, verdict
POST   /objectives/:id/key-results        add a key result (rejects if over 100)
PATCH  /key-results/:id/progress          update progress, re-rolls the objective
PATCH  /key-results/:id/approve           manager approval
POST   /key-results/:id/check-in          dated progress update with a note
GET    /key-results/:id/history           all check-ins, oldest first
GET    /insights                          plain-English findings, sorted by severity
GET    /activity                          recent activity feed (who did what)
GET    /objectives/:id/trend              chart-ready progress-over-time series
GET    /leaderboard                       ranked contributors (approved work counts double)
```

A create-objective body looks like this:

```json
{ "title": "Grow Q3 revenue", "type": "team", "dueDate": "2026-09-30" }
```

A key result body looks like this:

```json
{ "title": "Sign 20 new customers", "weight": 60, "progress": 0, "dueDate": "2026-09-15" }
```

If a key result would push the total weight over 100, the server replies with a
400 and a message saying how much room is left.

## Running the tests

The tests use Node's built-in runner, so there is nothing extra to install. They
need a MongoDB to talk to. Point `MONGO_URI` at any database you do not mind
wiping, then run:

```bash
MONGO_URI=mongodb://127.0.0.1:27017/okr_test JWT_SECRET=test_secret yarn test
```

The CI workflow runs the same command against a throwaway MongoDB container, so
if it passes locally it will pass there.

## The smart layer

Four features sit on top of the basic CRUD and are the interesting part to demo.

Check-ins are dated progress updates with an optional note ("signed 3 more
customers this week"). Every check-in is kept, so a key result has a full
history you can chart, not just a current number.

The forecast looks at how fast an objective has actually moved since it
started, projects that pace forward, and answers the question a manager cares
about: will this land by the due date? It returns the projected finish date,
the current pace per week, the pace that would be needed to finish exactly on
time, and a one-word verdict (on-pace, behind-pace, overdue, completed, or
no-progress-yet).

Insights turn the numbers into short sentences a person can act on. Examples:
an objective whose weights only total 80 so its progress will top out early, a
key result at 100 percent still waiting on approval, one that has had no
check-in for two weeks, or an objective that needs 12 percent a week to land on
time. Each insight has a severity so the frontend can colour and sort them.

The activity feed is a simple audit trail. Creating an objective, adding a key
result, checking in progress, and approving work all drop one line into it, so
the team (and the marker) can see the system being used over time.

## Promoting playground features to the main website

The Dev Playground is the proving ground: backend features get built and tested
there first, and the ones worth keeping move into the real pages. To make that
move painless there is a ready-made service file at
`frontend/src/features/okr/okrService.js`, written in the same style as
`authService.js`. A page never needs to know the endpoint URLs; it just calls
something like:

```js
import okrService from "../features/okr/okrService";

const summary = await okrService.getSummary(user.token);
const insights = await okrService.getInsights(user.token);
const forecast = await okrService.getForecast(objectiveId, user.token);
```

Rough mapping from playground to site: the summary powers the Dashboard KPI
cards, insights make a "needs attention" panel, the forecast badge belongs on
each objective card, check-in history feeds a progress chart on the objective
detail page, and the activity feed fits the Reports page or a sidebar.

## Production readiness

The module is built to ship inside a commercial product, so several layers of
protection are on by default. Requests with malformed ids are rejected with a
400 before they reach the database. Every request body is stripped of MongoDB
operator keys ($where, $gt and friends), which closes off NoSQL injection. An
in-memory rate limiter caps request volume per client, enough to blunt
brute-force scripts without bothering real users. Access control goes beyond
login: users can only see and change their own objectives (managers and admins
have wider rights through the authorisation middleware), and refusals do not
reveal whether a record exists. The health endpoint reports database state and
uptime so a monitoring agent on the Maxbox can watch it. The schemas carry
length limits and indexes on the query patterns the app actually uses.

All of this is covered by the test suite, including tests that one user cannot
read or delete another user's objectives, that injection payloads are
stripped, and that bad ids fail cleanly. CI runs the same suite on every push.

Before a real customer deployment, the remaining checklist sits with ops
rather than code: set a strong unique JWT_SECRET per box, use a dedicated
database user with least privilege, turn on TLS at the reverse proxy, schedule
database backups, and rotate any credentials that were ever shared during
development.

## Notes

Key result progress is meant to come from the Micromax calendar backend once
that integration is ready. For now the `calendarTaskId` field is filled with a
placeholder and progress is set directly through the API, which is enough to
build and demo the rest of the flow.

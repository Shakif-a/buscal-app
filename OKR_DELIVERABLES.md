# OKR backend: delivery manifest

Every file that makes up the OKR backend deliverable, what it is for, and who
needs it. Verified present and passing on 30 July 2026 (24 tests, 24 passing).

## Read these first

| File | Audience | Purpose |
|---|---|---|
| `OKR_FINAL_REPORT.md` | Supervisor, sponsor, your team | Verification results, requirements traceability (19 of 20 done), gaps found and fixed, priority actions |
| `backend/OKR_API_HANDOFF.md` | Frontend team | The API contract: every endpoint, permission tier, request and response shape, error codes, screen mapping |
| `backend/OKR_MODULE.md` | Any developer | How the module works, how to run it and its tests, production readiness notes |

## Code

| File | Purpose |
|---|---|
| `backend/controllers/okrController.js` | All request handlers and the business rules: weight ceiling, weighted roll-up, calendar-driven progress, forecasting, insights |
| `backend/routes/okrRoutes.js` | URL to handler mapping, with auth and validation applied per route |
| `backend/middleware/okrAuthorization.js` | Manager role check (admin, qm, manager) |
| `backend/middleware/okrSecurityMiddleware.js` | ObjectId validation, NoSQL operator stripping, rate limiting |
| `backend/models/okrObjectiveModel.js` | Objective schema, including the parent link for top-down cascade |
| `backend/models/okrKeyResultModel.js` | Key result schema: weight, approval fields, calendar entry links |
| `backend/models/okrCheckinModel.js` | Dated progress updates that build the history and trend |
| `backend/models/okrActivityModel.js` | Audit trail rows for the activity feed |

## Tests and tooling

| File | Purpose |
|---|---|
| `backend/test/okr.test.js` | 24 automated tests over the live API |
| `backend/scripts/seedOkrDemo.js` | Demo data for presentations and manual testing |
| `.github/workflows/ci.yml` | Backend CI: syntax check plus tests against a real MongoDB on every push, optional gated deploy |

## Shared files that were modified

Flag these in the pull request, because other people's work touches them.

`backend/server.js` gained the OKR router mounts (`/api/okr` and the versioned
`/api/v1/okr`) and the health probe endpoints.

`backend/package.json` gained the `check`, `test`, `test:ci` and
`seed:okr-demo` scripts. No new runtime dependencies were added anywhere, which
is deliberate: fewer packages to patch on a customer appliance.

## Not part of the deliverable

`frontend/src/features/okr/okrService.js` and the Dev Playground page were built
while proving the backend. The frontend belongs to another team, so treat these
as a working reference they can take or ignore, not as a requirement.

`Downloads/project/backend` holds the earlier standalone prototype. Useful to
cite in documentation as the reference design, but buscal-app is the live code.

## Before you push

Rotate the Atlas database password and the JWT secret. Both were exposed during
development and the password currently set in Atlas is still the exposed one.

Do not commit the local change made to the frontend auth guard, which existed
only to reach the playground.

Run the suite once yourself so you have seen it green:

```bash
cd backend
MONGO_URI=<your test db> JWT_SECRET=anything yarn test:ci
```

# OKR API handoff

This repository treats the backend and frontend as separately owned products.
The backend team owns the API, data rules, authorization, tests, monitoring,
and deployment pipeline. The frontend team consumes the published contract and
chooses how to present it.

## Stable base paths

- Existing clients: `/api/okr`
- New integrations: `/api/v1/okr`

Both paths currently expose the same handlers. New frontend work should use
the versioned path so a future breaking change can be introduced without
disrupting deployed clients.

## Authentication

Private endpoints require:

```http
Authorization: Bearer <JWT>
```

The backend accepts HS256 tokens signed with `JWT_SECRET`. Tokens and database
credentials must never be logged, committed, or included in test evidence.

## Authorization

| Capability | Employee/member | Objective owner | Manager/QM/admin |
| --- | ---: | ---: | ---: |
| Read an assigned objective | Yes | Yes | Yes |
| Update assigned KR progress/check in | Yes | Yes | Yes |
| Create or edit objectives | No | No | Yes |
| Create, edit, or delete key results | No | No | Yes |
| Approve completion | No | No | Yes |
| Request team scope | No | No | Yes |

Roles are normalized case-insensitively from both `roles` and
`companyRoles[].role`.

## Response conventions

Successful resource responses use the resource or documented aggregate shape.
Errors use:

```json
{
  "success": false,
  "message": "Human-readable explanation",
  "requestId": "traceable-request-id"
}
```

Clients should show `message` to the user for 4xx responses and record
`requestId` in support reports. Production 5xx responses intentionally hide
internal details.

Every response includes `X-Request-Id`. A caller may supply its own
`X-Request-Id` when it matches the allowed 1–128 character format.

## Health and operations

- `GET /api/health/live` — process is alive.
- `GET /api/health/ready` — process and MongoDB are ready.
- `GET /api/health` — compatibility alias for readiness.
- `GET /api/v1/okr/ping` — OKR module and database are reachable.

The deployment platform should use `/api/health/ready` as its readiness probe
and `/api/health/live` as its liveness probe.

## Rate limits

OKR responses include the standard `RateLimit-Limit`,
`RateLimit-Remaining`, and `RateLimit-Reset` headers. A rejected request also
includes `Retry-After`.

The built-in limiter is suitable for a single Buscal/Maxbox backend process.
A horizontally scaled deployment must replace its in-memory counter with a
shared store at the gateway or load-balancer layer.

## Contract source

The machine-readable contract is
[`openapi/okr.v1.yaml`](openapi/okr.v1.yaml). Keep it synchronized with
`routes/okrRoutes.js` whenever an endpoint or schema changes.

## Test 1 release gate

Test 1 is the mandatory backend foundation gate. It must prove:

1. Readiness reports a connected database.
2. A valid JWT reaches a protected endpoint.
3. An anonymous request is rejected.
4. A non-manager cannot create manager-owned OKR structures.
5. Malformed identifiers and invalid progress fail cleanly.
6. The versioned API alias behaves like the compatibility path.
7. The user, calendar, and web-notification controller boundaries respond.
8. No temporary test records remain after the suite.

The automated suite covers these rules and the full OKR lifecycle. Run:

```powershell
npm run test:ci
```

Only use a MongoDB database whose name contains `test`; the suite refuses to
clear any other database.

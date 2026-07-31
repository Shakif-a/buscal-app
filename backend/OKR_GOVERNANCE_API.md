# OKR governance and resilience API

For the frontend team. This covers the endpoints added for the objective
lifecycle, evidence, the approval workflow, the audit trail, and the resilience
layer. The core CRUD endpoints are in OKR_API_HANDOFF.md; this document is the
governance half.

Base URL: `/api/okr` (or `/api/v1/okr`). All endpoints need
`Authorization: Bearer <token>` unless stated otherwise.

Verified against the automated suite on 30 July 2026: 36 tests, all passing.

## The rule that shapes the UI: weights must total exactly 100

The client's requirement is that key result weights under an objective total
100%. Enforcing that on every save would make it impossible to add the first key
result, so the rule is enforced at publication instead.

An objective has a `lifecycle`:

- `draft` while it is being built. Weights may be partial. This is where the
  user adds key results one at a time.
- `active` once published. Getting here requires the weights to total exactly
  100.
- `closed` when it is finished or abandoned.

Build your create flow around that. Let the user assemble a draft freely, show
them how much weight is left, and only enable Publish when the objective is
ready.

### GET /objectives/:id/readiness

Poll this while the user edits so the Publish button reflects reality.

```json
{
  "objectiveId": "6890...",
  "lifecycle": "draft",
  "weightTotal": 90,
  "weightRemaining": 10,
  "keyResultCount": 2,
  "canActivate": false,
  "blockers": ["Weights total 90%, 10% still to allocate"],
  "yourAccess": "owner"
}
```

`blockers` are written for a person, so show them as-is. `yourAccess` is one of
`admin`, `owner`, `manager` or `staff`, which tells you which controls to render.

### POST /objectives/:id/activate

No body. Success:

```json
{ "success": true, "objective": { "...": "...", "lifecycle": "active" }, "weightTotal": 100 }
```

Refused when the weights are wrong:

```json
{
  "success": false,
  "message": "Key result weights total 90%. They must total exactly 100% before this objective can be activated.",
  "code": "WEIGHTS_NOT_100",
  "currentTotal": 90,
  "difference": 10
}
```

`difference` is positive when weight is missing and negative when it is over, so
you can write "add 10%" or "remove 5%" without doing the arithmetic yourself.
Other code: `NO_KEY_RESULTS`.

### POST /objectives/:id/close

No body. Returns the closed objective.

## Evidence

A key result cannot be submitted for approval without at least one piece of
evidence. Four kinds:

| kind | what to send | used for |
|---|---|---|
| `calendar` | `ref` = calendar entry id | the usual case: completed calendar work |
| `file` | `ref` = file id | an uploaded document |
| `link` | `value` = URL | something in another system |
| `note` | `value` = text | a written explanation |

### POST /key-results/:id/evidence

```json
{ "kind": "calendar", "ref": "6891...", "label": "Client workshop, 12 August" }
```

Returns `201` with the updated key result. A `calendar` reference that does not
resolve returns `404`, so you cannot attach proof that is not there. `link` and
`note` without a `value` return `400`.

Evidence appears on the key result as:

```json
{
  "evidence": [
    {
      "kind": "calendar",
      "ref": "6891...",
      "value": "",
      "label": "Client workshop, 12 August",
      "addedBy": "6890...",
      "addedAt": "2026-07-30T09:14:00.000Z"
    }
  ]
}
```

## Approval workflow

`approvalState` on a key result moves through four values:

`draft` → `pending` → `approved`, or `pending` → `rejected` → back to `pending`
when the owner revises and resubmits.

The boolean `approved` is kept in step with `approvalState` so any existing code
reading it keeps working. Prefer `approvalState` in new screens.

### POST /key-results/:id/submit

No body. Any user who can update the key result may submit it.

Refused without evidence:

```json
{
  "success": false,
  "message": "Attach at least one piece of evidence before submitting for approval",
  "code": "EVIDENCE_REQUIRED"
}
```

### POST /key-results/:id/review

Manager or admin only.

```json
{ "decision": "rejected", "note": "The evidence does not cover the second half of the quarter" }
```

A rejection without a `note` is refused with `REVIEW_NOTE_REQUIRED`. Rejecting
someone's work without saying why just creates another meeting, so the API
insists.

Someone cannot approve a key result they submitted themselves, even if they are
a manager:

```json
{
  "success": false,
  "message": "You cannot review this key result. Approvals need a manager who did not submit it.",
  "code": "SELF_APPROVAL_BLOCKED"
}
```

Hide the review controls when `submittedBy` matches the current user, so nobody
meets that error by surprise.

After a decision the key result carries `approvedBy`, `approvedAt` and
`reviewNote`. Show the note prominently on a rejected key result: it is the
instruction for what to fix.

## Access tiers

Four tiers, returned as `yourAccess` on the readiness endpoint.

| tier | can do |
|---|---|
| `admin` | everything, including other people's objectives |
| `owner` | full control of the objective they own and its key results |
| `manager` | create and edit objectives, review key results |
| `staff` | read what they can see, update progress and submit evidence on their own work |

Render controls from this rather than guessing from the role name. The server
enforces every rule independently, so a hidden button is convenience, not
security.

## Audit trail

### GET /objectives/:id/audit?limit=50

Every state change on an objective and its key results, newest first.

```json
{
  "count": 3,
  "entries": [
    {
      "action": "keyresult.rejected",
      "entityType": "keyresult",
      "actor": { "firstName": "Mia", "lastName": "Manager" },
      "before": { "approvalState": "pending" },
      "after": { "approvalState": "rejected" },
      "message": "Rejected \"Sign 20 customers\": evidence does not cover August",
      "severity": "warning",
      "createdAt": "2026-07-30T09:20:00.000Z"
    }
  ]
}
```

`message` is written to be read by a person, so render it directly. `severity` is
`info`, `repair` or `warning`; colour accordingly. Entries are append-only, so
there is no edit or delete for them.

`repair` entries come from the self-healing layer rather than a person, and
`actor` will be null on those.

## Resilience

The Maxbox calendar sits on customer premises and is not always reachable. The
backend handles that rather than passing the failure to you, but two things
surface in the UI.

### Degraded data

When the calendar is unreachable the backend serves the last known state from
its own database instead of failing. Responses that came from cache are marked,
so label them rather than presenting stale numbers as live.

### GET /system/resilience

```json
{
  "calendar": {
    "configured": true,
    "url": "http://maxbox.local",
    "breaker": {
      "name": "maxbox-calendar",
      "state": "open",
      "failures": 3,
      "openedAt": "2026-07-30T09:00:00.000Z",
      "lastError": "maxbox-calendar timed out after 5000ms",
      "stats": { "calls": 40, "failures": 3, "rejections": 12, "fallbacks": 15 }
    },
    "queuedWrites": 4
  },
  "checkedAt": "2026-07-30T09:22:00.000Z"
}
```

`state` is `closed` (healthy), `open` (unreachable, serving cache) or
`half-open` (testing recovery). `queuedWrites` are progress updates recorded
during the outage that will be delivered when the box returns; nothing is lost.

An admin screen showing this, plus a retry button hitting
`POST /system/flush-calendar-queue` (manager or admin), covers the support
conversation that starts with "the numbers look wrong".

## Self-healing

Reads of a single objective run a repair pass first. If a calendar entry was
deleted, or a key result was assigned to a user who no longer exists, or a
parent objective is gone, the backend detaches the dead reference, recalculates
what depended on it, and logs a `repair` entry. The request then succeeds
normally instead of returning a 500.

When something was repaired the response carries a header:

```
X-OKR-Repairs: 2
```

You can ignore it, or use it to refresh a stale view. Nothing is silently lost:
every repair is in the audit trail with its before and after values.

## Error codes

| code | meaning |
|---|---|
| `WEIGHTS_NOT_100` | Activation refused, weights do not total 100 |
| `NO_KEY_RESULTS` | Activation refused, nothing to measure |
| `EVIDENCE_REQUIRED` | Submission refused, attach evidence first |
| `REVIEW_NOTE_REQUIRED` | Rejection refused, give a reason |
| `SELF_APPROVAL_BLOCKED` | You submitted this, so you cannot review it |

Every error response carries a `message` written for an end user. Show it rather
than a generic failure notice.

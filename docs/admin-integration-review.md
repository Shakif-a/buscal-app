# Admin frontend integration review

Branch: integration/admin-hamim-prova-20260912
Base: hamim/admin-permissions-groups at 88fd0054bdee9505a9f31235f33950e645e256fd
Reviewed frontend branch: prova/navigation-frontend at c3aae50d08efe03a74603083d5cb8e1794c2a7b5

## Integration decision

Git ancestry confirms that Prova's branch is already included in the base branch.
The base also already contains her admin page layout, CSS, and removal of the
unused navigation profile icon. A second merge or copying her older JavaScript
would remove functional API integration. This branch keeps that existing work
and fixes the remaining frontend issues.

No backend, API service, authentication, permission middleware, or database model
was changed. No hardcoded groups or users, fake Add Users action, fake Add Role
action, or local-only role save was introduced into the application.

## Changes

- Role editing is available only after saved permissions load successfully.
- Group creation is disabled until users and groups load successfully.
- Pending saves disable conflicting edits and duplicate submissions. Failed saves
  retain the draft and display the API error without a success confirmation.
- Reset to defaults clearly identifies its draft-only behavior until saved.
- The permission reference no longer claims managers have full Admin access. It
  explains objective ownership, group management, and the limits of other saved
  permission labels without changing enforcement.
- Prova's styles are retained, with unused prototype styles removed and logo and
  popup selectors scoped to avoid affecting unrelated pages.
- Native checkbox focus is visible, search fields have accessible names, and
  navigation dropdowns support keyboard activation and Escape.
- Cypress regression tests exercise the real admin components, navigation,
  Redux user state, and API service with intercepted responses.

## Verification

- Backend: `cd backend && npm test` passes all 40 tests. This includes admin and
  executive access, manager restrictions, group-scoped manager permissions,
  objective edit/delete authorization, owner access, saved permission overrides,
  route authentication, model save calls, and objective/key-result deletion.
- Frontend: `cd frontend && npm test` passes all 3 service contract tests.
- Production: `cd frontend && npm run build` passes. Vite reports a large bundle
  warning; code splitting is outside this integration's scope.
- Browser: `cd frontend && npm run test:ui -- --browser electron` passes all 11
  tests with the local frontend running on port 4173. Coverage includes create,
  save, cancel, reload, search, load/save failures, pending controls, reset drafts,
  keyboard navigation, admin/executive access, and denied manager/employee access.

To repeat browser verification, run `npm run dev -- --port 4173` from frontend in
one terminal, then `npm run test:ui -- --browser electron` in another. Install the
project's existing frontend dependencies and Cypress browser first if needed.
The test-only fixture lives under cypress/fixtures and is not an application route
or part of the production bundle. Its named users and groups are test data only.

## Limits and review status

Ready for code review, with live environment testing still required before a
production merge. Browser reload checks use a stateful API mock; they do not
prove MongoDB durability. Backend tests exercise controllers, middleware, HTTP
routes, and model calls with mocked database operations. No configured backend
.env was available, so no live database or deployed end-to-end session was used.
The browser fixture isolates the admin pages and their shared navigation; it
does not exercise the entire dashboard shell or a real login session.

Existing behavior remains: only Create Objectives and Edit Objectives are wired
into the objective permission checks. Other stored permission labels do not
independently grant or revoke their named features. Admin pages still require an
administrator or executive regardless of saved Manage Roles/Manage Groups labels.

The integration is committed locally. Nothing is merged to main or pushed, and
no pull request or teammate branch is changed.

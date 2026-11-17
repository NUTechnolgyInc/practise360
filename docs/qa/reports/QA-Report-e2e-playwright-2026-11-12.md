# QA Report — Practise360 — End-to-end (Playwright) — 2026-11-12

**Environment**: http://localhost:3200 (production build) / http://localhost:4100 — isolated `practise360_e2e` database, re-seeded for the run
**Plan**: docs/qa/plans/e2e-playwright-2026-11-12.md
**Approved by**: Rishav — request on 2026-11-12 to write, implement and run the cases and send the report
**Tester**: Claude (automated Playwright pass), triggered by Rishav
**Build**: `bafecad` + uncommitted working tree (contributions, usage reports and access-control changes on `feat/ui-kit`)
**Run**: 2026-11-12 08:32 UTC, 59s, Chromium, 1 worker. Re-run twice with identical results (0 flaky).

## Summary
280 run — 276 passed, 4 failed, 0 skipped (99% pass rate)

Every failure is a real defect in the app, not in the tests. No permission, isolation or security check failed.

| Area | Passed |
|---|---|
| Platform & HTTP (API) | 5/6 ❌ |
| Authentication (API) | 19/19 |
| Access control & RBAC (API) | 42/42 |
| Practice contributions (API) | 56/58 ❌ |
| AI Tracker usage reports (API) | 29/29 |
| Login & session (UI) | 19/20 ❌ |
| Navigation, app visibility & settings (UI) | 25/25 |
| Access control portal (UI) | 16/16 |
| Contributions, single user (UI) | 27/27 |
| Review workflow, multi-user (UI) | 9/9 |
| AI Tracker (UI) | 15/15 |
| Mobile & keyboard (UI) | 14/14 |

## Defects Found

1. **Expired session isn't handled — users see a misleading page instead of being asked to sign in** — Major (UX) — AUTH-UI-15
   - Repro: sign in as `de.dev1`, open Practices, let the 8-hour token expire (simulated by swapping in an expired token), click **Start a contribution**.
   - Expected: sent to /login (or told the session expired).
   - Actual: stays on the page and shows *"You can't start a contribution — You need to be a member of a practice"*. Other screens show "Session expired" as a load error with no way back except signing out manually.
   - Suspected area: `apps/web/lib/api.js` / `components/auth/session-provider.js` — only the initial `/me` call clears the token on 401; every other `api()` call just throws. Clear the token and route to /login on any 401.
2. **Malformed JSON request body returns 500 "Something went wrong"** — Minor — PLAT-03
   - Repro: `POST /auth/login` with `Content-Type: application/json` and a truncated body.
   - Expected: 400. Actual: 500, logged as a server error (noise in logs and alerting).
   - Suspected area: `apps/api/src/app.js` error handler handles `entity.too.large` but not `entity.parse.failed`.
3. **Impossible calendar dates are accepted and silently shifted** — Minor — CON-API-02 (Feb 31 case)
   - Repro: `POST /contributions` with `dueDate: "2027-02-31"`.
   - Expected: 400. Actual: 201, stored as 3 March 2027.
   - Suspected area: `parseDate()` in `apps/api/src/routes/contributions.js` only checks the `YYYY-MM-DD` prefix and relies on `new Date()`, which rolls over. Check the parsed date round-trips to the same string. (The web date picker can't produce this; direct API callers can.)
4. **Descriptions over 200,000 characters are cut without warning** — Minor (data loss) — CON-API-42
   - Repro: create or edit a contribution with a 210,000-character description (e.g. a long imported document).
   - Expected: a clear error, or the full text kept. Actual: 201 and the last 10,000 characters are dropped silently.
   - Suspected area: `str(..., 200000)` in `apps/api/src/routes/contributions.js` truncates; the same pattern silently cuts summary/impact at 10,000 and progress updates at 50,000. Reject over-length input with 400 and show a limit in the editor.

## Results

### Platform & HTTP (API) — 5/6 passed

| ID | Scenario | Status |
|---|---|---|
| PLAT-01 | health and root endpoints respond | ✅ Pass |
| PLAT-02 | unknown route returns a JSON 404, not an HTML error page | ✅ Pass |
| PLAT-03 | malformed JSON body is rejected as a client error (400), not a server crash | ❌ Fail |
| PLAT-04 | JSON body over the 1 MB limit gets 413 with a readable message | ✅ Pass |
| PLAT-05 | CORS allows the configured web origin and no other | ✅ Pass |
| PLAT-06 | OpenAPI spec and Swagger UI are served | ✅ Pass |

### Authentication (API) — 19/19 passed

| ID | Scenario | Status |
|---|---|---|
| AUTH-API-01 | valid username + password returns a JWT that opens /me | ✅ Pass |
| AUTH-API-02 | username is case-insensitive and surrounding spaces are ignored | ✅ Pass |
| AUTH-API-03 | wrong password is rejected with 401 | ✅ Pass |
| AUTH-API-04 | unknown username gets the same message as a wrong password (no user enumeration) | ✅ Pass |
| AUTH-API-05 | password is case-sensitive | ✅ Pass |
| AUTH-API-06 | missing password → 400 | ✅ Pass |
| AUTH-API-06 | missing username → 400 | ✅ Pass |
| AUTH-API-06 | empty strings → 400 | ✅ Pass |
| AUTH-API-06 | empty body → 400 | ✅ Pass |
| AUTH-API-07 | NoSQL-injection style username object does not log anyone in | ✅ Pass |
| AUTH-API-08 | /auth/config advertises dev login and lists demo users without secrets | ✅ Pass |
| AUTH-API-09 | Google sign-in is a 501 stub | ✅ Pass |
| AUTH-API-10 | /me without a token → 401 Not signed in | ✅ Pass |
| AUTH-API-11 | garbage token → 401 | ✅ Pass |
| AUTH-API-12 | token signed with a different secret (forged) → 401 | ✅ Pass |
| AUTH-API-13 | expired token → 401 Session expired | ✅ Pass |
| AUTH-API-14 | validly signed token for a user that doesn't exist → 401 Account not available | ✅ Pass |
| AUTH-API-15 | alg=none token is rejected | ✅ Pass |
| AUTH-API-16 | /me returns grants, visible apps and practices for a multi-role user | ✅ Pass |

### Access control & RBAC (API) — 42/42 passed

| ID | Scenario | Status |
|---|---|---|
| RBAC-API-01 | Super Admin sees every active user and all their assignments | ✅ Pass |
| RBAC-API-02 | cert.admin (no member/role permissions) is refused the directory → 403 | ✅ Pass |
| RBAC-API-02 | aitracker.admin (no member/role permissions) is refused the directory → 403 | ✅ Pass |
| RBAC-API-02 | aitracker.member (no member/role permissions) is refused the directory → 403 | ✅ Pass |
| RBAC-API-03 | a practitioner sees the directory but only assignments inside their own practice | ✅ Pass |
| RBAC-API-04 | Practice Manager can grant Lead / Practitioner / custom roles in their practice only — never Practice Manager | ✅ Pass |
| RBAC-API-05 | Practices Admin can appoint Practice Managers in every practice but not platform/app admins | ✅ Pass |
| RBAC-API-06 | a Practice Lead has nothing to grant | ✅ Pass |
| RBAC-API-07 | Practice Manager grants Practitioner in their practice, then revokes it | ✅ Pass |
| RBAC-API-08 | granting the same role at the same scope twice → 409 | ✅ Pass |
| RBAC-API-09 | Practice Manager cannot appoint another Practice Manager (assignableFrom: app) | ✅ Pass |
| RBAC-API-10 | Practice Manager cannot grant roles in a different practice | ✅ Pass |
| RBAC-API-11 | Practice Lead cannot grant anything | ✅ Pass |
| RBAC-API-12 | custom-role holder with roles.assign still can't grant a role holding permissions they lack | ✅ Pass |
| RBAC-API-13 | Practices Admin appoints a Practice Manager in QA, then revokes | ✅ Pass |
| RBAC-API-14 | Practices Admin cannot create a Super Admin | ✅ Pass |
| RBAC-API-15 | AI Admin cannot add AI Members (needs platform.apps.assign — rbac.md §5) | ✅ Pass |
| RBAC-API-16 | a grant opens the app immediately and a revoke closes it on the very next request | ✅ Pass |
| RBAC-API-17 | a role can only be granted at its own scope type / scope | ✅ Pass |
| RBAC-API-18 | bad grant input: invalid user id, unknown user, unknown role, unknown practice | ✅ Pass |
| RBAC-API-19 | revoking is guarded like granting: a Manager can't remove a Manager (theirs or another practice's) | ✅ Pass |
| RBAC-API-20 | the last Super Admin assignment can't be removed | ✅ Pass |
| RBAC-API-21 | revoking an invalid or unknown assignment id → 404 | ✅ Pass |
| RBAC-API-22 | Practice Manager creates, renames and deletes a custom role in their practice | ✅ Pass |
| RBAC-API-23 | Practice Manager cannot create a custom role in another practice; a Lead can't create one at all | ✅ Pass |
| RBAC-API-24 | custom role can't contain platform.users.manage (outside the practice-scoped subset) → 400 | ✅ Pass |
| RBAC-API-24 | custom role can't contain practices.practice.create (outside the practice-scoped subset) → 400 | ✅ Pass |
| RBAC-API-24 | custom role can't contain practices.practice.archive (outside the practice-scoped subset) → 400 | ✅ Pass |
| RBAC-API-24 | custom role can't contain cert.catalog.manage (outside the practice-scoped subset) → 400 | ✅ Pass |
| RBAC-API-25 | custom role validation: blank name → 400 | ✅ Pass |
| RBAC-API-25 | custom role validation: no permissions → 400 | ✅ Pass |
| RBAC-API-25 | custom role validation: unknown practice → 400 | ✅ Pass |
| RBAC-API-26 | a custom role that is still assigned can't be deleted (409) | ✅ Pass |
| RBAC-API-27 | system roles can't be deleted; unknown roles → 404 | ✅ Pass |
| RBAC-API-28 | custom roles are only visible inside their practice | ✅ Pass |
| RBAC-API-29 | a practitioner (no roles.view) can't list roles or the catalog | ✅ Pass |
| RBAC-API-30 | only Super Admin may edit a system role | ✅ Pass |
| RBAC-API-31 | Super Admin role itself is locked (prevents lock-out) | ✅ Pass |
| RBAC-API-32 | platform.* permissions are refused on a practice-scope system role | ✅ Pass |
| RBAC-API-33 | unknown permission keys and empty permission lists are refused | ✅ Pass |
| RBAC-API-34 | Super Admin edits a system role's description (then restores it) | ✅ Pass |
| RBAC-API-35 | widening Practice Manager beyond Practices Admin stops Practices Admin appointing Managers (rbac.md §4) | ✅ Pass |

### Practice contributions (API) — 56/58 passed

| ID | Scenario | Status |
|---|---|---|
| CON-API-01 | practitioner starts a contribution in their practice | ✅ Pass |
| CON-API-02 | create rejects blank title → 400 | ✅ Pass |
| CON-API-02 | create rejects unknown type → 400 | ✅ Pass |
| CON-API-02 | create rejects 'other' without a custom label → 400 | ✅ Pass |
| CON-API-02 | create rejects missing due date → 400 | ✅ Pass |
| CON-API-02 | create rejects non-ISO date → 400 | ✅ Pass |
| CON-API-02 | create rejects garbage after the date → 400 | ✅ Pass |
| CON-API-02 | create rejects impossible calendar date (Feb 31) → 400 | ❌ Fail |
| CON-API-02 | create rejects due date before start date → 400 | ✅ Pass |
| CON-API-03 | 'other' type keeps its custom label; over-long titles are cut to 120 chars | ✅ Pass |
| CON-API-04 | same-day start and due date is allowed (boundary) | ✅ Pass |
| CON-API-05 | practitioner can't start a contribution in another practice | ✅ Pass |
| CON-API-06 | cert.admin (no contribution permissions) can neither list nor create | ✅ Pass |
| CON-API-06 | aitracker.member (no contribution permissions) can neither list nor create | ✅ Pass |
| CON-API-06 | de.coordinator (no contribution permissions) can neither list nor create | ✅ Pass |
| CON-API-07 | unauthenticated requests are refused | ✅ Pass |
| CON-API-08 | another practice gets 404 (not 403) so the contribution's existence isn't leaked | ✅ Pass |
| CON-API-09 | the whole practice can see it; Practices Admin and Super Admin see every practice | ✅ Pass |
| CON-API-10 | list filters: practice, status, type, mine, search (regex characters are treated literally) | ✅ Pass |
| CON-API-11 | malformed or unknown ids → 404 | ✅ Pass |
| CON-API-12 | invite picker lists only members of that practice; other practices → 403 | ✅ Pass |
| CON-API-13 | a practice member who isn't the owner or a contributor can't edit or log progress | ✅ Pass |
| CON-API-14 | owner edits details; invalid edits are refused | ✅ Pass |
| CON-API-15 | progress updates: empty body refused, attached files become permanent | ✅ Pass |
| CON-API-16 | a Lead (manage permission) can log progress on any contribution in the practice | ✅ Pass |
| CON-API-17 | PDFs are served inline; HTML is forced to download with nosniff (no stored XSS) | ✅ Pass |
| CON-API-18 | file names are sanitised (no path traversal or header injection) | ✅ Pass |
| CON-API-19 | empty upload → 400; over 4 MB → 413 | ✅ Pass |
| CON-API-20 | files of another practice's contribution can't be fetched; unknown file ids → 404 | ✅ Pass |
| CON-API-21 | a contributor can't remove a file the owner uploaded; the owner can | ✅ Pass |
| CON-API-22 | happy path: practitioner submits → Lead approves → Manager approves → published | ✅ Pass |
| CON-API-23 | submit refused: no summary | ✅ Pass |
| CON-API-23 | submit refused: no impact | ✅ Pass |
| CON-API-23 | submit refused: no documents | ✅ Pass |
| CON-API-23 | submit refused: javascript: repo link | ✅ Pass |
| CON-API-23 | submit refused: ftp demo link | ✅ Pass |
| CON-API-23 | submit refused: bad extra link | ✅ Pass |
| CON-API-24 | submit refused without a description, and file ids from another contribution don't count | ✅ Pass |
| CON-API-25 | only the owner can submit — not a contributor or the Lead | ✅ Pass |
| CON-API-26 | nobody reviews their own work: a Lead-owned contribution is reviewed by the Manager, who then can't also approve | ✅ Pass |
| CON-API-27 | a practitioner can't review, and a Lead can't give final approval | ✅ Pass |
| CON-API-28 | decline and clarify need a comment; unknown decisions are refused | ✅ Pass |
| CON-API-29 | clarification round-trip returns to the reviewer who asked (Lead stage, then Manager stage) | ✅ Pass |
| CON-API-30 | decline closes the contribution for good | ✅ Pass |
| CON-API-31 | reviewing something that isn't waiting for review → 409 | ✅ Pass |
| CON-API-32 | 'awaiting my review' queue shows the item to the right reviewer only | ✅ Pass |
| CON-API-33 | invite → accept makes a contributor who can edit and log progress but not submit | ✅ Pass |
| CON-API-34 | invite validation: outsiders, duplicates and existing contributors are refused | ✅ Pass |
| CON-API-35 | declining an invite and withdrawing one both clear it | ✅ Pass |
| CON-API-36 | join request → owner accepts; duplicate requests are refused; the requester can cancel | ✅ Pass |
| CON-API-37 | owner rejects a join request; answering a request that doesn't exist → 404 | ✅ Pass |
| CON-API-38 | inviting someone who already asked to join adds them straight away | ✅ Pass |
| CON-API-39 | nobody can join once it's in review, and other practices can't ask at all | ✅ Pass |
| CON-API-40 | contributors can leave; the owner can't 'leave'; the owner can remove a contributor | ✅ Pass |
| CON-API-41 | a contributor can't review the contribution they work on, even as a Lead | ✅ Pass |
| CON-API-42 | an over-long description is refused, not silently cut (no data loss) | ❌ Fail |
| CON-API-43 | clients can't set owner, status or practice through create/edit (mass assignment) | ✅ Pass |
| CON-API-44 | unicode and emoji titles round-trip and are searchable | ✅ Pass |

### AI Tracker usage reports (API) — 29/29 passed

| ID | Scenario | Status |
|---|---|---|
| AI-API-01 | practitioner uploads a PDF for a past month and sees it in their list | ✅ Pass |
| AI-API-02 | uploading again for the same month replaces the report (one per month) | ✅ Pass |
| AI-API-03 | the current month is accepted (not in the future) | ✅ Pass |
| AI-API-04 | period "NEXT" is refused → 400 | ✅ Pass |
| AI-API-04 | period "2026-13" is refused → 400 | ✅ Pass |
| AI-API-04 | period "2026-00" is refused → 400 | ✅ Pass |
| AI-API-04 | period "2026-1" is refused → 400 | ✅ Pass |
| AI-API-04 | period "26-01" is refused → 400 | ✅ Pass |
| AI-API-04 | period "abcd-ef" is refused → 400 | ✅ Pass |
| AI-API-04 | period "2026-10-01" is refused → 400 | ✅ Pass |
| AI-API-05 | a non-PDF file renamed with a PDF content type is rejected by its magic bytes | ✅ Pass |
| AI-API-06 | a real PDF sent with the wrong content type is refused | ✅ Pass |
| AI-API-07 | a PDF over 4 MB → 413 | ✅ Pass |
| AI-API-08 | a PDF just under 4 MB is accepted (boundary) | ✅ Pass |
| AI-API-09 | delete own report → 204; deleting again → 404 | ✅ Pass |
| AI-API-10 | file names are sanitised | ✅ Pass |
| AI-API-11 | users without AI permissions can't use reports at all | ✅ Pass |
| AI-API-12 | Practice Manager's team view is exactly their practice | ✅ Pass |
| AI-API-13 | a member of two practices shows up for both Managers | ✅ Pass |
| AI-API-14 | AI Admin sees everyone expected to submit, including people with no practice; Super Admin isn't expected | ✅ Pass |
| AI-API-15 | Practices Admin sees every practice member but not AI-only members | ✅ Pass |
| AI-API-16 | de.lead (no ai.usage.view) can't open the team view | ✅ Pass |
| AI-API-16 | de.dev1 (no ai.usage.view) can't open the team view | ✅ Pass |
| AI-API-16 | aitracker.member (no ai.usage.view) can't open the team view | ✅ Pass |
| AI-API-17 | team view needs a valid, non-future period | ✅ Pass |
| AI-API-18 | submitted / pending summary follows uploads | ✅ Pass |
| AI-API-19 | PDF access: owner, their Manager and AI Admin yes; same-practice Lead and other Managers no | ✅ Pass |
| AI-API-20 | unknown or malformed report ids → 404 | ✅ Pass |
| AI-API-21 | a multi-practice member's report is readable by both of their Managers | ✅ Pass |

### Login & session (UI) — 19/20 passed

| ID | Scenario | Status |
|---|---|---|
| AUTH-UI-01 | login page shows the form; Sign in stays disabled until both fields are filled | ✅ Pass |
| AUTH-UI-02 | valid credentials land on Home with a personal welcome | ✅ Pass |
| AUTH-UI-03 | wrong password shows an inline error and keeps the user on /login | ✅ Pass |
| AUTH-UI-04 | unknown user gets the same error (no hint which usernames exist) | ✅ Pass |
| AUTH-UI-05 | retry after a failed attempt succeeds and clears the error | ✅ Pass |
| AUTH-UI-06 | mixed-case username with spaces still signs in | ✅ Pass |
| AUTH-UI-07 | pressing Enter in the password field submits the form | ✅ Pass |
| AUTH-UI-08 | picking a demo user fills the form, and signing in works | ✅ Pass |
| AUTH-UI-09 | 'Continue with Google' explains it isn't available yet | ✅ Pass |
| AUTH-UI-10 | signed-out visit to / redirects to /login | ✅ Pass |
| AUTH-UI-10 | signed-out visit to /settings redirects to /login | ✅ Pass |
| AUTH-UI-10 | signed-out visit to /practices redirects to /login | ✅ Pass |
| AUTH-UI-10 | signed-out visit to /access-control redirects to /login | ✅ Pass |
| AUTH-UI-10 | signed-out visit to /ai-tracker redirects to /login | ✅ Pass |
| AUTH-UI-10 | signed-out visit to /practices/contributions/new redirects to /login | ✅ Pass |
| AUTH-UI-11 | a signed-in user opening /login is sent to Home | ✅ Pass |
| AUTH-UI-12 | sign out from the user menu clears the session; Back and reload don't restore it | ✅ Pass |
| AUTH-UI-13 | an expired or tampered token in storage is discarded and the user is asked to sign in | ✅ Pass |
| AUTH-UI-14 | user menu closes with Escape and shows every role for a multi-role user | ✅ Pass |
| AUTH-UI-15 | a session that expires while the tab is open sends the user back to sign in | ❌ Fail |

### Navigation, app visibility & settings (UI) — 25/25 passed

| ID | Scenario | Status |
|---|---|---|
| NAV-01 | superadmin: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | practices.admin: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | de.manager: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | de.lead: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | de.dev1: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | de.coordinator: Home shows exactly Practices, Certification Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | cert.admin: Home shows exactly Certification Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | aitracker.admin: Home shows exactly AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | aitracker.member: Home shows exactly AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-01 | multi.user: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | ✅ Pass |
| NAV-02 | apps that aren't built yet are marked 'Coming soon' and aren't links | ✅ Pass |
| NAV-03 | a custom role that opens Practices without contribution access gets no dead-end link | ✅ Pass |
| NAV-04 | app tiles open the app | ✅ Pass |
| NAV-05 | the current page is highlighted in the sidebar | ✅ Pass |
| NAV-06 | sidebar collapses to icons and expands again | ✅ Pass |
| NAV-07 | cert.admin opening /practices sees "Access restricted", not a crash | ✅ Pass |
| NAV-07 | cert.admin opening /ai-tracker sees "Access restricted", not a crash | ✅ Pass |
| NAV-07 | de.dev1 opening /access-control sees "Access restricted", not a crash | ✅ Pass |
| NAV-07 | aitracker.member opening /practices/contributions/new sees "Access restricted", not a crash | ✅ Pass |
| NAV-07 | de.coordinator opening /practices sees "Access restricted", not a crash | ✅ Pass |
| NAV-07 | cert.admin opening /access-control sees "Access restricted", not a crash | ✅ Pass |
| NAV-08 | an unknown URL shows the 404 page | ✅ Pass |
| SET-01 | shows the account and that it's a dev-password session | ✅ Pass |
| SET-02 | a multi-role user sees one row per assignment with its scope and permissions | ✅ Pass |
| SET-03 | Super Admin's wildcard permission is spelled out | ✅ Pass |

### Access control portal (UI) — 16/16 passed

| ID | Scenario | Status |
|---|---|---|
| AC-UI-01 | Super Admin sees every user, can search by name or username, and gets an empty state for no match | ✅ Pass |
| AC-UI-02 | Practice Manager's grant form only offers their practice and never 'Practice Manager' | ✅ Pass |
| AC-UI-03 | Practice Manager grants a role, sees it immediately, then removes it after confirming | ✅ Pass |
| AC-UI-04 | granting a role the user already has shows the conflict instead of duplicating it | ✅ Pass |
| AC-UI-05 | a Manager can't remove a fellow Manager: no remove button on Manager assignments | ✅ Pass |
| AC-UI-06 | a Lead can look but not change: View buttons and an explanation instead of the grant form | ✅ Pass |
| AC-UI-07 | the Manage dialog closes with Escape and with the close button | ✅ Pass |
| AC-UI-08 | Practices Admin picks a practice first, then sees only roles grantable there | ✅ Pass |
| AC-UI-09 | tabs are reflected in the URL and an unknown tab falls back to Users | ✅ Pass |
| AC-UI-10 | permission matrix marks what each role carries | ✅ Pass |
| AC-UI-11 | Practice Manager creates a custom role, sees it listed, then deletes it | ✅ Pass |
| AC-UI-12 | a blank (spaces-only) custom role name can't be saved | ✅ Pass |
| AC-UI-13 | deleting a custom role that's still assigned explains why it can't | ✅ Pass |
| AC-UI-14 | only Super Admin gets edit buttons on system roles, and Super Admin itself is locked | ✅ Pass |
| AC-UI-15 | Super Admin's system-role editor warns about the escalation guard and keeps platform.* off practice roles | ✅ Pass |
| AC-UI-16 | a Lead (roles.view only) sees roles but no 'New custom role' button | ✅ Pass |

### Contributions, single user (UI) — 27/27 passed

| ID | Scenario | Status |
|---|---|---|
| CON-UI-01 | practitioner starts a contribution and lands on its page | ✅ Pass |
| CON-UI-02 | submitting an empty form shows every problem inline and creates nothing | ✅ Pass |
| CON-UI-03 | a title of only spaces is treated as empty | ✅ Pass |
| CON-UI-04 | 'Other' reveals a required custom type field | ✅ Pass |
| CON-UI-05 | due date before the start date is caught before saving | ✅ Pass |
| CON-UI-06 | Markdown description previews and renders on the contribution page | ✅ Pass |
| CON-UI-07 | Cancel goes back to the list without creating anything | ✅ Pass |
| CON-UI-08 | search, type filter and Clear narrow the list; no match shows a friendly empty state | ✅ Pass |
| CON-UI-09 | search also matches the owner's name | ✅ Pass |
| CON-UI-10 | practitioners get All and Mine; reviewers also get 'Awaiting my review' | ✅ Pass |
| CON-UI-11 | overdue work is flagged in the list and on its page, and can be filtered | ✅ Pass |
| CON-UI-12 | someone who sees several practices gets a Practice column and filter | ✅ Pass |
| CON-UI-13 | someone in a practice with no contributions sees the 'No contributions yet' state | ✅ Pass |
| CON-UI-14 | another practice's contribution (or a bad id) shows 'Contribution not found' | ✅ Pass |
| CON-UI-15 | edit details: a blank title is refused, a new title is saved | ✅ Pass |
| CON-UI-16 | edit the description in the Markdown editor | ✅ Pass |
| CON-UI-17 | log progress: Post is disabled until something is written; the update appears newest-first | ✅ Pass |
| CON-UI-18 | upload a document, then remove it after confirming | ✅ Pass |
| CON-UI-19 | a file over 4 MB is refused in the browser before uploading | ✅ Pass |
| CON-UI-20 | submit for review: every missing requirement is listed and nothing is submitted | ✅ Pass |
| CON-UI-21 | a practice member who isn't on the contribution can ask to join but not edit or submit | ✅ Pass |
| CON-UI-22 | HTML and script in a description are shown as text, never executed | ✅ Pass |
| CON-UI-23 | documents open from their chip (PDF opens in a new tab) | ✅ Pass |
| CON-UI-24 | double-clicking 'Start contribution' creates exactly one contribution | ✅ Pass |
| CON-UI-25 | someone who can start contributions in several practices must pick one | ✅ Pass |
| CON-UI-26 | importing a Markdown file replaces the description and switches to Preview | ✅ Pass |
| CON-UI-27 | importing an unsupported file type explains which formats work | ✅ Pass |

### Review workflow, multi-user (UI) — 9/9 passed

| ID | Scenario | Status |
|---|---|---|
| WF-UI-01 | practitioner submits → Lead approves → Manager approves & publishes | ✅ Pass |
| WF-UI-02 | Lead asks for clarification; owner must reply before resubmitting; it returns to the Lead | ✅ Pass |
| WF-UI-03 | a declined contribution is closed for the owner | ✅ Pass |
| WF-UI-04 | the owner never gets a Review button on their own work; the Manager takes the Lead step | ✅ Pass |
| WF-UI-05 | closing the review dialog with Cancel records nothing | ✅ Pass |
| WF-UI-06 | ask to join → owner accepts → the new contributor can log progress and leave | ✅ Pass |
| WF-UI-07 | a join request can be cancelled by the requester | ✅ Pass |
| WF-UI-08 | owner invites a practice member, who declines; the invite picker only lists practice members | ✅ Pass |
| WF-UI-09 | invitee accepts; owner removes them after confirming | ✅ Pass |

### AI Tracker (UI) — 15/15 passed

| ID | Scenario | Status |
|---|---|---|
| AI-UI-01 | a practitioner sees the skill, the upload form and an empty history — no Team tab | ✅ Pass |
| AI-UI-02 | the skill download link really serves the zip | ✅ Pass |
| AI-UI-03 | upload a PDF: it's listed, and the form switches to 'Replace report' | ✅ Pass |
| AI-UI-04 | uploading again for the same month replaces it (still one row) | ✅ Pass |
| AI-UI-05 | pressing Upload without a file asks for the PDF | ✅ Pass |
| AI-UI-06 | picking a non-PDF is refused in the browser | ✅ Pass |
| AI-UI-07 | a PDF over 4 MB is refused in the browser with its size | ✅ Pass |
| AI-UI-08 | a file named .pdf that isn't a PDF gets the server's error as a toast | ✅ Pass |
| AI-UI-09 | delete asks for confirmation; Cancel keeps the report, Delete removes it | ✅ Pass |
| AI-UI-10 | View opens the in-app PDF viewer, which closes with Escape | ✅ Pass |
| AI-UI-11 | a Practice Manager sees their practice with Submitted / Pending and can filter | ✅ Pass |
| AI-UI-12 | switching to an older month with no uploads shows everyone as Pending | ✅ Pass |
| AI-UI-13 | a Lead (no team visibility) only gets My reports, even with ?tab=team | ✅ Pass |
| AI-UI-14 | AI Admin sees everyone, including AI-only members with no practice | ✅ Pass |
| AI-UI-15 | an AI Member (no practice) can still submit their own report | ✅ Pass |

### Mobile & keyboard (UI) — 14/14 passed

| ID | Scenario | Status |
|---|---|---|
| RESP-01 | login works and fits the screen | ✅ Pass |
| RESP-02 | the sidebar becomes a drawer: open it, navigate, and it closes | ✅ Pass |
| RESP-03 | the drawer closes with its close button | ✅ Pass |
| RESP-04 | / has no sideways scrolling at 375px | ✅ Pass |
| RESP-04 | /practices has no sideways scrolling at 375px | ✅ Pass |
| RESP-04 | /practices/contributions/new has no sideways scrolling at 375px | ✅ Pass |
| RESP-04 | /access-control has no sideways scrolling at 375px | ✅ Pass |
| RESP-04 | /ai-tracker has no sideways scrolling at 375px | ✅ Pass |
| RESP-04 | /settings has no sideways scrolling at 375px | ✅ Pass |
| RESP-05 | a contribution page with a long unbroken title still fits | ✅ Pass |
| KB-01 | sign in using only the keyboard | ✅ Pass |
| KB-02 | dialogs take focus when opened and give it back when closed with Escape | ✅ Pass |
| KB-03 | tabs switch with the keyboard | ✅ Pass |
| KB-04 | every page has exactly one top-level heading | ✅ Pass |

## Known Gaps (from TRACKER.md)
- P360-2 — Google sign-in stub: fails politely (501 + "not available yet" toast). ✅ as documented.
- P360-3 — App cards "Coming soon" for unbuilt apps: correct, and no dead-end links. ✅
- P360-6 / P360-9 / P360-11 — 🟡 RBAC sign-off pending: current behaviour matches docs/rbac.md in every role-matrix case; nothing new to flag.
- P360-11 — no notifications: reviewers find work through "Awaiting my review", which works for the right reviewer only.

## Observations (not failures)
- Dev login has no rate limit or lockout. Fine while it's behind `AUTH_MODE=dev`; make sure the SSO replacement has it.
- The review endpoint decides the stage from the current status, not the stage the reviewer saw. If a Lead approves while a Manager has the Lead-step dialog open, the Manager's "Approve" becomes the final approval. Low impact, but sending the expected stage would remove the surprise.
- Practices Admin is expected to submit a usage report, but only AI Admin / Super Admin can see it (Practices Admin has no practice-scope grant). Worth confirming that's intended (rbac.md §4).
- Headless Chromium has no PDF viewer, so CON-UI-23 checks the opened blob holds the PDF rather than the rendered tab.

## Suggested Additions
- Add `npm run test:e2e` to CI (GitHub Actions) with a MongoDB service container; the suite needs ~1 minute.
- A `.docx` fixture for the Word import, and Firefox/WebKit projects once the UI settles.
- Cert Tracker cases when it's built (rbac.md §6 plan status flow, assigned plans can't be declined).

## Recommendation
**Ship with caveats.** RBAC, data isolation, the contribution workflow and usage reports behave exactly as docs/rbac.md describes, including every escalation and cross-practice check. Fix defect 1 (expired session) before wider rollout, since every user hits it after 8 hours with a tab open; defects 2–4 are small API hardening fixes.

## Re-test after fixes — 2026-11-12

All four defects were fixed the same day (owner: "Yes, fix them"). The suite was re-run on a freshly seeded database with Playwright building and starting the stack itself.

**Result:** the first full run after the fixes passed **283 of 284** in 1.0 minute, with Playwright building and starting the stack from scratch. The one failure (CON-API-46) was a scoping bug in the new test itself (`base` not defined in that block); after fixing the test it passes on its own. Every previously failing case passed.

Two later confirmation runs were invalidated by the Mac going into battery maintenance sleep mid-run (tests timing out after 1–17 minutes against a 45-second limit). **A clean confirmation run with the machine awake and on power is still pending** — `npm run test:e2e`.

| # | Defect | Fix | Tests now passing |
|---|---|---|---|
| 1 | Expired session showed misleading pages | Any 401 on a request that carried a token clears the session (`apps/web/lib/api.js`); `SessionProvider` signs out and the login page shows "Your session expired. Sign in again to continue." `/auth/*` 401s (wrong password) are excluded. | AUTH-UI-15, AUTH-UI-16 (new), AUTH-UI-03 (no false "expired" notice) |
| 2 | Malformed JSON → 500 | Error handler maps `entity.parse.failed` to `400 {"error":"Request body isn't valid JSON"}` (`apps/api/src/app.js`) | PLAT-03 |
| 3 | Feb 31 accepted, rolled into March | `parseDate()` checks the calendar day exists; leap years handled; ISO timestamps still accepted (`routes/contributions.js`) | CON-API-02, CON-API-46 (new: leap day, Apr 31, month 13/00, ISO) |
| 4 | Over-long text silently truncated | `str()` throws an input error → `400` naming the field and its limit, for all 12 contribution text fields; Markdown editor shows a character count near the limit | CON-API-42, CON-API-03 (title 121 refused), CON-API-45 (new: summary/impact/link/update/comment + at-limit boundary), CON-UI-28 (new: counter + no data loss in the form) |

Behaviour change to note: titles over 120 characters used to be cut to 120; they are now refused (the web form already caps titles at 120, so only direct API callers notice).

**Updated recommendation: Ship once the confirmation run is green.** No known open defects; the observations above are design questions, not bugs.

# Test Plan — End-to-end (Playwright) — 2026-11-12

**Status**: APPROVED — implemented and executed (owner asked on 2026-11-12 to write the cases, implement them in Playwright, run them and send the report)
**Ticket(s)**: P360-1, P360-3, P360-4, P360-6, P360-7, P360-9, P360-10, P360-11, P360-12 (everything built so far; Certification Tracker cases added 2026-11-12)
**Scope**: Every screen and API that exists today — login/session, home + navigation, settings, Access control (users, grants, custom and system roles), Practices → Contributions (create, list, edit, files, progress, people, review workflow), AI Tracker usage reports, API platform behaviour, phone-width layout and keyboard use.
**References**: docs/rbac.md §1–§7 (roles, scopes, escalation guard, contributions, usage reports), docs/ui-guidelines.md (375px, one primary action, hide what can() denies), docs/tracker/TRACKER.md
**Code**: `e2e/` (specs, fixtures, global setup), `playwright.config.js`. Run with `npm run test:e2e`.

## How the suite thinks about users

Each case is written the way a person (or a curious person with dev tools) would actually use the portal:
- **Positive** — the role that should succeed does the job end to end.
- **Negative** — the wrong role, wrong input, wrong state, or a direct API call that skips the hidden button.
- **Edge** — boundaries (4 MB, same-day dates, current month), double clicks, odd characters, multi-practice users, phone width, keyboard only, sessions expiring mid-use.
- **Security** — forged/expired/alg=none tokens, injection-shaped input, stored XSS, file-type tricks, mass assignment, existence leaks (404 vs 403).

Role matrix follows rbac.md §7 seed users: the role that should succeed, one level below, the same level in a **different practice**, and a user with no access.

## Test environment

An isolated stack so a run never touches the dev database:

| Piece | Value |
|---|---|
| API | `node apps/api/src/local.js` on http://localhost:4100 (`AUTH_MODE=dev`, own JWT secret) |
| Web | production build (`next build` → `next start`) on http://localhost:3200, `NEXT_DIST_DIR=.next-e2e` |
| Database | `mongodb://127.0.0.1:27017/practise360_e2e` — dropped and re-seeded (rbac.md §7 users) before every run; refuses any DB not named `*_e2e` |
| Browser | Chromium (Playwright 1.62.1), desktop 1366×900, phone 375×812 |

Tests run one at a time (`workers: 1`) because they share one seeded database; each test cleans up what it changes (grants revoked, custom roles deleted, reports removed) and uses unique titles.

## Coverage summary

| | Count |
|---|---|
| Test cases (incl. parameterised variants) | 332 |
| API / UI | 190 / 142 |
| Positive / Negative / Edge / Security | 98 / 164 / 36 / 17 |
| P0 (blocks ship) / P1 (should fix) / P2 (nice to have) | 119 / 162 / 34 |

The type/priority split above predates the 17 cases added on 2026-11-12 for P360-13 (Practices and groups: PRAC-API-01…09, PRAC-UI-01…05, RBAC-API-13b, CON-API-27b, AC-UI-04b). Leads are group-scoped since then, so several older cases now act on members of the Lead's own group. On 2026-11-13 four more were added (PRAC-API-10/11, PRAC-UI-06/07) for the practice Overview, the Practices Admin name and the stats toggle; AC-UI-01 and AI-UI-12 now click "Show stats" because count tiles start hidden. Later on 2026-11-13, ten were added for invitations by email (INV-API-01…07, INV-UI-01/02, AUTH-API-02b); the AUTH login-error cases now expect "Invalid username, email or password".

Type and priority are assigned from the scenario: anything that guards a permission boundary, data isolation or a core journey is P0.

## Scenarios

### Platform & HTTP (API) — 6 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| PLAT-01 | health and root endpoints respond | Positive | P0 |
| PLAT-02 | unknown route returns a JSON 404, not an HTML error page | Negative | P2 |
| PLAT-03 | malformed JSON body is rejected as a client error (400), not a server crash | Negative | P1 |
| PLAT-04 | JSON body over the 1 MB limit gets 413 with a readable message | Negative | P1 |
| PLAT-05 | CORS allows the configured web origin and no other | Positive | P1 |
| PLAT-06 | OpenAPI spec and Swagger UI are served | Positive | P2 |

### Authentication (API) — 19 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| AUTH-API-01 | valid username + password returns a JWT that opens /me | Positive | P0 |
| AUTH-API-02 | username is case-insensitive and surrounding spaces are ignored | Edge | P0 |
| AUTH-API-02b | seeded users sign in with their email in any case; an unknown email gets 401 | Positive | P1 |
| AUTH-API-03 | wrong password is rejected with 401 | Negative | P0 |
| AUTH-API-04 | unknown username gets the same message as a wrong password (no user enumeration) | Security | P0 |
| AUTH-API-05 | password is case-sensitive | Positive | P1 |
| AUTH-API-06 | missing password → 400 | Negative | P1 |
| AUTH-API-06 | missing username → 400 | Negative | P1 |
| AUTH-API-06 | empty strings → 400 | Negative | P1 |
| AUTH-API-06 | empty body → 400 | Negative | P1 |
| AUTH-API-07 | NoSQL-injection style username object does not log anyone in | Security | P0 |
| AUTH-API-08 | /auth/config advertises dev login and lists demo users without secrets | Negative | P2 |
| AUTH-API-09 | Google sign-in is a 501 stub | Positive | P2 |
| AUTH-API-10 | /me without a token → 401 Not signed in | Negative | P0 |
| AUTH-API-11 | garbage token → 401 | Negative | P0 |
| AUTH-API-12 | token signed with a different secret (forged) → 401 | Security | P0 |
| AUTH-API-13 | expired token → 401 Session expired | Negative | P0 |
| AUTH-API-14 | validly signed token for a user that doesn't exist → 401 Account not available | Negative | P0 |
| AUTH-API-15 | alg=none token is rejected | Security | P0 |
| AUTH-API-16 | /me returns grants, visible apps and practices for a multi-role user | Edge | P1 |

### Access control & RBAC (API) — 42 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| RBAC-API-01 | Super Admin sees every active user and all their assignments | Positive | P1 |
| RBAC-API-02 | cert.admin (no member/role permissions) is refused the directory → 403 | Negative | P1 |
| RBAC-API-02 | aitracker.admin (no member/role permissions) is refused the directory → 403 | Negative | P1 |
| RBAC-API-02 | aitracker.member (no member/role permissions) is refused the directory → 403 | Negative | P1 |
| RBAC-API-03 | a practitioner sees the directory but only assignments inside their own practice | Negative | P1 |
| RBAC-API-04 | Practice Manager can grant Lead / Practitioner / custom roles in their practice only — never Practice Manager | Negative | P0 |
| RBAC-API-05 | Practices Admin can appoint Practice Managers in every practice but not platform/app admins | Negative | P0 |
| RBAC-API-06 | a Practice Lead has nothing to grant | Positive | P0 |
| RBAC-API-07 | Practice Manager grants Practitioner in their practice, then revokes it | Positive | P0 |
| RBAC-API-08 | granting the same role at the same scope twice → 409 | Negative | P0 |
| RBAC-API-09 | Practice Manager cannot appoint another Practice Manager (assignableFrom: app) | Negative | P0 |
| RBAC-API-10 | Practice Manager cannot grant roles in a different practice | Negative | P0 |
| RBAC-API-11 | Practice Lead cannot grant anything | Negative | P0 |
| RBAC-API-12 | custom-role holder with roles.assign still can't grant a role holding permissions they lack | Negative | P0 |
| RBAC-API-13 | one Manager per practice: a second Manager is refused (409) and pointed to the Practices page | Negative | P0 |
| RBAC-API-13b | Leads are per group: one per group (409), only from the practice's members (400), never practice-wide or in another practice's group (403) | Negative | P0 |
| RBAC-API-14 | Practices Admin cannot create a Super Admin | Negative | P0 |
| RBAC-API-15 | AI Admin cannot add AI Members (needs platform.apps.assign — rbac.md §5) | Negative | P0 |
| RBAC-API-16 | a grant opens the app immediately and a revoke closes it on the very next request | Positive | P0 |
| RBAC-API-17 | a role can only be granted at its own scope type / scope | Negative | P0 |
| RBAC-API-18 | bad grant input: invalid user id, unknown user, unknown role, unknown practice | Negative | P0 |
| RBAC-API-19 | revoking is guarded like granting: a Manager can't remove a Manager (theirs or another practice's) | Negative | P0 |
| RBAC-API-20 | the last Super Admin assignment can't be removed | Negative | P0 |
| RBAC-API-21 | revoking an invalid or unknown assignment id → 404 | Negative | P0 |
| RBAC-API-22 | Practice Manager creates, renames and deletes a custom role in their practice | Positive | P0 |
| RBAC-API-23 | Practice Manager cannot create a custom role in another practice; a Lead can't create one at all | Negative | P0 |
| RBAC-API-24 | custom role can't contain platform.users.manage (outside the practice-scoped subset) → 400 | Negative | P1 |
| RBAC-API-24 | custom role can't contain practices.practice.create (outside the practice-scoped subset) → 400 | Negative | P1 |
| RBAC-API-24 | custom role can't contain practices.practice.archive (outside the practice-scoped subset) → 400 | Negative | P1 |
| RBAC-API-24 | custom role can't contain cert.catalog.manage (outside the practice-scoped subset) → 400 | Negative | P1 |
| RBAC-API-25 | custom role validation: blank name → 400 | Negative | P1 |
| RBAC-API-25 | custom role validation: no permissions → 400 | Negative | P1 |
| RBAC-API-25 | custom role validation: unknown practice → 400 | Negative | P1 |
| RBAC-API-26 | a custom role that is still assigned can't be deleted (409) | Negative | P1 |
| RBAC-API-27 | system roles can't be deleted; unknown roles → 404 | Negative | P1 |
| RBAC-API-28 | custom roles are only visible inside their practice | Negative | P1 |
| RBAC-API-29 | a practitioner (no roles.view) can't list roles or the catalog | Negative | P1 |
| RBAC-API-30 | only Super Admin may edit a system role | Negative | P0 |
| RBAC-API-31 | Super Admin role itself is locked (prevents lock-out) | Negative | P0 |
| RBAC-API-32 | platform.* permissions are refused on a practice-scope system role | Negative | P1 |
| RBAC-API-33 | unknown permission keys and empty permission lists are refused | Negative | P1 |
| RBAC-API-34 | Super Admin edits a system role's description (then restores it) | Positive | P1 |
| RBAC-API-35 | widening Practice Manager beyond Practices Admin stops Practices Admin appointing Managers (rbac.md §4) | Positive | P1 |

### Practice contributions (API) — 60 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| CON-API-01 | practitioner starts a contribution in their practice | Positive | P0 |
| CON-API-02 | create rejects blank title → 400 | Negative | P1 |
| CON-API-02 | create rejects unknown type → 400 | Negative | P1 |
| CON-API-02 | create rejects 'other' without a custom label → 400 | Negative | P1 |
| CON-API-02 | create rejects missing due date → 400 | Negative | P1 |
| CON-API-02 | create rejects non-ISO date → 400 | Negative | P1 |
| CON-API-02 | create rejects garbage after the date → 400 | Negative | P1 |
| CON-API-02 | create rejects impossible calendar date (Feb 31) → 400 | Negative | P1 |
| CON-API-02 | create rejects due date before start date → 400 | Negative | P1 |
| CON-API-03 | 'other' type keeps its custom label; a 120-char title is fine, 121 is refused (not cut) | Negative | P1 |
| CON-API-04 | same-day start and due date is allowed (boundary) | Edge | P1 |
| CON-API-05 | practitioner can't start a contribution in another practice | Negative | P0 |
| CON-API-06 | cert.admin (no contribution permissions) can neither list nor create | Positive | P0 |
| CON-API-06 | aitracker.member (no contribution permissions) can neither list nor create | Positive | P0 |
| CON-API-06 | de.coordinator (no contribution permissions) can neither list nor create | Positive | P0 |
| CON-API-07 | unauthenticated requests are refused | Negative | P0 |
| CON-API-08 | another practice gets 404 (not 403) so the contribution's existence isn't leaked | Security | P0 |
| CON-API-09 | the whole practice can see it; Practices Admin and Super Admin see every practice | Positive | P0 |
| CON-API-10 | list filters: practice, status, type, mine, search (regex characters are treated literally) | Positive | P1 |
| CON-API-11 | malformed or unknown ids → 404 | Negative | P1 |
| CON-API-12 | invite picker lists only members of that practice; other practices → 403 | Negative | P1 |
| CON-API-13 | a practice member who isn't the owner or a contributor can't edit or log progress | Negative | P0 |
| CON-API-14 | owner edits details; invalid edits are refused | Negative | P1 |
| CON-API-15 | progress updates: empty body refused, attached files become permanent | Negative | P1 |
| CON-API-16 | a Lead (manage permission) can log progress on any contribution in the practice | Positive | P1 |
| CON-API-17 | PDFs are served inline; HTML is forced to download with nosniff (no stored XSS) | Security | P0 |
| CON-API-18 | file names are sanitised (no path traversal or header injection) | Security | P0 |
| CON-API-19 | empty upload → 400; over 4 MB → 413 | Negative | P1 |
| CON-API-20 | files of another practice's contribution can't be fetched; unknown file ids → 404 | Negative | P0 |
| CON-API-21 | a contributor can't remove a file the owner uploaded; the owner can | Negative | P1 |
| CON-API-22 | happy path: practitioner submits → Lead approves → Manager approves → published | Positive | P0 |
| CON-API-23 | submit refused: no summary | Negative | P1 |
| CON-API-23 | submit refused: no impact | Negative | P1 |
| CON-API-23 | submit refused: no documents | Negative | P1 |
| CON-API-23 | submit refused: javascript: repo link | Negative | P1 |
| CON-API-23 | submit refused: ftp demo link | Negative | P1 |
| CON-API-23 | submit refused: bad extra link | Negative | P1 |
| CON-API-24 | submit refused without a description, and file ids from another contribution don't count | Negative | P1 |
| CON-API-25 | only the owner can submit — not a contributor or the Lead | Negative | P0 |
| CON-API-26 | nobody reviews their own work: a Lead-owned contribution is reviewed by the Manager, who then can't also approve | Negative | P0 |
| CON-API-27 | a practitioner can't review, and a Lead can't give final approval | Negative | P0 |
| CON-API-27b | only the Lead of the owner's group reviews; another group's Lead sees the contribution but can't act | Security | P0 |
| CON-API-28 | decline and clarify need a comment; unknown decisions are refused | Negative | P1 |
| CON-API-29 | clarification round-trip returns to the reviewer who asked (Lead stage, then Manager stage) | Positive | P1 |
| CON-API-30 | decline closes the contribution for good | Positive | P1 |
| CON-API-31 | reviewing something that isn't waiting for review → 409 | Negative | P1 |
| CON-API-32 | 'awaiting my review' queue shows the item to the right reviewer only | Negative | P1 |
| CON-API-33 | invite → accept makes a contributor who can edit and log progress but not submit | Negative | P1 |
| CON-API-34 | invite validation: outsiders, duplicates and existing contributors are refused | Negative | P1 |
| CON-API-35 | declining an invite and withdrawing one both clear it | Edge | P1 |
| CON-API-36 | join request → owner accepts; duplicate requests are refused; the requester can cancel | Negative | P1 |
| CON-API-37 | owner rejects a join request; answering a request that doesn't exist → 404 | Negative | P1 |
| CON-API-38 | inviting someone who already asked to join adds them straight away | Positive | P1 |
| CON-API-39 | nobody can join once it's in review, and other practices can't ask at all | Negative | P1 |
| CON-API-40 | contributors can leave; the owner can't 'leave'; the owner can remove a contributor | Negative | P1 |
| CON-API-41 | a contributor can't review the contribution they work on, even as a Lead | Negative | P1 |
| CON-API-42 | an over-long description is refused with a clear message, not silently cut (no data loss) | Negative | P1 |
| CON-API-43 | clients can't set owner, status or practice through create/edit (mass assignment) | Security | P0 |
| CON-API-44 | unicode and emoji titles round-trip and are searchable | Edge | P2 |
| CON-API-45 | over-long summary, comment, progress update and link are refused with the field named | Negative | P1 |
| CON-API-46 | calendar edge dates: leap day only in leap years; full ISO timestamps still accepted | Negative | P1 |

### Certification Tracker (API) — 23 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| CERT-API-01 | every practice member sees the seeded catalog; AI Tracker-only users don't | Positive | P0 |
| CERT-API-02 | Lead adds to the catalog; practitioner can't; same title + provider is refused | Negative | P0 |
| CERT-API-03 | only Cert Admin retires; a retired entry can't be planned; restoring brings it back | Negative | P1 |
| CERT-API-04 | practitioner plans from the catalog; a second open plan for it is refused | Positive | P0 |
| CERT-API-05 | a one-off cert stays off the catalog | Positive | P1 |
| CERT-API-06 | create rejects missing due date → 400 | Negative | P1 |
| CERT-API-06 | create rejects impossible date → 400 | Negative | P1 |
| CERT-API-06 | create rejects due before start → 400 | Negative | P1 |
| CERT-API-06 | create rejects no cert → 400 | Negative | P1 |
| CERT-API-06 | create rejects a javascript: link → 400 | Security | P1 |
| CERT-API-07 | can't plan in another practice | Negative | P0 |
| CERT-API-08 | visibility: owner, DE Lead/Manager/Coordinator, admins — not peers or other practices (404, not 403) | Security | P0 |
| CERT-API-09 | a practitioner's list has only their own plans | Negative | P0 |
| CERT-API-10 | Manager assigns a new cert to members of two groups; it lands in the catalog; the owner can't drop it or move its due date, their group's Lead can, another group's Lead can't see it | Positive | P0 |
| CERT-API-11 | assign needs a future due date; only practice members; not across practices; not by practitioners | Negative | P0 |
| CERT-API-12 | recommendation: accept needs dates; decline closes it; someone with an open plan is skipped | Positive | P0 |
| CERT-API-13 | withdraw: open recommendations only; once accepted it's the member's plan | Negative | P1 |
| CERT-API-14 | completion needs date, verification link, certificate; a claim needs a receipt and INR/USD | Negative | P0 |
| CERT-API-15 | uploads: PDFs/images only, and only by the owner | Security | P0 |
| CERT-API-16 | full chain: Lead rejects → planned → resubmit → Lead approves → Manager clarifies → resubmit returns to Manager → completed with reimbursement | Positive | P0 |
| CERT-API-17 | whoever did the Lead step can't give final approval; Practices Admin can | Negative | P0 |
| CERT-API-18 | a file that was part of a submission can't be deleted afterwards | Edge | P1 |
| CERT-API-19 | unauthenticated requests are refused | Security | P0 |

### AI Tracker usage reports (API) — 29 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| AI-API-01 | practitioner uploads a PDF for a past month and sees it in their list | Positive | P0 |
| AI-API-02 | uploading again for the same month replaces the report (one per month) | Positive | P1 |
| AI-API-03 | the current month is accepted (not in the future) | Negative | P1 |
| AI-API-04 | period "NEXT" is refused → 400 | Negative | P1 |
| AI-API-04 | period "2026-13" is refused → 400 | Negative | P1 |
| AI-API-04 | period "2026-00" is refused → 400 | Negative | P1 |
| AI-API-04 | period "2026-1" is refused → 400 | Negative | P1 |
| AI-API-04 | period "26-01" is refused → 400 | Negative | P1 |
| AI-API-04 | period "abcd-ef" is refused → 400 | Negative | P1 |
| AI-API-04 | period "2026-10-01" is refused → 400 | Negative | P1 |
| AI-API-05 | a non-PDF file renamed with a PDF content type is rejected by its magic bytes | Security | P0 |
| AI-API-06 | a real PDF sent with the wrong content type is refused | Negative | P1 |
| AI-API-07 | a PDF over 4 MB → 413 | Negative | P1 |
| AI-API-08 | a PDF just under 4 MB is accepted (boundary) | Edge | P1 |
| AI-API-09 | delete own report → 204; deleting again → 404 | Negative | P1 |
| AI-API-10 | file names are sanitised | Security | P0 |
| AI-API-11 | users without AI permissions can't use reports at all | Negative | P0 |
| AI-API-12 | Practice Manager's team view is exactly their practice | Positive | P0 |
| AI-API-13 | a member of two practices shows up for both Managers | Edge | P0 |
| AI-API-14 | AI Admin sees everyone expected to submit, including people with no practice; Super Admin isn't expected | Negative | P0 |
| AI-API-15 | Practices Admin sees every practice member but not AI-only members | Negative | P0 |
| AI-API-16 | de.lead (no ai.usage.view) can't open the team view | Negative | P0 |
| AI-API-16 | de.dev1 (no ai.usage.view) can't open the team view | Negative | P0 |
| AI-API-16 | aitracker.member (no ai.usage.view) can't open the team view | Negative | P0 |
| AI-API-17 | team view needs a valid, non-future period | Positive | P0 |
| AI-API-18 | submitted / pending summary follows uploads | Positive | P0 |
| AI-API-19 | PDF access: owner, their Manager and AI Admin yes; same-practice Lead and other Managers no | Positive | P0 |
| AI-API-20 | unknown or malformed report ids → 404 | Negative | P1 |
| AI-API-21 | a multi-practice member's report is readable by both of their Managers | Edge | P1 |

### Login & session (UI) — 21 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| AUTH-UI-01 | login page shows the form; Sign in stays disabled until both fields are filled | Edge | P1 |
| AUTH-UI-02 | valid credentials land on Home with a personal welcome | Positive | P0 |
| AUTH-UI-03 | wrong password shows an inline error and keeps the user on /login | Negative | P0 |
| AUTH-UI-04 | unknown user gets the same error (no hint which usernames exist) | Negative | P1 |
| AUTH-UI-05 | retry after a failed attempt succeeds and clears the error | Edge | P1 |
| AUTH-UI-06 | mixed-case username with spaces still signs in | Edge | P1 |
| AUTH-UI-07 | pressing Enter in the password field submits the form | Positive | P1 |
| AUTH-UI-08 | picking a demo user fills the form, and signing in works | Positive | P2 |
| AUTH-UI-09 | 'Continue with Google' explains it isn't available yet | Negative | P2 |
| AUTH-UI-10 | signed-out visit to / redirects to /login | Positive | P0 |
| AUTH-UI-10 | signed-out visit to /settings redirects to /login | Positive | P0 |
| AUTH-UI-10 | signed-out visit to /practices redirects to /login | Positive | P0 |
| AUTH-UI-10 | signed-out visit to /access-control redirects to /login | Positive | P0 |
| AUTH-UI-10 | signed-out visit to /ai-tracker redirects to /login | Positive | P0 |
| AUTH-UI-10 | signed-out visit to /practices/contributions/new redirects to /login | Positive | P0 |
| AUTH-UI-11 | a signed-in user opening /login is sent to Home | Positive | P1 |
| AUTH-UI-12 | sign out from the user menu clears the session; Back and reload don't restore it | Positive | P0 |
| AUTH-UI-13 | an expired or tampered token in storage is discarded and the user is asked to sign in | Security | P0 |
| AUTH-UI-14 | user menu closes with Escape and shows every role for a multi-role user | Edge | P2 |
| AUTH-UI-15 | a session that expires while the tab is open sends the user back to sign in | Edge | P1 |
| AUTH-UI-16 | a session that expires during an action (upload) also returns the user to sign in | Positive | P1 |

### Navigation, app visibility & settings (UI) — 26 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| NAV-01 | superadmin: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | practices.admin: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | de.manager: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | de.lead: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | de.dev1: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | de.coordinator: Home shows exactly Practices, Certification Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | cert.admin: Home shows exactly Certification Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | aitracker.admin: Home shows exactly AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | aitracker.member: Home shows exactly AI Tracker; sidebar matches permissions | Positive | P0 |
| NAV-01 | multi.user: Home shows exactly Practices, Certification Tracker, AI Tracker; sidebar matches permissions | Edge | P0 |
| NAV-02 | Cert Admin's only app tile opens the Certification Tracker (was "Coming soon" before P360-12) | Positive | P1 |
| NAV-03 | a custom role that opens Practices without contribution access gets no dead-end link | Negative | P1 |
| NAV-04 | app tiles open the app | Positive | P1 |
| NAV-05 | the current page is highlighted in the sidebar | Positive | P2 |
| NAV-06 | sidebar collapses to icons and expands again | Positive | P2 |
| NAV-07 | cert.admin opening /practices sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | cert.admin opening /ai-tracker sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | de.dev1 opening /access-control sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | aitracker.member opening /practices/contributions/new sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | de.coordinator opening /practices sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | cert.admin opening /access-control sees "Access restricted", not a crash | Negative | P0 |
| NAV-07 | aitracker.member opening /certifications sees "Access restricted", not a crash | Negative | P0 |
| NAV-08 | an unknown URL shows the 404 page | Negative | P2 |
| SET-01 | shows the account and that it's a dev-password session | Positive | P1 |
| SET-02 | a multi-role user sees one row per assignment with its scope and permissions | Edge | P1 |
| SET-03 | Super Admin's wildcard permission is spelled out | Positive | P2 |

### Access control portal (UI) — 16 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| AC-UI-01 | Super Admin sees every user, can search by name or username, and gets an empty state for no match | Negative | P1 |
| AC-UI-02 | Practice Manager's grant form only offers their practice and never 'Practice Manager' | Negative | P0 |
| AC-UI-03 | Practice Manager grants a role, sees it immediately, then removes it after confirming | Positive | P0 |
| AC-UI-04 | granting a role the user already has shows the conflict instead of duplicating it | Positive | P1 |
| AC-UI-04b | granting a second Lead on a group shows "already has a Practice Lead" and points to the Practices page | Negative | P1 |
| AC-UI-05 | a Manager can't remove a fellow Manager: no remove button on Manager assignments | Negative | P0 |
| AC-UI-06 | a Lead can look but not change: View buttons and an explanation instead of the grant form | Negative | P1 |
| AC-UI-07 | the Manage dialog closes with Escape and with the close button | Edge | P2 |
| AC-UI-08 | Practices Admin picks a practice first, then sees only roles grantable there | Negative | P1 |
| AC-UI-09 | tabs are reflected in the URL and an unknown tab falls back to Users | Negative | P2 |
| AC-UI-10 | permission matrix marks what each role carries | Positive | P2 |
| AC-UI-11 | Practice Manager creates a custom role, sees it listed, then deletes it | Positive | P1 |
| AC-UI-12 | a blank (spaces-only) custom role name can't be saved | Negative | P1 |
| AC-UI-13 | deleting a custom role that's still assigned explains why it can't | Negative | P1 |
| AC-UI-14 | only Super Admin gets edit buttons on system roles, and Super Admin itself is locked | Negative | P1 |
| AC-UI-15 | Super Admin's system-role editor warns about the escalation guard and keeps platform.* off practice roles | Positive | P1 |
| AC-UI-16 | a Lead (roles.view only) sees roles but no 'New custom role' button | Negative | P1 |

### Contributions, single user (UI) — 28 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| CON-UI-01 | practitioner starts a contribution and lands on its page | Positive | P0 |
| CON-UI-02 | submitting an empty form shows every problem inline and creates nothing | Negative | P1 |
| CON-UI-03 | a title of only spaces is treated as empty | Negative | P1 |
| CON-UI-04 | 'Other' reveals a required custom type field | Positive | P1 |
| CON-UI-05 | due date before the start date is caught before saving | Positive | P1 |
| CON-UI-06 | Markdown description previews and renders on the contribution page | Positive | P1 |
| CON-UI-07 | Cancel goes back to the list without creating anything | Negative | P2 |
| CON-UI-08 | search, type filter and Clear narrow the list; no match shows a friendly empty state | Negative | P1 |
| CON-UI-09 | search also matches the owner's name | Positive | P2 |
| CON-UI-10 | practitioners get All and Mine; reviewers also get 'Awaiting my review' | Positive | P1 |
| CON-UI-11 | overdue work is flagged in the list and on its page, and can be filtered | Edge | P1 |
| CON-UI-12 | someone who sees several practices gets a Practice column and filter | Edge | P2 |
| CON-UI-13 | someone in a practice with no contributions sees the 'No contributions yet' state | Edge | P2 |
| CON-UI-14 | another practice's contribution (or a bad id) shows 'Contribution not found' | Negative | P0 |
| CON-UI-15 | edit details: a blank title is refused, a new title is saved | Negative | P1 |
| CON-UI-16 | edit the description in the Markdown editor | Positive | P1 |
| CON-UI-17 | log progress: Post is disabled until something is written; the update appears newest-first | Positive | P1 |
| CON-UI-18 | upload a document, then remove it after confirming | Positive | P1 |
| CON-UI-19 | a file over 4 MB is refused in the browser before uploading | Negative | P1 |
| CON-UI-20 | submit for review: every missing requirement is listed and nothing is submitted | Negative | P1 |
| CON-UI-21 | a practice member who isn't on the contribution can ask to join but not edit or submit | Negative | P1 |
| CON-UI-22 | HTML and script in a description are shown as text, never executed | Security | P0 |
| CON-UI-23 | documents open from their chip (PDF opens in a new tab) | Positive | P2 |
| CON-UI-24 | double-clicking 'Start contribution' creates exactly one contribution | Edge | P1 |
| CON-UI-25 | someone who can start contributions in several practices must pick one | Edge | P1 |
| CON-UI-26 | importing a Markdown file replaces the description and switches to Preview | Positive | P1 |
| CON-UI-27 | importing an unsupported file type explains which formats work | Positive | P1 |
| CON-UI-28 | the description editor counts characters near the limit and the save is refused with a clear message over it | Negative | P1 |

### Review workflow, multi-user (UI) — 9 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| WF-UI-01 | practitioner submits → Lead approves → Manager approves & publishes | Positive | P0 |
| WF-UI-02 | Lead asks for clarification; owner must reply before resubmitting; it returns to the Lead | Positive | P1 |
| WF-UI-03 | a declined contribution is closed for the owner | Negative | P1 |
| WF-UI-04 | the owner never gets a Review button on their own work; the Manager takes the Lead step | Negative | P0 |
| WF-UI-05 | closing the review dialog with Cancel records nothing | Edge | P1 |
| WF-UI-06 | ask to join → owner accepts → the new contributor can log progress and leave | Positive | P1 |
| WF-UI-07 | a join request can be cancelled by the requester | Edge | P1 |
| WF-UI-08 | owner invites a practice member, who declines; the invite picker only lists practice members | Negative | P1 |
| WF-UI-09 | invitee accepts; owner removes them after confirming | Positive | P1 |

### AI Tracker (UI) — 15 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| AI-UI-01 | a practitioner sees the skill, the upload form and an empty history — no Team tab | Negative | P1 |
| AI-UI-02 | the skill download link really serves the zip | Positive | P2 |
| AI-UI-03 | upload a PDF: it's listed, and the form switches to 'Replace report' | Positive | P1 |
| AI-UI-04 | uploading again for the same month replaces it (still one row) | Positive | P1 |
| AI-UI-05 | pressing Upload without a file asks for the PDF | Negative | P1 |
| AI-UI-06 | picking a non-PDF is refused in the browser | Negative | P1 |
| AI-UI-07 | a PDF over 4 MB is refused in the browser with its size | Negative | P1 |
| AI-UI-08 | a file named .pdf that isn't a PDF gets the server's error as a toast | Negative | P1 |
| AI-UI-09 | delete asks for confirmation; Cancel keeps the report, Delete removes it | Edge | P1 |
| AI-UI-10 | View opens the in-app PDF viewer, which closes with Escape | Edge | P2 |
| AI-UI-11 | a Practice Manager sees their practice with Submitted / Pending and can filter | Positive | P1 |
| AI-UI-12 | switching to an older month with no uploads shows everyone as Pending | Edge | P1 |
| AI-UI-13 | a Lead (no team visibility) only gets My reports, even with ?tab=team | Negative | P1 |
| AI-UI-14 | AI Admin sees everyone, including AI-only members with no practice | Negative | P1 |
| AI-UI-15 | an AI Member (no practice) can still submit their own report | Positive | P1 |

### Certification Tracker (UI) — 7 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| CERT-UI-01 | practitioner: My plans + Catalog only; form validation; adds a one-off plan and lands on it | Positive | P0 |
| CERT-UI-02 | Lead: four tabs; assigns a new cert (due date required); the member can't drop it | Positive | P0 |
| CERT-UI-03 | member accepts a recommendation with their own dates | Positive | P1 |
| CERT-UI-04 | member submits with certificate + reimbursement → Lead approves (no Final approval for Leads) → Manager approves & completes | Positive | P0 |
| CERT-UI-05 | a rejected completion reopens the plan and the owner sees the reason | Negative | P0 |
| CERT-UI-06 | someone from another practice gets "Plan not found" | Security | P0 |
| CERT-UI-07 | list, catalog and detail fit a 375px phone | Edge | P1 |

### Practices and groups (API) — 11 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| PRAC-API-01 | a Manager sees only their practice, with its Manager, groups, Leads and their own actions | Positive | P0 |
| PRAC-API-02 | Practices Admin sees every practice and can create; Cert Admin has no Practices view | Negative | P0 |
| PRAC-API-03 | practitioners and Leads get a read-only view; another practice's Manager gets 404 | Security | P0 |
| PRAC-API-04 | Practices Admin creates a practice with its Manager (duplicate names refused), then replaces the Manager; the old one stays as Practitioner | Positive | P0 |
| PRAC-API-05 | a Manager can't create practices or appoint a Manager | Negative | P0 |
| PRAC-API-06 | Manager creates, renames (id unchanged) and deletes a group; duplicate names and deleting a non-empty group are refused; a Lead can't create groups | Positive | P0 |
| PRAC-API-07 | Manager chooses a Lead from the practice (outsiders refused, Leads can't appoint); they join the group if not in one; a replacement already in a group stays there | Positive | P0 |
| PRAC-API-08 | a Lead's cert picker lists only their group; another group's Lead can't assign; moving a member hands them to the new Lead; practitioners can't move people | Security | P0 |
| PRAC-API-09 | Manager adds someone straight into a group; revoking their role takes them out of the group; a Lead's last practice role can't be revoked | Edge | P1 |
| PRAC-API-10 | the practices list names the Practices Admin for admin, Manager and practitioner | Positive | P2 |
| PRAC-API-11 | Manager and Practices Admin edit the Overview text and files; practitioner and Lead get 403 on edits; another practice's Manager gets 404 on a file; text over 50,000 chars is refused | Negative | P0 |

### Practices and groups (UI) — 7 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| PRAC-UI-01 | Manager's overview shows their practice, Manager, groups with Leads, no "New practice"; the Contributions tab navigates | Positive | P0 |
| PRAC-UI-02 | Practices Admin creates a practice and lands on its page with "Choose Manager" | Positive | P0 |
| PRAC-UI-03 | a practitioner gets a read-only practice page (no edit, group, Lead, member or move controls) | Negative | P0 |
| PRAC-UI-04 | Manager chooses a Lead for an empty group, then removes them after confirming | Positive | P1 |
| PRAC-UI-05 | Manager creates and deletes a group, and moves a member between groups | Positive | P1 |
| PRAC-UI-06 | Manager writes the Overview and uploads a file; a practitioner sees both with no edit, upload or remove controls; Manager removes the file after confirming | Positive | P0 |
| PRAC-UI-07 | count tiles start hidden; "Show stats" reveals them and the choice carries to other pages until "Hide stats" | Positive | P2 |

### Invitations (API) — 7 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| INV-API-01 | invitations follow the direct appointment's guard: a Manager can't invite a Manager, Leads and practitioners can't invite, another practice is 404; only inviters see open invitations | Security | P0 |
| INV-API-02 | bad email, unknown kind, Lead without a group, another practice's group → 400; an email that already has an account → 409 | Negative | P0 |
| INV-API-03 | member invitation into a group: the public link shows the role; accepting creates the account in that group; the link works once; they sign in with their email | Positive | P0 |
| INV-API-04 | Lead invitation: they join as Practitioner, lead the group and sit in it | Positive | P0 |
| INV-API-05 | a second Manager invitation replaces the first (old link 410); accepting makes them Manager; choosing a Manager directly withdraws an open invitation | Edge | P0 |
| INV-API-06 | the DE Manager can't cancel or resend an invitation for their own replacement; resend retires the old link; cancel makes the link 410 | Security | P0 |
| INV-API-07 | a made-up token is 404 on lookup and accept; no session needed | Negative | P1 |

### Invitations (UI) — 2 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| INV-UI-01 | Manager invites a new member by email from Add member, gets the join link (no SMTP), sees it under Pending invitations; the invitee joins from a fresh browser, lands on the practice; the spent link says so | Positive | P0 |
| INV-UI-02 | the Manager picker finds an existing person by email instead of offering an invitation, and offers "Invite <email>" for a new one | Positive | P1 |

### Mobile & keyboard (UI) — 14 cases

| ID | Scenario | Type | Priority |
|---|---|---|---|
| RESP-01 | login works and fits the screen | Positive | P2 |
| RESP-02 | the sidebar becomes a drawer: open it, navigate, and it closes | Positive | P2 |
| RESP-03 | the drawer closes with its close button | Positive | P2 |
| RESP-04 | / has no sideways scrolling at 375px | Edge | P2 |
| RESP-04 | /practices has no sideways scrolling at 375px | Edge | P2 |
| RESP-04 | /practices/contributions/new has no sideways scrolling at 375px | Edge | P2 |
| RESP-04 | /access-control has no sideways scrolling at 375px | Edge | P2 |
| RESP-04 | /ai-tracker has no sideways scrolling at 375px | Edge | P2 |
| RESP-04 | /settings has no sideways scrolling at 375px | Edge | P2 |
| RESP-05 | a contribution page with a long unbroken title still fits | Edge | P2 |
| KB-01 | sign in using only the keyboard | Negative | P1 |
| KB-02 | dialogs take focus when opened and give it back when closed with Escape | Negative | P1 |
| KB-03 | tabs switch with the keyboard | Edge | P2 |
| KB-04 | every page has exactly one top-level heading | Positive | P2 |

## Known Gaps to Probe
- P360-2 — Google sign-in is a stub → AUTH-API-09 (501) and AUTH-UI-09 (toast) confirm it fails politely.
- P360-3 — Home app cards "Coming soon" until apps exist → NAV-03 (Practices for a custom role without contribution access). Cert Tracker is built since P360-12, so NAV-02 now checks its tile opens it.
- P360-12 — 🟡 pending RBAC sign-off (`cert.plan.review`, `cert.catalog.create`) and no notifications → CERT-API-08/10/16/17 pin the role matrix and the review separation.
- P360-6 / P360-9 / P360-11 — 🟡 pending RBAC sign-off → the RBAC-API and CON-API role matrices pin today's behaviour so a sign-off change shows up as a diff.
- P360-11 — no notifications; reviewers rely on the queue → CON-API-32 and WF-UI-01 check the "Awaiting my review" queue.

## Out of Scope
- Google SSO, notifications, reimbursement payout (outside the portal).
- `.docx` import (needs a real Word file; `.md` import and unsupported types are covered).
- Firefox/WebKit, load/performance, the deployed Vercel environment.

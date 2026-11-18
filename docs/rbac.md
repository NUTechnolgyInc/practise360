# Practise360 — RBAC Design (v0)

## 1. Core idea: scoped role assignments

A user gets a **role** at a **scope**. Permissions are checked against the scope of the thing being touched, walking up the tree.

```
platform                         (global)
├── app: practices
│   ├── practice: digital-engineering
│   │   ├── group: digital-engineering-fullstack
│   │   ├── group: digital-engineering-devops
│   │   └── group: digital-engineering-mobile-app
│   ├── practice: platform
│   │   ├── group: platform-commercetools
│   │   └── group: platform-magento
│   ├── practice: qa
│   └── practice: ai
├── app: cert-tracker
└── app: ai-tracker
```

- A role granted at a parent scope applies to everything below it (e.g. Practices Admin → all practices and their groups; Practice Manager → every group in their practice).
- **App visibility is derived**: a user sees an app if they hold any assignment at that app or below it. No separate "app access" table to keep in sync.
- Certification Tracker has no sub-scopes of its own. It reuses **practice scope** and the **groups** inside it: a Practice Lead's cert permissions apply to the members of *their group* (see "Practice groups" in §4).

## 2. Data model (MongoDB)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | _id (ObjectId), username (unique), displayName, email (unique when set, lower-case), isActive, googleOnly | No password stored (dev login uses hardcoded `password`, by username or email). `googleOnly` accounts (real people on the demo deployment, and anyone whose account was created by Google sign-in) refuse the dev password and are left out of the login page's demo list |
| `invitations` | email, kind (`member` \| `manager` \| `lead`), practiceId, groupId, keepPrevious, tokenHash, status (`pending` \| `accepted` \| `cancelled`), invitedBy, expiresAt, delivery, acceptedBy/At, cancelledBy/At/Reason | Someone invited into a practice by email before they have an account. Only a SHA-256 of the link's token is stored |
| `apps` | _id (`practices`, `cert-tracker`, `ai-tracker`), name, permPrefix | |
| `practices` | _id (slug), appId, name, description, isArchived, createdBy | DE, Platform, QA, AI seeded; Practices Admin adds more |
| `practice_groups` | _id (slug, e.g. `digital-engineering-fullstack`), practiceId, name, description, createdBy | Groups inside a practice. Name unique within the practice; the id never changes on rename |
| `group_memberships` | practiceId, groupId, userId, addedBy, addedAt | Which group a practice member sits in. Unique on (practiceId, userId) — one group per practice |
| `practice_overviews` | _id (= practice id), body (Markdown), updatedBy | A practice's Overview text. Kept off `practices`, which is read on every request |
| `group_overviews` | _id (= group id), body (Markdown), updatedBy | A group's Overview text, same shape as a practice's |
| `practice_files` | practiceId, groupId, uploadedBy, fileName, contentType, size, data | Files on a practice's Overview (`groupId` null) or a group's (`groupId` set) — ≤ 4 MB each, 50 per Overview |
| `permissions` | _id (= key), appId, description | Static catalog, seeded from `apps/api/src/rbac/catalog.js` |
| `roles` | _id, name, scopeType, scopeId, isSystem, assignableFrom, **permissions[]** | Permissions are embedded (no join collection). `scopeId` set on app roles and on custom roles (owning practice) |
| `role_assignments` | userId, roleId, scopeType, scopeId, grantedBy, grantedAt | Unique on (userId, roleId, scopeType, scopeId) |
| `audit_logs` | at, actorId, actorName, actorUsername, action, label, category, method, route, params, details, resultId, status, outcome, error, ip, userAgent | Append-only record of every write request and sign-in (§4 "Audit log") |

`scopeType` ∈ `platform | app | practice | group`. A user can hold several assignments (e.g. Practitioner in DE + Lead of DE Fullstack, Practitioner in AI).
An assignment whose scope type doesn't match its role's (left over from a role changing level) grants nothing.
Grants are resolved from the DB on every API request (not baked into the JWT), so a revoked role stops working immediately.

## 3. Permission catalog

Format: `<app>.<resource>.<action>`. `:own` suffix = only on records the user owns.

**Platform**
- `platform.users.manage` — create/disable users
- `platform.apps.assign` — grant app-level admin roles
- `platform.roles.manage` — edit system roles and their permissions (Super Admin only, via `*`)
- `platform.audit.view` — view the audit log (Super Admin only, via `*` — see "Audit log" in §4)

**Practices app**
- `practices.practice.create`, `practices.practice.update`, `practices.practice.archive`
- `practices.practice.view`
- `practices.members.view`, `practices.members.manage` — add/remove people, and move them between the practice's groups
- `practices.group.manage` — create, rename and delete groups in a practice
- `practices.group.update` — run a group: edit its Overview and files, and take practice members into or out of it ⁶
- `practices.roles.view`
- `practices.roles.manage` — create/edit custom roles in the practice
- `practices.roles.assign` — assign roles to members (see escalation rule §5)
- `practices.contribution.view` — see contributions in the practice
- `practices.contribution.create` — start a contribution, ask to join one, accept an invite
- `practices.contribution.update:own` — edit and log progress on contributions you own **or contribute to**
- `practices.contribution.manage` — edit, log progress and manage people on any contribution in the practice
- `practices.contribution.review` — first review step (Lead step)
- `practices.contribution.approve` — final approval, which publishes (Manager step)

**Certification Tracker**
- `cert.catalog.manage` — edit or retire any catalog entry
- `cert.catalog.create` — add a certification/course to the shared catalog (e.g. while assigning one that isn't listed)
- `cert.catalog.view`
- `cert.plan.manage:own` — plan your own certifications, submit completions
- `cert.plan.view` — view plans of practice members
- `cert.plan.suggest` — recommend a cert (the member accepts or declines)
- `cert.plan.assign` — assign a cert (mandatory, with a due date; the member can't decline or drop it)
- `cert.plan.review` — first review of a completed cert (Lead step)
- `cert.plan.verify` — final approval of a completed cert, which marks it Completed (Manager step)
- `cert.reports.view`

**AI Tracker**
- `ai.usage.manage:own` — submit, replace and delete your own monthly Claude usage report (PDF)
- `ai.usage.view` — view usage reports of people in scope (see "Claude usage reports" below)
- `ai.admin.manage`, `ai.items.create`, `ai.items.update`, `ai.items.view`, `ai.reports.view` — placeholders, unused until initiative tracking is specified

## 4. System roles

| Role | Scope | Permissions |
|---|---|---|
| **Super Admin** | platform | everything (`*`) |
| **Practices Admin** | app: practices | all `practices.*` (incl. every `practices.contribution.*`), `cert.catalog.view/create`, all `cert.plan.*`, `cert.reports.view`, `ai.usage.view`, `ai.usage.manage:own` ¹ ² ⁴ |
| **Practice Manager** | practice | `practices.practice.view/update`, `practices.members.*`, `practices.roles.*`, `practices.group.manage` ⁵, `practices.group.update` ⁶, `practices.contribution.*` ³, all `cert.plan.*` (view/suggest/assign/review/verify/manage:own) ⁴, `cert.catalog.view/create`, `cert.reports.view`, `ai.usage.view`, `ai.usage.manage:own` |
| **Practice Lead** | **group** ⁵ | `practices.contribution.manage/review` ³, `cert.plan.view/suggest/assign/review` ⁴, `cert.catalog.create`, `practices.roles.view` (read across the Lead's practice), `practices.group.update` ⁶ (their own group) — only the Lead's extras; a Lead is also a member of the practice (usually Practitioner), which gives the rest |
| **Practitioner** | practice | `practices.practice.view`, `practices.members.view`, `practices.contribution.view/create/update:own` ³, `cert.catalog.view`, `cert.plan.manage:own`, `ai.usage.manage:own` |
| **Cert Admin** | app: cert-tracker | all `cert.*` (across all practices) |
| **AI Admin** | app: ai-tracker | all `ai.*` |
| **AI Member** | app: ai-tracker | `ai.items.create/update/view`, `ai.usage.manage:own` |

¹ Changed 2026-11-11: the original list (`cert.plan.view`, `cert.reports.view` only) made §5 impossible — the escalation guard needs the actor to hold every Manager permission, including `cert.plan.suggest/assign/verify/manage:own`. Pending owner sign-off.

² Added 2026-11-12 with Claude usage reports: Practices Admin must hold every Manager permission to appoint Managers (§5).

³ Added 2026-11-12 with Practice contributions (below). Practices Admin already holds all `practices.*`, so the escalation guard is unchanged.

⁴ Added 2026-11-12 with the Certification Tracker (below): `cert.plan.review` (Lead step) and `cert.catalog.create`. Practices Admin gets `cert.catalog.create` too, so it still holds every Manager permission (§5).

⁵ Changed 2026-11-12 with Practice groups (below), owner's decision: Practice Lead moved from practice to **group** scope and lost the permissions every practice member already has (it used to bundle Practitioner's). `practices.group.manage` is new; Practices Admin holds it through `practices.*`.

⁶ Added 2026-11-13 with group pages, owner's decision: the group's Lead runs their group — its Overview and who's in it. Practice Manager holds it at the practice (so it can still appoint Leads, §5) and Practices Admin through `practices.*`. `sync-roles` adds it to both roles on existing databases.

The table above is the **default** set (`apps/api/src/rbac/catalog.js`). Since 2026-11-12 Super Admin can edit system roles at runtime (`platform.roles.manage`):
- Editable: name, description, permissions. Fixed: id, scope type, `assignableFrom` — so the escalation guard's shape doesn't change.
- Super Admin itself (`*`) is never editable, so nobody can lock the platform out.
- `platform.*` permissions only on platform-scope roles.
- Edits apply on the next request to everyone holding the role. The escalation guard still applies to *granting*: if Practice Manager gains a permission Practices Admin lacks, Practices Admin can't appoint Managers until it gets it too.
- `npm run sync-roles -w api` no longer overwrites existing system roles; `-- --reset` restores the defaults. Exception: permissions that are **new to the catalog** (not yet in the DB) are added to the system roles whose defaults include them, so a new feature works without hand-editing every role.

Practice roles also implicitly include `cert.catalog.view` and `ai.usage.manage:own`, which makes Cert Tracker and AI Tracker visible to every practice member.

### Practices and groups (Practices app)
Decided by the owner on 2026-11-12. The hierarchy is **Practices app → practice → group**:

- **Practices**: four are seeded (Digital Engineering, Platform, QA, AI). Practices Admin creates more (`practices.practice.create`) and chooses each practice's **Practice Manager**. Manager or Practices Admin renames a practice (`practices.practice.update`). Ids are slugs of the name and never change; `contributions`, `new` and `people` are reserved.
- **Groups**: the Practice Manager (or Practices Admin) creates named groups inside a practice — e.g. `digital-engineering-fullstack`, `digital-engineering-devops`, `platform-commercetools` — with `practices.group.manage`. A group can be renamed, and deleted only when it has no Lead and no members.
- **One Manager per practice, one Lead per group.** Choosing a new one replaces the current one (after a confirmation in the UI). The generic grant in Access control refuses a second Manager or Lead (409) and points to the Practices page.
- **Group Lead**: Practice Lead is granted at the **group** scope, by the Practice Manager or Practices Admin (`assignableFrom: practice`, escalation guard as usual). The Lead must already be a member of the practice. If they aren't in a group yet, they're put into the one they lead.
- **Membership**: being in a practice = holding a practice-scope role there (Manager, Practitioner, custom role). Each member sits in **at most one group** per practice (`group_memberships`). Someone not in a group yet is covered by the Manager. Moving people between any groups needs `practices.members.manage` at the practice (Manager, Practices Admin, custom roles such as Practice Coordinator). Without it, a move needs `practices.group.update` on **every group involved** — so a Lead can take practice members who aren't in a group into their own group and remove members from it (they stay in the practice, without a group), but can't take someone from another Lead's group. Adding someone to the practice grants Practitioner (escalation guard), so a Lead can't bring in people from outside the practice or invite them.
- **Group page** (added 2026-11-13, owner's request): each group has its own page with Overview, Members and Contributions tabs; groups have no sub-groups. Its **Lead, the Practice Manager and Practices Admin run it** with `practices.group.update`: edit the group's Overview (Markdown + files, stored apart from the practice's) and add/remove its members as above. Renaming or deleting the group and choosing its Lead stay with `practices.group.manage` and the escalation guard (Manager, Practices Admin). Everyone who can view the practice reads the group's Overview and members. The Contributions tab lists contributions owned by the group's **current** members (the same rule that routes them to its Lead); anyone who may start a contribution in the practice can start one from there (owner's choice) — it then belongs to the starter's own group, or to the practice if they're in none.
- **What a Lead reaches** (settles §8 Q4): a member's contributions and cert plans are checked at the **owner's group** when they're in one (`group → practice → app → platform`), otherwise at the practice. So a Lead reviews, manages and suggests/assigns certs only for **their group's members**; the Manager, Practices Admin and Cert Admin still reach everyone. The group isn't stored on the contribution or plan — it's resolved from the owner's current membership, so moving someone to another group hands their open work to the new Lead.
- **Overview** (added 2026-11-13): each practice has an Overview tab with key information (Markdown) and files. Everyone with `practices.practice.view` there reads it and opens the files; `practices.practice.update` (Practice Manager, Practices Admin, Super Admin) edits the text and uploads/removes files — the same permission as renaming the practice, so no new key. The practices list also names the active Practices Admins to everyone who can see it.
- **Visibility is unchanged**: contributions are still visible to the whole practice (everyone holds `practices.contribution.view` at the practice), and every practice member sees the practice's groups, Manager and Leads.
- **Guards**: a Lead's last practice-scope role can't be revoked while they lead a group (choose another Lead first). Revoking someone's last practice-scope role also takes them out of the practice's group.

### Invitations (Practices app)
Added 2026-11-13 at the owner's request: wherever a Manager, Lead or member is picked, someone who isn't on Practise360 yet can be invited by email instead. This is the only way new accounts are created.

- **What can be invited:** `member` (joins the practice as Practitioner, optionally straight into a group), `manager` (becomes the practice's Manager), `lead` (joins as Practitioner and becomes the group's Lead). No new permission keys: an invitation is a **deferred grant** and needs exactly what the direct appointment needs — the escalation guard (§5) for every role it grants, plus the right to place a member into that group (`practices.members.manage`, or `practices.group.update` on it). So Practices Admin invites Managers, Leads and members anywhere; a Practice Manager invites Leads and members in their own practice; Leads and Practitioners can't invite (a Lead's `practices.group.update` places existing practice members only).
- **Re-checked on accept** against the inviter's grants at that moment. If the inviter lost the right (or was deactivated), or the practice is gone, the link stops working (410).
- **Who sees open invitations:** holders of `practices.roles.assign` at the practice (they could send one). Cancel and resend need the same right as sending that invitation — a Practice Manager can't cancel an invitation for their own replacement.
- **One open invitation** per email per practice, and per Manager / Lead slot: a newer one replaces the older. Filling the slot directly (Practices page or Access control) cancels the open invitation for it, so an accept can't silently undo that choice. Deleting a group cancels Lead invitations for it; member invitations into it still join the practice, without a group.
- **Existing accounts:** an email that already has an account is refused (409) — pick the person instead. If an invited email gets an account in between (e.g. accepted another practice's invitation), accepting applies the grants to that account.
- **Bulk add by email** (added 2026-11-17): Add member (practice) and a group's Add member, for callers who can add people from outside the practice, take a list of addresses (`POST /practices/:id/invites/bulk`, members only, ≤ 50 per call). Each address gets the single invite's checks — valid, `INVITE_EMAIL_DOMAINS`, the escalation guard — and its own result. Unlike a single invite, an address that **already has an account is added directly** (the same appointment as picking them, so the same guard), one already in the practice is reported and left as it is, and a deactivated account is refused. A caller who couldn't add anyone here gets 403 before any address is looked up, so it doesn't reveal who has an account. Manager and Lead pickers stay one person at a time (one holder per slot).
- **The link** is single-use, expires after 7 days, and is the credential: it proves the person owns the mailbox, so the public `/invites/:token` routes need no session and accepting signs them in. Afterwards they sign in like everyone else (dev: email or username + `password`; SSO later — RBAC still only sees a `userId`). Resend issues a new link (the old one stops working) and makes the resender the inviter.
- **Email:** sent over SMTP (`SMTP_URL`, `MAIL_FROM`). Without `SMTP_URL` the email is printed to the API console, and — only with `AUTH_MODE=dev` — the join link is returned to the inviter so it can be passed on. `INVITE_EMAIL_DOMAINS` can restrict which domains may be invited.

### Claude usage reports (AI Tracker)
- Every practice member (and AI Member) uploads **one PDF per month** (`YYYY-MM`, not in the future, ≤ 4 MB); uploading again replaces it. The PDF is produced by the `claude-usage-report` skill users download from the portal.
- Reports have no scope of their own. Like Cert Tracker they **reuse the owner's practice scope**: a report is visible to anyone with `ai.usage.view` at one of the owner's practices (or a parent), or at `app: ai-tracker`.
- Result: Practice Manager → their practice; Practices Admin → every practice member; AI Admin / Super Admin → everyone (including people with no practice). Leads and Practitioners see only their own.
- The team view lists everyone holding `ai.usage.manage:own` in the viewer's scope as Submitted / Pending, so managers can chase missing reports. Super Admin (`*` only) isn't expected to submit.

### Practice contributions (Practices app)
Work a practitioner starts inside a practice: Reusable framework / accelerator, Automation / internal tool, Client win story, Internal case study, Blog, or Other (custom label). Each has a title, Markdown description (a .docx/.md can be imported into it), owner ("started by"), start and due dates, contributors, a progress log and attachments (≤ 4 MB each).

- **Scope:** a contribution lives at **practice scope**. Everyone with `practices.contribution.view` there sees it — the whole practice, so people can discover work and ask to join. Other practices don't (404, not 403, so existence isn't leaked).
- **"Own" = owner or contributor.** `update:own` is checked against `{ ownerIds: [owner, ...contributors] }` (the engine accepts `ownerIds` as well as `ownerId`).
- **Added on someone's behalf** (owner's request, 2026-11-17): anyone with `practices.contribution.manage` at a member's scope can start a contribution **for** that member — the Lead of the member's group, the Practice Manager, Practices Admin (and custom roles holding `manage`). Same reach as managing one, so a Lead only adds for their own group's members; no new permission. The member is the owner and runs it as usual (edits, logs progress, submits — only the owner submits). The creator is stored as `createdBy` and shown everywhere as **"Added by …"** (list row, header, details, People card, timeline). The person who added it **can't review or approve it** (same separation as for participants), so another reviewer takes that step — e.g. if the Manager added it, the Lead does the Lead step and Practices Admin gives final approval.
- **People:** the owner (or anyone with `manage`) invites practice members and answers join requests; anyone with `create` may ask to join while it's in progress. Contributors can leave; only the owner submits.
- **Progress log:** owner, contributors, and `manage` holders (Lead, Manager, Practices Admin, Super Admin). Each entry is Markdown with optional attachments; entries can't be edited or deleted.
- **Workflow:** `in_progress → lead_review → manager_review → published`, plus `clarification` (back to the owner; resubmitting returns to the reviewer who asked) and `declined` (closed).
  - Submit (owner only) requires a description, summary, impact and ≥ 1 document; repo, demo and other links are optional.
  - Lead step: `practices.contribution.review` (the Lead of the owner's group, Manager). Manager step: `practices.contribution.approve` (Manager, Practices Admin); approving publishes automatically.
  - Nobody reviews a contribution they own, contribute to, or added on someone's behalf. A Manager may take the Lead step (e.g. when the owner is the only Lead), but the person who did the Lead step can't also give final approval.
  - Every decision (with its comment — required unless approving) is logged on the contribution's timeline.
- Rules live in one pure function, `actionsFor()` in `apps/api/src/rbac/contribution-access.js`; the API enforces it and returns its result as `actions` so the UI shows only what the API would allow.

### Certification Tracker
Practice members plan certifications and courses, then submit each completion for the same two-step approval as contributions.

- **Catalog** (shared by every practice): title, type (**Certification** or **Course**), provider, link, short description. Anyone with `cert.catalog.create` (Lead, Manager, Practices Admin, Cert Admin) adds entries — including inline while assigning one that isn't listed. The creator can fix their own entry; `cert.catalog.manage` (Cert Admin) edits or retires any entry. Retired entries stay on existing plans but can't be picked for new ones. Duplicates (same title + provider) are refused.
- **Plans** live at the **owner's practice scope** (chosen at creation when someone belongs to several). Each plan keeps a snapshot of the cert (title, type, provider, link), so later catalog edits don't rewrite history. A practitioner's own plan can use a **one-off** cert that isn't added to the catalog.
- **Visibility:** the owner, plus anyone with `cert.plan.view` at the owner's group or practice (the owner's group Lead, Manager, Practices Admin, custom roles such as Practice Coordinator) or at `app: cert-tracker` (Cert Admin, which has no practice). Everyone else gets 404, not 403. Unlike contributions, practitioners don't see each other's plans.
- **Sources:** `self` (the member's own plan), `suggested` (recommended — the member accepts with start and due dates, or declines with a reason), `assigned` (mandatory, due date required — the member can't decline or drop it, and only someone with `cert.plan.assign` other than the owner can move its due date). Suggest and assign target any member of the practice the actor reaches (anyone holding `cert.plan.manage:own` through a practice-scope assignment there — for a Lead, only their group's members), several at once. A member who already has an open plan for the same catalog entry is skipped. Whoever can suggest or assign may **withdraw** an open recommendation or assignment.
- **Workflow:** `suggested → planned → lead_review → manager_review → completed`, plus `clarification` (back to the owner; resubmitting returns to the reviewer who asked), `declined` (recommendation declined) and `dropped` (the owner dropped their own plan, or the recommendation/assignment was withdrawn).
  - Submitting a completion (owner only, while `planned` or `clarification`) requires the completion date (not in the future), a **verification link** (http/https), and ≥ 1 certificate file (PDF or image, ≤ 4 MB). Optional: credential ID and expiry date. **Reimbursement** is optional: amount > 0, currency INR or USD, and ≥ 1 receipt file.
  - Lead step: `cert.plan.review` (the Lead of the owner's group, Manager). Manager step: `cert.plan.verify` (Manager, Practices Admin). Final approval marks the plan **Completed**, and approves the reimbursement amount with it (payout happens outside the portal).
  - Reviewers approve, ask for clarification, or **reject**. A rejected completion goes **back to `planned`** with the reason logged, so the member can fix it and resubmit from the Lead step (assigned certs stay mandatory). This differs from contributions, where a decline closes the item.
  - Same separation as contributions: nobody reviews their own plan, and the person who did the Lead step can't also give final approval. Cert Admin holds every `cert.*` permission, so they can act at either step in any practice.
  - Every action (created, recommended, assigned, accepted, declined, dates changed, submitted, review decisions, completed, dropped, withdrawn) is logged on the plan's timeline with its comment.
- **Derived flags:** *overdue* = due date passed while `planned` or `clarification`; *expired* = completed with an expiry date in the past.
- Rules live in one pure function, `certActionsFor()` in `apps/api/src/rbac/cert-access.js`. The API enforces it and returns its result as `actions`.

### People profiles
Added 2026-11-13 — pending owner sign-off. Every person's name in the portal links to their profile (`/people/:id`, `GET /people/:id`). **A profile never shows more than the screens that already show that person**: each part reuses the rule of the screen it comes from, so there are no new permission keys.

| Part | Who sees it |
|---|---|
| Name, username, email ⁶, "on Practise360 since" | Anyone who can open the people directory (`GET /rbac/users` — `practices.members.view`, `practices.roles.assign`, `platform.users.manage` or `platform.apps.assign` at any scope), plus anyone who can see another part of the profile. Otherwise **404**. |
| Practices, group, practice roles | Per practice: `practices.members.view` there (the member list). The Manager and group Leads also to anyone with `practices.practice.view` there (the practice page shows them). The group someone sits in needs `practices.members.view`. |
| App roles (Practices Admin, Cert Admin, AI Admin, AI Member, Super Admin) | Whoever sees that assignment in Access control; Practices Admin also to anyone with `practices.practice.view` anywhere (`/practices` names them). |
| Contributions (owned or contributed to) | Each by its own rule (`actionsFor().view`) — the whole practice. |
| Certification plans | Each by its own rule (`certActionsFor().view`) — the owner, their group's Lead, the Manager, Practices Admin, Cert Admin. Practitioners still don't see each other's plans. |
| Claude usage reports | The owner, and `ai.usage.view` at one of the owner's practices or at `app: ai-tracker`. Shown for people expected to submit, or who have. |

- Everyone sees all of their own profile.
- A part the viewer can't see comes back as `null` and its tab is hidden; an empty list means "visible, nothing yet".
- Rules live in one pure function, `profileView()` in `apps/api/src/rbac/profile-access.js`; records are still filtered one by one with `actionsFor()` / `certActionsFor()`.

⁶ Email is shown when set on the user (the seed sets none). It's the only field no other screen shows yet — part of the sign-off.

### Audit log
Added 2026-11-18 at the owner's request: every action in the portal is recorded and shown to Super Admin.

- **What's recorded:** every write request (POST / PUT / PATCH / DELETE) on every route, and every sign-in (password, Google, accepting an invitation) — **including refused and failed ones** (`outcome`: `success`, `denied` = 401/403, `failed` = any other error), with the error the caller saw. Reads (opening a page, downloading a file) are not recorded.
- **Each entry:** when, who (user id plus the name and username they had then, so it still reads right after a rename), the action (`rbac.assignment.grant` → "Granted a role") and its area, the route **pattern** (never the raw URL — an invitation link's token is in it), path params, the request's fields, the id a create returned, HTTP status, IP and user agent.
- **Never stored:** any field whose name looks like a secret (password, token, credential, secret, authorization, cookie, otp) at any depth, file bytes (uploads log the file name only), and text beyond 200 characters.
- **Who sees it:** `platform.audit.view`, a platform-scope permission, so only Super Admin holds it (`*`). Custom roles can't carry `platform.*`, and Super Admin is the only platform-scope role.
- **Append-only:** no API route edits or deletes an entry. No retention limit yet.
- **How:** one app-level middleware (`apps/api/src/lib/audit.js`) names each request from the action list in `apps/api/src/lib/audit-actions.js`, and holds the response until the entry is written (at most 3 s; a failed write is logged on the server and never fails the action itself). `test/audit.test.js` fails if a write route has no entry in that list.
- Collection: `audit_logs` (§2). API: `GET /audit-log` with filters (search, area, outcome, person, date range) and pages of 50.

### Custom roles
- Created **inside a practice** by anyone with `practices.roles.manage` there (Practice Manager, Practices Admin).
- `scope_type = practice`, `scope_id = <practice>` — only assignable in that practice.
- Permissions picked from the practice-scoped subset of the catalog (`practices.*` except create/archive — so including `practices.contribution.*` — `cert.plan.*` and `cert.catalog.view/create`).
- Example: "Practice Coordinator" = `practices.members.manage` + `practices.roles.assign` + `cert.plan.view` — someone who manages roles/people without being the Manager.

## 5. Who can assign what (escalation guard)

To assign role **R** to a user at scope **S**, the actor needs:
1. `practices.roles.assign` (or `platform.apps.assign` for app roles) at **S** or a parent, **and**
2. Every permission in **R** is one the actor already holds at **S** (no granting more than you have).

Result:
- Super Admin → assigns Practices Admin, Cert Admin, AI Admin.
- Practices Admin → assigns Practice Managers in any practice, and Leads of any group.
- Practice Manager → assigns Practitioner and custom roles in *their* practice, and the Lead of each group in it (Lead is `assignable_from: practice`, granted at group scope). Cannot appoint another Manager: roles carry an `assignable_from` field, and `practice_manager` is `assignable_from: app`, so only Practices Admin can grant it.
- Extra checks on top of the guard: one Manager per practice and one Lead per group (409 otherwise), and a Lead must be a member of the group's practice.
- Practice Lead → cannot assign roles (no `practices.roles.assign`).
- App roles (Cert Admin, AI Admin, AI Member) use `platform.apps.assign`, which only Super Admin holds — so an AI Admin can't add AI Members yet (see open question 5).
- **Revoking** is guarded the same way as granting, and the last Super Admin assignment can't be removed.
- Custom roles: the creator must hold every permission they put in the role at that practice.

## 6. Authorization check

```js
// scopeChain('practice', 'qa') -> [practice:qa, app:practices, platform]
// scopeChain('group', 'qa-automation') -> [group:qa-automation, practice:qa, app:practices, platform]
function can(user, permission, scope, resource) {
  const [key, ownOnly] = permission.split(':');
  const chain = scopeChain(scope.type, scope.id);

  const granted = user.assignments.some(a =>
    chain.some(s => s.type === a.scopeType && s.id === a.scopeId) &&
    (a.permissions.has('*') || a.permissions.has(key) || a.permissions.has(`${key}:own`) && isOwner(user, resource))
  );
  return granted;
}

// Visible apps for the launcher
function visibleApps(user) {
  return [...new Set(user.assignments.flatMap(a => appsUnder(a.scopeType, a.scopeId)))];
}
```

- Load assignments + flattened permissions once at login, put them in the session/JWT (`{ userId, assignments: [{scopeType, scopeId, perms}] }`).
- **Enforce on the API** (Express middleware `requirePermission('cert.plan.assign', req => ({ type: 'practice', id: req.params.practiceId }))`). The web app uses the same data only to hide/show UI.

### Cert Tracker example
"Can Lead `de.lead` (Lead of DE Fullstack) assign AWS SAA to `de.dev1`?"
→ resolve the target's scope: `de.dev1` sits in group `digital-engineering-fullstack` → `can(lead, 'cert.plan.assign', {type:'group', id:'digital-engineering-fullstack'})` → true.
Same call for `de.dev2` (in DE DevOps) or a QA practitioner → false.

### Certification plan status
Superseded on 2026-11-12 by §4 "Certification Tracker": `suggested → planned → lead_review → manager_review → completed`, plus `clarification`, `declined` and `dropped`. *Expired* is derived from the expiry date instead of being stored. There's no separate `in_progress` state: the start date shows it.

## 7. Seed users (dev only, password `password`)

| Username | Assignments |
|---|---|
| `superadmin` | Super Admin @ platform |
| `practices.admin` | Practices Admin @ practices |
| `de.manager` | Practice Manager @ digital-engineering |
| `de.lead` | Practitioner @ digital-engineering + Practice Lead @ group DE Fullstack (member of it) |
| `de.dev1` | Practitioner @ digital-engineering, in DE Fullstack |
| `de.lead2` / `de.dev2` | same pattern for group DE DevOps |
| `platform.manager` / `platform.lead` / `platform.dev1` | same pattern @ platform, group Commercetools |
| `qa.manager` / `qa.lead` / `qa.tester1` | same pattern @ qa, group Automation |
| `ai.manager` / `ai.lead` / `ai.dev1` | same pattern @ ai practice, group GenAI |
| `de.coordinator` | custom "Practice Coordinator" @ digital-engineering (not in a group) |
| `cert.admin` | Cert Admin @ cert-tracker |
| `aitracker.admin` | AI Admin @ ai-tracker |
| `aitracker.member` | AI Member @ ai-tracker |
| `multi.user` | Practitioner @ qa + Lead of QA Manual Testing + Practitioner @ ai + AI Member |

Seeded groups without a Lead: DE Mobile App, Platform Magento.

Every seeded user also has a synthetic email, `<username>@example.com`, so email login and "already on Practise360?" checks work in dev.

The hardcoded password must sit behind an `AUTH_MODE=dev` flag so it can't ship to production by accident (a demo deployment on seeded data may opt in with `ALLOW_DEMO_LOGIN_IN_PRODUCTION=true`, owner decision 2026-11-17); swap for SSO later without touching RBAC (auth only produces a `userId`).

**Google sign-in** (`POST /auth/google`) is that SSO. The API verifies Google's ID token and looks up the user by email. **The first Google sign-in creates the account** (owner decision 2026-11-17) with **no role assignments**, so it sees no app — the home page tells them to ask their Practice Manager to add them. Access still only comes from a grant or an invitation; an invitation sent to that email later reuses the same account. With `GOOGLE_ALLOWED_DOMAINS` set, only Google Workspace accounts on those domains get in. RBAC is unchanged: Google only resolves a `userId`.

## 8. Open questions

1. Can a practitioner belong to more than one practice? (Design supports it; UI needs a "primary practice".)
2. Should a Practice Manager be able to appoint another Manager, or only Practices Admin?
3. Custom roles: per practice only, or also global templates a Practices Admin can reuse?
4. ~~Can a Lead see all practitioners in the practice, or only their direct reportees?~~ Answered 2026-11-12: Leads lead a **group** and act only on its members (§4 "Practices and groups").
5. AI Tracker: what entities and roles beyond Admin/Member? (Claude usage reports are built; initiative tracking still open.)
6. Should Practice Leads see their practice's Claude usage reports? Currently no — only Managers and above.

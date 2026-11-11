# Practise360 — RBAC Design (v0)

## 1. Core idea: scoped role assignments

A user gets a **role** at a **scope**. Permissions are checked against the scope of the thing being touched, walking up the tree.

```
platform                         (global)
├── app: practices
│   ├── practice: digital-engineering
│   ├── practice: platform
│   ├── practice: qa
│   └── practice: ai
├── app: cert-tracker
└── app: ai-tracker
```

- A role granted at a parent scope applies to everything below it (e.g. Practices Admin → all practices).
- **App visibility is derived**: a user sees an app if they hold any assignment at that app or below it. No separate "app access" table to keep in sync.
- Certification Tracker has no sub-scopes of its own. It reuses **practice scope**: a Practice Lead's cert permissions apply to practitioners of *their* practice.

## 2. Data model (MongoDB)

| Collection | Key fields | Notes |
|---|---|---|
| `users` | _id (ObjectId), username (unique), displayName, email, isActive | No password stored (dev login uses hardcoded `password`) |
| `apps` | _id (`practices`, `cert-tracker`, `ai-tracker`), name, permPrefix | |
| `practices` | _id (slug), appId, name, isArchived | DE, Platform, QA, AI |
| `permissions` | _id (= key), appId, description | Static catalog, seeded from `apps/api/src/rbac/catalog.js` |
| `roles` | _id, name, scopeType, scopeId, isSystem, assignableFrom, **permissions[]** | Permissions are embedded (no join collection). `scopeId` set on app roles and on custom roles (owning practice) |
| `role_assignments` | userId, roleId, scopeType, scopeId, grantedBy, grantedAt | Unique on (userId, roleId, scopeType, scopeId) |

`scopeType` ∈ `platform | app | practice`. A user can hold several assignments (e.g. Lead in DE, Practitioner in AI).
Grants are resolved from the DB on every API request (not baked into the JWT), so a revoked role stops working immediately.

## 3. Permission catalog

Format: `<app>.<resource>.<action>`. `:own` suffix = only on records the user owns.

**Platform**
- `platform.users.manage` — create/disable users
- `platform.apps.assign` — grant app-level admin roles
- `platform.roles.manage` — edit system roles and their permissions (Super Admin only, via `*`)

**Practices app**
- `practices.practice.create`, `practices.practice.update`, `practices.practice.archive`
- `practices.practice.view`
- `practices.members.view`, `practices.members.manage` — add/remove people
- `practices.roles.view`
- `practices.roles.manage` — create/edit custom roles in the practice
- `practices.roles.assign` — assign roles to members (see escalation rule §5)

**Certification Tracker**
- `cert.catalog.manage` — maintain the list of certifications/courses
- `cert.catalog.view`
- `cert.plan.manage:own` — practitioner adds/updates own plans & status
- `cert.plan.view` — view plans of practice members
- `cert.plan.suggest` — suggest a cert (practitioner can accept/decline)
- `cert.plan.assign` — assign a cert (mandatory, with due date)
- `cert.plan.verify` — mark completion as verified
- `cert.reports.view`

**AI Tracker**
- `ai.usage.manage:own` — submit, replace and delete your own monthly Claude usage report (PDF)
- `ai.usage.view` — view usage reports of people in scope (see "Claude usage reports" below)
- `ai.admin.manage`, `ai.items.create`, `ai.items.update`, `ai.items.view`, `ai.reports.view` — placeholders, unused until initiative tracking is specified

## 4. System roles

| Role | Scope | Permissions |
|---|---|---|
| **Super Admin** | platform | everything (`*`) |
| **Practices Admin** | app: practices | all `practices.*`, `cert.catalog.view`, all `cert.plan.*`, `cert.reports.view`, `ai.usage.view`, `ai.usage.manage:own` ¹ ² |
| **Practice Manager** | practice | `practices.practice.view/update`, `practices.members.*`, `practices.roles.*`, `cert.plan.view/suggest/assign/verify`, `cert.reports.view`, `cert.plan.manage:own`, `ai.usage.view`, `ai.usage.manage:own` |
| **Practice Lead** | practice | `practices.practice.view`, `practices.members.view`, `practices.roles.view`, `cert.plan.view/suggest/assign`, `cert.plan.manage:own`, `ai.usage.manage:own` |
| **Practitioner** | practice | `practices.practice.view`, `practices.members.view`, `cert.catalog.view`, `cert.plan.manage:own`, `ai.usage.manage:own` |
| **Cert Admin** | app: cert-tracker | all `cert.*` (across all practices) |
| **AI Admin** | app: ai-tracker | all `ai.*` |
| **AI Member** | app: ai-tracker | `ai.items.create/update/view`, `ai.usage.manage:own` |

¹ Changed 2026-11-11: the original list (`cert.plan.view`, `cert.reports.view` only) made §5 impossible — the escalation guard needs the actor to hold every Manager permission, including `cert.plan.suggest/assign/verify/manage:own`. Pending owner sign-off.

² Added 2026-11-12 with Claude usage reports: Practices Admin must hold every Manager permission to appoint Managers (§5).

The table above is the **default** set (`apps/api/src/rbac/catalog.js`). Since 2026-11-12 Super Admin can edit system roles at runtime (`platform.roles.manage`):
- Editable: name, description, permissions. Fixed: id, scope type, `assignableFrom` — so the escalation guard's shape doesn't change.
- Super Admin itself (`*`) is never editable, so nobody can lock the platform out.
- `platform.*` permissions only on platform-scope roles.
- Edits apply on the next request to everyone holding the role. The escalation guard still applies to *granting*: if Practice Manager gains a permission Practices Admin lacks, Practices Admin can't appoint Managers until it gets it too.
- `npm run sync-roles -w api` no longer overwrites existing system roles; `-- --reset` restores the defaults.

Practice roles also implicitly include `cert.catalog.view` and `ai.usage.manage:own`, which makes Cert Tracker and AI Tracker visible to every practice member.

### Claude usage reports (AI Tracker)
- Every practice member (and AI Member) uploads **one PDF per month** (`YYYY-MM`, not in the future, ≤ 4 MB); uploading again replaces it. The PDF is produced by the `claude-usage-report` skill users download from the portal.
- Reports have no scope of their own. Like Cert Tracker they **reuse the owner's practice scope**: a report is visible to anyone with `ai.usage.view` at one of the owner's practices (or a parent), or at `app: ai-tracker`.
- Result: Practice Manager → their practice; Practices Admin → every practice member; AI Admin / Super Admin → everyone (including people with no practice). Leads and Practitioners see only their own.
- The team view lists everyone holding `ai.usage.manage:own` in the viewer's scope as Submitted / Pending, so managers can chase missing reports. Super Admin (`*` only) isn't expected to submit.

### Custom roles
- Created **inside a practice** by anyone with `practices.roles.manage` there (Practice Manager, Practices Admin).
- `scope_type = practice`, `scope_id = <practice>` — only assignable in that practice.
- Permissions picked from the practice-scoped subset of the catalog (`practices.*` except create/archive, and `cert.plan.*`).
- Example: "Practice Coordinator" = `practices.members.manage` + `practices.roles.assign` + `cert.plan.view` — someone who manages roles/people without being the Manager.

## 5. Who can assign what (escalation guard)

To assign role **R** to a user at scope **S**, the actor needs:
1. `practices.roles.assign` (or `platform.apps.assign` for app roles) at **S** or a parent, **and**
2. Every permission in **R** is one the actor already holds at **S** (no granting more than you have).

Result:
- Super Admin → assigns Practices Admin, Cert Admin, AI Admin.
- Practices Admin → assigns Practice Managers in any practice.
- Practice Manager → assigns Lead, Practitioner, custom roles in *their* practice. Cannot appoint another Manager: roles carry an `assignable_from` field, and `practice_manager` is `assignable_from: app`, so only Practices Admin can grant it.
- Practice Lead → cannot assign roles (no `practices.roles.assign`).
- App roles (Cert Admin, AI Admin, AI Member) use `platform.apps.assign`, which only Super Admin holds — so an AI Admin can't add AI Members yet (see open question 5).
- **Revoking** is guarded the same way as granting, and the last Super Admin assignment can't be removed.
- Custom roles: the creator must hold every permission they put in the role at that practice.

## 6. Authorization check

```js
// scopeChain('practice', 'qa') -> [practice:qa, app:practices, platform]
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
"Can Lead `de.lead` assign AWS SAA to `de.practitioner`?"
→ resolve target's practice(s) → `can(lead, 'cert.plan.assign', {type:'practice', id:'digital-engineering'})` → true.
Same call against a QA practitioner → false.

### Certification plan status
`SUGGESTED → PLANNED → IN_PROGRESS → COMPLETED → VERIFIED`, plus `DECLINED` (suggested only), `DROPPED`, `EXPIRED`.
Each plan stores `source: self | suggested | assigned`, `created_by`, `due_date`. Practitioners cannot drop or decline an **assigned** plan.

## 7. Seed users (dev only, password `password`)

| Username | Assignments |
|---|---|
| `superadmin` | Super Admin @ platform |
| `practices.admin` | Practices Admin @ practices |
| `de.manager` | Practice Manager @ digital-engineering |
| `de.lead` | Practice Lead @ digital-engineering |
| `de.dev1` | Practitioner @ digital-engineering |
| `platform.manager` / `platform.lead` / `platform.dev1` | same pattern @ platform |
| `qa.manager` / `qa.lead` / `qa.tester1` | same pattern @ qa |
| `ai.manager` / `ai.lead` / `ai.dev1` | same pattern @ ai practice |
| `de.coordinator` | custom "Practice Coordinator" @ digital-engineering |
| `cert.admin` | Cert Admin @ cert-tracker |
| `aitracker.admin` | AI Admin @ ai-tracker |
| `aitracker.member` | AI Member @ ai-tracker |
| `multi.user` | Lead @ qa + Practitioner @ ai + AI Member |

The hardcoded password must sit behind an `AUTH_MODE=dev` flag so it can't ship to production by accident; swap for SSO later without touching RBAC (auth only produces a `userId`).

## 8. Open questions

1. Can a practitioner belong to more than one practice? (Design supports it; UI needs a "primary practice".)
2. Should a Practice Manager be able to appoint another Manager, or only Practices Admin?
3. Custom roles: per practice only, or also global templates a Practices Admin can reuse?
4. Can a Lead see all practitioners in the practice, or only their direct reportees?
5. AI Tracker: what entities and roles beyond Admin/Member? (Claude usage reports are built; initiative tracking still open.)
6. Should Practice Leads see their practice's Claude usage reports? Currently no — only Managers and above.

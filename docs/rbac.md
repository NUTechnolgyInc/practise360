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

## 2. Data model

| Table | Key columns | Notes |
|---|---|---|
| `users` | id, username, display_name, is_active | Password not stored for now (hardcoded `password`, dev only) |
| `apps` | id (`practices`, `cert-tracker`, `ai-tracker`), name | |
| `practices` | id, app_id, name, slug | DE, Platform, QA, AI |
| `permissions` | key, app_id, description | Static catalog, seeded from code |
| `roles` | id, key, name, scope_type, scope_id (nullable), is_system | `scope_id` set ⇒ custom role owned by one practice |
| `role_permissions` | role_id, permission_key | |
| `role_assignments` | user_id, role_id, scope_type, scope_id, granted_by, granted_at | One row per (user, role, scope) |

`scope_type` ∈ `platform | app | practice`. A user can hold several assignments (e.g. Lead in DE, Practitioner in AI).

## 3. Permission catalog

Format: `<app>.<resource>.<action>`. `:own` suffix = only on records the user owns.

**Platform**
- `platform.users.manage` — create/disable users
- `platform.apps.assign` — grant app-level admin roles

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

**AI Tracker** (placeholder until requirements are clear)
- `ai.admin.manage`, `ai.items.create`, `ai.items.update`, `ai.items.view`, `ai.reports.view`

## 4. System roles

| Role | Scope | Permissions |
|---|---|---|
| **Super Admin** | platform | everything (`*`) |
| **Practices Admin** | app: practices | all `practices.*`, `cert.plan.view`, `cert.reports.view` |
| **Practice Manager** | practice | `practices.practice.view/update`, `practices.members.*`, `practices.roles.*`, `cert.plan.view/suggest/assign/verify`, `cert.reports.view`, `cert.plan.manage:own` |
| **Practice Lead** | practice | `practices.practice.view`, `practices.members.view`, `practices.roles.view`, `cert.plan.view/suggest/assign`, `cert.plan.manage:own` |
| **Practitioner** | practice | `practices.practice.view`, `practices.members.view`, `cert.catalog.view`, `cert.plan.manage:own` |
| **Cert Admin** | app: cert-tracker | all `cert.*` (across all practices) |
| **AI Admin** | app: ai-tracker | all `ai.*` |
| **AI Member** | app: ai-tracker | `ai.items.create/update/view` |

Practice roles also implicitly include `cert.catalog.view`, which makes Cert Tracker visible to every practice member.

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
5. AI Tracker: what entities and roles beyond Admin/Member?

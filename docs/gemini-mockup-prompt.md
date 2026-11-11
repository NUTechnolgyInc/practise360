You are a senior frontend engineer and product designer. Build a **working, clickable mockup** of an internal portal called **Practise360** for the company NULogic.

## Output
- A single-page **React + Tailwind** app in **one self-contained HTML file** (React 18, ReactDOM, Babel standalone and Tailwind loaded from CDN). It must run by opening the file in a browser. No backend.
- Keep all data in an in-memory store, persisted to `localStorage` so changes survive refresh. Add a **"Reset demo data"** button in the user menu.
- Simulate API latency of about 200ms with a small loading state so it feels real.
- Use client-side routing with the hash router (`#/apps`, `#/practices/qa`, `#/certs`, …).

## What Practise360 is
An umbrella portal that holds several internal **apps**. A user only sees the apps they have access to:
1. **Practices**: manage the company's practices and their members and roles.
2. **Certification Tracker**: practitioners plan and track certifications and courses. Leads and managers suggest or assign certifications to them.
3. **AI Tracker**: tracks AI initiatives. It has its own admins and members (keep it simple, see below).

## Authentication (mock)
- A login page with username and password. The password is always `password` for every user.
- Under the form, show a **"Demo users"** panel listing every seed user with their roles. Clicking one fills the form.
- After login, show the user's name, avatar initials and roles in the top-right menu, with **Switch user** and **Logout** options.

## RBAC model (implement exactly this, it drives the whole UI)

**Scopes form a tree:** `platform → app (practices | cert-tracker | ai-tracker) → practice (digital-engineering | platform | qa | ai)`.
A user holds **role assignments** `{ roleId, scopeType, scopeId }`. A role granted at a parent scope applies to all children.

**Permissions** (format `app.resource.action`; the `:own` suffix means only on records the user owns):
- Platform: `platform.users.manage`, `platform.apps.assign`
- Practices: `practices.practice.create|update|archive|view`, `practices.members.view|manage`, `practices.roles.view|manage|assign`
- Certifications: `cert.catalog.manage|view`, `cert.plan.manage:own`, `cert.plan.view`, `cert.plan.suggest`, `cert.plan.assign`, `cert.plan.verify`, `cert.reports.view`
- AI Tracker: `ai.admin.manage`, `ai.items.create|update|view`, `ai.reports.view`

**System roles:**
| Role | Scope | Permissions |
|---|---|---|
| Super Admin | platform | `*` |
| Practices Admin | app: practices | all `practices.*`, `cert.plan.view`, `cert.reports.view` |
| Practice Manager | practice | `practices.practice.view/update`, `practices.members.*`, `practices.roles.*`, `cert.catalog.view`, `cert.plan.view/suggest/assign/verify`, `cert.reports.view`, `cert.plan.manage:own` |
| Practice Lead | practice | `practices.practice.view`, `practices.members.view`, `practices.roles.view`, `cert.catalog.view`, `cert.plan.view/suggest/assign`, `cert.plan.manage:own` |
| Practitioner | practice | `practices.practice.view`, `practices.members.view`, `cert.catalog.view`, `cert.plan.manage:own` |
| Cert Admin | app: cert-tracker | all `cert.*` across all practices |
| AI Admin | app: ai-tracker | all `ai.*` |
| AI Member | app: ai-tracker | `ai.items.create/update/view` |

**Custom roles:** created inside a practice by anyone with `practices.roles.manage` there. They can only be assigned in that practice. Their permissions come from the practice-level subset (`practices.*` except create/archive, plus `cert.plan.*`).

**Rules:**
- **App visibility is derived from roles.** A user sees an app if they hold any assignment at that app or below it. Any practice role also makes the Certification Tracker visible, because practice roles include `cert.catalog.view`.
- **Escalation guard:** to assign role R at scope S, the actor needs `practices.roles.assign` at S (or a parent), and must already hold every permission in R. Each role has an `assignableFrom` field. `practice_manager` is `assignableFrom: app`, so only a Practices Admin or Super Admin can appoint managers.
- Implement one helper `can(user, permission, scope, resource?)` that walks the scope chain. Use it for **every** button, menu item and route guard. Hide what the user can't do. For direct URL access, show a friendly "No access" page.

## Screens

### 1. App Launcher (`#/apps`)
- A greeting, then a grid of cards for the apps the user can see. Each card has an icon, a description and a small stat (for example "4 practices", "3 certs in progress").
- A "My roles" strip listing each assignment, such as "Practice Lead · QA".

### 2. Practices app
- **Practices list:** cards for DE, Platform, QA and AI showing member count, manager name, lead count and certification completion %. A "New practice" button appears only for Practices Admin.
- **Practice detail** (tabs):
  - **Overview:** description, key people, small charts (members by role, certifications by status).
  - **Members:** a table with name, role(s), joined date and certification count. Add/remove member and change role appear only with permission. The role dropdown lists only roles this actor is allowed to grant (escalation guard).
  - **Roles & Permissions:** system and custom roles for this practice, with a permission matrix (roles × permissions, as checkboxes). Create/edit custom role only with `practices.roles.manage`. System roles are read-only.
  - **Activity:** an audit log, for example "de.manager assigned Practice Lead to de.dev1 · 2h ago".

### 3. Certification Tracker
- **My Certifications** (every practitioner): a kanban with the columns Suggested, Planned, In Progress, Completed, Verified. Each card shows the certification name, provider, a source badge (`Self` / `Suggested by X` / `Assigned by X`), target date and progress %.
  - Practitioners can add their own plan from the catalog, move cards forward, update progress and attach a mock certificate on completion.
  - **Suggested** items can be accepted (they move to Planned) or declined.
  - **Assigned** items cannot be declined or dropped. Show a lock icon.
- **Team view** (for Lead, Manager, Practices Admin, Cert Admin): a table of practice members × their plans, with filters by practice, status and certification. Suggest / Assign buttons open a modal (pick a member, a catalog item, a due date and a note). A Lead or Manager only sees their own practice(s). Cert Admin sees all.
  - The Manager gets a **Verify** button on Completed items.
- **Catalog:** a list of certifications and courses (AWS SAA, Azure AZ-104, CKA, ISTQB Foundation, Google PCA, Terraform Associate, Databricks GenAI, PMP, and similar), with provider, level, practice tags and estimated hours. Editing requires `cert.catalog.manage`.
- **Reports:** completion rate by practice, overdue assigned items and a top certifications chart (use simple SVG or Chart.js from CDN).

### 4. AI Tracker (simple)
- A list of AI initiatives: title, owner, practice, status (Idea, PoC, Pilot, Production), tools used and impact estimate.
- AI Member can create and edit their own items. AI Admin can edit everything and manage AI Tracker members (assign AI Admin or AI Member).

### 5. Admin (Super Admin only)
- **Users:** list, create and deactivate users.
- **Access:** assign app-level roles (Practices Admin, Cert Admin, AI Admin, AI Member).
- **Permission explorer:** pick a user and see their effective permissions per scope, with the source assignment for each. This is very useful for demoing the RBAC.

## Seed data
Seed users (all with password `password`):
| Username | Assignments |
|---|---|
| superadmin | Super Admin @ platform |
| practices.admin | Practices Admin @ practices |
| de.manager, de.lead, de.dev1, de.dev2 | Manager / Lead / Practitioner / Practitioner @ digital-engineering |
| platform.manager, platform.lead, platform.dev1 | same pattern @ platform |
| qa.manager, qa.lead, qa.tester1 | same pattern @ qa |
| ai.manager, ai.lead, ai.dev1 | same pattern @ ai practice |
| de.coordinator | custom role "Practice Coordinator" (`practices.members.manage`, `practices.roles.assign`, `cert.plan.view`) @ digital-engineering |
| cert.admin | Cert Admin @ cert-tracker |
| aitracker.admin | AI Admin @ ai-tracker |
| aitracker.member | AI Member @ ai-tracker |
| multi.user | Practice Lead @ qa + Practitioner @ ai + AI Member @ ai-tracker |

Also seed about 25 certification plans spread across users and statuses, including some overdue assigned items. Add about 8 AI initiatives and about 15 audit log entries. Use realistic but fictional names only. No real personal data.

## Branding (NULogic)
- Fonts: **Montserrat** for headings, **Open Sans** for body text (Google Fonts).
- Colors as CSS variables:
  `--nu-lapis-blue:#050766; --nu-navy:#25255C; --nu-red-orange:#E62A32; --nu-purple:#8939A1; --nu-dark-teal:#133E49; --nu-near-white:#F4F5F6; --nu-muted-teal:#3E616A; --nu-soft-coral:#EE777C; --nu-light-purple:#B17DC1; --nu-dusty-indigo:#61629D;`
- Gradients: primary CTA `linear-gradient(135deg,#D42F7B,#E8623A)`; brand bar `linear-gradient(to right,#ED3027,#7B469B)`; dark sections `linear-gradient(135deg,#1B1F4E,#7B2D8E)`.
- Lapis Blue makes up about 60% of the colour, secondary colours about 30% and tertiary about 10%. Use a Near-White page background with white cards, Lapis Blue headings and Dark Teal body text.
- Logo (top-left of the sidebar and the login page): `https://cdn.prod.website-files.com/65fb25139694761d554cf15b/67c1643d837ad81822ec693b_nulogic.svg`. Use the icon `https://cdn.prod.website-files.com/65fb25139694761d554cf15b/68275dd02001200b841dbac6_g-logo.svg` for the favicon and the collapsed sidebar. Never distort or recolour the logo.
- Show "Practise360" as the product name next to the logo. Put a thin brand-gradient bar at the top of the app.
- Login page: dark gradient background, a centred white card and the tagline "INFINITE INNOVATION" (uppercase, letter-spacing 3px, light weight).

## UX quality bar
- Layout: a collapsible left sidebar that lists only the visible apps and their sub-pages, a top bar with breadcrumbs and the user menu, and a content area.
- Fully responsive. On mobile the sidebar becomes a drawer.
- Include empty states, toasts for every action, confirmation dialogs for destructive actions, and form validation.
- Accessible: keyboard navigable, visible focus states, sufficient contrast.
- Clean component structure inside the file (`Store`, `rbac.js`-style helpers, `Layout`, the pages, and shared UI like `Button`, `Modal`, `Table`, `Badge`, `Tabs`, `Kanban`).

## Demo scenarios that must work end to end
1. `de.dev1` logs in, sees only Practices (DE, read-only) and the Certification Tracker, adds "AWS SAA" as a self plan and moves it to In Progress.
2. `de.lead` suggests "Terraform Associate" to `de.dev1`. Switch to `de.dev1`, who sees it in Suggested and accepts it.
3. `de.manager` assigns "CKA" with a due date to `de.dev2`. `de.dev2` cannot decline it. The manager later verifies a completed certification.
4. `de.manager` creates a custom role, assigns it to a member, and cannot see "Practice Manager" in the role dropdown.
5. `qa.lead` cannot see DE members in the Certification Tracker team view.
6. `practices.admin` creates a new practice "Data Practice" and appoints a manager.
7. `aitracker.member` sees only the AI Tracker app. `multi.user` sees all three apps with the correct, limited permissions in each.
8. `superadmin` opens the Permission explorer for `multi.user` and sees where each permission comes from.

Deliver the complete code in one file with no placeholders or TODOs. After the code, give a short list of the assumptions you made.

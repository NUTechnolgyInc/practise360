# UI Guidelines — Practise360

**Purpose**: keep every screen in `apps/web` consistent, on-brand (NULogic) and easy to change. All new UI code follows this file. The living reference is the **UI Kit page** — run `npm run dev:web` and open http://localhost:3000/ui-kit.

The visual language comes from the clickable mockup (`docs/gemini-mockup-prompt.md`): navy sidebar, thin brand-gradient bar on top, white rounded cards on a near-white page, gradient primary buttons, Montserrat headings, Open Sans body.

---

## 1. Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, plain JS |
| Styling | Tailwind CSS v4 — tokens in `apps/web/app/globals.css` (`@theme`) |
| Variants | `class-variance-authority` (`cva`) |
| Class merging | `cn()` from `@/lib/cn` (`clsx` + `tailwind-merge`) |
| Icons | `lucide-react` — no other icon set |
| Fonts | `next/font/google` — Montserrat (headings), Open Sans (body) |

No component library (shadcn, MUI, …) and no CSS-in-JS. If a primitive is missing, add it to `components/ui/` following the patterns below.

---

## 2. File organisation

```
apps/web/
├── app/                      # Routes (App Router). Pages compose components; little markup of their own.
│   ├── globals.css           # Design tokens + base styles. The only place raw hex values live.
│   └── ui-kit/page.js        # Living component gallery — update when you add/change a primitive.
├── components/
│   ├── ui/                   # Primitives: Button, Badge, Card, Field, Modal, Tabs, Table, Toast, …
│   │   └── index.js          # Barrel — import primitives from "@/components/ui"
│   ├── layout/               # AppShell, Sidebar, Topbar, UserMenu, PageHeader, HeroBanner
│   ├── brand/                # Logo, BrandBar
│   └── <app>/                # Feature composites, one folder per app: practices/, certs/, ai-tracker/, admin/
├── lib/                      # cn(), API client, formatters
└── public/brand/             # Official NULogic SVGs (navy wordmark, white wordmark, g-icon)
```

**Size limits** (split when exceeded — same rule as quizzy):
- Max **300 lines per file**, **150 per component**, **100 per hook**.
- Extract hooks to `hooks/use-*.js`, helpers to `lib/`, sub-components into the feature folder.

**Naming**: files `kebab-case.js`, components `PascalCase`, hooks `useCamelCase`.

**Server vs client**: components are server components by default. Add `"use client"` only to files that use state, effects, context or browser APIs (Modal, Tabs, Toast, AppShell, …). Keep it at the leaf, not the page, wherever possible.

---

## 3. Design tokens

Use the `nu-*` utilities. **Never write a hex value in a component** — if a colour is missing, add a token to `globals.css`.

| Token | Utility | Use |
|---|---|---|
| Lapis Blue `#050766` | `text-nu-lapis`, `bg-nu-lapis` | Headings, dark buttons, avatars |
| Navy `#25255C` | `bg-nu-navy`, `text-nu-navy` | Sidebar, labels, strong secondary text |
| Dark Teal `#133E49` | `text-nu-dark-teal` | Body text (default on `body`) |
| Muted Teal `#3E616A` | `text-nu-muted-teal` | Descriptions, breadcrumbs |
| Purple `#8939A1` | `bg-nu-purple`, `text-nu-purple` | Active nav, links, progress, focus rings |
| Red-Orange `#E62A32` | `text-nu-red-orange` | Brand accent (sparingly) |
| Near-White `#F4F5F6` | `bg-nu-near-white` | Page background (default on `body`) |
| Light Purple / Soft Coral / Dusty Indigo | `*-nu-light-purple` etc. | Tertiary — tags, hovers, borders (≤10%) |

**Gradients** (utilities defined with `@utility`):
- `bg-nu-primary` — primary CTA (`#D42F7B → #E8623A`). **One primary action per view.**
- `bg-nu-brand-bar` — the thin top bar / decorative dividers.
- `bg-nu-dark` — hero banners, login background.

**Semantic colours** use Tailwind's palette, consistently: emerald = success/verified, amber = warning/pending, rose = error/danger/overdue, blue = info. Status → colour mapping lives in **one place**: `StatusBadge` in `components/ui/badge.js`. Add new statuses there, never inline.

**Typography**
- Headings: `font-heading` (automatic on `h1–h6`), colour Lapis. Page title `text-2xl font-extrabold`, card title `text-lg font-bold`.
- Body: `text-sm`; dense UI (tables, cards) `text-xs`; meta `text-[11px] text-gray-400`.
- Field labels / section eyebrows: `text-xs font-bold uppercase tracking-wider text-nu-navy` (use `<Label>`).
- IDs, usernames, dates: `font-mono`.

**Shape & spacing**
- Radius: page/section cards `rounded-3xl`, inner tiles `rounded-2xl`, inputs `rounded-xl`, buttons `rounded-lg`, badges `rounded-full`.
- Card padding `p-6`; page padding `p-4 md:p-8`; vertical rhythm between sections `space-y-6`; grid gaps `gap-4`/`gap-6`.
- Shadows: `shadow-sm` at rest, `shadow-xl` on hover/raised (modals `shadow-2xl`).

---

## 4. Component catalogue

Import primitives from `@/components/ui` and layout from `@/components/layout`.

| Component | When to use |
|---|---|
| `Button` | Any action. Variants: `primary` (gradient, one per view), `secondary`, `dark`, `danger`, `ghost`, `link`. Sizes `sm/md/lg/icon`. Icons go inside as children. |
| `Badge` / `StatusBadge` | Labels and lifecycle states. Always `StatusBadge` for cert-plan and AI-initiative statuses. |
| `Card`, `CardHeader`, `CardFooter` | Every content block. `interactive` for clickable tiles (launcher, directory). |
| `Field` + `Input` / `Select` / `Textarea` / `Label` | Every form control. `Field` wires `id`, hint and error with `aria-describedby`/`aria-invalid`. |
| `Modal` | Create/edit forms and confirmations. Put buttons in `footer`, link the submit button with `form="<form-id>"`. |
| `Tabs` | Section switching inside a page (practice detail, cert tracker views). Controlled — the page owns the value. |
| `Table`, `THead`, `TBody`, `TR`, `TH`, `TD` | Tabular lists (members, team plans, permission matrix). |
| `StatTile` | KPI numbers in overview grids. Tones: `purple/success/info/danger/neutral`. |
| `Progress` | Completion bars. Use `aria-label` instead of `label` when there's no room for text. |
| `Avatar` / `UserChip` | Any person reference. Initials are derived from the name. |
| `EmptyState` / `NoAccess` | Empty lists; routes the user can't access. Never leave a blank area. |
| `useToast()` | Feedback after a mutation: `toast("Saved")`, `toast("Failed", "error")`. |
| `AppShell` | Wraps every authenticated page: brand bar, sidebar, mobile drawer, top bar, user menu. |
| `PageHeader` | First element on every page: title, description, back link, actions/tabs. |
| `HeroBanner` | Landing views only (app launcher welcome). |
| `Logo` | NULogic logo — `onDark` for the white wordmark, `variant="icon"` for the g-mark. |

### Page template

```jsx
"use client";
import { Plus } from "lucide-react";
import { AppShell, PageHeader } from "@/components/layout";
import { Button, Card, CardHeader, EmptyState } from "@/components/ui";

export default function PracticesPage() {
  const { user, navItems, can } = useSession();          // derived from assignments
  const practices = usePractices();

  return (
    <AppShell navItems={navItems} user={user} breadcrumbs={[{ label: "Home", href: "/" }, { label: "Practices" }]}>
      <PageHeader
        title="Practices"
        description="Manage practice memberships, leadership roles and permissions"
        actions={can("practices.practice.create", { type: "app", id: "practices" }) && <Button><Plus /> New practice</Button>}
      />
      {practices.length === 0 ? (
        <EmptyState title="No practices yet" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">{practices.map((p) => <PracticeCard key={p.id} practice={p} />)}</div>
      )}
    </AppShell>
  );
}
```

### Writing a new primitive

```jsx
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";

const chipVariants = cva("inline-flex items-center rounded-full px-2 text-xs", {
  variants: { tone: { neutral: "bg-gray-100 text-gray-700", brand: "bg-purple-50 text-nu-purple" } },
  defaultVariants: { tone: "neutral" },
});

export function Chip({ className, tone, ...props }) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
```

Rules: accept `className` and spread `...props`; variants via `cva`; merge with `cn` so callers can override; export from `components/ui/index.js`; add it to the UI Kit page.

---

## 5. RBAC in the UI

`docs/rbac.md` is the source of truth. The UI only **hides/shows** — the API is always the security boundary.

- **Hide, don't disable**, controls the user has no permission for (a Practitioner never sees "Assign cert"). Disable only when the user *has* the permission but the action isn't valid right now (empty form, nothing selected) — and say why.
- Every permission check goes through the single `can(user, permission, scope, resource?)` helper. Never `user.role === "manager"` in a component.
- Components are **permission-agnostic**: pages decide (`can(...)`) and pass `navItems`, `actions` or booleans down. `Sidebar` renders whatever `navItems` it's given.
- App visibility comes from assignments (`getVisibleApps`). A direct URL to an app the user can't see renders `<NoAccess />`, not a broken page.
- Role pickers show only roles the **escalation guard** allows; if none, explain it in the field hint rather than showing an empty select.
- Show the user's role assignments as `Role @ scope` badges (user menu, admin inspector) using display names, never raw ids.

---

## 6. Interaction patterns

- **Mutations**: optimistic or loading state on the button (`disabled` + label change), then `toast()` on success or error. Never fail silently.
- **Destructive actions** (remove member, archive practice, decline suggestion): `danger` button inside a confirmation `Modal`.
- **Forms**: label every field, mark required fields with `required`, show errors under the field via `Field error=`. Submit with Enter.
- **Lists**: always have an empty state; tables scroll horizontally on mobile (built into `Table`).
- **Navigation**: breadcrumbs on every page; the last crumb is plain text. Tabs that represent shareable views should sync to the URL (`?tab=`).
- **Copy**: sentence case for buttons and titles ("New practice", not "New Practice"). Short, plain, professional — NULogic voice.

---

## 7. Responsive

- Mobile-first Tailwind. Breakpoints used: `sm` 640, `md` 768 (sidebar appears), `lg` 1024.
- Sidebar becomes a drawer below `md`; content max width `max-w-7xl`.
- No horizontal page scroll at 375px. Grids collapse to one column; header actions wrap.

---

## 8. Accessibility

- Every interactive element is a real `<button>` or `<Link>` — never a clickable `<div>` (the mockup's clickable cards become `<Link>` wrapping a `Card interactive`).
- Visible focus ring on every control (`focus-visible:ring-2`); don't remove outlines without a replacement.
- Icon-only buttons need `aria-label`; decorative icons get `aria-hidden`.
- Modals: `role="dialog"`, labelled by the title, Escape closes, focus moves in and returns (built into `Modal`).
- Tabs use `role="tablist"/"tab"` + `aria-selected`; current nav item and last breadcrumb use `aria-current="page"`.
- Colour is never the only signal — status badges carry text.
- Text contrast ≥ 4.5:1; `text-gray-400` only for non-essential meta.
- Respect `prefers-reduced-motion` (handled globally in `globals.css`).

---

## 9. Data & branding rules

- **Synthetic data only** in the UI Kit, mocks, stories and tests — fictional names, no real employees.
- **Logo**: only the files in `public/brand/` via `<Logo>`. Don't recolour, crop, stretch or add effects. White wordmark on dark, navy on light.
- No secrets or real credentials in UI copy or placeholders; the dev login hint (`password`) only renders when `AUTH_MODE=dev`.

---

## 10. Checklist before opening a PR with UI changes

- [ ] Uses existing primitives; any new primitive is in `components/ui/`, exported, and shown on `/ui-kit`.
- [ ] No hex colours, no inline `style` except dynamic values (progress width).
- [ ] Files within size limits; `"use client"` only where needed.
- [ ] Permission-gated controls go through `can()`; the matching API route enforces the same permission.
- [ ] Empty, loading and error states handled.
- [ ] Works at 375px with no horizontal scroll; keyboard-only flow works.
- [ ] `npm run build` passes; `CHANGELOG.md` updated if user-visible.

// Static RBAC catalog — mirrors docs/rbac.md §1, §3 and §4. The seed writes this into MongoDB.
// SYSTEM_ROLES are the *defaults*: Super Admin can edit them at runtime (platform.roles.manage), and
// sync-roles only inserts missing ones unless run with --reset. Changing a default still needs docs/rbac.md updated.

const APPS = [
  { _id: "practices", name: "Practices", permPrefix: "practices." },
  { _id: "cert-tracker", name: "Certification Tracker", permPrefix: "cert." },
  { _id: "ai-tracker", name: "AI Tracker", permPrefix: "ai." },
];

const PRACTICES = [
  { _id: "digital-engineering", appId: "practices", name: "Digital Engineering" },
  { _id: "platform", appId: "practices", name: "Platform" },
  { _id: "qa", appId: "practices", name: "QA" },
  { _id: "ai", appId: "practices", name: "AI" },
];

const PERMISSIONS = [
  ["platform.users.manage", "platform", "Create and disable users"],
  ["platform.apps.assign", "platform", "Grant app-level admin roles"],
  ["platform.roles.manage", "platform", "Edit system roles and their permissions"],
  ["platform.audit.view", "platform", "View the audit log of every action in the portal"],
  ["practices.practice.create", "practices", "Create practices"],
  ["practices.practice.update", "practices", "Edit practice details"],
  ["practices.practice.archive", "practices", "Archive practices"],
  ["practices.practice.view", "practices", "View practices"],
  ["practices.members.view", "practices", "View practice members"],
  ["practices.members.manage", "practices", "Add and remove practice members and move them between groups"],
  ["practices.group.manage", "practices", "Create, rename and delete groups in a practice"],
  ["practices.group.update", "practices", "Run a group: edit its overview and files, and add or remove its members"],
  ["practices.roles.view", "practices", "View roles in a practice"],
  ["practices.roles.manage", "practices", "Create and edit custom roles"],
  ["practices.roles.assign", "practices", "Assign roles to members"],
  ["practices.contribution.view", "practices", "View contributions in a practice"],
  ["practices.contribution.create", "practices", "Start a contribution, request to join or accept an invite"],
  ["practices.contribution.update:own", "practices", "Edit and log progress on contributions you own or contribute to"],
  ["practices.contribution.manage", "practices", "Edit, log progress and manage people on any contribution in the practice"],
  ["practices.contribution.review", "practices", "First review of submitted contributions (Lead step)"],
  ["practices.contribution.approve", "practices", "Final approval that publishes a contribution (Manager step)"],
  ["cert.catalog.manage", "cert-tracker", "Edit or retire any catalog entry"],
  ["cert.catalog.create", "cert-tracker", "Add certifications and courses to the shared catalog"],
  ["cert.catalog.view", "cert-tracker", "View the certification catalog"],
  ["cert.plan.manage:own", "cert-tracker", "Plan your own certifications and submit completions"],
  ["cert.plan.view", "cert-tracker", "View plans of practice members"],
  ["cert.plan.suggest", "cert-tracker", "Recommend a certification to a practice member"],
  ["cert.plan.assign", "cert-tracker", "Assign a mandatory certification with a due date"],
  ["cert.plan.review", "cert-tracker", "First review of a completed certification (Lead step)"],
  ["cert.plan.verify", "cert-tracker", "Final approval of a completed certification (Manager step)"],
  ["cert.reports.view", "cert-tracker", "View certification reports"],
  ["ai.admin.manage", "ai-tracker", "Administer the AI Tracker"],
  ["ai.items.create", "ai-tracker", "Create AI initiatives"],
  ["ai.items.update", "ai-tracker", "Update AI initiatives"],
  ["ai.items.view", "ai-tracker", "View AI initiatives"],
  ["ai.reports.view", "ai-tracker", "View AI reports"],
  ["ai.usage.manage:own", "ai-tracker", "Submit, replace and delete own monthly Claude usage reports"],
  ["ai.usage.view", "ai-tracker", "View Claude usage reports of people in scope"],
].map(([key, appId, description]) => ({ _id: key, appId, description }));

const ALL_KEYS = PERMISSIONS.map((p) => p._id);
const startsWith = (prefix) => ALL_KEYS.filter((k) => k.startsWith(prefix));

// Permissions a custom (practice-owned) role may contain — rbac.md §4 "Custom roles".
const CUSTOM_ROLE_PERMISSIONS = [
  ...startsWith("practices.").filter((k) => !["practices.practice.create", "practices.practice.archive"].includes(k)),
  ...startsWith("cert.plan."),
  "cert.catalog.view",
  "cert.catalog.create",
  ...startsWith("ai.usage."),
];

// Every practice member submits a monthly Claude usage report, which also makes AI Tracker visible to them.
// Every practice member can also see, start and work on contributions in their practice.
const PRACTICE_BASE = [
  "practices.practice.view",
  "practices.members.view",
  "cert.catalog.view",
  "ai.usage.manage:own",
  "practices.contribution.view",
  "practices.contribution.create",
  "practices.contribution.update:own",
];
// Lead and Manager both run the review step (a Manager covers it when the owner is the only Lead); only Managers publish.
const CONTRIBUTION_REVIEW = ["practices.contribution.manage", "practices.contribution.review"];
// Leads and Managers recommend/assign certs, add new ones to the shared catalog and run the Lead review step.
const CERT_LEAD = ["cert.plan.view", "cert.plan.suggest", "cert.plan.assign", "cert.plan.review", "cert.catalog.create"];

// assignableFrom = the shallowest scope the actor's assign permission may come from.
const SYSTEM_ROLES = [
  { _id: "super_admin", name: "Super Admin", scopeType: "platform", assignableFrom: "platform", permissions: ["*"] },
  {
    _id: "practices_admin",
    name: "Practices Admin",
    scopeType: "app",
    scopeId: "practices",
    assignableFrom: "platform",
    // rbac.md §5 needs Practices Admin to appoint Managers, so it must hold every Manager permission
    // (escalation guard). The §4 table omitted the cert.plan.* ones — added here, see rbac.md change log.
    permissions: [...startsWith("practices."), "cert.catalog.view", "cert.catalog.create", ...startsWith("cert.plan."), "cert.reports.view", ...startsWith("ai.usage.")],
  },
  {
    _id: "practice_manager",
    name: "Practice Manager",
    scopeType: "practice",
    assignableFrom: "app",
    permissions: [
      ...PRACTICE_BASE,
      "practices.practice.update",
      "practices.members.manage",
      "practices.roles.view",
      "practices.roles.manage",
      "practices.roles.assign",
      "practices.group.manage",
      "practices.group.update",
      ...CONTRIBUTION_REVIEW,
      "practices.contribution.approve",
      ...startsWith("cert.plan."),
      "cert.catalog.create",
      "cert.reports.view",
      "ai.usage.view",
    ],
  },
  {
    // Leads a group inside a practice (rbac.md §4 "Practices and groups"). Holds only the Lead's extras: a Lead is
    // also a practice member (Practitioner or another practice role), which gives the rest. Granted at group scope by
    // the practice's Manager or Practices Admin — never by a Lead. roles.view is read across the Lead's practice.
    // group.update lets them run their own group (overview, who's in it) — owner's decision 2026-11-13.
    _id: "practice_lead",
    name: "Practice Lead",
    scopeType: "group",
    assignableFrom: "practice",
    permissions: [...CONTRIBUTION_REVIEW, ...CERT_LEAD, "practices.roles.view", "practices.group.update"],
  },
  {
    _id: "practitioner",
    name: "Practitioner",
    scopeType: "practice",
    assignableFrom: "practice",
    permissions: [...PRACTICE_BASE, "cert.plan.manage:own"],
  },
  { _id: "cert_admin", name: "Cert Admin", scopeType: "app", scopeId: "cert-tracker", assignableFrom: "platform", permissions: startsWith("cert.") },
  { _id: "ai_admin", name: "AI Admin", scopeType: "app", scopeId: "ai-tracker", assignableFrom: "platform", permissions: startsWith("ai.") },
  {
    _id: "ai_member",
    name: "AI Member",
    scopeType: "app",
    scopeId: "ai-tracker",
    // App roles are granted with platform.apps.assign (rbac.md §5), which only platform-scope roles hold.
    assignableFrom: "platform",
    permissions: ["ai.items.create", "ai.items.update", "ai.items.view", "ai.usage.manage:own"],
  },
].map((r) => ({ isSystem: true, scopeId: null, ...r }));

// One holder per scope (owner's decision): a practice has one Manager, a group one Lead. Choosing a new one replaces
// the current holder from the Practices page; the generic grant refuses a second one.
const SINGLE_HOLDER_ROLES = ["practice_manager", "practice_lead"];

// Practice ids that would collide with static routes under /practices (web app pages and API sub-routes).
const RESERVED_PRACTICE_IDS = ["contributions", "new", "people"];

module.exports = { APPS, PRACTICES, PERMISSIONS, SYSTEM_ROLES, CUSTOM_ROLE_PERMISSIONS, SINGLE_HOLDER_ROLES, RESERVED_PRACTICE_IDS };

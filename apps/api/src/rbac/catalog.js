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
  ["practices.practice.create", "practices", "Create practices"],
  ["practices.practice.update", "practices", "Edit practice details"],
  ["practices.practice.archive", "practices", "Archive practices"],
  ["practices.practice.view", "practices", "View practices"],
  ["practices.members.view", "practices", "View practice members"],
  ["practices.members.manage", "practices", "Add and remove practice members"],
  ["practices.roles.view", "practices", "View roles in a practice"],
  ["practices.roles.manage", "practices", "Create and edit custom roles"],
  ["practices.roles.assign", "practices", "Assign roles to members"],
  ["cert.catalog.manage", "cert-tracker", "Maintain the certification catalog"],
  ["cert.catalog.view", "cert-tracker", "View the certification catalog"],
  ["cert.plan.manage:own", "cert-tracker", "Manage own certification plans"],
  ["cert.plan.view", "cert-tracker", "View plans of practice members"],
  ["cert.plan.suggest", "cert-tracker", "Suggest a certification"],
  ["cert.plan.assign", "cert-tracker", "Assign a certification with a due date"],
  ["cert.plan.verify", "cert-tracker", "Verify a completed certification"],
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
  ...startsWith("ai.usage."),
];

// Every practice member submits a monthly Claude usage report, which also makes AI Tracker visible to them.
const PRACTICE_BASE = ["practices.practice.view", "practices.members.view", "cert.catalog.view", "ai.usage.manage:own"];

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
    permissions: [...startsWith("practices."), "cert.catalog.view", ...startsWith("cert.plan."), "cert.reports.view", ...startsWith("ai.usage.")],
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
      ...startsWith("cert.plan."),
      "cert.reports.view",
      "ai.usage.view",
    ],
  },
  {
    _id: "practice_lead",
    name: "Practice Lead",
    scopeType: "practice",
    assignableFrom: "practice",
    permissions: [...PRACTICE_BASE, "practices.roles.view", "cert.plan.view", "cert.plan.suggest", "cert.plan.assign", "cert.plan.manage:own"],
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

module.exports = { APPS, PRACTICES, PERMISSIONS, SYSTEM_ROLES, CUSTOM_ROLE_PERMISSIONS };

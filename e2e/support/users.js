// Seed users (docs/rbac.md §7, apps/api/src/seed/data.js) and what each should see, derived from rbac.md:
// - apps: §1 "app visibility is derived" + §4 (practice roles implicitly hold cert.catalog.view and ai.usage.manage:own)
// - nav: Practices needs practices.practice.view or practices.contribution.view; Certifications follows Cert Tracker
//   visibility; Access control needs roles.view/roles.assign/apps.assign.
const ALL_APPS = ["Practices", "Certification Tracker", "AI Tracker"];

const USERS = {
  superadmin: { name: "Avery Stone", apps: ALL_APPS, nav: { practices: true, ai: true, access: true } },
  "practices.admin": { name: "Jordan Blake", apps: ALL_APPS, nav: { practices: true, ai: true, access: true } },
  "de.manager": { name: "Morgan Reyes", apps: ALL_APPS, nav: { practices: true, ai: true, access: true } },
  "de.lead": { name: "Casey Lin", apps: ALL_APPS, nav: { practices: true, ai: true, access: true } },
  "de.dev1": { name: "Riley Patel", apps: ALL_APPS, nav: { practices: true, ai: true, access: false } },
  "de.lead2": { name: "Blair Kim" },
  "de.dev2": { name: "Jesse Monroe" },
  // practices.practice.view opens the Practices overview, though not contributions.
  "de.coordinator": { name: "Hayden Cruz", apps: ["Practices", "Certification Tracker"], nav: { practices: true, ai: false, access: true } },
  "platform.manager": { name: "Taylor Brooks" },
  "platform.lead": { name: "Quinn Harper" },
  "platform.dev1": { name: "Drew Collins" },
  "qa.manager": { name: "Skyler Grant" },
  "qa.lead": { name: "Rowan Ellis" },
  "qa.tester1": { name: "Jamie Fox" },
  "ai.manager": { name: "Parker Nash" },
  "ai.lead": { name: "Emerson Kai" },
  "ai.dev1": { name: "Sage Morgan" },
  "cert.admin": { name: "Reese Walker", apps: ["Certification Tracker"], nav: { practices: false, ai: false, access: false } },
  "aitracker.admin": { name: "Kendall Shaw", apps: ["AI Tracker"], nav: { practices: false, ai: true, access: false } },
  "aitracker.member": { name: "Finley Ross", apps: ["AI Tracker"], nav: { practices: false, ai: true, access: false } },
  "multi.user": { name: "Alex Rivera", apps: ALL_APPS, nav: { practices: true, ai: true, access: true } },
};

const SEED_USER_COUNT = Object.keys(USERS).length;

module.exports = { USERS, ALL_APPS, SEED_USER_COUNT };

// Synthetic seed users — fictional names only. Every account signs in with `password` (AUTH_MODE=dev).

// Groups inside each practice (docs/rbac.md §4 "Practices and groups"). Mobile App and Magento start without a Lead.
const GROUPS = [
  { _id: "digital-engineering-fullstack", practiceId: "digital-engineering", name: "Fullstack", description: "Web apps end to end — React, Node, APIs" },
  { _id: "digital-engineering-devops", practiceId: "digital-engineering", name: "DevOps", description: "CI/CD, cloud infrastructure and observability" },
  { _id: "digital-engineering-mobile-app", practiceId: "digital-engineering", name: "Mobile App", description: "iOS, Android and React Native" },
  { _id: "platform-commercetools", practiceId: "platform", name: "Commercetools", description: "Commercetools platform practice" },
  { _id: "platform-magento", practiceId: "platform", name: "Magento", description: "Magento / Adobe Commerce platform practice" },
  { _id: "qa-automation", practiceId: "qa", name: "Automation", description: "" },
  { _id: "qa-manual-testing", practiceId: "qa", name: "Manual Testing", description: "" },
  { _id: "ai-genai", practiceId: "ai", name: "GenAI", description: "LLM applications and agents" },
];

// Manager, a Lead (a Practitioner who also leads `group`) and a Practitioner, both sitting in `group`.
const practiceTrio = (practice, group, prefix, names, devName = "dev1") => [
  { username: `${prefix}.manager`, displayName: names[0], roles: [["practice_manager", "practice", practice]] },
  { username: `${prefix}.lead`, displayName: names[1], roles: [["practitioner", "practice", practice], ["practice_lead", "group", group]], groups: [group] },
  { username: `${prefix}.${devName}`, displayName: names[2], roles: [["practitioner", "practice", practice]], groups: [group] },
];

const USERS = [
  { username: "superadmin", displayName: "Avery Stone", roles: [["super_admin", "platform"]] },
  { username: "practices.admin", displayName: "Jordan Blake", roles: [["practices_admin", "app", "practices"]] },
  ...practiceTrio("digital-engineering", "digital-engineering-fullstack", "de", ["Morgan Reyes", "Casey Lin", "Riley Patel"]),
  // A second DE group with its own Lead, so a Lead's reach can be seen stopping at their group.
  {
    username: "de.lead2",
    displayName: "Blair Kim",
    roles: [["practitioner", "practice", "digital-engineering"], ["practice_lead", "group", "digital-engineering-devops"]],
    groups: ["digital-engineering-devops"],
  },
  { username: "de.dev2", displayName: "Jesse Monroe", roles: [["practitioner", "practice", "digital-engineering"]], groups: ["digital-engineering-devops"] },
  ...practiceTrio("platform", "platform-commercetools", "platform", ["Taylor Brooks", "Quinn Harper", "Drew Collins"]),
  ...practiceTrio("qa", "qa-automation", "qa", ["Skyler Grant", "Rowan Ellis", "Jamie Fox"], "tester1"),
  ...practiceTrio("ai", "ai-genai", "ai", ["Parker Nash", "Emerson Kai", "Sage Morgan"]),
  { username: "de.coordinator", displayName: "Hayden Cruz", roles: [["de_practice_coordinator", "practice", "digital-engineering"]] },
  { username: "cert.admin", displayName: "Reese Walker", roles: [["cert_admin", "app", "cert-tracker"]] },
  { username: "aitracker.admin", displayName: "Kendall Shaw", roles: [["ai_admin", "app", "ai-tracker"]] },
  { username: "aitracker.member", displayName: "Finley Ross", roles: [["ai_member", "app", "ai-tracker"]] },
  {
    username: "multi.user",
    displayName: "Alex Rivera",
    roles: [
      ["practitioner", "practice", "qa"],
      ["practice_lead", "group", "qa-manual-testing"],
      ["practitioner", "practice", "ai"],
      ["ai_member", "app", "ai-tracker"],
    ],
    groups: ["qa-manual-testing"],
  },
];

const CUSTOM_ROLES = [
  {
    _id: "de_practice_coordinator",
    name: "Practice Coordinator",
    description: "Manages people and role assignments without being the Manager",
    scopeType: "practice",
    scopeId: "digital-engineering",
    isSystem: false,
    assignableFrom: "practice",
    permissions: [
      "practices.practice.view",
      "practices.members.view",
      "practices.members.manage",
      "practices.roles.view",
      "practices.roles.assign",
      "cert.catalog.view",
      "cert.plan.view",
    ],
  },
];

// Starter Certification Tracker catalog (public certifications/courses — no personal data). Links are placeholders.
const CERT_CATALOG = [
  ["AWS Certified Solutions Architect – Associate", "certification", "Amazon Web Services"],
  ["AWS Certified Developer – Associate", "certification", "Amazon Web Services"],
  ["Microsoft Certified: Azure Fundamentals (AZ-900)", "certification", "Microsoft"],
  ["Google Cloud Professional Cloud Architect", "certification", "Google Cloud"],
  ["Certified Kubernetes Administrator (CKA)", "certification", "The Linux Foundation"],
  ["HashiCorp Certified: Terraform Associate", "certification", "HashiCorp"],
  ["ISTQB Certified Tester Foundation Level", "certification", "ISTQB"],
  ["Professional Scrum Master I (PSM I)", "certification", "Scrum.org"],
  ["Machine Learning Specialization", "course", "Coursera"],
  ["Building Systems with the Claude API", "course", "Internal Academy"],
  ["React — The Complete Guide", "course", "Udemy"],
].map(([title, type, provider]) => ({ title, type, provider, url: "", description: "" }));

module.exports = { USERS, GROUPS, CUSTOM_ROLES, CERT_CATALOG };

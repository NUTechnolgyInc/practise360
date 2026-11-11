// Synthetic seed users — fictional names only. Every account signs in with `password` (AUTH_MODE=dev).

const practiceTrio = (practice, prefix, names, devName = "dev1") => [
  { username: `${prefix}.manager`, displayName: names[0], roles: [["practice_manager", "practice", practice]] },
  { username: `${prefix}.lead`, displayName: names[1], roles: [["practice_lead", "practice", practice]] },
  { username: `${prefix}.${devName}`, displayName: names[2], roles: [["practitioner", "practice", practice]] },
];

const USERS = [
  { username: "superadmin", displayName: "Avery Stone", roles: [["super_admin", "platform"]] },
  { username: "practices.admin", displayName: "Jordan Blake", roles: [["practices_admin", "app", "practices"]] },
  ...practiceTrio("digital-engineering", "de", ["Morgan Reyes", "Casey Lin", "Riley Patel"]),
  ...practiceTrio("platform", "platform", ["Taylor Brooks", "Quinn Harper", "Drew Collins"]),
  ...practiceTrio("qa", "qa", ["Skyler Grant", "Rowan Ellis", "Jamie Fox"], "tester1"),
  ...practiceTrio("ai", "ai", ["Parker Nash", "Emerson Kai", "Sage Morgan"]),
  { username: "de.coordinator", displayName: "Hayden Cruz", roles: [["de_practice_coordinator", "practice", "digital-engineering"]] },
  { username: "cert.admin", displayName: "Reese Walker", roles: [["cert_admin", "app", "cert-tracker"]] },
  { username: "aitracker.admin", displayName: "Kendall Shaw", roles: [["ai_admin", "app", "ai-tracker"]] },
  { username: "aitracker.member", displayName: "Finley Ross", roles: [["ai_member", "app", "ai-tracker"]] },
  {
    username: "multi.user",
    displayName: "Alex Rivera",
    roles: [
      ["practice_lead", "practice", "qa"],
      ["practitioner", "practice", "ai"],
      ["ai_member", "app", "ai-tracker"],
    ],
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

module.exports = { USERS, CUSTOM_ROLES };

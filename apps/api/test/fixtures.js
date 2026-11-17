// Shared unit-test fixtures: a small group tree on top of the seeded practices (docs/rbac.md §4 "Practices and groups").
const { PRACTICES } = require("../src/rbac/catalog");

const DE = "digital-engineering";
const FULLSTACK = "digital-engineering-fullstack";
const DEVOPS = "digital-engineering-devops";
const QA_AUTO = "qa-automation";
const GROUPS = [
  { _id: FULLSTACK, practiceId: DE, name: "Fullstack" },
  { _id: DEVOPS, practiceId: DE, name: "DevOps" },
  { _id: QA_AUTO, practiceId: "qa", name: "Automation" },
];

/** req.tree-shaped fixture; `members` = [[userId, groupId], …]. */
const treeWith = (members = []) => ({
  practices: PRACTICES,
  groups: GROUPS,
  memberships: members.map(([userId, groupId]) => ({ userId, groupId, practiceId: GROUPS.find((g) => g._id === groupId).practiceId })),
});

module.exports = { DE, FULLSTACK, DEVOPS, QA_AUTO, GROUPS, treeWith };

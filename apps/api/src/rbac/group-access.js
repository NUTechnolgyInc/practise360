// Who may run a group (docs/rbac.md §4 "Practices and groups"). Pure — no DB, unit-tested.
// `practices.group.update` at a group — its Lead, plus the Manager and Practices Admin through the practice/app —
// edits the group's overview and files and takes practice members into or out of it. `practices.members.manage` at
// the practice (Manager, Practices Admin, custom roles such as Practice Coordinator) still moves anyone anywhere.
const { can } = require("./engine");

const PERM = { UPDATE: "practices.group.update", MEMBERS_MANAGE: "practices.members.manage" };
const practiceScope = (id) => ({ type: "practice", id });
const groupScope = (id) => ({ type: "group", id });

const managesPracticeMembers = (user, practiceId, tree) => can(user, PERM.MEMBERS_MANAGE, practiceScope(practiceId), undefined, tree);

/** Edit the group's overview and files. */
const canUpdateGroup = (user, groupId, tree) => can(user, PERM.UPDATE, groupScope(groupId), undefined, tree);

/** Take members into or out of `group` ({ _id, practiceId }). */
const canManageGroupMembers = (user, group, tree) => managesPracticeMembers(user, group.practiceId, tree) || canUpdateGroup(user, group._id, tree);

/**
 * Move a member of `practiceId` from group `fromId` to group `toId` (null = not in a group). Practice-wide
 * members.manage moves anyone; otherwise the caller must run every group involved — so a Lead can bring in people
 * who aren't in a group and let members go, but can't take someone out of another Lead's group.
 */
function canMoveMember(user, practiceId, fromId, toId, tree) {
  if (managesPracticeMembers(user, practiceId, tree)) return true;
  const groups = [fromId, toId].filter(Boolean);
  return groups.length > 0 && groups.every((id) => canUpdateGroup(user, id, tree));
}

module.exports = { PERM, canUpdateGroup, canManageGroupMembers, canMoveMember };

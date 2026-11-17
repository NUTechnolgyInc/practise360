// Practice structure rules that need the DB (docs/rbac.md §4 "Practices and groups", §5): one Manager per practice,
// one Lead per group, a Lead must already be in the practice, and group membership follows practice membership.
// Shared by Access control (/rbac/assignments) and the Practices routes so both enforce the same thing.
const { GroupMembership, Role, RoleAssignment, User } = require("../models");
const { SINGLE_HOLDER_ROLES } = require("../rbac/catalog");
const { checkGrant, groupLabel } = require("../rbac/engine");
const { describeScope } = require("../rbac/present");

const conflict = (status, error) => ({ status, error });
const sameId = (a, b) => String(a) === String(b);

/** Role assignments currently holding `roleId` at a scope. */
const holdersOf = (roleId, scope) => RoleAssignment.find({ roleId, scopeType: scope.type, scopeId: scope.id ?? null }).lean();

/** Being in a practice = holding a practice-level role there (rbac.md §4). Stale assignments of group roles don't count. */
async function practiceRoleAssignments(userId, practiceId) {
  const assignments = await RoleAssignment.find({ userId, scopeType: "practice", scopeId: practiceId }).lean();
  if (!assignments.length) return [];
  const practiceRoles = new Set((await Role.find({ _id: { $in: assignments.map((a) => a.roleId) }, scopeType: "practice" }, "_id").lean()).map((r) => r._id));
  return assignments.filter((a) => practiceRoles.has(a.roleId));
}

const isPracticeMember = async (userId, practiceId) => (await practiceRoleAssignments(userId, practiceId)).length > 0;

/** One Manager per practice, one Lead per group: refuses a second holder. Returns { status, error } or null. */
async function singleHolderConflict(role, scope, userId, tree) {
  if (!SINGLE_HOLDER_ROLES.includes(role._id)) return null;
  const other = (await holdersOf(role._id, scope)).find((a) => !sameId(a.userId, userId));
  if (!other) return null;
  const holder = await User.findById(other.userId, "displayName").lean();
  return conflict(409, `${describeScope({ scopeType: scope.type, scopeId: scope.id }, tree)} already has a ${role.name} (${holder?.displayName ?? "someone"}) — change it from the Practices page`);
}

/** A group role (Lead) only goes to someone already in the group's practice. Returns { status, error } or null. */
async function groupMemberConflict(scope, userId, tree) {
  if (scope.type !== "group") return null;
  const group = tree.groups.find((g) => g._id === scope.id);
  if (!group || (await isPracticeMember(userId, group.practiceId))) return null;
  const practice = tree.practices.find((p) => p._id === group.practiceId);
  return conflict(400, `Add them to ${practice?.name ?? group.practiceId} before making them a Lead there`);
}

/** Checks on top of the escalation guard before granting `role` to `userId` at `scope`. Returns { status, error } or null. */
async function grantConflict(role, scope, userId, tree) {
  return (await singleHolderConflict(role, scope, userId, tree)) || groupMemberConflict(scope, userId, tree);
}

/** After a Lead is appointed: if they aren't in a group of that practice yet, they join the one they lead. */
async function afterGrant(role, scope, userId, actorId, tree) {
  if (scope.type !== "group") return;
  const group = tree.groups.find((g) => g._id === scope.id);
  if (!group) return;
  await GroupMembership.updateOne(
    { practiceId: group.practiceId, userId },
    { $setOnInsert: { practiceId: group.practiceId, groupId: group._id, userId, addedBy: actorId, addedAt: new Date() } },
    { upsert: true },
  );
}

/** Before revoking a practice-level role: a Lead can't lose their last one while they lead a group there. */
async function revokeConflict(assignment, tree) {
  if (assignment.scopeType !== "practice") return null;
  const practiceId = assignment.scopeId;
  const remaining = (await practiceRoleAssignments(assignment.userId, practiceId)).filter((a) => !sameId(a._id, assignment._id));
  if (remaining.length) return null;
  const groups = tree.groups.filter((g) => g.practiceId === practiceId);
  const lead = await RoleAssignment.findOne({ userId: assignment.userId, roleId: "practice_lead", scopeType: "group", scopeId: { $in: groups.map((g) => g._id) } }).lean();
  if (!lead) return null;
  const group = groups.find((g) => g._id === lead.scopeId);
  return conflict(409, `They lead ${groupLabel(group, tree.practices)} — choose another Lead for it first`);
}

/** After revoking: someone with no practice-level role left in a practice leaves its group too. */
async function afterRevoke(assignment) {
  if (assignment.scopeType !== "practice") return;
  if (!(await isPracticeMember(assignment.userId, assignment.scopeId))) await GroupMembership.deleteOne({ practiceId: assignment.scopeId, userId: assignment.userId });
}

/** System roles the Practices screens grant. Read per request: Super Admin may have edited their permissions. */
async function structureRoles() {
  const roles = await Role.find({ _id: { $in: ["practice_manager", "practice_lead", "practitioner"] } }).lean();
  const byId = Object.fromEntries(roles.map((r) => [r._id, r]));
  return { manager: byId.practice_manager, lead: byId.practice_lead, practitioner: byId.practitioner };
}

/**
 * Makes `userId` the only holder of `role` at `scope`, acting as `actor` (a loaded user with grants): guard + structure
 * checks first, then the current holders are revoked and the new one granted. Returns { status, error } on refusal,
 * null when done. Used for direct appointments and when an invitation is accepted (actor = whoever invited).
 */
async function replaceHolder({ user: actor, tree }, role, scope, userId, { keepPrevious = true } = {}) {
  const verdict = checkGrant(actor, role, scope, tree);
  if (!verdict.ok) return conflict(403, verdict.reason);
  const holders = await holdersOf(role._id, scope);
  if (holders.some((a) => sameId(a.userId, userId))) return null; // already them
  const leaving = holders;
  // Replacing isn't adding a second holder, so only the "Lead comes from the practice" rule applies here.
  const notMember = await groupMemberConflict(scope, userId, tree);
  if (notMember) return notMember;
  if (scope.type === "practice" && !keepPrevious) {
    for (const a of leaving) {
      const clash = await revokeConflict(a, tree);
      if (clash) return clash;
    }
  }

  for (const a of leaving) {
    await RoleAssignment.deleteOne({ _id: a._id });
    if (scope.type !== "practice") continue;
    // A Manager stepping down stays in the practice as a Practitioner unless asked otherwise, so their own
    // contributions, plans and group don't vanish with the role.
    if (keepPrevious && !(await isPracticeMember(a.userId, scope.id))) {
      await RoleAssignment.updateOne(
        { userId: a.userId, roleId: "practitioner", scopeType: "practice", scopeId: scope.id },
        { $setOnInsert: { grantedBy: actor.id, grantedAt: new Date() } },
        { upsert: true },
      );
    }
    await afterRevoke(a);
  }
  await RoleAssignment.updateOne({ userId, roleId: role._id, scopeType: scope.type, scopeId: scope.id }, { $setOnInsert: { grantedBy: actor.id, grantedAt: new Date() } }, { upsert: true });
  await afterGrant(role, scope, userId, actor.id, tree);
  return null;
}

/** Lower-case, dash-separated slug for practice and group ids. */
const slugify = (name, fallback) =>
  String(name)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || fallback;

/** `base`, or `base-2`, `base-3`… — the first id `taken(id)` says is free. */
async function uniqueId(base, taken) {
  for (let n = 1; n < 1000; n += 1) {
    const id = n === 1 ? base : `${base}-${n}`;
    if (!(await taken(id))) return id;
  }
  throw new Error(`No free id for ${base}`);
}

module.exports = {
  holdersOf,
  isPracticeMember,
  practiceRoleAssignments,
  grantConflict,
  groupMemberConflict,
  afterGrant,
  revokeConflict,
  afterRevoke,
  structureRoles,
  replaceHolder,
  slugify,
  uniqueId,
};

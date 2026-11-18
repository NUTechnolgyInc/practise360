// Practices app → practices and their groups (docs/rbac.md §4 "Practices and groups").
// Practices Admin creates practices and chooses each one's Manager; the Manager (or Practices Admin) creates groups,
// chooses each group's Lead and places members into groups. Manager and Lead changes go through the same escalation
// guard as Access control (checkGrant) plus the shared structure rules in lib/practice-structure.js.
const express = require("express");
const mongoose = require("mongoose");
const { Group, GroupMembership, GroupOverview, Invitation, Practice, PracticeFile, Role, RoleAssignment, User } = require("../models");
const { can, checkGrant, groupOf } = require("../rbac/engine");
const { canManageGroupMembers, canMoveMember, canUpdateGroup } = require("../rbac/group-access");
const { RESERVED_PRACTICE_IDS } = require("../rbac/catalog");
const { loadTree } = require("../rbac/load");
const { requireAnyScope } = require("../middleware/auth");
const { bad, wrap, str } = require("../lib/http");
const structure = require("../lib/practice-structure");
const { replaceHolder, structureRoles } = structure;
const overviewRoutes = require("./practice-overview");
const { inviteRoutes, listInvites, canSeeInvites } = require("./practice-invites");
const { cancelPending, inviteRefusal } = require("../lib/invites");

const router = express.Router();

const PERM = {
  VIEW: "practices.practice.view",
  CREATE: "practices.practice.create",
  UPDATE: "practices.practice.update",
  MEMBERS_VIEW: "practices.members.view",
  MEMBERS_MANAGE: "practices.members.manage",
  GROUPS: "practices.group.manage",
};
const APP = { type: "app", id: "practices" };
const practiceScope = (id) => ({ type: "practice", id });
const groupScope = (id) => ({ type: "group", id });
const NEW_GROUP = "\u0000new-group"; // placeholder id that can't collide with a slug
const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
// Email is included so the pickers can find people by it (and tell an existing person from someone to invite).
const person = (u) => (u ? { id: String(u._id), username: u.username, displayName: u.displayName, email: u.email ?? "" } : null);
const PERSON_FIELDS = "username displayName email";

/**
 * Everyone in the given practices and who leads which group: practice-level assignments (membership + Manager),
 * Lead assignments on their groups, and active users. One pass for the list and detail screens.
 */
async function loadPeople(tree, practiceIds) {
  const groupIds = tree.groups.filter((g) => practiceIds.includes(g.practiceId)).map((g) => g._id);
  const [practiceAssignments, leadAssignments, roles] = await Promise.all([
    RoleAssignment.find({ scopeType: "practice", scopeId: { $in: practiceIds } }).lean(),
    RoleAssignment.find({ roleId: "practice_lead", scopeType: "group", scopeId: { $in: groupIds } }).lean(),
    Role.find({ scopeType: "practice" }, "name").lean(),
  ]);
  const roleName = new Map(roles.map((r) => [r._id, r.name]));
  // Only roles that really are practice-level count as membership (a stale practice-wide Lead doesn't).
  const memberships = practiceAssignments.filter((a) => roleName.has(a.roleId));
  const userIds = [...new Set([...memberships, ...leadAssignments].map((a) => String(a.userId)))];
  const users = new Map((await User.find({ _id: { $in: userIds }, isActive: true }, PERSON_FIELDS).lean()).map((u) => [String(u._id), u]));
  return { memberships, leadAssignments, roleName, users };
}

/** Active Practices Admins — named on the overview so people know who runs the Practices app. */
async function practicesAdmins() {
  const assignments = await RoleAssignment.find({ roleId: "practices_admin", scopeType: "app", scopeId: "practices" }, "userId").lean();
  const users = await User.find({ _id: { $in: assignments.map((a) => a.userId) }, isActive: true }, PERSON_FIELDS).sort({ displayName: 1 }).lean();
  return users.map(person);
}

function presentPractice(practice, tree, people, user, roles, { withMembers = false } = {}) {
  const scope = practiceScope(practice._id);
  const has = (perm) => can(user, perm, scope, undefined, tree);
  const groups = tree.groups.filter((g) => g.practiceId === practice._id);
  const inPractice = people.memberships.filter((a) => a.scopeId === practice._id && people.users.has(String(a.userId)));
  const memberIds = [...new Set(inPractice.map((a) => String(a.userId)))];
  const groupOfMember = new Map(tree.memberships.filter((m) => m.practiceId === practice._id).map((m) => [m.userId, m.groupId]));
  const managers = inPractice.filter((a) => a.roleId === "practice_manager").map((a) => person(people.users.get(String(a.userId))));
  const leadOf = (groupId) => {
    const a = people.leadAssignments.find((x) => x.scopeId === groupId && people.users.has(String(x.userId)));
    return a ? person(people.users.get(String(a.userId))) : null;
  };
  const canSetLead = (groupId) => !!roles.lead && checkGrant(user, roles.lead, groupScope(groupId), tree).ok;
  const manageGroups = has(PERM.GROUPS);
  const seeMembers = has(PERM.MEMBERS_VIEW);

  const out = {
    id: practice._id,
    name: practice.name,
    description: practice.description || "",
    managers,
    memberCount: memberIds.length,
    // The Manager oversees every group, so they aren't counted as someone waiting to be placed.
    unassignedCount: memberIds.filter((id) => !groupOfMember.has(id) && !managers.some((m) => m?.id === id)).length,
    groups: groups.map((g) => {
      const members = memberIds.filter((id) => groupOfMember.get(id) === g._id);
      return {
        id: g._id,
        name: g.name,
        description: g.description || "",
        lead: leadOf(g._id),
        memberCount: members.length,
        ...(withMembers && seeMembers && { members: members.map((id) => person(people.users.get(id))).sort((a, b) => a.displayName.localeCompare(b.displayName)) }),
        actions: {
          edit: manageGroups,
          delete: manageGroups,
          setLead: canSetLead(g._id),
          // Running the group (its Lead, Manager, Practices Admin): overview, and taking members in or out of it.
          update: canUpdateGroup(user, g._id, tree),
          manageMembers: canManageGroupMembers(user, g, tree),
          // Invite someone new by email straight into this group — the Manager, Practices Admin, and its Lead.
          invite: !inviteRefusal(user, { kind: "member", practiceId: practice._id, groupId: g._id }, roles, tree),
        },
      };
    }),
    actions: {
      update: has(PERM.UPDATE),
      setManager: !!roles.manager && checkGrant(user, roles.manager, scope, tree).ok,
      createGroup: manageGroups,
      // Whether the caller could appoint the Lead of a group created here (same guard, on a not-yet-existing group).
      appointLeads: !!roles.lead && checkGrant(user, roles.lead, groupScope(NEW_GROUP), { ...tree, groups: [...tree.groups, { _id: NEW_GROUP, practiceId: practice._id }] }).ok,
      moveMembers: has(PERM.MEMBERS_MANAGE),
      addMember: !!roles.practitioner && checkGrant(user, roles.practitioner, scope, tree).ok,
    },
  };
  if (withMembers && seeMembers) {
    out.members = memberIds
      .map((id) => ({
        ...person(people.users.get(id)),
        roles: [...new Set(inPractice.filter((a) => String(a.userId) === id).map((a) => people.roleName.get(a.roleId)))].sort(),
        groupId: groupOfMember.get(id) ?? null,
        leads: groups.filter((g) => people.leadAssignments.some((a) => a.scopeId === g._id && String(a.userId) === id)).map((g) => g._id),
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return out;
}

async function practiceDetail(req, practiceId) {
  const practice = req.tree.practices.find((p) => p._id === practiceId);
  const [people, roles, invites] = await Promise.all([
    loadPeople(req.tree, [practiceId]),
    structureRoles(),
    canSeeInvites(req.user, practiceId, req.tree) ? listInvites(req.user, practiceId, req.tree) : null,
  ]);
  return { ...presentPractice(practice, req.tree, people, req.user, roles, { withMembers: true }), ...(invites && { invites }) };
}

/** Re-reads the tree after a structural change, so the response (and later checks) see the new practice or group. */
const refreshTree = async (req) => {
  req.tree = await loadTree();
};

const respond = async (req, res, status = 200) => {
  await refreshTree(req);
  res.status(status).json(await practiceDetail(req, req.practice._id));
};

/** Loads :id into req.practice; 404 unless the caller can see it (don't leak which practices exist). */
const load = (req, res, next) => {
  const practice = req.tree.practices.find((p) => p._id === req.params.id);
  if (!practice || !can(req.user, PERM.VIEW, practiceScope(practice._id), undefined, req.tree)) return bad(res, "Practice not found", 404);
  req.practice = practice;
  next();
};

/** Loads :groupId (must belong to :id) into req.group. */
const loadGroup = (req, res, next) => {
  const group = req.tree.groups.find((g) => g._id === req.params.groupId && g.practiceId === req.practice._id);
  if (!group) return bad(res, "Group not found", 404);
  req.group = group;
  next();
};

const requireHere = (perm) => (req, res, next) => (can(req.user, perm, practiceScope(req.practice._id), undefined, req.tree) ? next() : bad(res, `Missing permission ${perm}`, 403));

async function activeUser(userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const u = await User.findById(userId, `${PERSON_FIELDS} isActive`).lean();
  return u && u.isActive ? u : null;
}

/** Name + description from a body. Name is required and unique among `siblings` (case-insensitive). */
function nameInput(b, siblings, label) {
  const name = str(b.name, 80, "Name");
  const description = str(b.description, 500, "Description");
  if (!name) return { error: "Name is required" };
  if (siblings.some((x) => sameName(x.name, name))) return { error: `There's already a ${label} called ${name}` };
  return { name, description };
}

// ---------- practices ----------

router.get(
  "/",
  requireAnyScope(PERM.VIEW),
  wrap(async (req, res) => {
    const { tree, user } = req;
    const visible = tree.practices.filter((p) => can(user, PERM.VIEW, practiceScope(p._id), undefined, tree)).sort((a, b) => a.name.localeCompare(b.name));
    const [people, roles, admins] = await Promise.all([loadPeople(tree, visible.map((p) => p._id)), structureRoles(), practicesAdmins()]);
    res.json({
      practices: visible.map((p) => presentPractice(p, tree, people, user, roles)),
      admins,
      canCreate: can(user, PERM.CREATE, APP, undefined, tree),
    });
  }),
);

/** Active people for the Manager / member pickers. Names only — assignments stay behind /rbac/users. */
router.get(
  "/people",
  requireAnyScope(PERM.CREATE, "practices.roles.assign"),
  wrap(async (req, res) => {
    const users = await User.find({ isActive: true }, PERSON_FIELDS).sort({ displayName: 1 }).lean();
    res.json(users.map(person));
  }),
);

router.post(
  "/",
  wrap(async (req, res) => {
    if (!can(req.user, PERM.CREATE, APP, undefined, req.tree)) return bad(res, `Missing permission ${PERM.CREATE}`, 403);
    const b = req.body || {};
    const all = await Practice.find({}, "name").lean(); // archived ones too: names and ids stay taken
    const input = nameInput(b, all, "practice");
    if (input.error) return bad(res, input.error);

    let manager = null;
    if (b.managerId) {
      manager = await activeUser(b.managerId);
      if (!manager) return bad(res, "Pick an active person as Manager");
    }
    const roles = await structureRoles();
    const id = await structure.uniqueId(structure.slugify(input.name, "practice"), async (x) => RESERVED_PRACTICE_IDS.includes(x) || !!(await Practice.exists({ _id: x })));
    // Check the Manager grant against the tree as it will be, before writing anything.
    if (manager && !checkGrant(req.user, roles.manager, practiceScope(id), { ...req.tree, practices: [...req.tree.practices, { _id: id, appId: "practices" }] }).ok) {
      return bad(res, "You can't appoint a Manager for this practice", 403);
    }

    const practice = await Practice.create({ _id: id, appId: "practices", name: input.name, description: input.description, createdBy: req.user.id });
    await refreshTree(req);
    req.practice = practice.toObject();
    if (manager) {
      const clash = await replaceHolder(req, roles.manager, practiceScope(id), String(manager._id));
      if (clash) return bad(res, clash.error, clash.status);
    }
    await respond(req, res, 201);
  }),
);

router.get("/:id", load, wrap(async (req, res) => res.json(await practiceDetail(req, req.practice._id))));

router.patch(
  "/:id",
  load,
  requireHere(PERM.UPDATE),
  wrap(async (req, res) => {
    const b = req.body || {};
    const others = await Practice.find({ _id: { $ne: req.practice._id } }, "name").lean();
    const input = nameInput({ name: b.name ?? req.practice.name, description: b.description ?? req.practice.description }, others, "practice");
    if (input.error) return bad(res, input.error);
    await Practice.updateOne({ _id: req.practice._id }, input);
    await respond(req, res);
  }),
);

/** Choose the practice's Manager. The current one is replaced (and kept as a Practitioner unless keepPrevious is false). */
router.put(
  "/:id/manager",
  load,
  wrap(async (req, res) => {
    const target = await activeUser(req.body?.userId);
    if (!target) return bad(res, "Pick an active person as Manager");
    const { manager } = await structureRoles();
    const clash = await replaceHolder(req, manager, practiceScope(req.practice._id), String(target._id), { keepPrevious: req.body?.keepPrevious !== false });
    if (clash) return bad(res, clash.error, clash.status);
    // The slot is filled, so an open "join as Manager" invitation would otherwise replace this choice later.
    await cancelPending({ practiceId: req.practice._id, kind: "manager" }, req.user.id, "Another Manager was chosen");
    await respond(req, res);
  }),
);

// ---------- overviews of the practice and its groups (key information + files) ----------

overviewRoutes(router, { load, loadGroup });

// ---------- invitations (people not on Practise360 yet) ----------

inviteRoutes(router, { load, detail: (req) => practiceDetail(req, req.practice._id) });

// ---------- members ----------

/** Add someone to the practice as a Practitioner, optionally straight into a group. */
router.post(
  "/:id/members",
  load,
  wrap(async (req, res) => {
    const { practitioner } = await structureRoles();
    const scope = practiceScope(req.practice._id);
    const verdict = checkGrant(req.user, practitioner, scope, req.tree);
    if (!verdict.ok) return bad(res, verdict.reason, 403);
    const target = await activeUser(req.body?.userId);
    if (!target) return bad(res, "Pick an active person");
    if (await structure.isPracticeMember(target._id, req.practice._id)) return bad(res, `${target.displayName} is already in ${req.practice.name}`, 409);

    const groupId = req.body?.groupId || null;
    if (groupId) {
      if (!req.tree.groups.some((g) => g._id === groupId && g.practiceId === req.practice._id)) return bad(res, "Unknown group");
      if (!canMoveMember(req.user, req.practice._id, null, groupId, req.tree)) return bad(res, `Missing permission ${PERM.MEMBERS_MANAGE}`, 403);
    }
    await structure.addPracticeMember(req.practice._id, target._id, groupId, req.user.id);
    await respond(req, res, 201);
  }),
);

/**
 * Move a member to another group of the practice, or out of any group (groupId: null). `practices.members.manage`
 * moves anyone; `practices.group.update` (a Lead) only into or out of the groups the caller runs (rbac/group-access.js).
 */
router.put(
  "/:id/members/:userId",
  load,
  (req, res, next) => {
    // Refuse people who can't move anyone here before saying whether someone is a member.
    const practiceId = req.practice._id;
    const any = canMoveMember(req.user, practiceId, null, null, req.tree) || req.tree.groups.some((g) => g.practiceId === practiceId && canUpdateGroup(req.user, g._id, req.tree));
    return any ? next() : bad(res, `Missing permission ${PERM.MEMBERS_MANAGE}`, 403);
  },
  wrap(async (req, res) => {
    const { userId } = req.params;
    const practiceId = req.practice._id;
    if (!mongoose.isValidObjectId(userId) || !(await structure.isPracticeMember(userId, practiceId))) return bad(res, "Not a member of this practice", 404);
    const groupId = req.body?.groupId ?? null;
    if (groupId !== null && !req.tree.groups.some((g) => g._id === groupId && g.practiceId === practiceId)) return bad(res, "Unknown group");
    const fromId = groupOf(req.tree, practiceId, userId);
    if (!canMoveMember(req.user, practiceId, fromId, groupId, req.tree)) return bad(res, "You can only move people into or out of groups you manage", 403);
    if (groupId === null) {
      await GroupMembership.deleteOne({ practiceId, userId });
    } else {
      await GroupMembership.updateOne({ practiceId, userId }, { groupId, addedBy: req.user.id, addedAt: new Date() }, { upsert: true });
    }
    await respond(req, res);
  }),
);

// ---------- groups ----------

router.post(
  "/:id/groups",
  load,
  requireHere(PERM.GROUPS),
  wrap(async (req, res) => {
    const b = req.body || {};
    const siblings = req.tree.groups.filter((g) => g.practiceId === req.practice._id);
    const input = nameInput(b, siblings, "group in this practice");
    if (input.error) return bad(res, input.error);

    const practiceId = req.practice._id;
    const slug = structure.slugify(input.name, "group");
    const base = slug === practiceId || slug.startsWith(`${practiceId}-`) ? slug : `${practiceId}-${slug}`;
    const id = await structure.uniqueId(base, async (x) => !!(await Group.exists({ _id: x })));

    const lead = b.leadId ? await activeUser(b.leadId) : null;
    if (b.leadId && !lead) return bad(res, "Pick an active person as Lead");
    if (lead && !(await structure.isPracticeMember(lead._id, practiceId))) return bad(res, `Add ${lead.displayName} to ${req.practice.name} before making them a Lead`);

    await Group.create({ _id: id, practiceId, name: input.name, description: input.description, createdBy: req.user.id });
    await refreshTree(req);
    if (lead) {
      const { lead: leadRole } = await structureRoles();
      const clash = await replaceHolder(req, leadRole, groupScope(id), String(lead._id));
      // The group stays; the response says why the Lead wasn't set so they can pick someone else.
      if (clash) return res.status(201).json({ ...(await practiceDetail(req, practiceId)), warning: clash.error });
    }
    await respond(req, res, 201);
  }),
);

router.patch(
  "/:id/groups/:groupId",
  load,
  loadGroup,
  requireHere(PERM.GROUPS),
  wrap(async (req, res) => {
    const b = req.body || {};
    const siblings = req.tree.groups.filter((g) => g.practiceId === req.practice._id && g._id !== req.group._id);
    const input = nameInput({ name: b.name ?? req.group.name, description: b.description ?? req.group.description }, siblings, "group in this practice");
    if (input.error) return bad(res, input.error);
    await Group.updateOne({ _id: req.group._id }, input);
    await respond(req, res);
  }),
);

/** Only an empty group can go: no Lead and no members, so nobody's reviews silently move to the Manager. */
router.delete(
  "/:id/groups/:groupId",
  load,
  loadGroup,
  requireHere(PERM.GROUPS),
  wrap(async (req, res) => {
    const [members, leads] = await Promise.all([GroupMembership.countDocuments({ groupId: req.group._id }), RoleAssignment.countDocuments({ scopeType: "group", scopeId: req.group._id })]);
    if (members || leads) return bad(res, "Move its members to another group and remove its Lead first", 409);
    await Promise.all([Group.deleteOne({ _id: req.group._id }), GroupOverview.deleteOne({ _id: req.group._id }), PracticeFile.deleteMany({ practiceId: req.practice._id, groupId: req.group._id })]);
    // Open invitations into the group: a Lead invite has nothing left to lead; a member invite still joins the practice.
    await cancelPending({ practiceId: req.practice._id, kind: "lead", groupId: req.group._id }, req.user.id, "The group was deleted");
    await Invitation.updateMany({ practiceId: req.practice._id, groupId: req.group._id, status: "pending" }, { groupId: null });
    await respond(req, res);
  }),
);

/** Choose the group's Lead (replaces the current one). They must already be in the practice. */
router.put(
  "/:id/groups/:groupId/lead",
  load,
  loadGroup,
  wrap(async (req, res) => {
    const target = await activeUser(req.body?.userId);
    if (!target) return bad(res, "Pick an active person as Lead");
    const { lead } = await structureRoles();
    const clash = await replaceHolder(req, lead, groupScope(req.group._id), String(target._id));
    if (clash) return bad(res, clash.error, clash.status);
    await cancelPending({ practiceId: req.practice._id, kind: "lead", groupId: req.group._id }, req.user.id, "Another Lead was chosen");
    await respond(req, res);
  }),
);

/** Leave the group without a Lead — the Manager covers its members until a new one is chosen. */
router.delete(
  "/:id/groups/:groupId/lead",
  load,
  loadGroup,
  wrap(async (req, res) => {
    const { lead } = await structureRoles();
    const verdict = checkGrant(req.user, lead, groupScope(req.group._id), req.tree);
    if (!verdict.ok) return bad(res, verdict.reason, 403);
    await RoleAssignment.deleteMany({ roleId: lead._id, scopeType: "group", scopeId: req.group._id });
    await respond(req, res);
  }),
);

module.exports = router;

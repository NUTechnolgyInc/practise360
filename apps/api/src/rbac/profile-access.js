// What a signed-in user may see on someone's profile (docs/rbac.md §4 "People profiles"). Pure — no DB, unit-tested.
// A profile never shows more than the screens that link to it already do: each part reuses the rule of the screen
// it comes from — Access control, the practice page, Contributions, Certification Tracker and AI Tracker.
const { can, groupOf } = require("./engine");
const { describeScope } = require("./present");
const cert = require("./cert-access");
const { PERM: CONTRIBUTION } = require("./contribution-access");
const { canViewReportsOf, isSubmitter, practicesOf } = require("./usage-access");

const PRACTICE_VIEW = "practices.practice.view";
const MEMBERS_VIEW = "practices.members.view";
// GET /rbac/users: holding any of these opens the people directory (every active person's name and username).
const DIRECTORY_PERMS = [MEMBERS_VIEW, "practices.roles.assign", "platform.users.manage", "platform.apps.assign"];
// GET /rbac/users: which of a person's role assignments the viewer is shown.
const ASSIGNMENT_VIEW_PERMS = [MEMBERS_VIEW, "platform.users.manage", "platform.apps.assign"];
// The practice page shows its Manager and every group's Lead to everyone who can open the practice.
const STRUCTURE_ROLES = { practice_manager: "practice", practice_lead: "group" };

const scopeOf = (g) => ({ type: g.scopeType, id: g.scopeId ?? null });
const practiceScope = (id) => ({ type: "practice", id });
const holdsAnywhere = (user, ...perms) => user.grants.some((g) => g.permissions.includes("*") || perms.some((p) => g.permissions.includes(p)));
const byName = (a, b) => a.name.localeCompare(b.name);

/** May open the people directory — and so see any active person's name and username. */
const canBrowseDirectory = (viewer) => holdsAnywhere(viewer, ...DIRECTORY_PERMS);

/** Whether `viewer` may see one of someone else's role grants. */
function canSeeGrant(viewer, grant, tree) {
  const scope = scopeOf(grant);
  if (ASSIGNMENT_VIEW_PERMS.some((p) => can(viewer, p, scope, undefined, tree))) return true;
  if (STRUCTURE_ROLES[grant.roleId] === grant.scopeType && can(viewer, PRACTICE_VIEW, scope, undefined, tree)) return true;
  // /practices names the Practices Admins to everyone who can see any practice.
  return grant.roleId === "practices_admin" && holdsAnywhere(viewer, PRACTICE_VIEW);
}

/** The practices `grants` place someone in (practice roles, or leading one of its groups), active practices only. */
function practicesHeld(grants, tree) {
  const groupPractice = (id) => tree.groups.find((g) => g._id === id)?.practiceId;
  const ids = grants.flatMap((g) => (g.scopeType === "practice" ? [g.scopeId] : g.scopeType === "group" ? [groupPractice(g.scopeId)] : []));
  return tree.practices.filter((p) => ids.includes(p._id));
}

/**
 * The parts of `personId`'s profile that `viewer` may see. `grants` are the person's resolved grants (loadGrants).
 * Returns the visible practice memberships and app-level roles, plus which record sections are open to the viewer.
 * A section that's closed here can still show records the viewer reaches another way (e.g. as a co-contributor) —
 * the route adds those, filtered by each record's own rules.
 */
function profileView(viewer, personId, grants, tree) {
  const self = String(viewer.id) === String(personId);
  const sees = (g) => self || canSeeGrant(viewer, g, tree);
  const groupName = (id) => tree.groups.find((g) => g._id === id)?.name ?? id;

  const practices = practicesHeld(grants, tree)
    .map((p) => {
      const roles = grants.filter((g) => g.scopeType === "practice" && g.scopeId === p._id && sees(g));
      const groupRoles = grants.filter((g) => g.scopeType === "group" && tree.groups.some((x) => x._id === g.scopeId && x.practiceId === p._id) && sees(g));
      if (!roles.length && !groupRoles.length) return null;
      // Which group someone sits in is part of the member list, so it needs the same permission.
      const groupId = groupOf(tree, p._id, personId);
      const showGroup = groupId && (self || can(viewer, MEMBERS_VIEW, practiceScope(p._id), undefined, tree));
      return {
        id: p._id,
        name: p.name,
        group: showGroup ? { id: groupId, name: groupName(groupId) } : null,
        roles: [...new Set(roles.map((g) => g.roleName))].sort(),
        groupRoles: groupRoles.map((g) => ({ role: g.roleName, group: { id: g.scopeId, name: groupName(g.scopeId) } })),
      };
    })
    .filter(Boolean)
    .sort(byName);

  const appRoles = grants
    .filter((g) => (g.scopeType === "app" || g.scopeType === "platform") && sees(g))
    .map((g) => ({ roleId: g.roleId, roleName: g.roleName, scopeType: g.scopeType, scopeId: g.scopeId ?? null, scopeLabel: describeScope(g, tree) }))
    .sort((a, b) => a.roleName.localeCompare(b.roleName));

  // Records live at the owner's practice (contributions, plans) or follow it (usage reports).
  const memberOf = practicesOf(grants).filter((id) => tree.practices.some((p) => p._id === id));
  return {
    self,
    directory: canBrowseDirectory(viewer),
    practices,
    appRoles,
    contributions: memberOf.some((id) => can(viewer, CONTRIBUTION.VIEW, practiceScope(id), undefined, tree)),
    // Practitioners don't see each other's plans; the owner, their group's Lead, the Manager and admins do.
    certifications: self ? cert.ownPractices(viewer, tree).length > 0 : memberOf.some((id) => cert.canForMember(viewer, cert.PERM.VIEW, id, personId, tree)),
    reports: self || canViewReportsOf(viewer, memberOf, tree.practices),
    submitsReports: isSubmitter(grants),
  };
}

module.exports = { profileView, canSeeGrant, canBrowseDirectory, practicesHeld };

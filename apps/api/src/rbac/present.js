// Display helpers: the UI shows names ("Practice Lead @ Digital Engineering · Fullstack"), never raw ids.
const { groupLabel } = require("./engine");

function describeScope({ scopeType, scopeId }, { apps, practices, groups = [] }) {
  if (scopeType === "platform") return "Platform";
  if (scopeType === "app") return apps.find((a) => a._id === scopeId)?.name ?? scopeId;
  if (scopeType === "group") {
    const group = groups.find((g) => g._id === scopeId);
    return group ? groupLabel(group, practices) : scopeId;
  }
  return practices.find((p) => p._id === scopeId)?.name ?? scopeId;
}

module.exports = { describeScope };

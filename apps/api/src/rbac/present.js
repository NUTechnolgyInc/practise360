// Display helpers: the UI shows names ("Practice Lead @ QA"), never raw ids.

function describeScope({ scopeType, scopeId }, { apps, practices }) {
  if (scopeType === "platform") return "Platform";
  if (scopeType === "app") return apps.find((a) => a._id === scopeId)?.name ?? scopeId;
  return practices.find((p) => p._id === scopeId)?.name ?? scopeId;
}

module.exports = { describeScope };

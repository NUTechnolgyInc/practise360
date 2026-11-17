// Direct cleanup for the few things the API deliberately can't undo (e.g. practices can't be deleted), so a test
// that creates one doesn't leak it into later specs. Only ever points at the *_e2e database (see env.js).
const mongoose = require("mongoose");
const { E2E } = require("../env");

/** Removes a practice with its groups, group memberships, Overviews (practice and groups) and files, and every role assignment on it or its groups. */
async function removePractice(practiceId) {
  if (!new URL(E2E.mongoUri).pathname.endsWith("_e2e")) throw new Error("Refusing to touch a non-e2e database");
  const conn = await mongoose.createConnection(E2E.mongoUri).asPromise();
  try {
    const groups = await conn.collection("practice_groups").find({ practiceId }).toArray();
    await conn.collection("role_assignments").deleteMany({
      $or: [{ scopeType: "practice", scopeId: practiceId }, { scopeType: "group", scopeId: { $in: groups.map((g) => g._id) } }],
    });
    await conn.collection("group_memberships").deleteMany({ practiceId });
    await conn.collection("practice_groups").deleteMany({ practiceId });
    await conn.collection("practice_overviews").deleteOne({ _id: practiceId });
    await conn.collection("group_overviews").deleteMany({ _id: { $in: groups.map((g) => g._id) } });
    await conn.collection("practice_files").deleteMany({ practiceId });
    await conn.collection("practices").deleteOne({ _id: practiceId });
  } finally {
    await conn.close();
  }
}

/**
 * Removes people who joined from an invitation (by email) with everything they hold, plus every invitation sent to those
 * emails — later specs count the seeded users exactly.
 */
async function removeInvited(emails) {
  if (!new URL(E2E.mongoUri).pathname.endsWith("_e2e")) throw new Error("Refusing to touch a non-e2e database");
  const conn = await mongoose.createConnection(E2E.mongoUri).asPromise();
  try {
    const users = await conn.collection("users").find({ email: { $in: emails } }).toArray();
    const ids = users.map((u) => u._id);
    await conn.collection("role_assignments").deleteMany({ userId: { $in: ids } });
    await conn.collection("group_memberships").deleteMany({ userId: { $in: ids } });
    await conn.collection("users").deleteMany({ _id: { $in: ids } });
    await conn.collection("invitations").deleteMany({ email: { $in: emails } });
  } finally {
    await conn.close();
  }
}

module.exports = { removePractice, removeInvited };

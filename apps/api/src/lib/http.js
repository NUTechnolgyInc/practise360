// Request helpers shared by the feature routers (contributions, certifications).
const express = require("express");
const { RoleAssignment, Role, User } = require("../models");

const bad = (res, error, status = 400) => res.status(status).json({ error });

/** Input errors thrown from deep inside a handler (see str) become a 400; anything else is a real failure. */
class InputError extends Error {}
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => (err instanceof InputError ? bad(res, err.message) : next(err)));

// Vercel caps request bodies at 4.5 MB.
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const rawBody = express.raw({ type: () => true, limit: MAX_FILE_BYTES });

/** Trimmed text, refused when over `max` — silently cutting it would lose what the person wrote. */
const str = (v, max, label) => {
  if (typeof v !== "string") return "";
  const text = v.trim();
  if (text.length > max) throw new InputError(`${label} is too long (max ${max.toLocaleString("en-US")} characters)`);
  return text;
};

/** YYYY-MM-DD (optionally with a time). Impossible days like 2027-02-31 are refused instead of rolling into March. */
const parseDate = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(String(v ?? ""));
  if (!m) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const [y, mo, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const calendar = new Date(Date.UTC(y, mo - 1, day));
  return calendar.getUTCFullYear() === y && calendar.getUTCMonth() === mo - 1 && calendar.getUTCDate() === day ? d : null;
};

async function usersById(ids) {
  const unique = [...new Set(ids.filter(Boolean).map(String))];
  const users = await User.find({ _id: { $in: unique } }, "username displayName").lean();
  return new Map(users.map((u) => [String(u._id), { id: String(u._id), username: u.username, displayName: u.displayName }]));
}
const person = (map, id) => (id ? map.get(String(id)) ?? { id: String(id), username: "unknown", displayName: "Unknown user" } : null);

/**
 * Active people with a practice-scope assignment in `practiceId` for whom `qualifies({ id, grants })` is true
 * (e.g. "may contribute here"). Admins granted higher up aren't practice members.
 */
async function practiceMembers(practiceId, qualifies) {
  const assignments = await RoleAssignment.find({ scopeType: "practice", scopeId: practiceId }).lean();
  const roles = new Map((await Role.find({ _id: { $in: assignments.map((a) => a.roleId) } }).lean()).map((r) => [r._id, r.permissions]));
  const userIds = [...new Set(assignments.map((a) => String(a.userId)))];
  const users = await User.find({ _id: { $in: userIds }, isActive: true }, "username displayName").lean();
  return users
    .filter((u) => {
      const grants = assignments.filter((a) => String(a.userId) === String(u._id)).map((a) => ({ scopeType: a.scopeType, scopeId: a.scopeId, permissions: roles.get(a.roleId) || [] }));
      return qualifies({ id: String(u._id), grants });
    })
    .map((u) => ({ id: String(u._id), username: u.username, displayName: u.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Streams a stored file. Only PDFs and images render inline; anything else downloads, so uploaded HTML can't run in our origin. */
function sendStoredFile(res, file) {
  const data = Buffer.from(file.data.buffer ?? file.data);
  const inline = /^(application\/pdf|image\/(png|jpeg|gif|webp))$/.test(file.contentType);
  res.set({
    "Content-Type": inline ? file.contentType : "application/octet-stream",
    "Content-Length": data.length,
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${file.fileName.replace(/"/g, "")}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  res.send(data);
}

const safeFileName = (name, fallback = "attachment") => String(name || fallback).replace(/[^\w.\- ]+/g, "_").slice(0, 120);

module.exports = { bad, InputError, wrap, MAX_FILE_BYTES, rawBody, str, parseDate, usersById, person, practiceMembers, sendStoredFile, safeFileName };

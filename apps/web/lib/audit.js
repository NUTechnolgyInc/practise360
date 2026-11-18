// Display helpers for the audit log screen. The API does the filtering; these only format what it returns.

export const EMPTY_AUDIT_FILTERS = { q: "", category: "", outcome: "", actorId: "", from: "", to: "" };

export const OUTCOME_LABEL = { success: "Success", denied: "Denied", failed: "Failed" };

/** Query string for GET /audit-log — empty filters are left out. */
export function auditQuery(filters, page) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) params.set(k, v.trim?.() ?? v);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `/audit-log${qs ? `?${qs}` : ""}`;
}

/** "18 Nov 2026, 14:05:09" in the viewer's time zone — seconds matter when reading a sequence of actions. */
export function formatDateTime(iso) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/** "scopeId" → "Scope", "userIds" → "Users", "fileName" → "File name", "id" → "Target". */
export function fieldLabel(key) {
  if (key === "id") return "Target";
  const base = key.replace(/Ids$/, "s").replace(/Id$/, "") || key;
  const words = base.replace(/([a-z\d])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A value with ids swapped for names (`names` comes from the API), arrays joined, objects summarised. */
export function fieldValue(value, names) {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return names[value] ?? value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? value.map((v) => fieldValue(v, names)).join(", ") : "—";
  return Object.entries(value)
    .map(([k, v]) => `${fieldLabel(k)}: ${fieldValue(v, names)}`)
    .join("; ");
}

/** Path params first (what was acted on), then the request's own fields, then what a create returned. */
export function entryFields(entry, names) {
  const fields = [...Object.entries(entry.params), ...Object.entries(entry.details)].map(([k, v]) => ({ key: k, label: fieldLabel(k), value: fieldValue(v, names) }));
  if (entry.resultId) fields.push({ key: "resultId", label: "Created", value: names[entry.resultId] ?? entry.resultId });
  return fields;
}

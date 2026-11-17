// Labels and helpers for the Certification Tracker. Keys mirror the API model (apps/api/src/models).

export const CERT_TYPES = [
  { value: "certification", label: "Certification" },
  { value: "course", label: "Course" },
];

export const PLAN_STATUSES = [
  { value: "suggested", label: "Recommended" },
  { value: "planned", label: "Planned" },
  { value: "lead_review", label: "Lead review" },
  { value: "clarification", label: "Clarification needed" },
  { value: "manager_review", label: "Manager review" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "dropped", label: "Dropped" },
];

export const SOURCES = { self: "Own plan", suggested: "Recommended", assigned: "Assigned" };
export const CURRENCIES = ["INR", "USD"];

export const certTypeLabel = (type) => CERT_TYPES.find((t) => t.value === type)?.label ?? type;
export const planStatusLabel = (status) => PLAN_STATUSES.find((s) => s.value === status)?.label ?? status;
export const isOpen = (status) => ["suggested", "planned", "lead_review", "manager_review", "clarification"].includes(status);
export const inReview = (status) => ["lead_review", "manager_review"].includes(status);

/** "₹12,000" / "$450" */
export const formatMoney = (amount, currency) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(amount);

/** Sums reimbursements per currency: "₹24,000 · $450". Empty string when there are none. */
export function moneyTotals(rows) {
  const totals = {};
  for (const r of rows) if (r.reimbursement) totals[r.reimbursement.currency] = (totals[r.reimbursement.currency] ?? 0) + r.reimbursement.amount;
  return Object.entries(totals)
    .map(([currency, amount]) => formatMoney(amount, currency))
    .join(" · ");
}

/** Today as YYYY-MM-DD for <input type="date">, in the viewer's timezone. */
export const todayInput = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export const plansPath = (id) => `/certifications/plans/${id}`;
export const filesPath = (id) => `/certifications/plans/${id}/files`;

// Certificates and receipts must be PDFs or images — the API refuses anything else.
export const CERT_FILE_ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

// Labels and helpers for Practices → Contributions. Keys mirror the API model (apps/api/src/models).

export const CONTRIBUTION_TYPES = [
  { value: "framework", label: "Reusable framework / accelerator" },
  { value: "automation", label: "Automation / internal tool" },
  { value: "client_win", label: "Client win story" },
  { value: "case_study", label: "Internal case study" },
  { value: "blog", label: "Blog" },
  { value: "other", label: "Other (custom)" },
];

export const CONTRIBUTION_STATUSES = [
  { value: "in_progress", label: "In Progress" },
  { value: "lead_review", label: "Lead review" },
  { value: "clarification", label: "Clarification needed" },
  { value: "manager_review", label: "Manager review" },
  { value: "published", label: "Published" },
  { value: "declined", label: "Declined" },
];

export const typeLabel = (c) => (c.type === "other" ? c.customType || "Other" : CONTRIBUTION_TYPES.find((t) => t.value === c.type)?.label ?? c.type);
export const statusLabel = (status) => CONTRIBUTION_STATUSES.find((s) => s.value === status)?.label ?? status;

/** YYYY-MM-DD for <input type="date">. */
export const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export const MAX_FILE_BYTES = 4 * 1024 * 1024; // matches the API (Vercel caps bodies at 4.5 MB)

/**
 * Turns an uploaded .docx / .md / .txt into Markdown for the description editor.
 * .docx goes docx → HTML (mammoth) → Markdown (turndown + GFM tables). Images are dropped: embedded as
 * base64 they'd bloat the description past the API's 1 MB limit — attach them as files instead.
 * Loaded lazily so the converters only download when someone imports a document.
 */
export async function documentToMarkdown(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) return (await file.text()).trim();
  if (!name.endsWith(".docx")) throw new Error("Import a .docx, .md or .txt file");

  const [{ default: mammoth }, { default: TurndownService }, { gfm }] = await Promise.all([import("mammoth"), import("turndown"), import("turndown-plugin-gfm")]);
  const { value: html } = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    { convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })) },
  );
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  turndown.use(gfm);
  turndown.remove("img");
  return turndown
    .turndown(tablesWithHeaders(html))
    .replace(/^(\s*)([-*]|\d+\.)\s{2,}/gm, "$1$2 ") // "-   item" → "- item"
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Word tables come out of mammoth as <td><p>…</p></td> with no header row, and the GFM plugin only turns
 * tables with a header into Markdown (others stay raw HTML). Promote each table's first row to <th> and
 * unwrap the cell paragraphs so they become Markdown tables.
 */
function tablesWithHeaders(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("table").forEach((table) => {
    table.querySelectorAll("td p, th p").forEach((p) => p.replaceWith(...p.childNodes, " "));
    const first = table.querySelector("tr");
    if (!first || first.querySelector("th")) return;
    first.querySelectorAll("td").forEach((td) => {
      const th = doc.createElement("th");
      th.innerHTML = td.innerHTML;
      td.replaceWith(th);
    });
  });
  return doc.body.innerHTML;
}

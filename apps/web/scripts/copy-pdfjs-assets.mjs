// Copies pdf.js standard fonts into public/pdfjs/ (generated, gitignored). PDFs that use the base-14 fonts
// (Helvetica etc., which reportlab doesn't embed) render with no text unless pdf.js can fetch these.
import { cpSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pdfjsDir = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));
const out = join(root, "public", "pdfjs");

mkdirSync(out, { recursive: true });
cpSync(join(pdfjsDir, "standard_fonts"), join(out, "standard_fonts"), { recursive: true });
console.log("copied pdf.js standard fonts -> public/pdfjs/standard_fonts");

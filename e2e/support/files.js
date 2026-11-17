// Synthetic test files built in memory, so the suite has no binary fixtures to keep in sync.

/** A small, valid one-page PDF (correct xref offsets, so pdf.js renders it). */
function makePdf(text = "Practise360 e2e report") {
  const safe = text.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** `bytes` of filler — for size-limit tests. */
const bigBuffer = (bytes, head = "") => Buffer.concat([Buffer.from(head, "latin1"), Buffer.alloc(Math.max(0, bytes - head.length), 0x41)]);

const MB = 1024 * 1024;

module.exports = { makePdf, bigBuffer, MB };

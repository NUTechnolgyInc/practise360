#!/usr/bin/env python3
"""Render report.json into the NULogic-branded Claude Usage Report PDF.

Usage: python3 build_report.py report.json --out Claude-Usage-<Name>-<YYYY-MM>.pdf
Needs: reportlab, matplotlib  (pip install reportlab matplotlib)

The layout is fixed on purpose: leadership compares reports from many people, so every PDF must
look the same. Change the analysis in report.json, never the layout per person.
"""
import argparse
import calendar
import io
import json
import re
import sys
from pathlib import Path

try:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
except ImportError as exc:  # pragma: no cover
    sys.exit(f"Missing dependency ({exc.name}). Run: pip install reportlab matplotlib")

HERE = Path(__file__).resolve().parent
LOGO = HERE.parent / "assets" / "nulogic-wordmark.png"

# NULogic palette (nulogic-branding skill)
LAPIS, NAVY, TEAL, MUTED = "#050766", "#25255C", "#133E49", "#3E616A"
PURPLE, RED, CORAL, NEAR_WHITE, INDIGO = "#8939A1", "#E62A32", "#EE777C", "#F4F5F6", "#61629D"
C = colors.HexColor

STYLES = {
    "h1": ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=C(LAPIS)),
    "h2": ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=14, leading=18, textColor=C(LAPIS), spaceBefore=10, spaceAfter=6),
    "eyebrow": ParagraphStyle("eyebrow", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=C(PURPLE)),
    "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=C(TEAL), alignment=TA_LEFT),
    "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8, leading=11, textColor=C(MUTED)),
    "cell": ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=11, textColor=C(TEAL)),
    "cellb": ParagraphStyle("cellb", fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=C(NAVY)),
    "th": ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=colors.white),
    "kpi": ParagraphStyle("kpi", fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=C(LAPIS)),
    "kpil": ParagraphStyle("kpil", fontName="Helvetica-Bold", fontSize=7, leading=9, textColor=C(MUTED)),
}

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN


# ---------- validation & maths ----------

def fail(msg):
    sys.exit(f"report.json invalid: {msg}")


def validate(r):
    for key in ("meta", "executive_summary", "use_cases", "productivity", "top_roi", "recurring_work", "insights"):
        if key not in r:
            fail(f"missing '{key}' (see references/report-schema.md)")
    m = r["meta"]
    for key in ("name", "practice", "month", "conversations_analyzed"):
        if not m.get(key) and m.get(key) != 0:
            fail(f"meta.{key} is required")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", str(m["month"])):
        fail("meta.month must be YYYY-MM")
    cats = {u["category"]: u for u in r["use_cases"]}
    if not cats:
        fail("use_cases is empty")
    for p in r["productivity"].get("by_category", []):
        if p["category"] not in cats:
            fail(f"productivity category '{p['category']}' is not in use_cases")
        if p["claude_minutes"] > p["manual_minutes"]:
            fail(f"'{p['category']}': claude_minutes is more than manual_minutes")


def compute(r):
    counts = {u["category"]: u["count"] for u in r["use_cases"]}
    rows = []
    for p in r["productivity"]["by_category"]:
        n = counts[p["category"]]
        manual_h, claude_h = n * p["manual_minutes"] / 60, n * p["claude_minutes"] / 60
        rows.append({**p, "count": n, "manual_h": manual_h, "claude_h": claude_h, "saved_h": manual_h - claude_h})
    manual = sum(x["manual_h"] for x in rows)
    claude = sum(x["claude_h"] for x in rows)
    saved = manual - claude
    return {
        "rows": sorted(rows, key=lambda x: -x["saved_h"]),
        "manual_h": manual,
        "claude_h": claude,
        "saved_h": saved,
        "reduction_pct": (saved / manual * 100) if manual else 0,
        "multiplier": (manual / claude) if claude else 0,
    }


def month_label(ym):
    y, m = ym.split("-")
    return f"{calendar.month_name[int(m)]} {y}"


# ---------- building blocks ----------

def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para(text, style="body"):
    return Paragraph(esc(text), STYLES[style])


def bullets(items, style="body"):
    return [Paragraph(f"<font color='{PURPLE}'>&#9679;</font>&nbsp;&nbsp;{esc(i)}", STYLES[style]) for i in items]


def table(header, rows, widths, numeric_cols=()):
    data = [[Paragraph(esc(h), STYLES["th"]) for h in header]]
    for row in rows:
        data.append([c if not isinstance(c, (str, int, float)) else para(c, "cellb" if i == 0 else "cell") for i, c in enumerate(row)])
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), C(LAPIS)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, C(NEAR_WHITE)]),
        ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor("#DDDDE6")),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]
    for col in numeric_cols:
        style.append(("ALIGN", (col, 0), (col, -1), "RIGHT"))
    t.setStyle(TableStyle(style))
    return t


def kpi_tiles(kpis):
    cells = [[Paragraph(esc(v), STYLES["kpi"]), Paragraph(esc(label.upper()), STYLES["kpil"])] for v, label in kpis]
    inner = [Table([[c[0]], [c[1]]], colWidths=[CONTENT_W / 4 - 8]) for c in cells]
    t = Table([inner], colWidths=[CONTENT_W / 4] * 4)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), C(NEAR_WHITE)),
        ("LINEABOVE", (0, 0), (-1, 0), 2.5, C(PURPLE)),
        ("BOX", (0, 0), (-1, -1), 0, colors.white),
        ("INNERGRID", (0, 0), (-1, -1), 4, colors.white),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def chart(fig, width=CONTENT_W, height=62 * mm):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=200, bbox_inches="tight", transparent=True)
    plt.close(fig)
    buf.seek(0)
    return Image(buf, width=width, height=height, kind="proportional")


def style_axes(ax):
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#C9CAD6")
    ax.tick_params(colors=TEAL, labelsize=8)
    ax.grid(axis="x", color="#ECECF2", linewidth=0.8)
    ax.set_axisbelow(True)


def use_case_chart(use_cases):
    items = sorted(use_cases, key=lambda u: u["count"])
    fig, ax = plt.subplots(figsize=(7.2, max(2.2, 0.32 * len(items) + 0.6)))
    bars = ax.barh([u["category"] for u in items], [u["count"] for u in items], color=PURPLE, height=0.6)
    bars[-1].set_color(LAPIS)  # top category stands out
    for b in bars:
        ax.text(b.get_width() + 0.3, b.get_y() + b.get_height() / 2, f"{int(b.get_width())}", va="center", fontsize=8, color=NAVY)
    ax.set_xlabel("Conversations", fontsize=8, color=MUTED)
    style_axes(ax)
    return chart(fig)


def hours_chart(rows):
    rows = rows[:8]
    fig, ax = plt.subplots(figsize=(7.2, max(2.2, 0.42 * len(rows) + 0.6)))
    y = range(len(rows))
    ax.barh([i + 0.2 for i in y], [r["manual_h"] for r in rows], height=0.38, color="#C9CAD6", label="Manual (estimated)")
    ax.barh([i - 0.2 for i in y], [r["claude_h"] for r in rows], height=0.38, color=RED, label="With Claude")
    ax.set_yticks(list(y), [r["category"] for r in rows])
    ax.invert_yaxis()
    ax.set_xlabel("Hours this month", fontsize=8, color=MUTED)
    ax.legend(fontsize=8, frameon=False, loc="lower right")
    style_axes(ax)
    return chart(fig)


# ---------- page furniture ----------

def decorate(meta):
    def draw(canvas, doc):
        canvas.saveState()
        # Brand-identity gradient bar (#ED3027 -> #7B469B) across the top.
        steps = 60
        for i in range(steps):
            t = i / (steps - 1)
            r, g, b = (0xED + (0x7B - 0xED) * t, 0x30 + (0x46 - 0x30) * t, 0x27 + (0x9B - 0x27) * t)
            canvas.setFillColorRGB(r / 255, g / 255, b / 255)
            canvas.rect(PAGE_W * i / steps, PAGE_H - 5, PAGE_W / steps + 1, 5, stroke=0, fill=1)
        if LOGO.exists():
            canvas.drawImage(str(LOGO), MARGIN, PAGE_H - 18 * mm, width=34 * mm, height=12.8 * mm, mask="auto", preserveAspectRatio=True)
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(C(MUTED))
        canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 12 * mm, f"CLAUDE USAGE REPORT  ·  {month_label(meta['month']).upper()}")
        canvas.setStrokeColor(C("#E4E4EC"))
        canvas.line(MARGIN, 14 * mm, PAGE_W - MARGIN, 14 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(MARGIN, 9 * mm, f"{meta['name']}  ·  {meta['practice']}  ·  NULogic internal — Practise360 AI Tracker")
        canvas.drawRightString(PAGE_W - MARGIN, 9 * mm, f"Page {doc.page}")
        canvas.restoreState()

    return draw


# ---------- document ----------

def build(r, out):
    meta, ex, ins = r["meta"], r["executive_summary"], r["insights"]
    k = compute(r)
    top_cat = max(r["use_cases"], key=lambda u: u["count"])["category"]
    story = [
        Spacer(1, 6 * mm),
        para("EXECUTIVE REPORT", "eyebrow"),
        Spacer(1, 2),
        para("Claude Usage Report", "h1"),
        Spacer(1, 3),
        para(f"{meta['name']}  ·  {meta['practice']}  ·  {month_label(meta['month'])}", "small"),
        Spacer(1, 8 * mm),
        kpi_tiles([
            (str(meta["conversations_analyzed"]), "Conversations"),
            (f"{k['saved_h']:.0f} h", "Est. hours saved"),
            (f"{k['reduction_pct']:.0f}%", "Time reduction"),
            (top_cat, "Top use case"),
        ]),
        para("Executive summary", "h2"),
        para(ex["summary"]),
        Spacer(1, 4),
        *bullets(ex.get("highlights", [])[:4]),
        Spacer(1, 4),
        para(f"Sources: {', '.join(meta.get('sources', [])) or 'not stated'}. {meta.get('coverage_note', '')}", "small"),
    ]

    total = sum(u["count"] for u in r["use_cases"]) or 1
    uc_rows = [[u["category"], str(u["count"]), f"{u['count'] / total * 100:.0f}%", u.get("example", "")]
               for u in sorted(r["use_cases"], key=lambda u: -u["count"])]
    story += [
        para("1. Primary use cases", "h2"),
        KeepTogether([use_case_chart(r["use_cases"]), Spacer(1, 4)]),
        table(["Category", "Count", "Share", "Example"], uc_rows, [38 * mm, 16 * mm, 16 * mm, CONTENT_W - 70 * mm], (1, 2)),
    ]

    p_rows = [[x["category"], str(x["count"]), f"{x['manual_minutes']}", f"{x['claude_minutes']}", f"{x['saved_h']:.1f}"] for x in k["rows"]]
    p_rows.append([para("Total", "cellb"), "", f"{k['manual_h']:.0f} h", f"{k['claude_h']:.0f} h", f"{k['saved_h']:.1f}"])
    story += [
        para("2. Productivity &amp; efficiency gains".replace("&amp;", "&"), "h2"),
        para(f"Estimated {k['saved_h']:.0f} hours saved this month — work that would take about {k['manual_h']:.0f} h manually took "
             f"about {k['claude_h']:.0f} h with Claude ({k['reduction_pct']:.0f}% less time, {k['multiplier']:.1f}× throughput)."),
        Spacer(1, 4),
        KeepTogether([hours_chart(k["rows"]), Spacer(1, 4)]),
        table(["Category", "Tasks", "Manual min/task", "Claude min/task", "Hours saved"], p_rows,
              [CONTENT_W - 112 * mm, 18 * mm, 32 * mm, 32 * mm, 30 * mm], (1, 2, 3, 4)),
        Spacer(1, 3),
        para(f"Assumptions: {r['productivity'].get('assumptions', 'not stated')}", "small"),
        para("Highest-ROI tasks", "h2"),
        table(["Task", "Why Claude pays off here"], [[t["task"], t["why"]] for t in r["top_roi"]], [60 * mm, CONTENT_W - 60 * mm]),
    ]

    rw_rows = [[w["task"], f"{w['frequency_per_month']}×", "Yes" if w.get("make_skill") else "No", w.get("benefit", "")] for w in r["recurring_work"]]
    story += [
        para("3. Recurring work", "h2"),
        table(["Task", "Per month", "Make a skill?", "Expected benefit"], rw_rows or [["None identified", "", "", ""]],
              [50 * mm, 20 * mm, 22 * mm, CONTENT_W - 92 * mm], (1,)),
        para("4. Key insights", "h2"),
    ]
    for title, key in (("Working patterns", "patterns"), ("Strengths", "strengths"), ("Opportunities to improve", "improvements")):
        if ins.get(key):
            story += [KeepTogether([para(title.upper(), "eyebrow"), Spacer(1, 3), *bullets(ins[key]), Spacer(1, 6)])]

    doc = SimpleDocTemplate(
        str(out), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=24 * mm, bottomMargin=20 * mm,
        title=f"Claude Usage Report — {meta['name']} — {month_label(meta['month'])}", author=meta["name"],
        subject=json.dumps({"month": meta["month"], "conversations": meta["conversations_analyzed"], "hours_saved": round(k["saved_h"], 1),
                            "time_reduction_pct": round(k["reduction_pct"]), "top_use_case": top_cat}),
        keywords="practise360-claude-usage-report", creator="claude-usage-report skill",
    )
    deco = decorate(meta)
    doc.build(story, onFirstPage=deco, onLaterPages=deco)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("report_json")
    ap.add_argument("--out", help="output PDF path")
    args = ap.parse_args()
    r = json.loads(Path(args.report_json).read_text(encoding="utf-8"))
    validate(r)
    out = Path(args.out or f"Claude-Usage-{re.sub(r'[^A-Za-z0-9]+', '-', r['meta']['name']).strip('-')}-{r['meta']['month']}.pdf")
    build(r, out)
    k = compute(r)
    print(f"Wrote {out}  ·  {r['meta']['conversations_analyzed']} conversations  ·  {k['saved_h']:.0f} h saved  ·  {k['reduction_pct']:.0f}% time reduction")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Render docs/QA-GATE-RULES.md to public/pdfs/QA-GATE-RULES.pdf."""

from __future__ import annotations

import re
from pathlib import Path

import markdown
from fpdf import FPDF
from fpdf.fonts import FontFace

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "docs" / "QA-GATE-RULES.md"
DEST = ROOT / "public" / "pdfs" / "QA-GATE-RULES.pdf"

TEAL = (13, 155, 134)
NAVY = (11, 31, 51)
INK = (26, 36, 51)
MUTED = (91, 107, 124)


class QaPdf(FPDF):
    def header(self) -> None:
        if self.page_no() == 1:
            return
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Boing Network  -  QA Gate Rules", align="L")
        self.ln(10)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_draw_color(*TEAL)
        self.set_line_width(0.35)
        self.line(18, self.get_y(), self.w - 18, self.get_y())
        self.set_y(-12)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, f"boing.observer/qa/rules    Page {self.page_no()} of {{nb}}", align="C")


def ascii_safe(text: str) -> str:
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2026": "...",
        "\u00a0": " ",
        "\u202f": " ",
        "\u2009": " ",
        "\u2192": "->",
        "\u2264": "<=",
        "\u2265": ">=",
        "\u00b7": "-",
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", "replace").decode("latin-1")


def md_to_html(text: str) -> str:
    raw = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "sane_lists"],
        output_format="html",
    )
    raw = re.sub(r"<blockquote>\s*<p>", "<p><b>Note. </b>", raw)
    raw = raw.replace("</p>\n</blockquote>", "</p>")
    raw = raw.replace("<blockquote>", "<p>")
    raw = raw.replace("</blockquote>", "</p>")
    raw = raw.replace("<hr />", "<br>")
    raw = raw.replace("<hr>", "<br>")
    raw = re.sub(
        r"<code>(.*?)</code>",
        lambda m: f"<font face='Courier' size='9'>{m.group(1)}</font>",
        raw,
        flags=re.S,
    )
    raw = re.sub(r"<pre>.*?</pre>", "", raw, flags=re.S)

    def flatten_cell(match: re.Match[str]) -> str:
        tag = match.group(1)
        inner = re.sub(r"<[^>]+>", "", match.group(2))
        return f"<{tag}>{inner}</{tag}>"

    raw = re.sub(r"<(td|th)>(.*?)</\1>", flatten_cell, raw, flags=re.S)
    return raw


def main() -> None:
    md = ascii_safe(SRC.read_text(encoding="utf-8"))
    body = ascii_safe(md_to_html(md))
    DEST.parent.mkdir(parents=True, exist_ok=True)

    pdf = QaPdf(format="Letter", unit="mm")
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 16, 18)
    pdf.add_page()

    tag_styles = {
        "h1": FontFace(family="Helvetica", emphasis="B", size_pt=20, color=NAVY),
        "h2": FontFace(family="Helvetica", emphasis="B", size_pt=13, color=NAVY),
        "h3": FontFace(family="Helvetica", emphasis="B", size_pt=11.5, color=(18, 50, 74)),
        "p": FontFace(family="Helvetica", size_pt=10.5, color=INK),
        "li": FontFace(family="Helvetica", size_pt=10.5, color=INK),
        "a": FontFace(family="Helvetica", color=TEAL),
        "b": FontFace(emphasis="B", color=NAVY),
        "strong": FontFace(emphasis="B", color=NAVY),
    }

    pdf.write_html(
        f"<font face='Helvetica' size='11'>{body}</font>",
        tag_styles=tag_styles,
        table_line_separators=True,
    )
    pdf.output(DEST)
    print(f"Wrote {DEST} ({DEST.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

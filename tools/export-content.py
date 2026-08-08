#!/usr/bin/env python3
"""Export all site copy to a single Markdown file usable as a content source
of truth for rebuilding the UI. Content only: no CSS, no JS."""
import re
import html as htmlmod
from html.parser import HTMLParser

VOID = {"img", "br", "hr", "meta", "link", "input", "source", "path", "circle",
        "rect", "line", "polygon", "polyline", "use", "stop", "col"}
SKIP = {"script", "style", "noscript"}
INLINE = {"a", "strong", "b", "em", "i", "span", "code", "small", "sup", "sub", "u"}


class Node:
    __slots__ = ("tag", "attrs", "children", "text", "parent")

    def __init__(self, tag, attrs=None, text=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children = []
        self.text = text
        self.parent = parent

    def cls(self):
        return self.attrs.get("class", "")

    def has(self, c):
        return c in self.cls().split()

    def find_all(self, tag=None, cls=None):
        out = []
        for ch in self.children:
            if ch.tag != "#text":
                if (tag is None or ch.tag == tag) and (cls is None or ch.has(cls)):
                    out.append(ch)
                out.extend(ch.find_all(tag, cls))
        return out

    def first(self, tag=None, cls=None):
        r = self.find_all(tag, cls)
        return r[0] if r else None


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, dict(attrs), parent=self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, dict(attrs), parent=self.cur))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if self.cur.tag in SKIP:
            return
        self.cur.children.append(Node("#text", text=data, parent=self.cur))


def parse(path):
    t = Tree()
    t.feed(open(path, encoding="utf-8").read())
    return t.root


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def esc(s):
    return s.replace("|", "\\|")


# ---------------------------------------------------------------- inline text
def inline(node):
    """Render a node's subtree as a single inline string with md emphasis."""
    if node is None:
        return ""
    if node.tag == "#text":
        return node.text or ""
    if node.tag in SKIP or node.tag == "svg":
        return ""
    if node.tag == "br":
        return " "
    if node.tag == "img":
        return ""
    parts = "".join(inline(c) for c in node.children)
    if node.tag == "a":
        href = node.attrs.get("href", "")
        txt = norm(parts)
        if not txt:
            return ""
        return f"[{txt}]({href})" if href else txt
    if node.tag in ("strong", "b"):
        txt = norm(parts)
        return f"**{txt}**" if txt else ""
    if node.tag in ("em",):
        txt = norm(parts)
        return f"*{txt}*" if txt else ""
    return parts


def itext(node):
    if node is None:
        return ""
    return norm(inline(node))


def ptext(node):
    """Plain text of a subtree, no markdown emphasis."""
    if node is None:
        return ""
    if node.tag == "#text":
        return node.text or ""
    if node.tag in SKIP or node.tag == "svg":
        return ""
    return norm("".join(ptext(c) for c in node.children))


# ------------------------------------------------------------ block rendering
def blocks(node, out, depth=0):
    """Walk children emitting markdown blocks into out (list of str)."""
    for ch in node.children:
        render_block(ch, out, depth)


def render_block(n, out, depth=0):
    if n.tag == "#text":
        t = norm(n.text or "")
        if t:
            out.append(t)
        return
    if n.tag in SKIP:
        return
    if n.tag == "svg":
        # Wrapped labels are drawn as separate <text> elements sharing an x with
        # y stepping one line height. Regroup them into whole labels.
        items = []

        def walk(x):
            if x.tag == "text":
                t = norm("".join(ptext(c) for c in x.children))
                if t:
                    try:
                        px = float(x.attrs.get("x", "0"))
                        py = float(x.attrs.get("y", "0"))
                    except ValueError:
                        px = py = 0.0
                    items.append((px, py, t))
                return
            for c in x.children:
                walk(c)

        walk(n)
        labels, cur = [], None
        for px, py, t in items:
            if cur and abs(px - cur[0]) < 1 and 0 < py - cur[1] <= 32:
                cur = (px, py, cur[2] + " " + t)
            else:
                if cur:
                    labels.append(cur[2])
                cur = (px, py, t)
        if cur:
            labels.append(cur[2])
        if labels:
            out.append("_Flow diagram (hand-authored SVG). Labels in document order:_")
            out.append("\n".join(f"{i+1}. {l}" for i, l in enumerate(labels)))
        return

    if n.tag == "img":
        src = n.attrs.get("src", "")
        alt = n.attrs.get("alt", "")
        if src:
            out.append(f"![{alt}]({src})")
        return

    # --- component special cases (class-driven) ---------------------------
    if n.has("chips") or n.has("chip-row"):
        chips = [itext(c) for c in n.children if c.tag != "#text"]
        chips = [c for c in chips if c]
        if chips:
            out.append("**Tags:** " + ", ".join(chips))
        return

    if n.has("summary-grid"):
        rows = []
        for card in n.find_all(cls="summary-card"):
            label = itext(card.first("strong"))
            val = itext(card.first("span"))
            if label or val:
                rows.append((label, val))
        if rows:
            out.append("| Field | Value |\n| --- | --- |\n" +
                       "\n".join(f"| {esc(a)} | {esc(b)} |" for a, b in rows))
        return

    if n.has("stat-stack"):
        rows = []
        for r in n.find_all(cls="stat-row"):
            v = itext(r.first(cls="stat-value"))
            c = itext(r.first(cls="stat-copy"))
            rows.append((v, c))
        if rows:
            out.append("| Stat | Description |\n| --- | --- |\n" +
                       "\n".join(f"| {esc(a)} | {esc(b)} |" for a, b in rows))
        return

    if n.has("work-card-grid") or n.has("articles-grid"):
        for card in n.children:
            if card.tag != "a":
                continue
            href = card.attrs.get("href", "")
            idx = ptext(card.first(cls="work-card-index"))
            title = ptext(card.first("h3"))
            lines = [f"**{title}**", f"Link: `{href}`"]
            for p in card.find_all("p"):
                t = itext(p)
                if t and t != title:
                    lines.append(t)
            prefix = f"{idx}. " if idx else "- "
            out.append(prefix + ("\n" + " " * len(prefix)).join(lines))
        return

    if n.has("simple-list"):
        items = [itext(c) for c in n.children if c.tag != "#text"]
        items = [i for i in items if i]
        if items:
            out.append("\n".join(f"- {i}" for i in items))
        return

    if n.has("recommendation-card"):
        who = itext(n.first("h3"))
        rel = itext(n.first(cls="recommendation-meta"))
        out.append(f"**{who}**")
        if rel:
            out.append(f"_{rel}_")
        for p in n.find_all("p"):
            if p.has("recommendation-meta"):
                continue
            t = itext(p)
            if t:
                out.append("> " + t.replace("\n", " "))
        return

    if n.has("timeline-company"):
        head = n.first(cls="timeline-company-head")
        name = ptext(head.first("h3")) if head else ""
        dates = ptext(head.first("p")) if head else ""
        logo = head.first("img") if head else None
        out.append("#" * min(6, 3 + depth) + f" {name}")
        bits = []
        if dates:
            bits.append(dates)
        if logo is not None:
            bits.append(f"Logo: `{logo.attrs.get('src','')}`")
        if bits:
            out.append(" · ".join(bits))
        for role in n.find_all(cls="experience-item"):
            title = ptext(role.first("strong"))
            when = ptext(role.first(cls="work-note"))
            body = " ".join(itext(p) for p in role.find_all("p")).strip()
            cur = " (current role)" if role.has("is-current") else ""
            line = f"- **{title}**{cur} · {when}"
            if body:
                line += "\n  " + body
            out.append(line)
        return

    if n.has("insight-card"):
        meta = itext(n.first(cls="insight-meta"))
        body = " ".join(itext(p) for p in n.find_all("p") if not p.has("insight-meta"))
        out.append(f"- {body.strip()}" + (f" _({meta})_" if meta else ""))
        return

    if n.has("quote-card"):
        q = itext(n.first(cls="quote-text"))
        who = itext(n.first(cls="quote-meta"))
        out.append(f"> {q}")
        if who:
            out.append(f"> \n> {who}")
        return

    if n.has("notice-banner"):
        t = " ".join(itext(p) for p in n.find_all("p"))
        out.append(f"> **Note:** {t.strip()}")
        return

    if n.has("meta") and n.parent is not None and n.find_all("span"):
        spans = [itext(s) for s in n.children if s.tag == "span"]
        spans = [s for s in spans if s]
        if spans:
            out.append(" · ".join(spans))
            return

    # --- standard blocks --------------------------------------------------
    if n.tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
        lvl = int(n.tag[1])
        t = itext(n)
        if t:
            out.append("#" * min(6, lvl + depth) + " " + t)
        return

    if n.tag == "p":
        t = itext(n)
        if t:
            out.append(t)
        return

    if n.tag == "blockquote":
        t = itext(n)
        if t:
            out.append("> " + t)
        return

    if n.tag in ("ul", "ol"):
        items = []
        for i, li in enumerate([c for c in n.children if c.tag == "li"], 1):
            sub = []
            # nested lists inside li
            nested = [c for c in li.children if c.tag in ("ul", "ol")]
            t = itext(Node("span", children=[c for c in li.children if c.tag not in ("ul", "ol")])) \
                if False else itext(li)
            bullet = f"{i}." if n.tag == "ol" else "-"
            if t:
                items.append(f"{bullet} {t}")
        if items:
            out.append("\n".join(items))
        return

    if n.tag == "li":
        t = itext(n)
        if t:
            out.append(f"- {t}")
        return

    if n.tag in ("input", "button"):
        ph = n.attrs.get("placeholder") or itext(n)
        if ph:
            out.append(f"_(UI control: {ph})_")
        return

    if n.tag in INLINE:
        t = itext(n)
        if t:
            out.append(t)
        return

    blocks(n, out, depth)


def clean(out):
    res, prev = [], None
    for b in out:
        b = b.strip()
        if not b or b == prev:
            continue
        res.append(b)
        prev = b
    return res


# ============================================================== driver
def meta_of(root):
    d = {}
    for m in root.find_all("meta"):
        k = m.attrs.get("name") or m.attrs.get("property")
        if k:
            d[k] = m.attrs.get("content", "")
    t = root.first("title")
    d["title"] = itext(t) if t else ""
    ln = [l for l in root.find_all("link") if l.attrs.get("rel") == "canonical"]
    d["canonical"] = ln[0].attrs.get("href", "") if ln else ""
    return d


def meta_block(d):
    rows = [("Title", d.get("title", "")),
            ("Description", d.get("description", "")),
            ("Canonical URL", d.get("canonical", "")),
            ("OG image", d.get("og:image", ""))]
    return "| Field | Value |\n| --- | --- |\n" + "\n".join(
        f"| {k} | {esc(v)} |" for k, v in rows if v)


def page_body(path, depth=0):
    root = parse(path)
    body = root.first("body")
    out = []
    blocks(body, out, depth)
    return clean(out)


def render_page(path, heading, depth=1):
    root = parse(path)
    d = meta_of(root)
    parts = [f"## {heading}", f"`{path}`", "", "### Page metadata", meta_block(d), "", "### Content"]
    parts += page_body(path, depth=depth)
    return "\n\n".join(parts)


CASE_STUDIES = [
    ("case-study-research-bot.html", "Case study 01: AI Research Agent (BotDojo)"),
    ("case-study-ai-search.html", "Case study 02: AI Enterprise Risk Search"),
    ("case-study-billing.html", "Case study 03: Law Firm Billing Acceleration"),
    ("case-study-document-summarization.html", "Case study 04: Policy Document Summaries"),
    ("case-study-building-design-team.html", "Case study 05: Building a 0 to 1 Design Practice"),
]
ARTICLES = [
    ("article-resume-first-design.html", "Your Resume Is Your First Design Deliverable"),
    ("article-ai-tools-in-workflow.html", "Not Every AI Tool Deserves a Place in Your Workflow"),
    ("article-invisible-design.html", "Does Good Design Even Need to Be Seen?"),
    ("article-kiss-minimalism.html", "KISS and Minimalism"),
    ("article-designing-within-limits.html", "Designing Within Limits"),
    ("article-design-beyond-validation.html", "Design Beyond Validation"),
    ("article-perfectionism-to-progress.html", "From Perfectionism to Progress"),
    ("article-art-of-saying-no.html", "The Art of Saying No"),
]

doc = []
doc.append("""# Sujith Anand: complete site content

Everything written on **sujithanand.com**, extracted from the HTML so the site can be
rebuilt with a different UI. This is content only: no CSS, no JavaScript, no layout.

**How to read this file**
- Each page has its metadata (title, description, canonical URL) followed by its copy.
- Tables carry structured component data (stat cards, summary cards) so you can map them
  to whatever components the new UI uses.
- `backticked` paths are links and assets referenced by that page.
- House style: no em dashes anywhere in the copy. Middle dots (`·`) separate metadata
  such as dates and bylines.

## Contents
1. [Site-wide facts](#site-wide-facts)
2. [Homepage](#homepage)
3. [Case studies](#case-studies)
4. [Interactive demo data](#interactive-demo-data-ai-enterprise-risk-search)
5. [Articles](#articles)
6. [Assets](#assets)
""")

# ---- site-wide
root = parse("index.html")
d = meta_of(root)
ld = re.search(r'<script type="application/ld\+json">(.*?)</script>',
               open("index.html", encoding="utf-8").read(), re.S)
doc.append("""---

## Site-wide facts

These are the positioning claims the whole site rests on. Keep them consistent
wherever they appear in a rebuild.

| Fact | Value |
| --- | --- |
| Name | Sujith Anand |
| Functional role | Head of Design, GRC |
| Formal title | Design Manager |
| Employer | Mitratech |
| Business unit revenue | ~$100M ARR |
| Products supported | 13 enterprise GRC products |
| Team | 5 designers (grown from 1) |
| Design system | Owned by Sujith |
| Forward-deployed engineer role | Built by Sujith |
| Experience | 9+ years |
| Location | Hyderabad, India |
| Email | sujithanand96@gmail.com |
| LinkedIn | https://www.linkedin.com/in/sujithanand/ |
| Availability | Open to Head of Design roles |
| Design cycle time | Two weeks to four days (60% reduction) |
| Research cycle time | Three weeks to 1.5 weeks (50% reduction) |
| Billing cycle (case study) | 20 days to 5 days |

**Open item:** the 60% and 50% figures have no measurement note yet. A `TODO` marker sits
in `case-study-building-design-team.html` asking for the baseline, sample size, and
timeframe. Add that before treating these as load-bearing claims.

### Structured data (JSON-LD, Person)

```json
""" + (ld.group(1).strip() if ld else "{}") + "\n```\n")

# ---- homepage
doc.append("---\n\n## Homepage\n\n`index.html`\n\n### Page metadata\n\n" + meta_block(d))

nav = root.first("nav")
if nav:
    items = [f"- {ptext(a)} -> `" + a.attrs.get("href", "") + "`" for a in nav.find_all("a")]
    doc.append("### Navigation\n\n" + "\n".join(items))

body = root.first("body")
out = []
for sec in [c for c in body.find_all("section")] + [body.first("footer")]:
    if sec is None:
        continue
    sid = sec.attrs.get("id") or sec.attrs.get("aria-label") or sec.attrs.get("aria-labelledby") or ""
    o = []
    blocks(sec, o, depth=2)
    o = clean(o)
    if o:
        out.append(f"### Section: {sid}" if sid else "### Section")
        out.extend(o)
doc.append("\n\n".join(out))

# ---- case studies
doc.append("---\n\n# Case studies\n")
for p, h in CASE_STUDIES:
    doc.append("---\n\n" + render_page(p, h, depth=1))

# ---- demo data that lives in JS but appears on screen
import json as _json
js = open("js/search-demo.js", encoding="utf-8").read()
arr = re.search(r"const results = (\[.*?\n  \];)", js, re.S)
rows = []
if arr:
    raw = arr.group(1).rstrip(";")
    raw = re.sub(r"^(\s*)(\w+):", r'\1"\2":', raw, flags=re.M)
    try:
        for r in _json.loads(raw):
            rows.append((r["title"], r["description"], ", ".join(r["tags"]),
                         ", ".join(r["categories"]), r["owner"]))
    except Exception:
        pass
if rows:
    doc.append("---\n\n## Interactive demo data (AI Enterprise Risk Search)\n\n"
               "The search demo on `case-study-ai-search.html` renders these sample records "
               "from `js/search-demo.js`. They are on-screen content, so they belong here.\n\n"
               "Filter tabs: All, Risks, Controls, Questionnaires, Policies, Tasks, Mitigation.  \n"
               "Recent search chips: vendor risk, fire incident, questionnaire.  \n"
               "Search placeholder: \"Search risks, controls, policies, questionnaires...\"  \n"
               "Empty state: \"No results yet. Refine your search.\"\n\n"
               "| Title | Description | Tags | Categories | Owner |\n| --- | --- | --- | --- | --- |\n" +
               "\n".join("| " + " | ".join(esc(c) for c in r) + " |" for r in rows))

# ---- articles
doc.append("---\n\n# Articles\n\nListed newest first, matching the site order.\n")
for p, h in ARTICLES:
    doc.append("---\n\n" + render_page(p, h, depth=1))

# ---- assets
import glob
imgs = {}
for p in ["index.html"] + [x for x, _ in CASE_STUDIES] + [x for x, _ in ARTICLES] + ["404.html"]:
    r = parse(p)
    for im in r.find_all("img"):
        src = im.attrs.get("src", "")
        if src:
            imgs.setdefault(src, set()).add(p)
rows = "\n".join(f"| `{s}` | {', '.join(sorted(u))} |" for s, u in sorted(imgs.items()))
doc.append("---\n\n## Assets\n\nImages referenced by the pages above.\n\n"
           "| File | Used on |\n| --- | --- |\n" + rows +
           "\n\nAlso in the repo but not referenced by any page: the personal photo set "
           "`img/Photo (1..13).jpg` (from the retired photo gallery) and `img/logo.png`.\n")

open("SITE-CONTENT.md", "w", encoding="utf-8").write("\n\n".join(doc).rstrip() + "\n")
print("wrote SITE-CONTENT.md")

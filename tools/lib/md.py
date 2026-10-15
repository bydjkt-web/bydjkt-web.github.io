"""Renderer markdown mini (subset sama dengan src/admin/md.js) + shortcode."""
import html
import re

esc = lambda s: html.escape(s, quote=True)


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def strip_md(s):
    s = re.sub(r"!\[([^\]]*)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[*`]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def inline(s):
    s = esc(s)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", s)

    def link(m):
        url = m.group(2)
        rel = ' rel="noopener"' if url.startswith("http") else ""
        return f'<a href="{url}"{rel}>{m.group(1)}</a>'

    return re.sub(r"\[([^\]]+)\]\((/[^)\s]*|https?://[^)\s]+)\)", link, s)


def _cells(line):
    return [c.strip() for c in line.strip().strip("|").split("|")]


IMG_RE = re.compile(r'^!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)$')
SHORT_RE = re.compile(r"^\{\{\s*(\w+)\s*(.*?)\s*\}\}$")
SEP_RE = re.compile(r"^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$")


def render(text, shortcode=None, img=None):
    """-> (html, heads[(text,id)], faqs[(q,a_md)]). Bagian '## FAQ' dipisah."""
    main, _, faq_raw = text.partition("\n## FAQ")
    heads, out, para, lst, quote = [], [], [], None, []
    used = {}
    lines = main.split("\n")

    def flush():
        nonlocal para, lst, quote
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para = []
        if lst:
            tag, items = lst
            out.append(f"<{tag}>" + "".join(f"<li>{inline(i)}</li>" for i in items) + f"</{tag}>")
            lst = None
        if quote:
            out.append("<blockquote><p>" + inline(" ".join(quote)) + "</p></blockquote>")
            quote = []

    i = 0
    while i < len(lines):
        s = lines[i].rstrip()
        i += 1
        if not s.strip():
            flush(); continue
        m = re.match(r"^(#{2,3})\s+(.*)", s)
        if m:
            flush()
            lvl, t = len(m.group(1)), m.group(2).strip()
            hid = slugify(t) or "bagian"
            used[hid] = used.get(hid, 0) + 1
            if used[hid] > 1:
                hid += f"-{used[hid]}"
            if lvl == 2:
                heads.append((strip_md(t), hid))
            out.append(f'<h{lvl} id="{hid}">{inline(t)}</h{lvl}>')
            continue
        m = SHORT_RE.match(s)
        if m:
            flush()
            out.append(shortcode(m.group(1), m.group(2)) if shortcode else "")
            continue
        m = IMG_RE.match(s)
        if m:
            flush()
            alt, src, cap = m.group(1), m.group(2), m.group(3)
            tag = img(src, alt) if img else f'<img src="{esc(src)}" alt="{esc(alt)}">'
            out.append(f'<figure class="fig">{tag}' + (f"<figcaption>{esc(cap)}</figcaption>" if cap else "") + "</figure>")
            continue
        if s.startswith("|") and i < len(lines) and SEP_RE.match(lines[i].strip()):
            flush()
            head = _cells(s)
            i += 1
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(_cells(lines[i])); i += 1
            th = "".join(f"<th>{inline(c)}</th>" for c in head)
            tb = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in rows)
            out.append(f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>')
            continue
        m = re.match(r"^>\s?(.*)", s)
        if m:
            if para or lst:
                flush()
            quote.append(m.group(1)); continue
        m = re.match(r"^[-*]\s+(.*)", s)
        if m:
            if para or quote:
                flush()
            if not lst or lst[0] != "ul":
                flush(); lst = ("ul", [])
            lst[1].append(m.group(1)); continue
        m = re.match(r"^\d+\.\s+(.*)", s)
        if m:
            if para or quote:
                flush()
            if not lst or lst[0] != "ol":
                flush(); lst = ("ol", [])
            lst[1].append(m.group(1)); continue
        if lst or quote:
            flush()
        para.append(s.strip())
    flush()
    faqs = []
    if faq_raw.strip():
        heads.append(("FAQ", "faq"))
        for blk in re.split(r"\n### ", "\n" + faq_raw.strip()):
            blk = blk.strip()
            if blk:
                q, _, a = blk.partition("\n")
                faqs.append((q.strip(), " ".join(a.split())))
    return "\n".join(out), heads, faqs

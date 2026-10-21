#!/usr/bin/env python3
"""
Pemeriksa SEO on-page untuk hasil build (docs/).
  python3 tools/seo_check.py            -> laporan semua halaman
Exit code 1 jika ada FAIL.

Cek per halaman : title 30-60 karakter, meta description 70-160, 1 H1, canonical,
                  og:title/og:description/og:image, lang, viewport, robots, JSON-LD valid,
                  gambar ber-alt, heading tidak melompat, link internal >= 3, title/description unik.
Cek tambahan artikel (/blog/<slug>/): keyword ada di title, H1, 100 kata pertama, meta description,
                  slug; kepadatan keyword 0.4-2.5%; >= 800 kata; >= 3 H2; >= 2 link internal ke halaman model/harga.
"""
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
SRC_ART = ROOT / "content/articles"


class P(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""; self.in_title = False
        self.meta = {}; self.canon = ""; self.lang = ""
        self.h = []; self._h = None
        self.imgs = []; self.links = []; self.ld = []; self._ld = False
        self.text = []; self.skip = 0; self.in_main = False
        self.main_text = []

    def handle_starttag(self, tag, a):
        a = dict(a)
        if tag == "html": self.lang = a.get("lang", "")
        elif tag == "title": self.in_title = True
        elif tag == "meta":
            k = a.get("name") or a.get("property")
            if k: self.meta[k] = a.get("content", "")
        elif tag == "link" and a.get("rel") == "canonical": self.canon = a.get("href", "")
        elif tag in ("h1", "h2", "h3", "h4"): self._h = [tag, ""]
        elif tag == "img": self.imgs.append(a)
        elif tag == "a" and a.get("href"): self.links.append(a["href"])
        elif tag == "script":
            if a.get("type") == "application/ld+json": self._ld = True; self.ld.append("")
            self.skip += 1
        elif tag == "style": self.skip += 1
        elif tag == "main": self.in_main = True

    def handle_endtag(self, tag):
        if tag == "title": self.in_title = False
        elif tag in ("h1", "h2", "h3", "h4") and self._h: self.h.append(tuple(self._h)); self._h = None
        elif tag == "script": self._ld = False; self.skip -= 1
        elif tag == "style": self.skip -= 1
        elif tag == "main": self.in_main = False

    def handle_data(self, d):
        if self.in_title: self.title += d
        if self._h is not None: self._h[1] += d
        if self._ld and self.ld: self.ld[-1] += d
        if not self.skip:
            self.text.append(d)
            if self.in_main: self.main_text.append(d)


def words(t):
    return re.findall(r"[\w'’-]+", t.lower())


def check_page(f, seen):
    rel = "/" + str(f.relative_to(DOCS)).replace("index.html", "").replace("\\", "/")
    res = []
    p = P(); p.feed(f.read_text(encoding="utf-8"))
    ok = lambda c, lvl, msg: res.append(("PASS" if c else lvl, msg))
    noindex = "noindex" in p.meta.get("robots", "")
    t, d = p.title.strip(), p.meta.get("description", "")
    ok(p.lang == "id", "FAIL", "atribut lang=\"id\"")
    ok("width=device-width" in p.meta.get("viewport", ""), "FAIL", "meta viewport")
    if noindex:
        return rel, res, p, True
    ok(30 <= len(t) <= 60, "WARN", f"panjang title {len(t)} (ideal 30-60)")
    ok(70 <= len(d) <= 160, "WARN", f"panjang meta description {len(d)} (ideal 70-160)")
    h1 = [h for h in p.h if h[0] == "h1"]
    ok(len(h1) == 1, "FAIL", f"jumlah H1 = {len(h1)} (harus 1)")
    ok(bool(p.canon) and p.canon.startswith("http"), "FAIL", "canonical absolut")
    for k in ("og:title", "og:description", "og:image", "twitter:card"):
        ok(bool(p.meta.get(k)), "WARN", f"meta {k}")
    ok("index" in p.meta.get("robots", ""), "FAIL", "robots index")
    ok(all(i.get("alt") is not None and i.get("width") and i.get("height") for i in p.imgs), "WARN", f"gambar punya alt+width+height ({len(p.imgs)} gambar)")
    ok(len(p.ld) > 0, "WARN", "JSON-LD ada")
    for blob in p.ld:
        try: json.loads(blob)
        except Exception as e: ok(False, "FAIL", f"JSON-LD tidak valid: {e}")
    lv = [int(h[0][1]) for h in p.h]
    ok(all(b - a <= 1 for a, b in zip(lv, lv[1:])), "WARN", "urutan heading tidak melompat level")
    internal = [l for l in p.links if l.startswith("/") and not l.startswith("//")]
    ok(len(set(internal)) >= 3, "WARN", f"link internal unik {len(set(internal))} (>=3)")
    ok(t not in seen["t"], "FAIL", "title unik"); seen["t"].add(t)
    ok(d not in seen["d"], "FAIL", "meta description unik"); seen["d"].add(d)
    # artikel
    m = re.match(r"^/blog/([^/]+)/$", rel)
    if m:
        src = SRC_ART / f"{m.group(1)}.md"
        kw = ""
        if src.exists():
            mm = re.search(r"^keyword:\s*(.+)$", src.read_text(encoding="utf-8"), re.M)
            kw = mm.group(1).strip().lower() if mm else ""
        main = " ".join(p.main_text)
        W = words(main)
        ok(bool(kw), "FAIL", "front matter 'keyword' terisi")
        if kw:
            ok(kw in t.lower(), "FAIL", "keyword di title")
            ok(kw in h1[0][1].lower() if h1 else False, "FAIL", "keyword di H1")
            ok(kw in d.lower(), "WARN", "keyword di meta description")
            ok(kw.replace(" ", "-") in rel, "WARN", "keyword di slug")
            first = " ".join(W[:100])
            ok(kw in first, "FAIL", "keyword di 100 kata pertama")
            n = len(re.findall(re.escape(kw), " ".join(W)))
            dens = n * len(kw.split()) / max(1, len(W)) * 100
            ok(0.4 <= dens <= 2.5, "WARN", f"kepadatan keyword {dens:.2f}% ({n}x; ideal 0.4-2.5%)")
        nb = len(words(re.sub(r"\{\{[^}]*\}\}", " ", re.sub(r"[#*`>|]", " ", src.read_text(encoding="utf-8").split("\n---\n", 1)[-1].split("\n## FAQ")[0])))) if src.exists() else len(W)
        ok(nb >= 800, "WARN", f"jumlah kata isi artikel {nb} (>=800; tabel/CTA/menu tidak dihitung)")
        ok(len([h for h in p.h if h[0] == "h2"]) >= 3, "WARN", "minimal 3 subjudul H2")
        ok(len([l for l in internal if l.startswith("/byd-") or l == "/harga-byd/"]) >= 2, "WARN", "minimal 2 link internal ke model/harga")
        ok(any('"BlogPosting"' in b for b in p.ld), "WARN", "schema BlogPosting")
        # AEO/GEO
        raw = f.read_text(encoding="utf-8")
        art = raw.split("<article", 1)[-1].split("</article>", 1)[0]
        ok('class="ans"' in raw, "WARN", "AEO: kotak 'Jawaban singkat' di awal artikel (isi kolom Jawaban singkat)")
        qh = [h for h in p.h if h[0] in ("h2", "h3") and re.search(r"^(apa|apakah|berapa|bagaimana|kenapa|mengapa|siapa|kapan|mana|dimana|di mana)\b|\?\s*$", h[1].strip().lower())]
        ok(len(qh) >= 2, "WARN", f"AEO: minimal 2 subjudul berbentuk pertanyaan ({len(qh)})")
        ok(any(t in art for t in ("<ul", "<ol", "<table")), "WARN", "AEO: ada daftar atau tabel (mudah dikutip AI)")
        ok(any('"speakable"' in b for b in p.ld), "WARN", "AEO: schema speakable")
    return rel, res, p, False


def main():
    files = sorted(f for f in DOCS.rglob("*.html") if "admin" not in f.relative_to(DOCS).parts[:1])
    if not files:
        print("docs/ kosong. Jalankan tools/build.py dulu."); return 1
    seen = {"t": set(), "d": set()}
    fails = warns = 0
    pages = set()
    report = []
    noindexed = set()
    for f in files:
        rel, res, p, noidx = check_page(f, seen)
        if noidx:
            noindexed.add(f)
        pages.add(rel)
        bad = [(l, m) for l, m in res if l != "PASS"]
        fails += sum(1 for l, _ in bad if l == "FAIL"); warns += sum(1 for l, _ in bad if l == "WARN")
        report.append({"path": rel, "passed": len(res) - len(bad), "total": len(res), "issues": [{"level": l, "msg": m} for l, m in bad]})
        print(f"{'OK  ' if not bad else 'CEK '} {rel}  ({len(res) - len(bad)}/{len(res)} lulus)")
        for l, m in bad:
            print(f"      {l}: {m}")
    # link internal rusak
    print()
    for f in files:
        p = P(); p.feed(f.read_text(encoding="utf-8"))
        for l in set(p.links):
            if l.startswith("/") and not l.startswith("//"):
                base = l.split("#")[0].split("?")[0]
                if base and base not in pages and not (DOCS / base.lstrip("/")).exists():
                    print(f"FAIL link rusak di {f.relative_to(DOCS)}: {l}"); fails += 1
    # ---- AEO/GEO tingkat situs (saran, tidak menggagalkan)
    print("AEO/GEO situs:")
    site = []
    rb = (DOCS / "robots.txt").read_text(encoding="utf-8") if (DOCS / "robots.txt").exists() else ""
    site.append(("llms.txt tersedia", (DOCS / "llms.txt").exists()))
    site.append(("robots.txt mengatur crawler AI (GPTBot/PerplexityBot/dll)", "GPTBot" in rb))
    site.append(("halaman Tentang Kami (isi 'Tentang dealer' di Pengaturan Situs)", (DOCS / "tentang-kami/index.html").exists()))
    home = (DOCS / "index.html").read_text(encoding="utf-8") if (DOCS / "index.html").exists() else ""
    site.append(("schema AutoDealer punya sameAs", '"sameAs"' in home))
    site.append(("schema AutoDealer punya telepon/alamat peta (geo atau hasMap)", '"geo"' in home or '"hasMap"' in home))
    mods = [f for f in files if re.match(r"^byd-.*", f.parent.name)]
    site.append((f"jawaban singkat di semua halaman model ({sum(1 for f in mods if 'class=\"ans\"' in f.read_text(encoding='utf-8'))}/{len(mods)})", all('class="ans"' in f.read_text(encoding="utf-8") for f in mods) if mods else True))
    site.append(("testimoni customer tayang", (DOCS / "testimoni/index.html").exists()))
    site.append(("serah terima customer tayang", (DOCS / "serah-terima/index.html").exists()))
    for label, good in site:
        print(f"  {'OK  ' if good else 'SARAN'} {label}")
    sm = (DOCS / "sitemap.xml").read_text(encoding="utf-8")
    n_sm = sm.count("<loc>")
    indexable = len([f for f in files if f.name != "404.html" and f not in noindexed])  # halaman noindex (mis. sub-halaman yang belum diisi) tidak masuk sitemap
    print(f"Sitemap: {n_sm} URL (halaman indexable: {indexable})" + ("" if n_sm == indexable else "  <- TIDAK SAMA"))
    if n_sm != indexable: fails += 1
    if "--json" in sys.argv:
        out = pathlib.Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps({"fails": fails, "warns": warns, "pages": report}, ensure_ascii=False), encoding="utf-8")
    print(f"\nHasil: {fails} FAIL, {warns} WARN dari {len(files)} halaman")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())

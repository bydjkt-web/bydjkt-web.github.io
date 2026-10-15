#!/usr/bin/env python3
"""
Static site generator BYD Harmony.

  content/*.json, content/articles/*.md, content/pages/*.md, content/img/*   ->   docs/

Semua isi website (teks, model, harga, artikel, urutan section, tema) berasal dari folder content/
dan diedit lewat admin (/admin/). Jalankan lokal:  python3 tools/build.py
Di GitHub, workflow .github/workflows/pages.yml menjalankannya tiap push dan tiap jam (artikel terjadwal).
"""
import datetime
import html
import json
import pathlib
import re
import shutil
import sys
import urllib.parse

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from lib import content, images, md  # noqa: E402

ROOT = content.ROOT
SRC = ROOT / "src"
OUT = ROOT / "docs"
WARN = []
esc = html.escape

# ------------------------------------------------------------------ data
SITE = content.load_json("site.json", {})
LAYOUT = content.load_json("layout.json", {})
PG = content.load_json("pages.json", {})
ALL_MODELS = sorted(content.load_json("models.json", []), key=lambda m: m.get("order", 99))
MODELS = [m for m in ALL_MODELS if m.get("published", True)]
MBY = {m["slug"]: m for m in ALL_MODELS}
COMP = content.load_json("competitors.json", [])
CBY = {c["slug"]: c for c in COMP}
MEDIA = content.load_json("media.json", {})
NOW = content.now()
NAME = SITE["name"]
DOMAIN = SITE["domain"].rstrip("/")
PRICE_DATE = SITE.get("price_date") or NOW.date().isoformat()
PRICE_LABEL = SITE.get("price_date_label", "")
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
RESERVED = {"blog", "admin", "assets", "img", "harga-byd", "test-drive", "feed.xml", "sitemap.xml", "robots.txt", "404.html"}

ARTICLES = content.load_items("articles", "article")
LANDING = content.load_items("pages", "page")
VIS_ART = sorted([a for a in ARTICLES if a["visible"]], key=lambda a: a["dt"], reverse=True)
VIS_LAND = [p for p in LANDING if p["visible"]]
LBY = {p["slug"]: p for p in VIS_LAND}

OUT_PAGES = []  # (path, html, lastmod, indexable)


def fmt(s):
    return (s or "").replace("{name}", NAME).replace("{price_date}", PRICE_LABEL)


def url(path):
    return DOMAIN + path


def tgl(iso):
    y, m, d = map(int, iso[:10].split("-"))
    return f"{d} {BULAN[m - 1]} {y}"


def bulan_th(s):
    try:
        y, m = s.split("-")[:2]
        return f"{BULAN[int(m) - 1]} {y}"
    except (ValueError, IndexError):
        return s


def juta(n):
    if n >= 1_000_000_000:
        return "Rp" + f"{n / 1_000_000_000:.2f}".rstrip("0").rstrip(".").replace(".", ",") + " miliar"
    return "Rp" + f"{n / 1_000_000:g}".replace(".", ",") + " juta"


def wa_url(text="Halo, saya ingin info harga mobil listrik BYD."):
    return f"https://wa.me/{SITE['wa_number']}?text=" + urllib.parse.quote(text)


def td_url(model_name=""):
    return "/test-drive/" + ("?model=" + urllib.parse.quote(model_name) if model_name else "")


def words(t):
    return len(re.findall(r"[\w'’-]+", re.sub(r"<[^>]+>", " ", t)))


# ------------------------------------------------------------------ css / assets
def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};:,>])\s*", r"\1", css)
    return css.replace(";}", "}").strip()


def darken(hexcol, f=0.8):
    h = hexcol.lstrip("#")
    if len(h) != 6 or not re.fullmatch(r"[0-9a-fA-F]{6}", h):
        return "#006455"
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % (int(r * f), int(g * f), int(b * f))


ACC = (SITE.get("theme") or {}).get("accent", "#00806d")
if not re.fullmatch(r"#[0-9a-fA-F]{6}", ACC or ""):
    WARN.append(f"Warna tema tidak valid '{ACC}', memakai default")
    ACC = "#00806d"
CSS = minify_css((SRC / "assets/style.css").read_text(encoding="utf-8")) + f":root{{--acc:{ACC};--acc2:{darken(ACC)}}}"

BOLT = ("<svg viewBox='0 0 32 32' aria-hidden='true'><rect width='32' height='32' rx='8' fill='currentColor'/>"
        "<path d='M18 4 8 18h7l-1 10 10-14h-7z' fill='#fff'/></svg>")
FAVICON = ("data:image/svg+xml," + urllib.parse.quote(
    f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='{ACC}'/>"
    "<path d='M18 4 8 18h7l-1 10 10-14h-7z' fill='#fff'/></svg>"))
WA_ICON = ("<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 "
           "10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 "
           ".9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 "
           "1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z'/></svg>")


# ------------------------------------------------------------------ gambar
def alt_for(src, override=""):
    return override or (MEDIA.get(src) or {}).get("alt", "") or ""


def img_tag(src, alt="", sizes="(max-width:820px) 100vw, 760px", eager=False, cls=""):
    key = images.resolve(src)
    if not key:
        WARN.append(f"Gambar tidak ditemukan: {src}")
        return ""
    i = images.IMG[key]
    base = key[:-5]
    srcset = f' srcset="{base}-640.webp 640w, {key} {i["w"]}w" sizes="{sizes}"' if i["small"] else ""
    load = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    c = f' class="{cls}"' if cls else ""
    return (f'<img src="{key}"{srcset} width="{i["w"]}" height="{i["h"]}" alt="{esc(alt_for(key, alt))}" '
            f'{load} decoding="async"{c}>')


# ------------------------------------------------------------------ entitas perbandingan
def range_text(v):
    rk, std = (v.get("range_km") or "").strip(), (v.get("range_std") or "").strip()
    if not rk:
        return ""
    m = re.match(r"^(\d+)\s*(\((.*)\))?$", rk)
    if not m:
        return rk
    n, extra = m.group(1), m.group(3)
    if extra:
        return f"hingga {n} km ({extra}{', ' + std if std else ''})"
    return f"hingga {n} km ({std})" if std else f"hingga {n} km"


def find_variant(model, vname):
    key = (vname or "").replace("_", " ").strip().lower()
    for v in model.get("variants", []):
        if v["name"].lower() == key:
            return v
    return (model.get("variants") or [None])[0]


def model_entity(model, vname=None):
    v = find_variant(model, vname or model.get("compare_variant"))
    if not v:
        return None
    return {"name": f'{model["name"]} {v["name"]}'.strip(), "url": f'/{model["slug"]}/', "price": v["price"],
            "basis": "OTR Jakarta (price list dealer)", "battery": v.get("battery", ""), "range": range_text(v),
            "power": v.get("power", ""), "body": model.get("type", ""), "byd": True, "note": v.get("note", ""),
            "source": "", "as_of": ""}


def comp_entity(c):
    return {"name": c["name"], "url": None, "price": c["price"], "basis": c.get("price_basis", ""),
            "battery": c.get("battery", ""), "range": c.get("range", ""), "power": c.get("power", ""),
            "body": c.get("body", ""), "byd": False, "note": c.get("note", ""), "source": c.get("source", ""),
            "as_of": c.get("as_of", ""), "partial": c.get("partial", False)}


def entity(ref):
    if ":" in ref:
        slug, v = ref.split(":", 1)
        m = MBY.get(slug)
        return model_entity(m, v) if m else None
    if ref in CBY:
        return comp_entity(CBY[ref])
    if ref in MBY:
        return model_entity(MBY[ref])
    return None


def dash(s):
    return esc(s) if s else "—"


def compare_table(ents, caption=""):
    rows = ""
    for e in ents:
        name = f'<a href="{e["url"]}">{esc(e["name"])}</a>' if e["url"] else esc(e["name"])
        rows += (f'<tr{" class=me" if e["byd"] else ""}><th scope="row">{name}</th><td>{juta(e["price"])}</td>'
                 f'<td>{dash(e["battery"])}</td><td>{dash(e["range"])}</td><td>{dash(e["power"])}</td><td>{dash(e["body"])}</td></tr>')
    src = ""
    for e in ents:
        if e["byd"]:
            continue
        bits = [f'<strong>{esc(e["name"])}</strong>: harga {esc(e["basis"])}']
        if e["as_of"]:
            bits.append(f'per {bulan_th(e["as_of"])}')
        if e["source"]:
            bits.append(f'<a href="{esc(e["source"])}" rel="noopener">sumber</a>')
        if e["note"]:
            bits.append(esc(e["note"]))
        src += "<li>" + "; ".join(bits) + "</li>"
    byd_notes = "".join(f'<li><strong>{esc(e["name"])}</strong>: {esc(e["note"])}</li>' for e in ents if e["byd"] and e["note"])
    det = (f'<details class="src"><summary>Sumber data dan catatan</summary><ul>{src}{byd_notes}'
           "<li>Angka jarak tempuh memakai standar berbeda (NEDC, WLTP, atau klaim pabrikan) sehingga tidak bisa dibandingkan langsung. "
           "Harga dan spesifikasi dapat berubah; konfirmasi ke dealer masing-masing.</li></ul></details>") if (src or byd_notes) else ""
    return (f'<div class="tw"><table class="cmp"><thead><tr><th>Mobil</th><th>Harga</th><th>Baterai</th><th>Jarak tempuh</th>'
            f'<th>Daya</th><th>Tipe</th></tr></thead><tbody>{rows}</tbody></table></div>{det}')


def pricelist_table(opts):
    lo = float(opts.get("min", 0)) * 1_000_000
    hi = float(opts.get("max", 1e9)) * 1_000_000
    ents = []
    for m in MODELS:
        vs = m.get("variants", [])
        if vs:
            cheapest = min(vs, key=lambda v: v["price"])
            e = model_entity(m, cheapest["name"])
            e["name"] = f'{m["name"]} (mulai, varian {cheapest["name"]})'
            ents.append(e)
    ents += [comp_entity(c) for c in COMP]
    ents = sorted([e for e in ents if lo <= e["price"] <= hi], key=lambda e: e["price"])
    rows = ""
    for e in ents:
        name = f'<a href="{e["url"]}">{esc(e["name"])}</a>' if e["url"] else esc(e["name"])
        rows += (f'<tr{" class=me" if e["byd"] else ""}><th scope="row">{name}</th><td>{juta(e["price"])}</td>'
                 f'<td>{dash(e["body"])}</td><td>{dash(e["battery"])}</td><td>{dash(e["range"])}</td></tr>')
    notes = "".join(
        f'<li><strong>{esc(e["name"])}</strong>: {esc(e["basis"])}, per {bulan_th(e["as_of"])}'
        + (f', <a href="{esc(e["source"])}" rel="noopener">sumber</a>' if e["source"] else "")
        + "</li>" for e in ents if not e["byd"])
    return (f'<div class="tw"><table class="cmp"><thead><tr><th>Mobil</th><th>Harga</th><th>Tipe</th><th>Baterai</th><th>Jarak tempuh</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></div><details class="src"><summary>Sumber data dan catatan</summary><ul>{notes}'
            "<li>Baris BYD memakai price list dealer (OTR Jakarta). Baris lain dikumpulkan dari media otomotif dan harga bisa berbeda basisnya "
            "(OTR Jakarta, OTR Jabodetabek, atau harga katalog). Jarak tempuh memakai standar berbeda. Konfirmasi ke dealer masing-masing.</li></ul></details>")


def cta_box(model_name="", title=None, text=None):
    t = title or ("Ingin Mencoba " + model_name + "?" if model_name else "Ingin Mencoba Mobil Listrik BYD?")
    p = text or f"Konsultasi gratis, simulasi cicilan, dan booking test drive di {NAME}."
    return (f'<div class="cta-box"><h2 style="color:#fff;margin-top:0">{esc(t)}</h2><p>{esc(p)}</p>'
            f'<a class="btn w" href="{td_url(model_name)}">Booking Test Drive</a> '
            f'<a class="btn o" href="{wa_url("Halo, saya ingin info " + (model_name or "mobil listrik BYD"))}" data-wa="cta" rel="noopener">Chat WhatsApp</a></div>')


def model_card_mini(m):
    pr = f'Mulai {juta(min(v["price"] for v in m["variants"]))}' if m.get("variants") else "Hubungi sales"
    return (f'<a class="mini" href="/{m["slug"]}/"><strong>{esc(m["name"])}</strong><span>{esc(m["type"])}</span>'
            f'<span class="pr">{pr}</span></a>')


def shortcode(name, args):
    parts = args.split()
    kv = dict(p.split("=", 1) for p in parts if "=" in p)
    refs = [p for p in parts if "=" not in p]
    if name == "compare":
        ents = [entity(r) for r in refs]
        bad = [r for r, e in zip(refs, ents) if not e]
        if bad:
            WARN.append(f"Shortcode compare: referensi tidak dikenal {bad}")
        return compare_table([e for e in ents if e])
    if name == "pricelist":
        return pricelist_table(kv)
    if name == "cta":
        m = MBY.get(kv.get("model", ""))
        return cta_box(m["name"] if m else "")
    if name == "modelcard":
        ms = [MBY[r] for r in refs if r in MBY and MBY[r].get("published", True)]
        return '<div class="minis">' + "".join(model_card_mini(m) for m in ms) + "</div>"
    WARN.append(f"Shortcode tidak dikenal: {name}")
    return ""


def render_md(text):
    return md.render(text, shortcode=shortcode, img=lambda s, a: img_tag(s, a))


# ------------------------------------------------------------------ pecahan HTML umum
def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def breadcrumb_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": url(p)} for i, (n, p) in enumerate(items)]}


def faq_ld(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": md.strip_md(q),
                            "acceptedAnswer": {"@type": "Answer", "text": md.strip_md(a)}} for q, a in faqs]}


def socials():
    s = []
    if SITE.get("instagram"):
        s.append(("Instagram", "https://instagram.com/" + SITE["instagram"].lstrip("@")))
    if SITE.get("tiktok"):
        s.append(("TikTok", "https://www.tiktok.com/@" + SITE["tiktok"].lstrip("@")))
    for k, label in (("facebook", "Facebook"), ("youtube", "YouTube")):
        if SITE.get(k):
            s.append((label, SITE[k]))
    return s


def dealer_ld():
    d = {"@context": "https://schema.org", "@type": "AutoDealer", "@id": url("/#dealer"), "name": NAME, "url": url("/"),
         "image": url("/assets/og-default.png"),
         "description": "Dealer mobil listrik BYD: konsultasi, simulasi kredit, dan booking test drive.",
         "brand": {"@type": "Brand", "name": "BYD"}, "areaServed": "ID",
         "address": {"@type": "PostalAddress", "streetAddress": SITE["address"], "addressLocality": SITE["city"],
                     "addressRegion": SITE["region"], "postalCode": SITE["postal"], "addressCountry": "ID"},
         "openingHours": SITE.get("hours_schema", "Mo-Sa 09:00-18:00")}
    if SITE["wa_number"] != "6281234567890":
        d["telephone"] = "+" + SITE["wa_number"]
    sa = [u for _, u in socials()]
    if sa:
        d["sameAs"] = sa
    return d


def head(title, desc, path, og_type="website", schema=None, robots="index,follow", og_image=None, extra=""):
    canon = url(path)
    gsc = f'<meta name="google-site-verification" content="{esc(SITE["gsc_verification"])}">' if SITE.get("gsc_verification") else ""
    ga = ""
    if SITE.get("ga4_id"):
        gid = esc(SITE["ga4_id"])
        ga = ("<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());"
              f"gtag('config','{gid}');addEventListener('load',function(){{var s=document.createElement('script');s.async=1;"
              f"s.src='https://www.googletagmanager.com/gtag/js?id={gid}';document.head.appendChild(s)}})</script>")
    cfg = {"name": NAME, "wa": SITE["wa_number"], "firebase": SITE["firebase"]}
    ogi = url(og_image or "/assets/og-default.png")
    wh = '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
    return (f'<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(title)}</title><meta name="description" content="{esc(desc)}"><link rel="canonical" href="{canon}">'
            f'<meta name="robots" content="{robots},max-image-preview:large"><meta name="theme-color" content="{ACC}">'
            f'<link rel="icon" href="{FAVICON}"><link rel="alternate" type="application/rss+xml" title="{esc(NAME)}" href="/feed.xml">'
            f'<meta property="og:type" content="{og_type}"><meta property="og:site_name" content="{esc(NAME)}">'
            f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
            f'<meta property="og:url" content="{canon}"><meta property="og:locale" content="id_ID"><meta property="og:image" content="{ogi}">{wh}'
            f'<meta name="twitter:card" content="summary_large_image">{extra}{gsc}<style>{CSS}</style>'
            f'{"".join(ld(s) for s in (schema or []))}{ga}<script>window.SITE_CONFIG={json.dumps(cfg)}</script></head>')


def header():
    promo = ""
    pr = SITE.get("promo") or {}
    if pr.get("enabled") and pr.get("text"):
        link = f' <a href="{esc(pr.get("link", "/test-drive/"))}">Selengkapnya</a>' if pr.get("link") else ""
        promo = f'<div class="promo"><div class="wrap">{esc(pr["text"])}{link}</div></div>'
    nav = "".join(f'<a href="{esc(n["href"])}">{esc(n["label"])}</a>' for n in SITE.get("nav", []))
    return (f'<a class="skip" href="#main">Lewati ke konten</a>{promo}<header class="top"><div class="wrap bar">'
            f'<a class="logo" href="/" aria-label="{esc(NAME)} beranda">{BOLT}<span>{esc(NAME)}</span></a>'
            f'<nav class="d" aria-label="Menu utama">{nav}<a class="btn sm" href="/test-drive/">Test Drive</a></nav>'
            f'<details class="m"><summary>Menu</summary><div>{nav}<a href="/test-drive/">Test Drive</a></div></details></div></header>')


def footer():
    mod = "".join(f'<li><a href="/{m["slug"]}/">{esc(m["name"])}</a></li>' for m in MODELS)
    extra = "".join(f'<li><a href="/{p["slug"]}/">{esc(p["h1"])}</a></li>' for p in VIS_LAND if p["in_footer"])
    soc = "".join(f'<li><a href="{esc(u)}" rel="noopener me">{esc(n)}</a></li>' for n, u in socials())
    soc_block = f'<div><h2>Ikuti Kami</h2><ul>{soc}</ul></div>' if soc else ""
    fab = (f'<a class="wafab" href="{wa_url()}" data-wa="floating" rel="noopener" aria-label="Chat WhatsApp">{WA_ICON}<span>Chat WhatsApp</span></a>'
           if SITE.get("show_floating_wa", True) else "")
    return (f'<footer class="ft"><div class="wrap"><div class="fg"><div><h2>{esc(NAME)}</h2><p>{esc(SITE["tagline"])}.<br>{esc(SITE["address"])}<br>'
            f'{esc(SITE["city"])}, {esc(SITE["region"])}<br>{esc(SITE["hours"])}</p>'
            f'<p><a href="{wa_url()}" data-wa="footer" rel="noopener">WhatsApp {esc(SITE["phone_display"])}</a></p></div>'
            f'<div><h2>Model BYD</h2><ul>{mod}</ul></div>'
            f'<div><h2>Informasi</h2><ul><li><a href="/harga-byd/">Harga mobil BYD terbaru</a></li><li><a href="/test-drive/">Booking test drive</a></li>'
            f'<li><a href="/blog/">Blog &amp; perbandingan</a></li>{extra}</ul></div>{soc_block}</div>'
            f'<p class="legal">{esc(SITE.get("footer_note", ""))} © {NOW.year} {esc(SITE.get("legal_name") or NAME)}.</p></div></footer>'
            f'{fab}<script defer src="/assets/app.js"></script></body></html>')


def crumbs(items):
    parts = [esc(n) if i == len(items) - 1 else f'<a href="{p}">{esc(n)}</a>' for i, (n, p) in enumerate(items)]
    return '<nav class="crumb" aria-label="Breadcrumb">' + " › ".join(parts) + "</nav>"


def lead_form(model=""):
    opts = '<option value="">Belum tahu / ingin konsultasi</option>' + "".join(
        f'<option value="{esc(m["name"])}"{" selected" if m["name"] == model else ""}>{esc(m["name"])}</option>' for m in MODELS)
    return ('<form class="lead" novalidate>'
            '<label>Nama<input name="name" autocomplete="name" required maxlength="80" placeholder="Nama Anda"></label>'
            '<label>Nomor WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="0812xxxxxxxx"></label>'
            f'<label>Model yang diminati<select name="model">{opts}</select></label>'
            '<div class="row2"><label>Rencana pembelian<select name="timeline">'
            '<option value="minggu">Dalam 1 minggu</option><option value="bulan">Dalam 1 bulan</option>'
            '<option value="tiga_bulan" selected>1–3 bulan ke depan</option><option value="info">Baru cari informasi</option></select></label>'
            '<label>Pembayaran<select name="payment"><option value="kredit">Kredit</option><option value="cash">Cash</option>'
            '<option value="belum" selected>Belum menentukan</option></select></label></div>'
            '<label class="chk"><input type="checkbox" name="testDrive"> Saya ingin booking test drive</label>'
            '<label class="chk"><input type="checkbox" name="tradeIn"> Saya ingin tukar tambah mobil lama</label>'
            '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
            '<button class="btn" type="submit">Dapatkan Penawaran via WhatsApp</button>'
            '<div class="msg" role="status" aria-live="polite" hidden></div>'
            '<p class="note">Data Anda hanya dipakai untuk menghubungi Anda terkait penawaran mobil.</p></form>')


def lead_section(model="", h2="Konsultasi Gratis &amp; Booking Test Drive", text=None, bullets=None, alt=True):
    text = text or "Isi form singkat, tim kami menghubungi Anda lewat WhatsApp dengan harga OTR terbaru, promo yang berlaku, dan simulasi cicilan."
    bullets = bullets or ["Konsultasi model sesuai kebutuhan dan anggaran", "Simulasi uang muka, tenor, dan cicilan",
                          "Jadwal test drive sesuai ketersediaan unit", "Opsi tukar tambah"]
    li = "".join(f"<li>{esc(b)}</li>" for b in bullets)
    return (f'<section class="s{" alt" if alt else ""}" id="lead"><div class="wrap two"><div><h2>{h2}</h2><p>{esc(text)}</p><ul>{li}</ul></div>'
            f'<div class="leadbox">{lead_form(model)}</div></div></section>')


def faq_html(faqs):
    return "".join(f'<details class="q"><summary>{md.inline(q)}</summary><div>{md.inline(a)}</div></details>' for q, a in faqs)


def faq_pairs(lst):
    return [(f["q"], f["a"]) for f in lst or []]


def page(title, desc, path, body, schema=None, og_type="website", robots="index,follow", og_image=None, extra=""):
    return (head(title, desc, path, og_type, schema, robots, og_image, extra) + "<body>" + header() + '<main id="main">' + body + "</main>" + footer())


def add(path, html_, lastmod=None, index=True):
    OUT_PAGES.append((path, html_, lastmod or PRICE_DATE, index))


def price_line(m):
    return f'Mulai {juta(min(v["price"] for v in m["variants"]))}' if m.get("variants") else "Hubungi sales"


def reading_min(text):
    return max(1, round(words(text) / 200))


# ------------------------------------------------------------------ artikel: kartu, penempatan, terkait
def art_url(a):
    return f"/blog/{a['slug']}/"


def article_card(a):
    cover = ""
    if a["cover"] and images.resolve(a["cover"]):
        cover = f'<div class="vis">{img_tag(a["cover"], a["cover_alt"], "(max-width:600px) 100vw, 360px")}</div>'
    return (f'<a class="card" href="{art_url(a)}">{cover}<div class="bd"><span class="tp">{esc(a["category"])} · {tgl(a["date"])}</span>'
            f'<h3>{esc(a["h1"])}</h3><p>{esc(a["description"])}</p><span class="more">Baca artikel →</span></div></a>')


def arts_for(kind, key="", limit=None, fill=False):
    """Artikel yang ditempatkan: home | prices | model:<slug> | pillar:<slug>."""
    sel = []
    for a in VIS_ART:
        hit = False
        if kind == "home":
            hit = "home" in a["placements"]
        elif kind == "prices":
            hit = "prices" in a["placements"]
        elif kind == "model":
            hit = key in a["models"] or f"model:{key}" in a["placements"]
        elif kind == "pillar":
            hit = a["pillar"] == key or f"pillar:{key}" in a["placements"]
        if hit:
            sel.append(a)
    if fill and limit:
        for a in VIS_ART:
            if a not in sel:
                sel.append(a)
    return sel[:limit] if limit else sel


def related(a, n):
    scored = []
    for b in VIS_ART:
        if b is a:
            continue
        s = 3 * len(set(a["models"]) & set(b["models"])) + (2 if a["pillar"] and a["pillar"] == b["pillar"] else 0) + (1 if a["tier"] == b["tier"] else 0)
        scored.append((s, b["dt"], b))
    scored.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [b for _, _, b in scored[:n]]


def inject_after_h2(h, n, block):
    pos = [m.start() for m in re.finditer(r"<h2[ >]", h)]
    if len(pos) > n:
        return h[:pos[n]] + block + h[pos[n]:]
    return h


def toc_html(heads):
    if len(heads) < 3:
        return ""
    return '<nav class="toc" aria-label="Daftar isi"><b>Daftar isi</b><ol>' + "".join(f'<li><a href="#{i}">{esc(t)}</a></li>' for t, i in heads) + "</ol></nav>"


# ------------------------------------------------------------------ BERANDA
def section_on(group, sid):
    for s in LAYOUT.get(group, []):
        if s["id"] == sid:
            return s.get("on", True)
    return False


def sections_order(group, registry):
    ids = [s["id"] for s in LAYOUT.get(group, []) if s.get("on", True) and s["id"] in registry]
    for k in registry:  # section baru yang belum ada di layout.json ikut ditampilkan di akhir
        if k not in [s["id"] for s in LAYOUT.get(group, [])]:
            ids.append(k)
    return ids


def build_home():
    h = PG["home"]
    lead_txt = fmt(h.get("lead", ""))

    def s_hero():
        badges = "".join(f"<li>{esc(b)}</li>" for b in h.get("badges", []))
        return (f'<section class="hero"><div class="wrap"><h1>{esc(fmt(h["h1"]))}</h1><p class="lead">{esc(lead_txt)}</p><div class="cta">'
                f'<a class="btn w" href="{wa_url()}" data-wa="hero" rel="noopener">{WA_ICON} {esc(h.get("cta_primary", "Chat WhatsApp"))}</a>'
                f'<a class="btn o" href="#lead">{esc(h.get("cta_secondary", "Booking Test Drive"))}</a></div><ul class="badges">{badges}</ul></div></section>')

    def s_models():
        cards = ""
        for m in MODELS:
            vis = (img_tag(m["images"][0]["src"], m["images"][0].get("alt") or m["name"], "(max-width:600px) 100vw, 360px")
                   if m.get("images") and images.resolve(m["images"][0]["src"]) else esc(m["name"]))
            cards += (f'<a class="card" href="/{m["slug"]}/"><div class="vis">{vis}</div><div class="bd"><span class="tp">{esc(m["type"])}</span>'
                      f'<h3>{esc(m["name"])}</h3><span class="pr">{price_line(m)}</span><span class="more">Lihat detail →</span></div></a>')
        return (f'<section class="s" id="model"><div class="wrap"><h2>{esc(h["models_title"])}</h2><p>{esc(h.get("models_intro", ""))}</p>'
                f'<div class="grid">{cards}</div><p class="note" style="margin-top:14px">Harga OTR Jakarta, {esc(PRICE_LABEL)}; dapat berubah. '
                f'Lihat <a href="/harga-byd/">daftar harga mobil BYD terbaru</a>.</p></div></section>')

    def s_why():
        items = "".join(f'<div><h3>{esc(i["title"])}</h3><p>{esc(i["text"])}</p></div>' for i in h.get("why_items", []))
        return (f'<section class="s alt"><div class="wrap"><h2>{esc(h["why_title"])}</h2><div class="feat">{items}</div>'
                f'<p style="margin-top:18px">{md.inline(h.get("why_links", ""))}</p></div></section>')

    def s_articles():
        n = int(h.get("articles_count", 3))
        arts = arts_for("home", limit=n, fill=True)
        if not arts:
            return ""
        return (f'<section class="s"><div class="wrap"><h2>{esc(h.get("articles_title", "Artikel Terbaru"))}</h2>'
                f'<div class="grid">{"".join(article_card(a) for a in arts)}</div>'
                f'<p style="margin-top:16px"><a class="btn o sm" style="color:var(--acc2)" href="/blog/">Semua artikel</a></p></div></section>')

    def s_usecases():
        li = "".join(f"<li>{md.inline(u)}</li>" for u in h.get("usecases", []))
        return f'<section class="s alt"><div class="wrap"><h2>{esc(h["usecases_title"])}</h2><ul>{li}</ul></div></section>'

    def s_lead():
        return lead_section(h2=esc(h["lead_title"]), text=h.get("lead_text"), bullets=h.get("lead_bullets"), alt=False)

    def s_faq():
        return f'<section class="s"><div class="wrap art"><h2>{esc(h["faq_title"])}</h2>{faq_html(faq_pairs(h.get("faq")))}</div></section>'

    reg = {"hero": s_hero, "models": s_models, "why": s_why, "articles": s_articles, "usecases": s_usecases, "lead": s_lead, "faq": s_faq}
    body = "".join(reg[i]() for i in sections_order("home", reg))
    schema = [dealer_ld(), {"@context": "https://schema.org", "@type": "WebSite", "name": NAME, "url": url("/"), "inLanguage": "id-ID"}]
    if h.get("faq"):
        schema.append(faq_ld(faq_pairs(h["faq"])))
    add("/", page(fmt(h["title"]), fmt(h["description"]), "/", body, schema))


# ------------------------------------------------------------------ MODEL
def build_models():
    for m in MODELS:
        path = f"/{m['slug']}/"
        title = f"{m['name']}: Harga, Spesifikasi & Test Drive | {NAME}"
        desc = f"Cek harga OTR, varian, galeri, dan spesifikasi {m['name']}. Konsultasi gratis, simulasi kredit, dan booking test drive di {NAME}."
        crumb_items = [("Beranda", "/"), ("Model BYD", "/#model"), (m["name"], path)]
        imgs = [i for i in m.get("images", []) if images.resolve(i["src"])]

        def s_gallery():
            if not imgs:
                return ""
            big = imgs[0]
            thumbs = "".join(
                f'<a href="{images.resolve(i["src"])}" data-gal aria-label="Perbesar foto {k + 2}">'
                f'{img_tag(i["src"], i.get("alt") or m["name"], "(max-width:600px) 50vw, 280px")}</a>' for k, i in enumerate(imgs[1:]))
            return (f'<section class="s" style="padding-bottom:0"><div class="wrap"><div class="gal"><a class="big" href="{images.resolve(big["src"])}" data-gal '
                    f'aria-label="Perbesar foto utama">{img_tag(big["src"], big.get("alt") or m["name"], "(max-width:820px) 100vw, 760px", eager=True)}</a>'
                    f'<div class="th">{thumbs}</div></div></div></section>')

        def s_summary():
            body = "".join(f"<p>{md.inline(p)}</p>" for p in m.get("intro", []))
            best = ("<h2>Cocok untuk Siapa?</h2><ul>" + "".join(f"<li>{esc(b)}</li>" for b in m["best_for"]) + "</ul>") if m.get("best_for") else ""
            return f'<section class="s"><div class="wrap art"><h2>Ringkasan {esc(m["name"])}</h2>{body}{best}</div></section>'

        def s_highlights():
            if not m.get("highlights"):
                return ""
            items = "".join(f'<div><h3>{esc(x["title"])}</h3><p>{esc(x["text"])}</p></div>' for x in m["highlights"])
            return f'<section class="s alt"><div class="wrap"><h2>Keunggulan {esc(m["name"])}</h2><div class="feat">{items}</div></div></section>'

        def s_variants():
            vs = m.get("variants", [])
            if not vs:
                return ""
            rows = "".join(
                f'<tr><td>{esc(v["name"])}{"*" if v.get("verify") else ""}</td><td>{juta(v["price"])}</td><td>{dash(range_text(v))}</td>'
                f'<td>{dash(v.get("battery", ""))}</td><td>{dash(v.get("seats", ""))}</td></tr>' for v in vs)
            notes = "".join(f'<li>{esc(v["name"])}: {esc(v["note"])}</li>' for v in vs if v.get("verify") and v.get("note"))
            nt = f'<p class="note">* Catatan:</p><ul class="note">{notes}</ul>' if notes else ""
            return (f'<section class="s"><div class="wrap art"><h2>Harga {esc(m["name"])} (OTR Jakarta, {esc(PRICE_LABEL)})</h2><div class="tw"><table>'
                    f'<thead><tr><th>Varian</th><th>Harga OTR Jakarta</th><th>Jarak tempuh</th><th>Baterai</th><th>Kursi</th></tr></thead><tbody>{rows}</tbody></table></div>'
                    f'<p class="note">Harga sesuai price list dealer, dapat berubah dan berbeda antar daerah. Konfirmasi ke sales kami.</p>{nt}</div></section>')

        def s_specs():
            if not m.get("specs"):
                return ""
            rows = "".join(f'<tr><th scope="row">{esc(s["label"])}</th><td>{esc(s["value"])}</td></tr>' for s in m["specs"])
            return f'<section class="s alt"><div class="wrap art"><h2>Spesifikasi {esc(m["name"])}</h2><div class="tw"><table><tbody>{rows}</tbody></table></div></div></section>'

        def s_compare():
            refs = [r for r in m.get("compare", []) if r in CBY]
            if not refs or not m.get("variants"):
                return ""
            ents = [model_entity(m)] + [comp_entity(CBY[r]) for r in refs]
            links = arts_for("model", m["slug"])
            lk = ("<p>Baca perbandingan lengkap: " + ", ".join(f'<a href="{art_url(a)}">{esc(a["h1"])}</a>' for a in links[:3]) + ".</p>") if links else ""
            return (f'<section class="s"><div class="wrap art"><h2>{esc(m["name"])} vs Mobil Listrik Sekelas Harga</h2>'
                    f'<p>Kompetitor di bawah dipilih karena harganya berdekatan dengan {esc(ents[0]["name"])}.</p>{compare_table(ents)}{lk}</div></section>')

        def s_articles():
            arts = arts_for("model", m["slug"], limit=3)
            if not arts:
                return ""
            return (f'<section class="s alt"><div class="wrap"><h2>Artikel tentang {esc(m["name"])}</h2>'
                    f'<div class="grid">{"".join(article_card(a) for a in arts)}</div></div></section>')

        def s_faq():
            if not m.get("faq"):
                return ""
            return f'<section class="s"><div class="wrap art"><h2>Pertanyaan tentang {esc(m["name"])}</h2>{faq_html(faq_pairs(m["faq"]))}</div></section>'

        def s_others():
            others = [x for x in MODELS if x["slug"] != m["slug"]][:4]
            return ('<section class="s alt"><div class="wrap"><h2>Model BYD Lainnya</h2><div class="minis">'
                    + "".join(model_card_mini(x) for x in others) + "</div></div></section>")

        def s_lead():
            return lead_section(m["name"], alt=False)

        reg = {"gallery": s_gallery, "summary": s_summary, "highlights": s_highlights, "variants": s_variants, "specs": s_specs,
               "compare": s_compare, "articles": s_articles, "faq": s_faq, "others": s_others, "lead": s_lead}
        top = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(m["name"])}: Harga, Spesifikasi &amp; Test Drive</h1>'
               f'<p>{esc(m["tagline"])}</p><a class="btn" href="{td_url(m["name"])}">Booking Test Drive</a> '
               f'<a class="btn w" href="{wa_url("Halo, saya ingin info " + m["name"])}" data-wa="model-{m["slug"]}" rel="noopener">{WA_ICON} Tanya via WhatsApp</a></div></section>')
        body = top + "".join(reg[i]() for i in sections_order("model", reg))
        schema = [breadcrumb_ld(crumb_items)]
        if m.get("faq"):
            schema.append(faq_ld(faq_pairs(m["faq"])))
        car = {"@context": "https://schema.org", "@type": "Car", "name": m["name"], "brand": {"@type": "Brand", "name": m.get("brand", "BYD")},
               "description": m["tagline"], "url": url(path), "bodyType": m.get("body", ""), "fuelType": "Electric" if m.get("powertrain") == "BEV" else "Hybrid"}
        if imgs:
            car["image"] = [url(images.resolve(i["src"])) for i in imgs[:5]]
        if m.get("variants"):
            ps = [v["price"] for v in m["variants"]]
            car["offers"] = {"@type": "AggregateOffer", "priceCurrency": "IDR", "lowPrice": min(ps), "highPrice": max(ps), "offerCount": len(ps),
                             "seller": {"@id": url("/#dealer")}}
        schema.append(car)
        ogi = images.og_url(imgs[0]["src"]) if imgs else None
        add(path, page(title, desc, path, body, schema, og_image=ogi), PRICE_DATE)


# ------------------------------------------------------------------ HARGA, TEST DRIVE
def build_prices():
    p = PG["prices"]
    path = "/harga-byd/"
    crumb_items = [("Beranda", "/"), ("Harga Mobil BYD", path)]

    def s_table():
        rows = ""
        for m in MODELS:
            for v in m.get("variants", []):
                rows += (f'<tr><td><a href="/{m["slug"]}/">{esc(m["name"])}</a></td><td>{esc(v["name"])}</td><td>{juta(v["price"])}</td>'
                         f'<td>{dash(range_text(v))}</td></tr>')
        return (f'<section class="s"><div class="wrap art"><p>{esc(fmt(p["intro"]))}</p><div class="tw"><table><thead><tr><th>Model</th><th>Varian</th>'
                f'<th>Harga OTR Jakarta</th><th>Jarak tempuh</th></tr></thead><tbody>{rows}</tbody></table></div>'
                f'<p class="note">Harga dapat berubah tanpa pemberitahuan dan berbeda antar daerah. Konfirmasi ke sales {esc(NAME)}. Jarak tempuh sesuai price list dealer atau standar yang tertera.</p></div></section>')

    def s_guide():
        h, _, _ = render_md(p.get("guide_md", ""))
        return f'<section class="s alt"><div class="wrap art"><h2>{esc(p["guide_title"])}</h2>{h}</div></section>'

    def s_articles():
        arts = arts_for("prices", limit=6)
        if not arts:
            return ""
        return f'<section class="s"><div class="wrap"><h2>{esc(p.get("articles_title", "Artikel Terkait"))}</h2><div class="grid">{"".join(article_card(a) for a in arts)}</div></div></section>'

    def s_faq():
        return f'<section class="s alt"><div class="wrap art"><h2>{esc(p["faq_title"])}</h2>{faq_html(faq_pairs(p["faq"]))}</div></section>'

    def s_lead():
        return lead_section(h2=esc(p.get("lead_title", "Minta Harga Terbaru")), alt=False)

    reg = {"table": s_table, "guide": s_guide, "articles": s_articles, "faq": s_faq, "lead": s_lead}
    body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(fmt(p["h1"]))}</h1><p class="meta">Diperbarui {tgl(PRICE_DATE)}</p></div></section>'
            + "".join(reg[i]() for i in sections_order("prices", reg)))
    add(path, page(fmt(p["title"]), fmt(p["description"]), path, body, [breadcrumb_ld(crumb_items), faq_ld(faq_pairs(p["faq"]))]), PRICE_DATE)


def build_testdrive():
    t = PG["testdrive"]
    path = "/test-drive/"
    crumb_items = [("Beranda", "/"), ("Test Drive", path)]
    steps = "".join(f"<li>{esc(s)}</li>" for s in t.get("steps", []))
    body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(t["h1"])}</h1><p>{esc(t["intro"])}</p></div></section>'
            f'{lead_section(h2=esc(t["lead_title"]), alt=False)}<section class="s alt"><div class="wrap art"><h2>{esc(t["steps_title"])}</h2><ol>{steps}</ol>'
            f'<h2>{esc(t["faq_title"])}</h2>{faq_html(faq_pairs(t["faq"]))}</div></section>')
    add(path, page(fmt(t["title"]), fmt(t["description"]), path, body, [breadcrumb_ld(crumb_items), faq_ld(faq_pairs(t["faq"]))]), PRICE_DATE)


# ------------------------------------------------------------------ ARTIKEL & HALAMAN LANDING
def author_ld(a):
    nm = a["author"] or SITE.get("author_name") or NAME
    return {"@type": "Person" if a["author"] else "Organization", "name": nm, "url": url("/")}


def model_box(a):
    ms = [MBY[s] for s in a["models"] if s in MBY and MBY[s].get("published", True)]
    if not ms:
        return ""
    cards = "".join(
        f'<div class="mbox"><div><strong>{esc(m["name"])}</strong><span>{price_line(m)} OTR Jakarta</span></div>'
        f'<div><a class="btn sm" href="/{m["slug"]}/">Lihat {esc(m["name"])}</a> <a class="btn o sm" style="color:var(--acc2)" href="{td_url(m["name"])}">Minta penawaran</a></div></div>'
        for m in ms)
    return f'<aside class="mboxes" aria-label="Model yang dibahas"><h2>Model yang Dibahas</h2>{cards}</aside>'


def build_article(a):
    path = art_url(a)
    body_html, heads, faqs = render_md(a["body"])
    la = LAYOUT.get("article", {})
    if la.get("cta_mid", True):
        mm = MBY.get(a["models"][0]) if a["models"] else None
        body_html = inject_after_h2(body_html, int(la.get("cta_mid_after_h2", 2)), cta_box(mm["name"] if mm else ""))
    crumb_items = [("Beranda", "/"), ("Blog", "/blog/"), (a["h1"], path)]
    pillar = LBY.get(a["pillar"])
    pill = (f'<p class="meta">Bagian dari panduan: <a href="/{pillar["slug"]}/">{esc(pillar["h1"])}</a></p>') if pillar else ""
    nm = a["author"] or SITE.get("author_name") or NAME
    auth = ""
    if la.get("author", True):
        auth = (f'<aside class="author"><strong>Ditulis oleh {esc(nm)}</strong> · {esc(SITE.get("author_role", ""))} di {esc(NAME)}. '
                f'Harga dan data dikumpulkan dari sumber yang tercantum dan terakhir diperbarui {tgl(a["updated"])}.</aside>')
    cover = ""
    if a["cover"] and images.resolve(a["cover"]):
        cover = f'<figure class="fig cover">{img_tag(a["cover"], a["cover_alt"], eager=True)}</figure>'
    faq_block = f'<h2 id="faq">FAQ</h2>{faq_html(faqs)}' if faqs else ""
    rel = ""
    if la.get("related", True):
        r = related(a, int(la.get("related_count", 3)))
        if r:
            rel = f'<section class="s alt"><div class="wrap"><h2>Baca Juga</h2><div class="grid">{"".join(article_card(x) for x in r)}</div></div></section>'
    wc = words(body_html)
    body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(a["h1"])}</h1>'
            f'<p class="meta">{esc(a["category"])} · Diterbitkan {tgl(a["date"])}'
            + (f' · Diperbarui {tgl(a["updated"])}' if a["updated"] != a["date"] else "") + f' · {max(1, round(wc / 200))} menit baca</p>{pill}</div></section>'
            f'<article class="s"><div class="wrap art">{cover}{toc_html(heads) if la.get("toc", True) else ""}{body_html}{faq_block}'
            f'{model_box(a) if la.get("model_box", True) else ""}{auth}{cta_box(MBY[a["models"][0]]["name"] if a["models"] and a["models"][0] in MBY else "")}</div></article>{rel}')
    ogi = images.og_url(a["cover"]) if a["cover"] else None
    art_ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": a["h1"][:110], "description": a["description"],
              "datePublished": a["dt"].isoformat(), "dateModified": a["updated"], "inLanguage": "id-ID", "mainEntityOfPage": url(path),
              "image": url(ogi or "/assets/og-default.png"), "wordCount": wc, "articleSection": a["category"],
              "keywords": ", ".join([a["keyword"]] + a["secondary"]), "author": author_ld(a),
              "publisher": {"@type": "Organization", "name": NAME, "url": url("/")}}
    schema = [breadcrumb_ld(crumb_items), art_ld] + ([faq_ld(faqs)] if faqs else [])
    extra = f'<meta property="article:published_time" content="{a["dt"].isoformat()}"><meta property="article:modified_time" content="{a["updated"]}">'
    add(path, page(a["title"], a["description"], path, body, schema, "article", og_image=ogi, extra=extra), a["updated"])
    a["_words"], a["_path"] = wc, path


def build_landing(p):
    path = f"/{p['slug']}/"
    body_html, heads, faqs = render_md(p["body"])
    crumb_items = [("Beranda", "/"), (p["h1"], path)]
    sup = arts_for("pillar", p["slug"])
    sup_html = (f'<section class="s alt"><div class="wrap"><h2>Artikel Pendukung</h2><div class="grid">{"".join(article_card(a) for a in sup)}</div></div></section>') if sup else ""
    faq_block = f'<h2 id="faq">FAQ</h2>{faq_html(faqs)}' if faqs else ""
    body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(p["h1"])}</h1><p class="meta">Diperbarui {tgl(p["updated"])}</p></div></section>'
            f'<article class="s"><div class="wrap art">{toc_html(heads)}{body_html}{faq_block}{cta_box()}</div></article>{sup_html}{lead_section(alt=False)}')
    wp = {"@context": "https://schema.org", "@type": "CollectionPage" if sup else "WebPage", "name": p["h1"], "url": url(path),
          "description": p["description"], "inLanguage": "id-ID", "dateModified": p["updated"]}
    schema = [breadcrumb_ld(crumb_items), wp] + ([faq_ld(faqs)] if faqs else [])
    add(path, page(p["title"], p["description"], path, body, schema), p["updated"])
    p["_words"], p["_path"] = words(body_html), path


def build_blog():
    b = PG["blog"]
    size = 12
    pages_n = max(1, -(-len(VIS_ART) // size))
    for n in range(1, pages_n + 1):
        chunk = VIS_ART[(n - 1) * size: n * size]
        path = "/blog/" if n == 1 else f"/blog/page/{n}/"
        crumb_items = [("Beranda", "/"), ("Blog", "/blog/")]
        pager = ""
        if pages_n > 1:
            pager = '<nav class="pager" aria-label="Halaman">' + "".join(
                f'<a href="{"/blog/" if i == 1 else f"/blog/page/{i}/"}"{" aria-current=page" if i == n else ""}>{i}</a>' for i in range(1, pages_n + 1)) + "</nav>"
        extra = ""
        if n > 1:
            extra += f'<link rel="prev" href="{url("/blog/" if n == 2 else f"/blog/page/{n - 1}/")}">'
        if n < pages_n:
            extra += f'<link rel="next" href="{url(f"/blog/page/{n + 1}/")}">'
        h1 = fmt(b["h1"]) + (f" (Halaman {n})" if n > 1 else "")
        grid = f'<div class="grid">{"".join(article_card(a) for a in chunk).replace("<h3>", "<h2>").replace("</h3>", "</h2>")}</div>' if chunk else "<p>Artikel pertama segera hadir.</p>"
        body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(h1)}</h1><p>{esc(fmt(b["intro"]))}</p></div></section>'
                f'<section class="s"><div class="wrap">{grid}{pager}</div></section>')
        title = fmt(b["title"]) + (f" - Halaman {n}" if n > 1 else "")
        add(path, page(title, fmt(b["description"]) + (f" Halaman {n}." if n > 1 else ""), path, body, [breadcrumb_ld(crumb_items)], extra=extra),
            (chunk[0]["updated"] if chunk else PRICE_DATE))


def build_404():
    body = ('<section class="s"><div class="wrap art"><h1>Halaman tidak ditemukan</h1><p>Maaf, halaman yang Anda cari tidak ada. Coba lihat '
            '<a href="/harga-byd/">harga mobil BYD</a> atau kembali ke <a href="/">beranda</a>.</p></div></section>')
    add("/404.html", page(f"Halaman Tidak Ditemukan | {NAME}", "Halaman tidak ditemukan.", "/404.html", body, robots="noindex,follow"), index=False)


# ------------------------------------------------------------------ keluaran
def og_default():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        WARN.append("Pillow tidak ada: og-default.png tidak dibuat")
        return
    W, H = 1200, 630
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = x / W * 0.6 + y / H * 0.4
            px[x, y] = (7, int(20 + 70 * t), int(38 + 55 * t))
    d = ImageDraw.Draw(img)

    def font(size):
        for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"):
            try:
                return ImageFont.truetype(p, size)
            except OSError:
                continue
        return ImageFont.load_default()

    d.text((80, 200), NAME, font=font(96), fill="white")
    d.text((80, 330), "Dealer Mobil Listrik BYD", font=font(48), fill=(200, 230, 225))
    d.text((80, 410), "Harga OTR  |  Simulasi Kredit  |  Test Drive", font=font(34), fill=(160, 210, 200))
    img.save(OUT / "assets/og-default.png", optimize=True)


def write_feed():
    items = ""
    for a in VIS_ART[:20]:
        pub = a["dt"].astimezone(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")
        items += (f'<item><title>{esc(a["h1"])}</title><link>{url(art_url(a))}</link><guid isPermaLink="true">{url(art_url(a))}</guid>'
                  f'<pubDate>{pub}</pubDate><category>{esc(a["category"])}</category><description>{esc(a["description"])}</description></item>')
    last = VIS_ART[0]["dt"].astimezone(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000") if VIS_ART else ""
    (OUT / "feed.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>'
        f'<title>{esc(NAME)}</title><link>{url("/")}</link><description>{esc(SITE["tagline"])}</description><language>id-ID</language>'
        f'<atom:link href="{url("/feed.xml")}" rel="self" type="application/rss+xml"/>'
        + (f"<lastBuildDate>{last}</lastBuildDate>" if last else "") + items + "</channel></rss>", encoding="utf-8")


def write_all():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    images.process(OUT)
    shutil.copy(SRC / "assets/app.js", OUT / "assets/app.js")
    og_default()


def finalize():
    for path, html_, _, _ in OUT_PAGES:
        f = OUT / (path.lstrip("/") + "index.html") if path.endswith("/") else OUT / path.lstrip("/")
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(html_, encoding="utf-8")
    urls = "".join(f"<url><loc>{url(p)}</loc><lastmod>{lm}</lastmod></url>" for p, _, lm, idx in OUT_PAGES if idx)
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {url('/sitemap.xml')}\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    write_feed()
    if "DOMAIN-ANDA" not in DOMAIN:
        (OUT / "CNAME").write_text(DOMAIN.split("://", 1)[1] + "\n")
    key = (SITE.get("indexnow_key") or "").strip()
    if key:
        (OUT / f"{key}.txt").write_text(key)
    # admin panel (statis; hanya berfungsi dengan token GitHub milik Anda)
    adm = SRC / "admin"
    if adm.exists():
        shutil.copytree(adm, OUT / "admin")
    info = {
        "built_at": NOW.isoformat(), "pages": len([1 for *_, i in OUT_PAGES if i]),
        "articles_live": [{"slug": a["slug"], "title": a["h1"], "keyword": a["keyword"], "tier": a["tier"], "date": a["date"],
                           "words": a.get("_words", 0), "models": a["models"], "pillar": a["pillar"], "path": art_url(a)} for a in VIS_ART],
        "models_live": [m["slug"] for m in MODELS],
    }
    (OUT / "admin").mkdir(exist_ok=True)
    (OUT / "admin/build-info.json").write_text(json.dumps(info, ensure_ascii=False), encoding="utf-8")


def validate():
    seen = {}
    for it in ARTICLES + LANDING:
        if it["slug"] in RESERVED or it["slug"] in MBY:
            WARN.append(f"Slug '{it['slug']}' bentrok dengan halaman sistem/model")
        key = (it["kind"], it["slug"])
        if key in seen:
            WARN.append(f"Slug kembar: {it['kind']}/{it['slug']}")
        seen[key] = 1
    for a in ARTICLES:
        if a["status"] == "scheduled" and not a["publish_at"]:
            WARN.append(f"Artikel terjadwal tanpa publish_at: {a['slug']}")
        for s in a["models"]:
            if s not in MBY:
                WARN.append(f"Artikel {a['slug']}: model '{s}' tidak ada")
        if a["pillar"] and a["pillar"] not in {p['slug'] for p in LANDING}:
            WARN.append(f"Artikel {a['slug']}: pillar '{a['pillar']}' tidak ada")
        if a.get("blocked"):
            WARN.append(f"Artikel {a['slug']} DITAHAN (tidak tayang): keyword/description kosong")
    for m in ALL_MODELS:
        for r in m.get("compare", []):
            if r not in CBY:
                WARN.append(f"Model {m['slug']}: kompetitor '{r}' tidak ada di competitors.json")
    if "DOMAIN-ANDA" in DOMAIN:
        WARN.append("TODO: isi 'domain' di Admin → Pengaturan (canonical, sitemap, schema memakai domain ini)")
    if SITE["wa_number"] == "6281234567890":
        WARN.append("TODO: isi nomor WhatsApp di Admin → Pengaturan")
    if "ALAMAT" in SITE["address"]:
        WARN.append("TODO: isi alamat, kode pos, jam buka dealer (penting untuk local SEO)")
    if not SITE["firebase"].get("projectId"):
        WARN.append("TODO: isi Firebase agar lead tersimpan ke Firestore (sementara hanya ke WhatsApp)")


def main():
    validate()
    write_all()
    build_home(); build_models(); build_prices(); build_testdrive()
    for a in VIS_ART:
        build_article(a)
    for p in VIS_LAND:
        build_landing(p)
    build_blog(); build_404()
    finalize()
    sched = [a for a in ARTICLES if a["status"] == "scheduled" and not a["visible"]]
    print(f"Build selesai: {len(OUT_PAGES)} halaman, {len(VIS_ART)} artikel tayang, {len(sched)} terjadwal, "
          f"{len([a for a in ARTICLES if a['status'] == 'draft'])} draf -> {OUT}")
    for w in WARN + images.WARN:
        print("  !", w)


if __name__ == "__main__":
    sys.exit(main())

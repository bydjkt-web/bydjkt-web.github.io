#!/usr/bin/env python3
"""
Static site generator BYD Harmony.
  src/data/site.json, src/data/models.json, src/articles/*.md  ->  docs/  (GitHub Pages)

Jalankan:  python3 tools/build.py
Artikel baru: tambah file .md di src/articles/ lalu jalankan build lagi.
"""
import datetime
import html
import json
import pathlib
import re
import shutil
import sys
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "docs"

SITE = json.loads((SRC / "data/site.json").read_text(encoding="utf-8"))
MODELS = json.loads((SRC / "data/models.json").read_text(encoding="utf-8"))
TODAY = datetime.date.today().isoformat()
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli",
         "Agustus", "September", "Oktober", "November", "Desember"]
NAME = SITE["name"]
DOMAIN = SITE["domain"].rstrip("/")
WARN = []

esc = html.escape


def url(path):
    return DOMAIN + path


def tgl(iso):
    y, m, d = map(int, iso.split("-"))
    return f"{d} {BULAN[m - 1]} {y}"


def juta(n):
    return f"Rp{n // 1_000_000} juta"


def wa_url(text="Halo, saya ingin info harga mobil listrik BYD."):
    return f"https://wa.me/{SITE['wa_number']}?text=" + urllib.parse.quote(text)


# ---------------------------------------------------------------- CSS / assets
def minify_css(css):
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    css = re.sub(r"\s+", " ", css)
    css = re.sub(r"\s*([{};:,>])\s*", r"\1", css)
    return css.replace(";}", "}").strip()


CSS = minify_css((SRC / "assets/style.css").read_text(encoding="utf-8"))
JS = (SRC / "assets/app.js").read_text(encoding="utf-8")

FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='8' fill='%2300806d'/%3E"
           "%3Cpath d='M18 4 8 18h7l-1 10 10-14h-7z' fill='%23fff'/%3E%3C/svg%3E")

BOLT = ("<svg viewBox='0 0 32 32' aria-hidden='true'><rect width='32' height='32' rx='8' fill='#00806d'/>"
        "<path d='M18 4 8 18h7l-1 10 10-14h-7z' fill='#fff'/></svg>")
WA_ICON = ("<svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 "
           "10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 "
           ".9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 "
           "1.3 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.1 1.4z'/></svg>")


# ---------------------------------------------------------------- Markdown mini
def inline(s):
    s = esc(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\[([^\]]+)\]\((/[^)\s]*|https?://[^)\s]+)\)", r'<a href="\2">\1</a>', s)
    return s


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def md_blocks(text, heads):
    out, para, lst = [], [], None

    def flush_p():
        nonlocal para
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para = []

    def flush_l():
        nonlocal lst
        if lst:
            tag = lst[0]
            out.append(f"<{tag}>" + "".join(f"<li>{inline(i)}</li>" for i in lst[1]) + f"</{tag}>")
            lst = None

    for line in text.split("\n"):
        s = line.rstrip()
        if not s.strip():
            flush_p(); flush_l(); continue
        m = re.match(r"^(#{2,3})\s+(.*)", s)
        if m:
            flush_p(); flush_l()
            lvl, t = len(m.group(1)), m.group(2).strip()
            hid = slugify(t)
            if lvl == 2:
                heads.append((t, hid))
            out.append(f'<h{lvl} id="{hid}">{inline(t)}</h{lvl}>')
            continue
        m = re.match(r"^(?:[-*])\s+(.*)", s)
        if m:
            flush_p()
            if not lst or lst[0] != "ul":
                flush_l(); lst = ("ul", [])
            lst[1].append(m.group(1)); continue
        m = re.match(r"^\d+\.\s+(.*)", s)
        if m:
            flush_p()
            if not lst or lst[0] != "ol":
                flush_l(); lst = ("ol", [])
            lst[1].append(m.group(1)); continue
        flush_l(); para.append(s.strip())
    flush_p(); flush_l()
    return "\n".join(out)


def parse_article(path):
    raw = path.read_text(encoding="utf-8")
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
    if not m:
        raise SystemExit(f"Front matter hilang: {path}")
    meta = {}
    for ln in m.group(1).split("\n"):
        if ":" in ln:
            k, v = ln.split(":", 1)
            meta[k.strip()] = v.strip()
    body = m.group(2).strip()
    main, _, faq_raw = body.partition("\n## FAQ")
    heads = []
    main_html = md_blocks(main, heads)
    faqs = []
    if faq_raw.strip():
        heads.append(("FAQ", "faq"))
        for blk in re.split(r"\n### ", "\n" + faq_raw.strip()):
            blk = blk.strip()
            if not blk:
                continue
            q, _, a = blk.partition("\n")
            faqs.append((q.strip(), " ".join(a.split())))
    meta["body_text"] = re.sub(r"<[^>]+>", " ", main_html) + " " + " ".join(q + " " + a for q, a in faqs)
    meta["html"], meta["heads"], meta["faqs"] = main_html, heads, faqs
    return meta


# ---------------------------------------------------------------- Layout pieces
def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "</script>"


def breadcrumb_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": url(p)}
                                for i, (n, p) in enumerate(items)]}


def faq_ld(faqs):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q,
                            "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faqs]}


def dealer_ld():
    d = {"@context": "https://schema.org", "@type": "AutoDealer", "@id": url("/#dealer"),
         "name": NAME, "url": url("/"), "image": url("/assets/og-default.png"),
         "description": "Dealer mobil listrik BYD: konsultasi, simulasi kredit, dan booking test drive.",
         "brand": {"@type": "Brand", "name": "BYD"}, "areaServed": "ID",
         "address": {"@type": "PostalAddress", "streetAddress": SITE["address"],
                     "addressLocality": SITE["city"], "addressRegion": SITE["region"],
                     "postalCode": SITE["postal"], "addressCountry": "ID"},
         "openingHours": SITE.get("hours_schema", "Mo-Sa 09:00-18:00")}
    if SITE["wa_number"] != "6281234567890":
        d["telephone"] = "+" + SITE["wa_number"]
    return d


def head(title, desc, path, og_type="website", schema=None, robots="index,follow"):
    canon = url(path)
    gsc = (f'<meta name="google-site-verification" content="{esc(SITE["gsc_verification"])}">'
           if SITE.get("gsc_verification") else "")
    ga = ""
    if SITE.get("ga4_id"):
        gid = esc(SITE["ga4_id"])
        ga = ("<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}"
              "gtag('js',new Date());gtag('config','" + gid + "');"
              "addEventListener('load',function(){var s=document.createElement('script');s.async=1;"
              "s.src='https://www.googletagmanager.com/gtag/js?id=" + gid + "';document.head.appendChild(s)})</script>")
    cfg = {"name": NAME, "wa": SITE["wa_number"], "firebase": SITE["firebase"]}
    return (f'<!doctype html><html lang="id"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{esc(title)}</title><meta name="description" content="{esc(desc)}">'
            f'<link rel="canonical" href="{canon}"><meta name="robots" content="{robots},max-image-preview:large">'
            f'<meta name="theme-color" content="#00806d"><link rel="icon" href="{FAVICON}">'
            f'<meta property="og:type" content="{og_type}"><meta property="og:site_name" content="{esc(NAME)}">'
            f'<meta property="og:title" content="{esc(title)}"><meta property="og:description" content="{esc(desc)}">'
            f'<meta property="og:url" content="{canon}"><meta property="og:locale" content="id_ID">'
            f'<meta property="og:image" content="{url("/assets/og-default.png")}">'
            f'<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">'
            f'<meta name="twitter:card" content="summary_large_image">'
            f'{gsc}<style>{CSS}</style>{"".join(ld(s) for s in (schema or []))}{ga}'
            f'<script>window.SITE_CONFIG={json.dumps(cfg)}</script></head>')


def header():
    links = [("/#model", "Model"), ("/harga-byd/", "Harga"), ("/blog/", "Blog")]
    nav = "".join(f'<a href="{h}">{t}</a>' for h, t in links)
    return (f'<a class="skip" href="#main">Lewati ke konten</a><header class="top"><div class="wrap bar">'
            f'<a class="logo" href="/" aria-label="{esc(NAME)} beranda">{BOLT}<span>{esc(NAME)}</span></a>'
            f'<nav class="d" aria-label="Menu utama">{nav}<a class="btn sm" href="/test-drive/">Test Drive</a></nav>'
            f'<details class="m"><summary>Menu</summary><div>{nav}<a href="/test-drive/">Test Drive</a></div></details>'
            f'</div></header>')


def footer():
    mod = "".join(f'<li><a href="/{m["slug"]}/">{esc(m["name"])}</a></li>' for m in MODELS)
    return (f'<footer class="ft"><div class="wrap"><div class="fg">'
            f'<div><h2>{esc(NAME)}</h2><p>{esc(SITE["tagline"])}.<br>{esc(SITE["address"])}<br>'
            f'{esc(SITE["city"])}, {esc(SITE["region"])}<br>{esc(SITE["hours"])}</p>'
            f'<p><a href="{wa_url()}" data-wa="footer" rel="noopener">WhatsApp {esc(SITE["phone_display"])}</a></p></div>'
            f'<div><h2>Model BYD</h2><ul>{mod}</ul></div>'
            f'<div><h2>Informasi</h2><ul><li><a href="/harga-byd/">Harga mobil BYD terbaru</a></li>'
            f'<li><a href="/test-drive/">Booking test drive</a></li><li><a href="/blog/">Blog &amp; panduan</a></li></ul></div>'
            f'</div><p class="legal">Harga, promo, dan spesifikasi dapat berubah sewaktu-waktu; konfirmasi ke sales kami. '
            f'BYD adalah merek dagang BYD Company Limited. © {TODAY[:4]} {esc(NAME)}.</p></div></footer>'
            f'<a class="wafab" href="{wa_url()}" data-wa="floating" rel="noopener" aria-label="Chat WhatsApp">{WA_ICON}<span>Chat WhatsApp</span></a>'
            f'<script defer src="/assets/app.js"></script></body></html>')


def crumbs(items):
    parts = []
    for i, (n, p) in enumerate(items):
        parts.append(esc(n) if i == len(items) - 1 else f'<a href="{p}">{esc(n)}</a>')
    return '<nav class="crumb" aria-label="Breadcrumb">' + " › ".join(parts) + "</nav>"


def lead_form(model=""):
    opts = '<option value="">Belum tahu / ingin konsultasi</option>' + "".join(
        f'<option value="{esc(m["name"])}"{" selected" if m["name"] == model else ""}>{esc(m["name"])}</option>' for m in MODELS)
    return (f'<form class="lead" novalidate>'
            f'<label>Nama<input name="name" autocomplete="name" required maxlength="80" placeholder="Nama Anda"></label>'
            f'<label>Nomor WhatsApp<input name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="0812xxxxxxxx"></label>'
            f'<label>Model yang diminati<select name="model">{opts}</select></label>'
            f'<div class="row2"><label>Rencana pembelian<select name="timeline">'
            f'<option value="minggu">Dalam 1 minggu</option><option value="bulan">Dalam 1 bulan</option>'
            f'<option value="tiga_bulan" selected>1–3 bulan ke depan</option><option value="info">Baru cari informasi</option></select></label>'
            f'<label>Pembayaran<select name="payment"><option value="kredit">Kredit</option><option value="cash">Cash</option>'
            f'<option value="belum" selected>Belum menentukan</option></select></label></div>'
            f'<label class="chk"><input type="checkbox" name="testDrive"> Saya ingin booking test drive</label>'
            f'<label class="chk"><input type="checkbox" name="tradeIn"> Saya ingin tukar tambah mobil lama</label>'
            f'<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'
            f'<button class="btn" type="submit">Dapatkan Penawaran via WhatsApp</button>'
            f'<div class="msg" role="status" aria-live="polite" hidden></div>'
            f'<p class="note">Data Anda hanya dipakai untuk menghubungi Anda terkait penawaran mobil.</p></form>')


def lead_section(model="", h2="Konsultasi Gratis &amp; Booking Test Drive", alt=True):
    return (f'<section class="s{" alt" if alt else ""}" id="lead"><div class="wrap two"><div>'
            f'<h2>{h2}</h2><p>Isi form singkat, tim kami menghubungi Anda lewat WhatsApp dengan harga OTR terbaru, '
            f'promo yang berlaku, dan simulasi cicilan sesuai kebutuhan.</p>'
            f'<ul><li>Konsultasi model sesuai kebutuhan dan anggaran</li><li>Simulasi uang muka, tenor, dan cicilan</li>'
            f'<li>Jadwal test drive sesuai ketersediaan unit</li><li>Opsi tukar tambah</li></ul></div>'
            f'<div class="leadbox">{lead_form(model)}</div></div></section>')


def faq_html(faqs):
    return "".join(f'<details class="q"><summary>{esc(q)}</summary><div>{esc(a)}</div></details>' for q, a in faqs)


def page(title, desc, path, body, schema=None, og_type="website", robots="index,follow"):
    return head(title, desc, path, og_type, schema, robots) + "<body>" + header() + '<main id="main">' + body + "</main>" + footer()


def price_line(m):
    if m["variants"]:
        return "Mulai " + juta(min(v["price"] for v in m["variants"]))
    return "Hubungi sales"


# ---------------------------------------------------------------- Pages
PAGES = []  # (path, html, lastmod, indexable)


def add(path, html_, lastmod=None, index=True):
    PAGES.append((path, html_, lastmod or TODAY, index))


def build_home():
    cards = "".join(
        f'<a class="card" href="/{m["slug"]}/"><div class="vis">{esc(m["name"])}</div><div class="bd">'
        f'<span class="tp">{esc(m["type"])}</span><h3>{esc(m["name"])}</h3><span class="pr">{price_line(m)}</span>'
        f'<span class="more">Lihat detail →</span></div></a>' for m in MODELS)
    faqs = [
        ("Berapa harga mobil BYD termurah?", f"Berdasarkan daftar harga OTR Jakarta yang dipublikasikan {SITE['price_date_label']}, BYD Atto 1 varian Standard dimulai dari Rp199 juta. Hubungi sales kami untuk harga terbaru."),
        ("Apakah mobil listrik BYD bisa dibeli secara kredit?", "Bisa. Kami membantu simulasi uang muka, tenor, dan cicilan. Isi form di halaman ini dan tim kami menghubungi Anda lewat WhatsApp."),
        ("Bagaimana cara booking test drive BYD?", "Isi form di halaman ini atau chat WhatsApp kami. Tim kami akan menjadwalkan sesi test drive sesuai ketersediaan unit."),
        ("Berapa biaya charging mobil listrik di rumah?", "Biayanya dihitung dari kapasitas baterai dikali tarif listrik per kWh. Baca panduan lengkap beserta contoh hitungannya di artikel biaya charging mobil listrik di rumah."),
        ("Model BYD apa yang cocok untuk keluarga?", "BYD M6 berformat MPV untuk keluarga besar, sedangkan BYD Atto 3 dan Sealion 7 berformat SUV listrik. Test drive membantu Anda menilai kenyamanannya."),
    ]
    body = (
        f'<section class="hero"><div class="wrap"><h1>Mobil Listrik BYD: Harga OTR Terbaru, Promo &amp; Test Drive</h1>'
        f'<p class="lead">Konsultasi model, simulasi kredit, dan booking test drive di {esc(NAME)}. '
        f'Harga mulai Rp199 juta OTR Jakarta untuk BYD Atto 1 ({esc(SITE["price_date_label"])}).</p>'
        f'<div class="cta"><a class="btn w" href="{wa_url()}" data-wa="hero" rel="noopener">{WA_ICON} Chat WhatsApp</a>'
        f'<a class="btn o" href="#lead">Booking Test Drive</a></div>'
        f'<ul class="badges"><li>Konsultasi gratis</li><li>Simulasi kredit</li><li>Test drive</li><li>Tukar tambah</li></ul></div></section>'
        f'<section class="s" id="model"><div class="wrap"><h2>Pilih Model Mobil Listrik BYD</h2>'
        f'<p>Dari hatchback compact hingga SUV, MPV, dan sedan performa. Pilih sesuai kebutuhan Anda.</p><div class="grid">{cards}</div>'
        f'<p class="note" style="margin-top:14px">Harga OTR Jakarta, {esc(SITE["price_date_label"])}; dapat berubah. '
        f'Lihat <a href="/harga-byd/">daftar harga mobil BYD terbaru</a>.</p></div></section>'
        f'<section class="s alt"><div class="wrap"><h2>Kenapa Mobil Listrik?</h2><div class="feat">'
        f'<div><h3>Biaya energi lebih rendah</h3><p>Listrik umumnya lebih murah per kilometer daripada bensin, terutama jika diisi di rumah.</p></div>'
        f'<div><h3>Perawatan lebih sederhana</h3><p>Tanpa mesin pembakaran, tidak ada ganti oli mesin dan busi.</p></div>'
        f'<div><h3>Senyap dan halus</h3><p>Tenaga motor listrik langsung terasa dan kabin lebih tenang di kemacetan.</p></div></div>'
        f'<p style="margin-top:18px">Pelajari lebih dalam: <a href="/blog/kelebihan-dan-kekurangan-mobil-listrik/">kelebihan dan kekurangan mobil listrik</a> '
        f'dan <a href="/blog/biaya-charging-mobil-listrik-di-rumah/">biaya charging mobil listrik di rumah</a>.</p></div></section>'
        f'<section class="s"><div class="wrap"><h2>Cocok untuk Kebutuhan Apa?</h2><ul>'
        f'<li>Mobilitas kota dengan anggaran Rp200 jutaan: <a href="/byd-atto-1/">BYD Atto 1</a></li>'
        f'<li>Hatchback dengan baterai lebih besar: <a href="/byd-dolphin/">BYD Dolphin</a></li>'
        f'<li>SUV listrik keluarga: <a href="/byd-atto-3/">BYD Atto 3</a> dan <a href="/byd-sealion-7/">BYD Sealion 7</a></li>'
        f'<li>Keluarga besar: <a href="/byd-m6/">BYD M6</a></li>'
        f'<li>Sedan listrik performa: <a href="/byd-seal/">BYD Seal</a></li></ul></div></section>'
        f'{lead_section()}'
        f'<section class="s"><div class="wrap art"><h2>Pertanyaan yang Sering Diajukan</h2>{faq_html(faqs)}</div></section>')
    schema = [dealer_ld(), {"@context": "https://schema.org", "@type": "WebSite", "name": NAME, "url": url("/"), "inLanguage": "id-ID"}, faq_ld(faqs)]
    add("/", page(f"Dealer Mobil Listrik BYD: Harga OTR, Promo & Test Drive",
                  f"Dealer mobil listrik BYD: cek harga OTR terbaru, promo, simulasi kredit, dan booking test drive Atto 1, Dolphin, Atto 3, Seal, Sealion 7, M6.",
                  "/", body, schema))


def build_models():
    for m in MODELS:
        path = f"/{m['slug']}/"
        title = f"{m['name']}: Harga, Spesifikasi & Test Drive | {NAME}"
        desc = f"Cek harga OTR, varian, dan spesifikasi {m['name']}. Konsultasi gratis, simulasi kredit, dan booking test drive di {NAME}."
        spec_rows = "".join(f"<tr><th scope='row'>{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in m["specs"])
        var_html = ""
        if m["variants"]:
            rows = "".join(f"<tr><td>{esc(v['name'])}</td><td>{juta(v['price'])}</td></tr>" for v in m["variants"])
            var_html = (f'<h2>Harga {esc(m["name"])} (OTR Jakarta, {esc(SITE["price_date_label"])})</h2><div class="tw"><table>'
                        f'<thead><tr><th>Varian</th><th>Harga OTR Jakarta</th></tr></thead><tbody>{rows}</tbody></table></div>'
                        f'<p class="note">Harga dapat berubah dan berbeda antar daerah. Konfirmasi ke sales kami.</p>')
        else:
            var_html = (f'<h2>Harga {esc(m["name"])}</h2><p>Harga OTR {esc(m["name"])} berbeda per varian dan dapat berubah. '
                        f'Hubungi sales kami untuk harga yang berlaku hari ini, atau lihat <a href="/harga-byd/">daftar harga mobil BYD</a>.</p>')
        others = [x for x in MODELS if x["slug"] != m["slug"]][:3]
        rel = "".join(f'<li><a href="/{x["slug"]}/">{esc(x["name"])}</a> ({esc(x["type"])})</li>' for x in others)
        crumb_items = [("Beranda", "/"), ("Model BYD", "/#model"), (m["name"], path)]
        body = (
            f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(m["name"])}: Harga, Spesifikasi &amp; Test Drive</h1>'
            f'<p>{esc(m["tagline"])}</p><a class="btn" href="#lead">Booking Test Drive</a> '
            f'<a class="btn w" href="{wa_url("Halo, saya ingin info " + m["name"])}" data-wa="model-{m["slug"]}" rel="noopener">{WA_ICON} Tanya via WhatsApp</a></div></section>'
            f'<section class="s"><div class="wrap art"><h2>Ringkasan {esc(m["name"])}</h2>'
            + "".join(f"<p>{esc(p)}</p>" for p in m["intro"]) +
            f'<h2>Cocok untuk Siapa?</h2><ul>' + "".join(f"<li>{esc(b)}</li>" for b in m["best_for"]) + "</ul>"
            f'<h2>Spesifikasi {esc(m["name"])}</h2><div class="tw"><table><tbody>{spec_rows}</tbody></table></div>'
            f'{var_html}'
            f'<h2>Model BYD Lainnya</h2><ul>{rel}</ul>'
            f'<h2>Pertanyaan tentang {esc(m["name"])}</h2>{faq_html(m["faq"])}</div></section>'
            f'{lead_section(m["name"])}')
        schema = [breadcrumb_ld(crumb_items), faq_ld(m["faq"])]
        car = {"@context": "https://schema.org", "@type": "Car", "name": m["name"], "brand": {"@type": "Brand", "name": "BYD"},
               "description": m["tagline"], "url": url(path), "bodyType": m["type"], "fuelType": "Electric"}
        if m["variants"]:
            ps = [v["price"] for v in m["variants"]]
            car["offers"] = {"@type": "AggregateOffer", "priceCurrency": "IDR", "lowPrice": min(ps), "highPrice": max(ps),
                             "offerCount": len(ps), "seller": {"@id": url("/#dealer")}}
        schema.append(car)
        add(path, page(title, desc, path, body, schema))


def build_prices():
    path = "/harga-byd/"
    label = SITE["price_date_label"]
    rows = ""
    for m in MODELS:
        if m["variants"]:
            v = "; ".join(f'{x["name"]} {juta(x["price"])}' for x in m["variants"])
        else:
            v = "Hubungi sales untuk harga OTR terbaru"
        rows += f'<tr><td><a href="/{m["slug"]}/">{esc(m["name"])}</a></td><td>{esc(m["type"])}</td><td>{esc(v)}</td></tr>'
    faqs = [
        ("Berapa harga mobil BYD termurah?", f"BYD Atto 1 Standard dimulai dari Rp199 juta OTR Jakarta berdasarkan daftar harga {label}."),
        ("Apa arti harga OTR?", "OTR (on the road) adalah harga mobil yang sudah termasuk biaya pengurusan seperti pajak dan administrasi, sehingga siap dipakai di jalan. Besarnya bisa berbeda antar daerah."),
        ("Apakah harga mobil BYD bisa berubah?", "Bisa. Harga dan promo dapat berubah per periode. Pastikan Anda mengonfirmasi harga terbaru ke sales sebelum membeli."),
        ("Apakah tersedia cicilan untuk mobil BYD?", "Tersedia. Kami membantu simulasi uang muka, tenor, dan cicilan. Isi form di halaman ini untuk mendapatkannya."),
    ]
    crumb_items = [("Beranda", "/"), ("Harga Mobil BYD", path)]
    body = (
        f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>Harga Mobil BYD Terbaru {esc(label)} (OTR Jakarta)</h1>'
        f'<p class="meta">Diperbarui {tgl(TODAY)}</p></div></section>'
        f'<section class="s"><div class="wrap art"><p>Berikut daftar harga mobil listrik BYD di Indonesia untuk wilayah Jakarta. '
        f'Harga yang tercantum hanya model dan varian dengan harga yang sudah terkonfirmasi pada daftar yang dipublikasikan {esc(label)}. '
        f'Untuk model lain, hubungi sales kami agar mendapat harga yang berlaku hari ini.</p>'
        f'<div class="tw"><table><thead><tr><th>Model</th><th>Tipe</th><th>Varian &amp; harga OTR Jakarta</th></tr></thead><tbody>{rows}</tbody></table></div>'
        f'<p class="note">Harga dapat berubah tanpa pemberitahuan dan berbeda antar daerah. Konfirmasi ke sales {esc(NAME)}.</p>'
        f'<h2>Cara Memilih Mobil BYD Sesuai Anggaran</h2><ul>'
        f'<li>Sekitar Rp200 jutaan: <a href="/byd-atto-1/">BYD Atto 1</a> dengan tiga varian</li>'
        f'<li>Rp300 jutaan hingga Rp400 jutaan: <a href="/byd-dolphin/">BYD Dolphin</a> varian Dynamic atau Premium</li>'
        f'<li>Butuh ruang keluarga: <a href="/byd-m6/">BYD M6</a> atau <a href="/byd-atto-3/">BYD Atto 3</a></li>'
        f'<li>Performa dan fitur premium: <a href="/byd-seal/">BYD Seal</a> atau <a href="/byd-sealion-7/">BYD Sealion 7</a></li></ul>'
        f'<p>Sebelum memutuskan, baca <a href="/blog/kelebihan-dan-kekurangan-mobil-listrik/">kelebihan dan kekurangan mobil listrik</a> '
        f'dan hitung <a href="/blog/biaya-charging-mobil-listrik-di-rumah/">biaya charging di rumah</a>.</p>'
        f'<h2>Pertanyaan tentang Harga Mobil BYD</h2>{faq_html(faqs)}</div></section>'
        f'{lead_section(h2="Minta Harga &amp; Simulasi Cicilan Terbaru")}')
    schema = [breadcrumb_ld(crumb_items), faq_ld(faqs)]
    add(path, page(f"Harga Mobil BYD Terbaru {label} (OTR Jakarta)",
                   f"Daftar harga mobil BYD terbaru {label} OTR Jakarta: Atto 1, Dolphin, Atto 3, Seal, Sealion 7, dan M6. Minta simulasi cicilan gratis.",
                   path, body, schema))


def build_testdrive():
    path = "/test-drive/"
    crumb_items = [("Beranda", "/"), ("Test Drive", path)]
    faqs = [
        ("Apa yang perlu dibawa saat test drive?", "Bawa SIM A yang masih berlaku dan identitas diri. Tim kami akan menginformasikan detail lainnya saat konfirmasi jadwal."),
        ("Apakah test drive dikenakan biaya?", "Silakan konfirmasi ke sales kami saat menjadwalkan sesi."),
        ("Model apa saja yang bisa dites?", "Ketersediaan unit test drive berbeda tiap periode. Tim kami akan mengonfirmasi model yang tersedia sebelum jadwal."),
    ]
    body = (
        f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>Booking Test Drive Mobil Listrik BYD</h1>'
        f'<p>Rasakan langsung kenyamanan berkendara mobil listrik BYD. Isi form, kami jadwalkan.</p></div></section>'
        f'{lead_section(h2="Jadwalkan Test Drive Anda", alt=False)}'
        f'<section class="s alt"><div class="wrap art"><h2>Langkah Booking Test Drive</h2><ol>'
        f'<li>Isi form dan pilih model yang ingin dicoba.</li><li>Tim kami menghubungi Anda lewat WhatsApp untuk konfirmasi jadwal.</li>'
        f'<li>Datang ke dealer pada waktu yang disepakati dan coba langsung.</li></ol>'
        f'<h2>Pertanyaan tentang Test Drive</h2>{faq_html(faqs)}</div></section>')
    schema = [breadcrumb_ld(crumb_items), faq_ld(faqs)]
    add(path, page(f"Booking Test Drive Mobil Listrik BYD | {NAME}",
                   f"Booking test drive mobil listrik BYD di {NAME}. Isi form, kami jadwalkan sesi test drive dan kirim penawaran lewat WhatsApp.",
                   path, body, schema))


def build_blog():
    arts = sorted((parse_article(p) for p in (SRC / "articles").glob("*.md")), key=lambda a: a["date"], reverse=True)
    kw_seen = {}
    for a in arts:
        kw_seen[a["keyword"]] = kw_seen.get(a["keyword"], 0) + 1
        if kw_seen[a["keyword"]] > 1:
            WARN.append(f"Kanibalisasi keyword: '{a['keyword']}' dipakai >1 artikel")
        path = f"/blog/{a['slug']}/"
        words = len(a["body_text"].split())
        mins = max(1, round(words / 200))
        crumb_items = [("Beranda", "/"), ("Blog", "/blog/"), (a["h1"], path)]
        toc = "".join(f'<li><a href="#{i}">{esc(t)}</a></li>' for t, i in a["heads"])
        faq_block = (f'<h2 id="faq">FAQ</h2>{faq_html(a["faqs"])}') if a["faqs"] else ""
        body = (
            f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>{esc(a["h1"])}</h1>'
            f'<p class="meta">{esc(a.get("category", "Panduan"))} · Diterbitkan {tgl(a["date"])} · {mins} menit baca</p></div></section>'
            f'<article class="s"><div class="wrap art"><nav class="toc" aria-label="Daftar isi"><b>Daftar isi</b><ol>{toc}</ol></nav>'
            f'{a["html"]}{faq_block}'
            f'<div class="cta-box"><h2 style="color:#fff;margin-top:0">Ingin Mencoba Mobil Listrik BYD?</h2>'
            f'<p>Konsultasi gratis, simulasi cicilan, dan booking test drive di {esc(NAME)}.</p>'
            f'<a class="btn w" href="/test-drive/">Booking Test Drive</a></div></div></article>')
        art_ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": a["h1"][:110],
                  "description": a["description"], "datePublished": a["date"], "dateModified": a.get("updated", a["date"]),
                  "inLanguage": "id-ID", "mainEntityOfPage": url(path), "image": url("/assets/og-default.png"),
                  "author": {"@type": "Organization", "name": NAME, "url": url("/")},
                  "publisher": {"@type": "Organization", "name": NAME, "url": url("/")}}
        schema = [breadcrumb_ld(crumb_items), art_ld] + ([faq_ld(a["faqs"])] if a["faqs"] else [])
        add(path, page(a["title"], a["description"], path, body, schema, og_type="article"), a.get("updated", a["date"]))
        a["path"] = path
    items = "".join(
        f'<a class="card" href="{a["path"]}"><div class="bd"><span class="tp">{esc(a.get("category", "Panduan"))} · {tgl(a["date"])}</span>'
        f'<h2 style="font-size:1.15rem">{esc(a["h1"])}</h2><p>{esc(a["description"])}</p><span class="more">Baca artikel →</span></div></a>' for a in arts)
    crumb_items = [("Beranda", "/"), ("Blog", "/blog/")]
    body = (f'<section class="sub"><div class="wrap">{crumbs(crumb_items)}<h1>Blog Mobil Listrik BYD: Panduan &amp; Tips</h1>'
            f'<p>Panduan memilih, menghitung biaya, dan merawat mobil listrik.</p></div></section>'
            f'<section class="s"><div class="wrap"><div class="grid">{items}</div></div></section>')
    add("/blog/", page(f"Blog Mobil Listrik BYD: Panduan & Tips | {NAME}",
                       "Panduan memilih mobil listrik, menghitung biaya charging, perbandingan model BYD, dan tips perawatan dari tim BYD Harmony.",
                       "/blog/", body, [breadcrumb_ld(crumb_items)]))


def build_404():
    body = ('<section class="s"><div class="wrap art"><h1>Halaman tidak ditemukan</h1>'
            '<p>Maaf, halaman yang Anda cari tidak ada. Coba lihat <a href="/harga-byd/">harga mobil BYD</a> '
            'atau kembali ke <a href="/">beranda</a>.</p></div></section>')
    add("/404.html", page(f"Halaman Tidak Ditemukan | {NAME}", "Halaman tidak ditemukan.", "/404.html", body, robots="noindex,follow"), index=False)


# ---------------------------------------------------------------- Output
def og_image():
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        WARN.append("Pillow tidak ada: og-default.png tidak dibuat (tambahkan manual 1200x630)")
        return
    W, H = 1200, 630
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        for x in range(W):
            t = (x / W * 0.6 + y / H * 0.4)
            px[x, y] = (int(7 + 0 * t), int(20 + 70 * t), int(38 + 55 * t))
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
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    img.save(OUT / "assets/og-default.png", optimize=True)


def write_all():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / "assets").mkdir(parents=True, exist_ok=True)
    og_image()
    shutil.copy(SRC / "assets/app.js", OUT / "assets/app.js")
    for path, html_, _, _ in PAGES:
        f = OUT / (path.lstrip("/") + "index.html") if path.endswith("/") else OUT / path.lstrip("/")
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(html_, encoding="utf-8")
    urls = "".join(f"<url><loc>{url(p)}</loc><lastmod>{lm}</lastmod></url>" for p, _, lm, idx in PAGES if idx)
    (OUT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>", encoding="utf-8")
    (OUT / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {url('/sitemap.xml')}\n", encoding="utf-8")
    (OUT / ".nojekyll").write_text("")
    if "DOMAIN-ANDA" not in DOMAIN:
        (OUT / "CNAME").write_text(DOMAIN.split("://", 1)[1] + "\n")


def main():
    build_home(); build_models(); build_prices(); build_testdrive(); build_blog(); build_404()
    write_all()
    if "DOMAIN-ANDA" in DOMAIN:
        WARN.append("TODO: isi 'domain' di src/data/site.json (canonical, sitemap, schema memakai domain ini)")
    if SITE["wa_number"] == "6281234567890":
        WARN.append("TODO: isi 'wa_number' dan 'phone_display' dengan nomor WhatsApp dealer")
    if "ALAMAT" in SITE["address"]:
        WARN.append("TODO: isi 'address', 'postal', 'hours' dealer (penting untuk local SEO & schema)")
    if not SITE["firebase"].get("projectId"):
        WARN.append("TODO: isi 'firebase' di site.json agar lead tersimpan ke Firestore (sementara hanya ke WhatsApp)")
    if not SITE.get("ga4_id"):
        WARN.append("Opsional: isi 'ga4_id' untuk pelacakan konversi; isi 'gsc_verification' untuk Search Console")
    print(f"Build selesai: {len(PAGES)} halaman -> {OUT}")
    for w in WARN:
        print("  !", w)


if __name__ == "__main__":
    sys.exit(main())

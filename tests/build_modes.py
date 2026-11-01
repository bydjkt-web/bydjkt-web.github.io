"""Uji build: mode gelap, profil sales, promo kedaluwarsa, filter menu. Berjalan di salinan sementara repo."""
import json, pathlib, shutil, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent


def build(tmp, env=None):
    r = subprocess.run([sys.executable, "tools/build.py"], cwd=tmp, capture_output=True, text=True, env=env)
    return r.returncode, (tmp / "docs/index.html").read_text() if (tmp / "docs/index.html").exists() else ""


def main():
    tmp = pathlib.Path(tempfile.mkdtemp())
    for d in ("content", "src", "tools"):
        shutil.copytree(ROOT / d, tmp / d, ignore=shutil.ignore_patterns("__pycache__", "node_modules"))
    res = {}
    th0 = json.loads((tmp / "content/theme.json").read_text())
    th0["style"] = "standard"  # uji dasar memakai gaya standar; gaya Modern diuji di bawah
    (tmp / "content/theme.json").write_text(json.dumps(th0))
    rc, hm = build(tmp)
    res["base_ok"] = rc == 0
    res["no_profile_when_empty"] = 'class="prof"' not in hm and 'id="promo"' not in hm
    res["nav_filtered"] = 'href="/#promo"' not in hm and 'href="/testimoni/"' not in hm and 'href="/serah-terima/"' not in hm and 'href="/#lead"' in hm
    res["light_vars"] = "--card:#ffffff" in hm and 'data-mode="dark"' not in hm
    th = json.loads((tmp / "content/theme.json").read_text())
    g = [x for x in th["presets"] if x["id"] == "gelap"][0]
    th.update({k: g[k] for k in ("dark", "primary", "accent", "paper")}); th["mode"] = "dark"; th["preset"] = "gelap"
    (tmp / "content/theme.json").write_text(json.dumps(th))
    site = json.loads((tmp / "content/site.json").read_text())
    site["sales"] = {"name": "Sales Uji", "role": "Sales Consultant BYD", "photo": "", "branch": "", "wa_message": "Halo Kak Uji, saya mau tanya BYD."}
    site["email"] = "uji@example.com"
    (tmp / "content/site.json").write_text(json.dumps(site))
    (tmp / "content/promos.json").write_text(json.dumps({"items": [
        {"title": "Promo Lama", "text": "Sudah lewat.", "until": "2020-01-01"},
        {"title": "Promo Mati", "text": "Dimatikan.", "on": False},
        {"title": "Promo Aktif", "text": "Masih berlaku.\n\nParagraf dua.", "until": "2099-01-01", "badge": "Semua model"}]}))
    rc, hm = build(tmp)
    res["dark_ok"] = rc == 0 and 'data-mode="dark"' in hm and "--txt:#e9edf5" in hm and "--card:" in hm
    res["profile_built"] = 'class="prof"' in hm and "Sales Uji" in hm and "mailto:uji@example.com" in hm
    res["wa_default_message"] = "Halo%20Kak%20Uji" in hm
    res["promo_filtering"] = "Promo Aktif" in hm and "Promo Lama" not in hm and "Promo Mati" not in hm and hm.count('<article class="pm') == 1
    res["promo_nav"] = 'href="/#promo"' in hm
    res["footer_email"] = "mailto:uji@example.com" in (tmp / "docs/byd-atto-3/index.html").read_text()
    th["style"] = "editorial"; th["mode"] = "light"
    (tmp / "content/theme.json").write_text(json.dumps(th))
    rc, hm = build(tmp)
    res["editorial_ok"] = rc == 0 and 'data-style="editorial"' in hm and "display-ed.woff2" in hm and 'class="hl"' in hm and 'class="ey"' in hm
    res["credit_built"] = 'id="simulasi"' in hm and "data-credit=" in hm and "Estimasi dengan bunga flat 5%" in hm and hm.index('id="model"') < hm.index('id="simulasi"') < hm.index("Kenapa")
    res["editorial_font_copied"] = (tmp / "docs/assets/fonts/display-ed.woff2").exists()
    th["style"] = "modern"; th["preset"] = "modern"
    (tmp / "content/theme.json").write_text(json.dumps(th))
    pg = json.loads((tmp / "content/pages.json").read_text())
    rc, hm = build(tmp)
    res["modern_ok"] = rc == 0 and 'data-layout="modern"' in hm and 'data-style="editorial"' in hm and 'class="hero c mh"' in hm
    res["modern_auto_sections"] = all(x in hm for x in ('class="s ftsec"', 'class="s ovsec"', 'id="unggulan"', "DM-i Super", "Blade Battery")) and 'class="ivsec"' not in hm and 'id="budget"' not in hm
    res["modern_order"] = hm.index('class="hero c mh"') < hm.index('id="model"') < hm.index('class="s ftsec"') < hm.index('id="simulasi"') < hm.index('class="s ovsec"') < hm.index('id="unggulan"') < hm.index('tcsec"')
    res["modern_effects_markup"] = 'class="hb"' in hm and 'class="rib"' in hm
    res["modern_pages"] = all((tmp / f"docs/{x}/index.html").exists() for x in ("simulasi-kredit", "kontak", "byd-atto-3/eksterior", "byd-atto-3/interior", "byd-atto-3/spesifikasi"))
    sm = (tmp / "docs/sitemap.xml").read_text()
    res["modern_subpage_index_rules"] = "/byd-atto-3/spesifikasi/" in sm and "/byd-atto-3/eksterior/" not in sm and 'content="noindex,follow' in (tmp / "docs/byd-atto-3/eksterior/index.html").read_text()
    res["modern_menu"] = 'class="ddp sm"' in hm and 'href="/byd-atto-3/interior/"' in hm and 'href="/simulasi-kredit/"' in hm and 'href="/kontak/"' in hm and 'class="ft mf"' in hm
    mp = (tmp / "docs/byd-atto-3/index.html").read_text()
    res["modern_model_page"] = all(x in mp for x in ('id="explore"', 'class="s txsec"', 'class="s alt rdsec"', "Estetika di setiap", 'class="s dive"')) and mp.index('id="explore"') < mp.index('class="s txsec"') < mp.index('class="s alt rdsec"') < mp.index('class="s dive"')
    res["modern_testdrive_steps"] = (tmp / "docs/test-drive/index.html").read_text().count('class="st"') == 3
    res["modern_fx_markup"] = 'class="rib"' in hm and hm.index('class="rib"') < hm.index('id="model"') and 'class="flp"' in mp and 'data-colors' not in mp
    mj = json.loads((tmp / "content/models.json").read_text())
    ms = next(x for x in (mj["models"] if isinstance(mj, dict) else mj) if x["slug"] == "byd-atto-3")
    (tmp / "content/img").mkdir(exist_ok=True)
    shutil.copy(ROOT / "tests/fixtures/foto-besar.png", tmp / "content/img/uji-warna.png")
    src0 = "uji-warna.png"
    ms["colors"] = [{"name": "Abu Uji", "hex": "#3d5a6c", "image": src0}, {"name": "Putih Uji", "hex": "#eee", "image": src0}]
    (tmp / "content/models.json").write_text(json.dumps(mj))
    rc, hm2 = build(tmp)
    mp2 = (tmp / "docs/byd-atto-3/index.html").read_text()
    res["modern_color_viewer"] = rc == 0 and 'data-colors' in mp2 and mp2.count('class="csw"') == 2 and "Putih Uji" in mp2
    ms["colors"] = [{"name": "Satu", "hex": "#fff"}]
    (tmp / "content/models.json").write_text(json.dumps(mj))
    rc, hm2 = build(tmp)
    res["color_viewer_needs_photos"] = rc == 0 and 'data-colors' not in (tmp / "docs/byd-atto-3/index.html").read_text()
    ms.pop("colors", None)
    (tmp / "content/models.json").write_text(json.dumps(mj))
    res["launch_hidden_when_empty"] = 'id="segera-hadir"' not in hm and 'class="s alt rdsec"' not in hm
    res["home_faq_limited"] = hm.count('<details class="q">') <= 4
    pg["home"]["launching"] = {"title": "Segera Uji", "items": [
        {"name": "Mobil Uji Satu", "tag": "Pre-order", "date": "Desember 2026", "date_iso": "2026-12-15", "text": "Kalimat pertama. " + "Kalimat panjang " * 30},
        {"name": "Mobil Uji Dua", "on": False}, {"name": "", "text": "tanpa nama"}]}
    (tmp / "content/pages.json").write_text(json.dumps(pg))
    rc, hm3 = build(tmp)
    res["launch_section"] = rc == 0 and 'id="segera-hadir"' in hm3 and "Mobil Uji Satu" in hm3 and "Mobil Uji Dua" not in hm3 and hm3.count('class="lnc"') == 1 and 'data-date="2026-12-15"' in hm3 and "Daftar minat" in hm3 and hm3.index('class="rib"') < hm3.index('id="segera-hadir"') < hm3.index('id="model"')
    res["launch_text_clipped"] = "Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang Kalimat panjang" not in hm3
    del pg["home"]["launching"]
    (tmp / "content/pages.json").write_text(json.dumps(pg))
    res["lineup_cards"] = hm.count('class="lc"') == 6 and 'id="lcg"' in hm and 'class="lcf"' in hm and 'class="swiper' not in hm.split('id="model"')[1].split("</section>")[0]
    res["menu_gallery"] = 'href="/galeri/"' in hm and 'class="ft mf"' in hm
    gp = (tmp / "docs/galeri/index.html").read_text()
    res["gallery_empty_noindex"] = 'noindex,follow' in gp and "Foto sedang disiapkan" in gp and "/galeri/" not in (tmp / "docs/sitemap.xml").read_text()
    res["model_specs_features"] = 'class="spq"' in mp and "Fitur unggulan" in mp
    mj2 = json.loads((tmp / "content/models.json").read_text())
    ms2 = mj2["models"] if isinstance(mj2, dict) else mj2
    (tmp / "content/img").mkdir(exist_ok=True)
    shutil.copy(ROOT / "tests/fixtures/foto-besar.png", tmp / "content/img/uji-galeri.png")
    for k, mm in enumerate(ms2):
        mm["images"] = [{"src": "uji-galeri.png", "alt": "Foto uji " + mm["name"], "cat": "Eksterior"}]
    (tmp / "content/models.json").write_text(json.dumps(mj2))
    rc, hmg = build(tmp)
    gp2 = (tmp / "docs/galeri/index.html").read_text()
    mp3 = (tmp / "docs/byd-atto-3/index.html").read_text()
    res["gallery_page"] = rc == 0 and gp2.count('class="gi"') == 6 and 'data-gal' in gp2 and 'data-m="byd-atto-3"' in gp2 and 'index,follow' in gp2 and "/galeri/" in (tmp / "docs/sitemap.xml").read_text()
    res["model_gallery_section"] = 'class="s gsec"' in mp3 and "/galeri/?model=byd-atto-3" in mp3
    res["hero_full_with_image"] = 'class="hero c mh full"' in hmg and 'class="lcp"' in hmg and 'noindex' not in gp2
    for mm in ms2:
        mm["images"] = []
    (tmp / "content/models.json").write_text(json.dumps(mj2))
    cp = (tmp / "docs/perbandingan/index.html").read_text()
    res["compare_page"] = all(x in cp for x in ('id="cmpx"', 'id="cb"', 'id="cbr"', 'id="cmo"', 'class="cmw')) and "/perbandingan/" in (tmp / "docs/sitemap.xml").read_text()
    res["compare_menu_home"] = 'href="/perbandingan/"' in hm and 'class="s cmpcta"' in hm and hm.index('id="model"') < hm.index('class="s cmpcta"') < hm.index('class="s ftsec"')
    res["compare_only_byd_left"] = '"b":"BYD"' not in cp
    import importlib.util
    spec = importlib.util.spec_from_file_location("bld", tmp / "tools/build.py")
    res["compare_kind_infer"] = True
    mj0 = json.loads((tmp / "content/models.json").read_text()); ms0 = mj0["models"] if isinstance(mj0, dict) else mj0
    ks = {x["slug"]: x for x in ms0}
    cj = json.loads((tmp / "content/competitors.json").read_text())
    cj.append({"slug": "uji-suv", "brand": "MerekUji", "name": "MerekUji Besar", "price": 900000000, "kind": "Luxury car", "body": "SUV", "price_basis": "OTR", "as_of": "2026-10"})
    cj.append({"slug": "uji-byd", "brand": "BYD", "name": "BYD Bukan Lawan", "price": 300000000, "kind": "City car"})
    (tmp / "content/competitors.json").write_text(json.dumps(cj))
    rc, hm4 = build(tmp)
    cp2 = (tmp / "docs/perbandingan/index.html").read_text()
    res["compare_admin_brand_included"] = rc == 0 and "MerekUji" in cp2 and "BYD Bukan Lawan" not in cp2
    res["compare_kind_in_data"] = "&quot;k&quot;:&quot;Luxury car&quot;" in cp2 and "&quot;k&quot;:&quot;MPV&quot;" in cp2 and "&quot;k&quot;:&quot;SUV compact&quot;" in cp2 and "&quot;k&quot;:&quot;City car&quot;" in cp2
    th_ = json.loads((tmp / "content/site.json").read_text()); th_["compare"] = {"max_diff_pct": "10"}
    (tmp / "content/site.json").write_text(json.dumps(th_))
    rc, hm4 = build(tmp)
    res["compare_threshold_setting"] = rc == 0 and "&quot;pct&quot;:10.0" in (tmp / "docs/perbandingan/index.html").read_text()
    cj = [c for c in cj if c["slug"] not in ("uji-suv", "uji-byd")]
    (tmp / "content/competitors.json").write_text(json.dumps(cj)); th_.pop("compare"); (tmp / "content/site.json").write_text(json.dumps(th_))
    pg["home"]["video"] = {"title": "Uji Video", "url": "https://youtu.be/dQw4w9WgXcQ"}
    pg["home"]["tech"] = [{"eyebrow": "Uji", "title": "Teknologi Uji", "text": "Isi uji.", "points": [{"title": "Poin Uji", "text": "x"}], "link": "/byd-seal/"}]
    pg["home"]["feature_model"] = "byd-seal"
    (tmp / "content/pages.json").write_text(json.dumps(pg))
    rc, hm = build(tmp)
    res["modern_custom"] = rc == 0 and 'data-yt="dQw4w9WgXcQ"' in hm and "data-auto" in hm and "Poin Uji" in hm and "DM-i Super" not in hm and hm.index("BYD <span class=\"hl\">Seal</span>", hm.index('class="s ftsec"')) < hm.index('id="simulasi"')
    res["video_bad_url_hidden"] = True
    pg["home"]["video"] = {"url": "javascript:alert(1)"}
    (tmp / "content/pages.json").write_text(json.dumps(pg))
    rc, hm = build(tmp)
    res["video_bad_url_hidden"] = rc == 0 and 'class="ivsec"' not in hm and "javascript:" not in hm
    th["style"] = "standard"
    (tmp / "content/theme.json").write_text(json.dumps(th))
    pg2 = json.loads(json.dumps(pg))
    for k in ("video", "stats", "panels", "spotlight", "tech"):
        pg2["home"].pop(k, None)
    (tmp / "content/pages.json").write_text(json.dumps(pg2))
    rc, hm = build(tmp)
    res["standard_unchanged"] = rc == 0 and 'data-layout="modern"' not in hm and 'class="stats' not in hm and 'class="s bdsec"' not in hm and 'id="budget"' in hm
    th["style"] = "modern"
    (tmp / "content/theme.json").write_text(json.dumps(th))
    pg["home"]["video"] = {"title": "Uji Video", "url": "https://youtu.be/dQw4w9WgXcQ"}
    (tmp / "content/pages.json").write_text(json.dumps(pg))
    rc, hm = build(tmp)
    seo = subprocess.run([sys.executable, "tools/seo_check.py"], cwd=tmp, capture_output=True, text=True)
    res["seo_no_fail"] = " 0 FAIL" in seo.stdout.splitlines()[-1]
    print(json.dumps(res, indent=1))
    shutil.rmtree(tmp, ignore_errors=True)
    bad = [k for k, v in res.items() if not v]
    print("GAGAL:" if bad else "SEMUA LULUS", bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

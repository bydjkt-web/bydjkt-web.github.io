"""E2E admin: GitHub Git Data API dipalsukan (in-memory); hasil commit dibangun ulang dengan build.py asli."""
import base64, hashlib, http.server, io, json, os, pathlib, re, shutil, subprocess, sys, threading, zipfile, tempfile
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8123
O, R = "wins", "byd-harmony"
API = "https://api.github.com"


def gsha(b): return hashlib.sha1(b"blob %d\0" % len(b) + b).hexdigest()


class Repo:
    def __init__(self):
        self.files = {}
        for base in ("content", "tools", "src", "firebase", ".github"):
            for p in (ROOT / base).rglob("*"):
                if p.is_file() and "__pycache__" not in p.parts:
                    self.files[str(p.relative_to(ROOT))] = p.read_bytes()
        self.files["data/report.json"] = (ROOT / "tests/fixtures/report.json").read_bytes()
        self.blobs = {gsha(b): b for b in self.files.values()}
        self.head = "c0"; self.commits = {"c0": dict(self.files)}; self.n = 0; self.log = []; self.dispatched = []

    def tree(self): return [{"path": p, "type": "blob", "sha": gsha(b), "mode": "100644"} for p, b in sorted(self.files.items())]


def handler(repo):
    def h(route, request):
        url = request.url.replace(API, ""); m = request.method
        def ok(obj, status=200): route.fulfill(status=status, content_type="application/json", body=json.dumps(obj), headers={"access-control-allow-origin": "*"})
        base = f"/repos/{O}/{R}"
        if m == "OPTIONS":
            return route.fulfill(status=204, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
        if url == base: return ok({"permissions": {"push": True}, "default_branch": "main"})
        if url.startswith(base + "/git/trees/main"): return ok({"tree": repo.tree(), "truncated": False})
        mm = re.match(base + r"/git/blobs/(\w+)", url)
        if mm and m == "GET":
            return route.fulfill(status=200, body=repo.blobs[mm.group(1)], headers={"access-control-allow-origin": "*", "content-type": "application/octet-stream"})
        if url == base + "/git/blobs" and m == "POST":
            b = base64.b64decode(json.loads(request.post_data)["content"]); s = gsha(b); repo.blobs[s] = b; return ok({"sha": s}, 201)
        if url.startswith(base + "/git/ref/heads/main"): return ok({"object": {"sha": repo.head}})
        if url.startswith(base + "/git/commits/") and m == "GET": return ok({"tree": {"sha": "t-" + repo.head}})
        if url == base + "/git/trees" and m == "POST":
            body = json.loads(request.post_data); files = dict(repo.commits[repo.head])
            for e in body["tree"]:
                if e["sha"] is None: files.pop(e["path"], None)
                else: files[e["path"]] = repo.blobs[e["sha"]]
            repo.n += 1; tid = f"tree{repo.n}"; repo.commits["T" + tid] = files; return ok({"sha": tid}, 201)
        if url == base + "/git/commits" and m == "POST":
            body = json.loads(request.post_data); cid = f"c{repo.n}"; repo.commits[cid] = repo.commits["T" + body["tree"]]; repo.log.append(body["message"]); return ok({"sha": cid}, 201)
        if url.startswith(base + "/git/refs/heads/main") and m == "PATCH":
            repo.head = json.loads(request.post_data)["sha"]; repo.files = dict(repo.commits[repo.head]); return ok({"ref": "ok"})
        if url.startswith(base + "/actions/runs"):
            return ok({"workflow_runs": [{"name": "Build & Deploy", "conclusion": "success", "status": "completed", "html_url": "https://github.com/x", "created_at": "2026-10-15T10:00:00Z", "head_commit": {"message": "Update"}}]})
        if "/dispatches" in url: repo.dispatched.append(url); return route.fulfill(status=204, headers={"access-control-allow-origin": "*"})
        return ok({"message": "unmocked " + url}, 404)
    return h


def serve():
    os.chdir(ROOT / "docs")
    s = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), http.server.SimpleHTTPRequestHandler)
    s.RequestHandlerClass.log_message = lambda *a, **k: None
    threading.Thread(target=s.serve_forever, daemon=True).start()
    return s


def main():
    subprocess.check_call([sys.executable, str(ROOT / "tools/build.py")], stdout=subprocess.DEVNULL)
    (ROOT / "tests/fixtures/report.json").write_text(json.dumps({
        "generated": "2026-10-15T01:00:00Z", "range": {"startDate": "2026-09-17", "endDate": "2026-10-14"}, "property": "x",
        "pages": [{"page": "https://x.com/blog/biaya-charging-mobil-listrik-di-rumah/", "clicks": 12, "impressions": 340, "ctr": 0.035, "position": 8.4}],
        "keywords": [{"q": "harga mobil listrik", "tier": "hard", "target": "/harga-mobil-listrik/", "position": 31.2, "clicks": 1, "impressions": 90, "page": None}],
        "top_queries": [{"query": "biaya isi daya mobil listrik", "page": "https://x.com/blog/biaya-charging-mobil-listrik-di-rumah/", "position": 12.0, "clicks": 2, "impressions": 80}],
        "inspection": {"https://x.com/blog/biaya-charging-mobil-listrik-di-rumah/": {"verdict": "PASS", "coverage": "Submitted and indexed", "lastCrawl": "2026-10-12T03:00:00Z"}}}))
    repo = Repo(); srv = serve(); errors = []; res = {}
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={"width": 1280, "height": 900}); pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "favicon" not in m.text and "404" not in m.text else None)
        ctx.route(API + "/**", handler(repo))
        pg.goto(f"http://127.0.0.1:{PORT}/admin/")
        # 1 login salah repo lalu benar
        pg.fill("#lg_owner", O); pg.fill("#lg_repo", R); pg.fill("#lg_token", "github_pat_test"); pg.click("#lg_go")
        pg.wait_for_selector("nav.side"); res["login"] = True
        pg.wait_for_selector(".pill.ok"); res["dashboard_runs"] = "Build & Deploy" in pg.inner_text("#main")
        # 2 artikel baru
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/artikel/baru"); pg.wait_for_selector("#a_keyword")
        pg.fill("#a_keyword", "byd seal vs mazda 6e"); pg.fill("#a_title", "BYD Seal vs Mazda 6e: Sedan Listrik Mana yang Pas?")
        pg.fill("#a_answer", "BYD Seal unggul pada tenaga dan jarak tempuh, sedangkan Mazda 6e menonjol pada kenyamanan berkendara. Pilih sesuai prioritas dan anggaran Anda sebelum test drive keduanya."); res["answer_field"] = True
        pg.fill("#a_description", "BYD Seal vs Mazda 6e: bandingkan harga, baterai, tenaga, dan jarak tempuh sedan listrik sebelum membeli di dealer.")
        pg.fill("#a_body", "BYD Seal vs Mazda 6e adalah duel sedan listrik premium.\n\n## Tabel\n\n{{compare byd-seal mazda-6e}}\n\n## Harga\n\nLihat [harga](/harga-byd/) dan [Seal](/byd-seal/).\n\n## Spesifikasi\n\nIsi.\n\n## FAQ\n\n### Mana lebih murah?\n\nSeal.\n\n### Apa bedanya?\n\nBanyak.\n")
        pg.wait_for_timeout(400)
        score = int(pg.inner_text("#score")); res["score"] = score
        res["slug_auto"] = pg.input_value("#a_slug") == "byd-seal-vs-mazda-6e"
        res["serp"] = "byd-seal-vs-mazda-6e" in pg.inner_text(".serp")
        res["preview_stub"] = "compare" in pg.inner_html("#preview")
        pg.select_option("#a_status", "scheduled"); pg.fill("#a_publish_at", "2030-01-10T08:00")
        pg.select_option("#a_pillar", "harga-mobil-listrik")
        pg.click("#savebtn"); pg.wait_for_selector("#bar:not([hidden])")
        # 3 pengaturan + layout
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/pengaturan"); pg.wait_for_selector("#f_domain")
        pg.fill("#f_domain", "https://harmony-byd.co.id"); pg.fill("#f_wa_number", "6281299998888")
        pg.fill("#f_about_text", "BYD Harmony melayani konsultasi, simulasi kredit, dan test drive mobil listrik BYD untuk area Jabodetabek dan sekitarnya.\n\nTim sales kami mendampingi dari pemilihan model sampai serah terima unit."); pg.fill("#f_maps_url", "https://maps.app.goo.gl/contoh"); pg.fill("#f_lat", "-6.2088"); pg.fill("#f_lng", "106.8456")
        pg.select_option("#f_ai_crawlers", "search_only")
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/layout"); pg.wait_for_selector(".lay li")
        first = pg.inner_text(".lay li >> nth=0 >> .nm"); pg.click(".lay li >> nth=1 >> button >> nth=0")
        res["layout_moved"] = pg.inner_text(".lay li >> nth=0 >> .nm") != first
        # 4 media
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/media"); pg.wait_for_selector("#imgfile")
        pg.set_input_files("#imgfile", str(ROOT / "tests/fixtures/foto-besar.png")); pg.wait_for_selector(".media .m img")
        # 4b tema + leasing
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/tema"); pg.wait_for_selector(".preset")
        pg.click(".preset[data-id=merah]"); res["tema_preset"] = "sel" in (pg.get_attribute(".preset[data-id=merah]", "class") or "")
        pg.click(".preset[data-id=atlantic]")
        pg.fill(".pick >> nth=2 >> input[type=text]", "#1f6f8b"); pg.dispatch_event(".pick >> nth=2 >> input[type=text]", "change")
        res["tema_custom"] = "Teks tombol" in pg.inner_text(".tcheck")
        pg.click(".preset[data-id=gelap]"); res["tema_gelap"] = pg.is_checked("#dkmode") and "sel" in (pg.get_attribute(".preset[data-id=gelap]", "class") or "")
        pg.click(".preset[data-id=atlantic]"); res["tema_terang_lagi"] = not pg.is_checked("#dkmode")
        pg.fill(".pick >> nth=2 >> input[type=text]", "#1f6f8b"); pg.dispatch_event(".pick >> nth=2 >> input[type=text]", "change")
        # profil sales + promo
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/sales"); pg.wait_for_selector(".card")
        pg.get_by_label("Nama sales").fill("Dewi Uji"); pg.get_by_label("Jabatan").fill("Sales Consultant BYD"); pg.get_by_label("Email", exact=True).fill("dewi@example.com")
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/promo"); pg.wait_for_selector(".card")
        pg.click("text=+ Tambah"); pg.wait_for_selector(".sub-item")
        res["promo_on_default"] = pg.get_by_label("Tayangkan promo ini").is_checked()
        pg.get_by_label("Judul promo").fill("Promo Uji Akhir Tahun"); pg.get_by_label("Isi promo").fill("Bonus aksesori untuk pembelian unit BYD bulan ini.")
        pg.get_by_label("Berlaku sampai").fill("2099-12-31")
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/leasing"); pg.wait_for_selector(".card")
        pg.click("text=+ Tambah logo leasing"); pg.wait_for_selector(".lrow")
        pg.fill(".lrow input[type=text]", "Leasing Uji"); pg.fill(".lrow input[type=url]", "https://example.com")
        pg.set_input_files(".lrow input[type=file]", str(ROOT / "tests/fixtures/foto-besar.png")); pg.wait_for_selector(".lbox img")
        # 4c popup pilih gambar + testimoni + serah terima
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/serah-terima"); pg.wait_for_selector(".card")
        pg.click("text=+ Tambah"); pg.wait_for_selector(".sub-item")
        pg.fill(".sub-item >> input[type=text] >> nth=0", "Ibu Sari"); pg.click(".sub-item >> text=Pilih gambar >> nth=0")
        pg.wait_for_selector(".pk-ov .pk-it"); res["picker_open"] = pg.locator(".pk-ov .pk-it").count() >= 1
        pg.wait_for_function("document.querySelector('.pk-ph img') && document.querySelector('.pk-ph img').src.startsWith('blob:')", timeout=8000) if False else pg.wait_for_selector(".pk-ph img[src^='blob:']", timeout=8000)
        res["picker_thumb"] = True; pg.screenshot(path="/tmp/t2/picker.png")
        pg.fill(".pk-h input[type=search]", "zzz-tidak-ada"); res["picker_search"] = pg.locator(".pk-it").count() == 0
        pg.fill(".pk-h input[type=search]", ""); pg.click(".pk-ov .pk-it >> nth=0"); pg.wait_for_selector(".imgf-th img")
        res["picker_closed"] = pg.locator(".pk-ov").count() == 0
        pg.fill(".sub-item textarea >> nth=0", "Penyerahan kunci unit"); 
        pg.check(".sub-item >> text=Customer sudah memberi izin"); pg.select_option(".sub-item select", "byd-atto-3")
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/testimoni"); pg.wait_for_selector(".card")
        pg.click("text=+ Tambah"); pg.wait_for_selector(".sub-item")
        pg.fill(".sub-item >> input[type=text] >> nth=0", "Bpk. Andi")
        pg.fill(".sub-item textarea >> nth=0", "Proses pembelian cepat dan sales menjelaskan simulasi cicilan dengan jelas."); pg.check(".sub-item >> text=Customer sudah memberi izin")
        pg.select_option(".sub-item select >> nth=0", "byd-atto-3")
        # bar simpan tidak menutupi konten paling bawah
        pg.wait_for_selector("#bar:not([hidden])"); pg.wait_for_timeout(300)
        res["bar_clearance"] = pg.evaluate("parseFloat(getComputedStyle(document.getElementById('main')).paddingBottom) >= document.getElementById('bar').offsetHeight")
        # 5 zip
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            z.writestr("paket/content/articles/dari-zip.md", "---\ntitle: Dari Zip\nslug: dari-zip\nkeyword: dari zip\nstatus: draft\ndate: 2026-10-15\n---\n\nIsi.\n")
            z.writestr("paket/.github/workflows/pages.yml", "name: x")
            z.writestr("paket/content/layout.json", (ROOT / "content/layout.json").read_text())
            z.writestr("paket/__MACOSX/.x", "x")
        zp = ROOT / "tests/fixtures/paket.zip"; zp.write_bytes(buf.getvalue())
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/zip"); pg.wait_for_selector("#zipfile")
        pg.set_input_files("#zipfile", str(zp)); pg.wait_for_selector("#zipstage")
        zt = pg.inner_text("#main"); res["zip_skip_workflow"] = ".github" not in zt.split("Siapkan")[0].split("file")[-1] and "dari-zip.md" in zt
        pg.click("#zipstage")
        # 6 jadwal (draf dari seed + zip)
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/jadwal"); pg.wait_for_selector("#sch_apply")
        pg.fill("#sch_start", "2030-02-01"); pg.click("#sch_apply"); pg.wait_for_timeout(300)
        # 7 commit
        pending_n = pg.inner_text("#bar strong"); res["pending"] = pending_n
        pg.click("#commit"); pg.wait_for_selector("#bar[hidden]", state="attached", timeout=15000)
        res["commit_msg"] = repo.log[-1] if repo.log else None
        # 8 laporan
        pg.goto(f"http://127.0.0.1:{PORT}/admin/#/laporan"); pg.wait_for_selector("#rep_art")
        pg.wait_for_selector("#rep_art tbody tr")
        rt = pg.inner_text("#main"); res["report"] = ("8.4" in rt or "Submitted and indexed" in rt) and "31.2" in rt
        res["report_index"] = "1 URL terindeks" in rt
        # 9 dispatch
        pg.click("text=Ambil data Search Console sekarang"); pg.wait_for_timeout(300); res["dispatch"] = len(repo.dispatched) == 1
        # 10 mobile overflow
        pg.set_viewport_size({"width": 390, "height": 800})
        for r in ("dashboard", "artikel/baru", "model/byd-atto-3", "laporan", "layout", "media", "testimoni", "serah-terima", "tema", "leasing", "sales", "promo"):
            pg.goto(f"http://127.0.0.1:{PORT}/admin/#/{r}"); pg.wait_for_timeout(400)
            sw = pg.evaluate("document.documentElement.scrollWidth")
            if sw > 392: res.setdefault("overflow", []).append((r, sw))
        b.close()
    # verifikasi isi repo palsu
    f = repo.files
    art = f.get("content/articles/byd-seal-vs-mazda-6e.md", b"").decode()
    res["file_article"] = "status: scheduled" in art and "publish_at: 2030" in art and "pillar: harga-mobil-listrik" in art
    res["site_edit"] = json.loads(f["content/site.json"])["domain"] == "https://harmony-byd.co.id"
    imgs = [k for k in f if k.startswith("content/img/")]
    res["img"] = None
    if imgs:
        from PIL import Image
        im = Image.open(io.BytesIO(f[imgs[0]])); res["img"] = (imgs[0], im.size, len(f[imgs[0]]), im.format)
    res["zip_files"] = ("content/articles/dari-zip.md" in f, ".github/workflows/pages.yml" in f and f[".github/workflows/pages.yml"] == (ROOT / ".github/workflows/pages.yml").read_bytes(), "__MACOSX/.x" in f)
    sched = f["content/articles/byd-seal-vs-mazda-6e.md"].decode() if "content/articles/byd-seal-vs-mazda-6e.md" in f else ""
    res["scheduled_jadwal"] = "publish_at: 2030-02-01T08:00:00+07:00" in sched; res["thin_draft_skipped"] = "status: draft" in f["content/articles/dari-zip.md"].decode()
    # build ulang dari state repo palsu
    tmp = pathlib.Path(tempfile.mkdtemp()); 
    for p, bts in f.items():
        d = tmp / p; d.parent.mkdir(parents=True, exist_ok=True); d.write_bytes(bts)
    env = dict(os.environ, BUILD_NOW="2030-03-01T09:00:00+07:00")
    r1 = subprocess.run([sys.executable, "tools/build.py"], cwd=tmp, capture_output=True, text=True, env=env)
    r2 = subprocess.run([sys.executable, "tools/seo_check.py"], cwd=tmp, capture_output=True, text=True, env=env)
    res["rebuild_ok"] = r1.returncode == 0; res["seo_check_tail"] = r2.stdout.strip().splitlines()[-1]; res["seo_issues"] = r2.stdout.strip().splitlines()[-6:]
    res["article_live_html"] = (tmp / "docs/blog/byd-seal-vs-mazda-6e/index.html").exists()
    res["img_built"] = [x.name for x in (tmp / "docs/img").glob("*")][:4]
    try:
        th = json.loads(f["content/theme.json"]); res["theme_file"] = th["accent"] == "#1f6f8b" and th["preset"] == "custom"
        ls = json.loads(f["content/leasing.json"]); it = ls["items"][0]
        res["leasing_file"] = it["name"] == "Leasing Uji" and it["logo"].startswith("/img/leasing-") and ("content" + it["logo"]) in f
        hm = (tmp / "docs/index.html").read_text(); md = (tmp / "docs/byd-atto-3/index.html").read_text()
        res["leasing_built"] = 'bhs lsl' in hm and 'bhs lsl' in md and "--acc:#1f6f8b" in hm and "Leasing Uji" in hm
        res["testi_built"] = (tmp / "docs/testimoni/index.html").exists() and (tmp / "docs/serah-terima/index.html").exists() and "Bpk. Andi" in hm
        res["testi_in_model"] = "Kata Customer tentang BYD Atto 3" in re.sub(r"<[^>]+>", "", md)
        res["handover_sitemap_img"] = "image:image" in (tmp / "docs/sitemap.xml").read_text()
        res["about_built"] = (tmp / "docs/tentang-kami/index.html").exists() and "hasMap" in hm and '"geo"' in hm
        rb = (tmp / "docs/robots.txt").read_text(); res["robots_ai"] = "User-agent: PerplexityBot\nAllow: /" in rb and "User-agent: GPTBot\nDisallow: /" in rb
        ll = (tmp / "docs/llms.txt").read_text(); res["llms"] = "## Model" in ll and "tentang-kami" in ll
        res["answer_built"] = 'class="ans"' in (tmp / "docs/blog/byd-seal-vs-mazda-6e/index.html").read_text() if (tmp / "docs/blog/byd-seal-vs-mazda-6e/index.html").exists() else False
        res["sales_built"] = 'class="prof"' in hm and "Dewi Uji" in hm and "dewi@example.com" in hm
        res["promo_built"] = 'id="promo"' in hm and "Promo Uji Akhir Tahun" in hm and 'href="/#promo"' in hm and "Berlaku sampai 31 Desember 2099" in hm
        res["promo_after_models"] = hm.index('id="model"') < hm.index('id="promo"') < hm.index("Kenapa")
        res["cta_built"] = 'class="ctab"' in hm
        res["layout_leasing_after_models"] = hm.index('id="model"') < hm.index('class="lp"') < hm.index("Kenapa")
    except Exception as e:
        res["theme_leasing_error"] = repr(e)
    res["errors"] = errors[:5]
    print(json.dumps(res, indent=1, ensure_ascii=False, default=str))
    bad = [k for k, v in res.items() if v in (False, None) and k not in ("errors",)] + (["overflow"] if res.get("overflow") else []) + (["errors"] if errors else [])
    print("GAGAL:" if bad else "SEMUA LULUS", bad)
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

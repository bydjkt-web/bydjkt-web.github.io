/* Admin inti: sesi, navigasi, bilah perubahan, dan layar konten (pengaturan, halaman, model, pesaing, layout, media, zip). */
(function (root) {
  "use strict";
  var h = Forms.h;
  var A = root.A = { S: {}, routes: {}, h: h, cur: null };
  var JSONS = { site: "site.json", layout: "layout.json", pages: "pages.json", models: "models.json", comps: "competitors.json", media: "media.json", keywords: "keywords.json", topics: "topics.json", rules: "seo-rules.json", theme: "theme.json", leasing: "leasing.json" };
  var DEFAULTS = { site: {}, layout: {}, pages: {}, models: [], comps: [], media: { items: [] }, keywords: { keywords: [] }, topics: { topics: [] }, rules: {},
    theme: { preset: "atlantic", dark: "#243746", primary: "#3d5a6c", accent: "#2b6a8a", paper: "#f1f4f6", presets: [{id:"atlantic",name:"Atlantic Grey",dark:"#243746",primary:"#3d5a6c",accent:"#2b6a8a",paper:"#f1f4f6"},{id:"merah",name:"Merah BYD",dark:"#101820",primary:"#0d6b5b",accent:"#d4001a",paper:"#f4f5f2"},{id:"biru",name:"Biru Terang",dark:"#14213d",primary:"#1d4ed8",accent:"#0b5cff",paper:"#f3f7fe"},{id:"sporty",name:"Hitam Sporty",dark:"#0b0b0d",primary:"#8a1020",accent:"#e10b22",paper:"#f2f2f2"}] },
    leasing: { show_home: true, show_model: true, autoplay: true, title: "Mitra Leasing Resmi", intro: "Pengajuan kredit mobil listrik BYD lewat lembaga pembiayaan yang bekerja sama dengan kami.", items: [] } };

  A.toast = function (msg, err) {
    var t = document.getElementById("toast"), d = h("div", { class: err ? "err" : "", text: msg });
    t.appendChild(d); setTimeout(function () { d.remove(); }, err ? 9000 : 4500);
  };
  A.today = function () { var d = new Date(Date.now() + 7 * 3600e3); return d.toISOString().slice(0, 10); };
  A.slug = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); };
  A.fmtRp = function (n) { return "Rp" + Number(n || 0).toLocaleString("id-ID"); };
  A.esc = MD.esc;
  A.fail = function (e) { console.error(e); A.toast(e && e.message ? e.message : String(e), true); };

  /* ---- muat semua JSON konten ---- */
  A.loadAll = function () {
    return Promise.all(Object.keys(JSONS).map(function (k) {
      return GH.readJSON("content/" + JSONS[k], JSON.parse(JSON.stringify(DEFAULTS[k]))).then(function (v) { A.S[k] = v; });
    }));
  };
  A.saveJSON = function (key) { GH.stageJSON("content/" + JSONS[key], A.S[key]); };
  A.mediaOpts = function (current) {
    var o = [["", "— tidak ada —"]];
    var seen = {};
    GH.paths("content/img/").forEach(function (p) {
      var n = "/img/" + A.slug(p.split("/").pop().replace(/\.[^.]+$/, "")) + ".webp";
      if (!seen[n]) { seen[n] = 1; o.push([n, n.replace("/img/", "")]); }
    });
    if (current && !seen[current]) o.push([current, current]);
    return o;
  };

  /* ---- kerangka halaman ---- */
  var NAV = [
    ["dashboard", "Dashboard"], ["#", "Konten"], ["artikel", "Artikel"], ["halaman", "Halaman Pilar"], ["model", "Model Mobil"], ["pesaing", "Data Pesaing"],
    ["konten/home", "Beranda"], ["konten/prices", "Halaman Harga"], ["konten/testdrive", "Test Drive"], ["konten/blog", "Blog (index)"],
    ["#", "Tampilan"], ["tema", "Warna Template"], ["leasing", "Mitra Leasing"], ["layout", "Layout & Urutan"], ["media", "Media Gambar"], ["pengaturan", "Pengaturan Situs"],
    ["#", "SEO & Distribusi"], ["jadwal", "Jadwal Terbit"], ["rencana", "Rencana & Keyword"], ["laporan", "Laporan"],
    ["#", "Alat"], ["zip", "Upload ZIP ke GitHub"]
  ];
  A.shell = function () {
    var app = document.getElementById("app");
    app.innerHTML = "";
    var side = h("nav", { class: "side", id: "side" }, [h("h1", { text: "BYD Harmony · Admin" })]);
    NAV.forEach(function (n) {
      if (n[0] === "#") side.appendChild(h("div", { class: "grp", text: n[1] }));
      else side.appendChild(h("a", { href: "#/" + n[0], "data-r": n[0], text: n[1] }));
    });
    side.appendChild(h("div", { class: "grp", text: GH.cfg.owner + "/" + GH.cfg.repo }));
    side.appendChild(h("a", { href: "#", id: "logout", text: "Keluar", onclick: function (e) { e.preventDefault(); GH.logout(); location.hash = ""; location.reload(); } }));
    var main = h("main", { class: "ad", id: "main" });
    var bar = h("div", { class: "bar", id: "bar", hidden: true });
    app.appendChild(h("div", { class: "top-m" }, [h("strong", { text: "Admin BYD Harmony" }), h("button", { type: "button", text: "Menu", onclick: function () { side.classList.toggle("open"); } })]));
    app.appendChild(h("div", { class: "shell" }, [side, main]));
    app.appendChild(bar);
    GH.onChange(A.renderBar);
    A.renderBar();
  };
  A.renderBar = function () {
    var bar = document.getElementById("bar"); if (!bar) return;
    var n = GH.count();
    bar.hidden = n === 0;
    if (!n) return;
    bar.innerHTML = "";
    var msg = h("input", { type: "text", id: "cmsg", value: "Update konten dari Admin", "aria-label": "Pesan commit" });
    var det = h("div", { id: "pdet", class: "diff", hidden: true, style: "width:100%;max-height:160px;overflow:auto" });
    Object.keys(GH.pending).sort().forEach(function (p) {
      var q = GH.pending[p], k = q.del ? "r" : (GH.tree && GH.tree[p] ? "m" : "a");
      det.appendChild(h("div", { class: k, text: (k === "r" ? "− " : k === "a" ? "+ " : "~ ") + p }));
    });
    bar.appendChild(h("strong", { text: n + " perubahan belum disimpan" }));
    bar.appendChild(msg);
    bar.appendChild(h("button", { class: "btn", id: "commit", text: "Simpan ke GitHub", onclick: function (e) {
      var b = e.target; b.disabled = true; b.textContent = "Menyimpan…";
      GH.commit(msg.value).then(function (c) {
        A.toast("Tersimpan di GitHub (" + c.sha.slice(0, 7) + "). Situs dibangun ulang otomatis, tunggu 1–3 menit.");
      }).catch(A.fail).then(function () { A.renderBar(); if (A.cur) A.go(); });
    } }));
    bar.appendChild(h("button", { class: "btn o", text: "Lihat daftar", onclick: function () { det.hidden = !det.hidden; } }));
    bar.appendChild(h("button", { class: "btn d", text: "Batalkan semua", onclick: function () {
      if (!confirm("Buang semua perubahan yang belum disimpan?")) return;
      GH.discard(); A.loadAll().then(function () { A.go(); });
    } }));
    bar.appendChild(det);
  };
  window.addEventListener("beforeunload", function (e) { if (GH.cfg && GH.count()) { e.preventDefault(); e.returnValue = ""; } });

  A.view = function () { var m = document.getElementById("main"); m.innerHTML = ""; return m; };
  A.go = function () {
    var hash = (location.hash || "#/dashboard").replace(/^#\/?/, "") || "dashboard";
    var parts = hash.split("/"), key = parts[0], rest = parts.slice(1).join("/");
    document.querySelectorAll("nav.side a[data-r]").forEach(function (a) { a.classList.toggle("on", a.getAttribute("data-r").split("/")[0] === key && (key !== "konten" || a.getAttribute("data-r") === hash)); });
    var fn = A.routes[key];
    A.cur = key;
    var side = document.getElementById("side"); if (side) side.classList.remove("open");
    if (!fn) { A.view().appendChild(h("p", { text: "Halaman tidak ditemukan." })); return; }
    try { var r = fn(rest, A.view()); if (r && r.catch) r.catch(A.fail); } catch (e) { A.fail(e); }
  };
  window.addEventListener("hashchange", function () { if (GH.cfg && GH.tree) A.go(); });

  /* ---- form umum untuk objek JSON ---- */
  A.jsonForm = function (title, key, fields, sub, intro) {
    var m = A.view();
    m.appendChild(h("h2", { text: title }));
    if (intro) m.appendChild(h("p", { class: "muted", text: intro }));
    var data = sub ? A.S[key][sub] : A.S[key];
    var card = h("div", { class: "card" });
    card.appendChild(Forms.render(fields, data, function () { A.saveJSON(key); }));
    m.appendChild(card);
  };

  var F = Forms;
  var faqF = { k: "faq", t: "objlist", label: "FAQ (juga jadi schema FAQPage)", titleKey: "q", fields: [{ k: "q", label: "Pertanyaan", t: "text" }, { k: "a", label: "Jawaban", t: "area", rows: 3 }] };
  var seoF = [{ k: "title", label: "Title (30–60 karakter)", t: "text" }, { k: "description", label: "Meta description (70–160 karakter)", t: "area", rows: 2 }, { k: "h1", label: "H1", t: "text" }];
  var PAGE_FORMS = {
    home: seoF.concat([{ k: "lead", label: "Teks pembuka", t: "area", rows: 2, hint: "Boleh pakai {name} dan {price_date}" }, { k: "badges", label: "Badge", t: "strlist" }, { k: "cta_primary", label: "Tombol utama", t: "text" }, { k: "cta_secondary", label: "Tombol kedua", t: "text" },
      { k: "models_title", label: "Judul bagian model", t: "text" }, { k: "models_intro", label: "Pengantar model", t: "area", rows: 2 }, { k: "why_title", label: "Judul 'Kenapa mobil listrik'", t: "text" },
      { k: "why_items", label: "Poin keunggulan", t: "objlist", titleKey: "title", fields: [{ k: "title", label: "Judul", t: "text" }, { k: "text", label: "Teks", t: "area", rows: 2 }] },
      { k: "why_links", label: "Link lanjutan (markdown)", t: "area", rows: 2 }, { k: "articles_title", label: "Judul bagian artikel", t: "text" }, { k: "articles_count", label: "Jumlah artikel ditampilkan", t: "num" },
      { k: "usecases_title", label: "Judul kebutuhan", t: "text" }, { k: "usecases", label: "Daftar kebutuhan (markdown)", t: "strlist" },
      { k: "lead_title", label: "Judul form lead", t: "text" }, { k: "lead_text", label: "Teks form lead", t: "area", rows: 3 }, { k: "lead_bullets", label: "Poin form lead", t: "strlist" }, { k: "faq_title", label: "Judul FAQ", t: "text" }, faqF]),
    prices: seoF.concat([{ k: "intro", label: "Pengantar", t: "area", rows: 3 }, { k: "guide_title", label: "Judul panduan", t: "text" }, { k: "guide_md", label: "Panduan (markdown)", t: "area", rows: 8 }, { k: "articles_title", label: "Judul artikel", t: "text" }, { k: "faq_title", label: "Judul FAQ", t: "text" }, faqF, { k: "lead_title", label: "Judul form lead", t: "text" }]),
    testdrive: seoF.concat([{ k: "intro", label: "Pengantar", t: "area", rows: 2 }, { k: "lead_title", label: "Judul form", t: "text" }, { k: "steps_title", label: "Judul langkah", t: "text" }, { k: "steps", label: "Langkah", t: "strlist" }, { k: "faq_title", label: "Judul FAQ", t: "text" }, faqF]),
    blog: seoF.concat([{ k: "intro", label: "Pengantar blog", t: "area", rows: 3 }])
  };
  var PAGE_NAME = { home: "Beranda", prices: "Halaman Harga", testdrive: "Halaman Test Drive", blog: "Index Blog" };
  A.routes.konten = function (rest) {
    var k = rest || "home";
    A.S.pages[k] = A.S.pages[k] || {};
    A.jsonForm("Konten " + (PAGE_NAME[k] || k), "pages", PAGE_FORMS[k] || seoF, k, "Semua teks di halaman ini bisa diubah. Perubahan baru tayang setelah 'Simpan ke GitHub'.");
  };

  var SITE_FIELDS = [
    { k: "name", label: "Nama brand situs", t: "text" }, { k: "legal_name", label: "Nama badan usaha", t: "text" }, { k: "tagline", label: "Tagline", t: "text" },
    { k: "domain", label: "Domain (https://…)", t: "url", hint: "Dipakai untuk canonical, sitemap, schema" }, { k: "wa_number", label: "Nomor WhatsApp (format 62…)", t: "text" }, { k: "phone_display", label: "Nomor tampil", t: "text" },
    { k: "address", label: "Alamat lengkap dealer", t: "area", rows: 2 }, { k: "city", label: "Kota", t: "text" }, { k: "region", label: "Provinsi", t: "text" }, { k: "postal", label: "Kode pos", t: "text" },
    { k: "hours", label: "Jam buka (teks)", t: "text" }, { k: "hours_schema", label: "Jam buka (format schema, contoh Mo-Sa 09:00-18:00)", t: "text" },
    { k: "price_date_label", label: "Label tanggal harga (mis. Oktober 2026)", t: "text" }, { k: "price_date", label: "Tanggal harga (YYYY-MM-DD)", t: "text" },
    { k: "author_name", label: "Nama penulis default artikel", t: "text" }, { k: "author_role", label: "Jabatan penulis", t: "text" },
        { k: "promo", t: "obj", label: "Banner promo", fields: [{ k: "enabled", label: "Tampilkan banner", t: "bool" }, { k: "text", label: "Teks promo", t: "text" }, { k: "link", label: "Link (opsional)", t: "text" }] },
    { k: "show_floating_wa", label: "Tombol WhatsApp melayang", t: "bool" },
    { k: "nav", label: "Menu navigasi", t: "objlist", titleKey: "label", fields: [{ k: "label", label: "Teks", t: "text" }, { k: "href", label: "Link", t: "text" }] },
    { k: "footer_note", label: "Catatan footer", t: "area", rows: 3 },
    { k: "ga4_id", label: "Google Analytics 4 ID (G-XXXX)", t: "text" }, { k: "gsc_verification", label: "Kode verifikasi Search Console (meta content)", t: "text" },
    { k: "gsc_property", label: "Properti Search Console (mis. https://domain.com/ atau sc-domain:domain.com)", t: "text" },
    { k: "indexnow_key", label: "Kunci IndexNow (8–128 huruf/angka)", t: "text", hint: "Untuk Bing/Yandex. Google tidak memakai IndexNow." },
    { k: "instagram", label: "Instagram", t: "text" }, { k: "tiktok", label: "TikTok", t: "text" }, { k: "facebook", label: "Facebook", t: "text" }, { k: "youtube", label: "YouTube", t: "text" },
    { k: "firebase", t: "obj", label: "Firebase (lead ke Firestore)", fields: [{ k: "apiKey", label: "apiKey", t: "text" }, { k: "authDomain", label: "authDomain", t: "text" }, { k: "projectId", label: "projectId", t: "text" }, { k: "appId", label: "appId", t: "text" }] }
  ];
  A.routes.pengaturan = function () { A.jsonForm("Pengaturan Situs", "site", SITE_FIELDS, null, "Data dealer ini dipakai di schema AutoDealer (local SEO), footer, dan tombol WhatsApp. Isi selengkap mungkin."); };

  /* ---- Layout ---- */
  var SEC = { hero: "Hero (judul + tombol)", models: "Kartu model", why: "Kenapa mobil listrik", articles: "Artikel terbaru", usecases: "Cocok untuk kebutuhan", lead: "Form lead", faq: "FAQ",
    gallery: "Galeri foto", summary: "Ringkasan", highlights: "Keunggulan", variants: "Varian & harga", specs: "Spesifikasi", compare: "Perbandingan kompetitor", others: "Model lainnya", table: "Tabel harga", leasing: "Slider mitra leasing", guide: "Panduan memilih" };
  A.routes.layout = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Layout & Urutan Bagian" }));
    m.appendChild(h("p", { class: "muted", text: "Atur urutan bagian di setiap halaman dengan tombol panah, atau sembunyikan dengan mematikan centang." }));
    [["home", "Beranda"], ["model", "Halaman Detail Model"], ["prices", "Halaman Harga"]].forEach(function (g) {
      var card = h("div", { class: "card" }, [h("h3", { text: g[1] })]);
      var ul = h("ul", { class: "lay" });
      function draw() {
        ul.innerHTML = "";
        var arr = A.S.layout[g[0]];
        var anch = { home: "models", model: "others" }[g[0]];
        if (anch && !arr.some(function (x) { return x.id === "leasing"; })) {
          var ix = arr.map(function (x) { return x.id; }).indexOf(anch);
          arr.splice(ix < 0 ? arr.length : ix + 1, 0, { id: "leasing", on: true });
        }
        arr.forEach(function (it, i) {
          ul.appendChild(h("li", {}, [
            h("input", { type: "checkbox", checked: it.on, "aria-label": "Tampilkan " + it.id, onchange: function (e) { it.on = e.target.checked; A.saveJSON("layout"); } }),
            h("span", { class: "nm", text: SEC[it.id] || it.id }),
            h("button", { class: "btn o sm", text: "↑", disabled: i === 0, onclick: function () { arr.splice(i - 1, 0, arr.splice(i, 1)[0]); A.saveJSON("layout"); draw(); } }),
            h("button", { class: "btn o sm", text: "↓", disabled: i === arr.length - 1, onclick: function () { arr.splice(i + 1, 0, arr.splice(i, 1)[0]); A.saveJSON("layout"); draw(); } })
          ]));
        });
      }
      draw(); card.appendChild(ul); m.appendChild(card);
    });
    var la = A.S.layout.article = A.S.layout.article || {};
    var ac = h("div", { class: "card" }, [h("h3", { text: "Halaman Artikel" })]);
    ac.appendChild(Forms.render([
      { k: "toc", label: "Daftar isi", t: "bool" }, { k: "author", label: "Kotak penulis (E-E-A-T)", t: "bool" }, { k: "cta_mid", label: "CTA di tengah artikel", t: "bool" },
      { k: "cta_mid_after_h2", label: "CTA tengah muncul setelah H2 ke-", t: "num" }, { k: "model_box", label: "Kotak model terkait", t: "bool" }, { k: "related", label: "Artikel terkait", t: "bool" }, { k: "related_count", label: "Jumlah artikel terkait", t: "num" }
    ], la, function () { A.saveJSON("layout"); }));
    m.appendChild(ac);
  };

  /* ---- Model ---- */
  var MODEL_FIELDS = function () { return [
    { k: "name", label: "Nama model", t: "text" }, { k: "slug", label: "Slug URL (jangan diubah setelah tayang)", t: "text" }, { k: "published", label: "Tayang di situs", t: "bool" }, { k: "order", label: "Urutan", t: "num" },
    { k: "brand", label: "Merek", t: "text" }, { k: "type", label: "Tipe (mis. SUV listrik compact)", t: "text" }, { k: "body", label: "Bodi", t: "text" }, { k: "powertrain", label: "Penggerak", t: "select", opts: ["BEV", "PHEV", "HEV"] },
    { k: "keyword", label: "Keyword utama halaman", t: "text" }, { k: "tagline", label: "Tagline (jadi meta description)", t: "area", rows: 2 },
    { k: "images", label: "Galeri foto (maks 6; foto pertama = utama)", t: "objlist", titleKey: "src", fields: [{ k: "src", label: "Gambar (upload dulu di menu Media)", t: "select", opts: A.mediaOpts() }, { k: "alt", label: "Alt teks (jelaskan isi foto)", t: "text" }] },
    { k: "intro", label: "Paragraf pengantar", t: "strlist", area: true }, { k: "highlights", label: "Keunggulan", t: "objlist", titleKey: "title", fields: [{ k: "title", label: "Judul", t: "text" }, { k: "text", label: "Teks", t: "area", rows: 2 }] },
    { k: "best_for", label: "Cocok untuk", t: "strlist" }, { k: "specs", label: "Spesifikasi", t: "objlist", titleKey: "label", fields: [{ k: "label", label: "Label", t: "text" }, { k: "value", label: "Nilai", t: "text" }] },
    { k: "variants", label: "Varian & harga OTR", t: "objlist", titleKey: "name", fields: [{ k: "name", label: "Nama varian", t: "text" }, { k: "price", label: "Harga OTR (angka rupiah)", t: "num" }, { k: "range_km", label: "Jarak tempuh (km)", t: "text" }, { k: "range_std", label: "Standar jarak (NEDC/WLTP/price list)", t: "text" }, { k: "battery", label: "Baterai", t: "text" }, { k: "power", label: "Tenaga", t: "text" }, { k: "seats", label: "Kursi", t: "text" }, { k: "note", label: "Catatan", t: "text" }, { k: "verify", label: "Perlu verifikasi (tampilkan peringatan)", t: "bool" }] },
    { k: "compare_variant", label: "Varian untuk tabel perbandingan", t: "text" }, { k: "compare", label: "Kompetitor di tabel (slug dari Data Pesaing)", t: "strlist" }, faqF
  ]; };
  A.routes.model = function (rest) {
    var m = A.view();
    if (!rest) {
      m.appendChild(h("div", { class: "row sb" }, [h("h2", { text: "Model Mobil" }), h("button", { class: "btn", text: "+ Model baru", onclick: function () { location.hash = "#/model/baru"; } })]));
      var tb = h("table", { class: "t" }, [h("thead", {}, [h("tr", {}, ["Model", "Slug", "Harga mulai", "Status", ""].map(function (x) { return h("th", { text: x }); }))])]);
      var body = h("tbody");
      A.S.models.slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); }).forEach(function (md) {
        var lo = (md.variants || []).reduce(function (a, v) { return Math.min(a, v.price || a); }, Infinity);
        body.appendChild(h("tr", {}, [h("td", { text: md.name }), h("td", { text: md.slug }), h("td", { text: isFinite(lo) ? A.fmtRp(lo) : "-" }),
          h("td", {}, [h("span", { class: "pill " + (md.published === false ? "warn" : "ok"), text: md.published === false ? "Disembunyikan" : "Tayang" })]),
          h("td", {}, [h("a", { class: "btn o sm", href: "#/model/" + md.slug, text: "Edit" })])]));
      });
      tb.appendChild(body); m.appendChild(h("div", { class: "card tw" }, [tb]));
      return;
    }
    var md;
    if (rest === "baru") {
      md = Forms.blank(MODEL_FIELDS()); md.published = false; md.order = A.S.models.length + 1; md.brand = "BYD"; md.powertrain = "BEV";
      m.appendChild(h("h2", { text: "Model baru" }));
      var f1 = Forms.render(MODEL_FIELDS(), md, function () {});
      m.appendChild(h("div", { class: "card" }, [f1]));
      m.appendChild(h("button", { class: "btn", text: "Tambahkan model", onclick: function () {
        md.slug = A.slug(md.slug || md.name);
        if (!md.name || !md.slug) return A.toast("Nama dan slug wajib diisi.", true);
        if (A.S.models.some(function (x) { return x.slug === md.slug; })) return A.toast("Slug sudah dipakai.", true);
        A.S.models.push(md); A.saveJSON("models"); location.hash = "#/model/" + md.slug;
      } }));
      return;
    }
    md = A.S.models.filter(function (x) { return x.slug === rest; })[0];
    if (!md) { m.appendChild(h("p", { text: "Model tidak ditemukan." })); return; }
    m.appendChild(h("div", { class: "row sb" }, [h("h2", { text: md.name }), h("a", { class: "btn o", href: "#/model", text: "← Semua model" })]));
    m.appendChild(h("div", { class: "card" }, [Forms.render(MODEL_FIELDS(), md, function () { A.saveJSON("models"); })]));
    m.appendChild(h("button", { class: "btn d", text: "Hapus model", onclick: function () {
      if (!confirm("Hapus model " + md.name + "? Lebih aman: matikan 'Tayang di situs'.")) return;
      A.S.models.splice(A.S.models.indexOf(md), 1); A.saveJSON("models"); location.hash = "#/model";
    } }));
  };

  A.routes.pesaing = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Data Pesaing (untuk tabel perbandingan)" }));
    m.appendChild(h("p", { class: "muted", text: "Isi harga, basis harga, sumber, dan tanggal data. Kosongkan kolom yang belum terverifikasi; situs menampilkan '—' dan tidak menebak. Slug dipakai di shortcode {{compare slug1 slug2}}." }));
    var wrap = { comps: A.S.comps };
    m.appendChild(h("div", { class: "card" }, [Forms.render([{ k: "comps", label: "Daftar pesaing", t: "objlist", titleKey: "name", fields: [
      { k: "slug", label: "Slug", t: "text" }, { k: "brand", label: "Merek", t: "text" }, { k: "name", label: "Nama varian", t: "text" }, { k: "price", label: "Harga (rupiah)", t: "num" }, { k: "price_basis", label: "Basis harga (OTR Jakarta, katalog…)", t: "text" },
      { k: "battery", label: "Baterai", t: "text" }, { k: "range", label: "Jarak tempuh + standar", t: "text" }, { k: "power", label: "Tenaga", t: "text" }, { k: "seats", label: "Kursi", t: "text" }, { k: "body", label: "Tipe bodi", t: "text" },
      { k: "powertrain", label: "Penggerak", t: "text" }, { k: "partial", label: "Data spesifikasi belum lengkap", t: "bool" }, { k: "source", label: "URL sumber", t: "url" }, { k: "as_of", label: "Data per (YYYY-MM)", t: "text" }, { k: "note", label: "Catatan", t: "area", rows: 2 }] }],
      wrap, function () { A.S.comps = wrap.comps; A.saveJSON("comps"); })]));
  };
  root.__A_FAQ__ = faqF;

  /* ---- Media ---- */
  A.toWebp = function (file, maxW) {
    return createImageBitmap(file).then(function (bmp) {
      var w = bmp.width, hh = bmp.height, sc = Math.min(1, (maxW || 1600) / w);
      var c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(hh * sc);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return new Promise(function (res) { c.toBlob(function (b) {
        if (b && b.type === "image/webp") return res({ blob: b, ext: "webp", w: c.width, h: c.height });
        c.toBlob(function (j) { res({ blob: j, ext: "jpg", w: c.width, h: c.height }); }, "image/jpeg", 0.8);
      }, "image/webp", 0.78); });
    }).then(function (r) { return r.blob.arrayBuffer().then(function (buf) { r.bytes = new Uint8Array(buf); return r; }); });
  };
  A.addImage = function (file, alt) {
    var base = A.slug(file.name.replace(/\.[^.]+$/, "")) || "gambar";
    return A.toWebp(file).then(function (r) {
      var name = base + "." + r.ext, path = "content/img/" + name, i = 2;
      while (GH.exists(path)) { name = base + "-" + (i++) + "." + r.ext; path = "content/img/" + name; }
      GH.stage(path, r.bytes);
      var src = "/img/" + A.slug(name.replace(/\.[^.]+$/, "")) + ".webp";
      A.S.media.items = (A.S.media.items || []).filter(function (x) { return x.src !== src; });
      A.S.media.items.push({ src: src, alt: alt || "", w: r.w, h: r.h, kb: Math.round(r.bytes.length / 1024), file: name });
      A.saveJSON("media");
      return { src: src, r: r, file: file };
    });
  };
  A.routes.media = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Media Gambar" }));
    m.appendChild(h("p", { class: "muted", text: "Gambar dikecilkan otomatis di browser (maks 1600 px, WebP kualitas 78) sebelum diunggah. Saat build, situs membuat lagi versi 640 px dan gambar OG 1200×630. Isi alt teks yang menjelaskan isi foto." }));
    var drop = h("div", { class: "drop" }, [h("p", { text: "Pilih atau seret gambar (JPG, PNG, WebP) ke sini" })]);
    var inp = h("input", { type: "file", accept: "image/*", multiple: true, id: "imgfile" });
    function handle(files) {
      var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
      list.reduce(function (p, f) { return p.then(function () { return A.addImage(f, "").then(function (x) { A.toast(f.name + " → " + Math.round(f.size / 1024) + " KB menjadi " + A.S.media.items[A.S.media.items.length - 1].kb + " KB"); }); }); }, Promise.resolve()).then(function () { A.go(); }).catch(A.fail);
    }
    inp.addEventListener("change", function () { handle(inp.files); });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("on"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("on"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("on"); handle(e.dataTransfer.files); });
    drop.appendChild(inp); m.appendChild(drop);
    var grid = h("div", { class: "media", style: "margin-top:14px" });
    var paths = GH.paths("content/img/").filter(function (p) { return /\.(webp|jpe?g|png)$/i.test(p); });
    if (!paths.length) grid.appendChild(h("p", { class: "muted", text: "Belum ada gambar. Gambar model dan cover artikel diunggah di sini." }));
    paths.forEach(function (p) {
      var src = "/img/" + A.slug(p.split("/").pop().replace(/\.[^.]+$/, "")) + ".webp";
      var meta = (A.S.media.items || []).filter(function (x) { return x.src === src; })[0];
      var img = h("img", { alt: "", loading: "lazy" });
      GH.readBytes(p).then(function (b) { img.src = URL.createObjectURL(new Blob([b])); }).catch(function () {});
      var alt = h("input", { type: "text", placeholder: "Alt teks", value: meta ? meta.alt : "", "aria-label": "Alt teks " + p, oninput: function (e) {
        if (!meta) { meta = { src: src, alt: "" }; A.S.media.items = A.S.media.items || []; A.S.media.items.push(meta); }
        meta.alt = e.target.value; A.saveJSON("media");
      } });
      grid.appendChild(h("div", { class: "m" }, [img, h("div", { text: src }), meta && meta.kb ? h("div", { class: "muted", text: meta.w + "×" + meta.h + " · " + meta.kb + " KB" }) : null, alt,
        h("button", { class: "btn d sm", text: "Hapus", onclick: function () {
          if (!confirm("Hapus " + p + "? Pastikan tidak dipakai di model/artikel.")) return;
          GH.stageDelete(p); A.S.media.items = (A.S.media.items || []).filter(function (x) { return x.src !== src; }); A.saveJSON("media"); A.go();
        } })]));
    });
    m.appendChild(grid);
  };

  /* ---- Upload ZIP ---- */
  A.routes.zip = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Upload ZIP ke GitHub" }));
    m.appendChild(h("p", { class: "muted", text: "ZIP diekstrak di browser Anda. Hanya file baru atau yang berubah yang disiapkan sebagai perubahan, lalu disimpan dalam satu commit. Folder .github (workflow) dan docs/ dilewati karena token tidak boleh mengubah workflow dan docs/ dibuat otomatis." }));
    var out = h("div");
    var inp = h("input", { type: "file", accept: ".zip", id: "zipfile" });
    m.appendChild(h("div", { class: "drop" }, [h("p", { text: "Pilih file .zip" }), inp]));
    m.appendChild(out);
    inp.addEventListener("change", function () {
      var f = inp.files[0]; if (!f) return;
      out.innerHTML = ""; out.appendChild(h("p", { text: "Membaca ZIP…" }));
      JSZip.loadAsync(f).then(function (zip) {
        var names = Object.keys(zip.files).filter(function (n) { return !zip.files[n].dir; });
        var tops = {}; names.forEach(function (n) { tops[n.split("/")[0]] = 1; });
        var strip = "";
        var tk = Object.keys(tops);
        if (tk.length === 1 && names.every(function (n) { return n.indexOf("/") > 0; })) strip = tk[0] + "/";
        var items = [];
        return names.reduce(function (p, n) {
          return p.then(function () {
            var path = n.slice(strip.length);
            if (!path || /(^|\/)(__MACOSX|\.DS_Store)/.test(path) || /^\.github\//.test(path) || /^docs\//.test(path) || /^\.git\//.test(path)) return;
            return zip.files[n].async("uint8array").then(function (bytes) {
              return GH.gitBlobSha(bytes).then(function (sha) {
                var cur = GH.pending[path] ? null : GH.tree[path];
                items.push({ path: path, bytes: bytes, st: !GH.tree[path] ? "baru" : (cur === sha ? "sama" : "berubah") });
              });
            });
          });
        }, Promise.resolve()).then(function () { return { items: items, strip: strip }; });
      }).then(function (res) {
        out.innerHTML = "";
        var items = res.items;
        var cnt = { baru: 0, berubah: 0, sama: 0 }; items.forEach(function (x) { cnt[x.st]++; });
        out.appendChild(h("div", { class: "card" }, [h("strong", { text: items.length + " file" + (res.strip ? " (folder '" + res.strip + "' dihilangkan)" : "") }), h("div", { class: "muted", text: cnt.baru + " baru · " + cnt.berubah + " berubah · " + cnt.sama + " sama (dilewati)" })]));
        var chosen = items.filter(function (x) { return x.st !== "sama"; });
        var list = h("div", { class: "card diff", style: "max-height:300px;overflow:auto" });
        chosen.forEach(function (x) { list.appendChild(h("label", { class: "chk" }, [h("input", { type: "checkbox", checked: true, "data-p": x.path }), h("span", { class: x.st === "baru" ? "a" : "m", text: (x.st === "baru" ? "+ " : "~ ") + x.path })])); });
        out.appendChild(list);
        out.appendChild(h("button", { class: "btn", id: "zipstage", text: "Siapkan perubahan", onclick: function () {
          var on = {}; list.querySelectorAll("input:checked").forEach(function (c) { on[c.getAttribute("data-p")] = 1; });
          var n = 0; chosen.forEach(function (x) { if (on[x.path]) { GH.stage(x.path, x.bytes); n++; } });
          A.toast(n + " file disiapkan. Klik 'Simpan ke GitHub' di bawah."); A.loadAll().catch(function () {});
        } }));
      }).catch(A.fail);
    });
  };
})(window);

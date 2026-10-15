/* Dashboard, jadwal terbit, rencana editorial & keyword, laporan */
(function (root) {
  "use strict";
  var A = root.A, h = A.h;

  function card(title, kids) { return h("div", { class: "card" }, [title ? h("h3", { text: title }) : null].concat(kids || [])); }
  function dispatch(wf) {
    return GH.req(GH.repo() + "/actions/workflows/" + wf + "/dispatches", { method: "POST", body: { ref: GH.cfg.branch } })
      .then(function () { A.toast("Workflow " + wf + " dijalankan."); }).catch(A.fail);
  }

  /* ---- Dashboard ---- */
  A.routes.dashboard = function () {
    var m = A.view(), S = A.S.site;
    m.appendChild(h("h2", { text: "Dashboard" }));
    var todo = [];
    if (!S.domain || /DOMAIN-ANDA/.test(S.domain)) todo.push(["Isi domain situs", "pengaturan"]);
    if (!S.wa_number || /^62812345/.test(S.wa_number)) todo.push(["Isi nomor WhatsApp asli", "pengaturan"]);
    if (!S.address || /ALAMAT/.test(S.address) || S.postal === "00000") todo.push(["Lengkapi alamat, kode pos, jam buka (local SEO)", "pengaturan"]);
    if (!(S.firebase || {}).projectId) todo.push(["Isi Firebase agar lead tersimpan di Firestore", "pengaturan"]);
    if (!S.gsc_verification) todo.push(["Isi kode verifikasi Google Search Console", "pengaturan"]);
    if (!S.indexnow_key) todo.push(["Buat kunci IndexNow (Bing/Yandex)", "pengaturan"]);
    if (!S.ga4_id) todo.push(["Isi Google Analytics 4 ID", "pengaturan"]);
    var ck = card("Checklist peluncuran");
    if (!todo.length) ck.appendChild(h("p", { text: "Semua data dasar sudah terisi." }));
    todo.forEach(function (t) { ck.appendChild(h("div", {}, [h("span", { class: "pill warn", text: "Perlu" }), " ", h("a", { href: "#/" + t[1], text: t[0] })])); });
    m.appendChild(ck);

    var cnt = card("Konten", [h("p", { class: "muted", text: "Memuat…" })]);
    m.appendChild(cnt);
    A.loadItems("articles").then(function (items) {
      var c = { live: 0, sched: 0, draft: 0 };
      items.forEach(function (i) { var s = A.statusOf(i.meta)[1]; if (s === "ok") c.live++; else if (s === "warn") c.draft++; else c.sched++; });
      cnt.innerHTML = ""; cnt.appendChild(h("h3", { text: "Konten" }));
      cnt.appendChild(h("div", { class: "row" }, [h("span", { class: "pill ok", text: c.live + " artikel tayang" }), h("span", { class: "pill", text: c.sched + " terjadwal" }), h("span", { class: "pill warn", text: c.draft + " draf" }),
        h("span", { class: "pill", text: A.S.models.filter(function (x) { return x.published !== false; }).length + " model tayang" })]));
      cnt.appendChild(h("p", { class: "muted", text: "Pending: " + GH.count() + " perubahan belum disimpan." }));
    }).catch(A.fail);

    var run = card("Status build & deploy", [h("p", { class: "muted", text: "Memuat…" })]);
    m.appendChild(run);
    GH.req(GH.repo() + "/actions/runs?per_page=6").then(function (r) {
      run.innerHTML = ""; run.appendChild(h("h3", { text: "Status build & deploy" }));
      if (!r.workflow_runs.length) run.appendChild(h("p", { class: "muted", text: "Belum ada build. Pastikan file .github/workflows/pages.yml ada dan Pages memakai 'GitHub Actions'." }));
      r.workflow_runs.forEach(function (w) {
        var ok = w.conclusion === "success", bad = w.conclusion === "failure";
        run.appendChild(h("div", { class: "row" }, [h("span", { class: "pill " + (ok ? "ok" : bad ? "bad" : "warn"), text: w.conclusion || w.status }), h("a", { href: w.html_url, target: "_blank", rel: "noopener", text: w.name + " · " + (w.head_commit && w.head_commit.message || "").split("\n")[0].slice(0, 60) }), h("span", { class: "muted", text: new Date(w.created_at).toLocaleString("id-ID") })]));
      });
      run.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [h("button", { class: "btn", text: "Bangun ulang sekarang", onclick: function () { dispatch("pages.yml"); } })]));
    }).catch(function (e) {
      run.innerHTML = ""; run.appendChild(h("h3", { text: "Status build & deploy" }));
      run.appendChild(h("p", { class: "muted", text: "Tidak bisa membaca status Actions (" + e.message + "). Tambahkan izin 'Actions: Read and write' pada token jika ingin melihat status di sini." }));
    });
    fetch("build-info.json", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (b) {
      if (b) m.appendChild(card("Build yang sedang tayang", [h("p", { text: new Date(b.built_at).toLocaleString("id-ID") + " · " + b.pages + " halaman · " + b.articles_live.length + " artikel" })]));
    }).catch(function () {});
  };

  /* ---- Jadwal ---- */
  A.routes.jadwal = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Jadwal Terbit & Distribusi Artikel" }));
    m.appendChild(h("p", { class: "muted", text: "Susun urutan draf, pilih ritme terbit, lalu terapkan. Situs dibangun otomatis tiap jam sehingga artikel tayang pada jam terjadwal. Di tiap artikel Anda juga memilih halaman tempat ia ditampilkan (beranda, harga, model, pilar)." }));
    var box = h("div", { class: "card" }, [h("p", { class: "muted", text: "Memuat…" })]);
    m.appendChild(box);
    return A.loadItems("articles").then(function (items) {
      var all = items.filter(function (i) { var s = A.statusOf(i.meta)[1]; return s !== "ok"; });
      function ready(i) { var r = A.seoOf(i.meta, i.body, "articles"); return !!(i.meta.keyword && i.meta.description) && r.fails === 0; }
      var incl = false, q = all.filter(ready);
      var notReady = all.filter(function (i) { return !ready(i); });
      q.sort(function (a, b) { return String(a.meta.publish_at || "9999").localeCompare(String(b.meta.publish_at || "9999")); });
      box.innerHTML = "";
      if (!all.length) { box.appendChild(h("p", { text: "Tidak ada draf atau artikel terjadwal. Buat dari menu Rencana & Keyword." })); return; }
      if (notReady.length) box.appendChild(h("div", { class: "pill warn", id: "sch_warn", text: notReady.length + " draf belum lolos cek SEO wajib (keyword/title/H1/description) dan TIDAK ikut dijadwalkan: " + notReady.map(function (i) { return i.meta.slug; }).join(", ") }));
      var start = h("input", { type: "date", id: "sch_start", value: A.today() }), per = h("select", { id: "sch_per" }, [1, 2, 3, 4, 5, 7].map(function (n) { return h("option", { value: n, selected: n === 3 }, [n + " artikel / minggu"]); })), time = h("input", { type: "text", id: "sch_time", value: "08:00" });
      box.appendChild(h("div", { class: "grid2" }, [h("label", { class: "f" }, ["Mulai tanggal", start]), h("label", { class: "f" }, ["Ritme", per]), h("label", { class: "f" }, ["Jam terbit (WIB, HH:MM)", time])]));
      var ul = h("ul", { class: "lay" });
      function draw() {
        ul.innerHTML = "";
        q.forEach(function (it, i) {
          ul.appendChild(h("li", {}, [h("span", { class: "nm", text: (i + 1) + ". " + (it.meta.title || it.path) }), h("span", { class: "pill " + (it.meta.tier || ""), text: it.meta.tier || "" }),
            h("span", { class: "muted", text: it.meta.publish_at ? it.meta.publish_at.slice(0, 16).replace("T", " ") : "belum dijadwalkan" }),
            h("button", { class: "btn o sm", text: "↑", disabled: i === 0, onclick: function () { q.splice(i - 1, 0, q.splice(i, 1)[0]); draw(); } }),
            h("button", { class: "btn o sm", text: "↓", disabled: i === q.length - 1, onclick: function () { q.splice(i + 1, 0, q.splice(i, 1)[0]); draw(); } })]));
        });
      }
      draw(); box.appendChild(ul);
      box.appendChild(h("button", { class: "btn", id: "sch_apply", text: "Terapkan jadwal otomatis", onclick: function () {
        var p = Number(per.value), t = /^\d{2}:\d{2}$/.test(time.value) ? time.value : "08:00";
        if (!start.value) return A.toast("Isi tanggal mulai.", true);
        q.forEach(function (it, i) {
          var d = new Date(start.value + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + Math.floor(i * 7 / p));
          it.meta.publish_at = d.toISOString().slice(0, 10) + "T" + t + ":00+07:00"; it.meta.status = "scheduled";
          if (!it.meta.date || it.meta.date > it.meta.publish_at.slice(0, 10)) it.meta.date = it.meta.publish_at.slice(0, 10);
          GH.stage(it.path, A.serializeFM(it.meta, it.body));
        });
        A.toast(q.length + " artikel dijadwalkan (belum disimpan ke GitHub)."); A.go();
      } }));
    });
  };

  /* ---- Rencana & keyword ---- */
  A.routes.rencana = function () {
    var m = A.view(), T = A.S.topics;
    m.appendChild(h("h2", { text: "Rencana Editorial & Keyword" }));
    m.appendChild(h("p", { class: "muted", text: "Strategi hub-and-spoke: keyword hard dijaga lewat halaman pilar; artikel medium/easy menaut ke pilar sehingga otoritasnya mengalir ke halaman utama. Tidak ada yang bisa menjamin peringkat 1; yang bisa dikontrol adalah kualitas, struktur, dan konsistensi." }));
    var tb = h("table", { class: "t" }, [h("thead", {}, [h("tr", {}, ["Keyword", "Tier", "Jenis", "Slug", "Status", ""].map(function (x) { return h("th", { text: x }); }))])]);
    var body = h("tbody");
    T.topics.forEach(function (t) {
      var btn = t.status === "planned" ? h("button", { class: "btn sm", text: "Buat draf", onclick: function () {
        var folder = t.type === "pilar" ? "pages" : "articles", path = "content/" + folder + "/" + t.slug + ".md";
        if (GH.exists(path)) return A.toast("Berkas sudah ada.", true);
        var d = A.newDraft({ keyword: t.keyword, slug: t.slug, tier: t.tier, pillar: t.tier === "hard" ? "" : "harga-mobil-listrik", title: t.keyword.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) });
        if (t.type === "pilar") { delete d.meta.models; delete d.meta.placements; delete d.meta.pillar; }
        GH.stage(path, A.serializeFM(d.meta, d.body)); t.status = "draft"; A.saveJSON("topics"); A.toast("Draf dibuat. Buka di menu Artikel untuk melengkapi."); A.go();
      } }) : h("a", { class: "btn o sm", href: "#/" + (t.type === "pilar" ? "halaman" : "artikel") + "/" + t.slug, text: "Buka" });
      body.appendChild(h("tr", {}, [h("td", { text: t.keyword }), h("td", {}, [h("span", { class: "pill " + t.tier, text: t.tier })]), h("td", { text: t.type }), h("td", { text: t.slug }), h("td", { text: t.status }), h("td", {}, [btn])]));
    });
    tb.appendChild(body); m.appendChild(h("div", { class: "card tw" }, [h("h3", { text: "Rencana topik" }), tb]));
    var ed = h("div", { class: "card" }, [h("h3", { text: "Edit daftar topik" })]);
    ed.appendChild(Forms.render([{ k: "topics", label: "Topik", t: "objlist", titleKey: "keyword", fields: [
      { k: "keyword", label: "Keyword", t: "text" }, { k: "tier", label: "Tier", t: "select", opts: ["hard", "medium", "easy"] }, { k: "type", label: "Jenis", t: "select", opts: ["artikel", "pilar"] },
      { k: "slug", label: "Slug", t: "text" }, { k: "status", label: "Status", t: "select", opts: ["planned", "draft", "published"] }] }], T, function () { A.saveJSON("topics"); }));
    m.appendChild(ed);
    var kd = h("div", { class: "card" }, [h("h3", { text: "Keyword yang dipantau di Laporan" })]);
    kd.appendChild(Forms.render([{ k: "keywords", label: "Keyword", t: "objlist", titleKey: "q", fields: [
      { k: "q", label: "Kueri (persis seperti diketik pencari)", t: "text" }, { k: "tier", label: "Tier", t: "select", opts: ["hard", "medium", "easy"] }, { k: "target", label: "Halaman target (path)", t: "text" }] }], A.S.keywords, function () { A.saveJSON("keywords"); }));
    m.appendChild(kd);
    var rd = h("div", { class: "card" }, [h("h3", { text: "Ambang aturan SEO" }), h("p", { class: "muted", text: "Dipakai skor SEO di editor. Perubahan di sini hanya memengaruhi penilaian di admin." })]);
    rd.appendChild(Forms.render([{ k: "min_words", label: "Minimal kata artikel", t: "num" }, { k: "density_min", label: "Kepadatan keyword min (%)", t: "num" }, { k: "density_max", label: "Kepadatan keyword maks (%)", t: "num" }, { k: "min_h2", label: "Minimal H2", t: "num" }], A.S.rules, function () { A.saveJSON("rules"); }));
    m.appendChild(rd);
  };

  /* ---- Laporan ---- */
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  A.routes.laporan = function () {
    var m = A.view();
    m.appendChild(h("h2", { text: "Laporan Website & Peringkat" }));
    var top = h("div", { class: "row" }, [h("button", { class: "btn", text: "Ambil data Search Console sekarang", onclick: function () { dispatch("report.yml"); } }), h("button", { class: "btn o", text: "Muat ulang", onclick: function () { A.go(); } })]);
    m.appendChild(card(null, [top, h("p", { class: "muted", text: "Data Search Console tertunda 2–3 hari dan posisi hanya muncul untuk kueri yang sudah punya impresi. Status index berasal dari URL Inspection API dan diperbarui harian oleh workflow report.yml." })]));
    var body = h("div", { class: "card" }, [h("p", { class: "muted", text: "Memuat…" })]);
    m.appendChild(body);
    return Promise.all([getJSON("build-info.json"), getJSON("../seo-report.json"), GH.readJSON("data/report.json", null).catch(function () { return null; })]).then(function (r) {
      var info = r[0], seo = r[1], gsc = r[2];
      body.innerHTML = "";
      var rep = gsc && !gsc.error ? gsc : null;
      if (!gsc) body.appendChild(h("p", { class: "pill warn", text: "Belum ada data Search Console" })), body.appendChild(h("p", { class: "muted", text: "Langkah: (1) verifikasi situs di Search Console, (2) buat service account Google Cloud + aktifkan Search Console API, (3) tambahkan emailnya sebagai pengguna di properti, (4) simpan JSON-nya sebagai secret GSC_SERVICE_ACCOUNT di GitHub, (5) jalankan workflow 'Laporan Search Console'." }));
      if (gsc && gsc.error) body.appendChild(h("p", { class: "pill bad", text: "Gagal mengambil data: " + gsc.error }));
      if (rep) body.appendChild(h("p", { class: "muted", text: "Data per " + new Date(rep.generated).toLocaleString("id-ID") + " · periode " + rep.range.startDate + " s/d " + rep.range.endDate }));

      var ins = (rep && rep.inspection) || {}, vals = Object.keys(ins).map(function (k) { return ins[k]; });
      var idx = vals.filter(function (v) { return v.verdict === "PASS"; }).length;
      if (rep) body.appendChild(h("div", { class: "row" }, [h("span", { class: "pill ok", text: idx + " URL terindeks" }), h("span", { class: "pill warn", text: (vals.length - idx) + " belum / bermasalah" }),
        h("span", { class: "pill", text: (rep.pages || []).reduce(function (a, p) { return a + p.clicks; }, 0) + " klik" }), h("span", { class: "pill", text: (rep.pages || []).reduce(function (a, p) { return a + p.impressions; }, 0) + " impresi" })]));

      /* artikel: on-page + index + performa */
      var arts = (info && info.articles_live) || [];
      var tb = h("table", { class: "t", id: "rep_art" }, [h("thead", {}, [h("tr", {}, ["Artikel", "Keyword", "Tier", "Kata", "SEO on-page", "Status index", "Crawl terakhir", "Klik", "Impresi", "Posisi"].map(function (x) { return h("th", { text: x }); }))])]);
      var tbd = h("tbody");
      arts.forEach(function (a) {
        var sp = seo && seo.pages.filter(function (p) { return p.path === a.path; })[0];
        var u = Object.keys(ins).filter(function (k) { return k.replace(/\/$/, "").slice(-a.path.replace(/\/$/, "").length) === a.path.replace(/\/$/, ""); })[0], i = u ? ins[u] : null;
        var pg = rep && rep.pages.filter(function (p) { return p.page.replace(/\/$/, "").slice(-a.path.replace(/\/$/, "").length) === a.path.replace(/\/$/, ""); })[0];
        tbd.appendChild(h("tr", {}, [h("td", {}, [h("a", { href: a.path, target: "_blank", rel: "noopener", text: a.title })]), h("td", { text: a.keyword }), h("td", {}, [h("span", { class: "pill " + a.tier, text: a.tier })]), h("td", { text: String(a.words) }),
          h("td", {}, [sp ? h("span", { class: "pill " + (sp.issues.length ? "warn" : "ok"), text: sp.passed + "/" + sp.total }) : "-"]),
          h("td", {}, [i ? h("span", { class: "pill " + (i.verdict === "PASS" ? "ok" : "warn"), text: i.coverage || i.verdict || "?" }) : "-"]), h("td", { text: i && i.lastCrawl ? i.lastCrawl.slice(0, 10) : "-" }),
          h("td", { text: pg ? String(pg.clicks) : "-" }), h("td", { text: pg ? String(pg.impressions) : "-" }), h("td", { text: pg ? String(pg.position) : "-" })]));
      });
      if (!arts.length) tbd.appendChild(h("tr", {}, [h("td", { colspan: 10, class: "muted", text: "Belum ada data build. Terbitkan situs terlebih dulu." })]));
      tb.appendChild(tbd);
      body.appendChild(h("h3", { text: "Peringkat artikel yang di-crawl & terindeks" })); body.appendChild(h("div", { class: "tw" }, [tb]));

      var kws = (rep && rep.keywords) || A.S.keywords.keywords.map(function (k) { return { q: k.q, tier: k.tier, target: k.target, position: null, clicks: 0, impressions: 0 }; });
      var kt = h("table", { class: "t", id: "rep_kw" }, [h("thead", {}, [h("tr", {}, ["Keyword", "Tier", "Target", "Posisi terbaik", "Klik", "Impresi"].map(function (x) { return h("th", { text: x }); }))])]);
      var kb = h("tbody");
      kws.forEach(function (k) { kb.appendChild(h("tr", {}, [h("td", { text: k.q }), h("td", {}, [h("span", { class: "pill " + k.tier, text: k.tier })]), h("td", { text: k.target }), h("td", { text: k.position == null ? "belum ada impresi" : String(k.position) }), h("td", { text: String(k.clicks) }), h("td", { text: String(k.impressions) })])); });
      kt.appendChild(kb);
      body.appendChild(h("h3", { text: "Posisi keyword (hard / medium / easy)" })); body.appendChild(h("div", { class: "tw" }, [kt]));

      if (rep && rep.top_queries && rep.top_queries.length) {
        var qt = h("table", { class: "t" }, [h("thead", {}, [h("tr", {}, ["Kueri lain yang memunculkan situs", "Halaman", "Posisi", "Klik", "Impresi"].map(function (x) { return h("th", { text: x }); }))])]);
        var qb = h("tbody"); rep.top_queries.slice(0, 25).forEach(function (q) { qb.appendChild(h("tr", {}, [h("td", { text: q.query }), h("td", { text: q.page.replace(/^https?:\/\/[^/]+/, "") }), h("td", { text: String(q.position) }), h("td", { text: String(q.clicks) }), h("td", { text: String(q.impressions) })])); });
        qt.appendChild(qb); body.appendChild(h("h3", { text: "Peluang keyword baru" })); body.appendChild(h("div", { class: "tw" }, [qt]));
      }
      if (seo) {
        var bad = seo.pages.filter(function (p) { return p.issues.length; });
        body.appendChild(h("h3", { text: "Audit SEO on-page build terakhir: " + seo.fails + " gagal, " + seo.warns + " peringatan" }));
        bad.forEach(function (p) { body.appendChild(h("div", {}, [h("strong", { text: p.path }), h("ul", {}, p.issues.map(function (x) { return h("li", { text: x.level + ": " + x.msg }); }))])); });
        if (!bad.length) body.appendChild(h("p", { class: "muted", text: "Semua halaman lolos." }));
      }
    });
  };
})(window);

/* Editor artikel & halaman pilar: front matter, toolbar, pratinjau, skor SEO, SERP, jadwal terbit */
(function (root) {
  "use strict";
  var A = root.A, h = A.h;
  var KEYS = ["title", "h1", "slug", "keyword", "secondary", "tier", "intent", "description", "date", "updated", "publish_at", "status", "category", "cover", "cover_alt", "author", "models", "placements", "pillar", "in_footer"];
  var FM = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

  A.parseFM = function (text) {
    var m = FM.exec(text.replace(/\r\n/g, "\n"));
    if (!m) return { meta: {}, body: text };
    var meta = {};
    m[1].split("\n").forEach(function (ln) {
      if (!ln.trim() || ln.trim()[0] === "#") return;
      var i = ln.indexOf(":"); if (i < 0) return;
      meta[ln.slice(0, i).trim()] = ln.slice(i + 1).trim();
    });
    return { meta: meta, body: m[2].trim() + "\n" };
  };
  A.serializeFM = function (meta, body) {
    var lines = KEYS.filter(function (k) { return meta[k] !== undefined && String(meta[k]).trim() !== ""; }).map(function (k) { return k + ": " + String(meta[k]).replace(/\s*\n\s*/g, " ").trim(); });
    return "---\n" + lines.join("\n") + "\n---\n\n" + body.trim() + "\n";
  };
  A.loadItems = function (folder) {
    var ps = GH.paths("content/" + folder + "/", ".md");
    return Promise.all(ps.map(function (p) { return GH.read(p).then(function (t) { var f = A.parseFM(t); return { path: p, meta: f.meta, body: f.body }; }); }));
  };
  A.visible = function (meta) {
    var st = meta.status || "published";
    if (st !== "published" && st !== "scheduled") return false;
    var d = meta.publish_at || meta.date;
    if (!d) return true;
    var t = Date.parse(d.length === 10 ? d + "T00:00:00+07:00" : d);
    return isNaN(t) || t <= Date.now();
  };
  A.statusOf = function (meta) {
    var st = meta.status || "published";
    if (st === "draft") return ["Draf", "warn"];
    if (A.visible(meta)) return ["Tayang", "ok"];
    return ["Terjadwal " + (meta.publish_at || meta.date || "").slice(0, 16).replace("T", " "), ""];
  };
  A.seoOf = function (meta, body, kind) {
    return SEO.check({ kind: kind === "pages" ? "page" : "article", title: meta.title, h1: meta.h1 || meta.title, slug: meta.slug, keyword: meta.keyword, description: meta.description,
      body: body, cover: meta.cover, cover_alt: meta.cover_alt, tier: meta.tier, models: (meta.models || "").split(",").filter(Boolean) }, A.S.rules);
  };

  function listScreen(folder, label, kind) {
    var m = A.view();
    m.appendChild(h("div", { class: "row sb" }, [h("h2", { text: label }), h("a", { class: "btn", href: "#/" + kind + "/baru", text: "+ Baru" })]));
    var holder = h("div", { class: "card tw" }, [h("p", { class: "muted", text: "Memuat…" })]);
    m.appendChild(holder);
    return A.loadItems(folder).then(function (items) {
      items.sort(function (a, b) { return String(b.meta.publish_at || b.meta.date || "").localeCompare(String(a.meta.publish_at || a.meta.date || "")); });
      var tb = h("table", { class: "t" }, [h("thead", {}, [h("tr", {}, ["Judul", "Keyword", "Tier", "Status", "Skor SEO", "Kata", ""].map(function (x) { return h("th", { text: x }); }))])]);
      var body = h("tbody");
      items.forEach(function (it) {
        var st = A.statusOf(it.meta), r = A.seoOf(it.meta, it.body, folder);
        var slug = it.path.split("/").pop().replace(/\.md$/, "");
        body.appendChild(h("tr", {}, [h("td", { text: it.meta.title || slug }), h("td", { text: it.meta.keyword || "-" }),
          h("td", {}, [it.meta.tier ? h("span", { class: "pill " + it.meta.tier, text: it.meta.tier }) : "-"]),
          h("td", {}, [h("span", { class: "pill " + st[1], text: st[0] })]),
          h("td", {}, [h("span", { class: "pill " + (r.score >= 85 ? "ok" : r.score >= 60 ? "warn" : "bad"), text: r.score + "" })]), h("td", { text: String(r.words) }),
          h("td", {}, [h("a", { class: "btn o sm", href: "#/" + kind + "/" + slug, text: "Edit" })])]));
      });
      if (!items.length) body.appendChild(h("tr", {}, [h("td", { colspan: 7, class: "muted", text: "Belum ada konten." })]));
      tb.appendChild(body); holder.innerHTML = ""; holder.appendChild(tb);
    });
  }

  var TEMPLATE = function (kw) {
    return "Tulis 2–3 kalimat pembuka yang memuat **" + kw + "** dalam 100 kata pertama dan menjelaskan apa yang pembaca dapatkan.\n\n## Ringkasan Cepat\n\nJawaban singkat dan rekomendasi utama.\n\n## Tabel Perbandingan\n\n{{compare byd-atto-3 slug-pesaing}}\n\n## Harga\n\nBahas harga dan basis OTR. Link ke [halaman harga](/harga-byd/).\n\n## Spesifikasi\n\nBaterai, jarak tempuh, tenaga. Sebut standar (NEDC/WLTP).\n\n## Siapa Cocok Memilih yang Mana?\n\n- Kebutuhan A: model X\n- Kebutuhan B: model Y\n\n## Langkah Sebelum Membeli\n\n1. Hitung kebutuhan harian.\n2. Minta penawaran tertulis.\n3. Test drive.\n\n{{cta model=byd-atto-3}}\n\n## FAQ\n\n### Pertanyaan 1?\n\nJawaban.\n\n### Pertanyaan 2?\n\nJawaban.\n";
  };
  A.newDraft = function (o) {
    var kw = o.keyword || "";
    var meta = { title: o.title || kw, h1: o.h1 || o.title || kw, slug: A.slug(o.slug || kw || o.title), keyword: kw, tier: o.tier || "medium", intent: o.intent || "komersial", description: "", date: A.today(), status: "draft", category: o.category || "Perbandingan", pillar: o.pillar || "", models: "", placements: "home,prices" };
    return { meta: meta, body: TEMPLATE(kw) };
  };

  function editor(folder, kind, rest) {
    var m = A.view(), isPage = folder === "pages";
    var item, origPath = null;
    var ready = rest === "baru" ? Promise.resolve(A.newDraft({})) :
      GH.read("content/" + folder + "/" + rest + ".md").then(function (t) { var f = A.parseFM(t); origPath = "content/" + folder + "/" + rest + ".md"; return f; });
    return ready.then(function (it) {
      item = it; var meta = item.meta;
      if (!meta.status) meta.status = "published";
      m.appendChild(h("div", { class: "row sb" }, [h("h2", { text: rest === "baru" ? "Baru" : (meta.title || rest) }), h("a", { class: "btn o", href: "#/" + kind, text: "← Daftar" })]));
      var left = h("div"), right = h("div");
      m.appendChild(h("div", { class: "ed" }, [left, right]));

      function tf(key, label, opt) {
        opt = opt || {};
        var inp = opt.area ? h("textarea", { rows: opt.rows || 2 }) : h("input", { type: opt.type || "text" });
        inp.id = "a_" + key; inp.value = meta[key] || "";
        if (opt.type === "datetime-local") inp.value = (meta[key] || "").slice(0, 16);
        inp.addEventListener("input", function () {
          meta[key] = opt.type === "datetime-local" ? (inp.value ? inp.value + ":00+07:00" : "") : inp.value;
          if (opt.after) opt.after(); refresh();
        });
        return h("label", { class: "f", for: "a_" + key }, [label, opt.hint ? h("small", { text: opt.hint }) : null, inp]);
      }
      function sel(key, label, opts, after) {
        var s = h("select", { id: "a_" + key }, opts.map(function (o) { var v = Array.isArray(o) ? o[0] : o; return h("option", { value: v, selected: (meta[key] || "") === v }, [Array.isArray(o) ? o[1] : o]); }));
        s.addEventListener("change", function () { meta[key] = s.value; if (after) after(); refresh(); });
        return h("label", { class: "f" }, [label, s]);
      }
      var card1 = h("div", { class: "card" }, [h("h3", { text: "Informasi SEO" })]);
      card1.appendChild(tf("keyword", "Keyword utama", { hint: "Satu keyword yang ditargetkan halaman ini" }));
      card1.appendChild(tf("title", "Title tag (30–60 karakter)", { after: function () { if (!slugTouched && rest === "baru") { meta.slug = A.slug(meta.keyword || meta.title); var e = document.getElementById("a_slug"); if (e) e.value = meta.slug; } } }));
      card1.appendChild(tf("h1", "H1 (judul di halaman)"));
      var slugTouched = rest !== "baru";
      card1.appendChild(tf("slug", "Slug URL", { hint: "Huruf kecil & tanda hubung; memuat keyword. Jangan diubah setelah tayang." }));
      card1.appendChild(tf("description", "Meta description (70–160 karakter)", { area: true }));
      card1.appendChild(tf("secondary", "Keyword pendukung (pisahkan dengan titik koma)"));
      card1.appendChild(h("div", { class: "grid2" }, [sel("tier", "Tier keyword", [["hard", "Hard (kompetitif)"], ["medium", "Medium"], ["easy", "Easy"]]), sel("intent", "Intent", ["komersial", "informasional", "transaksional", "navigasional"])]));
      left.appendChild(card1);
      document.addEventListener("input", function once(e) { if (e.target && e.target.id === "a_slug") { slugTouched = true; document.removeEventListener("input", once); } });

      var card2 = h("div", { class: "card" }, [h("h3", { text: "Isi" })]);
      var tbar = h("div", { class: "toolbar" });
      var ta = h("textarea", { id: "a_body", rows: 22 }); ta.value = item.body;
      function ins(pre, post, ph) {
        var s = ta.selectionStart, e = ta.selectionEnd, sel_ = ta.value.slice(s, e) || ph || "";
        ta.value = ta.value.slice(0, s) + pre + sel_ + (post || "") + ta.value.slice(e);
        ta.focus(); ta.selectionStart = s + pre.length; ta.selectionEnd = s + pre.length + sel_.length;
        item.body = ta.value; refresh();
      }
      [["H2", "\n## ", "\n", "Subjudul"], ["H3", "\n### ", "\n", "Sub-subjudul"], ["B", "**", "**", "tebal"], ["I", "*", "*", "miring"], ["• List", "\n- ", "\n", "butir"], ["1. List", "\n1. ", "\n", "langkah"],
        ["Link", "[", "](/harga-byd/)", "teks link"], ["Tabel", "\n| Kolom A | Kolom B |\n|---|---|\n| ", " | isi |\n", "isi"], ["FAQ", "\n\n## FAQ\n\n### ", "?\n\nJawaban.\n", "Pertanyaan"],
        ["{{compare}}", "\n\n{{compare ", "}}\n\n", "byd-atto-3 chery-e5-pure"], ["{{cta}}", "\n\n{{cta model=", "}}\n\n", "byd-atto-3"], ["{{pricelist}}", "\n\n{{pricelist min=100 max=400}}\n\n", "", ""], ["{{modelcard}}", "\n\n{{modelcard ", "}}\n\n", "byd-atto-1 byd-atto-3"]
      ].forEach(function (b) { tbar.appendChild(h("button", { type: "button", text: b[0], onclick: function () { ins(b[1], b[2], b[3]); } })); });
      var imgSel = h("button", { type: "button", text: "+ Gambar", title: "Sisipkan gambar dari Media", onclick: function () {
        A.pickImage("", function (src) { if (!src) return; var md_ = (A.S.media.items || []).filter(function (x) { return x.src === src; })[0]; ins("\n\n![", "](" + src + ")\n\n", (md_ && md_.alt) || "deskripsi gambar"); });
      } });
      tbar.appendChild(imgSel);
      card2.appendChild(tbar); card2.appendChild(ta);
      ta.addEventListener("input", function () { item.body = ta.value; refresh(); });
      left.appendChild(card2);

      if (!isPage) {
        var card3 = h("div", { class: "card" }, [h("h3", { text: "Cover, penulis, kategori" })]);
        var coverBox = Forms.render([{ k: "cover", label: "Gambar cover", t: "image" }], meta, function () { refresh(); });
        coverBox.id = "a_cover";
        card3.appendChild(coverBox);
        card3.appendChild(tf("cover_alt", "Alt teks cover"));
        card3.appendChild(h("div", { class: "grid2" }, [tf("category", "Kategori"), tf("author", "Penulis (kosong = default situs)")]));
        left.appendChild(card3);

        var card4 = h("div", { class: "card" }, [h("h3", { text: "Distribusi ke halaman lain (mendorong halaman utama)" })]);
        card4.appendChild(h("p", { class: "muted", text: "Artikel otomatis menaut ke halaman model/pilar terkait dan tampil sebagai artikel pendukung di sana. Pilih di mana ia ditampilkan." }));
        var curM = (meta.models || "").split(",").filter(Boolean), curP = (meta.placements || "").split(",").filter(Boolean);
        function boxes(title, arr, store, opts) {
          var wrap = h("div", { class: "sub-list" }, [h("strong", { text: title })]);
          opts.forEach(function (o) {
            wrap.appendChild(h("label", { class: "chk" }, [h("input", { type: "checkbox", checked: arr.indexOf(o[0]) >= 0, onchange: function (e) {
              var i = arr.indexOf(o[0]); if (e.target.checked && i < 0) arr.push(o[0]); if (!e.target.checked && i >= 0) arr.splice(i, 1);
              meta[store] = arr.join(","); refresh(); } }), o[1]]));
          });
          return wrap;
        }
        card4.appendChild(boxes("Model BYD yang dibahas (tampil di kotak model + halaman model)", curM, "models", A.S.models.map(function (x) { return [x.slug, x.name]; })));
        card4.appendChild(boxes("Tempat tampil tambahan", curP, "placements", [["home", "Beranda"], ["prices", "Halaman harga"]].concat(A.S.models.map(function (x) { return ["model:" + x.slug, "Halaman " + x.name]; }))));
        var pillars = [["", "— tanpa pilar —"]];
        GH.paths("content/pages/", ".md").forEach(function (p) { var s_ = p.split("/").pop().replace(/\.md$/, ""); pillars.push([s_, s_]); });
        card4.appendChild(sel("pillar", "Halaman pilar yang didukung (artikel menaut balik ke sini)", pillars));
        left.appendChild(card4);
      }

      var card5 = h("div", { class: "card" }, [h("h3", { text: "Status & jadwal terbit" })]);
      card5.appendChild(sel("status", "Status", [["draft", "Draf (tidak tayang)"], ["scheduled", "Terjadwal"], ["published", "Terbit"]], function () { sched.style.display = meta.status === "scheduled" ? "" : "none"; }));
      var sched = h("div", {}, [tf("publish_at", "Terbit pada (WIB)", { type: "datetime-local", hint: "Situs dibangun ulang tiap jam; artikel tayang di jam berikutnya." })]);
      sched.style.display = meta.status === "scheduled" ? "" : "none";
      card5.appendChild(sched);
      card5.appendChild(h("div", { class: "grid2" }, [tf("date", "Tanggal (YYYY-MM-DD)"), tf("updated", "Diperbarui (YYYY-MM-DD)")]));
      left.appendChild(card5);

      var save = h("div", { class: "row" }, [
        h("button", { class: "btn", id: "savebtn", text: "Simpan (siapkan perubahan)", onclick: function () { doSave(false); } }),
        h("button", { class: "btn o", id: "pubbtn", text: "Simpan & terbitkan sekarang", onclick: function () { doSave(true); } }),
        rest !== "baru" ? h("button", { class: "btn d", text: "Hapus", onclick: function () {
          if (!confirm("Hapus permanen " + (meta.title || rest) + "?")) return;
          GH.stageDelete(origPath); A.toast("Dihapus (belum disimpan ke GitHub)."); location.hash = "#/" + kind;
        } }) : null]);
      left.appendChild(save);

      /* panel kanan */
      var scoreBox = h("div", { class: "card" }), serp = h("div", { class: "card" }), prev = h("div", { class: "preview", id: "preview" });
      right.appendChild(scoreBox); right.appendChild(serp);
      right.appendChild(h("div", { class: "card" }, [h("h3", { text: "Pratinjau isi" }), prev]));

      function stub(n, a) { return '<div class="stub"><strong>{{' + A.esc(n) + "}}</strong> " + A.esc(a) + " — dirender penuh saat build</div>"; }
      var tm = null;
      function refresh() {
        clearTimeout(tm);
        tm = setTimeout(function () {
          var r = A.seoOf(meta, item.body, folder);
          scoreBox.innerHTML = "";
          scoreBox.appendChild(h("div", { class: "row sb" }, [h("h3", { text: "Skor SEO" }), h("span", { class: "score", id: "score", style: "color:" + (r.score >= 85 ? "var(--ok)" : r.score >= 60 ? "var(--warn)" : "var(--bad)"), text: String(r.score) })]));
          scoreBox.appendChild(h("div", { class: "muted", text: r.words + " kata" }));
          var ul = h("ul", { class: "chkl", id: "checks" });
          r.checks.slice().sort(function (a, b) { return (a.ok ? 1 : 0) - (b.ok ? 1 : 0); }).forEach(function (c) {
            ul.appendChild(h("li", { class: c.ok ? "ok" : c.level }, [h("span", { class: "i", text: c.ok ? "✓" : c.level === "fail" ? "✗" : "!" }), h("span", { text: c.msg + (!c.ok && c.tip ? " — " + c.tip : "") })]));
          });
          scoreBox.appendChild(ul);
          var dom = (A.S.site.domain || "").replace(/\/$/, "").replace(/^https?:\/\//, "");
          var path = isPage ? "/" + (meta.slug || "") + "/" : "/blog/" + (meta.slug || "") + "/";
          serp.innerHTML = "";
          serp.appendChild(h("h3", { text: "Pratinjau hasil Google" }));
          serp.appendChild(h("div", { class: "serp" }, [h("div", { class: "u", text: dom + path }), h("div", { class: "t", text: (meta.title || "(title kosong)").slice(0, 62) + ((meta.title || "").length > 62 ? "…" : "") }), h("div", { class: "d", text: (meta.description || "(meta description kosong)").slice(0, 160) })]));
          var out = MD.render(item.body, { shortcode: stub, img: function (s, a) { return '<img src="' + A.esc(s) + '" alt="' + A.esc(a) + '">'; } });
          prev.innerHTML = '<h1 style="font-size:1.4rem">' + A.esc(meta.h1 || meta.title || "") + "</h1>" + out.html +
            (out.faqs.length ? "<h2>FAQ</h2>" + out.faqs.map(function (f) { return "<h3>" + A.esc(f[0]) + "</h3><p>" + MD.inline(f[1]) + "</p>"; }).join("") : "");
        }, 120);
      }
      function doSave(publishNow) {
        meta.slug = A.slug(meta.slug || meta.keyword || meta.title);
        if (!meta.title || !meta.slug) return A.toast("Title dan slug wajib diisi.", true);
        if (!meta.h1) meta.h1 = meta.title;
        var dir = "content/" + folder + "/", path = dir + meta.slug + ".md";
        if (path !== origPath && GH.exists(path)) return A.toast("Slug '" + meta.slug + "' sudah dipakai.", true);
        if (isPage === false && A.S.models.some(function (x) { return x.slug === meta.slug; })) return A.toast("Slug bentrok dengan halaman model.", true);
        if (publishNow) { meta.status = "published"; meta.publish_at = ""; }
        if (meta.status === "scheduled" && !meta.publish_at) return A.toast("Isi tanggal & jam terbit untuk status Terjadwal.", true);
        if (meta.status === "published" && !meta.date) meta.date = A.today();
        if (!meta.date) meta.date = A.today();
        meta.updated = A.today();
        var r = A.seoOf(meta, item.body, folder);
        if (meta.status !== "draft" && r.fails) A.toast("Peringatan: " + r.fails + " cek SEO wajib belum lolos, tetap disimpan.", true);
        if (origPath && origPath !== path) GH.stageDelete(origPath);
        GH.stage(path, A.serializeFM(meta, item.body));
        origPath = path;
        A.toast("Disiapkan: " + path + ". Klik 'Simpan ke GitHub' di bawah untuk tayang.");
        if (rest === "baru") location.hash = "#/" + kind + "/" + meta.slug;
      }
      refresh();
    });
  }

  A.routes.artikel = function (rest) { return rest ? editor("articles", "artikel", rest) : listScreen("articles", "Artikel", "artikel"); };
  A.routes.halaman = function (rest) { return rest ? editor("pages", "halaman", rest) : listScreen("pages", "Halaman Pilar & Landing", "halaman"); };
})(window);

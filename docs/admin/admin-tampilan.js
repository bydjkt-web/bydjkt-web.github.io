/* Menu Tampilan: Warna Template (tema siap pakai + warna manual + pratinjau + cek kontras) dan Mitra Leasing (slider logo). */
(function () {
  "use strict";
  var A = window.A, h = A.h, GH = window.GH;

  function rgb(x) { return [1, 3, 5].map(function (i) { return parseInt(x.substr(i, 2), 16); }); }
  function lum(x) {
    var c = rgb(x).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var l = [lum(a), lum(b)].sort(function (p, q) { return q - p; }); return (l[0] + 0.05) / (l[1] + 0.05); }
  function mix(a, b, t) { var p = rgb(a), q = rgb(b); return "#" + p.map(function (v, i) { return ("0" + Math.round(v + (q[i] - v) * t).toString(16)).slice(-2); }).join(""); }
  function darken(x, f) { return "#" + rgb(x).map(function (v) { return ("0" + Math.floor(v * f).toString(16)).slice(-2); }).join(""); }
  var HEX = /^#[0-9a-fA-F]{6}$/;

  var COLORS = [
    { k: "dark", label: "Warna gelap (hero, footer, teks)", hint: "Dipakai sebagai latar hero dan footer; harus gelap agar teks putih terbaca." },
    { k: "primary", label: "Warna utama (batang jarak tempuh, banner promo)", hint: "" },
    { k: "accent", label: "Warna tombol & tautan", hint: "Teks tombol otomatis putih atau gelap, mengikuti mana yang lebih terbaca." },
    { k: "paper", label: "Warna latar halaman", hint: "Sebaiknya terang." }
  ];

  A.routes.tema = function () {
    var m = A.view(), T = A.S.theme;
    m.appendChild(h("h2", { text: "Warna Template" }));
    m.appendChild(h("p", { class: "muted", text: "Pilih tema siap pakai atau atur warna sendiri. Perubahan baru tayang di situs setelah 'Simpan ke GitHub' (situs dibangun ulang otomatis, sekitar 1–2 menit)." }));

    var presetBox = h("div", { class: "card" }, [h("h3", { text: "Tema siap pakai" })]);
    var grid = h("div", { class: "presets" });
    var manual = h("div", { class: "card" }, [h("h3", { text: "Atur sendiri (opsional)" })]);
    var side = h("div", { class: "card" }, [h("h3", { text: "Pratinjau" })]);
    var prev = h("div", { class: "tprev" });
    var check = h("div", { class: "tcheck" });
    var inputs = {};

    function save() { A.saveJSON("theme"); }
    function paint() {
      var d = T.dark, p = T.primary, a = T.accent, pa = T.paper;
      var onacc = contrast(a, "#ffffff") >= contrast(a, "#101820") ? "#ffffff" : "#101820";
      prev.setAttribute("style", "--ink:" + d + ";--ev:" + p + ";--acc:" + a + ";--onacc:" + onacc + ";--paper:" + pa + ";--ig:" + mix(d, p, .5) + ";--line:" + mix(pa, d, .15) + ";--it:" + mix(d, "#ffffff", .8));
      prev.innerHTML = '<div class="pp-promo">Free charging di dealer Harmony</div><div class="pp-hero"><b>Mobil Listrik BYD: Harga OTR, Promo &amp; Test Drive</b><span class="pp-btn">Test Drive</span></div>' +
        '<div class="pp-body"><div class="pp-card"><b>BYD Atto 1</b> <em>Rp199 juta</em><i><u></u></i></div></div>';
      var msgs = [], c1 = contrast(a, onacc), c2 = contrast(d, "#ffffff"), c3 = contrast(d, pa);
      msgs.push([c1 >= 4.5, "Teks tombol: kontras " + c1.toFixed(1) + ":1" + (c1 >= 4.5 ? " (baik)" : " (rendah, pilih warna tombol yang lebih gelap atau lebih terang)")]);
      msgs.push([c2 >= 7, "Teks putih di atas warna gelap: " + c2.toFixed(1) + ":1" + (c2 >= 7 ? " (baik)" : " (kurang gelap)")]);
      msgs.push([c3 >= 7, "Teks di atas latar halaman: " + c3.toFixed(1) + ":1" + (c3 >= 7 ? " (baik)" : " (latar terlalu mirip warna gelap)")]);
      check.innerHTML = "";
      msgs.forEach(function (x) { check.appendChild(h("div", { class: x[0] ? "ok" : "bad", text: (x[0] ? "✓ " : "⚠ ") + x[1] })); });
      Array.prototype.forEach.call(grid.children, function (c) { c.classList.toggle("sel", c.getAttribute("data-id") === T.preset); });
      COLORS.forEach(function (c) { var o = inputs[c.k]; o.col.value = T[c.k]; o.txt.value = T[c.k]; });
    }
    (T.presets || []).forEach(function (pr) {
      var sw = h("div", { class: "sw" }, [h("i", { style: "flex:2;background:" + pr.dark }), h("i", { style: "background:" + pr.primary }), h("i", { style: "background:" + pr.accent }), h("i", { style: "background:" + pr.paper })]);
      grid.appendChild(h("button", { type: "button", class: "preset", "data-id": pr.id, onclick: function () {
        T.preset = pr.id; COLORS.forEach(function (c) { T[c.k] = pr[c.k]; }); save(); paint();
      } }, [sw, h("span", { text: pr.name })]));
    });
    presetBox.appendChild(grid);

    COLORS.forEach(function (c) {
      var col = h("input", { type: "color", "aria-label": c.label });
      var txt = h("input", { type: "text", maxlength: 7, placeholder: "#RRGGBB", "aria-label": c.label + " (kode hex)" });
      function setv(v) { if (!HEX.test(v)) return; T[c.k] = v.toLowerCase(); T.preset = "custom"; save(); paint(); }
      col.addEventListener("input", function () { setv(col.value); });
      txt.addEventListener("change", function () { var v = txt.value.trim(); if (v && v[0] !== "#") v = "#" + v; if (HEX.test(v)) setv(v); else { A.toast("Kode warna harus format #RRGGBB", true); txt.value = T[c.k]; } });
      inputs[c.k] = { col: col, txt: txt };
      manual.appendChild(h("div", { class: "colrow" }, [h("label", { class: "f" }, [c.label, c.hint ? h("small", { text: c.hint }) : null]), h("div", { class: "pick" }, [col, txt])]));
    });
    manual.appendChild(h("div", { class: "row", style: "margin-top:10px" }, [h("button", { type: "button", class: "btn o sm", text: "Kembalikan ke Atlantic Grey", onclick: function () {
      var d = (T.presets || []).filter(function (x) { return x.id === "atlantic"; })[0]; if (!d) return;
      T.preset = d.id; COLORS.forEach(function (c) { T[c.k] = d[c.k]; }); save(); paint();
    } })]));
    side.appendChild(prev); side.appendChild(check);
    var wrap = h("div", { class: "two" }, [h("div", {}, [presetBox, manual]), h("div", {}, [side])]);
    m.appendChild(wrap);
    paint();
  };

  /* ---- Mitra leasing ---- */
  A.routes.leasing = function () {
    var m = A.view(), L = A.S.leasing;
    L.items = L.items || [];
    m.appendChild(h("h2", { text: "Mitra Leasing" }));
    m.appendChild(h("p", { class: "muted", text: "Logo tampil di slider (beranda dan/atau halaman model). Slot logo berbentuk persegi panjang 3:1. Gunakan logo berlatar transparan (PNG/WebP), disarankan 300 × 100 px atau lebih besar dengan rasio sama; logo otomatis dikecilkan ke WebP maks 600 px. Jika belum ada logo, nama leasing tampil sebagai teks. Slider disembunyikan otomatis bila daftar kosong." }));
    var opt = h("div", { class: "card" }, [h("h3", { text: "Pengaturan slider" })]);
    opt.appendChild(Forms.render([
      { k: "title", label: "Judul bagian", t: "text" }, { k: "intro", label: "Kalimat pengantar", t: "area", rows: 2 },
      { k: "show_home", label: "Tampilkan di beranda", t: "bool" }, { k: "show_model", label: "Tampilkan di halaman detail model", t: "bool" }, { k: "autoplay", label: "Putar otomatis (berhenti saat disentuh)", t: "bool" }
    ], L, function () { A.saveJSON("leasing"); }));
    m.appendChild(opt);
    m.appendChild(h("p", { class: "muted", text: "Urutan bagian slider di halaman bisa diatur di menu Layout & Urutan." }));

    var list = h("div", { class: "card" }, [h("h3", { text: "Daftar logo" })]);
    var rows = h("div");
    function logoBox(it) {
      var box = h("div", { class: "lbox" });
      if (it.logo) {
        var img = h("img", { alt: "" });
        GH.readBytes("content" + it.logo).then(function (b) { img.src = URL.createObjectURL(new Blob([b], { type: "image/webp" })); }).catch(function () { box.textContent = "[logo belum terbaca]"; });
        box.appendChild(img);
      } else box.textContent = "[LOGO]";
      return box;
    }
    function draw() {
      rows.innerHTML = "";
      if (!L.items.length) rows.appendChild(h("p", { class: "muted", text: "Belum ada logo. Klik 'Tambah logo leasing' di bawah." }));
      L.items.forEach(function (it, i) {
        var file = h("input", { type: "file", accept: "image/*", "aria-label": "Unggah logo " + (it.name || i + 1), onchange: function () {
          var f = file.files[0]; if (!f) return;
          var base = "leasing-" + (A.slug(it.name || "") || (i + 1));
          A.toWebp(f, 600).then(function (r) {
            var name = base + ".webp", path = "content/img/" + name;
            GH.stage(path, r.bytes);
            it.logo = "/img/" + name;
            A.S.media.items = (A.S.media.items || []).filter(function (x) { return x.src !== it.logo; });
            A.S.media.items.push({ src: it.logo, alt: "Logo " + (it.name || "leasing"), w: r.w, h: r.h, kb: Math.round(r.bytes.length / 1024), file: name });
            A.saveJSON("media"); A.saveJSON("leasing");
            A.toast("Logo diunggah (" + r.w + "×" + r.h + " px, " + Math.round(r.bytes.length / 1024) + " KB)"); draw();
          }).catch(A.fail);
        } });
        var ratio = h("div", { class: "muted", text: "" });
        rows.appendChild(h("div", { class: "lrow" }, [logoBox(it), h("div", { class: "lf" }, [
          h("label", { class: "f" }, ["Nama leasing", h("input", { type: "text", value: it.name || "", oninput: function (e) { it.name = e.target.value; A.saveJSON("leasing"); } })]),
          h("label", { class: "f" }, ["Link (opsional, https://…)", h("input", { type: "url", value: it.url || "", oninput: function (e) { it.url = e.target.value; A.saveJSON("leasing"); } })]),
          h("label", { class: "f" }, [it.logo ? "Ganti logo" : "Unggah logo", file]), ratio,
          h("div", { class: "row" }, [
            h("button", { type: "button", class: "btn o sm", text: "↑", disabled: i === 0, onclick: function () { L.items.splice(i - 1, 0, L.items.splice(i, 1)[0]); A.saveJSON("leasing"); draw(); } }),
            h("button", { type: "button", class: "btn o sm", text: "↓", disabled: i === L.items.length - 1, onclick: function () { L.items.splice(i + 1, 0, L.items.splice(i, 1)[0]); A.saveJSON("leasing"); draw(); } }),
            h("button", { type: "button", class: "btn d sm", text: "Hapus", onclick: function () { L.items.splice(i, 1); A.saveJSON("leasing"); draw(); } })
          ])
        ])]));
      });
    }
    list.appendChild(rows);
    list.appendChild(h("button", { type: "button", class: "btn", text: "+ Tambah logo leasing", onclick: function () { L.items.push({ name: "", logo: "", url: "" }); A.saveJSON("leasing"); draw(); } }));
    m.appendChild(list);
    draw();
  };

  /* ---- Testimoni & Serah Terima ---- */
  function modelOpts() { return [["", "— tidak terkait model tertentu —"]].concat((A.S.models || []).map(function (m) { return [m.slug, m.name]; })); }
  var CONSENT_NOTE = "Hanya isi testimoni/foto yang benar-benar dari customer dan sudah diizinkan tampil (nama, foto, dan wajah). Item tanpa centang izin tidak akan tayang. Jangan membuat testimoni palsu: itu melanggar kebijakan Google dan bisa merugikan reputasi dealer.";
  function countNote(items, ok) {
    var n = (items || []).length, v = (items || []).filter(ok).length;
    return n + " item tersimpan, " + v + " siap tayang" + (n > v ? " (" + (n - v) + " belum lengkap atau belum ada izin)" : "") + ".";
  }
  A.routes.testimoni = function () {
    var m = A.view(), T = A.S.testi; T.items = T.items || [];
    m.appendChild(h("h2", { text: "Testimoni Customer" }));
    m.appendChild(h("p", { class: "muted", text: CONSENT_NOTE }));
    m.appendChild(h("p", { class: "muted", text: countNote(T.items, function (t) { return t.consent === true && t.name && (t.text || "").trim().length >= 20; }) + " Tampil di beranda (slider), halaman model terkait, dan halaman /testimoni/. Halaman /testimoni/ baru dibuat bila ada minimal satu testimoni siap tayang." }));
    var set = h("div", { class: "card" }, [h("h3", { text: "Pengaturan & SEO halaman /testimoni/" })]);
    set.appendChild(Forms.render([
      { k: "h1", label: "Judul halaman (H1)", t: "text" }, { k: "title", label: "Title SEO (30–60 karakter)", t: "text" }, { k: "description", label: "Meta description (70–160 karakter)", t: "area", rows: 2 },
      { k: "intro", label: "Kalimat pengantar", t: "area", rows: 2 }, { k: "home_title", label: "Judul bagian di beranda", t: "text" },
      { k: "show_home", label: "Tampilkan di beranda", t: "bool" }, { k: "show_model", label: "Tampilkan di halaman model terkait", t: "bool" }, { k: "home_count", label: "Jumlah di beranda", t: "num" }
    ], T, function () { A.saveJSON("testi"); }));
    m.appendChild(set);
    var card = h("div", { class: "card" }, [h("h3", { text: "Daftar testimoni" })]);
    card.appendChild(Forms.render([{ k: "items", label: "", t: "objlist", titleKey: "name", fields: [
      { k: "name", label: "Nama customer (boleh inisial, mis. Bpk. Andi)", t: "text" }, { k: "city", label: "Kota/area", t: "text" },
      { k: "model", label: "Model yang dibeli", t: "select", opts: modelOpts() },
      { k: "rating", label: "Rating (1–5)", t: "select", opts: ["5", "4", "3", "2", "1"], def: "5" },
      { k: "text", label: "Isi testimoni (minimal 20 karakter, kata-kata customer)", t: "area", rows: 4 },
      { k: "date", label: "Tanggal (YYYY-MM-DD)", t: "text" }, { k: "source", label: "Sumber (mis. WhatsApp, Google Maps, Instagram)", t: "text" },
      { k: "photo", label: "Foto customer (opsional)", t: "image" },
      { k: "featured", label: "Utamakan di beranda", t: "bool" },
      { k: "consent", label: "Customer sudah memberi izin testimoni/nama/foto ini ditampilkan", t: "bool" }
    ] }], T, function () { A.saveJSON("testi"); }));
    m.appendChild(card);
  };
  A.routes["serah-terima"] = function () {
    var m = A.view(), H = A.S.hand; H.items = H.items || [];
    m.appendChild(h("h2", { text: "Serah Terima Unit" }));
    m.appendChild(h("p", { class: "muted", text: CONSENT_NOTE }));
    m.appendChild(h("p", { class: "muted", text: countNote(H.items, function (x) { return x.consent === true && x.customer && x.photo; }) + " Tampil di beranda (slider) dan halaman /serah-terima/ (dibuat bila ada minimal satu item siap tayang; foto masuk sitemap gambar)." }));
    var set = h("div", { class: "card" }, [h("h3", { text: "Pengaturan & SEO halaman /serah-terima/" })]);
    set.appendChild(Forms.render([
      { k: "h1", label: "Judul halaman (H1)", t: "text" }, { k: "title", label: "Title SEO (30–60 karakter)", t: "text" }, { k: "description", label: "Meta description (70–160 karakter)", t: "area", rows: 2 },
      { k: "intro", label: "Kalimat pengantar", t: "area", rows: 2 }, { k: "home_title", label: "Judul bagian di beranda", t: "text" },
      { k: "show_home", label: "Tampilkan di beranda", t: "bool" }, { k: "home_count", label: "Jumlah di beranda", t: "num" }
    ], H, function () { A.saveJSON("hand"); }));
    m.appendChild(set);
    var card = h("div", { class: "card" }, [h("h3", { text: "Daftar serah terima" })]);
    card.appendChild(Forms.render([{ k: "items", label: "", t: "objlist", titleKey: "customer", fields: [
      { k: "customer", label: "Nama customer (boleh inisial)", t: "text" }, { k: "city", label: "Kota/area", t: "text" },
      { k: "model", label: "Model yang diserahkan", t: "select", opts: modelOpts() }, { k: "date", label: "Tanggal serah terima (YYYY-MM-DD)", t: "text" },
      { k: "photo", label: "Foto utama (wajib)", t: "image" }, { k: "photo2", label: "Foto kedua (opsional)", t: "image" },
      { k: "caption", label: "Keterangan singkat (mis. Penyerahan kunci BYD Atto 3 oleh sales kepada Bpk. Andi)", t: "area", rows: 2 },
      { k: "consent", label: "Customer sudah memberi izin foto & nama ini ditampilkan", t: "bool" }
    ] }], H, function () { A.saveJSON("hand"); }));
    m.appendChild(card);
  };
})();

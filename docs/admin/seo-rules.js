/* Penilaian SEO artikel — ambang dari content/seo-rules.json (dipakai juga oleh seo_check.py untuk padanan) */
(function (root) {
  "use strict";
  var DEF = { min_words: 800, title_min: 30, title_max: 60, desc_min: 70, desc_max: 160, density_min: 0.4, density_max: 2.5, min_h2: 3, min_internal: 3, min_model_links: 2 };
  function words(t) { return (t.toLowerCase().match(/[\w'’-]+/g) || []); }
  function plain(md) {
    return md.replace(/\{\{[^}]*\}\}/g, " ").replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/^#{1,6}\s+/gm, "").replace(/[*`>|]/g, " ").replace(/^[-\d.]+\s+/gm, " ");
  }
  function check(it, rules, ctx) {
    var R = Object.assign({}, DEF, rules || {});
    ctx = ctx || {};
    var res = [];
    function add(id, level, ok, msg, tip) { res.push({ id: id, level: ok ? "ok" : level, ok: !!ok, msg: msg, tip: tip || "" }); }
    var kw = (it.keyword || "").trim().toLowerCase();
    var title = (it.title || "").trim(), desc = (it.description || "").trim(), h1 = (it.h1 || title).trim();
    var body = it.body || "";
    var W = words(plain(body.split("\n## FAQ")[0]));
    var first = W.slice(0, 100).join(" ");
    add("kw", "fail", !!kw, "Keyword utama terisi", "Isi kata kunci utama yang ditargetkan.");
    add("title_len", "warn", title.length >= R.title_min && title.length <= R.title_max, "Panjang title " + title.length + " (ideal " + R.title_min + "–" + R.title_max + ")", "Title terlalu panjang akan terpotong di hasil Google.");
    add("desc_len", "warn", desc.length >= R.desc_min && desc.length <= R.desc_max, "Panjang meta description " + desc.length + " (ideal " + R.desc_min + "–" + R.desc_max + ")");
    if (kw) {
      add("kw_title", "fail", title.toLowerCase().indexOf(kw) >= 0, "Keyword ada di title", "Taruh keyword di awal title.");
      add("kw_h1", "fail", h1.toLowerCase().indexOf(kw) >= 0, "Keyword ada di H1");
      add("kw_desc", "warn", desc.toLowerCase().indexOf(kw) >= 0, "Keyword ada di meta description");
      add("kw_slug", "warn", (it.slug || "").indexOf(kw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")) >= 0 || (ctx.slugOptional === true), "Keyword ada di slug", "Slug sebaiknya memuat keyword.");
      add("kw_first", "fail", first.indexOf(kw) >= 0, "Keyword ada di 100 kata pertama");
      var n = 0, hay = W.join(" "), p = -1;
      while ((p = hay.indexOf(kw, p + 1)) >= 0) n++;
      var dens = W.length ? n * kw.split(/\s+/).length / W.length * 100 : 0;
      add("density", "warn", dens >= R.density_min && dens <= R.density_max, "Kepadatan keyword " + dens.toFixed(2) + "% (" + n + "x; ideal " + R.density_min + "–" + R.density_max + "%)", "Jangan memaksakan keyword; pakai variasi dan sinonim.");
    }
    var kind = it.kind || "article";
    var minW = kind === "article" ? R.min_words : 500;
    add("words", "warn", W.length >= minW, "Jumlah kata " + W.length + " (min " + minW + ")");
    var h2 = (body.split("\n## FAQ")[0].match(/^## /gm) || []).length;
    add("h2", "warn", h2 >= R.min_h2, "Subjudul H2: " + h2 + " (min " + R.min_h2 + ")");
    var links = body.match(/\]\((\/[^)\s]*)\)/g) || [];
    var uniq = {}; links.forEach(function (l) { uniq[l] = 1; });
    add("internal", "warn", Object.keys(uniq).length >= R.min_internal - 1, "Link internal unik: " + Object.keys(uniq).length + " (min " + (R.min_internal - 1) + " di isi; sisanya otomatis)");
    var mlinks = links.filter(function (l) { return /^\]\(\/(byd-|harga-)/.test(l); }).length;
    add("model_links", "warn", mlinks >= R.min_model_links || (it.models || []).length > 0, "Menaut ke halaman model/harga", "Tambahkan link ke model BYD terkait atau isi kolom 'Model terkait'.");
    add("faq", "warn", /\n## FAQ/.test(body) && (body.split(/\n### /).length > 2), "Ada bagian FAQ (≥2 pertanyaan) untuk rich result");
    var aw = words(plain(it.answer || "")).length;
    add("answer", "warn", aw >= 20 && aw <= 70, "AEO: jawaban singkat " + aw + " kata (ideal 20–70)", "Tulis 1–3 kalimat yang langsung menjawab pertanyaan utama; AI dan Google mengutip bagian ini.");
    var qh = (body.match(/^#{2,3}\s+.*$/gm) || []).filter(function (l) { return /^#{2,3}\s+(apa|apakah|berapa|bagaimana|kenapa|mengapa|siapa|kapan|mana|dimana|di mana)\b|\?\s*$/i.test(l); }).length;
    add("qheads", "warn", qh >= 2, "AEO: subjudul berbentuk pertanyaan " + qh + " (min 2)", "Contoh: 'Berapa harga BYD Atto 3?' — cocok dengan cara orang bertanya ke AI.");
    add("struct", "warn", /^\s*([-*]|\d+\.)\s+/m.test(body) || /\|\s*---/.test(body) || /\{\{compare/.test(body), "AEO: ada daftar atau tabel", "Daftar dan tabel mudah dikutip sebagai jawaban.");
    if (kind === "article") {
      add("cover", "warn", !!(it.cover), "Gambar cover terpasang", "Gambar memperbaiki CTR dan OG share.");
      add("cover_alt", "warn", !it.cover || !!(it.cover_alt), "Alt teks cover terisi");
      add("tier", "warn", !!it.tier, "Tier keyword dipilih (hard/medium/easy)");
      var imgs = body.match(/!\[([^\]]*)\]\(/g) || [];
      add("img_alt", "warn", imgs.every(function (x) { return x.length > 4; }), "Semua gambar di isi punya alt");
    }
    var weight = { fail: 3, warn: 1 }, tot = 0, got = 0;
    res.forEach(function (r) { var w = weight[r.level === "ok" ? (r.id.match(/^(kw|kw_title|kw_h1|kw_first)$/) ? "fail" : "warn") : r.level]; tot += w; if (r.ok) got += w; });
    return { checks: res, score: Math.round(got / Math.max(1, tot) * 100), words: W.length, fails: res.filter(function (r) { return r.level === "fail"; }).length };
  }
  var api = { check: check, words: words, plain: plain, DEFAULTS: DEF };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SEO = api;
})(typeof window !== "undefined" ? window : globalThis);

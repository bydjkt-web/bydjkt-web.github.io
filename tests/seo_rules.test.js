const SEO = require("../src/admin/seo-rules.js");
const assert = require("assert");
const good = { kind: "article", title: "Mobil Listrik 300 Jutaan: Bandingkan Pilihan 2026", h1: "Mobil Listrik 300 Jutaan Terbaik", slug: "mobil-listrik-300-jutaan", keyword: "mobil listrik 300 jutaan",
  description: "Mobil listrik 300 jutaan 2026: bandingkan harga, baterai, dan jarak tempuh model-model terbaru sebelum membeli di dealer.", cover: "a.webp", cover_alt: "x", tier: "hard", models: ["byd-m6-dm"],
  body: "Mobil listrik 300 jutaan banyak dicari. " + "kata ".repeat(850) + "\n## A\n\n## B\n\n## C\n\n[a](/byd-m6/) [b](/harga-byd/) [c](/blog/x/)\n\n## FAQ\n\n### Q1?\n\nA\n\n### Q2?\n\nB\n" };
const r = SEO.check(good, {});
assert.strictEqual(r.fails, 0, JSON.stringify(r.checks.filter(c => !c.ok)));
assert.ok(r.score >= 85, "score " + r.score);
const bad = Object.assign({}, good, { keyword: "xyz abc", title: "Pendek" });
const rb = SEO.check(bad, {});
assert.ok(rb.fails >= 3 && rb.score < r.score);
assert.ok(SEO.check(Object.assign({}, good, { body: "pendek" }), {}).checks.find(c => c.id === "words").ok === false);
console.log("seo-rules OK, skor baik =", r.score, "buruk =", rb.score);

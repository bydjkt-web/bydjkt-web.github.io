/* Renderer markdown mini — cermin dari tools/lib/md.py (uji paritas: tests/md_parity.js) */
(function (root) {
  "use strict";
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
  }
  function slugify(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function stripMd(s) {
    s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
    s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    s = s.replace(/[*`]/g, "");
    return s.replace(/\s+/g, " ").trim();
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(?<![\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?![\w*])/g, "<em>$1</em>");
    return s.replace(/\[([^\]]+)\]\((\/[^)\s]*|https?:\/\/[^)\s]+)\)/g, function (_, t, u) {
      return '<a href="' + u + '"' + (u.indexOf("http") === 0 ? ' rel="noopener"' : "") + ">" + t + "</a>";
    });
  }
  function cells(l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function (c) { return c.trim(); }); }
  var IMG = /^!\[(.*?)\]\((\S+?)(?:\s+"(.*?)")?\)$/;
  var SHORT = /^\{\{\s*(\w+)\s*(.*?)\s*\}\}$/;
  var SEP = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

  function render(text, opt) {
    opt = opt || {};
    var idx = text.indexOf("\n## FAQ");
    var main = idx < 0 ? text : text.slice(0, idx);
    var faqRaw = idx < 0 ? "" : text.slice(idx + 7);
    var heads = [], out = [], para = [], lst = null, quote = [], used = {};
    var lines = main.split("\n");
    function flush() {
      if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
      if (lst) { out.push("<" + lst[0] + ">" + lst[1].map(function (i) { return "<li>" + inline(i) + "</li>"; }).join("") + "</" + lst[0] + ">"); lst = null; }
      if (quote.length) { out.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>"); quote = []; }
    }
    var i = 0, m;
    while (i < lines.length) {
      var s = lines[i].replace(/\s+$/, ""); i++;
      if (!s.trim()) { flush(); continue; }
      if ((m = /^(#{2,3})\s+(.*)/.exec(s))) {
        flush();
        var lvl = m[1].length, t = m[2].trim(), hid = slugify(t) || "bagian";
        used[hid] = (used[hid] || 0) + 1;
        if (used[hid] > 1) hid += "-" + used[hid];
        if (lvl === 2) heads.push([stripMd(t), hid]);
        out.push("<h" + lvl + ' id="' + hid + '">' + inline(t) + "</h" + lvl + ">");
        continue;
      }
      if ((m = SHORT.exec(s))) { flush(); out.push(opt.shortcode ? opt.shortcode(m[1], m[2]) : ""); continue; }
      if ((m = IMG.exec(s))) {
        flush();
        var tag = opt.img ? opt.img(m[2], m[1]) : '<img src="' + esc(m[2]) + '" alt="' + esc(m[1]) + '">';
        out.push('<figure class="fig">' + tag + (m[3] ? "<figcaption>" + esc(m[3]) + "</figcaption>" : "") + "</figure>");
        continue;
      }
      if (s.charAt(0) === "|" && i < lines.length && SEP.test(lines[i].trim())) {
        flush();
        var head = cells(s); i++;
        var rows = [];
        while (i < lines.length && lines[i].trim().charAt(0) === "|") { rows.push(cells(lines[i])); i++; }
        out.push('<div class="tw"><table><thead><tr>' + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("") +
          "</tr></thead><tbody>" + rows.map(function (r) { return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>");
        continue;
      }
      if ((m = /^>\s?(.*)/.exec(s))) { if (para.length || lst) flush(); quote.push(m[1]); continue; }
      if ((m = /^[-*]\s+(.*)/.exec(s))) {
        if (para.length || quote.length) flush();
        if (!lst || lst[0] !== "ul") { flush(); lst = ["ul", []]; }
        lst[1].push(m[1]); continue;
      }
      if ((m = /^\d+\.\s+(.*)/.exec(s))) {
        if (para.length || quote.length) flush();
        if (!lst || lst[0] !== "ol") { flush(); lst = ["ol", []]; }
        lst[1].push(m[1]); continue;
      }
      if (lst || quote.length) flush();
      para.push(s.trim());
    }
    flush();
    var faqs = [];
    if (faqRaw.trim()) {
      heads.push(["FAQ", "faq"]);
      ("\n" + faqRaw.trim()).split(/\n### /).forEach(function (blk) {
        blk = blk.trim();
        if (!blk) return;
        var nl = blk.indexOf("\n");
        var q = nl < 0 ? blk : blk.slice(0, nl), a = nl < 0 ? "" : blk.slice(nl + 1);
        faqs.push([q.trim(), a.split(/\s+/).filter(Boolean).join(" ")]);
      });
    }
    return { html: out.join("\n"), heads: heads, faqs: faqs };
  }
  var api = { render: render, inline: inline, esc: esc, slugify: slugify, stripMd: stripMd };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.MD = api;
})(typeof window !== "undefined" ? window : globalThis);

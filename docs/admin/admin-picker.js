/* Popup pilih gambar dari Media: grid thumbnail + pencarian + unggah baru. Dipakai field t:"image", cover artikel, sisip gambar. */
(function () {
  "use strict";
  var A = window.A, h = A.h, GH = window.GH;
  var cache = {};

  A.imgList = function () {
    var seen = {}, out = [];
    GH.paths("content/img/").filter(function (p) { return /\.(webp|jpe?g|png)$/i.test(p); }).forEach(function (p) {
      var file = p.split("/").pop(), src = "/img/" + A.slug(file.replace(/\.[^.]+$/, "")) + ".webp";
      if (seen[src]) return; seen[src] = 1;
      var meta = (A.S.media.items || []).filter(function (x) { return x.src === src; })[0] || {};
      out.push({ src: src, path: p, file: file, alt: meta.alt || "", kb: meta.kb, w: meta.w, h: meta.h });
    });
    return out;
  };
  /* thumbnail kecil (maks 360 px) agar popup tetap ringan walau banyak foto */
  A.thumbURL = function (path) {
    var key = path + "|" + (GH.pending[path] ? "p" : "r");
    if (cache[key]) return cache[key];
    cache[key] = GH.readBytes(path).then(function (b) {
      var blob = new Blob([b], { type: /\.png$/i.test(path) ? "image/png" : /\.jpe?g$/i.test(path) ? "image/jpeg" : "image/webp" });
      if (!window.createImageBitmap) return URL.createObjectURL(blob);
      return createImageBitmap(blob).then(function (bmp) {
        var sc = Math.min(1, 360 / bmp.width), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
        c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
        return new Promise(function (res) { c.toBlob(function (t) { res(URL.createObjectURL(t || blob)); }, "image/webp", 0.7); });
      }).catch(function () { return URL.createObjectURL(blob); });
    });
    return cache[key];
  };
  A.thumbInto = function (img, src) {
    var it = A.imgList().filter(function (x) { return x.src === src; })[0];
    if (!it) return false;
    A.thumbURL(it.path).then(function (u) { img.src = u; }).catch(function () {});
    return true;
  };

  /* A.pickImage(current, cb, {empty:true}) -> cb(src) ; cb("") bila "tanpa gambar" */
  A.pickImage = function (current, cb, opt) {
    opt = opt || {};
    var prevFocus = document.activeElement;
    var ov = h("div", { class: "pk-ov", role: "dialog", "aria-modal": "true", "aria-label": "Pilih gambar dari Media" });
    var box = h("div", { class: "pk" });
    var search = h("input", { type: "search", placeholder: "Cari nama file atau alt teks…", "aria-label": "Cari gambar" });
    var file = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true });
    var grid = h("div", { class: "pk-grid" });
    var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); A.thumbURL(e.target.getAttribute("data-path")).then(function (u) { e.target.src = u; }).catch(function () {}); } });
    }, { root: grid, rootMargin: "200px" }) : null;
    function close() { document.removeEventListener("keydown", onKey, true); ov.remove(); document.body.classList.remove("pk-lock"); if (prevFocus && prevFocus.focus) prevFocus.focus(); }
    function onKey(e) {
      if (e.key === "Escape") { e.stopPropagation(); close(); return; }
      if (e.key === "Tab") { var f = box.querySelectorAll("button,input:not([hidden]),[tabindex='0']"); if (!f.length) return; var a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    }
    function draw() {
      var q = search.value.trim().toLowerCase(); grid.innerHTML = "";
      var list = A.imgList().filter(function (x) { return !q || (x.file + " " + x.alt).toLowerCase().indexOf(q) > -1; });
      if (!list.length) grid.appendChild(h("p", { class: "muted", text: q ? "Tidak ada gambar yang cocok." : "Belum ada gambar di Media. Klik 'Unggah gambar baru'." }));
      list.forEach(function (x) {
        var img = h("img", { alt: x.alt || x.file, "data-path": x.path });
        var btn = h("button", { type: "button", class: "pk-it" + (x.src === current ? " sel" : ""), "aria-label": "Pilih " + x.file, onclick: function () { close(); cb(x.src); } }, [
          h("span", { class: "pk-ph" }, [img]), h("span", { class: "pk-nm", text: x.file }),
          h("span", { class: "pk-mt", text: (x.alt ? x.alt + " · " : "") + (x.w ? x.w + "×" + x.h + " · " : "") + (x.kb ? x.kb + " KB" : "") })]);
        grid.appendChild(btn);
        if (io) io.observe(img); else A.thumbURL(x.path).then(function (u) { img.src = u; });
      });
    }
    function upload(files) {
      var list = Array.prototype.slice.call(files).filter(function (f) { return /^image\//.test(f.type); });
      if (!list.length) return;
      var last;
      list.reduce(function (p, f) { return p.then(function () { return A.addImage(f, "").then(function (x) { last = x; }); }); }, Promise.resolve())
        .then(function () { A.toast(list.length + " gambar ditambahkan ke Media"); if (list.length === 1 && last) { close(); cb(last.src); } else draw(); }).catch(A.fail);
    }
    file.addEventListener("change", function () { upload(file.files); });
    search.addEventListener("input", draw);
    var head = h("div", { class: "pk-h" }, [h("strong", { text: "Pilih gambar" }), search,
      h("button", { type: "button", class: "btn sm", text: "Unggah gambar baru", onclick: function () { file.click(); } }), file,
      opt.empty ? h("button", { type: "button", class: "btn o sm", text: "Tanpa gambar", onclick: function () { close(); cb(""); } }) : null,
      h("button", { type: "button", class: "btn o sm", "aria-label": "Tutup", text: "✕", onclick: close })]);
    box.appendChild(head); box.appendChild(grid); ov.appendChild(box);
    ov.addEventListener("mousedown", function (e) { if (e.target === ov) close(); });
    document.addEventListener("keydown", onKey, true);
    document.body.classList.add("pk-lock"); document.body.appendChild(ov);
    draw(); search.focus();
  };
})();

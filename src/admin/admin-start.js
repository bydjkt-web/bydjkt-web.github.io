/* Login & boot */
(function (root) {
  "use strict";
  var A = root.A, h = A.h;
  function guessRepo() {
    var host = location.hostname, m = /^([^.]+)\.github\.io$/.exec(host);
    var path = location.pathname.split("/").filter(Boolean);
    if (m) return { owner: m[1], repo: path[0] && path[0] !== "admin" ? path[0] : m[1] + ".github.io" };
    return { owner: "", repo: "" };
  }
  function loginScreen(msg) {
    var app = document.getElementById("app"); app.innerHTML = "";
    var g = guessRepo();
    var o = h("input", { type: "text", id: "lg_owner", value: g.owner, autocomplete: "off" }), r = h("input", { type: "text", id: "lg_repo", value: g.repo, autocomplete: "off" }),
      b = h("input", { type: "text", id: "lg_branch", placeholder: "kosong = branch utama" }), t = h("input", { type: "password", id: "lg_token", autocomplete: "off" });
    var err = h("p", { class: "pill bad", id: "lg_err", hidden: !msg, text: msg || "" });
    app.appendChild(h("div", { class: "login" }, [h("div", { class: "card" }, [
      h("h2", { text: "Admin BYD Harmony" }),
      h("p", { class: "muted", text: "Panel ini mengedit konten langsung di repo GitHub Anda. Tidak ada server; token disimpan hanya di browser ini." }),
      err,
      h("label", { class: "f" }, ["Pemilik repo (username/organisasi GitHub)", o]), h("label", { class: "f" }, ["Nama repo", r]), h("label", { class: "f" }, ["Branch", b]),
      h("label", { class: "f" }, ["Fine-grained personal access token", h("small", { text: "Buat di GitHub → Settings → Developer settings → Fine-grained tokens. Pilih HANYA repo ini. Izin: Contents = Read and write; Metadata = Read; (opsional) Actions = Read and write untuk status build & tombol 'Bangun ulang'." }), t]),
      h("button", { class: "btn", id: "lg_go", text: "Masuk", onclick: function (e) {
        var btn = e.target; btn.disabled = true; btn.textContent = "Memeriksa…";
        GH.save({ owner: o.value.trim(), repo: r.value.trim(), branch: b.value.trim(), token: t.value.trim() });
        boot().catch(function (er) { GH.logout(); loginScreen(er.message); });
      } })
    ])]));
  }
  function boot() {
    return GH.check().then(function () { GH.save(GH.cfg); return GH.loadTree(); }).then(function () {
      if (!GH.tree["content/site.json"]) throw new Error("Repo ini belum berisi folder content/. Upload isi paket ZIP situs ke repo terlebih dulu.");
      return A.loadAll();
    }).then(function () {
      A.shell();
      if (GH.truncated) A.toast("Repo sangat besar; daftar berkas terpotong.", true);
      A.go();
    });
  }
  var cfg = GH.load();
  if (cfg && cfg.token) boot().catch(function (e) { loginScreen(e.message); }); else loginScreen();
})(window);

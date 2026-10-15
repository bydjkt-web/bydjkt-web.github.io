/* Lapisan GitHub (Git Data API) + penyimpanan perubahan tertunda. Tanpa server: token milik Anda, disimpan di browser ini saja. */
(function (root) {
  "use strict";
  var API = (root.__GH_API__ || "https://api.github.com");
  var LS = "byd_admin_cfg_v1";
  var enc = new TextEncoder(), dec = new TextDecoder();

  function b64(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(str) {
    var bin = atob(str.replace(/\s/g, "")), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function sha1Hex(buf) {
    return crypto.subtle.digest("SHA-1", buf).then(function (d) {
      return Array.prototype.map.call(new Uint8Array(d), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
    });
  }
  function gitBlobSha(bytes) {
    var head = enc.encode("blob " + bytes.length + "\0"), all = new Uint8Array(head.length + bytes.length);
    all.set(head, 0); all.set(bytes, head.length);
    return sha1Hex(all);
  }

  var GH = {
    cfg: null, tree: null, cache: {}, pending: {}, listeners: [],
    load: function () { try { GH.cfg = JSON.parse(localStorage.getItem(LS) || "null"); } catch (e) { GH.cfg = null; } return GH.cfg; },
    save: function (c) { GH.cfg = c; try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {} },
    logout: function () { try { localStorage.removeItem(LS); } catch (e) {} GH.cfg = null; GH.tree = null; GH.cache = {}; GH.pending = {}; },
    onChange: function (fn) { GH.listeners.push(fn); },
    _emit: function () { GH.listeners.forEach(function (f) { try { f(); } catch (e) {} }); },

    req: function (path, opt) {
      opt = opt || {};
      var h = { "Authorization": "Bearer " + GH.cfg.token, "Accept": opt.accept || "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      if (opt.body) h["Content-Type"] = "application/json";
      return fetch(API + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" }).then(function (r) {
        if (r.status === 204) return null;
        if (!r.ok) return r.text().then(function (t) {
          var msg = t; try { msg = JSON.parse(t).message || t; } catch (e) {}
          var err = new Error("GitHub " + r.status + ": " + msg); err.status = r.status; throw err;
        });
        return opt.raw ? r.arrayBuffer() : r.json();
      });
    },
    repo: function () { return "/repos/" + GH.cfg.owner + "/" + GH.cfg.repo; },
    check: function () {
      return GH.req(GH.repo()).then(function (r) {
        if (!r.permissions || !r.permissions.push) throw new Error("Token tidak punya izin menulis ke repo ini (butuh Contents: Read and write).");
        if (!GH.cfg.branch) GH.cfg.branch = r.default_branch;
        return r;
      });
    },
    loadTree: function () {
      return GH.req(GH.repo() + "/git/trees/" + encodeURIComponent(GH.cfg.branch) + "?recursive=1").then(function (t) {
        GH.tree = {};
        (t.tree || []).forEach(function (e) { if (e.type === "blob") GH.tree[e.path] = e.sha; });
        GH.truncated = !!t.truncated;
        return GH.tree;
      });
    },
    blob: function (sha) {
      if (GH.cache[sha]) return Promise.resolve(GH.cache[sha]);
      return GH.req(GH.repo() + "/git/blobs/" + sha, { accept: "application/vnd.github.raw+json", raw: true }).then(function (buf) {
        var u = new Uint8Array(buf); GH.cache[sha] = u; return u;
      });
    },
    /* --- berkas virtual: tree + perubahan tertunda --- */
    paths: function (prefix, suffix) {
      var set = {};
      Object.keys(GH.tree || {}).forEach(function (p) { set[p] = 1; });
      Object.keys(GH.pending).forEach(function (p) { if (GH.pending[p].del) delete set[p]; else set[p] = 1; });
      return Object.keys(set).filter(function (p) { return (!prefix || p.indexOf(prefix) === 0) && (!suffix || p.slice(-suffix.length) === suffix); }).sort();
    },
    exists: function (p) { var q = GH.pending[p]; return q ? !q.del : !!(GH.tree && GH.tree[p]); },
    readBytes: function (p) {
      var q = GH.pending[p];
      if (q) { if (q.del) return Promise.reject(new Error("dihapus: " + p)); return Promise.resolve(q.bytes); }
      if (!GH.tree || !GH.tree[p]) return Promise.reject(new Error("tidak ada: " + p));
      return GH.blob(GH.tree[p]);
    },
    read: function (p) { return GH.readBytes(p).then(function (b) { return dec.decode(b); }); },
    readJSON: function (p, def) { return GH.exists(p) ? GH.read(p).then(JSON.parse) : Promise.resolve(def); },
    stage: function (p, data) {
      var bytes = typeof data === "string" ? enc.encode(data) : data;
      GH.pending[p] = { bytes: bytes };
      GH._emit();
    },
    stageJSON: function (p, obj) { GH.stage(p, JSON.stringify(obj, null, 2) + "\n"); },
    stageDelete: function (p) {
      if (GH.tree && GH.tree[p]) GH.pending[p] = { del: true }; else delete GH.pending[p];
      GH._emit();
    },
    discard: function () { GH.pending = {}; GH._emit(); },
    count: function () { return Object.keys(GH.pending).length; },
    /* simpan semua perubahan tertunda dalam SATU commit */
    commit: function (message) {
      var paths = Object.keys(GH.pending);
      if (!paths.length) return Promise.resolve(null);
      var base, baseTree;
      return GH.req(GH.repo() + "/git/ref/heads/" + encodeURIComponent(GH.cfg.branch)).then(function (ref) {
        base = ref.object.sha;
        return GH.req(GH.repo() + "/git/commits/" + base);
      }).then(function (c) {
        baseTree = c.tree.sha;
        return Promise.all(paths.map(function (p) {
          var q = GH.pending[p];
          if (q.del) return { path: p, mode: "100644", type: "blob", sha: null };
          return GH.req(GH.repo() + "/git/blobs", { method: "POST", body: { content: b64(q.bytes), encoding: "base64" } }).then(function (b) {
            return { path: p, mode: "100644", type: "blob", sha: b.sha };
          });
        }));
      }).then(function (entries) {
        return GH.req(GH.repo() + "/git/trees", { method: "POST", body: { base_tree: baseTree, tree: entries } }).then(function (t) {
          return GH.req(GH.repo() + "/git/commits", { method: "POST", body: { message: message || "Update dari Admin", tree: t.sha, parents: [base] } });
        }).then(function (c) {
          return GH.req(GH.repo() + "/git/refs/heads/" + encodeURIComponent(GH.cfg.branch), { method: "PATCH", body: { sha: c.sha } }).then(function () { return c; });
        });
      }).then(function (c) {
        paths.forEach(function (p) { delete GH.pending[p]; });
        return GH.loadTree().then(function () { GH._emit(); return c; });
      });
    },
    gitBlobSha: gitBlobSha, b64: b64, unb64: unb64
  };
  root.GH = GH;
})(window);

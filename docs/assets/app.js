/* BYD Harmony — lead capture, lead scoring, WhatsApp handoff. Vanilla JS, defer. */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};

  /* ---- UTM / sumber trafik disimpan selama sesi ---- */
  var src = {};
  try {
    var p = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach(function (k) {
      if (p.get(k)) src[k] = p.get(k).slice(0, 120);
    });
    if (Object.keys(src).length) sessionStorage.setItem("bh_src", JSON.stringify(src));
    else src = JSON.parse(sessionStorage.getItem("bh_src") || "{}");
  } catch (e) {}

  function track(name, params) {
    try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {}
  }

  /* ---- Klik WhatsApp ---- */
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a[data-wa]");
    if (a) track("click_whatsapp", { location: a.getAttribute("data-wa") });
  });

  /* ---- Lead scoring: 0-100 -> hot / warm / cold ---- */
  function score(d) {
    var s = 0;
    var t = { minggu: 40, bulan: 30, tiga_bulan: 15, info: 0 };
    s += t[d.timeline] || 0;
    s += d.payment === "cash" ? 20 : d.payment === "kredit" ? 15 : 0;
    if (d.testDrive) s += 20;
    if (d.model) s += 10;
    if (d.tradeIn) s += 5;
    s += 5; // nomor WhatsApp valid sudah terisi
    var tier = s >= 70 ? "hot" : s >= 40 ? "warm" : "cold";
    return { score: s, tier: tier };
  }

  function normPhone(v) {
    var n = String(v || "").replace(/[^\d+]/g, "");
    if (n.indexOf("+62") === 0) n = "62" + n.slice(3);
    else if (n.charAt(0) === "0") n = "62" + n.slice(1);
    return /^628\d{8,12}$/.test(n) ? n : "";
  }

  var LABEL = {
    minggu: "dalam 1 minggu", bulan: "dalam 1 bulan",
    tiga_bulan: "dalam 1–3 bulan", info: "baru cari informasi",
    cash: "Cash", kredit: "Kredit", belum: "Belum menentukan"
  };

  function waLink(d, sc) {
    var lines = [
      "Halo " + (C.name || "BYD Harmony") + ", saya " + d.name + ".",
      "Saya tertarik dengan " + (d.model || "mobil listrik BYD") + ".",
      "Rencana beli: " + (LABEL[d.timeline] || "-") + ". Pembayaran: " + (LABEL[d.payment] || "-") + "."
    ];
    if (d.testDrive) lines.push("Saya ingin booking test drive.");
    if (d.tradeIn) lines.push("Saya ingin tukar tambah.");
    lines.push("Mohon info harga OTR & promo terbaru. Terima kasih.");
    return "https://wa.me/" + C.wa + "?text=" + encodeURIComponent(lines.join("\n"));
  }

  /* ---- Simpan ke Firestore (SDK dimuat hanya saat form dikirim) ---- */
  function saveLead(doc) {
    var fb = C.firebase;
    if (!fb || !fb.projectId || !fb.apiKey) return Promise.resolve(false);
    var V = "10.14.1", B = "https://www.gstatic.com/firebasejs/" + V + "/";
    return Promise.all([import(B + "firebase-app.js"), import(B + "firebase-firestore.js")])
      .then(function (m) {
        var app = m[0].getApps().length ? m[0].getApp() : m[0].initializeApp(fb);
        var db = m[1].getFirestore(app);
        doc.createdAt = m[1].serverTimestamp();
        return m[1].addDoc(m[1].collection(db, "leads"), doc);
      })
      .then(function () { return true; });
  }

  function withTimeout(p, ms) {
    return Promise.race([p, new Promise(function (r) { setTimeout(function () { r(false); }, ms); })]);
  }


  function firstPage() {
    try {
      var k = "byd_first_page", v = sessionStorage.getItem(k);
      if (!v) { v = location.pathname.slice(0, 200); sessionStorage.setItem(k, v); }
      return v;
    } catch (e) { return location.pathname.slice(0, 200); }
  }

  // Prefill model dari ?model= (tombol "Minta penawaran" di artikel/model)
  (function () {
    try {
      var m = new URLSearchParams(location.search).get("model");
      if (!m) return;
      document.querySelectorAll("form.lead select[name=model]").forEach(function (sel) {
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === m || sel.options[i].text === m) { sel.selectedIndex = i; break; }
        }
      });
    } catch (e) {}
  })();

  // Lightbox sederhana untuk galeri model
  (function () {
    var links = document.querySelectorAll("[data-gal]");
    if (!links.length) return;
    var box = document.createElement("div");
    box.className = "lb"; box.hidden = true; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button type="button" aria-label="Tutup">×</button><img alt="">';
    document.body.appendChild(box);
    var img = box.querySelector("img");
    function close() { box.hidden = true; }
    box.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var t = a.querySelector("img");
        img.src = a.getAttribute("href"); img.alt = t ? t.alt : "";
        box.hidden = false; box.querySelector("button").focus();
      });
    });
  })();


  // Pemilih anggaran di hero
  (function () {
    var r = document.getElementById("bud"); if (!r) return;
    var out = document.getElementById("budout"), cnt = document.getElementById("budcnt"), items = document.querySelectorAll("#bm li");
    function fmt(n) { return n >= 1000 ? "Rp1 miliar" : "Rp" + n + " juta"; }
    function upd() {
      var v = Number(r.value), n = 0;
      out.textContent = fmt(v);
      items.forEach(function (li) { var ok = Number(li.getAttribute("data-min")) <= v; li.classList.toggle("over", !ok); if (ok) n++; });
      cnt.textContent = n ? n + " model mulai di bawah anggaran ini." : "Belum ada model di bawah anggaran ini. Geser ke kanan atau tanya sales soal cicilan.";
    }
    r.addEventListener("input", upd); upd();
  })();

  // Animasi indikator baterai saat terlihat
  // Swiper dimuat malas: hanya saat slider hampir terlihat (0 KB di awal). Sebelum aktif, slider tampil sebagai scroll-snap.
  (function () {
    var els = document.querySelectorAll(".bhs"); if (!els.length) return;
    var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches, p = null;
    function load() {
      if (p) return p;
      p = new Promise(function (ok, bad) {
        var n = 0, done = function () { if (++n === 2) ok(); };
        var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/assets/vendor/swiper.min.css"; l.onload = done; l.onerror = bad; document.head.appendChild(l);
        var sc = document.createElement("script"); sc.src = "/assets/vendor/swiper.min.js"; sc.onload = done; sc.onerror = bad; document.head.appendChild(sc);
      });
      return p;
    }
    function init(el) {
      var sec = el.closest("section") || document, d = el.dataset, per = parseFloat(d.per) || 3, mob = parseFloat(d.mob) || 1.12, mid = parseFloat(d.mid) || Math.min(2, per), auto = parseInt(d.auto, 10) || 0;
      var cfg = {
        spaceBetween: 16, slidesPerView: mob, watchOverflow: true, grabCursor: true, a11y: { enabled: true, prevSlideMessage: "Slide sebelumnya", nextSlideMessage: "Slide berikutnya" },
        breakpoints: { 600: { slidesPerView: mid }, 1000: { slidesPerView: per } },
        navigation: { prevEl: sec.querySelector("[data-sw='-1']"), nextEl: sec.querySelector("[data-sw='1']") },
        pagination: { el: el.querySelector(".swiper-pagination"), clickable: true }
      };
      if (auto && !still) { cfg.rewind = true; cfg.autoplay = { delay: auto, pauseOnMouseEnter: true, disableOnInteraction: true }; }
      window.BHSwiper(el, cfg);
    }
    function go(el) { load().then(function () { init(el); }).catch(function () {}); }
    if (!("IntersectionObserver" in window)) { els.forEach(go); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); go(e.target); } }); }, { rootMargin: "400px 0px" });
    els.forEach(function (el) { io.observe(el); });
  })();

  // AOS dimuat malas setelah halaman selesai; animasi hanya aktif bila JS memasang html.aos-on (tanpa JS konten tetap tampil)
  (function () {
    if (!document.querySelector("[data-aos]") || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    function go() {
      var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "/assets/vendor/aos.min.css";
      l.onload = function () {
        var sc = document.createElement("script"); sc.src = "/assets/vendor/aos.min.js";
        sc.onload = function () { document.documentElement.classList.add("aos-on"); window.AOS.init({ duration: 600, easing: "ease-out-cubic", once: true, offset: 40 }); };
        document.head.appendChild(sc);
      };
      document.head.appendChild(l);
    }
    var run = function () { (window.requestIdleCallback || function (f) { setTimeout(f, 200); })(go); };
    if (document.readyState === "complete") run(); else window.addEventListener("load", run);
  })();

  // WhatsApp melayang: isi pesan sesuai halaman yang sedang dibuka
  (function () {
    var a = document.querySelector(".wafab"), h1 = document.querySelector("h1");
    if (!a || !h1 || location.pathname === "/") return;
    try {
      var u = new URL(a.href); u.searchParams.set("text", "Halo " + (C.name || "BYD Harmony") + ", saya ingin info: " + h1.textContent.trim().slice(0, 90));
      a.href = u.toString();
    } catch (e) {}
  })();
  (function () {
    var bars = document.querySelectorAll(".rg");
    if (!bars.length) return;
    if (!("IntersectionObserver" in window)) { bars.forEach(function (b) { b.classList.add("on"); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); } }); }, { threshold: 0.4 });
    bars.forEach(function (b) { io.observe(b); });
  })();

  document.querySelectorAll("form.lead").forEach(function (form) {
    var out = form.querySelector(".msg");
    var busy = false;

    function say(text, cls) {
      out.className = "msg " + cls;
      out.textContent = text;
      out.hidden = false;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var f = new FormData(form);
      if (f.get("website")) return; // honeypot

      var d = {
        name: String(f.get("name") || "").trim().slice(0, 80),
        phone: normPhone(f.get("phone")),
        model: String(f.get("model") || ""),
        timeline: String(f.get("timeline") || "info"),
        payment: String(f.get("payment") || "belum"),
        testDrive: !!f.get("testDrive"),
        tradeIn: !!f.get("tradeIn")
      };
      if (d.name.length < 2) return say("Mohon isi nama Anda.", "err");
      if (!d.phone) return say("Nomor WhatsApp tidak valid. Contoh: 0812xxxxxxxx", "err");

      var sc = score(d);
      var doc = {
        name: d.name, phone: d.phone, model: d.model, timeline: d.timeline,
        payment: d.payment, testDrive: d.testDrive, tradeIn: d.tradeIn,
        score: sc.score, tier: sc.tier,
        page: location.pathname, first_page: firstPage(), referrer: (document.referrer || "").slice(0, 200),
        utm_source: src.utm_source || "", utm_medium: src.utm_medium || "",
        utm_campaign: src.utm_campaign || "", utm_term: src.utm_term || ""
      };

      busy = true;
      var btn = form.querySelector("button[type=submit]");
      if (btn) { btn.disabled = true; btn.textContent = "Mengirim…"; }

      withTimeout(saveLead(doc).catch(function () { return false; }), 4500).then(function () {
        track("generate_lead", { tier: sc.tier, score: sc.score, model: d.model });
        var link = waLink(d, sc);
        say("Terima kasih " + d.name + "! Kami lanjutkan lewat WhatsApp. Jika tidak terbuka otomatis, ketuk tombol di bawah.", "ok");
        var a = document.createElement("a");
        a.className = "btn w"; a.href = link; a.textContent = "Lanjut ke WhatsApp";
        a.rel = "noopener"; a.setAttribute("data-wa", "form-success");
        out.appendChild(document.createElement("br"));
        out.appendChild(a);
        if (btn) { btn.textContent = "Terkirim"; }
        setTimeout(function () { location.href = link; }, 900);
      });
    });
  });
})();

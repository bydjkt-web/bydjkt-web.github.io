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
    if (d.testDrive) lines.push("Saya ingin booking test drive." + (d.tdDate ? " Tanggal: " + d.tdDate + "." : "") + (d.tdTime ? " Jam: " + d.tdTime + "." : ""));
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
      document.querySelectorAll("form.lead input[type=radio][name=model]").forEach(function (r) { if (r.value === m) r.checked = true; });
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
        tradeIn: !!f.get("tradeIn"),
        tdDate: String(f.get("tdDate") || "").slice(0, 10),
        tdTime: String(f.get("tdTime") || "").slice(0, 40)
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
        if (form.classList.contains("tdf")) {
          // kartu konfirmasi (seperti acuan): form disembunyikan, tombol lanjut ke WhatsApp dan kembali
          var card = document.createElement("div"); card.className = "tdok"; card.setAttribute("role", "status");
          card.innerHTML = '<span class="ico" aria-hidden="true">✓</span><h2>Pemesanan dikirim</h2><p></p><div class="ctas"><a class="btn" rel="noopener" data-wa="td-success">Lanjut ke WhatsApp</a><button type="button" class="btn o">Kembali</button></div>';
          card.querySelector("p").textContent = "Terima kasih " + d.name + ". Cek WhatsApp Anda: pesan booking test drive " + (d.model || "mobil BYD") + " sudah kami siapkan untuk tim " + (C.name || "kami") + ".";
          card.querySelector("a").href = link;
          card.querySelector("button").addEventListener("click", function () { card.remove(); form.hidden = false; busy = false; if (btn) { btn.disabled = false; btn.textContent = "Konfirmasi via WhatsApp"; } });
          form.hidden = true; form.parentNode.insertBefore(card, form.nextSibling);
          setTimeout(function () { location.href = link; }, 900);
          return;
        }
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

  /* simulasi angsuran (bunga flat, estimasi) */
  (function () {
    var box = document.querySelector(".calc[data-credit]"); if (!box) return;
    var data, rate = parseFloat(box.getAttribute("data-rate")) || 5;
    try { data = JSON.parse(box.getAttribute("data-credit")); } catch (e) { return; }
    var m = document.getElementById("cm"), v = document.getElementById("cv"), dp = document.getElementById("cdp"), dpo = document.getElementById("cdpo"), t = document.getElementById("ct"), r = document.getElementById("cr"), d = document.getElementById("cdet"), wa = document.getElementById("cwa");
    function rp(n) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
    function variants() { v.innerHTML = ""; data[+m.value].v.forEach(function (x, i) { var o = document.createElement("option"); o.value = i; o.textContent = x.n; v.appendChild(o); }); }
    function calc() {
      var mod = data[+m.value], va = mod.v[+v.value] || mod.v[0], pr = va.p, pct = +dp.value, yrs = +t.value;
      var down = pr * pct / 100, loan = pr - down, total = loan * (1 + rate / 100 * yrs), mo = total / (yrs * 12);
      dpo.textContent = pct + "%"; roll(r, mo, function (n) { return rp(n) + " / bulan"; });
      d.textContent = "Harga " + rp(pr) + ", uang muka " + rp(down) + ", tenor " + yrs + " tahun";
      var msg = "Halo, saya ingin simulasi kredit " + mod.n + " " + va.n + ", uang muka " + pct + "%, tenor " + yrs + " tahun.";
      wa.href = wa.href.split("?")[0] + "?text=" + encodeURIComponent(msg);
    }
    m.addEventListener("change", function () { variants(); calc(); });
    [v, dp, t].forEach(function (el) { el.addEventListener("input", calc); el.addEventListener("change", calc); });
    variants(); calc();
  })();
  // video YouTube dimuat saat diklik (tanpa cookie, tanpa memuat skrip pihak ketiga sebelum diputar)
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-yt]"); if (!b) return;
    var f = document.createElement("iframe");
    f.src = "https://www.youtube-nocookie.com/embed/" + b.getAttribute("data-yt") + "?autoplay=1&rel=0";
    f.title = b.getAttribute("aria-label") || "Video"; f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true; f.className = "vframe";
    b.replaceWith(f);
  });
  // ---- gaya Modern: efek ringan (semua dimatikan bila perangkat meminta gerakan dikurangi) ----
  if (document.documentElement.getAttribute("data-layout") === "modern") {
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hd = document.querySelector("header.top"), bar = document.createElement("div");
    bar.className = "sprog"; bar.setAttribute("aria-hidden", "true"); document.body.appendChild(bar);
    var tick = false, mhm = document.querySelector(".mhm > img, .mhm > video");
    function onScroll() {
      tick = false;
      var y = window.pageYOffset || 0, h = document.documentElement.scrollHeight - window.innerHeight;
      if (hd) hd.classList.toggle("sc", y > 12);
      bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
      if (mhm && !calm && window.innerWidth > 900 && y < 900) mhm.style.transform = "scale(1.1) translateY(" + Math.round(y * 0.05) + "px)";
    }
    window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
    // efek tirai: hero diam di tempat dan bagian berikutnya naik menutupinya
    var hero = document.querySelector(".hero.mh");
    function fit() {
      var on = !!hero && !calm;
      document.documentElement.classList.toggle("curtain", on);
      // hero lebih tinggi dari layar: bagian bawahnya yang ditahan, jadi seluruh isi hero tetap terbaca sebelum tertutup
      if (on) hero.style.top = Math.min(hd ? hd.offsetHeight : 0, window.innerHeight - hero.offsetHeight) + "px";
    }
    fit(); window.addEventListener("resize", fit);
    // menu HP: tutup bila klik di luar panel atau tekan Esc
    document.addEventListener("click", function (e) {
      var d = document.querySelector("details.m[open]");
      if (d && !d.contains(e.target)) d.removeAttribute("open");
    });
    document.addEventListener("keydown", function (e) {
      var d = document.querySelector("details.m[open]");
      if (e.key === "Escape" && d) { d.removeAttribute("open"); d.querySelector("summary").focus(); }
    });
    // angka besar menghitung naik saat terlihat; teks akhir sudah ada di HTML
    var cn = document.querySelectorAll("[data-count]");
    if (cn.length && "IntersectionObserver" in window && !calm) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return; io.unobserve(en.target);
          var el = en.target, tn = el.firstChild; if (!tn || tn.nodeType !== 3) return;
          var raw = tn.nodeValue, m = raw.match(/^(\D*)([\d.,]+)(\D*)$/); if (!m) return;
          var end = parseFloat(m[2].replace(/\./g, "").replace(",", ".")); if (!isFinite(end)) return;
          var t0 = null, dur = 1100;
          (function step(t) {
            if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
            tn.nodeValue = m[1] + v.toLocaleString("id-ID") + m[3];
            if (k < 1) requestAnimationFrame(step); else tn.nodeValue = raw;
          })(performance.now());
        });
      }, { threshold: 0.4 });
      cn.forEach(function (x) { io.observe(x); });
    }
    var fine = window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches;
    // kartu model miring 3D mengikuti kursor
    if (fine && !calm) document.querySelectorAll(".mc").forEach(function (c) {
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        c.style.transform = "perspective(900px) rotateY(" + (x * 10) + "deg) rotateX(" + (-y * 10) + "deg) translateY(-8px)";
      });
      c.addEventListener("pointerleave", function () { c.style.transform = ""; });
    });
    // tombol utama sedikit tertarik ke kursor
    if (fine && !calm) {
      var mg = [].slice.call(document.querySelectorAll(".hero.mh .cta .btn, .ctasec .btn, .ctas .btn:not(.o), .tdgo .btn"));
      if (mg.length) window.addEventListener("pointermove", function (e) {
        mg.forEach(function (b) {
          var r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
          if (Math.abs(dx) < r.width / 2 + 50 && Math.abs(dy) < r.height / 2 + 50) b.style.transform = "translate(" + (dx * 0.25) + "px," + (dy * 0.25) + "px)";
          else if (b.style.transform) b.style.transform = "";
        });
      }, { passive: true });
    }
    // cahaya mengikuti kursor di panel dan kotak fitur
    if (fine && !calm) document.querySelectorAll(".pnl, .feat > div, .hc, .infos li, .vcard, .dvc, .fc").forEach(function (c) {
      c.classList.add("spot");
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(); c.style.setProperty("--mx", (e.clientX - r.left) + "px"); c.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
    // kartu statistik bisa dibalik
    document.querySelectorAll(".flp").forEach(function (b) {
      b.addEventListener("click", function () { var on = b.classList.toggle("on"); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    });
    // pilih warna cat
    document.querySelectorAll("[data-colors]").forEach(function (w) {
      var bs = w.querySelectorAll(".csw"), ps = w.querySelectorAll("[data-cp]"), nm = w.querySelector("[data-cn]"), names = [];
      try { names = JSON.parse(w.querySelector("[data-names]").textContent); } catch (e) {}
      bs.forEach(function (b) { b.addEventListener("click", function () {
        var k = +b.getAttribute("data-c");
        bs.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        ps.forEach(function (p) { p.hidden = +p.getAttribute("data-cp") !== k; });
        if (nm && names[k]) nm.textContent = names[k];
      }); });
    });
    // FAQ membuka dan menutup dengan halus
    if (!calm) document.querySelectorAll("details.q").forEach(function (d) {
      var sm = d.querySelector("summary"), body = d.querySelector("summary + div"); if (!sm || !body) return;
      sm.addEventListener("click", function (e) {
        e.preventDefault();
        if (d.getAttribute("data-busy")) return; d.setAttribute("data-busy", "1");
        var open = d.hasAttribute("open");
        body.style.overflow = "hidden";
        if (!open) { d.setAttribute("open", ""); var h1 = body.scrollHeight; body.style.height = "0px"; body.offsetHeight; body.style.transition = "height .35s cubic-bezier(.2,.7,.2,1)"; body.style.height = h1 + "px"; }
        else { body.style.height = body.scrollHeight + "px"; body.offsetHeight; body.style.transition = "height .3s cubic-bezier(.2,.7,.2,1)"; body.style.height = "0px"; }
        setTimeout(function () {
          if (open) d.removeAttribute("open");
          body.style.height = body.style.transition = body.style.overflow = ""; d.removeAttribute("data-busy");
        }, 380);
      });
    });
    // judul bagian muncul huruf demi huruf saat masuk layar
    if (!calm && "IntersectionObserver" in window) {
      var heads = [].slice.call(document.querySelectorAll(".hm .s h2, .ctasec h2, .mtop ~ section h2")).filter(function (x) { return x.textContent.length < 80 && !x.getAttribute("data-rise"); });
      var rio = new IntersectionObserver(function (es) {
        es.forEach(function (en) { if (en.isIntersecting) { rio.unobserve(en.target); en.target.classList.add("go"); } });
      }, { threshold: 0.35 });
      heads.forEach(function (hd2) {
        var i = 0;
        (function split(n) {
          [].slice.call(n.childNodes).forEach(function (c) {
            if (c.nodeType === 3) {
              var f = document.createDocumentFragment();
              c.nodeValue.split(/(\s+)/).forEach(function (t) {
                if (!t) return;
                if (/^\s+$/.test(t)) { f.appendChild(document.createTextNode(" ")); return; }
                var w = document.createElement("span"); w.className = "wd";
                t.split("").forEach(function (ch) { var l = document.createElement("span"); l.className = "ch"; l.style.setProperty("--i", Math.min(i++, 28)); l.textContent = ch; w.appendChild(l); });
                f.appendChild(w);
              });
              n.replaceChild(f, c);
            } else if (c.nodeType === 1) split(c);
          });
        })(hd2);
        hd2.setAttribute("data-rise", "1"); rio.observe(hd2);
      });
    }
    // hero: tiga lapisan bergerak beda jarak mengikuti kursor atau jari
    var hm = document.querySelector(".hero.mh .mhin");
    if (hm && !calm) {
      var far = document.createElement("i"), far2 = document.createElement("i"); far.className = "dp dp1"; far2.className = "dp dp2";
      far.setAttribute("aria-hidden", "true"); far2.setAttribute("aria-hidden", "true"); hm.appendChild(far); hm.appendChild(far2);
      var mm = hm.querySelector(".mhm"), tt = hm.querySelector(".mht");
      hm.addEventListener("pointermove", function (e) {
        var r = hm.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        far.style.transform = "translate(" + (x * 26) + "px," + (y * 16) + "px)"; far2.style.transform = "translate(" + (x * -34) + "px," + (y * -20) + "px)";
        if (mm && window.innerWidth > 900) mm.style.transform = "translate(" + (x * -14) + "px," + (y * -8) + "px)";
        if (tt && window.innerWidth > 900) tt.style.transform = "translate(" + (x * 6) + "px," + (y * 4) + "px)";
      });
      hm.addEventListener("pointerleave", function () { [far, far2, mm, tt].forEach(function (el) { if (el) el.style.transform = ""; }); });
    }
  }
  // angka bergulir halus (dipakai kalkulator); hasil akhir selalu teks yang benar
  function roll(el, to, fmt) {
    var calm2 = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (calm2 || document.documentElement.getAttribute("data-layout") !== "modern") { el.textContent = fmt(to); return; }
    var from = el._v == null ? to : el._v; cancelAnimationFrame(el._r); el._v = to;
    var t0 = null;
    (function step(t) {
      if (t0 === null) t0 = t; var k = Math.min(1, (t - t0) / 450);
      el.textContent = fmt(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) el._r = requestAnimationFrame(step); else el.textContent = fmt(to);
    })(performance.now());
  }
  // ---- menu Model (dropdown desktop): klik/ketuk membuka, Esc dan klik di luar menutup ----
  document.querySelectorAll(".dd").forEach(function (dd) {
    var b = dd.querySelector(".ddb");
    function set(o) { dd.classList.toggle("open", o); b.setAttribute("aria-expanded", o ? "true" : "false"); }
    b.addEventListener("click", function (e) { e.stopPropagation(); set(!dd.classList.contains("open")); });
    document.addEventListener("click", function (e) { if (!dd.contains(e.target)) set(false); });
    dd.addEventListener("keydown", function (e) { if (e.key === "Escape") { set(false); b.focus(); } });
  });
  // tanggal test drive tidak boleh sebelum hari ini
  document.querySelectorAll("input[name=tdDate]").forEach(function (i) { var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); i.min = t.toISOString().slice(0, 10); });

  // ---- halaman simulasi kredit ----
  (function () {
    var box = document.querySelector(".cpage[data-credit]"); if (!box) return;
    var data; try { data = JSON.parse(box.getAttribute("data-credit")); } catch (e) { return; }
    var rate = parseFloat(box.getAttribute("data-rate")) || 5, adm = parseFloat(box.getAttribute("data-adm")) || 0, ins = parseFloat(box.getAttribute("data-ins")) || 0;
    var $ = function (id) { return document.getElementById(id); };
    var mi = 0, yrs = 5, tabs = box.querySelectorAll(".ctabs button"), segs = box.querySelectorAll("#pt button");
    function rp(n) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
    function fillV() {
      var sel = $("pv"); sel.innerHTML = "";
      data[mi].v.forEach(function (v, i) { var o = document.createElement("option"); o.value = i; o.textContent = v.n + " · " + rp(v.p); sel.appendChild(o); });
      var pv = $("cpv"); pv.innerHTML = "";
      if (data[mi].img) { var im = document.createElement("img"); im.src = data[mi].img; im.alt = ""; im.loading = "lazy"; pv.appendChild(im); pv.hidden = false; } else pv.hidden = true;
      calc();
    }
    function calc() {
      var m = data[mi], v = m.v[+$("pv").value || 0], p = v.p, dpP = +$("pdp").value, dp = p * dpP / 100, loan = p - dp;
      var mon = loan * (1 + rate / 100 * yrs) / (yrs * 12), tdp = dp + adm + p * ins / 100 + mon;
      $("pdo").textContent = dpP + "%"; $("pp").textContent = rp(p); roll($("pm"), mon, function (n) { return rp(n) + " / bulan"; });
      roll($("ptdp"), tdp, rp); $("ph").textContent = rp(p); $("pk").textContent = rp(loan);
      var ls = $("pl").value;
      var msg = ["Halo, saya ingin simulasi kredit resmi.", "Model: " + m.n + " " + v.n + " (" + rp(p) + ").", "Uang muka " + dpP + "%, tenor " + yrs + " tahun" + (ls ? ", leasing " + ls : "") + ".",
        "Estimasi di situs: " + rp(mon) + " per bulan. Mohon dihitungkan angka resminya."];
      var wa = $("pwa"); wa.href = wa.href.split("?")[0] + "?text=" + encodeURIComponent(msg.join("\n"));
      $("ptd").href = "/test-drive/?model=" + encodeURIComponent(m.n);
    }
    tabs.forEach(function (t) { t.addEventListener("click", function () { mi = +t.getAttribute("data-i"); tabs.forEach(function (x) { x.setAttribute("aria-selected", x === t ? "true" : "false"); }); fillV(); }); });
    segs.forEach(function (s) { s.addEventListener("click", function () { yrs = +s.getAttribute("data-y"); segs.forEach(function (x) { x.setAttribute("aria-pressed", x === s ? "true" : "false"); }); calc(); }); });
    ["pv", "pdp", "pl"].forEach(function (id) { $(id).addEventListener("input", calc); $(id).addEventListener("change", calc); });
    var q = new URLSearchParams(location.search).get("model");
    if (q) data.forEach(function (m, i) { if (m.n === q || m.s === q) { mi = i; tabs.forEach(function (x, k) { x.setAttribute("aria-selected", k === i ? "true" : "false"); }); } });
    fillV();
  })();
  // tab (mis. Eksterior / Interior di halaman model)
  document.querySelectorAll("[data-tabs]").forEach(function (w) {
    var bs = w.querySelectorAll("[data-tab]"), ps = w.querySelectorAll("[data-pan]");
    bs.forEach(function (b) { b.addEventListener("click", function () {
      bs.forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
      ps.forEach(function (p) { p.hidden = p.getAttribute("data-pan") !== b.getAttribute("data-tab"); });
    }); });
  });
})();

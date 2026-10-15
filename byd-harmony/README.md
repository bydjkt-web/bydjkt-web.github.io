# BYD Harmony — Website Dealer (GitHub Pages + Firebase)

Website statis super ringan (tanpa framework, CSS di-inline, JS ±6 KB) yang dibuat oleh generator Python.
Sumber ada di `src/`, hasil siap tayang ada di `docs/`.

```
src/data/site.json     <- identitas dealer, nomor WA, domain, Firebase, GA4  (EDIT INI DULU)
src/data/models.json   <- model, varian, harga, FAQ per model
src/articles/*.md      <- artikel blog (tulis manual, build otomatis jadi halaman SEO)
src/assets/            <- style.css, app.js (form lead + scoring)
tools/build.py         <- generator: halaman, schema JSON-LD, sitemap, robots, OG image
tools/seo_check.py     <- pemeriksa standar SEO (title, meta, H1, schema, link rusak, keyword artikel)
firebase/firestore.rules
strategy/SEO-STRATEGY.md
docs/                  <- hasil build (yang dipublish GitHub Pages)
```

## 1. Isi data dealer (wajib)
Edit `src/data/site.json`: `domain`, `wa_number` (format 62812…), `phone_display`, `address`, `postal`, `hours`.
Lalu: `python3 tools/build.py && python3 tools/seo_check.py`

## 2. Firebase (penyimpanan lead)
1. console.firebase.google.com → buat project → tambah Web App → salin `apiKey`, `authDomain`, `projectId`, `appId` ke `site.json` (bagian `firebase`).
2. Build Firestore Database (mode production), lalu tempel isi `firebase/firestore.rules` di tab Rules → Publish.
3. Authentication → Settings → Authorized domains: tambahkan domain website Anda.
4. Lead masuk di koleksi `leads` dengan field `score` (0–100) dan `tier` (`hot` ≥70, `warm` 40–69, `cold` <40).
   Pengunjung hanya bisa menambah data, tidak bisa membaca. Jika Firebase belum diisi, form tetap berjalan lewat WhatsApp.

Aturan skor ada di `src/assets/app.js` (fungsi `score`): rencana beli (≤40), cash/kredit (≤20), minta test drive (20), pilih model (10), tukar tambah (5), nomor valid (5).

## 3. Publish di GitHub Pages
1. Buat repo GitHub, push seluruh folder ini.
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, folder `/docs`.
3. Pakai **custom domain** (Settings → Pages → Custom domain). Wajib untuk SEO: semua link memakai path root (`/byd-atto-1/`), tidak cocok untuk alamat `user.github.io/repo/`.
4. Atur DNS domain ke GitHub Pages, centang Enforce HTTPS. File `CNAME` dibuat otomatis saat domain sudah diisi.

## 4. Google indexing
1. Search Console → tambah properti domain → verifikasi (atau isi `gsc_verification` di `site.json`, build ulang).
2. Sitemaps → kirim `https://DOMAINANDA/sitemap.xml`.
3. URL Inspection → Request indexing untuk beranda, `/harga-byd/`, `/test-drive/`, tiap halaman model, dan artikel baru.
4. Buat Google Business Profile dealer dengan nama, alamat, dan telepon yang sama persis dengan di website.

## 5. Menambah artikel
Buat `src/articles/judul-artikel.md`:
```
---
title: Judul SEO maks 60 karakter (mengandung keyword)
h1: Judul H1 di halaman
slug: keyword-di-slug
keyword: keyword utama
description: Meta description 120-160 karakter, mengandung keyword
date: 2026-10-20
category: Panduan
---
Paragraf pertama langsung memuat keyword utama...

## Subjudul
Isi, gunakan [link internal](/byd-dolphin/) ke halaman model/harga.

## FAQ
### Pertanyaan?
Jawaban singkat.
```
Jalankan `python3 tools/build.py && python3 tools/seo_check.py`. Pemeriksa akan menilai keyword di title/H1/slug/100 kata pertama, kepadatan, jumlah kata, link internal, dan schema.
Selalu tambahkan nomor artikel baru ke strategi di `strategy/SEO-STRATEGY.md` agar tidak ada dua artikel yang menarget keyword yang sama.

## Catatan penting
- Harga di `models.json` hanya yang terkonfirmasi di daftar harga yang dipublikasikan Oktober 2026. Perbarui tiap bulan (dan ubah `price_date_label`), lalu build ulang. Gunakan harga resmi dari BYD Indonesia/dealer Anda.
- Belum ada foto mobil. Tambahkan foto milik dealer/izin resmi ke `src/assets/img/` (WebP, beri `width`, `height`, `alt`, dan `loading="lazy"` kecuali gambar paling atas). Jangan mengambil foto dari situs lain tanpa izin.

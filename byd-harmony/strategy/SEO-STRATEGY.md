# Strategi SEO Nasional — BYD Harmony

## Ekspektasi realistis
Tidak ada yang bisa menjamin peringkat #1. Keyword nasional seperti "harga mobil BYD" dikuasai situs otomotif besar (Moladin, Oto, Carmudi, situs resmi BYD, media nasional) yang sudah punya otoritas domain bertahun-tahun. Untuk website baru, jalur yang realistis adalah:

| Fase | Waktu | Target |
|---|---|---|
| 1. Fondasi | Minggu 1–2 | Website terindeks, Search Console aktif, Google Business Profile terverifikasi |
| 2. Long-tail | Bulan 1–3 | Peringkat 1–10 untuk keyword spesifik berpersaingan rendah |
| 3. Otoritas | Bulan 3–9 | Backlink berkualitas, artikel pilar, peringkat naik untuk keyword menengah |
| 4. Keyword sulit | Bulan 9–18 | Bersaing untuk "harga mobil BYD", "mobil listrik terbaik", dst. |

Kecepatan fase 3–4 sangat bergantung pada konsistensi konten dan backlink, bukan pada teknis semata.

## Yang sudah diterapkan di website (teknis & on-page)
- HTML statis, CSS inline, tanpa font/library eksternal, JS ±6 KB (LCP dan CLS sangat baik; ukur dengan PageSpeed Insights setelah tayang)
- Title unik ≤60 karakter, meta description 70–160, satu H1, canonical, Open Graph, `lang="id"`, viewport
- Schema JSON-LD: AutoDealer, WebSite, Car (+ AggregateOffer), BreadcrumbList, FAQPage, BlogPosting
- Sitemap.xml, robots.txt, halaman 404 `noindex`, breadcrumb, daftar isi artikel, internal linking antar model/harga/artikel
- Cek otomatis `tools/seo_check.py` (0 FAIL, 0 WARN pada build saat ini)
- Catatan: Google sejak 2023 hanya menampilkan rich result FAQ untuk situs pemerintah/kesehatan. Schema FAQ tetap membantu pemahaman konten, tetapi jangan berharap tampil sebagai rich snippet.

## Arsitektur konten (topic cluster)
**Halaman komersial (sudah ada):** beranda, `/harga-byd/`, 6 halaman model, `/test-drive/`.
**Artikel pilar yang direkomendasikan berikutnya** (satu keyword per artikel, jangan tumpang tindih):

| Prioritas | Keyword target | Jenis | Link internal ke |
|---|---|---|---|
| Tayang | kelebihan dan kekurangan mobil listrik | Informasional | model, harga |
| Tayang | biaya charging mobil listrik di rumah | Informasional | Atto 1, Dolphin |
| 1 | perbandingan BYD Atto 1 vs Dolphin | Komparasi (niat beli tinggi) | kedua model |
| 2 | simulasi cicilan mobil listrik BYD | Transaksional | harga, test drive |
| 3 | mobil listrik 200 jutaan terbaik | Komparasi | Atto 1 |
| 4 | perbedaan mobil listrik dan hybrid | Informasional | harga |
| 5 | cara merawat baterai mobil listrik | Informasional | model |
| 6 | mobil listrik untuk keluarga besar | Komparasi | M6, Sealion 7 |
| 7 | review BYD Atto 1 / Dolphin / Sealion 7 (pengalaman test drive asli) | Review | model terkait |

Ritme: 1 artikel per minggu (kualitas lebih penting dari jumlah). Perbarui `/harga-byd/` setiap awal bulan karena keyword "harga BYD [bulan tahun]" sering dicari dan dinilai segar.

## E-E-A-T (sinyal kepercayaan, penting untuk otomotif)
- Tambahkan foto dan video **asli** dealer dan unit (bukan stok), nama sales, dan alamat nyata
- Tulis review dan pengalaman test drive orisinal, bukan hanya meringkas spesifikasi
- Cantumkan sumber untuk angka teknis, tanggal pembaruan harga, dan disclaimer
- Halaman Tentang Kami, Kontak, dan Kebijakan Privasi (belum dibuat; sebaiknya ditambahkan sebelum menjalankan iklan)

## Link building & sinyal off-page
1. Google Business Profile (kategori: Dealer mobil), NAP identik dengan website, minta ulasan pelanggan asli
2. Direktori otomotif dan dealer BYD, media sosial dengan link ke website
3. Konten yang layak dikutip: data harga bulanan, kalkulator biaya charging
4. Kolaborasi dengan komunitas EV, media lokal, dan kreator otomotif
5. Hindari jual-beli backlink dan jaringan blog (PBN): berisiko penalti

## Mengubah traffic menjadi hot leads
- Setiap halaman memiliki form + tombol WhatsApp melayang; pesan WhatsApp sudah terisi (nama, model, rencana beli)
- Skor lead otomatis: **hot ≥70** (hubungi < 15 menit), **warm 40–69** (hubungi hari yang sama, kirim simulasi), **cold <40** (nurturing lewat WhatsApp/konten)
- Pantau di GA4: event `generate_lead` (dengan `tier`) dan `click_whatsapp`; tandai sebagai konversi
- Pakai parameter UTM untuk iklan dan postingan sosial; sumber trafik ikut tersimpan di setiap lead
- Retargeting: pasang Meta Pixel/Google Ads tag setelah halaman Kebijakan Privasi ada
- Langkah lanjutan: sambungkan koleksi `leads` ke CRM/dashboard internal dan notifikasi Telegram untuk lead hot

## KPI mingguan
Halaman terindeks (Search Console) · impresi dan klik · posisi rata-rata keyword target · Core Web Vitals · jumlah lead per tier · rasio lead → test drive → closing.

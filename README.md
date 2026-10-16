# ClassCash - Kas Digital Kelas

Aplikasi kas kelas yang transparan untuk **10 AKL 1, SMKN 1 Sorong**. Bendahara mencatat iuran dan pengeluaran, sedangkan siswa dan guru dapat melihat saldo dan riwayat tanpa bisa mengubah data.

**Link aplikasi:** https://classcash-web.netlify.app
(dibuka lewat browser di HP maupun laptop, tanpa instal)

## Masalah dan Solusi

| Masalah | Solusi ClassCash |
|---|---|
| Catatan kas di buku atau chat sulit dilacak | Semua pemasukan dan pengeluaran tersimpan di database |
| Siswa tidak tahu saldo dan ke mana uang dipakai | Dashboard menampilkan saldo dan riwayat yang bisa dilihat semua |
| Bendahara mencatat iuran dua kali | Menandai pembayaran otomatis membuat catatan pemasukan |

## Fitur

1. **Login per akun** dengan tiga peran: siswa, guru, bendahara.
2. **Kas mingguan dicicil**: iuran Rp 6.000 per minggu (Rp 1.000 x 6 hari). Status otomatis **Belum**, **Sebagian**, atau **Lunas**.
3. **Catatan transaksi** pemasukan dan pengeluaran dengan keterangan.
4. **Dashboard dan laporan** dengan saldo kas dan filter per bulan.
5. **Kelola siswa**: tambah, ubah nama, dan nonaktifkan (riwayat uang tetap tersimpan).

## Akun Demo

Gunakan akun ini untuk mencoba. Datanya hanya contoh, bukan data siswa asli.

| Peran | Email | Password | Bisa apa |
|---|---|---|---|
| Bendahara | bendahara@contoh.com | 100326 | Kelola siswa, catat kas, catat transaksi |
| Guru | guru@contoh.com | 080426 | Hanya melihat |
| Siswa | siswa@contoh.com | 220911 | Hanya melihat |

## Teknologi

- **Tampilan:** HTML, CSS, dan JavaScript (tanpa framework), mobile-first
- **Database dan login:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Hosting:** Netlify (otomatis diperbarui dari GitHub)
- **Alat bantu:** Visual Studio Code, GitHub

## Tools AI yang Dipakai

- **Claude (Anthropic):** menyusun PRD, merancang skema database dan aturan keamanan, menulis kode awal, dan membantu menelusuri error.
- Semua kode ditinjau, diuji, dan dijalankan sendiri oleh saya. Kami dapat menjelaskan cara kerja setiap bagian tanpa bantuan AI.

## Keamanan

- Peran disimpan di **database (server)**, bukan di browser, sehingga tidak bisa dipalsukan lewat konsol.
- **Row Level Security (RLS)** aktif di semua tabel: pengguna yang belum login tidak bisa mengakses data, siswa dan guru hanya bisa membaca, dan hanya bendahara kelas yang bisa menulis.
- Pembayaran iuran hanya lewat fungsi server yang memeriksa peran dan batas Rp 6.000 per minggu.
- Semua teks dari pengguna ditampilkan dengan `textContent` (mencegah XSS); query lewat Supabase client (mencegah SQL injection).
- Kunci yang ada di kode adalah kunci **anon** yang memang publik. Kunci rahasia (`service_role`) tidak pernah dipakai di aplikasi.

## Struktur Proyek

```
index.html        halaman utama
style.css         tampilan
js/config.js      alamat dan kunci anon Supabase
js/app.js         seluruh logika aplikasi
sql/schema.sql    skema database lengkap + aturan keamanan
```

## Cara Menjalankan Sendiri

1. Buat proyek di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel isi `sql/schema.sql`, lalu **Run**.
3. Buat tiga akun di **Authentication > Users** (centang *Auto Confirm User*), lalu tetapkan peran dengan dua query `update` di bagian 8 file `schema.sql`.
4. Isi `js/config.js` dengan **Project URL** dan **anon key** proyekmu.
5. Buka `index.html` lewat Live Server (VS Code), atau unggah folder ke Netlify.

## Tim

Tim **ORION** (pengembang tunggal)

| Nama | Kelas | Peran |
|---|---|---|
| Syaffira Nurul | 10 AKL 1 | Solo developer: perancangan, pengembangan, pengujian, dan dokumentasi |

Dokumentasi lengkap: lihat berkas Dokumentasi-ClassCash-ORION.docx

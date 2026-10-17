# Workflow Pembuatan ClassCash dengan AI

ORION- Solo developer - SMKN 1 Sorong - Lomba Aplikasi berbasis web berbantuan Artificial Intelligence (AI). 

## Prinsip Kerja

1. **Manusia memutuskan, AI membantu.** Setiap tahap baru dimulai setelah tim menyetujui (prinsip "jangan lanjut sebelum saya setujui").
2. **Satu langkah, satu pengujian.** Kode dijalankan dan dicoba sendiri sebelum lanjut.
3. **Data pribadi tidak dikirim ke AI.** Aplikasi memakai data contoh, dan hanya kunci anon (publik) yang dibagikan, tidak pernah kunci rahasia.

## Alat yang Dipakai

| Kebutuhan | Alat |
|---|---|
| Berpikir, merancang, menulis kode | Chat AI (Claude) |
| Database dan login | Supabase |
| Menulis dan menjalankan kode | Visual Studio Code |
| Menyimpan kode | GitHub |
| Hosting (link publik) | Netlify |
| Flyer | Canva |

## Langkah Kerja

| No | Langkah | Yang dilakukan bersama AI | Hasil |
|---|---|---|---|
| 1 | Menentukan masalah | Menjelaskan kebutuhan: kas kelas digital yang transparan, berjalan di HP, memakai Supabase | Gambaran aplikasi |
| 2 | Menilai aplikasi lama | Mengirim tangkapan layar dan kode versi pertama untuk ditinjau | Daftar masalah: peran hanya di browser, password tertulis di kode, kas dan catatan uang tidak terhubung |
| 3 | Memutuskan membangun ulang | Membandingkan menambal dengan membangun ulang | Keputusan: aplikasi baru, proyek Supabase baru, satu kelas dulu |
| 4 | Menyusun PRD | AI menyusun draf, tim membaca dan menyetujui | PRD 5 fitur inti |
| 5 | Merancang database dan keamanan | Skema tabel dan aturan akses (RLS) | `sql/schema.sql`, dijalankan dan dicek di Supabase |
| 6 | Menentukan aturan kas | Siswa membayar Rp 1.000 per hari, jadi dipilih kas **dicicil** dengan status Belum, Sebagian, Lunas | Perubahan fungsi database |
| 7 | Menulis kode per fitur | Login, dashboard, kas mingguan, laporan, kelola siswa | `index.html`, `style.css`, `js/` |
| 8 | Mencari dan memperbaiki error | Membaca pesan error di Console, lalu memperbaiki penyebabnya | Aplikasi berjalan |
| 9 | Menguji peran dan keamanan | Mencoba akun bendahara, guru, dan siswa | Siswa dan guru tidak punya tombol ubah |
| 10 | Mengunggah | Commit ke GitHub, lalu Netlify mengambil dari GitHub | Link publik |
| 11 | Dokumen | README, workflow, dokumentasi, flyer, video | Berkas pengumpulan |

## Contoh Prompt (5 Bagian)

- **Peran:** Kamu engineer ahli Android dan web developer.
- **Konteks:** Aplikasi kas digital kelas 10 AKL 1, memakai Supabase, untuk bendahara, guru, dan siswa.
- **Tugas:** Buat HANYA aplikasi kas dengan satu fitur dulu.
- **Batasan:** Peran dijaga server, siswa hanya bisa melihat, jangan lanjut sebelum saya setujui.
- **Format:** Rencana dulu, lalu kode, lalu cara mengujinya.

## Saat AI Salah

- **Masalah:** layar kosong setelah kode dijalankan.
- **Cara menemukan:** membuka Console (F12) dan membaca pesan error: nama `top` bentrok dengan bagian bawaan browser.
- **Perbaikan:** mengganti nama menjadi `pageTop`.
- **Pelajaran:** hasil AI tetap harus dijalankan dan diuji. Pesan error yang lengkap membuat perbaikan cepat.

## Keputusan yang Diambil Tim (bukan AI)

- Membangun ulang aplikasi, bukan menambal.
- Satu kelas dulu, dengan database yang siap dikembangkan.
- Kas dicicil per hari, bukan menunggu Rp 6.000 terkumpul.
- Siswa dinonaktifkan, bukan dihapus, supaya riwayat uang tetap utuh.

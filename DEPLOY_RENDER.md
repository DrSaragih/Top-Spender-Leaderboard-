# Hosting publik dengan Render

Konfigurasi `render.yaml` menyiapkan satu Python Web Service paket Starter di Singapore dan persistent disk 1 GB. **Keduanya dapat dikenakan biaya.** Periksa harga/estimasi Render sebelum membuat layanan. Belum ada service atau tagihan yang dibuat oleh perubahan kode ini. Domain pribadi tidak wajib: gunakan alamat HTTPS `*.onrender.com` yang diberikan Render.

## Buat layanan

1. Login atau buat akun di https://dashboard.render.com dan hubungkan GitHub Anda. Jangan membagikan password/token melalui chat.
2. Pilih **New → Blueprint**, lalu pilih repository `DrSaragih/Top-Spender-Leaderboard-` pada branch `main`.
3. Render membaca `render.yaml`. Pastikan hanya **1 instance**, disk terpasang pada `/var/data`, `DATABASE_PATH=/var/data/leaderboard.sqlite3`, dan `COOKIE_SECURE=1`.
4. Masukkan `ADMIN_PASSWORD` sendiri pada field rahasia Render (12–1024 karakter). Jangan menyimpannya di YAML/GitHub. Periksa paket dan biaya, kemudian buat/deploy Blueprint.
5. Tunggu status deploy berhasil dan health check `/healthz` lulus. Render akan memberikan URL HTTPS publik. Selama menggunakan domain Render, `RENDER_EXTERNAL_URL` diisi otomatis, jadi `PUBLIC_URL` tidak perlu ditetapkan.
6. Buka `<URL-Render>/admin`, login, atur timer yang benar, lalu lihat **Bagikan leaderboard & QR**. Tautan pelanggan, tautan videotron, dan QR tersedia di situ. Unduh QR SVG untuk bahan cetak.
7. Pada videotron, buka tautan **Buka tampilan videotron**, lalu gunakan fullscreen browser. Laptop admin dan videotron tidak harus menggunakan Wi-Fi yang sama. Pelanggan cukup scan QR dari jaringan seluler/Wi-Fi mereka.

Untuk domain sendiri, tambahkan custom domain di Render, ikuti instruksi DNS/HTTPS Render, lalu atur `PUBLIC_URL=https://domain-anda` pada Environment dan deploy ulang. QR akan memakai domain tersebut. Jangan menggunakan `localhost`, IP LAN, URL `/admin`, atau URL bertoken sebagai `PUBLIC_URL`.

## Sebelum acara

- Uji scan QR memakai HP dengan data seluler (matikan Wi-Fi), input dari laptop, dan lihat perubahan pada videotron dari jaringan berbeda. Semua harus mengakses URL Render yang sama.
- Pastikan timer menghitung sesuai jam server dan batas waktu acara Anda, dan uji penutupan di database uji sebelum produksi.
- Uji unduhan kedua CSV serta logout/login. Jangan memasukkan data demo ke database acara.
- Verifikasi database tetap ada setelah restart/deploy dengan data uji terlebih dahulu, lalu gunakan database bersih untuk acara. Disk harus tetap terpasang pada path yang sama.
- Tinjau volume kunjungan dan lakukan uji beban yang mewakili jumlah penonton. Polling setiap 3 detik berarti jumlah permintaan bertambah sesuai jumlah layar/HP. Konfigurasi ini satu instance; jangan menambah instance dengan database SQLite terpisah.

## Data laptop yang sudah ada

**Deploy tidak otomatis memindahkan `.data/leaderboard.sqlite3` dari laptop ke Render.** Database Render baru dimulai kosong, sementara data di laptop tetap ada. Sebelum pindah, download CSV dari admin lokal untuk arsip dan buat backup SQLite yang konsisten. Jangan menjalankan input di dua server sekaligus: data lokal dan Render tidak digabungkan otomatis. Jika histori lama harus muncul di leaderboard publik, selesaikan pemindahan database ke persistent disk Render melalui akses deployment yang Anda kelola sebelum mulai menerima transaksi publik. Fitur import CSV belum tersedia; CSV ekspor tidak dapat langsung diunggah kembali ke aplikasi.

Persistent disk mempertahankan data saat restart/deploy biasa; menghapus disk/service dapat menghapus data. CSV bukan backup database lengkap. Sediakan kebijakan backup disk/SQLite melalui fasilitas hosting dan uji pemulihannya. Jangan commit database, CSV pelanggan, atau kata sandi ke Git.

## Batas yang perlu dipahami

Aplikasi yang di-push ke GitHub belum otomatis online sebelum Render dibuat dan deploy berhasil. Kode/config ini telah diuji lokal; deploy, tagihan, konektivitas publik, dan pemindaian QR dari internet harus diverifikasi setelah layanan dibuat. Jika internet terputus, layar yang sudah terbuka mempertahankan data terakhir dan mencoba terhubung kembali, tetapi transaksi admin baru tidak tersimpan sampai koneksi pulih. Tidak ada sinkronisasi input offline lintas jaringan.

Untuk update lokal Windows, hentikan server lalu jalankan:

```bat
git pull origin main
python -m pip install -r requirements.txt
python server.py
```

Pada Render, gunakan deploy commit terbaru lewat dashboard atau mekanisme auto-deploy yang Anda aktifkan. Jangan menjalankan kembali server lokal untuk memasukkan data acara yang sudah dipindahkan ke Render.

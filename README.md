# Christmas Toy Factory · Midnight Sale

Leaderboard poin untuk 12 Desember 2026 dengan halaman admin, penyimpanan SQLite, dan sinkronisasi publik setiap 3 detik. Tidak ada data pelanggan contoh yang dimasukkan ke database.

## Menjalankan

Membutuhkan Python 3.12+. Instal dependency QR lokal dengan `python -m pip install -r requirements.txt` (Windows) atau `python3 -m pip install -r requirements.txt`.

```sh
cd /workspace/Top-Spender-Leaderboard-
python3 -m pip install -r requirements.txt
python3 server.py
```

Masukkan kata sandi admin 12–1024 karakter pada prompt terminal (input disembunyikan). Gunakan kata sandi yang sama ketika memulai ulang jika akses admin tetap sama diperlukan. Untuk service noninteraktif, sediakan `ADMIN_PASSWORD` melalui environment/secret manager deployment, jangan menulis kata sandi ke repository atau command history.

- Leaderboard: route `/`.
- Admin: route `/admin`.
- Videotron: route `/?display=screen`.
- Port default `8000`, dapat diubah melalui `PORT`.
- `HOST` default `0.0.0.0`; gunakan `127.0.0.1` untuk akses lokal saja.

Semua perangkat harus membuka URL server yang sama. HTML yang dibuka langsung dari file atau hosting statis tidak dapat menyimpan dan menyinkronkan transaksi. Ini adalah aplikasi satu server, bukan sinkronisasi melalui localStorage.

## Alur admin

1. Login di `/admin` menggunakan kata sandi server.
2. Isi nama depan, member code, dan nominal **transaksi baru** dalam rupiah bulat.
3. Simpan. Pilih kategori sesuai satu struk. Poin per struk dijumlahkan untuk member dengan kode yang sama; nama depan harus konsisten. Kode otomatis dijadikan huruf besar.
4. Leaderboard mengambil data terbaru setiap 3 detik tanpa memuat ulang halaman atau mengulang animasi saat data tidak berubah.

Nominal transaksi dan total per member dibatasi Rp999.999.999. Peringkat menampilkan 10 member dengan poin tertinggi dari struk yang memenuhi minimum dan sudah berkategori; poin sama diurutkan menurut member code. Nominal rupiah tidak menjadi penentu urutan saat poin sama. Riwayat admin menampilkan 100 transaksi terakhir dengan waktu sesuai zona perangkat. Nama depan maksimal 40 huruf (boleh apostrof/tanda hubung); member code maksimal 24 huruf/angka/tanda hubung. Sesi admin berakhir setelah 12 jam atau ketika server restart.

Permintaan simpan memakai ID transaksi unik. Jika koneksi terputus saat menyimpan, gunakan kembali data di formulir dan klik simpan lagi; server memastikan ID yang sama tidak tercatat dua kali. Data permintaan yang belum terkonfirmasi dipertahankan di tab admin melalui sessionStorage. Ini tidak menyimpan kata sandi. Jangan mengubah input transaksi yang belum terkonfirmasi sampai hasilnya diketahui.

Saat server tidak terjangkau, leaderboard mempertahankan data terakhir dan menandainya **KONEKSI TERPUTUS**; sinkronisasi dilanjutkan otomatis setelah koneksi pulih. Status LIVE menunjukkan keberhasilan pengambilan data, bukan integrasi langsung dengan POS/kasir.

## Data dan deployment

Database default: `.data/leaderboard.sqlite3` (diabaikan Git). `DATABASE_PATH` dapat menunjuk penyimpanan persisten lain. Restart proses tidak menghapus pembelanjaan. Jangan menaruh database di storage sementara untuk penggunaan acara. Backup SQLite menggunakan SQLite backup API atau hentikan server sebelum menyalin seluruh file database beserta WAL yang relevan.

Untuk akses Internet, letakkan server di belakang reverse proxy HTTPS dan tetapkan `COOKIE_SECURE=1`. Gunakan satu instance aplikasi dengan volume SQLite persisten; jangan menjalankan banyak instance dengan database terpisah. Sesi disimpan di memori dan tidak bertahan setelah restart. Route statis dibatasi sehingga source server, database, dan file tersembunyi tidak dipublikasikan. Login dibatasi 10 percobaan per alamat IP dalam 5 menit; gunakan rate limiting reverse proxy jika banyak admin berada di balik satu proxy.

Aplikasi belum di-deploy ke hosting publik. Tidak ada integrasi POS otomatis, import, pembatalan, atau penghapusan transaksi; periksa nominal sebelum menyimpan. Semua transaksi di database ini adalah untuk satu acara Midnight Sale tersebut.

## Pengujian

```sh
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s tests -v
```

Menguji autentikasi, perlindungan request lintas situs, file privat, validasi, akumulasi, pengurutan, penyimpanan, dan permintaan duplikat bersamaan. Gunakan database terpisah untuk pengujian; jangan mengisi database acara dengan data demo.

## Timer pengumpulan struk

Di `/admin`, bagian **Timer pengumpulan struk**, centang **Aktifkan batas waktu**, pilih tanggal/jam berakhir dan zona WIB/WITA/WIT, lalu simpan. Timer awalnya tidak aktif; tidak ada jam penutupan yang diasumsikan. Batas waktu disimpan di SQLite dan tetap berlaku setelah restart.

Leaderboard mengambil batas dan waktu server setiap 3 detik, lalu menghitung mundur hari/jam/menit/detik secara lokal menggunakan waktu monotonik. Perbedaan pengaturan jam perangkat tidak mengubah batas server. Label batas di layar publik selalu dikonversi ke WIB. Lima menit terakhir diberi penanda mendesak. Saat nol, pengumpulan ditutup dan API menolak transaksi baru, termasuk dari tab admin lama. Pengiriman ulang ID yang sudah tersimpan tetap berhasil tanpa menambah transaksi kedua kali.

Admin dapat memperpanjang batas untuk membuka kembali atau menonaktifkan timer agar pengumpulan kembali terbuka tanpa batas waktu. Jika koneksi terputus, timer memakai batas terakhir dan menampilkan peringatan; perubahan admin baru diterima setelah koneksi pulih. Pastikan jam server benar. Memulai browser baru tanpa koneksi tidak dapat menampilkan batas yang belum pernah dimuat.

## Download data dan QR publik

Admin memiliki tombol **Unduh semua transaksi** dan **Unduh rekap per member**. Ekspor CSV mencakup semua data yang sudah tersimpan saat query dijalankan, bukan hanya 100 transaksi terakhir atau 10 besar. CSV berformat UTF-8 BOM agar nama Indonesia terbaca di Excel; angka berupa rupiah bulat tanpa pemisah ribuan. Jika Excel tidak memisahkan kolom secara otomatis, gunakan Data → From Text/CSV dan pilih delimiter koma. Waktu tersedia dalam UTC dan WIB. Nilai teks yang dapat dianggap rumus oleh spreadsheet diberi apostrof; kode numerik dengan nol di depan juga diberi apostrof untuk mempertahankan nol tersebut.

CSV adalah arsip/tabulasi, bukan backup database yang bisa langsung di-restore aplikasi. Riwayat belum memiliki fitur import. File yang selesai diunduh tidak ikut berubah saat ada transaksi baru; ekspor lagi untuk snapshot terbaru. Semua ekspor dan QR admin memerlukan login.

QR dibuat lokal pada server dengan `qrcode==8.2`; tidak mengirim URL ke layanan QR pihak ketiga. Server memakai `PUBLIC_URL` jika diatur, atau `RENDER_EXTERNAL_URL` yang disediakan Render. Hanya origin HTTPS tanpa path/query yang diterima. Tanpa alamat publik yang valid, admin menampilkan petunjuk hosting dan tidak membuat QR localhost. QR mengarah ke `/`, tidak mengandung kredensial admin. Saat ganti domain, unduh dan cetak ulang QR. Tautan videotron memakai `/?display=screen`.

Konfigurasi Render dan langkah aktivasi ada di [DEPLOY_RENDER.md](DEPLOY_RENDER.md). QR tidak menyediakan internet: laptop admin, HP pelanggan, dan videotron boleh memakai jaringan berbeda tetapi tetap membutuhkan koneksi internet ke URL hosting yang sama.

## Aturan poin dan minimum struk

Minimum **Rp500.000 per struk berlaku untuk semua kategori**. Setiap input adalah satu struk. Jangan menjumlahkan dua struk kecil menjadi satu transaksi agar lolos minimum.

| Kategori | Nilai belanja untuk 1 poin | Contoh 1 struk Rp500.000 |
| --- | --- | --- |
| F&B | Rp50.000 | 10 poin |
| Fashion | Rp50.000 | 10 poin |
| Elektronik | Rp500.000 | 1 poin |
| Perhiasan | Rp500.000 | 1 poin |

Poin = `floor(nominal struk / tarif kategori)` hanya jika nominal satu struk minimal Rp500.000. Pembulatan dilakukan **per struk**, lalu poin dijumlahkan per member. Sisa rupiah tidak diakumulasikan, termasuk antar kategori bertarif sama. Dua struk Elektronik masing-masing Rp750.000 menghasilkan 1 + 1 = 2 poin; dua struk Fashion masing-masing Rp525.000 menghasilkan 10 + 10 = 20 poin.

Struk di bawah minimum tetap dicatat untuk arsip, tetapi mendapat **0 poin**. Dua struk Rp250.000 tidak menghasilkan poin walaupun totalnya Rp500.000. Member yang belum mempunyai struk memenuhi minimum tidak muncul pada leaderboard. Admin melihat estimasi poin sebelum menyimpan dan total poin member dari server setelah tersimpan. Riwayat serta CSV transaksi mencantumkan kategori, tarif, poin per struk, dan status kelayakan. CSV rekap mencantumkan total poin, nominal rupiah, serta jumlah struk memenuhi minimum/belum berkategori.

### Update database lama

Backup database terlebih dahulu, hentikan proses, jalankan `git pull origin main`, instal dependency dengan `python -m pip install -r requirements.txt`, lalu mulai lagi `python server.py`. Startup menambah kolom kategori tanpa menghapus atau menebak kategori transaksi lama. Muat ulang tab admin dan semua layar leaderboard setelah update.

Bagian admin **Kategorikan transaksi lama** menampilkan 100 struk belum berkategori per batch. Cocokkan nama, member code, nominal, dan waktu dengan struk asli, lalu pilih kategori. Batch berikutnya muncul otomatis. Penetapan kategori tetap dapat dilakukan setelah timer ditutup karena hanya memperbarui metadata transaksi yang sudah tercatat. Kategori yang sudah ditetapkan tidak bisa diganti melalui UI ini. Struk di bawah minimum tetap 0 poin. Transaksi belum berkategori tidak dihitung menjadi poin dan ditandai dalam ekspor; selesaikan pemeriksaan sebelum acara.

Versi ini tetap menggunakan Python/SQLite. Migrasi Vercel/Firebase belum dilakukan.

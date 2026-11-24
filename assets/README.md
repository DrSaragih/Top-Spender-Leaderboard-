# Aset Joy Factory Through The Night

## Aset dari Bear.zip

Ketujuh PNG kiriman pengguna disalin langsung ke `assets/bears` tanpa crop, konversi, atau perubahan piksel. Nama disederhanakan untuk URL aplikasi. Manifest `bears/manifest.json` mencatat nama asal ZIP, dimensi, dan SHA-256 setiap file.

| File | Isi | Pemakaian |
| --- | --- | --- |
| `bears/bear-wave.png` | Beruang berdiri melambai | Podium pertama |
| `bears/bear-jump.png` | Beruang melompat | Podium kedua |
| `bears/bear-dance.png` | Beruang menari dengan satu kaki terangkat | Podium ketiga |
| `bears/bear-candy.png` | Beruang membawa candy cane | Tengah dekorasi bawah pada layar besar |
| `bears/bear-gift.png` | Beruang duduk memegang hadiah | Sisi kanan pabrik |
| `bears/bear-cozy.png` | Beruang berbaring santai | Pendamping judul dan layar kosong |
| `bears/festive-ornaments.png` | Trio ornamen ruby/navy/ivory | Disimpan sebagai aset versi sebelumnya; ornamen aktif memakai SVG awal |

Enam beruang berukuran 1254 × 1254 px; ornamen 1536 × 1024 px. Transparansi asli dipertahankan. Arsip sekitar 14 MiB dipertahankan lengkap. Enam figur beruang (sekitar 12 MiB) dimuat sekali per halaman; perubahan poin memakai gambar yang sudah dimuat. Trio ornamen PNG tidak dimuat oleh halaman aktif.

## Aset pendukung aktif

- `joy-left-factory.png`: aset rumah pabrik baru, 1774 × 887 px, PNG transparan sekitar 1,94 MiB. Cottage navy/emas dengan atap bersalju, jendela hangat berisi mainan/beruang, pintu ruby, sayap workshop beroda gigi, dan pohon kecil. Dibuat dengan generator gambar yang tersedia dan disalin tanpa perubahan piksel dari `/workspace/generated_images/exec-9651c063-3599-44dd-9f7b-e39bcff6b38f.png`. Ditampilkan utuh di kiri bawah.
- `joy-crown.svg`, `joy-sparkle.svg`: mahkota podium dan bintang dekoratif.
- `joy-bauble.svg`: ornamen awal yang dipakai kembali sebagai tiga bola ruby, navy, dan ivory. CSS memberi warna lacquer, pantulan bergerak, halo hangat, dan kilau bergantian; SVG sumber tetap utuh.
- `joy-clockwork.svg`, `joy-workshop.svg`: roda gigi serta arsitektur rumah/pabrik di belakang panel.

Rumah baru dibuat dengan generator gambar dan SVG ditulis langsung. Enam beruang aktif memakai file Bear.zip pengguna. Tidak ada ketergantungan runtime pada layanan gambar/editor pihak ketiga.

## Font judul

`fonts/GreatVibes-Regular.ttf` adalah Great Vibes dari Google Fonts, dipakai pada wordmark kaligrafi Top Spender. Font dilayani langsung oleh server aplikasi; lisensi SIL Open Font License disertakan di `fonts/GreatVibes-OFL.txt`. Sumber: https://github.com/google/fonts/tree/main/ofl/greatvibes

Berkshire Swash dari desain sebelumnya tetap disimpan sebagai font cadangan, beserta lisensinya di `fonts/OFL.txt`.

## Motion dan penyajian

Figur PNG digerakkan sebagai satu kesatuan: ayunan beruang melambai, pantulan lembut pada pose melompat, goyangan pose menari, gerak membungkuk saat pergantian juara, serta kilau di sekitar hadiah. Tiga bola SVG awal berayun perlahan dengan halo, pantulan yang menyapu permukaan, dan sembilan kilau kecil. Seluruh efek memakai CSS, tanpa loop JavaScript per frame. Gambar PNG tidak memiliki bagian tubuh yang dianimasikan terpisah.

`motion.js` mengunduh dan mendekode setiap figur PNG sekali per halaman, lalu menggunakan object URL yang sama pada semua salinan dan pembaruan peringkat. Kegagalan pemuatan dicoba lagi dengan jeda bertahap hingga satu menit; koneksi pulih juga memicu percobaan ulang. Placeholder dekoratif dipakai selama gambar belum siap, tanpa menyembunyikan nama atau poin. SVG yang digandakan memakai ID gradient/clip unik.

Latar di `christmas.css` berisi aurora, bokeh emas, pita cahaya lengkung, gugusan lampu membentuk pohon, jejak cahaya, sorot panggung, dan salju. Jumlah elemen tetap: 24 bokeh, 84 titik pohon dan 36 salju. Detail dikurangi pada HP. Tidak ada loop JavaScript per frame atau pembuatan partikel terus-menerus. Semua dekorasi berada di belakang panel data yang solid. Tinggi rumah dibatasi agar tidak tertutup panel peringkat. Rumah berada di kiri, beruang candy cane di tengah pada layar besar, dan beruang hadiah di kanan. Tablet menyembunyikan beruang tengah, sedangkan HP menyembunyikan kedua figur bawah agar rumah dapat tampil lebih besar dan utuh. Posisi bola diskalakan untuk setiap layar agar tidak terpotong secara horizontal.

M menjeda seluruh motion. Reduced motion menghentikan animasi dan menyembunyikan salju, bokeh, jejak cahaya serta kilau, termasuk kilau bola. Halo tetap berupa cahaya statis saat reduced motion aktif. Tab tersembunyi menjeda animasi dan membatalkan sequence/partikel sementara. R mengulang pembuka tanpa mengubah poin atau timer. Sequence pembuka 2,4 detik, kenaikan poin 1,4 detik, pergantian juara 3,4 detik.

## Aset versi sebelumnya

`joy-bear-factory.png`, `joy-plush-bear.png`, `joy-crystal-globe.png`, `joy-couture-gifts.png`, `joy-factory-parade.png`, `joy-robot.svg`, `joy-train.svg`, `joy-gift.svg`, `joy-bear.svg`, `joy-tree.svg`, `joy-snowglobe.svg`, dan `joy-moon.svg` dipertahankan sebagai berkas lama, tetapi tidak dimuat oleh halaman aktif. Robot vektor, bola salju vektor, dan kereta yang melintas sudah dihapus dari komposisi.

## Panggung besar dan motion baru

`presentation.css` mengatur ruang judul, panel poin, dan scenery sebagai elemen dalam alur halaman. Rumah berada dalam `.house-display` dengan rasio 2:1 dan ruang khusus di bawah peringkat; tampak sekitar 40–50% lebih besar daripada desain sebelumnya pada viewport utama. Pada signage 1280 × 720 dan 1920 × 1080, seluruh peringkat serta scenery tetap muat tanpa scroll. HP boleh menggulir daftar hingga scenery.

Judul memakai kaligrafi Great Vibes dengan gradasi emas bergerak, garis dekoratif SVG yang tergambar saat pembuka, dan empat kilau kecil. Gambar rumah tetap utuh; cahaya jendela, enam kepulan uap cerobong, dan empat titik cahaya ditambahkan sebagai lapisan CSS. Pembuka menggerakkan rumah masuk secara lembut; pergantian juara juga memberi respons pada kilau judul dan cahaya rumah. Tidak ada perubahan piksel pada PNG. Semua efek mengikuti M, tab tersembunyi, dan reduced motion; pengaturan jeda juga meliputi pseudo-element halo podium.

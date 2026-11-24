# Aset Joy Factory Through The Night

## Aset dari Bear.zip

Ketujuh PNG kiriman pengguna disalin langsung ke `assets/bears` tanpa crop, konversi, atau perubahan piksel. Nama disederhanakan untuk URL aplikasi. Manifest `bears/manifest.json` mencatat nama asal ZIP, dimensi, dan SHA-256 setiap file.

| File | Isi | Pemakaian |
| --- | --- | --- |
| `bears/bear-wave.png` | Beruang berdiri melambai | Podium pertama |
| `bears/bear-jump.png` | Beruang melompat | Podium kedua |
| `bears/bear-dance.png` | Beruang menari dengan satu kaki terangkat | Podium ketiga |
| `bears/bear-candy.png` | Beruang membawa candy cane | Sisi kiri pabrik |
| `bears/bear-gift.png` | Beruang duduk memegang hadiah | Sisi kanan pabrik |
| `bears/bear-cozy.png` | Beruang berbaring santai | Pendamping judul dan layar kosong |
| `bears/festive-ornaments.png` | Trio ornamen ruby/navy/ivory | Ornamen gantung di bagian atas |

Enam beruang berukuran 1254 × 1254 px; ornamen 1536 × 1024 px. Transparansi asli dipertahankan. Paket sekitar 14 MiB dimuat sekali per halaman; perubahan poin memakai gambar yang sudah dimuat.

## Aset pendukung aktif

- `joy-bear-factory.png`: panorama pabrik beruang, conveyor hadiah, pohon Natal, toy soldiers dan kereta; 2172 × 724 px, PNG transparan. Merupakan ilustrasi dari versi sebelumnya. Kereta di dalamnya adalah bagian statis panorama, bukan kereta yang melintasi layar.
- `joy-crown.svg`, `joy-sparkle.svg`: mahkota podium dan bintang dekoratif.
- `joy-clockwork.svg`, `joy-workshop.svg`: roda gigi serta arsitektur rumah/pabrik di belakang panel.

Panorama pendukung dibuat dengan generator gambar pada sesi sebelumnya dan SVG ditulis langsung. Beruang serta ornamen aktif memakai file Bear.zip pengguna. Tidak ada ketergantungan runtime pada layanan gambar/editor pihak ketiga.

## Font judul

`fonts/BerkshireSwash-Regular.ttf` adalah Berkshire Swash dari Google Fonts, dipakai pada judul Top Spender dan dilayani oleh server aplikasi. Lisensi SIL Open Font License disertakan di `fonts/OFL.txt`. Sumber: https://github.com/google/fonts/tree/main/ofl/berkshireswash

## Motion dan penyajian

Figur PNG digerakkan sebagai satu kesatuan: ayunan beruang melambai, pantulan lembut pada pose melompat, goyangan pose menari, gerak membungkuk saat pergantian juara, serta kilau di sekitar hadiah. Trio ornamen berayun perlahan. Gambar PNG tidak memiliki bagian tubuh yang dianimasikan terpisah.

`motion.js` mengunduh dan mendekode setiap figur PNG sekali per halaman, lalu menggunakan object URL yang sama pada semua salinan dan pembaruan peringkat. Kegagalan pemuatan dicoba lagi dengan jeda bertahap hingga satu menit; koneksi pulih juga memicu percobaan ulang. Placeholder dekoratif dipakai selama gambar belum siap, tanpa menyembunyikan nama atau poin. SVG yang digandakan memakai ID gradient/clip unik.

Latar di `christmas.css` berisi aurora, bokeh emas, pita cahaya lengkung, gugusan lampu membentuk pohon, jejak cahaya, sorot panggung, dan salju. Jumlah elemen tetap: 24 bokeh, 84 titik pohon dan 36 salju. Detail dikurangi pada HP. Tidak ada loop JavaScript per frame atau pembuatan partikel terus-menerus. Semua dekorasi berada di belakang panel data yang solid. Tinggi panorama dibatasi agar tidak tertutup panel peringkat. Figur samping disembunyikan pada HP/tablet agar tidak bertumpuk dengan panorama.

M menjeda seluruh motion. Reduced motion menghentikan animasi dan menyembunyikan salju, bokeh, jejak cahaya serta kilau. Tab tersembunyi menjeda animasi dan membatalkan sequence/partikel sementara. R mengulang pembuka tanpa mengubah poin atau timer. Sequence pembuka 2,4 detik, kenaikan poin 1,4 detik, pergantian juara 3,4 detik.

## Aset versi sebelumnya

`joy-plush-bear.png`, `joy-crystal-globe.png`, `joy-couture-gifts.png`, `joy-bauble.svg`, `joy-factory-parade.png`, `joy-robot.svg`, `joy-train.svg`, `joy-gift.svg`, `joy-bear.svg`, `joy-tree.svg`, `joy-snowglobe.svg`, dan `joy-moon.svg` dipertahankan sebagai berkas lama, tetapi tidak dimuat oleh halaman aktif. Robot vektor, bola salju vektor, dan kereta yang melintas sudah dihapus dari komposisi.

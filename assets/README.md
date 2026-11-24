# Aset Joy Factory Through The Night

## Aset yang tampil

- `joy-plush-bear.png`: beruang Santa plush dengan rompi navy, pita ruby, dan hadiah emas; 1312 × 1199 px, PNG transparan sekitar 2,4 MiB. Menggantikan maskot vektor di podium pertama dan robot di sisi pabrik.
- `joy-crystal-globe.png`: bola kaca berisi beruang dan pohon emas, alas navy/emas serta pita velvet; 1254 × 1254 px, PNG transparan sekitar 1,9 MiB. Dipakai pada podium kedua dan sisi kanan pabrik.
- `joy-couture-gifts.png`: kado velvet/navy, ivory dan emas dengan mainan kuda goyang; 1312 × 1199 px, PNG transparan sekitar 1,9 MiB. Dipakai pada podium ketiga dan keadaan belum ada poin.
- `joy-bear-factory.png`: panorama pabrik beruang, conveyor hadiah, pohon Natal, toy soldiers dan kereta; 2172 × 724 px, PNG transparan. Kereta di dalam ilustrasi ini merupakan bagian statis panorama. Tidak ada kereta yang bergerak melintasi layar.
- `joy-crown.svg`, `joy-sparkle.svg`: mahkota podium dan bintang dekoratif.
- `joy-bauble.svg`, `joy-clockwork.svg`, `joy-workshop.svg`: ornamen gantung, roda gigi serta arsitektur latar yang samar.

PNG dibuat dengan generator gambar yang tersedia pada sesi ini. File asli disimpan di `/workspace/generated_images` dan disalin tanpa crop atau perubahan piksel. SVG ditulis langsung. Tidak ada integrasi runtime dengan layanan gambar atau editor desain pihak ketiga.

## Font judul

`fonts/BerkshireSwash-Regular.ttf` adalah Berkshire Swash dari Google Fonts, dipakai pada judul Top Spender dan dilayani oleh server aplikasi. Lisensi SIL Open Font License disertakan di `fonts/OFL.txt`. Sumber: https://github.com/google/fonts/tree/main/ofl/berkshireswash

## Motion dan penyajian

Ketiga figur PNG memakai bahan plush, velvet, kaca dan emas yang serasi dengan panorama pabrik. Figur digerakkan sebagai satu kesatuan dengan ayunan kecil, gerak membungkuk saat pergantian juara, halo di bawahnya, dan kilau bola kaca. Gambar PNG tidak memiliki bagian tubuh yang dianimasikan terpisah.

`motion.js` mengunduh dan mendekode setiap figur PNG sekali per halaman, lalu menggunakan object URL yang sama pada semua salinan dan pembaruan peringkat. Kegagalan pemuatan dicoba lagi dengan jeda bertahap hingga satu menit; koneksi pulih juga memicu percobaan ulang. Placeholder dekoratif dipakai selama gambar belum siap, tanpa menyembunyikan nama atau poin. SVG yang digandakan memakai ID gradient/clip unik.

Latar di `christmas.css` berisi aurora, bokeh emas, pita cahaya lengkung, gugusan lampu membentuk pohon, jejak cahaya, sorot panggung, dan salju. Jumlah elemen tetap: 24 bokeh, 84 titik pohon dan 36 salju. Detail dikurangi pada HP. Tidak ada loop JavaScript per frame atau pembuatan partikel terus-menerus. Semua dekorasi berada di belakang panel data yang solid. Tinggi panorama dibatasi agar tidak tertutup panel peringkat. Figur samping disembunyikan pada HP/tablet agar tidak bertumpuk dengan panorama.

M menjeda seluruh motion. Reduced motion menghentikan animasi dan menyembunyikan salju, bokeh, jejak cahaya serta kilau. Tab tersembunyi menjeda animasi dan membatalkan sequence/partikel sementara. R mengulang pembuka tanpa mengubah poin atau timer. Sequence pembuka 2,4 detik, kenaikan poin 1,4 detik, pergantian juara 3,4 detik.

## Aset versi sebelumnya

`joy-factory-parade.png`, `joy-robot.svg`, `joy-train.svg`, `joy-gift.svg`, `joy-bear.svg`, `joy-tree.svg`, `joy-snowglobe.svg`, dan `joy-moon.svg` dipertahankan sebagai berkas lama, tetapi tidak dimuat oleh halaman aktif. Robot vektor, bola salju vektor, dan kereta yang melintas sudah dihapus dari komposisi.

# Aset Joy Factory Through The Night

- `joy-bear-factory.png`: ilustrasi baru pabrik beruang Natal mewah, 2172 × 724 px, PNG transparan sekitar 2,2 MB. Beruang plush, workshop navy/emas, conveyor hadiah, pohon Natal, toy soldiers, dan kereta ruby. Dibuat dengan generator gambar sesi ini; disalin dari file asli tanpa perubahan piksel. Menjadi ilustrasi footer aktif; dimuat satu kali dari server aplikasi.
- `joy-bear.svg`: maskot podium beruang dengan topi Santa, rompi navy, bulu bergradasi, tangan melambai, mata berkedip, dan kepala bergerak.
- `joy-tree.svg`: pohon zamrud dengan ornamen ruby/emas, dua rangkaian lampu bergantian, bintang bercahaya, serta hadiah.
- `joy-bauble.svg`: ornamen gantung dengan pernis ruby, pita emas, dan pantulan cahaya bergerak.
- `joy-snowglobe.svg`: bola salju kaca dengan anak beruang bergoyang dan salju di dalamnya.
- `joy-clockwork.svg`: roda gigi kuningan dua belas gigi untuk mesin pabrik di latar.
- `joy-workshop.svg`: panorama arsitektur pabrik dengan 18 jendela bercahaya dan uap cerobong.
- `joy-factory-parade.png`: ilustrasi pabrik mainan versi sebelumnya, 2172 × 724 px, PNG transparan, sekitar 900 KB. File dipertahankan sebagai aset lama; halaman aktif memakai `joy-bear-factory.png`.
- `joy-crown.svg`: mahkota vektor emas dengan aksen merah dan mint untuk pemimpin leaderboard.
- `joy-sparkle.svg`: bintang empat sudut untuk dekorasi latar yang ringan.
- `joy-robot.svg`: robot orisinal dengan grup tangan, mata, antena, dan mekanisme dada yang dapat dianimasikan terpisah.
- `joy-train.svg`: kereta orisinal dengan empat grup roda, batang penghubung, dan dua kepulan uap. Dipakai pada podium dan jalur pengiriman di bawah layar.
- `joy-gift.svg`: hadiah orisinal dengan tutup/pita bergerak dan bintang berpendar.
- `joy-moon.svg`: bulan dan bintang untuk latar malam.

Higgsfield dan Figma tidak tersedia sebagai tool pada sesi ini. Ilustrasi dibuat dengan alat gambar yang tersedia, SVG ditulis langsung, dan motion dibuat dengan CSS/JavaScript aplikasi. Format sumber yang disediakan adalah PNG dan SVG. SVG dapat diimpor ke Figma untuk penyuntingan manual.

`motion.js` memuat SVG mainan dan latar sebagai elemen inline agar animasi bagian aset mengikuti kontrol halaman. ID gradient dan clip diberi awalan unik untuk setiap salinan agar dua pohon/ornamen tidak saling mengubah warna atau pemotongan. Bila pemuatan SVG gagal, gambar statis tetap ditampilkan dan pemuatan dicoba lagi saat koneksi pulih. Sumber hanya dari server aplikasi sendiri.

Motion memakai CSS: robot melambaikan tangan dan berkedip, roda kereta berputar dengan uap, serta tutup hadiah terbuka. Sequence pembuka berlangsung 2,4 detik, kenaikan poin 1,4 detik, dan pergantian juara 3,4 detik. Pintasan R atau tombol operator memutar ulang pembuka. Poin terbaru selalu langsung tampil selama sequence berjalan.

Pergerakan lampu, bintang, mahkota, avatar, dan ilustrasi footer mengikuti tombol jeda/pintasan M serta prefers-reduced-motion. Tab tersembunyi menjeda motion dan membatalkan sequence/partikel sementara. Partikel perayaan hanya menanggapi perubahan data nyata dan dibersihkan otomatis. Pembatasan pointer-events dan lapisan di belakang panel menjaga keterbacaan serta interaksi.

Latar mewah diatur di `christmas.css`: tirai ruby, bingkai lengkung emas, aurora, ornamen berayun, pohon berkelip, roda gigi, jendela pabrik, jejak cahaya, dan salju. Salju memakai 36 elemen tetap; layar HP menampilkan 18. Tidak ada pembuatan partikel terus-menerus atau loop JavaScript per frame. Reduced motion menghilangkan salju/jejak cahaya dan menghentikan semua animasi. Panel nama, kode member, dan poin tetap solid di atas dekorasi.

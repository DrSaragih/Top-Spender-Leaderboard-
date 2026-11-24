# Aset Joy Factory Through The Night

- `joy-factory-parade.png`: ilustrasi orisinal pabrik mainan malam, 2172 × 724 px, PNG transparan, sekitar 900 KB. Dibuat dengan generator gambar yang tersedia dalam sesi; file asli disalin tanpa crop atau perubahan piksel. Dipakai sebagai dekorasi footer, bukan latar teks/angka.
- `joy-crown.svg`: mahkota vektor emas dengan aksen merah dan mint untuk pemimpin leaderboard.
- `joy-sparkle.svg`: bintang empat sudut untuk dekorasi latar yang ringan.
- `joy-robot.svg`: robot orisinal dengan grup tangan, mata, antena, dan mekanisme dada yang dapat dianimasikan terpisah.
- `joy-train.svg`: kereta orisinal dengan empat grup roda, batang penghubung, dan dua kepulan uap. Dipakai pada podium dan jalur pengiriman di bawah layar.
- `joy-gift.svg`: hadiah orisinal dengan tutup/pita bergerak dan bintang berpendar.
- `joy-moon.svg`: bulan dan bintang untuk latar malam.

Higgsfield dan Figma tidak tersedia sebagai tool pada sesi ini. Ilustrasi dibuat dengan alat gambar yang tersedia, SVG ditulis langsung, dan motion dibuat dengan CSS/JavaScript aplikasi. Format sumber yang disediakan adalah PNG dan SVG. SVG dapat diimpor ke Figma untuk penyuntingan manual.

`motion.js` memuat tiga SVG mainan sebagai elemen inline agar animasi bagian aset mengikuti kontrol halaman. Bila pemuatan SVG gagal, gambar statis tetap ditampilkan dan pemuatan dicoba lagi saat koneksi pulih. Sumber hanya dari server aplikasi sendiri.

Motion memakai CSS: robot melambaikan tangan dan berkedip, roda kereta berputar dengan uap, serta tutup hadiah terbuka. Sequence pembuka berlangsung 2,4 detik, kenaikan poin 1,4 detik, dan pergantian juara 3,4 detik. Pintasan R atau tombol operator memutar ulang pembuka. Poin terbaru selalu langsung tampil selama sequence berjalan.

Pergerakan lampu, bintang, mahkota, avatar, dan ilustrasi footer mengikuti tombol jeda/pintasan M serta prefers-reduced-motion. Tab tersembunyi menjeda motion dan membatalkan sequence/partikel sementara. Partikel perayaan hanya menanggapi perubahan data nyata dan dibersihkan otomatis. Pembatasan pointer-events dan lapisan di belakang panel menjaga keterbacaan serta interaksi.

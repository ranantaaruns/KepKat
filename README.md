# Kepkat

Kepkat adalah editor video ringan yang berjalan sepenuhnya di browser. Potong klip, susun beberapa track, beri filter dan transisi, atur warna, tambahkan teks dan animasi, lalu ekspor hasilnya tanpa mengunggah media ke server.

Semua proses editing dan rendering terjadi di perangkat pengguna. Proyek dan media disimpan secara lokal di IndexedDB, sehingga tidak memerlukan akun, backend, atau koneksi cloud.

## Fitur

- Impor video, gambar, dan audio langsung dari perangkat.
- Timeline multi-track dengan trim, split, duplicate, snapping, zoom, dan pengaturan urutan klip.
- Filter, transisi, color grading, dan chroma key berbasis warna.
- Teks dengan gaya, font, animasi, serta keyframe untuk properti transformasi.
- Pengaturan kecepatan klip, volume audio, mute, dan fade in/out.
- Pratinjau real-time menggunakan WebGL2.
- Ekspor WebM secara real-time dan MP4 melalui ffmpeg.wasm.
- Penyimpanan proyek otomatis di browser.
- Antarmuka responsif untuk desktop dan layar kecil.

## Teknologi

- React 19 dan TypeScript
- Vite
- Zustand dan Immer
- IndexedDB melalui `idb`
- WebGL2 untuk compositing dan efek visual
- Web Audio API untuk pencampuran audio
- MediaRecorder dan ffmpeg.wasm untuk ekspor
- Radix UI untuk komponen antarmuka

## Menjalankan secara lokal

Disarankan menggunakan Node.js 24.

```bash
npm install
npm run dev
```

Buka alamat yang ditampilkan Vite, biasanya `http://localhost:5173`.

Perintah lain:

```bash
npm run lint      # memeriksa kualitas kode
npm run build     # membuat build production ke folder dist
npm run preview   # menjalankan hasil build secara lokal
```

## Deploy

Kepkat adalah aplikasi static dan dapat dideploy ke Vercel atau hosting static lainnya.

Pengaturan Vercel:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Tidak diperlukan environment variable maupun backend.

## Catatan

- Ekspor MP4 memakai ffmpeg.wasm. Unduhan pertama memuat core sekitar 32 MB, sehingga prosesnya bisa lebih lama daripada durasi video.
- Ekspor WebM berjalan real-time; biarkan tab tetap aktif selama proses ekspor.
- Browser perlu mendukung WebGL2 dan MediaRecorder.
- Media dan proyek tidak diunggah ke mana pun. Menghapus data situs di browser juga akan menghapus proyek yang tersimpan.

# MOTION SMART CLASS 🧠🕺
> **“Berpikir dengan Otak. Menjawab dengan Gerak!”**

Aplikasi web edukatif interaktif literasi dan numerasi siswa SD menggunakan deteksi kamera dan gerakan tubuh real-time. Dirancang khusus untuk **Interactive Digital Board (PID)**, tablet Android, laptop, dan PC dengan webcam.

---

## 🚀 Fitur Utama

### 1. Sistem Deteksi Gerakan Tubuh (Gesture Engine)
- **Gesture A (Pilihan A):** Tangan kiri diangkat di atas bahu
- **Gesture B (Pilihan B):** Tangan kanan diangkat di atas bahu
- **Gesture C (Pilihan C):** Kedua tangan diangkat di atas bahu
- **Gesture D (Pilihan D):** Posisi jongkok (squat)
- **Gesture SKIP:** Kedua tangan direntangkan ke samping secara horizontal
- **Gesture READY:** Berdiri tegak di tengah area kamera
- **Gesture BONUS:** Kedua tangan diangkat tinggi di atas kepala
- **Visual Feedback:** Tampilan status deteksi gerakan real-time, lingkaran meter konfirmasi tahan gerakan (*hold confirmation meter*), dan jeda *cooldown* untuk mencegah pemicu ganda.

### 2. Kalibrasi Kamera (Camera Check)
Sebelum permainan dimulai, siswa dipandu melalui proses kalibrasi visual:
- ✓ Kepala terdeteksi
- ✓ Bahu terdeteksi
- ✓ Tangan terdeteksi
- ✓ Tubuh terdeteksi
- ✓ Posisi ideal (area berdiri tengah)

### 3. 6 Mode Permainan
1. **Numerasi & Quick Quiz:** Soal pilihan ganda berhitung cepat dengan batas waktu (30–60 detik).
2. **Literasi (Detektif Membaca):** Soal berbasis teks cerita dengan petunjuk investigasi (*Clue Found*).
3. **Benar atau Salah (True/False):** 🙆 Angkat tangan untuk Benar, 🙅 Silang tangan/jongkok untuk Salah.
4. **Duel Tim:** Pertarungan 1-on-1 antar tim kelas (Tim Merah vs Tim Biru). Jawaban benar & tercepat mendapatkan bonus poin.
5. **Boss Challenge:** Lawan *Raja Angka Raksasa* dengan bar HP! Jawaban benar menghasilkan serangan damage langsung.
6. **Motion Challenge:** Tantangan variasi gerakan dinamis.

### 4. Papan Skor Kelas (Team Mode)
- Mendukung 4 Tim: 🔴 Tim Merah, 🔵 Tim Biru, 🟢 Tim Hijau, 🟡 Tim Kuning.
- Papan skor real-time terpampang di beranda dan dapat disesuaikan oleh guru.

### 5. Mode Guru (Teacher Mode)
- Login menyediakan pilihan peran **Siswa** atau **Guru** dan menggunakan Google Sign-In. Pilihan peran hanya dipakai ketika profil pertama dibuat.
- Riwayat bermain disimpan berdasarkan UID Firebase sehingga tetap tersedia saat pengguna masuk kembali.
- Pengguna tetap dapat bermain sebagai tamu anonim. Statistik, progres, dan riwayat tamu hanya disimpan di `sessionStorage` selama sesi tab aktif dan tidak dikirim ke koleksi riwayat Firestore.
- Siswa dan guru dapat mengirim soal ke antrean review. Hanya profil `super_admin` atau `owner` yang dapat menyetujui dan menerbitkannya.
- **Pengaturan Waktu & Sensitivitas:** Mengatur durasi per soal, kepekaan *confidence threshold*, durasi *hold/cooldown*, dan waktu bersiap gerakan 3–10 detik (default 5 detik).
- **Question Editor (Pembuat Soal):** Form interaktif untuk menambah soal baru, termasuk gambar pendukung dari link HTTPS dan deskripsi gambar.
- **Ekspor Data:** Fitur ekspor bank soal tambahan ke format JSON; `imageUrl` dan `imageAlt` ikut tersimpan agar gambar muncul kembali saat file diimpor.
- **Paket Sesi:** Guru dapat menyimpan mode, kelas, kategori, kesulitan, dan jumlah soal sebagai template sekali klik.
- **Impor/ekspor spreadsheet:** Mendukung pembuatan dan pemindahan bank soal melalui CSV, Excel 97–2003 (`.xls`), dan Excel modern (`.xlsx`).
- **Pustaka Media:** Gambar dari bank soal terkumpul otomatis dan dapat digunakan kembali.
- **Mode Presentasi Guru:** Paket sesi dapat dijalankan dalam mode sentuh tanpa kamera.
- **Randomisasi Aman:** Pilihan jawaban dapat diacak tanpa mengubah kunci jawaban yang benar.
- **Manajemen Skor Tim:** Atur nama dan skor awal tim kelas.

### 6. Fallback Mode (Touch Mode) & Privasi
- **Privasi Terjamin:** Video kamera diproses 100% secara lokal di browser via MediaPipe/Canvas. Tidak ada wajah, foto, atau video yang disimpan maupun diunggah.
- **Touch Mode Fallback:** Jika perangkat tidak memiliki kamera atau izin ditolak, siswa tetap dapat bermain secara lancar dengan menekan kartu pilihan di layar sentuh / mouse.
- **Aksesibilitas:** Tersedia teks besar, kontras tinggi, pengurangan animasi, dan profil gerakan tangan tanpa jongkok.

### 7. Latihan Gerak & Misi Kooperatif
- **Latihan Gerak:** Siswa dapat menguji empat gerakan sampai seluruhnya terdeteksi sebelum bermain.
- **Misi Satu Kelas:** Kelas mengejar target jawaban benar bersama tanpa peringkat individu.
- **Laporan Topik:** Analitik menampilkan akurasi dan status penguasaan untuk semua topik, bukan hanya materi yang lemah.

---

## 🛠️ Arsitektur Kode Modular

Proyek dirancang dengan arsitektur bersih dan modular:
```
motion-smart-class/
├── index.html                  # Entry HTML + Google Fonts (Outfit & Inter)
├── package.json                # Dependensi Vite & canvas-confetti
├── vite.config.js
├── src/
│   ├── main.js                 # Orchestrator aplikasi utama
│   ├── style.css               # Desain modern game show, responsive & PID
│   ├── data/
│   │   └── defaultQuestions.js # Bank soal 50+ Numerasi & Literasi SD Kelas 1-6
│   └── engine/
│       ├── AudioManager.js     # Web Audio API Synthesizer (100% offline)
│       ├── StorageManager.js   # LocalStorage untuk soal guru, pengaturan & tim
│       ├── QuestionEngine.js   # Pemfilteran & pengacakan soal kurikulum SD
│       ├── ScoreEngine.js      # Perhitungan skor, combo x2–x5, streak & badges
│       ├── CameraManager.js    # Akses Web Camera API, status pill, flip kamera
│       ├── PoseDetector.js     # MediaPipe Pose & overlay rangka sendi tubuh
│       ├── GestureEngine.js    # Klasifikasi postur tubuh, debouncing & hold meter
│       ├── GameEngine.js       # State machine permainan & countdown
│       ├── MultiplayerEngine.js# Cloud Firestore & BroadcastChannel Realtime Rooms
│       └── UIManager.js        # Antarmuka layar, login Google, Studio, podium & konfeti
```

### 8. Multiplayer Online Real-Time (Game Show Kelas) 🌐
- **Host Screen (Papan Interaktif / PID Guru):**
  - Guru membuka Room dengan kode PIN 6 karakter acak (misal: `MSC-8492`).
  - Menampilkan soal berukuran besar di depan kelas, status respons siswa live, dan grafik sebaran jawaban.
- **Player Screen (HP / Tablet Siswa):**
  - Peserta bergabung dengan PIN, memilih identitas siswa atau kelompok, mengisi nama sendiri, dan memilih avatar.
  - Nama serta hasil masuk ke laporan room milik guru, sementara perangkat peserta hanya memakai cache sesi yang dihapus saat keluar dari room.
  - Kamera di perangkat masing-masing mendeteksi pose jawaban siswa secara lokal tanpa mengirim video ke internet (100% aman privasi).
- **Dual Real-time Sync:**
  - Terhubung via Cloud Firestore `onSnapshot` untuk multiplayer antar perangkat di seluruh internet.
  - Dilengkapi jembatan `BroadcastChannel` untuk pengujian multi-tab tanpa jeda di perangkat yang sama.
- **Live Leaderboard & Podium Juara:** Papan skor otomatis terupdate setiap ronde dan selebrasi podium juara 1, 2, 3 dengan hujan konfeti!

---

## 💻 Cara Menjalankan

Gunakan Node.js 22 atau versi LTS yang kompatibel.

### 1. Jalankan Dev Server
```bash
cd motion-smart-class
npm run dev
```
Buka browser di: `http://localhost:5173/`

### 2. Build untuk Produksi
```bash
npm run build
npm run preview
```

### 3. Test dan pemeriksaan produksi

```bash
npm ci
npm run check
```

## 🔐 Konfigurasi Firebase yang aman

1. Aktifkan provider **Google** dan **Anonymous** di Firebase Authentication.
2. Tambahkan domain produksi ke daftar **Authorized domains** Firebase Authentication.
3. Isi seluruh konfigurasi Web App pada environment deployment: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, dan `VITE_FIREBASE_APP_ID`. `.env.example` hanya contoh dan tidak otomatis dipakai saat build.
4. Deploy `firestore.rules` dari repository ini.
5. Login sekali dengan akun pemilik, lalu ubah field `role` pada `users/{uid}` menjadi `owner` atau `super_admin` melalui Firebase Console/Admin SDK. Client hanya dapat membuat role awal `student` atau `teacher` dan tidak dapat menaikkan hak akses sendiri.
6. Aktifkan Firebase App Check untuk deployment produksi.

Koleksi utama:

- `users`: profil dan role akun.
- `game_sessions`: riwayat bermain milik UID pengguna.
- `question_submissions`: antrean kontribusi dengan status `pending`, `approved`, atau `rejected`.
- `questions`: hanya berisi soal yang sudah diterbitkan admin.

Perangkat yang belum login Google tetap memakai Firebase Anonymous untuk bermain/multiplayer. Dokumen room yang dapat dibaca siswa tidak membawa kunci jawaban; kunci disimpan terpisah di `msc_room_secrets` dan hanya dapat dibaca guru/admin.

> Jangan gunakan rules lama yang mengizinkan `allow read, write: if true`. Deploy rules terbaru sebelum mengaktifkan kontribusi soal.

## 🖼️ Format gambar pada soal ekspor/impor

Gunakan URL HTTPS publik yang langsung mengarah ke file gambar. Pastikan guru memiliki izin penggunaan gambarnya dan isi `imageAlt` agar materi tetap mudah dipahami siswa yang memakai pembaca layar.

```json
[
  {
    "question": "Perhatikan diagram. Pecahan berapa yang diarsir?",
    "options": ["1/4", "1/2", "3/4", "1"],
    "correctAnswer": 1,
    "imageUrl": "https://contoh.sch.id/media/diagram-pecahan.png",
    "imageAlt": "Lingkaran dengan setengah bagian berwarna biru"
  }
]
```

Untuk impor CSV, gunakan tombol **Template CSV**. Kolom yang didukung:

```text
question,optionA,optionB,optionC,optionD,correctAnswer,category,grade,difficulty,topic,imageUrl,imageAlt,explanation
```

## 📗 Impor dan ekspor Excel

Teacher Studio menyediakan tombol **Impor Excel**, **Ekspor XLSX**, dan **Ekspor XLS**. Aplikasi membaca worksheet bernama `Soal`; jika nama tersebut tidak tersedia, worksheet pertama akan digunakan. Header tidak peka huruf besar/kecil dan urutan kolom boleh berubah.

Workbook hasil ekspor memuat pertanyaan, empat pilihan, kunci jawaban A–D, kategori, kelas, kesulitan, topik, bacaan, gambar, waktu, bobot skor, dan pembahasan. Batas impor adalah 10 MB dan 5.000 baris soal per workbook.

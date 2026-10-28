/**
 * Bank soal khusus mode permainan.
 * Soal pada file ini diprioritaskan ketika mode yang sesuai dimainkan.
 */

const DEFAULT_GESTURES = Object.freeze({
  A: "LEFT_HAND",
  B: "RIGHT_HAND",
  C: "BOTH_HANDS",
  D: "SQUAT"
});

export const QUESTION_GAME_MODES = Object.freeze([
  "detective",
  "motion_challenge",
  "arena",
  "duel",
  "team_battle",
  "cooperative",
  "adventure"
]);

function buildBank(gameModes, defaults, questions) {
  return questions.map((question) => ({
    ...defaults,
    ...question,
    gameModes: [...gameModes],
    gestureMap: { ...DEFAULT_GESTURES },
    timeLimit: question.timeLimit || defaults.timeLimit || 40,
    pointWeight: question.pointWeight || defaults.pointWeight || 100
  }));
}

const DETECTIVE_QUESTIONS = buildBank(["detective"], {
  category: "literasi",
  difficulty: "medium",
  timeLimit: 55,
  pointWeight: 120
}, [
  {
    id: "mode-det-1", grade: 3, topic: "Detektif Bacaan - Bukti Waktu",
    passage: "Pukul 07.00 Raka melihat pintu perpustakaan masih terkunci. Lima belas menit kemudian Bu Sari datang membawa kunci, lalu membuka pintu untuk para siswa.",
    question: "Siapa yang membuka pintu perpustakaan?",
    options: ["Raka", "Bu Sari", "Para siswa", "Penjaga kantin"], correctAnswer: 1,
    explanation: "Bukti pada teks menyatakan Bu Sari datang membawa kunci dan membuka pintu."
  },
  {
    id: "mode-det-2", grade: 4, topic: "Detektif Bacaan - Jejak Benda",
    passage: "Di meja kelas ada bekas serutan pensil berwarna biru. Pensil biru milik Lani baru saja diraut, sedangkan pensil teman-temannya masih panjang dan belum digunakan.",
    question: "Bukti paling kuat bahwa Lani baru meraut pensil adalah...",
    options: ["Meja kelas berwarna biru", "Pensil Lani baru diraut", "Semua siswa membawa penghapus", "Bel sekolah sudah berbunyi"], correctAnswer: 1,
    explanation: "Kondisi pensil Lani sesuai dengan serutan yang ditemukan di meja."
  },
  {
    id: "mode-det-3", grade: 4, topic: "Detektif Bacaan - Sebab Akibat",
    passage: "Tanaman kelas tampak layu pada Senin pagi. Catatan piket menunjukkan jendela tertutup selama akhir pekan dan tidak ada siswa yang menyiram tanaman sejak Jumat.",
    question: "Penyebab paling masuk akal tanaman menjadi layu adalah...",
    options: ["Potnya terlalu berwarna", "Tidak disiram selama akhir pekan", "Diletakkan dekat papan tulis", "Daunnya berjumlah banyak"], correctAnswer: 1,
    explanation: "Catatan piket menunjukkan tanaman tidak menerima air sejak Jumat."
  },
  {
    id: "mode-det-4", grade: 5, topic: "Detektif Bacaan - Simpulan",
    passage: "Kotak alat olahraga ditemukan kembali di gudang. Lantai menuju gudang basah oleh jejak sepatu, dan hujan turun saat regu basket selesai berlatih di lapangan.",
    question: "Simpulan yang paling didukung bukti adalah...",
    options: ["Kotak dibawa saat cuaca cerah", "Regu basket kemungkinan menyimpan kotak", "Gudang tidak pernah dibuka", "Jejak berasal dari hewan"], correctAnswer: 1,
    explanation: "Waktu latihan, hujan, dan jejak sepatu basah mengarah pada regu basket."
  },
  {
    id: "mode-det-5", grade: 5, topic: "Detektif Bacaan - Makna Kata",
    passage: "Nisa memeriksa setiap rak dengan teliti. Ia tidak terburu-buru karena ingin memastikan buku ensiklopedia yang hilang benar-benar tidak terselip.",
    question: "Makna kata 'teliti' pada bacaan adalah...",
    options: ["Dengan cermat", "Dengan keras", "Dengan cepat", "Dengan ragu"], correctAnswer: 0,
    explanation: "Teliti berarti memeriksa dengan cermat dan hati-hati."
  },
  {
    id: "mode-det-6", grade: 6, topic: "Detektif Bacaan - Fakta dan Opini",
    passage: "Pameran sains dibuka pukul 09.00 dan diikuti 24 kelompok. Menurut Dito, robot penyiram tanaman adalah karya paling menarik di pameran itu.",
    question: "Kalimat yang merupakan opini adalah...",
    options: ["Pameran dibuka pukul 09.00", "Pameran diikuti 24 kelompok", "Robot penyiram paling menarik", "Ada pameran sains"], correctAnswer: 2,
    explanation: "Penilaian 'paling menarik' merupakan pendapat Dito."
  },
  {
    id: "mode-det-7", grade: 6, topic: "Detektif Bacaan - Urutan Peristiwa",
    passage: "Mira menemukan kartu perpustakaan di halaman. Ia membaca nama pemiliknya, melapor kepada guru piket, lalu menyerahkan kartu itu kepada pemilik saat jam istirahat.",
    question: "Apa yang dilakukan Mira setelah membaca nama pemilik kartu?",
    options: ["Pulang ke rumah", "Melapor kepada guru piket", "Membuang kartu", "Meminjam buku"], correctAnswer: 1,
    explanation: "Urutan teks menunjukkan Mira melapor kepada guru piket setelah membaca nama."
  },
  {
    id: "mode-det-8", grade: 5, topic: "Detektif Bacaan - Informasi Tersirat",
    passage: "Arman masuk kelas sambil mengibaskan payung dan menggulung ujung celananya yang basah. Di luar, langit tampak gelap dan suara air terdengar dari atap.",
    question: "Peristiwa yang kemungkinan sedang terjadi adalah...",
    options: ["Kemarau panjang", "Hujan deras", "Listrik padam", "Upacara bendera"], correctAnswer: 1,
    explanation: "Payung, pakaian basah, langit gelap, dan suara air merupakan petunjuk hujan."
  }
]);

const MOTION_CHALLENGE_QUESTIONS = buildBank(["motion_challenge"], {
  timeLimit: 25,
  pointWeight: 110
}, [
  { id: "mode-motion-1", category: "numerasi", topic: "Hitung Cepat", grade: 2, difficulty: "easy", question: "Berapa hasil 9 + 8?", options: ["15", "16", "17", "18"], correctAnswer: 2, explanation: "9 + 8 = 17." },
  { id: "mode-motion-2", category: "literasi", topic: "Kosakata Cepat", grade: 3, difficulty: "easy", question: "Lawan kata 'tinggi' adalah...", options: ["Besar", "Rendah", "Panjang", "Jauh"], correctAnswer: 1, explanation: "Antonim tinggi adalah rendah." },
  { id: "mode-motion-3", category: "numerasi", topic: "Pola Gerak", grade: 3, difficulty: "easy", question: "Lanjutkan pola 2, 4, 6, 8, ...", options: ["9", "10", "11", "12"], correctAnswer: 1, explanation: "Pola bertambah 2 sehingga berikutnya 10." },
  { id: "mode-motion-4", category: "literasi", topic: "Kata Baku", grade: 4, difficulty: "medium", question: "Penulisan kata baku yang tepat adalah...", options: ["Aktip", "Aktif", "Aktiv", "Aktef"], correctAnswer: 1, explanation: "Bentuk bakunya adalah aktif." },
  { id: "mode-motion-5", category: "numerasi", topic: "Pecahan Cepat", grade: 4, difficulty: "medium", question: "Setengah dari 18 adalah...", options: ["6", "8", "9", "12"], correctAnswer: 2, explanation: "18 ÷ 2 = 9." },
  { id: "mode-motion-6", category: "literasi", topic: "Kalimat Tanya", grade: 3, difficulty: "easy", question: "Kata tanya untuk menanyakan tempat adalah...", options: ["Siapa", "Kapan", "Di mana", "Mengapa"], correctAnswer: 2, explanation: "'Di mana' digunakan untuk menanyakan tempat." },
  { id: "mode-motion-7", category: "numerasi", topic: "Perkalian Cepat", grade: 5, difficulty: "medium", question: "Berapa 12 × 6?", options: ["62", "68", "72", "76"], correctAnswer: 2, explanation: "12 × 6 = 72." },
  { id: "mode-motion-8", category: "literasi", topic: "Sinonim Cepat", grade: 5, difficulty: "medium", question: "Sinonim kata 'cermat' adalah...", options: ["Teliti", "Lalai", "Bising", "Lambat"], correctAnswer: 0, explanation: "Cermat bersinonim dengan teliti." }
]);

const ARENA_QUESTIONS = buildBank(["arena"], {
  category: "numerasi",
  grade: 4,
  difficulty: "medium",
  timeLimit: 35,
  pointWeight: 130
}, [
  { id: "mode-arena-1", topic: "Arah dan Posisi", question: "Jika menghadap utara lalu berputar ke kanan, kamu menghadap...", options: ["Barat", "Timur", "Selatan", "Utara"], correctAnswer: 1, explanation: "Di sebelah kanan arah utara adalah timur." },
  { id: "mode-arena-2", topic: "Koordinat Sederhana", question: "Dari titik awal, bergerak 3 langkah ke kanan dan 2 langkah ke atas. Arah akhir dari titik awal adalah...", options: ["Kiri bawah", "Kanan atas", "Kiri atas", "Kanan bawah"], correctAnswer: 1, explanation: "Gerak ke kanan lalu ke atas menempatkan posisi di kanan atas." },
  { id: "mode-arena-3", topic: "Bangun Datar", question: "Bangun yang memiliki 4 sisi sama panjang dan 4 sudut siku-siku adalah...", options: ["Segitiga", "Persegi", "Lingkaran", "Trapesium"], correctAnswer: 1, explanation: "Persegi memiliki empat sisi sama panjang dan empat sudut siku-siku." },
  { id: "mode-arena-4", topic: "Simetri", question: "Berapa banyak simetri lipat pada persegi?", options: ["1", "2", "4", "8"], correctAnswer: 2, explanation: "Persegi memiliki 4 simetri lipat." },
  { id: "mode-arena-5", topic: "Sudut", question: "Sudut pada pojok buku berbentuk sudut...", options: ["Lancip", "Siku-siku", "Tumpul", "Refleks"], correctAnswer: 1, explanation: "Pojok buku umumnya membentuk sudut 90 derajat atau siku-siku." },
  { id: "mode-arena-6", topic: "Keliling Arena", question: "Arena persegi bersisi 8 meter. Kelilingnya adalah...", options: ["16 m", "24 m", "32 m", "64 m"], correctAnswer: 2, explanation: "Keliling persegi = 4 × 8 = 32 meter." }
]);

const BATTLE_QUESTIONS = buildBank(["duel", "team_battle"], {
  timeLimit: 30,
  pointWeight: 140
}, [
  { id: "mode-battle-1", category: "numerasi", topic: "Duel Hitung Cepat", grade: 3, difficulty: "easy", question: "Tim Merah memperoleh 35 poin dan Tim Biru 28 poin. Selisihnya...", options: ["5", "7", "8", "9"], correctAnswer: 1, explanation: "35 - 28 = 7." },
  { id: "mode-battle-2", category: "literasi", topic: "Duel Kosakata", grade: 3, difficulty: "easy", question: "Kata yang berarti bekerja bersama adalah...", options: ["Bersaing", "Berkolaborasi", "Berdiam", "Berpisah"], correctAnswer: 1, explanation: "Berkolaborasi berarti bekerja bersama." },
  { id: "mode-battle-3", category: "numerasi", topic: "Strategi Skor", grade: 4, difficulty: "medium", question: "Satu jawaban benar bernilai 125 poin. Empat jawaban benar menghasilkan...", options: ["400", "450", "500", "525"], correctAnswer: 2, explanation: "4 × 125 = 500 poin." },
  { id: "mode-battle-4", category: "literasi", topic: "Kalimat Efektif", grade: 5, difficulty: "medium", question: "Kalimat yang paling efektif adalah...", options: ["Para siswa-siswa belajar bersama", "Siswa belajar bersama", "Siswa semua pada belajar", "Bersama siswa belajar-belajar"], correctAnswer: 1, explanation: "'Siswa belajar bersama' ringkas dan tidak mengandung pengulangan tidak perlu." },
  { id: "mode-battle-5", category: "numerasi", topic: "Persentase Skor", grade: 5, difficulty: "medium", question: "Tim menjawab benar 8 dari 10 soal. Persentase ketepatannya...", options: ["70%", "75%", "80%", "90%"], correctAnswer: 2, explanation: "8/10 × 100% = 80%." },
  { id: "mode-battle-6", category: "literasi", topic: "Peribahasa", grade: 6, difficulty: "hard", question: "Makna 'bersatu kita teguh, bercerai kita runtuh' adalah...", options: ["Persatuan memberi kekuatan", "Harus selalu berlomba", "Bekerja sendiri lebih cepat", "Perbedaan harus dihindari"], correctAnswer: 0, explanation: "Peribahasa menekankan kekuatan persatuan." },
  { id: "mode-battle-7", category: "numerasi", topic: "Logika Poin", grade: 6, difficulty: "hard", question: "Skor awal 240, mendapat bonus 25%, lalu dikurangi 40. Skor akhir adalah...", options: ["240", "250", "260", "300"], correctAnswer: 2, explanation: "Bonus 25% dari 240 adalah 60; 240 + 60 - 40 = 260." },
  { id: "mode-battle-8", category: "literasi", topic: "Ide Pokok", grade: 4, difficulty: "medium", passage: "Setiap anggota tim memiliki tugas berbeda. Ada yang membaca soal, menghitung, dan memeriksa jawaban. Pembagian tugas membuat pekerjaan selesai lebih cepat.", question: "Ide pokok paragraf adalah...", options: ["Semua tugas harus sama", "Pembagian tugas membuat kerja tim efektif", "Membaca adalah tugas tersulit", "Bekerja cepat selalu benar"], correctAnswer: 1, explanation: "Seluruh kalimat menjelaskan manfaat pembagian tugas dalam tim." }
]);

const COOPERATIVE_QUESTIONS = buildBank(["cooperative"], {
  timeLimit: 40,
  pointWeight: 100
}, [
  { id: "mode-coop-1", category: "literasi", topic: "Gotong Royong", grade: 3, difficulty: "easy", question: "Sikap terbaik saat teman kesulitan memahami tugas adalah...", options: ["Mengejek", "Membantu menjelaskan", "Mengabaikan", "Menyembunyikan buku"], correctAnswer: 1, explanation: "Membantu teman merupakan bentuk kerja sama dan kepedulian." },
  { id: "mode-coop-2", category: "numerasi", topic: "Berbagi Adil", grade: 3, difficulty: "easy", question: "24 pensil dibagikan sama rata kepada 6 siswa. Setiap siswa mendapat...", options: ["3", "4", "5", "6"], correctAnswer: 1, explanation: "24 ÷ 6 = 4 pensil." },
  { id: "mode-coop-3", category: "literasi", topic: "Musyawarah", grade: 4, difficulty: "easy", question: "Ketika anggota kelompok berbeda pendapat, sebaiknya...", options: ["Bertengkar", "Bermusyawarah", "Meninggalkan kelompok", "Memaksakan kehendak"], correctAnswer: 1, explanation: "Musyawarah membantu kelompok mencapai keputusan bersama." },
  { id: "mode-coop-4", category: "numerasi", topic: "Target Bersama", grade: 4, difficulty: "medium", question: "Kelas menargetkan 80 buku. Sudah terkumpul 56 buku. Kekurangannya...", options: ["14", "20", "24", "26"], correctAnswer: 2, explanation: "80 - 56 = 24 buku." },
  { id: "mode-coop-5", category: "literasi", topic: "Tanggung Jawab", grade: 5, difficulty: "medium", question: "Contoh tanggung jawab anggota tim adalah...", options: ["Menyelesaikan bagian tugas tepat waktu", "Menunggu teman mengerjakan semua", "Mengubah keputusan tanpa bicara", "Tidak hadir tanpa kabar"], correctAnswer: 0, explanation: "Menuntaskan bagian tugas tepat waktu menunjukkan tanggung jawab." },
  { id: "mode-coop-6", category: "numerasi", topic: "Rata-rata Kelompok", grade: 5, difficulty: "medium", question: "Empat kelompok memperoleh 70, 80, 90, dan 80 poin. Rata-ratanya...", options: ["75", "80", "85", "90"], correctAnswer: 1, explanation: "(70 + 80 + 90 + 80) ÷ 4 = 80." },
  { id: "mode-coop-7", category: "literasi", topic: "Komunikasi Positif", grade: 5, difficulty: "medium", question: "Kalimat tanggapan yang santun adalah...", options: ["Pendapatmu pasti salah", "Saya setuju sebagian, tetapi ada hal yang perlu diperiksa", "Diam saja!", "Ide saya selalu terbaik"], correctAnswer: 1, explanation: "Kalimat tersebut menyampaikan perbedaan dengan tetap menghargai teman." },
  { id: "mode-coop-8", category: "numerasi", topic: "Pembagian Tugas", grade: 6, difficulty: "medium", question: "Sebuah proyek memiliki 45 tugas yang dibagi rata kepada 5 kelompok. Setiap kelompok menerima...", options: ["5", "8", "9", "10"], correctAnswer: 2, explanation: "45 ÷ 5 = 9 tugas." },
  { id: "mode-coop-9", category: "literasi", topic: "Kesimpulan Kerja Sama", grade: 6, difficulty: "hard", passage: "Kelompok Melati membagi peran berdasarkan kemampuan anggota. Mereka saling memeriksa hasil dan memperbaiki kesalahan tanpa saling menyalahkan.", question: "Mengapa kelompok tersebut bekerja efektif?", options: ["Semua anggota mengerjakan hal yang sama", "Mereka membagi peran dan saling memberi umpan balik", "Mereka tidak pernah menemukan kesalahan", "Hanya satu anggota yang bekerja"], correctAnswer: 1, explanation: "Pembagian peran dan umpan balik membuat kerja kelompok efektif." },
  { id: "mode-coop-10", category: "numerasi", topic: "Capaian Bersama", grade: 6, difficulty: "hard", question: "Target kelas 200 poin. Ronde pertama mendapat 35%, ronde kedua 45%. Berapa persen target yang masih kurang?", options: ["10%", "20%", "25%", "30%"], correctAnswer: 1, explanation: "35% + 45% = 80%, sehingga masih kurang 20%." }
]);

const ADVENTURE_QUESTIONS = buildBank(["adventure"], {
  timeLimit: 45,
  pointWeight: 150
}, [
  { id: "mode-adv-1-1", category: "numerasi", topic: "Misi 1 - Operasi Hitung", grade: 3, difficulty: "easy", question: "Gerbang pertama terbuka dengan hasil 36 ÷ 4. Kodenya...", options: ["7", "8", "9", "10"], correctAnswer: 2, explanation: "36 ÷ 4 = 9." },
  { id: "mode-adv-1-2", category: "numerasi", topic: "Misi 1 - Pola Angka", grade: 3, difficulty: "easy", question: "Jejak angka berbunyi 5, 10, 15, 20, ...", options: ["22", "24", "25", "30"], correctAnswer: 2, explanation: "Pola bertambah 5 sehingga berikutnya 25." },
  { id: "mode-adv-1-3", category: "numerasi", topic: "Misi 1 - Nilai Tempat", grade: 3, difficulty: "easy", question: "Pada kode 4.271, angka 2 bernilai...", options: ["2", "20", "200", "2.000"], correctAnswer: 2, explanation: "Angka 2 berada pada tempat ratusan." },
  { id: "mode-adv-1-4", category: "numerasi", topic: "Misi 1 - Perkalian", grade: 3, difficulty: "easy", question: "Ada 6 peti, masing-masing berisi 7 kristal. Jumlah kristal...", options: ["36", "40", "42", "48"], correctAnswer: 2, explanation: "6 × 7 = 42 kristal." },
  { id: "mode-adv-2-1", category: "literasi", topic: "Misi 2 - Ide Pokok", grade: 4, difficulty: "medium", passage: "Pohon-pohon di Hutan Kata menyimpan air saat hujan. Akar menahan tanah agar tidak mudah longsor. Karena itu, penjaga hutan selalu merawat pohon.", question: "Ide pokok bacaan adalah...", options: ["Penjaga takut hujan", "Pohon memberi manfaat bagi lingkungan", "Akar harus dipotong", "Hutan hanya berisi air"], correctAnswer: 1, explanation: "Bacaan menjelaskan manfaat pohon bagi air dan tanah." },
  { id: "mode-adv-2-2", category: "literasi", topic: "Misi 2 - Makna Kata", grade: 4, difficulty: "medium", question: "Kata 'rimbun' pada kalimat 'hutan itu sangat rimbun' berarti...", options: ["Gersang", "Lebat", "Sempit", "Gelap"], correctAnswer: 1, explanation: "Rimbun berarti lebat dan banyak daun." },
  { id: "mode-adv-2-3", category: "literasi", topic: "Misi 2 - Simpulan", grade: 4, difficulty: "medium", passage: "Tara mengikuti tanda panah, membaca setiap petunjuk, dan tidak meninggalkan sampah selama menjelajah. Ia tiba di tujuan tanpa merusak hutan.", question: "Sifat Tara adalah...", options: ["Ceroboh", "Tertib dan peduli lingkungan", "Pemarah", "Mudah menyerah"], correctAnswer: 1, explanation: "Tara mengikuti petunjuk dan menjaga kebersihan hutan." },
  { id: "mode-adv-2-4", category: "literasi", topic: "Misi 2 - Kalimat Petunjuk", grade: 4, difficulty: "medium", question: "Kalimat petunjuk yang tepat adalah...", options: ["Pohon itu sangat tinggi", "Beloklah ke kiri setelah jembatan", "Aku menyukai petualangan", "Mengapa jalan ini sepi?"], correctAnswer: 1, explanation: "Kalimat tersebut memberi arahan yang jelas." },
  { id: "mode-adv-3-1", category: "numerasi", topic: "Misi 3 - Pecahan", grade: 5, difficulty: "hard", question: "Kunci pecahan menunjukkan 3/4 + 1/8. Hasilnya...", options: ["4/12", "5/8", "7/8", "1"], correctAnswer: 2, explanation: "3/4 = 6/8, lalu 6/8 + 1/8 = 7/8." },
  { id: "mode-adv-3-2", category: "numerasi", topic: "Misi 3 - Volume", grade: 5, difficulty: "hard", question: "Peti berbentuk balok berukuran 8 × 5 × 4 cm. Volumenya...", options: ["40 cm³", "80 cm³", "160 cm³", "320 cm³"], correctAnswer: 2, explanation: "Volume balok = 8 × 5 × 4 = 160 cm³." },
  { id: "mode-adv-3-3", category: "numerasi", topic: "Misi 3 - Skala", grade: 5, difficulty: "hard", question: "Pada peta labirin, 1 cm mewakili 20 m. Jarak 7 cm sebenarnya...", options: ["27 m", "70 m", "140 m", "200 m"], correctAnswer: 2, explanation: "7 × 20 = 140 meter." },
  { id: "mode-adv-3-4", category: "numerasi", topic: "Misi 3 - Penalaran", grade: 5, difficulty: "hard", question: "Sebuah sandi adalah bilangan yang habis dibagi 4 dan 6, serta lebih kecil dari 30. Sandi terbesar adalah...", options: ["12", "18", "24", "28"], correctAnswer: 2, explanation: "Kelipatan bersama 4 dan 6 di bawah 30 adalah 12 dan 24; yang terbesar 24." }
]);

export const MODE_QUESTIONS = [
  ...DETECTIVE_QUESTIONS,
  ...MOTION_CHALLENGE_QUESTIONS,
  ...ARENA_QUESTIONS,
  ...BATTLE_QUESTIONS,
  ...COOPERATIVE_QUESTIONS,
  ...ADVENTURE_QUESTIONS
];

export const MODE_QUESTION_COUNTS = Object.freeze(MODE_QUESTIONS.reduce((counts, question) => {
  question.gameModes.forEach((mode) => {
    counts[mode] = (counts[mode] || 0) + 1;
  });
  return counts;
}, {}));

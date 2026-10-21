/**
 * MOTION SMART CLASS - Bank Soal Lengkap
 * Kurikulum SD (Numerasi & Literasi) Kelas 1 - 6
 * Standar Kurikulum Merdeka & AKM SD
 */

export const DEFAULT_QUESTIONS = [
  // ==========================================
  // NUMERASI (25 Soal Lengkap Beragam Kategori)
  // ==========================================
  {
    id: "num-1",
    category: "numerasi",
    topic: "Operasi Perkalian",
    grade: 3,
    difficulty: "easy",
    question: "Berapakah hasil dari 7 × 8 ?",
    options: ["48", "54", "56", "64"],
    correctAnswer: 2, // C: 56
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "7 dikalikan 8 sama dengan 56."
  },
  {
    id: "num-2",
    category: "numerasi",
    topic: "Bilangan & Nilai Tempat",
    grade: 3,
    difficulty: "easy",
    question: "Pada bilangan 3.582, angka 5 menempati nilai tempat...",
    options: ["Satuan", "Puluhan", "Ratusan", "Ribuan"],
    correctAnswer: 2, // C: Ratusan
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "3 ribuan, 5 ratusan, 8 puluhan, 2 satuan."
  },
  {
    id: "num-3",
    category: "numerasi",
    topic: "Operasi Penjumlahan & Pengurangan",
    grade: 3,
    difficulty: "easy",
    question: "Pak Budi memanen 250 apel, lalu membagikan 125 apel. Sisa apel Pak Budi adalah...",
    options: ["115 apel", "125 apel", "135 apel", "145 apel"],
    correctAnswer: 1, // B: 125 apel
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "250 - 125 = 125 apel."
  },
  {
    id: "num-4",
    category: "numerasi",
    topic: "Kelipatan & Faktor",
    grade: 4,
    difficulty: "medium",
    question: "Bilangan di bawah ini yang merupakan kelipatan dari 6 dan 8 adalah...",
    options: ["18", "24", "32", "40"],
    correctAnswer: 1, // B: 24
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "KPK dari 6 dan 8 adalah 24."
  },
  {
    id: "num-5",
    category: "numerasi",
    topic: "Pecahan Sederhana",
    grade: 4,
    difficulty: "medium",
    question: "Bentuk pecahan paling sederhana dari 12/16 adalah...",
    options: ["2/3", "3/4", "4/5", "6/8"],
    correctAnswer: 1, // B: 3/4
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Membagi pembilang dan penyebut dengan 4: 12÷4 = 3, 16÷4 = 4 → 3/4."
  },
  {
    id: "num-6",
    category: "numerasi",
    topic: "Geometri Bangun Datar",
    grade: 4,
    difficulty: "medium",
    question: "Sebuah persegi memiliki panjang sisi 9 cm. Berapakah luasnya?",
    options: ["36 cm²", "72 cm²", "81 cm²", "90 cm²"],
    correctAnswer: 2, // C: 81 cm²
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Luas persegi = sisi × sisi = 9 × 9 = 81 cm²."
  },
  {
    id: "num-7",
    category: "numerasi",
    topic: "Keliling Bangun Datar",
    grade: 4,
    difficulty: "medium",
    question: "Persegi panjang berukuran panjang 12 cm dan lebar 8 cm. Kelilingnya adalah...",
    options: ["20 cm", "40 cm", "96 cm", "48 cm"],
    correctAnswer: 1, // B: 40 cm
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Keliling = 2 × (p + l) = 2 × (12 + 8) = 40 cm."
  },
  {
    id: "num-8",
    category: "numerasi",
    topic: "KPK dan FPB",
    grade: 5,
    difficulty: "medium",
    question: "Faktor Persekutuan Terbesar (FPB) dari 24 dan 36 adalah...",
    options: ["6", "8", "12", "18"],
    correctAnswer: 2, // C: 12
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Faktor 24: 1,2,3,4,6,8,12,24. Faktor 36: 1,2,3,4,6,9,12,18,36. FPB = 12."
  },
  {
    id: "num-9",
    category: "numerasi",
    topic: "Operasi Pecahan",
    grade: 5,
    difficulty: "medium",
    question: "Hasil dari 2/5 + 1/2 adalah...",
    options: ["3/7", "7/10", "9/10", "3/10"],
    correctAnswer: 2, // C: 9/10
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Samakan penyebut ke 10: 4/10 + 5/10 = 9/10."
  },
  {
    id: "num-10",
    category: "numerasi",
    topic: "Geometri Bangun Ruang",
    grade: 5,
    difficulty: "medium",
    question: "Sebuah kubus memiliki rusuk 6 cm. Berapa volume kubus tersebut?",
    options: ["36 cm³", "144 cm³", "216 cm³", "256 cm³"],
    correctAnswer: 2, // C: 216 cm³
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Volume kubus = s × s × s = 6 × 6 × 6 = 216 cm³."
  },
  {
    id: "num-11",
    category: "numerasi",
    topic: "Membaca Data",
    grade: 5,
    difficulty: "easy",
    question: "Data nilai siswa: 70, 80, 80, 90, 100. Nilai yang paling sering muncul (Modus) adalah...",
    options: ["70", "80", "90", "100"],
    correctAnswer: 1, // B: 80
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Nilai 80 muncul sebanyak 2 kali, paling sering dibanding lainnya."
  },
  {
    id: "num-12",
    category: "numerasi",
    topic: "Pola Bilangan & Logika",
    grade: 5,
    difficulty: "hard",
    question: "Perhatikan pola: 3, 6, 12, 24, ... Angka berikutnya adalah?",
    options: ["36", "40", "48", "52"],
    correctAnswer: 2, // C: 48
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Setiap angka dikalikan 2: 24 × 2 = 48."
  },
  {
    id: "num-13",
    category: "numerasi",
    topic: "Operasi Pembagian",
    grade: 4,
    difficulty: "easy",
    question: "Berapa hasil dari 144 ÷ 12 ?",
    options: ["10", "11", "12", "14"],
    correctAnswer: 2, // C: 12
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "144 dibagi 12 sama dengan 12."
  },
  {
    id: "num-14",
    category: "numerasi",
    topic: "Bilangan Desimal & Persen",
    grade: 6,
    difficulty: "hard",
    question: "Bentuk desimal dari 3/5 adalah...",
    options: ["0,35", "0,5", "0,6", "0,75"],
    correctAnswer: 2, // C: 0,6
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "3 ÷ 5 = 0,6."
  },
  {
    id: "num-15",
    category: "numerasi",
    topic: "Perbandingan & Skala",
    grade: 6,
    difficulty: "hard",
    question: "Jarak pada peta 4 cm dengan skala 1 : 200.000. Jarak sebenarnya adalah...",
    options: ["4 km", "8 km", "80 km", "800 m"],
    correctAnswer: 1, // B: 8 km
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "4 cm × 200.000 = 800.000 cm = 8 km."
  },
  {
    id: "num-16",
    category: "numerasi",
    topic: "Bilangan Bulat Negatif",
    grade: 6,
    difficulty: "hard",
    question: "Suhu udara mula-mula -3°C, kemudian naik 8°C. Suhu udara sekarang adalah...",
    options: ["-11°C", "-5°C", "5°C", "11°C"],
    correctAnswer: 2, // C: 5°C
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "-3 + 8 = 5°C."
  },
  {
    id: "num-17",
    category: "numerasi",
    topic: "Operasi Perkalian Pecahan",
    grade: 5,
    difficulty: "medium",
    question: "Hasil dari 3/4 × 2/3 adalah...",
    options: ["1/4", "1/2", "5/7", "6/7"],
    correctAnswer: 1, // B: 1/2
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "(3 × 2) / (4 × 3) = 6/12 = 1/2."
  },
  {
    id: "num-18",
    category: "numerasi",
    topic: "Geometri Lingkaran",
    grade: 6,
    difficulty: "hard",
    question: "Jika jari-jari lingkaran adalah 7 cm, berapa keliling lingkaran tersebut? (π = 22/7)",
    options: ["22 cm", "44 cm", "88 cm", "154 cm"],
    correctAnswer: 1, // B: 44 cm
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Keliling = 2 × π × r = 2 × (22/7) × 7 = 44 cm."
  },
  {
    id: "num-19",
    category: "numerasi",
    topic: "Satuan Waktu",
    grade: 3,
    difficulty: "easy",
    question: "2 jam 30 menit sama dengan berapa menit?",
    options: ["120 menit", "150 menit", "180 menit", "230 menit"],
    correctAnswer: 1, // B: 150 menit
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "(2 × 60) + 30 = 120 + 30 = 150 menit."
  },
  {
    id: "num-20",
    category: "numerasi",
    topic: "Rata-rata (Mean)",
    grade: 6,
    difficulty: "hard",
    question: "Nilai ulangan matematika Edo: 6, 7, 8, 7, 7. Rata-rata nilainya adalah...",
    options: ["6,5", "7,0", "7,5", "8,0"],
    correctAnswer: 1, // B: 7,0
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "(6 + 7 + 8 + 7 + 7) ÷ 5 = 35 ÷ 5 = 7,0."
  },
  {
    id: "num-21",
    category: "numerasi",
    topic: "Logika Perbandingan",
    grade: 3,
    difficulty: "easy",
    question: "Manakah pecahan yang nilainya paling besar?",
    options: ["1/8", "1/4", "1/2", "1/6"],
    correctAnswer: 2, // C: 1/2
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Dengan pembilang sama, penyebut terkecil memiliki nilai terbesar (1/2 = 0,5)."
  },
  {
    id: "num-22",
    category: "numerasi",
    topic: "Operasi Hitung Campuran",
    grade: 4,
    difficulty: "medium",
    question: "Hasil dari 50 + 25 × 2 - 20 adalah...",
    options: ["60", "80", "100", "130"],
    correctAnswer: 1, // B: 80
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Dahulukan perkalian: 25 × 2 = 50. Lalu 50 + 50 - 20 = 80."
  },
  {
    id: "num-23",
    category: "numerasi",
    topic: "Satuan Berat",
    grade: 3,
    difficulty: "easy",
    question: "Ibu membeli 3 kg gula pasir. Berapa gram gula pasir tersebut?",
    options: ["30 gram", "300 gram", "3.000 gram", "30.000 gram"],
    correctAnswer: 2, // C: 3.000 gram
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "1 kg = 1.000 gram, sehingga 3 kg = 3.000 gram."
  },
  {
    id: "num-24",
    category: "numerasi",
    topic: "Sudut Geometri",
    grade: 4,
    difficulty: "easy",
    question: "Sudut yang besarnya tepat 90 derajat disebut sudut...",
    options: ["Lancip", "Tumpul", "Siku-siku", "Lurus"],
    correctAnswer: 2, // C: Siku-siku
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Sudut 90° adalah sudut siku-siku."
  },
  {
    id: "num-25",
    category: "numerasi",
    topic: "Persentase",
    grade: 5,
    difficulty: "medium",
    question: "25% dari 200 buah mangga adalah sebanyak...",
    options: ["25 buah", "50 buah", "75 buah", "100 buah"],
    correctAnswer: 1, // B: 50 buah
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "(25/100) × 200 = 50 buah."
  },

  // ==========================================
  // LITERASI (25 Soal Lengkap Beragam Kategori)
  // ==========================================
  {
    id: "lit-1",
    category: "literasi",
    topic: "Pemahaman Bacaan - Detektif",
    grade: 4,
    difficulty: "easy",
    passage: "Rani membawa payung sebelum berangkat ke sekolah karena langit pagi itu tampak gelap dan berangin kencang.",
    question: "Mengapa Rani membawa payung ke sekolah?",
    options: ["Ingin bermain air", "Kemungkinan akan hujan", "Supaya tidak mengantuk", "Tas sekolahnya hilang"],
    correctAnswer: 1, // B: Kemungkinan akan hujan
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Langit gelap dan berangin menandakan cuaca mendung dan akan hujan."
  },
  {
    id: "lit-2",
    category: "literasi",
    topic: "Kosakata - Sinonim",
    grade: 3,
    difficulty: "easy",
    question: "Sinonim dari kata 'Giat' dalam kalimat 'Siswa harus giat belajar' adalah...",
    options: ["Malas", "Rajin", "Cepat", "Santai"],
    correctAnswer: 1, // B: Rajin
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Giat memiliki arti yang sama dengan rajin dan tekun."
  },
  {
    id: "lit-3",
    category: "literasi",
    topic: "Kosakata - Antonim",
    grade: 3,
    difficulty: "easy",
    question: "Lawan kata (antonim) dari kata 'Hemat' adalah...",
    options: ["Cermat", "Kikir", "Boros", "Sederhana"],
    correctAnswer: 2, // C: Boros
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Lawan dari berhemat dalam menggunakan sesuatu adalah boros."
  },
  {
    id: "lit-4",
    category: "literasi",
    topic: "Bahasa - Kata Baku",
    grade: 5,
    difficulty: "medium",
    question: "Manakah penulisan kata baku yang benar menurut KBBI?",
    options: ["Praktek", "Apotik", "Ijin", "Praktik"],
    correctAnswer: 3, // D: Praktik
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Kata baku yang tepat adalah 'praktik', 'apotek', dan 'izin'."
  },
  {
    id: "lit-5",
    category: "literasi",
    topic: "Ide Pokok Paragraf",
    grade: 5,
    difficulty: "medium",
    passage: "Hutan bakau memiliki peran krusial bagi ekosistem pesisir. Akar bakau menahan erosi tanah akibat ombak laut. Selain itu, kawasan bakau menjadi tempat bertelur dan berlindung berbagai jenis ikan serta udang.",
    question: "Ide pokok dari paragraf tersebut adalah...",
    options: [
      "Ikan dan udang bertelur di pantai",
      "Peran penting hutan bakau di pesisir",
      "Bahaya ombak laut bagi manusia",
      "Cara menanam pohon bakau yang subur"
    ],
    correctAnswer: 1, // B: Peran penting hutan bakau di pesisir
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Paragraf menjelaskan berbagai fungsi dan peran penting hutan bakau."
  },
  {
    id: "lit-6",
    category: "literasi",
    topic: "Makna Kiasan / Konotatif",
    grade: 5,
    difficulty: "medium",
    question: "Ungkapan 'Kutu Buku' memiliki arti...",
    options: ["Orang yang malas membaca", "Orang yang suka merusak buku", "Orang yang sangat gemar membaca", "Hewan pemakan kertas buku"],
    correctAnswer: 2, // C: Orang yang sangat gemar membaca
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Kutu buku adalah kiasan bagi seseorang yang sangat gemar dan rajin membaca buku."
  },
  {
    id: "lit-7",
    category: "literasi",
    topic: "Cerita & Pesan Moral",
    grade: 4,
    difficulty: "easy",
    passage: "Semut bekerja keras mengumpulkan biji-biji makanan di musim panas tanpa mengeluh. Saat musim dingin tiba, Semut tetap kenyang dan hangat di dalam sarangnya, sementara Belalang yang bermalas-malasan kedinginan dan kelaparan.",
    question: "Amanat atau pesan moral yang dapat dipetik dari cerita adalah...",
    options: [
      "Kita harus bermalas-malasan saat cuaca panas",
      "Bekerja keras dan bersiap sejak dini membawa kebaikan",
      "Jangan berbagi makanan dengan tetangga",
      "Musim dingin adalah waktu untuk bermain di luar"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Semut mengajarkan kita untuk giat dan bersiap menghadapi masa depan."
  },
  {
    id: "lit-8",
    category: "literasi",
    topic: "Bahasa - Tanda Baca",
    grade: 4,
    difficulty: "easy",
    question: "Kalimat berikut yang menggunakan tanda baca dengan benar adalah...",
    options: [
      "Wah indah sekali pemandangan ini?",
      "Dimana kamu meletakkan buku matematika.",
      "Tolong ambilkan pensil itu di atas meja!",
      "Ibu membeli sayur buah dan ikan"
    ],
    correctAnswer: 2, // C: Tolong ambilkan pensil itu di atas meja!
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Kalimat perintah diawali huruf kapital dan diakhiri tanda seru (!)."
  },
  {
    id: "lit-9",
    category: "literasi",
    topic: "Pemahaman Bacaan - Kesimpulan",
    grade: 5,
    difficulty: "medium",
    passage: "Sampah plastik membutuhkan waktu ratusan tahun untuk terurai di dalam tanah. Jika dibuang sembarangan, sampah plastik dapat mencemari saluran air dan membahayakan biota laut.",
    question: "Kesimpulan yang tepat dari informasi di atas adalah...",
    options: [
      "Plastik sangat mudah terurai secara alami",
      "Kita harus bijak mengurangi penggunaan sampah plastik",
      "Saluran air tidak akan tersumbat plastik",
      "Hewan laut sangat menyukai sampah plastik"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Karena bahaya dan lamanya terurai, kita harus mengurangi sampah plastik."
  },
  {
    id: "lit-10",
    category: "literasi",
    topic: "Cerita - Latar Cerita",
    grade: 3,
    difficulty: "easy",
    passage: "Ombak bergulung lembut menyentuh pasir putih. Burung camar berterbangan di bawah langit jingga senja yang hangat.",
    question: "Latar tempat dan waktu pada kutipan cerita di atas adalah...",
    options: [
      "Hutan pada pagi hari",
      "Pantai pada waktu senja",
      "Pegunungan di tengah malam",
      "Sungai pada siang hari"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Ombak dan pasir putih menunjukkan pantai, langit jingga menunjukkan waktu senja."
  },
  {
    id: "lit-11",
    category: "literasi",
    topic: "Kosakata - Istilah Sains",
    grade: 5,
    difficulty: "medium",
    question: "Proses tumbuhan hijau mengolah makanan menggunakan bantuan sinar matahari disebut...",
    options: ["Metamorfosis", "Fotosintesis", "Adaptasi", "Evaporasi"],
    correctAnswer: 1, // B: Fotosintesis
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Fotosintesis adalah proses pembuatan makanan oleh tumbuhan berklorofil."
  },
  {
    id: "lit-12",
    category: "literasi",
    topic: "Bahasa - Kalimat Efektif",
    grade: 6,
    difficulty: "hard",
    question: "Manakah contoh kalimat yang paling efektif?",
    options: [
      "Para bapak-bapak sekalian sedang menghadiri rapat di aula.",
      "Bapak-bapak sedang menghadiri rapat di aula.",
      "Para bapak sedang menghadiri rapat sekali di aula.",
      "Semua para bapak menghadiri pertemuan rapat."
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Penggunaan 'para bapak-bapak' adalah pemborosan kata (pleonasme)."
  },
  {
    id: "lit-13",
    category: "literasi",
    topic: "Cerita - Tokoh & Karakter",
    grade: 4,
    difficulty: "easy",
    passage: "Ketika Doni melihat kucing kecil terperangkap di selokan yang basah, ia segera menjangkau dan mengeringkan bulunya dengan handuk hangat.",
    question: "Watak tokoh Doni pada cerita di atas adalah...",
    options: ["Penyayang dan peduli", "Penakut dan ragu-ragu", "Pemarah dan kasar", "Acuh tak acuh"],
    correctAnswer: 0, // A: Penyayang dan peduli
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Tindakan Doni menolong kucing menunjukkan sifat penyayang binatang."
  },
  {
    id: "lit-14",
    category: "literasi",
    topic: "Peribahasa",
    grade: 6,
    difficulty: "hard",
    question: "Peribahasa 'Besar pasak daripada tiang' memiliki arti...",
    options: [
      "Rumah yang memiliki tiang kokoh",
      "Pengeluaran lebih besar daripada pendapatan",
      "Pemasukan yang berlimpah ruah",
      "Bekerja keras membangun rumah"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Besar pasak daripada tiang artinya belanja/pengeluaran melebihi kemampuan penghasilan."
  },
  {
    id: "lit-15",
    category: "literasi",
    topic: "Bahasa - Kata Hubung",
    grade: 4,
    difficulty: "easy",
    question: "Ardi rajin berolahraga setiap pagi ... tubuhnya selalu sehat dan bugar. Kata hubung yang tepat adalah...",
    options: ["tetapi", "meskipun", "sehingga", "atau"],
    correctAnswer: 2, // C: sehingga
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Kata hubung 'sehingga' menyatakan hubungan sebab-akibat."
  },
  {
    id: "lit-16",
    category: "literasi",
    topic: "Pemahaman Bacaan - Detektif",
    grade: 5,
    difficulty: "medium",
    passage: "Lampu kamar belajar menyala terang, tetapi buku di atas meja masih terbuka di halaman yang sama sejak satu jam lalu, dan di lantai terdapat sepatu bola kotor.",
    question: "Kemungkinan besar apa yang terjadi?",
    options: [
      "Anak tersebut pergi bermain bola tanpa mematikan lampu",
      "Anak tersebut sedang membaca buku dengan khidmat",
      "Kamar tersebut tidak dihuni siapa pun",
      "Sepatu bola baru saja dibeli di toko"
    ],
    correctAnswer: 0, // A
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Buku tak berpindah dan ada sepatu kotor mengindikasikan anak itu keluar bermain bola."
  },
  {
    id: "lit-17",
    category: "literasi",
    topic: "Makna Denotatif vs Konotatif",
    grade: 6,
    difficulty: "hard",
    question: "Kalimat di bawah ini yang menggunakan kata 'panas' dalam makna denotatif (sebenarnya) adalah...",
    options: [
      "Suasana persidangan itu terasa sangat panas.",
      "Hatinya panas mendengar ejekan temannya.",
      "Air mendidih di atas kompor itu sangat panas.",
      "Isu pemilihan ketua kelas semakin panas."
    ],
    correctAnswer: 2, // C: Air mendidih di atas kompor itu sangat panas.
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Makna denotatif adalah makna sesungguhnya (suhu tinggi pada air mendidih)."
  },
  {
    id: "lit-18",
    category: "literasi",
    topic: "Pantun Anak",
    grade: 4,
    difficulty: "easy",
    passage: "Pergi ke pasar membeli mangga,\nMangga manis harum baunya.\nRajin berbakti pada orang tua,\n...",
    question: "Larik yang tepat untuk melengkapi pantun di atas adalah...",
    options: [
      "Jangan lupa membeli alpukat",
      "Pasti hidup bahagia selamanya",
      "Makan bersama di meja makan",
      "Belajar giat sepanjang hari"
    ],
    correctAnswer: 1, // B: Pasti hidup bahagia selamanya
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Rima akhir pantun berbaris a-b-a-b (mangga/tua berima -a, baunya/selamanya berima -nya)."
  },
  {
    id: "lit-19",
    category: "literasi",
    topic: "Kosakata - Majas Personifikasi",
    grade: 6,
    difficulty: "hard",
    question: "Kalimat manakah yang mengandung majas personifikasi?",
    options: [
      "Angin malam membisikkan ketenangan di telingaku.",
      "Wajahnya cantik bagaikan bunga mawar.",
      "Gedung sekolah itu tinggi menjulang ke angkasa.",
      "Ibu memasak gulai ikan di dapur."
    ],
    correctAnswer: 0, // A
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Personifikasi memberikan sifat manusia (membisikkan) kepada benda mati/alam (angin)."
  },
  {
    id: "lit-20",
    category: "literasi",
    topic: "Teks Petunjuk / Prosedur",
    grade: 3,
    difficulty: "easy",
    question: "Langkah pertama yang tepat saat menyikat gigi yang benar adalah...",
    options: [
      "Berkumur dengan air hingga bersih",
      "Menaruh pasta gigi secukupnya di bulu sikat",
      "Menggosok lidah dengan lembut",
      "Menyimpan sikat gigi di lemari"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Langkah awal adalah menyiapkan sikat dan memberi pasta gigi."
  },
  {
    id: "lit-21",
    category: "literasi",
    topic: "Kosakata - Antonim",
    grade: 4,
    difficulty: "easy",
    question: "Lawan kata dari 'Optimis' adalah...",
    options: ["Pesimis", "Dinamis", "Harmonis", "Kritis"],
    correctAnswer: 0, // A: Pesimis
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Optimis (yakin dan berpengharapan baik) berlawanan dengan pesimis (mudah putus asa)."
  },
  {
    id: "lit-22",
    category: "literasi",
    topic: "Pemahaman Bacaan - Sebab Akibat",
    grade: 5,
    difficulty: "medium",
    passage: "Karena sungai dipenuhi sampah plastik dan lumpur tebal yang tidak dikeruk, air meluap ke permukiman warga ketika hujan deras turun semalaman.",
    question: "Apa penyebab utama air meluap ke permukiman?",
    options: [
      "Warga menanam pohon di tepi jalan",
      "Pendangkalan dan sumbatan sampah di sungai",
      "Hujan reda sebelum tengah malam",
      "Pintu air dibuka dengan sengaja"
    ],
    correctAnswer: 1, // B
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Teks menyebutkan sungai dipenuhi sampah dan lumpur sehingga daya tampungnya berkurang."
  },
  {
    id: "lit-23",
    category: "literasi",
    topic: "Bahasa - Imbuhan",
    grade: 4,
    difficulty: "medium",
    question: "Imbuhan 'ber-' yang bermakna memiliki atau memakai terdapat pada kata...",
    options: ["Berlari", "Berenang", "Bersepatu", "Bernyanyi"],
    correctAnswer: 2, // C: Bersepatu
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "'Bersepatu' bermakna memakai sepatu. Sedangkan berlari/bernyanyi menyatakan perbuatan/aksi."
  },
  {
    id: "lit-24",
    category: "literasi",
    topic: "Bahasa - Kata Tanya",
    grade: 3,
    difficulty: "easy",
    question: "Kata tanya yang digunakan untuk menanyakan alasan terjadinya suatu peristiwa adalah...",
    options: ["Kapan", "Di mana", "Mengapa", "Berapa"],
    correctAnswer: 2, // C: Mengapa
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Kata tanya 'mengapa' atau 'kenapa' digunakan untuk menanyakan sebab atau alasan."
  },
  {
    id: "lit-25",
    category: "literasi",
    topic: "Cerita - Nilai Kejujuran",
    grade: 4,
    difficulty: "easy",
    passage: "Saat berjalan di lorong sekolah, Bima menemukan dompet berisi uang dan kartu identitas guru. Tanpa mengambil sedikit pun uangnya, Bima segera menyerahkannya ke ruang guru.",
    question: "Sikap terpuji yang ditunjukkan Bima adalah...",
    options: ["Pemberani", "Kejujuran", "Kemandirian", "Kreativitas"],
    correctAnswer: 1, // B: Kejujuran
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
    explanation: "Mengembalikan barang temuan utuh kepada pemiliknya adalah cerminan sikap jujur dan amanah."
  }
];

// Soal Khusus Mode True/False (Benar atau Salah)
export const TRUE_FALSE_QUESTIONS = [
  {
    id: "tf-1",
    category: "numerasi",
    question: "25 adalah kelipatan dari bilangan 5.",
    correctAnswer: 0, // 0 = BENAR (🙆), 1 = SALAH (🙅)
    explanation: "25 ÷ 5 = 5 (benar kelipatan 5)."
  },
  {
    id: "tf-2",
    category: "numerasi",
    question: "Segitiga memiliki total jumlah 4 sisi sama panjang.",
    correctAnswer: 1, // SALAH
    explanation: "Segitiga memiliki 3 sisi, bukan 4."
  },
  {
    id: "tf-3",
    category: "numerasi",
    question: "1 meter sama dengan 100 centimeter.",
    correctAnswer: 0, // BENAR
    explanation: "1 m = 100 cm."
  },
  {
    id: "tf-4",
    category: "numerasi",
    question: "Bilangan 17 adalah salah satu contoh bilangan prima.",
    correctAnswer: 0, // BENAR
    explanation: "17 hanya habis dibagi 1 dan dirinya sendiri."
  },
  {
    id: "tf-5",
    category: "literasi",
    question: "Sinonim dari kata 'Pintar' adalah 'Pandai'.",
    correctAnswer: 0, // BENAR
    explanation: "Pintar dan pandai memiliki arti yang sepadan."
  },
  {
    id: "tf-6",
    category: "literasi",
    question: "Tanda titik (.) digunakan di akhir kalimat tanya.",
    correctAnswer: 1, // SALAH
    explanation: "Kalimat tanya diakhiri tanda tanya (?)."
  },
  {
    id: "tf-7",
    category: "literasi",
    question: "Cerita fabel adalah cerita yang tokoh utamanya adalah hewan bertingkah seperti manusia.",
    correctAnswer: 0, // BENAR
    explanation: "Fabel adalah dongeng binatang yang mendidik."
  },
  {
    id: "tf-8",
    category: "numerasi",
    question: "Hasil dari 12 × 5 adalah 70.",
    correctAnswer: 1, // SALAH
    explanation: "12 × 5 = 60, bukan 70."
  }
];

// Soal Khusus Boss Challenge (Multi-stage Boss Fights)
export const BOSS_QUESTIONS = [
  {
    id: "boss-1",
    bossName: "Raja Angka Raksasa",
    bossTitle: "Penguasa Labirin Numerasi",
    bossHp: 500,
    question: "Berapa hasil dari (15 + 25) × 3 ?",
    options: ["90", "120", "150", "180"],
    correctAnswer: 1, // B: 120
    damage: 100,
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
  },
  {
    id: "boss-2",
    bossName: "Raja Angka Raksasa",
    bossTitle: "Penguasa Labirin Numerasi",
    bossHp: 500,
    question: "Kelipatan Persekutuan Terkecil (KPK) dari 12 dan 15 adalah...",
    options: ["30", "45", "60", "90"],
    correctAnswer: 2, // C: 60
    damage: 100,
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
  },
  {
    id: "boss-3",
    bossName: "Raja Angka Raksasa",
    bossTitle: "Penguasa Labirin Numerasi",
    bossHp: 500,
    question: "Sebuah kubus memiliki volume 1.000 cm³. Berapa panjang rusuknya?",
    options: ["5 cm", "10 cm", "15 cm", "20 cm"],
    correctAnswer: 1, // B: 10 cm
    damage: 100,
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
  },
  {
    id: "boss-4",
    bossName: "Raja Angka Raksasa",
    bossTitle: "Penguasa Labirin Numerasi",
    bossHp: 500,
    question: "Antonim dari kata 'Berani' dalam pertempuran adalah...",
    options: ["Gagah", "Takut / Pengecut", "Perkasa", "Tangguh"],
    correctAnswer: 1, // B
    damage: 100,
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
  },
  {
    id: "boss-5",
    bossName: "Raja Angka Raksasa",
    bossTitle: "Penguasa Labirin Numerasi",
    bossHp: 500,
    question: "Berapa 75% dari 400 poin energi pahlawan?",
    options: ["200", "250", "300", "350"],
    correctAnswer: 2, // C: 300
    damage: 100,
    gestureMap: { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
  }
];

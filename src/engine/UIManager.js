/**
 * MOTION SMART CLASS - UI Manager
 * Handles all visual rendering, screen transitions, HUD elements, modals, and confetti.
 */

import confetti from "canvas-confetti";
import { escapeHTML, safeColor, safeImageUrl } from "../utils/security.js";
import { GAME_STATES, GAME_MODES, ADVENTURE_STAGES } from "./GameEngine.js";
import { GESTURE_TYPES, GESTURE_LABELS } from "./GestureEngine.js";
import { CAMERA_STATUS } from "./CameraManager.js";
import { StorageManager } from "./StorageManager.js";
import { FirestoreManager } from "./FirestoreManager.js";
import {
  getFirebaseConfig,
  saveFirebaseConfig,
  resetFirebaseConfig,
  testFirestoreConnection,
  isFirebaseConfigured,
  validateFirebaseAuthConfig,
  ensureAnonymousAuth,
  getAdminSession,
  getConfiguredAdminEmail,
  signInAdmin,
  signOutAdmin
} from "../firebase.js";
import { DEFAULT_QUESTIONS } from "../data/defaultQuestions.js";
import { MODE_QUESTIONS } from "../data/modeQuestions.js";
import { MultiplayerEngine, ROOM_STATUS } from "./MultiplayerEngine.js";
import firestoreRules from "../../firestore.rules?raw";
import { createQuestionWorkbook, downloadWorkbook, readQuestionWorkbook } from "../utils/questionSpreadsheet.js";

const BUILT_IN_QUESTIONS = [...DEFAULT_QUESTIONS, ...MODE_QUESTIONS];
const QUESTION_MODE_LABELS = Object.freeze({
  detective: "Detektif",
  motion_challenge: "Tantangan Gerak",
  arena: "Arena",
  duel: "Duel",
  team_battle: "Pertarungan Tim",
  cooperative: "Kooperatif",
  adventure: "Petualangan"
});

export class UIManager {
  constructor({ appContainer, gameEngine, cameraManager, poseDetector, gestureEngine, audioManager }) {
    this.container = appContainer;
    this.game = gameEngine;
    this.camera = cameraManager;
    this.pose = poseDetector;
    this.gesture = gestureEngine;
    this.audio = audioManager;

    this.videoEl = null;
    this.canvasEl = null;
    this.calibrationChecklist = {};
    this.debugPanelEl = null;
    this.trainingGestures = new Set();
    this.reportedMultiplayerRooms = new Set();
    this.adminSession = null;

    // Online Multiplayer Engine
    this.multiplayer = new MultiplayerEngine();
    this.multiplayer.onRoomUpdate = (room) => {
      this.handleMultiplayerRoomUpdate(room);
    };

    this.initDOM();
    this.configureStudioAccess();
    this.bindEvents();
    this.initDatabaseSession();
  }

  initDOM() {
    this.container.innerHTML = `
      <div id="msc-app" class="msc-app">
        <!-- TOP NAVIGATION HUD -->
        <header class="msc-header">
          <div class="msc-brand" id="btn-brand-home" title="Kembali ke Beranda">
            <span class="msc-logo-icon">🧠</span>
            <div class="msc-brand-text">
              <h1 class="msc-title">MOTION SMART CLASS</h1>
              <p class="msc-tagline">Berpikir dengan Otak. Menjawab dengan Gerak!</p>
            </div>
          </div>

          <div class="msc-header-controls">
            <!-- Camera Status Pill -->
            <div id="cam-status-pill" class="cam-status-pill status-off" title="Status Kamera">
              <span class="status-dot"></span>
              <span id="cam-status-text">CAMERA OFF</span>
            </div>

            <!-- Touch / Camera Toggle -->
            <button id="btn-touch-toggle" class="hud-btn" title="Ganti Mode Kamera / Sentuh">
              <span class="hud-icon">🎮</span>
              <span id="touch-toggle-text">Mode: Gerak</span>
            </button>

            <!-- Sound Toggle -->
            <button id="btn-sound-toggle" class="hud-btn" title="Suara ON / OFF">
              <span id="sound-icon" class="hud-icon">🔊</span>
            </button>

            <!-- Fullscreen Toggle -->
            <button id="btn-fullscreen-toggle" class="hud-btn" title="Layar Penuh (PID / Board)">
              <span class="hud-icon">⛶</span>
            </button>

            <!-- Teacher Mode Button -->
            <button id="btn-teacher-open" class="hud-btn teacher-btn" title="Buka Studio atau akses admin">
              <span class="hud-icon">👨‍🏫</span>
              <span id="studio-button-label">Studio</span>
            </button>

          </div>
        </header>

        <!-- MAIN SCREEN CONTAINER -->
        <main id="msc-main" class="msc-main" tabindex="-1">
          <!-- Screens dynamically injected here -->
        </main>

        <!-- PERSISTENT CAMERA PIP & DEBUG CONTAINER -->
        <div id="cam-pip-container" class="cam-pip-container hidden">
          <div class="cam-pip-card">
            <div class="cam-video-wrapper">
              <video id="msc-video" playsinline muted autoplay></video>
              <canvas id="msc-canvas"></canvas>

              <!-- Standing Guide Box Overlay -->
              <div id="cam-guide-box" class="cam-guide-box hidden">
                <div class="guide-silhouette">🧍</div>
                <div class="guide-text">Area Berdiri Ideal</div>
              </div>

              <div id="pose-realtime-hud" class="pose-realtime-hud" aria-live="polite">
                <div class="pose-hud-topline">
                  <span id="pose-hud-state" class="pose-hud-state searching"><i></i><strong>Mencari tubuh</strong></span>
                  <span id="pose-hud-quality" class="pose-hud-quality">0%</span>
                </div>
                <div class="pose-hud-meter" aria-hidden="true"><span id="pose-hud-meter-fill"></span></div>
                <div class="pose-part-row" aria-label="Bagian tubuh yang terdeteksi">
                  <span id="pose-part-head">Kepala</span>
                  <span id="pose-part-arms">Lengan</span>
                  <span id="pose-part-torso">Tubuh Atas</span>
                </div>
              </div>

              <!-- Hold Confirmation Ring Meter -->
              <div id="hold-meter-container" class="hold-meter-container hidden">
                <svg class="hold-svg" viewBox="0 0 100 100">
                  <circle class="hold-bg" cx="50" cy="50" r="44"></circle>
                  <circle id="hold-circle" class="hold-progress" cx="50" cy="50" r="44"></circle>
                </svg>
                <div id="hold-meter-label" class="hold-meter-label">Tahan...</div>
              </div>
            </div>

            <div id="camera-issue-panel" class="camera-issue-panel hidden" role="alert" aria-live="assertive">
              <div class="camera-issue-copy">
                <span class="camera-issue-icon" aria-hidden="true">!</span>
                <div><strong id="camera-issue-title">Kamera tidak tersedia</strong><p id="camera-issue-message"></p><small id="camera-issue-action"></small><code id="camera-issue-code"></code></div>
              </div>
              <div class="camera-issue-actions">
                <button id="btn-camera-retry" class="camera-retry-btn" type="button">↻ Coba Kamera Lagi</button>
                <button id="btn-camera-touch" class="camera-touch-btn" type="button">Gunakan Mode Sentuh</button>
              </div>
            </div>

            <!-- Live Gesture Recognition Banner -->
            <div id="live-gesture-banner" class="live-gesture-banner">
              <span id="gesture-banner-icon">👀</span>
              <span id="gesture-banner-text">Mendeteksi Posisi...</span>
            </div>

            <!-- Flip Camera & Skeleton Toggle -->
            <div class="cam-pip-actions">
              <button id="btn-flip-cam" class="pip-sub-btn" title="Putar Kamera Depan/Belakang">🔄 Putar</button>
              <button id="btn-toggle-skeleton" class="pip-sub-btn" title="Garis Rangka">🦴 Garis</button>
              <button id="btn-toggle-debug" class="pip-sub-btn" title="Panel Debug FPS">⚙️ Debug</button>
            </div>
          </div>

          <!-- Secret Debug HUD -->
          <div id="debug-overlay-card" class="debug-overlay-card hidden">
            <h4>DEBUG CAMERA</h4>
            <div id="debug-stats-content">
              <div>FPS: <span id="debug-fps">0</span></div>
              <div>Pose Conf: <span id="debug-conf">0%</span></div>
              <div>Left Wrist: <span id="debug-left-wrist">-</span></div>
              <div>Right Wrist: <span id="debug-right-wrist">-</span></div>
              <div>Shoulders: <span id="debug-shoulders">-</span></div>
              <div>Detected: <strong id="debug-gesture">-</strong></div>
            </div>
          </div>
        </div>

        <!-- TEACHER STUDIO & CLASS MANAGEMENT MODAL -->
        <div id="teacher-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="teacher-modal-title">
          <div class="modal-card">
            <div class="modal-header">
              <h2 id="teacher-modal-title">👨‍🏫 TEACHER STUDIO & PENGATURAN KELAS</h2>
              <button id="btn-teacher-close" class="modal-close-btn" aria-label="Tutup Mode Guru">&times;</button>
            </div>

            <div id="teacher-dashboard-section" class="teacher-dashboard-section">
              <div class="studio-access-panel">
                <div id="studio-public-session" class="studio-database-note"><span aria-hidden="true">☁️</span><div><strong>Kontribusi tanpa login</strong><p>Pengguna dapat mengirim soal melalui sesi anonim. Pengaturan aplikasi dan publikasi soal hanya tersedia untuk admin.</p></div><button id="btn-admin-login-open" class="secondary-btn btn-sm" type="button">🔐 Masuk Admin</button></div>
                <form id="admin-login-form" class="admin-login-form hidden" autocomplete="on">
                  <div><strong>🔐 Login Administrator</strong><p>Gunakan akun Email/Password yang telah dibuat di Firebase Authentication.</p></div>
                  <label>Email admin<input id="admin-email" type="email" autocomplete="username" required /></label>
                  <label>Password<input id="admin-password" type="password" autocomplete="current-password" required /></label>
                  <button id="btn-admin-login" class="primary-btn" type="submit">Masuk</button>
                  <button id="btn-admin-login-cancel" class="secondary-btn" type="button">Batal</button>
                  <div id="admin-login-feedback" class="admin-login-feedback hidden" role="alert"></div>
                </form>
                <div id="admin-session-panel" class="admin-session-panel hidden"><div><strong>🛡️ Mode Admin Aktif</strong><span id="admin-session-email"></span></div><button id="btn-admin-logout" class="secondary-btn btn-sm" type="button">Keluar Admin</button></div>
              </div>
              <!-- Tabs -->
              <div class="modal-tabs">
                <button class="tab-btn active" data-tab="tab-add-question" data-access="public">➕ Kirim Soal</button>
                <button class="tab-btn" data-tab="tab-my-submissions" data-access="public">📝 Kontribusi Saya</button>
                <button class="tab-btn" data-tab="tab-review-submissions" data-access="admin">✅ Review Soal</button>
                <button class="tab-btn" data-tab="tab-custom-questions" data-access="admin">📋 Bank Soal</button>
                <button class="tab-btn" data-tab="tab-analytics" data-access="admin">📊 Analitik Belajar</button>
                <button class="tab-btn" data-tab="tab-session-packages" data-access="admin">🗂️ Paket Sesi</button>
                <button class="tab-btn" data-tab="tab-media-library" data-access="admin">🖼️ Media</button>
                <button class="tab-btn" data-tab="tab-settings" data-access="admin">⚙️ Pengaturan</button>
                <button class="tab-btn" data-tab="tab-teams" data-access="admin">👥 Skor 4 Tim</button>
                <button class="tab-btn" data-tab="tab-firebase" data-access="admin">🔥 Database</button>
              </div>

              <!-- Tab 1: Bank Soal Guru (List, Filter, Search, Import/Export, Edit, Delete) -->
              <div id="tab-custom-questions" class="tab-content">
                <!-- Firestore Cloud Status & Fast-Sync Bar -->
                <div class="firestore-status-bar" id="firestore-status-bar">
                  <div class="firestore-badge-group">
                    <span id="firestore-status-pill" class="firestore-status-pill status-connecting">
                      <span class="status-dot"></span>
                      <span id="firestore-status-text">Memeriksa Cloud Firestore...</span>
                    </span>
                    <span id="firestore-project-text" class="firestore-project-tag"></span>
                  </div>
                  <div class="firestore-btn-group">
                    <button type="button" id="btn-sync-firestore" class="secondary-btn btn-sm" title="Muat ulang dan sinkronkan soal dari Cloud Firestore">
                      🔄 Sinkronkan Cloud
                    </button>
                  </div>
                </div>

                <div class="teacher-studio-header">
                  <div class="q-actions-row">
                    <label class="secondary-btn btn-file-label" title="Impor file soal JSON">
                      📥 Impor Soal (JSON)
                      <input type="file" id="import-json-input" accept=".json" style="display:none;" />
                    </label>
                    <label class="secondary-btn btn-file-label" title="Impor soal dari template CSV">
                      📊 Impor CSV
                      <input type="file" id="import-csv-input" accept=".csv,text/csv" style="display:none;" />
                    </label>
                    <label class="secondary-btn btn-file-label" title="Impor bank soal Excel XLS atau XLSX">
                      📗 Impor Excel
                      <input type="file" id="import-excel-input" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" style="display:none;" />
                    </label>
                    <button type="button" id="btn-download-csv-template" class="secondary-btn" title="Unduh format kolom CSV">Template CSV</button>
                    <button id="btn-export-questions" class="secondary-btn" title="Ekspor seluruh bank soal ke JSON">📤 Ekspor Soal (JSON)</button>
                    <button type="button" id="btn-export-xlsx" class="secondary-btn" title="Ekspor bank soal ke Excel modern">📗 Ekspor XLSX</button>
                    <button type="button" id="btn-export-xls" class="secondary-btn" title="Ekspor bank soal ke Excel 97–2003">📘 Ekspor XLS</button>
                    <button id="btn-switch-to-add" class="primary-btn" title="Buka form pembuatan soal baru">➕ Tambah Soal Baru</button>
                  </div>
                </div>

                <!-- Import Feedback Box -->
                <div id="import-feedback-box" class="import-feedback-box hidden"></div>

                <!-- Filter & Search Toolbar -->
                <div class="teacher-filters-bar">
                  <div class="filter-item">
                    <span>Kategori:</span>
                    <select id="filter-q-category">
                      <option value="all">Semua Kategori</option>
                      <option value="numerasi">Numerasi</option>
                      <option value="literasi">Literasi</option>
                    </select>
                  </div>
                  <div class="filter-item">
                    <span>Kelas:</span>
                    <select id="filter-q-grade">
                      <option value="all">Semua Kelas</option>
                      <option value="1">Kelas 1</option>
                      <option value="2">Kelas 2</option>
                      <option value="3">Kelas 3</option>
                      <option value="4">Kelas 4</option>
                      <option value="5">Kelas 5</option>
                      <option value="6">Kelas 6</option>
                    </select>
                  </div>
                  <div class="filter-item">
                    <span>Kesulitan:</span>
                    <select id="filter-q-diff">
                      <option value="all">Semua Kesulitan</option>
                      <option value="easy">Mudah</option>
                      <option value="medium">Sedang</option>
                      <option value="hard">Sulit</option>
                    </select>
                  </div>
                  <div class="filter-item">
                    <span>Mode:</span>
                    <select id="filter-q-mode">
                      <option value="all">Semua Mode</option>
                      <option value="general">Umum</option>
                      <option value="detective">Detektif</option>
                      <option value="motion_challenge">Tantangan Gerak</option>
                      <option value="arena">Arena</option>
                      <option value="team_battle">Pertarungan Tim</option>
                      <option value="cooperative">Kooperatif</option>
                      <option value="adventure">Petualangan</option>
                    </select>
                  </div>
                  <input type="text" id="filter-q-search" class="filter-search-input" placeholder="🔍 Cari pertanyaan atau topik materi..." />
                </div>

                <div id="custom-questions-list" class="custom-questions-list">
                  <!-- Injected via JS -->
                </div>
              </div>

              <!-- Tab 2: Question Editor (Create / Edit Mode) -->
              <div id="tab-add-question" class="tab-content active">
                <!-- Editing Alert Banner -->
                <div id="editing-banner" class="editing-banner hidden">
                  <span>✏️ <strong>Mode Edit:</strong> Memperbarui soal yang dipilih.</span>
                  <button type="button" id="btn-cancel-edit-banner" class="secondary-btn" style="padding: 4px 10px; font-size: 0.78rem;">Batal Edit</button>
                </div>

                <form id="form-add-question" class="question-form">
                  <input type="hidden" id="edit-q-id" value="" />

                  <div class="form-row">
                    <div class="form-group">
                      <label>Kategori Pembelajaran:</label>
                      <select id="new-q-category">
                        <option value="numerasi">Numerasi</option>
                        <option value="literasi">Literasi</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Jenjang Kelas SD:</label>
                      <select id="new-q-grade">
                        <option value="1">Kelas 1 (Fase A)</option>
                        <option value="2">Kelas 2 (Fase A)</option>
                        <option value="3">Kelas 3 (Fase B)</option>
                        <option value="4" selected>Kelas 4 (Fase B)</option>
                        <option value="5">Kelas 5 (Fase C)</option>
                        <option value="6">Kelas 6 (Fase C)</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label>Tingkat Kesulitan:</label>
                      <select id="new-q-difficulty">
                        <option value="easy">⭐ Mudah</option>
                        <option value="medium" selected>⭐⭐ Sedang</option>
                        <option value="hard">⭐⭐⭐ Sulit</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-row">
                    <div class="form-group" style="flex: 2;">
                      <label>Topik / Pokok Bahasan:</label>
                      <input type="text" id="new-q-topic" placeholder="Contoh: Operasi Perkalian / Antonim & Sinonim" required />
                    </div>
                    <div class="form-group" style="flex: 1;">
                      <label>Batas Waktu (Detik):</label>
                      <input type="number" id="new-q-time-limit" min="15" max="120" value="40" required />
                    </div>
                    <div class="form-group" style="flex: 1;">
                      <label>Bobot Skor (Poin):</label>
                      <input type="number" id="new-q-point-weight" min="50" max="500" step="10" value="100" required />
                    </div>
                    <div class="form-group" style="flex: 1.4;">
                      <label>Mode Permainan:</label>
                      <select id="new-q-game-mode">
                        <option value="">Umum (semua mode)</option>
                        <option value="detective">Detektif</option>
                        <option value="motion_challenge">Tantangan Gerak</option>
                        <option value="arena">Arena</option>
                        <option value="duel">Duel</option>
                        <option value="team_battle">Pertarungan Tim</option>
                        <option value="cooperative">Kooperatif</option>
                        <option value="adventure">Petualangan</option>
                      </select>
                    </div>
                  </div>

                  <div class="form-group">
                    <label>Teks Bacaan / Cerita (Opsional - untuk Literasi & Soal Detektif):</label>
                    <textarea id="new-q-passage" rows="2" placeholder="Tuliskan teks cerita singkat atau data pendukung..."></textarea>
                  </div>

                  <div class="question-media-editor">
                    <div class="form-group">
                      <label>Gambar Pendukung (Opsional — URL HTTPS):</label>
                      <input type="url" id="new-q-image-url" placeholder="https://contoh.sch.id/gambar-soal.jpg" inputmode="url" />
                      <small>Link gambar akan disimpan dan ikut diekspor dalam file JSON. Gunakan sumber yang aman dan memiliki izin penggunaan.</small>
                    </div>
                    <div class="form-group">
                      <label>Deskripsi Gambar:</label>
                      <input type="text" id="new-q-image-alt" maxlength="160" placeholder="Contoh: Diagram pecahan berbentuk lingkaran" />
                    </div>
                    <div class="form-group">
                      <label>Posisi Gambar:</label>
                      <select id="new-q-image-layout">
                        <option value="contain">Utuh di atas pertanyaan</option>
                        <option value="wide">Lebar seperti banner</option>
                        <option value="compact">Ringkas di samping/atas</option>
                      </select>
                    </div>
                    <div id="new-q-image-preview" class="question-image-preview hidden" aria-live="polite"></div>
                  </div>

                  <div class="form-group">
                    <label>Pertanyaan Soal:</label>
                    <input type="text" id="new-q-text" placeholder="Tuliskan pertanyaan soal di sini..." required />
                  </div>

                  <div class="form-grid-options">
                    <div class="form-group">
                      <label>Pilihan A (✋ Tangan Kiri Diangkat):</label>
                      <input type="text" id="new-q-opt-a" required />
                    </div>
                    <div class="form-group">
                      <label>Pilihan B (✋ Tangan Kanan Diangkat):</label>
                      <input type="text" id="new-q-opt-b" required />
                    </div>
                    <div class="form-group">
                      <label>Pilihan C (🙌 Kedua Tangan Diangkat):</label>
                      <input type="text" id="new-q-opt-c" required />
                    </div>
                    <div class="form-group">
                      <label>Pilihan D (🧘 Posisi Jongkok):</label>
                      <input type="text" id="new-q-opt-d" required />
                    </div>
                  </div>

                  <div class="form-row mt-3">
                    <div class="form-group" style="flex: 1;">
                      <label>Kunci Jawaban Benar:</label>
                      <select id="new-q-correct">
                        <option value="0">A (Pilihan A - Tangan Kiri)</option>
                        <option value="1">B (Pilihan B - Tangan Kanan)</option>
                        <option value="2">C (Pilihan C - Kedua Tangan)</option>
                        <option value="3">D (Pilihan D - Posisi Jongkok)</option>
                      </select>
                    </div>
                    <div class="form-group" style="flex: 2;">
                      <label>Penjelasan Pembahasan (Muncul saat feedback):</label>
                      <input type="text" id="new-q-explanation" placeholder="Alasan mengapa jawaban tersebut benar..." />
                    </div>
                  </div>

                  <div style="display: flex; gap: 12px; margin-top: 18px;">
                    <button type="submit" id="btn-submit-question" class="primary-btn">Kirim untuk Review ✅</button>
                    <button type="button" id="btn-cancel-edit" class="secondary-btn hidden">Batal Edit ❌</button>
                  </div>
                </form>
              </div>

              <div id="tab-my-submissions" class="tab-content">
                <div class="feature-panel-header"><div><h3>📝 Kontribusi Soal Saya</h3><p>Pantau status pending, disetujui, atau ditolak oleh super admin.</p></div><button id="btn-refresh-my-submissions" class="secondary-btn btn-sm">Muat Ulang</button></div>
                <div id="my-submissions-list" class="submission-list"></div>
              </div>

              <div id="tab-review-submissions" class="tab-content">
                <div class="feature-panel-header"><div><h3>✅ Antrean Review Soal</h3><p>Setujui soal untuk menerbitkannya ke bank soal atau berikan catatan penolakan.</p></div><button id="btn-refresh-review-submissions" class="secondary-btn btn-sm">Muat Ulang</button></div>
                <div id="review-submissions-list" class="submission-list"></div>
              </div>

              <!-- Session Packages -->
              <div id="tab-session-packages" class="tab-content">
                <div class="feature-panel-header">
                  <div><h3>🗂️ Paket Sesi Pembelajaran</h3><p>Simpan konfigurasi kelas agar dapat dijalankan kembali dalam satu klik.</p></div>
                </div>
                <form id="form-session-package" class="session-package-form">
                  <div class="form-group"><label>Nama Paket</label><input id="package-name" maxlength="80" placeholder="Contoh: Latihan Pecahan Kelas 4" required /></div>
                  <div class="form-group"><label>Mode</label><select id="package-mode"><option value="quick_quiz">Kuis Gerak</option><option value="detective">Literasi Detektif</option><option value="cooperative">Target Bersama</option><option value="presentation">Presentasi Guru (sentuh)</option></select></div>
                  <div class="form-group"><label>Kategori</label><select id="package-category"><option value="all">Campuran</option><option value="numerasi">Numerasi</option><option value="literasi">Literasi</option></select></div>
                  <div class="form-group"><label>Kelas</label><select id="package-grade">${[1,2,3,4,5,6].map((grade) => `<option value="${grade}" ${grade === 4 ? "selected" : ""}>Kelas ${grade}</option>`).join("")}</select></div>
                  <div class="form-group"><label>Kesulitan</label><select id="package-difficulty"><option value="all">Campuran</option><option value="easy">Mudah</option><option value="medium">Sedang</option><option value="hard">Sulit</option></select></div>
                  <div class="form-group"><label>Jumlah Soal</label><input id="package-count" type="number" min="3" max="20" value="8" /></div>
                  <button class="primary-btn" type="submit">Simpan Paket</button>
                </form>
                <div id="session-packages-list" class="session-packages-list"></div>
              </div>

              <!-- Media Library -->
              <div id="tab-media-library" class="tab-content">
                <div class="feature-panel-header"><div><h3>🖼️ Pustaka Media Soal</h3><p>Gambar dikumpulkan otomatis dari bank soal. Pilih gambar untuk digunakan kembali.</p></div></div>
                <div id="media-library-grid" class="media-library-grid"></div>
              </div>

              <!-- Tab 3: Learning Analytics Dashboard -->
              <div id="tab-analytics" class="tab-content">
                <div class="analytics-dashboard">
                  <div class="analytics-header">
                    <h3>📊 Ringkasan Capaian Belajar Siswa</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted);">Data otomatis dihimpun dari sesi pembelajaran kelas secara aman di peramban.</p>
                  </div>

                  <div id="analytics-summary-cards" class="analytics-stats-grid">
                    <!-- Injected via JS -->
                  </div>

                  <div id="analytics-weak-recommendations" class="analytics-recommendation-box">
                    <!-- Injected via JS -->
                  </div>

                  <div class="analytics-sessions-history">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; flex-wrap:wrap; gap:8px;">
                      <h4 style="margin:0; font-size: 1rem;">Riwayat Sesi Belajar & Permainan Kelas:</h4>
                      <button type="button" id="btn-refresh-analytics-firestore" class="secondary-btn btn-sm" title="Muat riwayat sesi terbaru dari Cloud Firestore">
                        🔄 Muat dari Firestore
                      </button>
                    </div>
                    <div id="analytics-sessions-list" class="custom-questions-list">
                      <!-- Injected via JS -->
                    </div>
                  </div>

                  <div class="privacy-notice-box" style="margin-top: 10px;">
                    <span class="privacy-icon">🛡️</span>
                    <p><strong>Privasi & Keamanan Terjamin:</strong> Sistem hanya menyimpan rekap skor numerik dan topik materi. Tidak ada rekaman kamera, foto siswa, maupun data biometrik yang disimpan.</p>
                  </div>
                </div>
              </div>

              <!-- Tab 4: Settings -->
              <div id="tab-settings" class="tab-content">
                <div class="form-grid">
                  <div class="form-group">
                    <label>Durasi Waktu Default Per Soal (detik):</label>
                    <input type="number" id="setting-timer" min="15" max="120" value="40" />
                  </div>
                  <div class="form-group">
                    <label>Kepekaan Gerakan (Confidence):</label>
                    <input type="range" id="setting-confidence" min="0.4" max="0.9" step="0.05" value="0.6" />
                    <span id="setting-confidence-val">0.60</span>
                  </div>
                  <div class="form-group">
                    <label>Jeda Cooldown Antar Gerakan (detik):</label>
                    <input type="number" id="setting-cooldown" min="0.5" max="3" step="0.1" value="1.2" />
                  </div>
                  <div class="form-group">
                    <label>Waktu Tahan Konfirmasi Jawaban (detik):</label>
                    <input type="number" id="setting-hold" min="0.3" max="1.5" step="0.1" value="0.45" />
                  </div>
                  <div class="form-group">
                    <label>Waktu Bersiap Gerakan (detik):</label>
                    <input type="number" id="setting-ready-countdown" min="3" max="10" step="1" value="5" />
                    <small>Countdown sebelum soal dimulai agar siswa sempat mengambil posisi.</small>
                  </div>
                  <div class="form-group">
                    <label>Bobot Skor Standar (Poin):</label>
                    <input type="number" id="setting-base-points" min="50" max="300" step="10" value="100" />
                  </div>
                  <div class="form-group"><label>Penyimpanan Database:</label><small>Firestore memakai sesi anonim otomatis. Rekaman kamera dan data biometrik tidak pernah disimpan.</small></div>
                  <div class="form-group"><label>Profil Gerakan:</label><select id="setting-movement-profile"><option value="standard">Standar (termasuk jongkok)</option><option value="hands_only">Hanya gerakan tangan</option></select><small>Profil tangan mengganti pilihan D menjadi silang tangan di depan dada.</small></div>
                  <div class="form-group"><label>Target Jawaban Benar Bersama:</label><input type="number" id="setting-cooperative-goal" min="3" max="20" value="7" /></div>
                  <label class="setting-check"><input type="checkbox" id="setting-large-text" /> Teks besar untuk layar kelas</label>
                  <label class="setting-check"><input type="checkbox" id="setting-high-contrast" /> Kontras tinggi</label>
                  <label class="setting-check"><input type="checkbox" id="setting-reduced-motion" /> Kurangi animasi</label>
                  <label class="setting-check"><input type="checkbox" id="setting-shuffle-options" /> Acak urutan pilihan jawaban</label>
                </div>
                <button id="btn-save-settings" class="primary-btn mt-4">Simpan Pengaturan Kelas</button>
              </div>

              <!-- Tab 5: Teams -->
              <div id="tab-teams" class="tab-content">
                <div class="teams-manager-container">
                  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 14px;">
                    <h3>Pengaturan 4 Tim Kelas (Team Battle)</h3>
                    <span style="font-size: 0.82rem; color: var(--text-muted);">Mendukung 2 hingga 4 tim bergantian</span>
                  </div>
                  <div id="teams-editor-grid" class="teams-editor-grid">
                    <!-- Teams injected via JS -->
                  </div>
                  <div class="team-actions mt-4">
                    <button id="btn-save-teams" class="primary-btn">Simpan Data Tim</button>
                    <button id="btn-reset-teams" class="danger-btn">Reset Skor Seluruh Tim</button>
                  </div>
                </div>
              </div>

              <!-- Tab 6: Cloud Firestore Management -->
              <div id="tab-firebase" class="tab-content">
                <div class="firebase-panel-container">
                  <div class="firebase-panel-header">
                    <div>
                      <h3 style="display:flex; align-items:center; gap:8px;">🔥 Integrasi Cloud Firestore (Bank Soal & Riwayat)</h3>
                      <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                        Sinkronisasi Bank Soal online dan Riwayat Pembelajaran kelas secara terpusat dan aman.
                      </p>
                    </div>
                    <div id="firebase-tab-status-badge" class="firestore-status-pill status-connecting">
                      <span class="status-dot"></span>
                      <span id="firebase-tab-status-label">Memeriksa status...</span>
                    </div>
                  </div>

                  <!-- Quick Stats Cards -->
                  <div class="firebase-stats-grid">
                    <div class="fb-stat-card">
                      <div class="fb-stat-icon">📚</div>
                      <div class="fb-stat-val" id="fb-stat-questions-count">0</div>
                      <div class="fb-stat-label">Soal di Cloud Firestore</div>
                    </div>
                    <div class="fb-stat-card">
                      <div class="fb-stat-icon">📜</div>
                      <div class="fb-stat-val" id="fb-stat-sessions-count">0</div>
                      <div class="fb-stat-label">Riwayat Sesi Tersimpan</div>
                    </div>
                    <div class="fb-stat-card">
                      <div class="fb-stat-icon">⚡</div>
                      <div class="fb-stat-val" id="fb-stat-status-text">Siap</div>
                      <div class="fb-stat-label">Status Koneksi</div>
                    </div>
                  </div>

                  <!-- Configuration Box -->
                  <div class="firebase-config-box">
                    <h4>⚙️ Kredensial Firebase Proyek</h4>
                    <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
                      Konfigurasi didapatkan dari <strong>Firebase Console &gt; Project Settings &gt; General &gt; Web apps</strong>. Tersimpan aman di peramban.
                    </p>

                    <form id="firebase-config-form" class="firebase-form-grid">
                      <div class="form-group">
                        <label>Project ID (Wajib):</label>
                        <input type="text" id="fb-input-project-id" placeholder="motion-smart-class" required />
                      </div>
                      <div class="form-group">
                        <label>API Key:</label>
                        <input type="text" id="fb-input-api-key" placeholder="AIzaSy..." required />
                      </div>
                      <div class="form-group">
                        <label>Auth Domain:</label>
                        <input type="text" id="fb-input-auth-domain" placeholder="project-id.firebaseapp.com" required />
                      </div>
                      <div class="form-group">
                        <label>App ID:</label>
                        <input type="text" id="fb-input-app-id" placeholder="1:123456789:web:abc..." required />
                      </div>

                      <div class="fb-form-actions">
                        <button type="button" id="btn-test-firebase-conn" class="secondary-btn">🧪 Uji Koneksi Firestore</button>
                        <button type="submit" id="btn-save-firebase-cfg" class="primary-btn">💾 Simpan & Terapkan</button>
                        <button type="button" id="btn-reset-firebase-cfg" class="secondary-btn" style="color: #DC2626;">🔄 Reset ke .env</button>
                      </div>
                    </form>

                    <div id="firebase-test-feedback" class="fb-feedback-box hidden"></div>
                  </div>

                  <!-- Cloud Operations Box -->
                  <div class="firebase-ops-box">
                    <h4>🛡️ Pengelolaan Database</h4>
                    <div class="ops-grid">
                      <div class="ops-item">
                        <h5>1. Publikasi &amp; Moderasi</h5>
                        <p>Publikasi, edit, penghapusan, dan review soal dilakukan melalui Firebase Console atau Admin SDK agar hak admin tidak dibuka di aplikasi publik.</p>
                      </div>
                      <div class="ops-item">
                        <h5>2. Aturan Keamanan (firestore.rules)</h5>
                        <p>Salin skrip aturan keamanan siap pakai yang menjamin validasi data soal dan perlindungan privasi siswa (tanpa video/biometrik).</p>
                        <button type="button" id="btn-copy-firestore-rules" class="secondary-btn btn-sm">📋 Salin Aturan firestore.rules</button>
                      </div>
                    </div>

                    <!-- Progress container -->
                    <div id="fb-seed-progress-container" class="fb-seed-progress hidden">
                      <div class="progress-bar-bg">
                        <div id="fb-seed-progress-bar" class="progress-bar-fill" style="width: 0%;"></div>
                      </div>
                      <span id="fb-seed-progress-text" class="progress-text">Mengunggah ke Firestore...</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.videoEl = document.getElementById("msc-video");
    this.canvasEl = document.getElementById("msc-canvas");
    this.debugPanelEl = document.getElementById("debug-overlay-card");
  }

  bindEvents() {
    // Brand returns Home
    document.getElementById("btn-brand-home").addEventListener("click", () => {
      this.audio.playClick();
      this.game.returnHome();
    });

    // Sound toggle
    document.getElementById("btn-sound-toggle").addEventListener("click", () => {
      const enabled = this.audio.toggleSound();
      document.getElementById("sound-icon").textContent = enabled ? "🔊" : "🔇";
      StorageManager.saveSettings({ soundEnabled: enabled });
      if (enabled) this.audio.playClick();
    });

    // Fullscreen toggle
    document.getElementById("btn-fullscreen-toggle").addEventListener("click", () => {
      this.audio.playClick();
      const isFs = !document.fullscreenElement;
      if (isFs) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Touch Mode toggle
    document.getElementById("btn-touch-toggle").addEventListener("click", () => {
      this.audio.playClick();
      this.toggleTouchMode();
    });

    // Teacher Mode Open
    document.getElementById("btn-teacher-open").addEventListener("click", () => {
      this.audio.playClick();
      this.openTeacherModal();
    });

    // Teacher Modal Close
    document.getElementById("btn-teacher-close").addEventListener("click", () => {
      this.audio.playClick();
      this.closeTeacherModal();
    });

    document.getElementById("btn-admin-login-open").addEventListener("click", () => this.showAdminLoginForm());
    document.getElementById("btn-admin-login-cancel").addEventListener("click", () => this.hideAdminLoginForm());
    document.getElementById("admin-login-form").addEventListener("submit", (event) => this.handleAdminLogin(event));
    document.getElementById("btn-admin-logout").addEventListener("click", () => this.handleAdminLogout());

    // Teacher Modal Tabs
    document.querySelectorAll(".modal-tabs .tab-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.audio.playClick();
        document.querySelectorAll(".modal-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        const tabId = btn.getAttribute("data-tab");
        const content = document.getElementById(tabId);
        if (content) content.classList.add("active");

        if (tabId === "tab-analytics") {
          this.renderAnalyticsDashboard();
        } else if (tabId === "tab-custom-questions") {
          this.renderCustomQuestionsList();
        } else if (tabId === "tab-teams") {
          this.renderTeamsEditor();
        } else if (tabId === "tab-session-packages") {
          this.renderSessionPackages();
        } else if (tabId === "tab-media-library") {
          this.renderMediaLibrary();
        } else if (tabId === "tab-firebase") {
          this.renderFirebasePanel();
        } else if (tabId === "tab-my-submissions") {
          this.renderMySubmissions();
        } else if (tabId === "tab-review-submissions") {
          this.renderReviewSubmissions();
        }
      });
    });

    document.getElementById("btn-refresh-my-submissions")?.addEventListener("click", () => this.renderMySubmissions());
    document.getElementById("btn-refresh-review-submissions")?.addEventListener("click", () => this.renderReviewSubmissions());

    // Flip Camera Button
    document.getElementById("btn-flip-cam").addEventListener("click", async () => {
      this.audio.playClick();
      await this.camera.flipCamera();
    });

    document.getElementById("btn-camera-retry").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      this.audio.playClick();
      button.disabled = true;
      button.textContent = "Mencoba kamera...";
      await this.startCameraSession();
      button.disabled = false;
      button.textContent = "↻ Coba Kamera Lagi";
    });

    document.getElementById("btn-camera-touch").addEventListener("click", () => {
      this.audio.playClick();
      const calibrationTouch = document.getElementById("btn-calib-touch");
      if (calibrationTouch) {
        calibrationTouch.click();
        return;
      }
      this.pose.stopDetection();
      this.camera.stopCamera();
      if (!this.game.touchMode) this.toggleTouchMode();
      if (this.game.state === GAME_STATES.GESTURE_TRAINING) this.game.setState(GAME_STATES.HOME);
    });

    // Skeleton Overlay Toggle
    document.getElementById("btn-toggle-skeleton").addEventListener("click", () => {
      this.audio.playClick();
      this.pose.showSkeleton = !this.pose.showSkeleton;
    });

    // Debug Panel Toggle
    document.getElementById("btn-toggle-debug").addEventListener("click", () => {
      this.audio.playClick();
      this.debugPanelEl.classList.toggle("hidden");
    });

    // Save Settings in Teacher Mode
    document.getElementById("btn-save-settings").addEventListener("click", () => {
      this.audio.playClick();
      const timer = parseInt(document.getElementById("setting-timer").value, 10) || 40;
      const conf = parseFloat(document.getElementById("setting-confidence").value) || 0.6;
      const cooldown = parseFloat(document.getElementById("setting-cooldown").value) || 1.2;
      const hold = parseFloat(document.getElementById("setting-hold").value) || 0.45;
      const readyCountdown = Math.min(10, Math.max(3, parseInt(document.getElementById("setting-ready-countdown").value, 10) || 5));
      const movementProfile = document.getElementById("setting-movement-profile").value;

      const updatedSettings = {
        timerSeconds: timer,
        confidenceThreshold: conf,
        cooldownSeconds: cooldown,
        holdDurationSeconds: hold,
        readyCountdownSeconds: readyCountdown,
        movementProfile,
        cooperativeGoal: Math.min(20, Math.max(3, parseInt(document.getElementById("setting-cooperative-goal").value, 10) || 7)),
        largeText: document.getElementById("setting-large-text").checked,
        highContrast: document.getElementById("setting-high-contrast").checked,
        reducedMotion: document.getElementById("setting-reduced-motion").checked,
        shuffleOptions: document.getElementById("setting-shuffle-options").checked,
        basePoints: parseInt(document.getElementById("setting-base-points").value, 10) || 100
      };
      StorageManager.saveSettings(updatedSettings);

      this.gesture.setThresholds({
        confidence: conf,
        holdMs: hold * 1000,
        cooldownMs: cooldown * 1000
      });
      this.gesture.setMovementProfile(movementProfile);

      this.applyAccessibilitySettings();

      alert("Pengaturan kelas berhasil disimpan!");
    });

    document.getElementById("setting-confidence").addEventListener("input", (e) => {
      document.getElementById("setting-confidence-val").textContent = parseFloat(e.target.value).toFixed(2);
    });

    document.getElementById("new-q-image-url")?.addEventListener("input", () => {
      this.updateQuestionImagePreview();
    });
    document.getElementById("new-q-image-alt")?.addEventListener("input", () => {
      const previewImage = document.querySelector("#new-q-image-preview img");
      if (previewImage) previewImage.alt = document.getElementById("new-q-image-alt").value.trim() || "Pratinjau gambar soal";
    });

    // Switch to Add Question Tab button
    document.getElementById("btn-switch-to-add").addEventListener("click", () => {
      this.audio.playClick();
      this.resetQuestionForm();
      document.querySelectorAll(".modal-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      const addTabBtn = document.querySelector('.modal-tabs .tab-btn[data-tab="tab-add-question"]');
      if (addTabBtn) addTabBtn.classList.add("active");
      document.getElementById("tab-add-question").classList.add("active");
    });

    // Cancel Edit buttons
    const cancelEditHandler = () => {
      this.audio.playClick();
      this.resetQuestionForm();
    };
    document.getElementById("btn-cancel-edit").addEventListener("click", cancelEditHandler);
    document.getElementById("btn-cancel-edit-banner").addEventListener("click", cancelEditHandler);

    // Form Add / Update Question
    document.getElementById("form-add-question").addEventListener("submit", async (e) => {
      e.preventDefault();
      this.audio.playClick();

      const editId = document.getElementById("edit-q-id").value;
      const rawImageUrl = document.getElementById("new-q-image-url").value.trim();
      const imageUrl = safeImageUrl(rawImageUrl);
      if (rawImageUrl && !imageUrl) {
        alert("Link gambar tidak valid. Gunakan URL HTTPS yang lengkap.");
        document.getElementById("new-q-image-url").focus();
        return;
      }
      const questionData = {
        category: document.getElementById("new-q-category").value,
        grade: parseInt(document.getElementById("new-q-grade").value, 10),
        difficulty: document.getElementById("new-q-difficulty").value,
        topic: document.getElementById("new-q-topic").value.trim(),
        timeLimit: parseInt(document.getElementById("new-q-time-limit").value, 10) || 40,
        pointWeight: parseInt(document.getElementById("new-q-point-weight").value, 10) || 100,
        gameModes: document.getElementById("new-q-game-mode").value
          ? [document.getElementById("new-q-game-mode").value]
          : [],
        passage: document.getElementById("new-q-passage").value.trim(),
        question: document.getElementById("new-q-text").value.trim(),
        options: [
          document.getElementById("new-q-opt-a").value.trim(),
          document.getElementById("new-q-opt-b").value.trim(),
          document.getElementById("new-q-opt-c").value.trim(),
          document.getElementById("new-q-opt-d").value.trim()
        ],
        correctAnswer: parseInt(document.getElementById("new-q-correct").value, 10),
        explanation: document.getElementById("new-q-explanation").value.trim(),
        imageUrl,
        imageAlt: document.getElementById("new-q-image-alt").value.trim(),
        imageLayout: document.getElementById("new-q-image-layout").value,
        gestureMap: StorageManager.getSettings().movementProfile === "hands_only"
          ? { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "CROSS_ARMS" }
          : { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" }
      };

      const submitButton = document.getElementById("btn-submit-question");
      submitButton.disabled = true;
      submitButton.textContent = "Mengirim...";
      try {
        if (editId) {
          const editingSource = document.getElementById("edit-q-id").dataset.source || "local";
          if (editingSource === "firestore") {
            if (!this.adminSession) throw new Error("Login admin diperlukan untuk mengubah soal cloud.");
            await FirestoreManager.updateQuestion(editId, questionData);
            await this.syncQuestionsFromFirestore(false);
            alert("Perubahan soal cloud berhasil diterbitkan.");
          } else {
            StorageManager.updateCustomQuestion(editId, questionData);
            alert("Perubahan soal lokal berhasil disimpan.");
          }
        } else if (this.adminSession) {
          await FirestoreManager.saveQuestion(questionData);
          await this.syncQuestionsFromFirestore(false);
          alert("Soal baru berhasil diterbitkan ke bank soal.");
        } else {
          await FirestoreManager.submitQuestionForReview(questionData);
          alert("Soal berhasil dikirim. Super admin akan meninjau sebelum soal diterbitkan.");
        }
        this.resetQuestionForm();
        if (editId || this.adminSession) {
          this.activateStudioTab("tab-custom-questions");
          this.renderCustomQuestionsList();
        } else {
          this.activateStudioTab("tab-my-submissions");
          await this.renderMySubmissions();
        }
      } catch (error) {
        alert(error.message || "Soal belum dapat dikirim.");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = this.adminSession ? "Terbitkan Soal 💾" : "Kirim untuk Review ✅";
      }
    });

    // Import JSON File Listener with Schema Validation
    const importInput = document.getElementById("import-json-input");
    importInput.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const feedbackBox = document.getElementById("import-feedback-box");
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const result = StorageManager.importCustomQuestions(parsed);

          feedbackBox.classList.remove("hidden", "success", "error");
          if (result.success) {
            this.audio.playCorrect();
            feedbackBox.classList.add("success");
            feedbackBox.textContent = `✅ Impor Berhasil: ${result.importedCount} soal baru berhasil ditambahkan! (Total: ${result.totalCount} soal)`;
            this.renderCustomQuestionsList();
          } else {
            this.audio.playWrong();
            feedbackBox.classList.add("error");
            feedbackBox.textContent = `⚠️ Impor Gagal: ${result.error}`;
          }
        } catch (err) {
          this.audio.playWrong();
          feedbackBox.classList.remove("hidden", "success");
          feedbackBox.classList.add("error");
          feedbackBox.textContent = `⚠️ File Rusak: Format JSON tidak valid (${err.message}).`;
        }
        // Reset file input
        importInput.value = "";
      };

      reader.onerror = () => {
        this.audio.playWrong();
        alert("Gagal membaca file.");
        importInput.value = "";
      };

      reader.readAsText(file);
    });

    const csvInput = document.getElementById("import-csv-input");
    csvInput?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ({ target }) => {
        const result = StorageManager.importQuestionsFromCSV(target.result);
        const feedbackBox = document.getElementById("import-feedback-box");
        feedbackBox.classList.remove("hidden", "success", "error");
        feedbackBox.classList.add(result.success ? "success" : "error");
        feedbackBox.textContent = result.success
          ? `✅ ${result.importedCount} soal berhasil diimpor dari CSV.`
          : `⚠️ Impor CSV gagal: ${result.error}`;
        if (result.success) this.renderCustomQuestionsList();
        csvInput.value = "";
      };
      reader.readAsText(file);
    });
    document.getElementById("btn-download-csv-template")?.addEventListener("click", () => {
      const headers = "question,optionA,optionB,optionC,optionD,correctAnswer,category,grade,difficulty,topic,gameModes,imageUrl,imageAlt,explanation\n";
      const example = '"Berapa 6 x 7?",36,40,42,48,C,numerasi,4,medium,Perkalian,motion_challenge,,,"6 x 7 = 42"\n';
      const link = document.createElement("a");
      link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(headers + example)}`;
      link.download = "template_soal_motion_smart_class.csv";
      link.click();
    });

    const excelInput = document.getElementById("import-excel-input");
    excelInput?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const feedbackBox = document.getElementById("import-feedback-box");
      feedbackBox.classList.remove("hidden", "success", "error");
      if (file.size > 10 * 1024 * 1024) {
        feedbackBox.classList.add("error");
        feedbackBox.textContent = "⚠️ File Excel terlalu besar. Maksimum 10 MB.";
        excelInput.value = "";
        return;
      }
      feedbackBox.textContent = "Membaca workbook Excel...";
      try {
        const questions = await readQuestionWorkbook(await file.arrayBuffer());
        const result = StorageManager.importCustomQuestions(questions);
        feedbackBox.classList.add(result.success ? "success" : "error");
        feedbackBox.textContent = result.success
          ? `✅ Impor Excel berhasil: ${result.importedCount} soal baru ditambahkan.`
          : `⚠️ Impor Excel gagal: ${result.error}`;
        if (result.success) this.renderCustomQuestionsList();
      } catch (error) {
        feedbackBox.classList.add("error");
        feedbackBox.textContent = `⚠️ Workbook tidak dapat dibaca: ${error.message}`;
      } finally {
        excelInput.value = "";
      }
    });

    const exportExcel = async (bookType) => {
      try {
        const questions = StorageManager.getCustomQuestions();
        const workbookData = await createQuestionWorkbook(questions, bookType);
        downloadWorkbook(workbookData, `soal_motion_smart_class.${bookType}`);
      } catch (error) {
        alert(`Ekspor Excel gagal: ${error.message}`);
      }
    };
    document.getElementById("btn-export-xlsx")?.addEventListener("click", () => exportExcel("xlsx"));
    document.getElementById("btn-export-xls")?.addEventListener("click", () => exportExcel("xls"));

    document.getElementById("form-session-package")?.addEventListener("submit", (event) => {
      event.preventDefault();
      StorageManager.saveSessionPackage({
        name: document.getElementById("package-name").value,
        mode: document.getElementById("package-mode").value,
        category: document.getElementById("package-category").value,
        grade: document.getElementById("package-grade").value,
        difficulty: document.getElementById("package-difficulty").value,
        count: document.getElementById("package-count").value
      });
      event.currentTarget.reset();
      document.getElementById("package-count").value = 8;
      this.renderSessionPackages();
    });

    // Question Filters and Search
    const filterHandler = () => this.applyQuestionFilters();
    document.getElementById("filter-q-category").addEventListener("change", filterHandler);
    document.getElementById("filter-q-grade").addEventListener("change", filterHandler);
    document.getElementById("filter-q-diff").addEventListener("change", filterHandler);
    document.getElementById("filter-q-mode").addEventListener("change", filterHandler);
    document.getElementById("filter-q-search").addEventListener("input", filterHandler);

    // Reset Teams button
    document.getElementById("btn-reset-teams").addEventListener("click", () => {
      if (confirm("Reset seluruh skor tim ke 0?")) {
        this.audio.playClick();
        StorageManager.resetTeams();
        this.renderTeamsEditor();
      }
    });

    // Save Teams button
    document.getElementById("btn-save-teams").addEventListener("click", () => {
      this.audio.playClick();
      const teams = StorageManager.getTeams();
      teams.forEach((t) => {
        const nameInput = document.getElementById(`team-name-${t.id}`);
        const scoreInput = document.getElementById(`team-score-${t.id}`);
        if (nameInput) t.name = nameInput.value.trim();
        if (scoreInput) t.score = parseInt(scoreInput.value, 10) || 0;
      });
      StorageManager.saveTeams(teams);
      alert("Data tim berhasil disimpan!");
    });

    // Export questions
    document.getElementById("btn-export-questions").addEventListener("click", () => {
      this.audio.playClick();
      const customQ = StorageManager.getCustomQuestions();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(customQ, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "soal_motion_smart_class.json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Listen to Camera Manager status
    this.camera.onStatusChange((status, errorMsg, errorDetails) => {
      this.updateCameraStatusPill(status, errorMsg, errorDetails);
    });

    // Listen to Gesture Engine hold progress
    this.gesture.onGestureProgress = (progress, gesture) => {
      this.updateHoldMeter(progress, gesture);
    };

    // Listen to Game Engine state change
    this.game.onStateChange = (state, payload) => {
      this.renderState(state, payload);
    };

    // Listen to Game Engine timer tick
    this.game.onTimerTick = (timeLeft, totalTime) => {
      this.updateTimerHUD(timeLeft, totalTime);
    };

    // Listen to Boss HP update
    this.game.onBossHpUpdate = (currentHp, maxHp) => {
      this.updateBossHpBar(currentHp, maxHp);
    };

    // Set initial settings into controls
    const settings = StorageManager.getSettings();
    document.getElementById("setting-timer").value = settings.timerSeconds;
    document.getElementById("setting-confidence").value = settings.confidenceThreshold;
    document.getElementById("setting-confidence-val").textContent = settings.confidenceThreshold.toFixed(2);
    document.getElementById("setting-cooldown").value = settings.cooldownSeconds;
    document.getElementById("setting-hold").value = settings.holdDurationSeconds;
    document.getElementById("setting-ready-countdown").value = settings.readyCountdownSeconds;
    document.getElementById("setting-base-points").value = settings.basePoints;
    document.getElementById("setting-movement-profile").value = settings.movementProfile;
    document.getElementById("setting-cooperative-goal").value = settings.cooperativeGoal;
    document.getElementById("setting-large-text").checked = settings.largeText;
    document.getElementById("setting-high-contrast").checked = settings.highContrast;
    document.getElementById("setting-reduced-motion").checked = settings.reducedMotion;
    document.getElementById("setting-shuffle-options").checked = settings.shuffleOptions;
    this.applyAccessibilitySettings();

    // Cloud Firestore Events & Synchronization
    this.bindFirestoreEvents();
  }

  toggleTouchMode() {
    this.game.touchMode = !this.game.touchMode;
    const textEl = document.getElementById("touch-toggle-text");
    if (this.game.touchMode) {
      textEl.textContent = "Mode: Sentuh 🎮";
      document.getElementById("cam-pip-container").classList.add("hidden");
    } else {
      textEl.textContent = "Mode: Gerak 🕺";
      if (this.game.state === GAME_STATES.QUESTION_ACTIVE || this.game.state === GAME_STATES.CALIBRATION) {
        document.getElementById("cam-pip-container").classList.remove("hidden");
      }
    }
  }

  updateCameraStatusPill(status, errorMsg, errorDetails = null) {
    const pill = document.getElementById("cam-status-pill");
    const text = document.getElementById("cam-status-text");
    pill.className = "cam-status-pill";

    if (status === CAMERA_STATUS.READY) {
      pill.classList.add("status-ready");
      text.textContent = "CAMERA READY";
      this.updateCameraIssuePanel(null);
    } else if (status === CAMERA_STATUS.CONNECTING) {
      pill.classList.add("status-detecting");
      text.textContent = "DETECTING...";
      this.updateCameraIssuePanel(null);
    } else if (status === CAMERA_STATUS.ERROR) {
      pill.classList.add("status-error");
      text.textContent = "CAMERA UNAVAILABLE";
      pill.title = errorMsg || "Kamera bermasalah";
      this.updateCameraIssuePanel(errorDetails || {
        title: "Kamera tidak tersedia",
        message: errorMsg || "Kamera tidak dapat dibuka.",
        action: "Tutup aplikasi lain yang memakai kamera, lalu coba kembali.",
        code: "CameraError"
      });
    } else {
      pill.classList.add("status-off");
      text.textContent = "CAMERA OFF";
      this.updateCameraIssuePanel(null);
    }
  }

  updateCameraIssuePanel(details) {
    const panel = document.getElementById("camera-issue-panel");
    if (!panel) return;
    panel.classList.toggle("hidden", !details);
    if (!details) return;
    document.getElementById("camera-issue-title").textContent = details.title || "Kamera tidak tersedia";
    document.getElementById("camera-issue-message").textContent = details.message || "Kamera tidak dapat dibuka.";
    document.getElementById("camera-issue-action").textContent = details.action || "Tekan Coba Kamera Lagi.";
    document.getElementById("camera-issue-code").textContent = details.code || "CameraError";
    document.getElementById("btn-camera-retry").classList.toggle("hidden", details.canRetry === false);
  }

  updateHoldMeter(progress, gesture) {
    const container = document.getElementById("hold-meter-container");
    const circle = document.getElementById("hold-circle");
    const label = document.getElementById("hold-meter-label");

    if (progress <= 0 || gesture === GESTURE_TYPES.NONE) {
      container.classList.add("hidden");
      return;
    }

    container.classList.remove("hidden");
    const circumference = 2 * Math.PI * 44; // ~276.46
    const offset = circumference - progress * circumference;
    circle.style.strokeDashoffset = offset;

    const percent = Math.round(progress * 100);
    label.textContent = `${percent}%`;

    // Highlight corresponding option card in real-time
    this.highlightActiveOptionCard(gesture);
  }

  highlightActiveOptionCard(gesture) {
    document.querySelectorAll(".option-card").forEach((card) => {
      card.classList.remove("holding");
    });

    let targetCard = null;
    if (gesture === GESTURE_TYPES.A) targetCard = document.getElementById("opt-card-0");
    else if (gesture === GESTURE_TYPES.B) targetCard = document.getElementById("opt-card-1");
    else if (gesture === GESTURE_TYPES.C) targetCard = document.getElementById("opt-card-2");
    else if (gesture === GESTURE_TYPES.D) targetCard = document.getElementById("opt-card-3");

    if (targetCard) {
      targetCard.classList.add("holding");
    }
  }

  updateLiveGestureBanner(gestureName, confidence) {
    const banner = document.getElementById("live-gesture-banner");
    const text = document.getElementById("gesture-banner-text");
    const icon = document.getElementById("gesture-banner-icon");

    if (!gestureName || gestureName === GESTURE_TYPES.NONE) {
      banner.className = "live-gesture-banner";
      text.textContent = "Menunggu Gerakan...";
      icon.textContent = "👀";
      return;
    }

    banner.className = "live-gesture-banner active";
    text.textContent = GESTURE_LABELS[gestureName] || gestureName;

    if (gestureName === GESTURE_TYPES.A) icon.textContent = "✋";
    else if (gestureName === GESTURE_TYPES.B) icon.textContent = "✋";
    else if (gestureName === GESTURE_TYPES.C) icon.textContent = "🙌";
    else if (gestureName === GESTURE_TYPES.D) icon.textContent = "🧘";
    else if (gestureName === GESTURE_TYPES.BONUS) icon.textContent = "✨";
    else if (gestureName === GESTURE_TYPES.SKIP) icon.textContent = "↔️";
  }

  updateDebugStats({ fps, poseConfidence, landmarks, gesture }) {
    if (!this.debugPanelEl || this.debugPanelEl.classList.contains("hidden")) return;

    document.getElementById("debug-fps").textContent = fps;
    document.getElementById("debug-conf").textContent = `${Math.round(poseConfidence * 100)}%`;

    if (landmarks && landmarks.length > 16) {
      const lw = landmarks[15];
      const rw = landmarks[16];
      const ls = landmarks[11];
      const rs = landmarks[12];
      document.getElementById("debug-left-wrist").textContent = lw ? `(${lw.x.toFixed(2)}, ${lw.y.toFixed(2)})` : "-";
      document.getElementById("debug-right-wrist").textContent = rw ? `(${rw.x.toFixed(2)}, ${rw.y.toFixed(2)})` : "-";
      document.getElementById("debug-shoulders").textContent = ls && rs ? `Y: ${ls.y.toFixed(2)} / ${rs.y.toFixed(2)}` : "-";
    }
    document.getElementById("debug-gesture").textContent = gesture ? gesture.label : "-";
  }

  // Render State
  renderState(state, payload = {}) {
    const main = document.getElementById("msc-main");
    const camPip = document.getElementById("cam-pip-container");
    const guideBox = document.getElementById("cam-guide-box");
    const appEl = document.getElementById("msc-app");
    camPip?.classList.toggle("realtime-calibration", state === GAME_STATES.CALIBRATION);

    // Reparent cam-pip-container back to msc-app if transitioning away from CALIBRATION
    if (state !== GAME_STATES.CALIBRATION && state !== GAME_STATES.GESTURE_TRAINING) {
      if (appEl && camPip && camPip.parentElement !== appEl) {
        appEl.appendChild(camPip);
        if (this.videoEl) this.videoEl.play().catch(() => {});
      }
    }

    // Manage camera visibility
    if (state === GAME_STATES.CALIBRATION || state === GAME_STATES.GESTURE_TRAINING) {
      camPip.classList.remove("hidden");
      camPip.classList.add("calibration-view");
      guideBox.classList.remove("hidden");
      this.startCameraSession();
    } else if (state === GAME_STATES.QUESTION_ACTIVE || state === GAME_STATES.MULTIPLAYER_PLAYER_GAME) {
      camPip.classList.toggle("hidden", this.game.touchMode);
      camPip.classList.remove("calibration-view");
      guideBox.classList.add("hidden");
      this.startCameraSession();
    } else if (state === GAME_STATES.FEEDBACK) {
      // Keep PIP
    } else {
      camPip.classList.add("hidden");
      camPip.classList.remove("calibration-view");
      guideBox.classList.add("hidden");
      this.pose.stopDetection();
      this.camera.stopCamera();
    }

    switch (state) {
      case GAME_STATES.HOME:
        this.renderHomeScreen(main);
        break;
      case GAME_STATES.ADVENTURE_MAP:
        this.renderAdventureMapScreen(main, payload);
        break;
      case GAME_STATES.TEAM_SETUP:
        this.renderTeamSetupScreen(main, payload);
        break;
      case GAME_STATES.GRADE_SELECT:
        this.renderGradeSelectScreen(main);
        break;
      case GAME_STATES.DIFFICULTY_SELECT:
        this.renderDifficultySelectScreen(main);
        break;
      case GAME_STATES.CALIBRATION:
        this.renderCalibrationScreen(main);
        break;
      case GAME_STATES.GESTURE_TRAINING:
        this.renderGestureTrainingScreen(main);
        break;
      case GAME_STATES.COUNTDOWN:
        this.renderCountdownScreen(main, payload.countdown);
        break;
      case GAME_STATES.QUESTION_ACTIVE:
        this.renderQuestionScreen(main, payload);
        break;
      case GAME_STATES.FEEDBACK:
        this.renderFeedbackOverlay(payload);
        break;
      case GAME_STATES.RESULT:
        this.renderResultScreen(main, payload);
        break;
      case GAME_STATES.MULTIPLAYER_HUB:
        this.renderMultiplayerHubScreen(main);
        break;
      case GAME_STATES.MULTIPLAYER_HOST_LOBBY:
        this.renderMultiplayerHostLobby(main, payload);
        break;
      case GAME_STATES.MULTIPLAYER_JOIN:
        this.renderMultiplayerJoinScreen(main);
        break;
      case GAME_STATES.MULTIPLAYER_PLAYER_LOBBY:
        this.renderMultiplayerPlayerLobby(main);
        break;
      case GAME_STATES.MULTIPLAYER_HOST_GAME:
        this.renderMultiplayerHostGame(main);
        break;
      case GAME_STATES.MULTIPLAYER_PLAYER_GAME:
        this.renderMultiplayerPlayerGame(main);
        break;
      case GAME_STATES.MULTIPLAYER_ROUND_RESULT:
        this.renderMultiplayerRoundResult(main);
        break;
      case GAME_STATES.MULTIPLAYER_PODIUM:
        this.renderMultiplayerPodium(main);
        break;
    }
    queueMicrotask(() => main?.focus({ preventScroll: true }));
  }

  async startCameraSession() {
    if (this.game.touchMode) return;

    if (!this.pose.isModelLoaded) {
      await this.pose.loadModel();
    }

    this.pose.stopDetection();
    const res = await this.camera.startCamera(this.videoEl);
    if (res.success) {
      this.pose.startDetection({
        videoElement: this.videoEl,
        canvasElement: this.canvasEl,
        onResults: ({ landmarks, poseConfidence, fps, calibration, detectorMode, detectorError }) => {
          this.handlePoseResults({ landmarks, poseConfidence, fps, calibration, detectorMode, detectorError });
        }
      });
    } else {
      // Prompt Touch Mode fallback
      console.warn("Camera failed to start, offering Touch Mode fallback.");
    }
  }

  handlePoseResults({ landmarks, poseConfidence, fps, calibration, detectorMode, detectorError }) {
    const isArena = this.game.selectedMode === GAME_MODES.ARENA;
    const playerPos = this.gesture.estimatePlayerPosition(landmarks);

    // If in Calibration, update calibration checklist + Arena distance/lighting gauges
    if (this.game.state === GAME_STATES.CALIBRATION) {
      this.updateCalibrationUI(calibration, playerPos, { poseConfidence, fps, detectorMode, detectorError });
    }

    // Motion Arena Zone classification
    if (isArena && this.game.state === GAME_STATES.QUESTION_ACTIVE) {
      const arenaZone = this.gesture.classifyArenaZone(landmarks);
      this.updateArenaZoneHighlight(arenaZone.zone, playerPos);
    }

    // Process gestures
    const gestureResult = this.gesture.processLandmarks(landmarks);

    if (detectorError) {
      const bannerIcon = document.getElementById("gesture-banner-icon");
      const bannerText = document.getElementById("gesture-banner-text");
      if (bannerIcon) bannerIcon.textContent = "⚠️";
      if (bannerText) bannerText.textContent = detectorError.message;
    } else if (!landmarks || poseConfidence < 0.42) {
      const bannerIcon = document.getElementById("gesture-banner-icon");
      const bannerText = document.getElementById("gesture-banner-text");
      if (bannerIcon) bannerIcon.textContent = "🧍";
      if (bannerText) bannerText.textContent = "Pastikan tubuh terlihat dan ruangan cukup terang";
    } else {
      this.updateLiveGestureBanner(gestureResult.gesture, gestureResult.confidence);
    }
    this.updateDebugStats({ fps, poseConfidence, landmarks, gesture: gestureResult });

    // Handle confirmed gesture
    if (gestureResult.confirmed) {
      this.audio.playBonus();
      if (this.game.state === GAME_STATES.GESTURE_TRAINING) {
        this.trainingGestures.add(gestureResult.gesture);
        this.updateGestureTrainingUI(gestureResult.gesture);
      } else if (this.game.state === GAME_STATES.QUESTION_ACTIVE) {
        this.game.submitAnswerByGesture(gestureResult.gesture);
      } else if (this.game.state === GAME_STATES.MULTIPLAYER_PLAYER_GAME) {
        this.handleMultiplayerPlayerGesture(gestureResult.gesture);
      }
    }
  }

  updateArenaZoneHighlight(zone, playerPos) {
    // Clear previous reach active classes
    ["a", "b", "c", "d"].forEach((z) => {
      const el = document.getElementById(`opt-zone-${z}`);
      if (el) el.classList.remove("zone-reach-active");
    });

    if (zone) {
      const activeEl = document.getElementById(`opt-zone-${zone.toLowerCase()}`);
      if (activeEl) activeEl.classList.add("zone-reach-active");
    }

    // Update Player Indicator in Arena HUD
    const indicatorEl = document.getElementById("arena-player-status");
    if (indicatorEl && playerPos) {
      const lockText = playerPos.playerLocked ? "✅ Terkunci di Tengah" : "⚠️ Menyesuaikan Posisi";
      indicatorEl.innerHTML = `
        <span>🧍 Pemain: <strong>${lockText}</strong></span>
        <span>📏 Jarak: <strong>${playerPos.distanceStatus}</strong></span>
        <span>💡 Cahaya: <strong>${playerPos.lightingQuality}</strong></span>
      `;
    }
  }

  // ==========================================
  // SCREEN 1: HOME SCREEN
  // ==========================================
  renderHomeScreen(container) {
    const teams = StorageManager.getTeams();
    const stats = StorageManager.getStats();

    container.innerHTML = `
      <div class="screen-home animate-fade-in">
        <div class="home-hero">
          <div class="hero-badge">RUANG BELAJAR AKTIF • AMAN • INKLUSIF</div>
          <h2 class="hero-title">Belajar lebih fokus.<br /><span>Bergerak lebih percaya diri.</span></h2>
          <p class="hero-subtitle">Pengalaman numerasi dan literasi berbasis gerak untuk kelas yang sehat, menyenangkan, dan terarah.</p>
          <div class="hero-trust-row" aria-label="Keunggulan aplikasi">
            <span>🛡️ Privasi kamera terjaga</span>
            <span>🎓 Dirancang untuk siswa SD</span>
            <span>👩‍🏫 Kendali penuh untuk guru</span>
          </div>
        </div>

        <!-- SPECIAL ONLINE MULTIPLAYER HERO BANNER -->
        <div class="multiplayer-hero-banner animate-scale-up">
          <div class="mp-banner-glow"></div>
          <div class="mp-banner-content">
            <div class="mp-badge-tag">🌐 BARU: MULTIPLAYER ONLINE REAL-TIME</div>
            <h3 class="mp-banner-title">GAME SHOW KELAS INTERAKTIF</h3>
            <p class="mp-banner-desc">Guru buka Room di Layar Kelas (PID). Siswa gabung lewat HP di meja masing-masing &amp; jawab dengan gerak tubuh!</p>
            <div class="mp-banner-actions">
              <button class="mp-cta-btn host-cta" id="btn-quick-host">👑 Buat Room (Host / Guru)</button>
              <button class="mp-cta-btn join-cta" id="btn-quick-join">📱 Gabung PIN (Siswa)</button>
            </div>
          </div>
        </div>

        <!-- ALL GAME MODES GRID -->
        <div class="game-modes-grid">
          <!-- Mode 1: Numerasi -->
          <div class="mode-card mode-numerasi" id="mode-btn-numerasi">
            <div class="mode-card-icon">🔢</div>
            <div class="mode-card-badge">AKM & Hitungan</div>
            <h3 class="mode-title">NUMERASI</h3>
            <p class="mode-desc">Operasi hitung, kelipatan, pecahan, geometri, dan pola angka dengan gerakan tubuh!</p>
            <button class="mode-play-btn">Mulai Numerasi ▶</button>
          </div>

          <!-- Mode 2: Literasi -->
          <div class="mode-card mode-literasi" id="mode-btn-literasi">
            <div class="mode-card-icon">📚</div>
            <div class="mode-card-badge">Bahasa & Membaca</div>
            <h3 class="mode-title">LITERASI DETEKTIF</h3>
            <p class="mode-desc">Sinonim, antonim, ide pokok, teks petunjuk, dan pemecahan misteri bacaan detektif.</p>
            <button class="mode-play-btn">Mulai Literasi ▶</button>
          </div>

          <!-- Mode 3: Motion Arena (Tahap 3) -->
          <div class="mode-card mode-quick" style="border-top-color: #059669;" id="mode-btn-arena">
            <div class="mode-card-icon">🏟️</div>
            <div class="mode-card-badge">Zona Jawaban</div>
            <h3 class="mode-title">MOTION ARENA</h3>
            <p class="mode-desc">4 zona fisik di layar! Bergerak dan jangkau zona jawaban dengan kalibrasi posisi pemain!</p>
            <button class="mode-play-btn" style="background: #059669; color: #FFFFFF;">Masuk Arena 🏟️</button>
          </div>

          <!-- Mode 4: Adventure Learning (Tahap 4) -->
          <div class="mode-card mode-boss" style="border-top-color: #D97706;" id="mode-btn-adventure">
            <div class="mode-card-icon">🗺️</div>
            <div class="mode-card-badge">Peta Ekspedisi</div>
            <h3 class="mode-title">ADVENTURE MAP</h3>
            <p class="mode-desc">Jelajahi pulau pengetahuan! Kumpulkan kunci, raih bintang, dan taklukkan gerbang misi!</p>
            <button class="mode-play-btn" style="background: #D97706; color: #FFFFFF;">Mulai Petualangan 🗺️</button>
          </div>

          <!-- Mode 5: Team Battle 4 Tim (Tahap 5) -->
          <div class="mode-card mode-duel" id="mode-btn-teambattle">
            <div class="mode-card-icon">🏆</div>
            <div class="mode-card-badge">2–4 Tim Kelas</div>
            <h3 class="mode-title">TEAM BATTLE</h3>
            <p class="mode-desc">Turnamen kelas seru! Rotasi 1 siswa per giliran agar pose tubuh akurat & adil!</p>
            <button class="mode-play-btn">Mulai Battle Tim ⚔️</button>
          </div>

          <!-- Mode 6: Boss Challenge -->
          <div class="mode-card mode-boss" id="mode-btn-boss">
            <div class="mode-card-icon">👑</div>
            <div class="mode-card-badge">Lawan Monster</div>
            <h3 class="mode-title">BOSS CHALLENGE</h3>
            <p class="mode-desc">Kalahkan Raja Angka Raksasa! Setiap jawaban benar memberikan serangan damage dahsyat!</p>
            <button class="mode-play-btn">Tantang Boss 💥</button>
          </div>

          <!-- Mode 7: Benar / Salah -->
          <div class="mode-card mode-tf" id="mode-btn-tf">
            <div class="mode-card-icon">🙆🙅</div>
            <div class="mode-card-badge">Refleks Cepat</div>
            <h3 class="mode-title">BENAR / SALAH</h3>
            <p class="mode-desc">Angkat tangan (🙆) untuk Benar atau silang tangan (🙅) untuk Salah!</p>
            <button class="mode-play-btn">Main Benar/Salah 🎯</button>
          </div>

          <!-- Mode 8: Quick Quiz -->
          <div class="mode-card mode-quick" id="mode-btn-quick">
            <div class="mode-card-icon">⚡</div>
            <div class="mode-card-badge">Kilat &amp; Cepat</div>
            <h3 class="mode-title">QUICK QUIZ</h3>
            <p class="mode-desc">Uji kecepatan berpikir dan gerak refleks dalam tantangan waktu singkat!</p>
            <button class="mode-play-btn">Mulai Kilat ⚡</button>
          </div>

          <!-- Mode 9: Motion Challenge -->
          <div class="mode-card mode-quick" id="mode-btn-motion" style="border-top-color:#0D9488;">
            <div class="mode-card-icon">🏃‍♀️</div>
            <div class="mode-card-badge">Soal Ringkas &amp; Aktif</div>
            <h3 class="mode-title">TANTANGAN GERAK</h3>
            <p class="mode-desc">Jawab soal kilat khusus dengan pergantian pose yang cepat, jelas, dan ramah untuk pemanasan kelas.</p>
            <button class="mode-play-btn" style="background:#0D9488;color:#fff;">Mulai Bergerak 🏃</button>
          </div>

          <!-- Mode 10: Online Multiplayer Game Show -->
          <div class="mode-card mode-multiplayer" id="mode-btn-online" style="border-top-color: #7C3AED;">
            <div class="mode-card-icon">🌐🏆</div>
            <div class="mode-card-badge">Real-Time Cloud</div>
            <h3 class="mode-title">GAME SHOW KELAS</h3>
            <p class="mode-desc">Bermain bersama seluruh siswa sekelas! Hubungkan HP siswa dengan layar guru &amp; bertanding langsung!</p>
            <button class="mode-play-btn" style="background: linear-gradient(135deg, #2563EB, #7C3AED); color: #FFFFFF;">Pusat Game Show 🌐</button>
          </div>

          <div class="mode-card" id="mode-btn-training" style="border-top-color:#0F766E;">
            <div class="mode-card-icon">🧍</div>
            <div class="mode-card-badge">Pemanasan Aman</div>
            <h3 class="mode-title">LATIHAN GERAK</h3>
            <p class="mode-desc">Coba gerakan jawaban satu per satu dan pastikan kamera mengenalinya sebelum permainan dimulai.</p>
            <button class="mode-play-btn" style="background:#0F766E;color:#fff;">Mulai Latihan</button>
          </div>

          <div class="mode-card" id="mode-btn-cooperative" style="border-top-color:#F2B84B;">
            <div class="mode-card-icon">🤝</div>
            <div class="mode-card-badge">Target Bersama</div>
            <h3 class="mode-title">MISI SATU KELAS</h3>
            <p class="mode-desc">Seluruh siswa bekerja sama mengejar target jawaban benar tanpa peringkat individu.</p>
            <button class="mode-play-btn" style="background:#B7791F;color:#fff;">Mulai Misi Bersama</button>
          </div>
        </div>

        <!-- REAL-TIME CLASSROOM TEAM LEADERBOARD -->
        <div class="home-leaderboard-section">
          <div class="leaderboard-header">
            <h3>🏆 Papan Skor 4 Tim Kelas</h3>
            <span class="leaderboard-note">Update Otomatis Selama Pembelajaran</span>
          </div>
          <div class="leaderboard-grid">
            ${teams
              .sort((a, b) => b.score - a.score)
              .map(
                (team, idx) => `
                <div class="team-score-card team-${team.id}">
                  <div class="team-rank">#${idx + 1}</div>
                  <div class="team-info">
                    <h4>${team.name}</h4>
                    <span class="team-members">${team.members} Siswa</span>
                  </div>
                  <div class="team-points">${team.score.toLocaleString()} PTS</div>
                </div>
              `
              )
              .join("")}
          </div>
        </div>

        <!-- PRIVACY BANNER -->
        <div class="privacy-notice-box">
          <span class="privacy-icon">🛡️</span>
          <p>
            <strong>Privasi & Keamanan:</strong> Kamera hanya memproses deteksi gerakan siswa secara real-time di browser lokal.
            Tidak ada foto, video, atau wajah yang disimpan maupun diunggah ke internet.
          </p>
        </div>
      </div>
    `;

    // Bind Home Cards
    document.getElementById("mode-btn-numerasi").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.QUICK_QUIZ, category: "numerasi" });
    });

    document.getElementById("mode-btn-literasi").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.DETECTIVE, category: "literasi" });
    });

    document.getElementById("mode-btn-arena").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.ARENA, category: "all" });
    });

    document.getElementById("mode-btn-adventure").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.ADVENTURE, category: "all" });
    });

    document.getElementById("mode-btn-teambattle").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.TEAM_BATTLE, category: "all" });
    });

    document.getElementById("mode-btn-boss").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.BOSS, category: "all" });
    });

    document.getElementById("mode-btn-quick").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.QUICK_QUIZ, category: "all" });
    });

    document.getElementById("mode-btn-motion").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.MOTION_CHALLENGE, category: "all" });
    });

    document.getElementById("mode-btn-tf").addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.TRUE_FALSE, category: "all" });
    });

    document.getElementById("mode-btn-training")?.addEventListener("click", () => {
      this.audio.playClick();
      this.trainingGestures.clear();
      this.game.setState(GAME_STATES.GESTURE_TRAINING);
    });

    document.getElementById("mode-btn-cooperative")?.addEventListener("click", () => {
      this.audio.playClick();
      this.game.startSessionConfig({ mode: GAME_MODES.COOPERATIVE, category: "all" });
    });

    // Multiplayer Online buttons
    const btnHost = document.getElementById("btn-quick-host");
    if (btnHost) {
      btnHost.addEventListener("click", () => {
        this.audio.playClick();
        this.game.setState(GAME_STATES.MULTIPLAYER_HOST_LOBBY);
      });
    }

    const btnJoin = document.getElementById("btn-quick-join");
    if (btnJoin) {
      btnJoin.addEventListener("click", () => {
        this.audio.playClick();
        this.game.setState(GAME_STATES.MULTIPLAYER_JOIN);
      });
    }

    const btnOnline = document.getElementById("mode-btn-online");
    if (btnOnline) {
      btnOnline.addEventListener("click", () => {
        this.audio.playClick();
        this.game.setState(GAME_STATES.MULTIPLAYER_HUB);
      });
    }
  }

  // ==========================================
  // SCREEN: TEAM BATTLE SETUP (TAHAP 5)
  // ==========================================
  renderTeamSetupScreen(container) {
    let currentTeamCount = 4;
    const allTeams = StorageManager.getTeams();

    const renderGrid = (count) => {
      const activeTeams = allTeams.slice(0, count);
      return activeTeams
        .map(
          (t, idx) => `
        <div class="team-setup-card team-${escapeHTML(t.id)}" style="border-top: 6px solid ${safeColor(t.color)};">
          <div class="team-setup-icon" style="color:${safeColor(t.color)};">
            ${idx === 0 ? "🔴" : idx === 1 ? "🔵" : idx === 2 ? "🟢" : "🟡"}
          </div>
          <h4>${escapeHTML(t.name)}</h4>
          <span class="team-member-pill">${t.members || 5} Siswa</span>
          <p class="team-ready-label">✓ Siap Bertanding</p>
        </div>
      `
        )
        .join("");
    };

    container.innerHTML = `
      <div class="screen-select animate-fade-in">
        <div class="select-header">
          <button id="btn-team-back-home" class="back-link-btn">← Kembali ke Beranda</button>
          <h2>🏆 TEAM BATTLE CLASSROOM</h2>
          <p>Pilih jumlah tim kelas yang akan bertanding (2 hingga 4 tim):</p>
        </div>

        <!-- Team Count Selector -->
        <div class="team-count-tabs">
          <button class="team-count-btn ${currentTeamCount === 2 ? "active" : ""}" data-count="2">2 Tim (Merah vs Biru)</button>
          <button class="team-count-btn ${currentTeamCount === 3 ? "active" : ""}" data-count="3">3 Tim (Merah, Biru, Hijau)</button>
          <button class="team-count-btn ${currentTeamCount === 4 ? "active" : ""}" data-count="4">4 Tim (Semua Regu)</button>
        </div>

        <!-- Teams Preview Grid -->
        <div id="team-setup-preview-grid" class="teams-setup-grid">
          ${renderGrid(currentTeamCount)}
        </div>

        <!-- Classroom Turn-Rule Note (Essential for Vision Stability) -->
        <div class="team-rule-alert-box">
          <span class="alert-icon">⚠️</span>
          <div class="alert-text">
            <strong>Aturan Giliran Siswa di Kelas:</strong>
            <p>Hanya <strong>1 siswa</strong> yang berdiri di depan kamera setiap giliran soal. Teman satu tim memberi semangat dari belakang agar deteksi rangka tubuh tidak tertukar!</p>
          </div>
        </div>

        <!-- Start Action -->
        <div class="select-actions" style="margin-top: 24px; text-align: center;">
          <button id="btn-start-team-battle" class="start-game-btn ready-pulse">
            <span class="btn-icon">⚔️</span>
            <span>Mulai Pertandingan Tim</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById("btn-team-back-home").addEventListener("click", () => {
      this.audio.playClick();
      this.game.returnHome();
    });

    container.querySelectorAll(".team-count-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.audio.playClick();
        container.querySelectorAll(".team-count-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        currentTeamCount = parseInt(btn.getAttribute("data-count"), 10);
        document.getElementById("team-setup-preview-grid").innerHTML = renderGrid(currentTeamCount);
      });
    });

    document.getElementById("btn-start-team-battle").addEventListener("click", () => {
      this.audio.playClick();
      this.game.setupTeamBattle({ teamCount: currentTeamCount });
    });
  }

  // ==========================================
  // SCREEN: ADVENTURE LEARNING WORLD MAP (TAHAP 4)
  // ==========================================
  renderAdventureMapScreen(container, payload = {}) {
    const adv = StorageManager.getAdventureProgress();
    const stages = ADVENTURE_STAGES;

    container.innerHTML = `
      <div class="screen-adventure-map animate-fade-in">
        <div class="adventure-hero-bar">
          <div class="adv-hero-left">
            <button id="btn-adv-back-home" class="back-link-btn">← Beranda</button>
            <h2 class="adv-map-title">🗺️ PETA EKSPEDISI ADVENTURE LEARNING</h2>
            <p class="adv-map-sub">Taklukkan pulau pengetahuan, kumpulkan 3 kunci sakti, dan kalahkan Raja Angka!</p>
          </div>
          <div class="adv-inventory-box">
            <div class="inv-badge">🗝️ <strong>${adv.keys || 0} / 3</strong> Kunci Kuno</div>
            <div class="inv-badge">⭐ <strong>${adv.totalStars || 0}</strong> Bintang</div>
            <div class="inv-badge">🏁 <strong>${adv.completedStages ? adv.completedStages.length : 0} / 4</strong> Misi</div>
          </div>
        </div>

        <!-- World Map Canvas & Stages Track -->
        <div class="adventure-world-map">
          <div class="map-island-bg"></div>
          <div class="adventure-stages-row">
            ${stages
              .map((st, idx) => {
                const isCompleted = adv.completedStages && adv.completedStages.includes(st.id);
                const isUnlocked = adv.unlockedStages ? adv.unlockedStages.includes(st.id) : idx === 0;
                const statusClass = isCompleted ? "completed" : isUnlocked ? "unlocked" : "locked";

                return `
              <div class="stage-node ${statusClass}" data-stage-id="${st.id}">
                <div class="stage-icon-circle">
                  ${isCompleted ? "⭐" : isUnlocked ? st.icon : "🔒"}
                </div>
                <div class="stage-title">${st.title}</div>
                <div class="stage-world-tag">${st.world}</div>
                <div class="stage-key-badge">${st.rewardKey}</div>
                ${!isUnlocked ? `<div class="stage-lock-hint">Butuh ${st.requiredKeys} Kunci</div>` : ""}
              </div>
            `;
              })
              .join("")}
          </div>
        </div>

        <!-- Mission Details Briefing Box -->
        <div id="adventure-briefing-card" class="adventure-briefing-card">
          <div class="briefing-header">
            <span id="brief-icon" class="brief-icon">🌲</span>
            <div>
              <h3 id="brief-title">Lembah Angka Ajaib</h3>
              <span id="brief-world" class="brief-world">Pulau Numerasi Dasar</span>
            </div>
            <span id="brief-status-tag" class="stage-status-pill unlocked">TERBUKA</span>
          </div>

          <div class="briefing-grid">
            <div class="brief-item">
              <strong>🎯 Tujuan Belajar:</strong>
              <p id="brief-objective">Kuasai operasi hitung cepat, perkalian dasar, dan pola deret bilangan.</p>
            </div>
            <div class="brief-item">
              <strong>💡 Petunjuk Misi:</strong>
              <p id="brief-clue">Perhatikan selisih angka dan angkat tangan ke pilihan yang tepat!</p>
            </div>
            <div class="brief-item">
              <strong>🎁 Hadiah Penyelesaian:</strong>
              <p id="brief-reward">🗝️ Kunci Perak & +300 Pts</p>
            </div>
          </div>

          <div class="briefing-actions">
            <button id="btn-start-mission" class="start-game-btn ready-pulse">
              <span class="btn-icon">🚀</span>
              <span id="btn-mission-text">Mulai Misi Gerak ▶</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-adv-back-home").addEventListener("click", () => {
      this.audio.playClick();
      this.game.returnHome();
    });

    let selectedStageId = 1;
    // Auto-select latest unlocked stage
    if (adv.unlockedStages && adv.unlockedStages.length > 0) {
      selectedStageId = adv.unlockedStages[adv.unlockedStages.length - 1];
    }

    const updateBriefing = (stageId) => {
      const st = stages.find((s) => s.id === stageId) || stages[0];
      const isCompleted = adv.completedStages && adv.completedStages.includes(st.id);
      const isUnlocked = adv.unlockedStages ? adv.unlockedStages.includes(st.id) : st.id === 1;

      document.getElementById("brief-icon").textContent = st.icon;
      document.getElementById("brief-title").textContent = st.title;
      document.getElementById("brief-world").textContent = st.world;
      document.getElementById("brief-objective").textContent = st.objective;
      document.getElementById("brief-clue").textContent = st.clue;
      document.getElementById("brief-reward").textContent = `${st.rewardKey} & +${st.rewardPoints} Pts`;

      const statusTag = document.getElementById("brief-status-tag");
      const startBtn = document.getElementById("btn-start-mission");
      const startText = document.getElementById("btn-mission-text");

      if (isCompleted) {
        statusTag.textContent = "SELESAI ⭐";
        statusTag.className = "stage-status-pill completed";
        startBtn.classList.remove("disabled");
        startBtn.removeAttribute("disabled");
        startText.textContent = "Main Ulang Misi Ini 🔄";
      } else if (isUnlocked) {
        statusTag.textContent = "TERBUKA 🔓";
        statusTag.className = "stage-status-pill unlocked";
        startBtn.classList.remove("disabled");
        startBtn.removeAttribute("disabled");
        startText.textContent = "Mulai Misi Gerak ▶";
      } else {
        statusTag.textContent = `TERKUNCI 🔒 (${st.requiredKeys} Kunci)`;
        statusTag.className = "stage-status-pill locked";
        startBtn.classList.add("disabled");
        startBtn.setAttribute("disabled", "true");
        startText.textContent = `Kumpulkan ${st.requiredKeys} Kunci Dahulu 🗝️`;
      }
    };

    updateBriefing(selectedStageId);

    container.querySelectorAll(".stage-node").forEach((node) => {
      node.addEventListener("click", () => {
        this.audio.playClick();
        const stageId = parseInt(node.getAttribute("data-stage-id"), 10);
        selectedStageId = stageId;
        updateBriefing(stageId);
      });
    });

    document.getElementById("btn-start-mission").addEventListener("click", () => {
      this.audio.playClick();
      this.game.setupAdventureMission(selectedStageId);
    });
  }

  // ==========================================
  // SCREEN 2: GRADE SELECT SCREEN
  // ==========================================
  renderGradeSelectScreen(container) {
    container.innerHTML = `
      <div class="screen-select animate-fade-in">
        <div class="select-header">
          <button id="btn-back-home" class="back-link-btn">← Kembali</button>
          <h2>Pilih Jenjang Kelas Siswa</h2>
          <p>Pilih tingkatan kelas SD untuk menyesuaikan materi soal:</p>
        </div>

        <div class="grade-selection-grid">
          ${[1, 2, 3, 4, 5, 6]
            .map(
              (grade) => `
            <div class="grade-card" data-grade="${grade}">
              <div class="grade-num">Kelas ${grade}</div>
              <div class="grade-badge">${grade <= 2 ? "Fase A (Awal)" : grade <= 4 ? "Fase B (Menengah)" : "Fase C (Lanjut)"}</div>
              <p class="grade-desc">Materi sesuai kurikulum SD Kelas ${grade}</p>
              <button class="grade-select-btn">Pilih Kelas ${grade}</button>
            </div>
          `
            )
            .join("")}
        </div>
      </div>
    `;

    document.getElementById("btn-back-home").addEventListener("click", () => {
      this.audio.playClick();
      this.game.returnHome();
    });

    container.querySelectorAll(".grade-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.audio.playClick();
        const grade = parseInt(card.getAttribute("data-grade"), 10);
        this.game.setGrade(grade);
      });
    });
  }

  // ==========================================
  // SCREEN 3: DIFFICULTY SELECT SCREEN
  // ==========================================
  renderDifficultySelectScreen(container) {
    container.innerHTML = `
      <div class="screen-select animate-fade-in">
        <div class="select-header">
          <button id="btn-back-grade" class="back-link-btn">← Pilih Kelas</button>
          <h2>Pilih Tingkat Kesulitan</h2>
          <p>Tingkat tantangan soal dan kecepatan gerak yang diinginkan:</p>
        </div>

        <div class="difficulty-grid">
          <div class="difficulty-card diff-easy" data-diff="easy">
            <div class="diff-stars">⭐</div>
            <h3>MUDAH</h3>
            <p>Cocok untuk pemanasan dan latihan dasar gerakan.</p>
            <span class="diff-reward">+100 Poin Dasar</span>
            <button class="diff-btn">Mulai Mudah</button>
          </div>

          <div class="difficulty-card diff-medium active-card" data-diff="medium">
            <div class="diff-stars">⭐⭐</div>
            <h3>SEDANG</h3>
            <p>Tantangan seimbang untuk mengasah ketelitian berpikir & gerak.</p>
            <span class="diff-reward">+100 Poin + Speed Bonus</span>
            <button class="diff-btn">Mulai Sedang</button>
          </div>

          <div class="difficulty-card diff-hard" data-diff="hard">
            <div class="diff-stars">⭐⭐⭐</div>
            <h3>SULIT</h3>
            <p>Soal tingkat tinggi (HOTS) dengan penalaran lebih mendalam!</p>
            <span class="diff-reward">+100 Poin + Combo x5</span>
            <button class="diff-btn">Mulai Sulit</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-back-grade").addEventListener("click", () => {
      this.audio.playClick();
      this.game.setState(GAME_STATES.GRADE_SELECT);
    });

    container.querySelectorAll(".difficulty-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.audio.playClick();
        const diff = card.getAttribute("data-diff");
        this.game.setDifficulty(diff);
      });
    });
  }

  // ==========================================
  // SCREEN 4: CAMERA CALIBRATION (CHECK)
  // ==========================================
  renderCalibrationScreen(container) {
    this.gesture.resetCalibration();
    const isArena = this.game.selectedMode === GAME_MODES.ARENA;
    const isTeam = this.game.selectedMode === GAME_MODES.TEAM_BATTLE;

    container.innerHTML = `
      <div class="screen-calibration animate-fade-in">
        <div class="calibration-split-layout">
          
          <!-- SISI KIRI (SIDE 1): TAMPILAN KAMERA & SENSOR GERAK -->
          <div class="calibration-camera-side">
            <div class="calib-side-header">
              <span class="calib-side-title">📷 Area Sensor Kamera</span>
              <span class="calib-live-badge"><span class="status-dot"></span> LIVE SENSOR</span>
            </div>

            <!-- Tempat Docking Kamera di Sisi Layar -->
            <div id="calibration-cam-slot" class="calibration-cam-slot"></div>

            <div class="calib-cam-tips">
              <div class="tip-item">
                <span>📏</span>
                <div>
                  <strong>Jarak Ideal (~1.5–2.5 Meter)</strong>
                  <p>Cukup tampilkan kepala, bahu, siku, dan kedua tangan dengan jelas.</p>
                </div>
              </div>
              <div class="tip-item">
                <span>💡</span>
                <div>
                  <strong>Pencahayaan Terang</strong>
                  <p>Pastikan ruangan cukup terang dan tidak membelakangi cahaya kuat.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- SISI KANAN (SIDE 2): PETUNJUK, CHECKLIST & KONTROL -->
          <div class="calibration-content-card">
            <div class="calib-header">
              <span class="calib-icon">${isArena ? "🏟️" : isTeam ? "🏆" : "🎯"}</span>
              <h2>${isArena ? "MOTION ARENA — CEK RUANG & KALIBRASI" : isTeam ? "TEAM BATTLE — KALIBRASI GILIRAN" : "CEK KAMERA & KALIBRASI"}</h2>
              <p class="calib-instruction">
                ${isArena
                  ? "Pastikan kamera menangkap area gerak siswa dan berjarak sekitar 1.5–2.5 meter."
                  : isTeam
                  ? "Siswa perwakilan tim pertama maju ke depan kamera. Siswa lain bersiap di belakang."
                  : "Berdirilah di tengah area kamera hingga seluruh poin pemeriksaan di bawah berubah hijau!"}
              </p>
            </div>

            <div id="realtime-calibration-card" class="realtime-calibration-card state-searching" role="status" aria-live="polite">
              <div class="realtime-score-ring">
                <strong id="calib-quality-value">0%</strong>
                <span>Kualitas</span>
              </div>
              <div class="realtime-calibration-copy">
                <div class="realtime-calibration-heading">
                  <div><span class="realtime-eyebrow">DETEKSI SETENGAH TUBUH REAL-TIME</span><h3 id="calib-live-status">Mencari posisi siswa</h3></div>
                  <span id="calib-model-badge" class="calib-model-badge">Memuat sensor</span>
                </div>
                <p id="calib-guidance">Masuk ke area kamera hingga tubuh terlihat.</p>
                <div class="calib-quality-track" aria-hidden="true"><span id="calib-quality-bar"></span></div>
                <div class="calib-live-metrics">
                  <span><small>Titik tubuh atas</small><strong id="calib-points">0/7</strong></span>
                  <span><small>Kestabilan</small><strong id="calib-stability">0%</strong></span>
                  <span><small>Kecepatan</small><strong id="calib-detection-fps">0 FPS</strong></span>
                </div>
              </div>
            </div>

            <!-- Visual Checklist Cards -->
            <div class="calib-checklist-grid">
              <div id="check-head" class="check-item">
                <span class="check-icon">⏳</span>
                <span class="check-label">Kepala Terdeteksi</span>
              </div>
              <div id="check-shoulders" class="check-item">
                <span class="check-icon">⏳</span>
                <span class="check-label">Bahu Terdeteksi</span>
              </div>
              <div id="check-hands" class="check-item">
                <span class="check-icon">⏳</span>
                <span class="check-label">Tangan Terdeteksi</span>
              </div>
              <div id="check-body" class="check-item">
                <span class="check-icon">⏳</span>
                <span class="check-label">Tubuh Atas Terdeteksi</span>
              </div>
              <div id="check-ideal" class="check-item">
                <span class="check-icon">⏳</span>
                <span class="check-label">Posisi Ideal</span>
              </div>
            </div>

            <!-- Arena Specific Calibration HUD (Tahap 3) -->
            ${
              isArena
                ? `
              <div class="arena-calibration-guide">
                <h4>🎯 Kalibrasi Sensor Ruang & Zona Arena:</h4>
                <div class="arena-calib-grid">
                  <div class="arena-calib-card">
                    <h4>📏 Jarak Kamera:</h4>
                    <div id="calib-arena-distance" class="arena-calib-val">Menunggu Siswa...</div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Ideal: 1.5 – 2.5 Meter</span>
                  </div>
                  <div class="arena-calib-card">
                    <h4>📍 Posisi Lateral:</h4>
                    <div id="calib-arena-position" class="arena-calib-val">Tengah Layar</div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Berdiri tepat di tengah</span>
                  </div>
                  <div class="arena-calib-card">
                    <h4>💡 Pencahayaan:</h4>
                    <div id="calib-arena-lighting" class="arena-calib-val">Optimal 💡</div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Kontras tubuh terhadap latar</span>
                  </div>
                  <div class="arena-calib-card">
                    <h4>🖥️ Orientasi:</h4>
                    <div class="arena-calib-val">Landscape / PID</div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Rekomendasi layar lebar</span>
                  </div>
                </div>
              </div>
            `
                : ""
            }

            <!-- Team Battle Turn Order Reminder (Tahap 5) -->
            ${
              isTeam
                ? `
              <div class="team-rule-alert-box" style="margin-top: 14px;">
                <span class="alert-icon">👥</span>
                <div class="alert-text">
                  <strong>Aturan Rotasi 1 Siswa:</strong>
                  <p>Hanya 1 siswa yang berada di depan kamera per giliran soal agar algoritma skeleton tidak membingungkan 2 tubuh sekaligus!</p>
                </div>
              </div>
            `
                : ""
            }

            <!-- Gesture Quick Cheat Sheet -->
            <div class="calib-gesture-guide">
              <h4>${isArena ? "Jangkauan 4 Zona Arena:" : "Panduan Gerakan Jawaban Tubuh:"}</h4>
              <div class="guide-gestures-row">
                <div class="guide-g-item"><span>✋ Zona A (Kiri Atas)</span><strong>A</strong></div>
                <div class="guide-g-item"><span>✋ Zona B (Kanan Atas)</span><strong>B</strong></div>
                <div class="guide-g-item"><span>🙌 Zona C (Kedua Tangan)</span><strong>C</strong></div>
                <div class="guide-g-item"><span>🧘 Zona D (Jongkok)</span><strong>D</strong></div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="calib-actions">
              <button id="btn-calib-start" class="start-game-btn disabled" disabled>
                <span class="btn-icon">🚀</span>
                <span id="calib-start-text">Menunggu Posisi Ideal...</span>
              </button>
              <button id="btn-calib-touch" class="secondary-btn">
                🎮 Gunakan Mode Sentuh Saja
              </button>
            </div>
          </div>

        </div>
      </div>
    `;

    // Mount camera PIP into the side column slot
    const camPip = document.getElementById("cam-pip-container");
    const camSlot = document.getElementById("calibration-cam-slot");
    if (camPip && camSlot) {
      camSlot.appendChild(camPip);
      camPip.classList.remove("hidden");
      camPip.classList.add("calibration-view");
      if (this.videoEl) this.videoEl.play().catch(() => {});
    }

    document.getElementById("btn-calib-start").addEventListener("click", () => {
      this.audio.playClick();
      const appEl = document.getElementById("msc-app");
      if (appEl && camPip && camPip.parentElement !== appEl) {
        appEl.appendChild(camPip);
      }
      this.game.startCalibrationDone();
    });

    document.getElementById("btn-calib-touch").addEventListener("click", () => {
      this.audio.playClick();
      this.game.touchMode = true;
      const appEl = document.getElementById("msc-app");
      if (appEl && camPip && camPip.parentElement !== appEl) {
        appEl.appendChild(camPip);
      }
      if (camPip) {
        camPip.classList.add("hidden");
        camPip.classList.remove("calibration-view");
      }
      this.game.startCalibrationDone();
    });
  }

  updateCalibrationUI(calibration, playerPos = null, telemetry = {}) {
    const updateItem = (id, valid) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (valid) {
        el.classList.add("checked");
        el.querySelector(".check-icon").textContent = "✓";
      } else {
        el.classList.remove("checked");
        el.querySelector(".check-icon").textContent = "⏳";
      }
    };

    updateItem("check-head", calibration.head);
    updateItem("check-shoulders", calibration.shoulders);
    updateItem("check-hands", calibration.hands);
    updateItem("check-body", calibration.body);
    updateItem("check-ideal", calibration.idealPosition);

    const quality = Number.isFinite(calibration.quality) ? calibration.quality : Math.round((telemetry.poseConfidence || 0) * 100);
    const stability = Number.isFinite(calibration.stability) ? calibration.stability : 0;
    const state = telemetry.detectorError ? "error" : calibration.stableReady ? "ready" : calibration.allReady ? "locking" : quality >= 45 ? "adjusting" : "searching";
    const statusLabels = {
      ready: "Tubuh terkunci dan siap",
      locking: `Mengunci posisi… ${calibration.readyProgress || 0}%`,
      adjusting: "Tubuh terdeteksi, sesuaikan posisi",
      searching: "Mencari posisi siswa",
      error: "Model gerakan belum aktif"
    };
    const stateLabels = { ready: "TERKUNCI", locking: "MENSTABILKAN", adjusting: "SESUAIKAN", searching: "MENCARI", error: "MODEL ERROR" };

    const qualityValue = document.getElementById("calib-quality-value");
    const qualityBar = document.getElementById("calib-quality-bar");
    const status = document.getElementById("calib-live-status");
    const guidance = document.getElementById("calib-guidance");
    const points = document.getElementById("calib-points");
    const stabilityEl = document.getElementById("calib-stability");
    const fpsEl = document.getElementById("calib-detection-fps");
    const modelBadge = document.getElementById("calib-model-badge");
    const liveCard = document.getElementById("realtime-calibration-card");
    if (qualityValue) qualityValue.textContent = `${quality}%`;
    if (qualityBar) qualityBar.style.width = `${quality}%`;
    if (status) status.textContent = statusLabels[state];
    if (guidance) guidance.textContent = telemetry.detectorError?.message || calibration.guidance || "Pastikan seluruh tubuh berada di area kamera.";
    if (points) points.textContent = `${calibration.detectedPoints || 0}/${calibration.totalPoints || 7}`;
    if (stabilityEl) stabilityEl.textContent = `${stability}%`;
    if (fpsEl) fpsEl.textContent = `${telemetry.fps || 0} FPS`;
    if (modelBadge) {
      modelBadge.textContent = telemetry.detectorMode === "error"
        ? "AI Pose gagal"
        : telemetry.detectorMode === "optical"
          ? "Mode kompatibel"
          : telemetry.detectorMode === "warming"
            ? "Memuat AI Pose"
            : "AI Pose aktif";
    }
    if (liveCard) liveCard.className = `realtime-calibration-card state-${state}`;

    const hudState = document.getElementById("pose-hud-state");
    const hudQuality = document.getElementById("pose-hud-quality");
    const hudMeter = document.getElementById("pose-hud-meter-fill");
    if (hudState) {
      hudState.className = `pose-hud-state ${state}`;
      const label = hudState.querySelector("strong");
      if (label) label.textContent = stateLabels[state];
    }
    if (hudQuality) hudQuality.textContent = `${quality}%`;
    if (hudMeter) hudMeter.style.width = `${quality}%`;
    document.getElementById("cam-guide-box")?.classList.toggle("locked", state === "ready" || state === "locking");

    const setPartState = (id, active) => document.getElementById(id)?.classList.toggle("detected", Boolean(active));
    setPartState("pose-part-head", calibration.parts?.head);
    setPartState("pose-part-arms", calibration.parts?.leftArm && calibration.parts?.rightArm);
    setPartState("pose-part-torso", calibration.parts?.upperBody);

    // Update Arena Gauges if present
    if (playerPos) {
      const distEl = document.getElementById("calib-arena-distance");
      if (distEl) distEl.textContent = playerPos.distanceStatus;

      const posEl = document.getElementById("calib-arena-position");
      if (posEl) posEl.textContent = playerPos.lateralPosition;

      const lightEl = document.getElementById("calib-arena-lighting");
      if (lightEl) lightEl.textContent = playerPos.lightingQuality;
    }

    const startBtn = document.getElementById("btn-calib-start");
    const startText = document.getElementById("calib-start-text");

    if (startBtn && startText) {
      if (calibration.stableReady && !telemetry.detectorError) {
        startBtn.classList.remove("disabled");
        startBtn.removeAttribute("disabled");
        startBtn.classList.add("ready-pulse");
        startText.textContent = "SIAP! MULAI PERMAINAN";
      } else {
        startBtn.classList.add("disabled");
        startBtn.setAttribute("disabled", "true");
        startBtn.classList.remove("ready-pulse");
        startText.textContent = calibration.allReady
          ? `Menstabilkan Posisi… ${calibration.readyProgress || 0}%`
          : "Posisikan Tubuh di Dalam Bingkai...";
      }
    }
  }

  // ==========================================
  // SCREEN 5: COUNTDOWN SCREEN
  // ==========================================
  renderCountdownScreen(container, countValue = 5) {
    container.innerHTML = `
      <div class="screen-countdown animate-scale-up">
        <div class="movement-ready-card">
          <span class="ready-eyebrow">PERSIAPAN GERAK</span>
          <div class="countdown-circle">
            <div id="countdown-number" class="countdown-number">${escapeHTML(countValue)}</div>
          </div>
          <h2>Ambil posisi yang nyaman</h2>
          <p class="countdown-tag">Pastikan tubuh terlihat kamera sebelum soal dimulai.</p>
          <div class="ready-step-grid">
            <span>① Berdiri tegak</span>
            <span>② Jaga jarak aman</span>
            <span>③ Siap bergerak</span>
          </div>
        </div>
      </div>
    `;
  }

  renderGestureTrainingScreen(container) {
    const settings = StorageManager.getSettings();
    const fourthLabel = settings.movementProfile === "hands_only" ? "Silang tangan" : "Jongkok";
    container.innerHTML = `
      <div class="gesture-training-screen animate-fade-in">
        <button id="btn-training-back" class="back-link-btn">← Kembali</button>
        <div class="training-header"><span class="ready-eyebrow">PEMANASAN SEBELUM BELAJAR</span><h2>Latihan Gerakan Jawaban</h2><p>Tahan setiap gerakan sampai kartu berubah hijau. Pastikan area di sekitarmu aman.</p></div>
        <div id="training-camera-slot" class="training-camera-slot"></div>
        <div class="training-grid">
          ${[
            [GESTURE_TYPES.A, "A", "✋", "Angkat tangan kiri"],
            [GESTURE_TYPES.B, "B", "✋", "Angkat tangan kanan"],
            [GESTURE_TYPES.C, "C", "🙌", "Angkat kedua tangan"],
            [GESTURE_TYPES.D, "D", "🧘", fourthLabel]
          ].map(([gesture, letter, icon, label]) => `<div class="training-card" data-training-gesture="${gesture}"><span>${icon}</span><strong>${letter}</strong><p>${label}</p><small>Belum terdeteksi</small></div>`).join("")}
        </div>
        <div id="training-progress" class="training-progress" aria-live="polite">0 dari 4 gerakan berhasil</div>
        <button id="btn-training-finish" class="primary-btn" disabled>Selesai Latihan</button>
      </div>
    `;
    document.getElementById("btn-training-back")?.addEventListener("click", () => this.game.setState(GAME_STATES.HOME));
    document.getElementById("btn-training-finish")?.addEventListener("click", () => this.game.setState(GAME_STATES.HOME));
    const camera = document.getElementById("cam-pip-container");
    const slot = document.getElementById("training-camera-slot");
    if (camera && slot) {
      slot.append(camera);
      camera.classList.remove("hidden");
      camera.classList.add("calibration-view");
      this.videoEl?.play().catch(() => {});
    }
  }

  updateGestureTrainingUI(gesture) {
    const card = document.querySelector(`[data-training-gesture="${gesture}"]`);
    if (card) {
      card.classList.add("complete");
      card.querySelector("small").textContent = "✓ Terdeteksi dengan baik";
    }
    const count = [GESTURE_TYPES.A, GESTURE_TYPES.B, GESTURE_TYPES.C, GESTURE_TYPES.D]
      .filter((item) => this.trainingGestures.has(item)).length;
    const progress = document.getElementById("training-progress");
    if (progress) progress.textContent = `${count} dari 4 gerakan berhasil`;
    const finish = document.getElementById("btn-training-finish");
    if (finish && count === 4) finish.disabled = false;
  }

  renderQuestionImage(question, variant = "") {
    const imageUrl = safeImageUrl(question?.imageUrl);
    if (!imageUrl) return "";
    const alt = question?.imageAlt || "Gambar pendukung soal";
    const layout = ["contain", "wide", "compact"].includes(question?.imageLayout) ? question.imageLayout : "contain";
    const className = `question-media image-layout-${layout}${variant ? ` ${variant}` : ""}`;
    return `
      <figure class="${className}">
        <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(alt)}" loading="lazy" referrerpolicy="no-referrer" />
      </figure>
    `;
  }

  // ==========================================
  // SCREEN 6 & 7: ACTIVE QUESTION SCREEN
  // ==========================================
  renderQuestionScreen(container, {
    question,
    index,
    total,
    mode,
    battleTeams,
    currentTeamTurn,
    bossHp,
    bossMaxHp,
    isFinalRound,
    adventureStage,
    adventureKeys
  }) {
    const isArena = mode === GAME_MODES.ARENA;
    const isTeamBattle = mode === GAME_MODES.TEAM_BATTLE;
    const isAdventure = mode === GAME_MODES.ADVENTURE;
    const isCooperative = mode === GAME_MODES.COOPERATIVE;
    const isTrueFalse = mode === GAME_MODES.TRUE_FALSE || question.isTrueFalse;
    const isBoss = mode === GAME_MODES.BOSS;
    const isDetective = mode === GAME_MODES.DETECTIVE || !!question.passage;
    const fourthGestureText = StorageManager.getSettings().movementProfile === "hands_only"
      ? "🙅 Silang Tangan di Dada"
      : "🧘 Posisi Jongkok";

    const activeTeam = isTeamBattle && battleTeams && battleTeams.length > 0
      ? battleTeams[currentTeamTurn % battleTeams.length]
      : null;

    container.innerHTML = `
      <div class="screen-question animate-fade-in ${isBoss ? "boss-active-bg" : ""}">
        <!-- FINAL SHOWDOWN BANNER (Team Battle Final Round) -->
        ${
          isFinalRound
            ? `<div class="final-showdown-banner animate-pulse">🔥 BABAK FINAL SHOWDOWN (2x DOUBLE POINTS & SPEED BONUS)! 🔥</div>`
            : ""
        }

        <!-- TEAM BATTLE ACTIVE TURN BANNER -->
        ${
          isTeamBattle && activeTeam
            ? `
          <div class="team-turn-banner ${activeTeam.id}">
            <div style="display:flex; align-items:center; gap: 10px;">
              <span class="team-badge-pill ${activeTeam.id}">
                🎯 GILIRAN: ${escapeHTML(activeTeam.name).toUpperCase()}
              </span>
              <span style="font-size:0.85rem; font-weight:700;">(1 Siswa Maju ke Depan Kamera!)</span>
            </div>
            <div style="font-size:0.8rem; opacity:0.9;">Aturan: 1 siswa per giliran</div>
          </div>

          <!-- 2-4 Team Mini Scoreboard -->
          <div style="display:flex; gap: 8px; justify-content:center; margin-bottom: 8px; flex-wrap:wrap;">
            ${battleTeams
              .map(
                (t, idx) => `
              <div class="hud-pill ${escapeHTML(t.id)} ${idx === currentTeamTurn % battleTeams.length ? "active-turn-pill" : ""}" style="border: 2px solid ${safeColor(t.color)};">
                ${escapeHTML(t.name)}: <strong>${Number(t.sessionScore) || 0} PTS</strong>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }

        <!-- QUESTION TOP HUD -->
        <div class="game-hud-bar">
          <div class="hud-left">
            <span class="hud-pill hud-q-num">Soal ${index} / ${total}</span>
            <span class="hud-pill hud-topic">${escapeHTML(question.topic || "Edukasi Gerak")}</span>
            ${
              isAdventure
                ? `<span class="hud-pill" style="background:#FEF3C7; color:#92400E; font-weight:800;">🗺️ Misi ${adventureStage || 1} | 🗝️ ${adventureKeys || 0}/3 Kunci</span>`
                : ""
            }
          </div>

          <div class="hud-center">
            <!-- Timer Bar -->
            <div class="timer-container">
              <span class="timer-icon">⏱️</span>
              <div class="timer-track">
                <div id="timer-progress" class="timer-fill"></div>
              </div>
              <span id="timer-text" class="timer-digits">40s</span>
            </div>
          </div>

          <div class="hud-right">
            <div class="score-display">
              <span class="score-label">SKOR</span>
              <span id="hud-score-val" class="score-value">${this.game.scoreEngine.score}</span>
            </div>
            <div id="hud-streak-box" class="streak-box ${this.game.scoreEngine.streak > 1 ? "visible" : "hidden"}">
              🔥 <span id="hud-streak-val">STREAK ${this.game.scoreEngine.streak}</span>
            </div>
          </div>
        </div>

        ${isCooperative ? `
          <div class="cooperative-live-card">
            <div><strong>🤝 Target Bersama Kelas</strong><span>${this.game.scoreEngine.correctCount} / ${StorageManager.getSettings().cooperativeGoal || 7} jawaban benar</span></div>
            <div class="cooperative-progress-track"><span style="width:${Math.min(100, (this.game.scoreEngine.correctCount / (StorageManager.getSettings().cooperativeGoal || 7)) * 100)}%"></span></div>
          </div>
        ` : ""}

        <!-- BOSS HP BAR (If Boss Mode) -->
        ${
          isBoss
            ? `
          <div class="boss-hud-card">
            <div class="boss-avatar-box">
              <span class="boss-emoji">👑👹</span>
              <div class="boss-info">
                <h3>${escapeHTML(question.bossName || "Raja Angka Raksasa")}</h3>
                <span class="boss-title">${escapeHTML(question.bossTitle || "Penguasa Labirin Numerasi")}</span>
              </div>
            </div>
            <div class="boss-hp-track">
              <div id="boss-hp-bar" class="boss-hp-fill" style="width: ${(bossHp / bossMaxHp) * 100}%"></div>
              <span id="boss-hp-text" class="boss-hp-text">${bossHp} / ${bossMaxHp} HP</span>
            </div>
          </div>
        `
            : ""
        }

        <!-- DETECTIVE STORY PASSAGE (If Literacy Detective) -->
        ${
          isDetective && question.passage
            ? `
          <div class="detective-story-card animate-slide-down">
            <div class="detective-header">
              <span class="det-icon">🔎 BUKTI BACAAN DETEKTIF</span>
            </div>
            <p class="det-passage-text">"${escapeHTML(question.passage)}"</p>
          </div>
        `
            : ""
        }

        <!-- MAIN QUESTION CARD -->
        <div class="question-main-card">
          ${this.renderQuestionImage(question)}
          <h2 class="question-title-text">${escapeHTML(question.question)}</h2>
        </div>

        <!-- MOTION ARENA: ACTIVE PLAYER CALIBRATION INDICATOR (Tahap 3) -->
        ${
          isArena
            ? `
          <div id="arena-player-status" class="arena-player-indicator">
            <span>🧍 Pemain: <strong>Mendeteksi Posisi...</strong></span>
            <span>📏 Jarak: <strong>Ideal (~1.5–2.5m)</strong></span>
            <span>💡 Cahaya: <strong>Optimal 💡</strong></span>
          </div>

          <!-- 4 MOTION ARENA INTERACTIVE QUADRANT ZONES -->
          <div class="arena-4zones-container">
            ${question.options
              .map((optText, optIdx) => {
                const letter = ["A", "B", "C", "D"][optIdx];
                const zoneClass = ["zone-a", "zone-b", "zone-c", "zone-d"][optIdx];
                const reachHint = [
                  "✋ Jangkau Kiri Atas (Tangan Kiri)",
                  "✋ Jangkau Kanan Atas (Tangan Kanan)",
                  "🙌 Jangkau Kiri Bawah (Kedua Tangan)",
                  fourthGestureText
                ][optIdx];

                return `
                <div class="arena-zone-card ${zoneClass}" id="opt-zone-${letter.toLowerCase()}" data-index="${optIdx}">
                  <div class="arena-zone-header">
                    <span class="arena-zone-badge">ZONA ${letter}</span>
                    <span class="arena-zone-gesture">${reachHint}</span>
                  </div>
                  <div class="arena-zone-text">${escapeHTML(optText)}</div>
                </div>
              `;
              })
              .join("")}
          </div>
        `
            : `
          <!-- STANDARD / TRUE-FALSE ANSWER CARDS -->
          <div class="options-container ${isTrueFalse ? "options-true-false" : "options-4-grid"}">
            ${
              isTrueFalse
                ? `
              <div class="option-card opt-tf opt-true" id="opt-card-0" data-index="0">
                <div class="opt-gesture-badge">🙆 Angkat Kedua Tangan</div>
                <div class="opt-label-letter">A</div>
                <div class="opt-text">BENAR</div>
              </div>
              <div class="option-card opt-tf opt-false" id="opt-card-1" data-index="1">
                <div class="opt-gesture-badge">🙅 Tangan Disilang / Jongkok</div>
                <div class="opt-label-letter">B</div>
                <div class="opt-text">SALAH</div>
              </div>
            `
                : question.options
                    .map((optText, optIdx) => {
                      const letter = ["A", "B", "C", "D"][optIdx];
                      const gestureLabel = [
                        "✋ Tangan Kiri Diangkat",
                        "✋ Tangan Kanan Diangkat",
                        "🙌 Kedua Tangan Diangkat",
                        fourthGestureText
                      ][optIdx];

                      return `
                  <div class="option-card opt-${letter.toLowerCase()}" id="opt-card-${optIdx}" data-index="${optIdx}">
                    <div class="opt-gesture-badge">${gestureLabel}</div>
                    <div class="opt-body">
                      <span class="opt-label-letter">${letter}</span>
                      <span class="opt-text">${escapeHTML(optText)}</span>
                    </div>
                  </div>
                `;
                    })
                    .join("")
            }
          </div>
        `
        }

        <!-- SKIP SOAL FOOTER -->
        <div class="question-footer">
          <span class="skip-hint">💡 Rentangkan kedua tangan ke samping untuk <strong>SKIP</strong> soal ini.</span>
          <button id="btn-skip-touch" class="skip-touch-btn">Lewati Soal (Skip) ⏭</button>
        </div>
      </div>
    `;

    // Click on option card or arena zone card supports touch mode
    container.querySelectorAll(".option-card, .arena-zone-card").forEach((card) => {
      card.addEventListener("click", () => {
        this.audio.playClick();
        const chosenIdx = parseInt(card.getAttribute("data-index"), 10);
        this.game.submitAnswerByIndex(chosenIdx);
      });
    });

    document.getElementById("btn-skip-touch").addEventListener("click", () => {
      this.audio.playClick();
      this.game.skipQuestion();
    });
  }

  updateTimerHUD(timeLeft, totalTime) {
    const timerFill = document.getElementById("timer-progress");
    const timerText = document.getElementById("timer-text");

    if (timerFill && timerText) {
      const ratio = Math.max(0, Math.min(1, timeLeft / totalTime));
      timerFill.style.width = `${ratio * 100}%`;
      timerText.textContent = `${timeLeft}s`;

      if (ratio <= 0.25) {
        timerFill.classList.add("timer-danger");
      } else {
        timerFill.classList.remove("timer-danger");
      }
    }
  }

  updateBossHpBar(currentHp, maxHp) {
    const bar = document.getElementById("boss-hp-bar");
    const text = document.getElementById("boss-hp-text");
    if (bar && text) {
      const pct = Math.max(0, (currentHp / maxHp) * 100);
      bar.style.width = `${pct}%`;
      text.textContent = `${currentHp} / ${maxHp} HP`;
      bar.classList.add("hp-hit-flash");
      setTimeout(() => bar.classList.remove("hp-hit-flash"), 300);
    }
  }

  // ==========================================
  // SCREEN 8: FEEDBACK OVERLAY
  // ==========================================
  renderFeedbackOverlay({ isCorrect, timedOut, correctIndex, chosenIndex, scoreResult, explanation, mode }) {
    // Highlight correct & chosen cards
    const correctCard = document.getElementById(`opt-card-${correctIndex}`);
    if (correctCard) correctCard.classList.add("correct-highlight");

    if (!isCorrect && chosenIndex >= 0) {
      const wrongCard = document.getElementById(`opt-card-${chosenIndex}`);
      if (wrongCard) wrongCard.classList.add("wrong-highlight");
    }

    // Modal feedback overlay
    const overlay = document.createElement("div");
    overlay.className = "feedback-popup-overlay animate-scale-up";

    if (isCorrect) {
      // Fire confetti celebration!
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      overlay.innerHTML = `
        <div class="feedback-card correct-card">
          <div class="feedback-icon">🎉</div>
          <h2>HEBAT, BENAR!</h2>
          <div class="feedback-points">+${scoreResult.pointsEarned} POINT</div>
          ${scoreResult.comboText ? `<div class="feedback-combo-badge">${scoreResult.comboText} 🔥</div>` : ""}
          ${explanation ? `<p class="feedback-exp">${explanation}</p>` : ""}
        </div>
      `;
    } else {
      overlay.innerHTML = `
        <div class="feedback-card wrong-card animate-shake">
          <div class="feedback-icon">${timedOut ? "⌛" : "❌"}</div>
          <h2>${timedOut ? "WAKTU HABIS!" : "COBA LAGI!"}</h2>
          <p class="feedback-sub">Jawaban yang tepat adalah pilihan <strong>${["A", "B", "C", "D"][correctIndex]}</strong></p>
          ${explanation ? `<p class="feedback-exp">${explanation}</p>` : ""}
        </div>
      `;
    }

    document.getElementById("msc-main").appendChild(overlay);
  }

  // ==========================================
  // SCREEN 9: RESULT SCREEN
  // ==========================================
  renderResultScreen(
    container,
    {
      score,
      correct,
      wrong,
      total,
      accuracy,
      streak,
      level,
      badge,
      bossDefeated,
      battleTeams,
      rankedTeams,
      mode,
      adventureStage,
      adventureKeys,
      stageCompleted,
      earnedKey,
      avgResponseTimeSec,
      weakTopics,
      topicStats
    }
  ) {
    // Grand celebration confetti
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 }
    });

    const isDuel = mode === GAME_MODES.DUEL;
    const isTeamBattle = mode === GAME_MODES.TEAM_BATTLE;
    const isBoss = mode === GAME_MODES.BOSS;
    const isAdventure = mode === GAME_MODES.ADVENTURE;
    const isCooperative = mode === GAME_MODES.COOPERATIVE;
    const cooperativeGoal = StorageManager.getSettings().cooperativeGoal || 7;

    container.innerHTML = `
      <div class="screen-result animate-fade-in">
        <div class="result-hero-card">
          <div class="result-crown">🏆</div>
          <h2 class="result-title">
            ${bossDefeated ? "👑 BOSS DEFEATED!" : stageCompleted ? "🎉 MISI PETUALANGAN SELESAI!" : "MISSION COMPLETE!"}
          </h2>
          <p class="result-subtitle">
            ${
              isAdventure && stageCompleted
                ? "Selamat! Kamu berhasil menaklukkan tantangan gerak di pulau ini dan mendapatkan Kunci Kuno!"
                : "Kamu telah menyelesaikan tantangan gerak dengan luar biasa!"
            }
          </p>

          ${isCooperative ? `
            <div class="cooperative-result-card">
              <h3>${correct >= cooperativeGoal ? "🎉 Target kelas tercapai!" : "🌱 Sedikit lagi, kelas hebat!"}</h3>
              <p>Kelas mengumpulkan <strong>${correct}</strong> jawaban benar dari target <strong>${cooperativeGoal}</strong>. Tidak ada peringkat individu dalam mode ini.</p>
            </div>
          ` : ""}

          <!-- Grand Score Counter -->
          <div class="result-score-box">
            <span class="score-tag">TOTAL SKOR AKHIR</span>
            <span class="result-score-digits">${score.toLocaleString()}</span>
          </div>

          <!-- ADVENTURE KEY REWARD UNLOCKED CARD (Tahap 4) -->
          ${
            isAdventure && stageCompleted
              ? `
            <div style="background: linear-gradient(135deg, #FFFBEB, #FEF3C7); border: 2px solid #F59E0B; border-radius: var(--radius-lg); padding: 16px 20px; margin: 16px 0; text-align: center;">
              <span style="font-size: 2.2rem;">🗝️✨</span>
              <h3 style="color: #92400E; margin-top: 4px;">Hadiah Kunci Diperoleh!</h3>
              <div style="font-size: 1.1rem; font-weight: 900; color: #B45309; margin-top: 4px;">
                ${earnedKey || "🗝️ Kunci Petualangan Terbuka"}
              </div>
              <p style="font-size: 0.82rem; color: #92400E; margin-top: 4px;">
                Koleksi Kunci Kuno kamu sekarang: <strong>${adventureKeys || 1} / 3</strong>
              </p>
            </div>
          `
              : ""
          }

          <!-- TEAM BATTLE TOURNAMENT PODIUM (Tahap 5) -->
          ${
            isTeamBattle && rankedTeams && rankedTeams.length > 0
              ? `
            <div class="team-podium-section">
              <h3 style="margin-bottom: 12px; font-weight: 900;">🏆 Hasil Klasemen Team Battle:</h3>
              <div class="team-podium-grid">
                ${rankedTeams
                  .map(
                    (t, idx) => `
                  <div class="team-podium-card rank-${idx + 1}" style="border-top: 6px solid ${safeColor(t.color)};">
                    <div class="podium-rank-badge">
                      ${idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🎖️"}
                    </div>
                    <h4>${escapeHTML(t.name)}</h4>
                    <div class="podium-team-score">+${t.sessionScore || 0} PTS</div>
                    <span style="font-size: 0.78rem; color: var(--text-muted);">Sesi Ini</span>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- DUEL WINNER ANNOUNCEMENT -->
          ${
            isDuel && battleTeams && battleTeams.length >= 2
              ? `
            <div class="duel-winner-box">
              <h3>Hasil Duel Tim:</h3>
              <div class="duel-teams-result">
                <div class="team-res-card red ${battleTeams[0].sessionScore >= battleTeams[1].sessionScore ? "winner" : ""}">
                  <h4>${battleTeams[0].name}</h4>
                  <div class="res-points">${battleTeams[0].sessionScore} PTS</div>
                </div>
                <div class="team-res-card blue ${battleTeams[1].sessionScore >= battleTeams[0].sessionScore ? "winner" : ""}">
                  <h4>${battleTeams[1].name}</h4>
                  <div class="res-points">${battleTeams[1].sessionScore} PTS</div>
                </div>
              </div>
            </div>
          `
              : ""
          }

          <!-- STATS GRID -->
          <div class="result-stats-grid">
            <div class="stat-card">
              <span class="stat-icon">✅</span>
              <div class="stat-value">${correct}</div>
              <div class="stat-label">Jawaban Benar</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">❌</span>
              <div class="stat-value">${wrong}</div>
              <div class="stat-label">Jawaban Salah</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🎯</span>
              <div class="stat-value">${accuracy}%</div>
              <div class="stat-label">Akurasi Gerak</div>
            </div>
            <div class="stat-card">
              <span class="stat-icon">🔥</span>
              <div class="stat-value">${streak}</div>
              <div class="stat-label">Streak Terbaik</div>
            </div>
          </div>

          <!-- SESSION LEARNING ANALYTICS ACCORDION (Tahap 6) -->
          <div class="session-analytics-toggle">
            <h3>📊 Laporan Capaian Belajar Sesi Ini</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
              Ringkasan penguasaan materi dan waktu berpikir siswa:
            </p>
            <table class="topic-mastery-table">
              <thead>
                <tr>
                  <th>Topik Materi</th>
                  <th>Benar</th>
                  <th>Total</th>
                  <th>Tingkat Capaian</th>
                </tr>
              </thead>
              <tbody>
                ${
                  topicStats && Object.keys(topicStats).length > 0
                    ? Object.keys(topicStats)
                        .map((tp) => {
                          const data = topicStats[tp];
                          const acc = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                          const isWeak = acc < 65;
                          return `
                        <tr>
                          <td><strong>${escapeHTML(tp)}</strong> ${isWeak ? '<span style="color:#DC2626; font-size:0.75rem;">(Perlu Ditinjau)</span>' : "✓"}</td>
                          <td>${data.correct}</td>
                          <td>${data.total}</td>
                          <td style="color:${isWeak ? "#DC2626" : "#15803D"}; font-weight:800;">${acc}%</td>
                        </tr>
                      `;
                        })
                        .join("")
                    : `<tr><td colspan="4">Seluruh topik terekam dengan baik.</td></tr>`
                }
              </tbody>
            </table>

            <div style="margin-top:10px; font-size:0.85rem; display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
              <span>⚡ Rata-rata Waktu Menjawab: <strong>${avgResponseTimeSec || 0} detik</strong></span>
              <span>📈 Efisiensi Gerak: <strong>${accuracy >= 80 ? "Sangat Cepat & Presisi" : "Baik & Terus Berlatih"}</strong></span>
            </div>

            ${
              weakTopics && weakTopics.length > 0
                ? `
              <div style="margin-top:10px; background:#FEF2F2; border:1px solid #FCA5A5; padding:8px 14px; border-radius:6px; font-size:0.82rem; color:#991B1B;">
                <strong>💡 Rekomendasi Guru:</strong> Siswa disarankan mengulang pembahasan pada topik: 
                ${weakTopics.map((w) => `<u>${escapeHTML(w.topic)}</u>`).join(", ")}.
              </div>
            `
                : `
              <div style="margin-top:10px; background:#F0FDF4; border:1px solid #86EFAC; padding:8px 14px; border-radius:6px; font-size:0.82rem; color:#166534;">
                <strong>✓ Hasil Penguasaan Baik:</strong> Semua materi yang diujikan dalam sesi ini berhasil dikuasai dengan tuntas!
              </div>
            `
            }

            <div style="margin-top:10px; font-size:0.75rem; color:var(--text-muted);">
              🛡️ <em>Privasi Siswa Terjamin: Data dianalisis secara lokal tanpa merekam foto/video maupun identitas biometrik siswa.</em>
            </div>
          </div>

          <!-- BADGE UNLOCKED -->
          <div class="result-badge-card">
            <div class="badge-icon-large">${badge.title.split(" ")[0]}</div>
            <div class="badge-text">
              <h4>${badge.title}</h4>
              <p>${badge.desc}</p>
            </div>
          </div>

          <!-- ACTIONS -->
          <div class="result-actions">
            ${
              isAdventure
                ? `<button id="btn-result-adv-map" class="primary-btn">Peta Petualangan 🗺️</button>`
                : ""
            }
            <button id="btn-replay" class="${isAdventure ? "secondary-btn" : "primary-btn"}">Main Lagi 🔄</button>
            <button id="btn-result-home" class="secondary-btn">Beranda Utama 🏠</button>
          </div>
        </div>
      </div>
    `;

    if (document.getElementById("btn-result-adv-map")) {
      document.getElementById("btn-result-adv-map").addEventListener("click", () => {
        this.audio.playClick();
        const adv = StorageManager.getAdventureProgress();
        this.game.setState(GAME_STATES.ADVENTURE_MAP, { progress: adv, stages: ADVENTURE_STAGES });
      });
    }

    document.getElementById("btn-replay").addEventListener("click", () => {
      this.audio.playClick();
      this.game.prepareQuestions();
      this.game.startCountdown();
    });

    document.getElementById("btn-result-home").addEventListener("click", () => {
      this.audio.playClick();
      this.game.returnHome();
    });
  }

  // ==========================================
  // TEACHER MODE MODAL LOGIC
  // ==========================================
  async initDatabaseSession() {
    if (!validateFirebaseAuthConfig().valid) return;
    try {
      await ensureAnonymousAuth();
      this.adminSession = await getAdminSession().catch(() => null);
      this.configureStudioAccess();
    } catch (error) {
      console.warn("[Firebase] Sesi database anonim belum tersedia:", error);
    }
  }

  configureStudioAccess() {
    const isAdmin = Boolean(this.adminSession);
    document.querySelectorAll('#teacher-dashboard-section .tab-btn[data-access="admin"]').forEach((button) => button.classList.toggle("hidden", !isAdmin));
    document.getElementById("studio-public-session")?.classList.toggle("hidden", isAdmin);
    document.getElementById("admin-session-panel")?.classList.toggle("hidden", !isAdmin);
    document.getElementById("admin-login-form")?.classList.add("hidden");
    document.getElementById("admin-session-email").textContent = isAdmin ? (this.adminSession.user.email || "Administrator") : "";
    document.getElementById("studio-button-label").textContent = isAdmin ? "Admin" : "Studio";
    document.getElementById("teacher-modal-title").textContent = isAdmin ? "🛡️ ADMIN STUDIO & PENGATURAN APLIKASI" : "🎒 STUDIO KONTRIBUSI SOAL";
  }

  showAdminLoginForm() {
    const form = document.getElementById("admin-login-form");
    const emailInput = document.getElementById("admin-email");
    const feedback = document.getElementById("admin-login-feedback");
    emailInput.value = getConfiguredAdminEmail();
    document.getElementById("admin-password").value = "";
    feedback.className = "admin-login-feedback hidden";
    form.classList.remove("hidden");
    emailInput.focus();
  }

  hideAdminLoginForm() {
    document.getElementById("admin-login-form").classList.add("hidden");
    document.getElementById("admin-password").value = "";
  }

  async handleAdminLogin(event) {
    event.preventDefault();
    const button = document.getElementById("btn-admin-login");
    const feedback = document.getElementById("admin-login-feedback");
    button.disabled = true;
    button.textContent = "Memverifikasi...";
    feedback.className = "admin-login-feedback hidden";
    try {
      this.adminSession = await signInAdmin(
        document.getElementById("admin-email").value,
        document.getElementById("admin-password").value
      );
      document.getElementById("admin-password").value = "";
      this.configureStudioAccess();
      this.activateStudioTab("tab-custom-questions");
      await this.syncQuestionsFromFirestore(false);
      this.renderCustomQuestionsList();
    } catch (error) {
      const messages = {
        "auth/invalid-credential": "Email atau password admin tidak benar.",
        "auth/user-disabled": "Akun admin dinonaktifkan di Firebase.",
        "auth/too-many-requests": "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba kembali.",
        "auth/admin-role-required": "Akun valid, tetapi role Firestore belum owner atau super_admin.",
        "auth/unauthorized-admin": "Email ini tidak terdaftar sebagai admin aplikasi."
      };
      feedback.textContent = messages[error.code] || error.message || "Login admin gagal.";
      feedback.className = "admin-login-feedback error";
    } finally {
      button.disabled = false;
      button.textContent = "Masuk";
    }
  }

  async handleAdminLogout() {
    await signOutAdmin();
    this.adminSession = null;
    this.configureStudioAccess();
    this.activateStudioTab("tab-add-question");
  }

  activateStudioTab(tabId) {
    const dashboard = document.getElementById("teacher-dashboard-section");
    dashboard.querySelectorAll(".modal-tabs .tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
    dashboard.querySelectorAll(":scope > .tab-content").forEach((content) => content.classList.toggle("active", content.id === tabId));
  }

  openTeacherModal() {
    const modal = document.getElementById("teacher-modal");
    modal.classList.remove("hidden");
    this.configureStudioAccess();
    this.activateStudioTab(this.adminSession ? "tab-custom-questions" : "tab-add-question");
    this.resetQuestionForm();
  }

  closeTeacherModal() {
    document.getElementById("teacher-modal").classList.add("hidden");
  }

  renderSubmissionCard(submission, { review = false } = {}) {
    const question = submission.question || {};
    const statusLabel = { pending: "Menunggu review", approved: "Disetujui", rejected: "Ditolak" }[submission.status] || submission.status;
    return `<article class="submission-card">
      <div class="submission-card-head"><div><span class="submission-status status-${escapeHTML(submission.status || "pending")}">${escapeHTML(statusLabel)}</span><h4>${escapeHTML(question.question || "Soal tanpa judul")}</h4></div><small>${new Date(submission.submittedAt).toLocaleString("id-ID")}</small></div>
      <p class="submission-meta">${escapeHTML(question.category || "-")} · Kelas ${Number(question.grade) || "-"} · ${escapeHTML(question.topic || "-")}${review ? ` · oleh ${escapeHTML(submission.ownerName || "Pengguna")}` : ""}</p>
      <ol class="submission-options">${(question.options || []).map((option, index) => `<li class="${index === question.correctAnswer ? "correct" : ""}">${escapeHTML(option)}</li>`).join("")}</ol>
      ${submission.reviewNote ? `<p class="review-note"><strong>Catatan reviewer:</strong> ${escapeHTML(submission.reviewNote)}</p>` : ""}
      ${review && submission.status === "pending" ? `<div class="submission-review-actions"><button class="primary-btn btn-sm approve-submission" data-id="${escapeHTML(submission.id)}">Setujui & Terbitkan</button><button class="secondary-btn btn-sm reject-submission" data-id="${escapeHTML(submission.id)}">Tolak</button></div>` : ""}
    </article>`;
  }

  async renderMySubmissions() {
    const container = document.getElementById("my-submissions-list");
    if (!container) return;
    container.innerHTML = "<p>Memuat kontribusi...</p>";
    try {
      const submissions = await FirestoreManager.fetchQuestionSubmissions({ mine: true });
      container.innerHTML = submissions.length ? submissions.map((item) => this.renderSubmissionCard(item)).join("") : '<div class="empty-list-msg"><p>Belum ada soal yang Anda kirim.</p></div>';
    } catch (error) {
      container.innerHTML = `<div class="empty-list-msg"><p>Kontribusi belum dapat dimuat: ${escapeHTML(error.message || "akses ditolak")}</p></div>`;
    }
  }

  async renderReviewSubmissions() {
    const container = document.getElementById("review-submissions-list");
    if (!container || !this.adminSession) return;
    container.innerHTML = "<p>Memuat antrean review...</p>";
    try {
      const submissions = await FirestoreManager.fetchQuestionSubmissions({ status: "pending" });
      container.innerHTML = submissions.length
        ? submissions.map((item) => this.renderSubmissionCard(item, { review: true })).join("")
        : '<div class="empty-list-msg"><p>Antrean review sudah kosong.</p></div>';
      container.querySelectorAll(".approve-submission, .reject-submission").forEach((button) => {
        button.addEventListener("click", async () => {
          const decision = button.classList.contains("approve-submission") ? "approved" : "rejected";
          if (!confirm(decision === "approved" ? "Setujui dan terbitkan soal ini?" : "Tolak pengajuan soal ini?")) return;
          const note = prompt("Catatan review (opsional):", "") || "";
          button.disabled = true;
          try {
            await FirestoreManager.reviewQuestionSubmission(button.dataset.id, decision, note);
            await this.renderReviewSubmissions();
            if (decision === "approved") await this.syncQuestionsFromFirestore(false);
          } catch (error) {
            alert(error.message || "Review belum dapat disimpan.");
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      container.innerHTML = `<div class="empty-list-msg"><p>Antrean belum dapat dimuat: ${escapeHTML(error.message || "akses ditolak")}</p></div>`;
    }
  }

  getCombinedQuestionsList() {
    const custom = StorageManager.getCustomQuestions();
    const cachedFs = FirestoreManager.getCachedFirestoreQuestions();
    const onlineFs = this.game.questionEngine.onlineQuestions || [];

    const map = new Map();
    // 1. Local custom questions
    custom.forEach((q) => map.set(q.id, { ...q, source: q.source || "local" }));
    // 2. Cached firestore questions
    cachedFs.forEach((q) => map.set(q.id, { ...q, source: "firestore" }));
    // 3. Freshly loaded firestore questions
    onlineFs.forEach((q) => map.set(q.id, { ...q, source: "firestore" }));

    return Array.from(map.values());
  }

  renderCustomQuestionsList(overrideList = null) {
    const container = document.getElementById("custom-questions-list");
    if (!container) return;

    const allQuestions = this.getCombinedQuestionsList();
    const questions = overrideList !== null ? overrideList : allQuestions;

    if (allQuestions.length === 0) {
      container.innerHTML = `
        <div class="empty-list-msg">
          <p>Belum ada soal tambahan yang dibuat guru.</p>
          <p class="sub">Klik tombol <strong>"➕ Tambah Soal Baru"</strong> atau impor JSON, CSV, XLS, maupun XLSX untuk menambahkan soal.</p>
        </div>
      `;
      return;
    }

    if (questions.length === 0) {
      container.innerHTML = `
        <div class="empty-list-msg">
          <p>Tidak ada soal yang sesuai dengan filter atau kata kunci pencarian.</p>
          <button class="secondary-btn mt-3" id="btn-reset-filters">Reset Filter</button>
        </div>
      `;
      const resetBtn = document.getElementById("btn-reset-filters");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          document.getElementById("filter-q-category").value = "all";
          document.getElementById("filter-q-grade").value = "all";
          document.getElementById("filter-q-diff").value = "all";
          document.getElementById("filter-q-mode").value = "all";
          document.getElementById("filter-q-search").value = "";
          this.renderCustomQuestionsList();
        });
      }
      return;
    }

    container.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
        Menampilkan <strong>${questions.length}</strong> dari <strong>${allQuestions.length}</strong> soal di Bank Data:
      </div>
      ${questions
        .map(
          (q) => `
        <div class="custom-q-item" id="q-item-${escapeHTML(q.id)}">
          <div class="q-item-header">
            <div style="display:flex; gap: 8px; align-items:center; flex-wrap:wrap;">
              <span class="q-badge-cat">${escapeHTML(q.category).toUpperCase()} - Kelas ${Number(q.grade) || 4} (${escapeHTML(q.difficulty || "medium")})</span>
              <span class="cloud-source-badge ${q.source === 'firestore' || q.source === 'seed' ? 'badge-firestore' : 'badge-local'}">
                ${q.source === 'firestore' || q.source === 'seed' ? '☁️ Cloud Firestore' : '💾 Lokal'}
              </span>
              <span style="font-size: 0.75rem; background: #E2E8F0; padding: 2px 8px; border-radius: 4px; font-weight:700;">⏱️ ${q.timeLimit || 40}s</span>
              <span style="font-size: 0.75rem; background: #FEF3C7; color: #92400E; padding: 2px 8px; border-radius: 4px; font-weight:700;">⭐ ${q.pointWeight || 100} pts</span>
              ${(q.gameModes || []).map((mode) => `<span class="question-mode-badge">🎮 ${escapeHTML(QUESTION_MODE_LABELS[mode] || mode)}</span>`).join("")}
              <span style="font-size: 0.78rem; font-weight: 800; color: var(--text-secondary);">${escapeHTML(q.topic || "Materi")}</span>
            </div>
            ${this.adminSession || (q.source !== "firestore" && q.source !== "seed") ? `<div style="display:flex; gap: 6px;">
              <button class="edit-q-btn" data-id="${escapeHTML(q.id)}">✏️ Edit</button>
              <button class="delete-q-btn" data-id="${escapeHTML(q.id)}">🗑️ Hapus</button>
            </div>` : ""}
          </div>
          ${q.passage ? `<p style="font-size: 0.85rem; color: #78350F; background: #FFFBEB; padding: 6px 10px; border-radius: 4px; margin-top: 6px; font-style: italic;">"${escapeHTML(q.passage)}"</p>` : ""}
          ${this.renderQuestionImage(q, "question-media-thumb")}
          <p class="q-item-text" style="margin-top: 6px;"><strong>${escapeHTML(q.question)}</strong></p>
          <div class="q-item-opts" style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-top: 8px;">
            ${q.options
              .map(
                (opt, idx) => `
              <div style="padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border); background: ${idx === q.correctAnswer ? "rgba(34, 197, 94, 0.15)" : "#FFFFFF"}; border-color: ${idx === q.correctAnswer ? "#22C55E" : "var(--border)"}; font-size: 0.82rem;">
                <strong>${["A", "B", "C", "D"][idx]}:</strong> ${escapeHTML(opt)} ${idx === q.correctAnswer ? "✓ (Kunci)" : ""}
              </div>
            `
              )
              .join("")}
          </div>
          ${q.explanation ? `<div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 6px;">💡 <em>Pembahasan: ${escapeHTML(q.explanation)}</em></div>` : ""}
        </div>
      `
        )
        .join("")}
    `;

    // Bind Edit buttons
    container.querySelectorAll(".edit-q-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.populateEditQuestion(id);
      });
    });

    // Bind Delete buttons with confirmation
    container.querySelectorAll(".delete-q-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        if (confirm("Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?")) {
          this.audio.playClick();
          const question = this.getCombinedQuestionsList().find((item) => item.id === id);
          if (question?.source === "firestore") {
            if (!this.adminSession) return;
            const deleted = await FirestoreManager.deleteQuestion(id);
            if (!deleted) {
              alert("Soal cloud belum dapat dihapus.");
              return;
            }
            await this.syncQuestionsFromFirestore(false);
          } else {
            StorageManager.deleteCustomQuestion(id);
          }
          this.applyQuestionFilters();
        }
      });
    });
  }

  applyQuestionFilters() {
    const category = document.getElementById("filter-q-category") ? document.getElementById("filter-q-category").value : "all";
    const grade = document.getElementById("filter-q-grade") ? document.getElementById("filter-q-grade").value : "all";
    const diff = document.getElementById("filter-q-diff") ? document.getElementById("filter-q-diff").value : "all";
    const mode = document.getElementById("filter-q-mode") ? document.getElementById("filter-q-mode").value : "all";
    const search = document.getElementById("filter-q-search") ? document.getElementById("filter-q-search").value.toLowerCase().trim() : "";

    let list = this.getCombinedQuestionsList();

    if (category !== "all") {
      list = list.filter((q) => q.category === category);
    }
    if (grade !== "all") {
      list = list.filter((q) => String(q.grade) === grade);
    }
    if (diff !== "all") {
      list = list.filter((q) => q.difficulty === diff);
    }
    if (mode === "general") {
      list = list.filter((q) => !Array.isArray(q.gameModes) || q.gameModes.length === 0);
    } else if (mode !== "all") {
      list = list.filter((q) => Array.isArray(q.gameModes) && q.gameModes.includes(mode));
    }
    if (search) {
      list = list.filter(
        (q) =>
          (q.question && q.question.toLowerCase().includes(search)) ||
          (q.topic && q.topic.toLowerCase().includes(search)) ||
          (q.passage && q.passage.toLowerCase().includes(search))
      );
    }

    this.renderCustomQuestionsList(list);
  }

  populateEditQuestion(questionId) {
    this.audio.playClick();
    const questions = this.getCombinedQuestionsList();
    const q = questions.find((item) => item.id === questionId);
    if (!q) return;

    document.getElementById("edit-q-id").value = q.id;
    document.getElementById("edit-q-id").dataset.source = q.source || "local";
    document.getElementById("new-q-category").value = q.category || "numerasi";
    document.getElementById("new-q-grade").value = q.grade || 4;
    document.getElementById("new-q-difficulty").value = q.difficulty || "medium";
    document.getElementById("new-q-topic").value = q.topic || "";
    document.getElementById("new-q-time-limit").value = q.timeLimit || 40;
    document.getElementById("new-q-point-weight").value = q.pointWeight || 100;
    document.getElementById("new-q-game-mode").value = q.gameModes?.[0] || "";
    document.getElementById("new-q-passage").value = q.passage || "";
    document.getElementById("new-q-image-url").value = q.imageUrl || "";
    document.getElementById("new-q-image-alt").value = q.imageAlt || "";
    document.getElementById("new-q-image-layout").value = q.imageLayout || "contain";
    document.getElementById("new-q-text").value = q.question || "";
    document.getElementById("new-q-opt-a").value = q.options && q.options[0] ? q.options[0] : "";
    document.getElementById("new-q-opt-b").value = q.options && q.options[1] ? q.options[1] : "";
    document.getElementById("new-q-opt-c").value = q.options && q.options[2] ? q.options[2] : "";
    document.getElementById("new-q-opt-d").value = q.options && q.options[3] ? q.options[3] : "";
    document.getElementById("new-q-correct").value = typeof q.correctAnswer === "number" ? q.correctAnswer : 0;
    document.getElementById("new-q-explanation").value = q.explanation || "";
    this.updateQuestionImagePreview();

    // Show editing banner & update submit button
    const banner = document.getElementById("editing-banner");
    if (banner) {
      banner.classList.remove("hidden");
      banner.querySelector("strong").textContent = `Mode Edit: "${q.question.substring(0, 45)}..."`;
    }

    const submitBtn = document.getElementById("btn-submit-question");
    if (submitBtn) submitBtn.textContent = "Simpan Perubahan Soal 💾";

    const cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) cancelBtn.classList.remove("hidden");

    // Switch tab to Editor
    document.querySelectorAll(".modal-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    const addTabBtn = document.querySelector('.modal-tabs .tab-btn[data-tab="tab-add-question"]');
    if (addTabBtn) addTabBtn.classList.add("active");
    document.getElementById("tab-add-question").classList.add("active");
  }

  resetQuestionForm() {
    document.getElementById("form-add-question").reset();
    document.getElementById("edit-q-id").value = "";
    document.getElementById("edit-q-id").dataset.source = "";
    document.getElementById("new-q-time-limit").value = 40;
    document.getElementById("new-q-point-weight").value = 100;
    document.getElementById("new-q-game-mode").value = "";
    this.updateQuestionImagePreview();

    const banner = document.getElementById("editing-banner");
    if (banner) banner.classList.add("hidden");

    const submitBtn = document.getElementById("btn-submit-question");
    if (submitBtn) submitBtn.textContent = this.adminSession ? "Terbitkan Soal 💾" : "Kirim untuk Review ✅";

    const cancelBtn = document.getElementById("btn-cancel-edit");
    if (cancelBtn) cancelBtn.classList.add("hidden");
  }

  updateQuestionImagePreview() {
    const preview = document.getElementById("new-q-image-preview");
    const input = document.getElementById("new-q-image-url");
    if (!preview || !input) return;

    const rawUrl = input.value.trim();
    preview.replaceChildren();
    if (!rawUrl) {
      preview.classList.add("hidden");
      return;
    }

    preview.classList.remove("hidden", "invalid");
    const imageUrl = safeImageUrl(rawUrl);
    if (!imageUrl) {
      preview.classList.add("invalid");
      preview.textContent = "Gunakan link gambar HTTPS yang valid.";
      return;
    }

    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = document.getElementById("new-q-image-alt")?.value.trim() || "Pratinjau gambar soal";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    image.addEventListener("error", () => {
      preview.classList.add("invalid");
      preview.textContent = "Gambar tidak dapat dimuat. Periksa link atau izin akses gambarnya.";
    }, { once: true });
    preview.append(image);
  }

  applyAccessibilitySettings() {
    const settings = StorageManager.getSettings();
    const root = document.documentElement;
    root.classList.toggle("access-large-text", !!settings.largeText);
    root.classList.toggle("access-high-contrast", !!settings.highContrast);
    root.classList.toggle("access-reduced-motion", !!settings.reducedMotion);
  }

  renderSessionPackages() {
    const container = document.getElementById("session-packages-list");
    if (!container) return;
    const packages = StorageManager.getSessionPackages();
    if (!packages.length) {
      container.innerHTML = `<div class="empty-list-msg"><p>Belum ada paket sesi. Buat konfigurasi pertama melalui formulir di atas.</p></div>`;
      return;
    }
    container.innerHTML = packages.map((pkg) => `
      <article class="session-package-card">
        <div><span class="q-badge-cat">${escapeHTML(pkg.category)} • Kelas ${pkg.grade}</span><h4>${escapeHTML(pkg.name)}</h4><p>${pkg.count} soal • ${escapeHTML(pkg.difficulty)} • ${escapeHTML(pkg.mode)}</p></div>
        <div class="package-actions"><button class="primary-btn btn-sm package-run" data-id="${escapeHTML(pkg.id)}">▶ Jalankan</button><button class="danger-btn btn-sm package-delete" data-id="${escapeHTML(pkg.id)}">Hapus</button></div>
      </article>
    `).join("");
    container.querySelectorAll(".package-run").forEach((button) => button.addEventListener("click", () => {
      const pkg = StorageManager.getSessionPackages().find((item) => item.id === button.dataset.id);
      if (!pkg) return;
      this.closeTeacherModal();
      this.game.startSavedSession(pkg);
    }));
    container.querySelectorAll(".package-delete").forEach((button) => button.addEventListener("click", () => {
      StorageManager.deleteSessionPackage(button.dataset.id);
      this.renderSessionPackages();
    }));
  }

  renderMediaLibrary() {
    const container = document.getElementById("media-library-grid");
    if (!container) return;
    const mediaMap = new Map();
    this.getCombinedQuestionsList().forEach((question) => {
      const url = safeImageUrl(question.imageUrl);
      if (url && !mediaMap.has(url)) mediaMap.set(url, { url, alt: question.imageAlt || question.question, layout: question.imageLayout || "contain" });
    });
    const media = [...mediaMap.values()];
    if (!media.length) {
      container.innerHTML = `<div class="empty-list-msg"><p>Belum ada gambar. Tambahkan URL HTTPS melalui Editor Soal.</p></div>`;
      return;
    }
    container.innerHTML = media.map((item, index) => `
      <article class="media-library-card"><img src="${escapeHTML(item.url)}" alt="${escapeHTML(item.alt)}" loading="lazy" referrerpolicy="no-referrer" /><div><p>${escapeHTML(item.alt)}</p><button class="secondary-btn btn-sm media-use" data-index="${index}">Gunakan di soal</button></div></article>
    `).join("");
    container.querySelectorAll(".media-use").forEach((button) => button.addEventListener("click", () => {
      const item = media[Number(button.dataset.index)];
      document.getElementById("new-q-image-url").value = item.url;
      document.getElementById("new-q-image-alt").value = item.alt;
      document.getElementById("new-q-image-layout").value = item.layout;
      this.updateQuestionImagePreview();
      document.querySelectorAll(".modal-tabs .tab-btn").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === "tab-add-question"));
      document.querySelectorAll(".tab-content").forEach((tab) => tab.classList.toggle("active", tab.id === "tab-add-question"));
    }));
  }

  async renderAnalyticsDashboard(forceFirestore = false) {
    const statsContainer = document.getElementById("analytics-summary-cards");
    const recContainer = document.getElementById("analytics-weak-recommendations");
    const sessionsList = document.getElementById("analytics-sessions-list");

    if (!statsContainer || !recContainer || !sessionsList) return;

    const stats = StorageManager.getStats();
    let history = StorageManager.getAnalyticsHistory();

    const status = FirestoreManager.getStatus();
    if (forceFirestore || status.isConfigured) {
      try {
        const firestoreSessions = await FirestoreManager.fetchGameSessions(30);
        if (firestoreSessions && firestoreSessions.length > 0) {
          history = firestoreSessions;
        }
      } catch (e) {
        console.warn("Using local analytics history fallback:", e);
      }
    }

    const overallAccuracy = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

    let avgSpeed = 0;
    if (history.length > 0) {
      const totalSpeed = history.reduce((sum, s) => sum + (s.avgResponseTimeSec || 0), 0);
      avgSpeed = (totalSpeed / history.length).toFixed(1);
    }

    // Render Stats Cards
    statsContainer.innerHTML = `
      <div class="ana-card">
        <div class="ana-card-icon">🎮</div>
        <div class="ana-card-val">${stats.totalGames}</div>
        <div class="ana-card-label">Total Sesi Bermain</div>
      </div>
      <div class="ana-card">
        <div class="ana-card-icon">📝</div>
        <div class="ana-card-val">${stats.totalAnswered}</div>
        <div class="ana-card-label">Soal Dijawab Siswa</div>
      </div>
      <div class="ana-card">
        <div class="ana-card-icon">🎯</div>
        <div class="ana-card-val">${overallAccuracy}%</div>
        <div class="ana-card-label">Akurasi Rata-rata</div>
      </div>
      <div class="ana-card">
        <div class="ana-card-icon">⚡</div>
        <div class="ana-card-val">${avgSpeed}s</div>
        <div class="ana-card-label">Rata-rata Waktu Menjawab</div>
      </div>
    `;

    // Aggregate Weak Topics across sessions
    const topicAgg = {};
    history.forEach((session) => {
      if (session.topicMastery) {
        Object.keys(session.topicMastery).forEach((topic) => {
          if (!topicAgg[topic]) topicAgg[topic] = { correct: 0, total: 0 };
          topicAgg[topic].correct += session.topicMastery[topic].correct || 0;
          topicAgg[topic].total += session.topicMastery[topic].total || 0;
        });
      }
    });

    const weakTopics = [];
    Object.keys(topicAgg).forEach((topic) => {
      const data = topicAgg[topic];
      if (data.total >= 2) {
        const acc = (data.correct / data.total) * 100;
        if (acc < 65) {
          weakTopics.push({ topic, accuracy: Math.round(acc), correct: data.correct, total: data.total });
        }
      }
    });

    const topicRows = Object.entries(topicAgg)
      .map(([topic, data]) => ({ topic, ...data, accuracy: data.total ? Math.round((data.correct / data.total) * 100) : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .map((item) => `<tr><td>${escapeHTML(item.topic)}</td><td>${item.correct}/${item.total}</td><td><strong>${item.accuracy}%</strong></td><td>${item.accuracy >= 80 ? "Dikuasai" : item.accuracy >= 65 ? "Berkembang" : "Perlu latihan"}</td></tr>`)
      .join("");
    const topicTable = topicRows
      ? `<div class="topic-report-wrap"><h4>Laporan Semua Topik</h4><table class="topic-mastery-table"><thead><tr><th>Topik</th><th>Benar</th><th>Akurasi</th><th>Status</th></tr></thead><tbody>${topicRows}</tbody></table></div>`
      : "";

    if (weakTopics.length > 0) {
      recContainer.innerHTML = `
        <h4>💡 Rekomendasi Materi yang Perlu Ditinjau Ulang di Kelas:</h4>
        <p style="font-size: 0.85rem; color: #7F1D1D;">Siswa menunjukkan tingkat akurasi rendah pada materi berikut:</p>
        <div class="weak-topic-tags">
          ${weakTopics
            .map(
              (w) => `
            <span class="weak-tag">⚠️ ${escapeHTML(w.topic)} (Akurasi: ${w.accuracy}%)</span>
          `
            )
            .join("")}
        </div>
        ${topicTable}
      `;
    } else {
      recContainer.innerHTML = `
        <h4 style="color: #15803D;">🎉 Penguasaan Materi Kelas Sangat Baik!</h4>
        <p style="font-size: 0.85rem; color: #166534;">Belum ada topik yang menunjukkan tingkat kesulitan kritis. Siswa menguasai literasi dan numerasi dengan seimbang.</p>
        ${topicTable}
      `;
    }

    // Render Recent Sessions List
    if (history.length === 0) {
      sessionsList.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 14px;">Belum ada sesi pembelajaran yang terekam. Mulai permainan untuk melihat analitik!</p>`;
    } else {
      sessionsList.innerHTML = history
        .slice(0, 15)
        .map(
          (s) => `
        <div class="custom-q-item" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap: 8px;">
          <div>
            <div style="display:flex; gap: 6px; align-items:center; flex-wrap:wrap;">
              <span class="q-badge-cat">${escapeHTML(s.mode || "QUIZ").toUpperCase()} - Kelas ${escapeHTML(s.grade || 4)} (${escapeHTML(s.category || "campuran")})</span>
              <span class="cloud-source-badge ${s.source === 'firestore' || s.source === 'app' ? 'badge-firestore' : 'badge-local'}">
                ${s.source === 'firestore' || s.source === 'app' ? '☁️ Cloud Firestore' : '💾 Lokal'}
              </span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">📅 ${new Date(s.date).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
          <div style="display:flex; gap: 14px; align-items:center;">
            <div style="text-align:right;">
              <strong style="color: var(--primary); font-size: 1.1rem;">${(s.score || 0).toLocaleString()} PTS</strong>
              <div style="font-size: 0.8rem; color: var(--text-secondary);">${s.correctCount || 0}/${s.totalQuestions || 0} Benar (${s.accuracy || 0}%)</div>
            </div>
            <div style="font-size: 0.85rem; background: #F1F5F9; padding: 4px 10px; border-radius: 4px;">⚡ ${s.avgResponseTimeSec || 0}s</div>
          </div>
          ${Array.isArray(s.participantResults) && s.participantResults.length ? `
            <details class="multiplayer-report-details" style="flex-basis:100%;">
              <summary>📋 Laporan Room ${escapeHTML(s.roomCode || "")} · ${s.participantResults.length} peserta</summary>
              <div class="multiplayer-report-grid">
                ${s.participantResults.map((participant, index) => `<div><span>#${index + 1} ${escapeHTML(participant.name)}</span><small>${participant.participantType === "group" ? "Kelompok" : "Siswa"} · ${Number(participant.correctCount) || 0} benar · ${(Number(participant.score) || 0).toLocaleString()} poin</small></div>`).join("")}
              </div>
            </details>` : ""}
        </div>
      `
        )
        .join("");
    }
  }

  renderTeamsEditor() {
    const container = document.getElementById("teams-editor-grid");
    if (!container) return;

    const teams = StorageManager.getTeams();
    container.innerHTML = teams
      .map(
        (t) => `
      <div class="team-edit-card" style="border-top: 5px solid ${safeColor(t.color)}">
        <h4>${escapeHTML(t.name)}</h4>
        <div class="form-group">
          <label>Nama Tim:</label>
          <input type="text" id="team-name-${escapeHTML(t.id)}" value="${escapeHTML(t.name)}" />
        </div>
        <div class="form-group">
          <label>Skor Saat Ini:</label>
          <input type="number" id="team-score-${escapeHTML(t.id)}" value="${Number(t.score) || 0}" />
        </div>
      </div>
    `
      )
      .join("");
  }

  // ==========================================
  // CLOUD FIRESTORE MANAGEMENT & SYNCHRONIZATION
  // ==========================================
  bindFirestoreEvents() {
    // 1. Sync questions from Firestore button
    const btnSync = document.getElementById("btn-sync-firestore");
    if (btnSync) {
      btnSync.addEventListener("click", () => {
        this.audio.playClick();
        this.syncQuestionsFromFirestore(true);
      });
    }

    // 2. Seed default questions buttons
    const seedHandler = () => {
      this.audio.playClick();
      this.seedDefaultQuestionsToFirestore();
    };
    const btnSeed1 = document.getElementById("btn-seed-firestore");
    if (btnSeed1) btnSeed1.addEventListener("click", seedHandler);
    const btnSeed2 = document.getElementById("btn-seed-all-questions");
    if (btnSeed2) btnSeed2.addEventListener("click", seedHandler);

    // 3. Test Firebase Connection button
    const btnTest = document.getElementById("btn-test-firebase-conn");
    if (btnTest) {
      btnTest.addEventListener("click", () => {
        this.audio.playClick();
        this.testFirebaseConnectionUI();
      });
    }

    // 4. Save Firebase Config Form submit
    const cfgForm = document.getElementById("firebase-config-form");
    if (cfgForm) {
      cfgForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.audio.playClick();
        this.saveFirebaseConfigUI();
      });
    }

    // 5. Reset Firebase Config button
    const btnResetCfg = document.getElementById("btn-reset-firebase-cfg");
    if (btnResetCfg) {
      btnResetCfg.addEventListener("click", () => {
        if (confirm("Reset konfigurasi Firebase ke nilai bawaan (.env)?")) {
          this.audio.playClick();
          this.resetFirebaseConfigUI();
        }
      });
    }

    // 6. Copy firestore.rules button
    const btnCopyRules = document.getElementById("btn-copy-firestore-rules");
    if (btnCopyRules) {
      btnCopyRules.addEventListener("click", () => {
        this.audio.playClick();
        this.copyFirestoreRulesUI();
      });
    }

    // 7. Refresh Analytics from Firestore button
    const btnRefreshAna = document.getElementById("btn-refresh-analytics-firestore");
    if (btnRefreshAna) {
      btnRefreshAna.addEventListener("click", () => {
        this.audio.playClick();
        btnRefreshAna.textContent = "⏳ Memuat...";
        this.renderAnalyticsDashboard(true).finally(() => {
          btnRefreshAna.textContent = "🔄 Muat dari Firestore";
        });
      });
    }

  }

  updateFirestoreStatusUI() {
    const status = FirestoreManager.getStatus();
    const config = getFirebaseConfig();

    const pill = document.getElementById("firestore-status-pill");
    const text = document.getElementById("firestore-status-text");
    const projTag = document.getElementById("firestore-project-text");

    const tabBadge = document.getElementById("firebase-tab-status-badge");
    const tabLabel = document.getElementById("firebase-tab-status-label");

    if (status.isConfigured && status.isConnected) {
      if (pill) {
        pill.className = "firestore-status-pill status-connected";
        text.textContent = "🟢 Cloud Firestore Terhubung";
      }
      if (projTag) {
        projTag.textContent = status.projectId;
        projTag.classList.remove("hidden");
      }
      if (tabBadge && tabLabel) {
        tabBadge.className = "firestore-status-pill status-connected";
        tabLabel.textContent = "🟢 Terhubung: " + status.projectId;
      }
    } else if (status.isConfigured && !status.isOnline) {
      if (pill) {
        pill.className = "firestore-status-pill status-connecting";
        text.textContent = "🟠 Firestore Terkonfigurasi (Offline)";
      }
      if (projTag) projTag.textContent = status.projectId;
      if (tabBadge && tabLabel) {
        tabBadge.className = "firestore-status-pill status-connecting";
        tabLabel.textContent = "🟠 Offline";
      }
    } else {
      if (pill) {
        pill.className = "firestore-status-pill status-disconnected";
        text.textContent = "🟡 Mode Lokal (Belum Terhubung Firestore)";
      }
      if (projTag) projTag.textContent = "LocalStorage";
      if (tabBadge && tabLabel) {
        tabBadge.className = "firestore-status-pill status-disconnected";
        tabLabel.textContent = "🟡 Belum Terhubung";
      }
    }

    // Populate input fields in tab-firebase
    const inputProj = document.getElementById("fb-input-project-id");
    const inputKey = document.getElementById("fb-input-api-key");
    const inputAuth = document.getElementById("fb-input-auth-domain");
    const inputApp = document.getElementById("fb-input-app-id");

    if (inputProj && !inputProj.value) inputProj.value = config.projectId || "";
    if (inputKey && !inputKey.value) inputKey.value = config.apiKey || "";
    if (inputAuth && !inputAuth.value) inputAuth.value = config.authDomain || "";
    if (inputApp && !inputApp.value) inputApp.value = config.appId || "";
  }

  async renderFirebasePanel() {
    this.updateFirestoreStatusUI();

    const countQuestionsEl = document.getElementById("fb-stat-questions-count");
    const countSessionsEl = document.getElementById("fb-stat-sessions-count");
    const statusTextEl = document.getElementById("fb-stat-status-text");

    // Fetch and count questions
    try {
      const questions = await FirestoreManager.fetchQuestions();
      if (countQuestionsEl) countQuestionsEl.textContent = questions.length;
    } catch {
      if (countQuestionsEl) countQuestionsEl.textContent = StorageManager.getCustomQuestions().length;
    }

    // Fetch and count sessions
    try {
      const sessions = await FirestoreManager.fetchGameSessions(100);
      if (countSessionsEl) countSessionsEl.textContent = sessions.length;
    } catch {
      if (countSessionsEl) countSessionsEl.textContent = StorageManager.getAnalyticsHistory().length;
    }

    const status = FirestoreManager.getStatus();
    if (statusTextEl) {
      statusTextEl.textContent = status.isConnected ? "🟢 Online" : (status.isConfigured ? "🟠 Standby" : "⚪ Lokal");
    }
  }

  async syncQuestionsFromFirestore(showAlert = true) {
    const btnSync = document.getElementById("btn-sync-firestore");
    if (btnSync) btnSync.textContent = "⏳ Menyinkronkan...";

    try {
      const questions = await FirestoreManager.fetchQuestions();
      this.game.questionEngine.onlineQuestions = questions;
      this.renderCustomQuestionsList();
      this.updateFirestoreStatusUI();
      if (showAlert) {
        this.audio.playCorrect();
        alert(`Berhasil menyinkronkan ${questions.length} soal dari Cloud Firestore!`);
      }
    } catch (err) {
      console.warn(err);
      if (showAlert) {
        this.audio.playWrong();
        alert("Gagal menyinkronkan dengan Firestore. Menggunakan bank soal lokal.");
      }
    } finally {
      if (btnSync) btnSync.textContent = "🔄 Sinkronkan Cloud";
    }
  }

  async seedDefaultQuestionsToFirestore() {
    const status = FirestoreManager.getStatus();
    if (!status.isConfigured) {
      alert("Harap konfigurasi Project ID Firebase terlebih dahulu pada tab '🔥 Cloud Firestore'.");
      // switch to tab-firebase
      document.querySelectorAll(".modal-tabs .tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
      const fbTabBtn = document.querySelector('.modal-tabs .tab-btn[data-tab="tab-firebase"]');
      if (fbTabBtn) fbTabBtn.classList.add("active");
      document.getElementById("tab-firebase").classList.add("active");
      this.renderFirebasePanel();
      return;
    }

    const proceed = confirm(`Apakah Anda yakin ingin mengunggah seluruh ${BUILT_IN_QUESTIONS.length} soal bawaan dan soal khusus mode ke Cloud Firestore (koleksi 'questions')?`);
    if (!proceed) return;

    const progressContainer = document.getElementById("fb-seed-progress-container");
    const progressBar = document.getElementById("fb-seed-progress-bar");
    const progressText = document.getElementById("fb-seed-progress-text");

    if (progressContainer) progressContainer.classList.remove("hidden");

    try {
      await FirestoreManager.seedQuestionsToFirestore(BUILT_IN_QUESTIONS, ({ current, total, percentage }) => {
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `Mengunggah: ${current} dari ${total} soal (${percentage}%)...`;
      });

      this.audio.playWin();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      alert(`🎉 Sukses! Sebanyak ${BUILT_IN_QUESTIONS.length} soal bawaan berhasil diunggah ke Cloud Firestore!`);

      // Auto-sync after seed
      await this.syncQuestionsFromFirestore(false);
      this.renderFirebasePanel();
    } catch (err) {
      this.audio.playWrong();
      alert(`Gagal mengunggah soal: ${err.message}`);
    } finally {
      if (progressContainer) {
        setTimeout(() => progressContainer.classList.add("hidden"), 3000);
      }
    }
  }

  async testFirebaseConnectionUI() {
    const feedback = document.getElementById("firebase-test-feedback");
    feedback.className = "fb-feedback-box feedback-info";
    feedback.classList.remove("hidden");
    feedback.textContent = "⏳ Sedang menguji koneksi ke Cloud Firestore...";

    const projectId = document.getElementById("fb-input-project-id").value.trim();
    const apiKey = document.getElementById("fb-input-api-key").value.trim();
    const authDomain = document.getElementById("fb-input-auth-domain").value.trim();
    const appId = document.getElementById("fb-input-app-id").value.trim();

    const configToTest = {
      projectId,
      apiKey,
      authDomain,
      appId
    };

    const res = await testFirestoreConnection(configToTest);
    if (res.success) {
      this.audio.playCorrect();
      feedback.className = "fb-feedback-box feedback-success";
      feedback.textContent = `✅ ${res.message}`;
    } else {
      this.audio.playWrong();
      feedback.className = "fb-feedback-box feedback-error";
      feedback.textContent = `❌ ${res.message}`;
    }
    this.updateFirestoreStatusUI();
  }

  async saveFirebaseConfigUI() {
    const projectId = document.getElementById("fb-input-project-id").value.trim();
    const apiKey = document.getElementById("fb-input-api-key").value.trim();
    const authDomain = document.getElementById("fb-input-auth-domain").value.trim();
    const appId = document.getElementById("fb-input-app-id").value.trim();

    const config = {
      projectId,
      apiKey,
      authDomain,
      appId
    };

    const authConfig = validateFirebaseAuthConfig(config);
    if (!authConfig.valid) {
      const feedback = document.getElementById("firebase-test-feedback");
      feedback.className = "fb-feedback-box feedback-error";
      feedback.classList.remove("hidden");
      feedback.textContent = `❌ Belum dapat disimpan. Lengkapi: ${authConfig.missingLabels.join(", ")}.`;
      return;
    }

    saveFirebaseConfig(config);
    await ensureAnonymousAuth().catch((error) => {
      console.warn("[Firebase] Konfigurasi tersimpan, tetapi sesi anonim belum aktif:", error);
    });
    this.audio.playCorrect();
    alert("Konfigurasi Firebase berhasil disimpan dan diterapkan!");
    this.updateFirestoreStatusUI();
    this.renderFirebasePanel();
    this.syncQuestionsFromFirestore(false);
  }

  async resetFirebaseConfigUI() {
    resetFirebaseConfig();
    await ensureAnonymousAuth().catch(() => null);
    this.audio.playClick();
    alert("Konfigurasi kustom dihapus. Menggunakan variabel lingkungan .env!");
    document.getElementById("fb-input-project-id").value = "";
    document.getElementById("fb-input-api-key").value = "";
    document.getElementById("fb-input-auth-domain").value = "";
    document.getElementById("fb-input-app-id").value = "";
    this.updateFirestoreStatusUI();
    this.renderFirebasePanel();
  }

  copyFirestoreRulesUI() {
    navigator.clipboard.writeText(firestoreRules).then(() => {
      this.audio.playClick();
      alert("Aturan keamanan (firestore.rules) berhasil disalin ke clipboard! Buka Firebase Console > Firestore Database > Rules dan tempel di sana.");
    }).catch(() => {
      alert("Gagal menyalin otomatis. Silakan buka file 'firestore.rules' di folder proyek.");
    });
  }

  // ==========================================
  // MULTIPLAYER ONLINE METHODS & SCREENS
  // ==========================================

  handleMultiplayerRoomUpdate(room) {
    if (!room) return;
    const state = this.game.state;

    if (state === GAME_STATES.MULTIPLAYER_HOST_LOBBY) {
      this.updateHostLobbyPlayersUI(room);
    } else if (state === GAME_STATES.MULTIPLAYER_HOST_GAME) {
      const readyNumber = document.getElementById("mp-ready-count");
      if (room.status === ROOM_STATUS.COUNTDOWN) {
        if (readyNumber) readyNumber.textContent = room.countdownSec || 1;
        else this.renderMultiplayerHostGame(document.getElementById("msc-main"));
      } else if (room.status === ROOM_STATUS.QUESTION && readyNumber) {
        this.renderMultiplayerHostGame(document.getElementById("msc-main"));
      } else {
        this.updateHostGameProgressUI(room);
      }
    } else if (state === GAME_STATES.MULTIPLAYER_PLAYER_LOBBY) {
      this.updatePlayerLobbyPeersUI(room);
      if (room.status === ROOM_STATUS.COUNTDOWN || room.status === ROOM_STATUS.QUESTION) {
        this.game.setState(GAME_STATES.MULTIPLAYER_PLAYER_GAME);
      }
    } else if (state === GAME_STATES.MULTIPLAYER_PLAYER_GAME) {
      const readyNumber = document.getElementById("mp-ready-count");
      if (room.status === ROOM_STATUS.COUNTDOWN) {
        if (readyNumber) readyNumber.textContent = room.countdownSec || 1;
        else this.renderMultiplayerPlayerGame(document.getElementById("msc-main"));
      } else if (room.status === ROOM_STATUS.QUESTION && readyNumber) {
        this.renderMultiplayerPlayerGame(document.getElementById("msc-main"));
      } else if (room.status === ROOM_STATUS.ROUND_RESULT) {
        this.game.setState(GAME_STATES.MULTIPLAYER_ROUND_RESULT);
      } else if (room.status === ROOM_STATUS.PODIUM) {
        this.game.setState(GAME_STATES.MULTIPLAYER_PODIUM);
      }
    } else if (state === GAME_STATES.MULTIPLAYER_ROUND_RESULT && !this.multiplayer.isHost) {
      if (room.status === ROOM_STATUS.COUNTDOWN || room.status === ROOM_STATUS.QUESTION) {
        this.game.setState(GAME_STATES.MULTIPLAYER_PLAYER_GAME);
      } else if (room.status === ROOM_STATUS.PODIUM) {
        this.game.setState(GAME_STATES.MULTIPLAYER_PODIUM);
      }
    }
  }

  // 1. MULTIPLAYER HUB SCREEN
  renderMultiplayerHubScreen(container) {
    const isOnline = this.multiplayer.isOnlineFirestoreActive();

    container.innerHTML = `
      <div class="screen-mp-hub animate-fade-in">
        <div class="mp-hub-header">
          <button id="btn-mp-hub-back" class="back-link-btn">← Kembali ke Beranda</button>
          <div class="hero-badge">🌐 KELAS MULTIPLAYER REAL-TIME</div>
          <h2>Game Show Kelas Interaktif</h2>
          <p>Satu layar kelas untuk soal &amp; leaderboard, seluruh siswa menjawab serentak dengan kamera HP masing-masing!</p>
          <div class="mp-connection-pill ${isOnline ? 'online' : 'local'}">
            <span class="status-dot"></span>
            <span>${isOnline ? 'Cloud Firestore Aktif (Terhubung ke Internet)' : 'Local Peer Channel Aktif (Siap Main Antar Tab / Offline)'}</span>
          </div>
        </div>

        <div class="mp-hub-grid">
          <!-- Card Host / Guru -->
          <div class="mp-hub-card host-card" id="btn-hub-host">
            <div class="mp-card-icon">🖥️👑</div>
            <div class="mp-card-tag">PAPAN INTERAKTIF / GURU</div>
            <h3>Buat Room Kelas (Host)</h3>
            <p>Buka room di layar depan kelas (PID). Dapatkan kode PIN, tampilkan soal besar, dan pantau respons siswa secara live!</p>
            <button class="primary-btn mp-action-btn">Buka Room Baru ▶</button>
          </div>

          <!-- Card Siswa / Pemain -->
          <div class="mp-hub-card player-card" id="btn-hub-player">
            <div class="mp-card-icon">📱🎒</div>
            <div class="mp-card-tag">SMARTPHONE / LAPTOP SISWA</div>
            <h3>Gabung Sebagai Siswa</h3>
            <p>Pilih avatar favorit, masukkan kode PIN room dari guru, dan jawab setiap soal dengan gerakan tubuh di depan kamera HP-mu!</p>
            <button class="secondary-btn mp-action-btn" style="background:#7C3AED; color:#FFF; border:none;">Masukkan PIN &amp; Nama ▶</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-mp-hub-back")?.addEventListener("click", () => {
      this.audio.playClick();
      this.game.setState(GAME_STATES.HOME);
    });

    document.getElementById("btn-hub-host")?.addEventListener("click", () => {
      this.audio.playClick();
      this.game.setState(GAME_STATES.MULTIPLAYER_HOST_LOBBY);
    });

    document.getElementById("btn-hub-player")?.addEventListener("click", () => {
      this.audio.playClick();
      this.game.setState(GAME_STATES.MULTIPLAYER_JOIN);
    });
  }

  // 2. MULTIPLAYER HOST LOBBY
  async renderMultiplayerHostLobby(container) {
    container.innerHTML = `
      <div class="screen-mp-host-lobby animate-fade-in">
        <div class="mp-lobby-top">
          <button id="btn-mp-lobby-back" class="back-link-btn">← Kembali ke Hub</button>
          <span class="calib-live-badge" id="mp-host-sync-badge"><span class="status-dot"></span> HOST MODE</span>
        </div>

        <div class="mp-lobby-header-card">
          <span class="mp-lobby-icon">👑</span>
          <h2>Lobby Game Show Kelas</h2>
          <p>Minta siswa membuka web ini di HP masing-masing dan memasukkan Kode PIN di bawah:</p>
          
          <div class="mp-pin-container">
            <span class="mp-pin-label">KODE PIN ROOM:</span>
            <div class="mp-pin-code" id="mp-display-pin">MEMBUAT...</div>
            <button id="btn-copy-pin" class="mp-copy-btn" title="Salin Kode PIN">📋 Salin PIN</button>
          </div>
        </div>

        <!-- Room Settings Bar -->
        <div class="mp-room-settings-card">
          <h4>⚙️ Pengaturan Soal Pertandingan:</h4>
          <div class="mp-settings-row">
            <div class="mp-setting-group">
              <label>Kategori:</label>
              <select id="mp-set-category">
                <option value="numerasi" selected>Numerasi (Matematika &amp; Pola)</option>
                <option value="literasi">Literasi Detektif</option>
                <option value="all">Campuran (Semua)</option>
              </select>
            </div>
            <div class="mp-setting-group">
              <label>Kelas:</label>
              <select id="mp-set-grade">
                <option value="all">Semua Kelas</option>
                <option value="1">Kelas 1</option>
                <option value="2">Kelas 2</option>
                <option value="3">Kelas 3</option>
                <option value="4" selected>Kelas 4</option>
                <option value="5">Kelas 5</option>
                <option value="6">Kelas 6</option>
              </select>
            </div>
            <div class="mp-setting-group">
              <label>Jumlah Soal:</label>
              <select id="mp-set-count">
                <option value="3">3 Soal (Kilat)</option>
                <option value="5" selected>5 Soal (Standar)</option>
                <option value="10">10 Soal (Turnamen)</option>
              </select>
            </div>
            <div class="mp-setting-group">
              <label>Waktu per Soal:</label>
              <select id="mp-set-time">
                <option value="20">20 Detik</option>
                <option value="30" selected>30 Detik</option>
                <option value="45">45 Detik</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Real-Time Joined Players Section -->
        <div class="mp-players-section">
          <div class="mp-players-header">
            <h3>👥 Siswa yang Sudah Bergabung: <span id="mp-player-count" class="mp-count-badge">0</span></h3>
            <span class="mp-players-hint">Daftar terupdate otomatis secara real-time</span>
          </div>

          <div id="mp-players-grid" class="mp-players-grid">
            <div class="mp-waiting-empty">
              <div class="pulse-icon">⏳</div>
              <p>Menunggu siswa memasukkan PIN di HP masing-masing...</p>
            </div>
          </div>
        </div>

        <!-- Action Controls -->
        <div class="mp-lobby-actions">
          <button id="btn-host-start" class="start-game-btn disabled" disabled>
            <span>🚀 MULAI PERTANDINGAN KELAS</span>
          </button>
          <button id="btn-host-close" class="secondary-btn">
            ❌ Batalkan &amp; Tutup Room
          </button>
        </div>
      </div>
    `;

    // Initialize or fetch questions for the room
    const initQuestions = () => {
      const cat = document.getElementById("mp-set-category")?.value || "numerasi";
      const gr = document.getElementById("mp-set-grade")?.value || "4";
      const count = parseInt(document.getElementById("mp-set-count")?.value, 10) || 5;
      const time = parseInt(document.getElementById("mp-set-time")?.value, 10) || 30;

      const qList = this.game.questionEngine.getQuestions({
        category: cat,
        grade: gr,
        count
      });

      return { cat, gr, count, time, qList };
    };

    const { cat, gr, count, time, qList } = initQuestions();

    // Create room
    const readyCountdownSeconds = StorageManager.getSettings().readyCountdownSeconds;
    const room = await this.multiplayer.createRoom({
      hostName: "Guru",
      category: cat,
      grade: gr,
      totalQuestions: count,
      timeLimit: time,
      readyCountdownSeconds,
      questions: qList
    });

    const pinEl = document.getElementById("mp-display-pin");
    if (pinEl) pinEl.textContent = room.roomCode;
    const syncBadge = document.getElementById("mp-host-sync-badge");
    if (syncBadge) {
      syncBadge.textContent = this.multiplayer.cloudConnected
        ? "☁️ HOST CLOUD AMAN"
        : "💻 HOST LOKAL — periksa konfigurasi atau aturan Firestore";
    }

    // Setting changes listener
    const updateSettings = () => {
      if (!this.multiplayer.currentRoom) return;
      const { cat, gr, count, time, qList } = initQuestions();
      this.multiplayer.currentRoom.settings = {
        category: cat,
        grade: gr,
        totalQuestions: count,
        timeLimit: time,
        readyCountdownSeconds
      };
      this.multiplayer.currentRoom.questions = qList;
      this.multiplayer._syncRoomUpdate(this.multiplayer.currentRoom);
    };

    document.getElementById("mp-set-category")?.addEventListener("change", updateSettings);
    document.getElementById("mp-set-grade")?.addEventListener("change", updateSettings);
    document.getElementById("mp-set-count")?.addEventListener("change", updateSettings);
    document.getElementById("mp-set-time")?.addEventListener("change", updateSettings);

    // Copy PIN button
    document.getElementById("btn-copy-pin")?.addEventListener("click", () => {
      navigator.clipboard.writeText(room.roomCode).then(() => {
        this.audio.playClick();
        alert(`Kode PIN "${room.roomCode}" berhasil disalin!`);
      });
    });

    // Start Game button
    document.getElementById("btn-host-start")?.addEventListener("click", async () => {
      this.audio.playVictory();
      await this.multiplayer.startRoomGame();
      this.game.setState(GAME_STATES.MULTIPLAYER_HOST_GAME);
    });

    // Close / Back button
    const closeHandler = async () => {
      this.audio.playClick();
      await this.multiplayer.closeRoom();
      this.game.setState(GAME_STATES.MULTIPLAYER_HUB);
    };
    document.getElementById("btn-mp-lobby-back")?.addEventListener("click", closeHandler);
    document.getElementById("btn-host-close")?.addEventListener("click", closeHandler);
  }

  updateHostLobbyPlayersUI(room) {
    const countEl = document.getElementById("mp-player-count");
    const gridEl = document.getElementById("mp-players-grid");
    const startBtn = document.getElementById("btn-host-start");
    if (!gridEl || !room) return;

    const players = Object.values(room.players || {});
    if (countEl) countEl.textContent = players.length;

    if (players.length === 0) {
      gridEl.innerHTML = `
        <div class="mp-waiting-empty">
          <div class="pulse-icon">⏳</div>
          <p>Menunggu siswa memasukkan PIN di HP masing-masing...</p>
        </div>
      `;
      if (startBtn) {
        startBtn.classList.add("disabled");
        startBtn.setAttribute("disabled", "true");
        startBtn.classList.remove("ready-pulse");
      }
    } else {
      gridEl.innerHTML = players.map((p) => `
        <div class="mp-player-chip animate-scale-up">
          <span class="mp-chip-avatar">${escapeHTML(p.avatar || '🦁')}</span>
          <span class="mp-chip-name">${escapeHTML(p.name)}</span>
          <span class="role-badge">${p.participantType === "group" ? "Kelompok" : "Siswa"}</span>
          <span class="mp-chip-ready">✓ Siap</span>
        </div>
      `).join("");

      if (startBtn) {
        startBtn.classList.remove("disabled");
        startBtn.removeAttribute("disabled");
        startBtn.classList.add("ready-pulse");
      }
    }
  }

  // 3. MULTIPLAYER JOIN SCREEN (STUDENT)
  renderMultiplayerJoinScreen(container) {
    let selectedAvatar = "🦁";
    const avatars = ["🦁", "🐯", "🐼", "🦊", "🚀", "⚡", "🦄", "🐬"];

    container.innerHTML = `
      <div class="screen-mp-join animate-fade-in">
        <button id="btn-mp-join-back" class="back-link-btn">← Kembali ke Hub</button>

        <div class="mp-join-card">
          <div class="mp-join-icon">📱</div>
          <h2>Gabung Game Show Kelas</h2>
          <p>Masukkan Kode PIN 6 karakter yang ada di layar depan kelas:</p>

          <div class="mp-join-form">
            <div class="form-group">
              <label>KODE PIN ROOM:</label>
              <input type="text" id="mp-input-pin" maxlength="6" placeholder="Contoh: MSC-892 atau 582914" autocomplete="off" style="text-transform:uppercase; font-size:1.6rem; letter-spacing:0.15em; text-align:center; font-weight:900;">
            </div>

            <div class="form-group" style="margin-top:14px;">
              <label>BERGABUNG SEBAGAI:</label>
              <select id="mp-participant-type" style="font-size:1.05rem; font-weight:700;"><option value="student">Siswa / individu</option><option value="group">Kelompok / tim</option></select>
            </div>

            <div class="form-group" style="margin-top:14px;">
              <label id="mp-name-label">NAMA PANGGILAN SISWA:</label>
              <input type="text" id="mp-input-name" maxlength="40" placeholder="Contoh: Budi" autocomplete="off" style="font-size:1.15rem; font-weight:700;">
              <small>Nama hanya dikirim ke room dan laporan guru. Perangkat peserta tidak menyimpannya sebagai riwayat.</small>
            </div>

            <div class="form-group" style="margin-top:14px;">
              <label>PILIH AVATAR FAVORIT:</label>
              <div class="mp-avatar-picker">
                ${avatars.map((av, idx) => `
                  <button type="button" class="mp-avatar-btn ${idx === 0 ? 'selected' : ''}" data-avatar="${av}">
                    ${av}
                  </button>
                `).join("")}
              </div>
            </div>

            <div id="mp-join-error" class="error-text hidden" style="margin-top:12px;"></div>

            <button id="btn-submit-join" class="start-game-btn" style="margin-top:20px; width:100%; max-width:100%;">
              <span>MASUK KE ARENA GAME 🎮</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById("btn-mp-join-back")?.addEventListener("click", () => {
      this.audio.playClick();
      this.game.setState(GAME_STATES.MULTIPLAYER_HUB);
    });

    document.getElementById("mp-participant-type")?.addEventListener("change", (event) => {
      const isGroup = event.target.value === "group";
      document.getElementById("mp-name-label").textContent = isGroup ? "NAMA KELOMPOK / TIM:" : "NAMA PANGGILAN SISWA:";
      document.getElementById("mp-input-name").placeholder = isGroup ? "Contoh: Kelompok Garuda" : "Contoh: Budi";
    });

    // Avatar selector
    const avatarBtns = document.querySelectorAll(".mp-avatar-btn");
    avatarBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.audio.playClick();
        avatarBtns.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedAvatar = btn.getAttribute("data-avatar");
      });
    });

    // Submit Join
    const submitJoin = async () => {
      const pin = document.getElementById("mp-input-pin").value.trim().toUpperCase();
      const participantType = document.getElementById("mp-participant-type").value;
      const name = document.getElementById("mp-input-name").value.trim() || (participantType === "group" ? "Kelompok" : "Siswa");
      const errBox = document.getElementById("mp-join-error");

      if (!pin) {
        errBox.textContent = "Mohon masukkan Kode PIN Room terlebih dahulu!";
        errBox.classList.remove("hidden");
        return;
      }

      errBox.classList.add("hidden");
      this.audio.playClick();

      try {
        await this.multiplayer.joinRoom(pin, { name, avatar: selectedAvatar, participantType });
        this.audio.playVictory();
        this.game.setState(GAME_STATES.MULTIPLAYER_PLAYER_LOBBY);
      } catch (err) {
        this.audio.playWrong();
        errBox.textContent = err.message || "Gagal bergabung ke room!";
        errBox.classList.remove("hidden");
      }
    };

    document.getElementById("btn-submit-join")?.addEventListener("click", submitJoin);
    document.getElementById("mp-input-pin")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitJoin();
    });
    document.getElementById("mp-input-name")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitJoin();
    });
  }

  // 4. MULTIPLAYER PLAYER LOBBY (WAITING)
  renderMultiplayerPlayerLobby(container) {
    const room = this.multiplayer.currentRoom;
    const name = this.multiplayer.localPlayerName;
    const avatar = this.multiplayer.localPlayerAvatar;

    container.innerHTML = `
      <div class="screen-mp-player-lobby animate-fade-in">
        <div class="mp-player-lobby-card">
          <div class="mp-player-badge-top">${avatar}</div>
          <h2>${this.multiplayer.localParticipantType === "group" ? "Halo, Kelompok" : "Halo"}, ${escapeHTML(name)}!</h2>
          <p class="mp-joined-room-text">Kamu terhubung ke Room: <strong>${room ? room.roomCode : '...'}</strong></p>

          <div class="mp-player-status-box">
            <div class="pulse-icon">⏳</div>
            <h3>Menunggu Guru Memulai Pertandingan...</h3>
            <p>Perhatikan layar depan kelas dan bersiaplah menjawab dengan gerakan tubuh!</p>
          </div>

          <div class="mp-quick-rules-card">
            <h4>💡 Cara Menjawab Cepat:</h4>
            <ul>
              <li>✋ <strong>Pilihan A:</strong> Angkat Tangan Kiri</li>
              <li>✋ <strong>Pilihan B:</strong> Angkat Tangan Kanan</li>
              <li>🙌 <strong>Pilihan C:</strong> Angkat Kedua Tangan</li>
              <li>🧘 <strong>Pilihan D:</strong> Posisi Jongkok</li>
            </ul>
          </div>

          <div class="mp-peers-section">
            <h4>Teman Sekelas di Room Ini:</h4>
            <div id="mp-peer-chips" class="mp-peers-chips-grid">
              ${Object.values(room?.players || {}).map((p) => `
                <span class="mp-peer-tag">${escapeHTML(p.avatar || '🦁')} ${escapeHTML(p.name)}</span>
              `).join("")}
            </div>
          </div>

          <button id="btn-player-leave" class="secondary-btn" style="margin-top:20px; width:100%;">
            🚪 Keluar dari Room
          </button>
        </div>
      </div>
    `;

    document.getElementById("btn-player-leave")?.addEventListener("click", () => {
      this.audio.playClick();
      this.multiplayer.leaveRoom();
      this.game.setState(GAME_STATES.MULTIPLAYER_HUB);
    });
  }

  updatePlayerLobbyPeersUI(room) {
    const chipsEl = document.getElementById("mp-peer-chips");
    if (!chipsEl || !room) return;
    chipsEl.innerHTML = Object.values(room.players || {}).map((p) => `
      <span class="mp-peer-tag">${escapeHTML(p.avatar || '🦁')} ${escapeHTML(p.name)}</span>
    `).join("");
  }

  // 5. MULTIPLAYER HOST GAME SCREEN (BIG DISPLAY)
  renderMultiplayerReadyScreen(container, room, audience = "student") {
    const isHost = audience === "host";
    container.innerHTML = `
      <div class="screen-countdown multiplayer-ready-screen animate-scale-up">
        <div class="movement-ready-card">
          <span class="ready-eyebrow">${isHost ? "KELAS SEDANG BERSIAP" : "SIAPKAN GERAKANMU"}</span>
          <div class="countdown-circle">
            <div id="mp-ready-count" class="countdown-number">${Number(room.countdownSec) || 1}</div>
          </div>
          <h2>${isHost ? "Pastikan semua siswa siap" : "Ambil posisi di depan kamera"}</h2>
          <p class="countdown-tag">Soal ${Number(room.currentQuestionIndex) + 1} segera dimulai.</p>
          <div class="ready-step-grid">
            <span>① Tubuh terlihat</span>
            <span>② Ruang gerak aman</span>
            <span>③ Fokus ke layar</span>
          </div>
          <span class="ready-room-label">Room ${escapeHTML(room.roomCode || "")}</span>
        </div>
      </div>
    `;
  }

  renderMultiplayerHostGame(container) {
    const room = this.multiplayer.currentRoom;
    if (!room) return;
    if (room.status === ROOM_STATUS.COUNTDOWN) {
      if (this._hostGameInterval) clearInterval(this._hostGameInterval);
      this.renderMultiplayerReadyScreen(container, room, "host");
      return;
    }

    const currentQ = room.questions[room.currentQuestionIndex] || room.questions[0];
    const totalQ = room.questions.length;
    const qIndex = room.currentQuestionIndex + 1;

    container.innerHTML = `
      <div class="screen-mp-host-game animate-fade-in">
        <!-- TOP HUD BAR -->
        <div class="game-hud-bar">
          <div class="hud-left">
            <span class="hud-pill hud-q-num">SOAL ${qIndex} / ${totalQ}</span>
            <span class="hud-pill hud-topic">${escapeHTML(currentQ.topic || currentQ.category?.toUpperCase() || "Materi")}</span>
            <span class="hud-pill" style="background:#7C3AED22; color:#7C3AED;">ROOM: ${room.roomCode}</span>
          </div>

          <!-- Timer Bar -->
          <div class="timer-container" style="flex:1; max-width:320px;">
            <span style="font-size:1.1rem;">⏱️</span>
            <div class="timer-track">
              <div id="mp-host-timer-bar" class="timer-fill" style="width:100%;"></div>
            </div>
            <span id="mp-host-timer-text" class="timer-digits">${room.settings.timeLimit || 30}s</span>
          </div>

          <div class="hud-right">
            <button id="btn-host-force-end" class="hud-btn" style="background:var(--accent); color:#0F172A; border:none;">
              ⏱️ Kunci Ronde Sekarang ▶
            </button>
          </div>
        </div>

        <!-- Question Presentation -->
        <div class="question-main-card" style="padding:28px 36px; margin: 14px 0;">
          ${this.renderQuestionImage(currentQ, "question-media-host")}
          <h2 class="question-title-text" style="font-size:2.2rem;">${escapeHTML(currentQ.question)}</h2>
        </div>

        <!-- 4 Options Grid -->
        <div class="options-container options-4-grid">
          ${currentQ.options.map((opt, idx) => {
            const letter = ["A", "B", "C", "D"][idx];
            const gestureIcon = idx === 0 ? "✋ Tangan Kiri" : idx === 1 ? "✋ Tangan Kanan" : idx === 2 ? "🙌 Kedua Tangan" : "🧘 Jongkok";
            return `
              <div class="option-card opt-${letter.toLowerCase()}">
                <div class="opt-gesture-badge"><span>${gestureIcon}</span></div>
                <div class="opt-body">
                  <span class="opt-label-letter">${letter}</span>
                  <span class="opt-text">${escapeHTML(opt)}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <!-- LIVE CLASS RESPONSE PROGRESS -->
        <div class="mp-live-response-section">
          <div class="mp-response-header">
            <h4>📊 Respons Siswa: <span id="mp-host-answered-count">0 / 0 Siswa Menjawab</span></h4>
            <div class="mp-response-track">
              <div id="mp-host-response-fill" class="mp-response-fill" style="width:0%;"></div>
            </div>
          </div>
          <div id="mp-host-player-status-chips" class="mp-player-status-chips">
            <!-- Dynamically populated chips -->
          </div>
        </div>
      </div>
    `;

    // Start Host Timer Countdown
    let timeLeft = room.settings.timeLimit || 30;
    const timerFill = document.getElementById("mp-host-timer-bar");
    const timerText = document.getElementById("mp-host-timer-text");

    if (this._hostGameInterval) clearInterval(this._hostGameInterval);
    this._hostGameInterval = setInterval(async () => {
      timeLeft--;
      if (timerText) timerText.textContent = `${timeLeft}s`;
      if (timerFill) {
        const pct = Math.max(0, (timeLeft / (room.settings.timeLimit || 30)) * 100);
        timerFill.style.width = `${pct}%`;
        if (timeLeft <= 5) timerFill.classList.add("timer-danger");
      }

      if (timeLeft <= 0) {
        clearInterval(this._hostGameInterval);
        this.audio.playClick();
        await this.multiplayer.advanceToRoundResult();
        this.game.setState(GAME_STATES.MULTIPLAYER_ROUND_RESULT);
      }
    }, 1000);

    // Host force end round button
    document.getElementById("btn-host-force-end")?.addEventListener("click", async () => {
      if (this._hostGameInterval) clearInterval(this._hostGameInterval);
      this.audio.playClick();
      await this.multiplayer.advanceToRoundResult();
      this.game.setState(GAME_STATES.MULTIPLAYER_ROUND_RESULT);
    });

    this.updateHostGameProgressUI(room);
  }

  updateHostGameProgressUI(room) {
    if (!room) return;
    const answeredCountEl = document.getElementById("mp-host-answered-count");
    const fillEl = document.getElementById("mp-host-response-fill");
    const chipsEl = document.getElementById("mp-host-player-status-chips");
    if (!answeredCountEl || !chipsEl) return;

    const players = Object.values(room.players || {});
    const answered = players.filter((p) => p.hasAnswered);

    answeredCountEl.textContent = `${answered.length} / ${players.length} Siswa Sudah Mengunci Jawaban`;
    if (fillEl && players.length > 0) {
      fillEl.style.width = `${Math.round((answered.length / players.length) * 100)}%`;
    }

    chipsEl.innerHTML = players.map((p) => `
      <span class="mp-chip-student ${p.hasAnswered ? 'answered' : ''}">
        ${escapeHTML(p.avatar || '🦁')} ${escapeHTML(p.name)} ${p.hasAnswered ? '✓' : '...'}
      </span>
    `).join("");

    // Auto-advance if all players have answered!
    if (players.length > 0 && answered.length === players.length && this.multiplayer.isHost) {
      setTimeout(async () => {
        if (this._hostGameInterval) clearInterval(this._hostGameInterval);
        await this.multiplayer.advanceToRoundResult();
        this.game.setState(GAME_STATES.MULTIPLAYER_ROUND_RESULT);
      }, 1200);
    }
  }

  // 6. MULTIPLAYER PLAYER GAME SCREEN (STUDENT PHONE / LAPTOP)
  renderMultiplayerPlayerGame(container) {
    const room = this.multiplayer.currentRoom;
    if (!room) return;
    if (room.status === ROOM_STATUS.COUNTDOWN) {
      this.renderMultiplayerReadyScreen(container, room, "student");
      return;
    }

    const currentQ = room.questions[room.currentQuestionIndex] || room.questions[0];
    const totalQ = room.questions.length;
    const qIndex = room.currentQuestionIndex + 1;
    const player = room.players?.[this.multiplayer.localPlayerId];

    container.innerHTML = `
      <div class="screen-mp-player-game animate-fade-in">
        <!-- TOP STATUS -->
        <div class="mp-player-game-header">
          <div class="mp-player-info-pill">
            <span>${escapeHTML(player?.avatar || '🦁')}</span>
            <strong>${escapeHTML(player?.name || 'Siswa')}</strong>
            <span class="mp-score-val">${player?.score || 0} PTS</span>
          </div>
          <span class="hud-pill hud-q-num">SOAL ${qIndex} / ${totalQ}</span>
        </div>

        <!-- Question Card -->
        <div class="question-main-card" style="padding:18px 20px; margin: 12px 0;">
          ${this.renderQuestionImage(currentQ, "question-media-player")}
          <h3 class="question-title-text" style="font-size:1.35rem; line-height:1.3;">${escapeHTML(currentQ.question)}</h3>
        </div>

        <!-- Lock Status Banner -->
        <div id="mp-player-lock-banner" class="mp-lock-banner ${player?.hasAnswered ? 'locked' : 'hidden'}" aria-live="polite">
          ${player?.hasAnswered 
            ? `✅ Jawaban Terkunci: <strong>Pilihan ${player.lastAnswer}</strong> (${((player.answerTimeMs || 0)/1000).toFixed(1)}s)`
            : 'Menunggu pilihan gerakanmu di depan kamera...'}
        </div>

        <!-- 4 Options Grid (Interactive Buttons for Touch Fallback as well) -->
        <div class="options-container options-4-grid">
          ${currentQ.options.map((opt, idx) => {
            const letter = ["A", "B", "C", "D"][idx];
            const isSelected = player?.hasAnswered && player.lastAnswer === letter;
            const gestureIcon = idx === 0 ? "✋ Kiri" : idx === 1 ? "✋ Kanan" : idx === 2 ? "🙌 Dua Tangan" : "🧘 Jongkok";
            return `
              <div id="mp-opt-card-${idx}" class="option-card opt-${letter.toLowerCase()} ${isSelected ? 'holding' : ''}" data-letter="${letter}">
                <div class="opt-gesture-badge"><span>${gestureIcon}</span></div>
                <div class="opt-body">
                  <span class="opt-label-letter">${letter}</span>
                  <span class="opt-text" style="font-size:1.15rem;">${escapeHTML(opt)}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    // Bind Touch Option Cards for mobile touch support
    currentQ.options.forEach((opt, idx) => {
      const card = document.getElementById(`mp-opt-card-${idx}`);
      if (card) {
        card.addEventListener("click", async () => {
          this.audio.playClick();
          const letter = card.getAttribute("data-letter");
          await this.handleMultiplayerPlayerGesture(letter);
        });
      }
    });
  }

  async handleMultiplayerPlayerGesture(gesture) {
    if (!this.multiplayer || !this.multiplayer.currentRoom) return;
    const map = {
      [GESTURE_TYPES.A]: "A",
      [GESTURE_TYPES.B]: "B",
      [GESTURE_TYPES.C]: "C",
      [GESTURE_TYPES.D]: "D",
      A: "A",
      B: "B",
      C: "C",
      D: "D"
    };
    const answerKey = map[gesture];
    if (!answerKey) return;

    const res = await this.multiplayer.submitAnswer(answerKey);
    if (res && res.success) {
      if (res.isCorrect === true) {
        this.audio.playCorrect();
      } else if (res.isCorrect === false) {
        this.audio.playWrong();
      }
      this.updateMultiplayerPlayerAnsweredUI(answerKey, res);
    }
  }

  updateMultiplayerPlayerAnsweredUI(answerKey, result) {
    const banner = document.getElementById("mp-player-lock-banner");
    if (banner) {
      banner.className = "mp-lock-banner locked animate-scale-up";
      banner.innerHTML = `
        ✅ Jawaban Terkunci: <strong>Pilihan ${answerKey}</strong> (${(result.responseTimeMs / 1000).toFixed(1)}s)!
        <br><span style="font-size:0.85rem; font-weight:700;">Menunggu seluruh teman sekelas menjawab...</span>
      `;
    }

    const map = { A: 0, B: 1, C: 2, D: 3 };
    const idx = map[answerKey];
    if (idx !== undefined) {
      const card = document.getElementById(`mp-opt-card-${idx}`);
      if (card) card.classList.add("holding");
    }
  }

  // 7. MULTIPLAYER ROUND RESULT SCREEN
  renderMultiplayerRoundResult(container) {
    const room = this.multiplayer.currentRoom;
    if (!room) return;

    const currentQ = room.questions[room.currentQuestionIndex] || room.questions[0];
    const totalQ = room.questions.length;
    const isLastQ = room.currentQuestionIndex >= totalQ - 1;
    const correctLetter = ["A", "B", "C", "D"][currentQ.correctAnswer];
    const leaderboard = this.multiplayer.getLeaderboard();
    const isHost = this.multiplayer.isHost;
    const distribution = this.multiplayer.getAnswerDistribution();

    container.innerHTML = `
      <div class="screen-mp-round-result animate-fade-in">
        <div class="mp-round-header-card">
          <span class="mp-round-icon">🎯</span>
          <h2>Hasil Ronde Soal ${room.currentQuestionIndex + 1}</h2>
          <div class="mp-correct-answer-banner">
            Jawaban Benar: <strong>Pilihan ${correctLetter} — ${escapeHTML(currentQ.options[currentQ.correctAnswer])}</strong>
          </div>
          ${currentQ.explanation ? `<p class="mp-round-exp">💡 <em>${escapeHTML(currentQ.explanation)}</em></p>` : ''}
        </div>

        <!-- Answer Distribution Bars -->
        <div class="mp-distribution-card">
          <h4>📊 Sebaran Jawaban Kelas:</h4>
          <div class="mp-dist-grid">
            ${["A", "B", "C", "D"].map((optKey) => {
              const count = distribution[optKey] || 0;
              const pct = distribution.total > 0 ? Math.round((count / distribution.total) * 100) : 0;
              const isCorrectOpt = optKey === correctLetter;
              return `
                <div class="mp-dist-item ${isCorrectOpt ? 'correct' : ''}">
                  <span class="mp-dist-letter">${optKey}</span>
                  <div class="mp-dist-bar-track">
                    <div class="mp-dist-bar-fill ${isCorrectOpt ? 'correct' : ''}" style="width:${pct}%;"></div>
                  </div>
                  <span class="mp-dist-count">${count} siswa (${pct}%)</span>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Live Leaderboard Table -->
        <div class="mp-leaderboard-card">
          <h3>🏆 Papan Skor Kelas Sementara:</h3>
          <div class="mp-leaderboard-list">
            ${leaderboard.map((p, idx) => `
              <div class="mp-rank-row ${idx === 0 ? 'top-1' : ''} ${p.id === this.multiplayer.localPlayerId ? 'my-row' : ''}">
                <span class="mp-rank-num">#${idx + 1}</span>
                <span class="mp-rank-avatar">${escapeHTML(p.avatar || '🦁')}</span>
                <span class="mp-rank-name">${escapeHTML(p.name)} ${p.id === this.multiplayer.localPlayerId ? '<strong>(Kamu)</strong>' : ''}</span>
                <span class="mp-rank-streak">${p.streak > 1 ? `🔥 ${p.streak}x` : ''}</span>
                <span class="mp-rank-round-pts">${p.pointsEarned ? `+${p.pointsEarned}` : '+0'}</span>
                <span class="mp-rank-score">${p.score.toLocaleString()} PTS</span>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- Actions -->
        <div class="mp-round-actions">
          ${isHost 
            ? `
              <button id="btn-host-next-q" class="primary-btn" style="min-height:56px; font-size:1.15rem;">
                ${isLastQ ? '🏆 BUKA PODIUM JUARA AKHIR ▶' : 'SOAL BERIKUTNYA ➔'}
              </button>
            `
            : `
              <div class="mp-player-waiting-hint">
                <div class="pulse-icon">⏳</div>
                <p>Menunggu guru melanjutkan ke ${isLastQ ? 'Podium Juara' : 'soal berikutnya'}...</p>
              </div>
            `}
        </div>
      </div>
    `;

    if (isHost) {
      document.getElementById("btn-host-next-q")?.addEventListener("click", async () => {
        this.audio.playClick();
        await this.multiplayer.nextQuestion();
        if (isLastQ) {
          this.game.setState(GAME_STATES.MULTIPLAYER_PODIUM);
        } else {
          this.game.setState(GAME_STATES.MULTIPLAYER_HOST_GAME);
        }
      });
    }
  }

  // 8. MULTIPLAYER PODIUM (FINAL CELEBRATION)
  renderMultiplayerPodium(container) {
    const room = this.multiplayer.currentRoom;
    const leaderboard = this.multiplayer.getLeaderboard();
    const winner1 = leaderboard[0] || { name: "-", avatar: "🥇", score: 0 };
    const winner2 = leaderboard[1] || { name: "-", avatar: "🥈", score: 0 };
    const winner3 = leaderboard[2] || { name: "-", avatar: "🥉", score: 0 };

    // Trigger celebration effects
    confetti({
      particleCount: 160,
      spread: 90,
      origin: { y: 0.55 }
    });
    this.audio.playVictory();

    if (this.multiplayer.isHost && room && !this.reportedMultiplayerRooms.has(room.roomCode)) {
      this.reportedMultiplayerRooms.add(room.roomCode);
      this.saveMultiplayerTeacherReport(room, leaderboard).catch((error) => {
        console.warn("[Multiplayer] Laporan guru belum dapat disimpan:", error);
      });
    }

    container.innerHTML = `
      <div class="screen-mp-podium animate-fade-in">
        <div class="mp-podium-header">
          <span class="mp-crown-large">👑</span>
          <h2>PODIUM JUARA KELAS!</h2>
          <p>Selamat kepada seluruh juara dan peserta yang telah berpikir dan bergerak dengan hebat!</p>
        </div>

        <!-- 3-Tier Olympic Podium -->
        <div class="mp-podium-display">
          <!-- Juara 2 -->
          <div class="mp-podium-slot slot-2 animate-scale-up">
            <span class="mp-podium-medal">🥈</span>
            <span class="mp-podium-avatar">${winner2.avatar || '🥈'}</span>
            <h4 class="mp-podium-name">${winner2.name}</h4>
            <span class="mp-podium-score">${winner2.score.toLocaleString()} PTS</span>
            <div class="mp-podium-pedestal step-2">#2</div>
          </div>

          <!-- Juara 1 -->
          <div class="mp-podium-slot slot-1 animate-scale-up">
            <span class="mp-podium-crown">👑</span>
            <span class="mp-podium-avatar avatar-1">${winner1.avatar || '🥇'}</span>
            <h3 class="mp-podium-name name-1">${winner1.name}</h3>
            <span class="mp-podium-score score-1">${winner1.score.toLocaleString()} PTS</span>
            <div class="mp-podium-pedestal step-1">#1</div>
          </div>

          <!-- Juara 3 -->
          <div class="mp-podium-slot slot-3 animate-scale-up">
            <span class="mp-podium-medal">🥉</span>
            <span class="mp-podium-avatar">${winner3.avatar || '🥉'}</span>
            <h4 class="mp-podium-name">${winner3.name}</h4>
            <span class="mp-podium-score">${winner3.score.toLocaleString()} PTS</span>
            <div class="mp-podium-pedestal step-3">#3</div>
          </div>
        </div>

        <!-- Full Rankings Table -->
        <div class="mp-full-leaderboard-card">
          <h3>📋 Hasil Lengkap Seluruh Siswa:</h3>
          <div class="mp-full-list">
            ${leaderboard.map((p, idx) => `
              <div class="mp-full-row">
                <span class="mp-full-rank">#${idx + 1}</span>
                <span class="mp-full-avatar">${escapeHTML(p.avatar || '🦁')}</span>
                <span class="mp-full-name">${escapeHTML(p.name)} <small>(${p.participantType === "group" ? "Kelompok" : "Siswa"})</small></span>
                <span class="mp-full-correct">Jawaban Benar: ${p.correctCount || 0}</span>
                <span class="mp-full-score">${p.score.toLocaleString()} PTS</span>
              </div>
            `).join("")}
          </div>
        </div>

        <div class="mp-podium-actions">
          <button id="btn-podium-finish" class="primary-btn" style="min-height:54px; padding:12px 32px; font-size:1.15rem;">
            🏠 Kembali ke Beranda
          </button>
        </div>
      </div>
    `;

    document.getElementById("btn-podium-finish")?.addEventListener("click", () => {
      this.audio.playClick();
      this.multiplayer.leaveRoom();
      this.game.setState(GAME_STATES.HOME);
    });
  }

  async saveMultiplayerTeacherReport(room, leaderboard) {
    const participants = leaderboard.map((participant) => ({
      name: participant.name,
      participantType: participant.participantType,
      score: participant.score,
      correctCount: participant.correctCount
    }));
    const totalCorrect = participants.reduce((sum, participant) => sum + participant.correctCount, 0);
    const totalAnswers = participants.length * (room.questions?.length || 0);
    await FirestoreManager.recordGameSession({
      id: `room-report-${room.roomCode}-${Date.now()}`,
      date: new Date().toISOString(),
      mode: "multiplayer_classroom",
      category: room.settings?.category || "campuran",
      grade: room.settings?.grade || "all",
      score: participants.reduce((sum, participant) => sum + participant.score, 0),
      correctCount: totalCorrect,
      wrongCount: Math.max(0, totalAnswers - totalCorrect),
      totalQuestions: totalAnswers,
      accuracy: totalAnswers ? Math.round((totalCorrect / totalAnswers) * 100) : 0,
      roomCode: room.roomCode,
      participantResults: participants
    });
  }
}


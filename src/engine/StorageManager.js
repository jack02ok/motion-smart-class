import { cleanText, safeImageUrl } from "../utils/security.js";
import { getCurrentUser } from "../firebase.js";

/**
 * MOTION SMART CLASS - Storage Manager
 * Comprehensive LocalStorage management for Settings, Custom Questions, Team scores, Analytics & Badges.
 */

const SETTINGS_KEY = "MSC_SETTINGS";
const CUSTOM_QUESTIONS_KEY = "MSC_CUSTOM_QUESTIONS";
const TEAMS_KEY = "MSC_TEAMS";
const STATS_KEY = "MSC_STATS";
const ANALYTICS_KEY = "MSC_ANALYTICS_HISTORY";
const ADVENTURE_KEY = "MSC_ADVENTURE_PROGRESS";
const SESSION_PACKAGES_KEY = "MSC_SESSION_PACKAGES";
let legacyLearningDataCleared = false;

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  timerSeconds: 40,
  readyCountdownSeconds: 5,
  confidenceThreshold: 0.60,
  cooldownSeconds: 1.2,
  holdDurationSeconds: 0.45,
  showSkeleton: true,
  debugMode: false,
  cameraEnabled: true,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  movementProfile: "standard",
  shuffleOptions: false,
  cooperativeGoal: 7,
  preferredCameraId: "user",
  teacherPin: "",
  basePoints: 100,
  speedBonusEnabled: true,
  comboMultiplierEnabled: true
};

const DEFAULT_TEAMS = [
  { id: "red", name: "Tim Merah", color: "#EF4444", members: 5, score: 0 },
  { id: "blue", name: "Tim Biru", color: "#3B82F6", members: 5, score: 0 },
  { id: "green", name: "Tim Hijau", color: "#22C55E", members: 5, score: 0 },
  { id: "yellow", name: "Tim Kuning", color: "#F59E0B", members: 5, score: 0 }
];

export class StorageManager {
  /**
   * Learning data is temporary for guests and scoped per UID for Google users.
   * sessionStorage is automatically cleared when the browser tab/session ends.
   */
  static _getLearningStore() {
    const user = getCurrentUser();
    const persistent = Boolean(user && !user.isAnonymous);
    if (!persistent && !legacyLearningDataCleared && typeof localStorage !== "undefined") {
      [STATS_KEY, ANALYTICS_KEY, ADVENTURE_KEY].forEach((key) => localStorage.removeItem(key));
      legacyLearningDataCleared = true;
    }
    const storage = persistent
      ? (typeof localStorage !== "undefined" ? localStorage : null)
      : (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    return { storage, suffix: persistent ? `_${user.uid}` : "_GUEST" };
  }

  static _learningKey(baseKey) {
    const { suffix } = this._getLearningStore();
    return `${baseKey}${suffix}`;
  }

  static getSettings() {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  static saveSettings(settings) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.warn("Failed to save settings:", e);
      return settings;
    }
  }

  static getSessionPackages() {
    try {
      const data = localStorage.getItem(SESSION_PACKAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveSessionPackage(pkg) {
    const packages = this.getSessionPackages();
    const item = {
      id: pkg.id || `package-${Date.now()}`,
      name: cleanText(pkg.name || "Paket Belajar", 80),
      category: ["numerasi", "literasi", "all"].includes(pkg.category) ? pkg.category : "all",
      grade: Math.min(6, Math.max(1, parseInt(pkg.grade, 10) || 4)),
      difficulty: ["easy", "medium", "hard", "all"].includes(pkg.difficulty) ? pkg.difficulty : "all",
      mode: ["quick_quiz", "detective", "cooperative", "presentation"].includes(pkg.mode) ? pkg.mode : "quick_quiz",
      count: Math.min(20, Math.max(3, parseInt(pkg.count, 10) || 8)),
      updatedAt: new Date().toISOString()
    };
    const index = packages.findIndex((entry) => entry.id === item.id);
    if (index >= 0) packages[index] = item;
    else packages.unshift(item);
    localStorage.setItem(SESSION_PACKAGES_KEY, JSON.stringify(packages));
    return item;
  }

  static deleteSessionPackage(id) {
    const packages = this.getSessionPackages().filter((entry) => entry.id !== id);
    localStorage.setItem(SESSION_PACKAGES_KEY, JSON.stringify(packages));
    return packages;
  }

  static importQuestionsFromCSV(csvText) {
    const rows = String(csvText || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim());
    if (rows.length < 2) return { success: false, importedCount: 0, error: "CSV tidak memiliki baris data." };

    const parseRow = (row) => {
      const cells = [];
      let value = "";
      let quoted = false;
      for (let i = 0; i < row.length; i++) {
        const char = row[i];
        if (char === '"' && quoted && row[i + 1] === '"') { value += '"'; i++; }
        else if (char === '"') quoted = !quoted;
        else if (char === "," && !quoted) { cells.push(value.trim()); value = ""; }
        else value += char;
      }
      cells.push(value.trim());
      return cells;
    };

    const headers = parseRow(rows[0]).map((header) => header.toLowerCase());
    const required = ["question", "optiona", "optionb", "optionc", "optiond", "correctanswer"];
    if (!required.every((header) => headers.includes(header))) {
      return { success: false, importedCount: 0, error: `Kolom wajib: ${required.join(", ")}.` };
    }
    const valueAt = (cells, key) => cells[headers.indexOf(key)] || "";
    const questions = rows.slice(1).map((row) => {
      const cells = parseRow(row);
      const answerRaw = valueAt(cells, "correctanswer").toUpperCase();
      const correctAnswer = /^[ABCD]$/.test(answerRaw) ? answerRaw.charCodeAt(0) - 65 : Number(answerRaw) || 0;
      return {
        question: valueAt(cells, "question"),
        options: ["optiona", "optionb", "optionc", "optiond"].map((key) => valueAt(cells, key)),
        correctAnswer,
        category: valueAt(cells, "category") || "numerasi",
        grade: valueAt(cells, "grade") || 4,
        difficulty: valueAt(cells, "difficulty") || "medium",
        topic: valueAt(cells, "topic") || "Materi Umum",
        imageUrl: valueAt(cells, "imageurl"),
        imageAlt: valueAt(cells, "imagealt"),
        explanation: valueAt(cells, "explanation")
      };
    });
    return this.importCustomQuestions(questions);
  }

  // ==========================================
  // CUSTOM QUESTIONS CRUD
  // ==========================================
  static getCustomQuestions() {
    try {
      const data = localStorage.getItem(CUSTOM_QUESTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveCustomQuestion(question) {
    try {
      const questions = this.getCustomQuestions();
      const newQuestion = {
        ...question,
        id: question.id || "custom-" + Date.now(),
        imageUrl: safeImageUrl(question.imageUrl),
        imageAlt: cleanText(question.imageAlt || question.question, 160),
        imageLayout: ["contain", "wide", "compact"].includes(question.imageLayout) ? question.imageLayout : "contain",
        timeLimit: parseInt(question.timeLimit, 10) || 40,
        pointWeight: parseInt(question.pointWeight, 10) || 100,
        createdAt: question.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      questions.unshift(newQuestion);
      localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
      return newQuestion;
    } catch (e) {
      console.error("Failed to save custom question:", e);
      return null;
    }
  }

  static updateCustomQuestion(id, updatedData) {
    try {
      const questions = this.getCustomQuestions();
      const index = questions.findIndex((q) => q.id === id);
      if (index === -1) return null;

      questions[index] = {
        ...questions[index],
        ...updatedData,
        id, // preserve ID
        imageUrl: safeImageUrl(updatedData.imageUrl ?? questions[index].imageUrl),
        imageAlt: cleanText(updatedData.imageAlt ?? questions[index].imageAlt ?? updatedData.question ?? questions[index].question, 160),
        imageLayout: ["contain", "wide", "compact"].includes(updatedData.imageLayout) ? updatedData.imageLayout : (questions[index].imageLayout || "contain"),
        timeLimit: parseInt(updatedData.timeLimit, 10) || questions[index].timeLimit || 40,
        pointWeight: parseInt(updatedData.pointWeight, 10) || questions[index].pointWeight || 100,
        updatedAt: new Date().toISOString()
      };

      localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
      return questions[index];
    } catch (e) {
      console.error("Failed to update custom question:", e);
      return null;
    }
  }

  static deleteCustomQuestion(id) {
    try {
      const questions = this.getCustomQuestions().filter((q) => q.id !== id);
      localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(questions));
      return questions;
    } catch (e) {
      console.error("Failed to delete custom question:", e);
      return [];
    }
  }

  /**
   * Validate and Import questions from parsed JSON.
   * Returns { success: boolean, importedCount: number, error: string }
   */
  static importCustomQuestions(incoming) {
    try {
      if (!Array.isArray(incoming)) {
        return { success: false, importedCount: 0, error: "File harus berisi array daftar soal." };
      }

      if (incoming.length === 0) {
        return { success: false, importedCount: 0, error: "Daftar soal dalam file kosong." };
      }

      const validQuestions = [];
      for (let i = 0; i < incoming.length; i++) {
        const item = incoming[i];
        if (!item || typeof item !== "object") continue;

        const question = cleanText(item.question, 1000);
        if (!question) continue;

        const options = Array.isArray(item.options) ? item.options.slice(0, 4).map((o) => cleanText(o, 300)) : [];
        if (options.length < 2 || options.some((option) => !option)) continue;

        const correctAnswer = typeof item.correctAnswer === "number" && item.correctAnswer >= 0 && item.correctAnswer < options.length
          ? item.correctAnswer
          : 0;

        const validItem = {
          id: item.id && !String(item.id).startsWith("default-")
            ? cleanText(item.id, 80).replace(/[^a-zA-Z0-9_-]/g, "-")
            : "custom-" + Date.now() + "-" + i,
          category: item.category === "literasi" ? "literasi" : "numerasi",
          topic: cleanText(item.topic || "Materi Umum", 100),
          grade: parseInt(item.grade, 10) >= 1 && parseInt(item.grade, 10) <= 6 ? parseInt(item.grade, 10) : 4,
          difficulty: ["easy", "medium", "hard"].includes(item.difficulty) ? item.difficulty : "medium",
          passage: cleanText(item.passage, 3000),
          question,
          options,
          correctAnswer,
          explanation: cleanText(item.explanation, 2000),
          imageUrl: safeImageUrl(item.imageUrl),
          imageAlt: cleanText(item.imageAlt || item.question, 160),
          imageLayout: ["contain", "wide", "compact"].includes(item.imageLayout) ? item.imageLayout : "contain",
          timeLimit: parseInt(item.timeLimit, 10) || 40,
          pointWeight: parseInt(item.pointWeight, 10) || 100,
          gestureMap: item.gestureMap || { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
          createdAt: new Date().toISOString()
        };

        validQuestions.push(validItem);
      }

      if (validQuestions.length === 0) {
        return {
          success: false,
          importedCount: 0,
          error: "Format data soal tidak sesuai. Pastikan ada 'question', 'options' (array), dan 'correctAnswer'."
        };
      }

      const existing = this.getCustomQuestions();
      // Merge, avoid exact duplicate IDs
      const existingIds = new Set(existing.map((q) => q.id));
      const newItems = validQuestions.filter((q) => !existingIds.has(q.id));
      const combined = [...newItems, ...existing];

      localStorage.setItem(CUSTOM_QUESTIONS_KEY, JSON.stringify(combined));
      return { success: true, importedCount: newItems.length, totalCount: combined.length };
    } catch (err) {
      console.error("Import questions failed:", err);
      return { success: false, importedCount: 0, error: err.message || "Gagal memproses file JSON." };
    }
  }

  // ==========================================
  // TEAMS MANAGEMENT
  // ==========================================
  static getTeams() {
    try {
      const data = localStorage.getItem(TEAMS_KEY);
      return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    }
  }

  static saveTeams(teams) {
    try {
      localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
      return teams;
    } catch (e) {
      console.error("Failed to save teams:", e);
      return teams;
    }
  }

  static resetTeams() {
    const teams = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    this.saveTeams(teams);
    return teams;
  }

  // ==========================================
  // STATS & LEARNING ANALYTICS
  // ==========================================
  static getStats() {
    try {
      const { storage } = this._getLearningStore();
      const data = storage?.getItem(this._learningKey(STATS_KEY));
      return data ? JSON.parse(data) : {
        totalGames: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        highestScore: 0,
        highestStreak: 0,
        badges: ["FIRST_STEP"]
      };
    } catch {
      return { totalGames: 0, totalCorrect: 0, totalAnswered: 0, highestScore: 0, highestStreak: 0, badges: [] };
    }
  }

  static getAnalyticsHistory() {
    try {
      const { storage } = this._getLearningStore();
      const data = storage?.getItem(this._learningKey(ANALYTICS_KEY));
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveAnalyticsHistory(history) {
    try {
      const { storage } = this._getLearningStore();
      storage?.setItem(this._learningKey(ANALYTICS_KEY), JSON.stringify((history || []).slice(0, 50)));
      return history;
    } catch (error) {
      console.warn("Failed to save analytics history:", error);
      return history;
    }
  }

  // ==========================================
  // ADVENTURE LEARNING PROGRESS (TAHAP 4)
  // ==========================================
  static getAdventureProgress() {
    try {
      const { storage } = this._getLearningStore();
      const data = storage?.getItem(this._learningKey(ADVENTURE_KEY));
      return data
        ? JSON.parse(data)
        : {
            unlockedStages: [1],
            completedStages: [],
            keys: 0,
            totalStars: 0
          };
    } catch {
      return { unlockedStages: [1], completedStages: [], keys: 0, totalStars: 0 };
    }
  }

  static saveAdventureProgress(progress) {
    try {
      const { storage } = this._getLearningStore();
      storage?.setItem(this._learningKey(ADVENTURE_KEY), JSON.stringify(progress));
      return progress;
    } catch (e) {
      console.warn("Failed to save adventure progress:", e);
      return progress;
    }
  }

  static recordSessionAnalytics({
    mode,
    category,
    grade,
    score,
    correctCount,
    wrongCount,
    totalQuestions,
    accuracy,
    avgResponseTimeSec,
    topicMastery, // { [topicName]: { correct: n, total: n } }
    weakTopics // Array of topics needing review
  }) {
    try {
      const history = this.getAnalyticsHistory();
      const sessionEntry = {
        id: "sess-" + Date.now(),
        date: new Date().toISOString(),
        mode,
        category,
        grade,
        score,
        correctCount,
        wrongCount,
        totalQuestions,
        accuracy,
        avgResponseTimeSec: avgResponseTimeSec || 0,
        topicMastery: topicMastery || {},
        weakTopics: weakTopics || []
      };

      // Keep last 50 learning sessions
      history.unshift(sessionEntry);
      if (history.length > 50) history.pop();
      this.saveAnalyticsHistory(history);

      // Update aggregate stats
      this.recordGameResult({
        score,
        correct: correctCount,
        total: totalQuestions,
        streak: 0
      });

      return sessionEntry;
    } catch (e) {
      console.error("Failed to record analytics:", e);
    }
  }

  static recordGameResult({ score, correct, total, streak }) {
    try {
      const stats = this.getStats();
      stats.totalGames += 1;
      stats.totalCorrect += correct;
      stats.totalAnswered += total;
      if (score > stats.highestScore) stats.highestScore = score;
      if (streak > stats.highestStreak) stats.highestStreak = streak;

      // Unlock badges
      const newBadges = new Set(stats.badges || []);
      if (stats.totalGames >= 1) newBadges.add("FIRST_STEP");
      if (correct >= 5) newBadges.add("QUICK_THINKER");
      if (streak >= 5) newBadges.add("STREAK_MASTER");
      if (score >= 1000) newBadges.add("MATH_HERO");
      if (correct === total && total >= 5) newBadges.add("PERFECT_SCORE");

      stats.badges = Array.from(newBadges);
      const { storage } = this._getLearningStore();
      storage?.setItem(this._learningKey(STATS_KEY), JSON.stringify(stats));
      return stats;
    } catch (e) {
      console.error("Failed to record stats:", e);
    }
  }
}

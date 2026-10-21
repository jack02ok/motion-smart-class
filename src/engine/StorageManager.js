import { cleanText } from "../utils/security.js";

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

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  timerSeconds: 40,
  confidenceThreshold: 0.60,
  cooldownSeconds: 1.2,
  holdDurationSeconds: 0.45,
  showSkeleton: true,
  debugMode: false,
  cameraEnabled: true,
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
        if (options.length < 2) continue;

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
      const data = localStorage.getItem(STATS_KEY);
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
      const data = localStorage.getItem(ANALYTICS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // ==========================================
  // ADVENTURE LEARNING PROGRESS (TAHAP 4)
  // ==========================================
  static getAdventureProgress() {
    try {
      const data = localStorage.getItem(ADVENTURE_KEY);
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
      localStorage.setItem(ADVENTURE_KEY, JSON.stringify(progress));
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
      localStorage.setItem(ANALYTICS_KEY, JSON.stringify(history));

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
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      return stats;
    } catch (e) {
      console.error("Failed to record stats:", e);
    }
  }
}

/**
 * MOTION SMART CLASS - Firestore Service Manager
 * Handles Bank Soal (Questions) and Riwayat Permainan (Game Sessions / Analytics)
 * in Cloud Firestore with resilient offline caching and LocalStorage fallback.
 * 
 * Strict Privacy: ZERO camera/video or biometric data is stored.
 */

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  writeBatch
} from "firebase/firestore";
import { getDb, isFirebaseConfigured, getFirebaseConfig } from "../firebase.js";
import { StorageManager } from "./StorageManager.js";

const QUESTIONS_COLLECTION = "questions";
const SESSIONS_COLLECTION = "game_sessions";
const FIRESTORE_CACHE_KEY = "MSC_FIRESTORE_QUESTIONS_CACHE";

export class FirestoreManager {
  /**
   * Get current Firestore readiness and connection status
   */
  static getStatus() {
    const config = getFirebaseConfig();
    const configured = isFirebaseConfigured(config);
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : (typeof window !== "undefined");
    const isBrowser = typeof window !== "undefined";
    const db = (configured && isBrowser) ? getDb() : null;

    return {
      isConfigured: configured,
      isConnected: Boolean(db && isOnline),
      isOnline,
      projectId: config.projectId || null,
      source: config.source || "none"
    };
  }

  // ==========================================
  // BANK SOAL (QUESTIONS) METHODS
  // ==========================================

  /**
   * Fetch questions from Cloud Firestore with automatic local cache fallback
   */
  static async fetchQuestions({ category = "all", grade = "all", difficulty = "all" } = {}) {
    const status = this.getStatus();

    if (!status.isConfigured) {
      // Fallback: return custom questions from localStorage
      return this._filterQuestions(StorageManager.getCustomQuestions(), { category, grade, difficulty });
    }

    try {
      const db = getDb();
      if (!db) throw new Error("Firestore DB instance not initialized");

      const questionsRef = collection(db, QUESTIONS_COLLECTION);
      const q = query(questionsRef);
      const snapshot = await getDocs(q);

      const items = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        items.push({
          id: docSnap.id,
          ...data
        });
      });

      // Update local cache for offline usage
      if (typeof localStorage !== "undefined" && items.length > 0) {
        localStorage.setItem(FIRESTORE_CACHE_KEY, JSON.stringify(items));
      }

      console.log(`[Firestore] Fetched ${items.length} questions from collection '${QUESTIONS_COLLECTION}'`);
      return this._filterQuestions(items, { category, grade, difficulty });
    } catch (err) {
      console.warn("[Firestore] Failed to fetch questions from Firestore, using cache/local:", err);
      // Try local cache
      const cached = this.getCachedFirestoreQuestions();
      if (cached.length > 0) {
        return this._filterQuestions(cached, { category, grade, difficulty });
      }
      return this._filterQuestions(StorageManager.getCustomQuestions(), { category, grade, difficulty });
    }
  }

  /**
   * Get cached questions previously fetched from Firestore
   */
  static getCachedFirestoreQuestions() {
    try {
      if (typeof localStorage !== "undefined") {
        const data = localStorage.getItem(FIRESTORE_CACHE_KEY);
        return data ? JSON.parse(data) : [];
      }
    } catch (e) {
      console.warn("Failed to read cached firestore questions:", e);
    }
    return [];
  }

  /**
   * Add a new question to Firestore and mirror to local storage
   */
  static async saveQuestion(question) {
    const cleanQuestion = {
      category: question.category === "literasi" ? "literasi" : "numerasi",
      topic: (question.topic || "Materi Umum").trim(),
      grade: parseInt(question.grade, 10) || 4,
      difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
      passage: (question.passage || "").trim(),
      question: (question.question || "").trim(),
      options: Array.isArray(question.options) ? question.options.map(String) : [],
      correctAnswer: typeof question.correctAnswer === "number" ? question.correctAnswer : 0,
      explanation: (question.explanation || "").trim(),
      timeLimit: parseInt(question.timeLimit, 10) || 40,
      pointWeight: parseInt(question.pointWeight, 10) || 100,
      gestureMap: question.gestureMap || { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
      createdAt: question.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "firestore"
    };

    const docId = question.id || "fs-q-" + Date.now();
    cleanQuestion.id = docId;

    // Always mirror to localStorage custom questions
    StorageManager.saveCustomQuestion(cleanQuestion);

    // Save to Firestore if configured
    const status = this.getStatus();
    if (status.isConfigured) {
      try {
        const db = getDb();
        if (db) {
          await setDoc(doc(db, QUESTIONS_COLLECTION, docId), cleanQuestion);
          console.log(`[Firestore] Successfully saved question ${docId} to Firestore.`);
        }
      } catch (err) {
        console.error("[Firestore] Error saving question to Firestore:", err);
      }
    }

    return cleanQuestion;
  }

  /**
   * Update a question in Firestore and mirror to local storage
   */
  static async updateQuestion(id, updatedData) {
    const status = this.getStatus();
    const updatePayload = {
      ...updatedData,
      id,
      updatedAt: new Date().toISOString()
    };

    // Mirror to localStorage
    StorageManager.updateCustomQuestion(id, updatePayload);

    if (status.isConfigured) {
      try {
        const db = getDb();
        if (db) {
          const docRef = doc(db, QUESTIONS_COLLECTION, id);
          await updateDoc(docRef, updatePayload);
          console.log(`[Firestore] Updated question ${id} in Firestore.`);
        }
      } catch (err) {
        console.error("[Firestore] Error updating question in Firestore:", err);
      }
    }

    return updatePayload;
  }

  /**
   * Delete a question from Firestore and local storage
   */
  static async deleteQuestion(id) {
    // Mirror to localStorage
    StorageManager.deleteCustomQuestion(id);

    // Update cached firestore questions
    const cached = this.getCachedFirestoreQuestions().filter((q) => q.id !== id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FIRESTORE_CACHE_KEY, JSON.stringify(cached));
    }

    const status = this.getStatus();
    if (status.isConfigured) {
      try {
        const db = getDb();
        if (db) {
          await deleteDoc(doc(db, QUESTIONS_COLLECTION, id));
          console.log(`[Firestore] Deleted question ${id} from Firestore.`);
        }
      } catch (err) {
        console.error("[Firestore] Error deleting question from Firestore:", err);
      }
    }

    return true;
  }

  /**
   * Batch Seed default questions into Cloud Firestore so the teacher gets an immediate online bank soal!
   * @param {Array} questionsList List of question objects
   * @param {Function} onProgress Progress callback ({ current, total, percentage })
   */
  static async seedQuestionsToFirestore(questionsList, onProgress = null) {
    const status = this.getStatus();
    if (!status.isConfigured) {
      throw new Error("Firebase belum dikonfigurasi. Silakan isi konfigurasi Firebase terlebih dahulu.");
    }

    const db = getDb();
    if (!db) throw new Error("Koneksi Firestore tidak tersedia.");

    const total = questionsList.length;
    let processed = 0;

    // Firestore batch limit is 500 operations. We chunk into 250 to stay well within limits.
    const CHUNK_SIZE = 250;
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = questionsList.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((q) => {
        const docId = q.id || "seed-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5);
        const docRef = doc(db, QUESTIONS_COLLECTION, docId);
        const payload = {
          ...q,
          id: docId,
          source: "seed",
          uploadedAt: new Date().toISOString()
        };
        batch.set(docRef, payload);
      });

      await batch.commit();
      processed += chunk.length;

      if (onProgress) {
        onProgress({
          current: processed,
          total,
          percentage: Math.round((processed / total) * 100)
        });
      }
    }

    console.log(`[Firestore] Successfully seeded ${processed} questions to collection '${QUESTIONS_COLLECTION}'.`);
    return { success: true, count: processed };
  }

  // ==========================================
  // RIWAYAT PERMAINAN (GAME SESSIONS) METHODS
  // ==========================================

  /**
   * Record a completed game session into Firestore & LocalStorage
   * Ensures strict student privacy (numerical metrics only, zero camera/biometric data).
   */
  static async recordGameSession(sessionData) {
    const cleanSession = {
      id: sessionData.id || "sess-" + Date.now(),
      date: sessionData.date || new Date().toISOString(),
      mode: sessionData.mode || "unknown",
      category: sessionData.category || "campuran",
      grade: sessionData.grade || "all",
      score: parseInt(sessionData.score, 10) || 0,
      correctCount: parseInt(sessionData.correctCount, 10) || 0,
      wrongCount: parseInt(sessionData.wrongCount, 10) || 0,
      totalQuestions: parseInt(sessionData.totalQuestions, 10) || 0,
      accuracy: typeof sessionData.accuracy === "number" ? sessionData.accuracy : 0,
      avgResponseTimeSec: sessionData.avgResponseTimeSec || 0,
      topicMastery: sessionData.topicMastery || {},
      weakTopics: sessionData.weakTopics || [],
      studentName: sessionData.studentName || null,
      teamId: sessionData.teamId || null,
      source: "app"
    };

    // PRIVACY ENFORCEMENT: Explicitly delete any accidental raw camera or landmark fields
    delete cleanSession.videoStream;
    delete cleanSession.landmarks;
    delete cleanSession.faceBiometrics;
    delete cleanSession.cameraFrame;

    // Save to LocalStorage immediately
    try {
      const history = StorageManager.getAnalyticsHistory();
      history.unshift(cleanSession);
      if (history.length > 50) history.pop();
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("MSC_ANALYTICS_HISTORY", JSON.stringify(history));
      }
    } catch (e) {
      console.warn("Failed to save session locally:", e);
    }

    // Save to Firestore asynchronously
    const status = this.getStatus();
    if (status.isConfigured) {
      try {
        const db = getDb();
        if (db) {
          const docRef = doc(db, SESSIONS_COLLECTION, cleanSession.id);
          await setDoc(docRef, cleanSession);
          console.log(`[Firestore] Game session recorded in Firestore: ${cleanSession.id}`);
        }
      } catch (err) {
        console.warn("[Firestore] Failed to save session to Firestore (will use local):", err);
      }
    }

    return cleanSession;
  }

  /**
   * Fetch game sessions history from Firestore with LocalStorage fallback
   */
  static async fetchGameSessions(limitCount = 50) {
    const status = this.getStatus();

    if (!status.isConfigured) {
      return StorageManager.getAnalyticsHistory().slice(0, limitCount);
    }

    try {
      const db = getDb();
      if (!db) throw new Error("Firestore DB not ready");

      const sessionsRef = collection(db, SESSIONS_COLLECTION);
      // Query order by date desc
      const q = query(sessionsRef, orderBy("date", "desc"), limit(limitCount));
      const snapshot = await getDocs(q);

      const sessions = [];
      snapshot.forEach((docSnap) => {
        sessions.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });

      console.log(`[Firestore] Fetched ${sessions.length} game sessions from collection '${SESSIONS_COLLECTION}'`);
      return sessions;
    } catch (err) {
      console.warn("[Firestore] Error fetching sessions from Firestore, using local history:", err);
      return StorageManager.getAnalyticsHistory().slice(0, limitCount);
    }
  }

  /**
   * Delete a game session from Firestore and local cache
   */
  static async deleteGameSession(sessionId) {
    try {
      const history = StorageManager.getAnalyticsHistory().filter((s) => s.id !== sessionId);
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("MSC_ANALYTICS_HISTORY", JSON.stringify(history));
      }
    } catch (e) {
      console.warn(e);
    }

    const status = this.getStatus();
    if (status.isConfigured) {
      try {
        const db = getDb();
        if (db) {
          await deleteDoc(doc(db, SESSIONS_COLLECTION, sessionId));
          console.log(`[Firestore] Deleted session ${sessionId} from Firestore.`);
        }
      } catch (err) {
        console.error("[Firestore] Error deleting session in Firestore:", err);
      }
    }
    return true;
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  static _filterQuestions(questions, { category = "all", grade = "all", difficulty = "all" }) {
    let result = [...questions];

    if (category !== "all") {
      result = result.filter((q) => q.category === category);
    }

    if (grade !== "all") {
      const g = parseInt(grade, 10);
      if (!isNaN(g)) {
        result = result.filter((q) => q.grade === g || !q.grade);
      }
    }

    if (difficulty !== "all") {
      result = result.filter((q) => q.difficulty === difficulty || !q.difficulty);
    }

    return result;
  }
}

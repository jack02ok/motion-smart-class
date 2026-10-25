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
  where,
  writeBatch,
  runTransaction
} from "firebase/firestore";
import { getDb, getCurrentUser, isFirebaseConfigured, getFirebaseConfig } from "../firebase.js";
import { StorageManager } from "./StorageManager.js";
import { cleanText, safeImageUrl } from "../utils/security.js";

const QUESTIONS_COLLECTION = "questions";
const SESSIONS_COLLECTION = "game_sessions";
const SUBMISSIONS_COLLECTION = "question_submissions";
const FIRESTORE_CACHE_KEY = "MSC_FIRESTORE_QUESTIONS_CACHE";

export class FirestoreManager {
  static sanitizeQuestion(question, { source = "firestore", id = null } = {}) {
    const docId = id || question.id || "fs-q-" + Date.now();
    return {
      id: docId,
      category: question.category === "literasi" ? "literasi" : "numerasi",
      topic: cleanText(question.topic || "Materi Umum", 120),
      grade: Math.min(6, Math.max(1, parseInt(question.grade, 10) || 4)),
      difficulty: ["easy", "medium", "hard"].includes(question.difficulty) ? question.difficulty : "medium",
      passage: cleanText(question.passage || "", 4000),
      question: cleanText(question.question || "", 1000),
      options: Array.isArray(question.options) ? question.options.slice(0, 4).map((item) => cleanText(String(item), 500)) : [],
      correctAnswer: Number.isInteger(question.correctAnswer) ? question.correctAnswer : 0,
      explanation: cleanText(question.explanation || "", 2000),
      imageUrl: safeImageUrl(question.imageUrl),
      imageAlt: cleanText(question.imageAlt || question.question, 160),
      imageLayout: ["contain", "wide", "compact"].includes(question.imageLayout) ? question.imageLayout : "contain",
      timeLimit: Math.min(120, Math.max(15, parseInt(question.timeLimit, 10) || 40)),
      pointWeight: Math.min(500, Math.max(50, parseInt(question.pointWeight, 10) || 100)),
      gestureMap: question.gestureMap || { A: "LEFT_HAND", B: "RIGHT_HAND", C: "BOTH_HANDS", D: "SQUAT" },
      createdAt: question.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source
    };
  }
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
    const docId = question.id || "fs-q-" + Date.now();
    const cleanQuestion = this.sanitizeQuestion(question, { id: docId });

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

  /** Submit a question to the moderation queue. Requires a non-anonymous account. */
  static async submitQuestionForReview(question, profile) {
    const user = getCurrentUser();
    const db = getDb();
    if (!user || user.isAnonymous) throw new Error("Masuk dengan Google sebelum mengirim soal.");
    if (!db) throw new Error("Cloud Firestore belum tersedia.");

    const submissionRef = doc(collection(db, SUBMISSIONS_COLLECTION));
    const now = new Date().toISOString();
    const cleanQuestion = this.sanitizeQuestion(question, { id: `reviewed-${submissionRef.id}`, source: "community" });
    const payload = {
      id: submissionRef.id,
      ownerUid: user.uid,
      ownerRole: ["student", "teacher"].includes(profile?.role) ? profile.role : "student",
      ownerName: cleanText(profile?.displayName || user.displayName || "Pengguna", 100),
      ownerEmail: cleanText(profile?.email || user.email || "", 160),
      status: "pending",
      question: cleanQuestion,
      submittedAt: now,
      updatedAt: now,
      reviewerUid: null,
      reviewedAt: null,
      reviewNote: ""
    };
    await setDoc(submissionRef, payload);
    return payload;
  }

  static async fetchQuestionSubmissions({ mine = false, status = "all", limitCount = 100 } = {}) {
    const user = getCurrentUser();
    const db = getDb();
    if (!user || user.isAnonymous || !db) return [];
    const constraints = [];
    if (mine) constraints.push(where("ownerUid", "==", user.uid));
    constraints.push(limit(limitCount));
    const snapshot = await getDocs(query(collection(db, SUBMISSIONS_COLLECTION), ...constraints));
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return items
      .filter((item) => status === "all" || item.status === status)
      .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
  }

  /** Atomically publish an approved submission and close the review item. */
  static async reviewQuestionSubmission(submissionId, decision, reviewNote = "") {
    if (!["approved", "rejected"].includes(decision)) throw new Error("Keputusan review tidak valid.");
    const user = getCurrentUser();
    const db = getDb();
    if (!user || user.isAnonymous || !db) throw new Error("Sesi admin tidak tersedia.");
    const submissionRef = doc(db, SUBMISSIONS_COLLECTION, submissionId);

    await runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(submissionRef);
      if (!snapshot.exists()) throw new Error("Pengajuan soal tidak ditemukan.");
      const submission = snapshot.data();
      if (submission.status !== "pending") throw new Error("Pengajuan ini sudah ditinjau.");
      const now = new Date().toISOString();
      if (decision === "approved") {
        const cleanQuestion = this.sanitizeQuestion(submission.question, {
          id: submission.question?.id || `reviewed-${submissionId}`,
          source: "community-reviewed"
        });
        transaction.set(doc(db, QUESTIONS_COLLECTION, cleanQuestion.id), cleanQuestion);
      }
      transaction.update(submissionRef, {
        status: decision,
        reviewerUid: user.uid,
        reviewedAt: now,
        updatedAt: now,
        reviewNote: cleanText(reviewNote, 500)
      });
    });
    return true;
  }

  /**
   * Update a question in Firestore and mirror to local storage
   */
  static async updateQuestion(id, updatedData) {
    const status = this.getStatus();
    const updatePayload = {
      ...updatedData,
      id,
      imageUrl: safeImageUrl(updatedData.imageUrl),
      imageAlt: cleanText(updatedData.imageAlt || updatedData.question, 160),
      imageLayout: ["contain", "wide", "compact"].includes(updatedData.imageLayout) ? updatedData.imageLayout : "contain",
      updatedAt: new Date().toISOString()
    };

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
        throw err;
      }
    }

    // Mirror only after the authoritative cloud write succeeds.
    StorageManager.updateCustomQuestion(id, updatePayload);

    return updatePayload;
  }

  /**
   * Delete a question from Firestore and local storage
   */
  static async deleteQuestion(id) {
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
        return false;
      }
    }

    StorageManager.deleteCustomQuestion(id);
    const cached = this.getCachedFirestoreQuestions().filter((q) => q.id !== id);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(FIRESTORE_CACHE_KEY, JSON.stringify(cached));
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
        const payload = this.sanitizeQuestion(q, { id: docId, source: "seed" });
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
   * Record a completed game session. Guests only use session-scoped storage;
   * Google accounts may synchronize to Firestore.
   * Ensures strict student privacy (numerical metrics only, zero camera/biometric data).
   */
  static async recordGameSession(sessionData, { saveLocal = true } = {}) {
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
      roomCode: cleanText(sessionData.roomCode || "", 12) || null,
      participantResults: Array.isArray(sessionData.participantResults)
        ? sessionData.participantResults.slice(0, 100).map((participant) => ({
            name: cleanText(participant.name || "Peserta", 40),
            participantType: participant.participantType === "group" ? "group" : "student",
            score: Math.max(0, parseInt(participant.score, 10) || 0),
            correctCount: Math.max(0, parseInt(participant.correctCount, 10) || 0)
          }))
        : [],
      source: "app"
    };
    const currentUser = getCurrentUser();
    cleanSession.ownerUid = currentUser?.uid || null;

    // PRIVACY ENFORCEMENT: Explicitly delete any accidental raw camera or landmark fields
    delete cleanSession.videoStream;
    delete cleanSession.landmarks;
    delete cleanSession.faceBiometrics;
    delete cleanSession.cameraFrame;

    // Save through the scoped learning store (sessionStorage for guests).
    if (saveLocal) {
      try {
        const history = StorageManager.getAnalyticsHistory();
        history.unshift(cleanSession);
        if (history.length > 50) history.pop();
        StorageManager.saveAnalyticsHistory(history);
      } catch (e) {
        console.warn("Failed to save session locally:", e);
      }
    }

    // Save to Firestore asynchronously
    const status = this.getStatus();
    if (status.isConfigured && currentUser && !currentUser.isAnonymous) {
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

  /** Fetch only the signed-in user's play history (works for student accounts). */
  static async fetchMyGameSessions(limitCount = 20) {
    const user = getCurrentUser();
    const status = this.getStatus();
    if (!user || user.isAnonymous || !status.isConfigured) return StorageManager.getAnalyticsHistory().slice(0, limitCount);
    try {
      const db = getDb();
      const snapshot = await getDocs(query(
        collection(db, SESSIONS_COLLECTION),
        where("ownerUid", "==", user.uid),
        limit(Math.min(limitCount, 50))
      ));
      return snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } catch (error) {
      console.warn("[Firestore] Failed to load personal history:", error);
      return StorageManager.getAnalyticsHistory().slice(0, limitCount);
    }
  }

  /**
   * Delete a game session from Firestore and local cache
   */
  static async deleteGameSession(sessionId) {
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
        return false;
      }
    }
    try {
      const history = StorageManager.getAnalyticsHistory().filter((s) => s.id !== sessionId);
      StorageManager.saveAnalyticsHistory(history);
    } catch (e) {
      console.warn(e);
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

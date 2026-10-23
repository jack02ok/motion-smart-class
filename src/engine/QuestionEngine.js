/**
 * MOTION SMART CLASS - Question Engine
 * Provides filtered, shuffled, and mode-adapted questions with custom time limits & point weights.
 */

import { DEFAULT_QUESTIONS, TRUE_FALSE_QUESTIONS, BOSS_QUESTIONS } from "../data/defaultQuestions.js";
import { StorageManager } from "./StorageManager.js";
import { FirestoreManager } from "./FirestoreManager.js";

export class QuestionEngine {
  constructor() {
    this.defaultQuestions = DEFAULT_QUESTIONS;
    this.trueFalseQuestions = TRUE_FALSE_QUESTIONS;
    this.bossQuestions = BOSS_QUESTIONS;
    this.onlineQuestions = [];
    this.hasLoadedOnline = false;
  }

  /**
   * Asynchronously load questions from Cloud Firestore
   */
  async loadFirestoreQuestions() {
    try {
      const questions = await FirestoreManager.fetchQuestions();
      if (questions && questions.length > 0) {
        this.onlineQuestions = questions;
        this.hasLoadedOnline = true;
        console.log(`[QuestionEngine] Loaded ${questions.length} questions from Firestore`);
      }
      return this.onlineQuestions;
    } catch (e) {
      console.warn("[QuestionEngine] Could not load online questions:", e);
      return [];
    }
  }

  getAllQuestions() {
    const questionMap = new Map();

    // 1. Base default questions
    this.defaultQuestions.forEach((q) => questionMap.set(q.id, q));

    // 2. Custom questions from LocalStorage
    const custom = StorageManager.getCustomQuestions();
    custom.forEach((q) => questionMap.set(q.id, q));

    // 3. Cached Firestore questions from LocalStorage
    const cachedFs = FirestoreManager.getCachedFirestoreQuestions();
    cachedFs.forEach((q) => questionMap.set(q.id, q));

    // 4. Online questions freshly loaded
    this.onlineQuestions.forEach((q) => questionMap.set(q.id, q));

    return Array.from(questionMap.values());
  }

  getQuestions({ category = "all", grade = "all", difficulty = "all", count = 5, mode = "quiz" } = {}) {
    let pool = [];

    if (mode === "true_false") {
      pool = [...this.trueFalseQuestions];
      if (category !== "all") {
        pool = pool.filter((q) => q.category === category);
      }
      return this.shuffle(pool).slice(0, count).map((q) => ({
        ...q,
        isTrueFalse: true,
        options: ["BENAR (🙆)", "SALAH (🙅)"],
        timeLimit: q.timeLimit || 30,
        pointWeight: q.pointWeight || 100,
        gestureMap: {
          A: "LEFT_HAND",    // BENAR
          B: "RIGHT_HAND",   // SALAH
          C: "BOTH_HANDS",   // BENAR ALTERNATIVE
          D: "SQUAT"         // SALAH ALTERNATIVE
        }
      }));
    }

    if (mode === "boss") {
      return [...this.bossQuestions];
    }

    // Standard Quiz / Duel / Detective / Motion Challenge / Arena / Adventure
    pool = this.getAllQuestions();

    if (category !== "all") {
      pool = pool.filter((q) => q.category === category);
    }

    if (grade !== "all") {
      const g = parseInt(grade, 10);
      if (!isNaN(g)) {
        pool = pool.filter((q) => q.grade === g || !q.grade);
      }
    }

    if (difficulty !== "all") {
      pool = pool.filter((q) => q.difficulty === difficulty || !q.difficulty);
    }

    if (mode === "detective") {
      // Prioritize questions with passages or detective context
      const detectivePool = pool.filter((q) => q.passage || (q.topic && (q.topic.includes("Detektif") || q.topic.includes("Bacaan") || q.topic.includes("Cerita"))));
      if (detectivePool.length >= 3) {
        pool = detectivePool;
      }
    }

    // If filtered pool is smaller than required count, fill with remaining from pool
    if (pool.length === 0) {
      pool = this.getAllQuestions();
    }

    const shuffled = this.shuffle(pool);
    const shouldShuffleOptions = StorageManager.getSettings().shuffleOptions;
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((q) => {
      const normalized = { ...q, timeLimit: q.timeLimit || 40, pointWeight: q.pointWeight || 100 };
      return shouldShuffleOptions ? this.shuffleQuestionOptions(normalized) : normalized;
    });
  }

  shuffleQuestionOptions(question) {
    if (!Array.isArray(question.options) || question.options.length < 2) return question;
    const choices = question.options.map((text, index) => ({ text, isCorrect: index === question.correctAnswer }));
    const shuffled = this.shuffle(choices);
    return {
      ...question,
      options: shuffled.map((choice) => choice.text),
      correctAnswer: shuffled.findIndex((choice) => choice.isCorrect)
    };
  }

  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

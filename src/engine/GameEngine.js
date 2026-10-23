import { FirestoreManager } from "./FirestoreManager.js";

/**
 * MOTION SMART CLASS - Game Engine
 * State machine managing game modes, countdowns, rounds, feedback, and progression.
 */

import { GESTURE_TYPES } from "./GestureEngine.js";

export const GAME_STATES = {
  HOME: "HOME",
  CATEGORY_SELECT: "CATEGORY_SELECT",
  GRADE_SELECT: "GRADE_SELECT",
  DIFFICULTY_SELECT: "DIFFICULTY_SELECT",
  CALIBRATION: "CALIBRATION",
  COUNTDOWN: "COUNTDOWN",
  QUESTION_ACTIVE: "QUESTION_ACTIVE",
  FEEDBACK: "FEEDBACK",
  RESULT: "RESULT",
  TEACHER_MODE: "TEACHER_MODE",
  ADVENTURE_MAP: "ADVENTURE_MAP", // Tahap 4: Adventure Learning Map
  TEAM_SETUP: "TEAM_SETUP",        // Tahap 5: 2-4 Team Setup
  MULTIPLAYER_HUB: "MULTIPLAYER_HUB",
  MULTIPLAYER_HOST_LOBBY: "MULTIPLAYER_HOST_LOBBY",
  MULTIPLAYER_JOIN: "MULTIPLAYER_JOIN",
  MULTIPLAYER_PLAYER_LOBBY: "MULTIPLAYER_PLAYER_LOBBY",
  MULTIPLAYER_HOST_GAME: "MULTIPLAYER_HOST_GAME",
  MULTIPLAYER_PLAYER_GAME: "MULTIPLAYER_PLAYER_GAME",
  MULTIPLAYER_ROUND_RESULT: "MULTIPLAYER_ROUND_RESULT",
  MULTIPLAYER_PODIUM: "MULTIPLAYER_PODIUM",
  GESTURE_TRAINING: "GESTURE_TRAINING"
};

export const GAME_MODES = {
  QUICK_QUIZ: "quick_quiz",
  TRUE_FALSE: "true_false",
  MOTION_CHALLENGE: "motion_challenge",
  DUEL: "duel",
  DETECTIVE: "detective",
  BOSS: "boss",
  ARENA: "arena",           // Tahap 3: Motion Arena (Zone-based)
  ADVENTURE: "adventure",   // Tahap 4: Adventure Learning
  TEAM_BATTLE: "team_battle", // Tahap 5: Team Battle 2-4 teams
  ONLINE_ROOM: "online_room",  // Online Multiplayer Classroom Game Show
  COOPERATIVE: "cooperative",
  PRESENTATION: "presentation"
};

export const ADVENTURE_STAGES = [
  {
    id: 1,
    title: "Lembah Angka Ajaib",
    world: "Pulau Numerasi Dasar",
    category: "numerasi",
    grade: 3,
    difficulty: "easy",
    icon: "🌲",
    badgeIcon: "🌲🔢",
    objective: "Kuasai operasi hitung cepat, perkalian dasar, dan pola deret bilangan.",
    clue: "Perhatikan selisih angka dan angkat tangan ke pilihan yang tepat!",
    questionsCount: 4,
    rewardKey: "🗝️ Kunci Perak",
    rewardPoints: 300,
    requiredKeys: 0
  },
  {
    id: 2,
    title: "Hutan Kata Misterius",
    world: "Pulau Literasi Detektif",
    category: "literasi",
    grade: 4,
    difficulty: "medium",
    icon: "🔎",
    badgeIcon: "🔎📜",
    objective: "Temukan ide pokok bacaan dan pecahkan teka-teki makna kata tersirat.",
    clue: "Baca bukti teks detektif dengan jeli sebelum merentangkan tangan!",
    questionsCount: 4,
    rewardKey: "🗝️ Kunci Emas",
    rewardPoints: 500,
    requiredKeys: 1
  },
  {
    id: 3,
    title: "Labirin Pecahan Kuno",
    world: "Kuil Matematika HOTS",
    category: "numerasi",
    grade: 5,
    difficulty: "hard",
    icon: "🏛️",
    badgeIcon: "🏛️🍕",
    objective: "Selesaikan tantangan penalaran pecahan bernilai sama dan bangun datar.",
    clue: "Samakan nilai pecahan atau jongkok jika pilihan terakhir tepat!",
    questionsCount: 4,
    rewardKey: "🗝️ Kunci Kristal",
    rewardPoints: 700,
    requiredKeys: 2
  },
  {
    id: 4,
    title: "Benteng Raja Angka",
    world: "Gerbang Final Boss Akbar",
    category: "all",
    grade: 5,
    difficulty: "hard",
    icon: "👑",
    badgeIcon: "👑👹",
    isBoss: true,
    objective: "Kalahkan Raja Angka Raksasa (500 HP) dengan 5 serangan berturut-turut!",
    clue: "Gunakan ketiga kunci sakti untuk menembus benteng dan kalahkan monster!",
    questionsCount: 5,
    rewardKey: "👑 Mahkota Juara Petualang",
    rewardPoints: 1000,
    requiredKeys: 3
  }
];

export class GameEngine {
  constructor({ audioManager, questionEngine, scoreEngine, storageManager }) {
    this.audio = audioManager;
    this.questionEngine = questionEngine;
    this.scoreEngine = scoreEngine;
    this.storage = storageManager;

    this.state = GAME_STATES.HOME;
    this.selectedMode = GAME_MODES.QUICK_QUIZ;
    this.selectedCategory = "numerasi";
    this.selectedGrade = 4;
    this.selectedDifficulty = "medium";

    // Current session questions
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.currentQuestion = null;

    // Timer & Speed measurement
    this.timerSeconds = 40;
    this.timeLeft = 40;
    this.timerInterval = null;
    this.questionStartTime = 0;

    // Boss Fight State
    this.bossMaxHp = 500;
    this.bossCurrentHp = 500;
    this.bossName = "Raja Angka Raksasa";
    this.bossTitle = "Penguasa Labirin Numerasi";

    // Team Battle / Duel State (2 to 4 teams)
    this.battleTeams = [];
    this.currentTeamTurn = 0;
    this.selectedTeamCount = 4;

    // Adventure Learning State
    this.adventureStage = 1;
    this.adventureKeys = 0;

    // Touch Mode toggle
    this.touchMode = false;
    this.sessionQuestionCount = null;

    // Callbacks for UI updates
    this.onStateChange = null;
    this.onTimerTick = null;
    this.onQuestionUpdate = null;
    this.onFeedbackUpdate = null;
    this.onResultUpdate = null;
    this.onBossHpUpdate = null;
  }

  setState(newState, payload = {}) {
    this.state = newState;
    if (this.onStateChange) {
      this.onStateChange(this.state, payload);
    }
  }

  startSessionConfig({ mode, category }) {
    this.selectedMode = mode || GAME_MODES.QUICK_QUIZ;
    this.selectedCategory = category || "numerasi";

    if (this.selectedMode === GAME_MODES.BOSS) {
      this.bossMaxHp = 500;
      this.bossCurrentHp = 500;
      this.setState(GAME_STATES.CALIBRATION);
      return;
    }

    if (this.selectedMode === GAME_MODES.TEAM_BATTLE) {
      this.setState(GAME_STATES.TEAM_SETUP);
      return;
    }

    if (this.selectedMode === GAME_MODES.DUEL) {
      const teams = this.storage.getTeams().slice(0, 2);
      this.battleTeams = teams.map((t) => ({ ...t, sessionScore: 0 }));
      this.currentTeamTurn = 0;
      this.setState(GAME_STATES.CALIBRATION);
      return;
    }

    if (this.selectedMode === GAME_MODES.ADVENTURE) {
      const adv = this.storage.getAdventureProgress();
      this.adventureKeys = adv.keys || 0;
      this.setState(GAME_STATES.ADVENTURE_MAP, { progress: adv, stages: ADVENTURE_STAGES });
      return;
    }

    if (this.selectedMode === GAME_MODES.ARENA) {
      this.selectedGrade = 4;
      this.selectedDifficulty = "medium";
      this.setState(GAME_STATES.CALIBRATION);
      return;
    }

    this.setState(GAME_STATES.GRADE_SELECT);
  }

  startSavedSession(config = {}) {
    this.selectedMode = config.mode || GAME_MODES.QUICK_QUIZ;
    this.selectedCategory = config.category || "all";
    this.selectedGrade = config.grade || 4;
    this.selectedDifficulty = config.difficulty || "all";
    this.sessionQuestionCount = Math.min(20, Math.max(3, Number(config.count) || 8));
    if (this.selectedMode === GAME_MODES.PRESENTATION) {
      this.touchMode = true;
      this.prepareQuestions();
      this.startCountdown();
      return;
    }
    this.setState(GAME_STATES.CALIBRATION);
  }

  setupTeamBattle({ teamCount = 4 }) {
    this.selectedTeamCount = teamCount;
    const allTeams = this.storage.getTeams();
    this.battleTeams = allTeams.slice(0, teamCount).map((t) => ({ ...t, sessionScore: 0 }));
    this.currentTeamTurn = 0;
    this.setState(GAME_STATES.CALIBRATION);
  }

  setupAdventureMission(stageId) {
    const stage = ADVENTURE_STAGES.find((s) => s.id === stageId) || ADVENTURE_STAGES[0];
    this.adventureStage = stage.id;
    this.selectedCategory = stage.category;
    this.selectedGrade = stage.grade;
    this.selectedDifficulty = stage.difficulty;

    if (stage.isBoss) {
      this.selectedMode = GAME_MODES.BOSS;
      this.bossMaxHp = 500;
      this.bossCurrentHp = 500;
      this.bossName = "Raja Angka Raksasa";
      this.bossTitle = "Penguasa Benteng Akhir";
    }

    this.setState(GAME_STATES.CALIBRATION);
  }

  setGrade(grade) {
    this.selectedGrade = grade;
    this.setState(GAME_STATES.DIFFICULTY_SELECT);
  }

  setDifficulty(diff) {
    this.selectedDifficulty = diff;
    this.setState(GAME_STATES.CALIBRATION);
  }

  startCalibrationDone() {
    this.prepareQuestions();
    this.startCountdown();
  }

  prepareQuestions() {
    let count = this.sessionQuestionCount || 8;
    if (this.selectedMode === GAME_MODES.BOSS) {
      count = 5;
    } else if (this.selectedMode === GAME_MODES.ADVENTURE) {
      count = this.adventureStage === 4 ? 5 : 4;
    } else if (this.selectedMode === GAME_MODES.ARENA) {
      count = 6;
    } else if (this.selectedMode === GAME_MODES.TEAM_BATTLE) {
      count = Math.max(6, this.battleTeams.length * 2);
    } else if (this.selectedMode === GAME_MODES.COOPERATIVE) {
      count = this.sessionQuestionCount || 10;
    }

    if (this.selectedMode === GAME_MODES.ADVENTURE && this.adventureStage === 4) {
      this.questions = this.questionEngine.getQuestions({ mode: "boss", count: 5 });
    } else {
      this.questions = this.questionEngine.getQuestions({
        category: this.selectedCategory,
        grade: this.selectedGrade,
        difficulty: this.selectedDifficulty,
        count,
        mode: this.selectedMode
      });
    }

    this.currentQuestionIndex = 0;
    this.sessionQuestionCount = null;
    this.scoreEngine.reset();
  }

  startCountdown() {
    this.setState(GAME_STATES.COUNTDOWN);
    const configuredSeconds = Number(this.storage.getSettings()?.readyCountdownSeconds);
    let count = Math.min(10, Math.max(3, Number.isFinite(configuredSeconds) ? configuredSeconds : 5));
    this.audio.playCountdownTick();

    if (this.onStateChange) {
      this.onStateChange(GAME_STATES.COUNTDOWN, { countdown: count });
    }

    const interval = setInterval(() => {
      count--;
      if (count > 0) {
        this.audio.playCountdownTick();
        if (this.onStateChange) {
          this.onStateChange(GAME_STATES.COUNTDOWN, { countdown: count });
        }
      } else if (count === 0) {
        this.audio.playCountdownGo();
        if (this.onStateChange) {
          this.onStateChange(GAME_STATES.COUNTDOWN, { countdown: "GO!" });
        }
      } else {
        clearInterval(interval);
        this.loadNextQuestion();
      }
    }, 900);
  }

  loadNextQuestion() {
    if (this.currentQuestionIndex >= this.questions.length) {
      this.finishGame();
      return;
    }

    this.currentQuestion = this.questions[this.currentQuestionIndex];
    this.timerSeconds = this.currentQuestion.timeLimit || 40;
    this.timeLeft = this.timerSeconds;
    this.questionStartTime = performance.now();

    const isFinalRound =
      this.selectedMode === GAME_MODES.TEAM_BATTLE &&
      this.currentQuestionIndex === this.questions.length - 1;

    this.setState(GAME_STATES.QUESTION_ACTIVE, {
      question: this.currentQuestion,
      index: this.currentQuestionIndex + 1,
      total: this.questions.length,
      mode: this.selectedMode,
      battleTeams: this.battleTeams,
      currentTeamTurn: this.currentTeamTurn,
      bossHp: this.bossCurrentHp,
      bossMaxHp: this.bossMaxHp,
      adventureStage: this.adventureStage,
      adventureKeys: this.adventureKeys,
      isFinalRound
    });

    this.startTimer();
  }

  startTimer() {
    this.clearTimer();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;

      if (this.onTimerTick) {
        this.onTimerTick(this.timeLeft, this.timerSeconds);
      }

      if (this.timeLeft <= 0) {
        this.clearTimer();
        this.handleTimeout();
      }
    }, 1000);
  }

  clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleTimeout() {
    this.audio.playWrong();
    const responseTimeMs = performance.now() - this.questionStartTime;
    const result = this.scoreEngine.calculateAnswerScore({
      isCorrect: false,
      timeLeft: 0,
      totalTime: this.timerSeconds,
      pointWeight: this.currentQuestion.pointWeight || 100,
      responseTimeMs,
      topic: this.currentQuestion.topic || "Materi Umum"
    });

    if (
      (this.selectedMode === GAME_MODES.DUEL || this.selectedMode === GAME_MODES.TEAM_BATTLE) &&
      this.battleTeams.length > 0
    ) {
      this.currentTeamTurn++;
    }

    this.showFeedback({
      isCorrect: false,
      timedOut: true,
      correctIndex: this.currentQuestion.correctAnswer,
      chosenIndex: -1,
      scoreResult: result
    });
  }

  submitAnswerByIndex(chosenIndex, isBonus = false) {
    if (this.state !== GAME_STATES.QUESTION_ACTIVE) return;
    this.clearTimer();

    const responseTimeMs = performance.now() - this.questionStartTime;
    const isCorrect = chosenIndex === this.currentQuestion.correctAnswer;
    const isFinalRound =
      this.selectedMode === GAME_MODES.TEAM_BATTLE &&
      this.currentQuestionIndex === this.questions.length - 1;

    let pointWeight = this.currentQuestion.pointWeight || 100;
    if (isFinalRound) {
      pointWeight *= 2; // Double points for Final Showdown!
    }

    const scoreResult = this.scoreEngine.calculateAnswerScore({
      isCorrect,
      timeLeft: this.timeLeft,
      totalTime: this.timerSeconds,
      pointWeight,
      isBonusGesture: isBonus,
      responseTimeMs,
      topic: this.currentQuestion.topic || "Materi Umum"
    });

    if (isCorrect) {
      this.audio.playCorrect();
      if (scoreResult.comboMultiplier > 1) {
        this.audio.playCombo(scoreResult.streak);
      }
      if (isBonus) {
        this.audio.playBonus();
      }

      // Handle Boss Damage
      if (this.selectedMode === GAME_MODES.BOSS) {
        const damage = this.currentQuestion.damage || 100;
        this.bossCurrentHp = Math.max(0, this.bossCurrentHp - damage);
        this.audio.playBossHit();
        if (this.onBossHpUpdate) {
          this.onBossHpUpdate(this.bossCurrentHp, this.bossMaxHp);
        }
      }

      // Handle Team Battle / Duel scoring
      if (
        (this.selectedMode === GAME_MODES.DUEL || this.selectedMode === GAME_MODES.TEAM_BATTLE) &&
        this.battleTeams.length > 0
      ) {
        const activeTeam = this.battleTeams[this.currentTeamTurn % this.battleTeams.length];
        activeTeam.sessionScore = (activeTeam.sessionScore || 0) + scoreResult.pointsEarned;
        this.currentTeamTurn++;
      }
    } else {
      this.audio.playWrong();
      if (
        (this.selectedMode === GAME_MODES.DUEL || this.selectedMode === GAME_MODES.TEAM_BATTLE) &&
        this.battleTeams.length > 0
      ) {
        this.currentTeamTurn++;
      }
    }

    this.showFeedback({
      isCorrect,
      timedOut: false,
      correctIndex: this.currentQuestion.correctAnswer,
      chosenIndex,
      scoreResult,
      explanation: this.currentQuestion.explanation,
      mode: this.selectedMode,
      isFinalRound
    });
  }

  submitAnswerByGesture(gesture) {
    if (this.state !== GAME_STATES.QUESTION_ACTIVE || !this.currentQuestion) return;

    if (gesture === GESTURE_TYPES.SKIP) {
      this.skipQuestion();
      return;
    }

    let chosenIndex = -1;
    let isBonus = gesture === GESTURE_TYPES.BONUS;

    if (this.selectedMode === GAME_MODES.TRUE_FALSE) {
      // Option 0: BENAR, Option 1: SALAH
      if (gesture === GESTURE_TYPES.A || gesture === GESTURE_TYPES.C) {
        chosenIndex = 0; // BENAR (🙆)
      } else if (gesture === GESTURE_TYPES.B || gesture === GESTURE_TYPES.D) {
        chosenIndex = 1; // SALAH (🙅)
      }
    } else {
      // 4 Pilihan
      if (gesture === GESTURE_TYPES.A) chosenIndex = 0; // Left hand / Zone A
      else if (gesture === GESTURE_TYPES.B) chosenIndex = 1; // Right hand / Zone B
      else if (gesture === GESTURE_TYPES.C) chosenIndex = 2; // Both hands / Zone C
      else if (gesture === GESTURE_TYPES.D) chosenIndex = 3; // Squat / Zone D
      else if (gesture === GESTURE_TYPES.BONUS) {
        return;
      }
    }

    if (chosenIndex !== -1) {
      this.submitAnswerByIndex(chosenIndex, isBonus);
    }
  }

  skipQuestion() {
    this.clearTimer();
    this.audio.playWrong();
    if (
      (this.selectedMode === GAME_MODES.DUEL || this.selectedMode === GAME_MODES.TEAM_BATTLE) &&
      this.battleTeams.length > 0
    ) {
      this.currentTeamTurn++;
    }
    this.currentQuestionIndex++;
    this.loadNextQuestion();
  }

  showFeedback(payload) {
    this.setState(GAME_STATES.FEEDBACK, payload);

    setTimeout(() => {
      this.currentQuestionIndex++;
      if (this.selectedMode === GAME_MODES.BOSS && this.bossCurrentHp <= 0) {
        this.audio.playBossDefeated();
        this.finishGame(true);
      } else {
        this.loadNextQuestion();
      }
    }, 2400);
  }

  finishGame(bossDefeated = false) {
    this.clearTimer();
    this.audio.playVictory();

    const accuracy = this.scoreEngine.getAccuracy();
    const avgResponseTimeSec = this.scoreEngine.getAverageResponseTimeSec();
    const weakTopics = this.scoreEngine.getWeakTopics();

    // Record session learning analytics
    const sessionEntry = this.storage.recordSessionAnalytics({
      mode: this.selectedMode,
      category: this.selectedCategory,
      grade: this.selectedGrade,
      score: this.scoreEngine.score,
      correctCount: this.scoreEngine.correctCount,
      wrongCount: this.scoreEngine.wrongCount,
      totalQuestions: this.questions.length,
      accuracy,
      avgResponseTimeSec,
      topicMastery: this.scoreEngine.topicStats,
      weakTopics
    });
    if (sessionEntry) {
      FirestoreManager.recordGameSession(sessionEntry, { saveLocal: false }).catch((error) => {
        console.warn("[GameEngine] Firestore analytics sync failed:", error);
      });
    }

    const badge = this.scoreEngine.getBadge(this.selectedCategory);
    const level = this.scoreEngine.getLevel();

    // Adventure Mode Progression Handling
    let stageCompleted = false;
    let earnedKey = null;
    if (this.selectedMode === GAME_MODES.ADVENTURE) {
      const adv = this.storage.getAdventureProgress();
      const currentStageDef = ADVENTURE_STAGES.find((s) => s.id === this.adventureStage);
      const passed = this.adventureStage === 4 ? bossDefeated : this.scoreEngine.correctCount >= 2;

      if (passed) {
        stageCompleted = true;
        if (!adv.completedStages.includes(this.adventureStage)) {
          adv.completedStages.push(this.adventureStage);
          adv.keys = Math.min(3, (adv.keys || 0) + 1);
          earnedKey = currentStageDef ? currentStageDef.rewardKey : "🗝️ Kunci Baru";
        }
        const nextStageId = this.adventureStage + 1;
        if (nextStageId <= 4 && !adv.unlockedStages.includes(nextStageId)) {
          adv.unlockedStages.push(nextStageId);
        }
        adv.totalStars = (adv.totalStars || 0) + (this.scoreEngine.correctCount >= 3 ? 3 : 2);
        this.storage.saveAdventureProgress(adv);
        this.adventureKeys = adv.keys;
      }
    }

    // Team Battle Accumulated Persistence & Ranking
    let rankedTeams = [];
    if (this.selectedMode === GAME_MODES.TEAM_BATTLE || this.selectedMode === GAME_MODES.DUEL) {
      rankedTeams = [...this.battleTeams].sort((a, b) => (b.sessionScore || 0) - (a.sessionScore || 0));
      const storedTeams = this.storage.getTeams();
      this.battleTeams.forEach((bTeam) => {
        const match = storedTeams.find((st) => st.id === bTeam.id);
        if (match) {
          match.score = (match.score || 0) + (bTeam.sessionScore || 0);
        }
      });
      this.storage.saveTeams(storedTeams);
    }

    this.setState(GAME_STATES.RESULT, {
      score: this.scoreEngine.score,
      correct: this.scoreEngine.correctCount,
      wrong: this.scoreEngine.wrongCount,
      total: this.questions.length,
      accuracy,
      streak: this.scoreEngine.maxStreak,
      avgResponseTimeSec,
      weakTopics,
      topicStats: this.scoreEngine.topicStats,
      level,
      badge,
      bossDefeated,
      battleTeams: this.battleTeams,
      rankedTeams,
      mode: this.selectedMode,
      adventureStage: this.adventureStage,
      adventureKeys: this.adventureKeys,
      stageCompleted,
      earnedKey
    });
  }

  returnHome() {
    this.clearTimer();
    this.setState(GAME_STATES.HOME);
  }
}

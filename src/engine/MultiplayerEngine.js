/**
 * MOTION SMART CLASS - Multiplayer Engine
 * Real-time Classroom Game Show & Online Room Battle
 * 
 * Supports:
 * 1. Cloud Firestore for real-time internet-wide room synchronization (Host + Students)
 * 2. BroadcastChannel + LocalStorage bridge for instant zero-latency multi-tab testing & offline classrooms
 * 3. Strict Student Privacy: zero camera/video/biometric data sent over the network
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  runTransaction
} from "firebase/firestore";
import {
  ensureAnonymousAuth,
  getCurrentUser,
  getDb,
  isFirebaseConfigured,
  getFirebaseConfig
} from "../firebase.js";
import { cleanText } from "../utils/security.js";

export const ROOM_STATUS = {
  LOBBY: "LOBBY",
  COUNTDOWN: "COUNTDOWN",
  QUESTION: "QUESTION",
  ROUND_RESULT: "ROUND_RESULT",
  PODIUM: "PODIUM",
  FINISHED: "FINISHED"
};

const ROOMS_COLLECTION = "msc_rooms";
const ROOM_SECRETS_COLLECTION = "msc_room_secrets";
const LOCAL_STORAGE_PREFIX = "MSC_ROOM_";
const BROADCAST_CHANNEL_NAME = "msc_multiplayer_sync";

export class MultiplayerEngine {
  constructor() {
    this.currentRoom = null;
    this.roomCode = null;
    this.isHost = false;
    this.localPlayerId = this._getOrCreatePlayerId();
    this.localPlayerName = "Siswa";
    this.localPlayerAvatar = "🦁";
    this.hostQuestions = [];
    this.cloudConnected = false;

    // Callbacks
    this.onRoomUpdate = null;
    this.onError = null;

    // Real-time listeners
    this.unsubscribeFirestore = null;
    this.broadcastChannel = null;

    this._initBroadcastChannel();
  }

  /**
   * Initialize BroadcastChannel for instant local cross-tab sync
   */
  _initBroadcastChannel() {
    const hasBC = typeof window !== "undefined" ? ("BroadcastChannel" in window) : (typeof BroadcastChannel !== "undefined");
    if (hasBC) {
      try {
        const BC = typeof window !== "undefined" ? window.BroadcastChannel : BroadcastChannel;
        this.broadcastChannel = new BC(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this._handleBroadcastMessage(event.data);
        };
      } catch (e) {
        console.warn("[Multiplayer] BroadcastChannel not available:", e);
      }
    }
  }

  _handleBroadcastMessage(msg) {
    if (!msg || !msg.roomCode) return;
    if (this.roomCode && msg.roomCode.toUpperCase() === this.roomCode.toUpperCase()) {
      if (msg.type === "ROOM_UPDATED" && msg.room) {
        this.currentRoom = msg.room;
        if (typeof this.onRoomUpdate === "function") {
          this.onRoomUpdate(this.currentRoom);
        }
      }
    }
  }

  _broadcastRoom(room) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: "ROOM_UPDATED",
          roomCode: room.roomCode,
          room
        });
      } catch (e) {
        console.warn("[Multiplayer] Broadcast error:", e);
      }
    }
  }

  /**
   * Get or generate unique local device ID
   */
  _getOrCreatePlayerId() {
    if (typeof localStorage === "undefined") return "p_" + Math.random().toString(36).substring(2, 9);
    let id = localStorage.getItem("MSC_DEVICE_PLAYER_ID");
    if (!id) {
      id = "p_" + Math.random().toString(36).substring(2, 9);
      localStorage.setItem("MSC_DEVICE_PLAYER_ID", id);
    }
    return id;
  }

  /**
   * Generate 6-character room PIN (digits or uppercase alphanumeric)
   */
  static generateRoomCode() {
    const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let code = "";
    const random = new Uint32Array(6);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(random);
    }
    for (let i = 0; i < 6; i++) {
      const value = random[i] || Math.floor(Math.random() * 0xFFFFFFFF);
      code += chars.charAt(value % chars.length);
    }
    return code;
  }

  /**
   * Check if Cloud Firestore is active
   */
  isOnlineFirestoreActive() {
    const config = getFirebaseConfig();
    return isFirebaseConfigured(config) && (typeof window !== "undefined") && Boolean(getDb());
  }

  async _ensureCloudIdentity() {
    if (!this.isOnlineFirestoreActive()) return null;
    const user = getCurrentUser() || await ensureAnonymousAuth();
    if (user?.uid) this.localPlayerId = user.uid;
    return user;
  }

  // ==========================================
  // HOST ACTIONS
  // ==========================================

  /**
   * Create a new Multiplayer Room (Teacher / Host Mode)
   */
  async createRoom({
    hostName = "Guru",
    category = "numerasi",
    grade = 4,
    difficulty = "medium",
    totalQuestions = 5,
    timeLimit = 30,
    readyCountdownSeconds = 5,
    questions = []
  } = {}) {
    const cloudUser = await this._ensureCloudIdentity().catch(() => null);
    this.isHost = true;
    this.roomCode = MultiplayerEngine.generateRoomCode();

    this.hostQuestions = questions.slice(0, totalQuestions).map((question) => ({ ...question }));
    const publicQuestions = this.hostQuestions.map(({ correctAnswer, explanation, ...question }) => question);

    const readySeconds = Math.min(10, Math.max(3, Number(readyCountdownSeconds) || 5));
    const newRoom = {
      roomCode: this.roomCode,
      hostId: this.localPlayerId,
      hostUid: cloudUser?.uid || this.localPlayerId,
      hostName,
      createdAt: Date.now(),
      status: ROOM_STATUS.LOBBY,
      settings: {
        category,
        grade,
        difficulty,
        totalQuestions,
        timeLimit,
        readyCountdownSeconds: readySeconds
      },
      questions: publicQuestions,
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      countdownSec: readySeconds,
      players: {},
      leaderboard: []
    };

    this.currentRoom = newRoom;
    this._saveRoomLocally(newRoom);
    this._broadcastRoom(newRoom);

    // Save & listen in Firestore if available
    if (this.isOnlineFirestoreActive()) {
      try {
        const db = getDb();
        const roomDocRef = doc(db, ROOMS_COLLECTION, this.roomCode);
        await setDoc(doc(db, ROOM_SECRETS_COLLECTION, this.roomCode), {
          hostUid: cloudUser?.uid || this.localPlayerId,
          questions: this.hostQuestions,
          createdAt: Date.now()
        });
        await setDoc(roomDocRef, newRoom);
        this.cloudConnected = true;
        this._subscribeToFirestoreRoom(this.roomCode);
        console.log(`[Multiplayer] Cloud Firestore room created: ${this.roomCode}`);
      } catch (err) {
        this.cloudConnected = false;
        console.warn("[Multiplayer] Firestore createRoom error, running in local channel mode:", err);
      }
    }

    if (typeof this.onRoomUpdate === "function") {
      this.onRoomUpdate(this.currentRoom);
    }

    return newRoom;
  }

  /**
   * Host starts the game from Lobby
   */
  async startRoomGame() {
    if (!this.isHost || !this.currentRoom) return;

    this.currentRoom.status = ROOM_STATUS.COUNTDOWN;
    const readySeconds = Math.min(10, Math.max(3, Number(this.currentRoom.settings?.readyCountdownSeconds) || 5));
    this.currentRoom.countdownSec = readySeconds;
    this.currentRoom.currentQuestionIndex = 0;
    this.currentRoom.questionStartedAt = Date.now();

    // Reset player round states
    this._resetPlayerAnswersForNewRound();
    await this._syncRoomUpdate(this.currentRoom);

    // Trigger Countdown then transition to QUESTION
    let count = readySeconds;
    const interval = setInterval(async () => {
      count--;
      if (count > 0) {
        if (this.currentRoom) {
          this.currentRoom.countdownSec = count;
          await this._syncRoomUpdate(this.currentRoom);
        }
      } else {
        clearInterval(interval);
        if (this.currentRoom) {
          this.currentRoom.status = ROOM_STATUS.QUESTION;
          this.currentRoom.questionStartedAt = Date.now();
          await this._syncRoomUpdate(this.currentRoom);
        }
      }
    }, 1000);
  }

  /**
   * Host moves to round result / leaderboard
   */
  async advanceToRoundResult() {
    if (!this.isHost || !this.currentRoom || this.currentRoom.status !== ROOM_STATUS.QUESTION) return;

    await this._scoreCurrentRound();
    this.currentRoom.status = ROOM_STATUS.ROUND_RESULT;
    this.currentRoom.leaderboard = this.getLeaderboard();

    await this._syncRoomUpdate(this.currentRoom);
  }

  /**
   * Host moves to next question or final podium
   */
  async nextQuestion() {
    if (!this.isHost || !this.currentRoom) return;

    const nextIndex = this.currentRoom.currentQuestionIndex + 1;
    if (nextIndex >= this.currentRoom.questions.length) {
      // Game Over -> PODIUM
      this.currentRoom.status = ROOM_STATUS.PODIUM;
      this.currentRoom.leaderboard = this.getLeaderboard();
      await this._syncRoomUpdate(this.currentRoom);
      return;
    }

    this.currentRoom.currentQuestionIndex = nextIndex;
    this.currentRoom.status = ROOM_STATUS.COUNTDOWN;
    const readySeconds = Math.min(10, Math.max(3, Number(this.currentRoom.settings?.readyCountdownSeconds) || 5));
    this.currentRoom.countdownSec = readySeconds;
    this._resetPlayerAnswersForNewRound();
    await this._syncRoomUpdate(this.currentRoom);

    let count = readySeconds;
    const interval = setInterval(async () => {
      count--;
      if (count > 0) {
        if (this.currentRoom) {
          this.currentRoom.countdownSec = count;
          await this._syncRoomUpdate(this.currentRoom);
        }
      } else {
        clearInterval(interval);
        if (this.currentRoom) {
          this.currentRoom.status = ROOM_STATUS.QUESTION;
          this.currentRoom.questionStartedAt = Date.now();
          await this._syncRoomUpdate(this.currentRoom);
        }
      }
    }, 1000);
  }

  /**
   * Finish or close room
   */
  async closeRoom() {
    if (this.currentRoom) {
      this.currentRoom.status = ROOM_STATUS.FINISHED;
      await this._syncRoomUpdate(this.currentRoom);
    }
    this.leaveRoom();
  }

  // ==========================================
  // PLAYER ACTIONS
  // ==========================================

  /**
   * Join an existing room with code
   */
  async joinRoom(roomCode, { name = "Siswa", avatar = "🦁" } = {}) {
    const cloudUser = await this._ensureCloudIdentity().catch(() => null);
    this.isHost = false;
    this.roomCode = roomCode.trim().toUpperCase();
    this.localPlayerName = cleanText(name, 40) || "Siswa";
    this.localPlayerAvatar = cleanText(avatar, 8) || "🦁";

    let room = await this._fetchRoom(this.roomCode);

    if (!room) {
      throw new Error(`Room dengan kode "${this.roomCode}" tidak ditemukan! Pastikan kode benar.`);
    }

    if (room.status === ROOM_STATUS.FINISHED) {
      throw new Error(`Room "${this.roomCode}" sudah selesai atau ditutup.`);
    }

    // Add or update local player
    if (!room.players) room.players = {};

    room.players[this.localPlayerId] = {
      id: this.localPlayerId,
      name: this.localPlayerName,
      avatar: this.localPlayerAvatar,
      score: room.players[this.localPlayerId]?.score || 0,
      streak: room.players[this.localPlayerId]?.streak || 0,
      correctCount: room.players[this.localPlayerId]?.correctCount || 0,
      hasAnswered: false,
      lastAnswer: null,
      answerTimeMs: 0,
      isCorrect: false,
      joinedAt: Date.now()
    };

    this.currentRoom = room;
    if (this.isOnlineFirestoreActive() && cloudUser) {
      const db = getDb();
      const roomDocRef = doc(db, ROOMS_COLLECTION, this.roomCode);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(roomDocRef);
        if (!snapshot.exists()) throw new Error("Room tidak ditemukan.");
        const latest = snapshot.data();
        if (latest.status === ROOM_STATUS.FINISHED) throw new Error("Room sudah selesai.");
        latest.players = latest.players || {};
        latest.players[this.localPlayerId] = room.players[this.localPlayerId];
        transaction.update(roomDocRef, { players: latest.players });
        this.currentRoom = latest;
      });
      this._saveRoomLocally(this.currentRoom);
    } else {
      await this._syncRoomUpdate(room);
    }

    // Subscribe to updates
    if (this.isOnlineFirestoreActive()) {
      this._subscribeToFirestoreRoom(this.roomCode);
    }

    if (typeof this.onRoomUpdate === "function") {
      this.onRoomUpdate(this.currentRoom);
    }

    return room;
  }

  /**
   * Submit answer for the active question (via Gesture or Touch)
   * @param {string|number} answerKey 'A' | 'B' | 'C' | 'D' or index 0..3
   */
  async submitAnswer(answerKey) {
    if (!this.currentRoom || this.currentRoom.status !== ROOM_STATUS.QUESTION) {
      if (this.roomCode) {
        const latest = this._getRoomLocally(this.roomCode);
        if (latest) this.currentRoom = latest;
      }
    }

    if (!this.currentRoom || this.currentRoom.status !== ROOM_STATUS.QUESTION) {
      return { success: false, reason: "Bukan waktu menjawab" };
    }

    const player = this.currentRoom.players?.[this.localPlayerId];
    if (!player) return { success: false, reason: "Pemain tidak terdaftar di room" };

    if (player.hasAnswered) {
      return { success: false, reason: "Sudah menjawab di soal ini", alreadyAnswered: true };
    }

    const currentQ = this.currentRoom.questions[this.currentRoom.currentQuestionIndex];
    if (!currentQ) return { success: false, reason: "Soal tidak tersedia" };

    // Convert key to numeric index (0=A, 1=B, 2=C, 3=D)
    let selectedIndex = -1;
    if (typeof answerKey === "number") {
      selectedIndex = answerKey;
    } else {
      const map = { A: 0, B: 1, C: 2, D: 3 };
      selectedIndex = map[answerKey] ?? -1;
    }
    if (selectedIndex < 0 || selectedIndex > 3 || selectedIndex >= currentQ.options.length) {
      return { success: false, reason: "Pilihan jawaban tidak valid" };
    }

    const responseTimeMs = Math.max(200, Date.now() - (this.currentRoom.questionStartedAt || Date.now()));

    player.hasAnswered = true;
    player.lastAnswer = ["A", "B", "C", "D"][selectedIndex];
    player.answerTimeMs = responseTimeMs;
    if (this.isOnlineFirestoreActive()) {
      await this._ensureCloudIdentity();
      const db = getDb();
      const roomDocRef = doc(db, ROOMS_COLLECTION, this.roomCode);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(roomDocRef);
        if (!snapshot.exists()) throw new Error("Room tidak ditemukan.");
        const latest = snapshot.data();
        const latestPlayer = latest.players?.[this.localPlayerId];
        if (!latestPlayer) throw new Error("Pemain tidak terdaftar di room.");
        if (latestPlayer.hasAnswered) throw new Error("Jawaban sudah dikunci.");
        const updatedPlayer = {
          ...latestPlayer,
          hasAnswered: true,
          lastAnswer: player.lastAnswer,
          answerTimeMs: responseTimeMs
        };
        const players = { ...latest.players, [this.localPlayerId]: updatedPlayer };
        transaction.update(roomDocRef, { players });
        this.currentRoom = { ...latest, players };
      });
      this._saveRoomLocally(this.currentRoom);
    } else {
      await this._syncRoomUpdate(this.currentRoom);
    }

    return {
      success: true,
      pending: true,
      responseTimeMs,
      answer: player.lastAnswer
    };
  }

  /**
   * Leave room and clean up listeners
   */
  leaveRoom() {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }
    this.currentRoom = null;
    this.roomCode = null;
    this.isHost = false;
  }

  // ==========================================
  // HELPERS & SYNC ENGINE
  // ==========================================

  async _getHostQuestion(index) {
    if (this.hostQuestions[index]) return this.hostQuestions[index];
    if (!this.isHost || !this.isOnlineFirestoreActive()) return null;
    try {
      const snapshot = await getDoc(doc(getDb(), ROOM_SECRETS_COLLECTION, this.roomCode));
      if (snapshot.exists()) {
        this.hostQuestions = snapshot.data().questions || [];
        return this.hostQuestions[index] || null;
      }
    } catch (error) {
      console.error("[Multiplayer] Unable to load protected answer key:", error);
    }
    return null;
  }

  async _scoreCurrentRound() {
    const room = this.currentRoom;
    if (!room) return;
    const index = room.currentQuestionIndex;
    const privateQuestion = await this._getHostQuestion(index);
    if (!privateQuestion || typeof privateQuestion.correctAnswer !== "number") {
      throw new Error("Kunci jawaban privat tidak tersedia untuk host.");
    }

    const correctLetter = ["A", "B", "C", "D"][privateQuestion.correctAnswer];
    Object.values(room.players || {}).forEach((player) => {
      if (!player.hasAnswered) {
        player.isCorrect = false;
        player.pointsEarned = 0;
        player.streak = 0;
        return;
      }
      const isCorrect = player.lastAnswer === correctLetter;
      let pointsEarned = 0;
      if (isCorrect) {
        player.correctCount = (player.correctCount || 0) + 1;
        player.streak = (player.streak || 0) + 1;
        const maxTimeMs = (privateQuestion.timeLimit || room.settings?.timeLimit || 30) * 1000;
        const speedRatio = Math.max(0, 1 - ((player.answerTimeMs || maxTimeMs) / maxTimeMs));
        pointsEarned = 100 + Math.round(speedRatio * 50) + Math.min(60, (player.streak - 1) * 20);
        player.score = (player.score || 0) + pointsEarned;
      } else {
        player.streak = 0;
      }
      player.isCorrect = isCorrect;
      player.pointsEarned = pointsEarned;
    });

    // Publish the answer only after the round closes, never while students can answer.
    room.questions[index] = {
      ...room.questions[index],
      correctAnswer: privateQuestion.correctAnswer,
      explanation: privateQuestion.explanation || ""
    };
  }

  _resetPlayerAnswersForNewRound() {
    if (!this.currentRoom?.players) return;
    Object.values(this.currentRoom.players).forEach((p) => {
      p.hasAnswered = false;
      p.lastAnswer = null;
      p.answerTimeMs = 0;
      p.isCorrect = false;
      p.pointsEarned = 0;
    });
  }

  /**
   * Fetch room from Firestore or LocalStorage
   */
  async _fetchRoom(code) {
    // 1. Try Cloud Firestore
    if (this.isOnlineFirestoreActive()) {
      try {
        const db = getDb();
        const roomDocRef = doc(db, ROOMS_COLLECTION, code);
        const snap = await getDoc(roomDocRef);
        if (snap.exists()) {
          const data = snap.data();
          this._saveRoomLocally(data);
          return data;
        }
      } catch (e) {
        console.warn("[Multiplayer] Error fetching Firestore room:", e);
      }
    }

    // 2. Try LocalStorage
    return this._getRoomLocally(code);
  }

  /**
   * Sync room update across Firestore, LocalStorage, and BroadcastChannel
   */
  async _syncRoomUpdate(room) {
    if (!room) return;

    // Local mirror
    this._saveRoomLocally(room);
    this._broadcastRoom(room);

    // Cloud Firestore
    if (this.isOnlineFirestoreActive()) {
      try {
        const db = getDb();
        const roomDocRef = doc(db, ROOMS_COLLECTION, room.roomCode);
        await updateDoc(roomDocRef, room).catch(async () => {
          await setDoc(roomDocRef, room);
        });
      } catch (e) {
        console.warn("[Multiplayer] Firestore update error:", e);
      }
    }

    if (typeof this.onRoomUpdate === "function") {
      this.onRoomUpdate(room);
    }
  }

  _subscribeToFirestoreRoom(code) {
    if (this.unsubscribeFirestore) {
      this.unsubscribeFirestore();
      this.unsubscribeFirestore = null;
    }

    try {
      const db = getDb();
      if (!db) return;
      const roomDocRef = doc(db, ROOMS_COLLECTION, code);

      this.unsubscribeFirestore = onSnapshot(roomDocRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          this.currentRoom = data;
          this._saveRoomLocally(data);
          this._broadcastRoom(data);
          if (typeof this.onRoomUpdate === "function") {
            this.onRoomUpdate(this.currentRoom);
          }
        }
      }, (err) => {
        console.warn("[Multiplayer] Firestore onSnapshot error:", err);
      });
    } catch (e) {
      console.warn("[Multiplayer] Error subscribing to Firestore:", e);
    }
  }

  _saveRoomLocally(room) {
    if (typeof localStorage === "undefined" || !room) return;
    try {
      localStorage.setItem(LOCAL_STORAGE_PREFIX + room.roomCode, JSON.stringify(room));
    } catch (e) {}
  }

  _getRoomLocally(code) {
    if (typeof localStorage === "undefined") return null;
    try {
      const str = localStorage.getItem(LOCAL_STORAGE_PREFIX + code);
      return str ? JSON.parse(str) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get sorted leaderboard array from current room players
   */
  getLeaderboard() {
    if (!this.currentRoom && this.roomCode) {
      const latest = this._getRoomLocally(this.roomCode);
      if (latest && latest.players) this.currentRoom = latest;
    }
    if (!this.currentRoom?.players) return [];
    return Object.values(this.currentRoom.players).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.answerTimeMs || 99999) - (b.answerTimeMs || 99999);
    });
  }

  /**
   * Get counts of answers (A, B, C, D) for the current active question
   */
  getAnswerDistribution() {
    if (!this.currentRoom && this.roomCode) {
      const latest = this._getRoomLocally(this.roomCode);
      if (latest && latest.players) this.currentRoom = latest;
    }
    const dist = { A: 0, B: 0, C: 0, D: 0, total: 0 };
    if (!this.currentRoom?.players) return dist;

    Object.values(this.currentRoom.players).forEach((p) => {
      if (p.hasAnswered && p.lastAnswer && dist[p.lastAnswer] !== undefined) {
        dist[p.lastAnswer]++;
        dist.total++;
      }
    });
    return dist;
  }
}

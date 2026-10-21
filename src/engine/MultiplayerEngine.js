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
  deleteDoc,
  onSnapshot
} from "firebase/firestore";
import { getDb, isFirebaseConfigured, getFirebaseConfig } from "../firebase.js";

export const ROOM_STATUS = {
  LOBBY: "LOBBY",
  COUNTDOWN: "COUNTDOWN",
  QUESTION: "QUESTION",
  ROUND_RESULT: "ROUND_RESULT",
  PODIUM: "PODIUM",
  FINISHED: "FINISHED"
};

const ROOMS_COLLECTION = "msc_rooms";
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
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
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
    questions = []
  } = {}) {
    this.isHost = true;
    this.roomCode = MultiplayerEngine.generateRoomCode();

    const newRoom = {
      roomCode: this.roomCode,
      hostId: this.localPlayerId,
      hostName,
      createdAt: Date.now(),
      status: ROOM_STATUS.LOBBY,
      settings: {
        category,
        grade,
        difficulty,
        totalQuestions,
        timeLimit
      },
      questions: questions.slice(0, totalQuestions),
      currentQuestionIndex: 0,
      questionStartedAt: 0,
      countdownSec: 3,
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
        await setDoc(roomDocRef, newRoom);
        this._subscribeToFirestoreRoom(this.roomCode);
        console.log(`[Multiplayer] Cloud Firestore room created: ${this.roomCode}`);
      } catch (err) {
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
    this.currentRoom.countdownSec = 3;
    this.currentRoom.currentQuestionIndex = 0;
    this.currentRoom.questionStartedAt = Date.now();

    // Reset player round states
    this._resetPlayerAnswersForNewRound();
    await this._syncRoomUpdate(this.currentRoom);

    // Trigger Countdown then transition to QUESTION
    let count = 3;
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
    if (!this.isHost || !this.currentRoom) return;

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
    this.currentRoom.countdownSec = 3;
    this._resetPlayerAnswersForNewRound();
    await this._syncRoomUpdate(this.currentRoom);

    let count = 3;
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
    this.isHost = false;
    this.roomCode = roomCode.trim().toUpperCase();
    this.localPlayerName = name.trim() || "Siswa";
    this.localPlayerAvatar = avatar || "🦁";

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
    await this._syncRoomUpdate(room);

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
    let selectedIndex = 0;
    if (typeof answerKey === "number") {
      selectedIndex = answerKey;
    } else {
      const map = { A: 0, B: 1, C: 2, D: 3 };
      selectedIndex = map[answerKey] ?? 0;
    }

    const isCorrect = selectedIndex === currentQ.correctAnswer;
    const responseTimeMs = Math.max(200, Date.now() - (this.currentRoom.questionStartedAt || Date.now()));

    // Scoring formula: Base 100 + Speed Bonus (up to 50 for < 2.5s) + Streak Bonus (20 per streak)
    let pointsEarned = 0;
    if (isCorrect) {
      player.correctCount = (player.correctCount || 0) + 1;
      player.streak = (player.streak || 0) + 1;

      const maxTimeMs = (currentQ.timeLimit || 30) * 1000;
      const speedRatio = Math.max(0, 1 - (responseTimeMs / maxTimeMs));
      const speedBonus = Math.round(speedRatio * 50);
      const streakBonus = Math.min(60, (player.streak - 1) * 20);

      pointsEarned = 100 + speedBonus + streakBonus;
      player.score += pointsEarned;
    } else {
      player.streak = 0;
    }

    player.hasAnswered = true;
    player.lastAnswer = ["A", "B", "C", "D"][selectedIndex];
    player.answerTimeMs = responseTimeMs;
    player.isCorrect = isCorrect;
    player.pointsEarned = pointsEarned;

    await this._syncRoomUpdate(this.currentRoom);

    return {
      success: true,
      isCorrect,
      pointsEarned,
      responseTimeMs,
      streak: player.streak
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
    if (this.roomCode) {
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
    if (this.roomCode) {
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

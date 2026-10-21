/**
 * MOTION SMART CLASS - Main Entry Point
 * Orchestrates all modular engines and launches the application.
 *
 * "Berpikir dengan Otak. Menjawab dengan Gerak!"
 */

import "./style.css";
import { AudioManager } from "./engine/AudioManager.js";
import { StorageManager } from "./engine/StorageManager.js";
import { QuestionEngine } from "./engine/QuestionEngine.js";
import { ScoreEngine } from "./engine/ScoreEngine.js";
import { CameraManager } from "./engine/CameraManager.js";
import { PoseDetector } from "./engine/PoseDetector.js";
import { GestureEngine } from "./engine/GestureEngine.js";
import { GameEngine, GAME_STATES } from "./engine/GameEngine.js";
import { UIManager } from "./engine/UIManager.js";
import { ensureAnonymousAuth } from "./firebase.js";

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  // 1. Initialize persistent storage & audio
  const settings = StorageManager.getSettings();
  const audioManager = new AudioManager();
  audioManager.toggleSound(settings.soundEnabled);

  // 2. Question & Score Engines
  const questionEngine = new QuestionEngine();
  const scoreEngine = new ScoreEngine();

  // 3. Camera & Computer Vision Engines
  const cameraManager = new CameraManager();
  const poseDetector = new PoseDetector();
  poseDetector.showSkeleton = settings.showSkeleton;

  const gestureEngine = new GestureEngine({
    confidenceThreshold: settings.confidenceThreshold,
    holdDurationMs: settings.holdDurationSeconds * 1000,
    cooldownMs: settings.cooldownSeconds * 1000
  });

  // 4. Core Game Engine
  const gameEngine = new GameEngine({
    audioManager,
    questionEngine,
    scoreEngine,
    storageManager: StorageManager
  });

  // 5. User Interface Manager
  const uiManager = new UIManager({
    appContainer,
    gameEngine,
    cameraManager,
    poseDetector,
    gestureEngine,
    audioManager
  });

  // Start in Home state
  gameEngine.setState(GAME_STATES.HOME);

  // Pre-load Cloud Firestore questions asynchronously in background
  ensureAnonymousAuth().catch((err) => {
    console.warn("[Motion Smart Class] Anonymous Firebase authentication unavailable:", err);
  }).then(() => questionEngine.loadFirestoreQuestions()).then((questions) => {
    if (questions && questions.length > 0) {
      console.log(`[Motion Smart Class] Synced ${questions.length} questions from Cloud Firestore.`);
    }
  }).catch(() => {});

  // Unlock Web Audio on first user tap/click
  const unlockAudio = () => {
    audioManager.ensureContext();
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
  };
  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("touchstart", unlockAudio, { once: true });

  console.log("Motion Smart Class initialized successfully.");
});

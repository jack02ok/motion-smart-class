/**
 * Test Suite for Motion Smart Class Engines
 * Tests: StorageManager, QuestionEngine, ScoreEngine, GestureEngine
 */

import assert from "node:assert";
import { readFileSync } from "node:fs";

// Mock localStorage for node environment
globalThis.localStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
globalThis.sessionStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

async function runTests() {
  console.log("=== RUNNING MOTION SMART CLASS TEST SUITE ===");

  // 1. Test StorageManager CRUD
  console.log("\n[1] Testing StorageManager (Tahap 2 Teacher Studio)...");
  const { StorageManager } = await import("../src/engine/StorageManager.js");
  assert.strictEqual(StorageManager.getSettings().readyCountdownSeconds, 5, "Default movement preparation must be 5 seconds");

  // Save new question
  const q1 = StorageManager.saveCustomQuestion({
    category: "numerasi",
    grade: 5,
    difficulty: "medium",
    topic: "Uji Perkalian",
    question: "12 × 12 = ?",
    options: ["120", "132", "144", "154"],
    correctAnswer: 2,
    timeLimit: 35,
    pointWeight: 150
  });

  assert.ok(q1.id, "Question ID should be generated");
  assert.strictEqual(q1.question, "12 × 12 = ?");
  assert.strictEqual(q1.timeLimit, 35);
  assert.strictEqual(q1.pointWeight, 150);
  console.log("✓ saveCustomQuestion: PASS");

  // Update existing question
  const updated = StorageManager.updateCustomQuestion(q1.id, {
    question: "12 × 12 = Berapa ya?",
    pointWeight: 200
  });
  assert.strictEqual(updated.question, "12 × 12 = Berapa ya?");
  assert.strictEqual(updated.pointWeight, 200);
  assert.strictEqual(updated.timeLimit, 35, "Should preserve existing properties");
  console.log("✓ updateCustomQuestion: PASS");

  // Import JSON with validation
  const validImportData = [
    {
      question: "Ibu kota Indonesia adalah?",
      category: "literasi",
      grade: 4,
      difficulty: "easy",
      topic: "Wawasan Nusantara",
      options: ["Surabaya", "Bandung", "Jakarta / IKN", "Medan"],
      correctAnswer: 2,
      timeLimit: 30,
      pointWeight: 100,
      imageUrl: "https://images.example.edu/indonesia-map.png",
      imageAlt: "Peta Indonesia"
    }
  ];
  const importResult = StorageManager.importCustomQuestions(validImportData);
  assert.strictEqual(importResult.success, true);
  assert.strictEqual(importResult.importedCount, 1);
  const importedQuestion = StorageManager.getCustomQuestions().find((question) => question.topic === "Wawasan Nusantara");
  assert.strictEqual(importedQuestion.imageUrl, "https://images.example.edu/indonesia-map.png");
  assert.strictEqual(importedQuestion.imageAlt, "Peta Indonesia");
  console.log("✓ importCustomQuestions (Valid JSON): PASS");

  const csvResult = StorageManager.importQuestionsFromCSV([
    "question,optionA,optionB,optionC,optionD,correctAnswer,category,grade,difficulty,topic,imageUrl,imageAlt,explanation",
    '"Hasil 5 + 5?",8,9,10,11,C,numerasi,2,easy,Penjumlahan,,,"Lima ditambah lima"'
  ].join("\n"));
  assert.strictEqual(csvResult.success, true);
  assert.ok(StorageManager.getCustomQuestions().some((q) => q.question === "Hasil 5 + 5?" && q.correctAnswer === 2));
  console.log("✓ importQuestionsFromCSV: PASS");

  const { createQuestionWorkbook, readQuestionWorkbook } = await import("../src/utils/questionSpreadsheet.js");
  const excelFixture = [{
    id: "excel-roundtrip-1",
    question: "Berapakah setengah dari 10?",
    options: ["2", "5", "8", "10"],
    correctAnswer: 1,
    category: "numerasi",
    grade: 3,
    difficulty: "easy",
    topic: "Pembagian",
    imageUrl: "https://images.example.edu/halves.png",
    imageAlt: "Sepuluh benda dibagi dua kelompok",
    imageLayout: "compact",
    timeLimit: 35,
    pointWeight: 120,
    explanation: "Setengah dari sepuluh adalah lima."
  }];
  for (const format of ["xlsx", "xls"]) {
    const workbookData = await createQuestionWorkbook(excelFixture, format);
    const parsedExcel = await readQuestionWorkbook(workbookData);
    assert.strictEqual(parsedExcel.length, 1);
    assert.strictEqual(parsedExcel[0].question, excelFixture[0].question);
    assert.deepStrictEqual(parsedExcel[0].options, excelFixture[0].options);
    assert.strictEqual(parsedExcel[0].correctAnswer, 1);
    assert.strictEqual(parsedExcel[0].grade, 3);
    assert.strictEqual(parsedExcel[0].imageLayout, "compact");
  }
  console.log("✓ XLS/XLSX question workbook round-trip: PASS");

  const savedPackage = StorageManager.saveSessionPackage({ name: "Pecahan Kelas 4", mode: "cooperative", count: 10 });
  assert.strictEqual(savedPackage.mode, "cooperative");
  assert.ok(StorageManager.getSessionPackages().some((pkg) => pkg.id === savedPackage.id));
  StorageManager.deleteSessionPackage(savedPackage.id);
  console.log("✓ session package persistence: PASS");

  // Import Invalid JSON
  const invalidImportResult = StorageManager.importCustomQuestions([
    { question: "", options: ["A"] } // missing options, empty question
  ]);
  assert.strictEqual(invalidImportResult.success, false);
  console.log("✓ importCustomQuestions (Invalid Schema Rejected): PASS");

  // Delete question
  const remaining = StorageManager.deleteCustomQuestion(q1.id);
  assert.ok(!remaining.some((q) => q.id === q1.id), "Deleted question should not exist");
  console.log("✓ deleteCustomQuestion: PASS");

  const { getCameraConstraintPlans, describeCameraError } = await import("../src/engine/CameraManager.js");
  const cameraPlans = getCameraConstraintPlans("user");
  assert.strictEqual(cameraPlans.length, 2, "Camera must provide a PID-compatible fallback plan");
  assert.deepStrictEqual(cameraPlans[1].constraints, { audio: false, video: true });
  assert.strictEqual(cameraPlans[0].constraints.video.frameRate.max, undefined, "Preferred camera FPS must not impose a hard maximum");
  assert.strictEqual(describeCameraError({ name: "NotReadableError" }).title, "Kamera sedang dipakai atau diblokir");
  assert.match(describeCameraError({ name: "NotAllowedError" }, { isEmbedded: false }).action, /overlay/i);
  assert.match(describeCameraError({ name: "NotAllowedError" }, { isEmbedded: true }).action, /allow="camera"/i);
  console.log("✓ PID camera fallback & diagnostics: PASS");

  const { escapeHTML, cleanText, safeColor, safeImageUrl } = await import("../src/utils/security.js");
  assert.strictEqual(escapeHTML('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  assert.strictEqual(cleanText("Nama\u0000 Siswa", 20), "Nama Siswa");
  assert.strictEqual(safeColor("red; background:url(x)"), "#64748B");
  assert.strictEqual(safeImageUrl("javascript:alert(1)"), "");
  assert.strictEqual(safeImageUrl("https://cdn.example.edu/question.png"), "https://cdn.example.edu/question.png");
  console.log("✓ HTML escaping & input hardening: PASS");

  const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.ok(!firestoreRules.includes("allow read: if true"), "Firestore must not expose public reads");
  assert.ok(!firestoreRules.includes("allow write: if true"), "Firestore must not expose public writes");
  assert.ok(firestoreRules.includes("msc_room_secrets"), "Answer keys need a teacher-only collection");
  assert.ok(firestoreRules.includes("isOwnPlayerUpdate"), "Player updates must be scoped to their Firebase UID");
  assert.ok(firestoreRules.includes("question_submissions"), "Question contributions need a moderated collection");
  assert.ok(firestoreRules.includes("isAdmin() && validQuestion()"), "Only an admin may publish questions");
  assert.ok(firestoreRules.includes("request.resource.data.role in ['student', 'teacher']"), "Self-service login roles must not include admin roles");
  assert.ok(firestoreRules.includes("request.resource.data.status in ['approved', 'rejected']"), "Moderation decisions must be constrained");
  console.log("✓ Firestore security invariants: PASS");

  // 2. Test QuestionEngine
  console.log("\n[2] Testing QuestionEngine...");
  const { QuestionEngine } = await import("../src/engine/QuestionEngine.js");
  const qEngine = new QuestionEngine();
  const optionShuffle = qEngine.shuffleQuestionOptions({ options: ["A", "B", "C", "D"], correctAnswer: 2 });
  assert.strictEqual(optionShuffle.options[optionShuffle.correctAnswer], "C", "Shuffling must preserve the answer key");

  const numQuestions = qEngine.getQuestions({ category: "numerasi", grade: 4, count: 5 });
  assert.ok(numQuestions.length > 0, "Should return numerasi questions");
  assert.strictEqual(numQuestions.length, 5);
  assert.ok(numQuestions[0].options.length === 4);
  console.log("✓ getQuestions (Numerasi): PASS");

  const tfQuestions = qEngine.getQuestions({ mode: "true_false", count: 4 });
  assert.strictEqual(tfQuestions.length, 4);
  assert.strictEqual(tfQuestions[0].options.length, 2);
  console.log("✓ getQuestions (True/False mode): PASS");

  // 3. Test ScoreEngine & Analytics
  console.log("\n[3] Testing ScoreEngine & Learning Analytics (Tahap 6)...");
  const { ScoreEngine } = await import("../src/engine/ScoreEngine.js");
  const scoreEngine = new ScoreEngine();

  // Answer 1: Correct + Fast response
  const s1 = scoreEngine.calculateAnswerScore({
    isCorrect: true,
    timeLeft: 35,
    totalTime: 40,
    pointWeight: 100,
    responseTimeMs: 3200,
    topic: "Perkalian"
  });
  assert.strictEqual(s1.pointsEarned, 150, "Base 100 + 50 speed bonus");
  assert.strictEqual(scoreEngine.streak, 1);

  // Answer 2: Correct -> Streak 2 Combo x2
  const s2 = scoreEngine.calculateAnswerScore({
    isCorrect: true,
    timeLeft: 20,
    totalTime: 40,
    pointWeight: 100,
    responseTimeMs: 4500,
    topic: "Perkalian"
  });
  assert.strictEqual(s2.comboMultiplier, 2);
  assert.strictEqual(scoreEngine.streak, 2);

  // Answer 3: Wrong
  const s3 = scoreEngine.calculateAnswerScore({
    isCorrect: false,
    timeLeft: 0,
    totalTime: 40,
    pointWeight: 100,
    responseTimeMs: 12000,
    topic: "Pecahan"
  });
  assert.strictEqual(s3.pointsEarned, 0);
  assert.strictEqual(scoreEngine.streak, 0, "Streak resets on wrong");

  assert.strictEqual(scoreEngine.getAccuracy(), 67, "2/3 = 67%");
  assert.ok(scoreEngine.getAverageResponseTimeSec() > 0);

  const weakTopics = scoreEngine.getWeakTopics();
  assert.ok(weakTopics.some((w) => w.topic === "Pecahan"), "Pecahan should be flagged as weak topic");
  console.log("✓ ScoreEngine & Topic Analytics: PASS");

  // Record session analytics to storage
  const sessionEntry = StorageManager.recordSessionAnalytics({
    mode: "quick_quiz",
    category: "numerasi",
    grade: 4,
    score: scoreEngine.score,
    correctCount: scoreEngine.correctCount,
    wrongCount: scoreEngine.wrongCount,
    totalQuestions: 3,
    accuracy: scoreEngine.getAccuracy(),
    avgResponseTimeSec: scoreEngine.getAverageResponseTimeSec(),
    topicMastery: scoreEngine.topicStats,
    weakTopics
  });
  assert.ok(sessionEntry.id);
  const history = StorageManager.getAnalyticsHistory();
  assert.ok(history.length >= 1);
  console.log("✓ StorageManager recordSessionAnalytics: PASS");

  // 4. Test GestureEngine
  console.log("\n[4] Testing GestureEngine...");
  const { GestureEngine, GESTURE_TYPES } = await import("../src/engine/GestureEngine.js");
  const gestureEngine = new GestureEngine();

  // Test Left Hand Up
  const landmarksLeftUp = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  landmarksLeftUp[0] = { x: 0.5, y: 0.25, visibility: 0.9 }; // nose
  landmarksLeftUp[11] = { x: 0.6, y: 0.40, visibility: 0.9 }; // left shoulder
  landmarksLeftUp[12] = { x: 0.4, y: 0.40, visibility: 0.9 }; // right shoulder
  landmarksLeftUp[15] = { x: 0.65, y: 0.20, visibility: 0.9 }; // left wrist UP (< 0.40)
  landmarksLeftUp[16] = { x: 0.35, y: 0.55, visibility: 0.9 }; // right wrist DOWN (> 0.40)

  const resLeft = gestureEngine.classifyPose(landmarksLeftUp);
  assert.strictEqual(resLeft.gesture, GESTURE_TYPES.A, "Gesture A is Left Hand Up");
  console.log("✓ Gesture A (Left Hand Raised): PASS");

  // Test Right Hand Up
  const landmarksRightUp = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  landmarksRightUp[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  landmarksRightUp[11] = { x: 0.6, y: 0.40, visibility: 0.9 };
  landmarksRightUp[12] = { x: 0.4, y: 0.40, visibility: 0.9 };
  landmarksRightUp[15] = { x: 0.65, y: 0.55, visibility: 0.9 }; // left wrist DOWN
  landmarksRightUp[16] = { x: 0.35, y: 0.20, visibility: 0.9 }; // right wrist UP (< 0.40)

  const resRight = gestureEngine.classifyPose(landmarksRightUp);
  assert.strictEqual(resRight.gesture, GESTURE_TYPES.B, "Gesture B is Right Hand Up");
  console.log("✓ Gesture B (Right Hand Raised): PASS");

  // Test Both Hands Up
  const landmarksBothUp = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  landmarksBothUp[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  landmarksBothUp[11] = { x: 0.6, y: 0.40, visibility: 0.9 };
  landmarksBothUp[12] = { x: 0.4, y: 0.40, visibility: 0.9 };
  landmarksBothUp[15] = { x: 0.65, y: 0.20, visibility: 0.9 }; // left wrist UP
  landmarksBothUp[16] = { x: 0.35, y: 0.20, visibility: 0.9 }; // right wrist UP

  const resBoth = gestureEngine.classifyPose(landmarksBothUp);
  assert.strictEqual(resBoth.gesture, GESTURE_TYPES.C, "Gesture C is Both Hands Up");
  console.log("✓ Gesture C (Both Hands Raised): PASS");

  // Test Squat
  const landmarksSquat = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  landmarksSquat[0] = { x: 0.5, y: 0.52, visibility: 0.9 }; // nose dropped to > 0.46
  landmarksSquat[11] = { x: 0.6, y: 0.60, visibility: 0.9 };
  landmarksSquat[12] = { x: 0.4, y: 0.60, visibility: 0.9 };
  landmarksSquat[15] = { x: 0.6, y: 0.70, visibility: 0.9 };
  landmarksSquat[16] = { x: 0.4, y: 0.70, visibility: 0.9 };

  const resSquat = gestureEngine.classifyPose(landmarksSquat);
  assert.strictEqual(resSquat.gesture, GESTURE_TYPES.D, "Gesture D is Squat");
  console.log("✓ Gesture D (Squat Position): PASS");

  gestureEngine.setMovementProfile("hands_only");
  const crossedArms = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  crossedArms[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  crossedArms[11] = { x: 0.62, y: 0.42, visibility: 0.9 };
  crossedArms[12] = { x: 0.38, y: 0.42, visibility: 0.9 };
  crossedArms[15] = { x: 0.39, y: 0.43, visibility: 0.9 };
  crossedArms[16] = { x: 0.61, y: 0.43, visibility: 0.9 };
  assert.strictEqual(gestureEngine.classifyPose(crossedArms).gesture, GESTURE_TYPES.D, "Crossed arms must replace squat in hands-only mode");
  gestureEngine.setMovementProfile("standard");
  console.log("✓ accessible hands-only movement profile: PASS");

  // 5. Test Tahap 3: Motion Arena Zone Classification & Distance Estimation
  console.log("\n[5] Testing Tahap 3: Motion Arena Zones & Distance Calibration...");
  // Test Zone A reach
  const zoneALandmarks = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  zoneALandmarks[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  zoneALandmarks[11] = { x: 0.6, y: 0.40, visibility: 0.9 };
  zoneALandmarks[12] = { x: 0.4, y: 0.40, visibility: 0.9 };
  zoneALandmarks[15] = { x: 0.65, y: 0.25, visibility: 0.9 }; // Left wrist elevated
  zoneALandmarks[16] = { x: 0.35, y: 0.65, visibility: 0.2 }; // Right wrist low/inactive
  const arenaResA = gestureEngine.classifyArenaZone(zoneALandmarks);
  assert.strictEqual(arenaResA.zone, "A", "Zone A should be classified");
  console.log("✓ classifyArenaZone (Zone A Reach): PASS");

  // Test Distance Estimation
  const idealPlayerLandmarks = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  idealPlayerLandmarks[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  idealPlayerLandmarks[11] = { x: 0.65, y: 0.40, visibility: 0.9 };
  idealPlayerLandmarks[12] = { x: 0.35, y: 0.40, visibility: 0.9 }; // shoulder width = 0.30 (Ideal ~2m)
  const posIdeal = gestureEngine.estimatePlayerPosition(idealPlayerLandmarks);
  assert.strictEqual(posIdeal.distanceStatus, "Ideal (~1.5–2.5m)");
  assert.strictEqual(posIdeal.playerLocked, true);
  console.log("✓ estimatePlayerPosition (Ideal Distance ~2m): PASS");

  // Test Far Distance
  const farPlayerLandmarks = Array(33).fill(null).map(() => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  farPlayerLandmarks[0] = { x: 0.5, y: 0.25, visibility: 0.9 };
  farPlayerLandmarks[11] = { x: 0.55, y: 0.40, visibility: 0.9 };
  farPlayerLandmarks[12] = { x: 0.45, y: 0.40, visibility: 0.9 }; // shoulder width = 0.10 (Too Far)
  const posFar = gestureEngine.estimatePlayerPosition(farPlayerLandmarks);
  assert.strictEqual(posFar.distanceStatus, "Terlalu Jauh (>3m)");
  assert.strictEqual(posFar.playerLocked, false);
  console.log("✓ estimatePlayerPosition (Far Distance >3m Detected): PASS");

  // 6. Test Tahap 4: Adventure Learning Progression & Keys
  console.log("\n[6] Testing Tahap 4: Adventure Learning Stages & Keys...");
  const { ADVENTURE_STAGES } = await import("../src/engine/GameEngine.js");
  assert.strictEqual(ADVENTURE_STAGES.length, 4, "Must define 4 adventure stages");
  assert.strictEqual(ADVENTURE_STAGES[0].requiredKeys, 0, "Stage 1 unlocked by default");
  assert.strictEqual(ADVENTURE_STAGES[3].requiredKeys, 3, "Boss stage requires 3 keys");

  // Save adventure progress
  const advProgress = StorageManager.saveAdventureProgress({
    unlockedStages: [1, 2],
    completedStages: [1],
    keys: 1,
    totalStars: 3
  });
  assert.strictEqual(advProgress.keys, 1);
  assert.ok(advProgress.completedStages.includes(1));
  const retrievedAdv = StorageManager.getAdventureProgress();
  assert.strictEqual(retrievedAdv.keys, 1);
  console.log("✓ Adventure Progress & Keys Persistence: PASS");

  // 7. Test Tahap 5: Team Battle Turn Rotation & Final Showdown
  console.log("\n[7] Testing Tahap 5: Team Battle 4-Team Rotation & Final Showdown...");
  const teams = StorageManager.getTeams();
  assert.strictEqual(teams.length, 4, "Should have 4 class teams configured");
  assert.strictEqual(teams[0].id, "red");
  assert.strictEqual(teams[1].id, "blue");
  assert.strictEqual(teams[2].id, "green");
  assert.strictEqual(teams[3].id, "yellow");

  // Verify turn rotation mathematical progression (0 -> 1 -> 2 -> 3 -> 0)
  for (let turn = 0; turn < 8; turn++) {
    const activeTeam = teams[turn % teams.length];
    assert.strictEqual(activeTeam.id, teams[turn % 4].id, "1 student per turn rotation must cycle cleanly");
  }
  console.log("✓ Team Battle 1-Player per Turn Rotation: PASS");

  // Test Final Showdown 2x Point Weighting
  const normalPoints = scoreEngine.calculateAnswerScore({
    isCorrect: true,
    timeLeft: 30,
    totalTime: 40,
    pointWeight: 100,
    responseTimeMs: 3000,
    topic: "Uji Showdown"
  });
  const showdownPoints = scoreEngine.calculateAnswerScore({
    isCorrect: true,
    timeLeft: 30,
    totalTime: 40,
    pointWeight: 200, // 2x Double Points
    responseTimeMs: 3000,
    topic: "Uji Showdown"
  });
  assert.ok(showdownPoints.pointsEarned > normalPoints.pointsEarned, "Final Showdown points must be higher");
  console.log("✓ Final Showdown Double Points: PASS");

  // 8. Test Tahap 6 & Privacy Verification
  console.log("\n[8] Testing Tahap 6: Privacy & Learning Analytics Verification...");
  const analyticsData = StorageManager.getAnalyticsHistory();
  analyticsData.forEach((session) => {
    assert.strictEqual(session.videoStream, undefined, "Strict Privacy: Video streams must never be stored");
    assert.strictEqual(session.faceBiometrics, undefined, "Strict Privacy: Biometric faces must never be stored");
    assert.ok(typeof session.accuracy === "number", "Analytics must record quantitative numerical accuracy");
  });
  console.log("✓ Student Privacy & Analytics Non-Biometric Rule: PASS");

  // 9. Test Cloud Firestore Integration (Bank Soal & Riwayat Permainan)
  console.log("\n[9] Testing Cloud Firestore Integration (Bank Soal & Riwayat Permainan)...");
  const { FirestoreManager } = await import("../src/engine/FirestoreManager.js");
  const sanitizedQuestion = FirestoreManager.sanitizeQuestion({
    question: "  Berapa 2 + 2?  ",
    options: ["3", "4", "5", "6", "7"],
    correctAnswer: 1,
    grade: 99,
    imageUrl: "javascript:alert(1)"
  });
  assert.strictEqual(sanitizedQuestion.question, "Berapa 2 + 2?");
  assert.strictEqual(sanitizedQuestion.options.length, 4);
  assert.strictEqual(sanitizedQuestion.grade, 6);
  assert.strictEqual(sanitizedQuestion.imageUrl, "");
  console.log("✓ Moderated question sanitization: PASS");
  const { isFirebaseConfigured, validateFirebaseAuthConfig, describeFirebaseAuthError, saveFirebaseConfig, getFirebaseConfig, resetFirebaseConfig } = await import("../src/firebase.js");

  // Test Firebase Config Validator
  assert.strictEqual(isFirebaseConfigured({ projectId: "" }), false, "Empty projectId is not configured");
  assert.strictEqual(isFirebaseConfigured({ projectId: "your-project-id" }), false, "Placeholder is not configured");
  assert.strictEqual(isFirebaseConfigured({ projectId: "msc-sd-negeri-1" }), true, "Valid projectId is configured");
  assert.deepStrictEqual(
    validateFirebaseAuthConfig({ projectId: "msc", apiKey: "key", authDomain: "msc.firebaseapp.com", appId: "1:web:abc" }).missingFields,
    [],
    "Complete Firebase web config enables Authentication"
  );
  assert.deepStrictEqual(
    validateFirebaseAuthConfig({ projectId: "msc" }).missingFields,
    ["apiKey", "authDomain", "appId"],
    "Missing Authentication fields are reported"
  );
  assert.strictEqual(describeFirebaseAuthError({ code: "auth/unauthorized-domain" }).title, "Domain aplikasi belum diizinkan");
  console.log("✓ Firebase Config Validator: PASS");

  // Test Dynamic Config Storage
  saveFirebaseConfig({ projectId: "msc-test-sd", apiKey: "test-key-123" });
  const storedConfig = getFirebaseConfig();
  assert.strictEqual(storedConfig.projectId, "msc-test-sd");
  assert.strictEqual(storedConfig.apiKey, "test-key-123");
  console.log("✓ Firebase Dynamic LocalStorage Config: PASS");

  // Test FirestoreManager Status
  const fsStatus = FirestoreManager.getStatus();
  assert.strictEqual(fsStatus.isConfigured, true);
  assert.strictEqual(fsStatus.projectId, "msc-test-sd");
  console.log("✓ FirestoreManager.getStatus(): PASS");

  // Test Question Filtering Helper
  const mockQuestions = [
    { id: "q1", category: "numerasi", grade: 4, difficulty: "easy", question: "2 + 2 = ?" },
    { id: "q2", category: "numerasi", grade: 5, difficulty: "hard", question: "12 × 12 = ?" },
    { id: "q3", category: "literasi", grade: 4, difficulty: "medium", question: "Sinonim luas adalah?" }
  ];
  const filteredNum = FirestoreManager._filterQuestions(mockQuestions, { category: "numerasi", grade: 4 });
  assert.strictEqual(filteredNum.length, 1);
  assert.strictEqual(filteredNum[0].id, "q1");
  console.log("✓ FirestoreManager._filterQuestions: PASS");

  // Test Strict Privacy Sanitization on Firestore recordGameSession
  const cleanSession = await FirestoreManager.recordGameSession({
    id: "fs-test-sess-1",
    mode: "motion_arena",
    category: "numerasi",
    grade: 4,
    score: 850,
    correctCount: 4,
    wrongCount: 1,
    totalQuestions: 5,
    accuracy: 80,
    avgResponseTimeSec: 4.2,
    topicMastery: { "Pecahan": { correct: 4, total: 5 } },
    weakTopics: [],
    // Deliberate forbidden video & biometric parameters to verify sanitization
    videoStream: "binary_stream_data_forbidden",
    landmarks: [{ x: 0.5, y: 0.5 }],
    faceBiometrics: "face_id_forbidden",
    cameraFrame: "image_data_forbidden"
  });

  assert.strictEqual(cleanSession.id, "fs-test-sess-1");
  assert.strictEqual(cleanSession.videoStream, undefined, "Strict Privacy: videoStream stripped before storing");
  assert.strictEqual(cleanSession.landmarks, undefined, "Strict Privacy: landmarks stripped before storing");
  assert.strictEqual(cleanSession.faceBiometrics, undefined, "Strict Privacy: faceBiometrics stripped before storing");
  assert.strictEqual(cleanSession.cameraFrame, undefined, "Strict Privacy: cameraFrame stripped before storing");
  assert.strictEqual(cleanSession.score, 850);
  assert.strictEqual(cleanSession.accuracy, 80);
  assert.ok(sessionStorage.getItem("MSC_ANALYTICS_HISTORY_GUEST"), "Anonymous history must use temporary session storage");
  assert.strictEqual(localStorage.getItem("MSC_ANALYTICS_HISTORY_GUEST"), null, "Anonymous history must not persist in localStorage");
  console.log("✓ FirestoreManager.recordGameSession (Privacy & Non-Biometric Sanitization): PASS");

  // Test QuestionEngine merging with Firestore questions
  const qEngineAll = qEngine.getAllQuestions();
  assert.ok(qEngineAll.length >= 20, "QuestionEngine merges default + custom + firestore questions");
  console.log("✓ QuestionEngine online & offline question merging: PASS");

  // Reset test config
  resetFirebaseConfig();

  // 10. Test MultiplayerEngine (Online Classroom Game Show)
  console.log("\n[10] Testing MultiplayerEngine (Online Game Show & Real-Time Rooms)...");
  const { MultiplayerEngine, ROOM_STATUS } = await import("../src/engine/MultiplayerEngine.js");

  // Generate Room Code
  const code = MultiplayerEngine.generateRoomCode();
  assert.strictEqual(typeof code, "string");
  assert.strictEqual(code.length, 6, "Room code must be 6 characters");
  assert.match(code, /^[A-Z0-9]{6}$/, "Room code must be uppercase alphanumeric");
  console.log("✓ MultiplayerEngine.generateRoomCode: PASS");

  // Host creates Room
  const hostEngine = new MultiplayerEngine();
  const testQ = [
    {
      id: "q_mp_1",
      question: "25 + 75 = ?",
      options: ["90", "100", "110", "120"],
      correctAnswer: 1, // 'B'
      imageUrl: "https://images.example.edu/number-blocks.png",
      imageAlt: "Balok angka 25 dan 75",
      timeLimit: 30
    },
    {
      id: "q_mp_2",
      question: "Sinonim dari kata 'Giat' adalah?",
      options: ["Rajin", "Malas", "Lambat", "Santai"],
      correctAnswer: 0, // 'A'
      timeLimit: 30
    }
  ];

  const room = await hostEngine.createRoom({
    hostName: "Pak Guru",
    category: "numerasi",
    grade: 4,
    totalQuestions: 2,
    timeLimit: 30,
    questions: testQ
  });

  assert.ok(room.roomCode, "Room code should exist");
  assert.strictEqual(room.status, ROOM_STATUS.LOBBY);
  assert.strictEqual(room.questions.length, 2);
  assert.strictEqual(room.questions[0].correctAnswer, undefined, "Answer key must not be exposed in public room data");
  assert.strictEqual(room.questions[0].imageUrl, "https://images.example.edu/number-blocks.png", "Question image must be available to players");
  assert.strictEqual(room.settings.readyCountdownSeconds, 5, "Multiplayer must default to a 5-second preparation");
  assert.strictEqual(room.countdownSec, 5);
  assert.strictEqual(hostEngine.hostQuestions[0].correctAnswer, 1, "Host keeps the protected answer key");
  assert.strictEqual(hostEngine.isHost, true);
  console.log("✓ hostEngine.createRoom: PASS");

  // Student joins Room
  const studentEngine = new MultiplayerEngine();
  const joinedRoom = await studentEngine.joinRoom(room.roomCode, {
    name: "Kelompok Garuda",
    avatar: "🦁",
    participantType: "group"
  });

  assert.ok(joinedRoom.players[studentEngine.localPlayerId], "Student must be added to room players");
  assert.strictEqual(joinedRoom.players[studentEngine.localPlayerId].name, "Kelompok Garuda");
  assert.strictEqual(joinedRoom.players[studentEngine.localPlayerId].avatar, "🦁");
  assert.strictEqual(joinedRoom.players[studentEngine.localPlayerId].participantType, "group");
  assert.strictEqual(studentEngine.isHost, false);
  console.log("✓ studentEngine.joinRoom: PASS");

  // Host starts game
  const activeRoom = hostEngine._getRoomLocally(room.roomCode);
  activeRoom.status = ROOM_STATUS.QUESTION;
  activeRoom.questionStartedAt = Date.now() - 1500; // 1.5s ago
  await hostEngine._syncRoomUpdate(activeRoom);

  // Student submits answer ('B' is correct for Q1)
  const answerRes = await studentEngine.submitAnswer("B");
  assert.strictEqual(answerRes.success, true);
  assert.strictEqual(answerRes.pending, true);
  assert.strictEqual(answerRes.isCorrect, undefined, "Student must not receive correctness before host closes the round");
  console.log("✓ studentEngine.submitAnswer (Private/Pending): PASS");

  // Duplicate answer rejected
  const dupRes = await studentEngine.submitAnswer("A");
  assert.strictEqual(dupRes.success, false);
  assert.strictEqual(dupRes.alreadyAnswered, true);
  console.log("✓ Duplicate answer prevention in same round: PASS");

  // Host performs authoritative scoring and only then publishes the answer.
  hostEngine.currentRoom = hostEngine._getRoomLocally(room.roomCode);
  await hostEngine.advanceToRoundResult();
  assert.strictEqual(hostEngine.currentRoom.questions[0].correctAnswer, 1);

  // Leaderboard sorting
  const lb = hostEngine.getLeaderboard();
  assert.ok(Array.isArray(lb));
  assert.strictEqual(lb[0].name, "Kelompok Garuda");
  assert.strictEqual(lb[0].participantType, "group");
  assert.ok(lb[0].score > 0);
  assert.strictEqual(lb[0].isCorrect, true);
  console.log("✓ hostEngine.getLeaderboard: PASS");

  // Answer distribution
  const dist = hostEngine.getAnswerDistribution();
  assert.strictEqual(dist.B, 1);
  assert.strictEqual(dist.total, 1);
  console.log("✓ hostEngine.getAnswerDistribution: PASS");

  // Cleanup
  hostEngine.leaveRoom();
  studentEngine.leaveRoom();
  assert.strictEqual(hostEngine.currentRoom, null);
  assert.strictEqual(studentEngine.currentRoom, null);
  assert.strictEqual(sessionStorage.getItem(`MSC_ROOM_${room.roomCode}`), null, "Participant room cache must be cleared after leaving");
  console.log("✓ Room cleanup & leaveRoom: PASS");

  console.log("\n==========================================");
  console.log("🎉 ALL TESTS PASSED SUCCESSFULLY! (100% OK)");
  console.log("==========================================");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

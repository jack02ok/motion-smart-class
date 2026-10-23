/**
 * MOTION SMART CLASS - Gesture Engine
 * Identifies body gestures from pose landmarks with debouncing, hold confirmation, and cooldown.
 *
 * Gestures:
 * - GESTURE A: Left hand raised above shoulder
 * - GESTURE B: Right hand raised above shoulder
 * - GESTURE C: Both hands raised above shoulders
 * - GESTURE D: Squatting position
 * - SKIP: Both arms stretched horizontally sideways
 * - READY: Upright neutral stance held steady
 * - BONUS: Both hands clasped/held high above head
 */

export const GESTURE_TYPES = {
  NONE: "NONE",
  A: "LEFT_HAND",     // Option A / Tangan Kiri
  B: "RIGHT_HAND",    // Option B / Tangan Kanan
  C: "BOTH_HANDS",    // Option C / Kedua Tangan
  D: "SQUAT",         // Option D / Jongkok
  SKIP: "SKIP",       // Skip soal
  READY: "READY",     // Berdiri siap
  BONUS: "BONUS"      // Bonus poin
};

export const GESTURE_LABELS = {
  [GESTURE_TYPES.NONE]: "Menunggu Gerakan...",
  [GESTURE_TYPES.A]: "✋ Tangan Kiri Terangkat (A)",
  [GESTURE_TYPES.B]: "✋ Tangan Kanan Terangkat (B)",
  [GESTURE_TYPES.C]: "🙌 Kedua Tangan Terangkat (C)",
  [GESTURE_TYPES.D]: "🧍‍♂️➡️🧘 Posisi Jongkok (D)",
  [GESTURE_TYPES.SKIP]: "↔️ Rentangkan Tangan (SKIP)",
  [GESTURE_TYPES.READY]: "🧍 Siap Bermain (READY)",
  [GESTURE_TYPES.BONUS]: "✨ Tangan Di Atas Kepala (BONUS!)"
};

export class GestureEngine {
  constructor({
    confidenceThreshold = 0.55,
    holdDurationMs = 450,
    cooldownMs = 1200,
    onGestureConfirmed = null,
    onGestureProgress = null
  } = {}) {
    this.confidenceThreshold = confidenceThreshold;
    this.holdDurationMs = holdDurationMs;
    this.cooldownMs = cooldownMs;
    this.onGestureConfirmed = onGestureConfirmed;
    this.onGestureProgress = onGestureProgress;

    this.currentGesture = GESTURE_TYPES.NONE;
    this.gestureConfidence = 0;
    this.holdStartTime = null;
    this.lastTriggeredTime = 0;
    this.isCoolingDown = false;
    this.movementProfile = "standard";

    // Upright baseline for squat detection
    this.baselineNoseY = null;
    this.baselineHipY = null;
    this.calibrationSamples = 0;
  }

  setThresholds({ confidence, holdMs, cooldownMs }) {
    if (confidence) this.confidenceThreshold = confidence;
    if (holdMs) this.holdDurationMs = holdMs;
    if (cooldownMs) this.cooldownMs = cooldownMs;
  }

  setMovementProfile(profile) {
    this.movementProfile = profile === "hands_only" ? "hands_only" : "standard";
  }

  reset() {
    this.currentGesture = GESTURE_TYPES.NONE;
    this.gestureConfidence = 0;
    this.holdStartTime = null;
    if (this.onGestureProgress) this.onGestureProgress(0, GESTURE_TYPES.NONE);
  }

  processLandmarks(landmarks) {
    const now = performance.now();

    // Cooldown check
    if (now - this.lastTriggeredTime < this.cooldownMs) {
      this.isCoolingDown = true;
      const cooldownProgress = (now - this.lastTriggeredTime) / this.cooldownMs;
      return {
        gesture: GESTURE_TYPES.NONE,
        label: "⏳ Cooldown...",
        confidence: 0,
        isCoolingDown: true,
        cooldownProgress
      };
    }
    this.isCoolingDown = false;

    if (!landmarks || landmarks.length < 25) {
      this.reset();
      return {
        gesture: GESTURE_TYPES.NONE,
        label: GESTURE_LABELS[GESTURE_TYPES.NONE],
        confidence: 0,
        isCoolingDown: false
      };
    }

    const detected = this.classifyPose(landmarks);
    const gesture = detected.gesture;
    const confidence = detected.confidence;

    // Check gesture stability & hold progress
    if (gesture !== GESTURE_TYPES.NONE && confidence >= this.confidenceThreshold) {
      if (this.currentGesture !== gesture) {
        this.currentGesture = gesture;
        this.gestureConfidence = confidence;
        this.holdStartTime = now;
      }

      const elapsed = now - this.holdStartTime;
      const progress = Math.min(1.0, elapsed / this.holdDurationMs);

      if (this.onGestureProgress) {
        this.onGestureProgress(progress, gesture);
      }

      if (progress >= 1.0) {
        this.lastTriggeredTime = now;
        this.holdStartTime = null;

        if (this.onGestureConfirmed) {
          this.onGestureConfirmed(gesture, confidence);
        }

        return {
          gesture,
          label: GESTURE_LABELS[gesture] || gesture,
          confidence,
          confirmed: true,
          isCoolingDown: true
        };
      }

      return {
        gesture,
        label: GESTURE_LABELS[gesture] || gesture,
        confidence,
        holdProgress: progress,
        confirmed: false,
        isCoolingDown: false
      };
    } else {
      this.reset();
      return {
        gesture: GESTURE_TYPES.NONE,
        label: GESTURE_LABELS[GESTURE_TYPES.NONE],
        confidence: 0,
        isCoolingDown: false
      };
    }
  }

  classifyPose(landmarks) {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    // Check basic presence
    if (!nose || !leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
      return { gesture: GESTURE_TYPES.NONE, confidence: 0 };
    }

    // Y coordinates in canvas: 0 is top, 1 is bottom.
    // Raised hand means wrist.y < shoulder.y (smaller value = higher up).
    const shoulderAvgY = (leftShoulder.y + rightShoulder.y) / 2;
    const shoulderHeight = Math.abs(leftShoulder.y - (leftHip ? leftHip.y : 0.65)) || 0.35;
    const elevationBuffer = shoulderHeight * 0.15; // Requires wrist to be clearly above shoulder

    const isLeftHandUp = leftWrist.y < leftShoulder.y - elevationBuffer;
    const isRightHandUp = rightWrist.y < rightShoulder.y - elevationBuffer;

    // Both hands above head (BONUS gesture)
    const isBothHandsAboveHead =
      leftWrist.y < nose.y - 0.05 &&
      rightWrist.y < nose.y - 0.05 &&
      Math.abs(leftWrist.x - rightWrist.x) < 0.22;

    if (isBothHandsAboveHead) {
      return { gesture: GESTURE_TYPES.BONUS, confidence: 0.9 };
    }

    // Both hands raised (GESTURE C)
    if (isLeftHandUp && isRightHandUp) {
      return { gesture: GESTURE_TYPES.C, confidence: 0.88 };
    }

    // Only Left hand raised (GESTURE A)
    if (isLeftHandUp && !isRightHandUp) {
      return { gesture: GESTURE_TYPES.A, confidence: 0.85 };
    }

    // Only Right hand raised (GESTURE B)
    if (isRightHandUp && !isLeftHandUp) {
      return { gesture: GESTURE_TYPES.B, confidence: 0.85 };
    }

    // Arms stretched wide sideways (SKIP gesture)
    const armSpan = Math.abs(leftWrist.x - rightWrist.x);
    const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x);
    const leftArmHorizontal = Math.abs(leftWrist.y - leftShoulder.y) < 0.12;
    const rightArmHorizontal = Math.abs(rightWrist.y - rightShoulder.y) < 0.12;
    if (armSpan > shoulderSpan * 2.2 && leftArmHorizontal && rightArmHorizontal) {
      return { gesture: GESTURE_TYPES.SKIP, confidence: 0.85 };
    }

    // Accessible alternative for option D: wrists crossed near opposite shoulders.
    if (this.movementProfile === "hands_only") {
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const crossedAtChest = distance(leftWrist, rightShoulder) < 0.24 && distance(rightWrist, leftShoulder) < 0.24;
      if (crossedAtChest) return { gesture: GESTURE_TYPES.D, confidence: 0.86 };
    }

    // Squatting position (GESTURE D)
    // 1. Knee flexion: if knees and hips are visible, distance between hip and knee is compressed
    // 2. Relative lowering: nose and hips drop significantly relative to canvas height
    let isSquatting = false;
    let squatConfidence = 0.75;

    if (leftHip && rightHip && leftKnee && rightKnee) {
      const hipY = (leftHip.y + rightHip.y) / 2;
      const kneeY = (leftKnee.y + rightKnee.y) / 2;
      const hipKneeDist = Math.abs(kneeY - hipY);
      // In upright standing, hip-knee distance is ~0.25 - 0.35. When squatting, it compresses to < 0.16
      if (hipKneeDist < 0.16 && kneeY > hipY) {
        isSquatting = true;
        squatConfidence = 0.86;
      }
    }

    // Adaptive fallback for camera framed tightly on upper body:
    // If nose drops below 0.48 or hip drops significantly
    if (!isSquatting && nose.y > 0.46) {
      isSquatting = true;
      squatConfidence = 0.78;
    }

    if (isSquatting && this.movementProfile !== "hands_only") {
      return { gesture: GESTURE_TYPES.D, confidence: squatConfidence };
    }

    // Upright ready stance
    if (
      !isLeftHandUp &&
      !isRightHandUp &&
      nose.y >= 0.15 &&
      nose.y <= 0.40 &&
      Math.abs(leftShoulder.y - rightShoulder.y) < 0.08
    ) {
      return { gesture: GESTURE_TYPES.READY, confidence: 0.8 };
    }

    return { gesture: GESTURE_TYPES.NONE, confidence: 0 };
  }

  // ==========================================
  // TAHAP 3: MOTION ARENA ZONE CLASSIFICATION
  // ==========================================
  classifyArenaZone(landmarks) {
    if (!landmarks || landmarks.length < 17) {
      return { zone: null, confidence: 0 };
    }

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) {
      return { zone: null, confidence: 0 };
    }

    // In mirrored canvas (user looks as if in a mirror):
    // Left hand in canvas coordinate is right side of screen (x > 0.55)
    // Right hand in canvas coordinate is left side of screen (x < 0.45)
    // Zone A: Top-Left (User's left upper quadrant) -> leftWrist.x > 0.55 && leftWrist.y < 0.48
    // Zone B: Top-Right (User's right upper quadrant) -> rightWrist.x < 0.45 && rightWrist.y < 0.48
    // Zone C: Bottom-Left (User's left lower quadrant) -> leftWrist.x > 0.55 && leftWrist.y >= 0.48
    // Zone D: Bottom-Right (User's right lower quadrant) -> rightWrist.x < 0.45 && rightWrist.y >= 0.48

    const isLeftHandActive = leftWrist.visibility === undefined || leftWrist.visibility > 0.4;
    const isRightHandActive = rightWrist.visibility === undefined || rightWrist.visibility > 0.4;

    // Check elevated reach into Zone A (Left Upper)
    if (isLeftHandActive && leftWrist.y < leftShoulder.y - 0.05 && !isRightHandActive) {
      return { zone: "A", gesture: GESTURE_TYPES.A, confidence: 0.88 };
    }

    // Check elevated reach into Zone B (Right Upper)
    if (isRightHandActive && rightWrist.y < rightShoulder.y - 0.05 && !isLeftHandActive) {
      return { zone: "B", gesture: GESTURE_TYPES.B, confidence: 0.88 };
    }

    // Both hands up -> Zone C
    if (isLeftHandActive && isRightHandActive && leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y) {
      return { zone: "C", gesture: GESTURE_TYPES.C, confidence: 0.90 };
    }

    // Squat -> Zone D
    const standardClass = this.classifyPose(landmarks);
    if (standardClass.gesture === GESTURE_TYPES.D) {
      return { zone: "D", gesture: GESTURE_TYPES.D, confidence: standardClass.confidence };
    }

    // Spatial Reach mapping
    if (leftWrist.y < 0.40) {
      return { zone: "A", gesture: GESTURE_TYPES.A, confidence: 0.85 };
    }
    if (rightWrist.y < 0.40) {
      return { zone: "B", gesture: GESTURE_TYPES.B, confidence: 0.85 };
    }

    return { zone: null, gesture: GESTURE_TYPES.NONE, confidence: 0 };
  }

  estimatePlayerPosition(landmarks) {
    if (!landmarks || landmarks.length < 13) {
      return {
        playerLocked: false,
        isDistanceIdeal: false,
        distanceStatus: "Menunggu Siswa...",
        centerX: 0.5,
        shoulderWidth: 0,
        lateralPosition: "Tengah",
        lightingQuality: "Menunggu Kamera"
      };
    }

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    if (!leftShoulder || !rightShoulder) {
      return {
        playerLocked: false,
        isDistanceIdeal: false,
        distanceStatus: "Mencari Posisi...",
        centerX: 0.5,
        shoulderWidth: 0,
        lateralPosition: "Tengah",
        lightingQuality: "Mencari Rangka"
      };
    }

    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
    const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);

    let distanceStatus = "Ideal (~1.5–2.5m)";
    let isDistanceIdeal = true;
    if (shoulderWidth < 0.16) {
      distanceStatus = "Terlalu Jauh (>3m)";
      isDistanceIdeal = false;
    } else if (shoulderWidth > 0.46) {
      distanceStatus = "Terlalu Dekat (<1.2m)";
      isDistanceIdeal = false;
    }

    let lateralPosition = "Tengah (Ideal)";
    if (centerX < 0.35) {
      lateralPosition = "Geser ke Kanan Layar";
    } else if (centerX > 0.65) {
      lateralPosition = "Geser ke Kiri Layar";
    }

    // Evaluate visibility/confidence as indicator for camera lighting & silhouette clarity
    const visibilities = [nose, leftShoulder, rightShoulder, leftHip, rightHip]
      .filter(Boolean)
      .map((lm) => (typeof lm.visibility === "number" ? lm.visibility : 0.8));
    const avgVis = visibilities.reduce((a, b) => a + b, 0) / (visibilities.length || 1);
    const lightingQuality = avgVis >= 0.65 ? "Optimal 💡" : "Redup / Kurang Kontras ⚠️";

    const playerLocked = centerX >= 0.28 && centerX <= 0.72 && isDistanceIdeal && avgVis >= 0.5;

    return {
      playerLocked,
      isDistanceIdeal,
      distanceStatus,
      centerX: parseFloat(centerX.toFixed(2)),
      shoulderWidth: parseFloat(shoulderWidth.toFixed(2)),
      lateralPosition,
      lightingQuality,
      confidence: parseFloat(avgVis.toFixed(2))
    };
  }
}


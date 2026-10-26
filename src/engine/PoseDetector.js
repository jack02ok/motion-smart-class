/**
 * MOTION SMART CLASS - Pose Detector
 * High-performance browser pose estimation with MediaPipe Pose.
 * Features:
 * - Real MediaPipe Pose model integration
 * - Adaptive frame skip for smooth 30+ FPS on Android / Chromebook / PID
 * - Real-time skeleton & keypoint drawing on Canvas
 * - Calibration metrics (Head, Shoulders, Hands, Body, Ideal Position)
 * - Built-in fallback motion heuristics for offline resilience
 */

export function smoothPoseLandmarks(previous, current) {
  if (!Array.isArray(current)) return null;
  if (!Array.isArray(previous) || previous.length !== current.length) {
    return current.map((point) => point ? { ...point } : point);
  }

  return current.map((point, index) => {
    const prior = previous[index];
    if (!point || !prior) return point ? { ...point } : point;
    const visibility = Number.isFinite(point.visibility) ? point.visibility : 0.8;
    if (visibility < 0.35) return { ...point };
    const alpha = index === 15 || index === 16 ? 0.72 : 0.55;
    return {
      ...point,
      x: prior.x + ((point.x - prior.x) * alpha),
      y: prior.y + ((point.y - prior.y) * alpha),
      z: Number.isFinite(point.z) && Number.isFinite(prior.z) ? prior.z + ((point.z - prior.z) * alpha) : point.z
    };
  });
}

export class PoseDetector {
  constructor() {
    this.pose = null;
    this.isModelLoaded = false;
    this.isDetecting = false;
    this.videoElement = null;
    this.canvasElement = null;
    this.canvasCtx = null;
    this.onResultsCallback = null;

    // Performance & throttle tracking
    this.lastFrameTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.fpsTimer = performance.now();
    this.minInferenceIntervalMs = 45; // ~22 inference FPS max, UI runs at 60 FPS
    this.lastInferenceTime = 0;
    this.isProcessingFrame = false;
    this.loopToken = 0;

    // Latest landmarks
    this.latestLandmarks = null;
    this.poseConfidence = 0;

    // Settings
    this.showSkeleton = true;

    // Optical fallback helper
    this.prevFrameData = null;
    this.fallbackCanvas = null;
    this.fallbackCtx = null;
  }

  async loadModel() {
    if (this.isModelLoaded && this.pose) return true;

    try {
      // Check if MediaPipe Pose is already in window
      if (typeof window.Pose === "undefined") {
        await this.loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js");
      }

      if (typeof window.Pose !== "undefined") {
        this.pose = new window.Pose({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
          }
        });

        this.pose.setOptions({
          modelComplexity: 0, // Lite model for speed on tablets & interactive boards
          smoothLandmarks: true,
          enableSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        this.pose.onResults((results) => {
          this.handleResults(results);
        });

        this.isModelLoaded = true;
        console.log("MediaPipe Pose initialized successfully.");
        return true;
      }
    } catch (err) {
      console.warn("MediaPipe Pose CDN load failed or offline, enabling high-speed optical posture fallback:", err);
    }

    // Fallback mode enabled
    this.initOpticalFallback();
    this.isModelLoaded = true;
    return true;
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        return resolve();
      }
      const script = document.createElement("script");
      script.src = src;
      script.crossOrigin = "anonymous";
      script.onload = () => resolve();
      script.onerror = (e) => reject(e);
      document.head.appendChild(script);
    });
  }

  initOpticalFallback() {
    this.fallbackCanvas = document.createElement("canvas");
    this.fallbackCanvas.width = 160;
    this.fallbackCanvas.height = 120;
    this.fallbackCtx = this.fallbackCanvas.getContext("2d", { willReadFrequently: true });
  }

  startDetection({ videoElement, canvasElement, onResults }) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.canvasCtx = canvasElement ? canvasElement.getContext("2d") : null;
    this.onResultsCallback = onResults;
    this.isDetecting = true;
    this.lastFrameTime = performance.now();
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.prevFrameData = null;
    const loopToken = ++this.loopToken;
    this.runLoop(loopToken);
  }

  stopDetection() {
    this.isDetecting = false;
    this.loopToken += 1;
    this.latestLandmarks = null;
    this.prevFrameData = null;
    if (this.canvasCtx && this.canvasElement) {
      this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    }
  }

  runLoop(loopToken) {
    if (!this.isDetecting || loopToken !== this.loopToken) return;

    const now = performance.now();
    this.frameCount++;
    if (now - this.fpsTimer >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;
    }

    if (
      this.videoElement &&
      this.videoElement.readyState >= 2 &&
      !this.videoElement.paused &&
      !this.isProcessingFrame
    ) {
      // Match canvas dimensions to video
      if (this.canvasElement) {
        if (this.canvasElement.width !== this.videoElement.videoWidth && this.videoElement.videoWidth > 0) {
          this.canvasElement.width = this.videoElement.videoWidth;
          this.canvasElement.height = this.videoElement.videoHeight;
        }
      }

      // Check throttle interval
      if (now - this.lastInferenceTime >= this.minInferenceIntervalMs) {
        this.lastInferenceTime = now;
        this.isProcessingFrame = true;

        if (this.pose) {
          const inferenceStartedAt = performance.now();
          this.pose
            .send({ image: this.videoElement })
            .catch((err) => {
              console.warn("Pose send frame error:", err);
            })
            .finally(() => {
              const inferenceDuration = performance.now() - inferenceStartedAt;
              const targetInterval = inferenceDuration > 80 ? 80 : inferenceDuration > 55 ? 60 : 42;
              this.minInferenceIntervalMs += (targetInterval - this.minInferenceIntervalMs) * 0.2;
              // A restarted loop waits for the previous MediaPipe inference to finish,
              // preventing two sends from racing on the same graph.
              this.isProcessingFrame = false;
            });
        } else {
          // Process optical posture fallback
          this.processOpticalFrame();
          this.isProcessingFrame = false;
        }
      }
    }

    // Always keep UI responsive
    requestAnimationFrame(() => this.runLoop(loopToken));
  }

  handleResults(results) {
    if (!this.isDetecting) return;

    const rawLandmarks = Array.isArray(results.poseLandmarks) && results.poseLandmarks.length >= 25
      ? results.poseLandmarks
      : null;
    const landmarks = rawLandmarks ? smoothPoseLandmarks(this.latestLandmarks, rawLandmarks) : null;
    this.latestLandmarks = landmarks;

    if (landmarks && landmarks.length > 0) {
      // Calculate average confidence from key upper body landmarks
      const keyIndices = [0, 11, 12, 13, 14, 15, 16, 23, 24];
      let confSum = 0;
      let count = 0;
      keyIndices.forEach((idx) => {
        if (landmarks[idx] && typeof landmarks[idx].visibility === "number") {
          confSum += landmarks[idx].visibility;
          count++;
        }
      });
      this.poseConfidence = count > 0 ? confSum / count : 0.8;
    } else {
      this.poseConfidence = 0;
    }

    // Render skeleton overlay
    this.drawSkeleton(landmarks);

    // Calibration checklist
    const calibration = this.checkCalibration(landmarks);

    if (this.onResultsCallback) {
      this.onResultsCallback({
        landmarks,
        poseConfidence: this.poseConfidence,
        fps: this.fps,
        calibration
      });
    }
  }

  // Fallback optical heuristic when MediaPipe is offline
  processOpticalFrame() {
    if (!this.fallbackCtx || !this.videoElement) return;

    const w = 160;
    const h = 120;
    this.fallbackCtx.drawImage(this.videoElement, 0, 0, w, h);
    const frame = this.fallbackCtx.getImageData(0, 0, w, h);
    const data = frame.data;

    let leftUpperMotion = 0;
    let rightUpperMotion = 0;
    let centerMotion = 0;
    let lowerMotion = 0;

    if (this.prevFrameData) {
      const prev = this.prevFrameData;
      for (let y = 0; y < h; y += 4) {
        for (let x = 0; x < w; x += 4) {
          const idx = (y * w + x) * 4;
          const diff = Math.abs(data[idx] - prev[idx]) + Math.abs(data[idx + 1] - prev[idx + 1]);
          if (diff > 45) {
            // Note: Camera is mirrored for user
            if (y < h * 0.45) {
              if (x > w * 0.55) leftUpperMotion++;
              else if (x < w * 0.45) rightUpperMotion++;
              else centerMotion++;
            } else if (y > h * 0.6) {
              lowerMotion++;
            }
          }
        }
      }
    }
    this.prevFrameData = new Uint8ClampedArray(data);

    // Synthesize approximate landmarks for fallback responsiveness
    const synthetic = Array(33).fill(null).map((_, i) => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.7
    }));

    // Nose
    synthetic[0] = { x: 0.5, y: 0.28, z: 0, visibility: 0.85 };
    // Shoulders
    synthetic[11] = { x: 0.62, y: 0.42, z: 0, visibility: 0.85 }; // Left shoulder
    synthetic[12] = { x: 0.38, y: 0.42, z: 0, visibility: 0.85 }; // Right shoulder

    // Simulate wrists based on upper motion
    if (leftUpperMotion > 40) {
      synthetic[15] = { x: 0.72, y: 0.22, z: 0, visibility: 0.9 }; // Left wrist UP
    } else {
      synthetic[15] = { x: 0.70, y: 0.58, z: 0, visibility: 0.85 };
    }

    if (rightUpperMotion > 40) {
      synthetic[16] = { x: 0.28, y: 0.22, z: 0, visibility: 0.9 }; // Right wrist UP
    } else {
      synthetic[16] = { x: 0.30, y: 0.58, z: 0, visibility: 0.85 };
    }

    // Hips
    const squatOffset = lowerMotion > 60 ? 0.15 : 0;
    synthetic[23] = { x: 0.58, y: 0.68 + squatOffset, z: 0, visibility: 0.8 };
    synthetic[24] = { x: 0.42, y: 0.68 + squatOffset, z: 0, visibility: 0.8 };

    this.handleResults({ poseLandmarks: synthetic });
  }

  checkCalibration(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      return {
        head: false,
        shoulders: false,
        hands: false,
        body: false,
        idealPosition: false,
        allReady: false
      };
    }

    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];

    const vThreshold = 0.45;

    const head = !!(nose && (nose.visibility === undefined || nose.visibility > vThreshold));
    const shoulders = !!(
      leftShoulder &&
      rightShoulder &&
      (leftShoulder.visibility === undefined || leftShoulder.visibility > vThreshold) &&
      (rightShoulder.visibility === undefined || rightShoulder.visibility > vThreshold)
    );
    const hands = !!(
      leftWrist &&
      rightWrist &&
      (leftWrist.visibility === undefined || leftWrist.visibility > vThreshold) &&
      (rightWrist.visibility === undefined || rightWrist.visibility > vThreshold)
    );
    const body = !!(
      leftHip &&
      rightHip &&
      (leftHip.visibility === undefined || leftHip.visibility > vThreshold) &&
      (rightHip.visibility === undefined || rightHip.visibility > vThreshold)
    );

    // Ideal position: nose should be vertically in upper half (0.15 - 0.45)
    // and horizontally centered (0.30 - 0.70)
    let idealPosition = false;
    if (nose && shoulders) {
      const centerX = (leftShoulder.x + rightShoulder.x) / 2;
      const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
      idealPosition =
        centerX >= 0.28 &&
        centerX <= 0.72 &&
        nose.y >= 0.10 &&
        nose.y <= 0.50 &&
        shoulderWidth >= 0.12 &&
        shoulderWidth <= 0.55;
    }

    const allReady = head && shoulders && hands && body && idealPosition;

    return {
      head,
      shoulders,
      hands,
      body,
      idealPosition,
      allReady
    };
  }

  drawSkeleton(landmarks) {
    if (!this.canvasCtx || !this.canvasElement) return;

    const ctx = this.canvasCtx;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;

    ctx.clearRect(0, 0, w, h);

    if (!landmarks || !this.showSkeleton) return;

    // Connectors definition
    const connections = [
      // Torso
      [11, 12],
      [11, 23],
      [12, 24],
      [23, 24],
      // Left arm
      [11, 13],
      [13, 15],
      // Right arm
      [12, 14],
      [14, 16],
      // Left leg
      [23, 25],
      [25, 27],
      // Right leg
      [24, 26],
      [26, 28]
    ];

    ctx.save();
    // Mirror drawing for natural selfie camera experience
    ctx.translate(w, 0);
    ctx.scale(-1, 1);

    // Draw glowing bones
    connections.forEach(([startIdx, endIdx]) => {
      const p1 = landmarks[startIdx];
      const p2 = landmarks[endIdx];

      if (
        p1 &&
        p2 &&
        (p1.visibility === undefined || p1.visibility > 0.4) &&
        (p2.visibility === undefined || p2.visibility > 0.4)
      ) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.lineWidth = 4;
        ctx.strokeStyle = "rgba(59, 130, 246, 0.85)"; // Vibrant blue
        ctx.shadowColor = "rgba(59, 130, 246, 0.6)";
        ctx.shadowBlur = 8;
        ctx.stroke();
      }
    });

    // Draw joints
    landmarks.forEach((p, idx) => {
      if (!p || (p.visibility !== undefined && p.visibility < 0.4)) return;

      const px = p.x * w;
      const py = p.y * h;

      ctx.beginPath();
      let radius = 5;
      let color = "#38BDF8";

      // Highlight wrists & nose with distinct colors
      if (idx === 15 || idx === 16) {
        // Wrists
        radius = 9;
        color = "#F59E0B"; // Amber gold
      } else if (idx === 0) {
        // Head
        radius = 7;
        color = "#EC4899"; // Pink
      }

      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
    });

    ctx.restore();
  }
}

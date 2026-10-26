/**
 * MOTION SMART CLASS - Camera Manager
 * Manages webcam streams, permissions, status indicators, and touch fallbacks.
 * Privacy-first: No video frames are ever uploaded or saved.
 */

export const CAMERA_STATUS = {
  OFF: "OFF",             // 🔴 CAMERA OFF
  CONNECTING: "CONNECTING", // 🟡 DETECTING...
  READY: "READY",         // 🟢 CAMERA READY
  ERROR: "ERROR"          // ⚠️ CAMERA ERROR
};

export function getCameraConstraintPlans(facingMode = "user") {
  return [
    {
      name: "classroom",
      constraints: {
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        }
      }
    },
    {
      name: "compatible",
      constraints: { audio: false, video: true }
    }
  ];
}

export function describeCameraError(error, context = {}) {
  const name = error?.name || error?.code || "UnknownError";
  const isSecure = context.isSecureContext !== false;
  const isEmbedded = Boolean(context.isEmbedded);
  const details = {
    code: name,
    title: "Kamera tidak dapat digunakan",
    message: "Browser atau perangkat PID tidak dapat membuka kamera.",
    action: "Tutup aplikasi kamera lain, lalu tekan Coba Lagi.",
    canRetry: true
  };

  if (!isSecure || name === "InsecureContextError") {
    return {
      ...details,
      code: "InsecureContextError",
      title: "Kamera memerlukan koneksi aman",
      message: "Halaman ini tidak dibuka melalui HTTPS.",
      action: "Buka alamat HTTPS aplikasi secara langsung di Chrome atau Edge.",
      canRetry: false
    };
  }
  if (name === "UnsupportedError" || name === "TypeError") {
    return {
      ...details,
      title: "Browser PID tidak mendukung akses kamera",
      message: "Web Camera API tidak tersedia pada browser atau WebView ini.",
      action: "Gunakan Chrome atau Edge terbaru, bukan browser bawaan/launcher PID.",
      canRetry: false
    };
  }
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return {
      ...details,
      title: isEmbedded ? "Akses kamera diblokir oleh halaman induk" : "Izin kamera belum dapat digunakan",
      message: isEmbedded
        ? "Aplikasi dibuka di dalam iframe yang tidak memberikan izin kamera."
        : "Izin dapat ditolak oleh browser, kebijakan perangkat, atau toolbar overlay PID.",
      action: isEmbedded
        ? "Buka aplikasi secara langsung atau tambahkan allow=\"camera\" pada iframe."
        : "Tutup toolbar anotasi/floating overlay, reset izin situs, lalu coba lagi.",
      canRetry: true
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      ...details,
      title: "Kamera tidak ditemukan",
      message: "Browser tidak menemukan kamera internal maupun kamera USB.",
      action: "Periksa sambungan kamera dan pastikan Camera Access pada PID aktif.",
      canRetry: true
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      ...details,
      title: "Kamera sedang dipakai atau diblokir",
      message: "Perangkat terdeteksi, tetapi stream kamera tidak dapat dimulai.",
      action: "Tutup aplikasi kamera, meeting, screen recorder, dan whiteboard lain; lalu coba lagi.",
      canRetry: true
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      ...details,
      title: "Format kamera PID tidak kompatibel",
      message: "Driver kamera menolak resolusi atau frame rate yang diminta.",
      action: "Aplikasi telah mencoba mode kompatibel. Sambungkan kamera USB lain atau gunakan Mode Sentuh.",
      canRetry: true
    };
  }
  if (name === "AbortError") {
    return {
      ...details,
      title: "Kamera berhenti saat dibuka",
      message: "Sistem atau driver PID menghentikan proses pembukaan kamera.",
      action: "Restart browser atau PID, kemudian coba kembali.",
      canRetry: true
    };
  }

  return details;
}

export class CameraManager {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.status = CAMERA_STATUS.OFF;
    this.facingMode = "user"; // 'user' or 'environment'
    this.listeners = [];
    this.errorMessage = "";
    this.errorDetails = null;
    this.pendingStart = null;
    this.requestId = 0;
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    callback(this.status, this.errorMessage, this.errorDetails);
  }

  notify(status, error = "") {
    this.status = status;
    this.errorDetails = error && typeof error === "object" ? error : null;
    this.errorMessage = this.errorDetails?.message || String(error || "");
    this.listeners.forEach((cb) => cb(status, this.errorMessage, this.errorDetails));
  }

  async startCamera(videoElement, facingMode = "user") {
    if (this.pendingStart) return this.pendingStart;
    this.pendingStart = this._startCamera(videoElement, facingMode);
    try {
      return await this.pendingStart;
    } finally {
      this.pendingStart = null;
    }
  }

  async _startCamera(videoElement, facingMode = "user") {
    this.videoElement = videoElement;
    this.facingMode = facingMode;
    this.notify(CAMERA_STATUS.CONNECTING);

    const isSecureContext = typeof window === "undefined" || window.isSecureContext !== false;
    let isEmbedded = false;
    try { isEmbedded = typeof window !== "undefined" && window.self !== window.top; } catch { isEmbedded = true; }
    const context = { isSecureContext, isEmbedded };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const details = describeCameraError({ name: isSecureContext ? "UnsupportedError" : "InsecureContextError" }, context);
      this.notify(CAMERA_STATUS.ERROR, details);
      return { success: false, error: details.message, details };
    }

    this._releaseStream();
    const requestId = ++this.requestId;
    const plans = getCameraConstraintPlans(this.facingMode);
    let lastError = null;

    for (let index = 0; index < plans.length; index++) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(plans[index].constraints);
        if (requestId !== this.requestId) {
          stream.getTracks().forEach((track) => track.stop());
          return { success: false, cancelled: true, error: "Permintaan kamera dibatalkan." };
        }

        this.stream = stream;
        const videoTrack = stream.getVideoTracks?.()[0];
        if (videoTrack) {
          videoTrack.addEventListener?.("ended", () => {
            if (this.stream === stream) {
              const details = describeCameraError({ name: "AbortError" }, context);
              this.notify(CAMERA_STATUS.ERROR, details);
            }
          }, { once: true });
        }

        if (this.videoElement) {
          this.videoElement.srcObject = stream;
          this.videoElement.setAttribute("playsinline", "true");
          this.videoElement.muted = true;
          if (this.videoElement.readyState < 1) {
            await new Promise((resolve) => {
              const timeout = setTimeout(resolve, 4000);
              this.videoElement.addEventListener("loadedmetadata", () => {
                clearTimeout(timeout);
                resolve();
              }, { once: true });
            });
          }
          await this.videoElement.play().catch(() => {});
        }

        this.notify(CAMERA_STATUS.READY);
        return { success: true, stream, mode: plans[index].name };
      } catch (error) {
        lastError = error;
        const permissionError = ["NotAllowedError", "PermissionDeniedError", "SecurityError"].includes(error?.name);
        const missingDevice = ["NotFoundError", "DevicesNotFoundError"].includes(error?.name);
        if (permissionError || missingDevice || index === plans.length - 1) break;
      }
    }

    console.warn("Camera access failed:", lastError);
    const details = describeCameraError(lastError, context);
    this.notify(CAMERA_STATUS.ERROR, details);
    return { success: false, error: details.message, details };
  }

  _releaseStream() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) this.videoElement.srcObject = null;
  }

  stopCamera() {
    this.requestId++;
    this._releaseStream();
    this.notify(CAMERA_STATUS.OFF);
  }

  async flipCamera() {
    const newFacing = this.facingMode === "user" ? "environment" : "user";
    if (this.videoElement) {
      return await this.startCamera(this.videoElement, newFacing);
    }
    return { success: false, error: "Video element not found" };
  }

  // Toggle Fullscreen helper
  static toggleFullscreen(element = document.documentElement) {
    if (!document.fullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {});
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      }
      return true;
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      return false;
    }
  }
}

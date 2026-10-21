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

export class CameraManager {
  constructor() {
    this.stream = null;
    this.videoElement = null;
    this.status = CAMERA_STATUS.OFF;
    this.facingMode = "user"; // 'user' or 'environment'
    this.listeners = [];
    this.errorMessage = "";
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    callback(this.status, this.errorMessage);
  }

  notify(status, errorMsg = "") {
    this.status = status;
    this.errorMessage = errorMsg;
    this.listeners.forEach((cb) => cb(status, errorMsg));
  }

  async startCamera(videoElement, facingMode = "user") {
    this.videoElement = videoElement;
    this.facingMode = facingMode;
    this.notify(CAMERA_STATUS.CONNECTING);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = "Browser tidak mendukung Web Camera API.";
      this.notify(CAMERA_STATUS.ERROR, err);
      return { success: false, error: err };
    }

    try {
      // Stop any existing stream
      this.stopCamera();

      // Optimal settings for kids & classroom interactive boards
      const constraints = {
        audio: false,
        video: {
          facingMode: this.facingMode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.stream = stream;

      if (this.videoElement) {
        this.videoElement.srcObject = stream;
        this.videoElement.setAttribute("playsinline", "true");
        this.videoElement.muted = true;

        await new Promise((resolve) => {
          this.videoElement.onloadedmetadata = () => {
            this.videoElement.play().then(resolve).catch(resolve);
          };
        });
      }

      this.notify(CAMERA_STATUS.READY);
      return { success: true, stream };
    } catch (err) {
      console.warn("Camera access failed:", err);
      let humanMsg = "Kamera tidak dapat diakses.";

      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        humanMsg = "Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda, atau gunakan Touch Mode.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        humanMsg = "Kamera tidak ditemukan pada perangkat ini. Silakan gunakan Touch Mode.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        humanMsg = "Kamera sedang digunakan oleh aplikasi lain.";
      }

      this.notify(CAMERA_STATUS.ERROR, humanMsg);
      return { success: false, error: humanMsg };
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
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

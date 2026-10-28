/**
 * MOTION SMART CLASS - Firebase Configuration & Initialization
 * Provides modular Firebase v10/v11 App and Cloud Firestore instance.
 * Supports environment variables (VITE_FIREBASE_*) and dynamic Teacher Studio override in localStorage.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import {
  browserSessionPersistence,
  getAuth,
  setPersistence,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut
} from "firebase/auth";

const STORAGE_CONFIG_KEY = "MSC_FIREBASE_CONFIG";
const ADMIN_ROLES = new Set(["super_admin", "owner"]);

export function getConfiguredAdminEmail() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
  return String(env.VITE_ADMIN_EMAIL || "jakasaputra210@gmail.com").trim().toLowerCase();
}

/**
 * Resolve active Firebase configuration from:
 * 1. LocalStorage (custom override set by teacher in Teacher Studio)
 * 2. Vite environment variables (import.meta.env.VITE_FIREBASE_*)
 */
export function getFirebaseConfig() {
  const env = (typeof import.meta !== "undefined" && import.meta.env) ? import.meta.env : {};
  const envConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
    source: "env"
  };

  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId) {
          const populatedFields = Object.fromEntries(
            Object.entries(parsed).filter(([, value]) => typeof value === "string" && value.trim())
          );
          return { ...envConfig, ...populatedFields, source: "localStorage" };
        }
      }
    }
  } catch (e) {
    console.warn("[Firebase] Error reading stored config:", e);
  }

  return envConfig;
}

/**
 * Check if the Firebase configuration has essential fields
 */
export function isFirebaseConfigured(config = getFirebaseConfig()) {
  return Boolean(config && config.projectId && config.projectId.trim().length > 0 && !config.projectId.includes("your-project-id"));
}

/** Anonymous database sessions need the complete Firebase Web App configuration. */
export function validateFirebaseAuthConfig(config = getFirebaseConfig()) {
  const labels = {
    apiKey: "API Key",
    authDomain: "Auth Domain",
    projectId: "Project ID",
    appId: "App ID"
  };
  const missingFields = Object.keys(labels).filter((field) => {
    const value = config?.[field];
    return typeof value !== "string" || !value.trim() || value.includes("...");
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
    missingLabels: missingFields.map((field) => labels[field])
  };
}

let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;

/**
 * Initialize or get existing Firebase App and Firestore instance
 */
export function initFirebase(customConfig = null) {
  const config = customConfig || getFirebaseConfig();

  if (!isFirebaseConfigured(config)) {
    return { app: null, db: null, isConfigured: false, error: "Firebase belum dikonfigurasi (Project ID kosong)." };
  }

  // Node.js testing environment check: Avoid initializing live Firestore gRPC connections with dummy credentials
  if (typeof window === "undefined") {
    return {
      app: null,
      db: null,
      isConfigured: true,
      projectId: config.projectId,
      error: null
    };
  }

  try {
    const apps = getApps();
    if (apps.length > 0 && !customConfig) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(config, customConfig ? "msc-custom-" + Date.now() : "[DEFAULT]");
    }

    firestoreDb = getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);

    return {
      app: firebaseApp,
      db: firestoreDb,
      isConfigured: true,
      projectId: config.projectId,
      error: null
    };
  } catch (err) {
    console.error("[Firebase] Initialization failed:", err);
    return {
      app: null,
      db: null,
      isConfigured: false,
      error: err.message || "Gagal menginisialisasi Firebase SDK"
    };
  }
}

/**
 * Get the Firestore database instance
 */
export function getDb() {
  if (!firestoreDb) {
    const res = initFirebase();
    return res.db;
  }
  return firestoreDb;
}

export function getCurrentUser() {
  return firebaseAuth?.currentUser || null;
}

export function getAuthInstance() {
  if (!firebaseAuth) initFirebase();
  return firebaseAuth;
}

/** Authenticate classroom devices anonymously for the current browser session. */
export async function ensureAnonymousAuth() {
  if (typeof window === "undefined" || !validateFirebaseAuthConfig().valid) return null;
  const auth = getAuthInstance();
  if (!auth) return null;
  await setPersistence(auth, browserSessionPersistence);
  if (auth.currentUser?.isAnonymous) return auth.currentUser;
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function getAdminSession() {
  const auth = getAuthInstance();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return null;
  const db = getDb();
  if (!db) return null;
  const snapshot = await getDoc(doc(db, "users", user.uid));
  if (!snapshot.exists() || !ADMIN_ROLES.has(snapshot.data().role)) return null;
  return { user, profile: { uid: user.uid, ...snapshot.data() } };
}

export async function signInAdmin(email, password) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const expectedEmail = getConfiguredAdminEmail();
  if (!normalizedEmail || !password) throw Object.assign(new Error("Email dan password wajib diisi."), { code: "auth/missing-credentials" });
  if (expectedEmail && normalizedEmail !== expectedEmail) {
    throw Object.assign(new Error("Email ini tidak terdaftar sebagai admin aplikasi."), { code: "auth/unauthorized-admin" });
  }
  const auth = getAuthInstance();
  if (!auth || !getDb()) throw new Error("Firebase belum dikonfigurasi.");
  await setPersistence(auth, browserSessionPersistence);
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  const admin = await getAdminSession();
  if (!admin) {
    await signOut(auth);
    await ensureAnonymousAuth().catch(() => null);
    throw Object.assign(new Error("Akun belum memiliki role owner atau super_admin di Firestore."), { code: "auth/admin-role-required" });
  }
  return admin;
}

export async function signOutAdmin() {
  const auth = getAuthInstance();
  if (auth?.currentUser) await signOut(auth);
  return ensureAnonymousAuth();
}

/**
 * Test connection to Cloud Firestore
 */
export async function testFirestoreConnection(configToTest = null) {
  try {
    const config = configToTest || getFirebaseConfig();
    if (!isFirebaseConfigured(config)) {
      return { success: false, message: "Project ID belum diisi atau masih menggunakan placeholder." };
    }

    let testApp;
    let testDb;

    if (configToTest) {
      testApp = initializeApp(configToTest, "test-conn-" + Date.now());
      testDb = getFirestore(testApp);
      const testAuth = getAuth(testApp);
      await setPersistence(testAuth, browserSessionPersistence);
      if (!testAuth.currentUser) await signInAnonymously(testAuth);
    } else {
      await ensureAnonymousAuth();
      testDb = getDb();
    }

    if (!testDb) {
      return { success: false, message: "Gagal membuat koneksi database Firestore." };
    }

    // Try a fast, minimal read (1 doc from questions or metadata)
    const q = query(collection(testDb, "questions"), limit(1));
    await getDocs(q);

    return {
      success: true,
      message: `Berhasil terhubung ke Cloud Firestore (${config.projectId})!`,
      projectId: config.projectId
    };
  } catch (err) {
    console.error("[Firebase] Connection test error:", err);
    let msg = err.message || "Gagal terhubung ke Firestore";
    if (err.code === "permission-denied") {
      msg = "Akses ditolak (Permission Denied). Periksa Firestore Security Rules di Firebase Console.";
    } else if (err.code === "unavailable") {
      msg = "Layanan Firestore tidak dapat dijangkau (Offline / masalah jaringan).";
    }
    return {
      success: false,
      message: msg,
      code: err.code
    };
  }
}

/**
 * Save Firebase configuration to localStorage and re-initialize
 */
export function saveFirebaseConfig(config) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    }
    // Re-initialize
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
    return initFirebase(config);
  } catch (e) {
    console.error("Failed to save Firebase config:", e);
    return { success: false, error: e.message };
  }
}

/**
 * Reset Firebase configuration (remove custom config from localStorage)
 */
export function resetFirebaseConfig() {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_CONFIG_KEY);
    }
    firebaseApp = null;
    firestoreDb = null;
    firebaseAuth = null;
    return initFirebase();
  } catch (e) {
    console.error("Failed to reset Firebase config:", e);
  }
}

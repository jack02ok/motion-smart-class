/**
 * MOTION SMART CLASS - Firebase Configuration & Initialization
 * Provides modular Firebase v10/v11 App and Cloud Firestore instance.
 * Supports environment variables (VITE_FIREBASE_*) and dynamic Teacher Studio override in localStorage.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth";

const STORAGE_CONFIG_KEY = "MSC_FIREBASE_CONFIG";

/**
 * Resolve active Firebase configuration from:
 * 1. LocalStorage (custom override set by teacher in Teacher Studio)
 * 2. Vite environment variables (import.meta.env.VITE_FIREBASE_*)
 */
export function getFirebaseConfig() {
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_CONFIG_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.projectId) {
          return { ...parsed, source: "localStorage" };
        }
      }
    }
  } catch (e) {
    console.warn("[Firebase] Error reading stored config:", e);
  }

  // Fallback to Vite environment variables
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

  return envConfig;
}

/**
 * Check if the Firebase configuration has essential fields
 */
export function isFirebaseConfigured(config = getFirebaseConfig()) {
  return Boolean(config && config.projectId && config.projectId.trim().length > 0 && !config.projectId.includes("your-project-id"));
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

/** Authenticate classroom devices anonymously and return their stable Firebase UID. */
export async function ensureAnonymousAuth() {
  if (typeof window === "undefined" || !isFirebaseConfigured()) return null;
  const auth = getAuthInstance();
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInAnonymously(auth);
  return credential.user;
}

/** Sign in a teacher and verify their server-managed /users/{uid}.role. */
export async function signInTeacher(email, password) {
  const auth = getAuthInstance();
  const db = getDb();
  if (!auth || !db) throw new Error("Firebase belum dikonfigurasi.");
  await setPersistence(auth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getDoc(doc(db, "users", credential.user.uid));
  if (!profile.exists() || profile.data()?.role !== "teacher") {
    await signOut(auth);
    throw new Error("Akun ini belum memiliki role teacher di Firestore.");
  }
  return credential.user;
}

export async function getTeacherAuthStatus() {
  const user = getCurrentUser();
  const db = getDb();
  if (!user || !db || user.isAnonymous) return { signedIn: Boolean(user), isTeacher: false, user };
  try {
    const profile = await getDoc(doc(db, "users", user.uid));
    return { signedIn: true, isTeacher: profile.exists() && profile.data()?.role === "teacher", user };
  } catch {
    return { signedIn: true, isTeacher: false, user };
  }
}

export async function signOutFirebaseUser() {
  const auth = getAuthInstance();
  if (auth) await signOut(auth);
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
    } else {
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

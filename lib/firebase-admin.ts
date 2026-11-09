import { initializeApp, getApps, getApp, cert, App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK (server only).
 *
 * Required env vars:
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY   (literal "\n" sequences are accepted)
 */
function getAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin is not configured: set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY"
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

let firestoreConfigured = false;

export const adminAuth = () => getAuth(getAdminApp());

export const adminDb = () => {
  const db = getFirestore(getAdminApp());
  if (!firestoreConfigured) {
    // settings() may only be called once, before first use. Optional fields
    // that are `undefined` are dropped instead of throwing.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      /* already configured (e.g. dev hot-reload) */
    }
    firestoreConfigured = true;
  }
  return db;
};

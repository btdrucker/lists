import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  if (admin.apps.length === 0) {
    // Prefer environment variables (for deployments and local dev)
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      // Use service account JSON file path from env var
      try {
        const serviceAccount = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } catch (error) {
        console.error(`Failed to initialize Firebase with service account at: ${process.env.FIREBASE_SERVICE_ACCOUNT_PATH}`);
        throw error;
      }
    } else {
      throw new Error(
        'Firebase Admin SDK initialization failed. Please set one of:\n' +
        '  1. FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables, OR\n' +
        '  2. FIREBASE_SERVICE_ACCOUNT_PATH environment variable pointing to your service account JSON file\n' +
        '\nSee backend/README.md for setup instructions.'
      );
    }
  }
  return admin;
};

export const firebaseAdmin = initializeFirebase();
export const auth = firebaseAdmin.auth();

// Initialize Firestore with explicit settings
const firestoreInstance = firebaseAdmin.firestore();
firestoreInstance.settings({
  ignoreUndefinedProperties: true,
  preferRest: true,  // Use REST API instead of gRPC to avoid connection issues
});
export const firestore = firestoreInstance;


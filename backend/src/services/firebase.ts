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
    // Try to use service account JSON file if it exists
    const serviceAccountPath = join(__dirname, '../../listster-8ffc9-firebase-adminsdk-fbsvc-9a011b87e1.json');
    
    try {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (error) {
      // Fallback to environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
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


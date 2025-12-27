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
      console.log('[FIREBASE] Loading service account from:', serviceAccountPath);
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
      console.log('[FIREBASE] Service account loaded for project:', serviceAccount.project_id);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[FIREBASE] Admin SDK initialized successfully');
      console.log('[FIREBASE] Project ID:', serviceAccount.project_id);
    } catch (error) {
      // Fallback to environment variables
      console.log('[FIREBASE] Service account file not found, using environment variables');
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
      console.log('[FIREBASE] Admin SDK initialized from env vars');
    }
  } else {
    console.log('[FIREBASE] Admin SDK already initialized');
  }
  return admin;
};

export const firebaseAdmin = initializeFirebase();
export const auth = firebaseAdmin.auth();

// Initialize Firestore with explicit settings
const firestoreInstance = firebaseAdmin.firestore();
firestoreInstance.settings({
  ignoreUndefinedProperties: true,
  preferRest: true,  // Use REST API instead of gRPC
});
export const firestore = firestoreInstance;

console.log('[FIREBASE] Firestore initialized');

// Test Firestore connectivity at startup
(async () => {
  try {
    console.log('[FIREBASE] Testing Firestore connectivity...');
    const testRef = firestoreInstance.collection('_test_connection');
    await testRef.limit(1).get();
    console.log('[FIREBASE] ✓ Firestore connectivity test successful');
  } catch (error) {
    console.error('[FIREBASE] ✗ Firestore connectivity test failed:', error);
  }
})();


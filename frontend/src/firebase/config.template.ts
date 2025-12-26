import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// INSTRUCTIONS: Copy this file to config.ts and replace placeholder values
// 
// To get these values:
// 1. Go to Firebase Console (https://console.firebase.google.com/)
// 2. Select your project
// 3. Go to Project Settings (gear icon) > General
// 4. Scroll to "Your apps" and copy the config object
//
// Note: These values are SAFE to commit to source control.
// Firebase security is enforced through Security Rules.

const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);


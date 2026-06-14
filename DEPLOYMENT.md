# Deployment Guide

For local development setup, see the [README](README.md). This document covers one-time environment configuration and all deployment scenarios.

---

## Environments

| Alias | Firebase Project | Purpose |
|---|---|---|
| `prod` | `listster-8ffc9` | Live, user-facing app |
| `test` | `listster-test` | Staging / feature testing |

Each environment has its own Firebase project, Firestore database, Auth configuration, and Cloud Run backend instance. They are completely independent.

---

## One-Time Setup

### Prerequisites

```bash
# Firebase CLI (for frontend hosting + Firestore rules)
npm install -g firebase-tools
firebase login

# Google Cloud SDK (for backend Cloud Run deployment)
brew install --cask google-cloud-sdk
gcloud auth login
```

Node.js 20.19+ or 22.12+ is required. Check with `node --version`.

### Firebase Project Aliases

```bash
cd /path/to/lists

firebase use --add   # select your test project → alias: "test"
firebase use --add   # select listster-8ffc9   → alias: "prod"
```

This writes both aliases to `.firebaserc`.

### Backend Environment Files

Create these files in `backend/`. They are gitignored — never commit them.

**`backend/.env`** (local development):
```env
FIREBASE_PROJECT_ID=listster-8ffc9
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-8ffc9.iam.gserviceaccount.com
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**`backend/.env.test`** (test environment):
```env
FIREBASE_PROJECT_ID=listster-test
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@listster-test.iam.gserviceaccount.com
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://listster-test.web.app
```

**`backend/.env.production`** (production environment):
```env
FIREBASE_PROJECT_ID=listster-8ffc9
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-8ffc9.iam.gserviceaccount.com
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://listster-8ffc9.web.app
```

Get credentials from: Firebase Console → Project → Project Settings → Service Accounts → Generate new private key. The private key value must preserve `\n` newlines and be wrapped in quotes.

### Frontend Firebase Config Files

Create these files in `frontend/src/firebase/`. They are gitignored — never commit them.

**`frontend/src/firebase/config.ts`** (local development — points at prod Firebase project):
```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "listster-8ffc9.firebaseapp.com",
  projectId: "listster-8ffc9",
  storageBucket: "listster-8ffc9.firebasestorage.app",
  messagingSenderId: "451482687781",
  appId: "1:451482687781:web:841a89fe1aaecf40e622cc"
};

export default firebaseConfig;
```

**`frontend/src/firebase/config.test.ts`**:
```typescript
const firebaseConfig = {
  apiKey: "your-test-api-key",
  authDomain: "listster-test.firebaseapp.com",
  projectId: "listster-test",
  storageBucket: "listster-test.firebasestorage.app",
  messagingSenderId: "your-test-sender-id",
  appId: "your-test-app-id"
};

export default firebaseConfig;
```

**`frontend/src/firebase/config.production.ts`**:
```typescript
const firebaseConfig = {
  apiKey: "your-prod-api-key",
  authDomain: "listster-8ffc9.firebaseapp.com",
  projectId: "listster-8ffc9",
  storageBucket: "listster-8ffc9.firebasestorage.app",
  messagingSenderId: "451482687781",
  appId: "1:451482687781:web:841a89fe1aaecf40e622cc",
  measurementId: "G-EQYP5BT4K0"
};

export default firebaseConfig;
```

Get values from: Firebase Console → Project Settings → General → Your apps.

### Frontend API URL Files

**`frontend/.env`** (local — points at local backend):
```env
VITE_API_URL=http://localhost:3001
```

**`frontend/.env.test`** (test deployment):
```env
VITE_API_URL=https://recipe-app-backend-test-xxxxx-uc.a.run.app
```

**`frontend/.env.production`** (production deployment):
```env
VITE_API_URL=https://recipe-app-backend-prod-xxxxx-uc.a.run.app
```

The Cloud Run URLs are printed when the backend is deployed. Update these files after each backend deployment if the URL changes (it usually doesn't).

### Firestore Rules (One Time Per Environment)

Deploy whenever `firestore.rules` changes:

```bash
firebase use test && firebase deploy --only firestore:rules
firebase use prod && firebase deploy --only firestore:rules
```

---

## Running Locally (Full Local)

Standard daily development. Both servers must be running simultaneously.

**Backend** (terminal 1):
```bash
cd backend
npm run dev
# Runs on http://localhost:3001
# Uses backend/.env
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
# Uses frontend/.env → points at localhost:3001
```

---

## Running Frontend Locally Against Remote Test Backend

Useful when you don't want to run the backend locally, or want to test against the deployed cloud backend.

```bash
cd frontend
VITE_API_URL=https://recipe-app-backend-test-xxxxx-uc.a.run.app npm run dev
```

Or temporarily edit `frontend/.env` to point at the test backend URL, then restore it afterward.

The Firebase project used is still whatever `frontend/src/firebase/config.ts` points at (production by default for local dev).

---

## Deploy to Test

### 1. Backend

```bash
cd backend

gcloud run deploy recipe-app-backend-test \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file .env.test \
  --project listster-test
```

Note the Cloud Run URL printed after deployment and update `frontend/.env.test` if it changed.

### 2. Frontend

```bash
./deploy-frontend-test.sh
```

This script builds the frontend with test environment variables and deploys to Firebase Hosting on the test project.

### 3. Firestore Rules (only when changed)

```bash
firebase use test
firebase deploy --only firestore:rules
```

---

## Deploy to Production

### 1. Backend

```bash
cd backend

gcloud run deploy recipe-app-backend-prod \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file .env.production \
  --project listster-8ffc9
```

### 2. Frontend

```bash
./deploy-frontend-prod.sh
```

### 3. Firestore Rules (only when changed)

```bash
firebase use prod
firebase deploy --only firestore:rules
```

---

## Deployed URLs

| | Frontend | Backend |
|---|---|---|
| **Test** | https://listster-test.web.app | Cloud Run URL (see step 1 above) |
| **Production** | https://listster-8ffc9.web.app | Cloud Run URL (see step 1 above) |

After deploying the frontend to either environment, add the hosting domain to Firebase Console → Authentication → Settings → Authorized domains if it isn't already there.

---

## Troubleshooting

**Authentication fails on deployed frontend**
- Verify the Firebase config file for that environment has correct values
- Add the hosting domain to Firebase Console → Authentication → Authorized domains

**CORS errors from backend**
- The backend's allowed origins list must include the frontend hosting URL
- Update `backend/src/index.ts` and redeploy the backend
- Check Cloud Run logs: `gcloud run logs read recipe-app-backend-prod --project listster-8ffc9`

**Firestore permission denied**
- Verify rules are deployed: `firebase deploy --only firestore:rules`

**Backend won't deploy to Cloud Run**
- Docker must be running (Cloud Run uses it to build)
- Verify the env file exists and has all required keys

**Backend won't start locally**
- Confirm `backend/.env` exists with valid credentials
- Verify port 3001 is not already in use

**Scraping fails**
- Backend must be running and reachable
- Some sites block scraping — allrecipes.com and food.com are reliable for testing

---

## Costs (Reference)

| Service | Cost |
|---|---|
| Firebase Hosting | Free tier covers typical usage |
| Cloud Run | ~$0.40/million requests; free when idle |
| Firestore | Free tier: 50k reads/day, 20k writes/day |
| Firebase Auth | Free for typical usage |

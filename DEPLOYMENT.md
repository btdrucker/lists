# Deployment Guide - Test & Production

This guide covers deploying your EditRecipe App to both **test** and **production** environments.

## 🎯 Overview

You'll have two separate Firebase projects:
- **Test Environment**: For testing new features before going live
- **Production Environment**: Your live, user-facing app

Each environment has:
- Frontend (Firebase Hosting)
- Backend (Cloud Run or Cloud Functions)
- Firestore database
- Firebase Authentication

## 📋 Prerequisites

1. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Two Firebase Projects**:
   - **Production**: `listster-8ffc9` (you already have this)
   - **Test**: Create a new project at https://console.firebase.google.com/
     - Suggested name: `listster-test`
     - Enable Authentication (Email/Password + Google)
     - Enable Firestore Database

## 🔧 Initial Setup

### 1. Configure Firebase Projects

Add the test project to your Firebase configuration:

```bash
cd /Users/benjamin.drucker/WebstormProjects/lists

# Set up project aliases
firebase use --add
# Select your TEST project and give it alias "test"
# Select your PRODUCTION project (listster-8ffc9) and give it alias "prod"
```

This updates `.firebaserc` with both project aliases.

### 2. Backend Configuration

Create separate environment files:

**`backend/.env.test`**:
```env
# Get from Firebase Console → Test Project → Service Accounts → Generate new private key
FIREBASE_PROJECT_ID=your-test-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-test-project-id.iam.gserviceaccount.com

PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-test-project.web.app
```

**`backend/.env.production`**:
```env
# Get from Firebase Console → Production Project → Service Accounts → Generate new private key
FIREBASE_PROJECT_ID=listster-8ffc9
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-8ffc9.iam.gserviceaccount.com

PORT=3001
NODE_ENV=production
FRONTEND_URL=https://listster-8ffc9.web.app
```

### 3. Frontend Configuration

Create separate Firebase config files:

**`frontend/src/firebase/config.test.ts`**:
```typescript
// Get from Firebase Console → Test Project → Project Settings → Your apps
const firebaseConfig = {
  apiKey: "your-test-api-key",
  authDomain: "your-test-project.firebaseapp.com",
  projectId: "your-test-project-id",
  storageBucket: "your-test-project.appspot.com",
  messagingSenderId: "your-test-sender-id",
  appId: "your-test-app-id"
};

export default firebaseConfig;
```

**`frontend/src/firebase/config.production.ts`**:
```typescript
// Get from Firebase Console → Production Project → Project Settings → Your apps
const firebaseConfig = {
  apiKey: "your-prod-api-key",
  authDomain: "listster-8ffc9.firebaseapp.com",
  projectId: "listster-8ffc9",
  storageBucket: "listster-8ffc9.appspot.com",
  messagingSenderId: "your-prod-sender-id",
  appId: "your-prod-app-id"
};

export default firebaseConfig;
```

**Update `frontend/src/firebase/config.ts`** to use environment-specific config:
```typescript
// Load config based on environment
const isDev = import.meta.env.DEV;
const isTest = import.meta.env.VITE_ENV === 'test';

let firebaseConfig;
if (isDev) {
  // Development uses whatever you had configured
  firebaseConfig = {
    // Your existing dev config
  };
} else if (isTest) {
  firebaseConfig = (await import('./config.test')).default;
} else {
  firebaseConfig = (await import('./config.production')).default;
}

export default firebaseConfig;
```

### 4. Update firebase.json

Update your `firebase.json` to include hosting and functions/Cloud Run:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": "frontend/dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 5. Add .gitignore Entries

Ensure these are in your `.gitignore`:
```
backend/.env.test
backend/.env.production
frontend/src/firebase/config.test.ts
frontend/src/firebase/config.production.ts
```

## 🚀 Deployment Commands

### Deploy to Test

```bash
# 1. Deploy frontend (builds + hosting)
./deploy-frontend-test.sh

# 2. Deploy Firestore rules (first time only)
firebase use test
firebase deploy --only firestore:rules

# 3. Deploy backend
./deploy-backend-test.sh
```

### Deploy to Production

```bash
# 1. Deploy frontend (builds + hosting)
./deploy-frontend-prod.sh

# 2. Deploy Firestore rules (first time only)
firebase use prod
firebase deploy --only firestore:rules

# 3. Deploy backend
./deploy-backend-prod.sh
```

## 🖥️ Backend Deployment Options

You have two main options for deploying the backend:

### Option A: Google Cloud Run (Recommended)

**Pros**: Full control, cost-effective for low/medium traffic, can run any HTTP server
**Cons**: Requires Docker, slightly more setup

1. **Install Google Cloud SDK**:
   ```bash
   brew install --cask google-cloud-sdk
   gcloud auth login
   ```

2. **Dockerfile (already in repo root)**:
   ```dockerfile
   FROM node:22-alpine
   WORKDIR /app
   COPY backend/package*.json ./backend/
   WORKDIR /app/backend
   RUN npm ci
   WORKDIR /app
   COPY backend ./backend
   COPY shared ./shared
   RUN npm run build
   EXPOSE 8080
   CMD ["node", "dist/backend/src/index.js"]
   ```

3. **Create `backend/.dockerignore`**:
   ```
   node_modules
   dist
   .env
   .env.*
   *.log
   ```

4. **Deploy to Cloud Run** (from repo root):
   ```bash
   # For test
   gcloud run deploy listster-backend-test \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --project listster-test \
     --set-env-vars NODE_ENV=production,FRONTEND_URL=https://listster-test.web.app,FIREBASE_PROJECT_ID=listster-test,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-test.iam.gserviceaccount.com \
     --update-secrets=FIREBASE_PRIVATE_KEY=listster-test-firebase-key:latest
   
   # For production
   gcloud run deploy listster-backend-prod \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --project listster-8ffc9 \
     --set-env-vars NODE_ENV=production,FRONTEND_URL=https://listster-8ffc9.web.app,FIREBASE_PROJECT_ID=listster-8ffc9,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-8ffc9.iam.gserviceaccount.com \
     --update-secrets=FIREBASE_PRIVATE_KEY=listster-prod-firebase-key:latest
   ```

5. **Set Firebase credentials as secrets** (more secure than env vars):
   ```bash
   # Create secret from your .env.production file
   gcloud secrets create firebase-backend-env --data-file=.env.production --project listster-8ffc9
   
   # Grant Cloud Run access to the secret
   gcloud run services update recipe-app-backend-prod \
     --update-secrets=/etc/secrets/.env=firebase-backend-env:latest \
     --project listster-8ffc9
   ```

### Option B: Cloud Functions (Simpler, but limited)

**Pros**: Very simple to deploy, scales automatically
**Cons**: Cold starts, pricing can be higher for high traffic, requires adapting your Fastify app

1. **Install Functions dependencies**:
   ```bash
   cd backend
   npm install firebase-functions
   ```

2. **Create `backend/src/cloud-function.ts`**:
   ```typescript
   import * as functions from 'firebase-functions';
   import { app } from './index'; // Your Fastify app
   
   export const api = functions.https.onRequest(async (req, res) => {
     await app.ready();
     app.server.emit('request', req, res);
   });
   ```

3. **Update `firebase.json`**:
   ```json
   {
     "functions": {
       "source": "backend",
       "runtime": "nodejs22"
     }
   }
   ```

4. **Deploy**:
   ```bash
   firebase use test
   firebase deploy --only functions
   
   firebase use prod
   firebase deploy --only functions
   ```

## 🔒 Security Setup

### Update CORS in Backend

Update `backend/src/index.ts` to allow your deployed frontend URLs:

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'https://listster-8ffc9.web.app',
  'https://listster-8ffc9.firebaseapp.com',
  'https://your-test-project.web.app',
  'https://your-test-project.firebaseapp.com',
];

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
});
```

### Update Firestore Rules

Deploy your rules to both projects:

```bash
firebase use test
firebase deploy --only firestore:rules

firebase use prod
firebase deploy --only firestore:rules
```

## 📝 Deployment Checklist

### Before First Deploy

- [ ] Create test Firebase project
- [ ] Enable Auth (Email/Password + Google) in both projects
- [ ] Enable Firestore in both projects
- [ ] Generate service account keys for both projects
- [ ] Create `.env.test` and `.env.production` in backend/
- [ ] Create `config.test.ts` and `config.production.ts` in frontend/src/firebase/
- [ ] Add sensitive files to `.gitignore`
- [ ] Update `firebase.json` with hosting config
- [ ] Update CORS origins in backend
- [ ] Set up Firebase project aliases (`firebase use --add`)

### Regular Deployments

1. **Test your changes locally first**
2. **Deploy to test**:
   ```bash
   ./deploy-frontend-test.sh
   ./deploy-backend-test.sh
   ```
3. **Test on the test environment**
4. **Deploy to production**:
   ```bash
   ./deploy-frontend-prod.sh
   ./deploy-backend-prod.sh
   ```

## 🌐 Your Deployed URLs

After deployment:

**Test Environment**:
- Frontend: `https://your-test-project.web.app`
- Backend: Cloud Run URL (e.g., `https://recipe-app-backend-test-xxxxx-uc.a.run.app`)

**Production Environment**:
- Frontend: `https://listster-8ffc9.web.app`
- Backend: Cloud Run URL (e.g., `https://recipe-app-backend-prod-xxxxx-uc.a.run.app`)

Update the `FRONTEND_URL` and backend API URL in your respective configs.

## 🐛 Troubleshooting

**Authentication fails on deployed frontend**:
- Verify Firebase config has correct values for the environment
- Check Firebase Console → Authentication → Settings → Authorized domains
- Add your hosting domain (e.g., `listster-8ffc9.web.app`)

**Backend CORS errors**:
- Verify allowed origins include your hosting URL
- Check Cloud Run logs: `gcloud run logs read recipe-app-backend-prod --project listster-8ffc9`

**Firestore permission denied**:
- Verify rules are deployed: `firebase deploy --only firestore:rules`
- Check rules allow authenticated users to read/write

## 💰 Cost Optimization

- **Firestore**: Minimize reads by caching recipes in Redux (already implemented)
- **Hosting**: Free tier covers most small apps
- **Cloud Run**: Only charged when requests are being handled (very cost-effective)
- **Authentication**: Free for most usage levels

## 🔄 CI/CD (Optional Future Enhancement)

Consider setting up GitHub Actions to auto-deploy on push:
- Push to `main` → deploy to production
- Push to `develop` → deploy to test

This is beyond scope for now, but can be added later.

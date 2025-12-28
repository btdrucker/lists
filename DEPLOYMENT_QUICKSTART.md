# Quick Deployment Guide

This is a simplified guide to get you deployed quickly. See `DEPLOYMENT.md` for full details.

## 🎯 What You'll Deploy

- **Frontend**: Firebase Hosting (static React app)
- **Backend**: Google Cloud Run (containerized Fastify server)
- **Two Environments**: Test and Production

## 📋 Prerequisites

1. **Firebase CLI**:
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Google Cloud SDK** (for backend):
   ```bash
   brew install --cask google-cloud-sdk
   gcloud auth login
   ```

3. **Two Firebase Projects**:
   - Production: `listster-8ffc9` (you already have this)
   - Test: Create at https://console.firebase.google.com/ (suggested name: `listster-test`)
   
   For each project:
   - Enable Authentication (Email/Password + Google)
   - Enable Firestore Database
   - Generate Service Account key (Project Settings → Service Accounts → Generate new private key)

## 🔧 One-Time Setup

### 1. Configure Firebase Project Aliases

```bash
cd /Users/benjamin.drucker/WebstormProjects/lists

# Add test project
firebase use --add
# Select your test project, give it alias "test"

# Add production project  
firebase use --add
# Select listster-8ffc9, give it alias "prod"
```

### 2. Create Backend Environment Files

**`backend/.env.test`**:
```env
FIREBASE_PROJECT_ID=your-test-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-test-project.iam.gserviceaccount.com
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-test-project.web.app
```

**`backend/.env.production`**:
```env
FIREBASE_PROJECT_ID=listster-8ffc9
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@listster-8ffc9.iam.gserviceaccount.com
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://listster-8ffc9.web.app
```

### 3. Create Frontend Config Files

**`frontend/src/firebase/config.test.ts`** (copy from `config.test.ts.example`):
```typescript
const firebaseConfig = {
  apiKey: "your-test-api-key",
  authDomain: "your-test-project.firebaseapp.com",
  projectId: "your-test-project-id",
  storageBucket: "your-test-project.firebasestorage.app",
  messagingSenderId: "your-test-sender-id",
  appId: "your-test-app-id"
};

export default firebaseConfig;
```

**`frontend/src/firebase/config.production.ts`** (copy from `config.production.ts.example`):
```typescript
const firebaseConfig = {
  apiKey: "your-test-api-key",
  authDomain: "listster-8ffc9.firebaseapp.com",
  projectId: "listster-8ffc9",
  storageBucket: "listster-8ffc9.firebasestorage.app",
  messagingSenderId: "451482687781",
  appId: "1:451482687781:web:841a89fe1aaecf40e622cc",
  measurementId: "G-EQYP5BT4K0"
};

export default firebaseConfig;
```

### 4. Deploy Firestore Rules (One Time)

```bash
# Test
firebase use test
firebase deploy --only firestore:rules

# Production
firebase use prod
firebase deploy --only firestore:rules
```

## 🚀 Deploy to Test

### Frontend (Easy - Use Script):
```bash
./deploy-test.sh
```

### Backend (Cloud Run):
```bash
cd backend

# Build and deploy
gcloud run deploy recipe-app-backend-test \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --env-vars-file .env.test \
  --project your-test-project-id

# Note the URL that's printed (e.g., https://recipe-app-backend-test-xxxxx-uc.a.run.app)
```

### Update Frontend with Backend URL:

Create `frontend/.env.test`:
```env
VITE_API_URL=https://recipe-app-backend-test-xxxxx-uc.a.run.app
```

Then redeploy frontend:
```bash
./deploy-test.sh
```

## 🚀 Deploy to Production

Same process as test, but use production configs:

### Frontend:
```bash
./deploy-prod.sh
```

### Backend:
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

### Update Frontend:

Create `frontend/.env.production`:
```env
VITE_API_URL=https://recipe-app-backend-prod-xxxxx-uc.a.run.app
```

Then redeploy:
```bash
./deploy-prod.sh
```

## 🌐 Your URLs

**Test**:
- Frontend: `https://your-test-project.web.app`
- Backend: Cloud Run URL from deployment

**Production**:
- Frontend: `https://listster-8ffc9.web.app`
- Backend: Cloud Run URL from deployment

## 🐛 Troubleshooting

**"Origin not allowed by CORS"**:
- Update `backend/src/index.ts` allowedOrigins array with your hosting URLs

**"Authentication fails"**:
- Add your hosting domain to Firebase Console → Authentication → Settings → Authorized domains

**Backend won't deploy**:
- Make sure Docker is running (Cloud Run needs it to build)
- Check that .env.test or .env.production exists

## 💰 Costs

- **Firebase Hosting**: Free for most small apps
- **Cloud Run**: ~$0.40 per million requests (very cheap for low traffic)
- **Firestore**: Free tier covers 50k reads/day

## 📝 Regular Deployments

After initial setup, deploying is simple:

```bash
# Test
./deploy-test.sh
cd backend && gcloud run deploy recipe-app-backend-test --source . --project your-test-project-id

# Production
./deploy-prod.sh
cd backend && gcloud run deploy recipe-app-backend-prod --source . --project listster-8ffc9
```

That's it! 🎉


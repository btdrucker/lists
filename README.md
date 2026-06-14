# Listster

A family recipe and shopping app. Manage a shared recipe library, build shopping lists from recipes, and plan meals for the week. Runs as an installable PWA.

## Documentation

| Document | Description |
|---|---|
| [SPEC.md](SPEC.md) | What the app does — features and user experience |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | Architecture, tech stack, and how the code is organized |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Environment setup and deployment to test and production |

## Local Development

### Prerequisites

- Node.js 20.19+ or 22.12+ (`node --version` to check)
- A Firebase project with Authentication (Email/Password + Google) and Firestore enabled
- A Firebase service account key for the backend

### 1. Configure the backend

Create `backend/.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Get credentials from Firebase Console → Project Settings → Service Accounts → Generate new private key.

### 2. Configure the frontend

Create `frontend/src/firebase/config.ts` with your Firebase web app config:

```typescript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};

export default firebaseConfig;
```

Get values from Firebase Console → Project Settings → General → Your apps.

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3001
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run

**Backend** (terminal 1):
```bash
cd backend
npm run dev
# http://localhost:3001
```

**Frontend** (terminal 2):
```bash
cd frontend
npm run dev
# http://localhost:5173
```

For test and production deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

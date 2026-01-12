# EditRecipe App - Quick Start Guide

Your monorepo is ready! Follow these steps to get running.

## 📋 Prerequisites

1. **Node.js**: Version **20.19+** or **22.12+** required
   - Check your version: `node --version`
   - If you have v20.10.0 or older, upgrade:
     ```bash
     brew install node@22
     export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
     # Add to ~/.bash_profile or ~/.zshrc to make permanent
     ```

2. **Firebase Project**:
   - Go to https://console.firebase.google.com/
   - Create a new project (or use existing)
   - Enable **Authentication** → Email/Password provider
   - Enable **Firestore Database**

## 🔧 Setup Steps

### 1. Initialize Firebase CLI

First, authenticate and set up Firebase in your project:

```bash
cd /Users/benjamin.drucker/WebstormProjects/lists
firebase login  # Authenticate with your Google account (if not already logged in)
firebase init firestore
```

During `firebase init`, you'll be prompted to:
- **Select your Firebase project** from the list (or create a new one)
- **Firestore rules file**: Press Enter to accept `firestore.rules` (already exists)
- **Firestore indexes file**: Press Enter to accept `firestore.indexes.json`

This creates `.firebaserc` (project config) and `firebase.json` (deployment config).

### 2. Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

Or manually copy rules from `firestore.rules` into Firebase Console.

### 3. Backend Configuration

Create `/Users/benjamin.drucker/WebstormProjects/lists/backend/.env`:

```env
# Get these from Firebase Console → Project Settings → Service Accounts → Generate new private key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

**Note**: The private key must include `\n` newline characters and be wrapped in quotes.

### 4. Frontend Configuration

Edit `/Users/benjamin.drucker/WebstormProjects/lists/frontend/src/firebase/config.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",              // From Firebase Console
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

Get these from: Firebase Console → Project Settings → General → Your apps

## 🚀 Running the App

### Terminal 1: Backend

```bash
cd /Users/benjamin.drucker/WebstormProjects/lists/backend
npm run dev
```

Backend runs on **http://localhost:3001**

### Terminal 2: Frontend

```bash
cd /Users/benjamin.drucker/WebstormProjects/lists/frontend
npm run dev
```

Frontend runs on **http://localhost:5173**

## ✅ Test It Out

1. Open http://localhost:5173
2. Create an account (signup)
3. Add a recipe:
   - **Manual Entry**: Fill out the form directly
   - **URL Scraping**: Paste a recipe URL (try allrecipes.com or similar)
4. View your recipes in the list

## 📁 Project Structure

```
lists/
├── backend/          # Fastify API (TypeScript)
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/auth.ts
│   │   ├── routes/scrape.ts
│   │   ├── services/
│   │   │   ├── scraper.ts
│   │   │   ├── firestore.ts
│   │   │   └── firebase.ts
│   │   └── types/index.ts
│   └── .env (YOU CREATE THIS)
│
├── frontend/         # React + Redux (TypeScript)
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── recipe-list/
│   │   │   └── add-recipe/
│   │   ├── firebase/
│   │   │   ├── config.ts (YOU EDIT THIS)
│   │   │   ├── auth.ts
│   │   │   └── firestore.ts
│   │   ├── common/
│   │   │   ├── store.ts
│   │   │   └── slices/slice.ts
│   │   └── App.tsx
│   └── package.json
│
├── firestore.rules   # Firestore security rules
└── README.md
```

## 🔑 Key Features

- ✅ **Email/Password Authentication**
- ✅ **EditRecipe Scraping** from URLs using backend
- ✅ **Manual EditRecipe Entry** directly in frontend
- ✅ **Structured Ingredients** (amount, unit, name)
- ✅ **Redux State Management** with persistence
- ✅ **Firestore Cost Optimization** (single read per session)
- ✅ **Public Recipes** (all users can read all recipes)

## 🐛 Troubleshooting

**Backend won't start**:
- Check `.env` file exists in backend/
- Verify Firebase service account credentials
- Make sure port 3001 is available

**Frontend authentication fails**:
- Check `src/firebase/config.ts` has correct values
- Verify Email/Password auth is enabled in Firebase Console
- Check browser console for errors

**EditRecipe scraping fails**:
- Backend must be running on localhost:3001
- Some websites block scraping - try allrecipes.com or food.com
- Check browser console and backend logs for errors

## 📚 Next Steps

- Add recipe editing functionality
- Add recipe deletion
- Add search and filtering
- Add recipe images upload
- Add ingredient scaling (serving calculator)
- Add shopping list generation
- Make recipes private/public toggle

Enjoy your recipe app! 🍳

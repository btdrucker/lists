# Recipe Scraping App

A monorepo containing a React/Redux frontend and Fastify backend for scraping and managing recipes.

## Project Structure

```
lists/
├── frontend/          # React + Redux + TypeScript + Vite
├── backend/           # Fastify + TypeScript + Firebase Admin
├── firestore.rules    # Firestore security rules
└── README.md
```

## Prerequisites

- Node.js 18+ and npm
- Firebase project with Authentication and Firestore enabled
- Firebase service account key (for backend)

## Setup

### 1. Firebase Configuration

1. Create a Firebase project at https://console.firebase.google.com/
2. Enable **Authentication** → Email/Password provider
3. Enable **Firestore Database**
4. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   # Or manually paste rules from firestore.rules into Firebase Console
   ```
5. Create a service account for backend:
   - Project Settings → Service Accounts → Generate new private key
   - Save JSON file as `backend/.env` (see backend README)
6. Get Firebase config for frontend (Project Settings → Web app)

### 2. Backend Setup

```bash
cd backend
npm install
# Configure .env file (see backend/README.md)
npm run dev
```

Backend runs on http://localhost:3001

### 3. Frontend Setup

```bash
cd frontend
npm install
# Configure Firebase config (see frontend/README.md)
npm run dev
```

Frontend runs on http://localhost:5173

## Features

- **Authentication**: Firebase Auth with email/password
- **Recipe List**: View all recipes (public, any user can read)
- **Add Recipe**: Two modes:
  - Manual entry with structured ingredient input
  - URL scraping to extract recipe data from websites
- **Edit Recipe**: Modify title, description, ingredients, instructions
- **Cost Optimization**: Single Firestore read per session, Redux state management

## Architecture

- **Frontend**: React 19 + Redux Toolkit + TypeScript + Vite
- **Backend**: Fastify + TypeScript + Firebase Admin
- **Database**: Firestore
- **Auth**: Firebase Authentication

## Development

Both frontend and backend run independently with hot-reload. The frontend calls the backend API for recipe scraping only. Manual recipe entry writes directly to Firestore from the frontend.

## Deployment

Frontend and backend can be deployed separately:
- **Frontend**: Firebase Hosting, Vercel, Netlify, etc.
- **Backend**: Cloud Run, Railway, Render, etc.

## License

Private project


# Recipe Frontend

React + Redux + TypeScript frontend for recipe management.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Firebase

Copy the Firebase configuration template:

```bash
cp src/firebase/config.template.ts src/firebase/config.ts
```

Then edit `src/firebase/config.ts` and replace the placeholder values with your Firebase project credentials.

To get these values:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to Project Settings (gear icon) → General
4. Scroll to "Your apps" and copy the config object

### 3. Configure Backend URL (Optional)

Create a `.env` file in this directory:

```env
VITE_API_URL=http://localhost:3001
```

This is already the default, but you can change it if your backend runs on a different port.

### 4. Run Development Server

```bash
npm run dev
```

Frontend will run on http://localhost:5173

## Features

- **Authentication**: Email/password login and signup
- **Recipe List**: View all recipes with single Firestore read per session
- **Add Recipe**: Two modes:
  - Manual entry with structured ingredients
  - URL scraping via backend API
- **Redux State**: Optimized to minimize Firestore reads
- **Persistence**: Redux state persisted across sessions

## Project Structure

```
src/
├── features/
│   ├── auth/              # Authentication screens
│   ├── recipe-list/       # Recipe list view
│   └── add-recipe/        # Add/edit recipe form
├── firebase/
│   ├── config.ts          # Firebase configuration
│   ├── auth.ts            # Auth helper functions
│   └── firestore.ts       # Firestore CRUD operations
├── common/
│   ├── store.ts           # Redux store configuration
│   ├── hooks.ts           # Typed Redux hooks
│   └── slices/
│       └── recipes.ts     # Recipes Redux slice
├── types/
│   └── index.ts           # TypeScript interfaces
├── App.tsx                # Main app with routing
└── main.tsx               # Entry point
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

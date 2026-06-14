# Family Recipe & Shopping App — Implementation Plan

> **Purpose of this document**: Describe the technology choices, project structure, and architectural decisions. Consult the code directly for file-level or function-level details. For what the app *does*, see `SPEC.md`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Redux Toolkit, TypeScript, Vite |
| Backend | Fastify, TypeScript |
| Auth | Firebase Authentication |
| Database | Firestore (real-time NoSQL) |
| Hosting | Firebase / Vite preview (TBD) |
| PWA | Vite PWA plugin (Workbox service worker) |

---

## Monorepo Structure

```
lists/
├── frontend/       # React PWA
├── backend/        # Fastify API server
└── shared/
    └── types/      # TypeScript types shared between frontend and backend
```

Shared types live in `shared/types/index.ts`. Both frontend and backend import from there to keep the data model consistent. The key types are `Recipe`, `Ingredient`, `ShoppingItem`, `Tag`, `ShoppingGroup`, `MealPlanItem`, and the `UnitValue` enum.

---

## Frontend Architecture

### Entry Point & Routing

`App.tsx` is the root. It wraps everything in the Redux `Provider` and `PersistGate`. Auth state is observed here via a Firebase listener; until auth resolves, a loading screen is shown.

Routing is handled by React Router. There are two route trees:

- **Unauthenticated**: `/auth` only; all other paths redirect there.
- **Authenticated**: Three primary routes wrapped in `AppShell`, plus several detail/edit routes that use `PageScrollWrapper` instead.

### AppShell

`AppShell` renders the persistent bottom navigation (Recipes / Shopping / Meal Plan tabs) and wraps the active tab's content. It is only used for the three main tab routes. Detail views (recipe view, recipe editor, shopping item editor) are full-screen with their own headers and no tab bar.

`PageScrollWrapper` is a thin wrapper that handles scroll containment for full-screen non-tab views.

### Features

Each major area lives in `frontend/src/features/`:

| Feature | Route(s) | Description |
|---|---|---|
| `auth` | `/auth` | Login / sign-up screen |
| `recipe-list` | `/recipe-list` | Recipe library, search, compact list |
| `recipe` | `/recipe/:id`, `/edit-recipe/:id`, `/recipe-start` | View, edit, and add recipe flows |
| `shopping` | `/shopping`, `/shopping/edit/:itemId` | Shopping list with full list logic |
| `mealplan` | `/mealplan` | Meal plan calendar |
| `ai-debug` | `/ai-debug` | Developer debug screen for AI parsing |

Shared UI components live in `frontend/src/common/components/`.

### Common Utilities & Hooks

`frontend/src/common/` contains:
- `hooks/` — custom hooks: `useAppSelector`, `useAppDispatch`, `useNavigateWithDebug`, `useOnlineStatus`, `useWakeLock`, `useAddRecipeToCart`, `usePWAInstall`, `useAutoHeight`, `useDebugMode`
- `aiParsing.ts` — client-side ingredient text parsing logic
- `ingredientDisplay.ts` — formatting aggregated ingredient amounts for display
- `pluralize.ts` — pluralization utility

### Firebase

`frontend/src/firebase/` contains:
- `auth.ts` — Firebase Auth wrappers (sign in, sign out, Google sign in, ID token)
- `firestore.ts` — All Firestore read/write operations for the app (recipes, shopping items, tags, groups, meal plan items)

---

## Redux Store

The store is configured in `frontend/src/common/store.ts`. It uses `redux-persist` to cache the recipes slice to `localStorage`, avoiding redundant Firestore reads across sessions. Shopping and meal plan slices are not persisted — they use real-time listeners instead.

### Slices

#### `auth`
Holds the signed-in user (`uid`, `email`, `displayName`) and loading/error state. Populated by a Firebase Auth listener in `App.tsx`. The Firebase `User` object is converted to a plain serializable object before being stored.

#### `recipes`
Holds the recipe array, loading, and error. Recipes are loaded **once** from Firestore on the recipe list mount (not via real-time listener) and persisted to localStorage. All mutations (add, update, delete) update Redux immediately and write to Firestore asynchronously. This minimizes Firestore reads since the cached recipes survive page reloads.

#### `shopping`
Holds shopping items, tags, custom groups, view mode, and selected tag filter. Shopping is driven by **real-time Firestore subscriptions** — the slice is populated by subscription callbacks. New items are added **optimistically**: the item appears in Redux immediately with a temporary ID, and the Firestore write plus AI parsing happen in the background. The `pendingOptimisticIds` set prevents subscription snapshots from overwriting optimistic items before the write completes. View mode and selected tags are also persisted to `localStorage` directly (not via redux-persist).

#### `mealplan`
Holds meal plan items. Also driven by a real-time Firestore subscription. Uses the same optimistic add pattern as the shopping slice.

---

## Data Strategy Summary

| Data | Strategy |
|---|---|
| Recipes | Load once, persist to localStorage, update Redux on CRUD |
| Shopping items | Real-time subscription + optimistic adds |
| Shopping tags | Real-time subscription |
| Shopping groups | Real-time subscription |
| Meal plan items | Real-time subscription + optimistic adds |

---

## Backend Architecture

The backend is a minimal Fastify server. Its only current responsibility is recipe scraping — all other Firestore writes are done directly from the frontend.

### Auth

All requests are authenticated via Firebase ID tokens passed in the `Authorization: Bearer <token>` header. A Fastify middleware (`middleware/auth.ts`) verifies the token using the Firebase Admin SDK and attaches the decoded user info to the request.

### Services

- `services/scraper.ts` — fetches a recipe URL and extracts recipe data. Prioritizes JSON-LD structured data (`@graph` + Recipe objects), falls back to HTML parsing with Cheerio.
- `services/ai.ts` — uses an AI model to parse ingredient strings into structured `amount / unit / name` fields. Also performs AI-assisted parsing of the full recipe to normalize categories, cuisines, keywords, and ingredient structure.
- `services/firestore.ts` — Firebase Admin SDK wrapper for writing scraped recipes to Firestore.
- `services/firebase.ts` — Firebase Admin SDK initialization.

### API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/scrape` | Scrape a recipe from a URL, AI-parse ingredients, save to Firestore, return the recipe |

---

## Shared Types

`shared/types/index.ts` is the single source of truth for the data model. Key types:

- `Ingredient` — structured ingredient with `amount`, `unit`, `name`, `originalText`, AI fields, and optional `section`
- `RecipeContent` / `RecipeBase<DateType>` — recipe schema; `DateType` is `Date` on the backend, `string` on the frontend (Redux serialization requirement)
- `ShoppingItem` / `ShoppingItemBase<DateType>` — shopping list item
- `Tag` — colored label for shopping items
- `ShoppingGroup` — user-created named group for shopping items
- `MealPlanItem` — a recipe or note on a specific day
- `CombinedItem` — display-only type for aggregated shopping items (same ingredient from multiple sources)
- `GroupedItems` — display-only type for the recipe-grouped view
- `UnitValue` — enum of all recognized units (cups, tablespoons, pounds, etc.)

---

## Key Architectural Decisions

**Why load recipes once instead of real-time?**
Recipe data changes infrequently. Loading once and persisting to `localStorage` keeps the recipe list fast and minimizes Firestore reads (cost control). Shopping and meal plan data changes frequently and benefits from real-time sync.

**Why write shopping/meal plan items directly from the frontend?**
The backend is only needed for scraping (which requires server-side HTTP and AI access). Everything else goes directly to Firestore from the frontend using Firebase client SDK, keeping latency low and the backend simple.

**Why optimistic updates?**
Shopping list items need to feel instant — the user types an item and moves on. The optimistic pattern shows the item immediately, parses and persists in the background, and reconciles via the real-time subscription.

**Shared types package**
Frontend and backend share a single `shared/types/` directory imported by both projects. This ensures the data model can't silently diverge between layers.

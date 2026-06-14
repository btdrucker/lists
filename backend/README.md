# Backend

For setup and deployment, see the root [README](../README.md) and [DEPLOYMENT.md](../DEPLOYMENT.md).

## Backend-Specific Environment Variables

The following variables are in addition to the Firebase credentials documented in the root README. They control AI integration:

```env
# Vertex AI (default AI path — uses the Firebase service account)
VERTEX_AI_PROJECT_ID=listster-test   # defaults to FIREBASE_PROJECT_ID if omitted
VERTEX_AI_LOCATION=us-central1

# Legacy Gemini API key (only if not using Vertex AI)
# GEMINI_API_KEY=your-api-key
```

## API Endpoints

All endpoints require `Authorization: Bearer <firebase-id-token>`.

### POST `/scrape`

Scrapes a recipe from a URL, parses ingredients with AI, saves to Firestore, and returns the full recipe.

**Request body:**
```json
{ "url": "https://example.com/recipe" }
```

**Response:**
```json
{
  "success": true,
  "recipe": {
    "id": "...",
    "userId": "...",
    "title": "...",
    "ingredients": [...],
    "instructions": [...],
    "sourceUrl": "...",
    "isPublic": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### GET `/ai-health`

Smoke test for AI connectivity.

**Response:** `{ "status": "ok", "timestamp": "..." }`

### POST `/ai-debug`

Used by the in-app AI debug screen. Sends a raw prompt to the AI and returns the response.

**Request body:**
```json
{
  "systemInstruction": "...",
  "userPrompt": "..."
}
```

**Response:** `{ "status": "ok", "mode": "vertex", "rawText": "...", "ingredientCount": 2, "timestamp": "..." }`

## Scripts

- `npm run dev` — development server with hot-reload (http://localhost:3001)
- `npm run build` — production build
- `npm start` — run production build

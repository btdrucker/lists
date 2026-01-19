# EditRecipe Backend Service

Fastify + TypeScript backend for recipe scraping.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in this directory with:

```env
# Firebase Admin SDK Configuration
# Get these from: Firebase Console → Project Settings → Service Accounts → Generate new private key

FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com

# Server Configuration
PORT=3001
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173

# Optional AI settings (Vertex AI via service account)
# VERTEX_AI_PROJECT_ID defaults to FIREBASE_PROJECT_ID when omitted
VERTEX_AI_PROJECT_ID=listster-test
VERTEX_AI_LOCATION=us-central1

# Optional legacy Gemini API key (if not using Vertex AI)
# GEMINI_API_KEY=your-api-key
```

**Note**: The private key must be wrapped in quotes and include the `\n` newline characters.

### 3. Run Development Server

```bash
npm run dev
```

Server will run on http://localhost:3001 with hot-reload.

## API Endpoints

### POST `/scrape`

Scrape a recipe from a URL.

**Headers**:
```
Authorization: Bearer <firebase-id-token>
```

**Request Body**:
```json
{
  "url": "https://example.com/recipe"
}
```

### GET `/ai-health`

Smoke test for AI connectivity (Vertex AI or API key path).

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-25T..."
}
```

### POST `/ai-debug`

Debug endpoint used by the AI prompt testing UI.

**Request Body**:
```json
{
  "systemInstruction": "Normalize these ingredient strings...",
  "userPrompt": "Ingredients:\n1 cup diced tomatoes\n2 tsp olive oil"
}
```

**Response**:
```json
{
  "status": "ok",
  "mode": "vertex",
  "rawText": "[{\"amount\":1,\"unit\":\"CUP\",\"name\":\"diced tomatoes\"}]",
  "ingredientCount": 2,
  "timestamp": "2025-12-25T..."
}
```

**Response**:
```json
{
  "success": true,
  "recipe": {
    "id": "generated-id",
    "userId": "user-uid",
    "title": "EditRecipe Title",
    "description": "EditRecipe description",
    "ingredients": [...],
    "instructions": [...],
    "sourceUrl": "https://example.com/recipe",
    "isPublic": true,
    "createdAt": "2025-12-25T...",
    "updatedAt": "2025-12-25T..."
  }
}
```

## Project Structure

```
src/
├── index.ts              # Main server setup
├── middleware/
│   └── auth.ts           # Firebase Auth token verification
├── routes/
│   └── scrape.ts         # EditRecipe scraping endpoint
├── services/
│   ├── scraper.ts        # Web scraping logic
│   └── firestore.ts      # Firestore operations
└── types/
    └── index.ts          # TypeScript interfaces
```

## Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build for production
- `npm start` - Run production build

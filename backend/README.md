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

# Shared Types

This package contains TypeScript types shared between the frontend and backend of the Lists app.

## Purpose

Eliminates type duplication and ensures frontend and backend use consistent data structures.

## Key Types

### `Ingredient`
Structure for recipe ingredients with amount, unit, name, and section support.

### `RecipeContent`
Core recipe data that can be scraped or user-provided:
- title, description, notes
- ingredients, instructions
- imageUrl, servings, prepTime, cookTime, tags

### `RecipeBase<DateType>`
Generic recipe type with flexible date handling:
- Backend uses `RecipeBase<Date>` (for Firestore)
- Frontend uses `RecipeBase<string>` (for Redux serialization)

### `ExtractionMethod`
Backend-only type tracking which scraping method was used: `'WPRM' | 'DataAttributes' | 'JSON-LD' | 'HTML'`

## Usage

### Backend
```typescript
import type { RecipeBase, ExtractionMethod } from '../../../shared/types/index.js';

export interface EditRecipe extends RecipeBase<Date> {
  extractionMethod?: ExtractionMethod;
}
```

### Frontend
```typescript
import type { RecipeBase } from '../../../shared/types/index.js';

export interface EditRecipe extends RecipeBase<string> {
  // ISO string dates for Redux
}
```

## Adding New Fields

To add a field that should be shared:
1. Add to `RecipeContent` in `shared/types/index.ts`
2. Field automatically available in both frontend and backend EditRecipe types
3. No duplicate definitions needed!

## Notes Field

The `notes` field was added to fix a latent bug where user notes weren't being saved to Firestore. It's now properly included in the shared `RecipeContent` type.

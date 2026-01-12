// Re-export shared types
export type { 
  Ingredient, 
  RecipeContent, 
  RecipeBase 
} from '../../../shared/types/index.js';
import type { RecipeBase } from '../../../shared/types/index.js';

// Frontend-specific Recipe type with ISO string dates (for Redux serialization)
export interface Recipe extends RecipeBase<string> {
  // All fields from RecipeBase, but createdAt/updatedAt are strings
}

export interface SerializableUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthState {
  user: SerializableUser | null;
  loading: boolean;
  error: string | null;
}


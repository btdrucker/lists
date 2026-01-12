// Re-export shared types
export type {
  Ingredient,
  RecipeContent,
  RecipeBase,
  ExtractionMethod
} from '../../../shared/types/index.js';
import type { RecipeBase, ExtractionMethod } from '../../../shared/types/index.js';

// Backend-specific EditRecipe type with Date objects and extraction metadata
export interface Recipe extends RecipeBase<Date> {
  extractionMethod?: ExtractionMethod;
}

export interface ScrapeRequest {
  url: string;
}

export interface ScrapeResponse {
  success: boolean;
  recipe?: Recipe;
  error?: string;
}

export interface AuthUser {
  uid: string;
  email?: string;
}

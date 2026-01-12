export interface Ingredient {
  amount: number | null;
  amountMax?: number | null;
  unit: string | null;
  name: string;
  section?: string;
  optional?: boolean;
  originalText: string;
}

// Shared recipe content (what you get from scraping or user input)
export interface RecipeContent {
  title: string;
  description?: string;
  notes?: string;
  ingredients: Ingredient[];
  instructions: string[];
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
}

// Generic recipe with flexible date type
// Backend uses Date, frontend uses string
export interface RecipeBase<DateType = Date> extends RecipeContent {
  id: string;
  userId: string;
  sourceUrl?: string;
  isPublic: boolean;
  createdAt: DateType;
  updatedAt: DateType;
}

// Scraping-specific metadata (backend only, not in shared base)
export type ExtractionMethod = 'WPRM' | 'DataAttributes' | 'JSON-LD' | 'HTML';

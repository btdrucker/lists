export interface Ingredient {
  amount: number | null;
  amountMax?: number | null;
  unit: UnitValue | null;
  name: string;
  section?: string;
  optional?: boolean;
  originalText: string;
}

export const UnitValue = {
  // Volume
  CUP: 'CUP',
  TABLESPOON: 'TABLESPOON',
  TEASPOON: 'TEASPOON',
  FLUID_OUNCE: 'FLUID_OUNCE',
  MILLILITER: 'MILLILITER',
  LITER: 'LITER',
  PINT: 'PINT',
  QUART: 'QUART',
  GALLON: 'GALLON',
  // Weight
  POUND: 'POUND',
  OUNCE: 'OUNCE',
  GRAM: 'GRAM',
  KILOGRAM: 'KILOGRAM',
  // Count/Pieces
  PIECE: 'PIECE',
  WHOLE: 'WHOLE',
  CLOVE: 'CLOVE',
  SLICE: 'SLICE',
  CAN: 'CAN',
  PACKAGE: 'PACKAGE',
  JAR: 'JAR',
  BUNCH: 'BUNCH',
  HEAD: 'HEAD',
  STALK: 'STALK',
  SPRIG: 'SPRIG',
  LEAF: 'LEAF',
  // Special
  PINCH: 'PINCH',
  DASH: 'DASH',
  HANDFUL: 'HANDFUL',
  TO_TASTE: 'TO_TASTE',
} as const;

export type UnitValue = typeof UnitValue[keyof typeof UnitValue];

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
  category?: string[];   // e.g., ["Dinner", "Main"]
  cuisine?: string[];    // e.g., ["American", "Italian"]
  keywords?: string[];   // e.g., ["vegetarian", "quick", "comfort-food"]
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

export interface Ingredient {
  amount: number | null;
  amountMax?: number | null;
  unit: UnitValue | null;
  name: string;
  section?: string;
  optional?: boolean;
  originalText: string;
  parseConfidence?: number;
  aiAmount?: number | null;
  aiUnit?: UnitValue | null;
  aiName?: string | null;
}

export interface AiParsingMetadata {
  aiParsingStatus?: 'done' | 'required';
  lastAiParsingVersion?: number | null;
}

export const UnitValue = {
  // Volume
  CUP: 'CUP',
  TABLESPOON: 'TABLESPOON',
  TEASPOON: 'TEASPOON',
  FLUID_OUNCE: 'FLUID_OUNCE',
  QUART: 'QUART',
  // Weight
  POUND: 'POUND',
  WEIGHT_OUNCE: 'WEIGHT_OUNCE',
  // Count/Pieces
  EACH: 'EACH',
  CLOVE: 'CLOVE',
  SLICE: 'SLICE',
  CAN: 'CAN',
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

// ============================================================================
// Shopping List Types
// ============================================================================

// Shopping List Item (ephemeral, per shopping trip)
export interface ShoppingItemBase<DateType = Date> {
  id: string;
  familyId: string; // For multi-family future
  amount: number | null;
  unit: UnitValue | null;
  name: string;
  isChecked: boolean;
  storeTagIds: string[];
  sourceRecipeId?: string; // undefined = manual item
  customGroupId?: string; // Link to custom shopping group
  createdAt: DateType;
  updatedAt: DateType;
}

// Frontend: uses string dates (Redux serialization)
export type ShoppingItem = ShoppingItemBase<string>;

// Backend: uses Date objects (if needed)
export type ShoppingItemDoc = ShoppingItemBase<Date>;

// Store entity
export interface StoreBase<DateType = Date> {
  id: string;
  familyId: string;
  displayName: string;
  abbreviation: string;
  color: string;
  sortOrder: number;
  createdAt: DateType;
  updatedAt: DateType;
}

export type Store = StoreBase<string>;
export type StoreDoc = StoreBase<Date>;

// Shopping Group (user-created custom groups)
export interface ShoppingGroupBase<DateType = Date> {
  id: string;
  familyId: string;
  displayName: string;
  sortOrder: number; // Used for creation order (timestamp-based)
  createdAt: DateType;
  updatedAt: DateType;
}

export type ShoppingGroup = ShoppingGroupBase<string>;
export type ShoppingGroupDoc = ShoppingGroupBase<Date>;

// Item Profile (future, deferred)
export interface ItemProfileBase<DateType = Date> {
  id: string;
  familyId: string;
  name: string; // normalized ingredient name
  recentUsages: Array<{
    timestamp: DateType;
    storeIds: string[];
  }>;
  createdAt: DateType;
  updatedAt: DateType;
}

export type ItemProfile = ItemProfileBase<string>;

// Display-only types for UI (not stored in Firestore)
export interface CombinedItem {
  key: string; // normalized name + unit for grouping
  name: string;
  amount: number | null;
  unit: UnitValue | null;
  isChecked: boolean;
  isIndeterminate: boolean; // true when some but not all source items are checked
  storeTagIds: string[];
  sourceItemIds: string[]; // IDs of contributing items
}

export interface GroupedItems {
  recipeGroups: Array<{
    recipeId: string;
    recipeTitle: string;
    items: ShoppingItem[];
  }>;
  customGroups: Array<{
    groupId: string;
    groupName: string;
    items: ShoppingItem[];
  }>;
  manualItems: ShoppingItem[];
}

// Re-export shared types
export type {
  Ingredient,
  RecipeContent,
  RecipeBase,
  AiParsingMetadata,
  // Shopping list types
  ShoppingItem,
  ShoppingItemBase,
  Tag,
  TagBase,
  ShoppingGroup,
  ShoppingGroupBase,
  ItemProfile,
  CombinedItem,
  GroupedItems,
} from '../../../shared/types/index.js';
export { UnitValue } from '../../../shared/types/index.js';
import type { RecipeBase } from '../../../shared/types';

// Frontend-specific EditRecipe type with ISO string dates (for Redux serialization)
export type Recipe = RecipeBase<string>

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

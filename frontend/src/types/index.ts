export interface Ingredient {
  amount: number | null;
  amountMax?: number | null;
  unit: string | null;
  name: string;
  optional?: boolean;
  originalText: string;
}

export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  sourceUrl?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  isPublic: boolean;
  createdAt: string;  // ISO string for Redux serialization
  updatedAt: string;  // ISO string for Redux serialization
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


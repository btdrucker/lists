export interface Ingredient {
  amount: number | null;
  amountMax?: number | null;
  unit: string | null;
  name: string;
  section?: string;
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
  createdAt: Date;
  updatedAt: Date;
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


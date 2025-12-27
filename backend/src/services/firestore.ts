import { firestore } from './firebase.js';
import { Recipe } from '../types/index.js';

export async function saveRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
  const recipesRef = firestore.collection('recipes');
  const docRef = await recipesRef.add({
    ...recipe,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const savedRecipe: Recipe = {
    ...recipe,
    id: docRef.id,
  };

  return savedRecipe;
}

export async function getRecipeById(recipeId: string): Promise<Recipe | null> {
  const docRef = firestore.collection('recipes').doc(recipeId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
  } as Recipe;
}

export async function getRecipesByUserId(userId: string): Promise<Recipe[]> {
  const recipesRef = firestore.collection('recipes');
  const snapshot = await recipesRef.where('userId', '==', userId).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Recipe[];
}

export async function updateRecipe(
  recipeId: string,
  updates: Partial<Recipe>
): Promise<void> {
  const docRef = firestore.collection('recipes').doc(recipeId);
  await docRef.update({
    ...updates,
    updatedAt: new Date(),
  });
}

export async function deleteRecipe(recipeId: string): Promise<void> {
  const docRef = firestore.collection('recipes').doc(recipeId);
  await docRef.delete();
}


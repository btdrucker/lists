import { firestore, firebaseAdmin } from './firebase.js';
import { Recipe } from '../types/index.js';

export async function saveRecipe(recipe: Omit<Recipe, 'id'>): Promise<Recipe> {
  try {
    console.log('[FIRESTORE] Getting recipes collection...');
    const recipesRef = firestore.collection('recipes');
    console.log('[FIRESTORE] Adding document...');
    console.log('[FIRESTORE] Recipe data keys:', Object.keys(recipe));
    
    // Add with timeout
    const addPromise = recipesRef.add({
      ...recipe,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Firestore add timeout after 10 seconds')), 10000);
    });
    
    const docRef = await Promise.race([addPromise, timeoutPromise]) as FirebaseFirestore.DocumentReference;
    console.log('[FIRESTORE] Document added with ID:', docRef.id);

    const savedRecipe: Recipe = {
      ...recipe,
      id: docRef.id,
    };

    return savedRecipe;
  } catch (error) {
    console.error('[FIRESTORE] Error saving recipe:', error);
    throw error;
  }
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


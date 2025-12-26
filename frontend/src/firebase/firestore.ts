import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { Recipe } from '../types/index.ts';

// Get all recipes (any user can read any recipe per security rules)
export const getAllRecipes = async (): Promise<Recipe[]> => {
  const recipesRef = collection(db, 'recipes');
  const snapshot = await getDocs(recipesRef);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Recipe[];
};

// Get recipes by user ID
export const getRecipesByUserId = async (userId: string): Promise<Recipe[]> => {
  const recipesRef = collection(db, 'recipes');
  const q = query(recipesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Recipe[];
};

// Get single recipe by ID
export const getRecipeById = async (recipeId: string): Promise<Recipe | null> => {
  const docRef = doc(db, 'recipes', recipeId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  return {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as Recipe;
};

// Add new recipe
export const addRecipe = async (recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recipe> => {
  const recipesRef = collection(db, 'recipes');
  const now = Timestamp.now();
  
  const docRef = await addDoc(recipesRef, {
    ...recipe,
    createdAt: now,
    updatedAt: now,
  });
  
  return {
    ...recipe,
    id: docRef.id,
    createdAt: now.toDate(),
    updatedAt: now.toDate(),
  };
};

// Update existing recipe
export const updateRecipe = async (recipeId: string, updates: Partial<Recipe>): Promise<void> => {
  const docRef = doc(db, 'recipes', recipeId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Delete recipe
export const deleteRecipe = async (recipeId: string): Promise<void> => {
  const docRef = doc(db, 'recipes', recipeId);
  await deleteDoc(docRef);
};


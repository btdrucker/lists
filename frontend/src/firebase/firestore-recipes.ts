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
import type { DocumentSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { Recipe } from '../types/index.ts';
import { mapFirestoreDoc, timestampToISO } from './firestore-utils';

function mapRecipe(docSnap: DocumentSnapshot): Recipe {
  return mapFirestoreDoc(docSnap, (id, data) => {
    const { createdAt, updatedAt, ...rest } = data;
    return {
      ...(rest as Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>),
      id,
      createdAt: timestampToISO(createdAt),
      updatedAt: timestampToISO(updatedAt),
    };
  });
}

export const getAllRecipes = async (): Promise<Recipe[]> => {
  const recipesRef = collection(db, 'recipes');
  const snapshot = await getDocs(recipesRef);
  return snapshot.docs.map(mapRecipe);
};

export const getRecipesByUserId = async (userId: string): Promise<Recipe[]> => {
  const recipesRef = collection(db, 'recipes');
  const q = query(recipesRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapRecipe);
};

export const getRecipeById = async (recipeId: string): Promise<Recipe | null> => {
  const docRef = doc(db, 'recipes', recipeId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  return mapRecipe(docSnap);
};

export const addRecipe = async (
  recipe: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Recipe> => {
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
    createdAt: timestampToISO(now),
    updatedAt: timestampToISO(now),
  };
};

export const updateRecipe = async (
  recipeId: string,
  updates: Partial<Recipe>,
): Promise<void> => {
  const docRef = doc(db, 'recipes', recipeId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteRecipe = async (recipeId: string): Promise<void> => {
  const docRef = doc(db, 'recipes', recipeId);
  await deleteDoc(docRef);
};

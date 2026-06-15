import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  onSnapshot,
} from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { MealPlanItem } from '../types/index.ts';
import { mapFirestoreDoc, timestampToISO } from './firestore-utils';

function mapMealPlanItem(docSnap: DocumentSnapshot): MealPlanItem {
  return mapFirestoreDoc(docSnap, (id, data) => {
    const { createdAt, updatedAt, ...rest } = data;
    return {
      ...(rest as Omit<MealPlanItem, 'id' | 'createdAt' | 'updatedAt'>),
      id,
      createdAt: timestampToISO(createdAt),
      updatedAt: timestampToISO(updatedAt),
    };
  });
}

export const getMealPlanItems = async (familyId: string): Promise<MealPlanItem[]> => {
  const itemsRef = collection(db, 'mealPlanItems');
  const q = query(itemsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapMealPlanItem);
};

export const addMealPlanItem = async (
  item: Omit<MealPlanItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<MealPlanItem> => {
  const itemsRef = collection(db, 'mealPlanItems');
  const now = Timestamp.now();
  const docRef = await addDoc(itemsRef, {
    ...item,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...item,
    id: docRef.id,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
};

export const updateMealPlanItem = async (
  itemId: string,
  updates: Partial<MealPlanItem>,
): Promise<void> => {
  const docRef = doc(db, 'mealPlanItems', itemId);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error: unknown) {
    const firestoreError = error as { code?: string };
    if (firestoreError.code === 'not-found') {
      console.log('Meal plan item no longer exists, skipping update');
    } else {
      throw error;
    }
  }
};

export const deleteMealPlanItem = async (itemId: string): Promise<void> => {
  const docRef = doc(db, 'mealPlanItems', itemId);
  await deleteDoc(docRef);
};

export const subscribeToMealPlanItems = (
  familyId: string,
  callback: (items: MealPlanItem[]) => void,
): (() => void) => {
  const q = query(collection(db, 'mealPlanItems'), where('familyId', '==', familyId));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(mapMealPlanItem)),
    (error) => {
      console.error('Error subscribing to meal plan items:', error);
      callback([]);
    },
  );
};

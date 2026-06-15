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
  writeBatch,
} from 'firebase/firestore';
import type { DocumentSnapshot } from 'firebase/firestore';
import { db } from './config';
import type { ShoppingItem, ShoppingGroup } from '../types/index.ts';
import { mapFirestoreDoc, timestampToISO } from './firestore-utils';

// ============================================================================
// Shopping Items
// ============================================================================

function mapShoppingItem(docSnap: DocumentSnapshot): ShoppingItem {
  return mapFirestoreDoc(docSnap, (id, data) => {
    const { createdAt, updatedAt, tagIds, ...rest } = data;
    return {
      ...(rest as Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt' | 'tagIds'>),
      id,
      tagIds: Array.isArray(tagIds) ? (tagIds as string[]) : [],
      createdAt: timestampToISO(createdAt),
      updatedAt: timestampToISO(updatedAt),
    };
  });
}

export const getShoppingItems = async (familyId: string): Promise<ShoppingItem[]> => {
  const itemsRef = collection(db, 'shoppingItems');
  const q = query(itemsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapShoppingItem);
};

export const addShoppingItem = async (
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ShoppingItem> => {
  const itemsRef = collection(db, 'shoppingItems');
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

export const updateShoppingItem = async (
  itemId: string,
  updates: Partial<ShoppingItem>,
): Promise<void> => {
  const docRef = doc(db, 'shoppingItems', itemId);
  try {
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error: unknown) {
    const firestoreError = error as { code?: string };
    if (firestoreError.code === 'not-found') {
      // Item was deleted by another user — expected in a collaborative environment
      console.log('Item no longer exists, skipping update');
    } else {
      throw error;
    }
  }
};

export const deleteShoppingItem = async (itemId: string): Promise<void> => {
  const docRef = doc(db, 'shoppingItems', itemId);
  await deleteDoc(docRef);
};

export const bulkDeleteShoppingItems = async (itemIds: string[]): Promise<void> => {
  if (itemIds.length === 0) return;
  const batch = writeBatch(db);
  itemIds.forEach((id) => {
    batch.delete(doc(db, 'shoppingItems', id));
  });
  await batch.commit();
};

export const subscribeToShoppingItems = (
  familyId: string,
  callback: (items: ShoppingItem[]) => void,
): (() => void) => {
  const q = query(collection(db, 'shoppingItems'), where('familyId', '==', familyId));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(mapShoppingItem)),
    (error) => {
      console.error('Error subscribing to shopping items:', error);
      callback([]);
    },
  );
};

// ============================================================================
// Shopping Groups
// ============================================================================

function mapShoppingGroup(docSnap: DocumentSnapshot): ShoppingGroup {
  return mapFirestoreDoc(docSnap, (id, data) => {
    const { createdAt, updatedAt, ...rest } = data;
    return {
      ...(rest as Omit<ShoppingGroup, 'id' | 'createdAt' | 'updatedAt'>),
      id,
      createdAt: timestampToISO(createdAt),
      updatedAt: timestampToISO(updatedAt),
    };
  });
}

export const getShoppingGroups = async (familyId: string): Promise<ShoppingGroup[]> => {
  const groupsRef = collection(db, 'shoppingGroups');
  const q = query(groupsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapShoppingGroup);
};

export const addShoppingGroup = async (
  group: Omit<ShoppingGroup, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ShoppingGroup> => {
  const groupsRef = collection(db, 'shoppingGroups');
  const now = Timestamp.now();
  const docRef = await addDoc(groupsRef, {
    ...group,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...group,
    id: docRef.id,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
};

export const updateShoppingGroup = async (
  groupId: string,
  updates: Partial<ShoppingGroup>,
): Promise<void> => {
  const docRef = doc(db, 'shoppingGroups', groupId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteShoppingGroup = async (groupId: string): Promise<void> => {
  const docRef = doc(db, 'shoppingGroups', groupId);
  await deleteDoc(docRef);
};

export const subscribeToShoppingGroups = (
  familyId: string,
  callback: (groups: ShoppingGroup[]) => void,
): (() => void) => {
  const q = query(collection(db, 'shoppingGroups'), where('familyId', '==', familyId));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(mapShoppingGroup)),
    (error) => {
      console.error('Error subscribing to shopping groups:', error);
      callback([]);
    },
  );
};

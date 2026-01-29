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
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Recipe, ShoppingItem, Store, ShoppingGroup } from '../types/index.ts';

// Get all recipes (any user can read any recipe per security rules)
export const getAllRecipes = async (): Promise<Recipe[]> => {
  const recipesRef = collection(db, 'recipes');
  const snapshot = await getDocs(recipesRef);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Convert Firestore Timestamps to ISO strings for Redux serialization
      createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
      updatedAt: (data.updatedAt?.toDate?.() || new Date()).toISOString(),
    };
  }) as Recipe[];
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
  
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    // Convert Firestore Timestamps to ISO strings
    createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
    updatedAt: (data.updatedAt?.toDate?.() || new Date()).toISOString(),
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
    // Return ISO strings for Redux serialization
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
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

// ============================================================================
// Shopping Items
// ============================================================================

// Get all shopping items for a family
export const getShoppingItems = async (familyId: string): Promise<ShoppingItem[]> => {
  const itemsRef = collection(db, 'shoppingItems');
  const q = query(itemsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
      updatedAt: (data.updatedAt?.toDate?.() || new Date()).toISOString(),
    };
  }) as ShoppingItem[];
};

// Add new shopping item
export const addShoppingItem = async (
  item: Omit<ShoppingItem, 'id' | 'createdAt' | 'updatedAt'>
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

// Update shopping item with error handling for concurrent deletes
export const updateShoppingItem = async (
  itemId: string,
  updates: Partial<ShoppingItem>
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
      // Item was deleted by another user - expected in collaborative environment
      console.log('Item no longer exists, skipping update');
    } else {
      throw error;
    }
  }
};

// Delete single shopping item
export const deleteShoppingItem = async (itemId: string): Promise<void> => {
  const docRef = doc(db, 'shoppingItems', itemId);
  await deleteDoc(docRef);
};

// Bulk delete shopping items (atomic operation)
export const bulkDeleteShoppingItems = async (itemIds: string[]): Promise<void> => {
  if (itemIds.length === 0) return;

  // Use writeBatch for atomic operations
  const batch = writeBatch(db);

  itemIds.forEach((id) => {
    const docRef = doc(db, 'shoppingItems', id);
    batch.delete(docRef);
  });

  // All deletes succeed or all fail (atomicity)
  await batch.commit();
};

// Real-time listener for shopping items
export const subscribeToShoppingItems = (
  familyId: string,
  callback: (items: ShoppingItem[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'shoppingItems'),
    where('familyId', '==', familyId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as ShoppingItem;
      });
      callback(items);
    },
    (error) => {
      console.error('Error subscribing to shopping items:', error);
      // Return empty array to unblock UI and allow user to see the error
      callback([]);
    }
  );

  return unsubscribe;
};

// ============================================================================
// Stores
// ============================================================================

// Get all stores for a family
export const getStores = async (familyId: string): Promise<Store[]> => {
  const storesRef = collection(db, 'stores');
  const q = query(storesRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
      updatedAt: (data.updatedAt?.toDate?.() || new Date()).toISOString(),
    };
  }) as Store[];
};

// Add new store
export const addStore = async (
  store: Omit<Store, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Store> => {
  const storesRef = collection(db, 'stores');
  const now = Timestamp.now();

  const docRef = await addDoc(storesRef, {
    ...store,
    createdAt: now,
    updatedAt: now,
  });

  return {
    ...store,
    id: docRef.id,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
};

// Update store
export const updateStore = async (
  storeId: string,
  updates: Partial<Store>
): Promise<void> => {
  const docRef = doc(db, 'stores', storeId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Real-time listener for stores
export const subscribeToStores = (
  familyId: string,
  callback: (stores: Store[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'stores'),
    where('familyId', '==', familyId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const stores = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as Store;
      });
      callback(stores);
    },
    (error) => {
      console.error('Error subscribing to stores:', error);
      // Return empty array to unblock UI and allow user to see the error
      callback([]);
    }
  );

  return unsubscribe;
};

// Initialize default stores for a family (safe to call multiple times)
export const initializeDefaultStores = async (familyId: string): Promise<void> => {
  const storesRef = collection(db, 'stores');
  const q = query(storesRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) return; // Already initialized

  const defaultStores = [
    { displayName: 'Fred Meyer', abbreviation: 'FM', color: '#0066CC', sortOrder: 1 },
    { displayName: "Trader Joe's", abbreviation: 'TJ', color: '#D32F2F', sortOrder: 2 },
    { displayName: 'New Seasons', abbreviation: 'NS', color: '#388E3C', sortOrder: 3 },
    { displayName: 'Costco', abbreviation: 'CO', color: '#FF8C00', sortOrder: 4 },
  ];

  for (const store of defaultStores) {
    await addStore({ familyId, ...store });
  }
};

// ============================================================================
// Shopping Groups (user-created custom groups)
// ============================================================================

// Get all shopping groups for a family
export const getShoppingGroups = async (familyId: string): Promise<ShoppingGroup[]> => {
  const groupsRef = collection(db, 'shoppingGroups');
  const q = query(groupsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: (data.createdAt?.toDate?.() || new Date()).toISOString(),
      updatedAt: (data.updatedAt?.toDate?.() || new Date()).toISOString(),
    };
  }) as ShoppingGroup[];
};

// Add new shopping group
export const addShoppingGroup = async (
  group: Omit<ShoppingGroup, 'id' | 'createdAt' | 'updatedAt'>
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

// Update shopping group
export const updateShoppingGroup = async (
  groupId: string,
  updates: Partial<ShoppingGroup>
): Promise<void> => {
  const docRef = doc(db, 'shoppingGroups', groupId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

// Delete shopping group
export const deleteShoppingGroup = async (groupId: string): Promise<void> => {
  const docRef = doc(db, 'shoppingGroups', groupId);
  await deleteDoc(docRef);
};

// Real-time listener for shopping groups
export const subscribeToShoppingGroups = (
  familyId: string,
  callback: (groups: ShoppingGroup[]) => void
): (() => void) => {
  const q = query(
    collection(db, 'shoppingGroups'),
    where('familyId', '==', familyId)
  );

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const groups = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as ShoppingGroup;
      });
      callback(groups);
    },
    (error) => {
      console.error('Error subscribing to shopping groups:', error);
      callback([]);
    }
  );

  return unsubscribe;
};


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
import type { Tag } from '../types/index.ts';
import { mapFirestoreDoc, timestampToISO } from './firestore-utils';

function mapTag(docSnap: DocumentSnapshot): Tag {
  return mapFirestoreDoc(docSnap, (id, data) => {
    const { createdAt, updatedAt, ...rest } = data;
    return {
      ...(rest as Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>),
      id,
      createdAt: timestampToISO(createdAt),
      updatedAt: timestampToISO(updatedAt),
    };
  });
}

export const getTags = async (familyId: string): Promise<Tag[]> => {
  const tagsRef = collection(db, 'tags');
  const q = query(tagsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapTag);
};

export const addTag = async (
  tag: Omit<Tag, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Tag> => {
  const tagsRef = collection(db, 'tags');
  const now = Timestamp.now();
  const docRef = await addDoc(tagsRef, {
    ...tag,
    createdAt: now,
    updatedAt: now,
  });
  return {
    ...tag,
    id: docRef.id,
    createdAt: now.toDate().toISOString(),
    updatedAt: now.toDate().toISOString(),
  };
};

export const updateTag = async (
  tagId: string,
  updates: Partial<Tag>,
): Promise<void> => {
  const docRef = doc(db, 'tags', tagId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteTag = async (tagId: string): Promise<void> => {
  const docRef = doc(db, 'tags', tagId);
  await deleteDoc(docRef);
};

export const subscribeToTags = (
  familyId: string,
  callback: (tags: Tag[]) => void,
): (() => void) => {
  const q = query(collection(db, 'tags'), where('familyId', '==', familyId));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map(mapTag)),
    (error) => {
      console.error('Error subscribing to tags:', error);
      callback([]);
    },
  );
};

const DEFAULT_TAGS: Array<Omit<Tag, 'id' | 'familyId' | 'createdAt' | 'updatedAt'>> = [
  { displayName: 'Fred Meyer', abbreviation: 'FM', color: '#0066CC', sortOrder: 1 },
  { displayName: "Trader Joe's", abbreviation: 'TJ', color: '#D32F2F', sortOrder: 2 },
  { displayName: 'New Seasons', abbreviation: 'NS', color: '#388E3C', sortOrder: 3 },
  { displayName: 'Costco', abbreviation: 'CO', color: '#FF8C00', sortOrder: 4 },
];

/** Safe to call multiple times — no-ops if tags already exist for this family. */
export const initializeDefaultTags = async (familyId: string): Promise<void> => {
  const tagsRef = collection(db, 'tags');
  const q = query(tagsRef, where('familyId', '==', familyId));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) return;

  const now = Timestamp.now();
  const batch = writeBatch(db);
  for (const tag of DEFAULT_TAGS) {
    const docRef = doc(tagsRef);
    batch.set(docRef, { familyId, ...tag, createdAt: now, updatedAt: now });
  }
  await batch.commit();
};

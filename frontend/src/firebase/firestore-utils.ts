import type { DocumentSnapshot } from 'firebase/firestore';

/**
 * Converts a Firestore Timestamp (or anything with a .toDate() method) to an ISO
 * string. Falls back to the current time so callers always receive a valid string
 * and Redux never receives a non-serializable Date object.
 */
export function timestampToISO(ts: unknown): string {
  if (ts != null && typeof (ts as { toDate?: unknown }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

/**
 * Extracts and validates Firestore document data, throwing if the document does
 * not exist. Passes the id and raw data to the provided mapper so domain files
 * can construct strongly-typed objects without trailing `as T` casts.
 */
export function mapFirestoreDoc<T>(
  docSnap: DocumentSnapshot,
  mapper: (id: string, data: Record<string, unknown>) => T,
): T {
  const data = docSnap.data();
  if (!data) throw new Error(`Firestore document ${docSnap.id} has no data`);
  return mapper(docSnap.id, data as Record<string, unknown>);
}

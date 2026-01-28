import { 
  collection, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  getDocs,
  QueryConstraint,
  DocumentData,
  Query,
  getDoc,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { User } from "firebase/auth";

/**
 * Get the current authenticated user's ID
 * Throws error if user is not authenticated
 */
export function getCurrentUserId(user: User | null): string {
  if (!user) {
    throw new Error("User must be authenticated to perform this operation");
  }
  return user.uid;
}

/**
 * Create a query filtered by userId
 */
export function getUserCollection(
  collectionName: string,
  userId: string,
  ...additionalConstraints: QueryConstraint[]
): Query<DocumentData> {
  const baseQuery = query(
    collection(db, collectionName),
    where("userId", "==", userId),
    ...additionalConstraints
  );
  return baseQuery;
}

/**
 * Add a document with userId automatically included
 */
export async function addDocWithUser<T extends DocumentData>(
  collectionName: string,
  data: Omit<T, "userId">,
  userId: string
) {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    userId,
  } as T);
  return docRef;
}

/**
 * Update a document, verifying it belongs to the user
 */
export async function updateDocWithUser<T extends DocumentData>(
  collectionName: string,
  docId: string,
  data: Partial<T>,
  userId: string
) {
  // Verify ownership first
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error("Document not found");
  }
  
  const docData = docSnap.data();
  if (docData.userId !== userId) {
    throw new Error("Unauthorized: You don't have permission to update this document");
  }
  
  await updateDoc(docRef, data);
}

/**
 * Delete a document, verifying it belongs to the user
 */
export async function deleteDocWithUser(
  collectionName: string,
  docId: string,
  userId: string
) {
  // Verify ownership first
  const docRef = doc(db, collectionName, docId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    throw new Error("Document not found");
  }
  
  const docData = docSnap.data();
  if (docData.userId !== userId) {
    throw new Error("Unauthorized: You don't have permission to delete this document");
  }
  
  await deleteDoc(docRef);
}

/**
 * Helper to convert Firestore dates to JS Dates
 */
export function convertDates(data: any): any {
  const newData = { ...data };
  for (const key in newData) {
    if (newData[key] instanceof Timestamp) {
      newData[key] = newData[key].toDate();
    } else if (typeof newData[key] === 'object' && newData[key] !== null && !Array.isArray(newData[key])) {
      newData[key] = convertDates(newData[key]);
    }
  }
  return newData;
}

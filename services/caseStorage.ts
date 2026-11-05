import { collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { CaseRecord } from '../types';

export async function fetchUserCasesFromFirestore(userId: string): Promise<CaseRecord[]> {
  const collectionPath = `users/${userId}/cases`;
  try {
    const q = query(collection(db, 'users', userId, 'cases'), orderBy('timestamp', 'desc'), limit(50));
    const querySnapshot = await getDocs(q);
    const cases: CaseRecord[] = [];
    querySnapshot.forEach((docSnap) => {
      cases.push(docSnap.data() as CaseRecord);
    });
    return cases;
  } catch (error) {
    console.warn('Could not fetch cases from Firestore, fallback to local storage:', error);
    return [];
  }
}

export async function saveUserCaseToFirestore(userId: string, caseRecord: CaseRecord): Promise<void> {
  const docPath = `users/${userId}/cases/${caseRecord.id}`;
  try {
    const docRef = doc(db, 'users', userId, 'cases', caseRecord.id);
    const dataToSave: CaseRecord = {
      ...caseRecord,
      userId
    };
    await setDoc(docRef, dataToSave);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteUserCaseFromFirestore(userId: string, caseId: string): Promise<void> {
  const docPath = `users/${userId}/cases/${caseId}`;
  try {
    const docRef = doc(db, 'users', userId, 'cases', caseId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

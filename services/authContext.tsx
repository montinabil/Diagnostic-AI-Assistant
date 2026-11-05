import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
  AuthError
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (
    email: string,
    pass: string,
    displayName?: string,
    specialty?: string,
    institution?: string
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  formatAuthError: (error: unknown) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function formatAuthError(error: unknown): string {
  if (!error) return 'An unexpected error occurred.';
  const code = (error as AuthError)?.code || '';
  const message = (error as Error)?.message || String(error);

  switch (code) {
    case 'auth/invalid-email':
      return 'The email address is formatted incorrectly. Please check and try again.';
    case 'auth/user-disabled':
      return 'This clinician account has been disabled. Please contact system support.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password. Please verify your credentials or use the password reset link.';
    case 'auth/email-already-in-use':
      return 'An account with this email address is already registered. Please log in or request a password reset.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters. Please choose a more secure password.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Access has been temporarily locked for security. Please try again later or reset your password.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled in Firebase Authentication. Enable Email/Password in your Firebase Console (Authentication > Sign-in method).';
    case 'auth/popup-closed-by-user':
      return 'Authentication popup was closed before completing sign-in.';
    case 'auth/popup-blocked':
      return 'The authentication popup was blocked by your browser. Please allow popups for this site.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please log in again to continue.';
    default:
      return message.replace(/^Firebase:\s*/, '').replace(/\s*\(auth\/.*\)\.?$/, '');
  }
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Sync user profile from Firestore
  const fetchUserProfile = async (currentUser: User) => {
    const profilePath = `users/${currentUser.uid}`;
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      } else {
        // Create initial profile if missing
        const newProfile: UserProfile = {
          id: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Clinician'),
          specialty: 'Radiology / Diagnostic Imaging',
          institution: 'Medical Imaging Center',
          createdAt: new Date().toISOString()
        };
        await setDoc(docRef, newProfile);
        setUserProfile(newProfile);
      }
    } catch (err) {
      console.warn('Could not read user profile from Firestore:', err);
      // Fallback in-memory profile
      setUserProfile({
        id: currentUser.uid,
        email: currentUser.email || '',
        displayName: currentUser.displayName || 'Clinician',
        specialty: 'Diagnostic Imaging Specialist',
        institution: 'Hospital Imaging Dept',
        createdAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserProfile(currentUser);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
    await fetchUserProfile(cred.user);
  };

  const register = async (
    email: string,
    pass: string,
    displayName?: string,
    specialty?: string,
    institution?: string
  ) => {
    const trimmedEmail = email.trim();
    const cred = await createUserWithEmailAndPassword(auth, trimmedEmail, pass);
    
    // Update Firebase Auth display name if provided
    if (displayName) {
      try {
        await updateProfile(cred.user, { displayName });
      } catch (err) {
        console.warn('Could not set displayName on Auth user', err);
      }
    }

    // Write profile document to Firestore
    const profileData: UserProfile = {
      id: cred.user.uid,
      email: trimmedEmail,
      displayName: displayName || (trimmedEmail.split('@')[0]),
      specialty: specialty || 'General Medicine / Diagnostics',
      institution: institution || 'Clinical Practice',
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', cred.user.uid), profileData);
      setUserProfile(profileData);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${cred.user.uid}`);
    }
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    await fetchUserProfile(result.user);
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const updateUserProfile = async (data: Partial<UserProfile>) => {
    if (!user) throw new Error('No authenticated user');
    const updated: UserProfile = {
      id: user.uid,
      email: user.email || '',
      displayName: data.displayName || userProfile?.displayName || user.displayName || 'Clinician',
      specialty: data.specialty || userProfile?.specialty || '',
      institution: data.institution || userProfile?.institution || '',
      createdAt: userProfile?.createdAt || new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), updated, { merge: true });
      setUserProfile(updated);
      if (data.displayName && auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: data.displayName });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) throw new Error('No authenticated user');
    await sendEmailVerification(auth.currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        login,
        register,
        loginWithGoogle,
        resetPassword,
        logout,
        updateUserProfile,
        resendVerificationEmail,
        formatAuthError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

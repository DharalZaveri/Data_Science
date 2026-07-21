import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User as FirebaseUser, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { auth, googleProvider, db } from '../lib/firebase';
import { UserProfile } from '../types';

export interface User {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  loginAnonymously: () => Promise<void>;
  logout: () => Promise<void>;
  deductCredit: () => Promise<boolean>;
  addCredits: (amount: number) => Promise<void>;
  updateProfile: (profileData: Partial<UserProfile>) => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [cachedAccessToken, setCachedAccessToken] = useState<string | null>(null);

  // Sync profile from Firestore
  const syncProfile = async (uid: string, email: string | null) => {
    try {
      const userRef = doc(db, 'users', uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({
          uid,
          email: data.email || email || '',
          role: data.role || 'manufacturer',
          companyName: data.companyName || '',
          isPro: false,
          credits: data.available_credits ?? 10,
          displayName: data.displayName || '',
          phoneNumber: data.phoneNumber || '',
          address: data.address || '',
          businessCategory: data.businessCategory || ''
        });
      } else {
        // Create new user profile with 10 free credits
        await setDoc(userRef, {
          email: email || '',
          available_credits: 10
        });
        setUserProfile({
          uid,
          email: email || '',
          role: 'manufacturer',
          companyName: '',
          isPro: false,
          credits: 10,
          displayName: '',
          phoneNumber: '',
          address: '',
          businessCategory: ''
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isOfflineError = errMsg.includes('offline') || errMsg.includes('Backend didn\'t respond') || errMsg.includes('Could not reach') || errMsg.includes('10 seconds');
      if (isOfflineError) {
        console.warn("Failed to sync profile due to offline state (using sandbox fallback):", errMsg);
        // Fallback for offline environments to avoid blocking the app
        setUserProfile({
          uid,
          email: email || '',
          role: 'manufacturer',
          companyName: '',
          isPro: false,
          credits: 10, // Provide seamless demo experience when offline
          displayName: '',
          phoneNumber: '',
          address: '',
          businessCategory: ''
        });
      } else {
        console.error("Failed to sync profile:", err);
      }
    }
  };

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser({ uid: currentUser.uid, email: currentUser.email });
        await syncProfile(currentUser.uid, currentUser.email);

        const userRef = doc(db, 'users', currentUser.uid);
        unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
             const data = docSnap.data();
             setUserProfile(prev => {
                if (prev) {
                  return { 
                    ...prev, 
                    credits: data.available_credits ?? prev.credits, 
                    role: data.role || prev.role,
                    companyName: data.companyName ?? prev.companyName ?? '',
                    displayName: data.displayName ?? prev.displayName ?? '',
                    phoneNumber: data.phoneNumber ?? prev.phoneNumber ?? '',
                    address: data.address ?? prev.address ?? '',
                    businessCategory: data.businessCategory ?? prev.businessCategory ?? '',
                  };
                } else {
                  return {
                    uid: currentUser.uid,
                    email: data.email || currentUser.email || '',
                    role: data.role || 'manufacturer',
                    companyName: data.companyName || '',
                    isPro: false,
                    credits: data.available_credits || 0,
                    displayName: data.displayName || '',
                    phoneNumber: data.phoneNumber || '',
                    address: data.address || '',
                    businessCategory: data.businessCategory || ''
                  };
                }
             });
          }
        }, (err) => {
          const errMsg = err?.message || String(err);
          const isOfflineError = errMsg.includes('offline') || errMsg.includes('Backend didn\'t respond') || errMsg.includes('Could not reach') || errMsg.includes('10 seconds');
          if (isOfflineError) {
            console.warn("Firestore snapshot offline status:", errMsg);
          } else {
            console.error("Firestore snapshot error:", err);
          }
        });
      } else {
        setUser(null);
        setUserProfile(null);
        if (unsubscribeDoc) unsubscribeDoc();
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const { GoogleAuthProvider } = await import('firebase/auth');
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setCachedAccessToken(credential.accessToken);
      }
    } catch (error) {
      console.error("Google sign in failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const loginWithApple = async () => {
    setLoading(true);
    try {
      const { OAuthProvider, signInWithPopup } = await import('firebase/auth');
      const appleProvider = new OAuthProvider('apple.com');
      await signInWithPopup(auth, appleProvider);
    } catch (error) {
      console.error("Apple sign in failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const loginAnonymously = async () => {
    setLoading(true);
    try {
      const { signInAnonymously } = await import('firebase/auth');
      await signInAnonymously(auth);
    } catch (error) {
      console.error("Anonymous authentication failed:", error);
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      setCachedAccessToken(null);
    } catch (error) {
      console.error("Sign-out failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const deductCredit = async (): Promise<boolean> => {
    if (!user || (!userProfile && userProfile?.credits !== 0)) return false;
    if (userProfile!.credits <= 0) return false;

    const userRef = doc(db, 'users', user.uid);
    try {
      const newCredits = userProfile!.credits - 1;
      await updateDoc(userRef, {
        available_credits: newCredits
      });
      setUserProfile((prev) => prev ? { ...prev, credits: newCredits } : null);
      return true;
    } catch (err) {
      console.error("Failed to deduct credit:", err);
      return false;
    }
  };

  const updateProfile = async (profileData: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userRef, {
        companyName: profileData.companyName ?? '',
        displayName: profileData.displayName ?? '',
        phoneNumber: profileData.phoneNumber ?? '',
        address: profileData.address ?? '',
        businessCategory: profileData.businessCategory ?? '',
      }, { merge: true });

      setUserProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          ...profileData
        };
      });
    } catch (err) {
      console.error("Failed to update profile details in database:", err);
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await syncProfile(user.uid, user.email);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      loading,
      loginWithGoogle,
      loginWithApple,
      loginAnonymously,
      logout,
      deductCredit,
      addCredits: refreshProfile,
      updateProfile,
      getAccessToken: () => cachedAccessToken
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}

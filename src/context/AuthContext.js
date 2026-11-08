'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { auth, db, googleProvider } from '../lib/firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = useCallback(async () => {
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, googleProvider);
    if (result?.user) {
      setUser(result.user);
      try {
        await setDoc(
          doc(db, 'users', result.user.uid),
          {
            name: result.user.displayName || '',
            email: result.user.email || '',
            photoURL: result.user.photoURL || '',
            lastLoginAt: new Date().toISOString()
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Could not sync user login metadata:', err);
      }
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        currentUser: user,
        loading,
        loginWithGoogle,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

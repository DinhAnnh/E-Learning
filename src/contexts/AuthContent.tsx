import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  type User as FirebaseUser,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { get as getRealtime, ref, set as setRealtime } from 'firebase/database';
import { auth, db, realtimeDb } from '../config/firebase';
import type { User, UserRole } from '../types';


interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    const existingMethods = await fetchSignInMethodsForEmail(auth, email);

    if (existingMethods.length > 0) {
      throw Object.assign(new Error('Email already in use'), { code: 'auth/email-already-in-use' });
    }

    // Create Firebase auth user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    // Create user document in Firestore
    const user: User = {
      id: userCredential.user.uid,
      email,
      name,
      role,
      createdAt: new Date(),
    };

    await setDoc(doc(db, 'users', user.id), user);

    // Persist basic credentials in Realtime Database for demo account display
    try {
      await setRealtime(ref(realtimeDb, `users/${user.id}`), {
        email,
        password,
        role,
        name,
      });
    } catch (error) {
      // Failing to write demo credentials should not block account creation.
      console.warn('Unable to sync credentials to Realtime Database:', error);
    }
  };

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const fetchRealtimeUserByEmail = async (email: string) => {
    const response = await fetch(
      'https://academy-98fb0-default-rtdb.asia-southeast1.firebasedatabase.app/users.json'
    );

    if (!response.ok) {
      throw Object.assign(new Error('Unable to fetch realtime users'), {
        code: 'auth/network-request-failed',
      });
    }

    const rawData: unknown = await response.json();
    const candidates = Array.isArray(rawData) ? rawData : Object.values(rawData ?? {});
    const normalizedEmail = normalizeEmail(email);

    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }

      const record = candidate as Partial<User> & { password?: string };
      if (typeof record.email !== 'string' || typeof record.password !== 'string') {
        continue;
      }

      if (normalizeEmail(record.email) === normalizedEmail) {
        return record;
      }
    }

    return null;
  };

  const login = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return;
    } catch (error) {
      const authError = error as { code?: string };

      if (authError.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    const realtimeUser = await fetchRealtimeUserByEmail(email);

    if (!realtimeUser) {
      throw Object.assign(new Error('User not found'), { code: 'auth/user-not-found' });
    }

    if (realtimeUser.password !== password) {
      throw Object.assign(new Error('Incorrect password'), { code: 'auth/wrong-password' });
    }

    const signInMethods = await fetchSignInMethodsForEmail(auth, email);

    if (signInMethods.length === 0) {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const role = realtimeUser.role;

      const resolvedRole: UserRole =
        role === 'student' || role === 'teacher' || role === 'admin' ? role : 'student';

      const user: User = {
        id: userCredential.user.uid,
        email,
        name: typeof realtimeUser.name === 'string' ? realtimeUser.name : '',
        role: resolvedRole,
        createdAt: new Date(),
      };

      await setDoc(doc(db, 'users', user.id), user);

      try {
        await setRealtime(ref(realtimeDb, `users/${user.id}`), {
          email: user.email,
          password,
          role: user.role,
          name: user.name,
        });
      } catch (syncError) {
        console.warn('Unable to sync realtime credentials for migrated user:', syncError);
      }

      return;
    }

    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        // Fetch user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setCurrentUser({
            ...userData,
            createdAt: userData.createdAt instanceof Date
              ? userData.createdAt
              : (userData.createdAt as any).toDate()
          });
        } else {
          // Attempt to recover user profile from Realtime Database demo credentials
          const realtimeSnapshot = await getRealtime(ref(realtimeDb, `users/${firebaseUser.uid}`));

          if (realtimeSnapshot.exists()) {
            const realtimeData = realtimeSnapshot.val() as Partial<User> & { password?: string };
            const role = realtimeData.role;

            if (role === 'student' || role === 'teacher' || role === 'admin') {
              const recoveredUser: User = {
                id: firebaseUser.uid,
                email: realtimeData.email ?? firebaseUser.email ?? '',
                name: realtimeData.name ?? firebaseUser.displayName ?? '',
                role,
                createdAt: new Date(),
              };

              setCurrentUser(recoveredUser);
              await setDoc(doc(db, 'users', firebaseUser.uid), recoveredUser);
            } else {
              setCurrentUser(null);
            }
          } else {
            setCurrentUser(null);
          }
        }
      } else {
        setCurrentUser(null);
      }

      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    firebaseUser,
    loading,
    signup,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

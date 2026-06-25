import React, { createContext, useState, useEffect, useContext } from 'react';
import { auth, db } from './firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  doc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { AppUser, Personel, Vardiya, Sube } from './types';

interface AppContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  branches: Sube[];
  staff: Personel[];
  shifts: Vardiya[];
  isLoading: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [branches, setBranches] = useState<Sube[]>([]);
  const [staff, setStaff] = useState<Personel[]>([]);
  const [shifts, setShifts] = useState<Vardiya[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Auth observer
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setIsLoading(true);
      if (currentFirebaseUser) {
        setFirebaseUser(currentFirebaseUser);
        try {
          // Query user profile by auth UID from 'users' collection
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where("uid", "==", currentFirebaseUser.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userProfile = userDoc.data() as Personel;
            const appUser: AppUser = {
              name: userProfile.adi,
              email: userProfile.email,
              avatar: userProfile.avatarUrl || `https://picsum.photos/seed/${currentFirebaseUser.uid}/100/100`,
              role: userProfile.rol,
              branchId: userProfile.rol !== 'genel-mudur' ? userProfile.subeId : undefined,
              canManageInventory: userProfile.canManageInventory || false
            };
            setUser(appUser);
          } else {
            console.warn("User profile not found in users collection.");
            await signOut(auth);
            setUser(null);
            setFirebaseUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          await signOut(auth);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore data once authenticated
  useEffect(() => {
    if (!firebaseUser || !user) {
      setBranches([]);
      setStaff([]);
      setShifts([]);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    // 1. Fetch branches (all branches)
    const branchesQuery = query(collection(db, 'branches'));
    const unsubBranches = onSnapshot(branchesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        subeId: doc.id
      })) as Sube[];
      setBranches(data);
    }, (error) => console.error("Error fetching branches:", error));
    unsubscribers.push(unsubBranches);

    // 2. Fetch staff (all users in system or branch-specific)
    let staffQuery;
    if (user.role === 'genel-mudur') {
      staffQuery = query(collection(db, 'users'));
    } else if (user.branchId) {
      staffQuery = query(collection(db, 'users'), where('subeId', '==', user.branchId));
    } else {
      staffQuery = query(collection(db, 'users'), where('uid', '==', firebaseUser.uid));
    }

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        personelId: doc.id
      })) as Personel[];
      setStaff(data);
    }, (error) => console.error("Error fetching staff:", error));
    unsubscribers.push(unsubStaff);

    // 3. Fetch shifts (filtered by branch if branchId exists)
    let shiftsQuery;
    if (user.role === 'genel-mudur') {
      shiftsQuery = query(collection(db, 'shifts'));
    } else if (user.branchId) {
      shiftsQuery = query(collection(db, 'shifts'), where('subeId', '==', user.branchId));
    } else {
      shiftsQuery = query(collection(db, 'shifts'), where('personelId', '==', firebaseUser.uid));
    }

    const unsubShifts = onSnapshot(shiftsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        
        // Helper to convert Firestore Timestamp to JS Date
        const convertTimestamp = (val: any) => {
          if (val && typeof val.toDate === 'function') {
            return val.toDate();
          }
          return val;
        };

        return {
          ...docData,
          vardiyaId: doc.id,
          tarih: convertTimestamp(docData.tarih),
          planliGiris: convertTimestamp(docData.planliGiris),
          girisSaati: convertTimestamp(docData.girisSaati),
          cikisSaati: convertTimestamp(docData.cikisSaati)
        };
      }) as Vardiya[];
      setShifts(data);
    }, (error) => console.error("Error fetching shifts:", error));
    unsubscribers.push(unsubShifts);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [firebaseUser, user]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    signOut(auth);
  };

  return (
    <AppContext.Provider
      value={{
        user,
        firebaseUser,
        login,
        logout,
        branches,
        staff,
        shifts,
        isLoading
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

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
  getDoc,
  collection,
  onSnapshot,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { AppUser, Personel, Vardiya, Sube, UserProfile, Workspace } from './types';

interface AppContextType {
  user: AppUser | null;
  firebaseUser: FirebaseUser | null;
  profiles: UserProfile[];
  activeProfile: UserProfile | null;
  setActiveProfile: (profile: UserProfile | null) => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  workspaces: Workspace[];
  branches: Sube[];
  staff: Personel[];
  shifts: Vardiya[];
  isLoading: boolean;
  refreshProfiles: () => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [branches, setBranches] = useState<Sube[]>([]);
  const [staff, setStaff] = useState<Personel[]>([]);
  const [shifts, setShifts] = useState<Vardiya[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const switchActiveProfile = (profile: UserProfile | null) => {
    setActiveProfile(profile);
    if (profile && firebaseUser && user) {
      setUser(prev => prev ? {
        ...prev,
        role: profile.rol,
        isletmeId: profile.isletmeId,
        subeId: profile.subeId,
        activeProfileId: profile.profileId
      } : null);
    }
  };

  const refreshProfiles = async () => {
    if (!firebaseUser) return;
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const parentUser = userSnap.data();
        const q = query(collection(db, 'profiles'), where("ownerUid", "==", firebaseUser.uid));
        const profilesSnap = await getDocs(q);
        const fetchedProfiles = profilesSnap.docs.map(d => ({
          ...d.data(),
          profileId: d.id
        })) as UserProfile[];
        
        setProfiles(fetchedProfiles);
        
        // If active profile is not set or not in the list, set to first one
        if (!activeProfile || !fetchedProfiles.some(p => p.profileId === activeProfile.profileId)) {
          const active = fetchedProfiles.find(p => p.aktif) || fetchedProfiles[0] || null;
          setActiveProfile(active);
          if (active) {
            setUser({
              uid: firebaseUser.uid,
              name: parentUser.name || 'İsimsiz Kullanıcı',
              email: firebaseUser.email || '',
              avatar: parentUser.avatarUrl || `https://picsum.photos/seed/${firebaseUser.uid}/100/100`,
              role: active.rol,
              isletmeId: active.isletmeId,
              subeId: active.subeId,
              activeProfileId: active.profileId,
              canManageInventory: false
            });
          }
        }
      }
    } catch (e) {
      console.error("Error refreshing profiles:", e);
    }
  };

  // Auth observer
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentFirebaseUser) => {
      setIsLoading(true);
      if (currentFirebaseUser) {
        setFirebaseUser(currentFirebaseUser);
        try {
          // Fetch parent user document
          const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
          let userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
            // Retry once after 2 seconds to avoid race conditions
            await new Promise(resolve => setTimeout(resolve, 2000));
            userSnap = await getDoc(userDocRef);
          }

          if (userSnap.exists()) {
            const parentUser = userSnap.data();
            
            // Query profiles owned by this user
            const profilesRef = collection(db, 'profiles');
            const q = query(profilesRef, where("ownerUid", "==", currentFirebaseUser.uid));
            const profilesSnap = await getDocs(q);
            
            const fetchedProfiles = profilesSnap.docs.map(d => ({
              ...d.data(),
              profileId: d.id
            })) as UserProfile[];
            
            setProfiles(fetchedProfiles);
            
            // Set active profile: first active profile or null
            const active = fetchedProfiles.find(p => p.aktif) || fetchedProfiles[0] || null;
            setActiveProfile(active);
            
            if (active) {
              const appUser: AppUser = {
                uid: currentFirebaseUser.uid,
                name: parentUser.name || 'İsimsiz Kullanıcı',
                email: currentFirebaseUser.email || '',
                avatar: parentUser.avatarUrl || `https://picsum.photos/seed/${currentFirebaseUser.uid}/100/100`,
                role: active.rol,
                isletmeId: active.isletmeId,
                subeId: active.subeId,
                activeProfileId: active.profileId,
                canManageInventory: false
              };
              setUser(appUser);
            } else {
              // No profiles created yet
              const appUser: AppUser = {
                uid: currentFirebaseUser.uid,
                name: parentUser.name || 'İsimsiz Kullanıcı',
                email: currentFirebaseUser.email || '',
                avatar: parentUser.avatarUrl || `https://picsum.photos/seed/${currentFirebaseUser.uid}/100/100`,
                role: 'bireysel', // placeholder
                activeProfileId: undefined
              };
              setUser(appUser);
            }
          } else {
            console.warn("User profile not found in users collection.");
            await signOut(auth);
            setUser(null);
            setFirebaseUser(null);
            setProfiles([]);
            setActiveProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          await signOut(auth);
          setUser(null);
          setFirebaseUser(null);
          setProfiles([]);
          setActiveProfile(null);
        }
      } else {
        setUser(null);
        setFirebaseUser(null);
        setProfiles([]);
        setActiveProfile(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  // Listen to Firestore data once authenticated
  useEffect(() => {
    if (!firebaseUser || !activeProfile) {
      setWorkspaces([]);
      setBranches([]);
      setStaff([]);
      setShifts([]);
      return;
    }

    const unsubscribers: (() => void)[] = [];

    const activeIsletmeId = activeProfile.isletmeId || activeProfile.subeId || '';

    // 1. Fetch workspaces (all workspaces in the system)
    const workspacesQuery = query(collection(db, 'workspaces'));
    const unsubWorkspaces = onSnapshot(workspacesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        isletmeId: doc.id
      })) as Workspace[];
      setWorkspaces(data);
    }, (error) => console.error("Error fetching workspaces:", error));
    unsubscribers.push(unsubWorkspaces);

    // 2. Fetch branches for the active workspace
    const branchesQuery = query(collection(db, 'branches'), where('isletmeId', '==', activeIsletmeId));
    const unsubBranches = onSnapshot(branchesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        ...doc.data(),
        subeId: doc.id
      })) as Sube[];
      setBranches(data);
    }, (error) => console.error("Error fetching branches:", error));
    unsubscribers.push(unsubBranches);

    // 3. Fetch staff (all profiles belonging to the same workspace or the active profile itself)
    let staffQuery;
    if (activeProfile.rol === 'genel-mudur') {
      staffQuery = query(collection(db, 'profiles'), where('isletmeId', '==', activeIsletmeId));
    } else if (activeProfile.rol === 'bireysel') {
      staffQuery = query(collection(db, 'profiles'), where('ownerUid', '==', firebaseUser.uid));
    } else {
      staffQuery = query(collection(db, 'profiles'), where('isletmeId', '==', activeIsletmeId));
    }

    const unsubStaff = onSnapshot(staffQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const profileData = doc.data();
        return {
          personelId: doc.id,
          uid: profileData.ownerUid,
          isletmeId: profileData.isletmeId || activeIsletmeId,
          subeId: profileData.subeId || 'merkez',
          adi: profileData.title,
          rol: profileData.rol,
          tanimlananSaat: profileData.tanimlananSaat || 8,
          email: profileData.email || '',
          aktif: profileData.aktif
        };
      }) as Personel[];
      setStaff(data);
    }, (error) => console.error("Error fetching staff:", error));
    unsubscribers.push(unsubStaff);

    // 4. Fetch shifts (filtered by workspace or profile specific)
    let shiftsQuery;
    if (activeProfile.rol === 'genel-mudur') {
      shiftsQuery = query(collection(db, 'shifts'), where('isletmeId', '==', activeIsletmeId));
    } else if (activeProfile.rol === 'bireysel') {
      shiftsQuery = query(collection(db, 'shifts'), where('personelId', '==', activeProfile.profileId));
    } else {
      shiftsQuery = query(collection(db, 'shifts'), where('isletmeId', '==', activeIsletmeId));
    }

    const unsubShifts = onSnapshot(shiftsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const docData = doc.data();
        
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
  }, [firebaseUser, activeProfile]);

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
        profiles,
        activeProfile,
        setActiveProfile: switchActiveProfile,
        login,
        logout,
        workspaces,
        branches,
        staff,
        shifts,
        isLoading,
        refreshProfiles
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

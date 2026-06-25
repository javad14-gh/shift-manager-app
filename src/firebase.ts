import { initializeApp, getApps, getApp } from 'firebase/app';
// @ts-ignore
import { initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// These can be replaced with the actual Firebase credentials of the new database
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDZDCOgct6_WPXM1atHYS8B3FFwzP_HvSs",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-4557116244-16c26.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "studio-4557116244-16c26",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "studio-4557116244-16c26.appspot.com",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "57367553220",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:57367553220:web:9e516dd95445743dded591",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Use AsyncStorage for persistence in React Native / Expo
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} catch (e) {
  // If already initialized
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

const db = getFirestore(app);

export { app, auth, db };

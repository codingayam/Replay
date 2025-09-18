// Firebase configuration for FCM (Firebase Cloud Messaging)
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging';
import { Messaging } from 'firebase/messaging';

// Your Firebase config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
export const messaging: Messaging = getMessaging(app);
export const firebaseVapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export default app;

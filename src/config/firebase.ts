// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyApgR2GcJeR0i1Tia05WPlII9jjyAF0xHA",
  authDomain: "academy-98fb0.firebaseapp.com",
  databaseURL: "https://academy-98fb0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "academy-98fb0",
  storageBucket: "academy-98fb0.firebasestorage.app",
  messagingSenderId: "29939720477",
  appId: "1:29939720477:web:9d9520c864d5e7662a01f4",
  measurementId: "G-XRRVRRHRZD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const realtimeDb = getDatabase(app);

export default app;

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// 1. Replace this object with your ACTUAL keys from the Firebase Console
// (Project Settings > General > Your Apps > SDK Setup)
const firebaseConfig = {
  apiKey: "AIzaSyC2_UnET0hhqD4IyU5wxvT6r0eJaCNZJGY",
  authDomain: "collaborative-web-app.firebaseapp.com",
  projectId: "collaborative-web-app",
  storageBucket: "collaborative-web-app.firebasestorage.app",
  messagingSenderId: "1082059749132",
  appId: "1:1082059749132:web:105f53f148dd6cc75bbb29",
  measurementId: "G-W4B012BC53"
};

// 2. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 3. Export the services for use in other files
export const auth = getAuth(app);
export const db = getFirestore(app);

// Optional: Export the app instance if needed
export default app;
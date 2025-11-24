import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyArcAxmtWnksFZg-quho0c3togfpJUipL8",
  authDomain: "collab-inn.firebaseapp.com",
  projectId: "collab-inn",
  storageBucket: "collab-inn.firebasestorage.app",
  messagingSenderId: "264489482768",
  appId: "1:264489482768:web:6236ea4091bff01168e895"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
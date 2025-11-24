import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: "AIzaSyArcAxmtWnksFZg-quho0c3togfpJUipL8",
  authDomain: "collab-inn.firebaseapp.com",
  projectId: "collab-inn",
  storageBucket: "collab-inn.firebasestorage.app",
  messagingSenderId: "264489482768",
  appId: "1:264489482768:web:6236ea4091bff01168e895"
};

const app = initializeApp(firebaseConfig);

// Initialize App Check with reCAPTCHA v3
if (typeof window !== 'undefined') {
  // Enable debug mode for localhost
  if (window.location.hostname === 'localhost') {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LduCRcsAAAAADOxtuwfzPkk8m4SDX8MSzsyGQAu'),
    isTokenAutoRefreshEnabled: true
  });
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
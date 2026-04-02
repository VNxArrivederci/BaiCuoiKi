import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDGUCE3X-KOI83zt7a14xjFBJuXpmNPo_U",
  authDomain: "exploreease-1369a.firebaseapp.com",
  projectId: "exploreease-1369a",
  storageBucket: "exploreease-1369a.firebasestorage.app",
  messagingSenderId: "716909035213",
  appId: "1:716909035213:web:eb3b550447727c92b43384",
  measurementId: "G-5RDKP5D521"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
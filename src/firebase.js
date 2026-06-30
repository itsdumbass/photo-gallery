import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAiUwopzjFTjJ6yg61-H_P1K-6o_eQ-kmA",
  authDomain: "photo-gallery-ef340.firebaseapp.com",
  projectId: "photo-gallery-ef340",
  appId: "1:762872160785:web:59d6bb52f7e61a1ec5c7b0",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
import { type FirebaseApp, initializeApp } from "firebase/app";
import { type Auth, connectAuthEmulator, getAuth } from "firebase/auth";

import { env, isFirebaseConfigured } from "./env";

// Auth is null until Firebase is configured. In dev, connect to the Auth emulator (A6).
let auth: Auth | null = null;

if (isFirebaseConfigured) {
  const app: FirebaseApp = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  auth = getAuth(app);
  if (env.VITE_USE_AUTH_EMULATOR === "true") {
    connectAuthEmulator(auth, env.VITE_AUTH_EMULATOR_URL, { disableWarnings: true });
  }
}

export { auth };

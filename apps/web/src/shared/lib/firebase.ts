import { type FirebaseApp, initializeApp } from "firebase/app";
import {
    type Auth,
    connectAuthEmulator,
    createUserWithEmailAndPassword,
    getAuth,
} from "firebase/auth";

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
        // E2E-only seam — present ONLY in emulator builds (the flag is off in prod, so this
        // never ships). Lets Playwright create + sign in a throwaway user through the app's
        // own emulator-connected auth instance, so the guarded calculator becomes reachable.
        // Client-side only; the server boundary (FastAPI verifying the Firebase ID token,
        // Principle IV) is untouched.
        // Gate note: this seam is INTENTIONALLY gated on `VITE_USE_AUTH_EMULATOR === "true"`, NOT
        // on `import.meta.env.DEV`. Playwright runs against a PRODUCTION `vite build` / `vite preview`
        // (import.meta.env.DEV === false) with the emulator env injected — a DEV-mode gate would strip
        // the seam from that build and break e2e/preview. The emulator flag is off in real prod, so
        // this never ships there either way.
        const emulatorAuth = auth;
        window.__e2eAuth = {
            signUp: (email, password) =>
                createUserWithEmailAndPassword(emulatorAuth, email, password).then(() => undefined),
        };
    }
}

export { auth };

declare global {
    interface Window {
        /** Emulator-only E2E sign-in seam (see firebase.ts). Undefined in prod builds. */
        __e2eAuth?: { signUp: (email: string, password: string) => Promise<void> };
    }
}

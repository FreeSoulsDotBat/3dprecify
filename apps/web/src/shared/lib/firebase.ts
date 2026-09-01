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
        // ⚠ @doc DEC-077 — gateada pelo flag do EMULADOR, nunca por `import.meta.env.DEV`: o
        //   Playwright roda contra um build de PRODUÇÃO, e um gate por DEV apagaria a costura
        //   desse build e quebraria o e2e. Na produção real o flag está desligado.
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

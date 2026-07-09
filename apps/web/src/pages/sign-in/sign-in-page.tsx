import { SignInScreen } from "@/features/auth/sign-in-screen";

// Sign-in page surface (T040). The route composes the auth feature, which was re-skinned
// with DS primitives and given the A33-Phase-1 offline mapping. Return-to-intent and the
// already-authenticated bounce live in the router guard (GC-3/GC-4), not here.
export function SignInPage() {
  return <SignInScreen />;
}

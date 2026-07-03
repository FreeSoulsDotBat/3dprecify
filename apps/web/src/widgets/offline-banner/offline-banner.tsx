import { type ReactNode } from "react";

// Placeholder slot (T007). The role="status" aria-live="polite" offline banner
// (navigator.onLine + online/offline events) is built in US4 (T052). The app-shell
// mounts it as the top slot; it renders nothing until then.
export function OfflineBanner(): ReactNode {
  return null;
}

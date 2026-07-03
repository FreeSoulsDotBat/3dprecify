import { type ReactNode, useEffect, useState } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { Icon } from "@/shared/ui";

import "./offline-banner.css";

// Connectivity engine (decision A33 Phase 2): navigator.onLine + the online/offline events —
// NO /health ping. The initial value reads navigator.onLine (SSR/jsdom-safe default: online),
// then the effect subscribes and re-syncs in case connectivity flipped before it mounted.
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setOnline(navigator.onLine); // re-sync post-mount
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

/**
 * Offline banner (T052 / SS-1). A polite live region (`role="status"` + `aria-live="polite"`)
 * that appears within a frame of losing connectivity and states honestly that the calculation
 * keeps working. Rendered as the app-shell's top slot; renders nothing while online.
 */
export function OfflineBanner(): ReactNode {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" aria-live="polite" className="tf-offline-banner">
      <Icon name="info" size={18} className="tf-offline-banner__icon" />
      <span className="tf-offline-banner__msg">{messages.state.offline}</span>
    </div>
  );
}

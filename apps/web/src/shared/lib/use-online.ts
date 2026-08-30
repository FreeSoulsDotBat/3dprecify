import { useEffect, useState } from "react";

// 009 (E4, PR-A) — one connectivity hook (review PR-A, C6). Several surfaces need to know whether
// the device is online AND to react when that flips: the queue banner (offer "Sincronizar agora"
// only when it can work), the per-entry retry (pending retry is online-only), and the sign-out
// dialog (a dialog opened offline must re-enable sync the moment the network returns). The bug this
// closes is reading `navigator.onLine` ONCE at render and then freezing — a button stuck disabled
// forever after reconnection. Connectivity engine per decision A33: `navigator.onLine` + the
// online/offline events, no /health ping. SSR/jsdom-safe default: online.

/** Subscribes to `online`/`offline` and re-syncs post-mount, so every caller agrees and none
 *  freezes a one-time `navigator.onLine` read. */
export function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(
    () => typeof navigator === "undefined" || navigator.onLine,
  );
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    setOnline(navigator.onLine); // re-sync in case connectivity flipped before this mounted
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

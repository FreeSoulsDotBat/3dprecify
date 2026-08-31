import { type ReactNode } from "react";

import { messages } from "@/shared/i18n/messages.pt-br";
import { useOnline } from "@/shared/lib/use-online";
import { Icon } from "@/shared/ui";

import "./offline-banner.css";

/**
 * Offline banner (T052 / SS-1). A polite live region (`role="status"` + `aria-live="polite"`)
 * that appears within a frame of losing connectivity and states honestly that the calculation
 * keeps working. Rendered as the app-shell's top slot; renders nothing while online.
 *
 * Connectivity comes from the shared `useOnline` hook (decision A33: `navigator.onLine` + the
 * online/offline events, no /health ping) — the same one the Histórico surfaces use (review PR-A,
 * C6), so there is one connectivity truth in the app, not one per widget.
 */
export function OfflineBanner(): ReactNode {
    const online = useOnline();
    if (online) return null;
    return (
        <div role="status" aria-live="polite" className="tf-offline-banner">
            <Icon name="info" size={18} className="tf-offline-banner__icon" />
            <span className="tf-offline-banner__msg">{messages.state.offline}</span>
        </div>
    );
}

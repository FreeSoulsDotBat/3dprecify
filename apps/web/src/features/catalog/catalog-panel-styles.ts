import type { CSSProperties } from "react";

// Shared inline styles reused across `catalog-panel.tsx` and its extracted branch components
// (states/master-detail/dense-table/mobile-list) — kept in one place so every branch reads the
// exact same look, byte-for-byte.

export const captionText: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    color: "var(--text-muted)",
};

export const rowNameStyle: CSSProperties = {
    display: "block",
    fontWeight: "var(--fw-semibold)",
    color: "var(--text-strong)",
};

export const rowSummaryStyle: CSSProperties = {
    display: "block",
    fontSize: "var(--fs-caption)",
    color: "var(--text-muted)",
};

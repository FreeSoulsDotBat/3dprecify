// The `CSSProperties` objects shared by the calculator form's atoms/molecules/organisms —
// extracted verbatim from calculator-form.tsx (019-polish readability split, no behavior change).
import type { CSSProperties } from "react";

export const gridCard: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-3)",
};

export const sectionLabel: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-sm)",
    fontWeight: "var(--fw-semibold)",
    color: "var(--text-strong)",
};

export const captionText: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    color: "var(--text-muted)",
};

// "Preços por canal": the modality reads lighter than the marketplace name, and a divider separates
// stacked channels — so a channel header is distinct from the group sub-title above it (T019b #4).
export const channelModality: CSSProperties = {
    fontWeight: "var(--fw-regular)",
    color: "var(--text-muted)",
};

// 019/PR-F (T142, prancheta 10a) — "Preços por marketplace" leva o mesmo tratamento tipográfico
// que `.tf-catalog-md__kicker` (catalog-master-detail.css) já usa: caption maiúscula, tracking,
// tom muted. Cópia local em vez de importar a classe de outra feature (nenhum acoplamento de CSS
// entre `features/catalog` e `features/calculator`) — os valores são os mesmos, de propósito.
export const kickerLabel: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    fontWeight: "var(--fw-semibold)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
};

// 019/PR-F (10a) — o título de cada cartão de marketplace ("Mercado Livre · Clássico"): a
// prancheta usa `font-size:var(--fs-body-sm);font-weight:var(--fw-semibold)`, um degrau abaixo do
// `sectionLabel` (fs-sm) que os títulos de SEÇÃO usam — o cartão não é uma seção.
export const channelCardTitle: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-body-sm)",
    fontWeight: "var(--fw-semibold)",
    color: "var(--text-strong)",
};

// 019/PR-F (10a) — a trilha da barra de proporção. Sem classe `tf-*` própria: a prancheta também
// não tem uma (é estilo inline solto na marcação estática), então o mesmo objeto `CSSProperties`
// que o resto deste arquivo já usa para nós sem primitivo dedicado (ver `sectionLabel` acima).
export const proportionTrack: CSSProperties = {
    display: "flex",
    height: "8px",
    borderRadius: "var(--radius-pill)",
    overflow: "hidden",
    background: "var(--bg-muted)",
};

// Warning caption for a co-funded voucher that exceeds the margin (líquido < 0) — truthful, not clamped.
export const warnCaption: CSSProperties = {
    margin: 0,
    fontSize: "var(--fs-caption)",
    color: "var(--danger-text)",
};

import type { FrozenProvenance } from "./frozen-payload";

// 009/T019 (E4, PR-B, US3) — resolve a snapshot's ORIGIN at read time.
//
// Provenance is captured INFORMATION, deliberately NOT a foreign key (ADR-0019 §5): the id may
// dangle the instant the seller deletes the product or kit. That is by design — a snapshot never
// rots (FR-503). So this resolver answers one narrow question: does the origin STILL exist, so we
// can offer "abrir origem"? If it does not, the caller shows nothing at all — no broken link, no
// "produto excluído" claim, no degraded caption. The captured NAME still renders regardless; it is
// part of the frozen document and is always true (it is what the thing was called then).

export type OriginTarget =
    { kind: "PRODUCT"; id: string; name: string } | { kind: "KIT"; id: string; name: string };

/**
 * The origin's editor target IFF the id still resolves to a live item the seller owns, else `null`.
 * The kind is part of the identity: a product and a kit that happen to share an id are not the same
 * origin, so the pools are never crossed.
 */
export function resolveOrigin(
    provenance: FrozenProvenance | null,
    products: readonly { id: string }[],
    kits: readonly { id: string }[],
): OriginTarget | null {
    if (!provenance) return null;
    // 010/T035 (E5, PR-C, US7) — a SCENARIO origin has no editor route to offer (Calcular reopens a
    // scenario from its OWN list, not a deep link by id) — it is informational-only by construction, so
    // this never resolves to a target. The captured NAME still renders unconditionally wherever the
    // caller prints `payload.provenance.name` (never through this resolver), so the origin line stays
    // honest — never blank, never "removido" — without ever offering a link that could dangle.
    if (provenance.kind === "SCENARIO") return null;
    const pool = provenance.kind === "PRODUCT" ? products : kits;
    const exists = pool.some((item) => item.id === provenance.id);
    return exists ? { kind: provenance.kind, id: provenance.id, name: provenance.name } : null;
}

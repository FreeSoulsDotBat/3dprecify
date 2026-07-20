// 010/T023 (E5, PR-B US3) — decode the SERVER-resolved cost basis (contracts/api-surface.md
// `ResolvedCostBasis`) off a scenario's `config`, structurally (VR-603 posture: generic fields, no
// `PriceInput`/`BomResult` shape-pinning). `GET`/list/every write response already carries this —
// `costBasis.degraded` is the server's single D3/D6 decision (owner + `deleted_at IS NULL`,
// `scenarios.py::_resolve_cost_basis_for_read`); this module only reads it honestly on the client.
//
// NEVER infer "removido" from a degraded ref — the caller renders the calm `manualValuesKept`
// caption (reused verbatim, F1/K3) and offers "Abrir origem" ONLY when `degraded` is false AND a
// `ref` is present (a resolvable reference) — never a broken link.

export interface ResolvedCostBasisMeta {
  kind: "AD_HOC" | "PRODUCT" | "KIT";
  ref: { id: string; name: string } | null;
  /** `true` ⇒ D6 last-known (the ref did not resolve); `false` ⇒ D3 live-reflect or a pure AD_HOC
   *  basis (which never degrades — data-model §1). */
  degraded: boolean;
}

function isRefShaped(v: unknown): v is { id: unknown; name: unknown } {
  return typeof v === "object" && v !== null && "id" in v && "name" in v;
}

/** Structural read of `config.costBasis` off a raw wire payload (`ScenarioOutConfig` = an untyped
 *  bag). Returns `null` when the shape is not recognizable — never throws, never fabricates a kind. */
export function readResolvedCostBasis(config: unknown): ResolvedCostBasisMeta | null {
  if (typeof config !== "object" || config === null) return null;
  const costBasis = (config as Record<string, unknown>).costBasis;
  if (typeof costBasis !== "object" || costBasis === null) return null;
  const cb = costBasis as Record<string, unknown>;
  const kind = cb.kind;
  if (kind !== "AD_HOC" && kind !== "PRODUCT" && kind !== "KIT") return null;
  const rawRef = cb.ref;
  const ref = isRefShaped(rawRef) ? { id: String(rawRef.id), name: String(rawRef.name) } : null;
  return { kind, ref, degraded: cb.degraded === true };
}

/** "Abrir origem" is offered ONLY when the reference actually resolves (owned + live) — never a
 *  broken link, never offered on a degraded/AD_HOC basis (ux §4.2-4, the E3/E4 posture). */
export function canOpenOrigin(meta: ResolvedCostBasisMeta | null): boolean {
  return meta !== null && meta.kind !== "AD_HOC" && meta.ref !== null && !meta.degraded;
}

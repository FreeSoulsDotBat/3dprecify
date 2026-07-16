import { describe, expect, it } from "vitest";

import type { FrozenProvenance } from "./frozen-payload";
import { resolveOrigin } from "./origin";

// 009/T018 (E4, PR-B, US3) — the origin is resolved at READ TIME, and the whole point is that it may
// NOT resolve. Provenance is captured INFORMATION, deliberately NOT a foreign key (ADR-0019 §5): the
// id is allowed to dangle. So "abrir origem" is offered ONLY when the id still points at a LIVE item
// the seller owns; when the origin was deleted it is simply ABSENT — no broken link, no "produto
// excluído" claim, no degraded caption. A snapshot never rots (FR-503).

const PRODUCT: FrozenProvenance = { kind: "PRODUCT", id: "p1", name: "Vaso G" };
const KIT: FrozenProvenance = { kind: "KIT", id: "k1", name: "Kit Festa" };

describe("resolveOrigin — read-time, tolerant of a dangling id (US3, ADR-0019 §5)", () => {
  it("resolves a PRODUCT origin to its editor target while the product still exists", () => {
    const target = resolveOrigin(PRODUCT, [{ id: "p1" }, { id: "p2" }], []);
    expect(target).toEqual({ kind: "PRODUCT", id: "p1", name: "Vaso G" });
  });

  it("resolves a KIT origin to its editor target while the kit still exists", () => {
    const target = resolveOrigin(KIT, [], [{ id: "k1" }]);
    expect(target).toEqual({ kind: "KIT", id: "k1", name: "Kit Festa" });
  });

  it("returns null when the origin was DELETED — the affordance is simply absent, never degraded", () => {
    expect(resolveOrigin(PRODUCT, [{ id: "other" }], [])).toBeNull();
    expect(resolveOrigin(KIT, [], [{ id: "other" }])).toBeNull();
  });

  it("returns null for an ad-hoc snapshot (no provenance at all)", () => {
    expect(resolveOrigin(null, [{ id: "p1" }], [{ id: "k1" }])).toBeNull();
  });

  it("never crosses kinds: a PRODUCT id is not matched by a kit of the same id (and vice-versa)", () => {
    // Same id string in the other pool must NOT satisfy the origin — the kind is part of the identity.
    expect(resolveOrigin(PRODUCT, [], [{ id: "p1" }])).toBeNull();
    expect(resolveOrigin(KIT, [{ id: "k1" }], [])).toBeNull();
  });
});

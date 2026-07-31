import { describe, it, expect } from "vitest";

import {
  ancestorChain,
  categoryPath,
  categorySpineSchema,
  indexSpine,
  searchCategories,
} from "./category-tree";

// The spine is what makes SC-801 structural instead of a sorting rule: the nearest ancestor IS the
// most specific match and the chain is unique. These tests pin the two properties the resolver leans
// on (the chain is ordered most-specific-first; a malformed spine is rejected at parse) plus the
// picker helpers.

const ML = [
  { id: "MLB1051", name: "Celulares e Telefones", parentId: null },
  { id: "MLB1055", name: "Celulares e Smartphones", parentId: "MLB1051" },
  { id: "MLB3813", name: "Acessórios para Celulares", parentId: "MLB1051" },
  { id: "MLB439224", name: "Apoio para Celulares", parentId: "MLB3813" },
  { id: "MLB1574", name: "Casa, Móveis e Decoração", parentId: null },
];

describe("categorySpineSchema — a malformed spine is rejected at parse", () => {
  it("accepts a well-formed spine", () => {
    expect(() => categorySpineSchema.parse(ML)).not.toThrow();
  });

  it("rejects an orphan parentId", () => {
    const orphan = [{ id: "A", name: "A", parentId: "GHOST" }];
    expect(() => categorySpineSchema.parse(orphan)).toThrow(/orphan/i);
  });

  it("rejects a duplicate id", () => {
    const dup = [
      { id: "A", name: "A", parentId: null },
      { id: "A", name: "A again", parentId: null },
    ];
    expect(() => categorySpineSchema.parse(dup)).toThrow(/duplicate/i);
  });

  // A cycle would hang the ancestor walk forever. It dies at parse, not at runtime.
  it("rejects a cycle", () => {
    const cyclic = [
      { id: "A", name: "A", parentId: "B" },
      { id: "B", name: "B", parentId: "A" },
    ];
    expect(() => categorySpineSchema.parse(cyclic)).toThrow(/cycle/i);
  });
});

describe("ancestorChain — ordered most-specific-first", () => {
  const index = indexSpine(ML);

  it("starts at the node itself and walks to the root", () => {
    expect(ancestorChain(index, "MLB439224")).toEqual(["MLB439224", "MLB3813", "MLB1051"]);
  });

  it("a root is a chain of one", () => {
    expect(ancestorChain(index, "MLB1051")).toEqual(["MLB1051"]);
  });

  // The spine is SPARSE by design (measured: ~87.5% of ML nodes inherit their parent's rate and are
  // therefore absent). "Not in the spine" is the NORMAL case, not an error — the caller gets one
  // exact-match attempt and then falls through to the marketplace catch-all.
  it("an unknown category yields itself alone, not an empty chain nor a throw", () => {
    expect(ancestorChain(index, "MLB999999")).toEqual(["MLB999999"]);
  });
});

describe("picker helpers", () => {
  it("searches case- and accent-insensitively", () => {
    const hits = searchCategories(ML, "moveis");
    expect(hits.map((n) => n.id)).toEqual(["MLB1574"]);
  });

  it("an empty query matches nothing (never dumps the whole tree)", () => {
    expect(searchCategories(ML, "   ")).toEqual([]);
  });

  // Two near-homonyms that ML really publishes at DIFFERENT rates (18% vs 16%). Searching "celulares"
  // returns both, so the picker must render the path to make them distinguishable — otherwise the
  // seller picks by name and coin-flips 2 percentage points.
  it("returns near-homonyms together, and the path tells them apart", () => {
    const hits = searchCategories(ML, "celulares");
    expect(hits.length).toBeGreaterThanOrEqual(3);
    const index = indexSpine(ML);
    expect(categoryPath(index, "MLB1055")).toBe("Celulares e Telefones › Celulares e Smartphones");
    expect(categoryPath(index, "MLB439224")).toBe(
      "Celulares e Telefones › Acessórios para Celulares › Apoio para Celulares",
    );
  });

  // 014/T116 — a espinha é ESPARSA e o id vem de fora dela (produto salvo, cenário reaberto, catálogo
  // que deixou de carregar o nó). O caminho vazio não é "sem nome": é uma string que o chamador
  // renderiza como rótulo em branco. `ancestorChain`, a função irmã, já documenta e trata o id
  // desconhecido; esta devolvia "" e deixava o chamador descobrir sozinho.
  it("um id fora da espinha devolve null, nunca uma string vazia (T116)", () => {
    const index = indexSpine(ML);
    expect(categoryPath(index, "MLB-que-nao-existe")).toBeNull();
  });
});

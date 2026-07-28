import { z } from "zod";

// Category spine (014 / D2). The tree has TWO consumers with different needs, and conflating them was
// the design error the adversarial review caught: the RESOLVER needs only `id`+`parentId` of the nodes
// whose commission diverges from their parent (plus their ancestors) — the "spine" — while the PICKER
// needs the NAME of every node. The spine travels INSIDE the catalog artifact, so the data that decides
// money moves through one artifact with one `catalogVersion` (killing tree↔catalog skew by
// construction); the name index is fetched on demand.
//
// Why sparse: measured 2026-07-28 against the live ML API — the commission is PIECEWISE-CONSTANT down
// the tree. 84 of 96 sampled children inherit their root's rate; 12 diverge, and the divergences are
// money (Celulares 18% → Smartphones 16%, Games 18% → Consoles 16%). Storing every node would repeat
// the same number tens of thousands of times; storing only the roots would be wrong once every eight
// categories, in the highest-volume ones.

/** One node of a marketplace's category tree, flattened (`parentId` instead of nesting). */
export const categoryNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentId: z.string().min(1).nullable(),
});
export type CategoryNode = z.infer<typeof categoryNodeSchema>;

/**
 * A marketplace's spine. Validated for the two properties the ancestor walk depends on:
 * every `parentId` resolves, and there is no cycle — a cycle would hang the walk forever, so it is
 * rejected at parse rather than defended against at runtime with a visit counter.
 */
export const categorySpineSchema = z.array(categoryNodeSchema).superRefine((nodes, ctx) => {
  const byId = new Map<string, CategoryNode>();
  for (const n of nodes) {
    if (byId.has(n.id)) {
      ctx.addIssue({ code: "custom", message: `duplicate category id: ${n.id}` });
      return;
    }
    byId.set(n.id, n);
  }
  for (const n of nodes) {
    if (n.parentId !== null && !byId.has(n.parentId)) {
      ctx.addIssue({
        code: "custom",
        message: `orphan parentId "${n.parentId}" on category "${n.id}"`,
      });
      return;
    }
  }
  // Cycle detection: walk each node to a root, bounded by the node count.
  for (const n of nodes) {
    let hops = 0;
    let cur: CategoryNode | undefined = n;
    while (cur?.parentId != null) {
      if (++hops > nodes.length) {
        ctx.addIssue({ code: "custom", message: `cycle in the category tree at "${n.id}"` });
        return;
      }
      cur = byId.get(cur.parentId);
    }
  }
});

/** Index a spine for lookup. Built once per catalog, not per resolution. */
export function indexSpine(nodes: readonly CategoryNode[]): Map<string, CategoryNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * The chain from `categoryId` up to its root, INCLUSIVE of the starting node and ordered
 * most-specific-first. This ordering IS the SC-801 rule: the nearest ancestor is by definition the
 * most specific match, and the chain is unique — so resolution needs no sorting, no tie-break, and no
 * dependence on the order entries appear in the artifact.
 *
 * An unknown `categoryId` yields `[categoryId]` alone: the caller still gets one exact-match attempt
 * and then falls through to the marketplace catch-all, which is the honest outcome for a category the
 * spine does not carry (the spine is sparse by design — see the module docstring).
 *
 * `index.size` bounds the walk so a spine that somehow escaped cycle validation cannot hang the UI.
 */
export function ancestorChain(
  index: Map<string, CategoryNode>,
  categoryId: string,
): readonly string[] {
  const chain: string[] = [categoryId];
  let cur = index.get(categoryId);
  while (cur?.parentId != null && chain.length <= index.size) {
    chain.push(cur.parentId);
    cur = index.get(cur.parentId);
  }
  return chain;
}

/** Normalise for search: case- and accent-insensitive, so "orgao" finds "Órgão". */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Substring search over category names, for the picker. Matches against the node's own name; the
 * caller renders the full path so two near-homonyms (ML publishes "Celulares e Telefones" at 18% AND
 * "Celulares e Smartphones" at 16%) are distinguishable rather than a coin flip.
 */
export function searchCategories(
  nodes: readonly CategoryNode[],
  query: string,
  limit = 50,
): readonly CategoryNode[] {
  const q = fold(query.trim());
  if (q.length === 0) return [];
  const out: CategoryNode[] = [];
  for (const n of nodes) {
    if (fold(n.name).includes(q)) {
      out.push(n);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Human-readable path from root to node, for disambiguating near-homonyms in the picker. */
export function categoryPath(index: Map<string, CategoryNode>, categoryId: string): string {
  const names: string[] = [];
  let cur = index.get(categoryId);
  let hops = 0;
  while (cur && hops++ <= index.size) {
    names.unshift(cur.name);
    cur = cur.parentId == null ? undefined : index.get(cur.parentId);
  }
  return names.join(" › ");
}

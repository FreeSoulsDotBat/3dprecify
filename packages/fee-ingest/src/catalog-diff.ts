// The monthly diff (014/US4). Pure: two artifacts in, a reviewable description out.
//
// This module carries the increment's sharpest safety property, so it is worth stating plainly:
// the job NEVER decides to write money. It always opens a PR. What is decided here is only whether
// that PR may skip human review — and only when the change is provably nothing but a re-verification
// date (FR-020a). `develop` carries platform protection behind this (FR-020c); the classifier is the
// convenience, not the gate.

/** Field paths that carry NO money and no coverage — the only things a run may change unattended. */
const INERT_PATHS = new Set(["lastReviewed", "catalogVersion", "generatedAt"]);

export interface FieldChange {
  path: string;
  before: unknown;
  after: unknown;
}

export interface EntryDiff {
  marketplace: string;
  categoryId: string | null;
  categoryName: string | null;
  determinants: Record<string, string> | null;
  changes: FieldChange[];
}

export interface CatalogDiff {
  changedEntries: EntryDiff[];
  addedCategories: { marketplace: string; categoryId: string; name: string }[];
  removedCategories: { marketplace: string; categoryId: string; name: string }[];
  /** FR-019a — the marketplace moved a category to a different parent. With sparse entries this
   *  changes the EFFECTIVE rate while no field of any entry differs, so a field-level diff would
   *  show nothing and the loop would publish a price change with no line in the PR. */
  reparented: {
    marketplace: string;
    categoryId: string;
    name: string;
    parentBefore: string | null;
    parentAfter: string | null;
  }[];
  /** True when nothing but re-verification dates moved. Fails CLOSED: any unrecognised field, any
   *  added/removed/reparented category, or any structural surprise makes this false. */
  freshnessOnly: boolean;
}

type Json = Record<string, unknown>;

const entryKey = (d: unknown) =>
  d === null || d === undefined
    ? " null"
    : Object.keys(d as Json)
        .sort()
        .map((k) => `${k}=${String((d as Json)[k])}`)
        .join("&");

/** Deep field comparison, flattened to dotted paths so the PR body can list `commissionPct: 15 → 12`. */
/** `prefix` is always supplied by the caller — every entry point compares OBJECTS, so descent
 *  reaches leaves with a real path and there is no rootless case to defend against. */
function leafChanges(before: unknown, after: unknown, prefix: string): FieldChange[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  // Arrays are descended by INDEX, not dumped whole. A price band changing must read
  // "priceBands.0.commissionPct: 15 → 10" in the PR, not as two opaque arrays — the reviewer is
  // checking money, and a diff he cannot read is a diff he will approve without checking.
  if (Array.isArray(before) && Array.isArray(after)) {
    const len = Math.max(before.length, after.length);
    return Array.from({ length: len }, (_, i) =>
      leafChanges(before[i], after[i], `${prefix}.${i}`),
    ).flat();
  }
  const bothObjects =
    before !== null &&
    after !== null &&
    typeof before === "object" &&
    typeof after === "object" &&
    !Array.isArray(before) &&
    !Array.isArray(after);
  if (!bothObjects) return [{ path: prefix, before, after }];
  const keys = new Set([...Object.keys(before as Json), ...Object.keys(after as Json)]);
  return [...keys].flatMap((k) =>
    leafChanges((before as Json)[k], (after as Json)[k], prefix ? `${prefix}.${k}` : k),
  );
}

const spineOf = (mk: Json) => (Array.isArray(mk.categorySpine) ? (mk.categorySpine as Json[]) : []);
const entriesOf = (mk: Json) => (Array.isArray(mk.entries) ? (mk.entries as Json[]) : []);

/**
 * Compare two catalog artifacts.
 *
 * Categories are compared through the SPINE, not only through entries, because a sparse map
 * expresses "this category inherits" as the ABSENCE of an entry — so a category can appear,
 * disappear, or change parent without any entry differing at all.
 */
export function diffCatalogs(before: Json, after: Json): CatalogDiff {
  const diff: CatalogDiff = {
    changedEntries: [],
    addedCategories: [],
    removedCategories: [],
    reparented: [],
    freshnessOnly: true,
  };

  const mkBefore = new Map(
    ((before.marketplaces as Json[]) ?? []).map((m) => [String(m.marketplace), m]),
  );
  const mkAfter = new Map(
    ((after.marketplaces as Json[]) ?? []).map((m) => [String(m.marketplace), m]),
  );

  // Top-level metadata (catalogVersion, generatedAt) — inert by definition, but an UNKNOWN top-level
  // field changing is not, so it is classified like anything else.
  for (const c of leafChanges(
    { ...before, marketplaces: undefined },
    { ...after, marketplaces: undefined },
    "",
  )) {
    if (!INERT_PATHS.has(c.path)) diff.freshnessOnly = false;
  }

  for (const [name, mkA] of mkAfter) {
    const mkB = mkBefore.get(name);
    if (!mkB) {
      diff.freshnessOnly = false;
      continue;
    }

    const spineB = new Map(spineOf(mkB).map((n) => [String(n.id), n]));
    const spineA = new Map(spineOf(mkA).map((n) => [String(n.id), n]));
    for (const [id, node] of spineA) {
      const prev = spineB.get(id);
      if (!prev) {
        diff.addedCategories.push({ marketplace: name, categoryId: id, name: String(node.name) });
        diff.freshnessOnly = false;
      } else {
        // Normalise once — an absent key and an explicit null mean the same thing (a root), and
        // comparing them differently would report a phantom re-parent every run.
        const parentBefore = (prev.parentId as string | null | undefined) ?? null;
        const parentAfter = (node.parentId as string | null | undefined) ?? null;
        if (parentBefore !== parentAfter) {
          diff.reparented.push({
            marketplace: name,
            categoryId: id,
            name: String(node.name),
            parentBefore,
            parentAfter,
          });
          diff.freshnessOnly = false;
        }
      }
    }
    for (const [id, node] of spineB) {
      if (!spineA.has(id)) {
        diff.removedCategories.push({ marketplace: name, categoryId: id, name: String(node.name) });
        diff.freshnessOnly = false;
      }
    }

    const byKeyB = new Map(entriesOf(mkB).map((e) => [entryKey(e.determinants), e]));
    const byKeyA = new Map(entriesOf(mkA).map((e) => [entryKey(e.determinants), e]));
    for (const [key, entryA] of byKeyA) {
      const entryB = byKeyB.get(key);
      const changes = entryB
        ? leafChanges(entryB, entryA, "")
        : [{ path: "(new entry)", before: undefined, after: key }];
      if (changes.length === 0) continue;
      if (changes.some((c) => !INERT_PATHS.has(c.path))) diff.freshnessOnly = false;
      const rawCategory = (entryA.determinants as Json | null)?.category;
      const categoryId = rawCategory === undefined ? null : String(rawCategory);
      // `String(undefined)` is the string "undefined", so a `?? null` AFTER it never fires — an
      // entry keyed to a category the spine does not carry would have been reported to the reviewer
      // as a category literally named "undefined". Resolve the node first, then decide.
      const node = categoryId === null ? undefined : spineA.get(categoryId);
      diff.changedEntries.push({
        marketplace: name,
        categoryId,
        categoryName: node === undefined ? null : String(node.name),
        determinants: (entryA.determinants as Record<string, string> | null) ?? null,
        changes,
      });
    }
    for (const key of byKeyB.keys()) {
      if (!byKeyA.has(key)) diff.freshnessOnly = false; // an entry disappeared — never unattended
    }
  }

  for (const name of mkBefore.keys()) if (!mkAfter.has(name)) diff.freshnessOnly = false;

  return diff;
}

/** True when this run may be merged without a human reading it (FR-020a). */
export function mayAutoMerge(diff: CatalogDiff): boolean {
  return (
    diff.freshnessOnly &&
    diff.addedCategories.length === 0 &&
    diff.removedCategories.length === 0 &&
    diff.reparented.length === 0
  );
}

import { isInerte } from "./inert-fields.ts";

// The monthly diff (014/US4). Pure: two artifacts in, a reviewable description out.
//
// This module carries the increment's sharpest safety property, so it is worth stating plainly:
// the job NEVER decides to write money. It always opens a PR. What is decided here is only whether
// that PR may skip human review — and only when the change is provably nothing but a re-verification
// date (FR-020a). `develop` carries platform protection behind this (FR-020c); the classifier is the
// convenience, not the gate.

// 017/T007 — a lista de campos inertes agora mora em `inert-fields.ts`, uma vez só (fecha 014/U4-f).
// Ela era declarada aqui E em `refresh.ts`, com os mesmos três nomes e nada obrigando as duas a
// andarem juntas: uma decidia `freshnessOnly` (a dispensa de revisão), a outra decidia o que o
// revisor lê na tabela do PR.

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
    /** 014/T104 — uma entrada que SUMIU. Antes ela derrubava `freshnessOnly` e não entrava em lista
     *  nenhuma: o PR afirmava haver mudança sem mostrar qual, o que é pior do que não avisar — gasta a
     *  atenção do revisor sem dirigi-la. Uma entrada some quando a fonte para de publicar aquela
     *  categoria, e isso é dinheiro: o slot correspondente deixa de resolver. */
    removedEntries: {
        marketplace: string;
        categoryId: string | null;
        determinants: Record<string, string> | null;
    }[];
    /** 014/T104 — marketplaces inteiros entrando ou saindo, também nomeados em vez de mudos. */
    addedMarketplaces: string[];
    removedMarketplaces: string[];
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
/** 014/T105 — no padrão dos dois acima. `(cat.marketplaces ?? [])` cobria só null/undefined, então um
 *  JSON VÁLIDO com `marketplaces` como objeto estourava um `TypeError` — contra o contrato "degrada,
 *  não quebra" que este módulo declara. Degradar para `[]` faz o outro lado ler como "todo marketplace
 *  sumiu", que derruba a dispensa: falhar fechado é o desfecho certo para um artefato disforme. */
const marketplacesOf = (cat: Json) =>
    Array.isArray(cat.marketplaces) ? (cat.marketplaces as Json[]) : [];

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
        removedEntries: [],
        addedMarketplaces: [],
        removedMarketplaces: [],
        freshnessOnly: true,
    };

    const mkBefore = new Map(marketplacesOf(before).map((m) => [String(m.marketplace), m]));
    const mkAfter = new Map(marketplacesOf(after).map((m) => [String(m.marketplace), m]));

    // Top-level metadata (catalogVersion, generatedAt) — inert by definition, but an UNKNOWN top-level
    // field changing is not, so it is classified like anything else.
    for (const c of leafChanges(
        { ...before, marketplaces: undefined },
        { ...after, marketplaces: undefined },
        "",
    )) {
        if (!isInerte(c.path)) diff.freshnessOnly = false;
    }

    for (const [name, mkA] of mkAfter) {
        const mkB = mkBefore.get(name);
        if (!mkB) {
            diff.addedMarketplaces.push(name);
            diff.freshnessOnly = false;
            continue;
        }

        // 014/T103 — os campos de NÍVEL MARKETPLACE. O laço comparava espinha e entradas, e mais nada:
        // `determinantsSchema` — o contrato de quais determinantes existem — podia perder um eixo e a
        // execução seguia dispensável. Aqui nenhum campo é data de reverificação, então QUALQUER mudança
        // é material por construção; e tratar um campo NOVO desconhecido como material é exatamente o que
        // "falhar fechado" significa.
        const mkFields = leafChanges(
            { ...mkB, categorySpine: undefined, entries: undefined },
            { ...mkA, categorySpine: undefined, entries: undefined },
            name,
        );
        if (mkFields.length > 0) diff.freshnessOnly = false;

        const spineB = new Map(spineOf(mkB).map((n) => [String(n.id), n]));
        const spineA = new Map(spineOf(mkA).map((n) => [String(n.id), n]));
        for (const [id, node] of spineA) {
            const prev = spineB.get(id);
            if (!prev) {
                diff.addedCategories.push({
                    marketplace: name,
                    categoryId: id,
                    name: String(node.name),
                });
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
                diff.removedCategories.push({
                    marketplace: name,
                    categoryId: id,
                    name: String(node.name),
                });
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
            if (changes.some((c) => !isInerte(c.path))) diff.freshnessOnly = false;
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
        for (const [key, entryB] of byKeyB) {
            if (byKeyA.has(key)) continue;
            // T104 — nomeada, não apenas sinalizada. Uma entrada some quando a fonte para de publicar
            // aquela categoria, e isso é dinheiro: o slot correspondente deixa de resolver.
            const raw = (entryB.determinants as Json | null)?.category;
            diff.removedEntries.push({
                marketplace: name,
                categoryId: raw === undefined ? null : String(raw),
                determinants: (entryB.determinants as Record<string, string> | null) ?? null,
            });
            diff.freshnessOnly = false;
        }
    }

    for (const name of mkBefore.keys()) {
        if (!mkAfter.has(name)) {
            diff.removedMarketplaces.push(name);
            diff.freshnessOnly = false;
        }
    }

    return diff;
}

/** True when this run may be merged without a human reading it (FR-020a). */
export function mayAutoMerge(diff: CatalogDiff): boolean {
    return (
        diff.freshnessOnly &&
        diff.addedCategories.length === 0 &&
        diff.removedCategories.length === 0 &&
        diff.reparented.length === 0 &&
        // T104 — as listas novas entram aqui também. Deixá-las de fora faria a dispensa depender só de
        // `freshnessOnly`, e o dia em que alguém esquecesse de derrubá-lo num caminho novo, o portão
        // abriria em silêncio. A redundância é deliberada: duas fechaduras na mesma porta.
        diff.removedEntries.length === 0 &&
        diff.addedMarketplaces.length === 0 &&
        diff.removedMarketplaces.length === 0
    );
}

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type CategoryNode,
  categoryPath,
  categoryPathOfNode,
  childrenOf,
  indexSpine,
  rootNodes,
  searchCategories,
} from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Field } from "@/shared/ui";

import "./category-picker.css";

const t = messages.calculator.categoryPicker;

// 014/US1 — behaviour only; layout, the drill-vs-search affordance and where this sits inside the
// slot are `designer-ux`'s. Two things here are NOT cosmetic and must survive any restyle:
//
// 1. It renders ALWAYS and EXPANDED (FR-006a). A collapsed field plus an already-plausible
//    pre-filled number is exactly how a seller ends up accepting a rate that is not his. Choosing
//    stays optional as a GATE — nothing here blocks a calculation — and stops being optional as an
//    AFFORDANCE.
// 2. Every result shows its FULL PATH. ML publishes "Celulares e Telefones" at 18% and "Celulares e
//    Smartphones" at 16%; listing bare names makes picking between them a coin flip on 2 percentage
//    points of the seller's price.

export interface CategoryPickerProps {
  /** The marketplace's category spine, as shipped with the catalog (D2). */
  spine: readonly CategoryNode[];
  /** Currently chosen category id, if any. */
  value?: string | undefined;
  /** Reports the chosen id, or `undefined` when cleared. */
  onChange: (categoryId: string | undefined) => void;
  /**
   * Does this slot currently stand on a fee it did not have to invent? (FR-006d.)
   *
   * The picker knows the category spine and NOTHING about the money — which is why its empty state
   * used to assert "a taxa exibida já é a correta" while the same slot's seal read "sem referência".
   * The caller derives this from that seal, so the two surfaces can no longer disagree.
   */
  hasFeeReference: boolean;
}

const MAX_RESULTS = 8;

export function CategoryPicker({ spine, value, onChange, hasFeeReference }: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const index = useMemo(() => indexSpine(spine), [spine]);
  // 016/US13 (T054) — which browse-tree nodes are expanded. Plain ids, not a per-marketplace reset:
  // a marketplace switch replaces `spine` entirely (a stale expanded id simply never matches a node
  // again, same as an unmounted picker).
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  // 016/US13 (T044 homologação PR-E, R2) — the browse tree nasce RECOLHIDA. Measured: a spine of 38
  // (Amazon) rendered inline pushed the page to 1.795px BEFORE any input, and the final price fell
  // to y≈4.800 at 360px — every premium account paid that cost on every slot, whether or not it
  // ever opens the tree. Search stays the primary, always-visible path; the tree is now a
  // deliberate opt-in behind a button naming the REAL count.
  const [browseOpen, setBrowseOpen] = useState(false);
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Choosing UNMOUNTS the option button along with the whole list, so focus fell to `document.body`:
  // a keyboard user lost their place in the form at the exact moment they had just decided the
  // commission on their own sale. The flag distinguishes "the seller just chose" from "the component
  // mounted already carrying a value" — only the first should steal focus.
  const justChose = useRef(false);
  const clearRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (value && justChose.current) {
      justChose.current = false;
      clearRef.current?.focus();
    }
  }, [value]);

  // The spine is sparse and the NAME index is fetched on demand (D2), so an empty one is a real
  // state, not an error — say so plainly instead of rendering a search box that can never match.
  // WHAT to say depends on whether the slot has a fee behind it (FR-006d): with one, the only thing
  // missing is the name list; without one, the honest instruction is to type the commission, which
  // is exactly what the "sem referência" seal beside it already implies. The picker never claims a
  // rate is shown, never claims it is correct, and never promises a load it cannot guarantee.
  if (spine.length === 0) {
    return (
      <p role="status" className="category-picker__note">
        {hasFeeReference ? t.unavailableWithFee : t.unavailableNoReference}
      </p>
    );
  }

  if (value) {
    // T116 — the spine is SPARSE and this id may not be in it (a product saved before a catalog
    // revision, a reopened scenario, a node the marketplace dropped). The path used to come back as
    // the empty string and render a BLANK label next to "Limpar": a chip naming nothing, beside a
    // button offering to clear it. Say what is true instead — the catalog does not carry this
    // category — and keep the value VISIBLE rather than falling back to the search box, because a
    // value the form still holds and the screen no longer shows is the drift T097 closed.
    const path = categoryPath(index, value);
    return (
      // T115 — the chosen state keeps the FIELD: same name above it, same frame around it. It used
      // to return this bare, so choosing a category made the label, the hint and the whole frame
      // vanish and left the word "Calçados" floating between "Modalidade" and "Comissão" — the
      // seller's own choice reading as stray text. A field that stops looking like a field once it
      // is filled is the same FR-006a failure as one that never looked like a field.
      //
      // Deliberately NOT `<Field>`: it renders `<label htmlFor>`, and there is no form control here
      // to point at — a dangling `for` is a promise to the screen reader that nothing keeps. The
      // name is plain text in the reading order, and `chosenLabel` below says it is a choice.
      <div className="tf-field">
        <span className="tf-field__label tf-field__label--tight">{t.label}</span>
        {/* `role="status"` like the two sibling branches below — this was the only one of the three
            that announced nothing, and it is the one that reports a decision the seller just made. */}
        <div
          role="status"
          className="tf-inputwrap category-picker category-picker--chosen"
          data-testid="category-chosen"
        >
          <span
            className={`category-picker__chosen${path === null ? " category-picker__chosen--unknown" : ""}`}
            data-testid="category-chip"
          >
            {path === null ? (
              // No `chosenLabel` prefix here: the copy already names itself, and "Categoria
              // escolhida: a categoria escolhida não está neste catálogo" is what a reader would get.
              t.unknownChosen
            ) : (
              <>
                <span className="sr-only">{t.chosenLabel} </span>
                {path}
              </>
            )}
          </span>
          <Button
            ref={clearRef}
            variant="ghost"
            size="sm"
            aria-label={t.clearAria}
            onClick={() => onChange(undefined)}
          >
            {t.clear}
          </Button>
        </div>
      </div>
    );
  }

  const choose = (id: string) => {
    justChose.current = true;
    onChange(id);
    setQuery("");
  };

  const searched = query.trim().length > 0;
  // Busca SEM corte e corta depois, de propósito: a contagem precisa do total real. Cortar dentro do
  // `searchCategories` (via o seu `limit`) devolveria 8 e o rótulo diria "8 categorias encontradas"
  // com 23 existindo — o vendedor pararia de refinar acreditando ter visto tudo, e a categoria dele
  // pode ser a nona. O limite explícito é `spine.length` porque o padrão do próprio helper é 50, que
  // é só um corte maior. A espinha é ESPARSA por construção (ver o docstring de category-tree), então
  // varrê-la inteira a cada tecla é barato.
  const matches = searched ? searchCategories(spine, query, spine.length) : [];
  const results = matches.slice(0, MAX_RESULTS);
  const countLabel =
    matches.length > results.length
      ? t.resultsTruncated
          .replace("{n}", String(results.length))
          .replace("{total}", String(matches.length))
      : matches.length === 1
        ? t.resultsOne
        : t.resultsMany.replace("{n}", String(matches.length));

  return (
    <Field label={t.label} hint={t.hint} tightLabel>
      {({ id, "aria-describedby": describedBy }) => (
        <div className="category-picker">
          {/* The DS field frame, the same `.tf-inputwrap`/`.tf-input` pair NumberField uses — NOT a
              look-alike rebuilt here. This field decides which commission the seller is charged and
              it used to render as a raw 24px `<input>` with no border, background or padding
              (T115). */}
          <div className="tf-inputwrap">
            <input
              id={id}
              aria-describedby={describedBy}
              type="text"
              autoComplete="off"
              className="tf-input"
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {/* T117 — ONE live region, always mounted. Both halves matter. "Always mounted" because a
              region that appears together with its text is not reliably announced: the reader has to
              be watching it before the content changes. "One" because the count and the no-results
              advice are the same slot of information about the same search, and two competing status
              regions is how a screen reader ends up reading neither in order.

              It also replaces what the `combobox` contract was pretending to provide. This input used
              to carry `role="combobox"` + `aria-expanded` + `aria-controls` pointing at a listbox that
              only exists while there are results — a dangling reference most of the time — with no
              `aria-activedescendant`, no arrow-key navigation, and `aria-selected={false}` nailed to
              every option. The promise was a navigable popup widget; what is on screen is an in-flow
              list of real buttons, which is what the markup now says. Not announcing it is not a
              downgrade: nothing that was announced ever worked. */}
          <p
            className={`category-picker__note${results.length > 0 ? " category-picker__count" : ""}`}
            role="status"
          >
            {/* `noResults` is deliberately NOT "nada encontrado": the likely reason is that the
                seller searched for his OBJECT ("suporte de celular") while the marketplace names the
                USE ("Acessórios para Celulares"). Telling him how to search again is worth more than
                telling him he failed. */}
            {searched ? (results.length > 0 ? countLabel : t.noResults) : ""}
          </p>
          {results.length > 0 && (
            <ul className="category-picker__list">
              {results.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="category-picker__option"
                    onClick={() => choose(node.id)}
                  >
                    {/* By NODE, not by id: the node came out of this very spine, so there is no
                        unknown case to handle — and none to invent a fallback for either. */}
                    {categoryPathOfNode(index, node)}
                    <span className="category-picker__go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* 016/US13 (T054, FR-920) — hierarchical browse, ALONGSIDE search (not instead of it):
              reachable whenever the seller has not typed anything yet. 016/US11 (T044 homologação
              PR-E, R2) — it now nasce RECOLHIDA behind a button naming the REAL count (never "8" —
              `resultsTruncated`'s own lesson, applied here too); opened, it gets its OWN scroll
              (~40vh) so a 38-node spine never pushes the whole page. A flat spine (Amazon) degrades
              to a plain list with no code branch for it: every node IS a root, `childrenOf` returns
              `[]` for each — no expand affordance ever renders. */}
          {!searched && (
            <>
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                aria-expanded={browseOpen}
                data-testid="category-browse-toggle"
                onClick={() => setBrowseOpen((v) => !v)}
              >
                {browseOpen
                  ? t.browseCollapse
                  : t.browseToggle.replace("{n}", String(spine.length))}
              </Button>
              {browseOpen && (
                <div className="category-picker__browse-scroll">
                  <p className="category-picker__note category-picker__count" role="status">
                    {t.browseCount.replace("{n}", String(spine.length))}
                  </p>
                  <CategoryTreeList
                    nodes={rootNodes(spine)}
                    allNodes={spine}
                    index={index}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    onSelect={choose}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Field>
  );
}

/** One level of the hierarchical browse tree (016/US13, T054) — recursive, and each recursive call
 *  owns its own `<ul>` so nesting never double-wraps. A node is ALWAYS directly selectable (an
 *  intermediate category is a valid choice, not just a leaf); the "▸"/"▾" disclosure only ever
 *  controls whether its children are visible, and renders at all only when there ARE children — a
 *  leaf gets no dead-end toggle. */
function CategoryTreeList({
  nodes,
  allNodes,
  index,
  expanded,
  onToggleExpand,
  onSelect,
}: {
  nodes: readonly CategoryNode[];
  allNodes: readonly CategoryNode[];
  index: Map<string, CategoryNode>;
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="category-picker__list category-picker__tree" data-testid="category-tree">
      {nodes.map((node) => {
        const kids = childrenOf(allNodes, node.id);
        const isExpanded = expanded.has(node.id);
        return (
          <li key={node.id}>
            <div className="category-picker__tree-row">
              {kids.length > 0 && (
                <button
                  type="button"
                  className="category-picker__expand"
                  aria-expanded={isExpanded}
                  aria-label={(isExpanded ? t.collapseAria : t.expandAria).replace(
                    "{name}",
                    node.name,
                  )}
                  onClick={() => onToggleExpand(node.id)}
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              )}
              <button
                type="button"
                className="category-picker__option"
                onClick={() => onSelect(node.id)}
              >
                {node.name}
                <span className="category-picker__go" aria-hidden="true">
                  ›
                </span>
              </button>
            </div>
            {kids.length > 0 && isExpanded && (
              <CategoryTreeList
                nodes={kids}
                allNodes={allNodes}
                index={index}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

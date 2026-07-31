import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  type CategoryNode,
  categoryPath,
  categoryPathOfNode,
  indexSpine,
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
  const listId = useId();
  const index = useMemo(() => indexSpine(spine), [spine]);
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

  const results = query.trim() ? searchCategories(spine, query, MAX_RESULTS) : [];
  const searched = query.trim().length > 0;

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
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              autoComplete="off"
              className="tf-input"
              placeholder={t.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {results.length > 0 && (
            <ul id={listId} role="listbox" className="category-picker__list">
              {results.map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="category-picker__option"
                    onClick={() => {
                      justChose.current = true;
                      onChange(node.id);
                      setQuery("");
                    }}
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
          {searched && results.length === 0 && (
            // Not "nada encontrado": the likely reason is that the seller searched for his OBJECT
            // ("suporte de celular") and the marketplace names the USE ("Acessórios para Celulares").
            // Telling him how to search again is worth more than telling him he failed.
            <p role="status" className="category-picker__note">
              {t.noResults}
            </p>
          )}
        </div>
      )}
    </Field>
  );
}

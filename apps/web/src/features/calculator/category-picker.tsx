import { useId, useMemo, useState } from "react";

import {
  type CategoryNode,
  categoryPath,
  indexSpine,
  searchCategories,
} from "@/shared/fee-catalog";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Field } from "@/shared/ui";

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
}

const MAX_RESULTS = 8;

export function CategoryPicker({ spine, value, onChange }: CategoryPickerProps) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const index = useMemo(() => indexSpine(spine), [spine]);

  // The spine is sparse and the NAME index is fetched on demand (D2). Offline on a first run the
  // seller already has the correct RATE but not the name list — say so plainly instead of rendering
  // a search box that can never match anything.
  if (spine.length === 0) {
    return (
      <p role="status" className="category-picker__note">
        {t.unavailableOffline}
      </p>
    );
  }

  if (value) {
    return (
      <div className="category-picker category-picker--chosen">
        <span className="category-picker__chosen">{categoryPath(index, value)}</span>
        <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
          {t.clear}
        </Button>
      </div>
    );
  }

  const results = query.trim() ? searchCategories(spine, query, MAX_RESULTS) : [];
  const searched = query.trim().length > 0;

  return (
    <Field label={t.label} hint={t.hint} tightLabel>
      {({ id, "aria-describedby": describedBy }) => (
        <div className="category-picker">
          <input
            id={id}
            aria-describedby={describedBy}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            autoComplete="off"
            className="category-picker__input"
            placeholder={t.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
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
                      onChange(node.id);
                      setQuery("");
                    }}
                  >
                    {categoryPath(index, node.id)}
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

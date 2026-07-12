import type { BomLineResult } from "@3dprecify/pricing-core";
import type { ReactNode } from "react";

import { formatBRL } from "@/shared/lib/decimal-ptbr";
import { messages } from "@/shared/i18n/messages.pt-br";
import { Button, Card, Icon, NumberField } from "@/shared/ui";

// 008/T005 — one composer line (ux §1.1/§1.3 Option A): a Card collapsed to a summary row
// (label · qty · money) that expands to host the line editor (injected as `children` by the
// page — R7 keeps `features/bom` boundary-clean: the editor composes `features/calculator`
// sections at the widgets layer). All money read off `BomLineResult`; nothing multiplied here.

const t = messages.bom;

export interface BomLineCardProps {
  /** 1-based display index ("Peça {n}"). */
  index: number;
  /** Bound product name; null renders the honest "(avulsa)". */
  name: string | null;
  quantityRaw: string;
  onQuantityChange: (raw: string) => void;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** The engine's per-line outcome; null while the line is invalid (excluded from the total). */
  lineResult: BomLineResult | null;
  /** True when the line's inputs or quantity fail validation — captioned, never silently zero. */
  invalid: boolean;
  /** The referenced product was deleted after save: the line reopened on its last-known snapshot
   *  (F1/K3 — a calm caption, NEVER a "produto removido" claim; ux §1.2-D). */
  degraded?: boolean;
  children?: ReactNode;
}

export function BomLineCard({
  index,
  name,
  quantityRaw,
  onQuantityChange,
  expanded,
  onToggle,
  onRemove,
  lineResult,
  invalid,
  degraded,
  children,
}: BomLineCardProps) {
  // The K4 pre-fill names a materialized piece "Peça {n} · {kit}", which is exactly this prefix —
  // so a reopened kit would read "Peça 1 · Peça 1 · Kit X". Don't repeat a prefix the name already
  // carries (homologation nit).
  const prefix = t.lineLabel.replace("{n}", String(index));
  const label =
    name && name.startsWith(`${prefix} · `) ? name : `${prefix} · ${name ?? t.lineAdhoc}`;
  const qtyZero = lineResult !== null && lineResult.quantity === 0;
  return (
    <Card padding="md" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex min-h-11 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
          aria-label={`${label} — ${expanded ? t.collapse : t.expand}`}
          onClick={onToggle}
        >
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={16} aria-hidden />
          <span className="text-sm font-medium">{label}</span>
        </button>
        <NumberField
          size="sm"
          unit={t.quantityUnit}
          inputMode="numeric"
          placeholder="1"
          // Include the line label so a screen reader distinguishes each line's quantity field
          // ("Quantidade — Peça 1 · …") instead of announcing N identical "Quantidade" fields.
          aria-label={`${t.quantity} — ${label}`}
          value={quantityRaw}
          onChange={(e) => onQuantityChange(e.target.value)}
          className="w-24"
        />
        <Button
          variant="ghost"
          size="sm"
          aria-label={`${t.removeLine} — ${label}`}
          onClick={onRemove}
        >
          <Icon name="x" size={16} aria-hidden />
        </Button>
      </div>

      {lineResult !== null && (
        <p className="text-sm text-[var(--text-muted)]">
          {formatBRL(lineResult.line.custoTotal)} /{t.quantityUnit} ·{" "}
          {t.lineTotal.replace("{qty}", String(lineResult.quantity))}{" "}
          {formatBRL(lineResult.custoTotal)}
        </p>
      )}
      {qtyZero && <p className="text-sm text-[var(--text-muted)]">{t.qtyZero}</p>}
      {invalid && <p className="text-sm text-[var(--text-muted)]">{t.lineInvalid}</p>}
      {/* Degraded (product deleted after save): a calm legenda reusing the E2 manual-product copy —
          the line kept its last-known values and stays editable. NEVER says "removido/excluído"
          (F1/K3 — born-manual and delete-degraded are one honest state; ux §1.2-D). */}
      {degraded && (
        <p className="text-sm text-[var(--text-muted)]">{messages.productForm.manualValuesKept}</p>
      )}

      {expanded && children}
    </Card>
  );
}

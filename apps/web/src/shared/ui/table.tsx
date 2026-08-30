import { type TableHTMLAttributes } from "react";

import "./table.css";

export type TableProps = TableHTMLAttributes<HTMLTableElement>;

/**
 * `tf-table` (019/T012·T018, PR-A, ADR-0032, contrato ui-porte.md §C0) — o Catálogo denso a
 * partir de 1024px: comparar preços é leitura de COLUNA, e coluna não existe em cartões. O
 * contrato não define uma API de `columns`/`rows`; este é o wrapper mais simples que preserva a
 * marcação da folha — `<table>` semântico puro. Quem chama escreve o próprio `thead`/`tbody` com
 * as classes `tf-table__name`/`tf-table__num`/`tf-table__num--muted`/`tf-table__actions` da folha.
 */
export function Table({ className = "", ...rest }: TableProps) {
  return <table className={["tf-table", className].filter(Boolean).join(" ")} {...rest} />;
}

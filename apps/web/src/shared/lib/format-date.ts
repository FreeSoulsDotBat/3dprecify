// 019/PR-D (T068) — o formatador de data pt-BR, promovido de duas cópias locais (`fee-seal.tsx`
// `fmtDate` e `calculator-form.tsx` `fmtDatePtBr`) para uma lib compartilhada.
//
// Regra de fuso, DECLARADA: a tabela de datas que este arquivo formata (catálogo, taxas, "salvo
// em") não guarda offset — ao contrário de `snapshots`, que congela um instante. A leitura por
// padrão usa o fuso do APARELHO (`Intl` sem `timeZone` explícito lê `Date` no fuso local do
// runtime). O parâmetro `timeZone` opcional existe só para o teste provar a regra contra um
// instante que cruza a meia-noite UTC — nenhum chamador do produto precisa passá-lo hoje.

/** ISO date ("2026-07-06") ou timestamp completo → pt-BR "06/07/2026"; string crua se não parsear. */
export function formatDatePtBr(iso: string, timeZone?: string): string {
  const parts = readDateParts(iso, timeZone);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : iso;
}

/** ISO date/timestamp → "dd/mm" (a prancheta 16, "Salvo em 12/05"); string crua se não parsear. */
export function formatDayMonthPtBr(iso: string, timeZone?: string): string {
  const parts = readDateParts(iso, timeZone);
  return parts ? `${parts.day}/${parts.month}` : iso;
}

function readDateParts(
  iso: string,
  timeZone?: string,
): { day: string; month: string; year: string } | null {
  // Data pura ("YYYY-MM-DD", sem hora) é um calendário, não um instante — não passa por fuso
  // nenhum. Ler isso como `Date` cairia na meia-noite UTC e, num fuso negativo (América), voltaria
  // um dia (o bug clássico do `new Date("2026-07-06")`). Cobre os chamadores de hoje (fee-seal,
  // calculator-form) byte-a-byte.
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (dateOnly) return { year: dateOnly[1], month: dateOnly[2], day: dateOnly[3] };

  // Instante completo (timestamp): lido no fuso do APARELHO por padrão — `timeZone` indefinido faz
  // o `Intl` usar o fuso do runtime, que é exatamente "o fuso do aparelho". O parâmetro só existe
  // para o teste forçar um fuso quando o processo do vitest não controla `TZ` de forma confiável.
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone,
  });
  const byType = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: byType.day, month: byType.month, year: byType.year };
}

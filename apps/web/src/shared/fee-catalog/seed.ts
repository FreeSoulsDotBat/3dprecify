import type { FeeCatalog } from "./fee-catalog";
import seedData from "./seed.data.json";

// @doc ADR-0029 — a semente é SAÍDA de `pnpm fee:build`, não documento: nunca editada à mão.
// @doc FONTE-001 — a procedência dos números da Shopee (arts. 26839 e 23431, verbatim).
// ⚠ @doc 014/FR-026 — o `as unknown as` é deliberado: um `parse()` aqui derrubaria o boot em tela
//   branca. A validação mora onde sabe DEGRADAR — `parseSeedResilient` em `use-fee-catalog.ts`.
export const FEE_CATALOG_SEED = seedData as unknown as FeeCatalog;

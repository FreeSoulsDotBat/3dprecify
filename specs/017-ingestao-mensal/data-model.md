# Data Model 017 — tipos, baselines e estados (Phase 1)

Nada aqui toca schema de banco, wire de API ou `pricing-core`. O domínio do 017 é o PIPELINE:
vereditos, fatias, baselines e o corpo do PR. (Uma mudança que tocasse folha de dinheiro do
catálogo escalaria para opus por ADR-0022 — o 017 não cria nem remove folha; ele RELÊ as que
existem.)

## §1 Vereditos e cobertura (decisão A)

```ts
type Mk = "AMAZON" | "SHOPEE" | "MERCADO_LIVRE";   // + "AMAZON_PRECOS" como FONTE de vigia

// packages/fee-ingest/src/verdict.ts — 3 casos, nenhum quarto que escreva calado
export type CollectorVerdict =
  | { kind: "LIDO"; marketplace: Mk; collectedAt: string; sourceUrl: string; slice: CatalogSlice }
  | { kind: "ABORTADO"; marketplace: Mk; reason: string; sourceUrl: string }
  | { kind: "NAO_LIDO"; marketplace: Mk; reason: string };

// A VERDADE é a tabela, não o `ls`: marketplace sem veredito no disco vira
// NAO_LIDO { reason: "o job não produziu veredito" } por função TOTAL sobre MARKETPLACE_COVERAGE.
export const MARKETPLACE_COVERAGE: readonly Mk[];
```

Regras: cada job de coleta termina escrevendo `artifacts/<fonte>.verdict.json` e o sobe como
artefato da run; o compositor produz `Record<Mk, CollectorVerdict>` total.

## §2 Fatias e composição (decisão C)

```ts
// slice.ts — o tipo NÃO tem caminho para o disco
export type CatalogSlice = {
  marketplace: Mk;
  leaves: LeafWrite[];        // APENAS folhas que o coletor declarou ter LIDO
  collectedAt: string;
  sourceUrl: string;
};

// aplicarFatia(base, slice): toda folha NÃO declarada vem da BASE (regra da folha lida).
// É o que impede o coletor Shopee de reverter o hotfix A2: freight/freightSubsidyInfo/
// optionalSurcharges não estão no PNG ⇒ não estão na fatia ⇒ ficam da base. Provado por
// ponto fixo: PNG inalterado ⇒ artefato byte-idêntico (extensão do I9).

// compose.ts — ordem alfabética; decideRefresh POR marketplace; fatia reprovada ⇒ veredito
// vira ABORTADO (o PR parcial da Q4 expresso por tipo). Depois de admitir tudo:
// UM nextCatalogVersion + UM generatedAt (um bump por EXECUÇÃO — decisão B).
export type RunOutcome =
  | { kind: "SEM_PR"; motivo: string }
  | { kind: "PR"; titulo: string; corpo: string; dispensa: boolean; decisaoDoDono: boolean };
// Não existe terceiro caso que escreva (FR-020a em dois níveis).
```

## §3 Baselines de vigia (decisão E; clarify Q1)

Um arquivo por fonte em `packages/fee-ingest/data/`, forma comum:

```jsonc
{
  "sourceUrl": "…",
  "collectedAt": "2026-08-07",
  "selfDatedAs": "20/01/2025",            // ou null — a auto-datação que classifica a fonte vintage
  "shape": { "rows": 29, "cols": 8 },      // guarda de forma como DADO (canária)
  "anchors": ["…verbatim do T057…"],       // TÊM de existir; ausência = ABORT
  "absentAnchors": ["mínimo", "piso"],     // NÃO podem existir (a lição 014/US4 virada em dado)
  "values": { "...": "por fonte" },
  "contentHash": "sha256:…"
}
```

Arquivos: `amazon-precos.baseline.json` (mínimos por categoria + planos Individual R$ 2,00/item
e Profissional R$ 19/mês + auto-datação) · `ml-frete-{verde,amarela,vermelha}.baseline.json`
(3 × 29×8; limiar R$ 79 nos cabeçalhos; o E3 herda o insumo) · `ml-textos.baseline.json` (doc
developers "Última atualização em" · regra 50% < R$ 12,50 · cubagem divisor 6000) ·
`shopee-art26839.baseline.json` (âncoras + endereços `sha256(bytes)` dos PNGs — identidade é o
hash; URL é procedência).

```ts
// watch/*.ts — a separação estrutural do D7:
export type WatchReading = { /* leituras tipadas por fonte */ };
// NÃO EXISTE função WatchReading → FeeEntry | CatalogSlice em módulo nenhum.
// O vigia /precos confere o plano Individual contra AMAZON_INDIVIDUAL_PER_ITEM_FEE (2.0),
// a constante que JÁ é a fonte do número servido — discordância = alerta, número mora num lugar.
```

## §4 OCR e guardas (decisão F)

```ts
// ocr/avaliar-ocr.ts — conjuntiva, pura, sob o ratchet 100%
avaliarOcr(leitura, { anchors, absentAnchors, anterior }): SanityVerdict
// 1. FORMA: nº de faixas esperado; toda célula parseável em formato BR (vírgula decimal)
// 2. SANIDADE: comissão ∈ [5, 25]%
// 3. NÃO-CONTRADIÇÃO: âncoras de texto do baseline (fonte: T057, nunca OBTENCAO §8 — R7)
// 4. COBERTURA: checkBandCoverage (existente)
// Qualquer reprovada ⇒ ABORT; artefato intocado; sem PR.

// Limiar do banner (clarify Q8) — constante com a razão escrita, RATIFICAR NO GATE:
OCR_DIVERGENCE_BANNER = { relativo: 0.30, absolutoBRL: 5.00 };  // proposta ao dono
```

Detector (`shopee-detector.ts`): conjunto de `sha256(bytes)` inalterado ⇒ 0 OCR (caminho comum);
URL nova + bytes iguais ⇒ atualiza URL no baseline, relatório diz "re-upload sem mudança", OCR
não roda; bytes diferentes ⇒ tabela nova, OCR roda.

## §5 Dispensa, inertes e o corpo do PR (decisões E.4/I; US2)

```ts
// inert-fields.ts — A lista (funde refresh.INERT + catalog-diff.INERT_PATHS; fecha U4-f).
// Lida pelo classificador E pela tabela do corpo — um campo novo entra num lugar só.

// exemption.ts — falha-fechado nos DOIS eixos:
//   (a) diff do catálogo exclusivamente inerte  E
//   (b) conjunto de arquivos do PR ⊆ { backend/app/data/catalog.json,
//                                      apps/web/src/shared/fee-catalog/seed.data.json }
// ALLOW_FRESHNESS_EXEMPTION: input/variável do workflow, padrão FALSE (nasce desligada — Q5);
// o corpo IMPRIME que está desligada e por quê (P0-b).

// pr-body.ts — função pura (vereditos, diff, vigias, exemption) → markdown:
//   · execução sem mudança ⇒ ZERO seções de mudança (testado com not.toContain)
//   · mudança ⇒ `antigo → novo` por categoria, com fonte + data de coleta
//   · SEMPRE: os 3 estados por marketplace da MARKETPLACE_COVERAGE (ML = NÃO LIDO com porquê)
//   · vigias: seção "## Vigias (nenhum dado alterado)" com diff de baseline
//   · PR de decisão (Q2): título "DECISÃO — " + label decisao-do-dono + seção no TOPO
//     (valor A × valor B × auto-datação × 2 URLs) + dispensa forçada a NÃO
//   · banner Q8 acima do limiar: "divergência acima do limiar declarado — confira a imagem"
//     + lido × anterior × link da imagem (AC5 — sem isso a revisão de OCR é teatro)
```

## §6 Estados da execução (máquina inteira)

```text
por coletor:   COLETOU → fatia admitida ─┐
               COLETOU → fatia reprovada ─┤→ veredito {LIDO | ABORTADO | NAO_LIDO}
               FALHOU (fonte/canária)  ───┤
               sem veredito no disco ─────┘ (⇒ NAO_LIDO "o job não produziu veredito")

por execução:  RunOutcome = SEM_PR(motivo) | PR(corpo honesto, ≤1 por dia via branch bot/fee-refresh-<data>)

liveness:      ci.yml/loop-liveness: idade = hoje − max(lastReviewed | coberto) → >35d ⇒ ::warning::
               (35 = 31 + 4 folga; 35 < 45 — avisa o dono ANTES do selo falar com o vendedor)
```

## §7 Casos numéricos planejados (Constituição III)

- `aplicarFatia`: base Shopee com `freightSubsidyInfo` + fatia só-comissão ⇒ subsídio intacto
  (o teste anti-reversão do hotfix A2).
- `compor`: 2 fatias, 1 reprovada por sanidade ⇒ RunOutcome PR parcial com veredito ABORTADO;
  0 fatias admitidas + 0 vigias ⇒ SEM_PR.
- Bump único: 2 fatias admitidas na mesma data ⇒ exatamente 1 incremento de `catalogVersion`.
- `avaliarOcr`: 20% ⇒ passa sanidade; 4,9%/25,1% ⇒ ABORT; célula "6.50" (ponto) ⇒ ABORT de
  forma; âncora removida ⇒ ABORT; mutação de dígito plausível (ex.: 14%→19% numa faixa) ⇒
  pega por ≥1 guarda em 100% das rodadas.
- `exemption`: diff só-`lastReviewed` + arquivo extra de baseline no PR ⇒ NEGADA (eixo b).
- Paridade (P0-a): `projetarSemente(servido)` ≠ semente ⇒ vermelho; `catalogVersion` com data
  ≠ `generatedAt` ⇒ vermelho; mês sem execução ⇒ verde (a relação não depende de valores).

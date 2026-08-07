# ADR-0028 — O laço mensal de tarifas: coletor emite FATIA, a composição publica

- **Status**: Proposto (2026-08-07 — flip no gate do dono da PR-A do 017, precedente ADR-0023/0026/0027)
- **Data**: 2026-08-07
- **Contexto**: 017-ingestao-mensal (US1/US2/US7 · FR-1001/1002/1004/1011 · clarify Q3/Q4) —
  desenho em `specs/017-ingestao-mensal/arquitetura-017.md` §A/§C.
- **Decide**: a topologia do workflow mensal e o modelo de escrita do catálogo quando há MAIS de
  um coletor no mesmo laço.
- **Relaciona**: ADR-0010 §A6/§A10/§A13 (CI-first, runner hospedado, GITHUB_TOKEN não dispara CI) ·
  ADR-0019 (o rótulo congela em snapshot imutável — por isso um bump por execução) · 014/FR-020a
  (`RefreshOutcome` de 2 casos).

## Decisão

1. **Jobs explícitos por FONTE + um job `publicar`** (`needs` + `if: always()`); nunca
   `strategy: matrix` (força a união dos setups e impossibilita a futura perna ML sem
   dependências — T062a), nunca `continue-on-error` como independência. Só `publicar` tem
   `contents: write`/`pull-requests: write`.
2. **Os três estados são DADO**: cada coletor termina escrevendo um veredito
   (`CollectorVerdict` = LIDO | ABORTADO | NAO_LIDO) como artefato da run; o compositor produz
   `Record<Mk, CollectorVerdict>` por função TOTAL sobre a tabela única `MARKETPLACE_COVERAGE` —
   marketplace sem veredito vira NAO_LIDO com motivo, nunca omissão.
3. **Coletor NÃO escreve o artefato**: emite `CatalogSlice` (apenas folhas LIDAS). A composição
   aplica a **regra da folha lida** — folha não declarada vem da BASE. É o que impede um coletor
   Shopee de reverter o hotfix A2 (o PNG não contém `freight`/`freightSubsidyInfo`/
   `optionalSurcharges`). Prova: ponto fixo byte-idêntico por fonte (I9 estendido).
4. **Fatia reprovada** por `decideRefresh` (per-marketplace) é descartada e seu veredito vira
   ABORTADO — o **PR parcial** da clarify Q4 expresso por TIPO, não por `if`.
5. **Um bump por EXECUÇÃO**: após admitir todas as fatias, exatamente um `nextCatalogVersion` +
   um `generatedAt`. `RunOutcome` = SEM_PR | PR (2 casos; não existe caminho de escrita fora).
6. **Nada que decida dinheiro ou relatório mora em YAML** — shell chama `.mjs`, sobe artefato,
   e (no `publicar`) chama `gh`; todo `.mjs` novo é bootado sob `node` puro no próprio job.

## Consequências

- Fonte nova = job novo + fatia nova; nenhum job existente muda.
- O corpo do PR nunca cala um marketplace (US2/AC3 por construção).
- A migração de `build-amazon.mjs` de writer para emissor de fatia é tarefa da PR-A, não
  opcional — o modelo antigo (coletor escreve o `catalog.json` inteiro) morre com este ADR.

## Rejeitadas

- Um job sequencial (a falha de um mata os outros — viola FR-022).
- Matriz por marketplace (degenera em `if: matrix.x` com pior legibilidade; T062a impossível).
- `continue-on-error` (esconde exatamente o estado que a US2 exige declarar).

## Emenda 2026-08-07 (pré-flip) — exaustividade DECLARADA: a outra metade da regra da folha lida

A implementação da PR-A parou onde devia (Princípio VIII): uma fatia que só ESCREVE não tem como
dizer "esta entrada SUMIU da fonte" — e o coletor Amazon remove entradas por regenerar a seção
inteira (o caso 014/US4 "Categorias removidas da fonte"). Decisão do arquiteto, registrada em
`arquitetura-017.md` §C.2-bis:

```ts
export type SectionKey = "entries" | "categorySpine"; // NUNCA blocos de nível de marketplace
export interface CatalogSlice {
  marketplace: Mk; collectedAt: string; sourceUrl: string;
  leaves: LeafWrite[];
  exhaustive: SectionKey[]; // OBRIGATÓRIO — `[]` é uma frase, não um esquecimento
}
```

As 4 regras da composição: (1) seção NÃO declarada ⇒ nada removido, base vence; (2) declarada ⇒
remove as chaves ausentes naquele marketplace/seção; folhas remanescentes seguem a regra da folha
lida; (3) a declaração é CONDICIONADA, não confiada — a fatia só existe se canárias + piso
(`MIN_PARSE_ROWS`) + cobertura + colisões passaram, e fatia inexistente não remove nada; (4) o
teto de mudança passa a contar `materiais + removidas` (medido: sem isso, uma leitura encolhida
removeria fora do numerador; exposição residual ≤10 categorias/20 entradas — RA8).

Duas fechaduras para o hotfix A2: `SectionKey` NÃO representa `freightSubsidyInfo`/
`optionalSurcharges`/`determinantsSchema`/`feeAxes` (proteção por TIPO), além da regra da folha
lida. Shopee declara sempre `[]`; Amazon declara `["entries","categorySpine"]`. O corpo do PR
ganha a linha de procedência da remoção ("ausente na leitura EXAUSTIVA de … em <data> (<url>)")
e a US2 assere a AUSÊNCIA de "Sem mudança" em execução com remoção.

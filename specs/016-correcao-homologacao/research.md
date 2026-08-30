# Research — 016 (Phase 0)

**Data**: 2026-08-05. Nenhum `NEEDS CLARIFICATION` restou na spec (clarify 8/8 + reversão ML). Este
documento consolida as decisões técnicas — todas tomadas em `arquitetura-016.md` (arquiteto, opus)
com alternativas e confiança; aqui está o sumário normativo que o `/speckit-tasks` consome.

## R1. Taxa fixa como função do preço (Shopee < R$ 8 CNPJ)

- **Decision**: `fixedFeeRule?: { kind: "PCT_OF_PRICE"; pct }` opcional NA BANDA de preço
  (`pricing-core`), lido por uma única função `bandFixedFee(band, anuncio)` usada nas TRÊS chamadas
  (grossUpOnce, chooseBand.at, finish). Banda Shopee CNPJ `[0,80)` parte em `[0,8)` + `[8,80)`.
- **Rationale**: o preço é o ponto fixo do gross-up — só o motor o conhece; a álgebra continua
  fechada e linear (`L = base/(1−c/100−p/100)`). Ausência do campo = constante `fixedFee` (padrão
  ADR-0024: todo payload gravado mantém o significado). ADR-0027.
- **Alternatives considered**: `commissionPct: 70` (mente no selo, 93% inferior); regra no nível da
  entrada (duas fontes de verdade para < R$ 8, 86%); resolver no cliente (impossível — criaria
  segundo motor, 95%).
- **Pré-condição de PR-F**: releitura VERBATIM do art. 26839 antes de gravar número — as fontes
  internas divergem em 20 p.p. sobre se a comissão incide junto (§9.3 do desenho). Guardas no
  schema: `fixedFeeRule` só em `SELECTION`; `c+p < 100` por banda.

## R2. Perfil do vendedor Shopee e o +R$ 3/item

- **Decision**: UM determinante composto `sellerProfile ∈ {null(=CNPJ), CPF, CPF_ALTO_VOLUME}`;
  três tabelas como DADO (CPF_ALTO_VOLUME = CPF + R$ 3 já somado nas bandas); duas perguntas na
  tela mapeiam para um valor via `slotDeterminants` declarado.
- **Rationale**: casamento de determinantes é exato — eixo composto evita espaço cartesiano com
  buracos; CNPJ permanece a entrada catch-all `null` ⇒ byte-idêntico para documento salvo e slot
  sem resposta (FR-926). Se a condição do +R$ 3 mudar na releitura, a correção é dado, não schema
  (§9.8).
- **Alternatives**: dois eixos (buracos irrepresentáveis); sobretaxa separada para o R$ 3 (duplica
  número que a fonte publica somado).

## R3. Volumoso R$ 50 (surcharge)

- **Decision**: catálogo declara `optionalSurcharges[]` (id, label, value, appliesPer, procedência)
  no nível do MARKETPLACE; `ChannelInput.surcharges?: {label,value}[]` aditivo no motor, somado POR
  CIMA do fixo em todos os regimes e ecoado em `ChannelResult` para legenda/PDF. Persistência:
  `ScenarioChannelIntent.surcharges?: string[]` (ids, resolvem ao vivo); congelado viaja resolvido
  no `freezeInput` existente.
- **Rationale**: somar no `fixedFee` seria INERTE sobre entrada bandada (regra 013/F1) — os R$ 50
  sumiriam em silêncio; array rotulado porque a legenda "por pedido" (clarify Q5) é o que impede a
  superestimação multi-item de virar surpresa. Número nunca no código (Constituição II).
- **Alternatives**: escalar sem rótulo (perde a legenda); campo hardcoded na tela (a próxima
  sobretaxa viraria código — com o catálogo, é dado).

## R4. Remoção do `wasteGrams` — pricing-core 4.0.0

- **Decision**: recusa NOMINAL por chave presente (`RETIRED_INPUT_FIELDS`; `"wasteGrams" in input`
  → `ValidationError` nomeando o campo), ANTES de qualquer validação; `stripRetiredFields()` +
  `isPreRemovalModel()` exportados PELO PRÓPRIO pricing-core; migração Alembic `0003` DROP das três
  colunas (+CHECKs), downgrade recria schema mas não valores (escrito na migração); wire
  `extra="forbid"` em `FilamentIn`/`PieceInputs` com 422 nomeando a mudança.
- **Rationale**: a chave presente (mesmo `undefined`) é o sinal — spread descuidado falha ALTO; a
  informação "o campo existiu até 3.x" mora no pacote cuja versão a data (um lugar só, sob ratchet
  100%); nenhum ambiente provisionado ⇒ DROP é seguro (deploy adiado até v1, decisão 2026-07-09).
  ADR-0026.
- **Alternatives**: `zod.strict()` na borda (custo de bundle/parse no caminho quente E recusaria
  toda extensão aditiva futura — o oposto de I4; 78%); ignorar em silêncio (é o defeito, 95%);
  colunas mortas no banco (dead-code recorrente, 85%); mapeamento em `entities/`/`shared/` (dois
  lugares precisando concordar, 70–75%).
- **Costurados medidos (2, não mais)**: `scenario-bridge.ts` (usa `stripRetiredFields`, declara via
  `ScenarioFormPatch.discarded`) e `recalc-today.tsx` (declara via `isPreRemovalModel` — reprecifica
  da ORIGEM viva, nunca das entradas congeladas). **R3 do brief é falso**: nenhum artefato exportado
  imprime `wasteGrams` (medido: FrozenBreakdown, quote_render, tela de detalhe) — sem legenda nova.

## R5. Teaser premium unificado

- **Decision**: `shared/billing/premium-teaser.tsx` com contrato de conteúdo FECHADO — união
  `PremiumFeatureId` (5 valores) + registro i18n único; sem props de texto; única exceção nomeada
  `disabledAffordance` (US1-AC3). Os 4 teasers antigos + `PremiumTeaserDialog` são DELETADOS;
  `TeaserUpgrade` (E6) é o elemento "Assinar" — absorvido, nunca bifurcado.
- **Rationale**: com o registro, "mesma estrutura" é propriedade de TIPO (SC-901); em `shared/`
  porque `feature → feature` é proibido (I8). Homologação: comparação de árvore renderizada dos 5
  ids + screenshot (caixa acha o que texto não acha; imagem acha o que caixa não acha).
- **Alternatives**: props de texto (reabre a divergência que é o defeito); embrulhar os antigos (a
  cópia divergente sobrevive atrás do adaptador).

## R6. Campos dirigidos pelo marketplace

- **Decision**: `channelFieldPlan(catalog, marketplace)` puro decide render E determinantes
  enviados (uma função para os dois — RA5); eixos de tarifa vêm de `feeAxes` EXPLÍCITO no catálogo
  (aditivo; **ausência = os 4 campos = a tela de hoje**); `category` renderiza sse `categorySpine`
  não-vazio (mata a inferência categoria←modalidade medida em `calculator-form.tsx`);
  `MODALITY_OPTIONS` deixa de ser tabela codificada. Curadoria 016: Shopee
  `[commissionPct, fixedFee, freight]` · Amazon `[commissionPct, fixedFee, minPerItem]` · ML
  `[commissionPct, fixedFee, freight]` (ML permanece o comportamento de hoje — parte ML adiada).
- **Rationale**: qual tarifa a fonte cobra é FATO curável com procedência, não estatística das
  entradas — derivar das entradas faria a tela mudar de forma a cada atualização e não sabe
  responder para o ML vazio (72% inferior). Regressão byte-idêntica por construção (o plano só
  muda render; determinantes enviados são os de hoje + `sellerProfile` quando respondido).
- **FR-928 viaja aqui**: banda com `fixedFee` nulo ⇒ estado I9 ("sem referência"), nunca `?? 0`.

## R7. Amazon Individual fixedFee 2,00

- **Decision**: mudança de DADO (38 entradas INDIVIDUAL, gerador) + `catalogVersion` bump via
  `nextCatalogVersion` + UMA forma nova: `FeeEntry.fixedFeeSource?` (procedência própria da taxa
  fixa — o R$ 2,00 vem da `/precos`, não da G200336920 que é o `sourceUrl` da entrada). Metadado
  puro; não chega ao motor. `FeeSeal` exibe quando presente.
- **Rationale**: procedência única mentiria sobre o número novo (I6). Confiança 72%; a alternativa
  (aceitar procedência única + desvio registrado) é aceitável se o dono preferir PR-F sem schema.

## R8. Derivações de borda (US7/US8) — nada persistido

- **Decision**: h+min ↔ decimal bijetivo em minutos inteiros (`5.33` exibe `5h 20min`; 60min
  transborda); máquina: `machineLifetimeHours = RITMOS[i] × paybackAnos` com
  `RITMOS = [260, 1200, 3300]` h/ano (× 3 anos = 780/3.600/9.900 aprovados, SC-906); modo
  "ajustar" DERIVADO (valor salvo não bate com ritmo×payback inteiro), não gravado.
- **Rationale**: derivação de borda nunca entra em `PriceInput`, documento ou payload congelado —
  cada campo em payload congelado é permanente (I3).

## R9. Ordem das fatias e coordenação E6

- **Decision**: A→B→C→D(4.0.0)→E→F(4.1.0); PR-D NÃO espera o E6 (interseção de arquivos vazia,
  medida); PR-A absorve `teaser-upgrade.tsx` do E6 US7.
- **Rationale**: minimizar rótulos de versão efêmeros carimbáveis em snapshot imutável; bifurcar o
  TeaserUpgrade perderia a homologação que o E6 pagou (100,5px + toast fantasma).

## R10. ADIADO — matriz de custo fixo ML (decisão A / ADR-0025)

- **Decision**: fora do 016 (dono, 2026-08-05, pós-arquiteto: catálogo ML tem ZERO entradas — a
  premissa corretiva da Q2 era falsa). `fixedCostMatrix` no nível do marketplace, resolução em duas
  etapas (cliente colapsa logística+peso → motor recebe `priceBands[]` de hoje), comparação
  apresentacional fora de `PriceInput` — fica desenhado (ADR-0025 Proposed) para a fatia US6-ML/017.
  As decisões de clarify Q3 (peso das gramas + ajuste) e Q4 (comparação + escolha) permanecem
  válidas para esse momento.

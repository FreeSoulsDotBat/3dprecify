# ADR-0026 — pricing-core **4.0.0**: remoção do `wasteGrams`, recusa explícita e a regra de leitura de documento gravado

- **Status**: Aceito (2026-08-07 — ratificado pelo dono no merge do PR de fechamento do 016; implementado e homologado nas fatias PR-D e PR-F, evidência em specs/016-correcao-homologacao/dod-evidence.md)
- **Data**: 2026-08-05
- **Contexto**: 016-correcao-homologacao (US10 · FR-912/913/914; decisão do dono D2, opção A) —
  escalação opus do ADR-0022 (altera a superfície do motor de preço)
- **Decide**: como **remover um campo de entrada** do motor canônico sem quebrar nenhum documento
  gravado e sem que ninguém descubra a diferença sozinho.
- **Relaciona**: ADR-0008 (registro de versão + arredondamento) · ADR-0019 (imutabilidade de snapshot)
  · ADR-0021 (cenário guarda intenção) · ADR-0013 (schema/migração) · ADR-0016 (3.1.0, `computeBom`).

---

## 1. O problema

O dono homologou como usuário grátis e recusou a ambiguidade entre **"Desperdício (g)"** e **"Taxa de
falha (%)"**: dois campos que o vendedor lê como a mesma coisa. Decisão **D2, opção A — remoção
completa**, não só da tela.

Escopo medido: `filaments.default_waste_grams` (NOT NULL) · `products.waste_grams` (NOT NULL) ·
`bom_lines.waste_grams` · a entrada do motor · 54 ocorrências no código.

Duas coisas tornam isto a fatia de maior risco do incremento, e nenhuma delas é a aritmética:

1. **Remoção de campo de entrada é quebra** — o material passa de
   `costPerRoll/(rollWeightKg×1000) × (printGrams + wasteGrams)` para `… × printGrams`. Todo preço
   recalculado de um documento antigo **cai**, por motivo estrutural e não por churn de catálogo.
2. **Documentos gravados continuam existindo com o campo dentro**: o payload congelado (imutável por
   trigger PL/pgSQL) e o `lastKnown` de um cenário salvo. A limpeza é do presente, não do passado — foi
   o argumento a favor da opção B, e o dono escolheu a A mesmo assim.

## 2. As restrições

1. **ADR-0019 é intocável**: um orçamento congelado exibe e exporta exatamente o que foi cotado.
2. **Nenhum documento de nenhuma versão pode quebrar ao abrir** (SC-907).
3. **O descarte tem de ser DITO** (FR-913): o usuário não pode descobrir a diferença sozinho.
4. `pricing-core` é a fórmula canônica, offline, com **uma** dependência de runtime (ADR-0008) e
   ratchet de 100% de cobertura.

## 3. Decisão

### 3.1 O motor **recusa** o campo, e recusa pela CHAVE

```ts
export const PRICING_MODEL_VERSION = "4.0.0";          // package.json major = 4 (gate version.test.ts)
export const RETIRED_INPUT_FIELDS = ["wasteGrams"] as const;

// primeira coisa em computeCalculator, antes de qualquer validação:
for (const f of RETIRED_INPUT_FIELDS)
  if (f in input) throw new ValidationError(
    `${f} foi removido do modelo de preço em 4.0.0 — use stripRetiredFields() antes de recomputar`, f);
```

**A chave PRESENTE é o sinal, mesmo com valor `undefined`.** Um `{...documentoAntigo}` carrega a
chave; a camada de mapeamento tem de `delete`, não atribuir `undefined`. Assim o espalhamento
descuidado — o jeito real como isto voltaria — falha alto, com o nome do campo e a saída documentada
na mesma mensagem. `computeBom` herda a recusa (cada linha passa por `computeCalculator`).

`PRICING_MODEL_VERSION` recebe bump **MAJOR** (3.1.0 → **4.0.0**): remoção de campo de entrada é
quebra, e o rótulo é congelado dentro de um snapshot imutável — ele precisa continuar respondendo
**qual fórmula produziu este número**.

### 3.2 A porta documentada mora no MESMO pacote

```ts
export interface DiscardedField { field: (typeof RETIRED_INPUT_FIELDS)[number]; value: string }
/** Genérica na folha: string num documento gravado, número numa entrada viva. */
export function stripRetiredFields<T extends Record<string, unknown>>(
  stored: T,
): { kept: Omit<T, (typeof RETIRED_INPUT_FIELDS)[number]>; discarded: DiscardedField[] };
/** major(modelVersion) < 4 — para o documento congelado, que não tem folha a inspecionar. */
export function isPreRemovalModel(modelVersion: string): boolean;
```

**Recusa e porta no mesmo pacote, de propósito**: a informação "o `wasteGrams` existiu até a 3.x" é a
mesma informação que a constante de versão data. Separá-las cria dois lugares que precisam concordar —
e um deles fica para trás. Aqui há **um** lugar que sabe que o campo existiu, sob o ratchet de 100%.

### 3.3 A regra de leitura, por costurado — dirigida por VERSÃO onde há versão, por PRESENÇA onde não há

| costurado (medido) | comportamento |
| --- | --- |
| **Orçamento congelado** (detalhe, PDF, CSV) | **Nada muda.** Nenhum artefato jamais imprimiu o campo: `FrozenBreakdown` não tem linha de desperdício (ele está somado dentro de `material`), `quote_render.py` imprime só as chaves do breakdown gravado, e a tela de detalhe nunca renderiza `payload.inputs`. A imutabilidade não é tocada porque não há nada a tocar. |
| **Cenário reaberto** (`scenario-bridge`, os dois laços sobre `CALC_FIELD_NAMES`) | Passa por `stripRetiredFields`; `discarded` sobe no `ScenarioFormPatch` e a tela **declara o descarte**. O documento de cenário deliberadamente não guarda versão de modelo, então a evidência honesta ali é a **própria folha**. |
| **"Recalcular hoje" / "comparar hoje"** | Reprecifica da ORIGEM viva (produto/kit), nunca das entradas congeladas; sem origem resolvível, reemite o documento congelado **sem recomputar**. Nenhum mapeamento é necessário; a declaração vem de `isPreRemovalModel(frozen.modelVersion)`, e a divergência é explicada onde ela aparece. |

**Nenhum campo novo é criado para registrar o descarte.** A diferença entre `modelVersion` do registro
antigo e do novo já a responde — e um campo em payload congelado é **para sempre** (ADR-0019).

### 3.4 Migração `0003` — DROP

Colunas e CHECKs removidos: `filaments.default_waste_grams` (+ `ck_filaments_default_waste_valid`),
`products.waste_grams` (+ `ck_products_waste_grams_valid`), `bom_lines.waste_grams`
(+ `ck_bom_lines_waste_grams_valid`).

`downgrade` recria as três colunas com `server_default '0'`: **o schema é reversível, os valores não**,
e isso fica escrito na própria migração. Justificativa medida: **nenhum ambiente foi provisionado**
(decisão do dono 2026-07-09 — deploy adiado até a v1 completa), então não há linha de produção a
destruir. Se essa decisão for revista antes de PR-D, este ponto reabre.

**Contrato**: `FilamentIn/Out.defaultWasteGrams` e `PieceInputs.wasteGrams` saem; `scenarios.py` para
de emitir a folha em `lastKnown`; `boms.py` para de sincronizá-la. Regeneração obrigatória
(`export_openapi` + `gen:api` **da raiz**) + prova de idempotência — o drift-guard é CI-only e dispara
depois de um gate verde.

**Cliente velho (aba parada em cache)**: `FilamentIn` e `PieceInputs` passam a **recusar** campo extra,
com 422 nomeando a mudança de modelo. O padrão do Pydantic é *ignorar* o extra, e ignorar aqui é
justamente a mentira silenciosa que este incremento existe para matar — o vendedor salvaria um produto
achando que o desperdício entrou e veria outro preço. Snapshots do outbox (ADR-0018) continuam opacos e
aceitos como estão.

### 3.5 A ambiguidade não pode voltar por omissão

FR-914: o material de apoio das **gramas** e da **taxa de falha** passa a dizer o que cada um cobre —
purga, suporte e brim entram nas **gramas usadas**; falha é a impressão inteira perdida. Sem isso a
remoção apaga material real da conta (ressalva 1 do PO, confiança dele de 80% de que a perda é
material). É requisito de aceite, não conteúdo opcional.

## 4. Alternativas consideradas

| | por que não | confiança |
| --- | --- | --- |
| **Ignorar o campo em silêncio** | Recusado pela FR-912 e pela decisão do dono. É a definição do defeito: um preço diferente sem um sinal. | 95% |
| **`zod.strict()` na borda do motor** | `pricing-core` tem uma única dependência de runtime; Zod custa bundle offline e um parse por recomputo num caminho quente. Pior: `strict()` recusaria **toda** chave desconhecida, transformando cada extensão aditiva futura em quebra para chamador antigo — o oposto exato da disciplina de que o ADR-0024 e o ADR-0025 dependem. | 78% |
| **Depreciar (aceitar e avisar) por um ciclo** | Adia a decisão e cria uma janela em que dois modelos coexistem sob o mesmo major. Faz sentido com API pública e clientes de terceiros; não temos nenhum. | 70% |
| **Manter as colunas mortas no banco** | Coluna NOT NULL que ninguém alimenta é dead code que reaparece em cada review futuro como "isso ainda é usado?". | 85% |
| **Migrar os valores gravados** (somar waste em printGrams no `lastKnown`) | Reescreveria a intenção do vendedor sob outro nome, e no snapshot seria **impossível** (imutável). Descartar e DIZER é honesto; reescrever e calar não é. | 90% |
| **Opção B (só tirar da tela)** | **Já rejeitada pelo dono**; registrada porque foi ela que trouxe o argumento do §1.2. | — |

## 5. Consequências

**Boas**
- Uma ambiguidade de modelo some do produto, e a explicação que a substitui é melhor do que os dois
  campos juntos.
- O par **recusa + porta documentada** faz um costurado esquecido quebrar alto em vez de descartar em
  silêncio — que é a única razão de a §3.3 ser confiável quando aparecer o quarto costurado.
- O projeto passa a ter **duas** versões vivas de modelo, que é o gatilho que o ADR-0008 já previu para
  trocar 1A por 1B (registro de modelo) quando isso acontecesse.

**Custos e riscos**
- Todo preço recalculado de documento antigo **cai**, e a comunicação vive nos documentos (clarify Q7)
  — sem banner, porque não há usuário em produção pré-v1.
- O `DROP` destrói valores irrecuperáveis. Aceito **porque nenhum ambiente foi provisionado**; a
  premissa está escrita na migração para o dia em que alguém a ler fora de contexto.
- Fatia **isolada** (PR-D) por decisão do brief: é a única com bump MAJOR + migração + regra de
  leitura, e um rollback dela não pode arrastar a PR-C junto.
- **Ordem**: PR-D vem **antes** de PR-F/PR-G. Cada versão que existe, mesmo por dois dias, pode ser
  carimbada num snapshot imutável; inverter a ordem criaria uma 3.2.0 efêmera e permanente em qualquer
  orçamento gravado no intervalo.

## 6. Reabrir se

- A decisão "deploy adiado até a v1" for revista **antes** do merge de PR-D — aí existe dado real e o
  `DROP` vira arquivamento.
- Aparecer um terceiro campo aposentado: `RETIRED_INPUT_FIELDS` já é lista, mas duas remoções seguidas
  são o sinal para trocar a constante única pelo `MODEL_REGISTRY` do ADR-0008 §1B.
- Um documento gravado aparecer com `wasteGrams` **depois** do 016 — sinal de que um costurado escapou
  da recusa (e, portanto, de que a recusa não está na primeira linha do motor).

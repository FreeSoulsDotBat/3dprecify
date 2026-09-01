# Decisões de código (DEC)

O degrau do meio da escada do `docs/PADRAO_DE_COMENTARIOS.md` §2: decisões pequenas e locais —
posicionamento de um módulo, escolha de forma, procedência de um limiar — que precisam ficar
registradas mas não justificam um ADR.

**Quando NÃO abrir um DEC:** se um ADR já governa o assunto, aponte para ele. Se mudar a decisão
mexeria em mais de um módulo, ou num contrato, schema ou regra de preço, é ADR.

**Cada DEC é citado por ao menos um ponto do código** (`// @doc DEC-xxx — resumo`) — o guarda
`packages/repo-audit` derruba o portão quando isso deixa de ser verdade, nos dois sentidos: âncora
que aponta para DEC inexistente, e DEC que ninguém mais cita. Um DEC órfão é decisão sobre código
que não existe mais; ele sai daqui em vez de virar documentação de um lugar que o leitor não acha.

---

## DEC-001 — O rail forçado (426–599px): o menu recolhe por necessidade, sem botão de expandir

**Data**: 2026-08-15 · **Governa**: `RAIL_FORCADO_QUERY`, `useRailForcado`

Entre 426px (o primeiro pixel em que a barra lateral monta) e ~600px, os 240px de menu deixam ~150px
de conteúdo, e nada do produto cabe nisso — a homologação mediu a **página inteira** como culpada de
131px de transbordo, não um elemento isolado. Abaixo de 600px, o rail de 76px é a única largura de
menu que deixa espaço utilizável (426 − 76 − 32 de goteira ≈ 318px).

Nesta faixa o menu é recolhido **por necessidade, não por preferência do vendedor**, e por isso não
ganha botão de expandir: expandir ali devolveria exatamente o transbordo que a faixa existe para
evitar.

Não conflita com o corte mobile de 425px (`useIsMobile`): abaixo dele não existe barra lateral
nenhuma, então na prática esta faixa é 426–599px.

**Fica aqui e não no ADR-0031** porque o ADR governa a *estrutura* do gate de largura (Option C: um
hook único, `false` sem `matchMedia`) e este é apenas mais um limiar nomeado sob aquela regra — o
caso que o próprio ADR previu em §Follow-ups.

> **Pendência registrada (2026-09-01):** a §Emenda 2 do ADR-0031 enumera "os **três** limiares que
> hoje vivem em `use-is-wide.ts`" e não menciona `RAIL_FORCADO_QUERY`, que existe desde 2026-08-15 —
> são quatro. Um ADR que se declara a casa única dos limiares está contando errado. Emendar um ADR
> aceito é decisão do dono; fica anotado, não corrigido.

### Onde isso vive no código

- `apps/web/src/shared/lib/use-is-wide.ts` → `RAIL_FORCADO_QUERY`, `useRailForcado`

---

## DEC-002 — A gramática pt-BR É a validação; `parseFloat` só converte o que já foi aceito

**Data**: 2026-07-30 (013 · FA-01 · FB-01 · FA-02 · FA-05 · F2) · **Governa**: `parseDecimal`,
`stripAffixes`, `ptBrToWireDecimal`, `wireToPtBr`

O parser anterior fazia `.replace(/\./g,"").replace(",",".")` → `parseFloat`, isto é, confiava no
que sobrevivesse ao filtro. Isso produzia números FINITOS, PLAUSÍVEIS e ERRADOS, sem erro nenhum:
`"0.12"` kW virava 12 (um erro medido de 100× na energia) e `"1,234,56"` virava 1.234 (o `parseFloat`
parando no resíduo). Hoje `parseFloat` é só a conversão final de uma string já validada.

### As formas aceitas (sinal "-" opcional à frente)

| forma                            | o que é              | exemplos                            |
| -------------------------------- | -------------------- | ----------------------------------- |
| `^\d+$`                          | inteiro              | `"1500"` → 1500                     |
| `^\d+,\d+$`                      | decimal pt-BR        | `"0,12"` → 0.12                     |
| `^[1-9]\d{0,2}(\.\d{3})+(,\d+)?` | milhar pt-BR         | `"1.500,00"` → 1500 · `"1.500"` → 1500 |
| `^0\.\d+$`                       | fração < 1 (en-US)   | `"0.125"` → 0.125 · `"0.5"` → 0.5   |
| `^\d+\.\d{1,2}$`                 | decimal com ponto    | `"0.12"` → 0.12 · `"1500.00"` → 1500 |
| qualquer outra                   | **RECUSADA**         | `"1,234,56"` · `"10-5"` · `"5x3"` · `"12,,5"` · `"1.5000"` |

**Desambiguação estrutural**: um ponto seguido de EXATAMENTE 3 dígitos em grupos é marca de milhar
(convenção pt-BR); um ponto seguido de 1–2 dígitos só pode ser decimal en-US. A única forma
residualmente ambígua, `"1.500"`, resolve como pt-BR = 1500 — documentado aqui e pinado no teste.

**F2 (auditoria de confirmação do 013)**: o grupo de milhar NÃO pode começar com zero. `"0.125"`
casava a forma de milhar (o `\d{1,3}` aceitava o "0" à frente) → `"0125"` → 125: um erro silencioso
de 1000× para uma fração legítima de 3 casas. Número de milhar pt-BR nunca começa com grupo zero, e
`"0.xxx"` é inequivocamente fração < 1. O caso genuinamente ambíguo com não-zero (`"1.125"`) continua
milhar, pela regra documentada acima.

### Duas decisões registradas para que o próximo leitor não as "conserte"

1. **A sentinela de recusa é `Number.NaN`, não `null`.** O "→ null" do `tasks.md` é abreviação de "→
   erro de campo"; todo chamador já se protege com `Number.isFinite(n)` e o tipo de retorno é
   `number`. `NaN` preserva o contrato da superfície com zero ondulação e produz exatamente o mesmo
   desfecho visível (a mensagem pt-BR por campo que já existia). Desvio-com-razão.
2. **O corte de afixos mora AQUI e é ANCORADO.** Os chamadores antigos faziam cada um o seu
   `replace(/[^\d.,-]/g,"")` sem âncora, que CONCATENA ATRAVÉS do lixo interior (`"5x3"` → `"53"`) e
   por isso passaria por qualquer gramática. Cortamos apenas as corridas não-numéricas do INÍCIO e do
   FIM (então `"R$ 1,50"` e `"1,50 kg"` seguem funcionando) e deixamos o interior intacto, então
   `"5x3"` e `"10-5"` são recusados. Uma regra, uma casa (Constituição V) — chamador NÃO reimplementa
   o corte.

**Biblioteca de i18n completa segue adiada** (TD-001): estes helpers são puros e sem framework de
propósito, para que o modelo da calculadora, os formulários do catálogo e o primitivo `NumberField`
obedeçam todos à mesma regra.

### Onde isso vive no código

- `apps/web/src/shared/lib/decimal-ptbr.ts` → `parseDecimal`, `stripAffixes`, `ptBrToWireDecimal`, `wireToPtBr`, `formatBRL`

---

## DEC-003 — O aviso de plausibilidade: AVISO NUNCA VIRA VALIDAÇÃO

**Data**: 2026-08-13 (homologação automatizada) · **Governa**: `avisosDePlausibilidade`, `LIMIARES`

Nove dos onze achados de severidade ALTA daquela homologação são a mesma coisa: o vendedor digita um
número PLAUSÍVEL que significa outra coisa, e o produto devolve um preço com cara de preço, calado.
Ele lê "120 W" na etiqueta e escreve 120 num campo que pede kW (custo ×38). Ele pensa a vida útil da
máquina em ANOS e escreve 3 num campo que pede HORAS (×341). Ele zera o que não entende e chega a um
preço de venda de R$ 0,00.

Nenhum desses é erro de cálculo — a aritmética está certa em todos. Nenhum é entrada inválida —
nenhum validador reprova 120. É por isso que só um aviso os pega, e é por isso que este módulo existe
**separado do schema**, que é onde mora a RECUSA.

### A regra que governa o arquivo, e ela não é estilística

**Um campo com aviso continua calculando e continua salvando.** O dono decidiu, em 2026-08-03, que
`failurePct` NÃO tem teto — *"300% representa legitimamente uma peça que falha três vezes antes de
sair"* (está escrito no próprio `PriceInput` do `pricing-core`, com o pedido explícito de que ninguém
"conserte" o que foi decidido). Este módulo encosta na mesma fronteira por todos os lados. **Quem
transformar um destes avisos num erro terá revogado aquela decisão sem perceber.**

### Por que mora em `shared/lib` e não em `features/calculator`

Razão de FRONTEIRA, não de gosto: `features/bom` precisa do aviso de quantidade e NÃO pode importar
`features/calculator` — a regra está escrita no topo do `bom-line-card.tsx` e é o `eslint-boundaries`
que a cobra. Um módulo puro consumido por duas features é, por definição, `shared`.

Puro e determinístico de propósito: entra número, sai frase. Sem React, sem estado, sem I/O — o que
permite pinar cada limiar num teste unitário barato, e o que impede este arquivo de virar, com o
tempo, um segundo lugar onde o preço é decidido.

Cada limiar é uma FAIXA do mundo real, nunca um teto de validação, e cada um carrega a procedência do
número na própria linha (§4 do padrão) — um limiar sem procedência é um palpite que o próximo leitor
vai mexer sem saber o que está mexendo.

### Onde isso vive no código

- `apps/web/src/shared/lib/plausibilidade.ts` → `LIMIARES`, `AvisoPlausibilidade`

---

## DEC-004 — `PRICING_MODEL_VERSION`: o que é bump e o que não é

**Data**: 2026-07-08 → 2026-08-31 · **Governa**: `PRICING_MODEL_VERSION`

O rótulo é carimbado dentro de um snapshot IMUTÁVEL (ADR-0019) e responde a uma pergunta só: **qual
fórmula produziu aquele número.** Por isso ele NÃO se move quando a fórmula não se move — e por isso
mover-se sem que a fórmula tenha mudado é pior do que não mover: reescreve a resposta de um documento
congelado.

| versão    | ADR      | o que mudou                                                                     | por que esse degrau |
| --------- | -------- | ------------------------------------------------------------------------------- | ------------------- |
| **3.0.0** | ADR-0011 | `otherCosts[]` itemizado + resultado multicanal `channels[]`                     | quebra o contrato de resultado 2.0.0 ⇒ MAJOR |
| **3.1.0** | ADR-0016 | `computeBom` + exports `toMoney`/`sumMoney`/`Decimal`                            | superfície pública aditiva ⇒ MINOR |
| **4.0.0** | ADR-0026 | `wasteGrams` SAI da entrada: material vira `custo/kg × gramas`                   | remoção de campo de entrada é quebra ⇒ MAJOR |
| **4.1.0** | ADR-0027 | `PriceBand.fixedFeeRule` (taxa fixa como função do preço) + `ChannelInput.surcharges` | ambas OPCIONAIS; a ausência preserva o comportamento bit a bit ⇒ MINOR |
| **4.2.0** | ADR-0034 | nasce `computeQuote` (orçamento montado: N linhas × quantidade, desconto no TOTAL, piso de custo) | superfície NOVA; `computeCalculator` e `computeBom` não mudam um centavo ⇒ MINOR |

A afirmação da 4.2.0 **não é de leitura**: a varredura de igualdade
`tests/version-equality-4.1-4.2.test.ts` recomputa 500 casos de calculadora e 200 de BOM contra uma
fixture gerada com o motor 4.1.0 INTOCADO.

**2026-08-31 — o não-bump deliberado.** O chore de legibilidade passou a exportar
`bandContaining`/`bandFixedFee` (eram reimplementadas em `fee-prefill` e `fee-catalog`). Zero cômputo
novo, zero centavo diferente ⇒ o rótulo **não** se moveu, pela regra do primeiro parágrafo.

### Onde isso vive no código

- `packages/pricing-core/src/model-version.ts` → `PRICING_MODEL_VERSION`

---

## DEC-005 — O documento de INTENÇÃO do cenário: três regras de codificação

**Data**: 2026-07-19 (010/T004, E5 PR-A) · **Governa**: `ScenarioConfigDocument`,
`ScenarioLastKnownInput`, `ScenarioChannelSlotState`

Um cenário guarda a INTENÇÃO do vendedor, nunca um preço resolvido (Q3/FR-602/FR-607 — a estrutura da
decisão é o ADR-0021). O documento é a imagem espelhada do payload congelado do E4
(`entities/history/frozen-payload.ts`): lá as folhas de dinheiro/qtd/taxa/percentual são STRINGS
porque um snapshot tem de sobreviver a Postgres → JSON sem perda; aqui são STRINGS pelo mesmo motivo
de serialização, mas o que se guarda é um conjunto de entradas EDITÁVEL, não um resultado congelado.

**1. Dinheiro/taxa/qtd/percentual é STRING.** `JSON.parse`/`JSON.stringify` fazem uma folha numérica
ir e voltar por binary64 em silêncio — a perda é do app, não do banco. Só CONTAGENS inteiras de
verdade (`schemaVersion`, o `quantity` de uma linha de kit) são números JSON legítimos em qualquer
lugar do `config`.

**2. Uma chave `feeOverrides` AUSENTE é a fronteira vivo-vs-congelado.** Quais slots o vendedor
realmente editou é decisão da camada de FEATURE (o estado editado/selado do `fee-prefill.ts` do 005)
— este módulo só codifica a REGRA: uma folha em que o vendedor nunca digitou é OMITIDA, não guardada
como zero, para o cenário reaberto resolvê-la de novo contra o catálogo de tarifas de hoje (FR-607).
Um slot sem nenhuma folha editada omite a chave `feeOverrides` INTEIRA, não um objeto vazio.

**3. O envelope é ESTRUTURALMENTE independente de `PriceInput`/`BomResult`** (a lição do E4 §9.6, um
nível acima). Nada aqui faz `extends`/`Pick`/`map` sobre um tipo do `pricing-core` — todo tipo do
envelope é declarado à mão, para que um campo futuro do `pricing-core` jamais alargue ou estreite a
forma deste documento em silêncio. A base de custo carrega o SEU PRÓPRIO tipo recursivo de folhas em
string (`ScenarioLastKnownInput`), não o `PriceInput`.

Este módulo não importa de `features/*` (FSD-Lite: uma entity fica abaixo de uma feature). A entrada
"qual slot o vendedor editou" é, por isso, PARÂMETRO SIMPLES com a forma do estado de formulário do
005, e não um import dos tipos de `features/calculator` — a camada de feature mapeia o próprio estado
para `ScenarioChannelSlotState` no ponto de chamada (T009/T010).

### Onde isso vive no código

- `apps/web/src/entities/scenario/config-document.ts` → `ScenarioLastKnownInput`, `ScenarioChannelSlotState`

---

## DEC-006 — As rotas de 2 segmentos NÃO checam auth: elas só traduzem a forma da URL

**Data**: 2026-08-07 (016/T072-A4) · **Governa**: as rotas de redirecionamento legadas do `router.tsx`

As rotas antigas de 2 segmentos seguem registradas como REDIRECIONAMENTOS DE CLIENTE por ≥1 release
(013/F-02), encaminhando para a URL nova `?produto=` com o id preservado. Isso **não** resolve
sozinho um cold load ou favorito da URL ANTIGA — o app precisa bootar antes de qualquer redirect de
cliente rodar; essa metade é o 301 de hospedagem no `firebase.json` (T024).

**Elas chamavam `requireAuth` aqui, e isso causava dois bugs, ambos MEDIDOS:**

1. `requireAuth` roda dentro de `beforeLoad`, que pode disparar numa navegação completa a frio ANTES
   de o `authStateReady()` do Firebase resolver — o `context.status` fica transitoriamente
   `"loading"`, que o `requireAuth` trata como não-autenticado e joga para `/sign-in` mesmo com o
   vendedor já logado (medido: `requireAuth` invocado com status `"loading"` num acesso a frio).
2. O alvo desta rota era um pathname na forma ANTIGA (`/catalogo/produtos/xxx`), que o `safeRedirect`
   nunca reconhece (a lista só conhece `/catalogo` e `/catalogo?…`) — então até um vendedor
   genuinamente deslogado, abrindo um favorito antigo, caía em `/calcular` depois de entrar. Medido:
   um acesso a frio a `/catalogo/produtos/id-fantasma` terminava em `/calcular`, engolindo o id.

A corrida se auto-cura em `catalogoRoute`/`historicoRoute` porque o alvo delas é a forma NOVA, que
ESTÁ na lista do `safeRedirect`: o vendedor passa por `/sign-in` invisivelmente e volta exatamente
onde queria.

**A correção**: estas rotas não carregam checagem de auth nenhuma. O redirect incondicional cai em
`catalogoRoute`/`historicoRoute`, cujo próprio `beforeLoad` roda de novo (o TanStack reavalia
`beforeLoad` descendo o novo match) e faz o gate corretamente, com um alvo que já circula em
segurança — o mecanismo que o T020 do `deep-links.spec.ts` já prova seguro a frio.

### Onde isso vive no código

- `apps/web/src/app/router.tsx` → `safeRedirect`, `requireAuth`

---

## DEC-007 — Um 401 NUNCA desloga o vendedor, e quem garante isso é o grafo de imports

**Data**: 2026-08-07 (hotfix 016/A3, H5) · **Governa**: `session-expiry.ts`

O caminho de volta quando o SERVIDOR recusa uma sessão de cliente que ainda está viva (um 401 com
código real de sessão expirada) — a segunda metade do diagnóstico que o estado `unauthenticated` do
outbox (H4) já cobre na superfície dele. O `router.tsx` já redireciona para `/sign-in` quando a
sessão do CLIENTE (Firebase) morre; um 401 com sessão de cliente viva não movia tela nenhuma, e é o
"nenhuma tela oferece caminho de volta" que a homologação T072 encontrou.

**Uma store deste tamanho e desta burrice é o ponto inteiro**: ela sabe UM bit (expirada ou não) e
NADA sobre autenticação. Não consegue chamar `requestSignOut` porque nunca importa
`shared/session/sign-out-guard`, e não consegue chamar `purgeOutbox` porque `shared` é PROIBIDO de
importar `entities/history` (fronteira FSD-Lite, cobrada pelo `eslint-boundaries`).

A propriedade inegociável desta fatia — **um 401 NUNCA desloga o vendedor** — não é uma promessa que
este arquivo cumpre por disciplina; é uma promessa que o grafo de imports torna impossível de
quebrar a partir daqui.

Marcada pelo `transport.ts` num 401 cujo `code` é um código genuíno de expiração de sessão (nunca um
401 pelado — `ENTITLEMENT_REQUIRED` é uma história diferente, e mesmo dentro de 401 o fio poderia um
dia carregar um código sem relação). Limpa na primeira requisição que volta a dar certo, ou no
instante em que a própria store de sessão reporta `authenticated` (o vendedor entrou de novo por
outra aba/fluxo) — o que vier primeiro.

### Onde isso vive no código

- `apps/web/src/shared/session/session-expiry.ts` → `markSessionExpired`, `clearSessionExpired`, `useSessionExpired`


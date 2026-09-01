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

## DEC-005 — O documento de INTENÇÃO do cenário: o que o vendedor NÃO digitou fica de fora

**Data**: 2026-07-19 (010/T004, E5 PR-A) · **Governa**: `ScenarioConfigDocument`,
`ScenarioLastKnownInput`, `ScenarioChannelSlotState`

Um cenário guarda a INTENÇÃO do vendedor, nunca um preço resolvido (Q3/FR-602/FR-607 — a estrutura da
decisão é o ADR-0021). O documento é a imagem espelhada do payload congelado do E4: as duas regras de
codificação que eles compartilham (dinheiro é string, tipo independente do `pricing-core`) estão no
[[DEC-008]], que os dois arquivos citam. O que é só do cenário é a regra abaixo.

**Uma chave `feeOverrides` AUSENTE é a fronteira vivo-vs-congelado.** Quais slots o vendedor realmente
editou é decisão da camada de FEATURE (o estado editado/selado do `fee-prefill.ts` do 005) — este
módulo só codifica a REGRA: uma folha em que o vendedor nunca digitou é OMITIDA, não guardada como
zero, para o cenário reaberto resolvê-la de novo contra o catálogo de tarifas de hoje (FR-607). Um
slot sem nenhuma folha editada omite a chave `feeOverrides` INTEIRA, não um objeto vazio.

Este módulo não importa de `features/*` (FSD-Lite: uma entity fica abaixo de uma feature). A entrada
"qual slot o vendedor editou" é, por isso, PARÂMETRO SIMPLES com a forma do estado de formulário do
005, e não um import dos tipos de `features/calculator` — a camada de feature mapeia o próprio estado
para `ScenarioChannelSlotState` no ponto de chamada (T009/T010), no costurado do [[DEC-009]].

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

---

## DEC-008 — O envelope persistido: dinheiro é STRING e o tipo é independente do `pricing-core`

**Data**: 2026-07-12 (009/T003, E4 PR-A · data-model D1, ADR-0008, ADR-0019, ADR-0020 §1) ·
**Governa**: o payload congelado do Histórico e o documento de config do cenário ([[DEC-005]])

Um snapshot CONTÉM os seus valores; ele nunca REFERENCIA o catálogo para obtê-los. É a regra das duas
prateleiras inteira, e é aqui que ela vira verdade: tudo que a tela de detalhe ou o renderizador de
exportação um dia imprimirem tem de estar dentro do documento, para sempre.

Três regras, e cada uma impede uma MENTIRA — não um travamento:

**1. Dinheiro é STRING.** O Postgres guarda um número JSON como `numeric` sem perda — mas `json.loads`
e `JSON.parse` devolvem um FLOAT. A precisão morre no serializador, em silêncio, do lado do app. Então
toda folha de dinheiro/quantidade/taxa é string decimal; os únicos números JSON são contagens inteiras
(FR-525).

**2. Os tipos são ESTRUTURALMENTE independentes de `PriceResult`, e toda linha de detalhamento é
OPCIONAL.** Isso não é estilo. Se o documento congelado fosse tipado com o resultado VIVO, um campo
futuro do `pricing-core` faria o TypeScript *afirmar* que um snapshot de 2026 o carrega — o
renderizador alcançaria um `?? 0` e imprimiria um zero que nunca foi gravado. O zero fabricado do
FR-507, produzido pelo próprio sistema de tipos. Aqui, ausente é valor de primeira classe.

**3. O documento é AUTOSSUFICIENTE.** As linhas de kit carregam o NOME, a QUANTIDADE e o dinheiro já
ESCALADO pela quantidade, para que o renderizador de orçamento do servidor possa IMPRIMIR em vez de
CALCULAR — que é exatamente por que a exportação não bifurca o motor de preço, e por que "o backend
nunca recomputa" (ADR-0008) sobrevive ao E4 intacto.

### Onde isso vive no código

- `apps/web/src/entities/history/frozen-payload.ts` → `FROZEN_PAYLOAD_SCHEMA_VERSION`, `MoneyString`, `FrozenTotals`, `FrozenKitLine`
- `apps/web/src/entities/scenario/config-document.ts` → `ScenarioConfig`, `DecimalString`, `ScenarioChannelFeeOverrides`

---

## DEC-009 — O costurado calculadora↔cenário mora em `features/calculator`, e por fronteira

**Data**: 2026-07-19 (010/T009+T010+T014, E5 PR-A) · **Governa**: `scenario-bridge.ts`

A ÚNICA costura onde o estado vivo do formulário da calculadora encontra as formas de parâmetro da
entity de cenário, nos DOIS sentidos (salvar + reabrir).

Mora em `features/calculator` e NÃO em `features/scenarios` por razão estrutural (FSD-Lite/ADR-0004,
cobrada pelo `eslint-boundaries`): uma feature pode importar `entities/*` e `shared/*`, **nunca uma
feature IRMÃ**. `features/scenarios` não consegue importar os tipos `CalcFormValues` /
`ChannelSlotOutcome` de `features/calculator` — então a feature da calculadora, que já é dona desses
tipos, é a que sabe traduzi-los para as formas simples de `entities/scenario/config-document`
([[DEC-005]]). `features/scenarios` nunca vê um `CalcFormValues`: só lida com um `ScenarioConfig` já
montado (sentido salvar) ou com um patch de formulário já aplicado (sentido reabrir), e quem costura
os dois é a PÁGINA, chamando estas funções no ponto de chamada.

**O `pricing-core` não é tocado.** SALVAR reaproveita o que o `computeFromForm` já resolveu
(`ChannelSlotOutcome.editedFields`, o rastreio por campo do T010); REABRIR só produz STRINGS de
formulário pt-BR que voltam pelo mesmíssimo caminho `computeFromForm` → `fee-prefill.ts` de um
cálculo novo — slot não sobrescrito fica EM BRANCO para resolver no vivo, slot sobrescrito recebe o
valor salvo e lê "ajustado por você", e os casos de honestidade do 005 (slot sem cobertura → "sem
referência"; comissão ≥ 100% → o mesmo erro na linha) caem do código EXISTENTE, com zero lógica de
preço nova (FR-609, T014).

### Onde isso vive no código

- `apps/web/src/features/calculator/scenario-bridge.ts` → `ChannelSlotOutcome`

---

## DEC-010 — A sobrescrita é um MERGE SELETIVO, e só `commissionPct` derruba a tabela de bandas

**Data**: 2026-07-30 (013/E1-02; regra de derrubada corrigida pela auditoria F1; atribuição do cupom
corrigida pelo hotfix 016/A2) · **Governa**: o costurado de override do `calculator-model.ts`

A sobrescrita reescreve APENAS os escalares que o vendedor realmente DIGITOU. O sinal é
`editedFields` (quais campos foram digitados), **nunca** veracidade do valor — um `0` digitado é
override real e tem de vencer o valor da entrada. `freightIsEstimate` segue a mesma regra: o rótulo
"estimativa" pertence ao subsídio da entrada, então cai no instante em que o vendedor digita o
próprio frete.

**A regra de derrubada.** Um `commissionPct` digitado significa "minha comissão é X, não a do
catálogo" ⇒ a tabela de bandas de preço CAI e a comissão digitada governa. Todo o resto — frete,
`minPerItem` **e um `fixedFee` digitado** — NÃO derruba a tabela.

Por que o `fixedFee` não pode derrubar: a entrada da Shopee **não tem** `commissionPct` no topo (ele
vive nas bandas), então derrubar as bandas numa edição só de `fixedFee` cairia para 0% de comissão e
superestimaria o líquido do vendedor pela comissão inteira — **o bug F1**. Numa entrada com bandas o
motor tira `commissionPct`+`fixedFee` da banda que contém o anúncio, então o `fixedFee` digitado é
simplesmente inerte ali; numa entrada sem bandas ele sobrescreve o escalar, como se espera.

`freightVoucherBands` está DEPRECIADO no motor ([[FONTE-001]]: o cupom de R$ 20/30/40 é custo da
Shopee, não do vendedor, e o catálogo não o emite mais), mas segue sendo carregado
incondicionalmente: um documento de cenário salvo ANTES do hotfix pode conter o campo, e largá-lo
numa edição mudaria o número daquele documento por um motivo que o vendedor nunca pediu.

### Onde isso vive no código

- `apps/web/src/features/calculator/calculator-model.ts` → `editedFields`, `freightIsEstimate`

---

## DEC-011 — O construtor de orçamento: fronteira, fidelidade à prancheta e o que ficou de fora

**Data**: 2026-08-30 (019/PR-E, T088, US16/US17, ADR-0034) · **Governa**: `quote-builder.tsx`

**Fronteira** (Princípio VIII, precedente T124 da PR-D): `features/history` não importa
`features/calculator` nem `features/bom` (`eslint-boundaries`). Quem sabe transformar um PRODUCT/KIT
do Catálogo num `PriceInput` é a PAGE (`pages/historico/quote-line-input.ts`), que injeta
`toLineInput`. Este arquivo só sabe SOMAR o que já veio pronto — nenhuma linha dele chama
`computeFromForm`.

**Fidelidade, registrada e não inventada.** A prancheta desenha 18d (desconto/piso) e 18e (diálogo
"Enviar congela") como DUAS pranchetas separadas. O contrato T083 pede as DUAS num único passo de
revisão: "Válido até" já visível ANTES de qualquer confirmação adicional, e um único clique em
"Enviar" grava, sem uma segunda tomada de decisão. A leitura do total, do piso e da validade JÁ NA
TELA, antes do clique, é a confirmação — não existe uma segunda camada de diálogo Radix aqui.
**Registrado para o design revisar; não é um desvio silencioso.**

**18d·2 ("Aperta, mas passa" — sobra positiva mas pequena) FICOU DE FORA**: a prancheta não decide o
limiar (quantos % é "aperta"), e a T088 pede para NÃO inventar regra de dinheiro. Só os dois estados
com limiar decidido entram: sobra normal (linha apagada) e abaixo do custo (aviso, Q10).

**Ícones**: `check`/`share-2` do conjunto curado já estavam no bundle estático
(`public/brand/icons/lucide`) e entraram no mapa inline (`shared/ui/icon.tsx`).
`percent`/`minus`/`user`/`folder` NÃO estão no bundle e não foram inventados — o campo de desconto usa
o sufixo textual do `NumberField` (%, R$); `lock` (18e) não existe, e o `Aviso` já usa `info` por
padrão (a mesma troca que o resto do 019 fez noutras pranchetas).

### Onde isso vive no código

- `apps/web/src/features/history/quote-builder.tsx` → `toLineInput`

---

## DEC-012 — `freightSubsidyInfo` é INFORMAÇÃO, e é campo novo em vez de `kind` novo por compatibilidade

**Data**: 2026-08-07 (hotfix 016/A2) · **Governa**: `freightSubsidyInfo` no catálogo de tarifas

O subsídio de frete da Shopee no nível do MARKETPLACE — precedente exato de `optionalSurcharges`: não
é tarifa por perfil nem por faixa; é política que vale para todos os vendedores ([[FONTE-001]], arts.
23431 e 26839, literais nas duas: *"Todos os vendedores têm os benefícios do Programa de Frete
Grátis"* — não há adesão a modelar).

**NÃO-COMPUTANTE, e isso é a decisão inteira.** Nenhum consumidor multiplica, soma ou desconta nada
daqui: `entryToChannelFees` não o lê. Ele existe para o vendedor SABER que a Shopee subsidia — a
informação é boa notícia, e apagá-la em silêncio tiraria dele o que usa para decidir — sem que um teto
de validade de cupom volte a virar aritmética (foi assim que nasceu o achado A2).

**Por que um campo novo e NÃO um `kind: "SUBSIDY_INFO"` no union `freight`** — e esta é a armadilha
que o campo existe para desviar: `freightSchema` é um `z.discriminatedUnion`. Um `kind` novo no
artefato SERVIDO faria o cliente PWA **já instalado** RECUSAR o catálogo inteiro, e a recusa é
SILENCIOSA (cai no seed embutido e ninguém vê erro). Uma propriedade extra num `z.object` não-strict é
simplesmente DESCARTADA pelo cliente antigo, que então lê exatamente `freight: {kind: "NONE"}` — a
verdade nova. Compatibilidade por construção, não por sorte.

`nullish` e não `optional` pela razão de sempre: o backend serializa ausente como `null`.

### Onde isso vive no código

- `apps/web/src/shared/fee-catalog/fee-catalog.ts` → `freightSubsidyInfo`, `entryToChannelFees`

---

## DEC-013 — Onde um snapshot nasce: o vendedor escolhe a base, e o botão não existe sem premium ativo

**Data**: 2026-07-13 (009/T010, E4 PR-A · US1/US2 · FR-501/502/519/520) · **Governa**:
`record-snapshot-sheet.tsx`

Um snapshot é a AFIRMAÇÃO do vendedor sobre o que ele cobrou, então esta superfície tem um trabalho
só: gravar exatamente o que está na tela, com a data em que foi orçado, e nunca afirmar mais do que
de fato aconteceu. Três coisas são deliberadas:

1. **O vendedor ESCOLHE a base** (decisão do dono F1, 2026-07-13). Varejo vem pré-selecionado por ser
   o caso comum, mas orçamento de atacado é real — gravar um como varejo faria o Histórico mentir
   sobre o que ele cobrou. A base escolhida é então ROTULADA em toda superfície: um total sem rótulo
   é uma afirmação ambígua.
2. **O payload é congelado quando a Sheet ABRE** — os números que o vendedor lê antes de confirmar são
   os números que ficam gravados. Nada é rederivado na hora de enviar.
3. **A confirmação diz a verdade sobre até onde o registro chegou.** "Salvo" só é dito com resposta
   real do servidor; um registro que só chegou ao aparelho diz isso (`pendente`), e um que o aparelho
   nem conseguiu guardar diz AQUILO (e continua aberto) — a regra única do [[DEC-014]].

**O portão é a última palavra do SERVIDOR** (Princípio IV / nuance do ADR-0015): gravar é oferecido
sobre um entitlement de servidor last-known `active` — resposta de servidor em cache, nunca uma flag
de cliente. Decisão do dono Q15 (2026-07-13): **sem premium ativo o botão NÃO existe** — não é um
affordance acinzentado nem gatilho de teaser (`RecordSnapshotButton` devolve `null`). A calculadora
gratuita não é um salão de vendas (SC-109); a porta honesta vive na aba Histórico.

### Onde isso vive no código

- `apps/web/src/features/history/record-snapshot-sheet.tsx` → `RecordSnapshotButton`

---

## DEC-014 — O aviso de sincronização é UMA regra, e o `switch` exaustivo é o guarda dela

**Data**: 2026-09-01 (correção do bug B3) · **Governa**: `syncToastFor`

Era a MESMA cadeia `if/else` copiada em três telas (`record-snapshot-sheet`, `quote-builder` e
`recalc-today`), e a terceira cópia ficou para trás quando o hotfix 016/A3 acrescentou o ramo
`unauthenticated`: com a sessão expirada, o "Recalcular hoje" caía no vermelho genérico de falha em
vez de dizer que bastava entrar de novo — assustando, sem dizer o que fazer.

O `switch` é EXAUSTIVO de propósito, e é isso que impede a próxima cópia de nascer: um estado novo em
`SyncState` sem ramo aqui **não compila** (o retorno deixaria de ser `SyncToast`), em vez de escorregar
para um `else` que fala a frase errada com convicção.

Pausado não é falhado (ADR-0018 §9) e sessão morta não é recusa do servidor: os dois têm ramo próprio,
em tom `info`, e a palavra "conexão" não aparece na cópia deles.

### Onde isso vive no código

- `apps/web/src/entities/history/sync-toast.ts` → `syncToastFor`, `SyncToast`

---

## DEC-015 — A tela do documento congelado: três proibições, cada uma uma mentira evitada

**Data**: 2026-07-12 (009/T013, E4 PR-A, US2) · **Governa**: `snapshot-detail-page.tsx`

Esta superfície renderiza um DOCUMENTO ([[DEC-008]]), e é definida por três proibições:

1. **ZERO RECÔMPUTO (SC-501).** Todo número ali é uma string GUARDADA, formatada para leitura. Nada é
   derivado, nada é somado, o `pricing-core` não é chamado. Recomputar uma linha que fosse faria o
   snapshot passar a seguir o catálogo de hoje em silêncio — o oposto exato do que ele promete.
2. **LINHA AUSENTE NÃO É ZERO (FR-507).** Um payload sem `finishing` significa que o vendedor não
   cobrou acabamento. Imprimir "Acabamento R$ 0,00" inventaria um fato que ele nunca afirmou, então a
   linha simplesmente não é renderizada.
3. **NUNCA DEGRADA (FR-503).** Um snapshot CONTÉM seus valores e não referencia nada, então nada
   nele pode apodrecer. Apagar o produto de origem não muda nada aqui: nem legenda, nem selo, nem
   tom. A tela fica idêntica à de um cujo origem sempre foi avulsa — e **essa ausência é a feature**,
   o inverso exato da linha de kit degradada do E3.

### Onde isso vive no código

- `apps/web/src/pages/historico/snapshot-detail-page.tsx` → `SnapshotDetailPage`

---

## DEC-016 — Rota de 2 segmentos abre em BRANCO no cold load: overlay ou query param, nunca sub-rota

**Data**: 2026-07-19 (medido no E5) · **Governa**: toda superfície alcançada por navegação profunda

Fato MEDIDO do repositório, não preferência de UX: com `base: './'` (exigência do Capacitor),
**qualquer rota de 2 segmentos abre em branco num cold load ou refresh** — os assets resolvem
relativos e dão 404. Foi o que atingiu `/historico/$id` e `/catalogo/produtos/$id`; `/kits?id=`
desviou usando query param.

Consequências, e as três valem sempre:

- uma superfície nova nasce como **Sheet/overlay** ou **query param**, não como sub-rota;
- num teste e2e, chega-se a ela por **navegação de cliente**, nunca por `page.goto(deep-link)`;
- rota antiga de 2 segmentos que ainda exista é redirecionamento puro, sem checar auth ([[DEC-006]]).

### Onde isso vive no código

- `apps/web/src/features/scenarios/scenarios-list-sheet.tsx` → `ScenariosListSheet`

---

## DEC-017 — Linha de ícones inline no lugar do menu "⋯": desvio datado, e por ausência de primitivo

**Data**: 2026-07-20 (010/T029) · **Governa**: a linha de ações dos cards de cenário

O wireframe de UX desenha um menu de transbordo "⋯" por card. Aqui ele é composto como botões de
ícone inline (`pencil`/`copy`/`trash-2`): **não existe primitivo `DropdownMenu` no DS** (a própria ux
§10.2 G3 marca isso como lacuna de compor-primeiro), e o `features/catalog/catalog-panel.tsx` já
entrega a mesma convenção de linha de ícones para filamentos/impressoras/kits. Reusá-la mantém um
idioma só, em vez de inventar um componente de menu para esta fatia.

Funcionalmente equivalente (Abrir · Duplicar · Renomear · Excluir, cada um com o seu portão) — é
questiúncula de design, não mudança de comportamento, e está registrado para o design ver.

Nota do mesmo T029: o checkbox do T026 afirmava que o "Duplicar" já estava ligado no cliente; **não
estava** (só existia o endpoint do backend). Foi completado junto com a linha de ações.

### Onde isso vive no código

- `apps/web/src/features/scenarios/scenarios-list-sheet.tsx` → `ScenariosListSheet`

---

## DEC-018 — No modo PCT o servidor CONFERE que o abatimento é o percentual declarado (bug B12)

**Data**: 2026-09-01 (achado pelo teste de paridade, corrigido a pedido do dono) · **Governa**:
`_validate_declared_discount`

Até aqui o servidor conferia que o percentual era ≤ 100 e que a subtração fechava, e **nada mais**:
um documento dizendo `mode:"PCT", value:"50", amount:"0.01"` passava inteiro, desde que
`gross - amount` batesse com o total. O papel que chega ao cliente imprime os três números, e os dois
primeiros não explicavam o terceiro — congelado assim para sempre.

**Isto NÃO é o backend recalculando preço** (FR-118 segue de pé): é a mesma classe da identidade logo
acima — VERIFICAÇÃO de um número que o documento já traz, nunca produção de valor.

A conta é EXATA nos dois lados por construção: `gross` e `value` são decimais finitos, o produto é
finito e a divisão por 100 só desloca a vírgula (não há dízima), então o HALF_UP de 2 casas do
ADR-0008 cai no mesmo centavo aqui e no motor (`resolveDiscountAmount`, `pricing-core/src/quote.ts`).
Pinado dos dois lados por `contracts/discount-parity.json`.

**A ordem é deliberada**: esta guarda vem DEPOIS das três anteriores, para que nenhum documento que
já era recusado troque de mensagem — quem falhava por percentual > 100 continua falhando por
percentual > 100.

### Onde isso vive no código

- `backend/app/api/history.py` → `_validate_declared_discount`
- `packages/pricing-core/src/quote.ts` → `resolveDiscountAmount`

---

## DEC-019 — A exportação fica VISÍVEL e desabilitada, e o detalhamento de custo é OPT-IN

**Data**: 2026-07-15 (009/T028, E4 PR-C, US4 · FR-512..516) · **Governa**: `export-sheet.tsx`

O documento é renderizado pelo SERVIDOR (ADR-0020), e toda regra desta superfície decorre desse único
fato:

- **Não funciona offline, e não funciona para um registro que o servidor nunca viu.** Este app grava
  offline por desenho, então os dois são ordinários — não são casos de borda. Por isso o affordance
  fica VISÍVEL e DESABILITADO e diz QUAL dos dois é o caso, ali onde o vendedor toca. Escondê-lo o
  mandaria caçar um botão que estava ali; um botão que gira e não dá em nada seria pior.
- **O detalhamento de custo é OPT-IN e nasce desligado** (Q4/FR-512, SC-506). O artefato padrão vai
  para o CLIENTE do vendedor, e um cliente que lê material/energia/máquina/falha consegue calcular a
  margem contra a qual está negociando. A cópia acima do switch **nomeia esse dano** em vez de deixar
  um rótulo neutro — switch sem explicação é switch que alguém liga "para ver o que faz".
- **Num lapso o servidor recusa a exportação de qualquer jeito** (`require_entitlement`), então o
  cliente nunca precisa ser confiável quanto ao portão; só precisa ser honesto sobre ele.

**Desvio da ux §6** ("lapsed ⇒ visível → painel de reativação"), ratificado pelo dono: um painel
abriria um diálogo cujo único conteúdo é a frase que já está na tela, e não existe FLUXO de
reativação a oferecer antes do E6 (billing) — prometeria uma porta que não existe (Princípio II).

### Onde isso vive no código

- `apps/web/src/features/history/export-sheet.tsx` → `ExportButton`

---

## DEC-020 — O campo de tempo aceita `2:30` e `2h30` porque é assim que o fatiador imprime

**Data**: 2026-08-13 (homologação automatizada, CF-002-LEIGO-C) · **Governa**: `parseTimeInput`

O achado não foi "o formato não é aceito"; foi que ele **não era aceito NEM explicado**: digitar
`2:30` ou `2h30` no campo de horas não movia o preço e não dizia nada. Um campo que engole a entrada
em silêncio é pior que um que recusa, porque o vendedor segue achando que informou.

Aceitar é melhor que explicar aqui, por um motivo concreto: `2:30` e `2h30` são EXATAMENTE como
PrusaSlicer, Cura e Bambu Studio imprimem o tempo estimado — é de lá que o número vem. Não contradiz
a decisão do 016/US7 (h e min separados, para tirar o decimal do caminho do leigo): o destino continua
sendo h+min, só ganhou uma porta de entrada a mais.

**Deliberadamente ESTREITO**: só essas formas, com minutos de 1–2 dígitos. Qualquer outra coisa
devolve `null` e o campo segue exatamente como antes — nada de heurística generosa num campo que
multiplica o custo.

**Review do PR #58 (2026-08-15) — o sufixo `m`/`min`.** A regex ancorada em `$` recusava `"2h30m"` e
`"2h 30m"`, que é como Cura e Bambu Studio escrevem, e aí o FALLBACK do `onChange` lia
`parseInt("2h30m") = 2` e **preservava os minutos anteriores em silêncio**: o vendedor colava 2h30m e
ficava com 2h00 sem nenhum sinal. Recusar é aceitável; recusar e ficar com outro número não é.

### Onde isso vive no código

- `apps/web/src/features/calculator/time-input.ts` → `parseRelogio`, `decimalHoursToHm`, `hmToDecimalHours`

---

## DEC-021 — A fila drena sozinha, e disparar o dreno é seguro de qualquer lugar

**Data**: 2026-07-15 (009/T013, E4 PR-A · ADR-0018 §7) · **Governa**: `outbox-syncer.tsx`

Um registro pendente que só sincronizasse quando o vendedor por acaso abrisse o Histórico seria uma
promessa cumprida pela metade: o app diz "sincroniza sozinho quando a conexão voltar", então tem de
sincronizar. Os gatilhos são os do ADR-0018 §7 — boot / entrada (o uid aparece), reconexão (`online`),
`focus` da janela e a aba ficar visível (`visibilitychange`) — mais o instante em que o entitlement
volta a `active`, que desbloqueia uma fila recusada com 403.

`focus`/`visibilitychange` eram os dois gatilhos que faltavam (review da PR-A, M5): eles também fecham
o buraco do **portal cativo**, onde `navigator.onLine` continua `true`, nenhum evento `online` dispara
e nada drenaria dentro da sessão.

**Disparar daqui é seguro de qualquer lugar e quantas vezes for**: exatamente-uma-vez mora no BANCO
(a chave única em `clientSnapshotId`), nunca neste componente. Um dreno redundante pode desperdiçar
uma requisição; jamais duplicar um registro.

**Invariante que qualquer recuperação por TEMPO precisa preservar** (adiado para a PR-B em
2026-07-15, review M5 — backoff exponencial lendo `attempts`/`lastStatus`): um `status 0` (resposta
perdida) é RETENTADO, **nunca** virado para `failed` por nenhum teto — a escrita pode ter chegado.

### Onde isso vive no código

- `apps/web/src/features/history/outbox-syncer.tsx` → `OutboxSyncer`

---

## DEC-022 — O comparativo mostra congelado e vivo lado a lado sem inventar um terceiro número

**Data**: 2026-07-15 (009/T029, E4 PR-C, US7) · **Governa**: `compare-today.tsx`

*"Meu custo subiu desde que cotei?"*, respondido pondo os dois números um ao lado do outro. Puramente
informativo: gravar o número de hoje continua sendo a ação explícita "Recalcular hoje" (US3). Mora na
camada de página pelo mesmo motivo que o `recalc-today` — o recômputo precisa de `features/calculator`,
e FSD-Lite proíbe uma feature importar outra ([[DEC-009]]).

É a **única** superfície do épico que mostra um valor CONGELADO e um VIVO juntos, o que a torna o
lugar mais fácil de quebrar a regra das duas prateleiras ([[DEC-008]]). Três regras a seguram:

1. **Todo número diz o que é e QUANDO** (FR-523/SC-511). Dois totais pelados lado a lado são um
   enigma, não uma informação — e o vendedor teria de adivinhar qual foi o que ele cobrou.
2. **Compara IGUAL com IGUAL.** Um orçamento de atacado é comparado com o atacado de hoje; parear com
   o varejo de hoje fabricaria um aumento que nunca aconteceu.
3. **Nunca imprime um "hoje" que não conseguiu calcular.** O `recalcToday` reporta `fromFrozen` quando
   caiu de volta no documento congelado — e sob fórmula inalterada isso devolve os números de julho
   exatamente, então rotulá-los "Hoje" responderia "não mudou" com o próprio número em questão. O
   render se apoia no DESFECHO REAL, nunca em `!!product` (a armadilha que a review da PR-A pegou ao
   lado).

**Não calcula diferença.** O delta é aritmética de dinheiro, e aritmética de dinheiro mora no
`pricing-core` (ADR-0008) — dois números rotulados respondem a pergunta sem inventar um terceiro.

### Onde isso vive no código

- `apps/web/src/pages/historico/compare-today.tsx` → `CompareToday`

---

## DEC-023 — O produto não guarda preço: tudo é recomputado vivo, e só a ESCRITA congela

**Data**: 2026-07-11 (US6/T030) · **atualizado** 2026-08-28 (019/PR-B, T045) · **Governa**:
`produto-page.tsx`

A rota de página inteira de criar/editar produto (ux §1.6b): o corpo da calculadora + um nome + os
dois seletores do catálogo, sobre o MESMO controle RHF e o MESMO `computeFromForm` da Calcular.

**Nenhum preço é guardado em lugar nenhum**: todo número desta página é recomputado vivo na
`PRICING_MODEL_VERSION` corrente (FR-310/FR-313). Reabrir um produto DEGRADADO (a referência dele foi
apagada) mostra um aviso calmo, o seletor em "— Manual —" e os últimos valores conhecidos como
entradas editáveis comuns (US6-4) — nunca em branco, nunca quebrado. Salvar é honesto: toast de
verdade só depois de um 2xx de verdade; a falha mantém a página aberta com uma linha pt-BR específica.

**019/PR-B — leitura e recômputo funcionam em TODO portão** (FR-409); só a escrita congela. Fora de
`active`, os três `<fieldset>` viram `<Frozen>` (nunca um `disabled` isolado), o Salvar sai do rodapé
de sempre e vira "Salvar"/"Salvar alterações" SEMPRE renderizado (`type="button" disabled`), e o
rodapé ganha a frase mais o convite único — mesma regra do `FilamentForm`/`PrinterForm`, sem duplicar
a lógica.

O `gate` chega pronto da `CatalogoPage` (o mesmo `premiumGate()` que os quatro painéis leem) em vez de
um `readOnly` binário: **o 013/FB-02 só cobria `lapsed`**, e um `never-subscribed` que abrisse esta URL
direto via `?produto=` chegava com o formulário VIVO — bug fechado ali.

### Onde isso vive no código

- `apps/web/src/pages/catalogo/produto-page.tsx` → `ProdutoPage`, `PremiumGate`

---

## DEC-024 — Forma DEPRECIADA nunca é removida: documento imutável a carrega

**Data**: 2026-08-07 (hotfix 016/A2) · **Governa**: `VoucherBand` / `freight: BAND_VOUCHER` no schema
e no motor

O `BAND_VOUCHER` era descrito como "o teto de cupom co-financiado pelo vendedor, por faixa de preço".
A releitura VERBATIM das fontes ([[FONTE-001]], arts. 26839 e 23431) diz o contrário do que a forma
assume: o R$ 20/30/40 é o que a SHOPEE **oferece**, e é TETO DE VALIDADE do cupom, não cobrança do
vendedor. O catálogo parou de emitir a forma (as duas entradas Shopee viraram `{kind: "NONE"}`) e o
subsídio virou informação não-computante ([[DEC-012]]).

**Por que o schema continua sabendo LER a forma, e por que removê-la seria errado:** este `kind`
viaja DENTRO de payload de snapshot congelado (ADR-0019, imutável por trigger de banco) e de documento
de cenário (ADR-0021). Um schema que passasse a recusá-la faria um documento que o produto promete
imutável **parar de abrir** — ou, pior, abrir afirmando outro número sem uma linha dele mudar. O motor
mantém a capacidade INTACTA pelo mesmo motivo, e é por isso que `PRICING_MODEL_VERSION` **não** subiu
([[DEC-004]]): nada do que já foi gravado muda de valor.

Mesma disciplina do `bandMode` (ADR-0024) e do `fixedFeeRule` (ADR-0027).

**Reabre-se** com o verbatim que falta (o artigo de coparticipação linkado no 26839 e o art. 7749) — e
aí a decisão é do dono, não uma inferência sobre dinheiro (Princípio VIII).

### Onde isso vive no código

- `packages/pricing-core/src/channels.ts` → `VoucherBand`
- `apps/web/src/shared/fee-catalog/fee-catalog.ts` → `BAND_VOUCHER`

---

## DEC-025 — Avisar antes de sair, e NÃO persistir o rascunho — a semente é contrato de teste

**Data**: 2026-08-13 (homologação automatizada, CF-001-LEIGO-E) · **Governa**: `aviso-de-saida.ts`

Recarregar a página apagava tudo que o vendedor tinha digitado, **sem aviso**. Medido: o custo voltou
de R$ 19,91 para a semente. Importa mais do que parece porque o reflexo de quem acha que a tela
travou é justamente recarregar — a persona que perde o trabalho é a mesma que não entendeu o que
estava vendo.

**As duas correções resolveriam o achado.** Persistir o rascunho é a mais generosa e foi descartada
por razão MEDIDA, não por preguiça: a semente da calculadora é um CONTRATO que boa parte da suíte
existente assume depois de um `reload` (o preço-semente 16,16/24,24/21,01 aparece pinado em vários
testes, e a própria homologação o confere). Restaurar um rascunho mudaria o que a tela mostra depois
de recarregar, trocando um defeito de acolhimento por um risco de regressão em cima de um PR já
pronto — e **a decisão sobre o que a primeira visita mostra é do dono**, não de uma correção de
homologação.

O `beforeunload` do navegador é o mecanismo padrão para "você vai perder o que digitou": não inventa
UI nova, não guarda nada, e some sozinho quando não há o que perder.

**Fronteira conhecida e aceita**: o navegador só mostra o diálogo se a pessoa já interagiu com a
página (regra de user-activation) — que é exatamente o caso em que existe algo a perder.

### Onde isso vive no código

- `apps/web/src/features/calculator/aviso-de-saida.ts` → `useAvisoDeSaida`

---

## DEC-026 — O grupo segmentado tem UM dono, e dois papéis de a11y porque são duas semânticas

**Data**: 2026-08-26 (018) · **Governa**: `segmented.tsx`

**Por que existe**: o padrão já vivia no app, escondido dentro de `catalogo-page.tsx` como um
`CatalogTabs` local. O 018 precisa dele em dois lugares (as seções do Catálogo e o tema da Conta), e
duas cópias do mesmo comportamento de teclado é como uma delas fica para trás numa correção.

**O que é honesto dizer sobre o DS**: isto acrescenta uma família de classes `tf-segmented*`. Não é
primitiva nova de interação — a interação é a que o Catálogo já tinha —, mas também não é "zero CSS
novo": o visual de bandeja com pílula selecionada não sai de `Button` + tokens sem folha própria. A
`research.md` §I registra isso.

**A11y — dois papéis, porque são duas semânticas diferentes:**

- `tablist` — a escolha TROCA o painel abaixo (seções do Catálogo). Itens são `tab`, com
  `aria-selected` e `aria-controls`.
- `radiogroup` — a escolha é um VALOR (tema claro/escuro). Itens são `radio`, com `aria-checked`.

Nos dois casos há **um único ponto de tabulação** (roving tabindex): Tab entra no grupo uma vez e as
setas percorrem — que é como um grupo de opções deve se comportar para quem usa teclado.

### Onde isso vive no código

- `apps/web/src/shared/ui/segmented.tsx` → `Segmented`


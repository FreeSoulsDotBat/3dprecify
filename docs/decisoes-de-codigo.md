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

---

## DEC-027 — A superfície pública do `pricing-core`, dividida por responsabilidade

**Data**: 2026-08-31 (chore de legibilidade) · **Governa**: o barril `pricing-core/src/index.ts`

O núcleo canônico de precificação: puro, determinístico, offline. **O backend nunca recomputa preço**
(FR-118); este pacote é a fonte única da fórmula. ADR-0008 (dinheiro) · ADR-0009 (máquina) · ADR-0011
(contrato de resultado).

A divisão saiu de um arquivo único de 793 linhas. Os corpos foram movidos **VERBATIM**, e duas
guardas provam que a superfície não mudou: `tests/public-surface.test.ts` (pina os exports exatos) e
a varredura de igualdade `version-equality` ([[DEC-004]]).

Grafo de dependência, **acíclico**:

```
rounding ← channels ← channel-slot ← calculator ← bom ← quote
     ↖ errors ↗                 ↖ model-version ↗
```

| módulo            | responsabilidade                                                          |
| ----------------- | ------------------------------------------------------------------------- |
| `model-version`   | o rótulo `PRICING_MODEL_VERSION` + campos aposentados (ADR-0026)           |
| `errors`          | `ValidationError` + asserções de entrada                                   |
| `rounding`        | `toMoney`/`sumMoney`/`Decimal` — a única regra de arredondamento (ADR-0008) |
| `channels`        | gross-up por faixa: bandas, piso, voucher, sobretaxa (ADR-0024/0027)       |
| `channel-slot`    | `ChannelInput`→`ChannelFees`, validação POR SLOT + isolamento (SC-107)     |
| `calculator`      | `computeCalculator` — peça única: custo por linha + markups + canais       |
| `bom`             | `computeBom` — kit: linhas × quantidade + rollup por marketplace (ADR-0016) |
| `quote`           | `computeQuote` — orçamento: venda direta, desconto no total, piso (ADR-0034) |

### Onde isso vive no código

- `packages/pricing-core/src/index.ts` → `computeCalculator`, `computeBom`, `computeQuote`

---

## DEC-028 — A sessão só sai de "loading" depois do `authStateReady()`, e o listener nem existe antes

**Data**: 2026-07-23 (E6/T016, defeito ALTO reportado pelo coordenador) · **Governa**:
`bootFromAuth`, `initSessionListener`

O Firebase pode emitir um callback TRANSITÓRIO de pré-restauração (`onIdTokenChanged(null)`) antes de
uma sessão persistida terminar de carregar do IndexedDB (medido contra o emulador de Auth). Assinar
imediatamente — o comportamento antigo — deixava esse callback prematuro virar o `status` direto para
`"anonymous"`, o que satisfaz o portão de "loading" do `main.tsx` e permite a um guarda de rota
mandar um vendedor REALMENTE logado para `/sign-in` antes de o Firebase saber a resposta de verdade
(navegação a frio — exatamente o que um redirect externo de volta faz).

**A correção**: nunca sair de "loading" antes de `auth.authStateReady()` — que só resolve quando a
persistência assentou de fato — ter retornado. O listener **nem é anexado** até lá, então ele
estruturalmente não consegue reagir ao callback transitório; quem fornece a PRIMEIRA resposta honesta
é a própria promessa do `authStateReady()`, lida direto de `auth.currentUser`.

`bootFromAuth` recebe o handle `Auth` por parâmetro (em vez de ler o singleton de módulo) puramente
para testabilidade: o teste o dirige com um handle falso, sem precisar mockar o singleton criado na
inicialização do módulo. O código de produção só o chama por `initSessionListener()`.

### Onde isso vive no código

- `apps/web/src/shared/session/session-store.ts` → `bootFromAuth`, `initSessionListener`

---

## DEC-029 — O cache de entitlement só pode ECOAR o servidor; nunca CRIAR um plano

**Data**: 2026-07-13 (009/T011b, E4 PR-A, decisão do dono) · **Governa**: `entitlement-cache.ts`

O ADR-0018 §9 oferece gravar sobre o "entitlement de servidor last-known — resposta de servidor em
cache, nunca uma flag de cliente" ([[DEC-013]]). Esse cache era o de memória do React Query, que está
VAZIO num boot a frio: um vendedor premium abrindo o app **já offline** (a feira para a qual o outbox
existe) encontrava o teaser e não conseguia gravar nada. A fila offline ficava inalcançável
exatamente quando ela era o ponto inteiro.

A distinção que este arquivo precisa manter afiada é aquela em que o Princípio IV se apoia:

> esta store só pode **ECOAR** o que o servidor disse. Ela nunca pode **CRIAR** um plano.

É por isso que a guarda de forma é estrita (valor corrompido ou forjado resolve para "sem resposta",
nunca para premium), que a chave é por uid (aparelho compartilhado não concede a uma conta o premium
de outra) e que a store é varrida no sign-out. O servidor segue com a última palavra onde importa:
uma escrita tentada sobre um `active` velho é recusada na sincronização com 403 e a entrada vira
`blocked` — visível, retida, nunca aceita em silêncio.

### Onde isso vive no código

- `apps/web/src/entities/user/entitlement-cache.ts` → `loadCachedEntitlement`, `persistCachedEntitlement`, `purgeEntitlementCache`
- `apps/web/src/shared/lib/uid-cache.ts` → `createUidCache`

---

## DEC-030 — UM teaser para as cinco superfícies, com contrato FECHADO (sem props de texto)

**Data**: 2026-08-04 (016/US1, T005, arquitetura-016 §E) · **Governa**: `premium-teaser.tsx`

O único padrão de teaser das cinco superfícies premium (Simulações · "Usar do catálogo" · Catálogo ·
Kits · Orçamentos). Substitui **quatro componentes divergentes** (`features/{catalog,history,scenarios,bom}/*-teaser.tsx`
mais o `PremiumTeaserDialog`, todos APAGADOS naquela fatia), cada um com seu subtítulo, seu bloco "No
Premium…", seus botões de dispensar/entrar — a divergência que a US1 existe para matar (SC-901).

Mora em `shared/billing/` e não numa feature: os cinco chamadores são IRMÃOS FSD-Lite
(`feature → feature` é proibido, ADR-0004/I8), e o `TeaserUpgrade` — o elemento "Assinar" — já tinha
subido para cá pelo mesmo motivo. Este componente ABSORVE o `TeaserUpgrade` como está; ele nunca é
bifurcado (a homologação do E6 que ele carrega — 100,5px de transbordo, um toast que nunca renderizou
— é paga uma vez, não por teaser).

**O contrato é FECHADO: quatro elementos, ordem fixa, nenhuma prop de texto.** O conteúdo vem de
`messages.premiumTeaser`, chaveado por `PremiumFeatureId` — "mesma estrutura em cinco telas" é
propriedade do TIPO (um caminho de render, um registro), não um resultado que cada chamador tem de
acertar por conta própria.

### Onde isso vive no código

- `apps/web/src/shared/billing/premium-teaser.tsx` → `PremiumFeatureId`

---

## DEC-031 — Ler um 404 como "o vendedor apagou" exige DUAS provas independentes

**Data**: 2026-07-15 (009, review PR-A) · **Governa**: o tratamento de 404 no dreno do outbox

O ADR-0018 §5 manda largar a entrada em silêncio quando o vendedor apagou o snapshot noutro lugar:
sumiu da conta E da fila, não sobrou nada a reportar como não-enviado.

**Mas essa leitura exige PROVA**, porque 404 é o status que a infraestrutura mais produz: um proxy
mal roteado, uma rota desmontada ou a página 404 da hospedagem chegam todos como
`ApiError{status: 404, code: "UNKNOWN"}` (o `transport.ts` cai em `wire?.code ?? "UNKNOWN"` quando o
corpo não é o envelope de erro da API). Tratar isso como exclusão apaga a entrada e responde
`synced` — um "Salvo" verde sobre um registro que o servidor nunca recebeu, a mesma classe de mentira
que o M1 já fechou no caminho de releitura.

**Duas evidências independentes, as duas obrigatórias:**

- `attempts > 0` — o §5 descreve um REPLAY. O arquivo já enunciava o invariante em prosa ("um id
  recém-cunhado que o servidor nunca viu não pode dar 404") sem o cobrar de ninguém.
- `code === "NOT_FOUND"` — a API disse, não um estranho carregando o mesmo status.

Sem as duas, a entrada SOBREVIVE e é retentada. O custo de errar aqui é assimétrico: **entrada retida
incomoda; entrada apagada acabou.**

### Onde isso vive no código

- `apps/web/src/entities/history/outbox.ts` → `NOT_FOUND`, `attempts`

---

## DEC-032 — O piso de linhas mora onde a cobertura alcança, não no `.mjs` isento

**Data**: 2026-08-01 (015/A5, [F10-001]) · **Governa**: `checkParseSanity`

O piso de linhas que ACEITA ou REJEITA um parse do catálogo de tarifas morava em `build-amazon.mjs`,
que é o ÚNICO arquivo isento da catraca de cobertura (o `vitest.config.ts` isenta todo `.mjs` sob
`packages`). A `checkParseSanity` era testada com o piso vindo por PARÂMETRO: **a função estava
coberta, o VALOR não.** Trocar 28 por 2 não derrubava nenhum teste, e o guarda que existe para pegar
"a fonte encolheu" aceitaria um parse de 2 linhas.

A equipe já tinha movido `nextCatalogVersion`, `collectedAtFor` e `decideRefresh` para cá por essa
mesma razão, escrita nos próprios comentários: **a regra que decide o rótulo do dinheiro não pode
morar num lugar isento.** A migração ficou incompleta em um ponto — este.

**O número**: a leitura de 2026-07-28 tinha 38 linhas. Uma tabela que perde um quarto das linhas é
mudança de FORMA, não a Amazon apagando dez categorias de um dia para o outro.

Devolve um VEREDITO em vez de lançar, deliberadamente: o chamador precisa poder reagir deixando o
artefato intocado e alertando — nunca escrevendo um mapa parcial (SC-806).

### Onde isso vive no código

- `packages/fee-ingest/src/guardrails.ts` → `checkParseSanity`

---

## DEC-033 — Dentro de uma subárvore de dinheiro, inteiro é recusado; fora dela é contagem legítima

**Data**: 2026-07-31 (E4-01) · **atualizado** 2026-08-30 (019/PR-E, ADR-0034 §2) · **Governa**: as
chaves marcadas em `validation.py`

Chaves de objeto cuja SUBÁRVORE é dinheiro por definição: lá dentro um inteiro JSON nunca é contagem,
então é recusado. O defeito que originou a regra: uma folha de dinheiro inteira passou pela varredura
de float, congelou numa linha imutável e depois renderizou como célula VAZIA no PDF do cliente, porque
o renderizador imprime STRINGS guardadas e nunca coage um número ([[DEC-008]]). Fora dessas chaves um
inteiro é contagem legítima (`schemaVersion`, `quantity`, `contributingLines`, `skippedLines`) e passa
intocado.

**019/PR-E** — o documento do ORÇAMENTO trouxe dinheiro FORA de `totals`/`breakdown`, e ele entra pelas
FOLHAS, uma a uma. A marca é de SUBÁRVORE, e é por isso que `lines` e `discount` ficam de fora **por
decisão, não por esquecimento**:

- marcar `lines` recusaria o `quantity` INTEIRO de todo KIT já gravado — uma regressão do `kind` antigo
  causada pelo `kind` novo;
- marcar `discount` marcaria `value`, que em modo `PCT` é um PERCENTUAL, não dinheiro ([[DEC-018]]).

### Onde isso vive no código

- `backend/app/validation.py` → `_walk`

---

## DEC-034 — "Este marketplace tem taxa?" é UMA função, e a resposta conta sobretaxa

**Data**: 2026-09-01 (correção do bug B5) · **Governa**: `channelHasDeclaredFee`

Havia DUAS implementações que deviam significar a MESMA coisa e não coincidiam: a do congelado
(`frozen-payload.ts`, `feeBearing`) ignorava sobretaxas, enquanto a do vivo (`calculator-model.ts`,
`hasFee`) já as contava desde 016/PR-F (US16, ADR-0027 §3.2). Um marketplace cuja ÚNICA cobrança é uma
sobretaxa — Shopee "Manuseio de item volumoso", R$ 50 — lia "sem taxa" no congelado e **a linha dele
sumia do documento**: o mesmo dado, duas respostas.

**Por que mora em `shared/lib`**: `entities/history` e `features/calculator` não se importam um ao
outro (`eslint-boundaries`), então a casa comum é `shared` — mesmo precedente do `decimal-leaf.ts`,
extraído desta MESMA dupla de módulos na mesma frente de correção.

A forma aqui é NORMALIZADA: o vivo carrega números, o congelado carrega strings decimais. `Number(x)`
lê os dois igualmente (`Number("12.00") === Number(12)`), então a MESMA função serve aos dois lados sem
conversão explícita — só a checagem de PRESENÇA importa para
`priceBands`/`freightVoucherBands`/`surcharges`, nunca o valor de cada item.

### Onde isso vive no código

- `apps/web/src/shared/lib/channel-fee.ts` → `channelHasDeclaredFee`

---

## DEC-035 — A especificidade da tarifa é ESTRUTURAL: sobe a cadeia de ancestrais, não a ordem do JSON

**Data**: 2026-07-31 (014, FR-027, SC-801) · **Governa**: `resolveFeeEntry`

Resolve a entrada de tarifa de um `(marketplace, feeDeterminants)`. O ponto fixo de banda/piso por
preço fica no `pricing-core`.

O 014 substituiu **dois defeitos**:

**1. Casamento por SUBCONJUNTO, decidido pela ordem do array.** Uma entrada `{listingType}` e uma
`{listingType, category}` casavam AMBAS com um slot que fornecia os dois, e o `.find()` devolvia a que
viesse primeiro no arquivo — **uma comissão decidida pela ordenação do JSON** (SC-801 violado). Hoje o
casamento é EXATO por nível, e a especificidade é expressa PERCORRENDO A CADEIA DE ANCESTRAIS: vence o
ancestral mais próximo que tenha entrada. Essa ordenação é estrutural — a cadeia é única e
mais-específico-primeiro — então não há ordenação, nem desempate, nem dependência da ordem das
entradas. Empate nem é representável: o schema recusa conjuntos de determinantes duplicados.

**2. `?? mk.entries[0]`.** Um slot sem determinantes (modalidade vazia, que é exatamente o que
cenários e kits salvos antes do 014 carregam) recebia a PRIMEIRA entrada do array: a comissão de uma
categoria arbitrária, sob selo de "referência". **Removido, não ajustado** (FR-027): sem determinantes
e sem uma entrada explícita de chave nula, a resposta honesta é "sem referência".

Devolve `null` quando nada casa → entrada manual + selo "sem referência", **nunca** um pré-preenchimento
fabricado (Constituição II).

### Onde isso vive no código

- `apps/web/src/shared/fee-catalog/fee-catalog.ts` → `resolveEntry`

---

## DEC-036 — A normalização de nome usa classe de espaço EXPLÍCITA porque `\s` diverge entre JS e Python

**Data**: 2026-08-29 (019/PR-D, T063, ADR-0033 §4) · **Governa**: `normalizeName` nos dois lados

A regra, idêntica no cliente e no servidor: `normalize("NFD")` → remover marcas combinantes (`\p{Mn}`)
→ `toLowerCase()` (**nunca** `toLocaleLowerCase`/casefold — "Straße" não vira "strasse") → trim →
colapsar espaços internos em um.

**A classe de espaço é EXPLÍCITA, escrita com escapes de codepoint, e nunca `\s` nem `.trim()`**: o
`\s`/`.strip()` do Python casa `\x85` (NEL) e não casa BOM (U+FEFF); o `\s`/`.trim()` do JS faz o
inverso. Sem a classe explícita as duas linguagens concordariam **por acidente** em alguns casos e
divergiriam em silêncio noutros — exatamente o que o fixture compartilhado
(`specs/019-porte-design/contracts/fixtures/name-norm.json`) existe para provar caso a caso.

NEL (U+0085) fica DE FORA da classe por decisão: é preservado, não colapsado.

Os pontos de código vêm por escape (`\uXXXX`), **nunca crus**: U+2028/U+2029 são LineTerminator em JS,
e um caractere cru quebraria um regex literal.

### Onde isso vive no código

- `apps/web/src/shared/lib/name-norm.ts` → `nameNorm`, `nameNormKey`
- `backend/app/lib/name_norm.py` → `name_norm`, `name_norm_key`

---

## DEC-037 — `premiumGate` decide o que a tela MOSTRA, nunca o que ela PODE — e nunca presume

**Data**: 2026-08-28 (019/PR-B, T043, research §E-1) · **Governa**: `premiumGate`

A união de CINCO estados que as quatro telas premium leem. O servidor JÁ deriva do ledger
`none | active | lapsed`, e as duas portas já são diferentes (leitura aceita `lapsed`; escrita exige
`active`). "Nunca teve" × "teve e venceu" é, portanto, ESTRUTURAL do lado do servidor — esta função só
LÊ esse campo e o compõe com a sessão.

**Não é um portão** (Constituição IV intocada; diff VAZIO em `app/entitlement/`, SC-1903): é a forma
de a tela decidir o que MOSTRA, nunca o que PODE.

Pura e sem imports: recebe formas ESTRUTURAIS (`{status}`), como o `plan-view.ts` do E6 faz com
`EntitlementLike`. `shared` não pode importar `entities`, e é `shared/billing` (o vazio didático, o
rodapé do formulário inerte) quem precisa dela. Guarda de grafo em `premium-gate.test.ts`.

**O que ela NUNCA faz: presumir.** Sem resposta do servidor — nem fresca, nem lembrada do cache por
uid ([[DEC-029]]) — o estado é `unknown`: nem "presume grátis" nem "presume premium". A tela decide o
que fazer com `unknown`.

### Onde isso vive no código

- `apps/web/src/shared/billing/premium-gate.ts` → `premiumGate`, `PremiumGate`

---

## DEC-038 — O sign-out é INTERROMPÍVEL, e a costura mora em `shared` por fronteira

**Data**: 2026-07-13 (009/T011, E4 PR-A, ADR-0018 §10) · **Governa**: `signOutUser` e a costura de
registro

Até o E4, sair era ação pura: derrubava caches de LEITURA por uid, e cache de leitura sempre se
reconstrói do servidor. O outbox quebra isso: ele é a ÚNICA cópia de um orçamento que nunca chegou à
conta, e a garantia de privacidade "purgar ao sair" (aparelho compartilhado não pode guardar dado da
conta anterior) o destrói. **As duas propriedades estão certas; só o vendedor pode decidir entre
elas** — então sair tem de virar interrompível.

O ponto de interceptação mora em `shared` por razão estrutural: FSD-Lite proíbe `shared` importar
`entities/history`, então a checagem da fila não pode viver dentro da própria função de sair.
`shared` expõe a costura, e o app shell — a única camada que pode enxergar features — registra o que
perguntar.

**A alternativa é exatamente o buraco que isto fecha**: se cada ponto de chamada checasse a fila antes
de sair, o `signOutUser()` (dois pontos de chamada hoje) ganharia um terceiro no mês que vem, e ele
pularia a checagem em silêncio.

### Onde isso vive no código

- `apps/web/src/shared/session/sign-out-guard.ts` → `signOutUser`

---

## DEC-039 — O ramo `BAND_VOUCHER` do mapeamento não é código morto: catálogo persistido antigo o lê

**Data**: 2026-08-07 (hotfix 016/A2) · **Governa**: o mapeamento entrada-do-catálogo → tarifas do motor

Mapeia uma entrada resolvida do catálogo para as tarifas de canal do motor puro (SC-111). Entrada com
bandas (Shopee) leva `priceBands` adiante — o ponto fixo do motor é dono da seleção por preço; entrada
simples leva comissão/fixo/`minPerItem`. Frete conforme o `kind`: o `ESTIMATE.defaultSubsidy` do frete
grátis do ML vira um `freightCost` plano e editável, selado "estimativa"; `NONE` → sem frete.

**O ramo `BAND_VOUCHER` está DEPRECIADO e nenhum catálogo servido o emite — mas ele NÃO é código morto
e não pode ser apagado** ([[DEC-024]]): um cliente que ainda não buscou lê um catálogo PERSISTIDO de
antes do hotfix (a semente embutida vence por `catalogVersion`, mas a store é lida primeiro em alguns
caminhos), e documentos de cenário (ADR-0021) carregam a forma já mapeada. Largar o mapeamento mudaria,
**em silêncio**, o que um catálogo antigo guardado computa.

> **Correção de registro (2026-08-07).** Este docstring justificava o carry-through com "nunca largar
> — isso superestimaria o líquido". É FALSO desde a releitura verbatim: as fontes atribuem o
> R$ 20/30/40 à SHOPEE ([[FONTE-001]]), então **descontar** é que era o defeito. O carry-through
> sobrevive só por compatibilidade.

### Onde isso vive no código

- `apps/web/src/features/calculator/fee-prefill.ts` → `BAND_VOUCHER`

---

## DEC-040 — A tabela de modalidades sobrevive PRIVADA, só para decidir o padrão de um slot novo

**Data**: 2026-08-05 (016/US12, T052, FR-918/FR-919, arquitetura-016 §F.2) · **Governa**: a tabela
privada de modalidades do `calculator-schema.ts`

As opções de modalidade **voltadas ao RENDER** não são mais uma tabela aqui: o `channelFieldPlan` as
deriva vivas do `determinantsSchema` do catálogo, que é o que "dirigido pelo schema" significa — um
marketplace que muda os eixos declarados muda o formulário sem uma linha de código.

A tabela sobrevive, privada, para **um** trabalho: em qual modalidade um slot NOVO começa — um padrão
de UX, não uma lista de escolhas renderizada.

**É desvio MEDIDO e deliberado de derivar também isso**: a ordem do `determinantsSchema` da Amazon é
`["INDIVIDUAL", "PROFISSIONAL"]`, e a ÚNICA entrada catch-all da Amazon é chaveada em
`plan: "PROFISSIONAL"`. Derivar o padrão da ordem do catálogo viraria a modalidade padrão da semente
para INDIVIDUAL, para a qual não existe catch-all, e **mudaria em silêncio o preço-semente que todo
teste deste repositório pina**. O FR-919 pede resultado byte-idêntico nas combinações suportadas hoje;
esta tabela é o que impede o PADRÃO de sair do lugar.

### Onde isso vive no código

- `apps/web/src/features/calculator/calculator-schema.ts` → `defaultChannelSlot`, `slotResetOnMarketplaceChange`

---

## DEC-041 — O aviso de frete aferido é estático e colapsa para UMA linha

**Data**: 2026-08-06 (US17-AC3, art. 4478) · **atualizado** 2026-08-28 (019/T021) · **Governa**:
`shopee-warnings.tsx`

Peso e dimensões cadastrados menores que os aferidos pela transportadora geram recobrança retroativa.
Puramente informativo: não bloqueia o cálculo, não fabrica número e **não desaparece quando o vendedor
edita o formulário** — é estático, não depende de campo nenhum.

**Homologação 016/PR-F (A5)** — era um `Alert` completo (título + corpo sempre visíveis); a seção
Shopee media 1248px a 360px, e os dois avisos ocupavam 48% disso. Este é o estático (presente sempre,
mesmo depois de editar), então colapsa para UMA linha: título curto + ⓘ `InfoTip` com o corpo
completo. Continua presente, continua acessível (o `InfoTip` da casa já é teclado/toque), só não ocupa
a altura inteira até alguém pedir o detalhe.

**019/T021** — a variante `compact` nasceu aqui, local, com uma geometria (8/12px, centrado); a folha
do design a redefiniu no DS com outra (12px/8px, `flex-start`). Promovida: `<Alert compact>` é o dono e
a cópia local morreu (guarda `tf-class-uniqueness`). O ⓘ segue INLINE no título para a linha continuar
UMA — que é a razão de ser da A5.

### Onde isso vive no código

- `apps/web/src/features/calculator/shopee-warnings.tsx` → `InfoTip`

---

## DEC-042 — Um preço, uma fonte: as constantes de plano moram em `shared`, e os derivados são honestos

**Data**: 2026-07-23 (E6/T014-T015, US1, ux-billing §0.2/§8) · **movidas** para `shared` em 2026-08-03
(US7, T032) · **Governa**: `plans.ts`

**A ÚNICA constante de produto**: toda superfície de cobrança — a oferta, o CTA "Assinar"
compartilhado e os quatro teasers — lê preço daqui, nunca um número digitado localmente. Divergência
entre dois preços renderizados seria bloqueador de release (FR-701/SC-707), e ter exatamente uma fonte
é o que torna isso **impossível** em vez de apenas testado.

**Por que em `shared`**: os quatro teasers são features IRMÃS, e `feature → feature` é proibido por
desenho ([[DEC-030]]). Elevar era a saída já escrita no spec (ux-billing §9-G2) — e é a mais correta:
uma constante de PRODUTO é transversal, como `messages`, não propriedade de uma feature.

**Os derivados são fatos honestos, nunca números fabricados**: o "equivalente a R$ 12,99/mês" e os
"~19% de economia" saem da conta (155,88 / 12 ≈ 12,99; 12×15,99 = 191,88 → (191,88−155,88)/191,88 ≈
18,8%). E R$ 191,88 **nunca** renderiza como preço "de" riscado (§0.2, a proibição de/por). Nenhuma
cópia de urgência em lugar nenhum daqui.

### Onde isso vive no código

- `apps/web/src/shared/billing/plans.ts` → `BILLING_PLANS`, `BillingPlanKey`

---

## DEC-043 — Duas portas de entrada HTTP, um núcleo só, e falha de transporte também vira `ApiError`

**Data**: 2026-07-08 (decisão A20 / R2-G2, fecha D1) · **Governa**: `orvalFetch`, `apiFetch`

Duas entradas públicas compartilham um núcleo, para que o comportamento seja idêntico:

- **`orvalFetch`** — o mutator de fetch do Orval: o cliente gerado chama ESTE em vez do `fetch` cru,
  então toda requisição gerada ganha de graça um token Firebase fresco, a baseURL tipada e a
  normalização de `ApiError` (A9/T067).
- **`apiFetch`** — a entrada ergonômica escrita à mão: mesmo transporte, mas devolve o corpo já
  parseado (usada onde o envelope `{data,…}` e a união de 422 fantasma do hook gerado só somariam
  ruído).

As duas injetam token fresco por requisição, resolvem a baseURL do env tipado e — o ponto que
importa — normalizam **tanto as respostas 4xx/5xx quanto as falhas de FASE DE TRANSPORTE** (offline,
DNS, conexão recusada, refresh de token que falhou) num `ApiError` tipado carregando o `code` do fio e
o `correlationId`, reportado ao Sentry (no-op silencioso sem DSN).

Normalizar os dois lados no mesmo tipo é o que permite ao resto do app parar de distinguir "o
servidor recusou" de "não deu para perguntar" por acidente — quem precisa distinguir lê o `code`
([[DEC-031]], [[DEC-007]]).

### Onde isso vive no código

- `apps/web/src/shared/api/transport.ts` → `orvalFetch`, `apiFetch`, `ApiError`

---

## DEC-044 — O painel da Conta é decisão PURA, e compor não é inferir

**Data**: 2026-07-24 (E6 PR-B, T026/US6, SC-708) · **Governa**: `plan-view.ts`

A Conta compõe DUAS verdades do servidor: o ledger (`GET /entitlement` — quem decide se há premium,
Constituição IV) e o espelho do PSP (`GET /billing/subscription` — o que o vendedor contratou e pode
gerenciar). A clarificação de 2026-07-20 dá a precedência: **a assinatura vence quando existe; a
cortesia responde quando não há assinatura; a conta está ativa enquanto QUALQUER grant válido
existir.**

**Compor não é inferir** (SC-708): nenhum estado aqui nasce de palpite do cliente — cada um é a
leitura de um campo que o servidor mandou. Por isso **o erro do ledger vence tudo**, inclusive uma
assinatura em mãos: o espelho do PSP diz o que foi contratado, não se o premium está ligado.

O resultado é uma união discriminada de propósito, pelo mesmo motivo do `RefreshOutcome` da 014: uma
combinação não tratada **não é representável**, então nenhum `if` esquecido pode produzir um painel
sem estado.

### Onde isso vive no código

- `apps/web/src/features/billing/plan-view.ts` → `PlanState`

---

## DEC-045 — O plano vem do servidor e é PERSISTIDO, mas persistir não move o portão

**Data**: 2026-07-10 (E2/T025b, FR-304, ADR-0012 R1b) · **atualizado** 2026-07-13 (009/T011b, decisão
do dono) · **Governa**: `useEntitlement`

O estado de plano da conta vem de `GET /api/v1/entitlement`. Derivado do servidor, nunca fabricado: a
Conta renderiza exatamente o que isto devolve (`none`/`active`/`lapsed`) ou um `unknown` honesto em
caso de erro. Chaveado por uid como o `["me"]`, para que um re-login como outro usuário nunca leia o
plano cacheado do anterior.

**A última resposta do servidor é PERSISTIDA** (IndexedDB por uid, varrido no sign-out), então
sobrevive a um boot a frio. Sem isso, um vendedor premium que abrisse o app **já offline** não tinha
resposta de servidor nenhuma e encontrava o teaser gratuito: o outbox offline ficava inalcançável
exatamente no cenário para o qual existe ([[DEC-029]]).

**Isso não move o portão.** O valor em cache é a última palavra do PRÓPRIO servidor, não uma flag de
cliente (nuance do ADR-0015, ADR-0018 §9); ele só pode ecoar o que o servidor disse, e o servidor
ainda decide na sincronização — uma escrita sobre um `active` velho é recusada com 403 e o registro
vira `blocked`: visível e retido, nunca aceito em silêncio.

### Onde isso vive no código

- `apps/web/src/entities/user/use-entitlement.ts` → `useEntitlement`

---

## DEC-046 — O vazio didático: a lista não é substituída por parede, ela está vazia e EXPLICA

**Data**: 2026-08-28 (019/PR-B, T043, research §E-4) · **Governa**: `vazio-didatico.tsx`

Prancheta 32a/32c ("Premium — O Caminho Sem Parede", cópia congelada em
`specs/019-porte-design/design/`): a lista não é substituída por parede nenhuma — ela está vazia
porque nunca houve o que salvar, e o vazio EXPLICA a feature. Mesma forma do vazio de quem paga
(ícone, título, frase, botão); só o comprimento da frase muda. **Sem coroa, sem preço no título.**

COMPÕE o `EmptyState` que já existe e não tem CSS próprio — a guarda `tf-class-uniqueness` é o que
mantém isso estrutural, não uma promessa.

O **ÚNICO** convite da tela (FR-1906, o invariante um-teaser do 016/US1 — [[DEC-030]]) vive aqui
enquanto a lista é o que está na tela; quando o formulário inerte abre, o rodapé DELE passa a ser o
único (`teaser={false}`, com a contagem asserida nos dois estados).

> **Divergência registrada para a segunda passada do dono**: a prancheta 32a diz "nenhuma menção a
> plano" no vazio, e a FR-1906 exige um convite por tela. A FR ganhou (dod-evidence §T043).

### Onde isso vive no código

- `apps/web/src/shared/billing/vazio-didatico.tsx` → `VazioDidatico`

---

## DEC-047 — A LISTA do Catálogo nunca escreve nada; o aviso de preço vive no ITEM ABERTO

**Data**: 2026-07-11 (US6/T030) · **atualizado** 2026-08-29 (019/PR-D, T076/T124) · **Governa**:
`products-panel.tsx`

A aba Produtos: cache de leitura por uid ligado ao painel premium genérico em modo NAVEGAÇÃO —
criar/editar vivem na rota de página inteira, e o excluir mantém o Dialog de confirmação aqui. O
resumo da linha resolve os NOMES de referência dos caches irmãos; um vínculo degradado lê como
manual. **Nunca um preço numa linha** (FR-310).

**Nada aqui CHAMA `computeFromForm` nem os hooks de `price-observations`** — regra da fatia: hooks só
na PAGE, e este painel permanece PURO e testável por prop; `recomputed`/`changed` chegam prontos da
`catalogo-page.tsx`.

**A LISTA nunca escreve nada** — correção de fidelidade, achado da homologação: o aviso "custo hoje >
fixado" e os botões "Manter {valor}" / "Aceitar novo preço" vivem **só no ITEM ABERTO** (prancheta
17c/16b·2). Nenhuma prancheta desenha os dois blocos na lista.

O `gate` substituiu o `lapsed` binário: como o painel navega (não tem `renderForm`), ele só decide
vazio didático × lista, e o intercept do excluir em `gate === "lapsed"` ([[DEC-037]]).

### Onde isso vive no código

- `apps/web/src/features/catalog/products-panel.tsx` → `ProductsPanel`

---

## DEC-048 — A cópia das Simulações e dos Orçamentos é VERBATIM da prancheta, e o que ficou fora está listado

**Data**: 2026-07-19 (010, E5 PR-A) · **atualizado** 2026-08-04 (016/US2) e 2026-08-30 (019/PR-E,
T087) · **Governa**: `quote.pt-br.ts`

**Um cenário é VIVO, nunca datado**: nenhum "salvo em"/"cotado em" em lugar nenhum daqui (§0.2). E
"Cancelar" é banido (FR-014) — todo controle de dispensa é "Voltar".

**016/US2** — "cenário" virou "simulação" em toda superfície visível: o par Histórico/Cenários não
comunicava a diferença (congelado × recalculado hoje). A CHAVE do namespace (`scenarios`) e as chaves
internas **não** mudam — só os VALORES pt-BR. É o que permite renomear no produto sem renomear no
código.

**019/PR-E** — prancheta 18 ("Orçamentos — Montar e Enviar"), cópia congelada em
`specs/019-porte-design/design/`, **byte a byte**. Só o que a spec US6/US16/US17 abrange (Q6 venda
direta, desconto no TOTAL; Q7 "Válido até" é texto; Q10 abaixo do custo AVISA; Q8 PDF pelo servidor).

**Fora, e listado para não virar esquecimento**: a 18c inteira (US18 RETIRADA), os cinco estados da
lista e "Marcar aceito/recusado" (18a/18e·2), frete (18d), "Sobra sobre o custo" como algo além de
leitura do piso, "Como sai no WhatsApp"/Copiar/Compartilhar (18f), e o "prazo de produção".

### Onde isso vive no código

- `apps/web/src/shared/i18n/messages/quote.pt-br.ts` → `scenarios`

---

## DEC-049 — A poda da semente é POLÍTICA DECLARADA, não acidente curatorial

**Data**: 2026-08-07 (017/T009 · P0-a, ADR-0029 §B/§C.2.4) · **Governa**: `projetarSemente`

O defeito é MEDIDO e já custou duas edições à mão em dois dias: um teste cravava `catalogVersion` numa
literal, e todo bump de conteúdo obrigava alguém a reescrever uma string dentro de um teste. O
primeiro PR mensal nasceria VERMELHO por construção — **com o dado CERTO**.

A tentação seria "paridade estrita = igualdade de documento". Medido, e é falsa: **a semente não é
cópia do servido.** No servido a Amazon tem 78 entradas e uma espinha de 38 categorias; na semente,
`entries: []` e nenhuma espinha. É uma projeção PODADA, e a poda vale **94% do documento** — 45.858
bytes servidos viram 2.720 (orçamento de boot SC-810).

O que este módulo faz é transformar essa poda de ACIDENTE CURATORIAL em POLÍTICA DECLARADA. Até aqui
ela era um comentário no `seed.ts` ("ML + Amazon stay empty pending their category-specific rates")
que nenhum guarda verificava — **e um comentário não impede o mês em que alguém copie o servido
inteiro para dentro do bundle.**

### Onde isso vive no código

- `packages/fee-ingest/src/seed-projection.ts` → `projetarSemente`

---

## DEC-050 — Montar um kit é permitido para todos; só "Salvar" bloqueia

**Data**: 2026-07-16 (008/T005+T006) · **atualizado** 2026-08-28 (019/PR-B, T046, decisão 3 do dono
2026-08-27) · **Governa**: `bom-page.tsx`

A página `/kits` é dona da lista de linhas; o editor de cada linha é o formulário de peça da
calculadora hospedado na camada de widgets; **todo número de dinheiro vem de `computeFromForm` →
`composeBom`** — a view não soma nada.

**Decisão do dono (spec §Clarifications)**: *"a parede de /kits cai junto com a do Catálogo, e montar
um kit sem salvar é permitido no grátis/lapsed — só 'Salvar' bloqueia."* O composer MONTA para
qualquer sessão conhecida (deslogado, `none`, `lapsed`, `active`) e COMPÕE para todos — adicionar e
remover linha é estado local, nunca rede. A única coisa que o `premiumGate` ([[DEC-037]]) decide aqui é
o rodapé de "Salvar" e o convite único (FR-1906).

**O que continua sendo um MURO é a AUSÊNCIA de resposta do servidor** sobre uma conta autenticada
(`unknown`) — nunca presumido grátis, nunca presumido premium.

### Onde isso vive no código

- `apps/web/src/pages/bom/bom-page.tsx` → `composeBom`

---

## DEC-051 — Um BURACO entre bandas é dado legítimo; o que se recusa é a forma que o disfarça

**Data**: 2026-08-01 (014/T114, SC-817, FR-014a) · **Governa**: `checkBandCoverage`

Um GAP é dado legítimo e **não** é recusado: a FR-014a é explícita — a janela que a fonte deixa sem
preço fica sem preço, e o `pricing-core` recusa precificar dentro dela em vez de pegar emprestada a
taxa da vizinha.

O que este guarda pega são as formas que tornam um buraco INDISTINGUÍVEL de um erro de parse:

- **SOBREPOSIÇÃO** — duas bandas reivindicando o mesmo preço. A busca do motor (limite inferior
  inclusivo) escolheria em silêncio a que viesse primeiro, então **qual taxa o vendedor paga
  dependeria da ordem das linhas de uma tabela raspada**.
- **FORA DE ORDEM / limites invertidos** — um `maxPrice` igual ou menor que o próprio `minPrice` é uma
  banda que nunca pode conter preço nenhum: erro de leitura vestido de dado.
- **UMA SEGUNDA banda sem teto** — só a banda terminal pode ser aberta.

Devolve VEREDITO em vez de lançar, pela mesma razão do [[DEC-032]]: o chamador tem de poder deixar o
artefato publicado intocado, em vez de substituí-lo por algo malformado (SC-806).

### Onde isso vive no código

- `packages/fee-ingest/src/guardrails.ts` → `checkBandCoverage`

---

## DEC-052 — "Este canal tinha taxa?" é respondido na LEITURA, para valer também para o já congelado

**Data**: 2026-08-01 (014/T120, SC-815) · **Governa**: `feeBearing` no payload congelado

Com comissão 0 o motor devolve anúncio == base e líquido == base: números reais, mas **não** um preço
de marketplace. A calculadora já se recusa a mostrá-los ("Informe a comissão do canal para ver os
preços"); o detalhe congelado imprimia as quatro linhas e portanto **afirmava o que a própria origem
tinha negado** (Princípio II). Esta é a metade de LEITURA daquela recusa.

**Na leitura e não na escrita, de propósito.** As entradas de tarifa já viajam dentro do documento
(`inputs.channels` num SINGLE, `lines[].input.channels` num KIT), então o fato é recuperável de todo
registro já escrito — inclusive os já congelados, que um trigger de banco torna irreescrevíveis
(ADR-0019). Congelar nulos teria consertado só os registros futuros e deixado os existentes afirmando
a mesma coisa para sempre.

Responde `true` sempre que a AUSÊNCIA de taxa **não puder ser provada** pelo documento — payload sem
nenhuma entrada de canal, ou rollup sem slot correspondente. Suprimir uma linha por palpite seria a
mesma fabricação na direção oposta (SC-815).

Complementa o [[DEC-034]]: aquele unifica *o que conta como taxa*, este decide *quando a pergunta é
respondida*.

### Onde isso vive no código

- `apps/web/src/entities/history/frozen-payload.ts` → `feeBearing`

---

## DEC-053 — O foco no título pertence ao `page-header`, não ao shell — e por uma razão de ordem

**Data**: 2026-07-06 (T023/T033, T045/NAV-2) · **Governa**: `app-shell.tsx`

O chrome da camada de app que hospeda as páginas por `<Outlet/>`: banner de offline (topo,
`role=status`), top-bar (marca + tema + conta) e app-nav (TabBar no mobile, lateral no desktop,
variante por viewport). **Nenhum guarda de auth mora aqui** — guardas são `beforeLoad` do router.

**Foco-no-título ao navegar pertence ao `widgets/page-header`**: cada título de seção foca a si mesmo
ao montar (pulando a primeira montagem, a de carga inicial). Essa montagem é o único sinal confiável
de "o título novo está no DOM" — um efeito aqui, chaveado pelo pathname, **dispara antes de o
`<Outlet/>` comitar a página de destino**, e o shell focaria o título que está SAINDO.

### Onde isso vive no código

- `apps/web/src/app/app-shell.tsx` → `AppShell`

---

## DEC-054 — Exportar é uma AÇÃO (`useMutation`), e nada aqui monta documento

**Data**: 2026-07-15 (009/T028, E4 PR-C, US4 · FR-515/516) · **Governa**: `use-export.ts`

Busca o artefato que o SERVIDOR renderizou e o entrega ao aparelho. **Nada aqui monta um documento.**
O renderizador vive no servidor (ADR-0020) precisamente para que o portão de entitlement seja real: um
chamador grátis ou em lapso nunca chega nele, então "negado, e nenhum artefato parcial" vale por
construção, não por um `if` do cliente ([[DEC-019]]).

Os caminhos vêm dos construtores de URL GERADOS, para o contrato seguir sendo fonte única — uma rota
renomeada quebra o build aqui, não a produção.

**`useMutation` e não `useQuery`, de propósito**: exportar é uma AÇÃO que o vendedor toma, com efeito
colateral no aparelho dele. Os hooks gerados são `useQuery`, que cachearia os bytes, os buscaria de
novo no foco da janela e **rebaixaria um arquivo que ninguém pediu**.

O transporte é `apiFetchFile` porque só ele lê o `Content-Disposition` que o servidor manda.

### Onde isso vive no código

- `apps/web/src/entities/history/use-export.ts` → `apiFetchFile`

---

## DEC-055 — A rota atrás de flag não é REGISTRADA; e responde 404, não 401

**Data**: 2026-07-25 (E6/T035-T036, ADR-0023 §6, owner Q2 · VR-709/SC-711) · **Governa**: as rotas de
Play Billing

As duas rotas existem no CÓDIGO e não existem em nenhum ambiente do E6: elas só são registradas quando
`P3D_PLAY_BILLING_ENABLED` é verdadeira. Com a flag desligada, **o próprio roteador responde 404** —
não há handler que possa vazar por engano.

**404 e não 401/403, de propósito**: um 401 diria "existe, mas você não está autenticado", confirmando
a superfície para quem estiver sondando. 404 diz o que é verdade — não há rota aqui.

**Gating por REGISTRO e não por `if` dentro do handler**: um `if` esquecido é um vazamento; uma rota
que nunca foi registrada não tem como responder. Mesma família estrutural do [[DEC-044]] e da barreira
por AUSÊNCIA de handler do 019/PR-B.

### Onde isso vive no código

- `backend/app/api/billing.py` → `play_billing_enabled`
- `backend/app/settings.py` → `play_billing_enabled`

---

## DEC-056 — O banner de sessão expirada é `info`, mora no shell, e usa `<a>` puro

**Data**: 2026-08-07 (hotfix 016/A3, H5) · **Governa**: `session-expiry-banner.tsx`

O caminho de volta que a homologação T072 achou faltando ([[DEC-007]]): o servidor pode recusar uma
sessão de cliente viva, e até esta fatia NENHUMA tela se movia quando isso acontecia — o guarda do
`router.tsx` só reage à sessão do CLIENTE morrer, que não é este caso. Renderizado no `app-shell`
(toda aba autenticada o monta), para ser alcançável de onde quer que o 401 tenha acontecido, não de
uma página só.

**Tom `info`, nunca `danger`**: nada foi destruído — o estado `unauthenticated` do outbox (H4) guarda
todo orçamento não sincronizado — então isto é um convite, não um alarme.

**Um `<a>` puro, mesmo padrão do `TeaserUpgrade`, nunca o `<Link>` do router**: assim ele renderiza e é
testável sem nenhum `RouterProvider` montado. O `useRouterState` lê o `location.href` CORRENTE (campo
do próprio TanStack: pathname + search, nunca a URL absoluta do navegador), então o redirect preserva
a intenção do vendedor através da lista do `safeRedirect` ([[DEC-006]]).

### Onde isso vive no código

- `apps/web/src/widgets/session-expiry-banner/session-expiry-banner.tsx` → `SessionExpiryBanner`

---

## DEC-057 — Os dígitos vêm do formatador oficial; o SINAL fica, porque o menos tipográfico é DESENHO

**Data**: 2026-09-01 (chore de legibilidade, item 3(3)) · **Governa**: `breakdown-row.tsx`

Os DÍGITOS passaram a vir do formatador oficial (`formatDecimal`, a mesma casa de `formatBRL`): este
componente era o segundo `toLocaleString("pt-BR")` do app, e ele imprime justamente o detalhamento do
preço ([[DEC-002]]).

**O SINAL fica como está, e isso não é a exceção que sobrou.** O menos tipográfico (U+2212) é DESENHO,
escrito na prancheta — *"Dinheiro em pt-BR com fonte tabular, sinal de menos tipográfico: R$ 24,24,
R$ 1.234,56, − R$ 3,80"* (`docs/design/prompts/inferidos/calculadora/estados-de-preco-por-canal.md`)
— e dois testes o pinam.

> **Registro honesto de como a decisão foi tomada:** a aprovação do dono para "padronizar" veio da
> MINHA descrição do sinal como detalhe imperceptível. A prancheta diz o contrário, então trocá-lo
> seria divergir do desenho dele **sem decisão informada**. Fica como está até o dono decidir com a
> prancheta à vista.

A POSIÇÃO (sinal antes do prefixo) e `prefix`/`decimals` também seguem sendo deste componente.

### Onde isso vive no código

- `apps/web/src/shared/ui/breakdown-row.tsx` → `BreakdownRow`

---

## DEC-058 — As duas limitações do mapa da Amazon são DECLARADAS em cada entrada, não escondidas

**Data**: 2026-07-31 (014, FR-014, Q9) · **atualizado** 2026-08-05 (016/US14) · **Governa**:
`amazon-to-catalog.ts`

**1. A base da comissão inclui o frete.** A Amazon cobra a comissão sobre uma base que INCLUI o frete;
nosso motor cobra sobre o preço de anúncio. O número aqui, portanto, **subestima** a tarifa real de um
item enviado. Declarado, não modelado — modelar é mudança no `pricing-core` e está explicitamente fora
de escopo (Q9).

**2. A tabela de referral NÃO varia por plano** (medido em 2026-07-28: zero menções a plano nas 38
linhas), então os dois planos carregam a mesma comissão.

A cobrança POR ITEM separada do plano Individual não está publicada naquela página — e até o 016 ela
NÃO era incluída, que era a resposta honesta enquanto o número não tinha fonte. **O 016/US14 fechou
isso**: os R$ 2,00 vêm de `venda.amazon.com.br/precos` e hoje viajam COM essa página como procedência
própria (`fixedFeeSource`). A declaração permanece, mas agora declara a coisa certa: o número não está
NAQUELA página, e a entrada diz onde ele está.

### Onde isso vive no código

- `packages/fee-ingest/src/amazon-to-catalog.ts` → `fixedFeeSource`

---

## DEC-059 — `PROGRESSIVE` tem forma FECHADA por segmento; nenhum segmento serve ⇒ o nível fica SEM PREÇO

**Data**: 2026-08-01 (ADR-0024, SC-817, ADR-0027 §3.2) · **Governa**: o anúncio progressivo em
`channels.ts`

O `SELECTION` precisa de ponto fixo iterado porque a função de tarifa dele SALTA em cada limiar: o
anúncio escolhe a banda e a banda escolhe o anúncio. A função progressiva **não tem salto**, então a
solução é fechada por segmento. No segmento `[min_k, max_k)`:

```
fee(L) = acc_k + pct_k·(L − min_k)          acc_k = Σ_{i<k} pct_i·(max_i − min_i)
L − fee(L) − fixedFee_k − S = base          S = Σ sobretaxas (ADR-0027 §3.2)
⇒ L = (base + fixedFee_k + S + acc_k − pct_k·min_k) / (1 − pct_k)
```

Resolve-se TODO segmento e fica-se com aquele cuja solução cai dentro do PRÓPRIO segmento. Exatamente
um cai, quando as bandas cobrem a linha.

**Se nenhum cai** — um conjunto de bandas que para antes do ∞, ou um com buraco publicado, ambos dados
representáveis ([[DEC-051]]) — a resposta é `null`: **o nível fica SEM PREÇO** (SC-817). Responder com
o último segmento inventaria a taxa do excedente que a fonte nunca publicou.

### Onde isso vive no código

- `packages/pricing-core/src/channels.ts` → `PROGRESSIVE`

---

## DEC-060 — A alíquota de referência só aparece sob TRÊS condições, e a terceira evita trocar mentira por mentira

**Data**: 2026-08-03 (015/A8, `[F11a-007]`, decisão do dono) · **Governa**: a referência de comissão
no campo em branco

A tela foi MEDIDA: com Amazon e sem categoria, os quatro campos ficavam vazios com placeholder "0,00"
— lendo-se `Comissão 0,00 %` — enquanto "Preços por canal" mostrava um preço com 15% já embutidos. **O
número que o vendedor procura primeiro estava em branco, e o selo que o explicava era o elemento de
menor peso visual do painel.**

TRÊS condições, e cada uma existe para não trocar uma mentira por outra:

1. **Só quando as taxas vieram do CATÁLOGO** — o que o vendedor digitou, ele já vê.
2. **Só o campo que o vendedor NÃO digitou** — senão a referência competiria com o número dele.
3. **Só quando o valor é ÚNICO.** Com `priceBands` a comissão varia por faixa e o mapeamento devolve
   `commissionPct ?? 0` — ou seja, ZERO para uma entrada bandada. Publicar esse zero diria "Comissão
   0,00%" com ar de verdade, **que é exatamente o defeito que se está consertando**.

### Onde isso vive no código

- `apps/web/src/features/calculator/calculator-model.ts` → `commissionPct`

---

## DEC-061 — Uma causa NOMEADA é uma causa MEDIDA: erro sem `ApiError` não fala em conexão

**Data**: 2026-08-07 (016/T072-A9) · **Governa**: `error-messages.ts`

Mapeia uma ESCRITA QUE FALHOU numa linha pt-BR honesta e específica — nunca um erro genérico, nunca um
salvamento falso. Falha de fase de transporte (status 0 = offline / DNS / recusada) diz que a escrita
precisa de conexão; erro de servidor com código ganha a frase amigável dele (um 403 de lapso →
"Salvar faz parte do Premium"). Vivia como cópia privada em dois lugares; o salvar do kit foi o
terceiro chamador, e virou uma regra só para "como uma escrita negada fala".

**A correção do A9**: o ramo de não-`ApiError` também dizia "precisa de conexão" — uma afirmação **não
medida**. O `transport.ts` normaliza toda falha real de requisição, de rede E de servidor, num
`ApiError` tipado ([[DEC-043]]); logo, um valor LANÇADO que não é um deles é, por construção, uma
falha inesperada do lado do cliente. **A conexão não é a causa conhecida, então a cópia não pode
nomeá-la** — a regra da casa é que causa nomeada é causa MEDIDA. Cai na frase genérica honesta.

### Onde isso vive no código

- `apps/web/src/shared/api/error-messages.ts` → `honestWriteError`, `apiErrorMessage`

---

## DEC-062 — A espinha de categorias é ESPARSA e viaja DENTRO do artefato, porque ela decide dinheiro

**Data**: 2026-07-31 (014 / D2) · **Governa**: `category-tree.ts`

A árvore tem DOIS consumidores com necessidades diferentes, e confundi-los foi o erro de desenho que a
revisão adversarial pegou: o **RESOLVEDOR** precisa só de `id`+`parentId` dos nós cuja comissão diverge
do pai (mais os ancestrais) — a "espinha" —, enquanto o **SELETOR** precisa do NOME de todo nó.

A espinha viaja **DENTRO do artefato do catálogo**, para que o dado que decide dinheiro se mova num
artefato só, com um `catalogVersion` só — matando o descompasso árvore↔catálogo por construção. O
índice de nomes é buscado sob demanda.

**Por que esparsa, e o número é medido** (2026-07-28, contra a API viva do ML): a comissão é
CONSTANTE POR PARTES descendo a árvore. 84 de 96 filhos amostrados herdam a taxa da raiz; **12
divergem, e as divergências são dinheiro** (Celulares 18% → Smartphones 16%; Games 18% → Consoles
16%). Guardar todo nó repetiria o mesmo número dezenas de milhares de vezes; guardar só as raízes
estaria errado uma vez a cada oito categorias — e justamente nas de maior volume.

### Onde isso vive no código

- `apps/web/src/shared/fee-catalog/category-tree.ts` → `categorySpine`

---

## DEC-063 — A fatia existe para tornar impossível um coletor reverter curadoria em silêncio

**Data**: 2026-08-07 (017/T006, ADR-0028 §3, desenho §C.2) · **Governa**: o tipo `CatalogSlice`

O defeito que este módulo torna impossível está MEDIDO no `build-amazon.mjs` de hoje: ele lê e escreve
o `catalog.json` INTEIRO. Com um coletor serial isso funciona; com jobs independentes em VMs isoladas,
**o último a escrever vence e a curadoria do outro some — em silêncio, sobre dinheiro.**

E há um segundo defeito, pior, **que não precisa de concorrência nenhuma**: um coletor que REGENERA o
marketplace apaga toda folha que ele não sabe produzir. O PNG do art. 26839 traz a tabela de comissão
da Shopee e nada mais — nem `freight`, nem `freightSubsidyInfo`, nem `optionalSurcharges`. **Um
coletor Shopee ingênuo reverteria o hotfix 016/A2 na PRIMEIRA execução real**, devolvendo ao líquido
do vendedor o desconto de R$ 20 que acabou de sair de lá ([[FONTE-001]], [[DEC-012]]).

A regra: o coletor emite as folhas que DECLAROU ter lido; toda outra folha vem da BASE. E o tipo **não
tem caminho para o disco** — quem escreve é a composição, depois de validar. A outra metade da regra
(remoção sob exaustividade declarada) está no ADR-0028 §Emenda.

### Onde isso vive no código

- `packages/fee-ingest/src/slice.ts` → `CatalogSlice`, `aplicarFatia`

---

## DEC-064 — O sentido SALVAR não re-deriva nada, e devolve `null` em vez de persistir intenção quebrada

**Data**: 2026-07-19 (010/T009+T010) · **atualizado** 2026-07-20 (010/T021b) · **Governa**: o sentido
salvar do `scenario-bridge`

Monta o documento de config a partir do estado vivo da página Calcular: `values`/`channelOutcomes` vêm
direto do `computeFromForm` — **nada é re-derivado, re-parseado ou recomputado aqui** ([[DEC-009]]).

Devolve `null` quando não há nada válido a salvar (um formulário inválido não tem `parsedInput`: o
`computeFromForm` só devolve um numa passada inteiramente válida), para o chamador **desabilitar o
affordance de salvar em vez de persistir uma intenção quebrada**.

**Nota de escopo, sinalizada e não inferida**: a página Calcular não tem vínculo persistente com
produto do catálogo (ao contrário de uma linha de BOM), então todo cenário salvo a partir dela é
`AD_HOC`.

**T021b — `productRef`**: quando o chamador é a `ProdutoPage` (que monta ESTE MESMO corpo de
formulário sobre um produto SALVO), ela entrega o `{id, name}` aqui e a base capturada vira `PRODUCT`
em vez de `AD_HOC`, fechando a FR-606a do lado da UI. Base `KIT` está fora do escopo desta função —
Calcular e ProdutoPage são superfícies de peça única.

### Onde isso vive no código

- `apps/web/src/features/calculator/scenario-bridge.ts` → `productRef`

---

## DEC-065 — O aviso nasce no BLUR, não no `change`, e um valor novo o traz de volta

**Data**: 2026-08-28 (019/PR-C, T056, prancheta 14) · **Governa**: `use-aviso-de-campo.ts`

O ciclo de vida que as pranchetas 14a/14b pedem: o aviso nasce no BLUR (nunca no `change`), é
dispensável por "Entendi" — salvo quando acompanha uma recusa —, e **um valor novo faz o aviso voltar
mesmo já dispensado**.

Um `ref` segura o valor mais recente digitado, para o `onBlur` ler o valor certo mesmo que o
componente tenha re-renderizado no meio do caminho; e só o valor COMPROMETIDO no blur (o `useState`)
alimenta o aviso. **É essa a diferença entre "dispara a cada tecla" — o defeito — e "dispara ao sair
do campo".**

Vive em `shared/lib` e não em `features/calculator`: precisa de React e do store de dispensa, e os dois
consumidores (`features/calculator` e `widgets/bom-line-editor`) importam do mesmo lugar que já
hospeda o [[DEC-003]] — a mesma fronteira.

### Onde isso vive no código

- `apps/web/src/shared/lib/use-aviso-de-campo.ts` → `useAvisoDeCampo`

---

## DEC-066 — O banner escolhe o TÍTULO por precedência, mas nunca sequestra o botão de drenar

**Data**: 2026-07-15 (009, review PR-A, C6) · **atualizado** 2026-08-07 (hotfix 016/A3, H4b) ·
**Governa**: `history-queue-banner.tsx`

O TÍTULO segue a precedência `failed > blocked > unauthenticated > pending` — vence o estado que
precisa de decisão humana.

**Mas a ação de DRENAR não fica mais refém dele.** Uma única entrada falhada ou bloqueada escondia o
[Sincronizar agora] por inteiro, prendendo atrás dela todo `pending` saudável — o único dreno manual
do app, sumido. Hoje o banner SEMPRE oferece sincronizar quando há um `pending` saudável e está
online, mais um [Ver] para pular ao que precisa de decisão. Os selos por card contam a verdade
completa independentemente do que o banner diz.

**`unauthenticated` é ramo PRÓPRIO, nunca dobrado em `blocked`** ([[DEC-014]]): a cópia não pode dizer
"conexão"/"online" — o achado A3 é exatamente a cópia antiga de `pending` prometendo isso com a
conexão intacta — e ela oferece um caminho real de volta, [Entrar de novo] preservando `/historico`
como intenção de retorno ([[DEC-006]]).

### Onde isso vive no código

- `apps/web/src/pages/historico/history-queue-banner.tsx` → `QueueBanner`

---

## DEC-067 — Trocar de marketplace APAGA só o campo que sumiu da tela; o resto é número do vendedor

**Data**: 2026-08-05 (016/US11, T044, bloqueador da homologação PR-E) · **Governa**:
`channel-field-plan.ts`

O plano de campos decide **o que APARECE, nunca o que COBRA**. Trocar o marketplace de um slot com
campo já preenchido — por exemplo um "Frete" digitado no ML — deixava o valor lá: o campo
simplesmente parava de renderizar no marketplace novo (Amazon, `freightCost` fora dos `feeAxes`
dela), **e o número seguia descontando o líquido sem nenhum controle na tela que o nomeasse**.
Medido: −R$ 50, "Canal não-lucrativo", selo "ajustado por você", zero campo visível.

Devolve APENAS os campos que precisam ser zerados — todo campo que o plano novo ainda mostra fica
intocado, e o valor dele, se houver, segue significando o que o vendedor digitou. **Um valor que
sobrevive à troca porque o plano NOVO também o mostra não é vazamento: é o número do próprio vendedor
seguindo num eixo que continua existindo.**

### Onde isso vive no código

- `apps/web/src/features/calculator/channel-field-plan.ts` → `channelFieldPlan`

---

## DEC-068 — A aba é DERIVADA da URL, nunca congelada em `useState`

**Data**: 2026-07-31 (013/F-02 follow-up) · **Governa**: `catalogo-page.tsx`

Era `useState(initializer)`, que só re-deriva na MONTAGEM. Isso funcionava enquanto o formulário de
produto vivia em `/catalogo/produtos/*`: abri-lo saía desta rota, então voltar sempre remontava e
relia o `?tab=`. Com o formulário virando `?produto=` NESTA rota, o componente fica montado a visita
inteira — e um `active` congelado significava que (a) `?tab=products` depois de salvar um produto não
selecionava mais Produtos, e (b) `/catalogo?tab=kits` como link profundo renderizava a aba que
estivesse no estado velho.

**Um bug de link profundo escondido dentro da história de link profundo** ([[DEC-016]]); o e2e o pegou
como um clique numa linha de filamento que abria um produto.

Derivar faz da URL a fonte única, então a aba sobrevive a reload, favorito e voltar. Todo `TabId` faz
a ida e volta — inclusive `printers`, que o inicializador antigo largava em silêncio (ele só conhecia
products/kits).

### Onde isso vive no código

- `apps/web/src/pages/catalogo/catalogo-page.tsx` → `TabId`

---

## DEC-069 — Salvar cenário congela a config na ABERTURA da Sheet, e o affordance é ausente sem premium

**Data**: 2026-07-19 (010/T010, E5 PR-A US1) · **Governa**: `save-scenario-sheet.tsx`

Espelha exatamente o idioma do `RecordSnapshotButton` do E4 ([[DEC-013]]): um affordance inline
PREMIUM-ONLY que é simplesmente AUSENTE sem entitlement ativo de servidor — não acinzentado, não
gatilho de teaser (a postura SC-109 que esta feature herda).

É o guarda de rota honesto do CLIENTE que o ADR-0015 pede: **informativo apenas** — o
`require_entitlement(ACTIVE)` do servidor no `POST /scenarios` é o portão de verdade, e um cliente com
`active` velho ainda pode ser recusado lá (mostrado honestamente, nunca presumido).

**`buildConfig()` é chamado UMA vez, na ABERTURA da Sheet** (o mesmo padrão de congelar do
[[DEC-013]]): a config que é salva é a que o vendedor revisou na tela, não uma re-derivada depois que
ele começou a digitar o nome.

`features/scenarios` nunca importa `features/calculator`: quem monta o closure é a página, pelo
[[DEC-009]].

### Onde isso vive no código

- `apps/web/src/features/scenarios/save-scenario-sheet.tsx` → `buildConfig`

---

## DEC-070 — O painel genérico é onde as regras de honestidade da escrita são IMPOSTAS

**Data**: 2026-07-10 (T019/T022) · **atualizado** 2026-08-28 (019/PR-B, T044/T045) · **Governa**:
`catalog-panel.tsx`

O painel possui a apresentação de lista/vazio/carregando/erro/offline, mais a Sheet de criar-editar e
o Dialog de confirmar exclusão; o que é específico da entidade (formulário, textos de linha,
mapeamento de fio) entra por prop.

**As regras de honestidade são impostas AQUI**: toast de sucesso dispara SÓ depois de um 2xx real; uma
escrita que falha mantém a Sheet aberta com uma linha específica e honesta ([[DEC-061]]) e **nunca
finge um salvamento**.

**019/PR-B — "Premium sem parede"**: quem não paga não encontra mais uma parede. O corpo troca a coroa
e o vazio curto pelo VAZIO DIDÁTICO ([[DEC-046]]) sempre que `gate !== "active"`, e "Adicionar" abre o
MESMO formulário — inerte (`<Frozen>`, e **a barreira é a AUSÊNCIA do handler de submit**, nunca um
segundo portão no cliente; Constituição IV intocada). A faixa "Premium pausado" saiu: o rodapé do
formulário inerte já explica.

### Onde isso vive no código

- `apps/web/src/features/catalog/catalog-panel.tsx` → `CatalogPanel`

---

## DEC-071 — O card do Histórico é uma LINHA DE LIVRO-RAZÃO, e o layout é quem impõe isso

**Data**: 2026-07-12 (009/T013, E4 PR-A, US2 · FR-523/FR-524) · **Governa**: `historico-page.tsx`

O card **não é um preço**, e não é a cópia que garante isso — é o layout:

- **a DATA fica estruturalmente ACIMA do dinheiro** (FR-523): não dá para bater o olho no card e ler
  preço vivo, porque a primeira coisa sob o rótulo é quando aquilo foi cotado;
- o dinheiro é **"Valor cotado"**, nunca "Preço" — *preço* é o que a calculadora diz HOJE;
- a base vem escrita embaixo (um total sem rótulo é afirmação ambígua — [[DEC-013]]);
- sem `PriceHero`, sem tratamento de vivo, sem cor que leia como "atual".

**A lista vem de UM seletor** (servidor ∪ outbox, servidor vence). Nenhum componente aqui pode ler a
query do servidor sozinha — um registro na fila que a lista não mostrasse deixaria o vendedor
acreditando que o orçamento nunca foi feito.

### Onde isso vive no código

- `apps/web/src/pages/historico/historico-page.tsx` → `HistoricoPage`

---

## DEC-072 — O campo de horas ganha rascunho local, e só enquanto o texto tem separador

**Data**: 2026-08-15 (review do PR #58) · **Governa**: `campo-de-horas.tsx`

O achado: `2:30` funcionava COLADO e não funcionava DIGITADO. A causa é o campo ser controlado por
`String(h)` — ao teclar `0`, depois `:`, o texto `"0:"` não casa como relógio, cai no `parseInt` que
devolve 0, o React re-renderiza com `"0"` e **o `:` que a pessoa acabou de digitar some**. Continuando,
`"30"` vira **30 horas** — 60× o que ela quis dizer, calado ([[DEC-020]]).

O conserto é dar um rascunho local ao campo **enquanto o texto contém um separador**: nesse estado ele
NÃO commita nada e deixa a pessoa terminar de escrever. Assim que o relógio fecha (`0:30`), commita e
devolve o controle ao valor derivado. No blur, um rascunho que nunca fechou cai no `parseInt` de
sempre — **nada fica preso num estado que o motor não conhece**.

Esta é a única parte do campo com estado próprio, e ela existe só para os caracteres intermediários.

### Onde isso vive no código

- `apps/web/src/features/calculator/form-atoms/campo-de-horas.tsx` → `CampoDeHoras`

---

## DEC-073 — O rótulo nomeia o DADO, não a execução: só se move quando o conteúdo mudou

**Data**: 2026-07-31 (014, revisão final adversarial) · **Governa**: `nextCatalogVersion`

A próxima `catalogVersion` ("YYYY-MM-DD.n") é a data da LEITURA mais uma sequência dentro dela.

O `build-amazon.mjs` cravava `${collectedAt}.0`, então **regerar na mesma data de coleta reescrevia
conteúdo DIFERENTE sob rótulo IDÊNTICO**. Foi o que aconteceu: o artefato foi de 77 para 79 entradas
com `catalogVersion` parado em `2026-07-28.0`.

**Isso não é higiene de versionamento.** O rótulo é congelado dentro do payload que o ADR-0019 torna
IMUTÁVEL. Dois registros dizendo o mesmo nome descreviam tabelas diferentes, e a pergunta que o campo
existe para responder — QUAL tabela produziu este número — deixava de ter resposta, **sem conserto
posterior possível, porque o registro não pode ser reescrito**.

Duas regras, e a segunda é a que evita ruído: a sequência é INTEIRA (a mesma armadilha que o
`freshest` pagou — texto faria ".9" perder para ".10"), e o rótulo **só se move quando o CONTEÚDO
mudou**. Reler a mesma tabela não a torna uma tabela nova. Mesma família do [[DEC-004]].

### Onde isso vive no código

- `packages/fee-ingest/src/guardrails.ts` → `nextCatalogVersion`

---

## DEC-074 — A folha de moeda reabre com a MESMA máscara, e a precisão vem por parâmetro

**Data**: 2026-08-07 (016/T072-R5) · **corrigido** 2026-08-28 (019/PR-C, T060) · **Governa**: o
sentido REABRIR do `scenario-bridge`

Uma folha de MOEDA recebe a MESMA máscara de milhar pt-BR que o `NumberField` aplica no blur
(`"12345.00"` → `"12.345,00"`), em vez da troca simples ponto→vírgula. MEDIDO: reabrir um cenário
salvo escrevia a string crua sem agrupamento direto no formulário, então um valor ≥1000 renderizava
`"12345,00"` na reabertura — mascarado em todo lugar, sem máscara ali. O round-trip passa pelas
funções exatas que a própria máscara usa ([[DEC-002]]), nunca por um novo arredondamento: a string do
fio já carrega a precisão real do campo.

> **E a correção do R5 reintroduziu um corte diferente.** O `formatDecimal(n, 2)` dele estava
> CRAVADO, então re-truncava qualquer folha com mais de 2 casas reais — e a tarifa (R$/kWh) é o único
> campo de moeda com 4 (FR-1912/SC-1905): um `"0,8734"` salvo reabria como `"0,87"`. **Um corte
> silencioso reintroduzido pelo conserto feito para acabar com OUTRO corte** (a falta do separador de
> milhar). Hoje a `precision` vem por parâmetro e o padrão continua 2.

### Onde isso vive no código

- `apps/web/src/features/calculator/scenario-bridge.ts` → `precision`


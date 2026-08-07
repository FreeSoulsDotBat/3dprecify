# Hotfix A2 + A3 — desenho (arquiteto, 2026-08-07)

**Origem**: achados A2 (ALTA) e A3 (MÉDIA/ALTA) do T072, `specs/016-correcao-homologacao/dod-evidence.md`
§Polish. Decisão do dono: hotfix ANTES da PR-A do 017. Branch: `hotfix-016-a2-a3`.
**Este documento é desenho — nenhuma linha de código foi escrita.**

---

## 1. Os verbatins que decidem

Fonte primária: **Shopee, Centro de Educação do Vendedor, art. 26839** ("Confira a Política de Comissão
para vendedores CNPJ e CPF para 2026", datado 04-02-2026), extraído VERBATIM em 2026-08-06 —
7.452 chars, arquivo íntegro em
`C:/Users/Jonatan/AppData/Local/Temp/claude/D--projects-3dprecify/322762d1-4794-4ec3-98c1-ef01094a65fb/scratchpad/art26839.txt`.
É a MESMA fonte que o catálogo cita hoje (`sourceUrl` das duas entradas Shopee).

Os quatro trechos que decidem — literais, na ordem em que aparecem:

> **V1** (nota de rodapé, linha 162): "** A Shopee **oferece subsídios de frete para todos os vendedores**
> nos valores de R$20 para itens de até R$79,99, R$30 para itens de R$80 a R$199,99 e R$40 para itens
> acima de R$200."

> **V2** (seção "Programa Frete Grátis para todos", linha 139): "**Todos os vendedores têm os benefícios
> do Programa de Frete Grátis**, ampliando a atratividade dos seus produtos e disponibilizando cupons
> para todos os compradores."

> **V3** (seção "Programa de Frete Grátis", linhas 211–218): "Todos os vendedores têm os benefícios do
> Programa de Frete Grátis. **A Shopee também oferece subsídios de frete.** Confira como funciona:
> Para itens de até R$79,99: **Cupons de frete grátis válidos para fretes de até R$20**; Para itens de
> R$80 a R$199,99: Cupons de frete grátis válidos para fretes de até R$30; Para itens acima de R$200:
> Cupons de frete grátis válidos para fretes de até R$40."

> **V4** (última seção, linha 233): "**Política válida apenas para vendedores que utilizam o modelo
> logístico Intelipost ou outras ferramentas através da API de Frete**: em março de 2026, a política
> de **coparticipação** foi alterada. Veja em detalhes como funciona, clicando aqui."

### O que os verbatins respondem

**(a) O vendedor co-participa do custo do cupom?**
**A fonte diz o contrário do que o modelo 005 assume.** Em V1 e V3 o SUJEITO da frase é a Shopee: ela
*oferece* o subsídio, e o R$ 20/30/40 é o valor que ELA oferece. Em V3 o número é qualificado como
"cupons **válidos para fretes de até** R$20" — é o TETO DE VALIDADE do cupom, não uma cobrança.
A palavra "coparticipação" aparece **uma única vez** no artigo (V4) e vem **escopada**: "política
válida apenas para vendedores que utilizam o modelo logístico Intelipost ou outras ferramentas
através da API de Frete". Para o vendedor comum — que é o vendedor do produto — o artigo não
publica nenhuma coparticipação, e o valor da coparticipação dos vendedores de API **não está neste
artigo** (ele linka para fora).

**(b) O Programa é opt-in (atributo do vendedor, como o volumoso)?**
**Não. É universal.** V2 e V3 dizem duas vezes "**todos** os vendedores têm os benefícios do Programa
de Frete Grátis". Não há adesão a modelar. Um interruptor "participo do Programa" seria uma pergunta
que a fonte já respondeu por todos — e responderia errado para quem desmarcasse.

**(c) Se há custo para o vendedor, ele é o teto integral, o frete real limitado ao teto, ou um percentual?**
**NÃO-DETERMINADO pelas fontes lidas.** O artigo 26839 não afirma que o excedente acima do teto é do
vendedor, não dá percentual e não dá fórmula. Preencher isso seria inferência sobre dinheiro
(Constituição II + Princípio VIII).

### O que fecharia a questão (nomeado, não adivinhado)

1. **art. 23431 — "Programa de Frete Grátis"** (o "Próximo:" do próprio 26839), verbatim.
2. **O artigo de coparticipação linkado em V4** (o "clicando aqui" da seção Intelipost/API de Frete) —
   é o único lugar onde o artigo admite que existe rateio, e é onde o número dele mora.
3. **art. 7749 — "Dúvidas frequentes sobre comissão e frete grátis extra"** (indexado, não lido).
4. **art. 4478 — "Como funciona a cobrança adicional de frete?"** — é uma cobrança **diferente**
   (divergência de peso/dimensão aferida), já coberta pelo aviso US17 `measuredFreightWarning`.
   Não confundir com o cupom.

**Fronteira honesta desta leitura**: eu **não consegui extrair** 1–4. O `seller.shopee.com.br/edu`
é SPA e o WebFetch devolve apenas a casca ("Seller Education Hub") — medido em 3 tentativas, incluindo
o espelho `seller.br.shopee.cn`. Preciso do caminho headless (o padrão do 016: esperar por conteúdo,
nunca `networkidle`) para os quatro. Fontes de terceiros (blogs de agência/ERP) convergem para
"o vendedor paga só o EXCEDENTE acima do teto" e "coparticipação de 25%, máx. R$ 10, só para
vendedores de API", **mas divergem entre si** (uma delas fala em "3 a 12 p.p. da venda") e **não são
fonte de registro** — não servem para escrever número de dinheiro na tela.

---

## 2. Veredito do modelo

### O BAND_VOUCHER do 005 está ERRADO — em semântica, não em precisão. Confiança **92%**.

O que o produto faz hoje (`packages/pricing-core/src/channels.ts`, `grossUp.finish`, e o dado em
`backend/app/data/catalog.json` + `apps/web/src/shared/fee-catalog/seed.ts`): resolve a banda do
anúncio e **desconta o `voucherCeiling` inteiro** do líquido, nas duas entradas Shopee, sempre.

Três coisas erradas empilhadas, em ordem de gravidade:

1. **Cobra do vendedor um número que a fonte atribui à Shopee** (V1/V3). Medido no T072, semente:
   varejo 24,24 → anúncio 35,30 → **líquido 4,24** (−82,5% da margem). Com o volumoso de R$ 50
   ligado, **líquido −5,76**. Um vendedor que confie nessa tela recusa a Shopee por uma conta que
   não existe.
2. **Trata TETO como CERTO e INTEGRAL.** Mesmo na hipótese (não publicada) de existir custo para o
   vendedor, "cupom válido para fretes de até R$ 20" é um limite superior; cobrá-lo cheio é o pior
   caso apresentado como o caso.
3. **Desconta sem controle na tela que o nomeie.** O campo "Frete (opcional)" — que está nos
   `feeAxes` da Shopee e portanto RENDERIZA — exibe R$ 0,00 enquanto R$ 20,00 saem do líquido.
   Isso **já viola a FR-111b do 005**, textual: *"o vendedor MUST see and be able to override the
   resulting `freightCost`"*. Não é uma lacuna de UX descoberta agora; é um requisito escrito em
   2026-07-06 que nunca foi cumprido para a Shopee. O mecanismo 015/A8 (`appliedFees`, o
   placeholder de referência num campo em branco) existe e cobre `freightCost` — o voucher escapa
   dele porque não viaja como `freightCost`, viaja como `freightVoucherBands`.

**A correção é de DADO, com uma extensão ADITIVA de informação. Não é de semântica do motor e não é
de estado.** As três dimensões, explicitamente:

| dimensão | decisão | porquê |
| --- | --- | --- |
| **DADO** | as duas entradas Shopee passam de `freight: {kind:"BAND_VOUCHER", …}` para **`freight: {kind:"NONE"}`**, + bump de `catalogVersion` | remove um desconto fabricado; `NONE` afirma exatamente o que sabemos ("não publicamos custo de frete aqui") |
| **SEMÂNTICA** | **NÃO mudar** o que o motor faz com `voucherCeiling` | `freightVoucherBands` viaja DENTRO de snapshot congelado (ADR-0019, imutável por trigger) e de documento de cenário (ADR-0021). Redefinir a leitura faria um congelado — que o produto promete imutável — passar a afirmar outro número sem uma linha dele mudar. É o risco que os docstrings de `bandMode` (ADR-0024) e `fixedFeeRule` (ADR-0027) já nomeiam. O motor MANTÉM a capacidade, marcada **DEPRECATED**; o catálogo deixa de emiti-la |
| **ESTADO** | **NÃO virar opt-in** | V2/V3: "todos os vendedores têm os benefícios". Um interruptor de adesão mentiria sobre a participação — e ainda descontaria um número não publicado |

**Consequências assumidas, ditas antes de acontecerem:**
- **Cenários salvos (ADR-0021, resolve-live) com base Shopee vão reprecificar**: o líquido SOBE
  20/30/40. É a correção chegando, e é exatamente a mesma forma que a US8 do 014 homologou por
  MUTAÇÃO — deve ser homologada assim (um cenário Shopee salvo reprecifica 4,24 → 24,24).
- **Orçamentos congelados (ADR-0019) NÃO mudam** e não devem mudar: eles registram o que foi cotado
  naquele dia. O caminho do vendedor é "Recalcular hoje". O produto não reescreve história.
- **`pricing-core` fica em 4.1.0 e `PRICING_MODEL_VERSION` NÃO é bumpado** — não há mudança de
  código do motor. Só `catalogVersion` bumpa. Isto é deliberado e é o que mantém todo congelado
  byte-idêntico.
- **Dívida colateral a corrigir na mesma fatia**: o comentário do seam 013/E1-02 em
  `apps/web/src/features/calculator/calculator-model.ts` (≈ linhas 192–201) justifica a preservação
  do voucher no override dizendo que perdê-lo "overstated the recebido líquido". Com o veredito, a
  frase vira **falsa** — e comentário falso em seam de dinheiro é a dívida que o próximo dev acredita.
  A regra do merge seletivo continua certa para `priceBands`; só a justificativa do voucher muda.

### Alternativas rejeitadas

| # | alternativa | por que foi rejeitada | confiança na rejeição |
| --- | --- | --- | --- |
| R1 | **Virar sobretaxa opcional** (como `MANUSEIO_VOLUMOSO`): checkbox "Programa de Frete Grátis" | contradiz V2/V3 (o programa é universal — não há adesão). E o valor cobrado continuaria sendo um número que ninguém publicou: trocaria uma mentira automática por uma mentira consentida | 88% |
| R2 | **Mudar a semântica do motor**: `voucherCeiling` passa a significar teto sobre o frete DECLARADO (descontar `max(0, freteDeclarado − teto)` ou `min(freteDeclarado, teto)`) | duas razões independentes, cada uma suficiente: (i) muda o significado de uma folha que viaja dentro de payload congelado; (ii) a regra do excedente **não está na fonte** — seria inferência sobre dinheiro (Princípio VIII). É a forma mais provável de estar certa NO FUTURO, e é exatamente por isso que ela precisa do verbatim de art. 23431 antes, não depois | 85% |
| R3 | **Zerar os tetos** (`voucherCeiling: 0`) mantendo o `BAND_VOUCHER` | o número passa a afirmar "o teto é zero", que também é falso, e deixa a armadilha armada: a próxima curadoria preenche o campo que já existe e o defeito volta sem ninguém decidir nada. `kind: "NONE"` diz a verdade e some com o campo | 90% |
| R4 | **Deixar como está e só avisar** (um aviso "este desconto é uma estimativa de pior caso") | um aviso não conserta uma conta. O produto continuaria publicando líquido 4,24 sobre 24,24 — e a US17 já ensinou que aviso permanente vira ruído (A5 do T070) | 95% |

### A informação NÃO se perde — ela muda de lugar

O subsídio é real e é **boa notícia** para o vendedor. Apagá-lo em silêncio perde informação que ele
usa para decidir. Então o teto migra de **aritmética** para **informação**:

- Campo **aditivo, `nullish`, NÃO-COMPUTANTE** no catálogo, no nível do MARKETPLACE (precedente:
  `optionalSurcharges`, que também não é por determinante nem por faixa de tarifa) — nome proposto
  **`freightSubsidyInfo`**: `{ bands: [{minPrice, maxPrice, ceiling}], source, sourceUrl,
  effectiveDate, lastReviewed }`.
- **Por que campo novo e NÃO um `kind: "SUBSIDY_INFO"` no union `freight`**: `freightSchema` é um
  `z.discriminatedUnion`. Um `kind` novo no artefato SERVIDO faria o cliente PWA já instalado
  **recusar o catálogo inteiro** — e a recusa aqui é **silenciosa** (cai no seed embutido, ninguém vê
  erro; o próprio arquivo documenta essa armadilha duas vezes). Já uma propriedade extra num
  `z.object` não-strict é **descartada** pelo cliente antigo, que então lê exatamente
  `freight: {kind:"NONE"}` — a nova verdade. Compatibilidade por construção, não por sorte.
- Renderização: legenda + ⓘ sob o campo "Frete", **com zero número no código** (todo valor e rótulo
  vêm do dado — Constituição II), no formato: *"A Shopee subsidia o frete deste anúncio (cupom
  válido para fretes de até R$ {teto} na faixa do seu preço). Informe aqui só o que sobrar para
  você."* Texto final é do `designer-ux`; a FORMA (não-computante, dirigida por dado, com
  procedência) é a decisão arquitetural.

---

## 3. O display — como o desconto passa a se nomear

**A regra, generalizada da PR-E e já exigida pela FR-111b**: *nenhum valor entra na conta sem um
controle na tela que o nomeie e que o vendedor possa mudar.* "Declarado OU com valor" — ou o número
está num campo (digitado ou pré-preenchido sob selo), ou ele não existe.

Formas:

1. **O campo "Frete" da Shopee passa a ser a ÚNICA origem de desconto de frete.** Vazio ⇒ nenhuma
   linha, nenhum desconto. Digitado ⇒ uma linha, com aquele valor. Um controle, um número, uma linha.
2. **O rótulo da linha perde o "/ cupom"**: `channels.freightLine` "Frete / cupom" → **"Frete"**.
   Nada com forma de cupom é descontado; a linha passa a nomear o controle de onde o número saiu.
3. **O ML continua conforme** e vira o exemplo positivo da regra: o `ESTIMATE.defaultSubsidy` chega
   ao campo pelo mecanismo 015/A8 (`appliedFees.freightCost`) e leva selo "estimativa" — número
   visível, sobrescrevível, selado. **Tarefa de MEDIÇÃO no hotfix** (não afirmação): confirmar na tela
   que o placeholder do ML mostra os R$ 10 que o motor desconta. Se não mostrar, é a mesma violação
   e o mesmo conserto.
4. **A guarda estrutural** — o que transforma a regra em propriedade e não em promessa: uma varredura
   sobre o catálogo **servido de verdade** (o padrão do T073) afirmando que, para toda entrada de todo
   marketplace, `grossUp(base, entryToChannelFees(entrada)).freightCost === (fees.freightCost ?? 0)`.
   Fica vermelha no instante em que qualquer curadoria futura reintroduzir um desconto sem campo.

---

## 4. A3 — sessão expirada (o mínimo honesto)

Dois defeitos independentes, um diagnóstico só. **Não é redesenho de autenticação.**

**Medido no código**: `entities/history/outbox.ts` → `settleEntry` classifica `403 → blocked`,
`422 → failed` e **todo o resto → `pending`**. Um **401 cai no `pending`**, e a cópia do `pending`
promete rede: *"Sincroniza sozinho quando houver conexão."* — com a conexão intacta. É uma frase falsa
sobre um registro que é a ÚNICA cópia da cotação do vendedor. E `router.tsx` só redireciona para
`/sign-in` quando a sessão do **cliente** (Firebase) cai; um 401 do **servidor** com sessão de cliente
viva não move nenhuma tela — daí "nenhuma tela oferece caminho de volta".

### Forma escolhida

**(i) O outbox ganha um estado que diz a verdade.** `SyncState` passa a ter
`"unauthenticated"` (rótulo do vendedor: **sessão expirada**): `settleEntry` mapeia `status === 401`
para ele, **nunca** para `pending`. Comportamento: **não** é re-tentado sozinho (como `blocked` —
tentar sem sessão nunca dá certo), **é** re-tentado quando a sessão volta (espelho exato do
`retryBlocked`, que já existe para o Premium voltar), e **nunca** é apagado.
Cópia (final é do `designer-ux`): banner *"{n} registro(s) não foram enviados: sua sessão expirou."* +
ação **"Entrar de novo"**. A palavra "conexão" não aparece.

**(ii) O caminho de volta usa o mecanismo que JÁ existe e já é provado.** `router.tsx` tem
`safeRedirect` + `requireAuth` com return-to-intent por `location.href` — o mesmo caminho que o E6
usa para o retorno do checkout. O 401 não precisa de rota nova: precisa de um botão que navegue para
`/sign-in?redirect={location.href}`. Forma: um store mínimo (`shared/session/session-expiry.ts`)
que o transporte (`shared/api/transport.ts`, o ponto único por onde TODA requisição passa) marca ao
ver `401` com `code ∈ {UNAUTHENTICATED, TOKEN_EXPIRED}` (os dois já existem no enum gerado), e um
banner no `app-shell` com o botão. Limpo quando qualquer requisição volta a ter sucesso ou quando o
`session-store` vira `authenticated`.

**(iii) A propriedade NÃO-NEGOCIÁVEL desta fatia: um 401 NUNCA chama `requestSignOut` / `purgeOutbox`.**
Sign-out purga o outbox uid-keyed (é o que o `SignOutOutboxGuard` existe para negociar). Um
"deslogar automaticamente no 401" — a solução de reflexo — **apagaria a única cópia das cotações não
sincronizadas** e trocaria um achado MÉDIO por perda de dado do vendedor. Sessão expirada **não é**
sign-out: os dados locais ficam, o banner convida, o vendedor decide. Entrar de novo com o mesmo uid
reencontra a mesma fila (a chave é `history:outbox:{uid}`).

**Alternativas rejeitadas**: (α) sign-out automático no 401 — destrói o outbox, ver acima
(rejeição 96%); (β) redirect duro para `/sign-in` no 401 — arranca o vendedor da tela no meio de um
cálculo não salvo e perde a intenção quando o 401 vem de uma query de fundo (rejeição 85%);
(γ) só consertar a cópia do outbox, sem caminho de volta — deixa o achado principal ("nenhuma tela
oferece caminho de volta") vivo (rejeição 90%).

**Fronteira honesta**: o T072 mediu com **401 simulado no transporte**; a expiração REAL do refresh
do Firebase não foi exercida. O desenho acima não depende disso (o gatilho é o 401 do servidor,
qualquer que seja a causa), mas a homologação deve dizer qual dos dois exercitou.

---

## 5. Clarification datada — pronta para colar na spec 005

> ### Clarification 2026-08-07 — o frete Shopee do FR-111a estava invertido (achado A2, 016/T072)
>
> **O que se mediu.** Canal Shopee, semente varejo R$ 24,24: anúncio R$ 35,30, linha "Frete / cupom
> −R$ 20,00", **líquido R$ 4,24**, com o campo "Frete (opcional)" exibindo **R$ 0,00**; com o
> manuseio de item volumoso ligado, o líquido fica **negativo (−R$ 5,76)**.
>
> **O que a fonte diz.** Art. 26839 (a MESMA fonte que o catálogo já cita), verbatim:
> "*A Shopee **oferece subsídios de frete para todos os vendedores** nos valores de R$20 … R$30 …
> R$40*" e "*Cupons de frete grátis **válidos para fretes de até** R$20*". O R$ 20/30/40 é o valor
> que **a Shopee oferece** e é um **teto de validade do cupom** — não uma cobrança do vendedor.
> A palavra "coparticipação" aparece uma única vez no artigo e vem escopada a "*vendedores que
> utilizam o modelo logístico Intelipost ou outras ferramentas através da API de Frete*", sem os
> números, que ficam em artigo linkado.
>
> **Correção da FR-111a.** A cláusula "**Shopee** — the seller-co-funded free-shipping **voucher
> ceiling** by price band (curatable from the official source)" **é revogada**: ela atribuía ao
> vendedor um custo que a fonte atribui à Shopee, e cobrava um **teto** como **certo e integral**.
> Passa a valer: **Shopee — `freightCost = 0` por padrão**; o único frete descontado do líquido é o
> que o vendedor **declara** no campo de frete do canal. O subsídio da Shopee é publicado como
> **informação não-computante** (com procedência e data), nunca como parcela da conta.
>
> **NÃO-DETERMINADO, e deliberadamente não preenchido.** Se existe custo para o vendedor quando o
> frete real excede o teto — e, se existe, se ele é o excedente, um percentual ou uma coparticipação —
> **as fontes lidas não respondem**. Fecha-se com o verbatim de: art. 23431 ("Programa de Frete
> Grátis"), o artigo de coparticipação linkado na seção Intelipost/API de Frete do 26839, e art. 7749.
> Até lá o produto não desconta nada que o vendedor não tenha digitado. (Art. 4478, "cobrança
> adicional de frete", é outra cobrança — divergência de peso/dimensão — e já está coberta pelo aviso
> permanente da US17.)
>
> **FR-111b passa a ser verificável, não só declarada.** "O vendedor DEVE ver e poder sobrescrever o
> `freightCost` resultante" estava sendo violado pela Shopee desde E1: o valor descontado não tinha
> controle na tela. Regra reafirmada e sob guarda automática: **nenhum valor entra na conta sem um
> controle que o nomeie** — para toda entrada de todo marketplace do catálogo servido,
> `grossUp(base, fees).freightCost === (fees.freightCost ?? 0)`.
>
> **Compatibilidade.** Correção **de dado** (`freight: {kind:"NONE"}` nas duas entradas Shopee +
> bump de `catalogVersion`). O motor **não muda**: `freightVoucherBands` continua sendo honrado
> exatamente como antes para payloads já gravados (fica **DEPRECATED**, sem novos emissores), porque
> ele viaja dentro de snapshot congelado (ADR-0019) e de documento de cenário (ADR-0021).
> `pricing-core` permanece **4.1.0** e `PRICING_MODEL_VERSION` **não é bumpado**. Orçamentos
> congelados **não mudam** (registram o que foi cotado); cenários salvos com base Shopee
> **reprecificam para cima**, e isso é a correção chegando.

*(Registrar a mesma Clarification, em uma linha com ponteiro para cá, em
`specs/016-correcao-homologacao/spec.md` §Clarifications e no `docs/decisions/`.)*

---

## 6. Tarefas do hotfix (test-first, com os testes nomeados)

Ordem load-bearing: **H0 antes de tudo** (a fonte decide a forma); **H1 antes de H3** (o dado errado
sai antes de o dado novo entrar); **H4/H5 são independentes** e podem correr em paralelo.

| # | tarefa | teste que fica VERMELHO primeiro |
| --- | --- | --- |
| **H0** | **Extrair VERBATIM art. 23431 + o artigo de coparticipação linkado em V4 + art. 7749** (headless, padrão 016: esperar por conteúdo, nunca `networkidle`). Anexar ao dod-evidence. **Se qualquer um contradisser §2, o desenho volta ao dono ANTES de H1** | — (é medição; o entregável é o texto literal) |
| **H1** | **DADO**: as duas entradas Shopee → `freight: {kind:"NONE"}` em `backend/app/data/catalog.json` **e** `apps/web/src/shared/fee-catalog/seed.ts`; bump de `catalogVersion` | `apps/web/src/shared/fee-catalog/freight-declared.test.ts` — (a) "nenhuma entrada SERVIDA declara `freight.kind === 'BAND_VOUCHER'`" (varredura sobre catálogo servido **e** seed, padrão T073); (b) a propriedade geral: `grossUp(base, entryToChannelFees(e)).freightCost === (fees.freightCost ?? 0)` para toda entrada de todo marketplace |
| **H1b** | **Motor intocado, capacidade DEPRECATED**: docstring de `VoucherBand`/`freightVoucherBands` marca deprecação + a razão (payloads gravados) | `packages/pricing-core/tests/voucher-legacy-payload.test.ts` — "um payload GRAVADO com `freightVoucherBands` continua produzindo o mesmo líquido de antes" (byte-idêntico; é o contrato dos congelados) |
| **H1c** | **Re-apontar os testes que hoje afirmam o desconto** (`calculator-model.test.ts` ≈ 316/346/351/385; `channels.test.ts`; `band-floor.test.ts`): passam a testar o caminho LEGADO por fixture, não o catálogo Shopee | os próprios, reescritos (devem falhar antes do reaponte) |
| **H2** | **DISPLAY**: `channels.freightLine` "Frete / cupom" → "Frete"; correção do comentário falso do seam 013/E1-02 em `calculator-model.ts` | `apps/web/src/features/calculator/freight-line-names-its-control.test.tsx` — slot Shopee com o seed REAL: (a) campo vazio ⇒ **nenhuma** linha de frete e líquido == base; (b) digitar 12,00 ⇒ **exatamente uma** linha de −12,00; (c) valor da linha === valor do campo |
| **H2b** | **e2e**: a semente na Shopee | `apps/web/tests/e2e/calculator.spec.ts` — "Shopee, valores da semente: líquido == 24,24 e nenhuma linha de frete"; e com o volumoso ligado o líquido **não** fica negativo |
| **H2c** | **MEDIR** (não afirmar) se o placeholder do ML mostra os R$ 10 que o motor desconta | screenshot + leitura de geometria; vira tarefa só se falhar |
| **H3** | **INFORMAÇÃO**: `freightSubsidyInfo` aditivo `nullish` no nível do marketplace (bands + procedência) + legenda/ⓘ sob o campo Frete, **zero número no código** | `apps/web/src/shared/fee-catalog/fee-catalog.test.ts` — (a) catálogo SEM o campo parseia idêntico (compatibilidade retroativa); (b) catálogo COM o campo **não muda nenhum número computado** (mesmo `PriceResult` antes/depois); (c) guarda i18n: nenhuma string de mensagem contém "20"/"30"/"40" de subsídio |
| **H4** | **A3 outbox**: `SyncState` ganha `"unauthenticated"`; `settleEntry` mapeia `401` → ele; nunca auto-retry; retry quando a sessão volta (espelho do `retryBlocked`) | `apps/web/src/entities/history/outbox.test.ts` — (a) "um 401 no envio NÃO vira `pending`"; (b) "um 401 NUNCA remove a entrada"; (c) "um 401 não é re-tentado sozinho, e É re-tentado quando a sessão volta" |
| **H4b** | **A3 cópia**: banner/badge do estado novo, sem a palavra "conexão"; ação "Entrar de novo" | `apps/web/src/pages/historico/historico-page.test.tsx` — com uma entrada travada em 401: o banner **não** contém "conexão"/"online" **e** oferece caminho para `/sign-in` |
| **H5** | **A3 caminho de volta**: `shared/session/session-expiry.ts` marcado pelo `transport.ts` em `401 ∧ code ∈ {UNAUTHENTICATED, TOKEN_EXPIRED}`; banner no `app-shell` → `/sign-in?redirect={location.href}`; limpo no primeiro sucesso ou quando o `session-store` vira `authenticated` | `apps/web/src/shared/session/session-expiry.test.ts` — (a) **"um 401 NÃO chama `requestSignOut` nem `purgeOutbox`"** (spy: 0 chamadas) — é a propriedade não-negociável; (b) "o botão leva a `/sign-in` preservando `location.href`"; (c) "o marcador some quando a sessão volta" |
| **H6** | **Docs**: Clarification §5 na spec 005 + linha na spec 016 + `docs/decisions/`; linha no `docs/token-ledger.md`; dod-evidence do hotfix com os verbatins de H0 | — |
| **H7** | **Homologação por MUTAÇÃO** (o padrão que a US8 do 014 estabeleceu): um cenário Shopee salvo ANTES do hotfix reprecifica 4,24 → 24,24 com a intenção intacta; um Orçamento congelado NÃO muda | roteiro no dod-evidence + screenshots |

**Gate**: `pnpm gate:all` + e2e. **`catalogVersion` bumpado** (a lição do 014/PR-A: 77→79 entradas sem
bump foi o único bloqueador daquele merge) — aqui a mudança é de dado de dinheiro em duas entradas.

---

## 7. Confianças

| afirmação | confiança |
| --- | --- |
| Cobrar o `voucherCeiling` cheio do vendedor **não é suportado pela fonte** e deve sair | **92%** |
| O Programa é **universal**, não opt-in (V2/V3, duas vezes literais) | **95%** |
| O custo real do vendedor (se houver) é **não-determinado** pelas fontes lidas | **90%** |
| A forma escolhida (dado → `NONE` + info aditiva + regra de display sob guarda) é a certa AGORA | **88%** |
| A forma do A3 (estado novo + banner não-destrutivo, sem sign-out automático) | **85%** |
| R2 (semântica de excedente) é a forma provavelmente certa **no futuro**, depois de H0 | **70%** |

**Fontes**: art. 26839 verbatim (scratchpad, 2026-08-06) · `specs/016-correcao-homologacao/dod-evidence.md`
§Polish (T072) · `specs/005-marketplace-multichannel/spec.md` FR-111a/FR-111b ·
`packages/pricing-core/src/channels.ts` · `backend/app/data/catalog.json` ·
`apps/web/src/shared/fee-catalog/{fee-catalog.ts,seed.ts}` ·
`apps/web/src/features/calculator/{fee-prefill.ts,calculator-model.ts,calculator-form.tsx}` ·
`apps/web/src/entities/history/outbox.ts` · `apps/web/src/shared/api/transport.ts` ·
`apps/web/src/app/router.tsx`.


---

## H0 — EXECUTADA (2026-08-07, coordenador, navegador headless)

**art. 23431 (Programa de Frete Grátis) — 3.708 chars, verbatims decisivos:**
- *"Todos os vendedores têm os benefícios do Programa de Frete Grátis. A Shopee também oferece
  subsídios de frete."* — universal, e o sujeito que oferece é a SHOPEE.
- *"Para itens de até R$79,99: Cupons de frete grátis válidos para fretes de até R$20; … R$30; …
  R$40."* — os valores são TETOS DE VALIDADE DO CUPOM (da Shopee), não cobrança.
- **ZERO ocorrências** de "excedente", "teto" (como custo), "vendedor paga", "desconta", "custo do
  frete" — o artigo nunca atribui custo do programa ao vendedor.
- Coparticipação: UMA menção, escopada — *"Se você utiliza o modelo logístico Intelipost ou outras
  ferramentas através da API de Frete, confira como funciona a coparticipação aqui."* — nicho fora
  do modelo do produto.

**art. 7749**: NÃO CARREGOU (timeout de conteúdo — possivelmente movido/removido). Registrado como
não-lido; NÃO bloqueia: 23431 + 26839 fecham a questão para o caminho padrão.

**VEREDITO H0: os verbatims NÃO contradizem o desenho — o fortalecem.** O BAND_VOUCHER do 005
cobra do vendedor o que a fonte atribui à Shopee. As tarefas H1+ estão liberadas. O excedente
acima do teto e a coparticipação API-de-Frete permanecem NÃO-DETERMINADOS (nunca preencher).


---

## FECHAMENTO DO HOTFIX (2026-08-07) — o recibo

**Implementado em `hotfix-016-a2-a3`**, duas metades + homologação:
- **Dado (opus)**: Shopee `freight: NONE` (o verbatim manda: o subsídio é da Shopee, universal);
  `freightSubsidyInfo` aditivo não-computante com procedência do art. 23431; BAND_VOUCHER
  DEPRECATED sem emissores (congelados continuam legíveis — teste de payload legado);
  `catalogVersion 2026-08-07.0`; guarda estrutural `freight-declared.test.ts` com prova de mutação;
  FR-111a REVOGADA in-place + Clarification datada na spec 005. **O número: o líquido da semente
  Shopee foi de R$ 4,24 para R$ 24,24** (os R$ 20 que a Shopee paga e o 005 cobrava do vendedor);
  o líquido negativo com volumoso (−5,76) morreu. Nenhum ANÚNCIO mudou (frete nunca foi
  gross-upado).
- **UI + A3 (frontend)**: rótulo "Frete" (FR-111b cumprida — só campo digitado desconta); legenda
  do subsídio dirigida pelo catálogo (zero número no código); outbox com estado `unauthenticated`
  (401 NUNCA purga — propriedade provada por spy); banner "Entrar de novo" preservando o retorno.
- **Homologação (qa): PASS 93%, 43 screenshots, 0 bloqueadores** — a MUTAÇÃO provada de verdade
  (catálogo antigo interceptado: 4,24; catálogo novo: 24,24; intenção intacta; o congelado com
  SHA-256 IDÊNTICO antes/depois — o produto não reescreve história). H2c medido: o ML não
  desconta nada que não venha de campo visível (e a medição precisa ser refeita quando o US6-ML
  popular o ML). **Armadilha nova documentada pelo qa: a SEMENTE responde a primeira pintura —
  uma mutação de catálogo servido só é real depois de esperar o valor MUTADO.**
- **Ressalvas R1–R4 corrigidas no fechamento**: banner sticky (nascia até 3.608px fora da
  viewport — a classe E6/T028); alerta genérico calado quando a causa é conhecida; o retry do
  outbox gateado pelo marcador de expiração (não pelo status de cliente, que é exatamente o
  estado do A3); o último comentário falso do seam de dinheiro reescrito. **R5 registrado como
  follow-up** (máscara de milhar se perde na reabertura programática — classe B2 da PR-C).

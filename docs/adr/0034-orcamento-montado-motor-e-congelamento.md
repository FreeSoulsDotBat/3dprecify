# ADR-0034: "Montar e Enviar" — onde mora a regra do desconto, e como o orçamento enviado congela sem um segundo mecanismo

- **Status**: Proposed (o dono flipa para Accepted no gate da PR-E do 019)
- **Date**: 2026-08-26
- **Deciders**: Jonatan (owner — Q6/Q8 no clarify de 2026-08-26) + arquiteto (019-porte-design)
- **Escalação**: domínio de pricing (desconto, piso, quantidade) ⇒ **opus**, por ADR-0022
- **Estende**: ADR-0008 (versão do modelo + arredondamento) · ADR-0016 (contrato de composição de kit) ·
  ADR-0019 (imutabilidade do snapshot) · ADR-0020 (renderização do artefato exportado)

## Context

A US16–US18 do 019 criam o construtor multi-item: N itens do catálogo × quantidade, desconto, piso de
custo, validade, e "Enviar" que congela e gera o PDF. É a **única prancheta que não espelha código**;
propõe produto. E é a única fatia do 019 que encosta em dinheiro composto.

**Fatos medidos (2026-08-26):**

- `computeBom` (`packages/pricing-core/src/index.ts:510`) **já** faz N linhas × quantidade, com a regra
  de dinheiro um nível acima da ADR-0008 (linha unitária já arredondada → `toMoney(Decimal × qty)` →
  `sumMoney` dos já arredondados) e devolve `custoTotal`, `precoVarejo`, `precoAtacado` do conjunto
  (`BomResult`, :480). **O total do orçamento e o piso de custo já existem no motor.** O que não existe
  é o desconto.
- `PRICING_MODEL_VERSION` está em **4.1.0** (:29); o gate amarra a constante ao **major** do pacote
  (ADR-0008 §Decision), e o precedente recente de capacidade aditiva é 4.0.0 → 4.1.0 (016/PR-F).
- `snapshots` tem `CHECK kind IN ('SINGLE','KIT')` (`models/__init__.py:584`),
  `CHECK payload->>'kind' = kind` (:607) e a amarração
  `headline_total = payload->totals->>(CASE headline_basis …)` (:618-626), espelhada na aplicação por
  `_BASIS_TOTAL_KEY` (`api/history.py:71-74`) e pelos `Literal` de `SnapshotIn` (:109, :119).
- **`quote_validity_days` JÁ EXISTE** em `snapshots` (:652, `CHECK` 1..3650) — a validade não precisa de
  coluna nova.
- O PDF já renderiza `payload.lines` como nome + quantidade + total no ramo `KIT`
  (`services/quote_render.py:195-213`), com o rodapé não-fiscal e o opt-in de custos internos.

## Options considered

### Eixo 1 — onde mora a regra do desconto e do piso

#### Opção 1A — Composição no cliente sobre `computeBom` (a tela subtrai)
- **Prós**: zero mudança no pacote; nada para versionar.
- **Contras**: põe aritmética de dinheiro na tela, que é exatamente o que a FR-1916 proíbe ("nenhuma
  soma paralela"); o arredondamento passaria a existir em dois lugares (motor e tela) e divergiria
  em algum centavo, que é o defeito que ninguém vê; e a propriedade "o total descontado nunca é
  inventado" deixa de ser testável fora da UI.
- **Escalabilidade**: negativa.
- **Confiança de que produziria divergência de centavo em um incremento**: 70%.

#### Opção 1B — Estender `computeBom` com um parâmetro opcional de desconto
- **Prós**: uma função só para "conjunto de linhas".
- **Contras**: muda a assinatura de uma função que **kits** usam, para servir **orçamentos**; um
  parâmetro opcional em rota quente é o modo clássico de alguém passar desconto num kit sem querer. O
  contrato do ADR-0016 é de composição de kit, não de orçamento.
- **Confiança**: 40%.

#### Opção 1C — Função nova `computeQuote` no `pricing-core`, sobre `computeBom` (ESCOLHIDA)
- **Prós**: `computeCalculator` e `computeBom` ficam **byte-idênticos** (SC-709 aplicável por diff); a
  regra do desconto e do piso nasce com teste de propriedade fora da UI; o construtor da tela vira
  apresentação de um resultado, sem uma subtração sequer; um kit não tem como receber desconto por
  engano, porque a função dele não aceita.
- **Contras**: mais uma superfície pública no pacote; `PRICING_MODEL_VERSION` sobe.
- **Escalabilidade**: alta — a próxima regra de total (uma taxa de entrega, um acréscimo) entra aqui e
  não na tela.
- **Confiança**: 85%.

### Eixo 2 — como o orçamento enviado congela

- **2A — `kind='QUOTE'` + `headline_basis='PRECO_ORCAMENTO'` em `snapshots`, migração ADITIVA de CHECK**
  — **ESCOLHIDA**. Prós: mesma tabela, mesmo gatilho, mesma trilha de imutabilidade — **nenhum segundo
  mecanismo** (FR-1917); o número que o vendedor mandou ganha nome próprio e `totals.precoVarejo`
  continua significando "o que o motor calculou para varejo", sem ser reescrito para caber num CHECK.
  Contras: mexe em duas constraints de uma tabela imutável (constraints, não linhas) e no contrato.
- **2B — reutilizar `kind='KIT'`** e marcar a origem só no payload (o precedente `"SCENARIO"` do E5).
  Prós: zero migração. Contras: a lista do Histórico e o PDF passariam a chamar de kit um documento que
  não é kit, e a coluna `kind` perderia significado — o oposto do que ela existe para fazer.
  Confiança de que viraria confusão de leitura: 70%.
- **2C — tabela própria de orçamentos enviados**. Contras: um **segundo** mecanismo de imutabilidade,
  proibido explicitamente pela US17/FR-1917. Confiança: 5%.

## Decision

### 1. `computeQuote` no `pricing-core`, versão **4.2.0** (MINOR)

```
computeQuote({ lines: BomLineInput[], discount?: { mode: "PCT" | "AMOUNT"; value: number } })
  -> { bom: BomResult; grossTotal; discountAmount; netTotal; costFloor; belowCost: boolean }
```

Sub-regras normativas:

1. **A base é o preço de VENDA DIRETA** (Q6): `bom.precoVarejo` — custo + markup, **sem canal de
   marketplace**. O construtor não recebe `channels`; quem vende por marketplace usa Calculadora ou
   Simulações. Um orçamento nunca embute comissão.
2. **O desconto incide no TOTAL**, uma vez, em percentual **ou** em reais (Q6). Nunca por item, nunca
   duas vezes.
3. **Aritmética pela regra da casa** (ADR-0008): tudo em `Decimal`, `toMoney` no fim, nunca `*`/`-`
   nativos sobre dinheiro. `netTotal = toMoney(grossTotal − discountAmount)`, com
   `discountAmount = toMoney(grossTotal × pct/100)` no modo percentual.
4. **O piso é `bom.custoTotal`** — o custo somado dos itens × quantidades, que o motor já produz.
   `belowCost = netTotal < costFloor`, **estritamente menor**: vender exatamente no custo não é vender
   abaixo dele, e chamar de "abaixo" o empate seria um aviso falso.
5. **Q10 confirmada — avisa, não bloqueia.** Um orçamento abaixo do custo é decisão legítima do vendedor
   (promoção, cliente antigo, desovar estoque). Bloquear seria a classe "o produto recusou o que não
   devia". Confiança: 90%.
6. **`netTotal` nunca é negativo**: um desconto maior que o total é entrada inválida
   (`ValidationError`), não um total negativo silencioso.
7. **Nada de canal, nada de banda, nada de tarifa** entra nesta função — o que a mantém fora do alcance
   de `catalogVersion` (o 019 não toca tarifa).

**Versão**: `PRICING_MODEL_VERSION` **4.1.0 → 4.2.0**, com `package.json` junto. É **MINOR** porque
nenhuma computação existente muda de resultado — o pacote ganha capacidade. A prova exigida na fatia é a
mesma que o 014/C cobrou: uma varredura de igualdade entre 4.1.0 e 4.2.0 sobre `computeCalculator` e
`computeBom` (mesmas entradas, mesmos centavos), **antes** do bump valer.

### 2. Congelar = a maquinaria do E4, com um `kind` novo (Opção 2A)

- Migração **0009** (depois da 0008 da PR-D), **aditiva**: `kind IN ('SINGLE','KIT','QUOTE')` e
  `headline_basis IN ('PRECO_VAREJO','PRECO_ATACADO','PRECO_ORCAMENTO')`. Nenhuma linha existente é
  tocada; o gatilho de imutabilidade, o `UNIQUE (owner_uid, client_snapshot_id)` e o `PATCH`
  só-de-`label` ficam **intactos**.
- **A armadilha que esta migração TEM que resolver no mesmo ato**: o `CHECK` `headline_matches_totals`
  escolhe a chave do total por um `CASE` sobre `headline_basis`. Um valor novo cai no `ELSE` implícito e
  o `CASE` devolve **NULL** — e um `CHECK` que avalia NULL **PASSA** no PostgreSQL. Ou seja: adicionar o
  enum sem estender o `CASE` **desliga em silêncio** a única amarração de banco entre o total do cartão
  e o total do documento. O `CASE` ganha `WHEN 'PRECO_ORCAMENTO' THEN 'precoOrcamento'` na mesma
  migração, e um teste insere um snapshot de orçamento com total divergente e **espera a recusa**.
- **O espelho na aplicação move junto**: `_BASIS_TOTAL_KEY` (dict — chave faltando é `KeyError` ⇒ 500) e
  os `Literal` de `SnapshotIn`. Guarda estrutural: um teste afirma que o conjunto de valores do `Literal`
  é **igual** ao conjunto de chaves do dict. Sem ele, um enum novo vira 500 numa rota que o outbox
  re-tenta para sempre (ADR-0018 §3).
- **O documento congelado** (payload, envelope plano do E4/Option A) carrega, para um orçamento:
  `kind: "QUOTE"`, `lines[]` (nome, quantidade, unitário, subtotal — a forma que o PDF já lê),
  `totals.precoOrcamento` (= `netTotal`, e = `headline_total`), `discount` `{mode, value, amount,
  grossTotal}` e `costFloor`. **O desconto é declarado, nunca embutido**: um documento que mostra só o
  líquido esconde a conta que o vendedor fez.
- **Q7 confirmada — "Válido até" é TEXTO no documento**, não estado. Usa o `quote_validity_days` que já
  existe; não nasce ciclo de vida, não nasce job de expiração, não há "sai da lista sozinho". Um
  vencimento real precisaria de autoridade de relógio (e o `device_quoted_at` é, por decisão do E4, um
  carimbo do aparelho que o servidor **não verifica**) e de superfície de notificação — dois produtos
  novos para uma linha impressa. Confiança: 85%.
- **Q8 confirmada — "Enviar" = congela (ADR-0019) + gera o PDF (ADR-0020)**, com o rodapé não-fiscal.
  Zero superfície pública nova: sem link, sem e-mail, sem envio pelo app — o vendedor manda por fora,
  como já faz. O PDF ganha **uma** adição: as linhas de bruto → desconto → total, e só quando o payload
  traz `discount`. Nome adversarialmente longo é asserção de **geometria na página** (lição do E4/T034).
- **Antes de enviar, nada congela** (FR-1916): o construtor acompanha o preço de hoje, e um item
  degradado entra pelo caminho de degradação de leitura do E3/D6 com a legenda que o produto já tem —
  não vira erro do construtor.

### 3. Ponto ABERTO, roteado ao dono — a Q9 ficou **inconsistente com a Q6** (não decido aqui)

A US18 pede o aviso *"10 un. sai mais barato que 9"*, e o default da Q9 diz que ele **deriva das faixas
progressivas do marketplace** (ADR-0024, `band-dominance.test.ts`). Mas a **Q6, decidida**, tira o
marketplace do construtor. Sem faixa e sem troca de markup por quantidade, o total do construtor é
**monotônico por construção** (`netTotal` cresce com a quantidade, e desconto percentual ou fixo
preserva a ordem) — ou seja, **o aviso nunca poderia disparar**. Uma AC que não tem como acontecer não
é uma AC; é uma tela morta.

Opções, todas sem implementação antes da resposta:

- **Q9-1 — o construtor escolhe varejo/atacado por linha ou por quantidade.** Aí a não-monotonicidade é
  real (10 no atacado pode sair abaixo de 9 no varejo) e o aviso é útil e verdadeiro. Prós: mantém a
  US18 viva com dado que o produto já tem (os dois markups estão em `products`). Contras: inventa uma
  decisão de produto que ninguém pediu (quando trocar de markup?). **Confiança de ser o que o desenho
  quis dizer: 55%.**
- **Q9-2 — a US18 sai da PR-E e vira superfície nas telas onde a faixa existe** (Calculadora/Simulações,
  onde a propriedade band-dominance já está provada). Prós: o aviso passa a ser a superfície visível de
  uma propriedade **real**; nada é inventado. Contras: contraria o agrupamento da spec. **Confiança:
  70%.**
- **Q9-3 — a US18 permanece como propriedade testada sem superfície** no construtor (o motor garante a
  monotonicidade; um teste prova; nenhuma tela avisa porque nada há para avisar). Prós: honesto e
  barato. Contras: entrega menos do que a prancheta desenhou. **Confiança: 60%.**

A PR-E pode ser planejada e começar **sem** esta resposta: US16 e US17 não dependem dela. Só a US18
fica bloqueada.

## Consequences

- **Positivo**: nenhuma subtração de dinheiro na tela; `computeCalculator`/`computeBom` provadamente
  intocados; o orçamento enviado herda **inteiro** o aparato de imutabilidade do E4 (gatilho, guarda de
  ORM, ausência de `PUT`) e o exportador do E4 renderiza a estrutura que ele já sabe ler; a validade sai
  de graça de uma coluna que já existia.
- **Negativo / aceito**: o pacote de preço ganha uma superfície pública e um MINOR; duas constraints de
  uma tabela imutável mudam (e a mudança precisa da correção do `CASE`, senão desliga um guarda em
  silêncio); o contrato OpenAPI muda ⇒ regeneração do cliente + drift-guard na mesma fatia.
- **Risco declarado**: alguém "simplificar" gravando o total descontado em `totals.precoVarejo` para não
  mexer no enum. Isso faria o documento afirmar que o **motor** calculou aquele número — uma mentira
  dentro de um registro imutável, que é a pior classe possível aqui. O teste do §2 (inserção com total
  divergente ⇒ recusa) e a revisão do payload existem para pegar isso.
- **Follow-ups**: se um dia o construtor precisar de marketplace, ele **não** ganha um segundo caminho —
  `computeQuote` passa a aceitar canais e o documento ganha o bloco de canal que o E4 já congela.

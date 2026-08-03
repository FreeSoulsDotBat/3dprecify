# F03b — Motor de preço, canais

## Resumo

Nove casos-ouro de canal calculados à mão: **os nove batem**. A pergunta central do prompt tem
resposta medida — **a taxa de marketplace incide sobre o ANÚNCIO, não sobre o custo**
(`channels.ts:90`: `list = (base + fixo) / (1 − comissão%)`), e o erro que isso evita é
quantificável: no caso C1 a alternativa errada pagaria ao vendedor R$ 97,75 em vez dos R$ 100,00 que
ele pediu — **2,25% a menos, em toda venda**. Também confirmados: o fixo entra ANTES da divisão, o
piso por item da Amazon liga e desliga na fronteira certa, `PROGRESSIVE` cobra por fatia e dá
resultado DIFERENTE de `SELECTION` (116,67 contra 111,11 no mesmo par de bandas), o frete é deduzido
do líquido e **nunca somado ao custo**, e um slot inválido devolve erro sem derrubar os irmãos.
`commissionPct` é validado em `[0,100)` — 100 daria divisão por zero e é recusado.
**Nenhum achado novo.** A **A1-r** continua aberta e o veredito está abaixo.

---

## Método

Nove entradas projetadas antes de executar, cada uma mirando uma propriedade, com base de custo
fixada em R$ 100,00 e markup 0% para o anúncio ser lido direto. **Os nove canais foram passados num
único cálculo**, de propósito: é o que testa o isolamento por slot. Saída bruta em
`../evidencias/F03b-casos-ouro-canal.json`.

Mesmo desvio de R8 da F03a (arquivo temporário dentro do pacote, criado/executado/apagado na mesma
fase, `git status` verificado vazio depois). Causa: [F03a-001].

---

## A pergunta central: sobre o que a taxa incide?

**Sobre o anúncio.** `packages/pricing-core/src/channels.ts:89-93`:

```
keep    = 1 − comissão%/100
listPct = (base + fixo) / keep
```

### C1 — a prova aritmética

base R$ 100,00, comissão 15%, sem fixo:

| | conta | anúncio | o vendedor recebe |
| --- | --- | --- | --- |
| **o que o código faz** | 100 / 0,85 | **117,65** | 117,65 − 15%×117,65 = **100,00** ✅ |
| o erro clássico (taxa sobre o custo) | 100 × 1,15 | 115,00 | 115,00 − 15%×115,00 = **97,75** ❌ |

A diferença é **R$ 2,25 em R$ 100** — 2,25% do faturamento, em toda venda, e invisível para quem não
refaz a conta. O código **não** comete o erro.

---

## Tabela de casos-ouro

| caso | o que testa | calculado à mão | motor | bate? |
| --- | --- | --- | --- | --- |
| **C1** comissão 15% | a incidência | 100/0,85 = 117,647 → **117,65**; líquido **100,00** | idem | ✅ |
| **C2** 15% + fixo R$ 5 | o fixo entra ANTES da divisão | (100+5)/0,85 = 123,529 → **123,53**; líquido 123,53 − 18,53 − 5 = **100,00** | idem | ✅ |
| **C3** piso por item R$ 20 **liga** | a fronteira do piso da Amazon | 15% de 117,65 = 17,65 **< 20** ⇒ regime piso: 100+20 = **120,00**; líquido 120 − 20 = **100,00** | idem | ✅ |
| **C4** piso R$ 5 **não liga** | a fronteira, do outro lado | 17,65 **≥ 5** ⇒ regime %: **117,65** (igual a C1) | idem | ✅ |
| **C5** bandas SELECTION | escolhe a banda auto-consistente | banda ≥79 a 12%: 100/0,88 = 113,636 → **113,64**, que cai em [79,∞) ✔. A banda 0–79 daria 119,32, que NÃO cai nela ✘ | 113,64 | ✅ |
| **C6** bandas PROGRESSIVE | cobra por FATIA (ADR-0024) | comissão(L) = 15%×100 + 10%×(L−100) = 5 + 0,1L; L − 5 − 0,1L = 100 ⇒ L = **116,67** | idem | ✅ |
| **C7** frete R$ 10 | deduz do líquido, não entra no custo | anúncio **117,65** (frete NÃO entra no gross-up); líquido 100 − 10 = **90,00**; `custoTotal` segue **100,00** | idem | ✅ |
| **C8** comissão = 100 | divisão por zero | recusado: `error`, preços `null` | idem | ✅ |
| **C9** comissão negativa | limite inferior | recusado com a mesma mensagem | idem | ✅ |

### O que o C6 prova, e é o ponto da ADR-0024

Com as MESMAS bandas (15% até 100, 10% acima), os dois modos dão respostas diferentes:

- `PROGRESSIVE` → **116,67** (os primeiros R$ 100 pagam 15%)
- `SELECTION` com a banda de 10% daria 100/0,90 = **111,11**

Uma diferença de **R$ 5,56**. Se o `bandMode` se perdesse no caminho, a ausência seria lida como
`SELECTION` (o default da ADR-0024) e o vendedor anunciaria 111,11 recebendo menos do que pediu. O
`computeChannel` carrega o campo explicitamente e o comentário em `index.ts:296-298` nomeia essa
perda como o risco real da ADR — não a aritmética.

### O que o C7 prova

`custoTotal` permaneceu **100,00** com frete de R$ 10. O frete é dedução do líquido (FR-111a), e
**nunca** entra no custo — se entrasse, ele seria multiplicado pelo markup e o vendedor cobraria
margem sobre o próprio frete.

### O que os C8/C9 provam

Os dois slots inválidos devolveram `error` com preços `null`, e **os sete válidos ao lado
computaram normalmente** — isolamento por slot (SC-107) confirmado com os nove no mesmo cálculo. A
mensagem é de domínio (`"commissionPct must be a finite number in [0, 100)"`), sem vazar stack.

---

## Veredito sobre a A1-r

**A A1-r continua ABERTA, e continua sem sintoma reproduzível.** Isto não é achado novo desta fase —
é a confirmação do que já está registrado em `specs/014-fee-category-mapping/tasks.md`.

- **O que é**: `channels.ts:236` ordena os candidatos por *rank* e só depois pelo anúncio mais
  barato. Um candidato auto-consistente CARO vence um não-auto-consistente BARATO que entregaria a
  mesma base. Quando acontece, o vendedor recebe o que pediu (o selo não mente), mas o comprador vê
  um preço mais alto do que precisava.
- **Exposição medida**: **zero pontos dominados** em 6 tabelas × ~12 mil bases, incluindo **duas
  construídas de propósito** para serem patológicas. A hipótese de que o gatilho fosse a "forma-vale"
  foi **derrubada por medição** — cinco tabelas com vale deram zero.
- **O guarda que existe**: `packages/pricing-core/tests/band-dominance.test.ts` afirma a PROPRIEDADE
  ("o anúncio publicado é o mais barato que entrega a base") sobre 6 tabelas, e foi provado
  não-vácuo por mutação. Ele não depende de saber nomear a forma.
- **Por que não virou achado com severidade aqui**: eu não consegui produzir o sintoma. Registrar
  como "Alto" um defeito que 71 mil pontos não reproduzem seria inventar severidade. Registrar como
  resolvido seria pior. Fica como está: **aberto, medido, guardado, e dependente de decisão de
  desenho** — a tentativa de conserto quebrou 1.892 pontos de monotonicidade.

**Bloqueia provisionamento**: **não**.

---

## Não verificado nesta fase

1. **`computeBom`** — a soma por peça do E3, com quantidade e rollup por marketplace. Continua fora
   das duas sub-fases de preço; ver `PENDENCIAS.md` §P-007.
2. **Os vouchers de frete co-financiado da Shopee** (`freightVoucherBands`) só foram exercitados
   pela ausência. **Pergunta**: existe uma tabela de voucher real, com valores, contra a qual medir?
   Sem ela eu só consigo testar a mecânica, não a fidelidade à política da Shopee.
3. **Se a UI impede** comissão ≥ 100 antes de o motor recusar. O motor recusa; se a UI também
   impede, o caminho nunca é atingido. Isso se mede na **F08**.

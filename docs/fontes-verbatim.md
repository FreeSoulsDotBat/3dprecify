# Fontes verbatim (FONTE)

O terceiro tipo de conteúdo que vivia dentro dos comentários e não é decisão nossa: **a citação
literal da fonte externa que determinou um número**. Um artigo de central de ajuda de marketplace, um
trecho de documentação de PSP, um valor publicado.

Não é ADR (não decidimos nada) nem DEC (não é escolha local): é **procedência**. Fica aqui pelos
mesmos motivos que o resto saiu do código — verbatim é texto longo, e texto longo dentro da linha
esconde o código que o leitor foi procurar.

**Regra de ouro deste arquivo: o texto entre aspas é cópia literal da fonte e nunca é reescrito.**
Se a fonte mudar, entra um verbete NOVO com a data da releitura; o antigo fica, marcado. É o que
permite responder "de onde veio esse número" meses depois, e é a diferença entre procedência e
lembrança.

Como todo verbete, é citado do código (`// @doc FONTE-xxx — resumo`) e o guarda `packages/repo-audit`
derruba o portão se a citação morrer ou se o verbete ficar órfão.

---

## FONTE-001 — Shopee: comissão, taxa por item, frete e manuseio (arts. 26839 e 23431)

**Fonte**: Central de Ajuda da Shopee, artigos 26839 e 23431 · **Lidos**: 2026-08-06 (art. 26839,
016/T057) e 2026-08-07 (art. 23431, relido no hotfix 016/A2) · **Governa**: os números da Shopee em
`seed.data.json` e no catálogo servido.

Estes textos eram os comentários curatoriais de `apps/web/src/shared/fee-catalog/seed.ts`, e eram o
único lugar do repositório que os carregava — o literal TS virou JSON gerado (ADR-0029) e a prosa
ficou sem casa. Aqui está a casa.

**1. Art. 26839 (T057, US18/FR-927) — a banda [0, 80) parte em duas.**

> "Para produtos com preço abaixo de R$8, o adicional por item é a metade do preço do produto.
> Produtos acima de R$8 mantêm a comissão conforme a variação de valor do item"

A comissão de 20% **continua** incidindo; o que vira função do preço é o **adicional**. Em L = R$
8,00 as duas linhas cobram o mesmo (metade de 8 = os R$ 4 constantes): a fonte é contínua no limiar,
e a partição não inventa degrau nenhum.

**2. Art. 26839 (T057, US17/FR-926) — o CPF sem volume paga a tabela do catch-all.**

> "a taxa adicional de R$3 … não será aplicada, ficando vigente apenas a taxa por item vendido (R$4,
> R$16, R$20 ou R$26)"

Logo **duas** entradas, não três. Um eixo **composto** e não dois: "CNPJ + alto volume" não existe
publicado, e dois eixos criariam um espaço cartesiano com buracos irrepresentáveis. A entrada
catch-all (`determinants: null`) é o regime CNPJ — e é isso que mantém byte-idêntico todo documento
salvo antes do campo existir.

**3. Art. 26839 (T057) — a regressiva que o app NÃO precifica.**

> "um produto de R$10 tem uma taxa de R$6,50, enquanto um de R$8 terá taxa de R$6"

A fórmula não é publicada. Abaixo de R$ 12 o nível fica **sem referência** (I9) em vez de mentir sob
selo.

**4. Art. 23431 (relido 2026-08-07, hotfix 016/A2) — o subsídio de frete é da SHOPEE, não do vendedor.**

> "Todos os vendedores têm os benefícios do Programa de Frete Grátis. A Shopee também oferece
> subsídios de frete. … Para itens de até R$79,99: Cupons de frete grátis válidos para fretes de até
> R$20; … R$30; … R$40."

O valor é o **teto de validade do cupom**, e por isso `freightSubsidyInfo` é INFORMAÇÃO que não entra
em conta nenhuma. Era `freight: BAND_VOUCHER`, e o motor descontava os R$ 20 do líquido do vendedor —
o achado A2.

**5. Art. 3305 (016/US16, FR-923) — manuseio de item volumoso é POR PEDIDO.**

Num pedido de vários itens ela é cobrada **uma** vez.

> **Pendência herdada (registrada em 2026-08-07, ainda aberta):** a fatia que transforma estes
> verbatims em ÂNCORAS EXECUTÁVEIS é a PR-C do 017 (T026,
> `packages/fee-ingest/data/shopee-art26839.baseline.json`), onde deixam de ser prosa e viram guarda
> que dispara. Enquanto isso não acontece, este documento é a única procedência que existe.

### Onde isso vive no código

- `apps/web/src/shared/fee-catalog/seed.ts` → `FEE_CATALOG_SEED`

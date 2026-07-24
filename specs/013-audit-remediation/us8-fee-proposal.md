# US8 — Proposta de taxas curadas (Mercado Livre BR / Amazon BR)

**Tarefa**: T062 (levantamento) · **Gate**: T063 (aprovação do dono) · **Aplicação**: T064 (mecânica, pós-aprovação)
**Data da coleta**: 2026-07-23 · **Curador**: product-owner (sessão AI) · **Escopo**: `backend/app/data/catalog.json` + `apps/web/src/shared/fee-catalog/seed.ts`

> **GATE T063 — cada valor abaixo exige aprovação explícita do dono antes de qualquer merge.**

Nada aqui foi aplicado a código, catálogo ou seed. Este documento é uma **proposta**. Nenhum número foi inferido, estimado, arredondado ou "assumido razoavelmente": ou tem fonte oficial fetchada, ou está marcado **NÃO OBTIDO**.

---

## §0 · Resumo executivo (leia antes da tabela)

> ⚠️ **§0–§4 abaixo são da RODADA 1 e foram PARCIALMENTE SUPERADOS.** A Rodada 2 (§7, no fim deste
> documento) derrubou o diagnóstico de 403 do Mercado Livre, obteve números oficiais do ML, refutou a
> tese de peso/cubagem e resolveu o conflito da taxa mínima da Amazon **invertendo** a proposta de
> `minPerItem`. **Leia §7 antes de decidir qualquer linha do gate.**

| Marketplace | Situação (Rodada 1) | Ação proposta (Rodada 1) |
|---|---|---|
| **Amazon BR** | Página oficial **acessível** e lida 2× (+1 corroboração por busca) | Propostas 2 entradas (`plan: PROFISSIONAL` / `plan: INDIVIDUAL`) — dono valida os números |
| **Mercado Livre BR** | Página oficial **inacessível** — HTTP **403** em 5 URLs oficiais distintas | **NÃO OBTIDO** — proposta é **não** popular ML nesta feature, ou o dono fornecer os valores da sua conta de vendedor (§4) |

Consequência honesta: **US8 fecha pela metade nesta rodada.** O achado E1-01 (entradas ML/Amazon vazias) é remediado para a Amazon; para o ML, preencher com número de blog seria trocar um vazio honesto ("sem referência") por um pré-fill errado com selo de "referência" — exatamente o dano que a Constitution II proíbe.

**Correção da Rodada 2**: as duas linhas acima estão desatualizadas. Ver §7.0 para o quadro vigente.

---

## §1 · Restrição estrutural descoberta na leitura do código (afeta as duas propostas)

`apps/web/src/features/calculator/fee-prefill.ts:33-34` — os determinantes que o front realmente envia:

- Mercado Livre → `{ listingType: <modality> }` (`"CLASSICO"` | `"PREMIUM"`)
- Amazon → `{ plan: <modality> }` (`"PROFISSIONAL"` | `"INDIVIDUAL"`)

**A chave `category` NUNCA é enviada.** Logo, granularidade por categoria não é apenas "não cabe no schema" — ela é **inalcançável pelo lookup atual** (`resolveEntry` casa por igualdade de determinantes). Uma entrada com `determinants: { category: "casa" }` jamais resolveria; o pré-fill continuaria vazio, e o bug pareceria não corrigido.

Segunda restrição, `fee-prefill.ts:83` — `commissionPct: entry.commissionPct ?? 0`. Uma entrada com comissão `null` **e sem `priceBands`** pré-preenche **0%**, isto é, um número errado com selo de referência. Por isso nenhuma entrada proposta aqui tem comissão nula.

---

## §2 · AMAZON BR — proposta

**Fonte oficial**: https://venda.amazon.com.br/precos ("Quanto custa vender na Amazon? Comissões de 10% a 15%")
**Método**: WebFetch direto da página oficial, 2 leituras independentes (prompts diferentes) + 1 corroboração via busca restrita ao domínio oficial. A tabela do Seller Central (`G200336920`) redireciona para portal autenticado — **não corroborada por lá**.

### §2.1 · Tabela de valores propostos

| Campo | Valor proposto | sourceUrl | effectiveDate | Data da coleta | Trecho de origem |
|---|---|---|---|---|---|
| `commissionPct` (ambas as entradas) | **15** | https://venda.amazon.com.br/precos | `2025-01-20` (ver caveat C2) | 2026-07-23 | Linha da tabela oficial **"Demais categorias — 15%"**. Confirmada nas 2 leituras independentes. |
| `minPerItem` (ambas) | **1.00** | https://venda.amazon.com.br/precos | `2025-01-20` | 2026-07-23 | Verbatim: *"Caso o valor referente seja menor que a comissão mínima, a Amazon desconta o valor da comissão mínima, equivalente a R$ 1,00 (um real)."* (ver caveat **C1** — leitura conflitante de R$ 2,00) |
| `fixedFee` — entrada `plan: INDIVIDUAL` | **2.00** | https://venda.amazon.com.br/precos | `2025-01-20` | 2026-07-23 | Verbatim: *"O Plano Individual é isento de assinatura mensal, mas cobra **R$ 2,00 por item vendido**"* |
| `fixedFee` — entrada `plan: PROFISSIONAL` | **0** | https://venda.amazon.com.br/precos | `2025-01-20` | 2026-07-23 | Plano Profissional cobra **assinatura mensal**, não valor por item: *"O 1º ano do Plano Profissional é GRÁTIS para novos vendedores"* … *"R$ 19,00 mensais"* a partir do 13º mês. Sem cobrança por unidade ⇒ `0`. |
| `freight` | `{ "kind": "NONE" }` | — | — | 2026-07-23 | **Nada sobre subsídio de frete foi coletado da página oficial.** `NONE` é a declaração de ausência de dado, não um valor curado. |
| `priceBands` | **omitido** (`null`) | — | — | — | A tabela oficial tem faixa de preço apenas em 2 categorias (Acessórios eletrônicos: 15% até R$ 100 / 10% acima; Móveis: 15% até R$ 200 / 10% acima) — **nenhuma delas é a categoria proposta**. Aplicar faixas seria extrapolar. |
| `source` (string do selo) | `"Amazon Brasil — Quanto custa vender na Amazon (tabela de comissões por categoria; categoria \"Demais categorias\")"` | — | — | 2026-07-23 | Texto do selo deve dizer qual categoria, para o usuário saber quando sobrescrever. |
| `lastReviewed` | `2026-07-23` | — | — | 2026-07-23 | Data desta coleta (dispara o selo "desatualizada" em 30 dias — `STALENESS_DAYS`). |

### §2.2 · Por que 15% ("Demais categorias") e não 12% ("Casa"/"Brinquedos")

O lookup não recebe categoria (§1) ⇒ **um único número serve todas as vendas Amazon do usuário**. A tabela oficial lida traz, entre outras: Casa 12% · Brinquedos e jogos 12% · Papelaria e Escritório 13% · Instrumentos musicais e acessórios 12% · **Demais categorias 15%**.

Proponho **15%** por ser (a) a linha catch-all explícita da própria Amazon e (b) a escolha conservadora: superestimar a taxa protege a margem; subestimar faz o app sugerir um preço que perde dinheiro. **Isto é uma escolha de produto, não um fato — o dono pode trocar por 12%** (se a maioria das peças 3D dele for "Casa"/"Brinquedos"), e nesse caso o texto de `source` deve nomear a categoria escolhida.

### §2.3 · Fragmento JSON — **PROPOSTA — NÃO APLICADO**

Substituiria o bloco `AMAZON` de `backend/app/data/catalog.json` (e o espelho em `seed.ts`, byte-a-byte):

```json
{
  "marketplace": "AMAZON",
  "determinantsSchema": { "category": [], "plan": ["INDIVIDUAL", "PROFISSIONAL"] },
  "entries": [
    {
      "determinants": { "plan": "PROFISSIONAL" },
      "commissionPct": 15,
      "fixedFee": 0,
      "minPerItem": 1,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Amazon Brasil — Quanto custa vender na Amazon (comissão da categoria \"Demais categorias\"; comissão mínima R$ 1,00)",
      "sourceUrl": "https://venda.amazon.com.br/precos",
      "effectiveDate": "2025-01-20",
      "lastReviewed": "2026-07-23"
    },
    {
      "determinants": { "plan": "INDIVIDUAL" },
      "commissionPct": 15,
      "fixedFee": 2,
      "minPerItem": 1,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Amazon Brasil — Quanto custa vender na Amazon (categoria \"Demais categorias\"; comissão mínima R$ 1,00 + R$ 2,00 por item do Plano Individual)",
      "sourceUrl": "https://venda.amazon.com.br/precos",
      "effectiveDate": "2025-01-20",
      "lastReviewed": "2026-07-23"
    }
  ]
}
```

Conformidade com o schema Zod (`fee-catalog.ts:51-62`) conferida campo a campo: `commissionPct` ∈ [0,100) ✔ · `fixedFee` ≥ 0 ✔ · `minPerItem` ≥ 0 ✔ · `freight` discriminado por `kind` ✔ · `sourceUrl` é URL ✔ · provenance completa ✔ (o truth-gate test passa).

**Decisão de modelagem que o dono precisa ratificar**: os R$ 2,00/item do Plano Individual são uma **taxa de plano**, não uma tarifa de comissão — mas são cobrados por unidade vendida, então economicamente cabem em `fixedFee`. Se o dono preferir que `fixedFee` represente só tarifas de marketplace, a entrada `INDIVIDUAL` vai com `fixedFee: 0` e o usuário digita. Os **R$ 19,00/mês** do Plano Profissional **não têm lugar no schema** (custo mensal, não por venda) — ficam fora, declaradamente.

---

## §3 · MERCADO LIVRE BR — ~~**NÃO OBTIDO**~~ **SUPERADO PELA §7**

> ❌ **Esta seção inteira está SUPERADA.** O diagnóstico de "403 = domínio bloqueia o fetcher" era **falso**:
> era um *gate de user-agent*, e as URLs testadas em §3.1 estavam mortas (404/redirect) por motivos
> independentes. Com UA de navegador + render real, o ML respondeu **200** e entregou números oficiais.
> Ver **§7.1** (diagnóstico correto) e **§7.2** (o que foi obtido). A tese de peso/cubagem de §3.3 foi
> **REFUTADA** para o Brasil por fonte oficial — ver **§7.3**.

### §3.1 · O que foi tentado (todas as tentativas, com resultado)

| URL oficial tentada | Resultado |
|---|---|
| `https://www.mercadolivre.com.br/ajuda/Custos-de-vender-um-produto_1330` | **HTTP 403** |
| `https://www.mercadolivre.com.br/ajuda/tarifas-de-venda_1291` | **HTTP 403** |
| `https://www.mercadolivre.com.br/ajuda/Tarifas-por-vender-um-produto_1350` | **HTTP 403** |
| `https://vendedores.mercadolivre.com.br/nota/quanto-custa-vender-no-mercado-livre/` | **HTTP 403** |
| `https://vendedores.mercadolivre.com.br/tarifas` | **HTTP 403** |
| API direta de `listing_prices` | **Não tentada** — via 403-bloqueada já registrada (preferência do dono, 2026-07-06) |

O domínio `mercadolivre.com.br` bloqueia o fetcher inteiro (não é uma página específica). **Nenhum número oficial do ML foi obtido.**

### §3.2 · O que a busca (fonte NÃO-oficial) indicou — informativo, NÃO proposto

Registrado só para dimensionar o problema; **nenhum destes números entra no catálogo**:
- Clássico ~11–14% e Premium ~16–19%, variando **por categoria** (agregadores: ecommercenapratica, gestorshop, koncili — blogs, não fonte oficial);
- **Mudança estrutural em 02/03/2026**: o custo fixo por unidade (antes ~R$ 5,50–6,75 para produtos abaixo de R$ 79) foi **substituído por custo variável calculado por peso, dimensões/cubagem e preço**.

### §3.3 · O achado que importa mais que a indisponibilidade

Se a mudança de 02/03/2026 procede, o custo por unidade do ML **passou a depender de peso e dimensões** — variáveis que o schema atual não tem e que `priceBands` (indexado só por preço) **não consegue representar**. Nesse cenário, mesmo *com* os números em mãos, o ML não é modelável com fidelidade hoje: o máximo honesto seria a comissão percentual + custo por unidade **marcado como estimativa**. Confiança de que a mudança ocorreu: **~70%** (múltiplos secundários concordantes, zero confirmação oficial). Confiança de que, se ocorreu, o schema atual não a representa: **~90%** (leitura direta de `priceBandSchema`).

### §3.4 · Opções para o dono (T063 decide)

| # | Opção | Prós | Contras | Escalabilidade | Confiança |
|---|---|---|---|---|---|
| **A** | **Não popular ML nesta feature** (mantém `entries: []`, selo "sem referência", digitação manual) | Zero risco de número errado; comportamento atual já é honesto; fecha 013 sem dívida falsa | US8 entrega só metade; E1-01 continua aberto para ML | Neutra — reabre quando houver fonte | **90%** de ser a opção correta hoje |
| **B** | **Dono fornece os valores** da própria conta de vendedor ML (a tela de tarifas logada mostra a taxa da categoria dele) | Números reais, do caso de uso real; `sourceUrl` continua a página oficial; destrava US8 | Depende do dono; vale para a categoria/conta dele (declarar isso no `source`) | Boa — vira o processo padrão de recuratela | **75%** de ser viável sem atrito |
| **C** | **Curar de agregadores** (blogs de e-commerce) | Rápido, "completo" | Viola a ordem de fontes do dono e a Constitution II: `source` seria um blog exibido ao usuário como referência; risco de número errado com selo de autoridade | Ruim — cria precedente de fonte fraca | **95%** de que deve ser **recusada** |

**Recomendação**: **A** agora, **B** quando o dono tiver 10 minutos com a conta logada. **C** recusada.

---

## §4 · Confiança & ressalvas (o que NÃO está sólido)

- ❌ **C1 — SUPERADO pela §7.4.** O conflito foi resolvido: as duas leituras estavam ambas *parcialmente*
  certas, e a conclusão proposta (`minPerItem: 1`) está **errada para a categoria escolhida**. Leia §7.4.
  Texto original preservado abaixo para histórico.
- **C1 (Rodada 1, histórico) — conflito interno na Amazon (o mais importante).** As duas leituras da MESMA página oficial divergiram sobre a taxa mínima: a 1ª disse *"R$ 1,00 para a maioria; R$ 2,00 para algumas categorias"*; a 2ª renderizou uma coluna "Taxa Mínima" com **R$ 2,00 na maioria das linhas** e R$ 1,00 em poucas — enquanto o texto corrido, verbatim, diz **"comissão mínima, equivalente a R$ 1,00 (um real)"**, e a busca no domínio oficial corroborou R$ 1,00. **Não escolhi um vencedor por conta própria**: proponho `minPerItem: 1.00` (alinhado ao verbatim + corroboração + ao valor que `band-floor.test.ts` já exercita), e sinalizo que se a coluna por categoria de fato existir com R$ 2,00, o valor da linha "Demais categorias" seria **2,00**. **Confiança em 1,00: ~70%.** Este é o número que mais merece a conferência visual do dono na página.
- **C2 — `effectiveDate` da Amazon.** A página exibe *"Comissões atualizadas em 20/01/2025"*. Isso é uma data de **atualização**, e a página **não declara** "vigente a partir de". Proponho gravá-la como `effectiveDate` por ser o único carimbo oficial existente — mas ela tem ~18 meses hoje, o que é ou uma página genuinamente parada, ou um render antigo servido ao fetcher. **Confiança de que é a data exibida hoje: ~70%.** Se o dono vir outra data na tela, ela prevalece.
- **C3 — categoria da Amazon**: 15% é a linha catch-all oficial, mas é uma **escolha**, não um fato (§2.2). Confiança de que "Demais categorias = 15%" consta da página: **~85%** (2 leituras concordantes).
- **C4 — frete Amazon**: nenhum dado de subsídio/frete coletado ⇒ `freight: NONE` declara ausência. Não confundir com "a Amazon não tem custo de frete".
- ❌ **C5 — SUPERADO.** ~~Mercado Livre: **nenhum número.**~~ Números oficiais **obtidos** na Rodada 2 (faixa
  publicada, não valor exato). Ver §7.2.
- **C6 — não verifiquei** se a paridade `seed.ts` ≡ `catalog.json` já tem teste-guarda (research §6 pede que vire teste se não for) — item para T064, fora do escopo desta coleta.
- **C7 — `catalogVersion`**: se a Amazon for aprovada, bumpar para `"2026-07-23.0"` (formato `YYYY-MM-DD.n`, cuja comparação passa a ser data+int pelo fix E1-03 do mesmo escopo) e atualizar `generatedAt`.

---

## §5 · Limite declarado — granularidade por categoria (o dono aceita ou rejeita)

> A entrada curada representa o **caso comum**, não a taxa da categoria específica de cada anúncio. O Mercado Livre tem dezenas de taxas por categoria e a Amazon ~37 linhas; **o schema atual não comporta essa granularidade e o lookup do front sequer envia a categoria** (§1). A honestidade é sustentada do mesmo jeito que a Shopee já faz hoje: o **selo de referência** (com fonte + data) mais o **override manual** — o usuário vê de onde veio o número, e o ajusta quando sua categoria difere.
>
> **Se o dono quiser taxa por categoria, isso é evolução de schema FUTURA** (novo eixo de determinantes + UI de seleção de categoria + curadoria de N linhas por marketplace) e está **fora do escopo de 013**. Nesta feature, ou aceitamos o caso comum nomeado, ou não pré-preenchemos.

---

## §6 · Checklist do gate T063 (o dono marca cada linha) — ⚠️ SUBSTITUÍDO PELO §7.7

> O checklist abaixo é da Rodada 1. **Use o de §7.7**, que corrige as linhas 2 e 6.

| # | Item a aprovar | Aprovado? |
|---|---|---|
| 1 | Amazon `commissionPct = 15` ("Demais categorias") — **ou** trocar por 12% ("Casa"/"Brinquedos") | ☐ |
| 2 | Amazon `minPerItem = 1,00` — **conferir na tela** por causa do conflito C1 (candidato alternativo: 2,00) | ☐ |
| 3 | Amazon `effectiveDate = 2025-01-20` conforme exibido (C2) | ☐ |
| 4 | Amazon Plano Individual: R$ 2,00/item modelado como `fixedFee` (§2.3) | ☐ |
| 5 | Amazon `freight: NONE` (ausência de dado declarada) | ☐ |
| 6 | Mercado Livre: escolher **A** (não popular) · **B** (dono fornece) · **C** (recusada) — §3.4 | ☐ |
| 7 | Limite de granularidade por categoria (§5) aceito | ☐ |

**GATE T063 — cada valor acima exige aprovação explícita do dono antes de qualquer merge.**

---
---

# Rodada 2 — diagnóstico e fontes

**Data da coleta**: 2026-07-23 · **Método**: `curl` com user-agent de navegador + **render real em navegador
(Playwright)** para páginas client-side · **Escopo**: fechar as lacunas da Rodada 1, não repeti-la.

Toda URL abaixo é a **URL efetiva** (após redirects) que foi de fato buscada. Toda citação é **verbatim**.

---

## §7.0 · Quadro vigente (substitui §0)

| Marketplace | Situação após Rodada 2 | Ação proposta |
|---|---|---|
| **Amazon BR** | **Obtido + corroborado por 2 fontes oficiais** — e as duas **divergem** na taxa mínima | 2 entradas; `minPerItem` vai ao dono como decisão explícita (§7.4) |
| **Mercado Livre BR** | **Parcialmente obtido.** A **faixa** oficial (Clássico 10%–14%) é pública; o **valor exato por categoria** é *login-gated* | 3 opções em §7.6 — nenhuma delas usa blog |

**O que mudou de verdade**: o ML não é inacessível. O que é inacessível é o **número exato**, e por um motivo
estrutural (sessão de vendedor), não por bloqueio de fetcher.

---

## §7.1 · Mercado Livre — diagnóstico de acesso (o que está travado, como, e o que é genuinamente inalcançável)

### O erro da Rodada 1

A Rodada 1 concluiu "o domínio `mercadolivre.com.br` bloqueia o fetcher inteiro (403)". **Isso está errado**, e
o erro tem duas causas somadas:

1. **Gate de user-agent, não bloqueio de domínio.** `WebFetch` recebe 403; `curl -A "<UA de Chrome>"` recebe
   **200** nas mesmas rotas. Não é geo-block e não é autenticação — é filtro de bot.
2. **As 5 URLs de §3.1 estavam mortas por conta própria.** O help center do ML renumerou/renomeou os artigos;
   os slugs de §3.1 não existem mais. Um 404/redirect foi lido como 403.

Prova (todas com UA de navegador, 2026-07-23):

| URL pedida | URL efetiva | HTTP |
|---|---|---|
| `…/ajuda/quanto-custa-vender-um-produto_1338` | `https://www.mercadolivre.com.br/ajuda/870` | **200** |
| `…/ajuda/tarifas-e-faturamento_1472` | `https://www.mercadolivre.com.br/ajuda/1044` | **200** |
| `https://developers.mercadolivre.com.br/pt_br/comissao-por-vender` | (idem) | **200** |
| `https://vendedores.mercadolivre.com.br/nota/como-funcionam-as-taxas-do-mercado-livre` | (idem) | **200** |
| `…/ajuda/quanto-custa-para-anunciar-e-vender_867` | (idem) | **200** |
| `…/ajuda/51251` | (idem) | **200** |

### A segunda camada: renderização

As páginas `/ajuda/*` são **SPA client-side**. Com `curl` o HTML vem só com o *shell* (título, rodapé, banner de
cookies) — **zero conteúdo de tarifa**. Só há `window.__NAVIGATION_PRELOADED_STATE__`; o corpo do artigo chega
por XHR. **Ler essas páginas exige navegador de verdade.** (O `vendedores.mercadolivre.com.br/nota/*` é
server-rendered e é legível por `curl` puro.)

### A terceira camada: o que é genuinamente inalcançável (e por quê)

Esta é a barreira real, e ela **não** é contornável por UA nem por render:

| Recurso oficial | URL efetiva | Resultado |
|---|---|---|
| **Tarifa exata por categoria** | `https://www.mercadolivre.com.br/landing/custos-de-venda/tarifas-de-venda` | **Redireciona para login** (`mercadolivre.com/jms/mlb/lgz/msl/login/…`) |
| **Simulador de custos** | `https://www.mercadolivre.com.br/simulador-de-custos` | **Redireciona para login** |
| "Ver todos meus custos" | `https://www.mercadolivre.com.br/landing/custos-de-venda` | Mesma landing logada |
| API `listing_prices` | `https://api.mercadolibre.com/sites/MLB/listing_prices` | **Requer token** — a própria doc oficial só documenta a chamada com `-H 'Authorization: Bearer $ACCESS_TOKEN'` |

**Conclusão do diagnóstico**: o Mercado Livre publica a **faixa** de tarifa abertamente e mantém o **valor
exato por categoria atrás de sessão autenticada de vendedor, por desenho**. Não existe rota pública oficial
para o número exato. Isso valida a opção **B** da Rodada 1 (§3.4) como o único caminho para precisão — mas
agora sabemos que a faixa pública já é fonte oficial citável.

---

## §7.2 · Mercado Livre — o que FOI obtido (oficial)

### Fonte primária

- **URL efetiva**: `https://www.mercadolivre.com.br/ajuda/870`
- **Título**: "Quanto custa vender um produto?"
- **effectiveDate**: **não declarado** (a página não exibe data de vigência nem de atualização)
- **Data da coleta**: 2026-07-23

**Verbatim (tabela "Quais as diferenças entre os anúncios Clássico e Premium?")**:

> | | Clássico | Premium |
> |---|---|---|
> | Tarifa de venda por categoría | **Entre 10% e 14%** | **Entre 15% e 19%** |
> | Parcelamento | Sem parcelamento | Até 10x sem juros* |

**Verbatim (texto corrido, mesma página)**:

> "Criar um anúncio não tem custo. Ao concluir a venda, você pagará uma tarifa que varia dependendo se o
> anúncio é Clássico ou Premium, do valor e da categoria do produto."

E, sobre a granularidade que nos falta:

> "Busque sua categoria e confira a porcentagem exata a pagar de acordo com o tipo de anúncio."
> *(este link é exatamente o que redireciona para login — §7.1)*

### Fonte secundária oficial (corrobora a faixa)

- **URL efetiva**: `https://vendedores.mercadolivre.com.br/nota/como-funcionam-as-taxas-do-mercado-livre`
  (Central de aprendizagem / Universidade de Vendedores — domínio oficial ML)
- **effectiveDate**: **não declarado**

> "No Clássico, a tarifa varia entre 10% e 14% do valor da venda e não inclui a opção de parcelamento em até
> 12 vezes sem juros para o comprador. Já o Premium tem tarifa entre 15% e 19%…"

⚠️ **Esta página secundária está internamente desatualizada** e não deve ser usada como fonte de custo fixo.
Ela ainda descreve o modelo antigo:

> "Para produtos com valor menor que R$ 12,50, o custo fixo será de 50% do valor da unidade. […] Para
> produtos com valor acima de R$ 12,50 e abaixo de R$ 79, o custo fixo varia em três faixas de preço. Para
> produtos com valor acima de R$ 79 não existe custo fixo."

A página **canônica** (`/ajuda/870`) **não menciona custo fixo por unidade** — coerente com a mudança de
02/03/2026 documentada em §7.3. Duas páginas oficiais do ML discordam sobre custo fixo; **por isso não
proponho nenhum valor de custo fixo para o ML.**

### Mecanismo de faixa de preço que existe e é oficial

- **URL efetiva**: `https://www.mercadolivre.com.br/ajuda/51251` — "Categorias com desconto na tarifa de venda"

> "Quando você escolhe o Mercado Livre para oferecer seus preços mais competitivos e vende produtos das
> categorias selecionadas que estejam **entre R$ 150 e R$ 700**, terá uma redução na sua tarifa por venda"

O desconto é expresso em **pontos percentuais** (ex.: Acessórios para Veículos → 3pp em Premium, 1pp em
Clássico) sobre uma base que só é visível logado. Ou seja: **o ML tem sim um mecanismo indexado por preço que
o nosso `priceBands` conseguiria representar em forma — mas não temos a base sobre a qual aplicá-lo.**

---

## §7.3 · A tese de peso/dimensões/cubagem — **REFUTADA para o Brasil** (fonte oficial)

A Rodada 1 registrou, a ~70% de confiança e só com blogs, que desde 02/03/2026 o custo por unidade do ML
passou a ser calculado por **peso, dimensões e cubagem**. Se fosse verdade para a tarifa de venda, o nosso
`priceBands` (indexado só por preço) estaria estruturalmente incapaz de representar o ML.

**Fonte oficial consultada**: `https://developers.mercadolivre.com.br/pt_br/comissao-por-vender`
("Custos por vender" — documentação oficial de desenvolvedores do Mercado Livre)
**effectiveDate declarado na página**: *"Última atualização em 06/03/2026"*

### O que a mudança de 02/03/2026 realmente foi (verbatim)

> "**Importante:** O Mercado Livre atualizou a estrutura de custos de envio. O `fixed_fee` já não é calculado
> apenas pelo preço do produto, mas **depende do tipo de logística do vendedor**.
> **Datas de ativação:** Brasil: **02/03** · Argentina: 12/03 · Colombia: 23/03 · Chile: 06/04 · México: 08/04"

**A data 02/03 está CONFIRMADA como oficial.** O que a Rodada 1 errou foi o **eixo** da mudança.

### O peso NÃO se aplica ao Brasil (verbatim, seção "Lógica de cálculo")

> "**Brasil, Colômbia, Chile, México:**
> · Preço < TH + ME2: Apenas Flex (`self_service`) cobra custo fixo. Os demais modelos não geram cobrança.
> · ME1 / custom / not_specified: Sempre é cobrado custo fixo (quando preço < TH).
> · Preço ≥ TH: Não há cobrança de custo fixo em nenhum caso.
> · **Peso faturável: Não se aplica.**
> · Taxa de venda (`sale_fee`): Sempre é cobrada uma porcentagem do preço, de acordo com a categoria do produto."

E o parâmetro de peso é explicitamente de outro país:

> "`billable_weight` (number): Envie o peso faturável do pacote, em gramas. Exemplo: 5828 (**Obrigatório para
> Argentina**)."

### Veredicto

| Afirmação da Rodada 1 (§3.3) | Veredicto | Base |
|---|---|---|
| Houve mudança estrutural em **02/03/2026** no Brasil | ✅ **CONFIRMADO** | "Datas de ativação: Brasil: 02/03" |
| O custo por unidade passou a depender de **peso / cubagem** | ❌ **REFUTADO para o BR** | "Peso faturável: **Não se aplica**" (Brasil); `billable_weight` é obrigatório só na Argentina |
| Logo, o schema atual não consegue representar o ML | ❌ **REFUTADO como colocado** | O eixo novo é **tipo de logística/modo de envio**, não peso |
| A **tarifa de venda percentual** mudou de eixo | ❌ **REFUTADO** | "`sale_fee`: Sempre é cobrada uma porcentagem do preço, de acordo com a categoria" |

**O que os blogs confundiram**: a mudança de 02/03/2026 mexeu em **custos de envio/FULL** (aí sim peso, cubagem
e armazenagem entram) e no **`fixed_fee` por tipo de logística**. Os blogs fundiram as duas coisas num só
"custo por unidade agora é por peso". A comissão percentual de venda continua **preço + categoria**.

### Consequência real para o nosso schema (a que importa)

A `commissionPct` do ML **é modelável** — o obstáculo é *categoria*, não peso. Já o **custo fixo por unidade
do ML NÃO é modelável** no schema atual, mas por outro motivo: ele depende de `logistic_type` / `shipping_mode`
(Flex vs Full vs ME1 vs próprio), um eixo que o nosso `determinants` não tem e que o front não envia.
**Recomendação: `fixedFee: null` para o ML, sempre, com o motivo declarado no `source`.**

---

## §7.4 · Amazon — a taxa mínima R$ 1,00 × R$ 2,00, RESOLVIDA

### A hipótese do briefing foi TESTADA e está PARCIALMENTE REFUTADA

Hipótese: *"os dois números são coisas diferentes — mínimo de comissão vs. taxa por item do plano Individual
(R$ 2,00)"*.

**Resultado: a hipótese explica a coincidência, mas NÃO explica a tabela.** Existem de fato **dois R$ 2,00
distintos** na Amazon — e é essa colisão numérica que gerou a confusão —, porém o R$ 2,00 que apareceu na
coluna da tabela **é rotulado, na própria página, como comissão mínima**, não como taxa de plano.

### Fonte 1 — página de marketing (a que a Rodada 1 leu)

- **URL efetiva**: `https://venda.amazon.com.br/precos`
- **effectiveDate declarado**: *"Consulte comissões atualizadas em **20/01/2025**"* (confirmado em render real)
- **Data da coleta**: 2026-07-23

A tabela é **agrupada por taxa mínima**, com dois cabeçalhos de grupo. Verbatim, na ordem em que aparece:

> "Categoria do produto | Comissão da Amazon (%)
> **Comissão mínima R$1,00**
> Comidas e bebidas 10% · Eletrodomésticos de linha branca³ 11% · Saúde e cuidados pessoais 12% ·
> Bebidas alcoólicas 11% · Pneus e rodas 10% · Indústria e Ciência 12%
> **Comissão mínima R$ 2,00**
> Produtos para bebês 12% · Produtos para animais de estimação 12% · … · Brinquedos e jogos 12% · … ·
> Casa 12% · … · Papelaria e Escritório 13% · … · Livros 15% · … · **Demais categorias 15%**"

➡️ **"Demais categorias 15%" cai no grupo de comissão mínima R$ 2,00.** Não há terceiro cabeçalho depois dele.

E o texto corrido **da mesma página** diz o oposto, genericamente:

> "Caso o valor referente seja menor que a comissão mínima, a Amazon desconta o valor da comissão mínima,
> **equivalente a R$ 1,00 (um real)**."

**Isto é um conflito interno a uma única página oficial**: o texto corrido diz R$ 1,00 para todos; a tabela
logo abaixo cria um grupo explícito de R$ 2,00 que contém a categoria catch-all.

### Fonte 2 — a tabela contratual do Seller Central (NOVA nesta rodada; a Rodada 1 a deu como inacessível)

- **URL efetiva**: `https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR`
- **Título**: "Tabela de tarifas para Vender na Amazon"
- **effectiveDate declarado**: **não declarado** (a página não traz data de vigência; rodapé "© 2026")
- **Data da coleta**: 2026-07-23
- **Acesso**: **é público** — não exige login. A Rodada 1 testou `…/gp/help/external/G200336920` e
  `…/help/hub/reference/GTG4BAWSY39Z98CT` (esta sim redireciona para `ap/signin`). A rota
  `/help/hub/reference/`**`external`**`/G200336920?locale=pt-BR` abre, mas é **client-side** — por `curl` retorna
  só o shell (1.654 chars de texto); precisa de render.

**Verbatim (regra de cálculo)**:

> "Para todos os produtos, deduzimos o **maior valor** entre a porcentagem de comissão aplicável **ou a
> comissão mínima por item aplicável**, calculada sobre o preço total de venda por unidade pago pelo cliente
> (o preço do item, o custo de envio, a tarifa de embalagem para presente e os impostos pagos pelo cliente)."

**Verbatim (tabela "Comissões – BR", cabeçalho e linhas relevantes)**:

> "Categorias | Porcentagens de comissão | **Comissão mínima aplicável** (aplicada por produto, salvo
> indicação em contrário)
> Casa e Cozinha 12% — **BRL 1,00** · Brinquedos e Jogos 12% — **BRL 1,00** · Papelaria e Escritório 13% —
> **BRL 1,00** · Móveis² 15% até BRL 200,00 / 10% acima de BRL 200,00 — **BRL 1,00** ·
> **Outros 15% — BRL 1,00**"

➡️ **Nesta tabela, TODAS as ~37 categorias — inclusive a catch-all "Outros" — têm mínima BRL 1,00. Não existe
nenhuma linha com R$ 2,00.**

**Verbatim (as taxas de plano, que são coisa separada)**:

> "**Tarifas por item vendido**
> Vendedores do plano Profissional: **sem tarifa por item vendido**.
> Vendedores individuais: **Tarifa de BRL 2,00 para cada produto vendido**."

> "**Tarifa de assinatura mensal** — Plano de vendas Profissional: **BRL 19,00 por mês** quando você tiver
> ofertas ativas. Atualmente, há uma promoção de isenção da tarifa de assinatura por 12 meses para novos
> vendedores. Plano de vendas Individual: sem tarifa de assinatura."

### Resolução declarada

**Os dois R$ 2,00 da Amazon, nomeados:**

| # | O que é | Valor | Onde entra no schema | Status |
|---|---|---|---|---|
| **R$ 2,00 (A)** | **Tarifa por item vendido do Plano Individual** | R$ 2,00/produto | `fixedFee` da entrada `plan: INDIVIDUAL` | ✅ **Sem conflito** — as duas fontes oficiais concordam literalmente |
| **R$ 2,00 (B)** | **Comissão mínima** do grupo catch-all na página `/precos` | R$ 2,00/item | `minPerItem` | ⚠️ **Em conflito** com o Seller Central, que diz BRL 1,00 |

**Portanto: NÃO escolho vencedor** (regra do briefing — duas fontes oficiais divergentes). O quadro honesto:

| Fonte oficial | `minPerItem` para a categoria catch-all | effectiveDate | Natureza da fonte |
|---|---|---|---|
| `venda.amazon.com.br/precos` | **R$ 2,00** ("Demais categorias" está sob o cabeçalho "Comissão mínima R$ 2,00") | 20/01/2025 (declarado) | Página de **marketing** |
| `sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR` | **R$ 1,00** ("Outros … BRL 1,00") | **não declarado** | **Tabela de tarifas** (documento de referência do vendedor) |

**Observação que o dono deve pesar (não é fato, é peso de fonte)**: o Seller Central é o documento de
referência tarifária dirigido a vendedores e é **internamente consistente** (mínima 1,00 em 100% das linhas);
a `/precos` é material comercial e **se contradiz dentro da própria página** (texto corrido diz 1,00, tabela
cria grupo de 2,00). Isso *sugere* que R$ 1,00 é o valor vigente e que o agrupamento de 2,00 na `/precos` está
defasado — **mas isso é inferência, não fato declarado, e por isso vai ao gate, não ao catálogo.**

### O que a Rodada 1 acertou e o que errou

- ✅ Acertou o verbatim "equivalente a R$ 1,00 (um real)" — existe mesmo.
- ✅ Acertou que existe uma coluna/grupo com R$ 2,00 — não foi alucinação de render.
- ❌ Errou ao registrar as duas leituras como "conflito irresolvido de render": é **conteúdo real** e
  **estruturado por grupos**, legível de forma determinística em navegador.
- ❌ **Errou a conclusão**: propôs `minPerItem: 1` com a justificativa de que a tabela talvez não existisse.
  A tabela existe, e **coloca a categoria proposta ("Demais categorias") no grupo de R$ 2,00**. Se o dono
  ficar com a `/precos` como fonte, o valor coerente é **2,00**, não 1,00.
- ❌ Errou ao dar o Seller Central como inacessível — a rota `…/external/…?locale=pt-BR` é pública.

### Correções factuais menores (verbatim que a Rodada 1 citou errado)

A Rodada 1 (§2.1) cita: *"O Plano Individual é isento de assinatura mensal, mas cobra R$ 2,00 por item
vendido"*. **Essa frase não existe na página.** O verbatim real é:

> "O Plano Individual é isento de mensalidade; O custo é de **R$ 2,00 por produto vendido**."

E: *"A partir do 13° mês o preço do plano é de **R$ 19,00 mensais**."* — este confere.

✅ **C2 confirmado**: "Consulte comissões atualizadas em 20/01/2025" está de fato na página hoje (render real,
2026-07-23). Não é artefato de cache. Continua sendo data de *atualização*, não de vigência.

✅ **C3 confirmado a ~100%**: "Demais categorias 15%" (`/precos`) e "Outros 15%" (Seller Central) — duas fontes
oficiais concordam na catch-all.

### Busca por vigência mais recente (feita, resultado negativo)

Procurei anúncio oficial de mudança de comissão posterior a 20/01/2025 no Seller Central. O único encontrado
foi `sellercentral.amazon.com.br/seller-forums/discussions/t/fc32659d-9284-48ee-9efa-41eabdcdcfaa` —
"Alterações nas tarifas de logística e comissões no Brasil a partir de 1 de agosto", verbatim: *"entrarão em
vigor em 1° de agosto de **2024**"* — **anterior** a 20/01/2025, portanto já absorvido. O link
"Tarifas … (válidas até 21 de agosto de **2022**)" é arquivo histórico. **Nenhuma alteração de comissão
posterior a 20/01/2025 foi encontrada em fonte oficial.**

---

## §7.5 · PROPOSTA JSON atualizada — **PROPOSTA — NÃO APLICADO**

Conferido contra `apps/web/src/shared/fee-catalog/fee-catalog.ts` (`feeEntrySchema`) e contra o
`determinantsSchema` já presente em `backend/app/data/catalog.json`
(`MERCADO_LIVRE: {listingType:[CLASSICO,PREMIUM], category:[]}` · `AMAZON: {category:[], plan:[INDIVIDUAL,PROFISSIONAL]}`).
Estado atual: **ambos com `entries: []`** e `catalogVersion` `"2026-07-07.0"`.

### AMAZON — muda só `minPerItem` em relação à Rodada 1

```json
{
  "marketplace": "AMAZON",
  "determinantsSchema": { "category": [], "plan": ["INDIVIDUAL", "PROFISSIONAL"] },
  "entries": [
    {
      "determinants": { "plan": "PROFISSIONAL" },
      "commissionPct": 15,
      "fixedFee": 0,
      "minPerItem": 1,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Amazon Brasil — Tabela de tarifas para Vender na Amazon (categoria \"Outros\": comissão 15%, comissão mínima BRL 1,00; plano Profissional não tem tarifa por item)",
      "sourceUrl": "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR",
      "effectiveDate": "não declarado pela fonte",
      "lastReviewed": "2026-07-23"
    },
    {
      "determinants": { "plan": "INDIVIDUAL" },
      "commissionPct": 15,
      "fixedFee": 2,
      "minPerItem": 1,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Amazon Brasil — Tabela de tarifas para Vender na Amazon (categoria \"Outros\": comissão 15%, comissão mínima BRL 1,00 + tarifa de BRL 2,00 por produto vendido do plano Individual)",
      "sourceUrl": "https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR",
      "effectiveDate": "não declarado pela fonte",
      "lastReviewed": "2026-07-23"
    }
  ]
}
```

**Variante B — se o dono preferir a `/precos` como fonte** (ela tem `effectiveDate` declarado, o que o
Seller Central não tem): trocar em ambas as entradas `"minPerItem": 1` → **`2`**,
`"sourceUrl"` → `"https://venda.amazon.com.br/precos"`, `"effectiveDate"` → `"2025-01-20"`, e o `source` para
`"Amazon Brasil — Quanto custa vender na Amazon (categoria \"Demais categorias\": 15%, grupo de comissão mínima R$ 2,00)"`.

⚠️ **Não misturar**: escolher `minPerItem: 2` **com** `sourceUrl` do Seller Central produziria um selo de
referência apontando para uma página que diz 1,00 — exatamente o dano que a Constitution II proíbe. **Fonte e
número andam juntos.**

📌 **`effectiveDate` é `z.string().min(1)`, não uma data tipada** — logo `"não declarado pela fonte"` **passa**
no schema. Se o dono achar que uma string não-data nesse campo é ruim para o selo, a alternativa honesta é
adotar a Variante B (que tem data real). Decisão de produto, vai ao gate (§7.7, item 3).

### MERCADO_LIVRE — proposta nova (não existia na Rodada 1)

**Opção ML-1 (recomendada tecnicamente): manter `entries: []`.** Nada a escrever; o selo "sem referência" +
digitação manual já é o comportamento honesto de hoje.

**Opção ML-2: publicar o piso da faixa oficial, rotulado como faixa.** Só se o dono aprovar explicitamente
que um extremo de faixa vira número único:

```json
{
  "marketplace": "MERCADO_LIVRE",
  "determinantsSchema": { "listingType": ["CLASSICO", "PREMIUM"], "category": [] },
  "entries": [
    {
      "determinants": { "listingType": "CLASSICO" },
      "commissionPct": 14,
      "fixedFee": null,
      "minPerItem": null,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Mercado Livre — Quanto custa vender um produto? A tarifa do Clássico é publicada como FAIXA (entre 10% e 14%) e varia por categoria; adotado o teto 14% (conservador). O valor exato da sua categoria só é visível na sua conta de vendedor. Custo fixo não incluído: desde 02/03/2026 depende do tipo de logística (Flex/Full/ME1), eixo que este app não modela.",
      "sourceUrl": "https://www.mercadolivre.com.br/ajuda/870",
      "effectiveDate": "não declarado pela fonte",
      "lastReviewed": "2026-07-23"
    },
    {
      "determinants": { "listingType": "PREMIUM" },
      "commissionPct": 19,
      "fixedFee": null,
      "minPerItem": null,
      "priceBands": null,
      "freight": { "kind": "NONE" },
      "source": "Mercado Livre — Quanto custa vender um produto? A tarifa do Premium é publicada como FAIXA (entre 15% e 19%) e varia por categoria; adotado o teto 19% (conservador). O valor exato da sua categoria só é visível na sua conta de vendedor. Custo fixo não incluído: desde 02/03/2026 depende do tipo de logística (Flex/Full/ME1), eixo que este app não modela.",
      "sourceUrl": "https://www.mercadolivre.com.br/ajuda/870",
      "effectiveDate": "não declarado pela fonte",
      "lastReviewed": "2026-07-23"
    }
  ]
}
```

**O que ML-2 custa, dito sem maquiagem**: 14% e 19% **não são valores publicados** — são os **tetos** de faixas
publicadas. É a mesma classe de escolha que o "15% = Demais categorias" da Amazon (conservadora: superestimar
taxa protege margem), só que aqui o número exibido **não aparece literalmente na fonte**. O `source` proposto
declara isso ao usuário na própria etiqueta. **Se o dono achar que o selo "referência" não comporta um teto de
faixa, ML-1 é a resposta certa** — e continua sendo a minha recomendação por padrão.

**Escolhido ML-2, `catalogVersion` → `"2026-07-23.0"` e `generatedAt` atualizado** (mesma nota C7).

---

## §7.6 · Opções do Mercado Livre — reavaliadas

| # | Opção | O que muda com a Rodada 2 | Recomendação |
|---|---|---|---|
| **A / ML-1** | Não popular ML (`entries: []`) | Continua válida e continua sendo a mais segura | ✅ **Padrão** |
| **A′ / ML-2** | Popular com o **teto da faixa oficial**, rotulado | **NOVA** — antes impossível (não havia fonte); agora há fonte oficial pública citável | ⚠️ Só com aprovação explícita: o número é derivado de faixa, não publicado |
| **B** | Dono fornece os valores da conta logada | **Reforçada** — agora sabemos que é o *único* caminho para o valor exato, e que isso é por desenho do ML | ✅ Melhor resultado, quando houver 10 min |
| **C** | Curar de agregadores/blogs | **Reforçada a recusa** — os blogs erraram o eixo da mudança de 02/03/2026 (§7.3); usá-los teria propagado um erro checável | ❌ **Recusada** |

C não é mais só "fonte fraca": ela foi **empiricamente demonstrada errada** nesta rodada.

---

## §7.7 · Checklist do gate T063 — versão vigente (substitui §6)

| # | Item a aprovar | Aprovado? |
|---|---|---|
| 1 | Amazon `commissionPct = 15` — catch-all, confirmada em **2 fontes oficiais** ("Demais categorias" / "Outros") | ☐ |
| 2 | **Amazon `minPerItem`: escolher a fonte.** ☐ **1,00** (Seller Central `G200336920`, tabela de tarifas, mínima BRL 1,00 em 100% das linhas, **sem data**) · ☐ **2,00** (`/precos`, catch-all no grupo "Comissão mínima R$ 2,00", **com data 20/01/2025**). **Fonte e número andam juntos** (§7.5) | ☐ |
| 3 | Amazon `effectiveDate`: ☐ `"não declarado pela fonte"` (se Seller Central) · ☐ `"2025-01-20"` (se `/precos`) | ☐ |
| 4 | Amazon Plano Individual: **R$ 2,00 por produto vendido** como `fixedFee` — verbatim confirmado em 2 fontes; é **distinto** da comissão mínima (§7.4) | ☐ |
| 5 | Amazon `freight: NONE` (ausência de dado declarada) | ☐ |
| 6 | **Mercado Livre**: ☐ **ML-1** não popular (recomendado) · ☐ **ML-2** teto da faixa (14% / 19%, rotulado) · ☐ **B** dono fornece os valores da conta. **C recusada** | ☐ |
| 7 | ML `fixedFee` fica **`null` em qualquer cenário** — depende de `logistic_type`, eixo não modelado (§7.3) | ☐ |
| 8 | Limite de granularidade por categoria (§5) aceito — **inalterado**: o lookup não envia `category` | ☐ |
| 9 | `catalogVersion` → `"2026-07-23.0"` + `generatedAt` atualizado (C7) | ☐ |

**GATE T063 — cada valor acima exige aprovação explícita do dono antes de qualquer merge.**

---

## §7.8 · Ressalvas da Rodada 2 (o que continua NÃO sólido)

- **R1 — Nenhuma das duas fontes da Amazon declara vigência.** `/precos` declara *atualização* (20/01/2025);
  o Seller Central não declara nada. **Não existe "a partir de" oficial** para as comissões BR. Confiança de
  que os percentuais estão vigentes hoje: **~85%** (2 fontes oficiais concordantes + nenhum anúncio de mudança
  posterior encontrado).
- **R2 — O conflito 1,00 × 2,00 NÃO foi resolvido por autoridade, só por caracterização.** Sei exatamente
  *o que* cada número é e *onde* está; **não sei qual a Amazon cobra hoje**. Só uma fatura real ou o Seller
  Central logado resolve. **É a única linha do gate que exige decisão de fato, não ratificação.**
- **R3 — ML: 14% e 19% são TETOS de faixa, não valores publicados.** Se ML-2 for aprovada, isso precisa estar
  no `source` (está, na proposta) e idealmente visível no selo. Confiança de que a faixa 10–14% / 15–19% é a
  oficial vigente: **~95%** (2 páginas oficiais ML concordantes, lidas em render real).
- **R4 — ML sem `effectiveDate` em qualquer página.** Nem `/ajuda/870` nem a Central de Vendedores declaram
  data. O único carimbo de data oficial do ML obtido nesta rodada é o da doc de developers
  ("Última atualização em 06/03/2026"), que **não cobre os percentuais** — cobre custo de envio/`fixed_fee`.
- **R5 — Divergência interna do ML sobre custo fixo.** `/ajuda/870` (canônica) não menciona custo fixo;
  a Central de Vendedores ainda descreve o modelo antigo (R$ 12,50 / R$ 79). **Nenhum custo fixo do ML é
  proposto.** Se o dono vir custo fixo na conta dele, isso entra por B, não por curadoria.
- **R6 — Método**: as páginas `/ajuda/*` do ML e o Seller Central `G200336920` **exigem render em navegador**.
  Recuratelas futuras que usarem só `curl`/`WebFetch` vão ler o shell vazio e concluir "não obtido" —
  **exatamente o falso negativo da Rodada 1**. Registrar isso no processo de recuratela (T064).
- **R7 — `freight` da Amazon**: inalterado, `NONE` = ausência de dado coletado. A `/precos` fala de frete
  grátis a partir de R$ 19 e de faixas R$ 19–79 / acima de R$ 79 nas **logísticas** (FBA/DBA), mas isso é
  custo de envio por modalidade, não subsídio modelável no nosso `freightSchema`. Não coletado, não proposto.
- **R8 — C6 continua aberto** (paridade `seed.ts` ≡ `catalog.json` com teste-guarda) — item de T064.

---

## §7.9 · Índice de fontes da Rodada 2 (URLs efetivas, todas coletadas em 2026-07-23)

| # | URL efetiva | Natureza | Acesso | Data declarada |
|---|---|---|---|---|
| F1 | `https://www.mercadolivre.com.br/ajuda/870` | ML — help center canônico "Quanto custa vender um produto?" | Público, **exige render** | não declarado |
| F2 | `https://vendedores.mercadolivre.com.br/nota/como-funcionam-as-taxas-do-mercado-livre` | ML — Central de aprendizagem | Público, server-rendered | não declarado (conteúdo defasado, §7.2) |
| F3 | `https://developers.mercadolivre.com.br/pt_br/comissao-por-vender` | ML — doc oficial de developers | Público, server-rendered | **06/03/2026** (última atualização) |
| F4 | `https://www.mercadolivre.com.br/ajuda/51251` | ML — categorias com desconto (faixa R$ 150–700) | Público, **exige render** | não declarado |
| F5 | `https://www.mercadolivre.com.br/landing/custos-de-venda/tarifas-de-venda` | ML — **tarifa exata por categoria** | 🔒 **redireciona para login** | — |
| F6 | `https://www.mercadolivre.com.br/simulador-de-custos` | ML — simulador de custos | 🔒 **redireciona para login** | — |
| F7 | `https://api.mercadolibre.com/sites/MLB/listing_prices` | ML — API de custos | 🔒 **exige `Bearer` token** (por doc oficial F3) | — |
| F8 | `https://venda.amazon.com.br/precos` | Amazon — página comercial de preços | Público, **exige render** para a tabela | **20/01/2025** (atualização) |
| F9 | `https://sellercentral.amazon.com.br/help/hub/reference/external/G200336920?locale=pt-BR` | Amazon — **Tabela de tarifas para Vender na Amazon** | Público, **exige render** | **não declarado** |
| F10 | `https://sellercentral.amazon.com.br/help/hub/reference/GTG4BAWSY39Z98CT` | Amazon — help hub (rota não-`external`) | 🔒 redireciona para `ap/signin` | — |
| F11 | `https://sellercentral.amazon.com.br/seller-forums/discussions/t/fc32659d-9284-48ee-9efa-41eabdcdcfaa` | Amazon — anúncio oficial de tarifas | Público, **exige render** | vigor em **01/08/2024** (superado por F8) |

---

# Rodada 3 — sessão AUTENTICADA do dono (2026-07-23) e DECISÃO do gate T063

**Método**: o dono (Jonatan) autenticou-se pessoalmente no Mercado Livre e no Amazon Seller Central
num browser dirigido por Playwright/MCP; a IA navegou dentro da sessão dele e leu as telas. Credenciais
nunca foram vistas nem armazenadas pela IA. Isto atravessou o muro que derrubou as Rodadas 1 e 2.

## §8 · O que a sessão autenticada resolveu DEFINITIVAMENTE

### §8.1 · Amazon — a contradição R$ 1,00 × R$ 2,00 morreu

Fonte: `sellercentral.amazon.com.br/help/hub/reference/G200336920` §"Comissões – BR", lida logada.

- **Comissão mínima = `BRL 1,00` em TODAS as 38 categorias.** Não existe nenhuma linha com R$ 2,00.
  A leitura da Rodada 1 que viu "R$ 2,00" na `venda.amazon.com.br/precos` estava lendo um agrupamento
  de cabeçalho enganoso da própria página de marketing da Amazon.
- **O R$ 2,00 é outra tarifa**, verbatim: *"Vendedores individuais: Tarifa de BRL 2,00 para cada produto
  vendido"* · *"Vendedores do plano Profissional: sem tarifa por item vendido."* → é `fixedFee` do plano
  **Individual**, não `minPerItem`.
- Assinatura mensal: Profissional `BRL 19,00/mês`; Individual sem assinatura. **Fora do schema** (custo
  mensal, não por venda) — permanece fora, como a Rodada 1 já dizia.
- Catch-all **"Outros" = 15%**, mínimo BRL 1,00.
- Faixas por preço que JÁ existem e que o nosso `priceBands` modela: Acessórios Eletrônicos (15% até
  BRL 100 / 10% acima), Móveis e Colchões (15% até BRL 200 / 10% acima).

**Regra de cobrança oficial** (importa para o motor): *"deduzimos o maior valor entre a porcentagem de
comissão aplicável ou a comissão mínima por item"* — é EXATAMENTE o que `grossUpOnce` já faz com
`minPerItem`. Nosso engine bate com a Amazon nesse ponto.

**⚠ Nuance de modelagem, declarada e NÃO resolvida**: a Amazon calcula a comissão *"sobre o preço total
de venda por unidade pago pelo cliente (o preço do item, o custo de envio, a tarifa de embalagem para
presente e os impostos pagos pelo cliente)"* — ou seja, **incluindo frete**. Nosso motor aplica a
comissão só sobre o preço do anúncio. Para quem oferece frete grátis (frete embutido no preço) os dois
coincidem; para frete cobrado à parte, a Amazon retém um pouco mais do que prevemos. **Subestimação
conhecida e limitada** — entra como item de escopo do incremento 014, não se corrige aqui.

### §8.2 · Mercado Livre — valores EXATOS obtidos (primeira vez)

Fonte: `mercadolivre.com.br/landing/custos-de-venda`, seletor de categoria, sessão logada.

- Categoria `Informática › Impressão › Impressão 3D › Outros`: **Clássico 13% · Premium 18%** (exato,
  não faixa). Consistente com a faixa pública 10–14% / 15–19%.
- **Custo fixo por unidade em produtos < R$ 79** (aplica-se a Envios Flex, logística do vendedor, acordo
  com o comprador, retirada) — modelável no shape `priceBands`/`fixedFee`:

  | faixa | custo fixo |
  |---|---|
  | até R$ 12,50 | R$ 6,25 |
  | R$ 12,51 – 29,00 | R$ 6,50 |
  | R$ 29,01 – 50,00 | R$ 6,75 |

  **Lacuna da PRÓPRIA página ML, registrada e não interpolada**: o texto diz que o custo fixo vale "em
  produtos com preço menor que R$ 79", mas a lista para em R$ 50 — a faixa **R$ 50,01–78,99 não é coberta
  por nenhuma linha publicada**. Não inventamos a 4ª faixa.
- Isto **refuta** a conclusão da Rodada 2 de que o custo fixo do ML seria inmodelável: é modelável para o
  vendedor que despacha por conta própria (o caso típico do app). Só Full/Coleta é que vai por peso/cubagem.

## §9 · DECISÃO DO DONO (gate T063) — 2026-07-23

**US8 é DEFERIDA do incremento 013.** Nenhuma entrada de ML ou Amazon é adicionada ao
`backend/app/data/catalog.json` nem ao `seed.ts` nesta feature; `entries: []` permanece.

**Motivo** (decisão do dono, registrada): em vez de curar UMA categoria de referência por marketplace, o
produto vai ter **mapeamento completo categoria→taxa nos dois marketplaces, com atualização mensal o mais
automática possível**. Curar uma categoria única agora significaria embarcar um número errado para a
maioria dos usuários, carregando o selo "referência", e seria substituído em um incremento. Enquanto isso,
o override manual + selo "sem referência" já são o comportamento honesto.

**Destino**: incremento **014** (spec própria, a abrir logo após o fechamento do 013), passando pelo fluxo
spec-kit completo (product-owner → specify → clarify → plan + ADRs → tasks), por Princípio VIII.

## §10 · Insumo para o incremento 014 (não repetir trabalho já pago)

1. **Amazon é automatizável já**: tabela inteira numa página (`G200336920`), pública porém renderizada por
   JS — `curl` pega casca vazia; precisa de browser headless (Playwright já é devDependency). 38 categorias
   + 3 com faixa de preço. Parsing determinístico, 0 tokens de LLM.
2. **ML exige autenticação POR DESIGN**. Caminhos: (a) **app OAuth oficial do ML** — `/sites/MLB/listing_prices?price=X&category_id=Y` devolve a tarifa por tipo de anúncio e `/sites/MLB/categories` percorre a
   árvore; sancionado e automatizável — **mesmo bloqueio do D1–D4 / Q-D (conta ML da casa)**; (b) browser
   headless com sessão de vendedor armazenada — frágil e arriscado quanto a ToS, **desaconselhado**;
   (c) curadoria manual trimestral como fallback honesto.
   A via anônima está morta: `api.mercadolibre.com/sites/MLB/listing_prices` responde **403 PolicyAgent**.
3. **Bloqueio de wire já identificado**: `apps/web/src/features/calculator/fee-prefill.ts:33-34`
   (`slotDeterminants`) envia SOMENTE `listingType` (ML) e `plan` (Amazon) — **nunca `category`**. Uma
   entrada chaveada por categoria JAMAIS resolveria; o bug pareceria "não corrigido". Isto é pré-requisito
   duro do 014, não detalhe.
4. **Risco de pré-fill silenciosamente errado**: `fee-prefill.ts:83` faz `commissionPct ?? 0` — uma entrada
   com comissão nula e sem `priceBands` pré-preenche **0%** exibindo selo de "referência". Qualquer
   ingestão automática precisa garantir que comissão nula nunca chegue ao catálogo, ou trocar esse default.
5. **Decisões de design que o 014 precisa tomar (não decidir aqui)**: cobertura × tamanho do bundle (o app
   é offline-first e EMBARCA o seed — a árvore de categorias do ML tem milhares de folhas); UX do seletor
   de categoria por slot (designer-ux); e a saída do job mensal — **recomendação: abrir PR com o diff, nunca
   auto-merge**, porque taxa é fato de dinheiro e merece a mesma trava humana que o gate T063.
6. **Evidência visual** capturada da sessão do dono: `evidence/us8/{ml-tarifas-venda.png,
   ml-custo-fixo-bands.png,amazon-comissoes-br.png}`.

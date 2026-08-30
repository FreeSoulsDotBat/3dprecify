<!-- contextos-embutidos -->

> Cole este arquivo inteiro no Claude Design. Ele traz, nesta ordem: **(1)** o que a plataforma é e
> faz, **(2)** onde exatamente esta peça vive dentro dela, **(3)** as regras de marca e Design System
> que o desenho deve obedecer, e **(4)** o pedido de desenho propriamente dito.

---

# Contexto 1 — A plataforma

## O que é o Precifica3D

Uma **calculadora de precificação** para quem vende impressão 3D no Brasil, da marca **Truth's Forge**.
O vendedor informa seus custos e recebe um **preço sugerido com a conta aberta** — cada centavo rastreável
até a linha que o gerou. O nome da marca significa *verdade forjada em forma*: transparência não é um
adjetivo aqui, é o produto.

**Quem usa:** vendedor/maker prático, quase sempre MEI solo, frequentemente **leigo em precificação** —
sabe imprimir, não sabe formar preço. Ele erra por baixo (esquece energia, depreciação, taxa de falha,
comissão de marketplace) e descobre o prejuízo depois da venda. A interface existe para impedir isso.

**Plataforma:** PWA web instalável, **mobile-first** (390px é a largura de projeto), responsiva até
desktop com corte em **1280px**. Android via Play depois. Toda a interface é **pt-BR**.

## O que a plataforma faz — as cinco abas

| Aba | Rota | O que o vendedor faz ali |
|---|---|---|
| **Calcular** | `/calcular` | A tela central. Informa custos e markup, vê o preço sugerido recalculado ao vivo com o detalhamento item a item, e compara o preço em cada marketplace. **Grátis e ilimitado.** |
| **Catálogo** | `/catalogo` | Guarda filamentos, impressoras, produtos e kits salvos. Um item salvo **preenche a calculadora sozinho** e continua editável. **Premium.** |
| **Kits** | `/kits` | Monta um anúncio de várias peças (BOM multi-peça): cada peça tem seu próprio cálculo, e o kit soma. Ao salvar, as peças podem **virar produtos no catálogo**. **Premium.** |
| **Orçamentos** | `/historico` | Registros **congelados**: o preço de um dia, imutável, com a fórmula e as tarifas daquele momento. Consulta, compara com hoje, recalcula, exporta PDF/CSV. **Premium.** |
| **Conta** | `/conta` | Identidade, plano, assinatura, tema, privacidade, sair. |

## O que entra no preço

O motor de cálculo (`pricing-core`, roda **no dispositivo**, offline) soma:

- **Material** — custo do rolo ÷ peso do rolo × gramas usadas.
- **Energia** — consumo médio (kW) × tempo de impressão × tarifa (R$/kWh).
- **Máquina** — depreciação por hora, derivada de "quanto custou a máquina" + ritmo de uso + payback,
  ou informada direto pelo vendedor.
- **Falha** — uma taxa percentual que cobre a impressão que não deu certo.
- **Mão de obra e acabamento**, e **outros custos** nomeados (embalagem, etiqueta, frete, o que ele quiser).
- **Markup** varejo e atacado, aplicados **sobre o custo total**, não sobre o preço de venda.
- **Marketplace** — comissão, taxa fixa, frete e sobretaxas de cada canal, para chegar ao **preço de
  anúncio** e ao **líquido que sobra**.

## Os canais de marketplace

Mercado Livre, Shopee, Amazon e "Outro". As tarifas vêm de um **catálogo servido pelo servidor, cacheado
localmente e embarcado como semente** — versionado por data (`catalogVersion`). Cada canal tem sua própria
gramática: faixas progressivas de comissão, taxa fixa que às vezes é percentual do preço, comissão por
**categoria** do anúncio, perfil do vendedor (CPF/CNPJ, alto volume), sobretaxas opcionais, e subsídios de
frete que são **do marketplace, não do vendedor**. Quando uma tarifa não é publicada pelo canal, o produto
**diz que não sabe** em vez de chutar.

## A fronteira do Premium — binária, sem cota

**Calcular e ver o detalhamento é sempre grátis e ilimitado.** Qualquer **persistência ou escala** é
Premium: catálogo, kits, orçamentos salvos, exportação, simulações de marketplace.

R$ 15,99/mês, ou R$ 155,88/ano (equivalente a R$ 12,99/mês). Pagamento pelo **Mercado Pago** (Pix ou
cartão) — o cartão nunca passa pelo app. Cancelar vale até o fim do período pago.

O upsell aparece **só na fronteira da persistência**, nunca em cima do cálculo, e nunca com padrão escuro.

## Os estados que o produto vive de verdade

Não são exceções raras — são o dia a dia de quem vende do celular, no galpão, com sinal ruim:

- **Offline.** O cálculo continua funcionando inteiro (o motor é local). Leitura vem do cache local, com
  aviso de que pode estar desatualizada. Escrita vai para uma **fila (outbox)** que drena quando a conexão
  volta — o vendedor vê quantos registros estão esperando.
- **Premium pausado.** A assinatura caducou: os dados **continuam lá e legíveis**, mas escrever está
  congelado. Nada é apagado, e a interface diz isso com calma.
- **Sessão expirada.** O login venceu. A fila **não é descartada** — fica esperando o vendedor entrar de
  novo, com um caminho visível de volta.
- **Carência / cobrança recusada.** O Premium continua **ativo** enquanto o prazo de recuperação corre.
- **Degradação.** Um item do catálogo que alimentava um produto foi apagado: o produto mostra a **última
  informação conhecida**, rotulada como tal, em vez de sumir ou zerar.
- **Plano não confirmado.** O servidor não respondeu sobre o plano — o produto diz "não sei", nunca
  presume nem "grátis" nem "Premium".

## O que este produto nunca faz

Não esconde de onde veio um número. Não mistura "o preço de então" com "o preço de hoje" sem rótulo.
Não mostra `R$ 0,00` quando o que ele quer dizer é "não sei". Não vende falha de rede como recurso pago.
Não cobra por um valor que a tela não mostrou.

---

# Contexto 2 — Onde esta peça vive

## O mapa funcional de Simulações salvas (cenários de marketplace)

### Simulações salvas (cenários de marketplace) — mapa funcional da área

**O que é.** Uma *simulação* é uma estratégia de venda guardada: a combinação de canais (Mercado Livre, Shopee, Amazon…), modalidade, categoria, taxas ajustadas à mão, markup e a base de custo que estavam na tela quando o vendedor salvou. Ela **não guarda preço**. Ao reabrir, o app recalcula tudo com os preços e as tarifas de hoje — é o oposto do Orçamento, que congela um número para sempre. Toda a copy da área existe para sustentar essa diferença ("Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." / "Recalculado com os preços de hoje"), e por regra **nenhum cartão de simulação mostra data nem dinheiro** — só nome, nota e um carimbo relativo ("Atualizado há 2 dias").

**Como o vendedor chega.** A área **não tem rota própria**: ela vive inteiramente como folhas (`Sheet` ancorado à direita, largura `min(92vw, 26rem)`, altura total, sobre um scrim) e blocos dentro da aba **Calcular** (`/calcular`). Decisão técnica registrada no código: uma sub-rota `/calcular/cenarios` abriria em branco no recarregamento (o app usa `base:'./'`, e qualquer rota de 2 segmentos morre no cold load). Três portas existem:
- **"Minhas simulações"** — botão fantasma no topo do `/calcular`, abre a folha da lista. Visível para **todo mundo**, inclusive grátis e deslogado.
- **"Salvar simulação"** — botão no rodapé do `/calcular`, abaixo do resultado. **Só existe com Premium ativo** (não é teaser, é ausência).
- **"Salvar simulação"** — o mesmo botão dentro da ficha de produto salvo do Catálogo (`/catalogo/produtos/$id`), que grava a simulação **referenciando aquele produto**.

**As rotas envolvidas.** `/calcular` (a única casa da área: lista, salvar, barra de contexto, resumo de kit, avisos) · `/catalogo` com `?produto=` e `/kits?id=` (destinos do botão "Abrir origem", quando a base de custo é um produto ou um kit do catálogo).

**O que a área guarda, e onde.** No **servidor** (Postgres, por usuário): nome, nota e o documento de configuração (`config`), com paginação *keyset* por `created_at DESC` e busca por nome. No **cache local IndexedDB, chaveado por uid**: uma cópia de leitura da lista não filtrada, pré-carregada antes da resposta do servidor e usada como fallback quando a rede falha; **purgada no logout**. Escrita **não tem outbox**: diferente de Orçamentos, salvar/renomear/duplicar/excluir offline **falha na hora, honestamente** — nunca entra em fila, nunca finge que salvou.

**De que depende.** Do **entitlement** vindo do servidor (`active` · `lapsed` · `none`) — o cliente só decora, quem barra é o servidor · do **catálogo de tarifas** servido + cacheado + com semente embutida (é ele que faz o recálculo "de hoje" mudar) · do motor **`pricing-core`** em TypeScript, que calcula no dispositivo, inclusive offline · da **sessão Firebase** (sem sessão não há lista) · e das entidades **produto** e **kit** do Catálogo, quando a base de custo é uma referência.

**O que ela alimenta depois.** Reaberta, a simulação **vira a calculadora**: os 17 campos escalares são repovoados e o cálculo roda ao vivo. Dali o vendedor pode **congelar um orçamento** (Histórico/Orçamentos) a partir da simulação — o orçamento nasce carimbado com a procedência `SCENARIO` (id + nome como estavam ao abrir). E pode **duplicar-para-ajustar**: a cópia nasce no servidor como "Cópia de {nome}" e passa a ser o objeto editado.

**Estados por situação:**
- **Grátis / deslogado** — a porta "Minhas simulações" aparece igual, mas a folha inteira vira um **teaser Premium** ("Salve suas simulações…" + "Assinar" + "A calculadora continua grátis."), e o subtítulo da lista é suprimido para não repetir a promessa. O botão "Salvar simulação" **não existe** no rodapé.
- **Premium ativo** — lista, busca, abrir, renomear, duplicar, excluir, salvar alterações: tudo liberado.
- **Premium pausado (lapsed)** — **leitura completa, escrita congelada**: abre e recalcula normalmente, mas os três ícones de cada cartão ficam desabilitados, um alerta "Premium pausado" aparece no topo da lista e a mesma frase se repete embaixo de cada cartão e na barra de contexto. Não há CTA de reativação dentro desses avisos.
- **Offline** — a lista é servida do cache com o alerta "Modo leitura offline"; o cálculo continua funcionando (o motor é local); qualquer escrita responde "Esta ação precisa de conexão." Quando lapso e offline coincidem, a justificativa do lapso vence.
- **Sessão expirada** — o 401 não apaga o cache; a área depende do banner global "Entrar de novo" para o vendedor voltar.

**Corte desktop.** O app tem um limiar de composição em **1280px** (`useIsWide`), usado hoje por Catálogo, Kits, Orçamentos e Conta (lista + ficha ao lado). **Nada da área de Simulações usa esse limiar** — em 1920px ela renderiza exatamente o layout de celular. O `/calcular` em si vira duas colunas a partir de 1024px, mas todos os blocos de simulação ficam **fora da grade**, em faixa única de largura total.

## O ponto exato de inserção desta peça

- **Onde vive:** Substitui o corpo INTEIRO da folha "Minhas simulações" (busca, alertas, cartões, paginação — tudo) logo abaixo do título, dentro do mesmo painel lateral direito de ≈416px. É o componente compartilhado `PremiumTeaser feature="SCENARIOS"`: contrato fechado de quatro elementos em coluna centralizada — título "Salve suas simulações" → subtítulo aprovado verbatim ("Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje.") → o bloco "Assinar" (ou "Entrar" quando deslogado) com a linha de preço → legenda "A calculadora continua grátis.". Sem ícone e sem cartão em volta.
- **Como o vendedor chega:** Pela MESMA porta de todo mundo: o botão "Minhas simulações" no topo do Calcular. Chega quem está deslogado e quem tem conta sem Premium (`status: "none"`) — nunca uma lista quebrada fingindo que a função existe.
- **Vizinhança imediata:** Acima: o título "Minhas simulações" da folha e o X de fechar. O subtítulo-promessa da lista é DELIBERADAMENTE suprimido aqui, para não repetir, coladas, duas frases dizendo a mesma coisa ("…com os preços de hoje"). Abaixo: o fim do painel. Por baixo do scrim, a calculadora — cujo teaser do seletor de catálogo está escondido justamente para não haver dois "Assinar" na mesma tela.
- **Dados que chegam (e o que ela devolve):** Recebe apenas dois booleanos derivados: sessão não autenticada, e entitlement `none`. Não recebe nenhuma amostra do que o Premium destrava aqui (nenhum cartão-exemplo, nenhuma contagem). Devolve o clique para o fluxo de assinatura/entrar.
- **O que acontece depois:** "Assinar" leva ao fluxo de checkout (Conta/billing); "Entrar" leva ao login. Voltando com Premium ativo, a MESMA folha passa a renderizar subtítulo + busca + lista (ou o estado vazio), e o botão "Salvar simulação" passa a existir no rodapé do Calcular.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

---

# Contexto 3 — Regras de marca e Design System (obrigatórias)

> Este bloco **não é inspiração, é contrato**. A marca, os tokens e os primitivos abaixo já existem e já
> estão implementados no produto. O desenho compõe com eles; não os substitui, não os recolore, não cria
> equivalente próprio. Quando algo genuinamente não existir no sistema, **diga explicitamente que é novo**
> em vez de introduzi-lo em silêncio.

## 1. Marca — Truth's Forge

**Personalidade:** confiante, precisa, energética, premium. Nunca corporativa-estéril, nunca grunge.
**Humor visual:** ousado, moderno, alto contraste, superfícies chapadas e foscas, espaço negativo generoso.

**Logo:** monograma da forja (lâmina + arco de faísca laranja + faixa curva roxa) + a marca nominal
empilhada **"TRUTH'S FORGE"**. O lockup horizontal é o primário; o símbolo sozinho serve para espaços
reduzidos (ícone, favicon, nav). Respeite o espaçamento livre (≥2,5× o módulo). **Nunca** deforme,
recolora ou aperte o logo.

**Grafismos:** kit de formas curvas derivadas do logo — *arco* (energia), *espada* (o resultado forjado),
*linha curva* (conexão), *onda* (divisor). Use **um** floreio orgânico por tela para quebrar a geometria;
ótimo em estado vazio e cabeçalho. **Nunca dois.**

## 2. Cor

| Papel | HEX |
|---|---|
| Roxo — assinatura (CTA, ativo, destaque) | `#7800ff` |
| Laranja — energia (secundário, badge) | `#f7931e` |
| Ciano — apoio (info, link) | `#15bddc` |
| Roxo profundo (pressionado) | `#5a16a6` |
| Âmbar profundo (pressionado) | `#bd6c0e` |
| Teal profundo (link no claro) | `#0b8196` |

**Regra de aplicação:** color-blocking **chapado, ZERO gradiente**. Planos grandes de preto/branco carregam
a estrutura; o acento saturado entra com parcimônia — **um acento por zona**. Texto sobre roxo é branco;
texto sobre laranja e ciano é **preto**.

**Tema escuro é o padrão da v1; o claro é first-class.** Use sempre o token semântico, nunca a cor crua —
é o que faz os dois temas funcionarem sozinhos:

`--bg-base` `--bg-subtle` `--bg-muted` `--bg-inverse` · `--surface-card` `--surface-raised`
`--surface-sunken` `--surface-overlay` · `--text-strong` `--text-body` `--text-muted` `--text-faint`
`--text-on-accent` `--text-on-energy` `--text-link` · `--border-subtle` `--border-default` `--border-strong`
`--border-accent` · `--accent` `--accent-hover` `--accent-active` `--accent-soft` `--accent-text` ·
`--energy` `--energy-hover` `--energy-contrast` · `--success` `--danger` `--info` `--warning`, cada um com
`-soft` (fundo) e `-text` (texto) · `--focus-ring`.

**Claro:** `--bg-base:#ffffff` · `--surface-card:#ffffff` · `--text-strong:#0b0c0f` · `--text-body:#1f2128`
· `--text-muted:#4d505c` · `--border-subtle:#d7d8e0` · `--accent-text:#7800ff` · `--text-link:#0b8196` ·
`--info-text:#0a6d80`.

**Escuro:** `--bg-base:#000000` · `--surface-card:#14151a` · `--surface-raised:#1f2128` ·
`--text-strong:#ffffff` · `--text-body:#e4e4ea` · `--text-muted:#8c8f9d` · `--border-subtle:#1f2128` ·
`--accent-text:#b79aff` · `--text-link:#15bddc` · `--focus-ring:#9a4bff`.

## 3. Tipografia

- **Peace Sans** — display e nome da marca, sempre **CAIXA ALTA + bold**. (Substituída por **Paytone One**
  enquanto o `.woff2` real não é embarcado.)
- **Lilita One** — títulos secundários, majoritariamente caixa alta.
- **Inter** — corpo, formulário, rótulos, e **todos os números**, com algarismos tabulares
  (`font-feature-settings:"tnum"`). **Não existe monospace** no sistema tipográfico.
- **Nunca abaixo de 12px.**

## 4. Geometria e movimento

- Grade de **4px**. Espaçamentos: 4·8·12·16·20·24·28·32·40·48·56·64px.
- Raios: `xs 6` · `sm 10` · `md 14` (campos e botões) · `lg 18` (cards) · `xl 24` (folhas e painéis herói) ·
  `2xl 32` · `pill 999` (chips, segmented).
- Alturas de controle: 36 / 48 / 56px. **Alvo de toque ≥44px, sempre.**
- Cards **foscos**: borda de 1px + sombra curta. Brilho roxo opcional em **um** CTA focal por zona.
- Movimento 130/190ms, ease-out, toque escala 0,97, respeita `prefers-reduced-motion`.
- Foco: **anel roxo de 3px**, `:focus-visible`, jamais removido.
- Ícones **Lucide**, traço 2px, por máscara CSS com `currentColor`. **Nenhum emoji.**

## 5. Primitivos que já existem — reutilize, não reinvente

Prefixo de classe `tf-`. Nomeie qual primitivo usa em cada parte do desenho.

`tf-btn` (`--primary --secondary --ghost --danger --danger-ghost --glow --sm --lg --loading`) ·
`tf-card` (`--flat --outline --accent --inverse --ghost --interactive --pad-sm/lg/none`) ·
`tf-field` + `tf-inputwrap` (`--sm --lg --error --disabled`) + `tf-input` (`--num`) · `tf-select` ·
`tf-switch` · `tf-segmented` (`--sm --md`) · `tf-badge` (`--info --success --danger --neutral`) ·
`tf-alert` (`--info --success --danger --neutral`) · `tf-toast` (`--info --success --danger`) ·
`tf-dialog` (`--sheet-bottom --sheet-right --sheet-left`) · `tf-price` (herói de preço:
`--lg --md --accent --energy --success --inverse --center --plain`) · `tf-brow` (linha do detalhamento:
`--accent --muted --negative --total`) · `tf-empty` · `tf-spinner` · `tf-icon` · `tf-logo` (`--full --mark`)
· `tf-grafismo` · `tf-title` · `tf-display` · `tf-tnum`.

## 6. Acessibilidade — WCAG 2.2 AA, não negociável

- Contraste ≥4,5:1 **medido contra o fundo real do elemento**, não contra o card atrás dele. Um texto de
  status dentro de um badge tem como fundo o `*-soft` já composto sobre o card — é esse o pior caso, e é
  esse que o olho vê.
- Alvo de toque ≥44px. Todo campo rotulado. Foco visível e nunca removido.
- Ordem de leitura coerente com a ordem visual; nada essencial comunicado só por cor.

## 7. Conteúdo e honestidade — as regras que este produto paga caro para manter

1. **Todo número tem procedência.** Valor vindo de tabela de tarifa, catálogo salvo ou cálculo congelado
   diz de onde veio. "Preço de então" e "preço de hoje" **nunca** se misturam sem rótulo.
2. **Degradação é dita, não escondida.** Item apagado ou indisponível mostra a última informação conhecida
   com legenda honesta — nunca campo vazio silencioso, nunca `R$ 0,00` que na verdade é "não sei".
3. **Falha de rede nunca é upsell.** Erro de conexão jamais aparece como "isso é Premium".
4. **A frase honesta mora em elemento de largura total**, nunca dentro de um `placeholder` — ele corta onde
   a caixa acaba, e a explicação some. Placeholder carrega só número ou exemplo.
5. **Dinheiro em pt-BR:** `R$ 1.234,56` — separador de milhar, vírgula decimal, sempre com centavos.
   Unidades como sufixo do campo: `g`, `kg`, `kWh`, `h`, `%`.
6. **Upsell sem padrão escuro:** sem contagem regressiva falsa, sem "última chance", sem esconder o fechar,
   sem cobrar por valor que a tela não mostrou.
7. **Nove estados por superfície interativa:** repouso · foco · hover · pressionado · desabilitado ·
   carregando · vazio · erro · offline. Um desenho sem os nove está incompleto.

## 8. O que não fazer

Sem gradiente por padrão. Sem esqueuomorfismo. Sem cor fora da paleta. Sem deformar ou recolorir o logo.
Sem enterrar o resultado. Sem abrir todos os campos avançados de uma vez (intimida o leigo). Sem emoji.
Sem erro cru ou stack para o usuário. Sem inventar primitivo que já existe com outro nome.

---

# O pedido

# Porta honesta do Premium dentro da folha "Minhas simulações"

## O que desenhar

O painel lateral "Minhas simulações" é aberto pela calculadora (botão no cabeçalho da tela Calcular:
ícone `boxes` + "Minhas simulações"). Ele é visível para TODO MUNDO — inclusive quem nunca pagou e quem
nem entrou. Para o vendedor grátis ou deslogado, essa MESMA folha não mostra lista nenhuma: o conteúdo
inteiro vira uma porta de venda honesta — título, promessa, linha de preço, "Assinar Premium" e a legenda
que garante que a calculadora continua grátis. É a vitrine mais importante da funcionalidade de
Simulações, e ela vive espremida dentro de um painel deslizante à direita, sobre a calculadora que o
vendedor estava usando. Desenhe esse painel inteiro — a folha e o bloco de venda dentro dela.

## Por que este prompt existe

O bloco de venda foi desenhado no canvas 018, mas só para PÁGINAS de aba a 1920px: dentro de um `tf-card`
com padding 56/40 e com um ícone (troféu/relógio, 26px) acima do título. Nada disso existe aqui. O
componente construído é um contrato fechado de 4 elementos, SEM ícone e SEM card, e o canvas 018 não cobre
nem Calcular nem Simulações — logo, ninguém desenhou como esse bloco se comporta dentro de um painel
lateral de ~416px de largura, nem a 390px. Foi inferido também: a supressão condicional do subtítulo da
folha e a ausência de qualquer amostra do que o Premium destrava aqui.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo, dentro da folha (`SheetContent`, ancorada à DIREITA, largura
`min(92vw, 26rem)` = no máximo **416px** — a mesma no mobile e no 1920, ocupando a altura toda da tela):

| Elemento | Texto literal hoje | Observação |
| --- | --- | --- |
| Título da folha | "Minhas simulações" | maiúsculas, fonte de título, com o "X" de fechar (44×44px) no canto |
| Subtítulo da folha | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | → **NÃO renderiza para grátis/deslogado** (supressão da correção 016/T010-A1, porque repetia a promessa do subtítulo do teaser logo abaixo) |
| Título do teaser | "Salve suas simulações" | texto aprovado pelo dono, não parafrasear |
| Subtítulo do teaser | "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." | texto EXATO homologado (016 US1-AC5) |
| Linha de preço | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" | tamanho de legenda, cor apagada, sobre um filete separador; quebra em duas linhas quando não cabe |
| Botão | "Assinar Premium" | primário; deslogado passa por entrar antes de chegar na oferta |
| Legenda final | "A calculadora continua grátis." | tamanho de legenda, cor apagada |

Tudo centralizado, largura máxima `min(28rem, 100%)`, espaçamento uniforme entre os quatro elementos.

→ **Problema 1:** sem ícone e sem card, o bloco fica como texto solto no meio de um painel alto e vazio —
o vendedor grátis vê um painel de altura inteira com um punhado de linhas centralizadas no topo.
→ **Problema 2:** não há NENHUMA amostra do que o Premium destrava. A folha promete "reabrir e comparar"
e mostra zero exemplo de como uma simulação salva se parece.
→ **Problema 3:** o botão "Assinar Premium" fica lado a lado com a linha de preço quando cabe, e cai para
baixo quando não cabe — a hierarquia muda sozinha conforme o texto, sem ninguém ter desenhado as duas.
→ **Problema 4 (buraco real de estado):** a folha só decide entre teaser e lista depois que o plano
carrega. Enquanto carrega, um vendedor grátis vê a LISTA (spinner, depois vazio/erro) e só então a porta
aparece. E se a verificação do plano falhar, não existe estado nenhum aqui — o Kits já tem as frases
"Verificando seu plano…" e "Não foi possível verificar seu plano." + "Tentar novamente"; Simulações não.

## Conteúdo e dados reais

- Preços verdadeiros e de fonte única: mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, apresentado
  apenas pelo equivalente **R$ 12,99/mês**. **R$ 191,88 nunca aparece riscado** — não existe "de/por".
- Destinos: assinar leva à oferta dentro de Conta (`/conta?assinar=1`), nunca direto a um checkout —
  mensal e anual têm preços diferentes e a escolha é do vendedor. Deslogado passa pelo entrar
  preservando a intenção (volta para a oferta, não para a home).
- O que a lista mostraria se o vendedor fosse Premium (útil como base de uma amostra, se o dono aprovar):
  cartões com nome da simulação (uma linha, com reticências), nota opcional (2 linhas, com marcador de
  corte), e "Atualizado há 2 dias" — NUNCA uma data-alegação. Acima da lista, um campo de busca com
  placeholder "Buscar por nome…".
- Nada nesta peça mostra dinheiro calculado. Se a amostra for aprovada, o número plausível de um preço
  sugerido nesta base é **R$ 24,24**.

## Estados obrigatórios

1. **Deslogado (repouso)** — os 4 elementos acima; o botão leva a entrar e depois à oferta. Sem subtítulo
   da folha.
2. **Grátis / nunca assinou (repouso)** — visualmente idêntico ao anterior; o botão vai direto à oferta.
   Esses dois casos NÃO se distinguem hoje na tela — desenhe assumindo que continuam iguais.
3. **Verificando o plano** — hoje inexistente e necessário. Mostre um estado calmo, com a frase que já
   existe no produto: "Verificando seu plano…". Nunca a lista vazia nesse intervalo.
4. **Falha ao verificar o plano** — "Não foi possível verificar seu plano." + "Tentar novamente".
   Falha de rede JAMAIS pode aparecer como "você não é Premium".
5. **Foco de teclado** no botão "Assinar Premium" e no "X" de fechar — anel visível sobre o fundo do
   painel, não sobre o fundo da página.
6. **Hover e pressionado** do botão primário.
7. **Offline** — o teaser continua legível; se o botão "Assinar Premium" não puder funcionar sem conexão,
   isso precisa ser DITO, não descoberto no toque (ver Perguntas em aberto).
8. **Premium ativo** (contraste, uma prancheta só) — a mesma folha com subtítulo "Estratégias salvas.
   Cada uma recalcula com os preços de hoje quando você abre.", busca e 3 cartões. Serve para provar que
   a porta e a lista têm o mesmo esqueleto e o mesmo respiro.
9. **Premium pausado** (contraste, opcional) — alerta informativo "Premium pausado" com o corpo "Suas
   simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou
   excluir, reative o Premium." Este NÃO é o teaser: pausado vê a lista.

## Viewports

- **Mobile 390px** — o painel ocupa `92vw` (~359px) e desce a altura inteira. É o caso em que a linha de
  preço + botão não cabem lado a lado.
- **Desktop 1280px** — o painel continua com os mesmos **416px**, agora ancorado à direita sobre a
  calculadora, com muito espaço vazio embaixo. É exatamente o caso que ninguém desenhou.
- **Desktop 1920px** — inclua uma prancheta só para mostrar a proporção: o painel NÃO cresce, e é essa
  desproporção (vitrine de venda de 416px numa tela de 1920) que o desenho precisa resolver ou justificar.

## Regras que o desenho não pode quebrar

- Freemium é binário: ou é grátis, ou é Premium. Nada de "3 grátis por mês", contadores, prazos ou
  urgência ("últimas horas", "oferta acaba") — não existe promoção neste produto.
- A legenda "A calculadora continua grátis." é uma frase de honestidade: ela vive em elemento de largura
  cheia, **nunca dentro de um placeholder** e nunca truncada.
- Nenhum número inventado. Só R$ 15,99/mês e o equivalente R$ 12,99/mês; nada riscado.
- Falha de rede nunca é vendida como "não é premium".
- Se houver amostra do que o Premium destrava, ela precisa ser visivelmente uma AMOSTRA (rotulada como
  exemplo) — nunca um cartão que pareça um dado real do vendedor.
- Alvo de toque ≥44px no "Assinar Premium" e no "X".
- Contraste medido contra o fundo REAL do painel (superfície de card sobre o scrim), não contra o fundo
  da página.

## Armadilhas já pagas neste projeto

- **Transbordo horizontal medido:** este mesmo bloco já reivindicou ~506px numa faixa de 426px, jogando
  131px para fora da tela — a largura máxima precisa poder ENCOLHER, nunca só limitar.
- **Botão nascendo fora da viewport:** 100,5px de transbordo numa superfície de cobrança, com o botão
  fora da tela. A linha preço+botão precisa ser desenhada nas DUAS formas (lado a lado e empilhada).
- **Texto ocluso passa em teste:** um elemento pode estar visível para o teste e coberto/cortado na tela.
  Desenhe as caixas, não só o texto.
- **Placeholder que corta a frase honesta:** frase honesta nunca em placeholder.
- **Promessa colada duas vezes:** foi por isso que o subtítulo da folha some no grátis. Se o desenho
  trouxer o subtítulo de volta, ele precisa dizer coisa DIFERENTE do subtítulo do teaser.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. Painel completo, deslogado/grátis, **390px**.
2. Painel completo, deslogado/grátis, **1280px** (com a calculadora atrás e o scrim).
3. Proporção a **1920px**.
4. Estados "Verificando seu plano…" e "Não foi possível verificar seu plano.".
5. Detalhe da linha de preço + botão nas duas formas (lado a lado e empilhada) com foco, hover e
   pressionado.
6. Contraste: a mesma folha com Premium ativo (subtítulo + busca + 3 cartões).

Reutilize os primitivos existentes, sem criar novos: a folha é o `tf-dialog--sheet-right` com
`tf-dialog__title` e `tf-dialog__desc`; o bloco de venda é o `tf-premium-teaser`
(`__title` / `__subtitle` / `__caption`) com a faixa `tf-teaser-upgrade` (`__price` + `tf-btn tf-btn--primary`);
o ícone, se entrar, é o `tf-empty__icon` (56px, fundo de acento) já usado no canvas 018; os estados de
verificação usam `tf-alert`; os cartões da folha Premium usam `tf-card` com padding pequeno. Se o desenho
precisar do card em volta do teaser (como no canvas 018), use `tf-card` — e diga qual padding vale a
416px, já que 56/40 foi desenhado para coluna larga.

## Perguntas em aberto para o dono

1. O bloco de venda dentro da folha deve ganhar o **ícone** e o **card** do canvas 018, ou o painel
   estreito pede uma forma própria (sem card, texto solto)? Isso decide se o componente fechado de 4
   elementos muda.
2. Vale mostrar uma **amostra do que o Premium destrava** (ex.: dois cartões de simulação de exemplo,
   apagados e rotulados "exemplo")? É acréscimo de produto, não de layout — e hoje não existe nada.
3. No **desktop**, "Minhas simulações" deve continuar sendo um painel de 416px à direita, ou virar uma
   superfície mais larga (o canvas 018 desenhou as outras abas em página)? A porta de venda ficar em
   416px numa tela de 1920 é escolha ou herança?
4. **Deslogado e grátis** devem continuar vendo exatamente a mesma tela, ou o deslogado merece um
   "Entrar" separado do "Assinar Premium"?
5. **Offline**: o "Assinar Premium" deve aparecer desabilitado com motivo dito, ou permanecer ativo e
   falhar honestamente depois?

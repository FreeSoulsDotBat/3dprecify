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

- **Onde vive:** São DUAS folhas laterais direitas distintas para a mesma ação, com o mesmo título "Renomear simulação". (1) A da LISTA: aberta por cima da folha "Minhas simulações" (folha sobre folha, dois scrims), conteúdo = campo **Nome** + campo **Nota** (textarea de 3 linhas) + parágrafo vermelho de erro quando houver + botão "Salvar alterações". (2) A da BARRA DE CONTEXTO: aberta por cima da rota `/calcular`, conteúdo = SOMENTE o campo **Nome** + botão "Salvar alterações". A nota é inacessível por este caminho.
- **Como o vendedor chega:** Caminho 1: ícone de lápis na linha de ações de um cartão, dentro da folha da lista. Caminho 2: botão "Renomear" (ghost) na faixa de botões da barra de contexto, com a simulação já aberta na calculadora. Ambos exigem escrita liberada — com Premium pausado ou offline os dois gatilhos ficam desabilitados.
- **Vizinhança imediata:** A variante da lista fica sobre a lista (que continua montada por baixo, com os cartões visíveis nas bordas do scrim); a variante da barra fica sobre a calculadora com a simulação aberta. Em ambas, o X de fechar no topo direito, sobre o título, e nada abaixo do botão de salvar — o restante do painel é vazio.
- **Dados que chegam (e o que ela devolve):** Recebem o nome atual (e, na variante da lista, a nota atual) já preenchidos no campo. Validam 120 caracteres para o nome e 500 para a nota. Devolvem um `PATCH` que altera APENAS nome/nota — nunca a configuração de canais.
- **O que acontece depois:** Em sucesso: toast "Simulação renomeada.", a folha fecha e o novo nome aparece no cartão (variante 1) ou na linha "Simulação: {nome}" da barra de contexto (variante 2). Em erro: a variante da lista mostra a frase honesta em vermelho dentro da própria folha, com os valores intactos; a variante da barra, quando o nome está vazio ou longo demais, simplesmente NÃO FAZ NADA — não fecha, não avisa. E o rótulo "Salvar alterações" do botão é o mesmo rótulo que, na barra de contexto, nomeia outra ação (o salvamento da configuração inteira).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Renomear simulação — uma folha só, hoje são duas

## O que desenhar

A folha (painel lateral) que abre quando o vendedor renomeia uma simulação salva. Ela é alcançada por
**dois caminhos diferentes** dentro de Simulações: (1) pelo cartão da lista "Minhas simulações", tocando
no ícone de lápis da linha de ações; (2) pela barra de contexto da simulação já aberta na calculadora
(a faixa "Simulação: {nome}" com os botões `Abrir origem · Renomear · Duplicar · Salvar alterações`).
O usuário é o vendedor que salvou dez estratégias e não lembra mais qual é qual — renomear é como ele
arruma a prateleira. É uma peça pequena, de trinta segundos de uso, e por isso mesmo ela precisa ser
**a mesma peça nos dois caminhos**. Desenhe UMA folha canônica, e desenhe as duas origens ao redor dela
para mostrar de onde ela nasce.

## Por que este prompt existe

Ninguém desenhou renomear. Cada PR inferiu a sua tela a partir do texto do requisito e o resultado são
**duas folhas divergentes para a mesma ação**: a da lista tem Nome + Nota e mostra erro; a da barra de
contexto tem só o Nome (a Nota fica inalcançável por esse caminho) e **falha em silêncio** — se o campo
estiver vazio ou passar de 120 caracteres, o botão não faz nada, não mostra nada, não fecha nada. Pior:
as duas usam o rótulo **"Salvar alterações"**, que na barra de contexto é o nome de OUTRA ação (gravar a
configuração inteira da simulação). A mesma frase significa duas coisas a dois centímetros de distância.
O canvas 018 tem um botão parecido ("Editar rótulo", ficha de Orçamentos), mas é outro objeto e o canvas
não desenha a folha que ele abre; o protótipo de 2026-07-02 não tem renomear em lugar nenhum. Não existe
autoridade que diga qual das duas está certa — e é exatamente por isso que existem duas.

## O que já existe hoje (não invente do zero — corrija)

**Folha A — a partir do cartão da lista** (`scenarios-list-sheet.tsx`): título `"Renomear simulação"`,
campo `"Nome"` obrigatório, campo `"Nota (opcional)"` como área de texto de 3 linhas, um parágrafo de erro
em vermelho solto logo acima do botão, e o botão `"Salvar alterações"`.

**Folha B — a partir da barra de contexto** (`scenario-context-bar.tsx`): título `"Renomear simulação"`,
campo `"Nome"` obrigatório, botão `"Salvar alterações"`. Nada mais.

| Elemento | Folha A (lista) | Folha B (barra) | → problema |
|---|---|---|---|
| Título | "Renomear simulação" | "Renomear simulação" | igual, é a única coisa que bate |
| Nome | texto, obrigatório, limite 120 | texto, obrigatório, limite 120 | → aceita digitar 121 caracteres (o campo trava só em 121) e não há contador em nenhuma das duas |
| Nota | área de 3 linhas, limite 500 | **ausente** | → a mesma ação edita a nota num caminho e não no outro |
| Erro de validação | parágrafo vermelho solto, abaixo dos campos, longe do campo culpado | **nenhum** | → na B o botão simplesmente não responde: falha muda |
| Botão | "Salvar alterações" | "Salvar alterações" | → na barra de contexto esse é o rótulo do PUT da configuração inteira, logo atrás da folha |
| Erro de rede | dentro da folha | **atrás da folha**, no alerta da barra de contexto, coberto pelo painel | → o vendedor vê o botão parar de girar e nada acontecer |

→ Um detalhe herdado das duas: o rótulo do campo de nota sai na tela como **"Nota (opcional) opcional"** —
o texto já traz "(opcional)" e o marcador de campo opcional do design system acrescenta a palavra de novo.
Resolva no desenho: ou o rótulo é `"Nota"` com o marcador, ou é `"Nota (opcional)"` sem ele.

**Ao redor.** No cartão da lista: nome em uma linha com reticências, nota em duas linhas com reticências,
`"Atualizado há 2 dias"`, e uma fileira de três botões-ícone à direita (lápis · copiar · lixeira). Na barra
de contexto: `"Simulação: Camiseta 3D — Shopee agressivo"`, a legenda `"Recalculado com os preços de hoje"`,
o selo `"Alterações não salvas"`, o botão `"Fechar simulação"` à direita, e a fileira
`Abrir origem · Renomear · Duplicar · Salvar alterações`.

## Conteúdo e dados reais

- **Nome** — texto, obrigatório, até **120 caracteres**. Exemplo real: `Camiseta 3D — Shopee agressivo`.
  Adversarial: `Suporte de fone articulado com base emborrachada — Mercado Livre Clássico sem frete grátis`
  (93 caracteres, precisa caber na folha de 390px sem estourar).
- **Nota** — texto livre, opcional, até **500 caracteres**. Exemplo real:
  `Margem apertada de propósito, só para queimar estoque de PLA cinza.`
- **Erros literais, já homologados:** `"Dê um nome à simulação."` · `"Máximo de 120 caracteres."` ·
  `"Máximo de 500 caracteres."`
- **Erro de escrita sem conexão:** `"Esta ação precisa de conexão."`
- **Sucesso:** a folha fecha e sai um aviso curto de sucesso — `"Simulação renomeada."` — e só depois de
  a gravação ter acontecido de verdade.
- A folha **não mostra dinheiro nenhum**: renomear não toca preço, canal nem base de custo. Se o desenho
  quiser lembrar o vendedor de qual simulação ele está renomeando, o material honesto disponível é o nome
  anterior e a linha `"Atualizado há 2 dias"` — nunca um preço recalculado ali dentro.

## Estados obrigatórios

1. **Repouso** — nome preenchido com o valor atual, nota preenchida com a nota atual, botão habilitado.
2. **Foco** no campo de nome (anel de foco visível sobre o fundo do painel, não sobre o fundo da página).
3. **Hover** e **pressionado** no botão primário e nos botões-ícone do cartão de origem.
4. **Nome vazio** — `"Dê um nome à simulação."` ancorado NO campo de nome, não solto no rodapé.
5. **Nome longo demais** — `"Máximo de 120 caracteres."` + a decisão de contador (ver perguntas).
6. **Nota longa demais** — `"Máximo de 500 caracteres."` ancorado no campo de nota.
7. **Gravando** — botão em carregamento, campos ainda legíveis, folha não fecha antes da resposta.
8. **Falhou a gravação** — mensagem honesta DENTRO da folha, valores digitados intactos, folha aberta.
9. **Sem conexão** — `"Esta ação precisa de conexão."`; hoje o botão "Renomear" nas duas origens já nasce
   desabilitado offline, com a razão escrita por perto: desenhe o botão desabilitado + a frase.
10. **Premium pausado** — mesma trava, com a frase existente:
    `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` A simulação continua
    abrindo e recalculando; só a escrita congela — o desenho tem que dizer isso, não sugerir perda.
11. **Sucesso** — folha fechada, o nome novo já visível na lista/na barra, aviso de sucesso.

Não existe estado vazio nem estado degradado nesta peça: ela só abre sobre uma simulação que existe.

## Viewports

- **390px (mobile)** — obrigatório. O painel ocupa 92% da largura (≈358px) ancorado à direita, altura
  cheia, com rolagem própria.
- **1280px (desktop)** — obrigatório. O mesmo painel fica com 416px fixos na borda direita, sobre a tela
  da calculadora; a barra de contexto e o cartão da lista continuam visíveis por trás do véu, e é
  justamente aí que a colisão de rótulo com o "Salvar alterações" da barra fica visível. Desenhe essa
  sobreposição em uma prancheta — é o argumento do prompt. 1920px não acrescenta nada: o painel não cresce.

## Regras que o desenho não pode quebrar

- **Nenhuma ação falha em silêncio.** Todo caminho que não grava tem que dizer o motivo na tela.
- **O aviso de sucesso só existe depois da gravação real.** Nada de confirmar otimista.
- **Falha de rede nunca é vendida como limite de plano** — e limite de plano nunca é disfarçado de erro
  técnico. São duas frases distintas e já escritas; use-as literalmente.
- **Premium pausado não some com nada**: a frase fala em reativar, nunca em perder simulações.
- A frase honesta mora em texto de verdade, **nunca dentro do campo como placeholder** — placeholder é
  cortado pela largura do campo e some ao digitar.
- **Um rótulo, um significado.** Nesta funcionalidade não pode existir duas ações diferentes chamadas
  "Salvar alterações".
- Alvos de toque **≥ 44px** — inclusive os três botões-ícone do cartão, que hoje moram lado a lado.
- Contraste medido contra o fundo real do painel (que é mais claro que o fundo da página), não contra o
  fundo da página.

## Armadilhas já pagas neste projeto

- **Texto que estoura a coluna.** Um nome de 120 caracteres sem espaço nenhum já quebrou a lista antes; o
  cartão só ficou correto depois de ganhar quebra em qualquer ponto. Mostre o nome longo no campo, no
  cartão e no título da barra de contexto. No painel de 358px já houve botão nascido fora da viewport.
- **Texto ocluso passa em teste.** Um erro renderizado atrás do painel aberto (que é exatamente o que a
  folha B faz hoje com o erro de rede) satisfaz qualquer verificação de conteúdo e não é visto por
  ninguém. O desenho precisa deixar explícito onde cada mensagem aparece em relação ao painel.
- **Painel que fecha e trava a página.** Já custou um app congelado nesta base: o conteúdo do painel não
  pode sumir no mesmo instante em que ele fecha. É restrição de implementação, mas nasce do desenho da
  transição de fechamento — desenhe o fechamento como um estado, não como um corte.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como cidadão de primeira classe (pelo menos a prancheta
1 e a 5 nos dois temas):

1. **Folha canônica em repouso, 390px** — com os valores reais do exemplo.
2. **Folha canônica em repouso, 1280px**, sobreposta à calculadora com a barra de contexto visível atrás.
3. **Erros** — nome vazio, nome longo demais, nota longa demais (390px).
4. **Gravando + falhou a gravação** (390px), com a mensagem dentro da folha.
5. **As duas origens** — o cartão da lista com a fileira de ícones, e a barra de contexto com os quatro
   botões — incluindo os estados **sem conexão** e **premium pausado** com a razão escrita.

Reutilize os primitivos existentes, sem inventar componente novo: o painel é o **Sheet ancorado à direita**;
o título é o **título de folha**; cada campo é o **Field** (com rótulo, marcador de obrigatório/opcional e
o slot de erro do próprio Field — é lá que o erro deve morar, não num parágrafo solto); os campos são
`tf-input` (o de nota em área de texto de 3 linhas); o botão de confirmar é o **Button primário**, os do
cartão são **Button ghost pequeno com ícone**; a razão da trava é texto secundário; o erro de escrita é o
**Alert de tom perigo**; o aviso de sucesso é o **toast de tom sucesso**; o selo de alterações não salvas
é o **Badge neutro**.

## Perguntas em aberto para o dono

1. **A folha canônica edita a Nota também quando aberta pela barra de contexto?** Unificar significa que
   renomear pela barra passa a poder mexer na nota (mais consistente, mais campo numa ação que se chama
   "renomear"). Alternativa: a folha só tem Nome, e editar a nota vira outra porta.
2. **Qual é o rótulo do botão de confirmar?** "Salvar alterações" está ocupado pela gravação da
   configuração. Candidatos: "Salvar nome", "Renomear", "Salvar". A escolha muda a largura do botão nos
   dois temas e no painel de 358px.
3. **Contador de caracteres: mostrar sempre, só ao se aproximar do limite, ou nunca?** Hoje não existe
   nenhum, e o campo deixa digitar um caractere além do limite só para conseguir acusar o erro.
4. **Apagar a nota na folha significa apagar a nota da simulação?** Hoje, pelo caminho da lista, esvaziar
   a área de texto remove a nota de verdade — se isso é o comportamento desejado, o desenho deve avisar; se
   não é, precisa de uma ação explícita de remover.

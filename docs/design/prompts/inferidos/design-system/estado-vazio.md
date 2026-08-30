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

## O mapa funcional de Primitivos do Design System

### O que é esta área

Não é uma aba nem uma tela. É o **vocabulário visual** que as cinco abas do Precifica3D — Calcular · Catálogo · Kits · Orçamentos · Conta — falam. Vive em `apps/web/src/shared/ui/` e é exportado por um único barril (`index.ts`, o ÚNICO barril permitido no app, ADR-0007/A38): 20 primitivos + 2 lojas de estado (tema e menu recolhido). Nenhum deles tem rota. O vendedor nunca "vai ao design system" — ele encosta nele a cada toque.

### Como o vendedor chega

Por toda parte. Um caminho típico de primeira sessão: abre `/calcular` (grátis, sem login), digita gramas num **NumberField** dentro de um **Field**, lê a explicação de como a conta é feita num **InfoTip ⓘ**, escolhe o canal num **Select** nativo, vê o resultado num **PriceHero** e a conta aberta numa pilha de **BreakdownRow**, tudo dentro de **Cards**. Ao tentar SALVAR qualquer coisa, encontra o teaser Premium; assinando, ganha `/catalogo`, `/kits`, `/historico` — e ali o mesmo vocabulário reaparece em outra combinação: **EmptyState** na primeira visita, **Sheet** vindo da direita para cadastrar, **Dialog** central para confirmar exclusão, **Toast** confirmando, **Spinner** enquanto a rede responde, **Badge** dizendo o estado, **Alert** dando a notícia ruim.

### Rotas onde os primitivos aparecem

`/` · `/calcular` · `/catalogo` (+ `/catalogo/produtos/novo` e `/catalogo/produtos/$productId`) · `/kits` · `/historico` (+ `/historico/$snapshotId`) · `/conta` · `/sign-in` · `/privacidade`. O casco (`app/app-shell.tsx`) monta banner offline, banner de sessão expirada, TopBar, AppNav (TabBar no celular / barra lateral no desktop) e o **Toaster** (uma vez, em `app/providers.tsx`).

### O que a área guarda

Quase nada — e é de propósito. Três estados vivem aqui: a fila do **Toast** (zustand, em memória, some no refresh), o **tema** (`theme-store`, localStorage) e a **preferência de menu recolhido** (`nav-rail-store`, por aparelho, só vale ≥1280px). Nenhum primitivo fala com servidor, cache uid-keyed, outbox ou entitlement: quem sabe de plano, rede e dinheiro são as *features*, que passam texto e estado já resolvidos para dentro da peça.

### De que depende

Dos **tokens de design** (`src/styles/tokens/*` — cor, espaço, raio, sombra, anel de foco, `--touch-min: 44px`, `--tabbar-h`, `--sidebar-w`), do **Radix** para os três primitivos com acessibilidade não trivial (Dialog/Sheet, Popover do InfoTip, Switch), e do dicionário pt-BR (`shared/i18n/messages.pt-br`) só para os rótulos genéricos ("Fechar", "Notificações"). Formatação de dinheiro vem de `shared/lib/decimal-ptbr` (`formatDecimal`/`parseDecimal`) — o **pricing-core** calcula, o DS só mostra.

### O que ele alimenta

Tudo. O `NumberField` reescreve o próprio valor ao perder o foco (máscara de milhar pt-BR) e devolve isso ao formulário; o `Field` decide se a mensagem embaixo do campo é dica, **aviso de plausibilidade** (azul, não recusa) ou **erro** (vermelho, recusa); o `PriceHero` é o número que vira orçamento congelado; o `Card` clicável da lista mestre é o que seleciona a ficha à direita no desktop.

### Como muda por estado

- **Grátis** — o DS não sabe que é grátis. As features trocam o conteúdo: `EmptyState` vira teaser, `Switch` de canais fica **desabilitado e falso**, botões de salvar somem.
- **Premium** — as mesmas peças com dados reais; `Badge` verde no plano, `Sheet` de cadastro liberada.
- **Premium pausado (lapsed)** — listas ficam em leitura: `Alert` de aviso no topo, cartões ganham uma linha "somente leitura", ações destrutivas desaparecem.
- **Offline** — calcular funciona inteiro (o motor é local); escrever entra na fila e o `Badge` do item diz "na fila"; o `Toast` confirma o enfileiramento, não o salvamento.
- **Sessão expirada** — banner fixo no topo do casco com "Entrar de novo"; a fila NUNCA é purgada; `Dialog` central bloqueia a saída se houver pendências.
- **Largura** — abaixo de 1280px é celular (`useIsWide()` retorna false sem `matchMedia`); acima, o Catálogo vira mestre-detalhe e o tema vira controle segmentado. Os primitivos em si **não têm ponto de corte nenhum**: só o Toaster (768px) e o Switch (`prefers-reduced-motion`) declaram `@media` em toda a pasta.

## O ponto exato de inserção desta peça

- **Onde vive:** `shared/ui/empty-state.tsx` — bloco centrado com `max-width: 28rem`, `padding --space-10`: quadrado arredondado de 56px com fundo `--accent-soft` e ícone Lucide de 28px dentro, título, descrição e uma ação opcional. Aparece em **10 pontos**: três em `/catalogo` (`catalog-panel.tsx` — lista vazia de filamentos, de impressoras e o **vazio da BUSCA**), três em `/historico` (`historico-page.tsx`), dois na lista de simulações (`scenarios-list-sheet.tsx`), um em `/kits` (`bom-page.tsx`) e um na página 404 (`not-found-page.tsx`).
- **Como o vendedor chega:** É a PRIMEIRA tela que o vendedor recém-assinante vê em Catálogo, Kits, Orçamentos e Simulações — chega vindo do teaser Premium, acabou de pagar e ainda não cadastrou nada. O vazio da busca chega por outro caminho: ele digitou um termo no campo de busca do mestre-detalhe e nada casou — e esse segundo vazio **só existe acima de 1280px** (`catalog-panel.tsx:280`).
- **Vizinhança imediata:** No lugar exato onde a lista estaria. No Catálogo desktop, ocupa a coluna esquerda do mestre-detalhe, abaixo da barra de ferramentas (busca + contagem + botão "Novo …") e ao lado da ficha de 560px à direita — e, com `max-width: 28rem` dentro de uma coluna que pode ter mais de mil pixels, fica um bloco pequeno perdido no meio. No celular, ocupa o corpo inteiro entre o cabeçalho da aba e a barra de abas do rodapé.
- **Dados que chegam (e o que ela devolve):** `icon` (um nome do conjunto Lucide — o primitivo NÃO tem slot de arte, só de ícone), `title`, `description` e `action`. O vazio da busca recebe uma cópia diferente do vazio do catálogo, de propósito: existem itens salvos, só o filtro não achou — dizer "nenhum filamento salvo" seria mentira sobre os dados do vendedor. Sua ação é um `Button variant="secondary" size="sm"` que limpa a busca.
- **O que acontece depois:** Da lista vazia, a ação leva ao cadastro (a folha lateral do Catálogo, o compositor de kits, o formulário de orçamento). Do vazio de busca, "limpar busca" devolve a lista inteira e a ficha da direita reaparece com o primeiro item. Assim que o primeiro item existe, o `EmptyState` desmonta para sempre naquela seção.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Estado vazio (`tf-empty`) — a arte que virou ícone, e o vazio da busca

## O que desenhar
O bloco centrado que ocupa o lugar de uma lista quando não há nada para listar. É a **primeira tela** que o vendedor novo vê em Catálogo (Filamentos · Impressoras · Produtos · Kits), em Kits (o compositor sem peças), em Orçamentos e em Simulações — e reaparece, com outra voz, quando ele **busca e não acha**, quando a conta **não tem direito** ao recurso, e quando o painel de detalhe do desktop não tem item selecionado. Uma peça só, cinco papéis: boas-vindas, filtro vazio, porta fechada, painel sem seleção e página inexistente (404). Ela precisa parecer **intencional**, nunca um erro de carregamento.

## Por que este prompt existe
O kit de desenho pedia **arte** no vazio — o `Grafismo` do produto — e o código entregou um quadrado arredondado de 56px com fundo `--accent-soft` e um ícone de 28px dentro. A peça não tem slot de arte: só `icon`. O `Grafismo` perdeu as props de cor e tamanho que o kit usava e sobrou em **duas** telas do produto inteiro (404 e erro), sempre **fora** do bloco vazio, nunca dentro. Isso é divergência declarada, não omissão: o canvas do dono também desenha `tf-empty` na forma de ícone — mas naquele canvas há um único vazio, e ele não pertence a nenhuma das quatro abas. O que **ninguém desenhou nunca** é: o vazio da BUSCA sem resultado (existe só acima de 1280px no Catálogo), o `max-width: 28rem` centrado dentro de uma coluna de ~1720px a 1920px, e os vazios sem-permissão das quatro abas.

## O que já existe hoje (não invente do zero — corrija)
Anatomia atual (`shared/ui/empty-state.tsx` + `.css`): coluna centrada, `text-align:center`, gap `--space-3`, padding `--space-10` no eixo vertical e `--space-5` no horizontal, `max-width: 28rem`, `margin-inline: auto`. Dentro, nesta ordem: quadrado 56×56 (`--radius-lg`, fundo `--accent-soft`, cor `--accent-text`) com ícone de 28px → título `h2` em `--fs-lg` → descrição em `--fs-body-sm`/`--text-muted` → um slot de ação com `margin-top: --space-2`.

| Onde | Ícone | Título (literal) | Descrição (literal) | Ação |
|---|---|---|---|---|
| Catálogo · Filamentos | `package` | "Nenhum filamento salvo ainda" | "Salve seus filamentos uma vez e reutilize em cada cálculo." | "Adicionar filamento" (primário) |
| Catálogo · Impressoras | `package` | "Nenhuma impressora salva ainda" | "Salve os dados da sua impressora uma vez e reutilize em cada cálculo." | "Adicionar impressora" |
| Catálogo · Produtos | `package` | "Nenhum produto salvo ainda" | "Salve uma peça com seus custos e reabra com o preço sempre recalculado." | "Adicionar produto" |
| Catálogo · Kits | `package` | "Nenhum kit salvo ainda" | "Monte um kit com várias peças e reabra com o preço sempre recalculado." | "Montar kit" |
| Catálogo · busca vazia (**só ≥1280px**) | `package` | "Nada encontrado para essa busca" | "Tente outro termo, ou limpe a busca para ver tudo de novo." | "Limpar busca" (secundário sm) |
| Catálogo · sem direito | `crown` | "Salvar faz parte do Premium." | — nenhuma — | — nenhuma — |
| Kits (compositor vazio) | `package` | "Monte seu kit peça por peça" | "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro." | "Adicionar peça" (primário) + "Ver meus kits" (ghost) |
| Orçamentos · frio | `history` | "Nenhum registro ainda" | "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data." | "Ir para a calculadora" — **fora** da peça |
| Orçamentos · busca vazia | `history` | "Nenhum registro encontrado para “{termo}”." | — nenhuma — | "Limpar busca" — **fora** da peça |
| Simulações (dentro de um Sheet) | `boxes` | "Nenhuma simulação salva ainda" | "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." | "Voltar para a calculadora" |
| Simulações · busca vazia | `boxes` | "Nenhuma simulação encontrada para “{termo}”." | — nenhuma — | "Limpar busca" |
| 404 | `triangle-alert` | "Página não encontrada" | "O endereço que você abriu não existe." | "Voltar para Calcular" |

→ **Problemas a resolver no desenho:**
→ o vazio sem direito é uma **porta sem maçaneta**: título único, sem corpo, sem saída — e é o único título com ponto final, destoando de todos os outros;
→ três telas driblaram o slot único de ação pondo o botão **fora** do bloco, com espaçamento diferente do interno — a mesma peça se apresenta de dois jeitos;
→ os vazios de busca de Orçamentos e Simulações **não têm descrição**, enquanto o do Catálogo tem — mesmo papel, densidade diferente;
→ `max-width: 28rem` (≈448px) centrado: a 1920px a coluna de conteúdo tem ~1720px e o bloco fica uma ilha no meio do nada; dentro da coluna mestre a 1280px (≈560–600px, porque a ficha da direita é fixa em 560px) ele quase preenche — duas leituras opostas da mesma regra;
→ o `h2` do bloco compete com o `h2` da página e, dentro do Sheet de Simulações, com o título do próprio Sheet;
→ o **carregando** não é esta peça (é um spinner centrado com `py-8`) e o **erro** também não (é um alerta `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente") — mas os três ocupam o mesmo retângulo em sequência, e o desenho precisa mostrá-los juntos para que a troca não pisque.

## Conteúdo e dados reais
- O **termo buscado** entra literal, entre aspas curvas: `Nenhum registro encontrado para “PLA preto 1,75”.` Ele é do vendedor: pode ter 80 caracteres colados sem espaço nenhum (um código de fornecedor). Já custou 4.948px de rolagem horizontal a 1440px num card vizinho.
- O contador que fica ao lado da busca no desktop lê "12 filamento(s)" / "3 kit(s)" / "5 peça(s)" — quando a busca não acha, ele mostra **0**, ao lado do bloco vazio: os dois números precisam concordar visualmente.
- Nenhum estado vazio mostra dinheiro. Se alguma prancheta precisar de um valor de contexto ao redor (um card da lista cheia, para comparação), use números verdadeiros do produto: `R$ 24,24`, `R$ 16,16`, `R$ 21,01`.
- `Grafismo` existe em quatro formas — `arco`, `espada`, `linha-curva`, `onda` —, é recolorido por `currentColor` e mede 120×40 por padrão (a altura é ajustável). Hoje só o 404 e a página de erro o usam.
- Ícones em uso hoje: `package`, `history`, `boxes`, `crown`, `triangle-alert`, `search`, `plus`.

## Estados obrigatórios
1. **Vazio frio (boas-vindas)** — a lista nunca teve nada. Título + descrição + ação primária. É o estado que mais precisa parecer convidativo, não quebrado.
2. **Vazio de busca** — existem itens salvos, o filtro é que não achou. Precisa dizer o termo e oferecer "Limpar busca" (secundário). **Nunca** pode dizer "Nenhum filamento salvo ainda" — seria mentira sobre os dados do vendedor.
3. **Sem permissão (Premium)** — "Salvar faz parte do Premium." com ícone `crown`. Calmo, sem preço e sem data; e precisa de uma saída (ver Perguntas).
4. **Painel de detalhe sem seleção** — o `aside` do desktop de Orçamentos mostra o mesmo bloco dentro de uma coluna estreita: desenhe a versão comprimida (sem descrição longa, sem ação).
5. **Carregando** — o que ocupa o retângulo antes dos dados (hoje um spinner centrado). Desenhe para que o vazio **não** apareça durante a busca.
6. **Erro de leitura** — alerta `danger` "Não foi possível carregar seu catálogo." + "Tentar novamente". Mostre lado a lado com o vazio: são coisas diferentes e hoje parecem parentes.
7. **Offline com lista vazia** — o alerta `info` "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." acima do bloco vazio, com a ação de criar desabilitada.
8. **Estados do botão dentro do bloco** — repouso, hover, foco visível, pressionado e desabilitado (offline / premium pausado).
9. **404 / erro de página** — a versão com arte de verdade (`Grafismo`), a única que tem hoje.

## Viewports
- **390px** — todas as telas têm vazio no mobile (menos o da busca do Catálogo, que não existe lá). É onde o padding `--space-10` + o quadrado de 56px definem se o bloco cabe acima da dobra.
- **1280px** — o corte do mestre-detalhe do Catálogo: a ficha da direita é fixa em 560px, então a coluna da lista fica com ~560–600px. É onde o vazio da busca vive e onde `28rem` quase preenche.
- **1920px** — a coluna de conteúdo tem ~1720px e a lista vira duas colunas acima de 1600px. É onde o bloco de 448px centrado fica perdido, e é o caso que precisa de decisão de largura.

## Regras que o desenho não pode quebrar
- **Vazio ≠ erro ≠ sem permissão.** Uma falha de rede nunca pode ser vendida como "vire Premium", e um bloqueio de plano nunca pode parecer falha técnica.
- **Freemium binário**: o vazio sem direito não faz oferta com preço, nem data, nem contagem regressiva. O teaser comercial é **outra peça** (`tf-premium-teaser`) e não deve ser redesenhada aqui.
- **O vazio de busca declara a busca**, com o termo à vista — e o termo aparece no corpo do texto, nunca dentro de um placeholder de campo (frase honesta cortada por placeholder já custou uma homologação neste projeto).
- **Nada estoura na horizontal.** Termo longo colado, título longo, nome de item longo: quebra ou trunca com reticências, e o desenho diz qual dos dois.
- **Alvo ≥44px** em qualquer botão do bloco, inclusive o "Limpar busca" que hoje é `sm`.
- **Contraste medido** do ícone (`--accent-text` sobre `--accent-soft`) e da descrição (`--text-muted`) contra o fundo real de cada tema — não contra o branco.
- **Hierarquia de título**: dentro de um Sheet ou de um painel lateral, o título do vazio não pode competir com o título do container.

## Armadilhas já pagas neste projeto
- Transbordo horizontal só é real quando **medido nos dois eixos** — o navegador headless não desenha barra clássica, e um scroll vertical indevido passou despercebido por isso.
- `toBeVisible`/`toContainText` passam em elemento **ocluso ou transbordado**: layout se verifica com caixas, e a única coisa que pega uma colisão é a imagem.
- Um nome de item sem espaço gerou 4.948px de rolagem a 1440px no card da lista — o vazio de busca ecoa exatamente esse texto.
- Frase honesta dentro de placeholder some quando o campo é estreito; placeholders carregam só números.
- Um bloco desenhado no mobile e esticado para o desktop vira ilha: a largura precisa ser desenhada no viewport largo, não herdada.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe** (ambos para cada prancheta):
1. **Anatomia** do `tf-empty`: com arte × com ícone, com e sem descrição, com uma e com duas ações, título curto e título longo, termo de busca de 80 caracteres sem espaço.
2. **Catálogo · Filamentos vazio** a 390 / 1280 / 1920 — mostrando o que acontece com a largura em cada um.
3. **Catálogo · busca sem resultado** dentro da coluna mestre a 1280 e 1920, com a barra de busca e o contador "0 filamento(s)" no mesmo quadro (nunca foi desenhado).
4. **Sem permissão (Premium)** nas quatro abas — e ao lado, na mesma prancheta, o **erro de leitura** e o **offline com lista vazia**, para provar que os três se distinguem à primeira vista.
5. **Painel de detalhe sem seleção** (coluna de 560px) + **Simulações dentro do Sheet**.
6. **404 com arte** (`Grafismo arco`), como referência de quanto floreio a peça suporta.

Reutilize os primitivos existentes: `tf-empty` com `tf-empty__icon`, `__title`, `__desc`, `__action`; `tf-btn--primary` para a ação de criar, `tf-btn--secondary` para "Limpar busca" e "Voltar para a calculadora", `tf-btn--ghost` para "Ver meus kits"; `tf-alert` (tom `info` para offline, `danger` para falha) como vizinho, nunca como substituto; `tf-inputwrap` + `tf-input` para a busca; `tf-card` para os itens de lista das pranchetas comparativas; `tf-grafismo` para a arte. Não crie primitivo novo — se a arte exigir um slot, ele é um slot **dentro** do `tf-empty`, no lugar do quadrado de 56px.

## Perguntas em aberto para o dono
1. **Arte ou ícone?** O kit pedia `Grafismo` nos vazios das abas; o código e o seu canvas mostram o quadrado com ícone. Vale arte no vazio **frio** e ícone nos demais (busca, sem-seleção), ou o ícone em todos?
2. **O vazio sem direito ganha saída?** Hoje "Salvar faz parte do Premium." não tem botão nenhum. Deve levar à oferta, à aba pública, ou continuar sem ação?
3. **Largura a 1920px**: o bloco continua centrado em ~448px na coluna de 1720px, ou ancora à esquerda / ocupa a coluna com a arte maior?
4. **O mobile ganha busca no Catálogo?** Hoje o vazio de busca só existe ≥1280px porque a busca só existe lá.
5. **Duas ações viram regra?** Kits já empilha primário + ghost, e Orçamentos põe o botão fora do bloco. A peça passa a aceitar oficialmente ação primária + secundária?
6. **Os vazios de busca de Orçamentos e Simulações ganham a segunda linha** ("Tente outro termo, ou limpe a busca para ver tudo de novo.") que o Catálogo já tem, ou o vazio de busca é deliberadamente mais seco?

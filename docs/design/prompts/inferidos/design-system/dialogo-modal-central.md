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

- **Onde vive:** `shared/ui/dialog.tsx` → `<DialogContent variant="center">`. Sem rota: é uma camada que o Radix teleporta para o fim do `<body>` (portal), centralizada por `left/top: 50%` + `translate(-50%,-50%)`, `width: min(92vw, 32rem)`, `max-height: 85vh` com rolagem interna, `padding --space-6`, `radius xl`. São **9 caixas** hoje: excluir filamento/impressora (`catalog-panel.tsx:488`), descartar registro da fila (`entry-actions.tsx:67`), sair com fila pendente — duas em sequência (`sign-out-outbox-guard.tsx:100` e `:116`), renomear rótulo do orçamento (`snapshot-manage.tsx:83`), excluir orçamento (`snapshot-manage.tsx:113`), recalcular hoje (`recalc-today.tsx:257`), cancelar assinatura (`plan-panel.tsx:218`), descartar alterações da simulação (`scenario-context-bar.tsx:257`) e excluir simulação (`scenarios-list-sheet.tsx:426`).
- **Como o vendedor chega:** Sempre por um clique em ação irreversível, e o vendedor chega ANSIOSO: apertou "Excluir", "Sair", "Cancelar assinatura" ou "Recalcular hoje". Em 6 dos 9 casos o chamador passa `showClose={false}` — a caixa não tem X e só se sai ESCOLHENDO um dos botões (Escape ainda fecha, pelo Radix). Nos outros 3 há um X de 44×44 encostado no canto superior direito.
- **Vizinhança imediata:** Por baixo fica a tela de origem inteira, escurecida pelo scrim `--surface-overlay` (z-index 70; a caixa é 71) — a lista do Catálogo, a lista de Orçamentos ou o painel de plano da Conta, ainda legível atrás. Dentro, de cima para baixo: **título** em fonte de título CAIXA ALTA com `padding-right: --space-10` reservado para o X, **descrição** em `--text-muted`, às vezes um `<Alert tone="danger">` com o erro do servidor, e por último a fileira de botões — que CADA chamador monta do seu jeito (`flex justify-end gap-2` em uns, `mt-4 flex justify-end gap-2` em outros), com o secundário à esquerda e o destrutivo à direita.
- **Dados que chegam (e o que ela devolve):** Só texto já resolvido pela feature: título e corpo vindos de `messages.pt-br`, muitas vezes com interpolação do nome do item (`deleteTitle.replace("{nome}", …)`), e a contagem da fila pendente (`count(t.signOutQueueTitle, pending)`) que vem do outbox local. O primitivo não sabe o que é entitlement, rede ou dinheiro. Devolve apenas o evento de fechar (`onOpenChange`) — a decisão de excluir é do chamador.
- **O que acontece depois:** Confirmando, a mutação dispara: o item some da lista por baixo, um `Toast` sobe no rodapé e a caixa desmonta com o foco voltando ao botão que a abriu (Radix). Cancelando, some sem nada mudar. No caso da fila pendente, confirmar descarta registros não sincronizados e leva o vendedor para fora da sessão — é a única caixa do produto que destrói dado que ninguém mais tem.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# A caixa de confirmação central (excluir · sair · cancelar assinatura)

## O que desenhar

A caixa modal centralizada que aparece toda vez que o usuário pede algo irreversível ou que exige
decisão explícita: excluir um filamento, uma impressora, um orçamento congelado ou uma simulação
salva; sair do app com registros na fila offline; recalcular um congelado com os preços de hoje;
cancelar a assinatura Premium. Vive por cima de qualquer aba (Calcular, Catálogo, Kits,
Orçamentos, Conta), escurece o resto da tela e prende o foco: em 6 dos 9 pontos de uso ela **não
tem X** — só se sai escolhendo. É a última tela que o vendedor vê antes de perder um dado. Origem
no código: `apps/web/src/shared/ui/dialog.tsx` + `dialog.css` (variante `center`).

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. A caixa inteira foi inferida a partir de uma decisão técnica —
o próprio arquivo declara "ADR-0007, decision C1 = build now". O protótipo de 2026-07-02 desenhou
**só a Sheet** (§D.2, o upsell contextual); o readme lista `Sheet` entre os 32 primitivos e **não
lista Dialog/Modal**. O canvas de desktop também não tem nenhuma: o dono desenhou o botão
**"Excluir"** na ficha e nos Orçamentos, nunca o que acontece depois do clique. Largura, respiro,
ordem dos botões, peso do botão perigoso e o X que às vezes existe e às vezes não saíram de
escolhas de implementação, caller a caller.

## O que já existe hoje (não invente do zero — corrija)

Geometria atual: largura `min(92vw, 32rem)` (≈358px em 390 · 512px no desktop), `max-height: 85vh`
com rolagem interna, padding `--space-6`, raio `--radius-xl`, borda `--border-subtle`, sombra
`--shadow-lg`, scrim `--surface-overlay`, `gap --space-3` entre filhos. Título em `--font-title`,
CAIXA ALTA, `--fs-lg`, `--text-strong`, com `padding-right: --space-10` reservado para o X.
Descrição em `--text-muted`, `--fs-body-sm`. X de 44×44 (`--touch-min`) no canto superior direito.

Os 9 usos reais e o que cada um mostra:

| Onde | Título (literal) | Corpo | Botões (ordem atual) | X? |
| --- | --- | --- | --- | --- |
| Excluir filamento/impressora (`catalog-panel`) | "Excluir “{nome}”?" | "Esta ação não pode ser desfeita." | "Voltar" (ghost) · "Excluir" (danger) | **sim** |
| Excluir simulação (`scenarios-list-sheet`) | "Excluir a simulação “{nome}”?" | "Esta ação não pode ser desfeita." | "Voltar" (ghost) · "Excluir" (danger) | **sim** |
| Descartar alterações (`scenario-context-bar`) | "Descartar as alterações não salvas desta simulação?" | *(nenhum)* | "Voltar" (ghost) · "Descartar" (danger) | **sim** |
| Cancelar assinatura (`plan-panel`) | "Cancelar a assinatura?" | "Seu Premium continua ativo até {data}." + legenda "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." | "Voltar" (secondary, **preenchido**) · "Cancelar assinatura" (**danger-ghost**) | **sim** |
| Descartar registro da fila (`entry-actions`) | "Descartar este registro?" | "Ele não foi enviado para a sua conta e não poderá ser recuperado." | "Voltar" (secondary) · "Descartar" (danger) | não |
| Excluir congelado (`snapshot-manage`) | "Excluir este registro?" | "Esta ação não pode ser desfeita." | "Voltar" (secondary) · "Excluir" (danger) | não |
| Editar rótulo (`snapshot-manage`) | "Editar rótulo" | campo "Rótulo (opcional)", máx. 120 caracteres | "Voltar" (secondary) · "Salvar rótulo" (primary) | não |
| Recalcular hoje (`recalc-today`) | "Recalcular hoje" | "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de {data} continua como está." | "Voltar" (secondary) · "Recalcular" (primary) | não |
| Sair com fila pendente (`sign-out-outbox-guard`) | "{n} registro(s) ainda não foram sincronizados" | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | **coluna**: "Sincronizar agora" (primary) · "Sair e descartar" (danger) · "Voltar" (secondary) | não |

→ **A mesma classe de ação tem e não tem X.** Excluir um filamento fecha no X; excluir um
congelado, não. Não há regra — há dois costumes.
→ **A saída segura tem dois pesos.** "Voltar" é `ghost` em Catálogo/Simulações e `secondary` nas
demais. Em Cancelar assinatura a hierarquia foi **invertida de propósito** (decisão do dono
2026-08-03, medida: "Voltar" fantasma 85,6×48px contra "Cancelar assinatura" vermelho preenchido
187,6×48px — o destrutivo era 2,2× mais largo e o único com fundo). A inversão vive em **uma**
caixa; as outras oito seguem com o destrutivo preenchido.
→ **O ritmo vertical é remontado por chamador**: uns usam o `gap --space-3` da caixa, outros
empilham um agrupador interno, outros empurram a régua de botões com margem própria.
→ **O corredor do X existe mesmo quando não há X** — nas 6 caixas sem X o título quebra mais cedo
por causa de um botão que não está lá.
→ **A CAIXA ALTA cai sobre nome digitado**: "EXCLUIR “PLA VERMELHO 1KG”?" — e sobre frases longas:
"DESCARTAR AS ALTERAÇÕES NÃO SALVAS DESTA SIMULAÇÃO?", 49 caracteres em fonte de título, sem corpo
nenhum embaixo.

## Conteúdo e dados reais

- Nomes ecoados no título vêm do catálogo do usuário e vão de "PLA" a rótulos de até 120
  caracteres. Exemplos verdadeiros: "PLA Vermelho 1kg", "Creality Ender 3 V3 SE", "Vaso
  hexagonal — 15/07/2026", "Shopee — vaso grande com brinde de frete".
- `{n}` na guarda de saída é a fila offline: plausível 1–3, possível 40+. `{data}` é data curta
  ("15/07/2026"; no plano, "12/09/2026").
- Nada nesta caixa mostra dinheiro hoje. O recálculo confirma uma ação cujo resultado
  (ex.: `R$ 24,24` → `R$ 27,80`) só aparece **depois** que a caixa fecha — ver Perguntas em aberto.
- Campo único existente: "Rótulo (opcional)", texto livre, `maxLength=120`, pré-preenchido. Aviso
  em faixa: "Este filamento é usado em {n} produto(s). Eles manterão os últimos valores,
  editáveis." (e o gêmeo "Esta impressora é usada em {n} produto(s)…").

## Estados obrigatórios

- **Foco, hover e pressionado** — o foco entra na caixa e não sai; anel `--ring` visível em cada
  botão, no campo e no X, desenhado sobre `--surface-card` (não sobre a página). Hover nos cinco
  pesos de botão e no X (hoje o X clareia e ganha `--bg-muted`).
- **Carregando** — o botão da ação fica em `loading` enquanto a exclusão/cancelamento/recálculo
  roda, a caixa **continua aberta** e o "Voltar" precisa de estado definido nesse intervalo.
- **Erro** — faixa `danger` acima da régua, caixa aberta: "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes."
- **Aviso honesto (info)** — faixa com o texto de item referenciado; a ação **continua disponível**.
- **Offline** — na guarda de saída: "Sincronizar agora" **desabilitado** com a explicação abaixo,
  "Precisa de conexão para enviar."; no recálculo, a nota "Sem conexão: usando os valores do
  catálogo salvos neste aparelho, que podem estar desatualizados."
- **Degradado** — recálculo sem origem no catálogo: "Não foi possível localizar a origem deste
  registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro e
  a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." (o corpo mais alto
  que a caixa recebe hoje).
- **Sem saída pelo X** — nas 6 caixas em que a única saída é escolher, precisa ficar visualmente
  claro que ambas as saídas estão na régua de botões.
- **Sucesso parcial e segunda etapa** — a guarda de saída mostra a faixa `danger` "{n} registro(s)
  não puderam ser enviados. Eles continuam neste aparelho." **sem fechar**, e troca o próprio
  conteúdo por "Descartar {n} registro(s) e sair?" + "Eles não foram enviados para a sua conta e
  não poderão ser recuperados." com "Voltar" · "Descartar e sair".

## Viewports

- **390px (mobile)** — obrigatório: a caixa ocupa 92vw (≈358px) e é onde a régua de dois botões
  lado a lado aperta; desenhe também a versão com **três** botões (guarda de saída) e a caixa com
  **campo de texto** (teclado aberto contra `max-height: 85vh`).
- **1280px (desktop)** — obrigatório: é o corte do redesenho 018; a caixa fica em 512px centrada
  sobre barra lateral + lista + ficha, e o scrim precisa funcionar sobre três colunas.
- **1920px** — uma prancheta só para a proporção: a caixa **não cresce** além de 32rem, então ali
  é um retângulo pequeno num campo escuro grande. Se isso não estiver certo, proponha o ajuste.

## Regras que o desenho não pode quebrar

1. **"Voltar" nunca vira "Cancelar"** (FR-014, anotado no próprio arquivo de textos). Numa caixa
   chamada "Cancelar a assinatura?", um botão "Cancelar" é ambíguo por construção.
2. **Nada some em silêncio**: toda exclusão ecoa o nome do que será excluído e diz que não dá para
   desfazer.
3. **Falha de rede nunca é vendida como falta de plano** e nunca é vendida como sucesso: botão que
   não pode funcionar mostra o motivo escrito, não fica só apagado.
4. **A frase honesta mora em elemento de largura cheia** — nunca em placeholder, nunca cortada por
   reticências — e **degradação é dita**: o recálculo sem origem tem que parecer diferente do
   recálculo normal.
5. **Alvo ≥44×44px** para o X e para cada botão, inclusive quando dois dividem 358px; e
   **contraste medido contra o fundo real** (`--surface-card` sobre scrim, não sobre a página) —
   o `danger-ghost` é o pior caso.
6. **A confirmação de sucesso não pode morar dentro da caixa**: ela desmonta no instante da ação,
   então qualquer aviso de "pronto" desenhado aqui simplesmente não aparece (já aconteceu).

## Armadilhas já pagas neste projeto

- **Um diálogo desta família já estourou 100,5px na horizontal, com um botão nascido fora da
  viewport** — e o teste passou. Layout se prova com caixa medida, não com "o texto está lá".
- **Um toast de confirmação ficou no pacote e nunca renderizou** (0 inserções em 8s) porque a
  caixa desmontava antes — daí a regra 6.
- **Texto ocluso passa em teste**; e **nome grande estoura coluna** (já aconteceu num PDF de
  orçamento). Desenhe o título com um nome de 120 caracteres, não com "PLA".

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não cortesia)**: (1) confirmação
destrutiva de duas ações, 390px e 1280px; (2) a mesma com faixa `info` de item referenciado e com
faixa `danger` de erro; (3) a caixa com campo "Rótulo (opcional)" em 390px com teclado; (4) a
guarda de saída nas duas etapas, incluindo o offline com botão desabilitado e a explicação; (5) o
recálculo normal e degradado; (6) o cancelamento de assinatura com a hierarquia invertida; (7) o
estado carregando; (8) uma prancheta de foco com o anel em cada elemento; (9) 1920px.

Reutilize os primitivos, sem criar novos: a caixa é a variante `center` do `tf-dialog` (mesmo
scrim, raio e sombra da `Sheet`), o título `tf-dialog__title`, o corpo `tf-dialog__desc`, os
avisos `tf-alert` nos tons `info` e `danger`, os botões `tf-btn` nos cinco pesos já existentes, o
campo `tf-input` dentro de `tf-inputwrap` com o rótulo do `Field`, e o X `tf-dialog__x`. O que se
espera de novo não é primitivo: é **a regra** — uma régua de botões única, um ritmo vertical único
e uma decisão explícita sobre o X.

## Perguntas em aberto para o dono

1. **O X vira regra ou some?** Hoje 6 caixas prendem a saída e 4 não. Qual é a regra: toda
   confirmação destrutiva se fecha só escolhendo, ou toda caixa pode ser fechada no X e o
   "Voltar" já basta como saída segura?
2. **A inversão de hierarquia de 2026-08-03 (saída segura preenchida, ação destrutiva em
   `danger-ghost`) vale para todas as confirmações irreversíveis, ou continua exclusiva do
   cancelamento de assinatura?** Isso muda o desenho de 8 caixas.
3. **A CAIXA ALTA do título continua sobre nome digitado pelo usuário** ("EXCLUIR “PLA VERMELHO
   1KG”?"), ou o nome mantém a grafia original dentro de um título em caixa alta?
4. **A caixa de "Recalcular hoje" deve mostrar o número** (ex.: "de R$ 24,24 para R$ 27,80")
   antes de confirmar, ou o novo valor continua aparecendo só depois, no registro criado? Hoje ela
   confirma uma ação cujo efeito o usuário só vê quando a caixa já fechou.

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

- **Onde vive:** `shared/ui/select.tsx` — um `<select>` NATIVO dentro da moldura `tf-inputwrap`, com o cromo do sistema removido e um cursor `▾` desenhado à direita (`--space-4` da borda, `pointer-events: none`). Aparece em **11 pontos**: 6 no formulário de `/calcular` (`calculator-form.tsx` — canal de marketplace, modalidade, categoria, entre outros), 2 na página de produto (`produto-page.tsx`), 2 em `/calcular` fora do formulário (`calcular-page.tsx`) e 1 no editor de linha do kit (`bom-line-editor.tsx`).
- **Como o vendedor chega:** É por aqui que o vendedor escolhe **canal de marketplace, modalidade e categoria** — as escolhas que MUDAM O PREÇO. Ele toca no campo e o sistema operacional abre a roda nativa (no celular) ou o popup do navegador (no desktop): uma lista que a marca não controla.
- **Vizinhança imediata:** Dentro de um `Field` com `tightLabel` (reserva de UMA linha, não duas — é controle de largura inteira), tipicamente logo acima do bloco de canais, ao lado ou acima dos `NumberField` que dependem da escolha. Quando o canal é escolhido, aparecem abaixo os campos de tarifa daquele canal e, no resultado, os cartões de preço por canal com seus selos de origem da tarifa.
- **Dados que chegam (e o que ela devolve):** Uma lista `{value,label}` montada a partir do **catálogo de tarifas servido e cacheado** (canais, modalidades, faixas, categorias), um `placeholder` opcional que vira uma primeira `<option>` desabilitada de valor vazio, e o estado de erro. A escolha alimenta o `pricing-core`, que aplica comissão, taxa fixa, faixas progressivas e sobretaxas.
- **O que acontece depois:** Escolher um canal reconfigura o formulário abaixo (que campos existem é decidido por um `channelFieldPlan`), repreenche as tarifas com selo de origem e recalcula os cartões de preço por canal. Sem desenho hoje: o placeholder, o desabilitado, o erro, o seletor a 390px e o que fazer no desktop, onde a roda nativa não é a affordance certa.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Seletor (Select) — o cursor ▾ e a lista que a marca não controla

## O que desenhar
O controle de escolha única do Precifica3D: uma moldura `tf-inputwrap` de 48px de altura com um
`tf-select` dentro e o caractere `▾` literal encostado à direita. É por ele que o vendedor escolhe
**o marketplace do canal**, **a modalidade** (Clássico/Premium/Profissional/Individual), **o perfil
de vendedor da Shopee**, **o ritmo da máquina e o prazo de payback**, e ainda **o filamento salvo, a
impressora salva e o produto salvo** do catálogo. Ou seja: as escolhas que mudam o preço final e as
que puxam dados prontos. Ele vive na tela **Calcular**, na ficha do **Produto** (Catálogo) e no
**editor de linha de Kit** — sempre dentro de um `tf-field`, com rótulo em cima. A lista que se abre
ao tocar é a do **sistema operacional** (roda no celular, popup no desktop) — não é desenhável, e
essa é justamente a decisão que precisa ser encarada aqui.

## Por que este prompt existe
A ficha classifica como `PROTOTIPO_PARCIAL`, e o verificador adversarial foi preciso: **o estado
fechado-com-escolha ESTÁ desenhado pelo dono** — `Abas-Desktop.dc.html`, linhas 137-138, dois
seletores completos na ficha do Catálogo a 1920px, com o `▾` literal, sob os rótulos "Filamento
salvo" e "Impressora salva" em `tf-field__label--tight`. O dono viu o `▾` e o manteve (isso
neutraliza a objeção "Icons: Lucide, no emoji"). **Sobra sem desenho nenhum**: o placeholder (uma
primeira `<option>` desabilitada de valor vazio), o **desabilitado**, o **erro**, o seletor a
**390px** e a **lista aberta** — que, por decisão do código, é do sistema e a marca não pinta.
Nenhuma tela do ui_kit tem Select.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/select.tsx` + `select.css` + `field.css`.

Estrutura atual, exatamente: `<div class="tf-inputwrap tf-selectwrap">` → `<select class="tf-input
tf-select">` → `<span class="tf-select__caret">▾</span>`, com `aria-hidden` no caret.

| Coisa | Como está hoje |
|---|---|
| Altura da moldura | `--control-h` = **48px** (acima do alvo de 44px, ok) |
| Caret | caractere `▾`, cor `--text-strong`, tamanho `--fs-sm`, colado a `--space-4` da direita |
| Folga do texto | `padding-right: --space-5` no `select` para o rótulo longo não passar sob o `▾` |
| Cursor | `pointer` na moldura; `not-allowed` quando desabilitado |
| Foco | anel no **wrapper** (`:focus-within`), borda vira `--focus-ring` |
| Erro | `tf-inputwrap--error`: borda `--danger` + halo `--danger` 38%, vence o foco |
| Desabilitado | `tf-inputwrap--disabled`: fundo `--bg-muted` + **`opacity: 0.6`** |
| Lista aberta | nativa; `color-scheme` por tema pinta o popup, e `option:checked` recebe `--selection-bg`/`--selection-fg` (no escuro, `--accent-soft`) |

→ **O `error` do Select é código morto hoje**: varri as 11 chamadas (`calculator-form.tsx`,
`calcular-page.tsx`, `produto-page.tsx`, `bom-line-editor.tsx`) e **nenhuma** passa `error`. Ou seja,
um seletor inválido hoje só mostra a mensagem embaixo, sem a moldura vermelha que o NumberField ao
lado ganha. Precisa de desenho para virar real.
→ **O desabilitado tem um buraco medido**: o Premium pausado congela a ficha do Produto com
`<fieldset disabled>` (`produto-page.tsx:298/366/386`). Isso desabilita o `<select>` nativo, mas
**não** aplica `tf-inputwrap--disabled` na `<div>` de fora — a moldura continua com cara de ativa e o
`▾` continua em `--text-strong`. O desenho precisa dizer como o congelado se parece.
→ **`opacity: 0.6` no bloco inteiro** derruba o contraste do rótulo dentro do controle junto com a
borda. Prefira apagar por token (texto `--text-faint`, fundo `--bg-muted`) a apagar por opacidade.
→ A **categoria** NÃO é este componente (a ficha da auditoria diz que sim, e está errada): ela usa o
`CategoryPicker` próprio, com busca e caminho completo. Este prompt não cobre categoria.

## Conteúdo e dados reais

Textos literais que já existem — **não reescreva**:

- Rótulos: `"Marketplace"` · `"Modalidade"` · `"Você vende como"` · `"Mais de 450 pedidos nos últimos
  90 dias?"` · `"Com que frequência ela roda?"` · `"Em quantos anos quer que ela se pague?"` ·
  `"Filamento salvo"` · `"Impressora salva"` · `"Usar produto salvo"`.
- Opções de marketplace: `"Mercado Livre"`, `"Shopee"`, `"Amazon"`, `"Outro"`.
- Modalidade: `"Clássico"`, `"Premium"`, `"Profissional"`, `"Individual"`.
- Perfil do vendedor: `"Pessoa física (CPF)"`, `"Pessoa jurídica (CNPJ)"`; volume: `"Sim"`, `"Não"`.
- Ritmo (a opção mais larga, que já estourou layout): `"Poucas horas por semana"`, `"Quase todo dia"`,
  `"Praticamente o dia todo"`. Payback: `"1 anos"` … `"5 anos"` → **"1 anos" é copy ruim** e está no
  produto (`paybackYearsLabel: "{n} anos"`); trate como defeito de conteúdo a resolver no desenho.
- Placeholders: `"Selecione"` (perfil do vendedor) · `"Escolher…"` (filamento/impressora) ·
  `"— Manual —"` (linha de kit sem produto vinculado — é uma **opção válida**, não um vazio).
- Legenda derivada logo abaixo do par ritmo/payback: `"≈ R$ 3,47 por hora de impressão"`
  (`derivedCaption`, o número vem do cálculo).
- Erro de carga dos itens salvos, hoje mostrado em `Alert tone="danger"` acima dos dois seletores:
  `"Não foi possível carregar seus itens salvos agora."` + botão `"Tentar novamente"`.
- Premium pausado, em `Alert tone="info"`: `"Reative o Premium"` / `"Reative o Premium para voltar a
  criar e editar. Seus itens estão salvos."`

Dados reais das listas: filamentos/impressoras/produtos são nomes livres do usuário (ex.: `"PLA
Prata 1kg"`, `"Bambu Lab A1 mini"`, `"Vaso hexagonal 12cm"`) — **sem limite prático de comprimento**,
é aí que o texto encosta no `▾`. As listas variam de 1 a dezenas de itens.

## Estados obrigatórios

1. **Repouso, com escolha feita** — o único já desenhado (canvas 018, l.137-138). Rótulo tight em
   cima, valor em `--text-strong`, `▾` à direita.
2. **Repouso, vazio (placeholder)** — a primeira linha desabilitada de valor vazio: `"Selecione"` /
   `"Escolher…"`. Deve **parecer não respondido**, em `--text-faint`, nunca uma escolha já feita —
   na Shopee, "sem resposta" cai no catch-all e o preço muda; o vazio precisa se ler como vazio.
3. **Hover** — borda `--border-strong`; cursor de ponteiro na moldura inteira, não só no texto.
4. **Foco (teclado)** — anel na moldura inteira; um `▾` e um `select` nunca desenham dois anéis.
5. **Aberto** — a lista é do SO. Desenhe o que o app CONTROLA: como o controle fica enquanto o popup
   está aberto e como a linha selecionada aparece (`--selection-bg`/`--selection-fg`; no escuro,
   `--accent-soft` + `--text-strong`). Mostre a prancheta com a nota de que o resto é do sistema.
6. **Desabilitado por Premium pausado** — a ficha congelada. Precisa se ler como "pausado, seus
   dados estão aí", ao lado do alerta `"Reative o Premium"` — nunca como quebrado.
7. **Erro** — borda `--danger` + mensagem `--danger-text` abaixo. Hoje não existe na prática; desenhe
   para poder existir.
8. **Lista vazia / catálogo indisponível** — hoje o cartão inteiro some quando não há itens salvos
   (silêncio deliberado para "você ainda não salvou nada") e vira `Alert tone="danger"` quando a
   leitura falha. Desenhe os dois: o "nada salvo ainda" e o erro com retry.
9. **Offline** — os itens salvos vêm do cache local; o seletor funciona normal. **Falha de rede não
   pode aparecer como "não é Premium"** — se houver qualquer marca de offline, ela diz rede.

## Viewports
- **390px (mobile)** — obrigatório, é onde a decisão nasceu (a roda do sistema). Mostre o pior caso
  medido: `"Poucas horas por semana"` (≈197px do próprio texto) e um nome de filamento longo; a
  1 coluna, dois seletores empilhados.
- **1280px (desktop)** — o corte do 018. Aqui a roda nativa **não** é a affordance certa e a
  pergunta continua aberta (ver §Perguntas). Desenhe o par lado a lado na grade de 2 colunas.
- **1920px** — o desenho do dono já existe; reproduza para conferência de coerência, com os mesmos
  rótulos "Filamento salvo" / "Impressora salva".

## Regras que o desenho não pode quebrar
- O `▾` é o **único** ornamento; nada de segunda seta, sombra interna ou gradiente na moldura — ela
  tem de ser irmã visual do NumberField ao lado, mesmos tokens de borda/foco/erro.
- Alvo de toque ≥44px: a moldura tem 48px e a **área clicável é a moldura inteira**, incluindo o `▾`.
- Contraste medido contra o fundo real (`--surface-card`), nos dois temas, inclusive no desabilitado.
- **Freemium é binário**: o seletor de marketplace desabilitado por plano vem sempre acompanhado da
  frase honesta `"Vender em marketplaces faz parte do Premium."` — em texto próprio, **fora** do
  campo; frase honesta nunca mora dentro de placeholder.
- O valor escolhido é uma **intenção do vendedor** — nada aqui pode sugerir que o app escolheu por
  ele (o catch-all da Shopee é exatamente esse risco).

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: a 360/390px o par ritmo/payback só cabe empilhado —
  `auto-fit, minmax(240px, 1fr)` existe porque a opção mais larga não tinha folga nenhuma.
- **Rótulo comprido sob o caret**: o `padding-right` existe por isso; um nome de filamento de 40+
  caracteres tem de truncar com reticências **antes** do `▾`, nunca por baixo dele.
- **Texto ocluso passa em teste** — `toBeVisible` aprova elemento sobreposto; layout se prova com
  caixas. Entregue o desenho com as medidas explícitas.
- **Rótulo de 2 linhas desalinha o par**: `tf-field__label--tight` reserva UMA linha; misturar tight
  e não-tight na mesma linha empurra um seletor 15-16px abaixo do irmão.
- **Popup branco em tema escuro** já aconteceu; a causa-raiz foi `color-scheme` por tema. O desenho
  precisa mostrar o tema escuro com o popup escuro.

## Entregável
Pranchetas, em **escuro (padrão) e claro (first-class)**:
1. Anatomia do controle (repouso com escolha, repouso vazio/placeholder, hover, foco) — 1280px.
2. Os 4 estados críticos: erro, desabilitado por Premium pausado, lista vazia, erro de carga com
   retry — 390px.
3. O par ritmo/payback a 390px com o texto mais largo real, e a 1280px lado a lado.
4. Os dois seletores da ficha do Catálogo a 1920px, batendo com o canvas do dono.
5. Uma prancheta só para o **aberto**: o controle + a nota do que é do sistema + como a linha
   selecionada é pintada, nos dois temas.

Reutilize os primitivos existentes: moldura `tf-inputwrap` (com `--error` / `--disabled`), campo
`tf-input tf-select`, caret `tf-select__caret`, envelope `tf-field` com `tf-field__label--tight`,
mensagem `tf-field__error`, aviso `tf-alert--info` / `tf-alert--danger`, botão `tf-btn--secondary`
para "Tentar novamente". **Não crie primitivo novo** — se algum estado não couber nos que existem,
diga qual e por quê em vez de inventar.

## Perguntas em aberto para o dono
1. **Desktop**: a lista nativa do SO fica, ou o desktop ganha um popup próprio da marca? O código
   escolheu nativo pelo celular; a 1280/1920px isso é uma escolha herdada, nunca decidida. Se a
   resposta for "popup próprio", o escopo deste desenho dobra.
2. **`"{n} anos"`** gera `"1 anos"`. Corrigimos para `"1 ano"` (singular) ou trocamos a redação toda?
3. **Placeholder do perfil do vendedor**: `"Selecione"` deixa o cálculo cair no catch-all (a maior
   alíquota). O seletor deve avisar isso na própria linha, ou continua sendo trabalho só do selo de
   procedência que fica abaixo?
4. **Congelado por Premium pausado**: o seletor mostra o valor escolhido (só sem poder trocar) ou
   apaga junto com o resto do campo?

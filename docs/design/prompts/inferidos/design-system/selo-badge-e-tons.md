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

- **Onde vive:** `shared/ui/badge.tsx` — pílula de altura mínima 24px, `padding 0.125rem × --space-3`, `radius pill`, `white-space: nowrap`, quatro tons (`neutral`/`info`/`success`/`danger`). Aparece em **5 pontos de produto**: estado de sincronização na lista de Orçamentos (`historico-page.tsx:660`, dentro de cada linha da lista) e no detalhe do orçamento (`snapshot-detail-page.tsx:131`); o SELO DO PLANO no cartão de plano da Conta (`conta-page.tsx:128`, ao lado do nome do plano, acima da legenda de renovação); o "não salvo" da barra de contexto da simulação (`scenario-context-bar.tsx:174`); e o "recomendado" no cartão de plano da oferta (`offer-panel.tsx:72`, ao lado do nome do plano e acima do preço). Fora do DS, uma sexta forma: `.tf-badge.fee-seal` (`features/calculator/fee-seal.tsx`), o selo de origem da tarifa, um por canal de marketplace no bloco de resultado de `/calcular`.
- **Como o vendedor chega:** O vendedor não clica no selo — ele o LÊ de passagem, procurando o estado da linha: "sincronizado", "na fila", "falhou", "Premium", "não salvo", "tarifa de 06/07/2026".
- **Vizinhança imediata:** Sempre encaixado numa linha densa: à direita do nome do item na lista de Orçamentos, com a data logo abaixo; no cartão de plano da Conta fica colado ao título e acima do texto de renovação e do botão "Gerenciar assinatura"; na barra de contexto da simulação, à direita do nome do cenário e à esquerda dos botões de ação. O `fee-seal` fica logo abaixo do preço de cada canal, e precisou de três exceções locais para sobreviver ali: pode quebrar linha, alinha à esquerda e ganhou borda de 1px porque no tema escuro seu fundo (`--bg-muted`) é idêntico ao do cartão e a pílula sumia.
- **Dados que chegam (e o que ela devolve):** Um `tone` e um texto — nada mais. Quem decide o tom é a feature: o estado do outbox (`syncState === "failed" ? "danger" : "info"`), o `PlanState` resolvido pelo servidor (união discriminada, o painel NÃO tem acesso ao ledger), a sujeira do formulário de cenário, ou a proveniência da tarifa (referência / catch-all publicado / ajustado pelo vendedor / sem referência / estimativa).
- **O que acontece depois:** Nada — é leitura pura, sem ação. O que muda é a CONFIANÇA: um selo verde no plano diz que o Premium está ativo agora, e o selo de tarifa é a promessa de que um número pré-preenchido nunca é confundido com um número que o vendedor conferiu. Falta a este primitivo o tom que o desenho especifica duas vezes: o selo **Premium** laranja sólido com ícone, que hoje não existe.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Selo (Badge) — os quatro tons de status, o selo Premium que falta e o selo de procedência que quebra linha

## O que desenhar
O selo é a pílula pequena que o Precifica3D usa para carimbar um estado sobre um elemento maior: o plano do vendedor na aba Conta ("Premium", "Gratuito", "Premium pausado"), a etiqueta "recomendado" no cartão do plano anual, o aviso "Alterações não salvas" na barra de contexto do cenário, o estado de sincronização de cada registro do Histórico e — o caso mais pesado — o **selo de procedência da tarifa** que fica colado a cada campo de comissão de marketplace na calculadora, dizendo de onde aquele número veio e quando foi conferido. É a peça que o vendedor lê de relance, sem clicar, para saber se pode confiar no que está na tela. Ela aparece em todas as abas, no mobile e no desktop, sobre cartão e dentro de formulário.

## Por que este prompt existe
`PROTOTIPO_PARCIAL`. O protótipo de 2026-07-02 (`docs/design/prompts/claude-design-prototype.md` §D.2) **desenhou** os tons de status — o canvas do dono tem `tf-badge--success` ("Ao vivo"), `tf-badge--info` ("recomendado") e `tf-badge--neutral` nos chips de período — então os quatro tons não são invenção do código. O que **falta é o outro selo**, especificado duas vezes no mesmo documento: *"Badge Premium — pequeno, **laranja** (`--energy`, texto preto), rótulo 'Premium'. Marca ações gated"*, com ícone de coroa e aparência sólida. O `badge.tsx` do app não tem aparência sólida, não tem espaço para ícone e não tem nenhum tom laranja — a marca visual do que é Premium, o principal sinal do modelo freemium, foi desenhada e nunca existiu. Isso é **divergência declarada**, não lacuna.
E o canvas prova a falta pela prática: vários selos dele são pintados com `background`/`color` **inline**, porque o primitivo não oferecia o tom necessário.
Sem desenho também estão as **exceções locais** que nasceram fora do DS (`fee-seal.css`, "US2 homologation (T026b)"): o selo de tarifa reverte três decisões do primitivo — deixa quebrar linha, alinha o texto à esquerda e ganha uma borda de 1px porque **no tema escuro o fundo do selo neutro (`--bg-muted` = neutral-900) é idêntico ao do cartão (`--surface-card` = neutral-900) e a pílula simplesmente sumia**.

## O que já existe hoje (não invente do zero — corrija)

Um único primitivo, com uma única propriedade (`tone`), quatro valores:

| Tom | Fundo | Texto | Onde aparece hoje (texto literal) |
|---|---|---|---|
| `neutral` | `--bg-muted` | `--text-body` | "Gratuito" · "Premium pausado" · "Não foi possível confirmar seu plano." · "Alterações não salvas" · a maioria dos selos de tarifa |
| `info` | `--tf-info-soft` (ciano) | `--info-text` | selo de tarifa com referência fresca · "Pendente neste dispositivo" no Histórico · "estimativa de frete" |
| `success` | `--tf-success-soft` (verde) | `--success-text` | "Premium" no cartão do plano · "recomendado" no Plano anual |
| `danger` | `--tf-danger-soft` (vermelho) | `--danger-text` | "Não foi possível registrar" no Histórico |

Forma atual (inferida no código, sem desenho): altura mínima **24px**, respiro `0,125rem` na vertical × `--space-3` na horizontal, raio pílula, `caption` semibold, `line-height: 1`, `white-space: nowrap`, texto centralizado por padrão, sem borda.

→ **Problema 1 — o selo neutro desaparece no escuro.** Fundo do selo = fundo do cartão. O `fee-seal` resolveu localmente com uma borda de 1px `--border-default`; todos os outros selos neutros do app ("Gratuito", "Premium pausado", "Alterações não salvas") continuam invisíveis como pílula — leem-se como texto solto. O desenho tem de decidir isso **no primitivo**, não em cada feature.
→ **Problema 2 — não existe selo Premium.** Nenhuma ação gated é marcada visualmente; o freemium não tem carimbo.
→ **Problema 3 — o selo de tarifa não é um selo de status, é uma frase.** Chega a ~90 caracteres e quebra em 2–3 linhas; a forma "pílula de 24px" foi feita para uma palavra. Ele merece uma variante desenhada, não uma exceção sobrescrevendo o primitivo.
→ **Problema 4 — "Não foi possível confirmar seu plano." é uma frase com ponto final dentro de uma pílula.** Copy ruim para o formato: é mensagem de erro, não rótulo de estado. Ou o selo encolhe para "Plano não confirmado" (e a frase vira legenda abaixo), ou este caso deixa de ser selo.

## Conteúdo e dados reais
- **Plano (aba Conta):** "Premium" (`success`) · "Gratuito" (`neutral`) · "Premium pausado" (`neutral`) · "Não foi possível confirmar seu plano." (`neutral`). Em carência o selo **continua verde com o texto "Premium"** — a cautela mora na legenda, em `--info-text`: o premium segue ativo e degradar o selo seria a mentira contrária.
- **Oferta de planos:** "recomendado" (`success`) sobre o cartão "Plano anual · R$ 155,88/ano · equivalente a R$ 12,99/mês · ~19% de economia frente ao mensal". O mensal é "R$ 15,99/mês".
- **Histórico (estado do registro):** "Pendente neste dispositivo" (`info`) · "Envio pausado · precisa de Premium" (`info`) · "Envio pausado · sessão expirada" (`info`) · "Não foi possível registrar" (`danger`). Repare que três desses passam de 20 caracteres — nenhum é uma palavra só.
- **Cenários:** "Alterações não salvas" (`neutral`).
- **Selo de procedência da tarifa (calculadora, um por canal):** textos montados, com números reais —
  - "Referência: Tabela de comissões da Amazon — Calçados (11%) · atualizada em 06/07/2026" (`info`)
  - "referência embutida (offline) · atualizada em 06/07/2026 · pode estar desatualizada" (`neutral`)
  - "Referência: Tabela do Mercado Livre (para Calçados) · atualizada em 06/08/2026" (`info`)
  - "categoria não informada — usando a maior alíquota da tabela" (`neutral`, **nunca** `info`)
  - "ajustado por você" (`neutral`) · "sem referência — informe as taxas" (`neutral`) · "estimativa de frete" (`info`)
  - selo separado da taxa fixa: "Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/08/2026" (`neutral`)
- **Selo Premium (a desenhar):** rótulo "Premium", laranja `--energy`, texto em `--energy-contrast`, ícone de coroa ~11px à esquerda, aparência **sólida** (não o fundo suave dos tons de status). Marca ação/campo bloqueado — vive colado a um botão ou ao título de um bloco gated, nunca sozinho no meio do nada.

## Estados obrigatórios
- **Repouso** — cada um dos quatro tons, sobre `--surface-card` **e** sobre `--bg-base`, nos dois temas. O escuro é onde o neutro morre: mostre a solução.
- **Selo Premium sólido** — laranja, com e sem ícone de coroa.
- **Selo longo (procedência)** — 2 e 3 linhas, texto alinhado à esquerda, respiro interno que não vira "caixa de texto", ainda legível como carimbo. Inclua o pior caso: "Referência: Tabela de comissões da Amazon — Calçados (11%) · atualizada em 06/07/2026 · pode estar desatualizada".
- **Premium pausado** — selo neutro "Premium pausado" + a legenda que o acompanha: "Seus itens salvos continuam disponíveis para leitura."
- **Carência** — selo verde "Premium" com a legenda em tom de cautela abaixo. Desenhe os dois juntos para provar que a temperatura visual difere de uma assinatura saudável **sem** degradar o selo.
- **Offline / informação velha** — o selo do plano ganha o sufixo "última informação do servidor" na legenda; o selo de tarifa embutido diz "referência embutida (offline)".
- **Erro** — "Não foi possível registrar" (`danger`) e o caso do plano não confirmado.
- **Sem permissão (gated)** — a ação com o selo Premium ao lado; o selo não é clicável, quem é clicável é a ação.
- **Não existem** para esta peça: foco, hover, pressionado, desabilitado. O selo é decorativo-informativo e **não recebe foco nem clique** — se o desenho quiser torná-lo interativo, isso é decisão de produto (veja Perguntas em aberto), não um estado a inventar.

## Viewports
- **Mobile 390px** — obrigatório: é onde o selo de procedência quebra linha e onde ele divide a largura com o campo de taxa. Desenhe o selo longo dentro de uma coluna de conteúdo real de 390px, não isolado.
- **Desktop 1280px** — a largura de corte do redesenho 018: o selo do plano vive na coluna do plano (com a oferta aberta inline ao lado) e o selo de procedência ganha espaço, então mostre como ele se comporta quando **cabe em uma linha só** — a mesma peça não pode parecer dois componentes diferentes.
- 1920px é opcional: nada muda além da largura disponível.

## Regras que o desenho não pode quebrar
- **Procedência é obrigação, não enfeite.** Um número pré-preenchido nunca pode parecer conferido pelo vendedor. O tom `info` significa "temos referência da SUA categoria"; catch-all e semente ficam em `neutral` de propósito — dar a eles o mesmo tom de uma referência confirmada é exatamente o que faz o vendedor parar de escolher a categoria.
- **Freemium é binário.** "Premium" e "Gratuito" são os dois únicos planos; não invente níveis intermediários, "trial" ou "pro".
- **Degradação dita, nunca escondida** — "pode estar desatualizada", "referência embutida (offline)", "sem referência — informe as taxas" precisam caber inteiras e legíveis. Frase honesta nunca em elemento que corta.
- **Falha de rede nunca vendida como falta de Premium** — "Envio pausado · sessão expirada" e "Envio pausado · precisa de Premium" são dois selos diferentes e devem ler-se diferentes.
- **Contraste medido contra o fundo real** — o selo vive sobre `--surface-card` e sobre `--bg-base`; texto ≥4,5:1 e a **borda/fundo do selo distinguível do cartão** em ambos os temas (é o defeito nº 1).
- **Alvo ≥44px** só vale se o selo virar interativo; hoje não é. Se ficar não-interativo, ele **não** pode parecer um botão nem um chip clicável.
- O selo **não carrega dinheiro**. Preço tem seu próprio primitivo; um selo com "R$ 1.234,56" dentro é sinal de que a informação está no lugar errado.

## Armadilhas já pagas neste projeto
- **A pílula que some no escuro** — `--bg-muted` e `--surface-card` são o mesmo neutral-900. Isso passou em todo teste de texto (o texto estava lá, legível) e só apareceu numa homologação visual. Qualquer solução tem de ser **medida contra o fundo do cartão**, não contra o fundo da página.
- **Texto que estoura a coluna** — o `white-space: nowrap` do primitivo empurrava a largura mínima do selo para a linha inteira e gerava rolagem horizontal em 390px. Nenhum selo pode forçar overflow horizontal; meça o eixo X **e** o eixo Y.
- **Frase honesta cortada** — a homologação de 016 pegou uma frase de honestidade morando num sufixo de placeholder, onde era clipada. Frases de honestidade vivem em elemento de largura cheia; selos carregam rótulos curtos.
- **Exceção local que vira DS de fato** — três decisões do primitivo já são revertidas por uma feature. Ou o desenho abençoa uma variante "selo longo", ou o primitivo continua sendo contrariado onde mais importa.
- **Selo decorativo que nunca preenche** — já houve um campo dentro do selo que nenhum caminho de produção alimentava. Todo pedaço desenhado precisa de um dado real por trás.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos completos:
1. **Cartela do primitivo** — os quatro tons em repouso, sobre `--surface-card` e sobre `--bg-base`, com as medidas de altura, respiro e raio anotadas, e a solução do contraste no escuro explicitada.
2. **Selo Premium** — sólido, laranja `--energy`, rótulo "Premium", com e sem coroa, em três contextos: ao lado de um `tf-button` gated, ao lado de um título de bloco gated, e dentro de uma linha de lista.
3. **Variante "selo longo" (procedência)** — os sete textos reais de tarifa, em 390px (quebrando) e em 1280px (uma linha).
4. **Em contexto** — o cartão do plano na Conta nos quatro estados (Premium, carência, Gratuito, Premium pausado) e uma linha do Histórico com cada um dos quatro selos de sincronização.
Reutilize os primitivos existentes: `tf-badge` é o alvo do redesenho; use `tf-card` como superfície de contexto, `tf-button` para a ação gated, `tf-alert` quando a mensagem for longa demais para um selo (é a fronteira que o desenho precisa marcar) e os tokens de texto para as legendas. Não crie primitivo novo — o que se pede é **uma propriedade de aparência (suave/sólida), um slot de ícone e um tom `accent`/laranja** no selo que já existe.

## Perguntas em aberto para o dono
1. O selo Premium **marca** a ação gated (carimbo ao lado, não clicável) ou **é** o gatilho da oferta (o vendedor toca nele e abre a assinatura)? Isso muda alvo mínimo, foco e se ele precisa de estado pressionado.
2. "Não foi possível confirmar seu plano." deve continuar dentro de uma pílula, ou vira legenda/alerta e o selo passa a mostrar algo curto (ex.: "Plano não confirmado")?
3. O selo de procedência da tarifa deve continuar sendo o mesmo componente do selo de status, ou é um componente próprio ("selo de procedência") com sua forma, já que é frase e não rótulo?
4. Existe algum lugar em que o laranja `--energy` do selo Premium concorra com o roxo `--accent` do botão principal na mesma linha? Se sim, quem ganha a atenção — a ação ou o carimbo?

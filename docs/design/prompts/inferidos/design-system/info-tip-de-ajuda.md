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

- **Onde vive:** `shared/ui/info-tip.tsx` + `info-tip.css`. O gatilho é uma pílula de 28×28 com o glifo `info`, cuja área clicável é esticada por um `::after` assimétrico (`inset: -12px -8px -4px`) até 44px sem inflar o desenho. Aparece em **4 pontos**, todos na aba Calcular (`/calcular`) e herdados pelo editor de peça dos Kits: (1) ao lado do TÍTULO de cada seção do formulário — `SectionTitle`, `calculator-form.tsx:146`; (2) na LINHA DO RÓTULO de qualquer campo com dica, à direita do texto, como `labelAddon` do `Field` (`calculator-form.tsx:183`); (3) no rótulo de "Vida útil da máquina" (`calculator-form.tsx:449`); (4) dentro do bloco de avisos da Shopee, ao lado do texto de frete medido (`shopee-warnings.tsx:51`).
- **Como o vendedor chega:** No desktop, por HOVER (com 80ms de atraso no fechamento); no toque, por CLIQUE — não há hover para dar a pista de que o ponto cinza é clicável. Escape fecha e SUPRIME o hover até o ponteiro sair de verdade do gatilho. O vendedor chega em dúvida sobre COMO aquele número entra na conta — é o coração da promessa de transparência do produto.
- **Vizinhança imediata:** O gatilho fica na mesma linha do rótulo, à direita do texto e SEMPRE irmão do `<label>`, nunca dentro dele (senão o nome acessível do campo vira "Vida útil da máquina Sobre a vida útil da máquina"). Abaixo do rótulo vem o `tf-inputwrap` com o campo, e abaixo dele a dica/aviso/erro. O cartão flutuante abre por cima, com `max-width: min(20rem, 100vw − 2×gutter)`, `radius lg`, `shadow md` e seta, posicionado por colisão do Radix — a 360px ele encosta nas duas bordas.
- **Dados que chegam (e o que ela devolve):** Duas coisas, ambas texto estático de `messages.pt-br`: `label` (nome acessível do botão, ex.: "Sobre a vida útil da máquina") e `children` (o corpo da explicação). Não recebe valor calculado, nem tarifa, nem entitlement. Devolve apenas abre/fecha — é não-modal: não prende o foco nem bloqueia a página por baixo.
- **O que acontece depois:** Fecha por Escape, clique fora ou saída do ponteiro, e o foco volta ao gatilho. Nada no formulário muda: o `InfoTip` nunca toca em `field.value`. O vendedor volta a digitar no campo logo abaixo — e é por isso que o cartão aberto não pode cobrir o próprio campo que ele explica.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Dica de ajuda ⓘ (InfoTip) — gatilho e cartão aberto

## O que desenhar
O ⓘ que explica **como a conta é feita**. É a peça mais repetida do produto: aparece ao lado do título de cada seção da Calculadora ("Custos da peça", "Detalhamento", "Marketplace", "Outros custos"), ao lado do rótulo de nove campos numéricos (gramas, consumo médio, tarifa, vida útil da máquina, manutenção, taxa de falha, tempo e valor de acabamento, horas e valor da mão de obra) e, desde 016/PR-F, como o **único lugar onde mora o corpo de um aviso da Shopee que foi colapsado para caber**. Quem usa é o vendedor leigo, no meio do preenchimento, quando não sabe o que o campo quer ou desconfia do número que saiu. É o coração da promessa de transparência: se o ⓘ não abre bem, o produto vira uma caixa-preta que cospe preço.

## Por que este prompt existe
O gatilho foi inferido inteiro pela IA: pílula de 28×28, glifo `info` cinza, fundo `--accent-soft` quando aberto, área de toque esticada por um pseudo-elemento assimétrico, abertura por hover com 80 ms de atraso e a regra do Escape que suprime o hover. O protótipo de 2026-07-02 (`CalculatorScreen.jsx:68-69`) desenhou **só metade**: um `circle-help` de 15px em `--text-faint` na linha do rótulo, à direita do texto, com o mesmo papel ("explicar como o campo entra na conta"). Ou seja: **posição e papel têm autoridade; o cartão ABERTO nunca foi desenhado por ninguém** — nem largura, nem hierarquia, nem o que acontece com um texto de 330 caracteres a 360px. O `Tooltip` do kit foi citado no readme mas nunca exportado. E as quatro abas desktop redesenhadas (`Abas-Desktop.dc.html`) têm **zero** ⓘ — o desenho do desktop simplesmente não considerou esta peça.

## O que já existe hoje (não invente do zero — corrija)

**Gatilho** (`shared/ui/info-tip.tsx` + `.css`)

| Propriedade | Valor real hoje |
|---|---|
| Caixa pintada | 28 × 28 px, `border-radius: var(--radius-pill)`, fundo transparente |
| Glifo | ícone `info` (círculo + haste + ponto), 16 px, `--text-muted` |
| Hover / aberto | cor `--accent-text`, fundo `--accent-soft` |
| Área clicável | esticada por um retângulo invisível `inset: -12px -8px -4px` → 8+28+8 = 44 de largura, 12+28+4 = 44 de altura |
| Posição | na mesma linha do título da seção (`gap: 4px`) ou como `labelAddon`, irmão do `<label>`, **nunca dentro dele** |

→ o gatilho **não tem estado de foco desenhado**: hoje ele herda o anel padrão e ninguém verificou como esse anel se comporta sobre um alvo de 28px cujo alvo real é 44 (o anel desenha na caixa pintada, não na área de toque — decida isso no desenho).
→ o retângulo de toque é **assimétrico** (−12 em cima, −4 embaixo) porque abaixo dele há só 8px até o campo. Isso não é enfeite: é uma regra de não-colisão que o desenho precisa respeitar, não "arredondar para 44 de todos os lados".

**Cartão aberto**

| Propriedade | Valor real hoje |
|---|---|
| Largura máxima | `min(20rem, 100vw − 2 × gutter)` — 320px no desktop, ~326px a 360px |
| Caixa | `--surface-card`, borda 1px `--border-subtle`, `--radius-lg`, `--shadow-md` |
| Espaçamento | `--space-3` em cima/baixo, `--space-4` nas laterais |
| Texto | `--fs-body-sm`, `--lh-normal`, `--text-body` — **um único bloco de corpo, sem título** |
| Seta | preenchida com `--surface-card` (não acompanha a borda) |
| Posição | lado preferido `top`, centralizado, 6px de folga, 12px de margem anticolisão; o Radix vira o cartão sozinho |

→ **o cartão não repete o assunto.** O `label` ("Sobre a tarifa de energia") existe só como nome acessível do botão — quem enxerga abre e lê um parágrafo solto, sem cabeçalho. Para um corpo de 3 frases com fórmula dentro, isso é um muro de texto. Decidir no desenho: título dentro do cartão, sim ou não.
→ a seta é `--surface-card` sem contorno: no tema claro, sobre um fundo claro, ela some do recorte da borda. Desenhe a seta com a borda incluída.

## Conteúdo e dados reais
Todo texto abaixo é **literal e homologado** — não reescreva, desenhe para ele.

- Rótulos dos gatilhos (nome acessível): `"Sobre os custos da peça"`, `"Sobre mão de obra e custos"`, `"Sobre outros custos"`, `"Sobre o markup"`, `"Sobre o cálculo do preço"`, `"Sobre o marketplace"`, `"Sobre as gramas usadas"`, `"Sobre o consumo médio"`, `"Sobre a tarifa de energia"`, `"Sobre a vida útil da máquina"`, `"Sobre a reserva de manutenção"`, `"Sobre a taxa de falha"`, `"Sobre o tempo de acabamento"`, `"Sobre o valor do acabamento"`, `"Sobre a mão de obra (horas)"`, `"Sobre o valor da hora"`, `"Sobre o frete aferido"`.
- **Corpo curto (piso, 92 caracteres)** — use para provar que o cartão não fica gordo com pouco texto:
  `"Cada linha em reais soma exatamente ao custo total; os preços vêm do custo total × markup."`
- **Corpo com FÓRMULA** — a hierarquia mais difícil, porque a fórmula precisa ser lida sem quebrar no meio:
  `"O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × gramas usadas. Energia = tempo de impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão."`
  e `"Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa."`
- **Corpo longo com dinheiro e exemplo (teto, 355 caracteres)** — desenhe o cartão COM ele:
  `"É quanto vale uma hora do seu trabalho. Sem esse número, você entrega horas de graça no preço. Descubra o seu assim: quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.: R$ 3.000 ÷ 160 h = R$ 18,75. Só para comparar, o salário mínimo dá R$ 7,37 a hora."`
  e `"…Sem a conta em mãos, a média do país fica perto de R$ 0,85."` (os dois valores em reais são **constantes datadas** injetadas no texto — no desenho eles são números de verdade, não `{placeholder}`).
- **Corpo do aviso Shopee** (o caso em que o ⓘ carrega o conteúdo inteiro de um alerta, não uma explicação de conta):
  linha visível `"Frete aferido pode gerar cobrança retroativa"` + ⓘ; dentro do cartão:
  `"Se o peso ou as dimensões cadastrados forem menores que os aferidos pela transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra no cálculo — é um risco a considerar ao cadastrar o anúncio."`
  Esse gatilho vive numa linha `tf-alert--compact` (ícone `info` de 20px + título + ⓘ), alinhada ao centro, `--space-2`/`--space-3` de padding — ou seja: **dois glifos de informação na mesma linha**, um decorativo de 20px e o clicável de 16px. → isso lê como ruído e é um problema a resolver no desenho.

## Estados obrigatórios
1. **Repouso** — glifo `--text-muted` sobre fundo transparente, sem caixa. Precisa parecer clicável no toque, onde não existe hover para dar a pista (é o impacto declarado na auditoria).
2. **Hover** (só ponteiro fino) — cor `--accent-text`, fundo `--accent-soft` na pílula.
3. **Foco por teclado** — anel de foco visível sobre uma pílula de 28px encostada no rótulo; mostre a folga que impede o anel de cortar o texto ao lado.
4. **Pressionado / aberto** — mesmo tratamento do hover, mantido enquanto o cartão estiver aberto (o gatilho é a âncora visual da seta).
5. **Cartão aberto — corpo curto** (1 frase) e **corpo longo** (355 caracteres, com `R$ 18,75` dentro).
6. **Cartão aberto acima e abaixo** — o lado padrão é acima; quando não cabe, o Radix vira para baixo e a seta troca de ponta. Desenhe os dois.
7. **Cartão colidindo com a borda** — a 360/390px o cartão para a 12px da borda e a seta desalinha do centro do gatilho. Desenhe esse desalinhamento, não a versão ideal centralizada.
8. **Fechado = ausente** — quando fechado, o cartão não existe na tela (nada de conteúdo escondido por opacidade).
9. **Variante alerta compacto (Shopee)** — a linha inteira em repouso e com o cartão aberto sobre ela.

Não existem estados de carregando, erro, offline, vazio, degradado nem premium pausado nesta peça: o conteúdo é texto estático embutido. Não invente nenhum deles.

## Viewports
- **390px (obrigatório)** — é onde a peça vive de verdade e onde o cartão bate na borda; mostre gatilho + cartão longo aberto no mesmo quadro, com a medida da margem sobrando.
- **360px (obrigatório)** — o piso medido do projeto e a largura em que a linha Shopee foi colapsada; é o caso que mais aperta.
- **1280px** — a Calculadora e o formulário de produto também rodam no desktop, onde o hover existe e o cartão de 320px é confortável. Mostre pelo menos o gatilho na linha do rótulo com o cartão aberto acima.
- Não precisa de 1920px: as quatro abas desktop do 018 não têm ⓘ hoje, e decidir se elas passam a ter é pergunta do dono (abaixo).

## Regras que o desenho não pode quebrar
- **O clique é o caminho universal; o hover é enfeite.** Todo conteúdo tem de ser alcançável por toque e por teclado — nenhuma explicação pode depender de passar o mouse.
- **Alvo ≥44px sem inflar o desenho.** A caixa pintada continua 28×28; o alvo cresce por fora e é assimétrico para não roubar o toque do campo que está 8px abaixo.
- **A frase honesta nunca cabe em placeholder nem em texto cortado.** O corpo do cartão é o lugar onde o produto explica a conta — se ele trunca, o produto mentiu por omissão. Sem `line-clamp`, sem "ver mais".
- **Nada de número inventado no desenho.** `R$ 0,85` e `R$ 7,37` são constantes datadas com revisão anual; use exatamente esses e nenhum outro valor de referência.
- **O cartão não é modal.** Não escurece a página, não prende o foco, não bloqueia o formulário atrás.
- **O gatilho nunca entra dentro do `<label>`.** Ele fica na linha do rótulo como elemento irmão — juntar os dois já quebrou o nome acessível do campo uma vez ("Vida útil da máquina Sobre a vida útil da máquina").
- **Contraste medido contra o fundo real** do cartão (`--surface-card`), nos dois temas, incluindo a seta.

## Armadilhas já pagas neste projeto
- **O ⓘ na linha do controle esmagou o campo** (016/PR-C, achado B4): disputando a linha com um sufixo de unidade largo (`/kWh`), a "Tarifa de energia" ficou com **1px** de input visível a 360/390px. Por isso ele mora na linha do RÓTULO. Não devolva o ⓘ para a linha do input.
- **Escape que se desfazia sozinho** (016/PR-C, R3): fechar com Escape sem mover o mouse reabria o cartão na hora. O desenho precisa deixar claro que o gatilho aberto é um estado do gatilho, e que fechar é fechar.
- **Texto que passa em teste e não aparece na tela**: `toBeVisible` passa em texto ocluso ou estourado. Meça caixas — largura do cartão, distância até a borda, altura da linha compacta.
- **Overflow horizontal medido nos dois eixos**: o headless não enxerga barra de rolagem clássica; se o cartão empurrar a página a 360px, ninguém vê no teste.
- **Alerta que ocupava 1248px de altura** a 360px foi o que criou a variante compacta — o ⓘ virou compressor de conteúdo. Desenhe essa variante sabendo que ela é uma solução de espaço, não uma explicação de conta.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro em paridade** (os dois com a seta e a sombra verificadas):
1. Gatilho em 4 estados lado a lado (repouso, hover, foco por teclado, aberto), com a área de toque de 44×44 desenhada como sobreposição cotada.
2. Cartão aberto com o corpo curto e com o corpo longo (`R$ 18,75`), a 390px, lado `top`.
3. Cartão virado para baixo e cartão colidindo com a borda a 360px, com a seta fora do centro.
4. Cartão com fórmula (`Anúncio = (preço + taxa fixa) ÷ (1 − comissão%)`) — mostrando como a fórmula não quebra no meio.
5. A linha `tf-alert--compact` da Shopee em repouso e aberta.
6. Desktop 1280px: a linha de rótulo do campo "Tarifa de energia" com sufixo `/kWh` no input e o ⓘ no rótulo, cartão aberto.

Reutilize os primitivos existentes: o **ícone `info` do conjunto da casa** (16px no gatilho, 20px no ícone decorativo do alerta), a **superfície de cartão** e a **sombra média** já definidas para popovers, o **raio pill** no gatilho e o **raio lg** no cartão, o **tom `--accent-soft`/`--accent-text`** para o estado aberto e o **corpo pequeno** para o texto. Não crie um novo componente de tooltip nem um novo tom de fundo.

## Perguntas em aberto para o dono
1. **O cartão ganha título?** Hoje o `label` ("Sobre a tarifa de energia") só é lido por leitor de tela; quem enxerga recebe um parágrafo sem cabeçalho. Repetir o label como título dentro do cartão é decisão de produto.
2. **A mesma peça serve para dois papéis?** Explicar a conta (ⓘ ao lado do título/rótulo) e esconder o corpo de um aviso comprido (Shopee) são coisas diferentes; se forem a mesma, a linha compacta fica com dois glifos de informação — se forem duas, precisamos de um segundo desenho.
3. **As quatro abas desktop do 018 passam a ter ⓘ?** Hoje têm zero. Catálogo, Kits, Orçamentos e Conta também mostram números derivados que ninguém explica.
4. **Na variante compacta, o ícone decorativo de 20px continua?** Ele duplica o glifo do gatilho na mesma linha.

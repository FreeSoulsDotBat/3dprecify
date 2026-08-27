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

- **Onde vive:** Não é uma peça, é uma AUSÊNCIA de regra espalhada por sete folhas de estilo da pasta: `button.css`, `card.css`, `field.css`, `dialog.css`, `empty-state.css`, `toast.css`, `segmented.css`. Manifesta-se em toda tela ≥1280px: `/catalogo` em mestre-detalhe (lista à esquerda + ficha fixa de 560px à direita), `/kits`, `/historico`, `/conta` e `/calcular` — em qualquer largura de 1280 a 1920, dentro da coluna de conteúdo que sobra à direita da barra lateral (240px expandida / 76px recolhida).
- **Como o vendedor chega:** O vendedor abre o app no notebook ou no monitor grande — é exatamente o gesto que abriu o incremento 018: o dono re-andou as quatro abas a 1920px e julgou o desktop errado. Chega esperando densidade de aplicativo de trabalho e encontra corpo de celular.
- **Vizinhança imediata:** Dentro dos quadros novos que o dono desenhou: barra lateral fixa à esquerda, TopBar em cima, e o conteúdo entre elas. Aí convivem controles de 48px de altura com piso de toque de 44px, cartões com `padding --space-5`, diálogo de 32rem, folha de 26rem, `EmptyState` limitado a 28rem CENTRALIZADO dentro de uma coluna que pode ter 1720px, e o rótulo de campo (`.tf-field__label`) reservando DUAS linhas de altura — reserva cujo comentário no código diz que existe para alinhar grades de 2 colunas, um problema de tela estreita.
- **Dados que chegam (e o que ela devolve):** Nenhum dado de produto. O único sinal disponível é a largura da janela: `useIsWide()` (corte em 1280px, retorna false sem `matchMedia`) e as duas ÚNICAS regras `@media` de toda a pasta `shared/ui` — `switch.css:54` (`prefers-reduced-motion`) e `toast.css:15` (`min-width: 768px`). Nenhum outro primitivo tem faixa de viewport.
- **O que acontece depois:** Nada muda hoje: a mesma peça é servida a 390px e a 1920px. O que se decide aqui é se altura de controle, espaçamento interno, escala tipográfica e alvo de ponteiro (que não precisa dos 44px de dedo) passam a variar acima de 1280 — e, se passarem, tudo o que está montado dentro dos quadros do desktop reflui junto, incluindo a ficha de 560px do Catálogo e as grades de 2 colunas do formulário.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Densidade dos primitivos no desktop (≥1280px)

## O que desenhar

Uma **prancha de densidade**: como cada primitivo `tf-*` deve se comportar quando a janela passa de
1280px de largura. Não é uma tela — é a régua que as quatro abas redesenhadas do 018 (Catálogo, Kits,
Orçamentos, Conta) vão herdar. Quem "usa" essa peça é o vendedor sentado num monitor de 1920px com
mouse e teclado, na jornada inteira: preencher um custo, abrir uma ficha lateral, confirmar um diálogo,
ler um toast, trocar de seção num grupo segmentado. Hoje ele vê, a 1920px, exatamente o mesmo corpo que
o vendedor de celular vê a 390px.

## Por que este prompt existe

Foi inferido que **nada muda**. Medição: `grep -rn "@media" apps/web/src/shared/ui` devolve DUAS linhas
em toda a camada de primitivos — `switch.css:54` (`prefers-reduced-motion`) e `toast.css:15`
(`min-width: 768px`, que só reposiciona o toaster). Nenhum primitivo tem regra de largura. A autoridade é
`PROTOTIPO_PARCIAL` e o verificador foi explícito: o canvas do 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) **decide densidade por encaixe e inline** —
`tf-btn--sm` em uma dúzia de botões ("Sair", "Duplicar", "Excluir", "Remover peça"), `tf-card--pad-sm`
nos cartões laterais, `h1` forçado a `1.75rem`, preço a `2.25rem` e `1.5rem` — e o diretório
`design/assets/` **não existe**, então o `<link rel="stylesheet" href="assets/app.css">` da linha 12 é
morto: as classes `tf-*` do canvas não têm pele, e a aparência que o arquivo entrega vem só do inline.
Ou seja: **o dono nunca viu a densidade dos primitivos renderizada**. É essa a queixa que abriu o 018 —
os quadros novos estão desenhados, as peças dentro deles seguem com corpo de celular.

## O que já existe hoje (não invente do zero — corrija)

Valores medidos no código (`apps/web/src/shared/ui/*.css` + `styles/tokens/spacing.css`,
`styles/tokens/typography.css`). Tudo abaixo vale **igual em 390px e em 1920px**:

| Peça | Hoje (valor único, sem faixa de viewport) | |
|---|---|---|
| `tf-btn` | altura 48px, padding lateral 20px, texto 16px, piso `min-width/min-height: 44px` | → a 1920 é um botão de polegar |
| `tf-btn--sm` / `--lg` | 36px / 56px; padding 16px / 28px; texto 14px / 18px | → o canvas usa `--sm` em quase tudo: **sinal de que o padrão está grande demais no desktop** |
| `tf-card` | padding 20px (`--space-5`); `--pad-sm` 16px; `--pad-lg` 28px | → cartão lateral fica apertado, cartão de lista fica gordo |
| `tf-inputwrap` | altura 48px, padding lateral 16px, `min-width: 8rem` (128px) | → o piso de 128px foi calibrado para grade 2-col de celular |
| `.tf-field__label` | **reserva de DUAS linhas** (`min-height: calc(2 * 1.2 * 1em)` a 13px ≈ 31px) | → o comentário no código diz por quê: alinhar grades de 2 colunas. **É um problema de celular ocupando ~15px de vazio por campo, em toda linha do desktop** |
| `.tf-field__hint` / `__error` | 12px | → legenda de 12px a 1920px é ilegível a distância de monitor |
| `tf-dialog` (modal) | `width: min(92vw, 32rem)` = teto 512px, padding 24px, `max-height: 85vh` | → 512px num quadro de 1920px |
| `tf-dialog--sheet-right/left` | `width: min(92vw, 26rem)` = teto **416px**, padding 20px | → a ficha do 018 tem **560px**; a folha não alcança |
| `tf-dialog__title` | 22px, caixa alta, `padding-right: 40px` (espaço do X) | |
| `tf-dialog__x` | 44×44px, a 12px do topo/direita | |
| `tf-empty` | `max-width: 28rem` (448px), padding 40/20, ícone 56×56, título 22px, texto 14px | → 448px centralizado dentro de uma coluna de **1720px** |
| `tf-toaster` | `min(92vw, 30rem)` = 480px; a ≥768px vai para o canto inferior direito (24px) | → única regra responsiva que existe; o corte é 768, não 1280 |
| `tf-toast` | padding 12/12/12/16, mensagem 14px, fechar 44×44 | |
| `tf-segmented__item` | `min-height: 44px`, padding 8/16; `--sm` 12px, padding 8/12; `--md` 14px; ícone 16px | → a bandeja rola na horizontal quando não cabe (correto, mantenha) |
| Coluna da página | `--content-max` 1120px; a ≥1280 vira `--content-max-wide` **1720px**; sidebar 240px, rail recolhido 76px; gutter 16px no mobile, **32px** no desktop | ✔ isto **já** tem faixa de viewport — só o miolo não tem |

## Conteúdo e dados reais

- Escala de espaço disponível (não invente outra): 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 40 · 48 · 56 · 64px.
- Alturas de controle existentes: **36 / 48 / 56px**, e o piso de toque **44px**.
- Escala tipográfica existente: 12 · 13 · 14 · 16 · 18 · 22 · 28 · 36 · 48px; preço a
  `clamp(2.5rem, 9vw, 3.75rem)` (a 1920px bate o teto de 60px), `tf-price--md` = 36px.
- Números de verdade para preencher os exemplos (são os valores da semente do app, não invente outros):
  preço sugerido **R$ 24,24**, custo **R$ 16,16**, alternativa **R$ 21,01**. Um caso adversarial
  obrigatório: **R$ 1.234.567,89** dentro do mesmo componente.
- Rótulo longo real para testar a reserva de duas linhas: **"Reserva de manutenção"** (é o exemplo
  citado no próprio comentário do código) e **"Tarifa de energia"** (o campo com prefixo de moeda **e**
  sufixo de unidade ao mesmo tempo — o pior caso já medido).
- Grupo segmentado real do 018: as seções do Catálogo — **Filamentos · Impressoras · Produtos · Kits**.

## Estados obrigatórios

Desenhe cada estado **na densidade nova**, não só em repouso:

- **Repouso** — botão, campo, cartão, pílula.
- **Hover** (só existe no desktop, e é aqui que ele estreia de verdade): `tf-btn--secondary` muda a
  borda para `--border-strong`; `tf-card--interactive` sobe 2px e ganha sombra média; `tf-inputwrap`
  troca a borda; a pílula não selecionada clareia o texto.
- **Foco visível** — anel `--ring` no botão/campo; na pílula selecionada é **outline** de 2px com offset
  2px (troca de fundo sumiria justamente no item já destacado).
- **Pressionado** — `scale(0.97)` no botão; `tf-card--interactive` volta a `translateY(0)`.
- **Desabilitado** — opacidade 0,55 no botão, cursor `not-allowed`; campo desabilitado ganha fundo
  `--bg-muted` e opacidade 0,6.
- **Carregando** — `tf-btn--loading` (cursor `progress` + spinner na cor do texto).
- **Erro no campo** — borda `--danger` que **permanece vermelha com foco dentro** (o anel vira vermelho,
  não roxo) + linha de erro em `--danger-text`, 12px.
- **Aviso de plausibilidade** — é um estado SEPARADO do erro: tom `--info-text`, dentro do hint. O
  número não foi recusado; pintar de vermelho diria o contrário do que a frase diz.
- **Vazio** — `tf-empty` com ícone, título 22px e ação; mostre-o **dentro da coluna larga**, que é onde
  o problema aparece.
- **Toast** nos três tons (info/sucesso/erro) na posição de desktop (canto inferior direito).
- **Pílula selecionada** — fundo `--surface-raised` + `--shadow-xs`. Não use `--surface-card`: no tema
  escuro ele é o mesmo `#14151a` da bandeja (contraste medido **1,00:1** — a pílula não existia na
  tela). Isso já foi pago no review do PR #58.

## Viewports

- **1920px** — a prancha principal. É a largura em que o dono julgou o desktop errado.
- **1280px** — o corte. Acima dele o app é estruturalmente outro (mestre-detalhe, rail recolhível); a
  densidade nova só pode existir a partir daqui.
- **1279px** — desenhe o par de fronteira ao lado do 1280 para provar que a troca não quebra nada.
- **390px** — obrigatório, e **idêntico ao que existe hoje**. O mobile não se mexe; a prancha do 390
  serve de prova visual disso, não de proposta.

## Regras que o desenho não pode quebrar

- **O mobile não muda.** Toda decisão desta prancha nasce acima de 1280px. Se um valor novo também
  melhora o celular, isso é assunto de outro prompt.
- **A escala é fechada.** Use apenas os degraus de espaço e de tipo que já existem; densidade nova é
  escolher outro degrau, nunca inventar 22px de padding.
- **Contraste medido contra o fundo real** — a pílula dentro de um cartão dentro de uma bandeja são três
  superfícies empilhadas; foi exatamente esse empilhamento que produziu 1,00:1 na Conta.
- **Estado nunca só por cor** (WCAG 1.4.1) e indicador de estado nunca abaixo de 3:1 (1.4.11): a seleção
  precisa de relevo, não só de matiz.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega número; aviso, degradação e
  procedência moram em elemento de largura cheia.
- **Nada de transbordo horizontal de página.** Um contêiner que se declara rolável (a bandeja
  segmentada) pode rolar; a página não.

## Armadilhas já pagas neste projeto

- **Cortar altura por corte de viewport quebra o alvo de toque.** Existe laptop com tela sensível a
  toque acima de 1280px; o piso de 44px não é decoração. Ver "Perguntas em aberto".
- **Diminuir `min-width` do campo derruba a grade.** O piso de 128px do `tf-inputwrap` existe porque o
  input carrega `min-width: 0` e nada segurava o invólucro; o pior caso (prefixo de moeda + sufixo de
  unidade) já estourou o viewport uma vez e teve de virar grade que reflui.
- **Valor grande estoura a coluna** — R$ 1.234.567,89 num `tf-price` ou numa célula de tabela; isso não
  aparece em teste de texto, só na imagem.
- **Texto ocluso passa em teste.** Oclusão não é propriedade de texto: se o desenho encolher o padding e
  a legenda encostar no botão, nenhuma asserção existente acusa. Marque as folgas com medida.
- **O canvas do 018 não renderizou os `tf-*`** (a folha `assets/app.css` não existe). Não trate a
  aparência daquele arquivo como aprovação de densidade — trate como intenção a ser desenhada agora.

## Entregável

Pranchetas, **tema escuro como padrão e tema claro como first-class** (as duas versões de cada uma):

1. **Régua de controles** — `tf-btn` nas quatro variantes (primary/secondary/ghost/danger-ghost) e nos
   três tamanhos, com a altura escolhida cotada em px, lado a lado com o valor de hoje.
2. **Régua de formulário** — `tf-field` + `tf-inputwrap` numa grade de 2 colunas com "Reserva de
   manutenção" e "Tarifa de energia", mostrando o que acontece à reserva de duas linhas do rótulo.
3. **Superfícies** — `tf-card` nos três paddings, dentro da coluna de 1720px, com a lista mestre à
   esquerda e a ficha à direita.
4. **Camadas flutuantes** — `tf-dialog` modal e `tf-dialog--sheet-right` (a folha que edita filamento e
   impressora no desktop), com a largura cotada.
5. **Vazio e feedback** — `tf-empty` dentro da coluna larga, `tf-toast` nos três tons no canto inferior
   direito, `tf-segmented` com Filamentos · Impressoras · Produtos · Kits.

Reutilize os primitivos existentes — nenhum componente novo. O que muda é o **corpo** deles acima de
1280px, e cada mudança vem com o número em px anotado na prancha para virar token direto.

## Perguntas em aberto para o dono

1. **O piso de 44px cai no desktop?** O verificador observa que alvo de ponteiro não precisa de 44px,
   mas o app é PWA e roda em laptop com tela sensível a toque. Manter 44 acima de 1280, ou baixar (e
   para quanto)?
2. **A altura padrão de controle a ≥1280 é 48px, 44px ou 40px?** O canvas usa `tf-btn--sm` (36px) em
   quase tudo — isso é a resposta pretendida, ou só o que coube naquele encaixe?
3. **A reserva de duas linhas do rótulo morre no desktop?** Ela existe para alinhar grade de 2 colunas
   no celular; acima de 1280 há largura para o rótulo em uma linha só.
4. **A folha lateral vai a 560px** (a medida da ficha do 018) ou fica no teto atual de 416px? Hoje as
   duas medidas se contradizem.
5. **O estado vazio segue centralizado em 448px** dentro de 1720px, ou passa a ocupar a coluna da lista?
6. **O toaster continua trocando de posição a 768px**, ou o corte dele também passa para 1280?

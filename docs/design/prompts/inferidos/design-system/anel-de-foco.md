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

- **Onde vive:** Não é uma peça: é o token `--ring` (`styles/tokens/elevation.css`) aplicado em `:focus-visible` por **todos** os primitivos — `button.css`, `field.css` (no `tf-inputwrap`, via `focus-within`), `dialog.css` (no X), `switch.css` (na trilha, não na raiz), `toast.css` (no fechar) — MENOS um: `segmented.css`, que desenha `outline: 2px solid var(--accent)` com offset, uma segunda linguagem.
- **Como o vendedor chega:** Pela tecla Tab, ou por um teclado externo ligado ao tablet. O vendedor que navega assim não tem outra pista de onde está o cursor — e quem usa mouse só vê o anel de raspão, ao clicar fora de um campo.
- **Vizinhança imediata:** Todo lugar onde há foco: a fileira de botões do diálogo central, os campos empilhados da folha lateral, as pílulas do controle segmentado do Catálogo e do tema, os cartões clicáveis da lista mestre no desktop, os itens do menu lateral, o X das folhas e o botão de fechar do toast. Em cada um o anel encosta em vizinhos diferentes — no `tf-inputwrap` ele foi propositalmente casado com a cor da borda para os dois lerem como UM traço só (no tema escuro, cores distintas apareciam como borda dupla).
- **Dados que chegam (e o que ela devolve):** Nenhum dado — só o estado de foco do navegador e o tema corrente (`data-theme`, do `theme-store` em localStorage), que troca a cor do anel. Hoje o token exportado pelo desenho define 3px em DUAS camadas e o app redefiniu `--ring-width: 2px` com uma camada só, porque a dupla lia como borda dupla.
- **O que acontece depois:** O anel não faz nada — ele só diz onde Enter/Espaço vão bater. Sua consequência prática é a navegação inteira por teclado, incluindo a devolução de foco ao botão de origem quando um diálogo ou folha fecha (contrato do Radix).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# O anel de foco — a única pista de onde o cursor está

## O que desenhar
O indicador de foco de teclado (`:focus-visible`) do Precifica3D, peça por peça: botão, campo de
texto/número, campo em erro, pílula do grupo segmentado, chave (switch), cartão clicável, item do menu
de navegação, opção de lista (o seletor de categoria), botão de fechar de diálogo e de toast, e o link
ou botão "cru" que não veste nenhuma classe do DS. Não é uma tela: é um estado que aparece em TODAS as
telas — Calculadora, Catálogo, Kits, Orçamentos, Histórico, Conta — e é a única coisa que diz a quem
navega por Tab onde ele está. Quem usa: teclado, leitor de tela com foco visual, e qualquer pessoa num
desktop 1920px que prefira Tab a mouse (o público desktop cresceu com o 018).

## Por que este prompt existe
O anel TEM desenho — o token exportado do Claude Design (`.design-import/tokens/elevation.css`) crava
`--ring-width: 3px` com DUAS camadas (sólido + halo 28%), e o readme do kit diz literalmente "Focus:
visible 3px purple ring, :focus-visible only, never removed". O app divergiu conscientemente: redefiniu
`--ring-width: 2px` com UMA camada só, com o motivo escrito no comentário ("the former double-layer read
as a double border, so the halo is dropped"). Ou seja: **o código contraria uma regra de desenho
explícita, com justificativa, e ninguém decidiu qual das duas vale.** O que não tem desenho em lugar
nenhum é o foco POR PEÇA: nenhuma das 6 telas do ui_kit e nenhum quadro do canvas renderiza um estado de
foco. Foi nesse vazio que nasceram **cinco linguagens diferentes** de foco, cada uma inventada no
arquivo onde a anterior não servia.

## O que já existe hoje (não invente do zero — corrija)

As cinco linguagens vivas, todas em `:focus-visible`, todas com 2px:

| Peça | Como o foco aparece hoje | Cor |
| --- | --- | --- |
| Campo (`.tf-inputwrap:focus-within`) | anel EXTERNO 2px colado na borda + a própria borda repintada da cor do anel, para lerem como um traço só | `--focus-ring` (claro `#7800ff` · escuro `#9a4bff`) |
| Campo em ERRO | anel de 2px vermelho translúcido (38%), borda continua vermelha — o roxo não entra | `--danger` a 38% |
| Botão `.tf-btn`, cartão clicável, X do diálogo, X do toast, trilho do switch, opção do seletor de categoria | o MESMO anel externo 2px do campo | `--focus-ring` |
| Link/botão "cru" (sem classe do DS) | contorno 2px **afastado 2px** da peça — outra forma, não o anel | `--focus-ring` |
| Pílula do grupo segmentado | contorno 2px afastado 2px, e usando um token DIFERENTE | `--accent` (`#7800ff` nos DOIS temas) |
| Item do menu (`.tf-nav__item`) | anel **INTERNO** 2px abraçando a forma arredondada do item + fundo `--accent-soft` | `--focus-ring` |

→ **Problema 1 — a espessura.** A marca especificou 3px + halo; o app entrega 2px sem halo. Precisa de
uma decisão desenhada, não de dois arquivos discordando.

→ **Problema 2 — três formas para a mesma ideia** (anel externo colado · contorno afastado 2px · anel
interno). Cada uma nasceu de um motivo REAL e bom, que o desenho tem de honrar em vez de apagar:
o afastado existe porque uma troca de fundo sumiria justamente no item já selecionado; o interno existe
porque no menu o item ativo já é um fundo suave e um anel externo repintava a "caixa roxa" que o dono
reclamou — sem ele, focar um item já ativo não mudava NADA na tela.

→ **Problema 3 — o segmentado usa `--accent`, não `--focus-ring`.** No tema escuro `--accent` continua
`#7800ff` enquanto `--focus-ring` clareia para `#9a4bff` — o anel do segmentado é o único que fica roxo
escuro sobre bandeja escura. Medir contra o fundo real (`--bg-muted` / `--surface-raised` no escuro).

→ **Problema 4 — peça sem foco nenhum.** O "abrir/fechar" da árvore do seletor de categorias
(`.category-picker__expand`) só troca a cor do texto no foco. Cor como único sinal, e fraco.

→ **Problema 5 — o botão de fechar.** X do diálogo e X do toast usam o anel externo colado; num canto,
2px de anel externo podem cair fora da caixa arredondada e ser cortados.

## Conteúdo e dados reais
A peça não tem texto próprio. O que ela precisa respeitar como contexto:
- Alturas de controle **36 / 48 / 56px**; alvo mínimo **44×44px**; raios **6 (xs) / 14 (md, campos e
  botões) / 18 / 24 / pílula**. O anel acompanha o raio da peça, pílula inclusive.
- Cores do anel: claro `--focus-ring: #7800ff`; escuro `--focus-ring: #9a4bff`. Fundos sobre os quais o
  anel realmente aparece: claro `#ffffff` (cartão) e neutro-100 (`--bg-muted`); escuro `#14151a`
  (`--surface-card` E `--bg-muted` — são o MESMO valor) e neutro-800 (`--surface-raised`).
- O trilho do switch tem 44×24px com polegar de 20px dentro de um alvo de 44×44 — o anel envolve o
  TRILHO, não o alvo invisível.
- Campos que recebem foco carregam dinheiro em fonte tabular alinhada à direita, com prefixo e sufixo
  dentro da moldura: `R$ 1.234,56`, `R$ 24,24`, `R$ 16,16`. O anel envolve a moldura inteira (prefixo +
  número + sufixo), nunca só o número.
- Pílulas do segmentado hoje: rótulos curtos ("Escuro" / "Claro" / "Sistema", abas da Conta), com ícone
  opcional de 16px à esquerda, dentro de uma bandeja que ROLA na horizontal quando não cabe.
- Alto contraste do Windows (`forced-colors`): o anel de sombra some, e hoje só link/botão/campo e o
  item do menu têm substituto (contorno 2px na cor `Highlight`). Desenhar como cada peça se comporta
  quando o sistema decide as cores.

## Estados obrigatórios
- **Repouso** — nenhum anel. Nunca desenhar foco permanente.
- **Foco de teclado (`:focus-visible`)** — o estado central deste prompt, em cada peça da tabela acima.
- **Foco + hover** — o mouse já mudou fundo/borda (o botão secundário troca `--border-default` por
  `--border-strong`; a opção de lista ganha `--bg-muted`); o anel continua legível por cima disso.
- **Foco + pressionado** — o botão encolhe (escala 0,97) enquanto apertado; mostrar o anel acompanhando
  a escala sem "descolar" da peça.
- **Foco + selecionado/ativo** — a pílula já selecionada (fundo em relevo + sombra) e o item de menu já
  ativo (fundo suave). Se o foco não for VISÍVEL nesses dois, o desenho falhou.
- **Foco + erro** — campo inválido: borda vermelha mantida, anel vermelho translúcido, mensagem de erro
  abaixo. O roxo não pode voltar por cima do vermelho.
- **Foco + aviso de plausibilidade** — o campo aceita o número e mostra um aviso em tom `info` no hint;
  o anel de foco é o roxo normal, nunca o vermelho (o número não foi recusado).
- **Desabilitado** — não recebe foco: opacidade 0,55 e cursor bloqueado. Desenhar para deixar explícito
  que a ausência de anel ali é intencional.
- **Foco programático em elemento não interativo** — o `<h1>` que recebe foco a cada navegação **não
  mostra anel nenhum** (é afordância de leitor de tela, não escolha do usuário). Manter assim.
- **Alto contraste forçado** — contorno de cor do sistema, sem sombra.
- **Movimento reduzido** — o anel aparece sem transição.

## Viewports
- **Mobile 390px** — o anel existe no mobile (teclado externo, navegação assistiva e o próprio
  navegador). Interessa aqui o que ENCOSTA na borda: campo de largura total, cujo anel externo de 2–3px
  mais o afastamento não podem criar transbordo horizontal na página.
- **Desktop 1280px** — o corte do 018: barra de navegação lateral focável, lista à esquerda, ficha à
  direita. É o viewport onde a jornada por Tab é real.
- **Desktop 1920px** — a autoridade de layout do 018; mostrar o percurso completo de Tab numa tela
  (barra → cabeçalho → lista → ficha) para provar que o anel é achável em qualquer densidade.

## Regras que o desenho não pode quebrar
- Foco só em `:focus-visible`. **Nunca removido** — remover é defeito duro, não escolha estética.
- O anel precisa ser visível sobre o **fundo real** de cada peça, medido — e no escuro `--surface-card` e
  `--bg-muted` são o mesmo `#14151a`, então "escureceu um pouco" não é sinal.
- O foco jamais pode ser transmitido só por **cor de texto** (WCAG 1.4.1) nem ficar abaixo de 3:1 contra
  o vizinho (1.4.11).
- O anel não pode se confundir com **erro** (vermelho) nem com **selecionado** (fundo em relevo). Três
  significados, três leituras distinguíveis.
- Alvo de toque **≥44px** continua valendo com o anel desenhado; o anel não substitui área clicável.
- O anel segue o raio da peça — nada de retângulo duro sobre pílula.
- Regra de honestidade da casa: se o anel some em alguma situação, ela é justamente a que deve ser
  desenhada (item já ativo, fundo igual ao da peça, tema escuro, canto cortado).

## Armadilhas já pagas neste projeto
- **Duas bordas.** O halo de 2 camadas leu como borda dupla no campo; e no escuro a borda de destaque
  (`#7800ff`) diferia do anel (`#9a4bff`), o que também virou borda dupla. Por isso hoje a borda é
  repintada da cor do anel. Qualquer desenho novo tem de mostrar borda + anel JUNTOS, não o anel isolado.
- **A "caixa roxa" no menu.** Um anel externo no item de navegação foi reclamado pelo dono; a correção
  foi o anel interno. Não reintroduzir a caixa externa.
- **O selecionado invisível.** No escuro, a pílula selecionada era o mesmo `#14151a` da bandeja —
  contraste 1,00:1, pílula inexistente na tela. Um foco feito por troca de fundo teria o mesmo destino.
- **Transbordo horizontal medido.** A página não pode rolar na horizontal; um anel afastado num elemento
  colado na borda de um 390px é candidato a criar exatamente isso.
- **Estado ocluso passa em teste.** Asserção de presença aprova elemento coberto ou cortado — o anel se
  homologa por imagem e por geometria, nunca por "o elemento está lá".
- **Sombra some em alto contraste.** Anel feito de sombra desaparece em `forced-colors`; hoje há
  substituto só para parte das peças.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como igual** (cada prancheta nos dois):
1. **Catálogo de foco por peça** — repouso e foco lado a lado, com a medida do anel anotada: `tf-btn`
   (primário, secundário, fantasma, perigo), `tf-inputwrap` (normal, com prefixo `R$`, em erro),
   `tf-segmented` (item comum e item já selecionado), `tf-switch` (ligado e desligado),
   `tf-card--interactive`, item do menu (comum e já ativo), opção de lista do seletor de categoria, X de
   diálogo, X de toast, e o link/botão cru.
2. **A decisão da espessura** — 2px camada única × 3px sólido + halo 28%, na MESMA peça, nos dois temas,
   sobre `#14151a` e sobre branco, para o dono escolher olhando.
3. **Percurso de Tab em 1280px** — uma tela real do 018 com a ordem de foco numerada, provando que o
   anel é achável em cada parada.
4. **Casos adversos** — foco sobre item já ativo, foco sobre campo em erro, foco em peça encostada no
   canto (X do diálogo), foco em alto contraste forçado, foco em 390px colado na borda.

Reutilizar os primitivos `tf-*` existentes; nenhum primitivo novo. O anel é um ESTADO deles: `tf-btn`,
`tf-field`/`tf-inputwrap`, `tf-segmented`, `tf-switch`, `tf-card`, `tf-toast`, `tf-dialog` e o item de
navegação do app. Se o desenho concluir que alguma peça precisa de forma própria de foco, dizer POR QUÊ
na prancheta — a regra é uma linguagem só, com exceções justificadas e escritas.

## Perguntas em aberto para o dono
1. **2px ou 3px?** O token exportado diz 3px + halo; o app diz 2px sem halo, e o comentário defende a
   escolha. Uma das duas fontes precisa deixar de ser verdade.
2. **Uma linguagem só, ou três com regra?** Aceita-se "anel colado nas peças de superfície, contorno
   afastado nas pílulas, anel interno no menu" como REGRA desenhada — ou o desenho deve unificar tudo?
3. **O segmentado migra de `--accent` para `--focus-ring`?** Isso muda a cor do anel dele no tema escuro
   (de `#7800ff` para `#9a4bff`).
4. **O "abrir/fechar" da árvore de categorias ganha anel?** Hoje só muda a cor do texto.
5. **Existe um "pular para o conteúdo"?** Não há nenhum no app; sem ele, todo Tab de toda página começa
   percorrendo a navegação inteira. É decisão de produto, não de estilo.

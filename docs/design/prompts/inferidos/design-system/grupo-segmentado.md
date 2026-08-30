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

- **Onde vive:** `shared/ui/segmented.tsx` — bandeja com pílulas dentro, dois tamanhos (`sm`/`md`) com piso de 44px de altura mesmo no `sm`, rolagem horizontal escondida quando não cabe. Existe em **2 pontos**: (1) as **seções do Catálogo**, no topo de `/catalogo`, logo abaixo do título da aba e imediatamente acima da lista/mestre-detalhe (`catalogo-page.tsx:41`, semântica de `tablist`, `size="sm"`); (2) o **tema**, no cartão de aparência de `/conta` (`conta-page.tsx:228`, semântica de `radiogroup`, pílulas "Claro" e "Escuro" com ícones sol/lua de 16px) — e este **só monta acima de 1280px**: abaixo do corte, o mesmo cartão mostra um `Switch`.
- **Como o vendedor chega:** No Catálogo, é o primeiro controle que o vendedor toca ao entrar na aba: ele troca entre as seções (filamentos, impressoras, produtos). Na Conta, ele rola até a linha de aparência e escolhe o tema pelo NOME — porque um interruptor diz ligado/desligado, e ligado não é um tema.
- **Vizinhança imediata:** No Catálogo, entre o cabeçalho da aba e a barra de ferramentas do mestre-detalhe (busca + contagem + botão "Novo …"), com a lista logo abaixo. Na Conta, dentro de um `Card` de uma linha só: o rótulo "Tema" à esquerda e a bandeja encostada à direita, entre as outras linhas de conta (plano, privacidade, sair).
- **Dados que chegam (e o que ela devolve):** Uma lista de opções (id, rótulo, ícone opcional), o valor selecionado e um `onChange`. No Catálogo o valor está na URL/estado da página e comanda qual painel monta; na Conta o valor vem do `useThemeStore` (localStorage) — e o segmentado e o interruptor escrevem no MESMO store: dois controles, uma verdade.
- **O que acontece depois:** No Catálogo, trocar a pílula troca a lista inteira por baixo (e a ficha da direita, no desktop) sem mudar de rota. Na Conta, trocar a pílula repinta o app inteiro na hora. Cuidado histórico: o sinal de "qual está escolhido" já falhou uma vez no tema escuro, e por isso o foco aqui é um `outline` sólido e não o `--ring` que todos os outros primitivos usam — uma troca de fundo sumiria justamente no item já selecionado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Grupo segmentado — a bandeja com pílulas (`tf-segmented`)

## O que desenhar

Um controle de escolha única: uma bandeja arredondada com N pílulas lado a lado, uma delas em relevo
(a escolhida). Ele vive em dois lugares do produto, com significados diferentes: (1) no **Catálogo**,
trocando a seção visível — "Filamentos · Impressoras · Produtos · Kits" — e é a primeira coisa que o
vendedor toca ao abrir a aba, no mobile e no desktop; (2) na **Conta**, no desktop, escolhendo o
**tema** — "Claro · Escuro", cada pílula com um ícone (sol/lua) à esquerda do rótulo, dentro de uma
linha de um card de configuração. No mobile a Conta continua com o interruptor de hoje (decisão do
dono: "o mobile não se mexe"), então a peça só aparece lá no Catálogo. Desenhe o **componente**
(anatomia + estados) e as **duas aplicações reais**, não um controle genérico.

## Por que este prompt existe

A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`. O canvas do dono desenhou a bandeja
**parada**, a 1920, com estilos inline próprios, nos dois usos. Tudo o mais foi inferido no código:
os dois tamanhos (`sm`/`md`), o piso de 44px de altura mesmo no pequeno, o hover, o **foco**, a
rolagem horizontal escondida quando a bandeja não cabe, o teclado (Tab entra uma vez, setas
percorrem) e a segunda semântica (o Catálogo é `tablist`, a Conta é `radiogroup`).
E há uma divergência já paga em produção: **o canvas escolheu `--surface-card` para a pílula
selecionada, e o código teve de trocar por `--surface-raised` + sombra**, porque no tema escuro
`--surface-card` e o fundo da bandeja `--bg-muted` são o mesmo `#14151a` — contraste **1,00:1**, ou
seja, **não havia pílula na tela**. Na Conta era pior: card, bandeja e pílula, os três, o mesmo
`#14151a`. Este desenho existe para que a decisão de cor volte a ser tomada no desenho — desta vez
medida contra o fundo real dos dois temas.

## O que já existe hoje (não invente do zero — corrija)

| Onde | Papel | Opções (textos LITERAIS, não reescrever) | Tamanho |
| --- | --- | --- | --- |
| Catálogo, topo da aba | `tablist` (troca o painel abaixo) | "Filamentos" · "Impressoras" · "Produtos" · "Kits"; nome do grupo para leitor de tela: "Seções do catálogo" | `sm` |
| Conta, linha de um card | `radiogroup` (é um valor) | "Claro" (ícone sol) · "Escuro" (ícone lua); rótulo da linha à esquerda: "Tema" | `sm` |

Medidas reais de hoje: bandeja com `padding` de 4px, `gap` 4px, raio 999px, fundo `--bg-muted`;
pílula com altura mínima **44px**, `padding` 8px/12px no `sm`, texto **12px** no `sm` e **14px** no
`md`, peso 600 em *todos* os itens, sem borda, raio 999px; ícone 16×16 com 8px de respiro até o
rótulo; rótulos **não quebram linha**.

→ **Problema 1 — o foco foge do padrão do DS.** Aqui o foco é `outline: 2px sólido` na cor de
destaque, com 2px de afastamento; **todos** os outros primitivos (`Button`, `Card`, `Switch`,
`Field`, `Dialog`, `Toast`) usam o anel `--ring` (sombra de 2px em `--focus-ring`). O motivo dado no
código é legítimo (o foco precisa aparecer **por cima da pílula já selecionada**), mas a forma nunca
foi desenhada. Resolva no desenho: ou o anel padrão passa a funcionar sobre a pílula, ou o outline
vira a exceção declarada.
→ **Problema 2 — a rolagem é invisível.** Quando as 4 pílulas não cabem (mobile 390px), a bandeja
rola na horizontal com a barra de rolagem **escondida**. Não existe nenhuma pista visual de que há
mais conteúdo à direita.
→ **Problema 3 — não existe estado pressionado.** Não há nenhum tratamento de "estou clicando
agora"; a única transição é de cor, em 0,15s.
→ **Problema 4 — o hover só age nos não-selecionados** (o texto passa de apagado para corpo). Passar
o mouse sobre a pílula já escolhida não devolve nada.
→ **Problema 5 — `md` não tem nenhum uso real hoje.** Os dois lugares usam `sm`.

## Conteúdo e dados reais

Nada aqui é número de negócio: a peça não mostra dinheiro, quantidade nem data. O conteúdo é
exatamente o das duas listas acima — 4 rótulos curtos no Catálogo (o mais longo, "Impressoras", com
11 caracteres) e 2 rótulos com ícone na Conta. Não há contador ao lado do rótulo, não há badge, não
há "novo". A escolha do Catálogo é **derivada da URL** (`?tab=produtos` etc.), então ela sobrevive a
recarregar e a voltar — o desenho tem de assumir que qualquer uma das quatro pílulas pode ser a
selecionada no primeiro pintar, inclusive a última. O tema escolhido na Conta vale para o app
inteiro na hora, sem confirmação e sem salvar.

## Estados obrigatórios

- **Repouso, não selecionado** — texto em `--text-muted`, fundo transparente sobre a bandeja.
- **Selecionado** — pílula em relevo: fundo `--surface-raised`, texto em `--accent-text`, sombra
  `--shadow-xs`. **Nos dois temas o relevo tem de existir por forma (sombra/superfície), não só por
  matiz** — é a regra que a peça reprovou uma vez.
- **Hover (não selecionado)** — texto sobe para `--text-body`. Diga se o fundo também reage.
- **Hover sobre o selecionado** — hoje não existe; decida se deve existir.
- **Foco visível por teclado** — obrigatório e tem de aparecer **também sobre a pílula selecionada**.
- **Pressionado** — não existe hoje; desenhe.
- **Selecionado + em foco** — o caso que quebra: dois sinais empilhados no mesmo elemento.
- **Transbordo** — as 4 pílulas do Catálogo a 390px não cabem; a bandeja rola dentro de si mesma e
  **a página nunca rola na horizontal**. Desenhe a pista de "tem mais à direita".
- **Grupo inteiro ausente (sem permissão)** — no Catálogo, conta grátis ou deslogada **não vê a
  bandeja**: o teaser premium ocupa o lugar de tudo. Não desenhe uma bandeja desabilitada para esse
  caso; desenhe a ausência.
- **Premium pausado (`lapsed`)** — a bandeja aparece normal e os painéis abaixo ficam só-leitura.
  Hoje o controle **não diz nada** sobre isso (ver pergunta ao dono).
- **Desabilitado / carregando / erro / offline** — o componente **não tem** esses estados hoje: as
  pílulas nunca somem, nunca esperam rede e nunca falham. Só desenhe um deles se propuser
  conscientemente que exista, e diga por quê.

## Viewports

- **390px (mobile)** — obrigatório, e é o caso mais duro: só o Catálogo, 4 pílulas, transbordo real.
  Mostre a bandeja com a primeira pílula selecionada e com a última selecionada.
- **1280px (desktop)** — o corte do desktop do 018. Os dois usos: a bandeja do Catálogo com folga, e
  a da Conta dentro da linha do card, com o rótulo "Tema" à esquerda.
- **1920px** — só se acrescentar algo; foi a largura do canvas original e a bandeja não muda de
  tamanho com a tela.

## Regras que o desenho não pode quebrar

- **Contraste medido contra o fundo real, não contra o branco.** No escuro a Conta empilha três
  superfícies: card → bandeja → pílula. Se duas delas resolverem para o mesmo valor, a peça some.
- **Estado nunca sinalizado só por cor** (WCAG 1.4.1) e **indicador de estado com pelo menos 3:1**
  contra o vizinho (1.4.11). Como todos os itens já são peso 600 e sem borda, se você tirar o relevo
  o único sinal vira a cor do texto — foi exatamente o defeito corrigido.
- **Alvo de toque ≥ 44px de altura em todos os tamanhos**, inclusive no `sm`.
- **Zero transbordo horizontal da página.** O contêiner que se declara rolável pode rolar; a página
  não pode.
- **Ícone é decoração**: o rótulo escrito ("Claro"/"Escuro") é que informa — nunca uma bandeja só de
  ícones.
- **Nenhuma pílula pode ser desenhada como "trancada"/premium**: o freemium aqui é binário e resolve
  fora do controle (teaser no lugar da tela inteira).

## Armadilhas já pagas neste projeto

- **A pílula invisível no escuro** (acima): a cor foi escolhida no desenho e corrigida no código;
  contraste 1,00:1 passou por todos os testes automatizados porque nenhum teste enxerga cor.
- **Barra de rolagem que o headless não vê**: no 016 um transbordo real passou batido porque a
  verificação media só um eixo. Se a rolagem é a solução, ela precisa de **pista visual desenhada**,
  não de confiança na barra do sistema.
- **Texto ocluso passa em teste**: `está visível` e `contém o texto` continuam verdadeiros para uma
  pílula empurrada para fora da bandeja. Layout se decide por caixa, não por texto.
- **Divergência canvas × código sem dono**: quando o desenho usa estilos inline próprios em vez dos
  tokens do DS, a correção acontece no código e o desenho fica mentindo. Use os tokens.

## Entregável

Pranchetas, tema **escuro como padrão e claro como primeira classe** (as duas versões de cada uma):

1. **Anatomia** — a bandeja com 2 e com 4 pílulas, cotas de altura (44px), respiros, raio, e os dois
   tamanhos `sm`/`md` lado a lado (ou a recomendação de aposentar o `md`).
2. **Matriz de estados** — repouso, hover, pressionado, foco, selecionado, selecionado+foco, para
   uma mesma bandeja.
3. **Catálogo a 390px** — inclusive o quadro de transbordo com a pista de continuação, e o quadro em
   que a pílula selecionada é a última.
4. **Catálogo a 1280px** e **Conta a 1280px** — esta última dentro da linha do card, com "Tema" à
   esquerda, mostrando no escuro os três níveis de superfície distinguíveis.

Reaproveite os primitivos existentes em vez de criar novos: a bandeja e as pílulas são a família
`tf-segmented` (bandeja `--bg-muted` + raio pill; pílula selecionada `--surface-raised` +
`--accent-text` + `--shadow-xs`), o cartão da Conta é o `Card` do DS, os ícones são os do conjunto
`Icon` a 16px, e o foco deve usar o anel `--ring` do DS a menos que você justifique a exceção.

## Perguntas em aberto para o dono

1. **Foco**: o grupo segmentado mantém o outline próprio (destaque, 2px, afastado) ou volta ao anel
   `--ring` que todo o resto do DS usa? É a única exceção do sistema hoje, e ninguém decidiu.
2. **Pista de rolagem no mobile**: desvanecimento na borda direita, setas, ou nada (aceitar que o
   usuário descubra arrastando)?
3. **Premium pausado**: quando a assinatura está pausada e os painéis do Catálogo ficam só-leitura,
   a bandeja deve dizer alguma coisa, ou o aviso continua sendo só do painel de baixo?
4. **Tamanho `md`**: ninguém usa. Fica no sistema como opção desenhada, ou é aposentado?

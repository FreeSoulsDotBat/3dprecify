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

- **Onde vive:** `shared/ui/spinner.tsx` — anel de três tamanhos (0,94rem / 1,25rem / 1,75rem), cor `--accent`, rótulo "Carregando…" apenas para leitor de tela. Aparece **solto, no lugar do conteúdo, em 9 pontos**: retorno do checkout (`checkout-return.tsx:98`), lista do Catálogo (`catalog-panel.tsx:225`), lista de simulações (`scenarios-list-sheet.tsx:276`), compositor de kits (`bom-page.tsx:159`), produto (`produto-page.tsx:249`), Conta (`conta-page.tsx:54`), lista de Orçamentos (`historico-page.tsx:151` e `:324`) e detalhe do orçamento (`snapshot-detail-page.tsx:84`). Não existe `Skeleton` nem `ProgressBar` em lugar nenhum do app.
- **Como o vendedor chega:** Toda vez que o vendedor Premium entra numa aba que precisa do servidor: toca em Catálogo, Kits, Orçamentos ou Conta e a página abre VAZIA com um ponto girando no meio. Também aparece dentro do botão que ele acabou de apertar (`Button loading`).
- **Vizinhança imediata:** Sozinho, entre o cabeçalho da aba (que já renderizou) e o rodapé — sem rótulo visível, sem posição definida, sem esqueleto da lista que virá. No mestre-detalhe do Catálogo ele ocupa o lugar das DUAS colunas ao mesmo tempo; a página inteira encolhe para a altura de um ponto e volta a crescer quando os dados chegam.
- **Dados que chegam (e o que ela devolve):** Um booleano `isPending`/`isLoading` do TanStack Query. O spinner não sabe o que está carregando, quanto falta, nem se a fonte é o servidor, o cache uid-keyed ou a fila offline — e não distingue "carregando" de "sem rede".
- **O que acontece depois:** Quando os dados chegam, o ponto desmonta e a lista cheia toma seu lugar de uma vez — o salto de altura é justamente o que o esqueleto desenhado (e nunca construído) existia para evitar. Se o servidor recusar, o spinner dá lugar a um `Alert tone="danger"`; se o entitlement tiver expirado, ao teaser Premium.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Carregando — o anel que substituiu o esqueleto

## O que desenhar
O estado de espera do Precifica3D: o que o vendedor vê entre pedir uma tela e ela existir. Hoje isso é
sempre a mesma coisa — um anel girando, sozinho, centralizado, no lugar de todo o conteúdo — e aparece em
nove pontos da jornada: ao abrir o Catálogo, ao abrir Kits, ao abrir Orçamentos (duas vezes: o gate do
plano e a lista sob os filtros), ao abrir um orçamento salvo, ao editar um produto, ao abrir a Conta, ao
abrir a gaveta de Simulações e ao voltar do Mercado Pago depois de pagar. Quem usa é o vendedor de peças
3D, quase sempre nos primeiros 1–3 segundos de cada tela premium, muitas vezes com internet ruim. Desenhe
o sistema de espera inteiro: o esqueleto de lista e de detalhe, a espera com rótulo, o anel como peça
residual e a transição para conteúdo / vazio / erro.

## Por que este prompt existe
O protótipo desenhou o esqueleto e o app construiu outra coisa. `CatalogScreen.jsx:42-49` monta três linhas
de esqueleto no formato exato da lista real (círculo 36×36 + duas linhas de texto, 55% e 35%, com
divisórias); a §D.2 pede "Skeleton — placeholders de loading (linhas/cards) com shimmer discreto
respeitando reduced-motion"; a rodada V3 registra "#14 Demo: carregando — skeleton visível no escuro
(1,79:1), reduced-motion honrado" como CORRIGIDO E MEDIDO. Nada disso foi construído: `Skeleton` e
`ProgressBar` têm ZERO ocorrências no app, inclusive em CSS. **Para Catálogo e Orçamentos o desenho existe
e foi ignorado — isto aqui é uma correção, não uma criação.** Para Conta, Kits, Produto, Simulações e
retorno de checkout não há desenho de carregamento em autoridade nenhuma: essas cinco esperas nunca foram
desenhadas por ninguém.

## O que já existe hoje (não invente do zero — corrija)

O único componente de espera do app é o anel (`shared/ui/spinner.tsx` + `spinner.css`):

| Propriedade | Valor real hoje |
| --- | --- |
| Tamanhos | `sm` 15px · `md` 20px (padrão) · `lg` 28px |
| Espessura do anel | 2px (`sm`/`md`), 3px (`lg`) |
| Cor | `--accent`; trilha = a mesma cor a 28% de opacidade, só o topo do anel é sólido |
| Giro | 0,7s, linear, infinito; `prefers-reduced-motion` global neutraliza |
| Rótulo | `"Carregando…"` — **visualmente oculto**, só o leitor de tela ouve |
| Papel | `role="status"` |

Os nove pontos, com o que cada um mostra hoje:

| Onde | O que aparece | → Problema |
| --- | --- | --- |
| Catálogo (lista de filamentos/impressoras/produtos) | anel centralizado, `py-8` | → mudo; e a ≥1280px **colapsa o mestre-detalhe inteiro** (lista + ficha) num ponto |
| Kits — gate do plano | anel + `"Verificando seu plano…"` | ok: é o único com frase e cabeçalho preservados |
| Orçamentos — gate do plano | anel centralizado | → mesmo gate do Kits, mas **sem** a frase |
| Orçamentos — lista, sob a barra de filtros | anel centralizado | → a lista some, a página encolhe e volta a crescer |
| Orçamento salvo (detalhe) | anel centralizado | → a página inteira vira um ponto |
| Produto (edição) | anel centralizado | → depois vira "não encontrado" ou o formulário: dois saltos |
| Conta — cartão de identidade | anel dentro de um `Card` | ok-ish: é o único que preserva forma |
| Simulações (gaveta lateral) | anel centralizado | → mudo |
| Retorno do checkout | `Card` com anel + `"Confirmando seu pagamento…"` + corpo + 2 botões | ok: espera com forma e saída |

→ Sete das nove esperas são **um ponto girando mudo**. → Nenhuma preserva a altura do conteúdo que vem:
a página encolhe para ~64px e salta para a lista cheia. → O botão em carregamento (`tf-btn` com `loading`)
já faz certo: anel `sm` inline, rótulo mantido, `aria-busy`, interação bloqueada — é o padrão a estender.

## Conteúdo e dados reais
Frases pt-BR que **já existem e são homologadas** (use estas, não invente sinônimos):

- `"Verificando seu plano…"` — gate premium (Kits e Orçamentos).
- `"Verificando sessão…"` — arranque do app, antes de saber quem está logado.
- `"Confirmando seu pagamento…"` + `"Estamos verificando com o Mercado Pago. Assim que confirmar, o Premium liga sozinho — você não precisa fazer mais nada."` + botões `"Atualizar"` e `"Voltar para a Conta"`.
- `"Carregando…"` — hoje só para leitor de tela.
- Erro frio, por superfície: `"Não foi possível carregar seu catálogo."` · `"Não foi possível carregar seus orçamentos."` · `"Não foi possível carregar suas simulações."` · `"Não foi possível carregar seus itens salvos agora."` · `"Não foi possível carregar sua conta"` — todas com o botão `"Tentar novamente"`.

Formas reais que o esqueleto precisa imitar: linha de catálogo = avatar/ícone redondo 36px + nome (ex.:
"PLA Preto 1kg") + resumo em texto menor (ex.: "R$ 89,90 · 1000 g"); linha de orçamento = nome do produto
+ data + preço `R$ 24,24`; detalhe de orçamento = cabeçalho, selo de procedência, bloco de preço grande e
uma pilha de linhas de composição de custo. Use "…" (reticência única), como o app já usa.

## Estados obrigatórios
1. **Carregando — lista** (o principal): três linhas de esqueleto no formato real, dentro do cartão, com as
   divisórias da lista verdadeira. Altura igual à da lista que vai chegar.
2. **Carregando — detalhe**: blocos de esqueleto no formato da ficha (cabeçalho, bloco de preço, 4 linhas).
3. **Carregando com rótulo** (gate/sessão/pagamento): frase visível, nunca só o anel. `"Verificando seu plano…"`.
4. **Carregando dentro do botão**: anel `sm` + rótulo original, botão desabilitado.
5. **Anel** nos três tamanhos, com trilha e ponta visíveis nos dois temas.
6. **Movimento reduzido**: shimmer e giro parados — desenhe o equivalente estático (o esqueleto continua
   legível, o anel vira arco fixo ou ponto pulsante desligado). Não pode virar um retângulo invisível.
7. **Erro frio** (o que vem depois quando falha): `Alert` de perigo com a frase da superfície + `"Tentar novamente"`.
8. **Vazio** (o que vem depois quando não há nada): `EmptyState` com ícone, título e ação.
9. **Offline com dados em cache**: NÃO é carregando — a lista aparece com a legenda de procedência. Mostre
   que o esqueleto não pode aparecer por cima de dados que o vendedor já tem.
10. **Premium pausado**: o gate resolveu e é `lapsed` — o esqueleto sai e entra o teaser/aviso. O que não
    pode existir é o caminho "não respondeu → mostro teaser".

## Viewports
- **Mobile 390px** — obrigatório: todas as nove esperas existem no mobile, e é onde a internet é pior.
  Verifique também 360px na prancheta do cartão de erro da Conta (ver armadilhas).
- **Desktop 1280px** — obrigatório: é o corte do mestre-detalhe (018). Precisa mostrar como a espera se
  comporta com dois painéis: hoje ela apaga os dois. Desenhe o esqueleto de lista à esquerda e o que o
  painel da ficha mostra à direita.
- 1920px opcional, só se o esqueleto de lista mudar de contagem de linhas em tela alta.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como "não premium".** Enquanto o plano não respondeu, a tela diz que está
  verificando — nunca oferece assinatura, nunca sugere que o acesso acabou.
- **Nada promete sucesso.** No retorno do checkout a espera é "confirmando", nunca "processado"/"ativado".
- **Frase honesta nunca em placeholder** nem cortada: as frases de espera vivem em elemento de largura
  cheia, fora de campo de formulário.
- **Procedência sobrevive à espera**: quando os dados chegam de cache offline, a legenda de origem aparece
  junto com o conteúdo — o esqueleto não pode "limpar" essa marca.
- **Alvo ≥44px** em `"Tentar novamente"`, `"Atualizar"` e `"Voltar para a Conta"`.
- **Contraste medido contra o fundo real**, nos dois temas: o esqueleto no escuro foi medido em 1,79:1 no
  protótipo — mantenha-o visível sem virar um bloco chapado que parece conteúdo pronto.
- **O esqueleto não pode ser confundível com dado**: nada de números ou textos falsos dentro dele.

## Armadilhas já pagas neste projeto
- **O colapso e o salto**: a página encolhe para um ponto e cresce de volta. O esqueleto tem de ocupar a
  altura da lista real — desenhe a altura, não só a forma.
- **`toBeVisible` passa em qualquer coisa**: um anel sozinho satisfaz todo teste automatizado; foi
  exatamente assim que este estado atravessou nove telas sem ninguém notar. O desenho precisa ser
  verificável por imagem, com medidas.
- **Overflow a 360px**: o cartão de identidade da Conta já pariu o botão "Tentar novamente" fora do cartão
  E da viewport (right 378,5 > 360) porque o erro herdou uma linha flex feita para avatar+texto. O estado de
  erro que sucede a espera precisa de pilha própria.
- **Placeholder que corta a frase** (016): frase de espera nunca dentro de um campo.
- **Reduced-motion honrado no protótipo e nunca reconstruído**: se o desenho não entregar a variante
  parada, ela some de novo na implementação.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como par de primeira classe para cada uma:

1. **Anatomia do anel** — `sm`/`md`/`lg`, trilha + ponta, nos dois temas, com a variante de movimento reduzido.
2. **Skeleton de lista — Catálogo**, 390px e 1280px (mestre-detalhe: esqueleto à esquerda + painel da ficha à direita).
3. **Skeleton de detalhe — orçamento salvo**, 390px e 1280px.
4. **Espera com rótulo — gate premium**, com o cabeçalho da página preservado e `"Verificando seu plano…"`.
5. **Cartão de retorno do checkout**, com as frases literais e os dois botões.
6. **Cartão de identidade da Conta**: carregando → carregado → erro (o trio, a 360px).
7. **Sequência de transição**: carregando → conteúdo · carregando → vazio · carregando → erro, na mesma
   caixa, mostrando que a altura não pula.

Reutilize os primitivos existentes e nomeie-os: `tf-card` (o contêiner de toda espera com forma),
`tf-btn` com estado `loading` (anel `sm` + rótulo), `tf-alert` tom perigo (erro frio), `tf-empty-state`
(vazio), `tf-page-header` (o cabeçalho que a espera não pode apagar), `tf-spinner` (só onde não há forma
conhecida). **Um único primitivo novo é esperado: `tf-skeleton`**, com variantes `text` (largura em %),
`circle` (36px) e `rect` (blocos de detalhe) — especifique cor de repouso, shimmer e a variante parada.
Nenhum outro componente novo.

## Perguntas em aberto para o dono
1. O esqueleto substitui o anel em **todas** as listas, ou o anel fica como padrão para esperas sem forma
   conhecida (gate de plano, verificação de sessão, retorno do checkout)?
2. As sete esperas mudas ganham **rótulo visível**? Se sim, qual frase para Catálogo, Orçamentos e
   Simulações — hoje só o leitor de tela ouve "Carregando…".
3. Existe **limiar de tempo**? Depois de N segundos a espera muda de aparência ou ganha uma frase do tipo
   "está demorando mais que o normal"? Nenhuma regra desse tipo está escrita em lugar nenhum.
4. No mestre-detalhe (≥1280px), durante a carga o painel da ficha mostra esqueleto também ou fica vazio
   com uma frase de instrução?
5. **Recarregamento** de dados já em tela (o vendedor puxa para atualizar, ou o app revalida): sinal
   discreto no topo, ou nada? Hoje o estado de carregando cobre só a primeira carga, e o silêncio na
   revalidação nunca foi decidido.

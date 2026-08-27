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

- **Onde vive:** `shared/ui/card.tsx` — seis variantes (`default`/`flat`/`outline`/`ghost`/`inverse`/`accent`) e quatro paddings, mais o `interactive` (hover levanta 2px com `--shadow-md` e reforça a borda; foco pelo anel; `role="button"` + `tabIndex` injetados quando a tag não é botão). É o contêiner mais comum do app: 7 cartões na Conta (plano, aparência, privacidade, sair…), 3 no editor de linha do kit, 3 em `/calcular`, 3 no retorno do checkout, 2 no detalhe do orçamento, 2 na página de produto, 2 no resumo do kit, além de Orçamentos, comparação e privacidade. O caso CLICÁVEL de verdade está no **mestre-detalhe do Catálogo ≥1280px**: cada item da lista é um `<button class="tf-card tf-card--interactive tf-catalog-md__card">` (`catalog-panel.tsx:305`).
- **Como o vendedor chega:** No desktop, o vendedor entra em `/catalogo` e a lista mestre inteira é feita desses cartões: passa o mouse, um levanta; clica, ele pinta; navega por Tab, um anel o contorna. No celular esse cartão não existe — a lista é outra e a ficha vem numa folha lateral.
- **Vizinhança imediata:** Na coluna ESQUERDA do mestre-detalhe (uma coluna, ou duas acima de 1600px), abaixo da barra de ferramentas (busca + contagem + "Novo …") e à esquerda da ficha fixa de 560px, que é `sticky` no topo e rola por dentro. Dentro de cada cartão: nome do item na primeira linha, resumo na segunda, e linhas extras condicionais — a nota do item, "dados de uma sincronização anterior" quando o cache está velho, e "somente leitura" quando o Premium lapsou.
- **Dados que chegam (e o que ela devolve):** O item do cache uid-keyed do catálogo (nome, resumo, nota, id), mais dois sinais de estado da feature: `list.stale` e `lapsed`. O estado **selecionado não é variante do primitivo**: é uma classe de feature (`tf-catalog-md__card--selected` — borda `--accent` e fundo `--accent-soft`), concatenada à mão; o `card.tsx` não sabe o que é "selecionado". A seleção é derivada contra a lista ATUAL a cada render, então item excluído ou filtrado cai para um válido, nunca para uma ficha órfã.
- **O que acontece depois:** Clicar troca a ficha da coluna direita na hora, sem mudar de rota e sem abrir folha nenhuma — filamento e impressora ficam EDITÁVEIS ali; produto e kit apenas resumidos, com o editor de página inteira ainda sendo o dono da edição. Três sinais — hover que levanta, selecionado que pinta, foco que anela — nunca foram vistos juntos num desenho.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Cartão — clicável, selecionado, e as três variantes que nunca foram vistas

## O que desenhar
O cartão (`tf-card`) é a superfície em que este produto inteiro se apoia: 36 lugares do app o usam. O que
nunca foi desenhado é o cartão que **reage** — o `tf-card--interactive`, que levanta no hover, afunda no
clique e ganha anel no teclado — e o cartão **selecionado**, que no desktop (≥1280px) marca qual item da
lista mestre está aberto na ficha à direita. Isso vive nas duas listas mestre-detalhe do desktop: Catálogo
(Filamentos · Impressoras · Produtos · Kits) e Orçamentos. O vendedor passa o mouse por uma coluna de 4 a 40
cartões, clica em um, e precisa enxergar sem pensar qual está aberto. Desenhe a FAMÍLIA do cartão: os
estados de interação, o selecionado como membro da família, e as variantes `inverse` / `accent` / `ghost`
que existem no código e nunca apareceram em contexto nenhum.

## Por que este prompt existe
O par PARADO já é seu: o desenho de 2026-07-02 (`Abas-Desktop.dc.html`) tem os cartões da lista do Catálogo
(l.105) e os registros de Orçamentos (l.280), e §D.1 lista as variantes em prosa — mas prosa documenta o
código, não o desenha. Ficaram sem desenho: o **hover** (`translateY(-2px)` + sombra maior + borda mais
forte), o **foco**, o **selecionado como parte da família** (hoje ele é classe de feature, o `card.tsx` não
sabe o que é "selecionado") e as variantes `inverse`/`accent`/`ghost`. E o código **contraria o seu desenho
em dois pontos**, marcados abaixo com →.

## O que já existe hoje (não invente do zero — corrija)

| Peça | Como está no código | Situação |
| --- | --- | --- |
| Repouso | fundo `--surface-card`, borda 1px `--border-subtle`, raio `--radius-card`, sombra `--shadow-card` (= `--shadow-sm`), padding `--space-5` | desenhado |
| Hover (clicável) | sobe 2px, sombra `--shadow-md`, borda vira `--border-default`; transição 190ms `--ease-out` | **nunca desenhado** |
| Pressionado | volta a `translateY(0)` — nenhuma outra mudança | **nunca desenhado** |
| Foco (teclado) | `outline: none` + anel sólido 2px roxo (`--ring`) colado na borda; **a sombra do cartão some** enquanto focado | **nunca desenhado** |
| Selecionado (Catálogo) | `border-color: var(--accent)` **+ `background: var(--accent-soft)`** | → o seu desenho (l.601) pinta **só a borda** accent; o código pinta o fundo também |
| Selecionado (Orçamentos) | `border-color: var(--accent)` + `background: var(--accent-soft)` | bate com o desenho (l.625) |
| Cartão de Orçamentos | é um `<Card>` comum dentro de um link — **não tem `tf-card--interactive`** | → o seu desenho l.280 usa `tf-card--interactive tf-card--pad-sm`: hoje a lista do Catálogo levanta no hover e a de Orçamentos não |
| Paddings | `none` (0) · `sm` (`--space-4`) · `md` (`--space-5`, padrão) · `lg` (`--space-7`) | só `sm`/`md`/`lg` aparecem em contexto |
| `flat` / `outline` | sem sombra; `outline` ainda troca a borda para `--border-default` | usadas de fato |
| `ghost` / `inverse` / `accent` | existem no CSS e **não são usadas em lugar nenhum do app** (0 ocorrências em 36 usos) | **nunca desenhadas, nunca usadas** |
| Conteúdo do cartão do Catálogo | nome (semibold, `--text-strong`) + resumo em caption `--text-muted`; **sem selo e sem linha de dinheiro própria** | → o seu desenho tem selo no canto superior direito e o dinheiro em linha separada `tf-tnum` |
| Avisos dentro do cartão | "pode estar desatualizada" e "somente leitura" entram como mais uma caption cinza no rodapé de **cada** cartão | → repetido 20 vezes numa lista de 20; precisa de hierarquia |

## Conteúdo e dados reais
Textos literais, exatos como estão hoje:
- Cartão de filamento: nome `"PLA Azul"`, resumo `"PLA · R$ 120,00 / 1 kg"` (material · custo do rolo / peso).
- Cartão de impressora: nome `"Ender 3 V3"`, resumo `"R$ 1.899,00 · 4.000 h · 0,12 kW"` (valor da máquina ·
  vida útil em horas · potência média).
- Contadores acima da lista: `"{n} filamento(s)"`, `"{n} impressora(s)"`, `"{n} produto(s)"`, `"{n} kit(s)"`.
- Legendas de estado dentro do cartão: `"pode estar desatualizada"` (leitura offline) e `"somente leitura"`
  (Premium pausado).
- Cartão de Orçamentos (a ordem é obrigatória — a data vem ANTES do dinheiro): rótulo do registro
  (`"Cliente Ana · pedido 412"`), selo de sincronização quando o estado não é "sincronizado", meta
  `"Cotado em 12/08/2026 · Kit · 3 peças"` ou `"… · Peça única"`, depois `"Valor cotado"` + **R$ 148,90** em
  negrito, e a legenda da base do preço.
- Busca acima da lista: placeholder `"Buscar no catálogo…"`, rótulo `"Buscar no catálogo"`.
- Vazio da busca (não é o vazio do catálogo): `"Nada encontrado para essa busca"` /
  `"Tente outro termo, ou limpe a busca para ver tudo de novo."` / botão `"Limpar busca"`.
- O nome é campo livre do vendedor: pode vir com 500 caracteres sem espaço nenhum (aconteceu na homologação).

## Estados obrigatórios
Desenhe cada um destes, no cartão da lista do Catálogo e no de Orçamentos:
1. **Repouso** — a base matte.
2. **Hover** — o cartão sobe 2px, sombra `--shadow-md`, borda `--border-default`. Mostre o cursor.
3. **Pressionado** — volta ao chão (`translateY(0)`), sem piscar de cor.
4. **Foco por teclado** — anel roxo sólido 2px. Resolva: hoje o anel **substitui** a sombra do cartão, então
   um cartão focado fica mais chapado que os vizinhos.
5. **Selecionado (repouso)** — o item aberto na ficha à direita.
6. **Selecionado + hover** e **selecionado + foco** — os três sinais juntos, que é exatamente o que nunca foi
   visto num desenho. O selecionado precisa continuar legível com o anel por cima.
7. **Offline / desatualizado** — o cartão continua clicável e diz `"pode estar desatualizada"`.
8. **Premium pausado (somente leitura)** — o cartão continua clicável (a ficha abre em leitura) e diz
   `"somente leitura"`. Não é desabilitado, e não pode parecer erro.
9. **Cartão não clicável** — o mesmo cartão sem `interactive` (Conta, resultado do Calcular, privacidade):
   precisa ser distinguível à distância de um clicável parado.
10. **As três variantes órfãs em contexto** — `accent` (fundo `--accent-soft`, sem borda, sem sombra),
    `inverse` (plano preto da marca, texto claro) e `ghost` (transparente, sem borda, padding 0): mostre um
    uso plausível de cada uma **ou** diga no desenho que devem ser aposentadas.
- Não existe estado desabilitado no cartão. Se você achar que precisa de um, é decisão do dono.

## Viewports
- **Desktop 1280px** — o corte do mestre-detalhe. Lista em **uma** coluna ao lado da ficha; é aqui que o
  clicável+selecionado nasce.
- **Desktop 1920px** — a lista do Catálogo vira **duas colunas** (a partir de 1600px). O hover e o
  selecionado precisam ler bem em cartões lado a lado, não só empilhados.
- **Mobile 390px** — só como prancheta de referência: no mobile o cartão **não** é clicável (a linha tem um
  botão interno) e nada aqui deve mudá-lo. O mobile não se mexe; desenhe-o para mostrar que a família fecha.

## Regras que o desenho não pode quebrar
- **Alvo de toque e clique ≥44px** de altura no cartão clicável, inclusive no padding `sm`.
- **Contraste medido contra o fundo real**, não contra branco: a borda `--accent` e o fundo `--accent-soft`
  precisam separar o selecionado do vizinho **nos dois temas** — no escuro `--accent-soft` é roxo a 18% de
  opacidade sobre um cinza quase preto, uma diferença fina.
- **Foco e seleção não podem colidir**: o anel de foco é roxo e a borda do selecionado é roxa. Um cartão
  selecionado E focado tem que dizer as duas coisas — resolva por espessura, afastamento ou brilho, não por cor.
- **Seleção nunca é só cor**: o item aberto também é anunciado para leitores de tela, mas visualmente hoje só
  existe cor. Considere um segundo sinal (barra lateral, marca) para daltonismo.
- **Degradação dita, não escondida**: `"pode estar desatualizada"` e `"somente leitura"` ficam VISÍVEIS, em
  elemento de largura cheia — nunca truncadas, nunca dentro de placeholder.
- **Falha de rede nunca vira "não é premium"**: o cartão offline continua sendo o item salvo do vendedor.
- **Movimento**: o levantar de 2px roda em 190ms e precisa sumir sob `prefers-reduced-motion` — nenhuma
  legibilidade pode depender da animação.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido**: um filamento com 500 caracteres sem espaço gerou **4.948px** de rolagem
  a 1440px, porque o cartão da lista não quebrava o nome (a ficha da direita já quebrava). O desenho precisa
  mostrar o nome comprido quebrando dentro do cartão, e a coluna sem crescer.
- **Valor grande que estoura a linha**: mostre um cartão de Orçamentos com **R$ 12.480,55** ao lado de um
  selo — o trio rótulo + dinheiro + selo é onde a linha estoura.
- **Texto ocluso passa em teste**: asserção de texto não vê colisão. Desenhe as caixas, com folga real entre
  o nome e o selo do canto.
- **Anel de foco com raio errado**: no cartão de Orçamentos o clicável é o link em volta, e o contorno de
  foco herda um raio pequeno — desenha um quase-retângulo em volta de um cartão arredondado. Diga qual é o
  raio do foco do cartão.
- **Se parece clicável, tem que ser botão**: um cartão clicável que não é botão de verdade recebe o papel de
  botão mas **não responde ao Enter**. Todo cartão que você desenhar como clicável é um botão.

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (first-class, não um remendo)**:
1. **Matriz de estados** do cartão clicável do Catálogo: repouso · hover · pressionado · foco · selecionado ·
   selecionado+hover · selecionado+foco (7 quadros, lado a lado, mesmo conteúdo).
2. **Lista mestre a 1280px** com 5 cartões, um selecionado e outro sob o mouse — para ver os três sinais
   convivendo.
3. **Lista a 1920px em duas colunas**, um selecionado.
4. **Lista de Orçamentos a 1280px**, com selo de sincronização, valor alto e um cartão aberto.
5. **Casos-limite**: nome de 500 caracteres · cartão offline (`"pode estar desatualizada"`) · cartão em
   Premium pausado (`"somente leitura"`).
6. **Variantes**: `default` · `flat` · `outline` · `accent` · `inverse` · `ghost`, cada uma com um uso
   plausível ou marcada como "aposentar".
7. **Mobile 390px** de referência, cartão não clicável.
Reutilize os primitivos existentes: `tf-card` (+ `tf-card--interactive`, `tf-card--pad-sm`) para a
superfície, `tf-badge` para o selo do canto, `tf-tnum` para todo número de dinheiro, `tf-input` +
`tf-inputwrap` na busca acima da lista e `tf-btn--ghost tf-btn--sm` no "Carregar mais". Nenhum primitivo
novo — o que falta aqui é estado, não componente.

## Perguntas em aberto para o dono
1. **O selecionado do Catálogo pinta o fundo?** Seu desenho marca só a borda `--accent`; o código também
   pinta `--accent-soft`, igual ao de Orçamentos. As duas telas devem dizer "escolhido" da mesma forma, ou o
   Catálogo é mais discreto de propósito?
2. **O cartão de Orçamentos levanta no hover?** Seu desenho diz que sim (`tf-card--interactive`); o código
   diz que não. Hoje as duas listas clicáveis do desktop se comportam diferente.
3. **`inverse`, `accent` e `ghost` ficam ou saem?** Não são usadas em nenhum dos 36 cartões do app. Se ficam,
   qual é o uso que justifica cada uma?
4. **O selo do canto superior direito do cartão do Catálogo** existe no seu desenho e não no código. Que
   informação ele carrega — o aviso de "desatualizada" / "somente leitura", ou outra coisa?

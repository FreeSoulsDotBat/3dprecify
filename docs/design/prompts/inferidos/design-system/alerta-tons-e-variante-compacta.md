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

- **Onde vive:** `shared/ui/alert.tsx` — bloco tingido com ícone de 20px à esquerda, título opcional e corpo, fundo `*-soft` e cor de status; `danger` é assertivo (`role="alert"`), os demais são `status` educados. É a peça de feedback mais usada do produto: **30+ pontos**, com concentração em `/catalogo/produtos/$id` (7), `/kits` (7), o painel do Catálogo (7), `/historico` (6), a lista de simulações (5), o detalhe do orçamento (4), `/calcular` (4+3), a tela de entrada (3). Fora do DS existe uma variante local, `.tf-alert--compact` (`features/calculator/shopee-warnings.css`), criada porque a seção de avisos da Shopee media 1248px de altura a 360px.
- **Como o vendedor chega:** Sem gesto: é a notícia que o produto dá quando algo é parcial, arriscado ou quebrado — "seu Premium expirou e esta lista está em leitura", "o item de catálogo que este kit usa foi excluído", "não foi possível salvar", "este orçamento usa tarifas de uma data antiga", "o frete da Shopee é subsidiado pelo marketplace".
- **Vizinhança imediata:** Quase sempre no TOPO do bloco a que se refere e antes da ação: acima da lista quando o plano lapsou, dentro do diálogo central acima da fileira de botões quando o servidor recusa, dentro da folha lateral acima do rodapé de ações, e — no caso da Shopee — logo abaixo do cartão de preço daquele canal, na densidade mais apertada do app, empilhado com outros avisos do mesmo canal. Em `/calcular` há também o alerta `info` de plausibilidade do RESULTADO, imediatamente abaixo do par de `PriceHero`.
- **Dados que chegam (e o que ela devolve):** Um `tone`, um título opcional e o corpo, já em pt-BR. Quem escolhe o tom é a feature, a partir do entitlement resolvido pelo servidor, do estado da fila offline, do `ErrorCode` traduzido ou da idade da tarifa no catálogo. O mapa tom→ícone (`info`/`circle-check`/`circle-alert`) foi decidido no código.
- **O que acontece depois:** Alerta não fecha nem tem ação própria — ele PERMANECE enquanto a condição durar e some quando ela deixa de valer (o plano volta, a rede volta, o item é religado). É por isso que sua densidade importa: num aparelho de 360px, uma pilha de avisos honestos pode empurrar o preço para fora da primeira dobra.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Alerta em bloco (`tf-alert`) — os quatro tons, o alerta sem título e a variante compacta

## O que desenhar
O bloco de mensagem inline do Precifica3D: uma faixa com fundo tingido, um ícone à esquerda e um corpo
de texto que explica algo que o vendedor precisa saber sem sair da tela. É a peça de feedback mais usada
do produto — mais de 30 pontos: a calculadora, a ficha do Catálogo ("vincule um filamento e uma impressora
salvos"), a linha de peça dos Kits, os Orçamentos ("modo leitura offline"), a Conta ("não foi possível
verificar seu plano"). Quem a lê é o vendedor no meio de uma tarefa: ela nunca é o assunto da tela, é
sempre a nota que muda o significado do número logo acima ou logo abaixo dela. Desenhe o componente
inteiro — os quatro tons, as três composições (título+corpo, só corpo, só título), a variante compacta com
ação, e a densidade em tela estreita.

## Por que este prompt existe
O protótipo de 2026-07-02 cobriu o alerta, mas parcialmente. O canvas 018 do dono desenhou três casos a
1920px — `info` na ficha do Catálogo, `danger` na peça inválida do Kit e, o mais importante, `info` +
`compact` nos Orçamentos com o botão "Sincronizar agora" à direita — o que **derruba** a acusação de que
a variante compacta seria uma gambiarra: ela foi desenhada pelo dono, com ação. O que continua sem
desenho, e foi decidido dentro do código, é: (1) os tons **`success`** e **`neutral`**, que existem no CSS
e que **nenhum ponto do app inteiro invoca** — são tons órfãos; (2) o alerta **sem título**, que é
justamente a forma mais comum (mais da metade dos usos passa só o corpo) e cujo resultado é um bloco
tingido com texto cinza e nenhuma hierarquia; (3) a **densidade a 360px**, que é o que forçou a
`.tf-alert--compact` a nascer fora do design system, dentro de `features/calculator/shopee-warnings.css`,
datada "016/PR-F homologação (A5)", porque a seção da Shopee media **1248px de altura a 360px** e 48%
disso eram dois avisos.

## O que já existe hoje (não invente do zero — corrija)
Anatomia atual: `[ícone 20px] [corpo: título opcional em semibold + texto opcional]`, em flex com gap
`--space-3`, padding `--space-4`, raio `--radius-md` e **uma borda de 1px sempre transparente** (está no
CSS e nenhum tom a pinta). → A borda transparente é um espaço reservado que ninguém usa: decida se o tom
ganha borda ou se ela sai.

| Tom | Fundo | Ícone + título | Ícone | Anúncio ao leitor de tela | Usado hoje? |
|---|---|---|---|---|---|
| `info` (padrão) | `--tf-info-soft` (ciano) | `--info-text` | círculo com "i" | educado (`status`) | sim — é a esmagadora maioria |
| `danger` | `--tf-danger-soft` (rosa/vermelho) | `--danger-text` | círculo com "!" | assertivo (`alert`) | sim |
| `success` | `--tf-success-soft` (verde) | `--success-text` | círculo com "✓" | educado | **nunca** |
| `neutral` | `--bg-muted` (cinza) | `--text-strong` | o MESMO ícone do `info` | educado | **nunca** |

→ `neutral` reaproveita o ícone de informação: dois tons distintos com o mesmo símbolo. → `success` e
`neutral` nunca foram exercitados em tela nenhuma, então ninguém sabe se lêem bem sobre os fundos reais.

Composições reais no código, todas legítimas hoje:
- **título + corpo** — "Modo leitura offline" + "Seus itens salvos continuam aqui para usar no cálculo.
  Criar e editar precisam de conexão."
- **só corpo, sem título** — "Os valores atuais foram mantidos e continuam editáveis." → sem título o
  texto sai em `--text-body` (cinza de corpo) e a única marca do tom é o ícone: um `danger` sem título tem
  a mesma cor de texto de um `info` sem título.
- **só título, sem corpo** — o que o canvas 018 desenhou: "Vincule um filamento e uma impressora salvos" e
  "Confira os campos desta peça — ela não entra no total até ser corrigida."
- **com ação dentro do corpo** — título "Não foi possível atualizar as taxas", corpo "Usando a referência
  salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente."
  + botão secundário "Tentar novamente". → em outras telas o mesmo botão foi posto **fora** do alerta; a
  posição da ação nunca foi desenhada.
- **compacta** — em duas formas incompatíveis: no canvas 018 é `ícone + título esticado + botão
  "Sincronizar agora" à direita`, alinhado ao centro; no app é `ícone + título curto + gatilho ⓘ` com o
  corpo dentro do tooltip. → unifique: uma linha, um slot de ação à direita que aceita botão pequeno
  **ou** ⓘ.

O ícone é 20px no app e 18px no canvas 018. → Fixe um número.

## Conteúdo e dados reais
Textos literais já homologados, que **não devem ser reescritos**:
- "Modo leitura offline" / "Seus registros continuam aqui. Novos registros ficam pendentes neste
  dispositivo até você voltar a ficar online."
- "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar,
  reative o Premium." — e a variante de uma linha: "Premium pausado — você pode reabrir e recalcular este
  kit. Salvar precisa do Premium ativo."
- "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."
- "Não foi possível carregar seu catálogo." · "Não foi possível carregar seus orçamentos." · "Não foi
  possível verificar seu plano." · botão "Tentar novamente".
- "Os valores atuais foram mantidos e continuam editáveis." (degradação: o item de catálogo referenciado
  sumiu) · "Confira os campos destacados para ver o preço."
- Compacta no app: título "Frete aferido pode gerar cobrança retroativa" + gatilho "Sobre o frete
  aferido", que abre "Se o peso ou as dimensões cadastrados forem menores que os aferidos pela
  transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra no cálculo — é um
  risco a considerar ao cadastrar o anúncio."
- Compacta no canvas: "1 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora".
  → "registro(s) pendente(s)" com parênteses de plural é copy ruim; no desenho apareça já resolvida:
  "1 registro pendente neste dispositivo." / "3 registros pendentes neste dispositivo."

O texto mais longo que o alerta carrega hoje tem **420 caracteres**, com aspas curvas e dinheiro no meio
da frase: "Para vendedores CPF com mais de 450 pedidos nos últimos 90 dias, a Shopee cobra uma taxa
adicional regressiva abaixo de R$ 12,00 — mas só divulga dois pontos: “um produto de R$10 tem uma taxa de
R$6,50, enquanto um de R$8 terá taxa de R$6”. Sem a fórmula completa, não aplicamos nenhuma estimativa —
informe a taxa manualmente se precisar calcular este preço." Use **esse texto** na prancheta de estresse,
não um lorem curto.

## Estados obrigatórios
- **Repouso, por tom** — `info`, `danger`, `success`, `neutral` lado a lado, com título + corpo, para que
  a diferença seja avaliável de uma vez. O que cada um significa: `info` = contexto ou limitação honesta
  (é o padrão do produto, inclusive para offline e Premium pausado, que **não são erros**); `danger` =
  algo falhou ou está inválido agora; `success` = confirmação do que o vendedor acabou de fazer;
  `neutral` = nota sem carga.
- **Sem título** (só corpo) — como a mensagem ganha hierarquia sem o semibold. Se a resposta for "o corpo
  assume a cor do tom quando não há título", desenhe assim.
- **Só título** (sem corpo) — a forma do canvas 018.
- **Com ação** — botão secundário pequeno "Tentar novamente" dentro do alerta: onde fica, quanto respira,
  e alvo ≥44px mesmo sendo um botão `sm`.
- **Compacta com ação à direita** — uma linha: ícone + frase + "Sincronizar agora".
- **Compacta com ⓘ** — uma linha: ícone + frase curta + gatilho; e o tooltip aberto com o corpo completo.
- **Erro / offline / vazio da tela ao redor** — o alerta é o próprio veículo do erro ("Não foi possível
  carregar seu catálogo.") e do offline; mostre-o como cabeçalho de uma lista vazia, não flutuando sozinho.
- **Foco de teclado** — no botão e no ⓘ dentro do alerta: o anel precisa ser visível sobre ciano, verde,
  rosa e cinza.
- **Empilhado** — dois e três alertas seguidos, o que acontece de verdade (offline + Premium pausado +
  falha de atualização de taxas na mesma tela).
- **Texto longo a 360px** — o caso de 420 caracteres, origem da variante compacta.

## Viewports
- **Mobile 390px** — obrigatório: é onde o componente vive a maior parte do tempo.
- **Mobile 360px** — obrigatório e não negociável nesta peça: 360 é a largura da medição real que criou a
  compacta. Desenhe ali os dois avisos da Shopee, um completo e um compacto, e anote a altura de cada um.
- **Desktop 1280px e 1920px** — o alerta aparece na ficha lateral do Catálogo (coluna estreita, ~560px),
  na linha de peça do Kit e como faixa larga acima da lista de Orçamentos. A mesma peça em coluna estreita
  e em largura total se comporta de forma muito diferente: mostre as duas.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium, e Premium pausado nunca é vendido como erro.**
  Offline e "Premium pausado" são `info`, calmos, e dizem o que **continua funcionando** antes do que não
  funciona. Nada de vermelho para eles.
- **Freemium é binário**: o alerta descreve o estado; nunca insinua um plano intermediário.
- **Degradação é dita, não escondida**: "Os valores atuais foram mantidos e continuam editáveis." precisa
  ser lida, não sussurrada em cinza claro.
- **Procedência do número**: quando o alerta fala de uma taxa, ele não pode sugerir um valor que o produto
  não calcula — o texto da Shopee existe exatamente para recusar a estimativa.
- **Frase honesta nunca mora em placeholder**, nem sozinha dentro de um tooltip — com uma exceção já
  ratificada: na compacta o corpo pode ir para o ⓘ **desde que o título visível já diga o risco**
  ("Frete aferido pode gerar cobrança retroativa").
- **Contraste medido contra o fundo real**: ícone e título com ≥4,5:1 sobre o fundo tingido do próprio
  tom, em tema escuro e claro — não sobre o fundo da página.
- **Alvo ≥44px** para qualquer botão ou gatilho ⓘ dentro do alerta, inclusive na compacta, cujo padding
  vertical é menor.
- `danger` é anunciado de forma assertiva pelo leitor de tela e interrompe; reserve-o ao que realmente
  interrompe.

## Armadilhas já pagas neste projeto
- **Altura medida, não estimada**: foi a medição de 1248px a 360px que criou a compacta. Todo alerta em
  tela estreita precisa ser desenhado com texto real e a altura anotada.
- **Placeholder que corta a frase honesta**: em 016/PR-F um sufixo de placeholder foi clipado e a
  honestidade sumiu. Frases honestas vivem em elementos de largura total.
- **Texto que passa no teste e não aparece na tela**: asserção de texto não enxerga oclusão nem transbordo.
  O alerta de 420 caracteres precisa ser desenhado com caixas, não com fé.
- **Valor grande estoura a coluna**: `R$ 1.234,56` no meio do corpo, na ficha lateral de 560px, precisa
  quebrar sem empurrar o bloco.
- **Duplicação fora do design system**: a compacta hoje é remontada à mão por quem a usa, o que já rendeu
  divergência de ícone e de estrutura. Trate-a como variante do mesmo componente.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class, mesmo cuidado)**:
1. **Matriz de tons** — os quatro tons × (título+corpo · só corpo · só título), a 1280px.
2. **Alerta com ação** — botão dentro e, ao lado, a mesma mensagem com o botão fora, para o dono comparar.
3. **Variante compacta** — as duas formas (botão à direita; ⓘ à direita), com o tooltip aberto.
4. **360px: antes e depois** — a seção Shopee com dois alertas completos vs. um completo + um compacto,
   com a altura total anotada em cada caso.
5. **Contexto real** — na ficha lateral do Catálogo e como faixa larga sobre a lista de Orçamentos, a 1920px.
6. **Foco e empilhamento**.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` com
`tf-alert--{neutral,info,success,danger}` e `tf-alert--compact`; ícones do conjunto da casa (`info`,
`circle-check`, `circle-alert`); a ação é `tf-btn tf-btn--secondary tf-btn--sm`; o gatilho ⓘ é o `InfoTip`
da casa; corpo em `--fs-body-sm`; fundos em `--tf-info-soft` / `--tf-success-soft` / `--tf-danger-soft` /
`--bg-muted` e cores de tom em `--info-text` / `--success-text` / `--danger-text` / `--text-strong`.

## Perguntas em aberto para o dono
1. **`success` e `neutral` continuam existindo?** Nenhum ponto do app usa os dois. Se o produto nunca
   confirma nada com um bloco verde (confirmação hoje é toast ou badge), `success` pode sair — e `neutral`
   pode virar simplesmente texto de apoio, sem bloco tingido. Manter quatro tons dos quais dois nunca
   aparecem é decisão de produto, não de desenho.
2. **Alerta sem título: o corpo herda a cor do tom ou continua cinza?** É a forma mais comum da peça —
   mudar isso muda a leitura de dezenas de telas de uma vez.
3. **A ação fica dentro ou fora do alerta?** Os dois padrões estão em produção hoje ("Tentar novamente"
   dentro, no Catálogo; fora, no Histórico).
4. **Na compacta, quando o corpo pode migrar para o ⓘ?** A regra atual é informal ("quando o aviso é
   estático e sempre presente"). Vale também para o aviso de registros pendentes, ou só para avisos que
   não dependem do formulário?

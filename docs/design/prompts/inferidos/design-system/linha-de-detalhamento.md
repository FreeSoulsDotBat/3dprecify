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

- **Onde vive:** `shared/ui/breakdown-row.tsx` — uma linha: bolinha de legenda opcional (quadrado de 10px, `radius 3`) à esquerda, rótulo (com sub-rótulo opcional embaixo) no meio e valor à direita, em cinco ênfases (`default`/`muted`/`accent`/`negative`/`total`). Aparece em **21 pontos**: 13 empilhados no detalhamento de `/calcular` (`calculator-form.tsx`), 4 no rollup de preços por canal do kit (`channel-rollup.tsx`), 3 no detalhe do orçamento congelado (`snapshot-detail-page.tsx`) e 1 no resumo da montagem do kit (`assembly-summary.tsx`).
- **Como o vendedor chega:** O vendedor rola do preço para baixo querendo saber POR QUÊ — é a peça que cumpre a promessa da marca, "a conta inteira à mostra". No orçamento congelado ele chega pelo caminho inverso: abre um registro de meses atrás e lê a conta como ela era naquele dia.
- **Vizinhança imediata:** Imediatamente abaixo do par de `PriceHero` (Varejo e Atacado) e acima dos cartões de preço por canal. As linhas se empilham em ordem: material, energia, depreciação, mão de obra, **Outros custos** (uma linha por item que o vendedor nomeou), e a ÚLTIMA leva `emphasis="total"`. As linhas de taxa de marketplace usam `negative` — que pinta só o VALOR de vermelho e usa um menos tipográfico `−` (U+2212) colado ao prefixo.
- **Dados que chegam (e o que ela devolve):** Números do `pricing-core` (offline, sem servidor) e rótulos: os fixos vêm de `messages.pt-br`, mas o de "Outros custos" é **texto que o VENDEDOR digitou**. Por isso rótulo e valor carregam `overflow-wrap: anywhere` — 300 caracteres sem espaço geraram 2.100px de rolagem horizontal a 1440px na homologação, e o culpado é um nó de TEXTO, invisível a qualquer medição de caixa.
- **O que acontece depois:** Nada muda ao tocar — é leitura. Mas essa pilha inteira é o que congela dentro do orçamento (payload imutável, com gatilho no banco) e o que é impresso no PDF exportado — onde um nome comprido já estourou as colunas de preço uma vez.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Linha do detalhamento (`tf-brow`) — a linha que desconta e a linha que o vendedor batizou

## O que desenhar

A **linha do detalhamento**: rótulo à esquerda, valor em dinheiro à direita, empilhadas dentro de um
`tf-card` para mostrar de onde saiu o preço. É a peça que cumpre a promessa da marca ("a conta inteira
à mostra") e aparece em quatro lugares: no **Calcular** (o bloco "Como chegamos no preço", ~9 linhas +
"Custo total" + as linhas de cada canal de marketplace), no **detalhe do Orçamento congelado**
(Histórico), no **resumo do Kit** (barra "Total do kit" e "Preços por canal (kit)") e no rollup por
canal. O vendedor a lê depois de digitar os custos, para conferir se a conta fecha. Este prompt pede o
desenho de **duas variações que nunca foram desenhadas**: a linha de **ênfase negativa** (dinheiro que
sai / resultado negativo) e o **pior caso de dado real** — o rótulo que o próprio vendedor digitou.

## Por que este prompt existe

A pilha completa já está desenhada duas vezes (protótipo de 2026-07-02 e o canvas do dono do 018, que
monta o "Detalhamento" com as classes reais `tf-brow`/`__main`/`__label`/`__sub`/`__val`/`--total`).
O que ficou de fora dos dois: a ênfase **`negative`** — nenhum desenho a exercita; o protótipo pintou
até a *taxa de marketplace* como `muted`, cinza — e o **rótulo longo**. Sem desenho, o código decidiu
sozinho: pinta só o VALOR de vermelho e cola um **menos tipográfico `−` (U+2212)** no prefixo (`−R$
20,00`), e usa `--danger` cru no lugar do token de status-como-texto. **Isso contraria uma regra
explícita da casa**: os tokens `--danger-text`/`--success-text`/`--info-text` existem justamente porque
"status como texto usa o tom medido, nunca o matiz cru" (INV-3/INV-4). No tema escuro os dois coincidem;
**no tema claro `--danger` (#ef3340) sobre card branco lê ~3,7:1 — reprova AA** — enquanto
`--danger-text` (#c41f2b) lê ~6,0:1. A legenda de aviso logo abaixo da linha já usa o token certo: a
linha e sua própria legenda estão em vermelhos diferentes.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual (`apps/web/src/shared/ui/breakdown-row.{tsx,css}`), da esquerda para a direita:

| Parte | Hoje | Observação |
|---|---|---|
| bolinha de legenda | quadrado 10×10px, raio 3px, cor passada por fora | → **morta**: desde 016/US5 nenhuma tela passa cor. Foi removida do Calcular por ler como "cromo de legenda de gráfico" |
| rótulo | 13px, peso médio, cor de corpo, quebra em qualquer ponto | recebe o **nome que o vendedor digitou** em "Outros custos" |
| sublegenda (opcional) | 12px, cor `muted`, logo abaixo do rótulo | usada para `markup 60%`, contagem de peças, "contribuíram N linhas" |
| valor | Inter tabular, 13px, semibold, alinhado à direita, quebra em qualquer ponto | prefixo `R$` + vírgula decimal |
| separador | linha de 1px `--border-subtle` **entre** linhas (a primeira não tem) | |
| altura | mínimo 40px, respiro de 12px em cima e embaixo | linha **não é interativa** — não há alvo de toque a cumprir |

Ênfases que o código tem: **padrão** · **`muted`** (rótulo e valor cinza, peso normal) · **`accent`**
(só o valor em roxo) · **`negative`** (só o valor em vermelho) · **`total`** (margem extra em cima,
borda superior de **2px** `--border-strong`, rótulo bold 15px, valor bold 18px).

→ Problema 1: **`negative` só pinta o valor.** O rótulo continua cinza/normal. Ninguém desenhou se isso
basta ou se a linha inteira deveria mudar de tom (fundo `--danger-soft`? ícone?).
→ Problema 2: **`−R$ 20,00` sai colado** — o menos gruda no `R$` porque o prefixo é montado como
`− + "R$ " + valor`. Ninguém decidiu se é assim mesmo, se é `-R$ 20,00`, se é `R$ −20,00` ou se a
subtração deveria aparecer como cor + sinal.
→ Problema 3: **a mesma cara para duas coisas diferentes.** Hoje a linha "Frete" (dinheiro que SAI, um
desconto normal e esperado) é **`muted` cinza** com o menos; e "Recebido líquido" quando dá prejuízo é
**`negative` vermelho**. São semânticas distintas usando o mesmo sinal `−`, e só uma tem cor.
→ Problema 4: **a bolinha nunca foi desenhada como legenda de verdade** e hoje não é usada por ninguém.

## Conteúdo e dados reais

Textos literais, exatamente como aparecem hoje (não reescreva; se achar ruim, diga por quê):

- Detalhamento de custo: `"Material"` · `"Energia"` · `"Máquina"` · `"Falha / perdas"` ·
  `"Acabamento"` · `"Mão de obra"` · `"Custo total"` (linha `total`).
- Derivação de preço: `"Preço varejo"` (ênfase `accent`) e `"Preço atacado"`, ambas com sublegenda
  `"markup 60%"`.
- Linhas de canal: `"Preço para anunciar"` · `"Frete"` (a linha de desconto) · `"Recebido líquido"`.
- "Outros custos": o rótulo é **o nome digitado pelo vendedor** (placeholder do campo: `"Ex.: Embalagem"`);
  nome em branco cai no rótulo neutro `"Outros custos"`.
- Legenda de aviso logo abaixo da linha negativa, em vermelho, 12px, fora de qualquer placeholder:
  `"Canal não-lucrativo neste preço (frete maior que a margem)."`

Números verdadeiros para desenhar com (são os do canvas e da semente do app, não invente outros):
Material `R$ 3,78` · Energia `R$ 0,36` · Máquina `R$ 3,55` · Falha / perdas `R$ 0,77` · Acabamento
`R$ 4,69` · Mão de obra `R$ 6,19` · Embalagem `R$ 2,50` · **Custo total `R$ 21,84`**.
Caso negativo (Shopee com frete digitado): Preço para anunciar `R$ 24,24` · Frete `−R$ 20,00` ·
**Recebido líquido `−R$ 4,61`**.
Pior caso de largura: valor de 5 dígitos + centavos, `R$ 12.345,67` (já custou aperto no Kit).

## Estados obrigatórios

A linha **não é interativa**: não tem hover, foco, pressionado nem desabilitado, e nada nela recebe
clique. Não desenhe esses quatro — desenhe estes, que são os que existem de verdade:

1. **Repouso padrão** — rótulo + valor. Primeira da pilha, **sem** borda em cima.
2. **`muted`** — rótulo e valor cinza, peso normal: um custo opcional que ficou em `R$ 0,00` (ex.:
   `"Acabamento" R$ 0,00`) e a linha de desconto `"Frete" −R$ 20,00`.
3. **`accent`** — valor em roxo: `"Preço varejo"` com sublegenda `"markup 60%"`.
4. **`negative`** — `"Recebido líquido" −R$ 4,61`, com a legenda vermelha embaixo. **Este é o estado
   principal do prompt.** Mostre-o nos dois temas e diga qual vermelho usar em cada um.
5. **`total`** — `"Custo total" R$ 21,84`, borda de 2px em cima, tipografia maior.
6. **Com sublegenda** — duas linhas de texto à esquerda sem empurrar o valor.
7. **Rótulo hostil** — nome digitado de 300 caracteres **sem um espaço** (um código de produto colado).
   Hoje ele quebra em qualquer ponto e vira um parágrafo de 40 linhas com o valor pendurado no topo.
   Precisa de decisão de desenho: quantas linhas no máximo, e o que acontece com o resto.
8. **Valor hostil** — `R$ 12.345,67` na coluna estreita da ficha lateral do desktop.
9. **Com bolinha (legado)** — o quadradinho de 10px à esquerda. Desenhe **uma** prancheta dizendo se
   ela fica (e como fica: bolinha redonda? quadrado? de que tamanho?) ou se some do sistema.

Carregando, vazio, erro e offline **não moram nesta linha**: são do bloco que a contém (o card mostra
selo/legenda de procedência). Não desenhe casca de carregamento por linha.

## Viewports

- **390px (mobile)** — obrigatório: é onde a peça nasce e onde o aperto aparece. Rótulo e valor dividem
  ~326px úteis dentro do card. Mostre a pilha completa de 8 linhas + total.
- **1280px (desktop)** — obrigatório: no layout do 018 o "Detalhamento" vive numa das duas colunas de
  um grid, e no Kit vive na ficha lateral. A coluna é estreita, então o caso do valor de 5 dígitos e do
  rótulo longo é **pior** aqui do que a largura total sugere. 1920px não acrescenta nada: a coluna não
  cresce, só a página.

## Regras que o desenho não pode quebrar

- **Contraste medido contra o fundo real** — o vermelho do valor negativo é lido sobre `--surface-card`,
  que é **branco** no tema claro. O matiz cru reprova ali. Escolha e nomeie o tom por tema.
- **A cor não pode ser o único portador do sinal.** O `−` já cumpre esse papel; mantenha-o visível e
  diga onde ele fica em relação ao `R$`.
- **A conta tem que fechar.** As linhas somam exatamente o "Custo total" (o protótipo de 2026-07-02
  falhou nisso: 9,35 + 4,68 = 14,03 contra um total de 14,02). Use os números acima, que fecham.
- **Nunca `R$ 0,00` como "não sei".** Uma linha ausente é ausência honesta; zero é zero de verdade.
- **A frase honesta em elemento de largura total**, nunca em placeholder — vale para a legenda
  `"Canal não-lucrativo neste preço (frete maior que a margem)."`.
- **Nada de upsell nesta peça.** O detalhamento é grátis e ilimitado: nenhuma linha pode aparecer
  borrada, cadeada ou com selo de Premium.
- Dinheiro sempre em pt-BR com centavos e algarismos tabulares, para as colunas alinharem verticalmente.

## Armadilhas já pagas neste projeto

- **2.100px de rolagem horizontal a 1440px**, medidos na homologação automatizada, causados por um
  rótulo de 300 caracteres sem espaço. O culpado é um **nó de texto pintando fora da caixa** — nenhuma
  medição de retângulo de elemento o enxerga, e nenhum teste de "o texto está presente" o denuncia.
  O desenho precisa dar um teto explícito ao rótulo, não confiar em quebra automática.
- O mesmo já aconteceu com o **valor**: ele era "não quebra" e um número grande empurrou a página a 390px.
- No Kit, 89px por valor numa barra de duas colunas **não comportam `R$ 1.234,56`** em nenhuma
  tipografia — a saída foi empilhar, não encolher a fonte.
- Frase honesta dentro de placeholder é frase cortada (custou uma homologação inteira).

## Entregável

Pranchetas em `.dc.html` reutilizando `tf-card` como recipiente e `tf-brow` como a linha (com
`tf-brow__main` / `__label` / `__sub` / `__val` e os modificadores `--muted`, `--accent`, `--negative`,
`--total`); a legenda de aviso como parágrafo de 12px em `--danger-text`; se propuser um selo, use
`tf-badge --danger` em vez de inventar. **Não crie primitivo novo** — se a linha negativa precisar de
fundo tingido ou ícone, declare que é uma extensão do `tf-brow` e nomeie o modificador.

1. **Pilha canônica** (8 linhas + `--total`) a 390px e na coluna do 1280px — escuro e claro.
2. **Bloco de canal com prejuízo**: anúncio, frete `−R$ 20,00`, `Recebido líquido −R$ 4,61` e a legenda
   vermelha — escuro e claro, com o valor de contraste anotado ao lado de cada vermelho.
3. **Matriz das cinco ênfases** lado a lado, mesma largura, para comparar peso e cor.
4. **Casos hostis**: rótulo de 300 caracteres sem espaço e valor `R$ 12.345,67` na coluna estreita,
   com a solução de truncamento/quebra desenhada e anotada.
5. **A bolinha**: prancheta única com a decisão (fica, muda de forma, ou sai do sistema).

Tema escuro é o padrão; o claro é first-class e é onde o vermelho reprova hoje — desenhe os dois.

## Perguntas em aberto para o dono

1. **Vermelho significa "dinheiro saindo" ou "resultado ruim"?** Hoje a linha de frete (saída normal e
   esperada) é cinza e só o líquido negativo é vermelho. Se vermelho for "saída", toda dedução muda de
   cor; se for "resultado ruim", a regra atual está certa e precisa ser escrita.
2. **A linha negativa muda por inteiro ou só o valor?** Rótulo, fundo (`--danger-soft`) e um possível
   ícone estão sem decisão.
3. **A bolinha de legenda fica no sistema?** Nenhuma tela a usa desde 016/US5. Se ficar, para quê —
   amarrar linha a um gráfico que ainda não existe?
4. **O nome digitado em "Outros custos" tem limite de caracteres?** Se o produto limitar na entrada
   (ex.: 60), o pior caso do desenho encolhe muito. E: cada sub-custo deveria carregar a sublegenda
   `"Outros custos"` (como o canvas do 018 desenhou em "Embalagem") ou só o nome cru, como o app faz hoje?

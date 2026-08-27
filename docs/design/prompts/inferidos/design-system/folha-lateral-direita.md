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

- **Onde vive:** `shared/ui/dialog.tsx` → `<SheetContent>` (`variant="sheet"`, `side` com **padrão `"right"`**). Painel colado na borda direita da janela, `top:0; bottom:0`, `width: min(92vw, 26rem)`, arredondado só na borda interna (`radius-xl 0 0 radius-xl`), `padding --space-5`, rolagem por dentro. São **12 folhas**: cadastro/edição de filamento e impressora (`catalog-panel.tsx:459` — a ÚNICA que declara `side` explicitamente, e declara "right"), exportar PDF/CSV (`export-sheet.tsx:92`), registrar orçamento (`record-snapshot-sheet.tsx:86`), salvar simulação (`save-scenario-sheet.tsx:72`), renomear cenário (`scenario-context-bar.tsx:231`), lista de simulações + renomear dentro dela (`scenarios-list-sheet.tsx:386` e `:467`), oferta de assinatura na Conta (`conta-page.tsx:201`), e o período personalizado dos Orçamentos (`historico-page.tsx:488`, sem X).
- **Como o vendedor chega:** Por um botão de ação no topo ou no corpo da aba: "Novo filamento" na barra do Catálogo, "Exportar" no orçamento, "Registrar orçamento" no rodapé do resultado, "Salvar simulação" na barra de contexto, "Ver planos" na Conta. No celular ela cobre 92% da largura e chega DE LADO — gesto que o vendedor lê como "tela nova" mas que o botão voltar do sistema não desfaz. Acima de 1280px o Catálogo já não a usa: a ficha mora fixa na coluna direita.
- **Vizinhança imediata:** Por baixo, a página de origem escurecida pelo scrim; à esquerda dela sobram ~8% da tela no celular e uma faixa larga no desktop. Dentro, de cima para baixo: o **título** da folha (mesma tipografia CAIXA ALTA do diálogo, com o mesmo recuo à direita para o X de 44×44), às vezes uma **descrição** em `--text-muted`, depois o corpo — que é sempre um formulário de `Field` empilhados ou uma lista de cartões — e um rodapé de ações montado caso a caso pelo chamador. Não existe alça de arrasto.
- **Dados que chegam (e o que ela devolve):** Cada chamador entrega o próprio conteúdo. `catalog-panel` passa `defaultValues` do item selecionado (do cache uid-keyed do catálogo) e o modo `edit`/`new`; `export-sheet` recebe o entitlement ATIVO como pré-condição; `save-scenario-sheet` recebe o cálculo corrente do `pricing-core` mais o catálogo de tarifas servido/cacheado; `conta-page` injeta o `OfferPanel` com os preços de assinatura. O primitivo em si só recebe `side`, `showClose` e filhos.
- **O que acontece depois:** Ao salvar, a folha fecha, a lista por baixo se atualiza (online) ou o registro entra na fila do outbox (offline) e um `Toast` sobe no canto — no celular ele aparece EM CIMA da barra de abas, empurrado por `--tabbar-h`. Fechando pelo X ou pelo Escape, nada muda; nos formulários com alteração pendente, um `Dialog` central de "descartar alterações" se interpõe.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Folha lateral (Sheet) — a superfície que hoje entra pela direita sem ninguém ter escolhido

## O que desenhar
A folha modal do Precifica3D: o painel ancorado numa borda da tela que cobre o app inteiro com um
scrim e recebe UM formulário ou UMA decisão curta. Ela é a superfície de escrita mais usada do
produto no celular — é por ela que o vendedor cadastra filamento, impressora, produto e kit, salva
um orçamento congelado, salva uma simulação, renomeia uma simulação, escolhe o que exportar,
escolhe um período no Histórico e vê a oferta do Premium na Conta. São 12 aberturas, 8 arquivos,
1 primitivo. Desenhe o primitivo (a moldura, a ancoragem, o cabeçalho, a rolagem, o rodapé de
ações, o gesto de sair) e mostre-o com 3 conteúdos reais, do mais curto ao mais longo.

## Por que este prompt existe
A ancoragem NUNCA foi desenhada, e o código contraria o único desenho que existe. `dialog.tsx`
fixa `side = "right"` como PADRÃO; das 12 folhas do app apenas uma declara o lado — e declara
`"right"`. As outras 11 entram pela direita porque ninguém escolheu. O kit de protótipo de
2026-07-02 desenhou folha em duas telas (`CatalogScreen.jsx`, `HistoryScreen.jsx`) e as duas são
`placement="bottom"`; o §D.2 repete "entra de baixo (mobile) / centralizado (desktop)" e o §E8
chama o upsell de "bottom-sheet contextual". Nenhuma das três rodadas de auditoria tocou no
assunto. O canvas 018 resolve o desktop REMOVENDO a folha ("ficha do item à direita, sem sheet",
≥1280px) — o que deixa exatamente 390px, onde a folha vive de verdade, sem desenho nenhum.
→ A pergunta central deste prompt não é estética: **de que lado esta folha entra no celular, e o
que o gesto de sair dela é**, dado que hoje ela cobre 92% da largura vindo do lado e disputa
leitura com o "voltar" do sistema.

## O que já existe hoje (não invente do zero — corrija)

Moldura (`dialog.css`):

| Propriedade | Valor de hoje | Leitura |
| --- | --- | --- |
| Ancoragem | direita, `top:0; bottom:0` | → padrão implícito, contraria o protótipo |
| Largura | `min(92vw, 26rem)` = 358,8px a 390px · 416px a 768px | → no celular é quase tela cheia mas parece painel |
| Cantos | `radius-xl` só nas bordas internas (esq.) | coerente com a ancoragem |
| Rolagem | `overflow: auto` na folha inteira | → cabeçalho e ações rolam junto |
| Fechar | `×` absoluto no topo-direito, 44×44px, `aria-label="Fechar"` | → fica SOBRE o conteúdo; o título reserva `space-10` à direita |
| Alça de arrasto | não existe | → nada indica que dá para arrastar/deslizar para sair |
| Movimento | nenhum: sem `transition`, sem keyframes | → a folha não desliza, ela APARECE |
| Rodapé de ações | não existe no primitivo | → montado caso a caso; em algumas é um botão solto no fim do formulário |
| `--sheet-left` | existe no CSS, **zero consumidores** | código morto |

Título: caixa alta, `font-title`, `tracking-wide`, `fs-lg`, `text-strong`.
Descrição: `fs-body-sm`, `text-muted`, logo abaixo do título.

Os 12 conteúdos reais e seus títulos literais: "Novo filamento" / "Editar filamento" · "Nova
impressora" / "Editar impressora" · "Novo produto" / "Editar produto" · "Montar kit" / "Editar
kit" · "Salvar em Orçamentos" · "Salvar simulação" · "Renomear simulação" (duas origens
diferentes) · "Exportar" · "Período…" · "Assinar o Premium".

## Conteúdo e dados reais

**Folha curta — "Período…"** (Histórico): dois campos de data "De" e "Até", botão "Aplicar".
Abre sem `×` (`showClose={false}`) → hoje só se sai por Esc ou pelo scrim, e isso não é dito.

**Folha média — "Salvar em Orçamentos"**: intro "Vamos guardar os valores exatamente como estão
nesta tela, com a data de hoje." · campo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120
caracteres · campo "Validade da proposta" com o sufixo "dias" DENTRO do campo (número inteiro,
1 a 3650) · grupo "Preço que você está cotando" com "Varejo" e "Atacado" (ex.: R$ 24,24 e
R$ 21,01 — o de atacado só aparece quando existe) · ação "Salvar em Orçamentos".

**Folha longa — "Exportar"**: grupo "O que exportar" com "Orçamento para o cliente (PDF)" e
"Meus orçamentos (CSV)" · interruptor "Incluir detalhamento de custos" (sempre começa DESLIGADO)
· abaixo dele, a frase de dano, em texto corrido de largura inteira: "Seu cliente veria as linhas
gravadas — material, energia, máquina, falhas, acabamento, mão de obra e os seus outros custos —
e poderia calcular a sua margem." (para kit, a variante curta: "Seu cliente veria o custo total
gravado do kit — e poderia calcular a sua margem.") · a descrição do que viaja: "O orçamento leva:
itens, quantidades, o valor cotado, a data, a validade, o rótulo deste registro (impresso como
“Referência”), e identifica você pelo nome e e-mail da sua conta." · ação "Gerar PDF" ou
"Baixar CSV". Esse é o pior caso de altura: desenhe-o com o teclado ABERTO e o texto rolado.

**"Salvar simulação"**: intro "Guardamos a estratégia desta tela — canais, taxas ajustadas, base
de custo. Ao reabrir, ela recalcula com os preços de hoje." · "Nome" (obrigatório, 120) · "Nota
(opcional)" (500, área de texto de 3 linhas).

## Estados obrigatórios
- **Repouso** — folha aberta, scrim `surface-overlay` sobre o app, foco já dentro dela.
- **Foco visível** — anel `--ring` em cada campo, no `×` e nos botões; o `×` é o primeiro alvo
  focável e precisa ser óbvio como tal.
- **Rolagem** — conteúdo mais alto que a tela: mostre onde o título e o `×` ficam quando o
  usuário rolou (→ hoje somem; decida se o cabeçalho gruda).
- **Teclado aberto** (390px) — o campo em edição visível e a ação principal alcançável.
- **Enviando** — botão em `loading` com o rótulo mantido; a folha NÃO fecha antes da resposta.
- **Erro de escrita, folha aberta** — as escolhas ficam intactas. Frases reais: "Não foi possível
  gerar o arquivo." · "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." ·
  "Salvar uma simulação precisa de conexão." · "Dê um nome à simulação." (só depois da 1ª tentativa
  de salvar — o campo intocado não grita).
- **Bloqueio ANTES de abrir** — o gatilho fica desabilitado com a razão em TEXTO ao lado, nunca em
  tooltip: "Exportar precisa de conexão." · "Exportar precisa do Premium ativo." · e, dentro da
  folha, na opção que de fato está morta: "Sincronize para exportar."
- **Premium pausado (lapsed)** — a folha de catálogo abre em LEITURA, com o aviso calmo acima; não
  abre um formulário que vai falhar no envio.
- **Sem permissão** — para quem não tem Premium ativo, o gatilho de salvar não existe (não é botão
  cinza, não é isca). A folha simplesmente não é alcançável por ali.
- **Fechamento com alterações** — hoje só a barra de contexto de cenário confirma; nas demais,
  tocar no scrim descarta calado. → decida o comportamento do primitivo.

## Viewports
- **390px — obrigatório e principal.** É o único lugar onde esta peça continua existindo depois do
  018, e é onde o problema mora: 358,8px de painel sobre 390px de tela.
- **768px — obrigatório.** Aqui a folha vira mesmo um painel lateral (416px sobre 768px), e a
  mesma peça precisa ler bem nos dois.
- **1280px+ — não desenhar a folha.** O canvas 018 já decidiu: mestre-detalhe com ficha fixa à
  direita, sem sheet. Se algum conteúdo desta lista não couber na ficha, isso é pergunta ao dono,
  não desenho novo.

## Regras que o desenho não pode quebrar
- A frase honesta ("Seu cliente veria as linhas gravadas…", "Sincronize para exportar.") vive em
  elemento de largura inteira, NUNCA em placeholder e nunca em tooltip — placeholder corta e some
  ao digitar; tooltip não existe no toque.
- Falha de rede jamais é vendida como falta de Premium, e vice-versa: são frases distintas e o
  desenho precisa de lugar para as duas.
- Freemium é binário: sem Premium ativo o gatilho não existe; nada de folha aberta que termina em
  403.
- Nenhuma ação destrutiva mora nesta folha — excluir é diálogo centrado, com o nome ecoado.
- Todo alvo tocável ≥44×44px, inclusive o `×` e os rádios.
- Contraste medido contra o `surface-card` real por trás do scrim, nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: nesta largura, 92vw + `space-5` de padding dos dois
  lados deixa pouco para um valor grande; um `R$ 1.234,56` ou um nome de 120 caracteres tem de
  quebrar, não empurrar. A homologação já mediu 100,5px de transbordo com um botão nascido fora da
  viewport.
- **Texto ocluso passa em teste**: o `×` absoluto pode cobrir o fim do título — nenhum
  `toContainText` vê isso. Desenhe a reserva de espaço explicitamente.
- **Sufixo dentro do campo**: "dias" e as máscaras de milhar já cortaram texto uma vez; o campo
  precisa de largura para "3650" + "dias" sem colisão.
- **Folha que desmonta antes do retorno**: já houve app congelado (overlay órfão) e toast que nunca
  apareceu porque a folha sumiu antes da confirmação. O desenho tem de deixar claro em que momento
  a folha some e onde a confirmação aparece.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class), ambas em 390px e 768px:
1. **A moldura anotada** — ancoragem, largura, cantos, scrim, cabeçalho (título + `×`), área
   rolável e rodapé de ações, com as medidas escritas.
2. **Folha curta** — "Período…" (De/Até + "Aplicar").
3. **Folha longa** — "Exportar" em PDF com o interruptor LIGADO, texto de dano visível, rolada até
   o fim.
4. **Folha com teclado aberto** — "Salvar em Orçamentos" editando "Validade da proposta".
5. **Estados** — enviando, erro com folha aberta, gatilho desabilitado com a razão em texto ao
   lado, e leitura em Premium pausado.
Reutilize os primitivos existentes: `tf-dialog--sheet` (moldura), `tf-dialog__title` /
`tf-dialog__desc` / `tf-dialog__x` (cabeçalho), `tf-input` + `tf-inputwrap` + `Field` (campos),
`tf-switch` (o opt-in de custos), `tf-btn` primário/secundário/ghost (ações), `tf-alert` tom `info`
para offline e Premium pausado, `tf-card` só quando a folha listar itens. Não crie primitivo novo;
se faltar um, diga qual e por quê em vez de desenhá-lo.

## Perguntas em aberto para o dono
1. **Lado.** No celular a folha volta a entrar de BAIXO (como os dois únicos protótipos que
   existem e como o §D.2 escreve), ou fica na direita que o código escolheu sozinho? Isso muda o
   gesto de sair, os cantos, a altura e a relação com o "voltar" do Android.
2. **Fechar com alterações não salvas** vira regra do primitivo (confirmar sempre, como a barra de
   contexto de cenário já faz) ou continua caso a caso?
3. **Cabeçalho fixo.** Título e `×` grudam no topo durante a rolagem — ou continuam rolando junto
   com o conteúdo, como hoje?
4. **`--sheet-left`**: código morto sem consumidor. Some do sistema, ou existe um uso previsto que
   nunca foi escrito?

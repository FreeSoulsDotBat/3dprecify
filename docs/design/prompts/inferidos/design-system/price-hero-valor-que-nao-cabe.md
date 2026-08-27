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

- **Onde vive:** `shared/ui/price-hero.tsx` + `price-hero.css`. Aparece em **4 pontos**, todos no bloco de resultado: em `/calcular`, o par **Varejo** (tom `accent`) e **Atacado** (tom `energy`), lado a lado, `size="md"`, centralizados (`calculator-form.tsx:642` e `:650`); em `/kits`, o mesmo par no resumo da montagem (`assembly-summary.tsx:82-83`). Estrutura interna: rótulo-sobrancelha em cima, depois a linha do valor — prefixo `R$` + inteiro + `,decimais` — e a legenda embaixo.
- **Como o vendedor chega:** É o destino de todo o fluxo grátis: o vendedor preenche gramas, tempo, filamento e markup e ROLA até aqui. É o número que o produto existe para mostrar — e o que ele fotografa para mandar ao cliente.
- **Vizinhança imediata:** Logo abaixo do último campo do formulário e imediatamente acima do detalhamento — a pilha de `BreakdownRow` que abre a conta linha a linha. Os dois heróis dividem a largura; abaixo deles, quando há canais ligados, vêm os cartões de preço por marketplace com seus selos de tarifa; e mais abaixo o botão "Registrar orçamento" (Premium).
- **Dados que chegam (e o que ela devolve):** Um número puro do `pricing-core` (`result.precoVarejo` / `result.precoAtacado`), calculado LOCALMENTE, offline inclusive — o servidor nunca recomputa. O primitivo formata em pt-BR com `formatDecimal` e parte a string na vírgula para estilizar centavos. A legenda traz o markup digitado ("markup 50%").
- **O que acontece depois:** Esse número é o que vira orçamento congelado quando o vendedor Premium toca em "Registrar orçamento" — a partir daí ele é imutável (gatilho de imutabilidade no banco) e reaparece no detalhe do orçamento e no PDF exportado. Todo defeito de transbordo que esta peça já teve — quebra de linha, rolagem interna, o inteiro partido ao meio, os 7,5px de descentralização por barra de rolagem clássica — foi descoberto com o preço JÁ na tela do dono, nunca no desenho.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# PriceHero — o preço quando ele não cabe

## O que desenhar

O `PriceHero` é o leitor de preço em destaque do Precifica3D: um rótulo em caixa alta, o número grande com
a moeda pequena e elevada à esquerda e os centavos reduzidos à direita, e uma legenda embaixo. Ele aparece
no fim da aba **Calcular** (o par "Preço varejo" / "Preço atacado", lado a lado ou empilhados), na **barra
fixada do kit** (o par Varejo/Atacado abaixo do "Custo total"), e é o formato do número congelado no
**Histórico**. É a última coisa que o vendedor olha antes de fechar a tela — o produto inteiro existe para
produzir esse número. O que precisa ser desenhado aqui **não é o caso bonito**: é o comportamento do
readout quando o valor **não cabe** na caixa — quando ele precisa encolher, quebrar entre partes, ou rolar
por dentro — em cada tom, tamanho e viewport.

## Por que este prompt existe

A autoridade é **PROTÓTIPO PARCIAL**. O desenho original (`.design-import/components/data/PriceHero.jsx`)
é o mais completo do repositório — CSS inteiro, 5 tons, 3 tamanhos, a divisão moeda/inteiro/centavos — e o
canvas instancia o componente duas vezes, sempre com valores pequenos (**R$ 3,00**, **R$ 20,65**). O caso
nominal está coberto. O que nunca foi desenhado é o valor que transborda, e as quatro correções que o app
precisou fazer **contradizem o desenho, uma a uma**: o desenho não tem `flex-wrap`, não tem rolagem, não
impede a quebra no meio do número, crava entrelinha 1 (a causa medida da barra de rolagem do item 9 da
homologação 016) e centraliza o cartão por `align-items` (a causa medida do transbordo em 016/T016). Cada
um desses defeitos foi descoberto com o preço já na tela do dono. Este prompt pede o desenho que faltou.

## O que já existe hoje (não invente do zero — corrija)

Anatomia real (origem: `apps/web/src/shared/ui/price-hero.tsx` + `price-hero.css`):

| Parte | Conteúdo | Tratamento atual |
| --- | --- | --- |
| `label` | ex. "Preço varejo" | 13px, semibold, CAIXA ALTA, opacidade 0,9 — opcional |
| `cur` | "R$" | 0,4em do número, elevado 0,55em, opacidade 0,85 |
| `int` | "1.234" | 1em — o tamanho manda na linha inteira |
| `dec` | ",56" | 0,5em, bold |
| `cap` | ex. "markup 50%" | 12px, medium, opacidade 0,92 — opcional |

Tons: `plain` (sem fundo nem borda), `accent` (roxo com glow — **é o padrão**), `energy`, `inverse`,
`success`. Tamanhos: `md` (36px), `default` (fluido 40→60px), `lg` (fluido 48→76px). Modificador `center`.

Onde vive hoje, com os textos literais:

- **Calcular** — dois cartões numa grade `auto-fit` com piso de **210px**: `accent` + "Preço varejo" +
  legenda "markup 50%"; `energy` + "Preço atacado" + legenda "markup 30%". Ambos `md`, centralizados.
  Acima deles, quando o atacado sai maior que o varejo, um alerta de tom `info` (nunca de erro).
- **Barra fixada do kit** — os mesmos dois valores, empilhados em **uma coluna**, rótulos curtos
  "Varejo" e "Atacado" (o longo "Preço atacado" mede 111px e tranca num orçamento de ~101px), e abaixo,
  quando há peça fora da conta: "{n} peça(s) fora do total — confira os avisos nas peças acima."
  → **Problema**: nesta barra nenhum dos dois declara tom, então **os dois herdam `accent`** — dois blocos
  roxos com glow, empilhados, dentro de um cartão. Isso nunca foi desenhado; foi herdado do valor padrão.
- → **Problema**: o componente aceita `children` (um espaço livre depois da legenda) que nenhum uso
  exercita. Ou o desenho diz para que serve, ou ele não deveria existir.

## Conteúdo e dados reais

- O valor é sempre **dinheiro em reais**, formatado pt-BR com **duas casas** e **algarismos tabulares**:
  separador de milhar ".", decimal ",". Exemplos verdadeiros do produto: `R$ 16,16`, `R$ 24,24`,
  `R$ 21,01`, `R$ 35,93`, `R$ 44,14`.
- Faixa realista: de `R$ 0,00` (valor ausente cai em zero, não em vazio) até seis dígitos,
  `R$ 123.456,78`. Um preço de seis dígitos ocupa **147px** a 36px de corpo — foi medido, não estimado.
- Fora da faixa realista existe o caso patológico que o motor aceita: um custo de 15 dígitos multiplicado
  por um markup de 9 dígitos, ordem de 10^24. Nenhum tamanho de fonte resolve isso, porque o corpo fluido
  responde à **largura da tela**, não ao **comprimento do número**.
- Rótulo e legenda são ambos opcionais; a legenda é hoje o único lugar onde cabe procedência
  ("markup 50%", "Varejo · markup 50%"). O prefixo "R$" é configurável mas nunca foi trocado.

## Estados obrigatórios

Desenhe cada um com o número de verdade dentro, não com "R$ 0,00" de enfeite:

1. **Repouso nominal** — `R$ 24,24`, nos cinco tons e nos três tamanhos.
2. **Zero** — `R$ 0,00`. É o primeiro paint da tela de cálculo, antes de qualquer entrada.
3. **Valor longo (cabe apertado)** — `R$ 123.456,78` em `md`, dentro de uma coluna de 210px.
4. **Valor que não cabe — quebra entre partes** — a linha pode dobrar **entre** "R$", inteiro e centavos,
   nunca **dentro** do inteiro. Mostre como fica: `R$ 18.130` quebrado como `18.13` / `0` já aconteceu
   neste produto, e "18.13" é **outro número** para quem lê. Desenhe o alinhamento das duas linhas.
5. **Valor que não cabe de jeito nenhum — rolagem interna** — último recurso: o número rola dentro da
   própria linha, com todos os dígitos legíveis. → **É aqui que o desenho tem trabalho real a fazer**:
   hoje nada avisa que existem dígitos fora da vista.
6. **Centralizado vs. alinhado à esquerda** — os dois convivem no produto (Calcular centraliza, a barra
   do kit não). Desenhe os dois; o centralizado **não pode** deixar o cartão crescer além da coluna.
7. **Par lado a lado** (>= 420px de faixa) e **par empilhado** (<= 390px) — a decisão é da grade, mas o
   readout precisa parecer intencional nas duas.
8. **Com aviso acima** — o alerta `info` de "atacado acima do varejo" imediatamente antes do par.
9. **Sem legenda** e **sem rótulo** — ambas as partes são opcionais e o cartão precisa continuar equilibrado.

Não há estado de carregamento, erro, offline ou desabilitado **dentro** deste readout: hoje quem decide isso
é a tela ao redor. Se o desenho achar que a procedência do número (ao vivo / último conhecido / congelado)
tem que aparecer no próprio cartão, proponha — mas veja a pergunta ao dono.

## Viewports

- **360px** — obrigatório, e não é exagero: é a largura em que cada defeito deste componente foi medido.
  A 360px, duas colunas deixavam 108px para um valor que precisa de 124px, e na barra do kit deixavam 89px,
  que não comportam "R$ 1.234,56" nem em texto corrido.
- **390px** — o mobile de referência do produto.
- **1280px** — o corte desktop do increment 018, onde o par de preços vive na ficha da direita e ganha
  largura sobrando; o risco aqui é o oposto, um número pequeno perdido num cartão largo demais.

## Regras que o desenho não pode quebrar

- **O número nunca é partido ao meio.** Quebrar o inteiro renderiza um valor diferente do calculado, e
  nenhuma verificação automática enxerga isso: um bloco quebrado ainda reporta que "coube".
- **Nenhum dígito pode ser escondido.** Cortar com reticências ou ocultar por transbordo é mentir sobre
  dinheiro. As saídas honestas são encolher, quebrar entre partes, ou rolar — nessa ordem.
- **O cartão jamais empurra a página.** A largura do cartão é a da coluna; o que sobra é resolvido por
  dentro. Meça o transbordo horizontal da página, não a "visibilidade" do elemento.
- **Nenhuma barra de rolagem clássica atravessando o cartão.** A entrelinha 1 fazia o conteúdo ficar 4px
  mais alto que a caixa, o navegador desenhava uma barra de 15px e ela empurrava o preço 7,5px do centro.
  A altura da linha precisa acomodar o número com folga.
- **Contraste medido contra o fundo real de cada tom** — o roxo com glow, o laranja de energia e o fundo
  invertido são três fundos diferentes; o valor e a legenda precisam passar nos três, em tema escuro e claro.
- **A legenda é texto de verdade, em elemento de largura cheia** — nunca uma frase honesta espremida onde
  ela possa ser cortada.

## Armadilhas já pagas neste projeto

- Centralizar por alinhamento de itens (em vez de alinhamento de texto) fez o bloco do número crescer até
  a largura natural dele e abrir a página inteira. O cartão precisa continuar esticado na coluna.
- Grade de duas colunas fixas em toda largura: o número foi o que cedeu, quebrando no meio, para a página
  não transbordar. O piso de coluna precisa ser derivado do número, não escolhido.
- Rótulo longo estourando o orçamento de largura da barra do kit ("Preço atacado" = 111px em ~101px) —
  duas grafias diferentes para o mesmo conceito nasceram desse aperto.
- Valores de exemplo curtos escondem tudo: o protótipo original testava R$ 3,00 e R$ 20,65 e por isso
  nenhum desses defeitos apareceu no desenho. **Use valores adversariais em toda prancheta.**

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (primeira classe, não uma variação tardia)**:

1. **Anatomia** do readout com as cinco partes nomeadas e as proporções (moeda 0,4em elevada, centavos
   0,5em), no tamanho `default`.
2. **Matriz tom × tamanho**: 5 tons × 3 tamanhos, valor `R$ 24,24`.
3. **A escada do transbordo**: o mesmo cartão de 210px com `R$ 24,24` → `R$ 1.234,56` → `R$ 123.456,78` →
   um valor absurdo de 20+ dígitos, mostrando encolher → quebrar entre partes → rolar, e **como o usuário
   percebe** que está rolando.
4. **Par de preços em contexto**, a 360px, 390px e 1280px, com o alerta `info` acima.
5. **Barra fixada do kit** com os dois readouts e a linha "{n} peça(s) fora do total…".

Reutilize os primitivos existentes, sem criar novos: `tf-price` (com `tf-price__label`, `__cur`, `__int`,
`__dec`, `__cap`) para o readout, `tf-card` para a caixa da barra do kit, `tf-alert` de tom `info` para o
aviso de atacado acima do varejo. Se algo faltar, diga que falta em vez de inventar um primitivo novo.

## Perguntas em aberto para o dono

1. Quando o valor rola por dentro (último recurso), deve existir um sinal visível de que há dígitos fora
   da vista — degradê na borda, seta, o cartão inteiro mudando de aparência — ou o produto prefere que
   esse caso simplesmente nunca chegue à tela na faixa realista?
2. Na barra fixada do kit, Varejo e Atacado devem repetir os tons de Calcular (roxo/laranja), ou os dois
   ficam neutros ali? Hoje ambos herdam o roxo com glow por acidente do valor padrão.
3. Existe um rótulo único para o par, ou "Varejo"/"Atacado" e "Preço varejo"/"Preço atacado" continuam
   sendo duas grafias legítimas conforme a largura disponível?
4. A procedência do número (calculado agora / último conhecido offline / congelado no histórico) deve
   caber na legenda do próprio PriceHero, ou continua sendo responsabilidade da tela ao redor?
5. Qual é o teto que o produto se compromete a mostrar **sem** encolher nem quebrar — seis dígitos
   (`R$ 123.456,78`) é suficiente, ou existe cliente que precifica acima disso?

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

- **Onde vive:** `shared/ui/number-field.tsx` — o campo numérico do produto: prefixo forte `R$` à esquerda quando `currency`, entrada alinhada à DIREITA com figuras tabulares (`tf-input--num`), sufixo de unidade à direita (`g`, `h`, `kWh`, `%`), teclado decimal no celular, e a moldura com piso de `min-width: 8rem`. Aparece em **9 pontos**: 7 no formulário de `/calcular` (`calculator-form.tsx`), 1 no cadastro de filamento/impressora (`catalog-controls.tsx`) e 1 na linha da peça do kit (`bom-line-card.tsx`) — mais os mesmos 7 reaparecendo dentro do editor de peça expandido dos Kits.
- **Como o vendedor chega:** É o campo mais tocado do produto: o vendedor entra em Calcular e digita gramas, horas, preço do filamento, tarifa de energia, markup. O comportamento que interessa acontece quando ele SAI do campo — toca no próximo, ou fora dele.
- **Vizinhança imediata:** Dentro de um `Field`, em grades de 2 colunas: rótulo (com reserva de duas linhas para os inputs ficarem alinhados entre colunas) e `InfoTip` na linha de cima, dica/aviso/erro na de baixo, o campo irmão à direita. O caso mais apertado do app é "Tarifa de energia", que carrega prefixo `R$` E sufixo `/kWh` ao mesmo tempo — grade que precisou refluir para não estourar o viewport de 360/390px.
- **Dados que chegam (e o que ela devolve):** Valor controlado como STRING pelo React Hook Form. Ao perder o foco, todo campo `currency` reescreve o que foi digitado com separador de milhar pt-BR ("12345,67" vira "12.345,67") e dispara o MESMO `onChange` do formulário — nunca durante a digitação (isso brigaria com o cursor). Valor em branco ou ilegível é deixado exatamente como foi digitado; quem explica é a validação do campo. O número parseado vai para o `pricing-core`, que calcula offline.
- **O que acontece depois:** O texto muda sozinho na frente do vendedor, o formulário recalcula e o `PriceHero` acima atualiza. Efeito colateral já registrado na memória do projeto: ao reabrir uma simulação salva por caminho programático, a máscara de milhar se perdia — o valor voltava cru.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# NumberField — o campo de dinheiro e o instante em que ele reescreve o próprio texto

## O que desenhar

O `NumberField` é o campo mais tocado do Precifica3D: é ele que recebe custo do rolo, tarifa de energia,
valor da máquina, valor da hora, taxa fixa do marketplace, frete, "outros custos" e a quantidade de cada
peça do kit. Ele vive dentro da calculadora (aba **Simulações**), dentro do editor de linha de kit e nas
fichas de catálogo — sempre embrulhado por um rótulo, uma dica e um espaço de erro. O que este prompt pede
não é só a aparência em repouso: é a **anatomia completa + a matriz de estados + a sequência temporal da
máscara de milhar**, isto é, os quadros de antes/depois do instante em que o vendedor sai do campo e o texto
que ele digitou é reescrito na frente dele.

## Por que este prompt existe

O comportamento nasceu no código, datado no próprio arquivo: *"016/PR-C homologação (B2) — todos os campos
currency ganham, consistência"*. Ninguém desenhou o momento. O canvas do dono cobre o componente **nominal**
e até o pior caso de afixos (prefixo `R$` **e** sufixo `/h` na mesma moldura, em "Reserva de manutenção"), e
a especificação §D.1 fala de vírgula decimal, `inputmode`, placeholder e figuras tabulares — **nunca de
separador de milhar nem de reescrita no blur**. Um desenho estático não mostra um instante, e o protótipo
clicável não exercita esse instante. Também foram decididos sem desenho: o piso `min-width: 8rem` da moldura
(defesa contra transbordo em grade de 2 colunas) e o alinhamento **à direita** com figuras tabulares.

## O que já existe hoje (não invente do zero — corrija)

Moldura única (`tf-inputwrap`, altura de controle) com, na ordem: prefixo opcional `R$` → input numérico
alinhado à direita → sufixo opcional. Fora dela, acima, a linha de rótulo (rótulo + `*` obrigatório ou a
etiqueta muda **"opcional"** à direita + o gatilho `?` do InfoTip como irmão do rótulo, nunca dentro dele);
abaixo, a dica **ou** o erro (o erro substitui a dica).

| Campo real | Prefixo | Sufixo | Placeholder | Exemplo verdadeiro |
|---|---|---|---|---|
| "Custo do rolo" (obrigatório) | `R$` | — | `0,00` | `100,00` |
| "Valor da máquina" (obrigatório) | `R$` | — | `0,00` | `4.000,00` (semente já agrupada) |
| "Tarifa de energia" (obrigatório) | `R$` | `/kWh` | `0,00` | `1,00` |
| "Reserva de manutenção" (opcional) | `R$` | `/h` | `0,00` | `1,11` |
| "Valor da hora" / "Valor do acabamento" (opcional) | `R$` | `/h` | `0,00` | `18,75` |
| "Taxa fixa" · "Comissão mínima/item" · "Frete" (canal) | `R$` | — | `0,00` | `4,00` |
| "Comissão" (canal) | — | `%` | `0,00` | `12` |
| "Peso do rolo" · "Gramas usadas" · "Consumo médio" | — | `kg` · `g` · `kW` | `0,00` | `1` · `100` · `0,12` |
| Quantidade da linha de kit (tamanho `sm`) | — | unidade | `1` | `2` |

→ **Problema a resolver:** o rótulo reserva **duas linhas** de altura sempre, só para que "Reserva de
manutenção" (que quebra) não desalinhe a moldura vizinha numa grade de 2 colunas. Desenhe uma solução que
alinhe as molduras sem pagar esse buraco branco em todo campo de rótulo curto.
→ **Problema a resolver:** "Tarifa de energia" com `R$` **e** `/kWh` já espremeu o input até ~1px de largura
visível a 390px. A grade hoje reflui para 1 coluna nesse caso; o desenho precisa dizer **quando** reflui.

## Conteúdo e dados reais

Tudo em pt-BR: vírgula decimal, ponto de milhar, dinheiro como `R$ 1.234,56`. O valor é uma **string**
digitável — a leitura aceita `12345,67`, `12.345,67`, `1500` e `0,12` como o mesmo número, e recusa
`1,234,56`, `5x3`, `10-5`. O teclado móvel abre no modo decimal. Dicas literais que já existem: "Consumo
médio real da impressora, não a potência de placa (~0,12 kW).", "Margem sobre o custo total (não sobre o
preço de venda).", "Descontado do valor recebido (não é embutido no anúncio).", "Embalagem, etiqueta, taxas,
etc. Cada item soma ao custo total.". Erros literais: **"Informe um número válido."**, **"Não pode ser
negativo."**, **"Campo obrigatório."**, **"O peso do rolo deve ser maior que zero."**, **"A comissão deve ser
menor que 100%."**, **"Valor muito alto."**.

## Estados obrigatórios

- **Repouso** — borda neutra, valor à direita em figuras tabulares, afixos em tom apagado (o `R$` um pouco
  mais forte que o sufixo, como é hoje).
- **Vazio** — só o placeholder `0,00` no tom mais fraco; os afixos continuam visíveis.
- **Hover** — borda um passo mais forte, cursor de texto em toda a moldura (a moldura inteira é clicável).
- **Foco** — borda **e** anel na mesma cor, lidos como **um traço só**: um anel de cor diferente da borda já
  apareceu como contorno duplo neste produto, é defeito conhecido.
- **Erro** — borda vermelha que **permanece vermelha mesmo em foco** (com o halo tingido de vermelho), e a
  mensagem literal abaixo, substituindo a dica.
- **Aviso de plausibilidade** (número aceito, provavelmente com outro significado) — tom **informativo**,
  nunca vermelho, dentro do espaço da dica, abaixo dela: *"Confira a reserva de manutenção: R$ 3.600,00 por
  HORA. Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Nada foi recusado."*
  Se houver erro, o aviso some — o produto não avisa sobre a plausibilidade de um número que recusou.
- **Desabilitado** — fundo abafado, opacidade reduzida, cursor bloqueado; afixos junto.
- **Tamanhos** — `sm` (linha de kit), `md` (padrão), `lg`.
- **A sequência da máscara** (o coração deste prompt), em quatro quadros lado a lado com legenda:
  1. foco, digitando: `12345,67` — **sem** ponto de milhar, cursor visível (a máscara nunca roda durante a
     digitação: brigaria com o cursor);
  2. saída do campo: o texto vira `12.345,67`, silenciosamente, sem toast e sem badge;
  3. saída com texto ilegível (`12,34,56`): o texto fica **exatamente como foi digitado** e quem explica é o
     erro "Informe um número válido." — nunca uma reescrita silenciosa;
  4. saída com o campo em branco: nada acontece, o placeholder volta.

## Viewports

- **390px (mobile)** — obrigatório: é onde o vendedor precifica de fato, e é onde a moldura com prefixo +
  sufixo já quebrou. Inclua na mesma prancheta a grade de 2 colunas ("Tarifa de energia" ao lado de "Consumo
  médio") e mostre o ponto em que ela reflui para 1 coluna.
- **1280px (desktop)** — obrigatório: o redesenho 018 coloca esses campos dentro de uma ficha lateral direita
  de ~560px, que é mais estreita que a página; a grade de 2 colunas ali é o caso real, não o de 1920.
- 1920px é dispensável: o comportamento não muda e o canvas do dono já cobre a moldura larga.

## Regras que o desenho não pode quebrar

- A máscara **nunca** altera o significado do número, só a grafia — e nunca "conserta" um valor que o produto
  não entendeu.
- Nada de vermelho para o aviso de plausibilidade: quem lê um aviso escrito como erro conclui que o produto
  recusou, e o produto não recusou. Toda frase de aviso termina em "Nada foi recusado."
- Frase honesta nunca mora em placeholder: o placeholder carrega **só números** (`0,00`, `1`); explicação vai
  na dica ou no erro, que são de largura cheia e não cortam.
- Alvo tocável ≥ 44px de altura na moldura `md`; os afixos não roubam área de toque do input.
- Contraste medido do afixo e do placeholder **contra o fundo real do card**, nos dois temas — o placeholder
  é o texto mais fraco da tela e é o primeiro a falhar.
- O erro é anunciado por leitor de tela; o desenho precisa reservar o espaço dele sem fazer a página pular.

## Armadilhas já pagas neste projeto

- Um valor de 4+ dígitos **sem** máscara aparecendo até o primeiro toque (`R$ 4000,00` na semente) foi
  achado de homologação; hoje a semente já nasce agrupada. Desenhe assumindo que valores grandes existem
  desde o primeiro paint.
- Máscara perdida ao **reabrir uma simulação salva** — o valor voltava cru enquanto o mesmo campo mascarava
  corretamente num blur normal. O desenho deve mostrar o campo restaurado idêntico ao campo pós-blur.
- Transbordo horizontal medido: o piso de largura da moldura evita que ela encolha atrás do conteúdo, mas
  **não** salva o pior caso prefixo+sufixo — esse exige refluxo.
- Texto ocluso passa em teste automatizado: o valor `1.234.567,89` dentro da coluna estreita precisa ser
  desenhado, não presumido.
- Um `?` de ajuda na **mesma linha** do input disputa espaço com o sufixo `/kWh` e come o campo; o gatilho
  fica na linha do rótulo.

## Entregável

Quatro pranchetas, cada uma em **tema escuro (padrão) e claro (first-class)**: (1) **Anatomia** — moldura com
prefixo, sufixo, prefixo+sufixo juntos, e os três tamanhos `sm`/`md`/`lg`; (2) **Matriz de estados** — repouso,
vazio, hover, foco, erro, erro+foco, aviso, desabilitado, com o rótulo obrigatório (`*`) e o opcional
("opcional") lado a lado; (3) **A fita da máscara** — os quatro quadros descritos acima, com legenda curta sob
cada um; (4) **Contexto real** — a grade de "Custos da peça" a 390px e dentro da ficha de 560px a 1280px, com
"Custo do rolo", "Tarifa de energia" e "Reserva de manutenção" preenchidos com números verdadeiros. Reutilize
os primitivos existentes em vez de criar novos: `tf-inputwrap` (moldura, com as variantes `--sm`/`--lg`/
`--error`/`--disabled`), `tf-input--num` (o campo alinhado à direita com figuras tabulares),
`tf-inputwrap__affix` e `tf-inputwrap__affix--strong` (sufixo e prefixo `R$`), `tf-field__label-row`,
`tf-field__req`, `tf-field__optional`, `tf-field__hint`, `tf-field__error`, `tf-field__aviso` (o tom
informativo) e o `InfoTip` já existente para o `?`.

## Perguntas em aberto para o dono

1. A máscara de milhar vale **só** para campos de dinheiro (é o que o código faz hoje) ou também para os
   numéricos grandes sem `R$` — "Vida útil da máquina" com `3600` h e "Gramas usadas"? Hoje eles ficam sem
   ponto, e a mesma tela mostra `4.000,00` ao lado de `3600`.
2. Ao voltar o foco a um campo já mascarado, o texto deve **desagrupar** (`12345,67`, mais fácil de editar
   com o cursor) ou permanecer `12.345,67`? Hoje permanece, e ninguém decidiu isso.
3. A reescrita deve ficar totalmente silenciosa (como hoje) ou merece uma microtransição de ~150ms que dê ao
   vendedor o sinal de que **o produto** mudou o texto e não ele?

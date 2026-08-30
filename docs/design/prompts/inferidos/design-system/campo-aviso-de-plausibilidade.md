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

- **Onde vive:** `shared/ui/field.tsx` + `.tf-field__aviso` em `field.css` — uma linha extra DENTRO do bloco de dica, `margin-top --space-1`, pintada com `--info-text` e com `overflow-wrap: anywhere`. Nasce em `calculator-form.tsx:186` (`ControlledField`), portanto em **todos** os campos numéricos de `/calcular` e, de graça, nos mesmos campos aninhados dentro do editor de peça do compositor de kits (`widgets/bom-line-editor`, que renderiza os mesmos `CalcFieldMeta`). Há um irmão de segundo nível: o aviso sobre o RESULTADO, que sai como `<Alert tone="info">` logo abaixo dos preços (`AvisoDeResultado`, `calculator-form.tsx:128`).
- **Como o vendedor chega:** Sem gesto: o vendedor digita um número esquisito — 5000 gramas, R$ 0,02 de energia — e a linha azul aparece embaixo do campo enquanto ele ainda está ali. O valor NÃO foi recusado.
- **Vizinhança imediata:** O mesmo lugar exato ocupado por três mensagens diferentes, uma de cada vez: a **dica** cinza (`--text-muted`, `--fs-caption`), o **aviso** azul logo abaixo dela quando ambos existem, e o **erro** vermelho (`--danger-text`, `role="alert"`), que SUBSTITUI dica e aviso. Acima está o `tf-inputwrap` (que fica com a borda vermelha e um halo avermelhado quando há erro); acima dele, a linha do rótulo com o `InfoTip ⓘ` à direita; abaixo, o próximo campo da grade de 2 colunas.
- **Dados que chegam (e o que ela devolve):** O aviso é derivado no próprio campo, a partir do valor digitado (`avisoDeCampo(meta.name, value)`, em `shared/lib/plausibilidade.ts`) — nenhuma prop atravessa a árvore. Entra como HINT, nunca como `error`, de propósito: campo genuinamente inválido continua mostrando a recusa e o aviso some, porque avisar sobre a plausibilidade de um número que o produto nem aceitou seria ruído. A regra está escrita no código: "AVISO NUNCA VIRA VALIDAÇÃO".
- **O que acontece depois:** Nada é bloqueado: o vendedor pode calcular assim mesmo, e o preço absurdo sai. O aviso é a única coisa entre ele e esse preço — a um passo de ser lido como erro (e parecer que recusou) ou de sumir no meio da dica (e não avisar).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Campo — a terceira camada de mensagem (o aviso de plausibilidade)

## O que desenhar

A faixa de mensagem que fica **abaixo do controle** de um campo do Precifica3D e que hoje carrega três coisas
diferentes no mesmo lugar: a **dica** (texto neutro, sempre presente), o **aviso de plausibilidade** (o número
é estranho, mas foi aceito e o preço continua sendo calculado) e o **erro** (o número foi recusado). Ela vive
na calculadora de preço — a tela onde o vendedor digita custo do rolo, gramas, tempo de impressão, consumo,
tarifa, vida útil da máquina — e também no editor de linha de kit e no bloco de canal do marketplace. Quem a
usa é um vendedor leigo, no exato segundo em que ele digitou um número plausível que significa outra coisa
(120 W escritos num campo que pede kW; 3 anos escritos num campo que pede horas). Desenhar isto é desenhar a
**hierarquia entre três tons no mesmo slot** — um azul que não recusa, um vermelho que recusa, e um cinza que
só explica.

## Por que este prompt existe

O contrato desenhado do Field tem **duas** camadas: `hint` e `error`, com o erro SUBSTITUINDO o hint (§D.1); o
§E4 desenhou apenas o erro do peso do rolo. O código inventou uma terceira, `.tf-field__aviso`, datada no
próprio CSS como "Homologação automatizada (2026-08-13)": uma linha extra empurrada para dentro do hint e
pintada com `--info-text`. Nenhuma autoridade de desenho trata de **níveis de mensagem** — o canvas do dono usa
`tf-field` sem hint, sem erro e sem aviso. Ou seja: a única coisa entre o vendedor e um preço absurdo é uma
linha azul que ninguém desenhou, a um passo de ser lida como erro (e recusar) ou de sumir (e não avisar).
Correção de rota registrada: o módulo é `shared/lib/plausibilidade.ts`; o comentário do `field.css` ainda
aponta para `features/calculator/plausibilidade.ts`, que **não existe**.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual do campo, de cima para baixo:

| Parte | Como está hoje | Observação |
| --- | --- | --- |
| Linha do rótulo | rótulo + `*` obrigatório (cor `--energy`) + ⓘ irmão do rótulo + etiqueta "opcional" empurrada à direita | reserva **duas linhas** de altura para alinhar grades de 2 colunas |
| Controle | `tf-inputwrap` com prefixo `R$` e/ou sufixo de unidade (`kW`, `h`, `g`, `/kWh`) | borda vermelha quando há erro |
| Camada 1 — dica | caption em `--text-muted` | ex.: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." |
| Camada 2 — aviso | caption em `--info-text`, empilhada logo abaixo da dica, `margin-top` de 1 passo | **sem ícone, sem fundo, sem borda: só cor** → problema |
| Camada 3 — erro | caption em `--danger-text`, peso médio, `role="alert"` | **substitui a dica E o aviso** |

→ O aviso só se distingue da dica pela **cor**. Quem não percebe matiz não percebe que há aviso.
→ O aviso **não muda nada no controle**: a borda do input continua idêntica à do repouso. Nada puxa o olho de
volta para o campo que causou o aviso.
→ O CSS do aviso carrega `overflow-wrap: anywhere` — sintoma de que alguém já teve medo do estouro horizontal.
→ A mesma classe é reusada **fora** do Field, na linha de kit, num parágrafo `text-sm` (maior que o caption do
Field): a mesma peça aparece em dois tamanhos.
→ O aviso do RESULTADO (preço zero / custo absurdo) usa uma peça completamente diferente: um `tf-alert--info`
com ícone e fundo. Dois pesos visuais para a mesma família de mensagem, sem hierarquia declarada.

## Conteúdo e dados reais

Os textos são literais e já homologados — **não reescreva**. Todos terminam com "Nada foi recusado.":

- Consumo médio (kW, obrigatório, faixa real ~0,05–0,25 kW, limiar 5): *"Confira o consumo: 120 kW. Acima de
  5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts:
  120 W são 0,12 kW. Nada foi recusado."*
- Vida útil da máquina (h, obrigatório, limiar mínimo 100 h): *"Confira a vida útil: 3 horas é menos de uma
  semana ligada. Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos =
  3.600 h. Nada foi recusado."*
- Tempo de impressão (h + min, obrigatório, limiar 100 h): *"Confira o tempo: 150 horas equivalem a 6,3 dias
  imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado."*
- Peso do rolo (kg, limiar 50): *"Confira o peso do rolo: 1.000 kg. O rolo comum tem 1 kg — se você informou
  gramas, 1.000 g são 1 kg. Nada foi recusado."*
- Comissão do canal (%, opcional, limiar mínimo 1%): *"Confira a comissão: 0,12%. Marketplaces costumam cobrar
  entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."*
- Quantidade da peça de kit (limiar 2.147.483.647): *"Confira a quantidade: 5.000.000.000. O máximo por peça é
  2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."*
- Resultado, sem campo culpado: *"O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não
  dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado."* e *"Confira os custos:
  R$ 6.000.061,60 para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais
  em algum campo. Nada foi recusado."*

**Medida que decide o desenho:** a frase mais longa tem ~230 caracteres. Em caption, dentro de uma coluna de
grade de 2 colunas a 390px, isso ocupa de 6 a 8 linhas empurrando o campo seguinte para baixo. É o caso normal,
não o extremo.

→ Dentro das frases o dinheiro sai **sem centavos** ("R$ 3.000", "R$ 0,1234"), enquanto o resto do produto
escreve `R$ 1.234,56` — decisão do dono (ver perguntas).

## Estados obrigatórios

1. **Repouso, só dica** — caption cinza, uma linha. É o estado da imensa maioria dos campos.
2. **Repouso, sem dica e sem aviso** — nada abaixo do controle; o espaço não fica reservado.
3. **Aviso ativo, com dica** — dica cinza na primeira linha, aviso azul empilhado abaixo. Desenhe com a frase
   longa de verdade (o consumo), não com um lorem curto.
4. **Aviso ativo, sem dica** — o aviso é a única linha (é o caso do tempo de impressão e da comissão).
5. **Erro** — o vermelho substitui dica **e** aviso; a borda do controle fica vermelha inclusive com foco.
6. **Erro + valor implausível ao mesmo tempo** — o desenho precisa mostrar quem vence (hoje: o erro; o aviso
   desaparece por completo).
7. **Foco** — anel roxo no controle; mostre como a mensagem de três camadas convive com o anel.
8. **Hover** (borda mais forte) e **digitando** — o aviso aparece e some **a cada tecla**, porque nasce do
   valor cru do campo; desenhe a transição, um flash abrupto é ruído.
9. **Desabilitado** — controle esmaecido; a dica permanece.
10. **Aviso de resultado** — o bloco `tf-alert--info` abaixo do preço, com uma ou **duas** frases concatenadas
    na mesma caixa (é o que o código faz).
11. **Campo obrigatório vs. opcional** — o `*` e a etiqueta "opcional" na mesma linha do rótulo, com o aviso
    aceso, para provar que a densidade continua legível.

## Viewports

- **Mobile 390px** — obrigatório e prioritário: é onde a frase longa colide com a grade de 2 colunas dos custos
  da peça. Desenhe um par de campos lado a lado com o da esquerda em aviso.
- **Desktop 1280px** — é o corte do redesenho das abas; o mesmo campo aparece na ficha lateral e no formulário
  de custos. Mostre a frase cabendo em 2–3 linhas. 1920px é dispensável: acima de 1280 nada muda no campo.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O número foi aceito, o preço continua sendo calculado e o formulário continua
  podendo ser salvo. Nada no desenho — nem cor, nem ícone, nem borda — pode dizer "recusado".
- **Vermelho é exclusivo da recusa.** Um aviso pintado de vermelho diria o contrário do que a frase está
  escrita para dizer.
- O erro tem prioridade absoluta e é anunciado por assistiva; o aviso é visual e precisa ser perceptível
  **sem** foco, porque ele fala do valor que já está lá.
- **Cor não pode ser o único sinal** (o único diferencial atual entre dica e aviso é matiz), e o contraste do
  azul precisa ser medido contra o fundo real do formulário nos dois temas.
- A frase honesta nunca mora em placeholder nem em elemento truncado: ela quebra em quantas linhas precisar,
  em elemento de largura total da coluna.
- Alvo de toque do controle ≥44px; o aviso é texto, não alvo — não transforme em botão nem em "ver mais" que
  esconda a frase.
- O aviso não pode empurrar o preço para fora da tela nem desalinhar os inputs da grade de 2 colunas.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não olhado.** O `overflow-wrap: anywhere` já está no CSS porque a frase longa
  ameaça a coluna; qualquer desenho precisa mostrar a frase inteira dentro da largura, sem reticências.
- **Um aviso que existia e nunca aparecia.** O limiar, a frase e o teste unitário do "vida útil da máquina"
  estavam verdes e nenhuma tela renderizava o aviso — o vendedor levava o custo/hora de R$ 1,11 para
  R$ 1.333,33, calado. Desenhe o estado aceso de cada campo listado, um por um, para que a falta seja visível.
- **Texto que passa em teste e some na tela.** Assertivas de texto não enxergam ocultação nem colisão.
- **Empurrão de layout.** A reserva de duas linhas no rótulo existe para manter os inputs alinhados; o aviso,
  que aparece e some ao digitar, é o novo candidato a desalinhar a grade.

## Entregável

Pranchetas, tema **escuro** primeiro e **claro** como par de primeira classe de cada uma:

1. **Anatomia das três camadas** — o mesmo campo ("Consumo médio", `R$`/`kW`, valor 120) em quatro variações
   empilhadas: só dica · dica + aviso · só aviso · erro. Com legenda nomeando cada camada.
2. **Matriz de estados** — repouso, hover, foco, digitando com aviso aceso, erro, erro+implausível,
   desabilitado.
3. **Contexto real 390px** — a grade de 2 colunas dos custos da peça com um campo em aviso e o vizinho em
   repouso, provando o alinhamento dos inputs.
4. **Contexto real 1280px** — o mesmo formulário na largura do desktop.
5. **Hierarquia campo × resultado** — o aviso de campo e o bloco de aviso do resultado na mesma prancheta,
   mostrando que são a mesma família em dois pesos.

Reutilize os primitivos existentes, sem criar novos: `tf-field` (rótulo, `*`, "opcional", dica, erro),
`tf-inputwrap` com afixos de moeda/unidade, `tf-field__aviso` como a camada nova a ser desenhada de verdade, e
`tf-alert` no tom `info` para o aviso de resultado. Um eventual ícone deve sair do conjunto já usado no produto.

## Perguntas em aberto para o dono

1. O aviso de campo ganha **ícone** (ou algum sinal que não seja cor), sabendo que qualquer glifo de alerta
   corre o risco de ser lido como recusa?
2. Quando há erro E valor implausível no mesmo campo, o aviso deve mesmo **sumir** (comportamento atual) ou
   aparecer abaixo do erro?
3. O **controle** deve sinalizar de alguma forma que há um aviso (uma borda ou um afixo em tom `info`), ou o
   sinal continua exclusivamente na linha de texto abaixo?
4. O dinheiro dentro das frases sai sem centavos ("R$ 3.000", "R$ 0,1234"). Padroniza em `R$ 1.234,56`?
5. "Nada foi recusado." repete no fim de **todas** as frases. Vira um elemento fixo da peça (uma etiqueta ou
   um sufixo visual constante) ou continua como parte do texto de cada mensagem?
6. Na linha de kit o aviso aparece maior (`text-sm`) e fora de um campo. É a mesma peça em dois tamanhos, ou
   ele deve ser normalizado no tamanho caption do Field?

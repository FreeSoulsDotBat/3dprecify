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

## O mapa funcional de Shell, navegação e telas transversais

### O que é esta área

A "moldura": tudo que emoldura as cinco abas e as telas que não são aba nenhuma. Ela não calcula preço,
não guarda catálogo e não vende Premium — ela decide **onde o vendedor está**, **como ele sai daqui** e
**o que o app avisa quando algo está errado** (offline, sessão expirada, rota inexistente, erro global).

### Como o vendedor chega

Abre o PWA (ícone na tela inicial ou URL). O `main.tsx` segura a tela num texto solto "Carregando…"
(um `<p>` cru, **fora do shell**) até o Firebase resolver a sessão; só então o roteador monta. `/` é
redirecionada para `/calcular`. Não existe splash, não existe onboarding e **não existe porta de entrada
no chrome**: o app abre direto na calculadora, logado ou não.

### Rotas (todas filhas da mesma raiz, cujo `component` é o `AppShell`)

- `/calcular` — pública, sempre grátis, funciona offline.
- `/catalogo` — pública (mostra o teaser honesto); vira guardada quando traz `?produto=<id>`.
- `/kits` — pública; `?id=` reabre um kit salvo, `&copy=1` duplica.
- `/historico` — rotulada **"Orçamentos"** no menu; pública; guardada quando traz `?snapshot=<id>`.
- `/conta` — **única rota com guarda incondicional** (`requireAuth`); `?checkout=retorno` e `?assinar=1`.
- `/sign-in` — a tela Entrar, com `?redirect=<href interno>`; se já autenticado, rebate para o destino.
- `/privacidade` — "Como tratamos seus dados", pública, alcançável deslogada.
- 404 (`notFoundComponent`) e Erro (`errorComponent`) são declarados na **raiz** — logo renderizam
  **dentro** do shell, com menu e barra superior de pé em volta.
- `/catalogo/produtos/*` e `/historico/$id` só existem como redirecionadores (rotas de 2 segmentos
  quebram no carregamento a frio; a armadilha conhecida é a **página em branco**, sem 404 e sem erro).

### O que a moldura monta, nesta ordem

`.tf-shell` → faixa de offline → faixa de sessão expirada → **(mobile ≤425px)** barra superior de 56px +
`<main>`; **(desktop >425px)** `.tf-shell__body` com a **barra lateral** à esquerda (240px, ou 76px
recolhida, grudada no topo com altura de janela) e, à direita, barra superior + `<main>`. No mobile ainda
entra a **barra de abas fixa no rodapé** (64px, 5 células iguais). Por último, invisíveis: o diálogo de
saída com fila e o sincronizador do outbox. A **região de toasts** é montada por fora, nos providers.

### Larguras (as quatro faixas reais)

≤425px barra de abas · 426–599px barra lateral **recolhida à força** em 76px, **sem botão de expandir** ·
600–1279px barra lateral de 240px com a coluna de conteúdo ainda limitada (460px até 1024px, 1120px
depois) · ≥1280px o corte do 018: botão Recolher/Expandir no rodapé do menu e conteúdo até 1720px.

### Do que ela depende e o que guarda

Guarda pouquíssimo e nada de dinheiro: preferência de tema (aparelho), preferência de rail (aparelho, só
vale ≥1280px), e um bit "a sessão expirou" ligado pelo transporte HTTP num 401 de sessão. Depende da
**sessão Firebase** (`loading` · `anonymous` · `authenticated` · `not-configured`), do **entitlement do
servidor** (que ela não lê — quem lê são as páginas), e do **outbox uid-keyed** (fila de escrita offline)
para decidir se sair destrói trabalho. Ao sair ou trocar de conta, ela varre todos os caches por uid —
**menos o outbox**, que é a única cópia de um orçamento que nunca chegou à conta.

### O que muda por estado

- **Deslogado**: o cluster de identidade some inteiro (nada de e-mail, nada de "Sair") — sobra logo +
  tema. Nenhum item do menu é marcado como bloqueado; a fronteira do freemium só aparece quando se toca
  em "Conta" e o app rebate para `/sign-in`.
- **Grátis (logado)**: chrome idêntico ao Premium; a diferença vive dentro das abas (teasers).
- **Premium / Premium pausado**: a moldura **não muda** — plano é assunto da aba Conta.
- **Offline**: faixa ciano no topo ("o cálculo continua funcionando"), o menu continua navegando, e o
  diálogo de saída desabilita "Sincronizar agora" com uma legenda explicando por quê.
- **Sessão expirada**: faixa grudada no topo com "Entrar de novo" levando a `/sign-in` com o endereço
  atual preservado — nada é apagado e o vendedor continua podendo editar embaixo dela.

## O ponto exato de inserção desta peça

- **Onde vive:** Último bloco visual do shell no mobile (≤425px): `<AppNav variant="tabbar">`, `position: fixed`, colada em `bottom: 0`, atravessando a largura toda, `z-index: 30`, com `padding-bottom` de área segura. Altura de 64px (`--tabbar-h`), fundo de cartão e uma linha de 1px no topo. Cinco células em `flex: 1 1 0` idênticas — ~72px cada em 360px — na ordem fixa Calcular · Catálogo · Kits · Orçamentos · Conta, cada uma com ícone de 22px acima do rótulo em tamanho de legenda, sem quebra de linha.
- **Como o vendedor chega:** O vendedor está o dia inteiro aqui: é o único jeito de trocar de seção no telefone. Chega no meio de qualquer coisa — com um cálculo pela metade, com o teclado numérico aberto, com um orçamento ainda na fila.
- **Vizinhança imediata:** Acima dela, o `<main>`, que reserva 64px + folga de padding para não passar por baixo. Elementos fixados pelas páginas (como a barra de total do kit) param acima dela por `--pinned-bottom`. Os **toasts** aparecem centrados logo acima da barra, e nunca sobre ela. Abaixo, nada — é o piso da tela. O item ativo é marcado por texto/ícone roxos mais uma pílula de 28×3px colada no topo da própria célula.
- **Dados que chegam (e o que ela devolve):** Só a rota atual (`useRouterState`) para decidir o item ativo, e os rótulos do arquivo pt-BR (`nav.*`). Devolve navegação: cada item é um link de verdade, com `aria-current="page"` no ativo e um único ponto de tabulação percorrendo os cinco por setas.
- **O que acontece depois:** Tocar troca a rota sem recarregar; o conteúdo do `<main>` é substituído e o título da nova seção recebe o foco. A barra em si não se move nem se esconde ao rolar. Acima de 425px ela deixa de existir e é substituída pela coluna lateral.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Barra de abas inferior do mobile — as 5 seções

## O que desenhar
A barra fixa no rodapé do app no celular: cinco seções (Calcular · Catálogo · Kits · Orçamentos · Conta)
que são a navegação principal do produto inteiro. Ela está presente em TODAS as telas do mobile, sobre o
conteúdo, e é o elemento que o vendedor toca dezenas de vezes por dia — é por ela que ele sai de um
orçamento e vai ver o catálogo de filamentos, e volta. Vive colada no fundo da janela (`position: fixed`),
respeitando a área segura do iPhone; o conteúdo da página reserva altura embaixo para nunca ficar
escondido atrás dela. Existe SÓ no mobile: acima de 425px de largura o app troca para um menu lateral, que
já tem desenho próprio no canvas do 018.

## Por que este prompt existe
O único desenho que existe dessa barra (protótipo de 2026-07-02, §D.2 e §E3) fixa **quatro** seções —
"Calcular · Catálogo · Histórico · Conta", altura 64px, ícone 24 + rótulo caption, alvo ≥44px, e o ativo
marcado **por COR (roxo `--accent`)**. O produto de hoje tem **cinco** células (Kits entrou em 008/K1, uma
mudança de IA aprovada pelo dono depois do protótipo) e o rótulo "Histórico" virou **"Orçamentos"**
(016/US2) — um rótulo 43% mais longo, na barra que ficou 25% mais cheia. Ninguém desenhou o resultado.
Além disso o código **contraria o protótipo em dois pontos**: o ativo ganhou uma pílula roxa de 28×3px
colada no topo da célula (o desenho pedia cor, não pílula) e o ícone encolheu para 22px sem que nada
autorizasse. E não existe nenhuma regra sobre o que acontece quando cinco rótulos com `white-space: nowrap`
não couberem — em 360px cada célula tem ~72px.

## O que já existe hoje (não invente do zero — corrija)
Barra `.tf-nav--tabbar`: fixa no rodapé, fundo `--surface-card`, borda superior 1px `--border-subtle`,
altura `--tabbar-h` = **64px**, mais `env(safe-area-inset-bottom)` embaixo. A lista é flex e cada célula é
`flex: 1 1 0` — **larguras rigorosamente iguais**, independentemente do tamanho do rótulo.

| Ordem | Rótulo literal (pt-BR) | Ícone (22px) | Rota |
|---|---|---|---|
| 1 | "Calcular" | calculadora | `/calcular` |
| 2 | "Catálogo" | caixa/pacote | `/catalogo` |
| 3 | "Kits" | caixas empilhadas | `/kits` |
| 4 | "Orçamentos" | histórico (relógio com seta) | `/historico` |
| 5 | "Conta" | pessoa em círculo | `/conta` |

- O landmark se anuncia como "Navegação principal"; o item ativo é anunciado como página atual.
- Dentro da célula: ícone em cima, rótulo embaixo, `gap: 2px`, padding `--space-1`, rótulo em
  `--fs-caption` (12px) com **`white-space: nowrap`**.
- Ativo = cor `--accent-text` + peso semibold + **pílula 28×3px `--accent`, raio pill, no topo da célula**.
- Foco de teclado = fundo `--accent-soft` + **anel INTERNO** (`inset`, `--focus-ring`), nunca a caixa de
  contorno externa — e o anel interno existe justamente porque, no item que JÁ está ativo, um fundo suave
  sozinho não mudava nada ao receber foco (reprovava WCAG 2.4.7). Essa distinção precisa sobreviver ao
  desenho.
- → **Problema 1:** em 360px sobram ~72px por célula e "Orçamentos" em 12px pede ~76–80px. Com `nowrap` e
  sem nenhuma regra de truncar/abreviar/reduzir, o rótulo mais importante da barra é o que corre risco de
  encostar no vizinho ou vazar da célula. É a decisão central deste desenho.
- → **Problema 2:** não existe estado de **pressionado** nem de **hover** no tabbar (o CSS só define hover
  no botão de recolher, que é do desktop). No celular, o toque não tem retorno visual nenhum.
- → **Problema 3:** a pílula superior e o ícone de 22px contrariam a única autoridade de desenho existente
  (cor + 24px). Decida conscientemente, não por inércia.

## Conteúdo e dados reais
- Os cinco rótulos são **texto homologado**: "Calcular", "Catálogo", "Kits", "Orçamentos", "Conta". Não
  reescreva nem traduza. "Orçamentos" substituiu "Histórico" de propósito, porque o par
  Histórico/Cenários não comunicava a diferença entre preço congelado e preço recalculado hoje.
- A barra não exibe número nenhum: sem contadores, sem valores, sem badges hoje.
- Nenhuma seção é bloqueada pela barra. Kits e Orçamentos são áreas Premium, mas o usuário gratuito
  **navega** até elas e encontra lá dentro o convite honesto — a barra nunca desabilita, nunca põe
  cadeado, nunca esconde uma aba.
- Tamanho mínimo de alvo: 44×44px (`--touch-min`), medido por célula.
- Vizinhos que disputam o mesmo rodapé e precisam aparecer nas pranchetas de contexto: os toasts sobem
  para 64px + `--space-3` acima do chão, e as barras fixas de resumo (ex.: o total do kit) param em
  64px + `--space-2` + área segura. Já houve um defeito real de um total de kit parado a 8px do chão, ou
  seja, 56px DENTRO da barra, com os dígitos cortados.

## Estados obrigatórios
1. **Repouso** — ícone + rótulo em `--text-muted`, peso medium.
2. **Ativo (seção atual)** — roxo + peso semibold + o marcador que você decidir (pílula ou só cor).
   Desenhe pelo menos uma prancheta com "Orçamentos" ativo, que é o rótulo mais longo e o que a barra
   mais sofre.
3. **Foco de teclado** — anel interno acompanhando o raio do item, distinguível **mesmo sobre o item já
   ativo**. Mostre os dois: foco no inativo e foco no ativo.
4. **Pressionado / toque** — não existe hoje; proponha um (não pode ser só a mudança de cor do ativo,
   porque o toque acontece antes da rota trocar).
5. **Rótulo apertado** — a prancheta de 360px com os cinco rótulos, mostrando explicitamente sua regra
   (truncar? reduzir? abreviar? só ícone no inativo?).
6. **Área segura do iPhone** — a mesma barra com a faixa do indicador de home embaixo: o rótulo não pode
   ficar tangenciando a borda inferior.
7. **Tema claro e tema escuro** — os dois são primeira classe; o contraste do `--text-muted` sobre
   `--surface-card` precisa ser medido nos dois.
8. **Não existem** aqui: carregando, vazio, erro, desabilitado. A navegação é sempre a mesma e sempre
   navegável — se você desenhar um desses, está inventando estado que o produto não tem.
9. **Offline / sessão expirada** — hoje a barra **não muda**; quem avisa é uma faixa no TOPO da tela. Se o
   seu desenho quiser tocar nisso, é pergunta para o dono (abaixo), não decisão sua.

## Viewports
- **360px** — obrigatório, é a largura em que a conta não fecha (~72px por célula) e onde a regra do
  rótulo longo se prova ou se quebra.
- **390px** — a referência principal do projeto (~78px por célula).
- **425px** — o último pixel em que a barra existe: em 426px o app troca para o menu lateral. Vale uma
  prancheta para mostrar que a barra não fica ridícula esparramada.
- **Sem desktop.** Acima de 425px esta peça não é montada — o menu lateral (e o rail recolhido de 76px)
  são outra peça, já desenhada no canvas do 018.

## Regras que o desenho não pode quebrar
- Alvo de toque ≥44×44px em cada uma das cinco células, inclusive em 360px.
- A barra nunca gera rolagem horizontal: em 360px a soma das cinco células mais bordas é exatamente a
  largura da janela, nem 1px a mais.
- Nenhum rótulo pode ser cortado no meio de forma silenciosa. Se a decisão for truncar, o truncamento
  precisa ser visível e legível ("Orçamen…" é honesto; um "Orçament" cortado pela borda não é).
- A barra nunca vende bloqueio: nada de cadeado ou aba apagada em cima de área Premium — a honestidade
  freemium acontece dentro da página, com o convite completo.
- O indicador de foco precisa ser diferente do indicador de ativo, inclusive quando estão no mesmo item.
- Contraste medido contra `--surface-card` real de cada tema, não contra o fundo da página.
- O conteúdo por baixo continua reservando exatamente a altura da barra + área segura; se você mudar a
  altura, diga o número novo com todas as letras, porque três outros elementos se ancoram nele.

## Armadilhas já pagas neste projeto
- **Texto que passa em teste e não aparece na tela.** Asserções de texto são cegas a oclusão e a
  transbordo — dois rótulos encostados passam em todo teste automatizado. Aqui só a imagem decide.
- **Transbordo medido nos DOIS eixos.** Uma barra de rolagem clássica não existe em headless; já
  perdemos uma homologação por medir só um eixo.
- **Elemento fixo comendo o conteúdo.** O total do kit já parou dentro desta barra (56px de sobreposição)
  com os dígitos cortados. Qualquer mudança de altura reabre esse risco.
- **Frase honesta em espaço apertado.** Copy homologada não cabe em elemento estreito — aqui isso vira:
  não resolva o aperto de "Orçamentos" trocando o rótulo por conta própria.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro**, para 360px, 390px e 425px:
1. A barra em repouso com "Calcular" ativo.
2. A barra com **"Orçamentos" ativo** em 360px — a prancheta que prova a regra do rótulo longo.
3. Detalhe ampliado de uma célula nos quatro estados: repouso, ativo, foco de teclado, pressionado.
4. Uma prancheta de contexto: a barra com um toast acima dela e com a faixa de área segura do iPhone.
5. Se propuser truncar/abreviar/reduzir, mostre a alternativa descartada lado a lado, para o dono
   escolher vendo.

Reutilize os primitivos existentes: a barra é `tf-nav` na variante tabbar, cada célula é um
`tf-nav__item` com `tf-nav__icon` (ícone do conjunto do DS) e `tf-nav__label`; cor de ativo pelo token
semântico de acento, foco pelo token de anel. **Não crie primitivo novo** — se precisar de algo que não
existe, diga qual é e por quê, em vez de desenhar um componente paralelo.

## Perguntas em aberto para o dono
1. **Quando "Orçamentos" não couber em 360px, o que acontece?** Truncar com reticências, abreviar com uma
   palavra curta homologada, reduzir a fonte abaixo de 12px, ou aceitar só-ícone nos inativos? Se a
   resposta for abreviar, qual é a palavra — "Orçam.", "Preços", outra? É copy, e copy é sua.
2. **A pílula do ativo fica ou o ativo volta a ser só cor**, como o protótipo de 2026-07-02 mandava?
3. **A barra deve sinalizar estado do app** (offline, orçamento na fila do outbox, Premium pausado) com
   um pontinho sobre o ícone, ou isso continua exclusivamente na faixa do topo?
4. **Kits continua sendo uma das cinco seções de topo para o usuário gratuito**, ou a IA de cinco itens
   deve ser reavaliada agora que os rótulos ficaram mais longos?

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

- **Onde vive:** Não é uma tela: é o estado da moldura inteira quando `session.status` é `anonymous` (ou `not-configured`). Materializa-se em dois pontos: (1) o canto direito da barra superior — `.tf-topbar__actions` —, onde o bloco de identidade `AccountChrome` retorna `null` e sobra apenas o botão de tema de 44×44; (2) a lista de 5 itens do menu (barra de abas no mobile, barra lateral no desktop), toda ela renderizada igual, sem cadeado, badge ou qualquer marca separando público de guardado.
- **Como o vendedor chega:** É o primeiro estado do produto: o vendedor abre o app pela primeira vez (ou depois de sair), `/` redireciona para `/calcular` e ele já está aqui, sem ter visto tela de login. Chega para calcular — e o app promete que calcular é grátis e ilimitado.
- **Vizinhança imediata:** Barra superior de 56px: logo (centralizado em absoluto no mobile, encostado à esquerda no desktop) à esquerda/centro, e à direita só o ícone de sol/lua. Abaixo, o `<main>` com a calculadora. No rodapé (mobile) a barra de 5 abas; no desktop, a coluna do menu à esquerda com os mesmos 5 itens. Nenhum elemento entre o tema e a borda da tela — é ali que caberia uma porta de entrada e não há nada.
- **Dados que chegam (e o que ela devolve):** Só `session.status` do `session-store` (ouvinte do Firebase, alimentado no boot por `initSessionListener`). Nada de servidor, nada de entitlement, nada de catálogo de tarifas — o chrome deslogado não faz um pedido sequer. Devolve: a ausência de identidade.
- **O que acontece depois:** Tocar em Calcular/Catálogo/Kits/Orçamentos abre a aba normalmente (as três últimas mostram o teaser honesto de Premium dentro do conteúdo). Tocar em **Conta** dispara a guarda `requireAuth` do roteador: a tela nunca chega a pintar e o app rebate para `/sign-in?redirect=/conta`. Ao voltar autenticado, o cluster de identidade nasce na barra superior (e-mail + botão Sair) e nada mais na moldura muda.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# O shell deslogado — o app inteiro antes de existir uma conta

## O que desenhar
O chrome do aplicativo (barra superior + menu de navegação, nas duas variantes: TabBar inferior no
mobile e barra lateral no desktop) no estado em que **ninguém está conectado**. É o primeiro
contato: o vendedor abre o Precifica3D, cai em "Calcular" (a raiz `/` redireciona para `/calcular`)
e pode navegar livremente por Calcular, Catálogo, Kits e Orçamentos — todas públicas — sem nunca
ter criado conta. É o estado comercial mais importante do produto e é o único que nunca foi
desenhado.

## Por que este prompt existe
O shell anônimo foi **inferido inteiro**, sem nenhuma autoridade de desenho: as autoridades
consultadas descrevem o shell apenas como o destino DEPOIS do login (§E3), e o ciclo de sessão é
fechado como "Login fullscreen ↔ shell; Sair na Conta volta ao Login" — em E1–E9 não existe shell
anônimo, e a matriz §G não tem linha para ele. O canvas 018 desenha a barra superior sempre com
`maker@truthsforge.com` + "Sair"; o `isFree` desenhado lá é o usuário **logado sem Premium**, que
é outro estado. Consequência medida no código: quando a sessão não está autenticada, o bloco de
conta da barra superior devolve **nada** (`top-bar.tsx`: `if (status !== "authenticated") return null`),
e a palavra "Entrar" **não aparece em nenhum arquivo de `widgets/` ou `app/`**. O produto vende
"calcular é grátis" e entrega esse convite num shell sem porta.

## O que já existe hoje (não invente do zero — corrija)

Barra superior (`widgets/top-bar/top-bar.tsx`), estado deslogado:

| Elemento | Deslogado hoje | Logado hoje |
| --- | --- | --- |
| Logo | mark compacta ≤425px, lockup horizontal no desktop (40px de altura) | igual |
| Identidade | **ausente** (o bloco inteiro é `null`) | "Conectado como maker@truthsforge.com" (some abaixo de 640px) |
| Ação de sessão | **ausente** | botão secundário "Sair" |
| Tema | botão-ícone sol/lua, rótulo acessível "Alternar tema", 44×44px | igual |

→ Problema 1: a barra superior deslogada tem **logo + botão de tema e mais nada**. O lado direito
fica visualmente vazio no desktop (1280/1920px), onde o espaço é justamente o que sobra.

→ Problema 2: **não existe convite para entrar ou criar conta em lugar nenhum do chrome**. O único
caminho é tocar em "Conta" (5º item do menu) e ser *redirecionado* para a tela de login — a
fronteira do freemium só é descoberta por colisão.

Menu (`widgets/app-nav/app-nav.tsx`) — os cinco itens, na ordem, com os rótulos literais:
`Calcular` · `Catálogo` · `Kits` · `Orçamentos` (a rota é `/historico`, o rótulo visível é
"Orçamentos") · `Conta`. O landmark se chama "Navegação principal". No desktop recolhido o rótulo
sai da tela mas continua audível, e a dica de mouse devolve o nome.

→ Problema 3: os cinco itens são **visualmente idênticos**. Não há cadeado, badge, separador ou
qualquer marca distinguindo o que funciona deslogado (Calcular, e as três abas que mostram teaser)
do que **empurra para o login** (Conta, e Catálogo/Orçamentos quando carregam um produto ou um
orçamento específico pela URL).

→ Problema 4: nas abas públicas o deslogado vê o teaser Premium com o botão "Assinar Premium" —
que, para quem não tem conta, na verdade navega para o login. O rótulo promete cobrança e entrega
formulário de entrada.

## Conteúdo e dados reais
- Nome do app: "Precifica3D". A marca no logo é Truth's Forge (lockup inteiro no desktop, mark no mobile).
- Rótulos de menu: exatamente os cinco acima. Não renomear — "Orçamentos" já foi renomeado uma vez
  (016/US2) e é copy homologada.
- Botão de tema: rótulo acessível "Alternar tema"; estado pressionado = tema escuro. No desktop o
  018 prevê um **controle segmentado** com dois segmentos rotulados "Claro" e "Escuro" (ícones
  sol/lua, pílula de raio 999px) — desktop-only, por decisão do dono.
- Copy que JÁ existe e pode ser reaproveitada, se o desenho decidir trazê-la para o chrome:
  título "Entrar", subtítulo "Entre para acessar seu catálogo, orçamentos e conta.", botão
  "Entrar com Google", e a legenda honesta dos teasers "A calculadora continua grátis."
- Medidas reais: barra superior de 56px no mobile; barra lateral de 240px expandida e 76px
  recolhida; alvo mínimo de toque 44px.
- Exemplo numérico da tela por trás (Calcular público, primeira visita com dados semeados): preço
  sugerido **R$ 24,24**. O vendedor deslogado precisa ver esse número sem obstrução.

## Estados obrigatórios
1. **Anônimo** — o estado principal deste prompt. O chrome mostra logo, navegação e tema; o desenho
   precisa decidir onde entra o convite de entrada.
2. **Verificando sessão** — hoje o app inteiro é substituído por uma única linha de texto:
   "Verificando sessão…". Desenhe o que aparece nesse instante sem piscar identidade falsa.
3. **Login indisponível no ambiente** — indistinguível do anônimo no chrome; só na tela de login
   aparece "Login indisponível: Firebase não configurado neste ambiente."
4. **Autenticado**, para contraste — identidade + "Sair" (é o único estado que o canvas 018 cobre).
5. **Offline** — a faixa superior de status já existe e o cálculo continua funcionando; a frase da
   tela de login é "Você está offline. O login precisa de internet — o cálculo continua funcionando."
6. **Sessão expirada** — faixa fixa com a ação "Entrar de novo" (existe hoje, é a única ocorrência
   de "Entrar" no chrome, e só aparece para quem JÁ estava logado).
7. **Item de menu:** repouso · hover · foco visível (anel) · seção atual · recolhido (só ícone,
   rótulo audível) — nos cinco itens.
8. **Convite de entrada (o elemento novo):** repouso · hover · pressionado · foco · carregando (se
   levar direto ao Google) · desabilitado quando o login não está disponível no ambiente.

## Viewports
- **390px (mobile)** — obrigatório: a barra superior mobile centraliza o logo e ancora as ações à
  direita; o menu é a TabBar inferior de 5 itens. Mostre onde o convite cabe sem brigar com o logo
  centralizado nem com a TabBar.
- **1280px (desktop, o corte do 018)** — barra lateral expandida de 240px à esquerda de tudo, barra
  superior começando onde a lateral termina, logo alinhado à esquerda em vez de centralizado.
- **1920px** — a mesma composição com o lado direito da barra superior ainda mais vazio: é aqui que
  a ausência de identidade fica mais evidente.
- Desenhe também **1280px com o menu recolhido** (rail de 76px, só ícones): o convite precisa
  sobreviver ao recolhimento.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** entrar (conta) e assinar (Premium) são coisas DIFERENTES. Nada no
  chrome pode sugerir que criar conta libera Premium, nem que Premium é necessário para calcular.
- **Nada de identidade falsa:** enquanto a sessão está sendo verificada, não desenhe avatar,
  iniciais nem espaço reservado que pareça um usuário. O produto já pagou caro por "premium aparente".
- **Falha de rede nunca vira "faça login" nem "não é premium".** Offline é offline, com frase própria.
- **Frase honesta nunca dentro de placeholder** (lição do 016): "A calculadora continua grátis." e
  qualquer explicação da fronteira moram em elemento de largura plena, nunca cortadas.
- **Alvo ≥44px** em todos os controles do chrome, inclusive o convite novo, inclusive no rail de 76px.
- Contraste medido **contra o fundo real** da barra superior (superfície de card, não o fundo da página).

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado:** a 426px a barra lateral de 240px deixava ~150px de
  conteúdo e a página inteira acusava 131px de transbordo. Qualquer elemento novo na barra superior
  precisa caber em 390px junto com o logo e o tema.
- **O e-mail some abaixo de 640px** por regra de CSS — ou seja, entre 426 e 639px o lado direito já
  é quase vazio mesmo logado. Não desenhe assumindo que a identidade sempre aparece.
- **Texto ocluso passa em teste:** um convite empurrado para fora da barra ou coberto pelo logo
  centralizado continua "visível" para asserção de texto. Prove por geometria, com caixas.
- **Rótulo escondido não é rótulo removido:** no rail, o nome do item sai da tela mas continua
  audível. Se o convite virar só ícone, ele precisa do mesmo tratamento.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro em pé de igualdade** (as duas versões de cada):
1. Barra superior deslogada — 390px, 1280px, 1920px.
2. Barra superior deslogada × autenticada, lado a lado a 1280px (a comparação é o argumento).
3. Shell deslogado completo a 390px (TabBar visível) e a 1280px (lateral expandida e recolhida),
   com "Calcular" ativo por trás.
4. Estados do convite de entrada: repouso, hover, pressionado, foco, desabilitado, carregando.
5. Estado "Verificando sessão…" e estado offline no chrome deslogado.
6. Proposta de marcação da fronteira nos itens de menu (o que hoje é Problema 3): no máximo duas
   alternativas, sem escolher por nós.

Reaproveite os primitivos existentes, sem criar novos: `tf-topbar` e seus filhos para a barra;
`tf-btn` (variante secundária ou ghost, tamanho `sm`) para o convite de entrada — o mesmo shape do
"Sair" atual; `tf-nav` / `tf-nav__item` / `tf-nav--rail` para o menu; `tf-topbar__theme` ou o
segmentado do canvas 018 para o tema; a faixa de status existente para offline e sessão expirada;
o conjunto de ícones do DS para qualquer ícone (nada desenhado à mão).

## Perguntas em aberto para o dono
1. O convite deslogado deve dizer **"Entrar"** (a copy que já existe na tela de login) ou **"Criar
   conta"** (o que o vendedor de primeira viagem realmente vai fazer)? São promessas diferentes e o
   código não decide isso.
2. O convite fica **permanente na barra superior** ou aparece só quando o vendedor esbarra na
   fronteira? Permanente é honesto e ocupa espaço escasso a 390px; contextual é mais limpo e mantém
   a fronteira invisível até a colisão — que é exatamente o defeito de hoje.
3. Os itens gateados do menu devem ganhar **marca visual** (cadeado/badge) para o deslogado, ou
   isso vende o produto como "bloqueado" antes de mostrar valor?
4. Quando um deslogado toca em "Assinar Premium" no teaser, ele hoje cai no login sem aviso. O botão
   deve **mudar de rótulo** para o deslogado, ou o login deve **explicar** que é etapa da assinatura?
5. O controle segmentado de tema ("Claro"/"Escuro") do canvas 018 vale também no estado deslogado,
   ou o deslogado fica com o botão-ícone atual?

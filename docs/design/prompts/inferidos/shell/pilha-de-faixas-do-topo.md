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

- **Onde vive:** A região que ocupa os dois primeiros filhos do `.tf-shell`, acima de `.tf-shell__body`: primeiro `<OfflineBanner>` (faixa ciano, ícone + frase centralizados, ~36px, rola embora junto com a página) e logo abaixo `<SessionExpiryBanner>` (o bloco grudado descrito acima, ~80px). Nenhuma das duas está dentro do corpo — no desktop as duas atravessam a largura inteira, cruzando por cima da coluna do menu, que é grudada no topo com altura de janela.
- **Como o vendedor chega:** Sozinhas ou juntas, sempre por acidente do mundo: perder rede, e/ou o servidor recusar a sessão. O vendedor não pediu nenhuma das duas e não pode fechar nenhuma delas.
- **Vizinhança imediata:** Acima: nada, é o topo do documento. Abaixo: no mobile a barra superior de 56px e depois o conteúdo; no desktop, o topo da coluna do menu (que o desenho do 018 desenhou começando no pixel 0) e o topo da barra superior. Somadas, as duas podem comer ~120px do alto da tela — e uma delas fica grudada enquanto a outra sobe com a rolagem, de modo que a ordem visual muda conforme o vendedor rola.
- **Dados que chegam (e o que ela devolve):** A faixa de offline lê a conectividade de um único hook compartilhado (o mesmo que as telas de Orçamentos usam), anunciando-se educadamente para leitores de tela; a de sessão lê o bit de expiração. Devolvem só aviso: nenhuma das duas desabilita campo nenhum por conta própria.
- **O que acontece depois:** Voltando a rede, a faixa ciano desaparece e a fila do outbox começa a drenar sozinha (o sincronizador vive no mesmo shell); entrando de novo, a faixa azul desaparece. Enquanto qualquer uma existir, tudo abaixo — inclusive o topo do menu e o botão Recolher — fica deslocado para baixo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# A região de avisos do topo do shell (quando são DUAS faixas)

## O que desenhar

A faixa de largura total que nasce no alto de **todas** as telas autenticadas do Precifica3D, acima da barra
superior e — no desktop — acima também da coluna do menu lateral. Hoje ela pode receber dois avisos
diferentes: a faixa de **offline** ("o cálculo continua funcionando") e a faixa de **sessão expirada**
("Entrar de novo"). Na maior parte do tempo a região não existe: as duas faixas renderizam `null` e a
altura é 0. O que precisa de desenho é o momento em que **uma** aparece, o momento em que **as duas
aparecem juntas** (offline + 401 é combinação real: o servidor recusa a sessão e a rede cai em seguida), e
o que acontece com o resto do shell — a barra superior, o menu lateral de altura de janela e o conteúdo —
quando o topo do documento é empurrado para baixo. Quem vê isso é o vendedor no meio de um orçamento,
tipicamente com a página rolada até o fim, onde mora "Salvar em Orçamentos".

## Por que este prompt existe

A ficha classifica a região como `PROTOTIPO_PARCIAL`: **uma** das faixas tem desenho, a **região** não. O
protótipo de 2026-07-02 cobre a faixa de offline sozinha e com autoridade forte (§D.2 "faixa discreta em
ciano de info", §E3, §E9 e a coluna offline da matriz §G), e ela já passou por duas rodadas de correção
(`role="status"`/`aria-live`, contraste no tema escuro — 11,96:1 medido no V3). O que ninguém desenhou:
onde as faixas moram quando são duas, qual vem primeiro, o fato de uma ser sticky (z-index 40) e a outra
rolar embora, e como um menu lateral de `height: 100dvh` convive com faixas que empurram o topo.
**O código contraria o desenho do desktop**: no canvas 018 a busca por "offline" dá 0 ocorrências e o
`<nav class="tf-nav tf-nav--sidebar">` nasce como primeiro filho do corpo do shell, sem nada acima dele —
ou seja, o desenho do desktop não prevê faixa alguma sobre o menu, e o produto põe duas.

## O que já existe hoje (não invente do zero — corrija)

As duas faixas são irmãs diretas dentro do shell, nesta ordem, **acima** do corpo da aplicação
(`apps/web/src/app/app-shell.tsx`):

| # | Faixa | Texto literal em pt-BR (não reescreva) | Comportamento de rolagem | Altura aproximada |
|---|-------|----------------------------------------|--------------------------|-------------------|
| 1 | Offline (`offline-banner.tsx`) | "Você está offline. O cálculo continua funcionando." | **rola embora** — sai da tela junto com o conteúdo | ~36–40px (uma linha) |
| 2 | Sessão expirada (`session-expiry-banner.tsx`) | título "Sua sessão expirou" · corpo "Entre de novo para continuar de onde parou." · botão "Entrar de novo" | **sticky no topo**, z-index 40 | ~110–140px (três blocos) |

- A faixa de offline é um bloco centralizado: ícone `info` 18px + texto, fundo `--tf-info-soft`, texto
  `--info-text`, corpo pequeno, peso médio, **sem movimento** (nada deve distrair de "o cálculo continua").
- A faixa de sessão é o primitivo `Alert` no tom `info` (ícone `info` 20px à esquerda, título, corpo e, no
  fim, um botão primário pequeno). O tom é **info e nunca perigo** de propósito: nada foi destruído — a fila
  de sincronização guarda os orçamentos não enviados —, então isso é convite, não alarme.
- → **Problema 1:** a soma das duas pode consumir ~120px do alto sem que ninguém tenha decidido o que fica
  visível. Nenhuma das duas pode ser fechada pelo vendedor.
- → **Problema 2 (desktop):** o menu lateral é uma coluna `sticky top:0` de `height: 100dvh` com o botão de
  recolher no **rodapé do menu**. Empurrada ~120px para baixo pelas faixas, essa coluna passa a terminar
  ~120px abaixo do fim da janela: o botão de recolher (e os últimos itens) saem de alcance. É a classe
  "elemento nascido fora da viewport" que este projeto já pagou duas vezes.
- → **Problema 3:** ao rolar, a faixa de sessão gruda no topo com z-index 40 e passa a cobrir o **topo do
  menu lateral** (logo e primeiros itens), que não tem z-index próprio. Ninguém desenhou essa sobreposição.
- → **Problema 4:** a faixa de offline não é sticky. No instante do 401 o vendedor está no fim da página; a
  faixa de sessão foi feita sticky justamente por isso (media-se 1.746px fora da viewport a 1440px e
  3.608px a 360px antes do conserto). A de offline continua nascendo fora de alcance.
- → **Problema 5 (copy):** o protótipo dizia "Offline — o cálculo continua funcionando"; o produto diz
  "Você está offline. O cálculo continua funcionando." Use **a frase do produto** (é a homologada); só
  registre que as duas autoridades divergem.

## Conteúdo e dados reais

- A região não tem dados numéricos: é 100% texto de sistema. Nenhum valor em R$ aparece aqui.
- Larguras do shell que a região atravessa: menu lateral **240px** expandido, **76px** recolhido; abaixo de
  600px o menu recolhe por necessidade; o interruptor de recolher só existe a partir de 1280px. No mobile
  (≤425px) não há menu lateral — há barra inferior fixa.
- O botão "Entrar de novo" é um link real (leva ao login preservando a tela em que o vendedor estava).
- Estado normal do produto: **nenhuma faixa**. A região tem altura 0 e o menu lateral encosta no pixel 0.
  Desenhe esse estado também — é o que 99% do tempo aparece, e é a régua contra a qual os outros deslocam.

## Estados obrigatórios

1. **Ausente** (online, sessão válida) — altura 0; o topo do shell é a barra superior (mobile) ou o menu
   lateral encostado no topo (desktop). Serve de linha de base.
2. **Só offline** — faixa 1, uma linha, ciano de info, centralizada, largura total. Texto: "Você está
   offline. O cálculo continua funcionando."
3. **Só sessão expirada** — faixa 2, o `Alert` info com "Sua sessão expirou" / "Entre de novo para
   continuar de onde parou." / botão "Entrar de novo".
4. **As duas juntas** — o estado que este prompt existe para resolver. Mostre a pilha completa e o efeito
   sobre a barra superior e sobre o menu lateral.
5. **Rolado** — o mesmo estado 4 com a página rolada: hoje a faixa 1 sumiu, a faixa 2 gruda e cobre o topo
   do menu. Desenhe o que **deveria** acontecer.
6. **Botão "Entrar de novo"**: repouso, hover, foco visível (anel), pressionado — alvo mínimo de 44px de
   altura tocável mesmo sendo o tamanho pequeno do botão.
7. **Offline + sessão expirada com a ação impossível** — offline, o login não funciona (o próprio produto
   já diz noutra tela: "O login precisa de internet"). O desenho precisa de uma resposta visível para isso:
   botão desabilitado com motivo dito, ou ordem/supressão entre as faixas. Ver perguntas ao dono.

## Viewports

- **Mobile 390px** — obrigatório: as faixas nascem aqui e a de sessão tem três blocos de texto que quebram
  em várias linhas; é onde a pilha come mais proporção de tela.
- **Desktop 1280px** — obrigatório: é o primeiro ponto em que o menu lateral de 240px pode ser recolhido
  pelo vendedor. Desenhe **duas variantes**: menu expandido (240px) e menu recolhido (76px).
- **Desktop 1920px** — a largura em que o dono redesenhou as abas no canvas 018; a faixa fica muito larga e
  o texto centralizado vira uma linha solta no meio de um vão enorme. Precisa de decisão de largura máxima.
- **480px** (opcional, uma prancheta) — a faixa 426–599px, em que o menu lateral já existe mas está
  recolhido à força em 76px: é a combinação mais apertada que o produto tem.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de premium**: a faixa de offline afirma que o cálculo continua
  funcionando, e essa é a promessa central do produto. Nada no desenho pode sugerir bloqueio de recurso.
- **Degradação dita, não escondida**: se uma faixa suprimir a outra, o que sumiu precisa continuar
  legível em algum lugar — não pode simplesmente desaparecer.
- **A frase honesta vive em elemento de largura inteira**, nunca truncada e nunca dentro de um placeholder.
- **Sem alarme falso**: sessão expirada é tom de **info**, não de perigo — nada foi perdido.
- **Contraste medido contra o fundo real da faixa** (o ciano suave), nos dois temas; o valor de referência
  já conquistado é 11,96:1 no tema escuro. Não regrida.
- **Alvo tocável ≥44px** para "Entrar de novo".
- **Sem movimento** na faixa de offline (nada de pulsar/deslizar): ela informa, não alarma.
- Nenhuma faixa pode empurrar o menu lateral de forma que o botão de recolher, no rodapé do menu, saia da
  janela.

## Armadilhas já pagas neste projeto

- **Botão nascido fora da viewport** (E6/T028: 100,5px de transbordo, botão fora da tela). Foi exatamente
  isso que tornou a faixa de sessão sticky. A faixa de offline ainda tem o defeito.
- **Coluna que estica com o conteúdo**: o menu lateral já nasceu com o botão de recolher no pixel 2.803 de
  uma página cheia antes de ganhar `height: 100dvh`. Empurrar o topo reintroduz o mesmo sintoma por outra
  porta.
- **Texto ocluso passa em teste**: sobreposição não é propriedade de texto; um elemento coberto por outro
  continua "visível" para asserções de conteúdo. Este desenho precisa mostrar as caixas, não só as frases.
- **Transbordo horizontal**: faixa de largura total com ícone + texto + botão estoura 390px com facilidade.
- **Placeholder que corta a frase honesta** (016): frase de honestidade nunca em elemento estreito.

## Entregável

Pranchetas, tema **escuro como padrão** e tema **claro como cidadão de primeira classe** (as duas versões
de cada prancheta que envolver cor de faixa):

1. Mobile 390px — os quatro estados de conteúdo (ausente · só offline · só sessão · as duas) em coluna.
2. Mobile 390px — o estado rolado, mostrando o que fica preso no topo.
3. Desktop 1280px, menu expandido — as duas faixas juntas, com o menu lateral inteiro visível e o botão de
   recolher dentro da janela.
4. Desktop 1280px, menu recolhido (76px) — mesmo estado.
5. Desktop 1280px — o estado rolado, resolvendo a sobreposição faixa × topo do menu.
6. Desktop 1920px — a decisão de largura do texto na faixa larga.
7. Detalhe: os quatro estados do botão "Entrar de novo" (repouso/hover/foco/pressionado) e o estado em que
   ele é impossível (offline).

Reutilize os primitivos existentes, sem criar novos: a faixa de sessão é o `Alert` no tom `info` (ícone
`info`, título, corpo, ação); a ação é o botão primário no tamanho pequeno; o ícone da faixa de offline é o
mesmo `info` em 18px; a cor de fundo é o token suave de info e o texto é o token de texto de info. Se o
desenho precisar de uma faixa mais compacta que o `Alert`, diga isso explicitamente como variante do
`Alert`, não como componente novo.

## Perguntas em aberto para o dono

1. **Quando as duas aparecem juntas, empilha ou uma suprime a outra?** Offline + sessão expirada é a
   combinação em que o botão "Entrar de novo" **não funciona** (o login exige internet). Empilhar as duas é
   honesto mas soma ~120px; suprimir a de sessão enquanto offline é mais limpo, mas esconde o motivo real
   pelo qual as ações pararam de responder.
2. **A faixa de offline deve virar sticky também?** Hoje ela rola embora — o vendedor no fim da página não
   descobre que está offline. Sticky resolve, ao custo de mais altura permanente.
3. **No desktop, as faixas atravessam por cima do menu lateral ou começam depois dele** (só na coluna de
   conteúdo, à direita)? O canvas 018 desenhou o menu começando no pixel 0 do artboard, o que sugere a
   segunda opção — mas isso nunca foi decidido.
4. **O vendedor pode dispensar alguma das faixas?** Hoje nenhuma das duas tem fechar. Se puder, ela volta a
   aparecer quando?
5. **Existe teto de faixas simultâneas?** Se amanhã entrar um terceiro aviso (plano pausado, cobrança em
   atraso), a região precisa de uma regra de prioridade ou vira uma pilha sem limite.

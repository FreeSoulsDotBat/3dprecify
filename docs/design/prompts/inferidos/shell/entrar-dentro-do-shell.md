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

- **Onde vive:** Rota `/sign-in`, renderizada como qualquer aba: **dentro** do shell, no `<main>`, com o menu montado em volta (barra de abas embaixo no mobile, coluna de 240px à esquerda no desktop) e a barra superior por cima — só que nessa rota o logo da barra some e vira um espaçador invisível, deixando um vazio no lugar da marca. O conteúdo é uma coluna centrada de no máximo 384px: logo completo, depois um cartão com título "Entrar", subtítulo, o botão grande "Entrar com Google", os avisos condicionais, e — solto abaixo do cartão — o link sublinhado "Como tratamos seus dados".
- **Como o vendedor chega:** Por rebote, quase sempre: tocou em **Conta**, ou abriu um link guardado (`/catalogo?produto=…`, `/historico?snapshot=…`), ou clicou em "Entrar de novo" na faixa de sessão expirada. Chega interrompido, com uma intenção pendente carregada no `?redirect=`. Chega também pelos teasers dentro das abas.
- **Vizinhança imediata:** Acima do cartão: o logo completo; acima dele, a barra superior esvaziada e, se for o caso, as faixas de aviso. Abaixo do cartão: o link de privacidade, e nada mais até o fim da coluna. Dos lados, no desktop, muito vazio — o cartão de 384px flutua num `<main>` que a ≥1280px pode ter 1720px de largura, ao lado de um menu que continua navegando para telas que devolvem o vendedor para cá.
- **Dados que chegam (e o que ela devolve):** `session.status` (para saber se o Firebase está sequer configurado — se não estiver, o botão nasce desabilitado com um aviso), o resultado do pop-up do Google, e o `?redirect=` validado por uma lista branca de rotas internas (destino externo vira `/calcular`). Devolve uma sessão autenticada. Quatro estados de tela: parado · enviando (botão carregando) · offline (aviso azul: "o login precisa de internet — o cálculo continua funcionando") · erro (aviso vermelho).
- **O que acontece depois:** Assim que a sessão vira autenticada, a própria guarda da rota rebate o vendedor para o `?redirect=` (preservando a query, inclusive o id do produto/orçamento que ele tentou abrir) ou para `/calcular`. A barra superior ganha o cluster de identidade no mesmo instante. O link de privacidade leva a `/privacidade`, de onde só se volta pelo menu.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Entrar — a porta de entrada e a moldura em volta dela

## O que desenhar
A tela **Entrar** do Precifica3D (rota `/sign-in`) e, principalmente, **a moldura em que ela aparece**. É a primeira tela que o vendedor vê quando tenta abrir Catálogo, Kits, Orçamentos ou Conta sem estar conectado: o app o desvia para cá, ele entra com o Google e é devolvido exatamente para onde queria ir. Calcular é público, então ninguém é obrigado a passar por aqui para precificar — quem chega aqui está tentando salvar, consultar ou gerenciar algo seu. Hoje a tela é um cartão de 384px centrado; o que precisa de desenho é a tela inteira, incluindo o que aparece **atrás e acima** dela: a barra superior e o menu do app.

## Por que este prompt existe
O protótipo de 2026-07-02 desenhou o login como tela **fullscreen** — a especificação diz literalmente "Login/logout fullscreen (Login E2 ↔ shell)", e o `LoginScreen.jsx` do ui-kit confirma pela forma: é a **única** das 6 telas do kit que não monta barra superior nem menu. O código faz o oposto: a rota de login é filha da mesma árvore de `/calcular`, então ela renderiza **dentro** do shell — menu do app montado atrás, barra superior presente. Isso é uma **contradição explícita com o desenho existente**, e ninguém desenhou o que ficou no lugar. Pior: como a barra superior esconde o logo nessa rota (para não duplicar o do cartão), sobra um **buraco onde a marca deveria estar**. E a versão desktop nunca existiu em desenho nenhum.

## O que já existe hoje (não invente do zero — corrija)

**A moldura (o shell), presente em todas as viewports:**

| Elemento | Estado em `/sign-in` hoje | |
|---|---|---|
| Barra superior (56px) | Logo **suprimido**, trocado por um espaçador vazio | → um vazio no canto esquerdo, é o achado principal |
| Identidade + botão "Sair" | Não renderiza (ninguém está conectado) | correto |
| Alternar tema (ícone sol/lua, 20px) | Único elemento visível da barra | → uma barra de 56px inteira para um ícone |
| Menu (abas em ≤425px, barra lateral acima disso) | Montado e clicável, com **Calcular · Catálogo · Kits · Orçamentos · Conta** | → 4 dos 5 itens devolvem o usuário para esta mesma tela |
| Faixa de offline / sessão expirada | Podem aparecer acima de tudo | mantêm-se |

**O conteúdo (o cartão), de cima para baixo:** logo horizontal completo → cartão com padding grande contendo o título **"Entrar"**, a legenda **"Entre para acessar seu catálogo, orçamentos e conta."**, o botão primário grande **"Entrar com Google"** e, quando houver, um aviso → abaixo do cartão, solto, o link sublinhado **"Como tratamos seus dados"**.

→ O cartão tem 384px de largura máxima. No desktop ≥1280px ele flutua sozinho numa área útil de até **1720px**, ao lado de uma barra lateral de 240px. É a mesma classe de desperdício que a homologação do 016 mediu como "~37/39% de aproveitamento".

→ O botão "Entrar com Google" hoje é **primário sólido, sem o G colorido**. O protótipo desenhou um botão de superfície com borda e o G de 4 cores — a convenção que o vendedor reconhece.

→ A proposta de valor sumiu. O protótipo abria com **"Forje o preço certo"** e **"Precifique suas impressões 3D com a conta transparente — do material à margem."**; o código entrega "Entrar" e uma frase administrativa.

## Conteúdo e dados reais
Textos literais que já estão no produto (não reescreva sem dizer que está reescrevendo):
- Título: **"Entrar"** · Legenda: **"Entre para acessar seu catálogo, orçamentos e conta."**
- Botão: **"Entrar com Google"** (no protótipo, o rótulo em carregamento era **"Entrando…"**)
- Erro genérico: **"Não foi possível entrar. Tente novamente."**
- Offline: **"Você está offline. O login precisa de internet — o cálculo continua funcionando."**
- Ambiente sem login: **"Login indisponível: Firebase não configurado neste ambiente."**
- Rodapé (link real, leva a uma página pública): **"Como tratamos seus dados"** — medido em 181×20px, com altura mínima de 24px forçada por acessibilidade (é um link solto, não dentro de frase).
- Frase estática do protótipo, que **não** virou link: "Ao continuar você concorda com os Termos e a Política de Privacidade. Os cálculos funcionam offline."
- Legenda do protótipo abaixo do botão: "Login por Google. Mais opções em breve."
- Barra superior: rótulo do controle de tema **"Alternar tema"**; nomes do menu **Calcular · Catálogo · Kits · Orçamentos · Conta**.
- Enquanto o app confere a sessão, existe a frase **"Verificando sessão…"**.

Não há campos de formulário: **um único botão**, sem e-mail, sem senha, sem "criar conta". Nenhum número, nenhum dinheiro nesta tela.

## Estados obrigatórios
1. **Repouso** — botão pronto, nenhum aviso. É o estado que 95% das visitas vê.
2. **Foco por teclado** — anel visível no botão e no link do rodapé, medido contra o fundo real do cartão (o projeto já corrigiu um medidor de foco que errava).
3. **Hover / pressionado** no botão e no link.
4. **Enviando** — botão em carregamento, não clicável, com indicação de progresso; a janela do Google abre por cima. Diga o que o vendedor lê aqui ("Entrando…" ou o rótulo mantido — decida no desenho e mostre).
5. **Erro** — aviso de tom perigo com "Não foi possível entrar. Tente novamente.", abaixo do botão, dentro do cartão; o botão volta a ficar clicável.
6. **Offline** — aviso de tom informativo com a frase completa sobre o cálculo continuar funcionando. **Nunca** vender falha de rede como "sem permissão" ou "premium".
7. **Login indisponível no ambiente** — botão **desabilitado** + aviso informativo. É o único estado em que o botão nasce morto; precisa parecer morto e explicado, não quebrado.
8. **Verificando sessão** — o instante antes de decidir se mostra a tela ou devolve o usuário ao destino.
9. **Faixa de offline global** e **faixa de sessão expirada** podem aparecer acima da barra superior: desenhe pelo menos uma composição com a faixa presente, para provar que a tela não é empurrada para fora.

## Viewports
- **Mobile 390px** — obrigatória: é onde o vendedor realmente entra. Barra de abas embaixo, barra superior em cima, cartão no meio.
- **Desktop 1280px** — obrigatória: é o corte em que a área útil abre e o cartão de 384px começa a boiar.
- **Desktop 1920px** — obrigatória: é o caso extremo (área útil de até 1720px) e é onde o desperdício foi medido.
- Verifique também a faixa **426–599px**, onde o menu lateral aparece já recolhido em rail de 76px: é a largura em que a moldura mais aperta o conteúdo.

## Regras que o desenho não pode quebrar
- **A marca não pode ser um buraco.** Se o logo sai da barra superior nesta rota, o que fica no lugar precisa ser uma decisão visível, não um espaçador vazio.
- **Nada de laço.** Se o menu continuar visível, os itens que exigem login não podem parecer disponíveis e devolver o usuário para esta mesma tela sem explicação.
- **Honestidade de rede.** Offline é offline: a frase inteira, em elemento de largura cheia — **nunca dentro de um campo/placeholder** (o projeto já perdeu uma frase honesta cortada por isso).
- **Alvo de toque:** botão principal grande (≥56px de altura no mobile); link do rodapé com ≥24px de altura real e área de clique coerente.
- **Contraste medido contra o fundo real** — inclusive o do aviso sobre o cartão, e inclusive no tema claro.
- **Zero rolagem horizontal** em 390px e em 1920px, medida nos dois eixos.
- Se você propuser uma tela sem moldura (fullscreen, como o protótipo), **desenhe também a transição**: o que o vendedor vê no instante seguinte ao login, quando o shell aparece.

## Armadilhas já pagas neste projeto
- **Aproveitamento medido**: telas com conteúdo estreito num campo largo foram reprovadas em homologação com "~37/39% de aproveitamento". Um cartão de 384px em 1920px cai nessa categoria.
- **Transbordo horizontal invisível em teste**: um elemento pode passar em todos os testes de texto e ainda estar fora da tela. Mostre as caixas.
- **Frase honesta cortada**: mensagens de honestidade em elementos estreitos ficam com reticências. O aviso de offline é a frase mais longa desta tela — desenhe-a com o texto inteiro.
- **Barra lateral que come o conteúdo**: abaixo de 600px, 240px de menu deixaram ~150px de página e mediram 131px de transbordo. A moldura desta tela sofre do mesmo.
- **Logo duplicado**: a barra superior esconde a marca justamente porque o cartão já mostra uma. Resolva o par, não um lado só.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como igual** (não como variação secundária):
1. `Entrar · 390px · repouso` — moldura completa (barra superior + abas) e cartão.
2. `Entrar · 390px · estados` — enviando, erro, offline, login indisponível, foco por teclado.
3. `Entrar · 1280px · repouso` — sua proposta de composição desktop (moldura ou fullscreen).
4. `Entrar · 1920px · repouso` — a mesma proposta no campo largo, provando o aproveitamento.
5. `Entrar · barra superior em detalhe` — o que ocupa o lugar da marca nesta rota, nos dois temas.
6. `Entrar · 1280px · tema claro`.

Reutilize os primitivos existentes: **Card** (padding grande) para o bloco central, **Button** primário tamanho grande para "Entrar com Google", **Alert** (tom informativo para offline e ambiente sem login; tom perigo para erro), **Logo** (lockup completo), **Icon** para o G do Google e para o controle de tema, e os componentes de barra superior e navegação já existentes. **Não crie primitivo novo**; se a composição pedir um (por exemplo, um painel de marca lateral no desktop), diga explicitamente que é novo e por quê.

## Perguntas em aberto para o dono
1. **Login dentro ou fora do shell?** O protótipo disse fullscreen, o código entrega emoldurado. É a decisão que muda tudo nesta tela — e ela também define como fica o "sair" (a volta pelo mesmo caminho).
2. **Se ficar emoldurado**, o menu continua clicável nos itens que exigem login, ou eles aparecem marcados como "precisa entrar"?
3. **A proposta de valor volta?** "Forje o preço certo" + "Precifique suas impressões 3D com a conta transparente — do material à margem." estavam desenhadas e não foram implementadas.
4. **O rodapé legal**: fica só o link "Como tratamos seus dados", ou volta a frase do protótipo sobre Termos e Política de Privacidade? Hoje **não existe página de Termos** — se a frase voltar, ela precisa de destino ou precisa ser reescrita.
5. **O controle de tema aparece na tela de entrada?** É o único controle da barra superior nesta rota; mantê-lo é uma escolha, não uma consequência.
6. **"Login por Google. Mais opções em breve."** — a promessa do protótipo continua de pé? Se não houver outra opção planejada, ela não deve ser desenhada.

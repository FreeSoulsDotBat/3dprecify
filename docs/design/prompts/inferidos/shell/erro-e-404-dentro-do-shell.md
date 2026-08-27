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

- **Onde vive:** Duas telas declaradas na raiz do roteador, portanto renderizadas **no lugar da página**, dentro do `<main>`, com o shell inteiro de pé em volta (menu clicável, barra superior com identidade e tema, faixas de aviso ativas). **404**: um grafismo em arco, um estado-vazio com ícone de triângulo, título "Página não encontrada", corpo "O endereço que você abriu não existe." e um botão primário "Voltar para Calcular". **Erro**: um grafismo de espada, título "Algo deu errado", corpo "Tente novamente. Se persistir, informe o código de suporte.", botão "Recarregar" e, discreta no fim, a linha "Código de suporte: <id>".
- **Como o vendedor chega:** O 404 chega por endereço digitado, link velho ou atalho salvo que não existe mais. A tela de erro chega quando qualquer coisa dentro da árvore de rotas estoura — inclusive uma chamada de API que falhou de um jeito que a página não tratou. Existe ainda um terceiro caso, pior: endereços de dois segmentos podem carregar em **branco absoluto**, sem 404 e sem tela de erro.
- **Vizinhança imediata:** Em volta, o app inteiro continua parecendo funcionar: no desktop, a coluna de menu à esquerda e a barra superior acima; no mobile, a barra de 5 abas no rodapé, tocável. A coluna de conteúdo é estreita e centrada num campo que a ≥1280px chega a 1720px. Acima do grafismo, a barra superior; abaixo do botão, no caso do erro, a linha do código de suporte e nada mais.
- **Dados que chegam (e o que ela devolve):** O 404 não recebe nada. A tela de erro recebe o objeto do erro e dele extrai um código de correlação — o mesmo identificador que viaja no cabeçalho da chamada — ou gera um código local estável; o mesmo código é enviado ao monitoramento com a etiqueta certa. Nunca aparece pilha de erro, nunca aparece código de fio cru.
- **O que acontece depois:** "Voltar para Calcular" navega para a aba pública sem recarregar. "Recarregar" recarrega a página inteira do navegador. E o menu continua funcionando o tempo todo: o vendedor pode simplesmente trocar de aba e sair do erro — o que também significa que nada distingue "o app quebrou" de "esta tela quebrou".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Erro global e 404 emoldurados pelo shell

## O que desenhar

As duas telas de exceção do Precifica3D — **"Algo deu errado"** (limite de erro global da árvore de rotas) e
**"Página não encontrada"** (404) — desenhadas **como elas realmente aparecem hoje**: dentro do shell, com o
menu lateral (ou a TabBar no celular), a top-bar de marca/tema/conta e as faixas de estado ainda de pé em
volta. Quem vê é o vendedor 3D no meio da jornada: clicou em algo, digitou um endereço errado, ou a tela que
usava quebrou — o momento em que o produto tem menos crédito e mais precisa parecer honesto. Além dos dois
estados normais, o desenho cobre o **pior caso já medido**: a rota de dois segmentos que carrega em branco
absoluto — nem 404, nem tela de erro, nem shell.

## Por que este prompt existe

O **conteúdo** das duas telas já foi desenhado e homologado (protótipo de 2026-07-02, §E9 + item 19 dos
`claude-design-prototype-fixes`): grafismo, título honesto, botão de volta, "Código de suporte:
{correlationId}", nunca stack trace. **O enquadramento nunca foi.** No protótipo as duas são telas do fluxo
— o 404 é descrito como tendo "link de volta ao shell", frase que só faz sentido se ele estiver **fora** do
shell — mas `errorComponent` e `notFoundComponent` estão declarados na `rootRoute`, cujo `component` é o
`AppShell`: as duas renderizam **dentro** dele. O canvas do 018 não tem prancheta nenhuma das duas. O código
contraria a leitura mais natural da autoridade de desenho, e ninguém decidiu se contrariar está certo.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/error/error-page.tsx`, `pages/not-found/not-found-page.tsx`,
`app/router.tsx`, `app/app-shell.tsx`.

**Tela de erro global** — coluna centrada, `max-width: 28rem` (448px), texto centralizado, na ordem:

| Elemento | Conteúdo literal / dado | Observação |
|---|---|---|
| Grafismo | `espada` (96×48px, cor de acento, opacidade 0,55) | decorativo, `aria-hidden` |
| Título `h1` | "Algo deu errado" | tamanho `--fs-xl` |
| Corpo | "Tente novamente. Se persistir, informe o código de suporte." | cor `--text-muted` |
| Ação | botão primário "Recarregar" | recarrega a página inteira |
| Rodapé | "Código de suporte:" + o código | `--text-faint`, `--fs-caption`, numerais tabulares |

O código de suporte é o `correlationId` real da chamada que falhou; quando a falha não veio da API, é um
fallback local `local-<uuid>`, igualmente longo. → **Problema:** 36+ caracteres com `word-break: break-all`
num campo de 448px; a 390px quebra em duas ou três linhas de letra minúscula — e é justamente o texto que o
vendedor precisa **ler em voz alta ou copiar**. Não há botão de copiar.

**Tela 404** — coluna centrada, na ordem:

| Elemento | Conteúdo literal |
|---|---|
| Grafismo | `arco` (96×48px, acento, opacidade 0,55) |
| Ícone do `EmptyState` | `triangle-alert`, 28px |
| Título `h2` | "Página não encontrada" |
| Descrição | "O endereço que você abriu não existe." |
| Ação | link com aparência de botão primário: "Voltar para Calcular" (vai para `/calcular`) |

→ **Problemas:** (1) o 404 traz **grafismo + ícone de alerta** empilhados, duas peças decorativas
concorrendo; (2) o botão diz "Voltar para Calcular", mas dentro do shell o menu já oferece "Calcular" a dois
centímetros dali — a ação principal duplica a navegação visível.

**O que sobra em volta nas duas telas** (é isto que nunca foi desenhado): a faixa de offline quando aplicável
("Você está offline. O cálculo continua funcionando."), a faixa de sessão expirada quando aplicável ("Sua
sessão expirou" / "Entre de novo para continuar de onde parou." / "Entrar de novo"), a top-bar com marca +
tema + conta, e o menu com os cinco destinos **Calcular · Catálogo · Kits · Orçamentos · Conta** — todos
**clicáveis e navegáveis**, inclusive quando o que quebrou foi a própria árvore de rotas. → **Problema:** o
menu continua se oferecendo como se funcionasse, e ninguém decidiu se ele deve.

## Conteúdo e dados reais

- Todos os textos acima são **homologados — cite-os exatos**. A única frase que marco como fraca é "Voltar
  para Calcular" **no contexto do shell** (ver Perguntas em aberto).
- Código de suporte: dois formatos reais, ambos longos — `7f3c9a12-4b8e-4c21-9d55-a2e1b0f47c38` (UUID de
  correlação do cabeçalho `X-Correlation-Id`) e `local-9f2b7c1a-0e44-4a90-8b3d-6c5e21f0aa77`. Desenhe com o
  **mais longo dos dois**, não com um `ABC-123` de mentira.
- Nada aqui mostra dinheiro, plano, preço ou número do domínio de precificação, nem fala comercial.
- O grafismo é **decorativo** e sem animação (respeita `prefers-reduced-motion`).
- Larguras do shell no desktop: barra lateral **240px** expandida, **76px** recolhida; o conteúdo é o resto.

## Estados obrigatórios

1. **404 em repouso** — grafismo `arco`, "Página não encontrada", "O endereço que você abriu não existe.",
   botão de volta.
2. **Erro global em repouso** — grafismo `espada`, "Algo deu errado", corpo, "Recarregar", "Código de
   suporte:" + código longo.
3. **Foco de teclado** no botão principal e no código de suporte (se ele virar alvo copiável) — anel visível
   contra o fundo real da tela, nos dois temas.
4. **Hover e pressionado** do botão primário ("Recarregar" / "Voltar para Calcular").
5. **Carregando após "Recarregar"** — o clique recarrega a página inteira; mostre o instante entre o clique
   e o recarregamento (botão ocupado, ou nada — mas decida).
6. **Erro + offline** — a faixa "Você está offline. O cálculo continua funcionando." em cima da tela de erro.
   O empilhamento é real e não pode virar duas mensagens que se contradizem.
7. **Erro + sessão expirada** — a faixa "Sua sessão expirou" com "Entrar de novo" sobre a tela de erro: duas
   ações concorrentes ("Entrar de novo" e "Recarregar"); mostre a hierarquia.
8. **Menu durante a falha** — as duas leituras possíveis: (a) menu íntegro e clicável como hoje; (b) menu com
   os destinos atenuados / não navegáveis enquanto a árvore está quebrada. O desenho mostra as duas para o
   dono poder escolher.
9. **Nada renderiza (tela branca)** — o caso `016/A4`: rota de dois segmentos aberta a frio, assets em
   caminho relativo dão 404 e o vendedor vê branco absoluto — sem shell, sem 404, sem tela de erro. Desenhe
   a **tela mínima de salvação** que hoje não existe: marca, uma frase honesta e um caminho de volta.

## Viewports

- **Mobile 390px** — as duas existem no celular. Shell = top-bar + TabBar inferior fixa; a coluna de 448px
  passa a caber justo, e o código de suporte quebra em várias linhas.
- **Desktop 1280px** — onde o menu vira barra lateral com rótulo e pode ser recolhido; menu **expandido**.
- **Desktop 1920px** — obrigatório: é aqui que o defeito de enquadramento fica óbvio. Uma coluna de 448px
  centrada em ~1.680px usa ~27% da largura e a tela de erro parece um recado perdido — o mesmo padrão (39%
  a 1440px) que o 016 já teve de corrigir nas outras páginas.

## Regras que o desenho não pode quebrar

- **Nunca stack trace nem código cru, nunca culpar o usuário** — o único identificador exposto é o
  "Código de suporte:".
- **Falha nunca é vendida como limite de plano** — nada de "assine", "premium" ou caminho comercial aqui.
- **Frase honesta em elemento de largura plena, nunca em placeholder** — a linha do código de suporte cabe
  inteira e legível; se virar campo, não pode ser recortada por reticências.
- **Alvos de toque ≥44px** — botão principal, item de menu, "Entrar de novo" da faixa.
- **Contraste medido contra o fundo real** de cada tema, incluindo a linha `--text-faint` do código de
  suporte — a mais fraca das duas telas e a que mais precisa ser lida.
- **O menu não pode mentir**: destino que não vai funcionar não pode parecer normal.
- **Zero transbordo horizontal a 390px**, com o código de suporte longo presente.

## Armadilhas já pagas neste projeto

- **Transbordo medido, não estimado** — o 016 achou 100,5px de transbordo com um botão nascido fora da
  viewport; o código de suporte com 36+ caracteres e `break-all` é exatamente esse tipo de string.
- **Coluna estreita em campo largo** — 448px sobrevivendo até 1920px já foi defeito de homologação em cinco
  páginas deste app. Não repita só porque a tela é "menor".
- **Texto que passa em teste e não aparece na tela** — asserção de texto é cega para oclusão e recorte; o
  desenho mostra o código de suporte no pior caso (mais longo × tela mais estreita).
- **O caso em que nada renderiza é o mais caro e o único sem desenho** — existe hoje, registrado como
  follow-up, e é a razão de esta peça não ser de prioridade baixa.

## Entregável

Pranchetas, tema **escuro como padrão** e **claro como first-class** (as duas telas nos dois temas):

1. `404 · mobile 390px` — dentro do shell, com TabBar.
2. `404 · desktop 1280px` — menu lateral expandido.
3. `Erro global · mobile 390px` — com o código de suporte longo, quebrando de verdade.
4. `Erro global · desktop 1280px`.
5. `Erro global · desktop 1920px` — a prancheta que resolve a coluna estreita no campo largo.
6. `Erro + offline` e `Erro + sessão expirada` — o empilhamento de faixas e a hierarquia entre as ações.
7. `Menu durante a falha` — duas variantes lado a lado (íntegro × atenuado).
8. `Tela branca / app não subiu` — a tela mínima de salvação, mobile e desktop.

Reutilize os primitivos existentes, não crie novos: `Grafismo` (`espada` no erro, `arco` no 404) ·
`EmptyState` (ícone + título + descrição + ação) no 404 · botão primário `tf-btn tf-btn--primary` em
"Recarregar" e "Voltar para Calcular" · a faixa de status já usada por offline/sessão · barra lateral,
TabBar e top-bar do shell como já desenhadas no 018. Se o código de suporte ganhar copiar, use o
botão-ícone do DS.

## Perguntas em aberto para o dono

1. **O erro e o 404 ficam DENTRO ou FORA do shell?** A decisão central. Dentro: o vendedor continua orientado
   e troca de aba num clique — mas o app parece funcionar enquanto está quebrado. Fora (como o protótipo
   sugeria com o "link de volta ao shell"): a falha fica evidente, ao preço de ele ficar sem menu.
2. **Se ficarem dentro: o menu continua clicável quando a árvore de rotas falhou?** Hoje continua — e se o
   destino também estiver quebrado, o clique leva a outra tela de erro.
3. **"Voltar para Calcular" continua sendo a ação do 404 com "Calcular" já no menu ao lado?** Se sim, é
   redundante; se não, qual passa a ser a ação principal.
4. **O código de suporte ganha botão de copiar?** É longo e existe para ser transmitido a um humano, mas
   copiar é função nova, não desenhada.
5. **A tela branca de dois segmentos (`016/A4`) entra neste desenho ou vira peça própria?**

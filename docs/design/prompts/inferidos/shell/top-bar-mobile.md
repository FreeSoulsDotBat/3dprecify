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

- **Onde vive:** Primeiro elemento visível do shell no mobile depois das faixas de aviso: `<header class="tf-topbar">` de 56px (`--topbar-h`), fundo de cartão, borda de 1px embaixo, atravessando a largura inteira. Dentro dela, três coisas: o símbolo da marca em posição ABSOLUTA no centro exato da barra; e, encostado à direita, o cluster `.tf-topbar__actions` = [e-mail] + botão **Sair** (secundário, pequeno) + botão de tema (44×44, com estado pressionado). O e-mail está no DOM mas fica `display:none` abaixo de 640px — ou seja, no mobile o vendedor vê "Sair" sem ver de quem.
- **Como o vendedor chega:** Está sempre lá, no alto de todas as abas — não se chega a ela, esbarra-se nela. É o primeiro lugar onde o olho procura "quem sou eu aqui" e o lugar de onde se sai do app.
- **Vizinhança imediata:** Acima: a faixa de offline e a de sessão expirada, quando existirem (empurram a barra para baixo). Abaixo: direto o `<main>` da aba atual. Nada à esquerda do logo; entre o logo centralizado e o cluster da direita há espaço vazio variável — o logo está fora do fluxo, então o cluster pode chegar perto dele quando o e-mail reaparece a ≥640px. No desktop esta mesma barra deixa de atravessar a tela: ela começa onde a barra lateral termina e o logo volta a ser um item normal encostado à esquerda.
- **Dados que chegam (e o que ela devolve):** `session.status` e `user.email` do `session-store`; a preferência de tema do `theme-store` (aparelho, aplicada antes do primeiro render); e a rota atual, usada para uma exceção — em `/sign-in` o logo é substituído por um espaçador vazio. Devolve: o pedido de saída, que **não** sai direto — passa pelo guarda (`requestSignOut`).
- **O que acontece depois:** Tocar em Sair com a fila vazia encerra a sessão na hora: os caches por uid são varridos e a rota guardada em que o vendedor estava rebate para `/sign-in`. Com a fila cheia, abre o diálogo bloqueante de saída. Tocar no tema troca claro/escuro instantaneamente em todo o app — e este mesmo par (tema e Sair) existe **de novo** dentro da aba Conta, sem hierarquia declarada entre os dois lugares.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Barra superior do mobile (56px): marca, "Sair" e tema

## O que desenhar
A faixa fixa de 56px que fica no topo de TODAS as telas do app no celular (≤425px), acima do conteúdo e
acima da barra de abas inferior (Calcular · Catálogo · Kits · Orçamentos · Conta). Hoje ela carrega três
coisas ao mesmo tempo: o símbolo da marca centralizado, o botão "Sair" e o botão de alternar tema. Quem a
usa é o vendedor de peças 3D no meio da jornada — ele quase nunca quer sair nem trocar de tema; ele quer
espaço para calcular preço. O desenho pedido é a decisão de COMPOSIÇÃO desses 56px: o que fica, o que sai,
e como a marca convive com o que sobrar.

## Por que este prompt existe
Nada disso foi desenhado — foi inferido por IA ao extrair o cabeçalho inline da versão 001. E não é só
ausência de protótipo: o protótipo **decide o contrário**. §E3 é literal — "**Header minimalista**: só
logo/símbolo. **Migração header→tabs (resolve o cramping mobile, TD-017):** identidade (email), **Sair** e
**toggle de tema** SAEM do header e vão para a aba **Conta**" — e §E7 recebe os três na Conta;
`.design-import/ui_kits/precifica3d/AccountScreen.jsx` materializa isso (tema como `Row`, "Sair" como
`ListItem`, e a única top-bar da tela é `<TopBar title="Conta"/>`, sem e-mail, sem "Sair", sem tema). O
canvas do 018 desenha uma top-bar com e-mail + tema + "Sair", mas dentro do artboard `data-layout="desktop"`
de 1920px, e o arquivo declara não cobrir mobile — viewport errada. **Resultado: o código contraria a única
autoridade que fala do assunto, e a duplicação nasceu daí** — "Sair" e o controle de tema existem hoje DUAS
vezes no mobile (aqui e na aba Conta), sem nenhuma decisão de desenho sobre qual manda.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/top-bar/top-bar.tsx` + `top-bar.css`; a duplicata em
`apps/web/src/pages/conta/conta-page.tsx`.

| Elemento | Como está hoje | Observação |
|---|---|---|
| Faixa | altura 56px (`--topbar-h`), fundo de cartão, borda inferior de 1px, respiro lateral = gutter da tela | fixa em todas as rotas |
| Marca | símbolo compacto (variante "mark"), 32px de altura, **posicionado em ABSOLUTO no centro** da faixa | → o centro é geométrico, não óptico: ele ignora a largura do cluster à direita |
| "Sair" | botão secundário pequeno, texto literal **"Sair"** | → 44px de alvo real; some junto com o cluster se a sessão não estiver autenticada |
| Tema | botão quadrado 44×44 só com ícone (lua no escuro, sol no claro), rótulo assistivo e `title` **"Alternar tema"** | → não diz para onde vai; sem texto visível |
| E-mail | `"Conectado como" + e-mail` existe no mesmo cluster, mas só aparece a partir de 640px | → **no mobile ele NUNCA aparece** (o ramo mobile só monta até 425px): é copy morta nesta viewport |
| Rota `/sign-in` | a marca é suprimida e vira um espaçador invisível (o cartão de login já mostra a marca) | a faixa fica com o cluster sozinho à direita |
| Acima da faixa | banner de offline e banner de sessão expirada, quando existirem | empurram a faixa para baixo |

→ Problemas a resolver no desenho, não a documentar: (a) **a marca centralizada em absoluto colide com um
cluster de largura variável** — hoje "Sair" + tema ocupam ~96px + gutter e não encostam nela a 390px, mas
qualquer rótulo maior, um e-mail reaparecendo ou uma fonte ampliada fecha essa folga sem aviso; (b) **a
duplicação**: o mesmo "Sair" e o mesmo controle de tema estão na aba Conta, que é uma das 5 abas fixas do
rodapé, a um toque de distância; (c) os 56px mais escassos do produto estão gastos com duas ações raras.

## Conteúdo e dados reais
- Marca: símbolo compacto, 32px de altura, texto alternativo **"Precifica3D"**.
- Botão de saída: texto exato **"Sair"** — não "Encerrar sessão", não "Logout".
- Tema: dois estados reais, escuro (ícone de lua, é o padrão do v1) e claro (ícone de sol); rótulo
  assistivo exato **"Alternar tema"**. Na aba Conta o mesmo tema aparece como interruptor no mobile, com a
  legenda da linha e as palavras "Claro"/"Escuro" já usadas no desktop.
- Identidade: prefixo exato **"Conectado como"** + e-mail (ex.: `jonatan.fbossan@gmail.com`), com corte por
  reticências a partir de 220px de largura. Só existe ≥640px.
- Sair não é imediato quando há registros na fila offline: abre um diálogo com o título
  **"{n} registro(s) ainda não foram sincronizados"** e as ações **"Sincronizar agora"** e
  **"Sair e descartar"** (com **"Precisa de conexão para enviar."** quando offline). O desenho da barra
  precisa saber que o botão pode ABRIR ALGO, não só sair.
- Nada aqui exibe dinheiro nem número derivado — é chrome puro. Se algum preço aparecer no desenho, está errado.

## Estados obrigatórios
- **Repouso autenticado**: marca + "Sair" + tema (ou o que o novo desenho decidir manter).
- **Não autenticado / carregando sessão**: o cluster de conta simplesmente não existe — sobra a marca e o
  tema. Desenhe essa faixa: ela é a primeira que o usuário novo vê.
- **Rota de login**: marca suprimida, faixa quase vazia.
- **Foco por teclado**: anel visível nos dois botões, medido contra o fundo de cartão da faixa (não contra
  o fundo da página).
- **Hover e pressionado** nos dois botões; o botão de tema tem estado "pressionado" permanente quando o
  tema é escuro (hoje ele muda cor de ícone e de borda) — mostre os dois.
- **Tema claro e tema escuro** da própria faixa, com a marca correta para cada um.
- **Offline**: o banner **"Você está offline. O cálculo continua funcionando."** aparece ACIMA da faixa —
  desenhe a pilha com ele.
- **Sessão expirada**: banner com **"Sua sessão expirou"**, **"Entre de novo para continuar de onde parou."**
  e a ação **"Entrar de novo"**, também acima da faixa. Nunca fale em conexão aqui — a rede está boa.
- **Sair com fila pendente**: o diálogo descrito acima cobrindo a tela.

## Viewports
Desenhe **390px** (principal) e **360px** (o aperto real — é a largura em que este projeto já mediu
transbordo horizontal três vezes). Um terceiro quadro a **425px** só se a sua composição mudar nesse limite.
**Não desenhe desktop**: acima de 425px o app monta outra estrutura (barra lateral à esquerda, top-bar
começando depois dela, marca alinhada à esquerda em vez de centralizada, e-mail visível) e essa peça já
tem desenho próprio no canvas do 018.

## Regras que o desenho não pode quebrar
- Alvo de toque ≥44px nos dois botões, com folga real dentro de 56px de altura.
- Zero transbordo horizontal a 360px, medido com a caixa e não "de olho": a soma marca + cluster + gutters
  tem que caber, e a marca centralizada em absoluto não pode passar por baixo do cluster.
- A frase honesta nunca mora em `title`/tooltip: se o tema precisa dizer o que faz, diga com texto ou
  mova-o para a Conta, onde a linha já é rotulada.
- Falha de rede jamais vira "faça upgrade" nem some silenciosamente: os dois banners de cima são
  primeiros-classe, não enfeite.
- Contraste medido contra o fundo real da faixa (superfície de cartão), inclusive do ícone de tema no
  estado pressionado.
- Uma única marca por tela: se a rota já mostra a marca no conteúdo (login), a faixa não repete.
- Se o desenho mantiver "Sair"/tema aqui E na Conta, ele precisa dizer explicitamente qual é o principal e
  por que os dois existem. Duplicação sem decisão é o defeito que originou este prompt.

## Armadilhas já pagas neste projeto
- Elemento centralizado em absoluto sobre vizinho de largura variável: `toBeVisible` passa com o elemento
  totalmente ocluído — oclusão não é propriedade de texto. Desenhe a folga; não confie no teste.
- Transbordo horizontal a 360px com botão nascendo fora da viewport (E6/T028) — a mesma classe reapareceu
  na Conta em 2026-08: `right 378,5 > 360`.
- Copy que existe no código e nunca aparece na tela (o "Conectado como" desta barra no mobile; o aviso do
  PR #58 que existia e nunca renderizou). Se um texto está no desenho, ele precisa ter uma viewport em que
  aparece.
- Rótulo que descreve estado em vez de ação: o rail aprendeu isso ("Recolher", não "Recolhido"). "Alternar
  tema" tem o mesmo cheiro — alterna para qual?

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro**, ambas 1:1, sem escala: (1) barra em repouso
autenticado a 390px; (2) barra a 360px com as caixas de medida visíveis; (3) barra sem sessão
(não autenticado); (4) barra na rota de login; (5) foco/hover/pressionado dos dois botões; (6) a pilha
completa com banner de offline e com banner de sessão expirada; (7) — se a sua proposta for a migração do
protótipo — como a aba Conta recebe "Sair" e tema no mobile, e como fica a faixa esvaziada. Reutilize os
primitivos existentes, sem inventar novos: `tf-btn--secondary --sm` para "Sair", o botão-ícone quadrado já
usado na barra para o tema (ou `tf-switch`/`tf-segmented` se ele migrar para a Conta), `tf-logo--mark` para
a marca, `tf-alert` para os banners, `tf-dialog` para a confirmação de saída com fila pendente, `tf-card`
para as linhas da Conta.

## Perguntas em aberto para o dono
1. **Vale a migração do protótipo (§E3/TD-017)?** Ou seja: "Sair" e tema saem da barra do mobile e ficam só
   na aba Conta — que já é uma das 5 abas fixas do rodapé — deixando a faixa com a marca sozinha? É a
   decisão que muda tudo neste desenho, e é de produto, não de código.
2. Se ficarem os dois lugares: **qual manda** e o que justifica repetir? (Hoje ambos escrevem no mesmo
   estado; não há conflito técnico, só ambiguidade de produto.)
3. Se o tema ficar na barra, ele deve dizer para onde vai ("Modo claro"/"Modo escuro") em vez de "Alternar
   tema"? A troca de rótulo é homologação de copy, não escolha do designer.
4. A marca no mobile deve continuar centralizada, ou alinhada à esquerda como no desktop do 018? Centralizar
   é a única razão do posicionamento absoluto que gera o risco de colisão.

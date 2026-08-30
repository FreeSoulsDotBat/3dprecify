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

- **Onde vive:** Rota `/privacidade`, pública, renderizada dentro do shell como qualquer aba: menu montado em volta, barra superior por cima. O conteúdo é uma coluna centrada de no máximo 448px (nem a coluna larga que o resto do app ganhou): um título "Como tratamos seus dados" e, logo abaixo, UM cartão com cinco parágrafos corridos, na ordem login-com-Google · registro de erros técnicos · não vendemos dados · a calculadora funciona sem login · o Premium guarda seu catálogo. Sem seções, sem separadores, sem data de vigência e **sem botão de voltar**.
- **Como o vendedor chega:** Por um único caminho desenhado: o link sublinhado no rodapé da tela Entrar, logo abaixo do cartão de login — ou seja, o vendedor chega aqui no meio do login, antes de decidir se entra. (A aba Conta tem um cartão com o mesmo assunto, mas não linka para cá.)
- **Vizinhança imediata:** Acima do título, a barra superior (com logo, já que não é `/sign-in`) e, se houver, as faixas de aviso; no desktop, o menu de 240px à esquerda. Abaixo do cartão, nada — a coluna termina e sobra vazio até o pé. Nenhum "Voltar para Entrar": a única saída é o menu, que leva para outra seção, não de volta ao login.
- **Dados que chegam (e o que ela devolve):** Nenhum. É texto estático do arquivo pt-BR; não faz pedido, não lê sessão, não lê entitlement, funciona offline.
- **O que acontece depois:** O vendedor sai por onde der: tocando numa aba do menu (indo parar em Calcular/Catálogo/…), ou pelo botão voltar do navegador, que é o que realmente o devolve ao login. Nada aqui muda o estado do app.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Página "Como tratamos seus dados" (rota `/privacidade`)

## O que desenhar
A página pública que responde "o que vocês fazem com meus dados". Ela vive fora do produto pago: é
alcançável **deslogada**, e o único caminho de entrada hoje é um link de rodapé na tela de login —
logo abaixo do botão "Entrar com Google", ou seja, exatamente no segundo em que o vendedor decide se
entrega o e-mail dele. Quem a usa é alguém em dúvida, no meio de uma ação, que quer ler pouco,
entender e voltar. Ela é montada dentro do shell (top-bar + menu lateral no desktop, tab bar no
mobile), então o vendedor vê o menu do produto ao redor de um texto que não pertence a nenhuma das
cinco abas. Desenhar: a leitura das cinco declarações, a hierarquia entre elas, e a volta.

## Por que este prompt existe
Nunca houve desenho desta página. O inventário §E (E1–E9) não tem tela de privacidade — o aviso
legal só aparece como frase solta de rodapé no kit de login antigo ("Ao continuar você concorda com
os Termos e a Política de Privacidade. Os cálculos funcionam offline."), **sem destino nenhum**. O
canvas do 018 desenha "Como tratamos seus dados", mas como um `tf-card` na terceira coluna da aba
Conta, com `<h2>` e **uma** frase: cobre o cartão, não a rota avulsa. O mesmo conteúdo existe hoje
em três tamanhos — **5 frases** na página, **2** no cartão da Conta, **1** no desenho — sem que
ninguém tenha desenhado a relação entre eles. A moldura da página (um cartão único de 448px, sem
volta, sem data) foi inferida por IA.

## O que já existe hoje (não invente do zero — corrija)
Uma seção de largura máxima **448px** (`max-w-md`) centrada, com um `<h1>` "Como tratamos seus
dados" e **um único cartão** (`Card padding="lg"`) contendo cinco parágrafos corridos, separados só
por um respiro de 12px. Sem subtítulos, sem separadores, sem ícones, sem data, sem botão de voltar.

Ordem atual e texto **literal** (nenhuma dessas frases pode ser reescrita sem o dono — a redação foi
ratificada por ele antes da UAT):

| # | Chave | Texto exato hoje |
|---|---|---|
| 1 | `google` | "Para entrar, usamos o Login com Google, que nos informa seu e-mail — usado apenas para identificar sua conta." |
| 2 | `monitoring` | "Registramos erros técnicos (Sentry) para corrigir falhas." |
| 3 | `noSale` | "Não vendemos seus dados nem fazemos rastreamento para publicidade." |
| 4 | `calculatorFree` | "A calculadora funciona sem login e não coleta nada." |
| 5 | `catalogData` | "Se você usar o Premium, salvamos seu catálogo (filamentos, impressoras e produtos) na sua conta para você reutilizar nos cálculos." |

Problemas a resolver no desenho:

→ **Não há volta.** O menu do shell tem cinco itens fixos — Calcular · Catálogo · Kits · Orçamentos
· Conta — e nenhum deles é "Entrar". Quem chegou pelo rodapé do login só volta pelo botão do
navegador; tocar em "Conta" deslogado devolve à tela de login **por acidente** (é uma rota guardada
que redireciona), não por desenho.
→ **A frase 2 e a frase 5 não são da mesma família.** "Registramos erros técnicos (Sentry)" e "Se
você usar o Premium, salvamos seu catálogo" respondem perguntas diferentes (o que é coletado ×
o que é guardado × o que NÃO fazemos), e o cartão único as apresenta como uma lista plana.
→ **"(Sentry)" é jargão** para um vendedor de impressão 3D. É o único nome de fornecedor no texto
sem uma palavra que explique o que ele é.
→ **Nenhuma data de vigência, nenhuma versão.** Uma política sem data é uma política que ninguém
consegue conferir se mudou.
→ **O `<h1>` é solto**, escrito à mão, e não usa o cabeçalho de página do produto — então, ao
contrário de todas as outras telas, o título não recebe foco quando o vendedor navega até aqui
(leitores de tela não são anunciados na chegada) e não existe o espaço de linha de apoio que o
cabeçalho padrão oferece.
→ **O desktop é uma coluna de 448px dentro de um `<main>` que vai até 1720px.** A página nem sequer
usa a largura padrão das telas do 016/018 (460px no mobile, 1120px a partir de 1024px, 1720px a
partir de 1280px). A 1920px o texto ocupa cerca de um quarto da área útil e o resto é vazio.

## Conteúdo e dados reais
Não há campos, números nem dinheiro nesta peça: é conteúdo estático, sem chamada de rede, sem
formulário e sem nada que o vendedor possa alterar. O que existe de concreto:

- **Título**: "Como tratamos seus dados" — o mesmo texto é o rótulo do link no rodapé do login e o
  `<h2>` do cartão da Conta (três lugares, uma string).
- **Link de origem** (tela de login, abaixo do cartão de entrada): sublinhado, tamanho pequeno, cor
  de texto secundário, medido em **181×20px** e forçado a **24px de altura mínima** por ser um link
  de rodapé solto, não um link dentro de uma frase.
- **Cartão gêmeo na Conta** (terceira coluna do desktop, abaixo do tema, acima de "Sair"): título +
  frases 1 e 3 apenas, **sem link para esta página** — a Conta mostra dois quintos da política sem
  dizer que existe mais.
- **Fora do escopo declarado**: não há gestão de consentimento, exclusão de dados, e-mail de contato
  nem "Termos de Uso"; o desenho **não pode sugerir** que existam.

## Estados obrigatórios
Poucos, e é honesto que sejam poucos — o código não tem carregamento, erro nem vazio aqui. Desenhe
só o que existe de verdade:

- **Repouso** — a página completa, deslogado (é o caso principal: veio do login).
- **Repouso, logado** — o mesmo conteúdo com a aba de origem ainda destacada no menu; mostre que a
  página não pertence a nenhuma aba e como isso é resolvido visualmente.
- **Foco de teclado** no link/botão de voltar e no título (anel de foco visível sobre o fundo real
  do cartão, não sobre o fundo da página).
- **Hover e pressionado** do controle de volta.
- **Offline** — a faixa de offline do shell aparece acima de tudo, mas a página **funciona inteira
  offline** (é texto): desenhe a faixa presente e nenhum aviso de "conteúdo indisponível".
- **Sessão expirada** — a faixa fixa "Entrar de novo" do shell também pode estar aqui; desenhe a
  convivência das duas faixas com o título.
- Não há estado premium, pausado, degradado nem sem permissão nesta peça — criar um é inventar
  produto.

## Viewports
- **390px (mobile)** — obrigatório: é o aparelho em que o vendedor lê isso, e a tab bar fixa embaixo
  come altura no fim do texto.
- **1280px** — o corte em que o menu lateral e a largura larga entram; é onde o cartão de 448px
  começa a parecer perdido.
- **1920px** — obrigatório *porque é onde o defeito é maior*: 448px de texto num `<main>` de até
  1720px. Precisa de uma decisão de medida de linha (o texto de leitura não deve virar uma linha de
  dois metros — mas também não pode ser um quarto da tela vazia).

## Regras que o desenho não pode quebrar
- **As cinco frases são texto ratificado.** Podem ser reagrupadas, tituladas e reordenadas; **não
  podem ser reescritas, resumidas nem suavizadas** neste desenho. Se alguma precisar mudar, isso vira
  pergunta ao dono, não uma edição.
- **Nada de linguagem de marketing** e **nenhum direito que não existe**: sem "seus dados estão
  seguros conosco", sem "solicite a exclusão", sem "Termos de Uso" clicável — nada está construído.
- **A frase 4 é uma promessa dura** ("A calculadora funciona sem login e não coleta nada.") e precisa
  de peso visual; **a frase 5 não é oferta** — é declaração de tratamento de dado, sem botão de
  assinar nem selo de premium ao lado.
- **Frase honesta nunca em placeholder** nem cortada por reticências: tudo aqui é conteúdo em
  elemento de largura cheia.
- **Alvo de toque ≥44px** no controle de volta (o link de origem vive com 24px por ser texto de
  rodapé; o botão desta página não tem essa desculpa) e **contraste medido contra o fundo real do
  cartão**, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Transbordo medido nos dois eixos.** A frase 5 passa de 130 caracteres e a frase 1 tem um
  travessão que não quebra; a 390px, com a tab bar embaixo, o teste automatizado não vê barra de
  rolagem clássica — mede-se a geometria, inclusive no eixo vertical.
- **Texto ocluso passa em teste.** "Está visível" não é propriedade do texto: mostre caixas que não
  se sobrepõem, especialmente com as duas faixas do shell empilhadas no topo.
- **O desktop largo já foi um vazio de 37%** numa outra tela antes do 016; esta página é o último
  lugar com o problema na forma original.
- **Repetição sem procedência**: três cópias do mesmo texto com tamanhos diferentes é o que gerou
  esta ficha — um desenho que crie uma quarta versão piora o problema.

## Entregável
Pranchetas, todas em **tema escuro** (padrão) e com **pelo menos duas repetidas em tema claro** (o
claro é first-class e este texto tem muita superfície):

1. **Mobile 390px — repouso, deslogado**: a página inteira, do título ao fim do texto, com a tab bar.
2. **Mobile 390px — a chegada**: recorte da tela de login com o link de rodapé, para amarrar origem e
   destino (mostrando o rótulo "Como tratamos seus dados" como ele é hoje).
3. **Desktop 1280px — repouso**, com o menu lateral expandido.
4. **Desktop 1920px — repouso**, resolvendo a medida de linha e o vazio.
5. **Estados**: foco de teclado no controle de volta, hover/pressionado, e a versão com faixa de
   offline + faixa de sessão expirada presentes ao mesmo tempo.
6. **Relação com o cartão da Conta**: um recorte lado a lado da terceira coluna da Conta (título + 2
   frases) e o topo desta página, propondo como um remete ao outro.

Reutilize os primitivos existentes, sem criar novos: o **cabeçalho de página** do produto para o
título (é ele que dá o foco na chegada e a linha de apoio), o **cartão** (`tf-card`) para os blocos
de texto, o **botão secundário** com ícone para a volta, o **separador** do DS entre grupos, a
**faixa/alerta** do DS para os avisos do shell, e a **largura de página larga** do 016/018 no lugar
do `max-w-md`. Rótulos de seção usam o nível de título do DS abaixo do `<h1>`.

## Perguntas em aberto para o dono
1. **"Termos de Uso" existem?** O kit de login antigo prometia "os Termos e a Política de
   Privacidade"; hoje só a Política existe e não há rota de Termos. O desenho cita um único
   documento ou dois?
2. **Data de vigência / versão**: a página deve mostrar "Atualizado em {data}"? Não existe nada
   disso hoje, e criar o carimbo é decisão de produto (obriga a manter).
3. **A relação página × cartão da Conta**: o cartão da Conta continua com as 2 frases e sem link
   (como está e como o canvas 018 desenhou), ou vira um resumo **com** "Ler a política completa"?
   As duas respostas mudam o desenho dos dois lados.
4. **A volta**: quando o vendedor chega deslogado, o botão de voltar leva a **/sign-in** (a origem
   real) ou à calculadora (a única tela pública de produto)? O menu não tem "Entrar".
5. **A frase do Sentry**: "(Sentry)" pode ganhar cinco palavras de explicação — "um serviço que nos
   avisa quando algo quebra" — ou a redação ratificada é intocável?
6. **Cancelamento do Premium**: o texto deve dizer o que acontece com o catálogo salvo quando a
   assinatura acaba? Hoje a política não diz, e o produto tem lapso/pausa.
7. **Canal de contato**: existe um e-mail para pedido sobre dados? Não há nenhum no app; sem isso, o
   desenho não pode oferecer "Fale conosco".

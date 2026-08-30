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

- **Onde vive:** Estado do layout entre 600px e 1023px: a barra lateral está **expandida em 240px** (ícone + rótulo, item ativo com fundo roxo suave, sem botão de recolher) e a coluna de conteúdo dentro do `<main>` continua limitada a 460px — o teto do mobile. Resultado: menu de 240px, coluna de 460px encostada à esquerda e algumas centenas de pixels de vazio à direita, com goteira de desktop em volta.
- **Como o vendedor chega:** Tablet na horizontal, janela de navegador em meia tela na bancada, monitor pequeno. É a largura em que muita gente realmente usa um app web enquanto trabalha ao lado da impressora.
- **Vizinhança imediata:** À esquerda a coluna do menu de altura total; acima, a barra superior com logo de 40px à esquerda e identidade + tema à direita; à direita da coluna de conteúdo, vazio. As páginas que o 016/018 alargaram só sobem para 1120px a partir de 1024px e para 1720px a partir de 1280px — abaixo disso elas se comportam como telefone esticado.
- **Dados que chegam (e o que ela devolve):** Só largura de janela: acima do limiar de rail forçado (599px) e abaixo do corte de 1280px. Nenhuma composição de mestre-detalhe existe aqui — abaixo de 1280px o app monta o mesmo ramo de código do mobile, então clicar num cartão **navega**, não seleciona.
- **O que acontece depois:** Descendo abaixo de 600px o menu recolhe sozinho para 76px; subindo acima de 1280px aparecem, ao mesmo tempo, o botão Recolher no rodapé do menu, a coluna larga e a ficha lateral das quatro abas redesenhadas. Nada muda de conteúdo — muda só quanto do espaço é usado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# A faixa intermediária: o shell entre 600px e 1023px

## O que desenhar

O quadro do aplicativo (menu lateral + barra de topo + área de conteúdo) nas larguras de tablet e de
janela de navegador meia-tela — de 600px a 1023px. É o mesmo shell que já existe no telefone e no
desktop, mas nessa faixa ele monta uma combinação que ninguém desenhou: o menu lateral **expandido**
de 240px ao lado de uma coluna de conteúdo travada em 460px (a largura do telefone). Quem vive aqui é
o vendedor que abre o Precifica3D no tablet em cima da bancada, ao lado da impressora, ou que deixa o
navegador em meia tela num monitor comum. Ele vê as mesmas quatro telas de sempre — Catálogo, Kits,
Orçamentos, Conta — e a de Calcular, só que num quadro que não foi pensado para essa largura.

## Por que este prompt existe

Nenhuma autoridade de desenho cobre esta faixa. O §H entrega "**todas as telas** (E1–E9) em **mobile
(~390px)** e **desktop**" — dois pontos, sem meio. O §C.5 declara só duas larguras de referência
(460px mobile, 1120px desktop), e é exatamente esse par que o CSS usa: o que existe entre elas é
**interpolação de código**, não decisão de produto. O canvas do 018 tem um único artboard, de 1920px,
e o próprio corte de 1280px é a fronteira declarada dele. A auditoria só encostou no assunto pelo teto
e o item ficou NÃO CORRIGIDO em duas rodadas, com a recomendação final "absorva os resíduos no app" —
ou seja, a decisão foi explicitamente delegada ao código.

## O que já existe hoje (não invente do zero — corrija)

O quadro, de fora para dentro, na faixa:

| Peça | Comportamento hoje | Observação |
|---|---|---|
| Menu lateral | **Expandido, 240px**, ícone + rótulo, fundo de cartão, borda à direita | Fixo no topo, altura da janela, rola sozinho |
| Botão "Recolher" | **Não existe nesta faixa** — só aparece a partir de 1280px | → o vendedor não tem como devolver os 164px |
| Barra de topo | Começa **depois** do menu, logo horizontal completo (40px de altura) à esquerda, ações à direita | E-mail da conta só aparece a partir de 640px |
| Coluna de conteúdo | `max-width: 460px`, **centralizada** na área restante (`mx-auto`) | → a ficha da auditoria diz "encostada à esquerda"; **está errado, ela é centralizada** |
| Goteira da área principal | 32px de cada lado (a goteira "desktop") | Mobile usa 16px |
| Composição mestre-detalhe | **Desligada** — as telas do 018 só existem a partir de 1280px | Aqui o card do catálogo **navega**, não seleciona |
| Barra inferior de abas | Não existe (só até 425px) | |

O número que decide este desenho — a **descontinuidade dos 600px**:

| Largura da janela | Menu | Largura útil do conteúdo | Sobra vazia |
|---|---|---|---|
| 390px (telefone) | nenhum | **358px** | 0 |
| 599px | rail de 76px | **459px** | 0 |
| **600px** | **expandido, 240px** | **296px** | 0 |
| 768px (tablet retrato) | 240px | 460px (teto) | ~4px |
| 834px | 240px | 460px (teto) | ~70px (35 de cada lado) |
| 1023px | 240px | 460px (teto) | **~259px** — 64% da área usada |
| 1024px | 240px | 719px (teto sobe para 1120) | 0 |

→ **Ao ganhar 1 pixel de largura, a janela perde 163px de conteúdo.** De 599px para 600px o menu
deixa de ser um rail de 76px e vira uma coluna de 240px, e a coluna de trabalho cai de 459px para
296px — 62px **mais estreita do que num telefone de 390px**. Esse é o pior ponto da faixa e é
puramente acidental: os dois limiares (425px do mobile, 599px do rail forçado, 1024px do teto de
conteúdo, 1280px do mestre-detalhe) foram decididos em momentos diferentes e nunca conferidos juntos.

→ No outro extremo, a 1023px, sobram 259px de vazio simétrico ao redor de uma coluna de telefone
esticada ao lado de um menu grande demais. É a mesma classe de desperdício que a homologação do 016
mediu a 1440px ("~39% usado") antes de criar a coluna larga.

## Conteúdo e dados reais

- Itens do menu, na ordem e com o texto exato: **"Calcular"**, **"Catálogo"**, **"Kits"**,
  **"Orçamentos"**, **"Conta"**. Rótulo de acessibilidade do bloco: "Navegação principal". O item da
  seção atual tem fundo de realce (accent suave).
- Botão do rodapé do menu (hoje só ≥1280px): diz o que **vai acontecer**, não o estado — "Recolher"
  quando expandido, "Expandir" quando recolhido.
- Barra de topo: logo horizontal completo, botão de tema, e-mail da conta e "Sair". O e-mail é
  truncado com reticências a partir de 220px de largura.
- Banners do quadro, com o texto literal (aparecem acima de tudo, empurrando o conteúdo):
  - offline: "Você está offline. O cálculo continua funcionando."
  - fila pendente: "Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos
    quando você voltar a ficar online."
  - sessão: título "Sua sessão expirou", corpo "Entre de novo para continuar de onde parou.", ação
    "Entrar de novo".
- Conteúdo real para preencher as pranchetas (não use texto genérico): a lista de **Orçamentos**, com
  subtítulo "O que você cotou, com a data. Os valores ficam congelados como estavam no dia." e linhas
  com valores de verdade — R$ 16,16 · R$ 24,24 · R$ 21,01 · R$ 1.234,56 para testar o número longo.
- Alturas fixas: barra de topo 56px; alvo mínimo de toque 44px; grade de 4px.

## Estados obrigatórios

- **Repouso** na faixa, com a seção atual realçada no menu.
- **Foco por teclado** num item do menu — o menu é um conjunto só: as setas movem entre os itens e
  existe um único ponto de parada de tabulação. O anel de foco tem de ser visível sobre o fundo do
  menu, que é o fundo de cartão e não o fundo da página.
- **Passagem do mouse** e **pressionado** num item do menu.
- **Menu recolhido** (rail de 76px, só ícones): é o que acontece abaixo de 600px hoje. Desenhe-o
  também dentro da faixa, porque é a alternativa mais óbvia para a descontinuidade. O rótulo **some da
  tela mas continua sendo lido em voz alta** — nunca desenhe como se o nome deixasse de existir; e o
  nome volta ao mouse como dica.
- **Rolagem longa**: o menu fica preso no topo com a altura da janela e rola por dentro; o conteúdo
  rola por fora. Mostre uma prancheta com a página comprida para provar que o rodapé do menu fica
  alcançável sem rolar a página inteira.
- **Offline** e **sessão expirada**: o banner ocupa a largura toda acima do quadro; mostre como ele
  convive com o menu à esquerda.
- **Lista vazia** e **carregando** de uma das telas dentro da coluna estreita de 296px — é onde o
  texto quebra pior.
- **Valor grande**: R$ 1.234,56 e um nome de produto longo na coluna de 296px.

## Viewports

Só desktop-shell: esta peça **não existe no telefone** (abaixo de 426px não há menu lateral nenhum), e
acima de 1280px ela é substituída pela composição mestre-detalhe do 018, que já tem desenho. Desenhe:

- **599px e 600px lado a lado** — o par que expõe a descontinuidade. É a prancheta mais importante.
- **768px** (tablet em retrato) — a largura mais comum da faixa.
- **1023px** — o pior desperdício, imediatamente antes do teto de conteúdo subir.

## Regras que o desenho não pode quebrar

- **Zero rolagem horizontal em qualquer largura da faixa**, medida nos dois eixos.
- A coluna de trabalho **nunca pode ser mais estreita do que num telefone de 390px**. Se a solução for
  manter o menu expandido a 600px, ela precisa render pelo menos 358px de conteúdo.
- Alvos de toque de 44px no menu e na barra de topo — no tablet o dedo é o ponteiro.
- O menu não é conteúdo: se ele ocupa mais de um terço da largura da janela, está errado.
- Contraste medido contra o fundo real de cada peça (menu = fundo de cartão; conteúdo = fundo base).
- O rótulo escondido continua existindo para leitor de tela — o desenho pode ocultar visualmente, mas
  não pode ser desenhado como "sem nome".
- Nada de nova primitiva: o menu, a barra de topo e os cartões já existem.

## Armadilhas já pagas neste projeto

- **131px de transbordo medidos** na faixa logo abaixo desta (426–599px) com o menu expandido — a
  medição acusou a página inteira, não um elemento. Foi o que obrigou o rail forçado. Repetir o menu
  de 240px sobre uma coluna estreita repete o defeito.
- **O headless não enxerga barra de rolagem clássica**: transbordo vertical no tablet é invisível a
  teste automático. Desenhe contando que a régua é o olho.
- **Texto ocluso passa em teste**: um rótulo cortado pelo menu ou pela borda da coluna continua
  "visível" para o teste. As colisões desta faixa só aparecem na imagem.
- **~39% da área usada a 1440px** foi o que gerou a coluna larga do 016; a faixa 600–1023 nunca
  recebeu o mesmo tratamento e hoje chega a 64%.
- **Frase honesta nunca dentro de campo vazio**: os textos de offline/sessão vivem em elementos de
  largura inteira, e nessa faixa a largura inteira é menor do que se imagina.

## Entregável

Pranchetas em tema **escuro (padrão)** e as duas mais decisivas — o par 599/600 e a de 1023px —
repetidas em tema **claro**. Em cada uma, o quadro completo: menu, barra de topo, banners quando o
estado pedir, e uma tela real dentro (use Orçamentos com dados de verdade). Reaproveite os primitivos
existentes: o cartão para o painel do menu e para as linhas da lista, o botão fantasma para "Recolher"
e para o botão de tema, o rótulo de estado para o banner de offline, o preço grande para o valor da
linha. Marque na prancheta, com cota numérica, a largura do menu, a largura da coluna de conteúdo e a
sobra de cada lado — é a cota que resolve esta peça, não a estética.

## Perguntas em aberto para o dono

1. **Na faixa 600–1023px o menu deve nascer recolhido (rail de 76px) ou expandido?** Recolher devolve
   164px de conteúdo e elimina a descontinuidade dos 600px; expandir mostra os rótulos. Não há
   decisão registrada.
2. **Deve existir o botão "Recolher"/"Expandir" nesta faixa?** Hoje ele é exclusivo de ≥1280px, onde
   recolher é preferência. Aqui seria espaço — e se o menu nascer recolhido, expandir pode voltar a
   apertar o conteúdo.
3. **A coluna de conteúdo deve continuar travada em 460px até 1024px, ou crescer junto com a janela?**
   Se crescer, a partir de que largura e com que teto?
4. **Vale antecipar alguma composição de duas colunas antes dos 1280px** (por exemplo, lista + ficha
   mais estreita a partir de 1024px), ou a faixa toda é coluna única por decisão?
5. **O tablet em paisagem (1024–1279px) fica com o desenho desta faixa ou com o do desktop?** Hoje ele
   fica no meio: coluna larga de 1120px, mas sem mestre-detalhe.

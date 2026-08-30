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

- **Onde vive:** Estado da coluna do menu na faixa de 426px a 599px de largura: o shell já usa o layout de desktop (não há barra de abas em lugar nenhum) e a barra lateral nasce **recolhida em 76px**, com os cinco itens centrados, só ícone de 22px, rótulo escondido visualmente (continua no DOM para leitor de tela) e o nome disponível apenas como dica do sistema ao passar o mouse. E o rodapé do menu fica **vazio**: o botão Recolher/Expandir só é entregue acima de 1280px, então nessa faixa não há como abrir.
- **Como o vendedor chega:** Janela de navegador estreita no desktop, aparelho grande em paisagem, tela dividida. O vendedor não escolhe entrar aqui — ele arrasta a janela ou vira o telefone e o menu encolhe sozinho.
- **Vizinhança imediata:** À esquerda da tela, a coluna de 76px grudada no topo, com altura de janela e rolagem própria. À direita dela, a barra superior (logo grande de 40px + cluster de identidade + tema) e, embaixo, o `<main>` com goteira larga — sobram ~318px de conteúdo em 426px. Acima de tudo, as faixas de aviso, quando existirem. Abaixo do último ícone do menu, espaço vazio até o pé da janela.
- **Dados que chegam (e o que ela devolve):** Duas leituras de largura do mesmo hook: `>425px` (deixa de ser mobile) e `≤599px` (recolhe à força). Nenhum dado de negócio. Devolve uma largura de coluna que o resto do app consome por uma única variável — recolher devolve pixels ao conteúdo sem nenhuma página saber disso.
- **O que acontece depois:** Clicar num ícone navega normalmente e o ícone ativo ganha o fundo roxo suave. Abaixo de 426px o menu vira barra de abas com rótulos de volta; acima de 600px a coluna se expande sozinha para 240px com rótulos; acima de 1280px aparece o botão Recolher no rodapé do menu e o recolhimento vira escolha guardada no aparelho.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Menu recolhido à força — a faixa de 426px a 599px

## O que desenhar
A navegação principal do app quando a janela tem entre **426px e 599px** de largura: larga demais para a barra inferior do celular (que só existe até 425px) e estreita demais para a barra lateral de 240px. Hoje, nessa faixa, o app monta a barra lateral **já recolhida** num rail de **76px** com cinco ícones sem rótulo e **sem nenhum botão para expandir**. Quem cai aqui: o vendedor que usa o Precifica3D numa janela encaixada em metade da tela do PC, num tablet em pé, ou num celular grande em paisagem. É a primeira coisa que ele vê ao abrir qualquer aba — Calcular, Catálogo, Kits, Orçamentos e Conta — e é por onde ele troca de seção o dia inteiro.

## Por que este prompt existe
O canvas do 018 (`Abas-Desktop.dc.html`) **desenhou o rail recolhido de verdade** — largura animada, rótulos que somem, ícones centralizados e até a dica por `title` em cada item vieram do desenho, não de invenção. O que ele nunca desenhou foi **este** caso: lá o rail é uma *escolha* do vendedor num artboard de 1920px, com o botão "Recolher" no rodapé do menu — exatamente o botão que aqui não existe. O protótipo §H só pede "mobile (~390px) e desktop"; §E3 só conhece BottomBar **ou** Sidebar. A faixa intermediária não foi desenhada por ninguém: o limiar de 600px nasceu de uma **medição** no review do PR #58 (2026-08-15), que acusou 131px de transbordo da página inteira a 426px. Ou seja: a resposta a "não cabe" foi escolhida por um review técnico, não por desenho.

## O que já existe hoje (não invente do zero — corrija)
A coluna do menu com `--sidebar-w: 76px`, colada no topo, altura da janela inteira (`100dvh`, rolagem própria), à esquerda de tudo — inclusive do cabeçalho. Dentro dela, cinco links empilhados, na ordem:

| Ordem | Rótulo literal (pt-BR) | Ícone | Rota |
|---|---|---|---|
| 1 | "Calcular" | calculadora | `/calcular` |
| 2 | "Catálogo" | pacote | `/catalogo` |
| 3 | "Kits" | caixas | `/kits` |
| 4 | "Orçamentos" | histórico | `/historico` |
| 5 | "Conta" | usuário em círculo | `/conta` |

- O menu se anuncia como "Navegação principal".
- Recolhido, **o rótulo continua existindo** para leitor de tela (escondido visualmente, nunca apagado) e o nome só aparece na tela como **dica de `title`** — → **problema central a resolver: `title` é dica de MOUSE, e essa faixa é tocada com o dedo.** O vendedor não tem como descobrir o nome de nenhuma das cinco seções.
- O botão "Recolher" / "Expandir" (ícone de painel à esquerda, no rodapé do menu) **existe apenas a partir de 1280px**. → Nesta faixa não há saída: o rail é imposto e não tem volta. Expandir devolveria o transbordo, então "só colocar o botão" não é a correção — é preciso desenhar como o nome chega ao dedo.
- À direita do rail fica a coluna de conteúdo (a **426px sobram ~350px**), e dentro dela o cabeçalho com o logotipo horizontal completo de 40px de altura + "Conectado como {e-mail}" + "Sair" + "Alternar tema". → **Suspeita forte de aperto:** esse cabeçalho foi desenhado para conviver com uma janela larga, não com 350px.
- Acima de tudo podem aparecer duas faixas: o aviso de offline e o aviso de sessão expirada ("Entrar de novo").

## Conteúdo e dados reais
- Larguras reais: menu expandido **240px**, rail **76px**. A conta que decidiu o rail: 426 − 76 − 32 de goteira ≈ **318px** de conteúdo utilizável; com 240px de menu sobrariam ~150px, e nada do produto cabe nisso.
- A troca de largura é **animada em 0,18s** (suavização de saída) — o desenho precisa dizer o que acontece durante a mudança de faixa.
- Ícone: **22px**. Alvo de toque: **≥44×44px** em cada item (regra dura do projeto, não sugestão).
- Seção ativa: cor de destaque no texto **e** no ícone + peso mais forte + fundo suave de destaque. Na barra inferior do celular ela ganha ainda um traço de 28×3px no topo do item; no rail, hoje, **não ganha nada equivalente** — → decida se o rail precisa de um marcador de forma (não só de cor).
- Nada aqui mostra dinheiro. Os únicos números da peça são geometria.

## Estados obrigatórios
1. **Repouso** — cinco ícones em cor apagada, centralizados na coluna de 76px.
2. **Seção ativa** — cor de destaque + fundo suave; deve continuar legível para quem não distingue cor.
3. **Hover** (mouse, que existe nessa faixa em janela de PC) — e o que aparece junto: hoje é só a dica nativa do sistema.
4. **Foco de teclado** — anel **interno** que abraça o cantinho arredondado do item + fundo suave; ele precisa ser visivelmente diferente do estado ativo **mesmo quando o item já está ativo** (isso já reprovou uma vez: foco no item ativo não mudava nada). Em modo de alto contraste forçado, o anel vira contorno do sistema.
5. **Pressionado** (toque) — hoje não há nada desenhado; é a oportunidade natural de revelar o nome.
6. **Item de seção guardada sem sessão** — Catálogo, Kits, Orçamentos e Conta levam a áreas com login; o menu não desabilita nada, e a recusa acontece depois. Diga se isso muda algo visualmente (recomendação: **não** invente cadeado no menu).
7. **Offline** — a faixa de offline empurra tudo para baixo; o rail (colado no topo, altura da janela) precisa continuar coerente com a faixa em cima.
8. **Sessão expirada** — a mesma coisa, com a faixa fixa "Entrar de novo".
9. **Menu com rolagem própria** — a coluna tem `100dvh` e rola sozinha; em paisagem de celular (altura ~390px) os cinco itens + o cabeçalho podem não caber. Desenhe esse caso.
10. **Transição entre faixas** — 599px → 600px o menu se expande sozinho para 240px e o botão "Recolher" **ainda não** aparece (ele só nasce a 1280px). O desenho precisa assumir explicitamente essa descontinuidade ou propor outra.

## Viewports
- **426px** (obrigatório) — o pior caso: o primeiro pixel em que a barra lateral monta, com só ~350px de conteúdo. É onde a medição achou 131px de transbordo.
- **599px** (obrigatório) — o último pixel da faixa, o caso folgado, para mostrar que a mesma peça serve os dois extremos.
- **390px** (referência, não entrega) — a barra inferior de celular, **para comparar**: é a experiência que o vendedor perde ao ganhar 36px de largura. Desenhe-a lado a lado só para sustentar a decisão.
- **1280px** (referência) — o rail **por escolha**, com o botão "Recolher" no rodapé, já desenhado no canvas do 018. O desenho novo precisa ser irmão dele, não um segundo dialeto.
- Fora de escopo: 1920px (já desenhado).

## Regras que o desenho não pode quebrar
- **O nome da seção não pode depender de mouse.** Numa largura tocada, uma dica de passagem do cursor é uma ausência disfarçada de recurso.
- **O rótulo nunca é apagado da árvore de acessibilidade** — o que se vê pode sumir; o que se ouve continua sendo "Catálogo".
- **Expandir não é a saída.** Se o desenho propuser voltar para 240px nessa faixa, ele reintroduz o transbordo medido. A solução tem que caber em 76px (ou propor uma terceira forma — barra superior de ícones, gaveta temporária, etc.).
- **Alvo ≥44×44px** em todos os cinco itens, inclusive no rail estreito.
- **Contraste medido contra o fundo real** (a superfície de cartão do menu, não o fundo da página) — nos dois temas.
- **Zero rolagem horizontal** em 426px: nem na página, nem dentro do menu.
- Nada de vender falha de rede ou falta de sessão como bloqueio de plano: o menu não é lugar de teaser.

## Armadilhas já pagas neste projeto
- **Transbordo medido na página inteira, não num elemento** (131px a 426px): a culpa era da composição, e por isso a correção foi de largura de menu. Qualquer desenho aqui precisa declarar a conta de larguras que fecha em 426px.
- **Headless não enxerga barra de rolagem clássica** — o transbordo do item 9 do 016 só apareceu medindo o eixo **vertical** também. Desenhe prevendo os dois eixos.
- **Texto ocluso passa em teste**: `toBeVisible` aprova elemento coberto. O que decide layout aqui é caixa, não string.
- **Frase honesta em `placeholder` some** (016/PR-F): qualquer texto explicativo que este desenho introduzir vive em elemento próprio, com largura para caber.
- **O cabeçalho ao lado do rail é o suspeito seguinte**: logotipo horizontal de 40px + "Conectado como {e-mail}" + "Sair" + "Alternar tema" numa coluna de ~350px. Trate como parte da peça, não como vizinho.
- **`display:none` no rótulo** foi o que o arquivo de design original propunha, e teve que ser trocado no código por esconder-visualmente. Se o novo desenho remover o rótulo, remova-o **visualmente**.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro em pé de igualdade**, reutilizando os primitivos existentes em vez de criar novos:

1. **426px — repouso**, com a conta de larguras anotada (76 + goteira + conteúdo).
2. **426px — a solução para o nome**: a sua proposta de como o vendedor descobre "Orçamentos" sem mouse (rótulo micro sob o ícone dentro dos 76px? revelação ao toque? gaveta temporária sobre o conteúdo?). Anote o alvo de 44px sobre o desenho.
3. **426px — estados**: ativo, foco de teclado (anel interno), pressionado, hover — os quatro na mesma prancheta, comparáveis.
4. **599px** — o mesmo repouso no extremo folgado.
5. **426px com as duas faixas** (offline + sessão expirada) e com o menu rolando em altura curta.
6. **Tira comparativa**: 390px (barra inferior) · 426px (esta peça) · 1280px (rail por escolha, com "Recolher"), para provar continuidade.

Use `tf-nav--sidebar` + `tf-nav--rail` como a coluna, `tf-nav__item` como o alvo de cada seção (com o ícone do conjunto do DS em 22px e o rótulo escondido visualmente), `tf-topbar` para o cabeçalho apertado, e a variável de largura do menu (`--sidebar-w`) como a única alavanca de largura. Não crie um componente de menu novo: esta peça é um **estado** do menu que já existe.

## Perguntas em aberto para o dono
1. **A resposta certa a "não cabe" é o rail — ou é manter a barra inferior do celular até 599px?** Ninguém decidiu isso por desenho; o corte em 425px veio de uma decisão de 2026-07-03 e o rail forçado de uma medição de 2026-08-15. Trocar o limiar da barra inferior de 425px para 599px resolveria a peça inteira sem rail nenhum.
2. **Como o vendedor descobre o nome das cinco seções nessa faixa?** Rótulo miúdo sob o ícone (cabe em 76px, mas encolhe o alvo), revelação ao toque longo, ou uma gaveta temporária que abre sobre o conteúdo e fecha ao escolher? São produtos diferentes.
3. **O cabeçalho encolhe junto?** Abaixo de 600px, o logotipo vira só a marca (como no celular) e o "Conectado como {e-mail}" some, sobrando "Sair"? Ou o cabeçalho fica como está?
4. **A descontinuidade em 600px é aceitável?** Hoje, ao passar de 599 para 600, o menu abre sozinho para 240px e o vendedor segue sem botão para recolher até 1280px. Deveria haver botão já a partir de 600px?

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

- **Onde vive:** Diálogo modal montado pelo próprio shell (irmão do corpo, acima de tudo: véu e caixa em z-index 70/71, portanto por cima até dos toasts), centrado na tela, **sem X de fechar**. Passo 1: título com a contagem ("{n} registro(s) ainda não foram sincronizados"), corpo, um aviso vermelho de sincronização parcial que só aparece DEPOIS de uma tentativa que sobrou item, e uma **coluna vertical** de ações nesta ordem — "Sincronizar agora" (primário; desabilitado offline, com a legenda centrada "Precisa de conexão para enviar." logo abaixo dele), "Sair e descartar" (vermelho), "Voltar" (secundário). Passo 2, na mesma caixa: "Descartar {n} registro(s) e sair?" com [Voltar] [Descartar e sair] alinhados à direita.
- **Como o vendedor chega:** Sempre por um clique em **Sair** — e são dois botões diferentes: o da barra superior (canto direito, em qualquer aba) e o da aba Conta (na terceira coluna do desenho desktop). Ambos passam pelo mesmo guarda; se a fila estiver vazia, o diálogo nem aparece e a saída acontece na hora. Ele só existe para quem tem trabalho não sincronizado — o caso do vendedor que orçou na feira, sem sinal.
- **Vizinhança imediata:** Por baixo, escurecida pelo véu, fica a tela em que o vendedor estava (qualquer aba) com o menu e as faixas ainda de pé. Nada mais do app é clicável enquanto ele estiver aberto, e a saída fica literalmente suspensa esperando a resposta.
- **Dados que chegam (e o que ela devolve):** A contagem vem da leitura do outbox por uid (fila local de escrita); a conectividade vem do hook compartilhado e é assinada ao vivo, então um diálogo aberto offline reabilita "Sincronizar agora" no instante em que a rede volta. "Sincronizar agora" tenta enviar cada item ao servidor e reconta o que sobrou. Devolve UMA decisão: prosseguir com a saída ou não.
- **O que acontece depois:** Sincronizou tudo → sai sem perder nada e as listas de Orçamentos são revalidadas. Sobrou item → o diálogo **não** deixa sair: recontagem no título e o aviso vermelho "continuam neste aparelho". Descartar e confirmar → a fila é apagada de vez (é a única cópia daquele orçamento) e a sessão encerra. Voltar → nada acontece, o vendedor continua logado exatamente onde estava.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Diálogo de saída com orçamentos ainda não sincronizados

## O que desenhar
O diálogo modal bloqueante que aparece quando o vendedor toca em **"Sair"** e ainda existem orçamentos na fila offline deste aparelho — registros que ele calculou, salvou e que **nunca chegaram à conta dele**. Ele é disparado de dois lugares (o botão "Sair" da aba **Conta** e o "Sair" da top-bar), interrompe o logout no meio e só deixa a sessão terminar depois que o vendedor decide entre enviar ou destruir. É a **única superfície do app capaz de apagar trabalho de forma irreversível**: a fila é a única cópia daquele orçamento. Quem usa: o vendedor comum, frequentemente com pressa, frequentemente sem sinal (é justamente o offline que enche a fila), muitas vezes num aparelho compartilhado — porque a varredura de privacidade no logout é o que torna o descarte obrigatório.

## Por que este prompt existe
Não existe autoridade de desenho nenhuma para esta peça. O protótipo de 2026-07-02 trata "Sair" como uma linha simples da Conta (§E7) e, na matriz §G, diz literalmente **"logout ok, sync off"** — ou seja, a decisão OPOSTA: sair sempre pode. O único "Sair" desenhado em JSX (`.design-import/ui_kits/precifica3d/AccountScreen.jsx`) é um `ListItem` com ícone `log-out` em `var(--danger)` chamando `onLogout` **direto, sem confirmação**. A fila offline (outbox, ADR-0018) nasceu no E4, em 2026-07, depois do protótipo — não havia o que desenhar. No canvas 018 "Sair" aparece 4 vezes, sempre como botão simples; a busca por "fila"/"sincroniz" no artboard de Conta não retorna nada. Portanto: **a escada de dois passos, a hierarquia entre sincronizar e descartar, o botão desabilitado com legenda, o alerta vermelho no meio do diálogo e a ordem da pilha de ações foram todos arbitrados por quem escreveu o código.** Este é o desenho que faltou.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/sign-out-outbox-guard.tsx` + `shared/i18n/messages.pt-br.ts` (bloco `historico`).

**Passo 1 — o diálogo de decisão** (`DialogContent showClose={false}`, sem X; Esc e clique no scrim cancelam o logout):

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | "{n} registro(s) ainda não foram sincronizados" | `{n}` = contagem real da fila |
| Corpo | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | boa copy, manter |
| Alerta (condicional) | "{n} registro(s) não puderam ser enviados. Eles continuam neste aparelho." | `Alert tone="danger"`, só aparece DEPOIS de uma tentativa que sobrou item |
| Ação 1 | "Sincronizar agora" | `Button` primário; desabilitado offline e enquanto sincroniza |
| Legenda (condicional) | "Precisa de conexão para enviar." | parágrafo centrado, `--text-muted`, `fs-sm`, só offline |
| Ação 2 | "Sair e descartar" | `Button variant="danger"` |
| Ação 3 | "Voltar" | `Button variant="secondary"` — cancela o logout |

As três ações estão hoje numa **coluna vertical, largura total, nesta ordem**, com `gap` de um passo.

**Passo 2 — a confirmação destrutiva** (mesmo diálogo, conteúdo trocado):

| Elemento | Texto literal hoje |
|---|---|
| Título | "Descartar {n} registro(s) e sair?" |
| Corpo | "Eles não foram enviados para a sua conta e não poderão ser recuperados." |
| Ações | "Voltar" (`secondary`) + "Descartar e sair" (`danger`), **em linha, alinhadas à direita** |

Problemas a resolver no desenho:

- → **O vendedor destrói trabalho identificado só por um número.** Nenhum dos dois passos mostra QUAIS registros estão em jogo — nem rótulo ("Cliente, pedido…"), nem data, nem preço. A tela de Orçamentos tem esses dados; o diálogo que os apaga, não.
- → **O alerta vermelho não diz a causa.** "Sincronizar agora" só reenvia entradas `pending`; entradas em `blocked` (Premium não ativo), `unauthenticated` (sessão expirada) e `failed` (servidor recusou) são **puladas de propósito** — o botão parece funcionar, nada acontece com elas, e o alerta diz apenas "não puderam ser enviados". O app já tem a copy honesta para cada causa e ela não aparece aqui: "Envio pausado · precisa de Premium", "Envio pausado · sessão expirada", "Não foi possível registrar". Sem isso o vendedor tenta de novo para sempre ou descarta sem entender.
- → **Sincronizar não tem estado de progresso visível.** O botão só fica desabilitado com o mesmo rótulo; o primitivo `tf-btn` tem `loading` com spinner e não é usado. Com fila grande e rede ruim a tela fica parada por segundos.
- → **Ordem e peso das ações são invenção.** "Sair e descartar" em vermelho, do mesmo tamanho e largura do primário, imediatamente acima de "Voltar" — o destrutivo está no caminho do polegar, no meio da pilha.
- → **Contradição interna de formato:** passo 1 usa coluna de botões de largura total; passo 2 usa linha alinhada à direita. É o mesmo diálogo, dois idiomas.
- → **Título com recuo fantasma:** o título reserva espaço à direita para o X mesmo com `showClose={false}` — sobra um vão sem nada.
- → **O primeiro botão desabilitado é a chave do drama offline.** Quem está sem sinal vê a única ação segura apagada e a única ação viva em vermelho.

## Conteúdo e dados reais
- **Contagem `{n}`**: inteiro ≥ 1 (o diálogo nem abre com fila vazia). Faixa realista 1–8; desenhe também **"12 registro(s)"** para provar o layout com dois dígitos, e considere o texto "1 registro(s)" — o plural entre parênteses é feio e o dono ainda não decidiu.
- **O que cada registro é**: um orçamento congelado, com rótulo opcional ("Cliente, pedido…"), data de cotação ("Cotado em 14/08/2026") e um preço, ex. **R$ 1.234,56** ou **R$ 24,24**. Se o desenho listar os registros, é isso que a linha mostra.
- **Estados de sincronização que uma entrada pode ter** (vocabulário já homologado): `pendente` · `envio pausado · precisa de Premium` · `envio pausado · sessão expirada` · `não foi possível registrar`.
- Nada aqui é dinheiro editável e nada é campo de formulário: o diálogo é 100% decisão.
- Container atual: modal centrado, `width: min(92vw, 32rem)`, `max-height: 85vh` com rolagem interna.

## Estados obrigatórios
1. **Repouso, online** — três ações vivas, sem legenda, sem alerta.
2. **Repouso, offline** — "Sincronizar agora" desabilitado + "Precisa de conexão para enviar." Precisa ser óbvio que **nada foi perdido** e que voltar (cancelar o logout) é seguro.
3. **Volta da conexão** — a ação primária reativa sozinha enquanto o diálogo está aberto; desenhe como isso é percebido (nada pode reativar em silêncio absoluto).
4. **Sincronizando** — spinner no primário, rótulo legível, demais ações não podem virar armadilha; diga se "Sair e descartar" fica bloqueado durante o envio (hoje **não fica**).
5. **Sincronização parcial** — alerta vermelho + contagem atualizada; aqui entra a causa por registro.
6. **Sincronização total** — o diálogo some e o logout continua; não há tela, mas diga o que o vendedor vê.
7. **Passo 2, confirmação destrutiva** — foco inicial, qual botão é o padrão, e o que impede o toque acidental.
8. **Foco de teclado** e **pressionado/hover** em cada ação, com o foco visível contra o card sobre o scrim.
9. **Desabilitado** — o primário offline precisa parecer *indisponível*, não *quebrado*.

## Viewports
- **Mobile 390px** — obrigatório e é o caso principal: fila cheia é sintoma de campo/rua/feira. A 92vw dá ~359px; três botões de largura total, alvo ≥44px, e o teclado não entra em cena (não há campo).
- **Desktop 1280px** — o diálogo trava em 32rem (512px) num scrim sobre a aba Conta ou a top-bar; a proporção muda completamente e a pilha vertical de botões largos fica estranha. Desenhe.
- 1920px não precisa de prancheta própria (a caixa não cresce), mas mostre o scrim numa tela larga se a leitura mudar.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca vira falha do vendedor nem oferta de plano.** Offline é um fato temporário e dito assim.
- **Cada causa de bloqueio é dita com o nome verdadeiro.** "Premium não está ativo" e "sessão expirou" são coisas diferentes de "sem conexão" e o app já as separa — nenhuma delas pode ser vendida como a outra.
- **Nenhuma frase honesta em placeholder ou em elemento cortável.** A legenda "Precisa de conexão para enviar." vive num bloco de largura total.
- **Destruição irreversível exige dois passos e nunca é a ação de menor esforço.** O botão vermelho não pode ser o mais fácil de acertar com o polegar.
- **Cancelar existe e se chama "Voltar"** — nunca "Cancelar" (FR-014).
- **Nenhuma promessa de recuperação.** Não há lixeira, não há desfazer: o texto "não poderão ser recuperados" é literal.
- Alvos ≥44×44px; contraste do vermelho medido contra `--surface-card` sobre o scrim, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Overflow medido nos DOIS eixos.** Um diálogo com alerta + legenda + três botões a 390px já é alto; `max-height: 85vh` cria rolagem interna e o headless não enxerga barra clássica — desenhe o que acontece quando o conteúdo passa da altura, e onde a rolagem começa e termina.
- **Texto que passa em teste e some na tela.** `toBeVisible` passa em elemento ocluído; o alerta vermelho que aparece só depois da tentativa pode nascer fora da área visível se o diálogo já estiver rolado.
- **Número grande estoura a coluna** — "12 registro(s) não puderam ser enviados." dentro do `Alert` com ícone precisa de quebra desenhada.
- **Botão que existe e nunca aparece** já aconteceu aqui (016): se o desenho criar um estado condicional, ele precisa de gatilho descrito.
- **Confirmação que promete algo que não acontece** já aconteceu no billing (toast que nunca renderizou): não desenhe recibo de sucesso que o produto não emite.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como first-class** (o app tem controle de tema segmentado no desktop):
1. Mobile 390px — passo 1 online, repouso.
2. Mobile 390px — passo 1 offline (primário desabilitado + legenda).
3. Mobile 390px — passo 1 sincronizando.
4. Mobile 390px — passo 1 com sincronização parcial (alerta + causas por registro).
5. Mobile 390px — passo 2, confirmação destrutiva.
6. Desktop 1280px — passo 1 online e passo 2, com o scrim sobre a aba Conta.
7. Uma prancheta de variação com **12 registros** e um rótulo longo, provando a quebra.
8. Ambos os passos em tema claro (mínimo: passo 1 offline e passo 2).

Reutilize os primitivos existentes, sem criar novos: `tf-dialog` centrado (`showClose={false}`, sem X) para o container; `tf-dialog__title` e `tf-dialog__desc` para título e corpo — e resolva o recuo à direita do título que hoje reserva o X inexistente; `tf-alert--danger` para a sincronização parcial e `tf-alert--info`/`--neutral` se o desenho separar as causas; `tf-btn--primary` com `loading` para "Sincronizar agora"; `tf-btn--danger` para o destrutivo; `tf-btn--secondary` para "Voltar"; `tf-btn--danger-ghost` está disponível caso o desenho decida rebaixar o peso do descarte no passo 1. Se listar os registros, use o mesmo vocabulário de badge de sincronização já existente em Orçamentos.

## Perguntas em aberto para o dono
1. **O diálogo deve mostrar QUAIS registros estão em jogo** (rótulo, data, preço, estado), ou continua sendo só uma contagem? Isso muda a peça de caixa de confirmação para lista com decisão.
2. **Descarte deve ser tudo-ou-nada?** Hoje "Sair e descartar" apaga a fila inteira. Um registro `failed` que nunca vai passar e três `pending` que passariam recebem o mesmo destino.
3. **Qual é a ação primária de verdade quando o vendedor está offline?** Hoje sobra só o vermelho. "Voltar" (ficar logado e sincronizar depois) deve virar o primário nesse estado?
4. **"Sair e descartar" no passo 1 deve ter o mesmo peso visual do "Sincronizar agora"?** É a decisão que define se a peça protege ou apenas informa.
5. **Plural**: "1 registro(s)" é aceitável ou a copy passa a flexionar ("1 orçamento" / "12 orçamentos")? Note que o produto renomeou Histórico → **Orçamentos** (016/PR-A) e estes textos ainda dizem "registro".
6. **Entradas `blocked` por Premium**: o diálogo deve oferecer reativar o Premium ali, ou isso é upsell no pior momento possível e fica fora?

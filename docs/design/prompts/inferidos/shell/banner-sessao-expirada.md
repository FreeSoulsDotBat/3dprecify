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

- **Onde vive:** Segundo filho do `.tf-shell`, logo abaixo da faixa de offline e ACIMA de todo o corpo — inclusive, no desktop, por cima da coluna do menu. É um aviso de tom informativo (azul) embrulhado num contêiner grudado no topo (`sticky`, `z-index: 40`), com título "Sua sessão expirou", corpo "Entre de novo para continuar de onde parou." e um botão-link primário pequeno "Entrar de novo". Não tem X, não tem dispensa, não some sozinho.
- **Como o vendedor chega:** Ninguém o chama: ele nasce no meio do trabalho. O servidor recusou uma sessão que no aparelho ainda parece viva (401 com código de sessão expirada) — tipicamente ao salvar um orçamento, no FIM da página. Por isso é grudado: montado estático, ele nascia até 3.600px fora da viewport, longe do olho do vendedor.
- **Vizinhança imediata:** Imediatamente acima: a faixa de offline, quando as duas coexistem (o 401 chegar e a rede cair em seguida é combinação real). Imediatamente abaixo: a barra superior no mobile; no desktop, a coluna do menu à esquerda e a barra superior à direita, ambas com o topo coberto por esta faixa. O conteúdo embaixo continua editável e clicável — nada é bloqueado, nada é apagado.
- **Dados que chegam (e o que ela devolve):** Um único bit de um armazém minúsculo, ligado pelo transporte HTTP e desligado no primeiro pedido que voltar a dar certo (ou quando a sessão voltar a ser autenticada em outra aba). Lê também o endereço atual do roteador para montar `\/sign-in?redirect=<endereço>`. Não lê entitlement, não lê o outbox e — por construção do grafo de imports — **não consegue** deslogar ninguém nem apagar a fila.
- **O que acontece depois:** Clicar em "Entrar de novo" é uma navegação de página inteira para `/sign-in` com a intenção preservada; feito o login, o vendedor volta exatamente para onde estava. Se ele ignorar a faixa e continuar trabalhando, o que ele salvar cai na fila do outbox com estado "não autenticado" — e continua no aparelho até uma sessão válida voltar.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell` · `Região de toasts (posição, empilhamento e dispensa)`

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

# Faixa de sessão expirada — o caminho de volta quando o servidor recusa a sessão

## O que desenhar
A faixa que aparece no topo do app inteiro quando o **servidor** recusa uma sessão que o aplicativo
ainda achava viva (um 401 com código de sessão expirada). Ela não é um erro de tela: é o **único
caminho de volta**, e aparece por cima de qualquer aba — Calcular, Catálogo, Kits, Orçamentos, Conta —
no meio do trabalho, tipicamente no instante em que o vendedor apertou "Salvar em Orçamentos" no fim
de uma página longa. O conteúdo embaixo continua editável e nada é destruído: os registros que não
foram enviados ficam guardados no aparelho. Quem a usa é o vendedor comum, no momento mais frágil de
uso do produto — ele acabou de fazer uma conta e descobriu que ela não subiu.

## Por que este prompt existe
Esta peça nunca foi desenhada. Ela nasceu num hotfix de 2026-08-07 (016/A3), cinco semanas depois do
protótipo de 2026-07-02 — que não tem faixa nem tela de sessão nenhuma. Tudo o que hoje define a peça
foi decidido por código: a **forma** (faixa larga sobre o shell, e não toast, folha ou diálogo), o
**tom** (`info`, não `danger`), a **ausência de qualquer dispensa** e — o mais grave — a **fixação no
topo, escolhida por medição de bug e não por desenho**: o comentário no arquivo registra que a faixa
montada no topo nascia 1.746px (1440) / 3.608px (360) fora da viewport, então virou `sticky` com um
`z-index: 40` escrito em estilo **inline** dentro do componente. É a superfície que governa o momento
mais frágil do uso, desenhada por acidente de correção.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/session-expiry-banner/session-expiry-banner.tsx`, montada em
`app-shell.tsx` logo abaixo da faixa de offline, **acima** da barra lateral e da barra superior.

| Elemento | Hoje | Observação |
|---|---|---|
| Contêiner | `Alert` tom `info` (fundo info-soft, ícone "info" 20px, `role="status"`) | Bloco com 16px de respiro interno, cantos arredondados, borda transparente |
| Título | "Sua sessão expirou" | Peso semibold, tamanho de corpo pequeno |
| Corpo | "Entre de novo para continuar de onde parou." | Uma linha |
| Ação | Botão primário **pequeno**, texto "Entrar de novo" | Leva para a tela de entrada preservando a página atual |
| Posicionamento | Fixo no topo da rolagem, sobreposto ao conteúdo | Estilo inline, sem classe própria |
| Dispensa | **Não existe** | Fica até o vendedor entrar de novo ou uma requisição voltar a dar certo |

→ O botão primário é da variante **pequena**: no aparelho, a altura fica abaixo dos 44px de alvo
mínimo. É o único alvo tocável da peça, e é o mais importante do app naquele instante.
→ O bloco é um "cartão" solto colado na borda: não tem tratamento de faixa (nada de largura total
com margem lateral resolvida), então a caixa arredondada encosta nas laterais da tela.
→ Como o bloco fica **por cima** do conteúdo que rola, o fundo dele precisa ser 100% opaco. Hoje é um
tom "soft" — se tiver transparência, o texto do orçamento passa por trás da frase.
→ Não há hierarquia definida entre esta faixa, a faixa de offline (que também usa fundo info e é
largura total, centralizada) e a barra superior. As duas faixas **podem aparecer ao mesmo tempo**, e o
resultado é duas tarjas azul-claras empilhadas dizendo coisas calmas diferentes.

## Conteúdo e dados reais
Textos literais, já homologados, que o desenho deve usar **exatos**:
- Título: **"Sua sessão expirou"**
- Corpo: **"Entre de novo para continuar de onde parou."**
- Ação: **"Entrar de novo"**

Textos da mesma família, que aparecem em outras superfícies **no mesmo instante** e precisam conviver
com a faixa sem se contradizer (não os reescreva, use-os para checar coerência):
- Faixa da fila de Orçamentos: "3 registro(s) não foram enviados: sua sessão expirou." + ação
  "Entrar de novo"
- Etiqueta no cartão do registro: "Envio pausado · sessão expirada"
- Aviso no detalhe do registro: título "Sessão expirada", corpo "Este registro não foi enviado para a
  sua conta: sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo."
- Faixa de offline (outra peça, pode estar visível junto): "Você está offline. O cálculo continua
  funcionando."

A peça **não tem dados variáveis**: nenhum número, nenhuma contagem, nenhuma data, nenhum nome de
usuário. Ela conhece exatamente um bit — expirou ou não. Não invente contador de registros pendentes
aqui (isso mora na faixa da fila, dentro de Orçamentos); se você achar que deveria estar aqui, isso é
pergunta para o dono, não decisão sua.

## Estados obrigatórios
1. **Ausente** — nada expirou: a faixa não existe, não reserva espaço nenhum. É o estado 99% do tempo.
2. **Repouso (expirado)** — título, corpo e o botão "Entrar de novo".
3. **Entrada da faixa** — ela aparece durante o trabalho, sem recarregar a página: mostre como ela
   entra (empurra o conteúdo ou sobrepõe?) sem fazer o vendedor perder o lugar onde estava.
4. **Foco no botão** (teclado) — anel de foco visível contra o fundo tintado da faixa, não contra o
   fundo da página.
5. **Hover** e **pressionado** do botão.
6. **Rolagem** — o estado que define a peça: a faixa parada no topo enquanto o conteúdo passa por
   trás. Desenhe esse instante, com texto de orçamento atrás, para provar a opacidade.
7. **Convivência com a faixa de offline** — as duas visíveis ao mesmo tempo. Mostre a ordem e a
   separação, ou defenda um desenho em que uma some.
8. **Convivência com a faixa da fila** — na aba Orçamentos, a faixa do shell no topo e a faixa
   "3 registro(s) não foram enviados: sua sessão expirou." dentro da página: duas vezes a mesma
   verdade em duas tarjas. Resolva visualmente essa redundância.
9. **Sem dispensa** — se o desenho propuser uma dispensa, mostre também o que sobra depois de
   dispensar (o caminho de volta não pode simplesmente sumir).

## Viewports
- **Mobile 390px** — obrigatório e prioritário: é onde a faixa custa mais caro (cada pixel dela é
  pixel de trabalho) e onde o alvo do botão é crítico. Desenhe também o instante logo depois do
  "Salvar em Orçamentos", com o vendedor no fim da página.
- **Desktop 1280px** — a faixa é renderizada **acima** da barra lateral e da barra superior, atravessa
  a largura inteira do shell. Precisa dizer o que acontece com o alinhamento da mensagem numa largura
  em que a frase ocupa uma fração da linha.
- **Desktop 1920px** — mesma pergunta, ampliada: uma frase curta centralizada num vão de 1920px vira
  texto perdido; uma frase alinhada à esquerda vira botão a 1600px de distância do olho.

## Regras que o desenho não pode quebrar
- **Nunca dizer "conexão" ou "offline".** A conexão está intacta; o que morreu foi a sessão. Essa
  disciplina é deliberada e foi paga por um defeito real (a cópia antiga prometia sincronização
  automática "quando houver conexão" com a conexão perfeita).
- **Nada foi perdido, e isso precisa continuar verdadeiro na leitura.** O tom não pode sugerir
  destruição de dados: os registros não enviados continuam no aparelho.
- **Um 401 nunca desconecta o vendedor.** A faixa convida; não expulsa, não bloqueia a tela, não
  esvazia o formulário. Nada de sobreposição modal que impeça continuar mexendo embaixo.
- **A frase honesta vive em texto de largura cheia**, nunca em espaço apertado que a corte.
- **Alvo de toque ≥44px** para "Entrar de novo" — o botão pequeno de hoje é o problema a corrigir.
- **Contraste medido contra o fundo real da faixa** (o fundo tintado), não contra o fundo da página,
  nos dois temas.
- **A faixa é opaca.** O conteúdo que rola por baixo não pode ser lido através dela.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport**: foi exatamente o que aconteceu aqui (1.746px / 3.608px fora) e a
  correção virou o desenho. O desenho novo tem que resolver isso por intenção, não por remendo.
- **Transbordo horizontal medido**: a 390px, título + corpo + botão numa faixa que encosta nas bordas
  já custou transbordo em outras peças. Nada pode ultrapassar a largura da tela em nenhum dos dois
  eixos.
- **Texto que passa em teste e está ocluso**: uma faixa sobreposta pode tapar o campo ou o botão que
  está logo abaixo dela na página. Mostre o que fica coberto quando a faixa aparece.
- **Duas tarjas da mesma cor dizendo coisas diferentes** já apareceram no produto e leem como uma só.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como igual (nenhum dos dois é rascunho):
1. Mobile 390px — faixa em repouso, no topo de uma tela de Orçamentos com conteúdo real atrás.
2. Mobile 390px — o instante da rolagem, com texto passando por trás da faixa.
3. Mobile 390px — faixa + faixa de offline juntas, e faixa do shell + faixa da fila juntas.
4. Desktop 1280px — a faixa atravessando o shell acima da barra lateral e da barra superior.
5. Desktop 1920px — o mesmo, resolvendo o alinhamento no vão largo.
6. Detalhe em escala 1:1 dos estados do botão: repouso, hover, foco, pressionado, com a altura de
   alvo cotada.

Reaproveite os primitivos existentes em vez de criar novos: o bloco de aviso `tf-alert` no tom `info`
(ícone + título + corpo já fazem parte dele), o botão `tf-btn tf-btn--primary` numa altura que atinja
o alvo, o ícone do conjunto do app, e os espaçamentos e raios dos tokens. Se a faixa precisar de um
tratamento de largura total que o `tf-alert` não tem, descreva-o como **variação do alerta em faixa**,
não como componente novo.

## Perguntas em aberto para o dono
1. **A faixa pode ser dispensada?** Hoje não pode — fica até o vendedor entrar de novo. Se puder, qual
   é o caminho de volta depois de dispensar (um selo permanente na barra superior? nada?).
2. **Tom `info` ou `danger`?** O código escolheu `info` com o argumento de que nada foi destruído. É
   uma decisão de produto: o vendedor precisa se alarmar para agir, ou se acalmar para continuar?
3. **A faixa do shell deve dizer quantos registros ficaram parados?** Hoje ela não sabe disso de
   propósito, e essa informação aparece só dentro de Orçamentos — o que gera duas tarjas. O dono
   prefere uma faixa que conte ("3 registro(s) não foram enviados") ou duas superfícies separadas?
4. **Quando offline e sessão expirada acontecem juntos, quem manda?** As duas faixas empilhadas dizem
   duas verdades simultâneas — e uma delas ("entre de novo") é impossível de executar sem rede.

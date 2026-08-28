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

- **Onde vive:** Primitivo do DS montado UMA única vez, nos providers — **fora** do `.tf-shell`, portanto acima de todo o app (z-index 60, acima das faixas de aviso em 40 e da barra de abas em 30, abaixo apenas dos diálogos em 70/71). É uma região fixa, anunciada educadamente a leitores de tela: no mobile centrada embaixo e levantada acima da barra de abas, com largura de até 92% da tela (máx. 480px); a partir de 768px salta para o canto inferior direito. Cada toast é um cartão elevado com ícone à esquerda, mensagem e um botão de fechar de 44px; empilha de cima para baixo, sem limite de quantidade, e cada um se dispensa sozinho em 5 segundos.
- **Como o vendedor chega:** Não tem rota: ele é a confirmação de quase toda ação de escrita do produto. Hoje é disparado de dez lugares nomeados — o painel do catálogo (salvar/apagar filamento, impressora, produto), a página de produto, a página de Kits, a folha de registrar orçamento, a folha de exportar (PDF/CSV), o gerenciar/expirar de orçamentos, o recalcular hoje, e as três superfícies de cenários (salvar, barra de contexto e lista).
- **Vizinhança imediata:** No mobile, imediatamente acima da barra de 5 abas — encobre a parte de baixo do conteúdo e, com dois ou três empilhados, sobe por cima do que o vendedor acabou de tocar. No desktop, flutua no canto inferior direito sobre o conteúdo da aba, longe do menu. Quando um diálogo está aberto (o de saída com fila, por exemplo), o toast fica ATRÁS do véu escuro.
- **Dados que chegam (e o que ela devolve):** Uma frase já em português — os códigos de erro do servidor são traduzidos no ponto de chamada, o componente não conhece copy de negócio — mais um tom (neutro · info · sucesso · perigo, que muda só a cor do ícone) e uma duração. Perigo é anunciado como alerta; o resto, como estado.
- **O que acontece depois:** O toast some sozinho aos 5s ou no clique do X; nada mais acontece — ele nunca é a única prova de uma ação, e nunca substitui a mudança de estado na tela (a lista já foi revalidada antes de ele aparecer). Nada empilha nem enfileira: um sexto toast simplesmente vira o sexto cartão da pilha.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Shell no estado deslogado (sem identidade, sem "Entrar")` · `Barra de abas do mobile com 5 seções` · `Barra superior do mobile (logo centralizado + Sair + tema)` · `Tela Entrar emoldurada pelo shell (e sua versão desktop)` · `Faixa de sessão expirada ("Entrar de novo")` · `Empilhamento das faixas de aviso no topo do shell` · `Diálogo de saída com orçamentos na fila` · `Menu recolhido à força na faixa 426–599px` · `Faixa intermediária 600–1023px (menu de 240px + coluna de 460px)` · `Página "Como tratamos seus dados" (rota avulsa)` · `Telas de Erro e 404 emolduradas pelo shell`

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

# Região de toasts — onde a confirmação do app aparece, empilha e some

## O que desenhar

A faixa flutuante que carrega TODA confirmação efêmera do Precifica3D: "Filamento salvo.", "Simulação
duplicada.", "Não foi possível gerar o arquivo.", "Pendente neste dispositivo. Sincroniza sozinho quando
houver conexão." Ela é montada uma única vez no shell do app (`apps/web/src/app/providers.tsx`) e paira
sobre qualquer tela — calculadora, Catálogo, Kits, Orçamentos, Conta. Quem a usa é o vendedor logo depois
de tocar em "Salvar", "Duplicar", "Excluir", "Exportar" ou "Registrar": é por ela que ele descobre se a
ação encostou no servidor de verdade, ficou só no aparelho, ou falhou. Desenhe a REGIÃO (posição,
empilhamento, entrada/saída, convivência com a barra de abas e com os diálogos), não só o cartãozinho.

## Por que este prompt existe

Existe autoridade de desenho sobre a PEÇA e nenhuma sobre a REGIÃO. O protótipo de 2026-07-02 (§D.2)
define "**Toast** — feedback efêmero (sucesso/erro/info), radius md, sombra sm", e o CSS honra isso. Mas
nenhuma prancha do inventário §E mostra a região: não há posição, empilhamento, duração, limite, nem
convivência com a BottomBar; a matriz §G não tem linha de toast; as duas rodadas de correção não citam a
palavra; o canvas do 018 não tem nenhuma ocorrência de "toast". O tom "neutral", os 5000ms de
auto-dispensa e o `z-index: 60` **não vêm de lugar nenhum** — foram escolhidos por uma IA a partir de
requisito textual. É a mesma classe do defeito E6/T028, em que um toast prometido nunca apareceu e não
havia desenho contra o qual comparar.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/shared/ui/toast.tsx` + `toast.css`.

Anatomia do cartão (esta parte tem desenho, mantenha): ícone 18px à esquerda · mensagem em uma ou mais
linhas · botão de fechar 44×44px com `aria-label` **"Fechar"**. Fundo `surface-raised`, borda sutil,
`radius-md`, `shadow-md`. Só o ÍCONE muda de cor por tom — o texto é sempre `text-strong`.

| Comportamento atual | Valor real no código | Leitura |
| --- | --- | --- |
| Posição < 768px | centrado, `bottom = altura da barra de abas (64px) + 12px`, largura `min(92vw, 30rem)` | → a barra de abas só existe até **425px**; entre 426px e 767px o toast flutua 76px do chão sem nada embaixo |
| Posição ≥ 768px | canto inferior direito, 24px das bordas | o corte de desktop do 018 é 1280px — a região troca de canto num limiar que não é o do layout |
| Área segura (iPhone) | a barra de abas soma `safe-area-inset-bottom`; **o toast não** | → num aparelho com barra de gestos o toast invade ~22px da navegação |
| Empilhamento | ilimitado, novo entra por BAIXO (`[...toasts, novo]`), coluna com 8px de gap | → três toasts de duas linhas ocupam ~200px sobre a navegação; ninguém desenhou o limite |
| Duração | 5000ms por item, contados individualmente | → uma frase de 96 caracteres ("Não foi possível guardar o registro neste aparelho. Ele não foi salvo.") tem os mesmos 5s de "Kit salvo." |
| Camadas | toast `z-index: 60`; overlay de diálogo/sheet **70**, diálogo **71** | → **um toast disparado com uma folha aberta nasce ATRÁS do véu** — invisível. A ficha dizia "60 contra 40"; o valor real é 70/71 |
| Entrada e saída | nenhuma. Sem `transition`, sem `keyframes`, sem `prefers-reduced-motion` | → aparece e some no talo; num empilhamento, os de baixo pulam ao expirar o de cima |
| Tom `neutral` | é o padrão do código e **nenhuma chamada do app o usa** | → tom fantasma; ou ganha papel no desenho ou o desenho declara 3 tons |
| Leitura assistiva | região `role="region" aria-label="Notificações" aria-live="polite"`; tom `danger` vira `role="alert"` | mantido |

## Conteúdo e dados reais

Toda a copy abaixo já está homologada — cite-a EXATA nas pranchetas, não reescreva:

- **success** — "Filamento salvo." · "Impressora salva." · "Produto salvo." · "Kit salvo." ·
  "Registro salvo em Orçamentos." · "Simulação salva." · "Simulação atualizada." ·
  "Simulação duplicada." · "Simulação renomeada." · "Simulação excluída." · "Registro excluído." ·
  "Rótulo atualizado." · "Assinatura cancelada. Premium ativo até 12/09/2026."
- **info** (as frases honestas de sincronização, ADR-0018) — "Pendente neste dispositivo. Sincroniza
  sozinho quando houver conexão." · "Envio pausado — o Premium não está ativo. O registro continua neste
  aparelho." · "Envio pausado — sua sessão expirou. O registro continua neste aparelho."
- **danger** — "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." ·
  "Não foi possível registrar. O servidor não aceitou este registro." · "Não foi possível gerar o
  arquivo." · "Exportar precisa do Premium ativo." · "Não foi possível excluir o registro." ·
  "Não foi possível atualizar o rótulo."

Medidas para desenhar com número de verdade: mensagem mais curta = 11 caracteres ("Kit salvo."); mais
longa = 96 caracteres, que a 480px de largura ocupa **duas linhas** e a 358px (92vw de um 390px) ocupa
**três**. Desenhe com a de três linhas, não com a curta. Nenhum toast carrega dinheiro hoje, mas se o
desenho abrir espaço para valor, use o formato do app: R$ 1.234,56.

## Estados obrigatórios

1. **Repouso, um toast** — tom `success`, ícone `circle-check` verde, "Kit salvo.", botão fechar visível.
2. **Repouso, mensagem longa** — tom `danger`, ícone `circle-alert`, a frase de 96 caracteres em 3 linhas
   a 390px; mostre onde o botão de fechar se ancora (topo? centro?) quando o texto cresce.
3. **Empilhado, 2 e 3 itens** — misture tons (info + danger) e mostre a ordem: o mais novo entra embaixo
   hoje. Diga se isso deve mudar.
4. **Empilhado além do limite** — o desenho precisa DECIDIR o teto (ex.: 3 visíveis) e o que acontece com
   o quarto: descarta o mais antigo, agrupa, ou empilha atrás? Hoje não há teto.
5. **Foco no botão fechar** — anel de foco do DS, contraste medido contra `surface-raised`, não contra o
   fundo da página.
6. **Hover / pressionado do fechar** — hoje só muda de `text-muted` para `text-strong`; sem pressionado.
7. **Entrada e saída** — desenhe os dois quadros (de onde vem, para onde vai) e a variante de
   movimento reduzido, que hoje não existe.
8. **Sobre a barra de abas (≤425px)** — a folga real entre o cartão e a navegação, com área segura.
9. **Com folha/diálogo aberto** — o estado que hoje é um defeito: mostre onde o toast deve aparecer
   quando há um véu na tela.
10. **Offline / Premium pausado** — não são estados VISUAIS próprios: viram tom `info` com as frases
    acima. O desenho deve deixar claro que falha de rede e sessão expirada **não** usam vermelho de erro
    de servidor, porque o registro não se perdeu.

## Viewports

- **390px** — obrigatória. É onde a região colide com a barra de abas e onde a frase longa vira 3 linhas.
- **425px** — obrigatória, é o último pixel com barra de abas.
- **768px** — obrigatória: é o limiar em que a região salta para o canto direito hoje, sem que nada no
  layout mude junto.
- **1280px** — obrigatória, é o corte real de desktop do 018 (menu lateral, sem barra de abas).
- 1920px opcional, só se a ancoragem à direita precisar de outra distância da borda.

## Regras que o desenho não pode quebrar

- **Nunca vender falha de rede como falta de Premium, nem o contrário.** As três frases de "Envio pausado"
  distinguem premium inativo de sessão expirada; o desenho não pode uniformizá-las num só ícone genérico.
- **Sucesso só depois do 2xx real.** Todo toast verde deste app é disparado com resposta confirmada do
  servidor; nada de confirmação otimista. O desenho não deve sugerir um estado "salvando…" dentro do toast.
- **A frase honesta nunca cabe cortada.** A região tem 480px no máximo; o texto quebra em linhas, jamais
  em reticências. (Lição do 016: frase honesta nunca vive em placeholder nem em elemento estreito.)
- **Alvo de toque ≥44px** para o fechar, sem que ele coma a margem do texto.
- **Contraste medido contra `surface-raised`**, que é mais claro que o fundo da página no tema escuro.
- Ícone é reforço, não portador: a mensagem sozinha precisa dizer o que houve.

## Armadilhas já pagas neste projeto

- **E6/T028**: um toast prometido no código NUNCA renderizou — o diálogo desmontava antes do callback.
  O desenho é o que permite dizer "isto deveria estar aqui"; por isso a prancha com folha aberta é a mais
  importante da lista.
- **016/T118**: uma barra fixa parou 56px DENTRO da barra de abas porque `padding-bottom` não alcança
  quem é `fixed`/`sticky`. A região de toasts tem exatamente essa forma e hoje ignora a área segura.
- **016/PR-B**: o headless não vê barra de rolagem clássica — meça overflow nos DOIS eixos. A 390px,
  `92vw` + sombra precisa caber sem empurrar a página na horizontal.
- **014**: `toBeVisible` passa em elemento totalmente ocluso. Um toast atrás do véu de um diálogo passa em
  todo teste de texto e é invisível para o vendedor.

## Entregável

Pranchetas em tema **escuro (padrão)** e **claro (first-class)**:

1. `Região · 390px` — mapa da tela inteira com barra de abas, área segura, um toast, cotas em px.
2. `Região · 390px empilhado` — 3 toasts (info + danger + success), com o teto proposto explícito.
3. `Região · 768px` e `Região · 1280px` — ancoragem no canto, distância das bordas, largura máxima.
4. `Cartão · anatomia` — os 4 tons lado a lado (ou 3, se `neutral` cair), com as frases reais.
5. `Cartão · texto longo` — a frase de 96 caracteres em 3 linhas, com o fechar posicionado.
6. `Estados do fechar` — repouso, hover, foco, pressionado.
7. `Movimento` — quadros de entrada/saída + a variante de movimento reduzido.
8. `Convivência` — toast com folha/diálogo aberto e toast sobre a barra de abas.

Reutilize os primitivos existentes, sem criar novos: o cartão é `tf-toast` sobre `surface-raised` com
`radius-md`/`shadow-md`; os ícones são `info`, `circle-check`, `circle-alert` e `x` do `Icon` do DS; o
fechar herda o anel de foco do DS; as cores de tom são `info-text`, `success-text`, `danger-text`. A
região `tf-toaster` é só posicionamento — não desenhe caixa, fundo nem borda para ela.

## Perguntas em aberto para o dono

1. **Quantos toasts podem coexistir?** Hoje é ilimitado. Teto de 3 com descarte do mais antigo, ou
   agrupar ("+2 mensagens")?
2. **Qual o limiar de posição?** A região troca de canto a 768px, mas o layout de desktop só começa a
   1280px e a barra de abas some a 425px. Um único limiar (425px ou 1280px) ou os três continuam?
3. **O tom `neutral` deve existir?** Nenhuma chamada do app o usa; ou ele ganha um papel (aviso sem
   cor) ou o desenho fixa três tons e o código perde o quarto.
4. **Erro deve auto-dispensar?** Os 5000ms valem hoje para "Kit salvo." e para "Não foi possível guardar
   o registro neste aparelho. Ele não foi salvo." igualmente — a segunda pede ação e some sozinha.
5. **Toast disparado com folha aberta**: deve aparecer POR CIMA do véu, ou a folha deve exibir a mensagem
   internamente e o toast só surgir depois que ela fechar?

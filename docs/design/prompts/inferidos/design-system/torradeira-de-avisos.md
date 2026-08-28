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

## O mapa funcional de Primitivos do Design System

### O que é esta área

Não é uma aba nem uma tela. É o **vocabulário visual** que as cinco abas do Precifica3D — Calcular · Catálogo · Kits · Orçamentos · Conta — falam. Vive em `apps/web/src/shared/ui/` e é exportado por um único barril (`index.ts`, o ÚNICO barril permitido no app, ADR-0007/A38): 20 primitivos + 2 lojas de estado (tema e menu recolhido). Nenhum deles tem rota. O vendedor nunca "vai ao design system" — ele encosta nele a cada toque.

### Como o vendedor chega

Por toda parte. Um caminho típico de primeira sessão: abre `/calcular` (grátis, sem login), digita gramas num **NumberField** dentro de um **Field**, lê a explicação de como a conta é feita num **InfoTip ⓘ**, escolhe o canal num **Select** nativo, vê o resultado num **PriceHero** e a conta aberta numa pilha de **BreakdownRow**, tudo dentro de **Cards**. Ao tentar SALVAR qualquer coisa, encontra o teaser Premium; assinando, ganha `/catalogo`, `/kits`, `/historico` — e ali o mesmo vocabulário reaparece em outra combinação: **EmptyState** na primeira visita, **Sheet** vindo da direita para cadastrar, **Dialog** central para confirmar exclusão, **Toast** confirmando, **Spinner** enquanto a rede responde, **Badge** dizendo o estado, **Alert** dando a notícia ruim.

### Rotas onde os primitivos aparecem

`/` · `/calcular` · `/catalogo` (+ `/catalogo/produtos/novo` e `/catalogo/produtos/$productId`) · `/kits` · `/historico` (+ `/historico/$snapshotId`) · `/conta` · `/sign-in` · `/privacidade`. O casco (`app/app-shell.tsx`) monta banner offline, banner de sessão expirada, TopBar, AppNav (TabBar no celular / barra lateral no desktop) e o **Toaster** (uma vez, em `app/providers.tsx`).

### O que a área guarda

Quase nada — e é de propósito. Três estados vivem aqui: a fila do **Toast** (zustand, em memória, some no refresh), o **tema** (`theme-store`, localStorage) e a **preferência de menu recolhido** (`nav-rail-store`, por aparelho, só vale ≥1280px). Nenhum primitivo fala com servidor, cache uid-keyed, outbox ou entitlement: quem sabe de plano, rede e dinheiro são as *features*, que passam texto e estado já resolvidos para dentro da peça.

### De que depende

Dos **tokens de design** (`src/styles/tokens/*` — cor, espaço, raio, sombra, anel de foco, `--touch-min: 44px`, `--tabbar-h`, `--sidebar-w`), do **Radix** para os três primitivos com acessibilidade não trivial (Dialog/Sheet, Popover do InfoTip, Switch), e do dicionário pt-BR (`shared/i18n/messages.pt-br`) só para os rótulos genéricos ("Fechar", "Notificações"). Formatação de dinheiro vem de `shared/lib/decimal-ptbr` (`formatDecimal`/`parseDecimal`) — o **pricing-core** calcula, o DS só mostra.

### O que ele alimenta

Tudo. O `NumberField` reescreve o próprio valor ao perder o foco (máscara de milhar pt-BR) e devolve isso ao formulário; o `Field` decide se a mensagem embaixo do campo é dica, **aviso de plausibilidade** (azul, não recusa) ou **erro** (vermelho, recusa); o `PriceHero` é o número que vira orçamento congelado; o `Card` clicável da lista mestre é o que seleciona a ficha à direita no desktop.

### Como muda por estado

- **Grátis** — o DS não sabe que é grátis. As features trocam o conteúdo: `EmptyState` vira teaser, `Switch` de canais fica **desabilitado e falso**, botões de salvar somem.
- **Premium** — as mesmas peças com dados reais; `Badge` verde no plano, `Sheet` de cadastro liberada.
- **Premium pausado (lapsed)** — listas ficam em leitura: `Alert` de aviso no topo, cartões ganham uma linha "somente leitura", ações destrutivas desaparecem.
- **Offline** — calcular funciona inteiro (o motor é local); escrever entra na fila e o `Badge` do item diz "na fila"; o `Toast` confirma o enfileiramento, não o salvamento.
- **Sessão expirada** — banner fixo no topo do casco com "Entrar de novo"; a fila NUNCA é purgada; `Dialog` central bloqueia a saída se houver pendências.
- **Largura** — abaixo de 1280px é celular (`useIsWide()` retorna false sem `matchMedia`); acima, o Catálogo vira mestre-detalhe e o tema vira controle segmentado. Os primitivos em si **não têm ponto de corte nenhum**: só o Toaster (768px) e o Switch (`prefers-reduced-motion`) declaram `@media` em toda a pasta.

## O ponto exato de inserção desta peça

- **Onde vive:** `shared/ui/toast.tsx` — a região `.tf-toaster` é montada UMA vez, em `app/providers.tsx`, acima de tudo (`z-index: 60`). No celular fica presa ao rodapé, centralizada, EMPURRADA para cima pela altura da barra de abas (`bottom: calc(var(--tabbar-h) + var(--space-3))`), largura `min(92vw, 30rem)`; a partir de **768px** (único corte de largura de toda a pasta) pula para o canto inferior direito. É disparada por `toast()` de **10 arquivos**: recalcular hoje (6 chamadas), registrar orçamento (6), gerir/renomear/excluir orçamento (4), lista de simulações (3), barra de contexto da simulação (3), Catálogo (2), produto, kit, salvar simulação e exportar (1 cada).
- **Como o vendedor chega:** Sem gesto nenhum: ela APARECE depois que o vendedor termina uma ação — salvou o filamento, copiou o link, exportou o PDF, recalculou o preço de hoje, ou a rede recusou. Some sozinha em 5000ms.
- **Vizinhança imediata:** No celular, empilha em coluna logo acima da barra de abas (Calcular · Catálogo · Kits · Orçamentos · Conta) — o lugar mais disputado da tela, e a folha ou o diálogo que originou a ação normalmente já desmontou por baixo. No desktop, canto inferior direito, sobre o conteúdo da aba, à direita da barra lateral. Cada cartão traz ícone de 18px por tom à esquerda, mensagem no meio e botão de fechar de 44px à direita com margem negativa. Empilha sem limite de fila e não tem NENHUMA animação de entrada ou saída.
- **Dados que chegam (e o que ela devolve):** Uma string em pt-BR já traduzida no ponto de chamada (o `ErrorCode` vira frase lá, não aqui), um `tone` (`neutral`/`info`/`success`/`danger`) e uma duração. A fila vive numa loja zustand em memória — some no refresh, não vai para servidor nem para o outbox.
- **O que acontece depois:** Some em 5s ou ao clicar no X, e nada mais acontece: é o ÚLTIMO elo da ação, sem desfazer, sem link. Armadilha registrada: na homologação do E6/PR-B um toast NUNCA renderizou — o diálogo desmontava antes de o callback de mutação rodar, e a frase de confirmação existia no código sem nunca chegar à tela.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Botão destrutivo (danger e danger-ghost)` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Aviso efêmero (Toast) — onde aparece, quanto fica, quantos cabem

## O que desenhar
O aviso efêmero é a única forma que o Precifica3D tem de dizer "deu certo", "está pendente" ou "não deu"
depois de uma ação que o vendedor já disparou. Ele nasce de um salvamento (filamento, impressora, produto,
kit, orçamento, simulação), de um cancelamento de assinatura, de uma exportação e — o caso mais delicado —
de cada um dos quatro estados de sincronização do outbox offline. Vive fixado no rodapé em todas as telas do
app, montado uma única vez no shell (`app/providers.tsx`), acima do conteúdo mas abaixo das folhas/diálogos.
Desenhe a peça: o cartão em cada tom, a região que os empilha, a âncora em cada viewport, a entrada, a saída
e o que acontece quando chegam vários de uma vez.

## Por que este prompt existe
Nada disso foi desenhado. O DS antigo tem UMA linha de prosa sobre ele ("Toast — feedback efêmero
(sucesso/erro/info), radius md, sombra sm"); nenhuma das 6 telas do ui_kit dispara um, o canvas do 018 não o
desenha, e as três rodadas de auditoria não o citam. Posição, duração (5000 ms), profundidade da pilha (sem
limite) e a total ausência de animação foram decididas dentro do CSS. E o código contraria duas regras já
escritas neste projeto: `toast.css:15` corta em **768px**, enquanto o app inteiro passou a cortar em **1280px**
(018/ADR-0031) — é o único corte de largura em todo o `shared/ui`; e o toaster ignora `--pinned-bottom`, a
variável que o shell criou justamente para que nada pinado se sente em cima da barra de abas (014/T118).

## O que já existe hoje (não invente do zero — corrija)
A região (`.tf-toaster`): fixa, `z-index: 60`, coluna, gap de 8px, largura `min(92vw, 30rem)` → 480px de teto,
358px em 390px de tela.

| Aspecto | Como está hoje | Leitura |
| --- | --- | --- |
| Âncora < 768px | rodapé, centralizado, `bottom: 64px (barra de abas) + 12px` | → **não soma `env(safe-area-inset-bottom)`**; num aparelho com indicador de home o aviso desce para dentro da barra |
| Âncora ≥ 768px | canto inferior direito, `bottom: 24px`, `right: 24px` | → entre **768px e 1279px** o layout ainda é o MÓVEL (a barra de abas continua na tela) e o aviso já pulou para 24px do chão — ou seja, **sobre a barra de abas**, numa faixa de 512px de largura |
| Duração | 5000 ms para todos os tons, inclusive erro | → o mesmo tempo para "Kit salvo." (11 caracteres) e para "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." (69) |
| Pausa | nenhuma: não pausa no hover, não reinicia no foco | → um erro lido pela metade não volta |
| Fila | ilimitada, novos **acrescentados ao fim** | → no celular o mais NOVO nasce colado na barra de abas e empurra os antigos para cima; cinco avisos cobrem ~312px da tela e cada cartão captura toque |
| Animação | **nenhuma** de entrada ou de saída | → o aviso aparece e some por corte seco; não há `prefers-reduced-motion` a respeitar porque não há movimento |
| Distinção de tom | só a cor do ícone de 18px muda (`info` / `success` / `danger`); fundo, borda e sombra são idênticos | → um erro e um sucesso são o mesmo retângulo com um ponto colorido |
| Camada | toast `z-index: 60`, overlay de diálogo `70`, conteúdo do diálogo `71` | → um aviso disparado com a folha ainda aberta fica **atrás do overlay**: invisível |
| Fechar | botão de 44×44 com margem negativa (−8px vertical, −4px horizontal), rótulo `aria-label="Fechar"` | o alvo cumpre 44px, mas a margem negativa o encosta na borda do cartão |
| Região | `role="region"`, `aria-label="Notificações"`, `aria-live="polite"`; o cartão de erro usa `role="alert"` dentro dessa região polida | → erro urgente dentro de região educada é uma contradição de anúncio |

Registro que reforça tudo isso: na homologação visual do E6/PR-B um toast **nunca renderizou** — a folha
desmontava antes do retorno da mutação, e a frase ficou no pacote afirmando um reconhecimento que não houve.

## Conteúdo e dados reais
Um aviso é sempre: ícone (18px) + uma frase pt-BR + botão fechar. Sem título, sem ação, sem link — não existe
"Desfazer" em lugar nenhum. Frases literais, homologadas, que o desenho deve usar como estão:

- Sucesso (curtas): `"Filamento salvo."` · `"Impressora salva."` · `"Produto salvo."` · `"Kit salvo."` ·
  `"Simulação salva."` · `"Simulação atualizada."` · `"Simulação duplicada."` · `"Simulação renomeada."` ·
  `"Simulação excluída."` · `"Rótulo atualizado."` · `"Registro excluído."` · `"Registro salvo em Orçamentos."`
- Sucesso longa (assinatura): `"Assinatura cancelada. Premium ativo até {data}."` → com data real:
  "Assinatura cancelada. Premium ativo até 14/09/2026."
- Info / sincronização (as três mais longas, e as que mais importam):
  `"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."` ·
  `"Envio pausado — o Premium não está ativo. O registro continua neste aparelho."` ·
  `"Envio pausado — sua sessão expirou. O registro continua neste aparelho."`
- Erro: `"Não foi possível guardar o registro neste aparelho. Ele não foi salvo."` ·
  `"Não foi possível registrar. O servidor não aceitou este registro."` ·
  `"Não foi possível gerar o arquivo."` · `"Não foi possível excluir o registro."` ·
  `"Não foi possível atualizar o rótulo."` · `"Exportar precisa do Premium ativo."`

Tons existentes: `neutral`, `info`, `success`, `danger` — quatro, e hoje `neutral` e `info` são visualmente
idênticos. Nenhuma chamada do app passa duração própria: os 5000 ms valem para todos. O código aceita
`duration <= 0` (fica até fechar), e **nenhuma tela usa isso hoje** — é a porta pronta para o erro que precisa
esperar leitura.

## Estados obrigatórios
- **Repouso — sucesso**: `"Kit salvo."`, ícone de conferido; frase curta, cartão de uma linha.
- **Repouso — info**: `"Pendente neste dispositivo. Sincroniza sozinho quando houver conexão."` — mostre em
  390px, onde quebra em 2–3 linhas; o cartão cresce, não corta.
- **Repouso — erro**: `"Não foi possível guardar o registro neste aparelho. Ele não foi salvo."` — precisa ser
  reconhecível como erro **antes** de ler a frase.
- **Repouso — neutro**: decida se sobrevive como tom distinto ou some (ver perguntas ao dono).
- **Entrando**: hoje não existe; desenhe o quadro de entrada (de onde vem, quanto dura).
- **Saindo / expirando**: desenhe o fim, e desenhe se o tempo restante é visível ou invisível.
- **Foco no botão fechar**: anel de foco visível sobre o fundo elevado do cartão, não sobre o fundo da página.
- **Hover no botão fechar**: hoje o ícone passa de esmaecido a forte — mantenha e mostre.
- **Pilha de 2 e de 5**: o mesmo desenho com dois e com cinco avisos; mostre o que acontece com o excedente.
- **Sobre folha/diálogo aberto**: o estado que hoje é invisível — desenhe onde o aviso fica quando há uma
  folha por cima.
- **Aviso persistente (sem contagem)**: o cartão sem prazo, esperando o toque em Fechar.

## Viewports
- **390px** — obrigatório: é onde a peça é mais crítica, mora sobre a barra de abas de 64px (mais a área
  segura do aparelho) e onde a frase de 77 caracteres precisa caber.
- **1024px** — obrigatório, e é o quadro que hoje está errado: layout ainda móvel (barra de abas presente),
  aviso já no canto direito a 24px do chão. Desenhe a resposta certa para esta faixa.
- **1280px** — o corte real do app: a barra de abas dá lugar ao rail lateral; o canto inferior direito fica
  livre. Mostre a âncora final e a relação com o rail recolhido (76px) e expandido (240px).
- 1920px não precisa de prancheta própria se a âncora for a mesma de 1280px — diga se for.

## Regras que o desenho não pode quebrar
- **O aviso nunca afirma o que não aconteceu.** Todo sucesso aqui só dispara em resposta real do servidor; o
  desenho não pode sugerir confirmação onde o vocabulário diz "pendente" ou "pausado".
- **Falha de rede nunca é vendida como falta de Premium, e vice-versa.** Os três "Envio pausado" e o
  "Não foi possível registrar" são causas diferentes e precisam ser legíveis como diferentes.
- **A frase honesta é o corpo do aviso** — nunca reticências, nunca truncamento, nunca uma versão curta
  "de caber". Se não cabe, o cartão cresce.
- **Não pode cobrir a barra de abas nem a área segura do aparelho**: a folga do rodapé é a mesma que o shell
  já declara para tudo que é pinado (barra de abas + respiro + área segura), não um número novo.
- **Alvo de toque ≥ 44px** no botão fechar, sem que a margem negativa o faça sangrar para fora do cartão.
- **Contraste medido contra o fundo elevado do cartão**, nos dois temas — inclusive o ícone colorido de cada
  tom, que é hoje o único portador de significado.
- **Erro precisa de tempo de leitura maior que sucesso** (ou de nenhum tempo). 5 segundos para 69 caracteres
  é uma decisão de código, não de desenho.

## Armadilhas já pagas neste projeto
- **A barra de abas engoliu um elemento pinado antes** (014/T118: o total do kit parou a 8px do chão, 56px
  DENTRO da barra, e o vendedor leu o total com os dígitos cortados). O toaster repete o padrão pela metade:
  soma a barra, esquece a área segura.
- **Um toast que nunca renderizou** (E6/PR-B): 0 inserções em 8 segundos de observação. Um aviso disparado no
  fim de um fluxo que fecha a folha pode nascer atrás do overlay ou não nascer.
- **`toBeVisible` passa em elemento ocluso** — occlusão não é propriedade de texto. Este cartão é ocluído por
  duas coisas reais: a barra de abas e o overlay de diálogo. Desenhe as camadas explicitamente.
- **Estouro horizontal medido**: 92vw em 390px = 358,8px, menos 44px de botão e 18px de ícone e os espaçamentos
  → sobram ~270px para a frase. Desenhe com a frase de 77 caracteres, não com "Kit salvo.".
- **Headless não vê barra de rolagem clássica** (016/PR-B): a pilha crescendo não pode virar uma coluna que
  rola; ela precisa de um teto desenhado.

## Entregável
Pranchetas, tema escuro primeiro e claro como primeira classe (as duas, não uma variação de nota de rodapé):
1. **Anatomia do cartão** — ícone, frase, botão fechar, medidas e folgas, com os quatro tons lado a lado.
2. **Os quatro tons com as frases reais** (a curta, a longa de sincronização, a de erro, a de assinatura com
   data), cada uma em 390px.
3. **Âncora em 390px** — com a barra de abas de 64px desenhada abaixo, mostrando a folga real.
4. **Âncora em 1024px** — a faixa hoje quebrada, com a resposta proposta.
5. **Âncora em 1280px** — com o rail lateral expandido e recolhido.
6. **Pilha** — 2 avisos e 5 avisos, com a decisão de ordem (novo em cima ou embaixo) e de teto de fila.
7. **Movimento** — quadros de entrada e saída, e a versão para movimento reduzido.
8. **Aviso sobre folha aberta** — a resolução de camada.

Reutilize os primitivos `tf-*` em vez de criar novos: o cartão é `tf-toast` (fundo elevado, radius md, sombra
md, borda sutil — os mesmos tokens de superfície do `tf-card`); o ícone vem do conjunto `Icon` já existente
(`info`, `circle-check`, `circle-alert`, `x`); o botão fechar é a variante ícone-apenas do `tf-button`, não um
botão novo; o anel de foco é o `--ring` do DS. Se um tom precisar de fundo ou borda própria, derive dos tokens
`info` / `success` / `danger` existentes; não introduza cor nova.

## Perguntas em aberto para o dono
1. **Duração por tom**: sucesso curto pode sair em 3–4s, mas erro deve ficar até o vendedor fechar? O código
   já suporta "sem prazo" e ninguém usou.
2. **Ordem da pilha**: o aviso mais novo deve nascer perto do polegar (embaixo, como hoje) ou no topo da pilha?
   Hoje o mais recente é o mais próximo da barra de abas.
3. **Teto de fila**: quantos avisos simultâneos no máximo, e o que acontece com o excedente — descarta o mais
   antigo, ou agrupa ("+2 avisos")?
4. **Tom `neutral`**: ele deve continuar existindo como tom próprio ou colapsa em `info`? Hoje são visualmente
   idênticos e nenhuma tela pede um neutro deliberadamente.
5. **Aviso disparado com folha aberta**: ele deve aparecer POR CIMA da folha, ou esperar a folha fechar? A
   escolha muda a camada e a animação.
6. **Progresso visível**: o aviso mostra quanto tempo falta (uma linha que encolhe) ou some sem avisar?

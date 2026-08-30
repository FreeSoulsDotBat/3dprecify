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

- **Onde vive:** `shared/ui/button.tsx` / `button.css` — duas variantes: `danger` (fundo `--danger`, texto branco, hover `--danger-deep`) e `danger-ghost` (transparente, texto `--danger-text`, borda `--danger`). O ÚNICO consumidor de `danger-ghost` no app inteiro é "Cancelar assinatura", no painel de plano da Conta (`plan-panel.tsx:241`). O `danger` sólido é usado nas confirmações de exclusão dentro dos diálogos centrais.
- **Como o vendedor chega:** Sempre no fim de um caminho de perda: o vendedor abre o menu do item, toca em "Excluir", e o diálogo central se interpõe — o botão vermelho é o segundo clique, o que efetiva. Na Conta, ele rola até o fim do cartão de plano e encontra o "Cancelar assinatura" contornado, não preenchido.
- **Vizinhança imediata:** Dentro da fileira de ações do diálogo central, encostado à direita, com o "Cancelar"/"Voltar" secundário à sua esquerda — sob o título em caixa alta e a descrição que explica o que se perde. No painel de plano da Conta, fica ABAIXO do bloco de renovação e do botão "Gerenciar assinatura", separado dele — a colocação no desktop o dono desenhou; a aparência dos dois vermelhos (hover, foco, desabilitado, nos dois temas) foi decidida numa correção de defeito.
- **Dados que chegam (e o que ela devolve):** Só o `variant` e o rótulo. A escolha entre sólido e fantasma é semântica, registrada no código: num diálogo de PERDA, quem tem preenchimento é a saída SEGURA; a ação irreversível fica legível e vermelha, mas sem o convite de um botão cheio.
- **O que acontece depois:** Confirmando, o dado do vendedor some — filamento, impressora, orçamento, simulação — ou a assinatura entra em cancelamento no fim do período (o selo do plano CONTINUA verde, porque o Premium ainda está ativo, e degradá-lo seria a mentira oposta). A lista por baixo se atualiza e um toast confirma.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Diálogo modal central (confirmar / excluir / sair)` · `Folha lateral (Sheet) que entra pela direita` · `Densidade dos primitivos no desktop (≥1280px)` · `Dica de ajuda ⓘ (InfoTip)` · `Campo de texto — o primitivo que nunca foi construído` · `Selo (Badge) — o selo Premium desenhado que não existe, e as exceções do selo de tarifa` · `Estado vazio (EmptyState) — a arte que virou ícone, e o vazio da busca` · `Aviso efêmero (Toast) — posição, empilhamento e duração` · `Carregando — o giro que substituiu o esqueleto desenhado` · `PriceHero — o preço que não cabe (quebra, encolhe, rola)` · `O anel de foco — duas implementações e metade da espessura` · `Campo — a terceira camada de mensagem (aviso de plausibilidade)` · `NumberField — a máscara de milhar que reescreve o valor ao sair do campo` · `Grupo segmentado (bandeja com pílulas)` · `Botão em carregamento, desabilitado e com brilho` · `Seletor (Select) — o cursor ▾ e o popup do sistema` · `Alerta em bloco — tons e a variante compacta` · `Linha do detalhamento (BreakdownRow) — a ênfase negativa e o nome que o vendedor digita` · `Cartão — o clicável, o selecionado e as variantes sem espelho` · `Interruptor (Switch) — a trilha, o polegar e o alvo escondido`

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

# Botão destrutivo: `danger` (sólido) e `danger-ghost` (contornado)

## O que desenhar
As duas variantes vermelhas do botão do Precifica3D e a linha de ações em que elas vivem. Elas aparecem
sempre que o vendedor está prestes a perder algo: excluir um filamento/impressora/produto do catálogo,
excluir um registro do Histórico, descartar um cálculo que ainda não subiu para a conta, sair da conta com
registros pendentes, excluir uma simulação salva, e cancelar a assinatura Premium. São dois papéis
diferentes: o **sólido** é a ação irreversível quando ela É o que o usuário veio fazer (o "Excluir" dentro
do diálogo de confirmação), e o **contornado** é a ação irreversível quando ela NÃO é a ação padrão (o
gatilho "Excluir" ao lado de "Duplicar" numa ficha, e o "Cancelar assinatura" ao lado de um "Voltar"
preenchido).

## Por que este prompt existe
As duas variantes nasceram no código, não numa prancheta: `danger` é herdada do kit original, cujo readme
admite que "success/danger" foram acrescentados **fora** do manual de marca; `danger-ghost` foi criada em
2026-08-03 numa correção de bug (015/A8), para inverter uma hierarquia que a medição mostrou errada.
Autoridade parcial: o canvas do dono (018, `Abas-Desktop.dc.html`) **já decide a colocação** — usa
`tf-btn--danger-ghost` na ficha do Catálogo (l. 125, ao lado de "Duplicar", tamanho `sm`) e nas ações do
Orçamento (l. 316, isolado à direita com `margin-left:auto`, longe de "Exportar"). O que continua sem
desenho é a **pele**: a variante sólida em qualquer contexto, e os estados hover / foco / pressionado /
desabilitado / carregando dos dois vermelhos, nos dois temas.

## O que já existe hoje (não invente do zero — corrija)
Geometria real do botão (vale para as duas variantes): altura 48px, raio 14px, borda 1,5px, rótulo 16px
semibold, alvo mínimo 44×44px, pressionar reduz para 0,97 de escala.
→ **Medido**: o tamanho `sm` NÃO fica com 36px de altura — o mínimo de 44px vence; o `sm` só encurta o
padding e leva o rótulo a 14px. O "Excluir" `sm` do canvas é um botão de **44px de altura**, desenhe assim.

| Contexto (origem no app) | Gatilho hoje | Confirmação hoje | → problema |
| --- | --- | --- | --- |
| Catálogo, diálogo de exclusão (`catalog-panel.tsx`) | — | "Voltar" *ghost* + "Excluir" **sólido**, com carregando | a saída segura não tem peso nenhum |
| Histórico, registro salvo (`snapshot-manage.tsx`) | "Excluir" **secondary** (cinza) | "Voltar" *secondary* + "Excluir" **sólido** | gatilho destrutivo idêntico a "Editar rótulo" |
| Histórico, registro pendente (`entry-actions.tsx`) | "Descartar" **sólido `sm`**, solto na lista | "Voltar" + "Descartar" **sólido** | vermelho cheio dentro de uma lista |
| Simulações, linha da lista (`scenarios-list-sheet.tsx`) | lixeira **ghost, só ícone**, sem vermelho | "Voltar" *ghost* + "Excluir" **sólido** | terceira aparência para a mesma ação |
| Conta / Plano (`plan-panel.tsx`) | — | "Voltar" **secondary preenchido** + "Cancelar assinatura" **contornado** | única inversão deliberada, e a certa |
| Canvas 018, ficha e barra do Orçamento | "Excluir" **danger-ghost `sm`** | — | é esta a regra que falta escrever |

→ Quatro tratamentos diferentes para "excluir" convivem hoje (ícone ghost, cinza, sólido, contornado). O
desenho precisa resolver isso numa regra só, e o canvas do dono já aponta para o contornado no gatilho.

Textos literais em pt-BR (não reescreva; use exatamente):
- "Excluir “{nome}”?" · "Esta ação não pode ser desfeita." · "Excluir" · "Voltar"
- "Excluir este registro?" · "Não foi possível excluir o registro."
- "Descartar este registro?" · "Ele não foi enviado para a sua conta e não poderá ser recuperado." · "Descartar"
- "{n} registro(s) ainda não foram sincronizados" · "Sincronizar agora" · "Precisa de conexão para enviar."
  · "Sair e descartar" · "Descartar {n} registro(s) e sair?" · "Descartar e sair"
- "Cancelar a assinatura?" · "Seu Premium continua ativo até {data}." · "Depois disso, seus itens salvos
  ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." · "Cancelar
  assinatura" · "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes."
- Razões de bloqueio: "Esta ação precisa de conexão." · "Premium pausado — reative para renomear,
  duplicar, editar ou excluir."

## Conteúdo e dados reais
- Vermelhos em uso: base `#ef3340`, profundo `#c41f2b`, suave `#fde4e6` no tema claro e vermelho a 16% no
  escuro. O vermelho *de texto* é o profundo no tema claro e o base no escuro (calibrado contra o fundo real
  em que ele aparece, não contra branco teórico).
- Sólido hoje: fundo vermelho base, rótulo **branco** nos dois temas; hover troca o fundo para o profundo.
  → **Medi agora: branco sobre `#ef3340` dá ~4,0:1**, e o rótulo tem 16px semibold — não conta como "texto
  grande", então isso **reprova o AA de 4,5:1**. Pior: o hover (`#c41f2b`, ~5,9:1) é mais legível que o
  repouso, e o repouso é o estado em que o vendedor lê antes de clicar em algo irreversível.
- Contornado hoje: fundo transparente, rótulo no vermelho de texto, borda no vermelho base; no hover ganha
  o preenchimento suave e a borda escurece.
- Nomes reais que entram no título do diálogo: "PLA Preto 1,75mm", "Ender 3 V3 SE", "Kit Vaso Grande +
  Prato" — o campo de rótulo aceita até 120 caracteres.
- Diálogo do Premium com data real: "Seu Premium continua ativo até 12/09/2026."

## Estados obrigatórios
1. **Repouso** — sólido e contornado lado a lado, para comparar peso.
2. **Hover** — sólido escurece o fundo; contornado ganha o preenchimento suave e escurece a borda.
3. **Foco por teclado** — anel de 2px, hoje **roxo** (a mesma cor do foco de todo o app) inclusive no botão
   vermelho. Desenhe e decida: anel roxo sobre borda vermelha, ou anel vermelho? Mostre o escolhido.
4. **Pressionado** — 0,97 de escala, sem mudança de cor.
5. **Desabilitado** — hoje é só opacidade 0,55 sobre a mesma cor; num vermelho isso vira rosa apagado e o
   contornado perde legibilidade. Desenhe o desabilitado **com a razão ao lado**, nunca sozinho: "Esta ação
   precisa de conexão." (offline) e "Premium pausado — reative para renomear, duplicar, editar ou excluir."
6. **Carregando** — spinner à esquerda **e o rótulo continua** ("Excluir" com spinner). O botão cresce nesse
   estado: desenhe a linha de ações já acomodando o crescimento.
7. **Erro depois da tentativa** — o diálogo continua aberto, com o aviso vermelho acima da linha de botões
   ("Não foi possível excluir o registro." / "Não foi possível cancelar agora. Nada mudou — tente de novo
   em instantes.") e o botão de volta ao repouso.

## Viewports
- **390px (mobile)**: a peça existe em todas as telas listadas. Desenhe a linha de ações do diálogo (dois
  botões alinhados à direita) e o caso vertical de três botões empilhados do "sair com pendências".
- **1280px (desktop)**: é onde o canvas 018 coloca o contornado — ficha do Catálogo (ao lado de "Duplicar")
  e barra de ações do Orçamento (empurrado à direita, separado de "Exportar" / "Recalcular hoje" /
  "Comparar com hoje"). Desenhe as duas linhas de ação inteiras, não o botão isolado.
- 1920px é opcional: a linha de ações não muda de forma, só de largura disponível.

## Regras que o desenho não pode quebrar
- **A saída segura tem peso igual ou maior.** No diálogo de cancelamento, "Voltar" é preenchido e "Cancelar
  assinatura" é contornado — decisão do dono (015/A8), não se inverte de volta.
- **O rótulo da saída segura é sempre "Voltar"**, nunca "Cancelar": uma tela de cancelamento com um botão
  "Cancelar" é ambígua por construção.
- **Nada de exclusão sem confirmação**: o gatilho abre um diálogo, sempre.
- **Falha de rede nunca é vendida como "não é premium"** e vice-versa: as duas razões de bloqueio são frases
  distintas e ambas aparecem como texto de apoio visível, nunca como dica só no hover.
- Contraste medido **contra o fundo real** (o vermelho sólido, o suave sobre o card, a borda sobre o cartão).
- Alvo ≥44×44px em todos os tamanhos, inclusive no botão só de ícone.

## Armadilhas já pagas neste projeto
- **Largura desigual medida**: "Cancelar assinatura" mediu 187,6×48px contra 85,6×48px do "Voltar" — a linha
  de dois botões com rótulos muito diferentes já estourou caixa neste app. Desenhe com o rótulo mais longo
  real, não com um "Excluir" curto.
- **Título com nome longo**: "Excluir “{nome}”?" com 120 caracteres precisa quebrar em duas linhas dentro do
  diálogo, sem vazar e sem truncar o "?" que o torna uma pergunta.
- **Frase honesta fora de placeholder**: as razões de bloqueio e os avisos de erro vivem em elementos de
  largura cheia; este projeto já perdeu uma frase por cortá-la dentro de um campo estreito.
- **Ocluso passa no teste**: um botão coberto por outro elemento continua "visível" para o teste automático.
  A linha de ações precisa de folga desenhada entre o destrutivo e o vizinho.

## Entregável
Pranchetas, **tema escuro e tema claro lado a lado** (o escuro é o padrão do app, o claro é first-class):
1. Matriz de estados dos dois vermelhos (repouso, hover, foco, pressionado, desabilitado, carregando), nos
   tamanhos `md` (48px) e `sm` (também com 44px de alvo).
2. Diálogo de exclusão do Catálogo, 390px — com o aviso de tom `info` de item referenciado presente.
3. Diálogo de cancelamento do Premium, 390px — a hierarquia invertida, com as três linhas de texto.
4. "Sair com pendências", 390px — os três botões empilhados, um deles desabilitado com a legenda.
5. Ficha do Catálogo e barra de ações do Orçamento, 1280px — a colocação que o canvas 018 já fixou.
Reutilize os primitivos existentes, sem criar novos: o botão `tf-btn` nas variantes `--danger` e
`--danger-ghost` (com `--sm` onde o canvas manda), o `tf-dialog` para as confirmações, o `tf-alert` no tom
`danger` para o erro pós-tentativa e no tom `info` para o aviso de item referenciado, e o `tf-spinner`
dentro do botão no estado carregando. A razão de bloqueio é texto de apoio, não um componente novo.

## Perguntas em aberto para o dono
1. O rótulo branco sobre o vermelho base reprova o contraste AA (~4,0:1 medido, rótulo de 16px). Aceita
   trocar o **repouso** do sólido para o vermelho profundo (que já é o hover, ~5,9:1) — o que muda a cara do
   botão em cinco telas já homologadas — ou mantemos e registramos a exceção?
2. Regra única para o **gatilho** de exclusão fora do diálogo: hoje convivem lixeira-ícone cinza
   (Simulações), botão cinza (Histórico) e vermelho cheio (registro pendente), e o canvas 018 usa o
   contornado. Padronizamos tudo no contornado, inclusive na lista de Simulações?
3. "Descartar" e "Excluir" são dois verbos para duas coisas diferentes (o que nunca chegou à conta vs. o que
   já está salvo). A distinção é intencional e fica, ou unificamos em "Excluir"?

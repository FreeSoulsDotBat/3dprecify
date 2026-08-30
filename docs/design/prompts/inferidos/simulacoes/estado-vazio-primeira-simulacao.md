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

## O mapa funcional de Simulações salvas (cenários de marketplace)

### Simulações salvas (cenários de marketplace) — mapa funcional da área

**O que é.** Uma *simulação* é uma estratégia de venda guardada: a combinação de canais (Mercado Livre, Shopee, Amazon…), modalidade, categoria, taxas ajustadas à mão, markup e a base de custo que estavam na tela quando o vendedor salvou. Ela **não guarda preço**. Ao reabrir, o app recalcula tudo com os preços e as tarifas de hoje — é o oposto do Orçamento, que congela um número para sempre. Toda a copy da área existe para sustentar essa diferença ("Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." / "Recalculado com os preços de hoje"), e por regra **nenhum cartão de simulação mostra data nem dinheiro** — só nome, nota e um carimbo relativo ("Atualizado há 2 dias").

**Como o vendedor chega.** A área **não tem rota própria**: ela vive inteiramente como folhas (`Sheet` ancorado à direita, largura `min(92vw, 26rem)`, altura total, sobre um scrim) e blocos dentro da aba **Calcular** (`/calcular`). Decisão técnica registrada no código: uma sub-rota `/calcular/cenarios` abriria em branco no recarregamento (o app usa `base:'./'`, e qualquer rota de 2 segmentos morre no cold load). Três portas existem:
- **"Minhas simulações"** — botão fantasma no topo do `/calcular`, abre a folha da lista. Visível para **todo mundo**, inclusive grátis e deslogado.
- **"Salvar simulação"** — botão no rodapé do `/calcular`, abaixo do resultado. **Só existe com Premium ativo** (não é teaser, é ausência).
- **"Salvar simulação"** — o mesmo botão dentro da ficha de produto salvo do Catálogo (`/catalogo/produtos/$id`), que grava a simulação **referenciando aquele produto**.

**As rotas envolvidas.** `/calcular` (a única casa da área: lista, salvar, barra de contexto, resumo de kit, avisos) · `/catalogo` com `?produto=` e `/kits?id=` (destinos do botão "Abrir origem", quando a base de custo é um produto ou um kit do catálogo).

**O que a área guarda, e onde.** No **servidor** (Postgres, por usuário): nome, nota e o documento de configuração (`config`), com paginação *keyset* por `created_at DESC` e busca por nome. No **cache local IndexedDB, chaveado por uid**: uma cópia de leitura da lista não filtrada, pré-carregada antes da resposta do servidor e usada como fallback quando a rede falha; **purgada no logout**. Escrita **não tem outbox**: diferente de Orçamentos, salvar/renomear/duplicar/excluir offline **falha na hora, honestamente** — nunca entra em fila, nunca finge que salvou.

**De que depende.** Do **entitlement** vindo do servidor (`active` · `lapsed` · `none`) — o cliente só decora, quem barra é o servidor · do **catálogo de tarifas** servido + cacheado + com semente embutida (é ele que faz o recálculo "de hoje" mudar) · do motor **`pricing-core`** em TypeScript, que calcula no dispositivo, inclusive offline · da **sessão Firebase** (sem sessão não há lista) · e das entidades **produto** e **kit** do Catálogo, quando a base de custo é uma referência.

**O que ela alimenta depois.** Reaberta, a simulação **vira a calculadora**: os 17 campos escalares são repovoados e o cálculo roda ao vivo. Dali o vendedor pode **congelar um orçamento** (Histórico/Orçamentos) a partir da simulação — o orçamento nasce carimbado com a procedência `SCENARIO` (id + nome como estavam ao abrir). E pode **duplicar-para-ajustar**: a cópia nasce no servidor como "Cópia de {nome}" e passa a ser o objeto editado.

**Estados por situação:**
- **Grátis / deslogado** — a porta "Minhas simulações" aparece igual, mas a folha inteira vira um **teaser Premium** ("Salve suas simulações…" + "Assinar" + "A calculadora continua grátis."), e o subtítulo da lista é suprimido para não repetir a promessa. O botão "Salvar simulação" **não existe** no rodapé.
- **Premium ativo** — lista, busca, abrir, renomear, duplicar, excluir, salvar alterações: tudo liberado.
- **Premium pausado (lapsed)** — **leitura completa, escrita congelada**: abre e recalcula normalmente, mas os três ícones de cada cartão ficam desabilitados, um alerta "Premium pausado" aparece no topo da lista e a mesma frase se repete embaixo de cada cartão e na barra de contexto. Não há CTA de reativação dentro desses avisos.
- **Offline** — a lista é servida do cache com o alerta "Modo leitura offline"; o cálculo continua funcionando (o motor é local); qualquer escrita responde "Esta ação precisa de conexão." Quando lapso e offline coincidem, a justificativa do lapso vence.
- **Sessão expirada** — o 401 não apaga o cache; a área depende do banner global "Entrar de novo" para o vendedor voltar.

**Corte desktop.** O app tem um limiar de composição em **1280px** (`useIsWide`), usado hoje por Catálogo, Kits, Orçamentos e Conta (lista + ficha ao lado). **Nada da área de Simulações usa esse limiar** — em 1920px ela renderiza exatamente o layout de celular. O `/calcular` em si vira duas colunas a partir de 1024px, mas todos os blocos de simulação ficam **fora da grade**, em faixa única de largura total.

## O ponto exato de inserção desta peça

- **Onde vive:** No corpo da folha "Minhas simulações", ocupando o espaço da pilha de cartões: um `EmptyState` com ícone `boxes` (o mesmo emprestado do Catálogo, sem grafismo/ilustração), título "Nenhuma simulação salva ainda", corpo explicando o caminho ("Monte uma comparação de canais na calculadora e toque em “Salvar simulação”…") e um `Button variant="secondary"` "Voltar para a calculadora".
- **Como o vendedor chega:** É o PRIMEIRO contato de um vendedor que acabou de virar Premium: ele assina, toca em "Minhas simulações" e encontra esta tela. Também aparece depois de excluir a última simulação.
- **Vizinhança imediata:** Acima: o campo de busca (que continua visível e utilizável mesmo sem nenhum item) e o subtítulo-promessa; acima deles, o título da folha e o X de fechar. Abaixo: nada — o painel termina aí, com toda a altura restante vazia. Por baixo do scrim, a calculadora com o rodapé onde vive o botão "Salvar simulação" que criaria a primeira.
- **Dados que chegam (e o que ela devolve):** Recebe apenas `items.length === 0` com `searching === false` (busca vazia). Não recebe amostra, exemplo nem sugestão de nome. O botão devolve `onClose`.
- **O que acontece depois:** O único CTA fecha a folha e devolve a calculadora exatamente como estava — ele não rola até o botão "Salvar simulação", não abre a folha de salvar, não preenche nada.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Primeiro contato com "Minhas simulações" — a tela vazia

## O que desenhar

O estado vazio que aparece dentro do painel lateral **"Minhas simulações"** quando o vendedor Premium
abre a funcionalidade pela primeira vez e ainda não salvou nenhuma simulação. O painel é um sheet
ancorado à direita (`tf-dialog--sheet-right`, largura `min(92vw, 26rem)` — ~359px no mobile de 390,
416px no desktop), aberto pelo botão fantasma "Minhas simulações" que fica no topo da página
Calcular, ao lado do título. Quem chega aqui é um assinante que acabou de virar Premium e está
descobrindo o que é uma simulação: **é o único momento em que o produto tem a chance de ensinar isso**.
A saída do vazio é fechar o painel e usar o botão "Salvar simulação", que vive na calculadora, atrás
do painel.

## Por que este prompt existe

Esta peça nunca foi desenhada — foi inferida a partir de requisito textual. O componente `EmptyState`
foi desenhado (protótipo 2026-07-02), mas o protótipo **derruba a versão construída**: lá todo estado
vazio tem ARTE (`Grafismo` "espada"/"arco"/"linha" a 84–96px) e um CTA que AGE ("Adicionar filamento",
botão primário), e a regra de marca §C.6 pede "um floreio orgânico por tela… ótimos em empty-states".
O vazio de simulações é a única instância do produto **sem grafismo**, com um ícone reciclado do
catálogo (`boxes`) e um CTA secundário — "Voltar para a calculadora" — que **não faz nada além de
fechar o painel**. Nas 4 autoridades de design, 0 ocorrências de vazio de cenários. O código, aqui,
contraria uma regra de desenho explícita.

## O que já existe hoje (não invente do zero — corrija)

Composição atual do painel quando a lista volta vazia, de cima para baixo:

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título do sheet | "Minhas simulações" | `tf-dialog__title`, caixa alta, fonte de título |
| Subtítulo | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | só renderiza para quem tem Premium (o grátis vê o teaser no lugar) |
| Campo de busca | placeholder "Buscar por nome…" | → **renderiza mesmo com zero simulações**: uma busca sobre o nada |
| Ícone do vazio | ícone `boxes` a 28px num quadrado 56px de `--accent-soft`, cantos `--radius-lg` | → é o MESMO ícone do botão de entrada; não diz "simulação", diz "caixas" |
| Título do vazio | "Nenhuma simulação salva ainda" | copy boa, manter verbatim |
| Corpo do vazio | "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." | ensina o caminho e cita o botão real entre aspas curvas; manter verbatim |
| Ação | botão **secundário** "Voltar para a calculadora" | → o `onClick` é literalmente "fechar". Nenhuma arte, nenhuma condução |

→ **Três problemas a resolver no desenho:** (1) ausência de grafismo, contra §C.6 e contra as outras
telas; (2) ícone emprestado do catálogo; (3) hierarquia invertida — a única ação do momento mais
importante da funcionalidade é um botão secundário que fecha.

## Conteúdo e dados reais

- Não há número nem dinheiro nesta peça: ela existe justamente porque não há dados. O que existe é o
  **caminho**: painel → fechar → calculadora → botão "Salvar simulação" (que na calculadora só
  aparece para Premium e recusa com "Corrija os campos da calculadora antes de salvar." se a
  simulação estiver inválida).
- O que uma simulação guarda, e é o que a peça precisa fazer entender: canais de venda, taxas
  ajustadas e a base de custo (avulsa, referência do catálogo ou kit do catálogo). Ao reabrir, **ela
  recalcula com os preços de hoje** — é isso que a separa de um Orçamento, que fica congelado.
- Quando já existirem simulações, cada card mostra nome (1 linha, com reticências), nota opcional
  (2 linhas, com reticências) e "Atualizado há 2 dias" — **nunca uma data**. Útil como referência do
  que o vazio está prometendo, não para desenhar aqui.
- Limites que aparecem no fluxo vizinho: nome obrigatório, máx. 120 caracteres; nota opcional, máx.
  500 caracteres.

## Estados obrigatórios

1. **Vazio de verdade (primeiro contato)** — Premium ativo, zero simulações salvas. Ícone/arte +
   "Nenhuma simulação salva ainda" + o corpo verbatim + a ação. É a prancheta principal.
2. **Vazio da busca** — existem simulações, o filtro é que não achou: "Nenhuma simulação encontrada
   para “termo”." + botão secundário "Limpar busca". **Não pode parecer o mesmo vazio do item 1** —
   dizer "nenhuma simulação salva" para quem tem simulações é mentira sobre os dados do vendedor.
3. **Carregando** — hoje é só um `Spinner` centralizado com `padding` vertical generoso, sem
   esqueleto. Desenhe o que deve aparecer antes de sabermos se está vazio ou cheio.
4. **Erro de carga (frio)** — alerta de perigo "Não foi possível carregar suas simulações." + botão
   secundário "Tentar novamente". Nunca um vazio: "não carregou" ≠ "não existe".
5. **Offline / leitura em cache** — alerta informativo, título "Modo leitura offline", corpo "Suas
   simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de
   conexão." + "Tentar novamente". Desenhe como esse alerta convive com o vazio acima dele.
6. **Premium pausado (lapsed)** — alerta informativo, título "Premium pausado", corpo "Suas simulações
   continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir,
   reative o Premium." → **hoje esse aviso só aparece quando existe pelo menos uma simulação**: um
   assinante pausado com zero simulações vê o vazio limpo, convidando a salvar algo que ele não pode
   salvar. Desenhe a versão pausada do vazio.
7. **Sem permissão (grátis / deslogado)** — não é esta peça: o painel troca o corpo inteiro pelo
   teaser Premium. Só precisa constar que o vazio **nunca** deve ser confundido com paywall.
8. Estados de interação do CTA e do campo de busca: repouso, hover, foco visível, pressionado e, no
   caso pausado/offline, desabilitado com o motivo escrito ao lado — nunca um botão morto e mudo.

## Viewports

- **Mobile 390px** — obrigatória. O sheet ocupa 92vw (~359px) e o vazio vive dentro dele com padding
  de `--space-5`; a `max-width: 28rem` do bloco nunca chega a valer, então todo o texto quebra.
- **Desktop 1280px** — obrigatória. Mesmo sheet, agora travado em 416px encostado à direita, com a
  calculadora visível por baixo do overlay. Vale mostrar como o vazio se comporta numa coluna alta e
  estreita: 416px de largura por quase toda a altura da tela é muito espaço vertical vazio — é onde
  o grafismo e a hierarquia se resolvem, ou não.
- 1920px não precisa de prancheta própria: o sheet não cresce, só o fundo.

## Regras que o desenho não pode quebrar

- **Freemium binário.** Este vazio é território de quem JÁ pagou. Nada de selo de cadeado, coroa,
  "desbloqueie" ou preço. A conversão acontece no teaser, não aqui.
- **Nada de data.** A funcionalidade inteira proíbe data-alegação; o vazio não pode inventar
  "criado em" nem "desde".
- **Falha de rede nunca é falta de permissão.** Erro e offline têm frases próprias, já escritas —
  não podem ser desenhados como "você não tem simulações".
- **Frase honesta fora de placeholder.** O corpo educativo é texto de bloco, largura cheia; nunca
  dentro do campo de busca, nunca cortado.
- **Alvo ≥44px** para o CTA e para qualquer botão do alerta, inclusive dentro do sheet estreito.
- Contraste medido contra o fundo real do sheet (que é uma superfície elevada sobre overlay), nos
  dois temas.

## Armadilhas já pagas neste projeto

- **O campo de busca já shipou invisível** (1×1px) porque foi escondido pela via errada. Se o desenho
  decidir que a busca não deve existir no vazio, diga "não renderiza"; se decidir que existe, desenhe
  a geometria dela explicitamente.
- **Texto ocluso passa em teste.** `toBeVisible` aprova elemento sobreposto ou estourado — a
  homologação desta peça lê caixas, não strings. Nada pode encostar na borda de 359px.
- **Placeholder corta a frase.** Uma frase honesta dentro de um `placeholder` desaparece ao digitar e
  é clipada em campo estreito; já custou uma homologação neste projeto.
- **Aspas curvas no corpo** (“Salvar simulação”) são parte da copy homologada — não troque por retas
  nem quebre a citação em duas linhas de forma que o nome do botão fique partido.

## Entregável

Pranchetas, tema **escuro como padrão e claro como first-class** (as duas versões de cada uma das
duas primeiras):

1. Vazio de primeiro contato — mobile 390px (escuro + claro).
2. Vazio de primeiro contato — desktop 1280px, sheet sobre a calculadora (escuro + claro).
3. Vazio da busca ("Nenhuma simulação encontrada para “kit natal”." + "Limpar busca").
4. Vazio + faixa "Premium pausado", e vazio + faixa "Modo leitura offline".
5. Carregando e erro de carga, lado a lado, no mesmo recorte de painel.

Reutilize os primitivos existentes, sem criar componentes novos: o painel é `tf-dialog--sheet-right`
com `tf-dialog__title` + `tf-dialog__desc`; o bloco vazio é `tf-empty` (`__icon` no quadrado 56px de
`--accent-soft`, `__title`, `__desc`, `__action`); os avisos são `tf-alert` nos tons `info` e
`danger`; os botões são `tf-btn` nas variantes `primary`/`secondary`/`ghost`; a busca é
`tf-inputwrap` + `tf-input`; o carregando é `tf-spinner`. **O floreio deve usar o `Grafismo` que já
existe** — as quatro formas disponíveis são `arco`, `espada`, `linha-curva` e `onda`; `espada` e
`arco` já estão faladas no catálogo e no 404, então prefira `onda` ou `linha-curva` para simulações.
Se você propuser um ícone próprio para "simulação" no lugar do `boxes` emprestado, entregue-o como
proposta explícita, marcada como adição ao conjunto de ícones.

## Perguntas em aberto para o dono

1. **O CTA do vazio deve agir ou continuar só fechando?** Três produtos diferentes: (a) fecha o
   painel e ainda leva o olho até o botão "Salvar simulação" na calculadora; (b) cria uma simulação
   de exemplo (semente), como o Catálogo ganhou na rodada 2; (c) permanece "Voltar para a
   calculadora", assumido como suficiente. O desenho muda inteiro conforme a resposta.
2. **Se for semente, o que ela contém?** Uma comparação de canais fictícia é um número na tela — e
   este produto proíbe número sem procedência. Precisa de rótulo de exemplo, e o rótulo é decisão
   sua.
3. **A busca some quando não há nada salvo?** Ela hoje aparece sobre uma lista vazia. Some, ou fica
   desabilitada com motivo?
4. **O assinante pausado com zero simulações deve ver "Premium pausado" no vazio?** Hoje não vê, e o
   vazio o convida a salvar algo que ele não consegue salvar.

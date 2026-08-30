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

## O mapa funcional de Calculadora e precificação

### A área "Calcular" (aba 1, rota `/calcular`)

**Como o vendedor chega.** `/calcular` é a porta do produto: a raiz `/` redireciona para cá e a aba é a
primeira do menu (`Calcular · Catálogo · Kits · Orçamentos · Conta` — no código: `/calcular`, `/catalogo`,
`/kits`, `/historico`, `/conta`). É a **única rota pública sem nenhum portão**: renderiza para anônimo,
grátis, Premium, online e offline. O menu é barra inferior até 425px e barra lateral acima disso (rail de
76px abaixo de 600px e a partir de 1280px por escolha do vendedor).

**O que ele vem fazer.** Digitar os custos de uma peça impressa e ler dois preços sugeridos (varejo e
atacado), com a conta aberta item a item. É a única tela do app que calcula preço a partir de campos
crus — e ela é **grátis e ilimitada**.

**Rotas da área.** Uma só: `/calcular`. Não há sub-rota; tudo o mais é folha/diálogo por cima
(a folha "Meus cenários", a folha de salvar cenário, a folha de gravar no histórico). O mesmo formulário
é *reusado* fora da área — a página de produto (`/catalogo?produto=…`) e o editor de linha de kit
(`/kits`) montam `CostsSection`, `FieldGroup`, `OtherCostsSection`, `MarketplaceSection`, `PriceResults`,
`TimeHmField` e `MachineCostFields` exatamente iguais.

**Layout.** Coluna única até 1023px, na ordem em que está escrito. A partir de `min-width:1024px` a
página sobe de 460px para 1120px e vira **duas colunas** (`.tf-calc-grid`) com um **rodapé de largura
total** (`.tf-calc-footer`, filhos capados em 720px e centrados) que carrega o resultado inteiro.

**O que a área guarda.** Nada por si só. O formulário vive em memória (React Hook Form); recarregar
perde tudo — e por isso existe um diálogo de aviso de saída quando há algo digitado. Persistir é sempre
uma ação Premium **para fora** da área: "Salvar cenário" (simulação) e "Salvar no histórico" (orçamento
congelado). O que a área lê de fora: o **catálogo de tarifas** (servido → cache local → semente
embutida, nunca bloqueia), o **entitlement** do servidor (`active` / `none` / `lapsed`), e as listas de
**filamentos e impressoras** do catálogo Premium (cache local por uid, respondem offline).

**Quem calcula.** `pricing-core`, no aparelho, sempre. O servidor nunca recalcula. Offline os preços
saem iguais; o que falha é só a atualização de tarifas e a escrita.

**O que a área alimenta depois.** Um cálculo válido vira (a) uma **simulação salva** — reabri-la traz a
Calcular preenchida de volta, com barra de contexto e selo de alterações não salvas; (b) um **orçamento
congelado** no Histórico (escrita offline vai para a fila/outbox e drena depois). No sentido inverso, o
Catálogo alimenta a Calcular pelo bloco "Usar do catálogo", e um kit reaberto como base traz um resumo
somente-leitura no lugar da conta escalar.

**Como muda por estado.**
- **Grátis / deslogado** — todos os custos, markup e os dois preços funcionam. A seção Marketplace vira
  um portão: chave desligada e desabilitada + "Vender em marketplaces faz parte do Premium." + teaser
  centrado, ocupando as **duas colunas**; "Outros custos" migra da esquerda para a direita para
  compensar. Some "Usar do catálogo" (vira um cartão de teaser com botão desabilitado) e somem os dois
  botões de gravar. "Meus cenários" continua visível para todos — é a porta honesta.
- **Premium ativo** — marketplace ligável, canais repetíveis com tarifas pré-preenchidas pelo catálogo,
  "Preços por canal" na cauda do detalhamento, e os dois botões de gravar no rodapé.
- **Premium pausado (lapsed)** — a Calcular se comporta como grátis para OFERECER (só `active` habilita);
  o que já foi salvo continua legível pela folha "Meus cenários", que exibe seu próprio aviso de plano.
- **Offline** — cálculo intacto; o selo de cada canal passa a dizer "referência embutida (offline)" e
  pode acusar "desatualizado"; um aviso não-bloqueante com "Tentar de novo" aparece no topo da lista de
  canais; gravar vai para a fila.
- **Sessão expirada** — faixa de sessão no topo do shell ("Entrar de novo"); as leituras Premium falham
  e o bloco "Usar do catálogo" pode cair no cartão de erro com "Tentar de novo"; a conta continua sendo
  feita normalmente.

## O ponto exato de inserção desta peça

- **Onde vive:** A primeira dobra de /calcular, acima de tudo: as três primeiras faixas da página, em largura total.
- **Como o vendedor chega:** É o que o vendedor vê ao abrir o app — /calcular é a rota inicial e é pública, então esta é literalmente a primeira tela do produto para um visitante anônimo.
- **Vizinhança imediata:** Ordem exata: (1) o cabeçalho de página com o título 'Calcular preço' CENTRADO; (2) logo abaixo, centrada, a promessa freemium como legenda cinza de 12px — 'Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.'; (3) uma linha alinhada à DIREITA com um botão fantasma pequeno, com ícone, escrito 'Meus cenários'. Depois disso vêm, quando existem: a barra de cenário carregado, o alerta de campo aposentado, o resumo de kit, o cartão de teaser e o cartão 'Usar do catálogo' — e só então a grade do formulário.
- **Dados que chegam (e o que ela devolve):** Nada calculado: é texto fixo. O botão abre a folha lateral de simulações salvas, que existe para TODOS (inclusive grátis e deslogado) — é a porta honesta para o que é Premium.
- **O que acontece depois:** A folha 'Meus cenários' cobre a página; escolher uma simulação a carrega DENTRO deste mesmo formulário (e, se a base for kit, troca o resultado pelo resumo somente-leitura). Enquanto a folha está aberta, o cartão de teaser abaixo é escondido para não haver dois botões de compra na mesma tela.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Topo da Calcular — título, promessa freemium e a porta “Minhas simulações”

## O que desenhar

A primeira dobra da aba **Calcular**, a tela que abre o app e onde o vendedor de peças 3D passa a
maior parte do tempo. São três elementos empilhados acima do primeiro cartão de campos: o título da
página, a frase que diz o que é grátis e o que é Premium, e a porta de entrada para as simulações
salvas. É o que a pessoa lê nos primeiros dois segundos — antes de digitar qualquer número, antes de
ver preço nenhum. Abaixo desse bloco vêm, condicionalmente, a barra da simulação carregada, avisos
informativos, o resumo de kit, o teaser Premium e só então os cartões de custo/markup.

## Por que este prompt existe

Este topo nunca foi desenhado: foi montado a partir de requisito textual. O protótipo de 2026-07-02
(§E3, `CalculatorScreen.jsx`) desenhava outra coisa — uma `TopBar` com logo à esquerda, título e dois
IconButtons, e a frase freemium no **rodapé** da tela. Em 015/A8 o dono mediu que essa frase vivia a
3.413px de 3.529 (97% da altura, 4,6 telas de rolagem a 360px) e mandou subi-la para a primeira
dobra — decisão medida, correta, e **só de posição: a forma nunca foi desenhada**. Hoje ela é uma
legenda cinza de 12px. Pior: o canvas 018 do dono desenha o cabeçalho das quatro abas irmãs
(Catálogo · Kits · Orçamentos · Conta) como `tf-page-header` **alinhado à esquerda**, com título +
descrição em `max-width:760px` e a ação primária na **direita da mesma linha**. A Calcular contraria
essa convenção em duas frentes: centraliza o título e joga a porta numa linha própria abaixo.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual, de cima para baixo (`apps/web/src/pages/calcular/calcular-page.tsx`):

| # | Elemento | Como está hoje | Texto literal |
|---|---|---|---|
| 1 | Título `h1` | `tf-page-header` + modificador `--center`, `font-size: var(--fs-lg)`, **centralizado**, sem descrição | “Calcular preço” |
| 2 | Promessa freemium | parágrafo solto, `--fs-caption` (12px), cor `--text-muted`, centralizado | “Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.” |
| 3 | Porta das simulações | linha própria `flex justify-end`, botão **ghost sm** com ícone `boxes` 16px | “Minhas simulações” |

→ **Problema 1 — hierarquia invertida.** A frase mais importante do produto é o **menor e mais claro**
texto da dobra (12px, `--text-muted`), enquanto “Calcular preço” — que o vendedor já sabe, porque a
aba está marcada na navegação — é o maior. O desenho precisa resolver quem é o protagonista da dobra.

→ **Problema 2 — a porta não pertence a essa região visual.** “Minhas simulações” é navegação, não
uma ação do formulário. Hoje flutua sozinha entre o título e o primeiro cartão, num alinhamento à
direita que não conversa com nada. O canvas 018 já resolveu isso nas abas irmãs: título à esquerda,
ação na direita da mesma linha.

→ **Problema 3 — centralização isolada.** `tf-page-header--center` existe **só** para esta tela. Ou o
desenho justifica por que a Calcular é a exceção, ou alinha à esquerda como as outras quatro.

→ **Problema 4 — o `h1` não tem descrição.** As abas irmãs têm `tf-page-header__desc`. Aqui a
promessa freemium ocupa esse lugar sem ser esse elemento — mesmo papel, forma diferente.

## Conteúdo e dados reais

- **Título:** “Calcular preço”. É `h1`, é o único heading de nível 1 da página e recebe **foco
  programático** ao navegar entre abas (leitores de tela anunciam a seção nova) — precisa de um anel
  de foco visível quando alcançado pelo teclado, e nada visível no foco programático.
- **Promessa freemium (texto homologado, não parafrasear):** “Calcular custo e markup é grátis, sem
  limite. Vender em marketplaces, salvar e exportar fazem parte do Premium.” São **duas afirmações
  numa frase**: o que é grátis e o que é pago. As duas metades são verdade e nenhuma pode sumir.
- **Porta:** “Minhas simulações”, ícone de caixas, **sempre visível e sempre habilitada** — inclusive
  para quem está deslogado ou no plano grátis. É a porta honesta: quem clica sem Premium vê a oferta
  dentro da folha, não uma porta trancada nem uma porta invisível.
- **O que vem logo abaixo do bloco** (não é objeto deste desenho, mas define o espaço até o primeiro
  cartão): barra de contexto da simulação reaberta, avisos `info`, resumo de kit e o teaser Premium
  “Preencha o cálculo com um toque” com a legenda “O cálculo de custo e markup continua grátis.”
  Desenhe o topo sabendo que **frases sobre grátis/Premium podem aparecer duas vezes na mesma dobra**
  quando o teaser está presente — o desenho precisa evitar que soem como a mesma coisa repetida.

## Estados obrigatórios

1. **Repouso, plano grátis / deslogado** — os três elementos, porta habilitada.
2. **Repouso, Premium ativo** — idêntico; a promessa freemium **continua na tela** (ela também explica
   o que a assinatura cobre). Se o desenho achar que ela deve mudar para quem já assina, isso é
   pergunta ao dono, não decisão do desenho.
3. **Foco de teclado no título** — anel visível no `h1` (alvo de foco na troca de aba).
4. **Porta: repouso / hover / foco / pressionado** — os quatro estados do botão ghost, alvo ≥44px de
   altura clicável mesmo em tamanho `sm`.
5. **Simulação carregada** — logo abaixo do bloco entra a barra de contexto com o nome da simulação;
   desenhe como o topo convive com ela (espaçamento e continuidade visual), não a barra em si.
6. **Premium pausado (`lapsed`) e offline** — o topo **não muda**: a porta continua aberta e a leitura
   continua permitida; quem bloqueia escrita é a folha. Mostre essa prancheta justamente para provar
   que nada aqui some — nunca vender falha de rede como “não é premium”.
7. **Título longo/quebra** — o `h1` quebra em qualquer ponto (`overflow-wrap: anywhere`) porque em
   outras telas ele carrega nome de registro. Aqui o texto é fixo, mas o desenho não pode depender de
   uma linha só.

## Viewports

- **Mobile 390px** — obrigatório: é a superfície principal e a dobra medida em 015/A8. A largura útil
  do corpo é ~460px no máximo, coluna única.
- **Desktop 1280px** — obrigatório: é o corte do 018, e é onde a divergência com as quatro abas irmãs
  aparece. A partir de 1024px o corpo da calculadora se alarga para o `--content-max` (~1120px) e os
  campos viram duas colunas — o topo precisa parecer o cabeçalho dessa largura maior, não um bloco de
  460px centralizado num vazio.
- **Desktop 1920px** opcional, só se a solução mudar de forma acima de 1280px.

## Regras que o desenho não pode quebrar

- **Freemium é binário e dito na cara.** Grátis é grátis sem limite; Premium é Premium. Nada de
  “experimente”, “desbloqueie” ou promessa que não se cumpre.
- **A frase honesta nunca vive em placeholder nem em elemento que pode ser cortado.** Ela é conteúdo
  de largura total; se não couber, quebra em duas linhas — nunca reticências.
- **A porta “Minhas simulações” fica visível para todo mundo.** Esconder a porta de quem não assina é
  o oposto da honestidade; trancar com cadeado sem explicar, também.
- **Contraste medido contra o fundo real**, nos dois temas. `--text-muted` a 12px é justamente o que
  está em xeque aqui: se a frase continuar em muted, prove que o contraste passa; se subir de peso,
  diga qual token usa.
- **Alvo de toque ≥44px** para a porta, mesmo com o botão em tamanho `sm`.
- **Zero rolagem horizontal em 390px**, medida nos dois eixos.

## Armadilhas já pagas neste projeto

- **Rolagem horizontal medida, não olhada** — em 016/PR-B um item vazou no eixo vertical e o headless
  não viu a barra clássica. Qualquer solução que aproxime título e ação numa mesma linha precisa
  provar que a 390px ela empilha em vez de espremer.
- **Texto ocluso passa em teste** — `toBeVisible` aprova elemento totalmente sobreposto. A frase
  freemium é exatamente o tipo de elemento que “existe” e ninguém lê. O desenho precisa dar a ela um
  lugar que não dependa de fé.
- **Sufixo cortado em elemento estreito** (016/PR-F): frase honesta em caixa apertada some pela
  direita. Duas linhas confortáveis valem mais que uma linha elegante que corta.
- **Dois CTAs de compra na mesma tela** (E6/T038-D4 e 016/T010-A3, a mesma classe duas vezes): se o
  topo ganhar qualquer chamada para o Premium, ela vai coexistir com o teaser logo abaixo. Desenhe
  contando com essa vizinhança.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. Mobile 390px — repouso, plano grátis.
2. Mobile 390px — com simulação carregada (mostrando o encontro com a barra de contexto abaixo).
3. Desktop 1280px — repouso, com o bloco na largura real do conteúdo.
4. Desktop 1280px — hover/foco na porta “Minhas simulações”.
5. Uma prancheta de comparação lado a lado: **o topo de Orçamentos (convenção 018)** vs. **o topo da
   Calcular proposto**, para o dono julgar se a Calcular vira exceção ou entra na convenção.

Reutilize os primitivos existentes, sem criar novos: `tf-page-header` + `tf-page-header__title` para o
`h1` (e `tf-page-header__desc` se a promessa passar a ocupar esse papel), `tf-btn` com a variante
fantasma em tamanho pequeno para “Minhas simulações”, e o ícone de caixas já usado. Se a promessa
freemium precisar de tratamento próprio (fundo, borda, peso), descreva-o com os tokens existentes e
diga qual primitivo está sendo estendido — não invente um componente novo sem dizer.

## Perguntas em aberto para o dono

1. **A Calcular entra na convenção 018 (título à esquerda + ação na direita da mesma linha) ou fica
   deliberadamente centralizada como exceção?** Isso muda o desenho inteiro e é decisão sua — o
   modificador `--center` existe só para esta tela.
2. **A promessa freemium sobe para `tf-page-header__desc`** (descrição normal da página, mesmo lugar
   das abas irmãs) **ou vira um elemento de destaque próprio** acima do formulário? Você mandou ela
   subir para a primeira dobra em 015/A8, mas a forma nunca foi decidida.
3. **Quem já assina Premium continua lendo a frase?** Hoje sim, sempre. Ela é meia verdade útil para
   o assinante (“marketplaces, salvar e exportar fazem parte do Premium” = o que você já tem) e pode
   soar como oferta repetida.
4. **“Minhas simulações” pertence ao topo da Calcular ou à navegação do app?** É a única aba que
   carrega uma porta de navegação dentro do próprio conteúdo.

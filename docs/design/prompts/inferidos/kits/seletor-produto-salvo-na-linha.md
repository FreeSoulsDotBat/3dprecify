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

## O mapa funcional de Kits / BOM multi-peça

### O que é a área Kits

O vendedor de impressão 3D às vezes não anuncia uma peça: anuncia um **conjunto** ("suporte + base", "kit de 3 vasos"). A aba **Kits** é onde ele monta esse conjunto peça por peça e vê o preço do kit inteiro — custo total, preço de varejo, preço de atacado e, se ele usa marketplaces, quanto sai o anúncio e quanto sobra líquido em cada canal.

### Como ele chega e o que encontra

- **Aba 3 da navegação** (`/kits`, rótulo "Kits") → cai no **compositor vazio**, pronto para montar um kit novo.
- **`/kits?id=<id>`** → o mesmo compositor **hidratado com um kit salvo** (veio da aba Kits dentro do Catálogo, ou de um "Salvar kit" que acabou de acontecer). As peças chegam já resolvidas pelo servidor.
- **`/kits?id=<id>&copy=true`** → duplicar: carrega os mesmos dados, o nome ganha o sufixo "(cópia)" e **salvar cria um kit novo** — nada é escrito sem o vendedor mandar.
- **`/catalogo?tab=kits`** → a *lista* de kits salvos (quarta pílula do Catálogo, ao lado de Filamentos · Impressoras · Produtos). Não é uma segunda tela de edição: abrir uma linha manda de volta para `/kits?id=`.

A rota `/kits` é **pública** — quem está deslogado ou sem Premium chega nela e vê um teaser honesto, nunca um chute para fora.

### O que a área guarda, e o que ela só calcula

Um kit salvo guarda **estrutura, nunca dinheiro**: nome, ordem das peças, quantidade e, por peça, ou uma **referência viva** a um produto do catálogo ou os valores próprios daquela peça. Preço **nenhum** é armazenado — ele é recalculado do zero a cada abertura, pelo motor `pricing-core`, que roda **no aparelho e offline**. Por isso a linha da lista de kits só sabe dizer "3 peça(s)", jamais um valor.

As leituras (kits salvos, produtos do catálogo) vêm do servidor e ficam num **cache local por conta**; se a rede falhar, o cache continua servindo e a tela diz que o dado pode estar desatualizado. **As escritas de kit são só online** — o servidor é quem decide o direito de gravar, então não existe fila/outbox para "Salvar kit" e não existe confirmação otimista: o toast "Kit salvo." e o recibo só aparecem depois de uma resposta real.

### De que depende

Catálogo de **tarifas de marketplace** servido + cacheado (alimenta os preços por canal de todas as peças de uma vez) · **entitlement** consultado no servidor (`active` · `lapsed` · `none`) · **sessão Firebase** · o catálogo de **produtos** do vendedor (o seletor de peça) · o motor `pricing-core`.

### O que a área alimenta depois

- **Salvar kit** escreve no catálogo do vendedor: cada peça que não é referência vira um **produto novo em Produtos** (materialização) — e é isso que o recibo pós-salvamento conta.
- **Salvar em Orçamentos** congela o kit como documento (aba Orçamentos): o preço de hoje vira registro imutável, itemizado peça a peça. Sai da esfera do "vivo".
- Um kit salvo também pode virar base de um cálculo na aba Calcular.

### Como muda por estado

| estado | o que o vendedor vê |
|---|---|
| **grátis / deslogado** | nenhum compositor: só o cabeçalho e o teaser Premium honesto |
| **Premium ativo** | tudo: compor, salvar, duplicar, congelar em Orçamentos |
| **Premium pausado (lapsed)** | **criar** está fechado (painel calmo de reativação + "Ver meus kits"); **reabrir e recalcular** um kit salvo continua funcionando, com faixa informativa no topo; "Salvar kit" continua **visível** e responde honestamente ao ser tocado; "Salvar em Orçamentos" **não existe** ali |
| **offline** | calcular funciona inteiro; leituras vêm do cache; salvar kit falha e diz por quê — falha de rede nunca é vendida como "você não tem Premium" |
| **sessão expirada** | volta ao teaser deslogado; o "Entrar" promete voltar para `/kits` |
| **plano não verificável** | estado próprio: "Verificando seu plano…" ou a parede "Não foi possível verificar seu plano." + "Tentar novamente" — deliberadamente diferente de "você não tem Premium" |

## O ponto exato de inserção desta peça

- **Onde vive:** O primeiro cartão de dentro da peça já expandida — antes de "Custos da peça", ou seja, a primeira decisão que o editor pede. Só existe quando o vendedor tem ao menos um produto salvo no catálogo; com zero produtos o cartão simplesmente não aparece.
- **Como o vendedor chega:** Aparece assim que a peça é expandida (por adição de peça nova ou por toque no cabeçalho). É o mecanismo que faz o kit APONTAR para o catálogo em vez de duplicá-lo.
- **Vizinhança imediata:** Dentro do cartão: o rótulo "Usar produto salvo" e, sob ele, um seletor cuja primeira opção é "— Manual —" seguida de todos os produtos salvos, sem busca e sem teto de itens. Quando há produto vinculado, uma legenda pequena logo abaixo do seletor: "do catálogo: Vaso G" — que passa a "do catálogo: Vaso G · ajustado por você" no instante em que o vendedor edita qualquer campo depois de vincular. Acima do cartão, a borda superior do cartão da peça; abaixo, o título "Custos da peça".
- **Dados que chegam (e o que ela devolve):** A lista de produtos do catálogo (cache por conta, servida pelo servidor) e o id vinculado da peça. Ao escolher um produto, os campos da peça são pré-preenchidos com os valores VIVOS daquele produto; escolher "— Manual —" desvincula mantendo os valores atuais editáveis.
- **O que acontece depois:** Vincular e não mexer = ao salvar, a peça vira uma REFERÊNCIA viva (segue o produto para sempre). Vincular e editar = a peça deixa de ser referência e passará a ser um produto NOVO no catálogo — o que faz surgir, no fim do editor, a legenda "Você ajustou esta peça…" e o campo de nome da peça.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Vincular uma peça do kit a um produto salvo — o seletor e o selo de origem

## O que desenhar
Dentro da aba **Kits** (`/kits`, "Monte seus kits"), cada peça do kit é um card recolhido que mostra
`Peça 1 · Vaso G` ou `Peça 2 (avulsa)`, a quantidade em `un` e o custo. Ao expandir ("Editar esta peça"),
o vendedor recebe a calculadora inteira daquela peça — e, no topo dela, o mecanismo desta prancheta: a
escolha entre digitar a peça na mão ou **apontá-la para um produto já salvo no catálogo**. É o que faz o
kit *referenciar* o catálogo em vez de duplicá-lo: uma peça vinculada e intocada é salva como referência
viva (muda o produto, muda o kit); uma peça vinculada e depois **editada** deixa de ser referência e vira
uma peça nova no catálogo. Desenhe o controle de vínculo, o selo que declara a origem da peça, e o
momento em que esse selo muda de sentido.

## Por que este prompt existe
O mecanismo nunca foi desenhado — foi inferido por IA a partir do requisito textual. O canvas 018 chega
perto: desenha um botão de rodapé **"Usar produto salvo"** que só aparece na peça NÃO vinculada, e o selo
de origem no **cabeçalho** da linha (`do catálogo: Vaso G` / `— Manual —`). Mas o que está no ar diverge
do desenhado: **não existe botão nenhum** — existe uma lista suspensa dentro do editor expandido, e a
legenda de origem mora lá dentro, não no cabeçalho. E três coisas não existem em artboard nenhum: **o que
o botão abriria** (não há prancheta de seletor), o estado **"ajustado por você"** (busca por `ajustado` no
`.dc.html`: zero ocorrências) e o caso de **zero produtos salvos**. Nada disso existe abaixo de 1280px.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/bom-line-editor/bom-line-editor.tsx` (o seletor + o selo),
`apps/web/src/features/bom/bom-line-card.tsx` (o cabeçalho da linha), textos em
`apps/web/src/shared/i18n/messages.pt-br.ts` (`messages.bom`).

| Elemento | Como está hoje | Observação |
|---|---|---|
| Rótulo do controle | `"Usar produto salvo"` | rótulo de campo (justo), acima da lista |
| Controle | lista suspensa nativa (`tf-select`), caret `▾` | → **problema**: sem busca, sem teto de itens |
| Primeira opção | `"— Manual —"` (valor vazio) | é o padrão; escolhê-la desvincula |
| Demais opções | um item por produto salvo, só o **nome** | ordem = a da API, sem agrupar, sem filtrar |
| Selo de origem (vinculado) | `"do catálogo: {nome}"` → `do catálogo: Vaso G` | legenda pequena, logo abaixo da lista |
| Selo após editar | `"do catálogo: {nome} · ajustado por você"` | → **nunca desenhado, em nenhuma largura** |
| Aviso de consequência | `"Você ajustou esta peça — ela será salva como uma peça nova no catálogo."` | aparece **fora** deste bloco, lá embaixo, junto do campo `Nome da peça no catálogo` |
| Cabeçalho da linha | `Peça 1 · Vaso G` / `Peça 2 (avulsa)` | → o cabeçalho **não** reflete o "ajustado por você" |
| Zero produtos salvos | o bloco inteiro **não é renderizado** | → **problema grave**: nenhuma pista de que a opção existe |
| Carregando / falha de leitura / cache offline | **nada** — a tela usa só a lista de itens e ignora os estados `isLoading`, `isError` e `stale` que o dado já traz | → carregando é indistinguível de "você não tem produtos" |

→ Consequência prática do último item: com rede lenta o bloco some e volta; e um vendedor com 40 produtos
salvos, offline, vê uma lista que pode estar desatualizada sem nenhum aviso.

## Conteúdo e dados reais
- Cada opção carrega **apenas** o nome do produto (ex.: `Vaso G`, `Suporte de celular`,
  `Peça 1 · Kit suporte + base`). Não há preço, foto, material nem data na opção — se o desenho quiser uma
  segunda linha por item (material, custo unitário), isso é decisão de produto (ver perguntas).
- Nomes longos e repetitivos são o caso comum, não a exceção: peças materializadas por um kit anterior
  nascem com o padrão `Peça {n} · {kit}`. Desenhe com `Peça 1 · Kit suporte + base`, não com "Vaso G".
- Ao vincular, os campos da peça são **pré-preenchidos com os valores atuais do produto** e continuam
  editáveis. Nenhum preço é copiado — o preço é sempre recalculado.
- Números vizinhos, para calibrar o entorno: `42 g`, `3 h 30 min`, custo unitário `R$ 21,84`,
  `Total da linha (3×) R$ 65,52`, quantidade `3 un`.
- A quantidade vizinha tem teto real (2.147.483.647) e já avisa acima dele — não é assunto desta peça, mas
  divide o mesmo card.

## Estados obrigatórios
1. **Manual (repouso, padrão)** — controle mostrando `— Manual —`, sem selo abaixo; o cabeçalho lê
   `Peça 2 (avulsa)`.
2. **Vinculado e intocado** — controle com o nome do produto; selo `do catálogo: Vaso G`. É a peça que será
   salva como **referência viva**.
3. **Vinculado e ajustado** — selo `do catálogo: Vaso G · ajustado por você`. O estado que nenhum artboard
   mostra e que muda o destino da peça: ela deixa de ser referência e vira peça nova no catálogo. A frase
   de consequência já existe: `"Você ajustou esta peça — ela será salva como uma peça nova no catálogo."` —
   decida no desenho onde ela deve viver (hoje mora longe do selo).
4. **Zero produtos salvos** — hoje: nada. Precisa de um estado que diga que a opção existe e o que fazer
   para tê-la.
5. **Carregando a lista** — leitura online em voo, sem cache. Tem que ser distinguível do estado 4.
6. **Falha ao ler a lista, sem cache** — erro honesto + "tentar de novo"; **nunca** apresentado como "você
   não tem produtos" e **nunca** como "isso é premium".
7. **Servindo do cache do aparelho (offline, ou leitura falhou com cache)** — a lista funciona, mas pode
   estar desatualizada, e isso precisa ser dito.
8. **Peça degradada** — o produto referenciado foi apagado depois do kit salvo: a linha reabre com os
   últimos valores conhecidos e mostra `"Os valores atuais foram mantidos e continuam editáveis."`. As
   palavras "removido/excluído" são proibidas. Revincular a outro produto retira essa legenda.
9. **Foco / hover / pressionado / desabilitado** do controle e de cada item escolhível.
10. **Muitos produtos** — desenhe com pelo menos 25 itens, para mostrar o que acontece quando a lista não
    cabe. É o ponto que motivou este prompt.

## Viewports
- **390px** — obrigatório: a peça existe no mobile e é lá que a lista sem busca dói mais (vira roda do
  sistema). Mostre também o selo de duas partes (`do catálogo: {nome} · ajustado por você`) com nome longo
  em coluna estreita.
- **1280px** — o corte em que Kits vira duas colunas: peças à esquerda (largura fluida), resumo fixo de
  480px à direita. Este bloco vive na coluna da esquerda.
- **1920px** — opcional, só se o comportamento do seletor mudar em relação a 1280px.

## Regras que o desenho não pode quebrar
- **Procedência do número dita, nunca escondida**: quem olha a peça precisa saber, sem clicar, se aqueles
  valores vieram do catálogo, do catálogo com ajuste, ou da mão do vendedor.
- **Nenhuma frase honesta dentro de placeholder** — placeholder some ao digitar e corta em campo estreito;
  legendas de origem e avisos ficam em elemento próprio, de largura cheia.
- **Falha de rede nunca vendida como falta de premium**, e nunca como lista vazia.
- **Degradação em tom calmo**, sem acusar o vendedor e sem afirmar remoção.
- Alvo tocável **≥44px** no controle e em cada item de lista.
- Contraste medido contra o fundo real: o bloco fica **dentro de um card**, não sobre o fundo da página —
  nos dois temas.
- O vínculo **não copia preço**: nada no desenho pode sugerir que um preço veio junto do produto.

## Armadilhas já pagas neste projeto
- **Lista de resultados que lê como um segundo campo preenchido** (014, visto só no screenshot): se o
  desenho propuser busca com resultados abaixo, o bloco de resultados precisa se distinguir de um campo — e
  a contagem precisa ser verdadeira. Dizer "8 encontrados" com 31 correspondências é mentira medida, já
  cometida aqui.
- **Texto ocluso passa em teste**: asserção de texto não enxerga elemento sobreposto ou estourado. Nome
  longo ao lado de `· ajustado por você` é exatamente esse caso — desenhe o corte.
- **Overflow horizontal medido em 360/390px** já custou bloqueador em outra tela deste app.
- **Sufixo cortado**: uma frase honesta pendurada no fim de outra string é a primeira coisa a sumir;
  considere separar `do catálogo: {nome}` e `ajustado por você` em dois elementos.
- **Estado ausente porque a condição não renderiza**: o bloco inteiro sumir quando não há produtos salvos é
  essa armadilha já materializada.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**:
1. O bloco de vínculo em repouso, vinculado e **ajustado por você**, a 390px e 1280px (6 quadros).
2. O seletor **aberto** com 25+ produtos — a proposta de como escolher numa lista que cresce sem teto.
   É a peça central deste prompt.
3. Os quatro estados de lista: vazia (sem produtos salvos), carregando, falha sem cache, cache offline.
4. A linha degradada (produto apagado depois do kit salvo).
5. Um quadro de anatomia mostrando onde o selo de origem deve viver — dentro do editor expandido (como
   está no ar) ou no cabeçalho da linha (como o canvas 018 desenhou) — e qual dos dois você recomenda,
   com o motivo escrito no quadro.

Reutilize os primitivos existentes: o card da peça é `tf-card`; o controle atual é `tf-select` dentro de
`tf-inputwrap`, com rótulo de campo justo; a quantidade vizinha usa `tf-inputwrap--sm` com afixo `un`; o
aviso de linha inválida usa `tf-alert--danger`; os botões do rodapé da peça são `tf-btn--ghost tf-btn--sm`;
números em `tf-tnum`. Se o seletor precisar de busca, reaproveite o desenho do seletor de categoria que já
existe neste app (campo de busca + lista de resultados + chip escolhido + "Limpar") em vez de criar um
padrão novo. Não crie primitivo novo sem dizer, no próprio quadro, por que nenhum dos existentes serve.

## Perguntas em aberto para o dono
1. **O vínculo é lista suspensa ou botão que abre um seletor com busca?** O canvas 018 desenhou o botão
   "Usar produto salvo"; o código tem a lista suspensa. Os dois não podem estar certos.
2. **A opção mostra só o nome, ou nome + segunda linha (material / custo unitário)?** Hoje é só o nome, e
   nomes como `Peça 1 · Kit suporte + base` se parecem demais entre si.
3. **Onde mora o selo de origem** — no cabeçalho da linha (visível com a peça recolhida) ou dentro do
   editor expandido (como está no ar)? Só o cabeçalho torna a origem visível sem abrir a peça.
4. **"Ajustado por você" deve aparecer também no cabeçalho recolhido**, junto de `Peça 1 · Vaso G`? É a
   informação que muda o destino da peça no salvamento.
5. **Sem nenhum produto salvo, o que o vendedor vê?** Nada (como hoje), um controle desabilitado com
   explicação, ou um convite para cadastrar um produto — e, nesse caso, para onde o convite leva?
6. **Desvincular ("— Manual —") mantém os valores preenchidos** — é o que o código faz hoje, em silêncio.
   Isso deve ser dito na tela?

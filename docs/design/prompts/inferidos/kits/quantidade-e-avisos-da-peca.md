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

- **Onde vive:** Na linha superior do cartão de cada peça, espremido entre o botão expansível (à esquerda) e o botão de remover (à direita) — um campo numérico de 96px de largura fixa. Aparece uma vez por peça, sempre, recolhida ou expandida.
- **Como o vendedor chega:** É o controle que o vendedor mexe a cada ajuste do kit ("na verdade são 3 bases, não 2"). Nasce com "1" preenchido quando a peça é adicionada, ou com o valor salvo quando o kit é reaberto.
- **Vizinhança imediata:** À esquerda, o rótulo da peça com chevron; à direita, o botão fantasma "x". O campo tem sufixo "un" dentro dele e NENHUM rótulo visível — a palavra "Quantidade" existe só para leitores de tela. Logo abaixo da linha, na pilha de legendas do cartão: "Quantidade 0 — não entra no total." quando é zero, e o aviso de plausibilidade quando o número passa do teto que o banco aceita — aviso que NUNCA recusa: a peça continua no kit e o campo continua editável. Ambas as legendas dividem tipografia com as outras três possíveis no mesmo cartão.
- **Dados que chegam (e o que ela devolve):** Só texto digitado. Uma quantidade que não seja inteira não-negativa marca a peça como inválida (e ela sai do total com a legenda correspondente); zero é tratado como um zero verdadeiro, e a peça continua contando como linha do kit.
- **O que acontece depois:** Cada mudança recalcula na hora a linha ("Total da linha (3×) R$ …"), o "Total do kit" e todos os rollups por canal. É também o número que vai congelado para o orçamento, se o vendedor registrar um.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Quantidade da peça e a pilha de avisos do card (Kits)

## O que desenhar

O controle de **quantidade** que vive no cabeçalho de cada card de peça do compositor de kits (aba
**Kits**, título "Monte seus kits") — e, principalmente, **a pilha de legendas e avisos que nasce
logo abaixo dele, dentro do mesmo card**. O cabeçalho tem três coisas na mesma linha: o botão que
expande a peça ("Peça 1 · Suporte de celular"), o campo de quantidade com sufixo `un`, e o botão de
remover. Abaixo, em fluxo, aparecem até três parágrafos ao mesmo tempo: o custo da linha, um aviso
sobre a própria quantidade, e a legenda de peça degradada. Quem usa é o vendedor montando um anúncio
combinado — a quantidade é **o controle que ele mexe a cada ajuste**, mais do que qualquer outro
campo do kit. Kits é Premium: esta peça nunca é vista por quem está no plano grátis.

## Por que este prompt existe

O canvas de desktop (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linha 190) **desenhou o
controle** — rótulo textual "Quantidade" visível à esquerda, campo de `104px` com afixo `un`, e um
botão de **lixeira** para remover. O que está no ar (`apps/web/src/features/bom/bom-line-card.tsx`)
diverge do desenho em três pontos: o rótulo sumiu para dentro de um `aria-label` (nenhuma palavra
visível), a largura virou `96px`, e a lixeira virou um "x". **Aqui o código contraria um desenho
explícito — não é lacuna, é divergência.** Já os **avisos não têm desenho nenhum**: procurar por
"Quantidade 0" no canvas dá zero, e o único alerta desenhado dentro do card é o de peça inválida. O
aviso do teto do banco nasceu de um achado de homologação automatizada (CF-021-UI-03), não de
desenho, e foi colado como mais um parágrafo cinza no meio dos outros.

## O que já existe hoje (não invente do zero — corrija)

Cabeçalho do card, da esquerda para a direita:

| Elemento | Como está | Origem |
|---|---|---|
| Botão de expandir | chevron 16px + "Peça 1 · Suporte de celular" (ou "Peça 1 · (avulsa)") | `bom-line-card.tsx` |
| Campo de quantidade | `tf-inputwrap--sm`, **96px**, altura **36px**, afixo `un`, placeholder `1`, teclado numérico | idem |
| Rótulo "Quantidade" | **só no `aria-label`** → invisível na tela | idem |
| Botão de remover | `tf-btn--ghost --sm`, ícone **`x`** de 16px | idem |

→ **O rótulo invisível é o problema principal**: o desenho pediu a palavra "Quantidade" e ela não
existe. O `un` sozinho não diz que aquilo é quantidade — pode ser lido como "unidade de medida".
→ **96px com 36px de altura** fere o alvo de ≥44px e não cabe um número longo com o afixo.
→ O ícone `x` lê como "fechar/recolher" ao lado de um chevron que faz exatamente isso; a **lixeira**
desenhada era mais clara.

Parágrafos abaixo do cabeçalho, na ordem em que o código os empilha — **todos `text-sm`, todos em
`--text-muted`, exceto um**:

1. Custo da linha: `"R$ 12,34 /un · Total da linha (3×) R$ 37,02"`
2. `"Quantidade 0 — não entra no total."`
3. Aviso de plausibilidade, o único com cor (`--info-text`): `"Confira a quantidade: 3.000.000.000.
   O máximo por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."`
4. `"Confira os campos desta peça — ela não entra no total até ser corrigida."`
5. `"Os valores atuais foram mantidos e continuam editáveis."` (peça degradada)

→ **Medi as combinações reais** (a ficha da auditoria fala em cinco parágrafos simultâneos; não são
cinco). 1 e 4 são mutuamente exclusivos, 2 e 3 também. O máximo real é **três ao mesmo tempo**:
`1 + (2 ou 3) + 5`, ou `4 + 5`. É esse trio que precisa de hierarquia — não uma pilha de cinco.
→ **A quantidade dentro da legenda 1 não é formatada**: hoje sai `"Total da linha (3000000000×)"`,
sem separador de milhar, contra a regra pt-BR do preâmbulo, e é o que estoura a linha.
→ **Contradição medida**: digitar `3.000.000.000` (com os pontos que o próprio pt-BR pede) faz
aparecer o aviso 3, que termina em "Nada foi recusado", **e** o parágrafo 4, que diz que a peça não
entra no total até ser corrigida. As duas frases se contradizem no mesmo card.
→ A quantidade só aceita **inteiro sem pontuação**. `1,5`, `-1`, campo vazio e `3.000` caem todos no
parágrafo 4, genérico, que **não nomeia a quantidade** — o vendedor vai procurar o erro nos campos
de dentro da peça, que estão certos.
→ O canvas desenhou o estado inválido como `tf-alert--danger` com ícone; o código entrega um
parágrafo cinza. Decida qual vale e desenhe uma forma só.

## Conteúdo e dados reais

- **Quantidade**: inteiro, obrigatório, unidade `un`, placeholder `1`. Faixa plausível do negócio:
  **1 a 500**. Teto duro: **2.147.483.647** (limite da coluna `int4` do banco). O `0` é **aceito e
  válido** — a peça fica no kit e soma zero, com legenda própria.
- **Custo unitário** e **total da linha**: dinheiro pt-BR, `R$ 12,34` e `R$ 37,02`. Derivados —
  nunca digitados. Numerais tabulares.
- Exemplos verdadeiros para as pranchetas: `3` (normal), `250` (lote), `0` (o caso captionado),
  `2147483647` (o limite exato), `3000000000` (o que dispara o aviso).
- Rótulos vizinhos que existem e vale citar: "Adicionar peça", "Editar esta peça", "Recolher",
  "Remover peça", "Usar produto salvo", e o resumo do kit dizendo `"{n} peça(s) fora do total —
  confira os avisos nas peças acima."`

## Estados obrigatórios

- **Repouso vazio** — campo sem valor, placeholder `1` em `--text-faint`, rótulo visível ao lado.
- **Repouso preenchido** — `3`, alinhado à direita, tabular.
- **Hover** — borda em `--border-strong`.
- **Foco** — anel roxo de 3px que **não pode ser cortado** pelo card nem pelo botão vizinho.
- **Pressionado** (botão de remover) — escala 0.97.
- **Quantidade 0** — o campo continua normal (não é erro); abaixo, o custo da linha em `R$ 0,00`
  com `"Quantidade 0 — não entra no total."`. Nada de vermelho: zero é uma escolha legítima.
- **Aviso de teto** — campo **sem** estado de erro (a regra do projeto é "aviso nunca vira
  validação"), parágrafo em tom `info`, largura total, com o texto completo do item 3 acima.
- **Linha inválida** — quantidade vazia, fracionária ou pontuada: precisa de um sinal **no campo** e
  de uma frase que nomeie a quantidade, não a peça inteira.
- **Peça degradada** — o produto de catálogo foi apagado depois de salvo: legenda calma "Os valores
  atuais foram mantidos e continuam editáveis.", com o campo de quantidade **totalmente editável**.
- **Desabilitado** — não existe hoje neste campo; desenhe mesmo assim, para o DS (`--disabled`).
- Não há carregando/offline/vazio **neste controle**: eles vivem antes, no portão de plano da aba
  ("Verificando seu plano…" / "Não foi possível verificar seu plano." + "Tentar novamente"). Não os
  desenhe aqui — só não deixe o card assumir que a rede respondeu.

## Viewports

- **390px** — é onde a peça dói: cabeçalho com botão flexível + campo + botão de remover na mesma
  linha, e o nome da peça pode ser longo ("Peça 1 · Suporte de celular articulado preto"). Mostre o
  que acontece quando o nome quebra e quando a quantidade tem 10 dígitos.
- **1280px** — o compositor vira duas colunas (peças à esquerda, resumo do kit fixo à direita, com
  ~480px). A coluna de peças fica em torno de 700px: o cabeçalho respira e o rótulo "Quantidade"
  cabe à esquerda do campo, como o canvas desenhou. Desenhe o card nessa largura. 1920px não precisa
  de prancheta própria — a coluna de peças não cresce o bastante para mudar decisão alguma.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O número acima do teto continua no campo, continua editável, e a
  peça continua no kit. Nada de vermelho, nada de borda de erro, nada de botão bloqueado por ele.
- **Zero é verdade, não falha.** `R$ 0,00` com legenda é honesto; `R$ 0,00` sem legenda é mentira.
- **Degradação é dita.** A legenda da peça degradada nunca diz "removido" ou "excluído".
- **A frase honesta é sempre elemento de largura total** — nenhuma delas pode virar `title`,
  tooltip ou placeholder.
- **Alvo ≥44px** para o campo e para o botão de remover (hoje ambos têm 36px de altura).
- Contraste do texto de aviso medido contra o **fundo do card** (`--surface-card`), não contra
  `--bg-base`.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não estimado.** `2.147.483.647` mais o afixo `un` num campo de 96px é
  overflow certo; e a legenda "Total da linha (3000000000×) R$ 36.996.000.000,00" é a linha mais
  longa que este card consegue produzir. Desenhe com ESSES números, não com `3`.
- **Texto ocluso passa em teste.** Uma legenda espremida contra o botão de remover continua
  "visível" para qualquer asserção de texto. A hierarquia tem que ser legível na imagem.
- **Placeholder corta frase** — mais uma razão para o rótulo "Quantidade" ser texto.
- **Três parágrafos cinzas idênticos não são hierarquia**: hoje o único diferenciado é o aviso de
  teto, e ele é justamente o mais raro dos três.

## Entregável

Pranchetas, tema **escuro** primeiro e as duas primeiras repetidas no **claro**:

1. **Cabeçalho do card, 390px** — quatro variações lado a lado: repouso vazio · preenchido com `3` ·
   foco · quantidade de 10 dígitos. Rótulo "Quantidade" visível, campo `tf-inputwrap--sm` de ao
   menos 104px, botão de remover `tf-btn--ghost` com ícone de lixeira e alvo de 44px.
2. **Pilha de avisos, 390px** — as três combinações reais (`custo + qtd 0 + degradada`,
   `custo + aviso de teto + degradada`, `inválida + degradada`), com a hierarquia que você propõe.
   Use `tf-alert--danger` para o inválido **ou** justifique por que ele fica parágrafo; o aviso de
   teto fica em tom `info`, nunca `danger`.
3. **Card completo recolhido, 1280px**, na coluna de peças, ao lado do resumo do kit.
4. **Estados do campo** em linha: repouso · hover · foco · pressionado · desabilitado · com aviso.

Componha com os primitivos existentes: `tf-card` (o card da peça), `tf-inputwrap--sm` +
`tf-input--num` (o campo), `tf-btn--ghost --sm` (remover e expandir), `tf-alert--danger` /
`tf-alert--info` (se a pilha virar alerta), `tf-tnum` (os números das legendas), `tf-badge` se
precisar marcar a peça degradada. **Não crie primitivo novo sem dizer que é novo e por quê** — em
especial: se a resposta for um stepper `−/+`, ele é um primitivo que o DS não tem.

## Perguntas em aberto para o dono

1. **Stepper ou campo livre?** A quantidade é o controle mais mexido do kit e quase todo ajuste é
   ±1, o que pede `−/+` com alvos de 44px; mas digitar `250` num stepper é ruim. Ninguém decidiu, e
   a decisão muda a largura do cabeçalho inteiro.
2. **Quantidade 0 continua sendo um estado válido de permanência?** Hoje a peça fica no kit somando
   zero. A alternativa seria oferecer remover. Se o 0 fica, a legenda atual basta.
3. A frase do teto termina em **"Acima disso o kit não consegue ser salvo. Nada foi recusado."** — o
   fecho de família ("Nada foi recusado") é verdade na digitação e meia-verdade no salvamento.
   Mantém como está, ou esta frase específica ganha outro fecho?
4. **Quantidade vazia / fracionária / com pontos merece mensagem própria?** Hoje cai na frase
   genérica da peça inteira, que manda o vendedor procurar o erro no lugar errado.

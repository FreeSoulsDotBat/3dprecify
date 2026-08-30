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

- **Onde vive:** Dentro do cartão de uma peça específica, na pilha de legendas cinzas logo abaixo da linha de dinheiro — é a QUINTA e última legenda possível ali, depois da linha de preço, do "Quantidade 0", do aviso de quantidade e do "Confira os campos desta peça". Não tem superfície própria.
- **Como o vendedor chega:** Sem nenhuma ação do vendedor. Ele salvou um kit que referenciava um produto; depois apagou esse produto do Catálogo; agora reabriu o kit por /kits?id=… e o servidor devolveu aquela peça com os últimos valores conhecidos e sem vínculo.
- **Vizinhança imediata:** O cabeçalho da peça passa a dizer "Peça 2 · (avulsa)" onde antes dizia o nome do produto; dentro do editor expandido, o seletor "Usar produto salvo" mostra "— Manual —". A legenda que anuncia isso é um parágrafo cinza de 14px emprestado do formulário de produto, dizendo que os valores conhecidos foram mantidos — visualmente idêntico às outras quatro legendas do mesmo cartão. Nada muda no resumo do kit nem na barra do total.
- **Dados que chegam (e o que ela devolve):** A resposta do servidor ao reabrir o kit, que marca a peça como degradada e entrega o último retrato conhecido dos valores. O preço continua sendo recalculado normalmente a partir desses valores — a peça não some do total.
- **O que acontece depois:** A peça segue totalmente editável. Se o vendedor escolher outro produto no seletor, o vínculo volta a ser vivo e a legenda se retira sozinha. Se ele salvar como está, a peça vira um produto novo no catálogo (e aparece no recibo como "criado").

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Peça de kit que perdeu o produto vinculado

## O que desenhar
O card de UMA peça dentro do compositor de kits (aba **Kits**, rota `/kits?id=…`, quando o vendedor reabre um kit já salvo) no estado em que o produto do catálogo que aquela peça referenciava foi apagado depois do salvamento. A peça não some e não quebra: ela reabre com os últimos valores conhecidos, continua editável, continua entrando no total do kit — mas deixou de acompanhar o catálogo, e isso aconteceu **sem nenhuma ação do vendedor**, entre uma visita e outra. É o único momento do produto em que um card muda de natureza sozinho. Quem vê é o vendedor premium que volta para recalcular um kit montado semanas atrás.

## Por que este prompt existe
Este estado nunca foi desenhado — foi decidido em texto (`specs/008-e3-multi-piece-bom/ux-bom.md` §1.2-D, "decisão T021", 2026-07-12) e implementado direto. O canvas de desenho existente até desenha a peça **nascida** avulsa (`titulo: "Peça 2 (avulsa)"`, `origem: "— Manual —"`), mas não a peça que **degradou**: não há nele nenhum dado, marcador ou legenda de "valores mantidos", e a transição — o mesmo card que dizia "do catálogo: Suporte de fone" e agora diz "(avulsa)" — não é representável num quadro que ninguém desenhou. O que existe hoje é uma legenda emprestada do formulário de produto, num `<p>` cinza de 14px idêntico às outras quatro legendas possíveis no mesmo card. O que falta é o desenho de como se sinaliza uma mudança que o usuário não causou **sem alarmar** — e se ela merece marcador no resumo do kit e na lista de kits (hoje não tem nenhum).

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/bom/bom-line-card.tsx`, `apps/web/src/pages/bom/bom-page.tsx`, `apps/web/src/widgets/bom-line-editor/bom-line-editor.tsx`.

O card **colapsado**, de cima para baixo:

| Elemento | Texto/valor literal hoje | Observação |
|---|---|---|
| Cabeçalho (botão que expande) | `Peça 2 · (avulsa)` | chevron 16px à esquerda; a palavra "(avulsa)" é a MESMA de uma peça nascida manual |
| Quantidade | campo numérico, sufixo `un`, placeholder `1` | valor real do kit salvo, ex. `5` |
| Remover | botão fantasma com ícone `x` | rótulo acessível `Remover peça` |
| Linha de dinheiro | `R$ 24,24 /un · Total da linha (5×) R$ 121,20` | 14px, `--text-muted` |
| **Legenda da degradação** | `Os valores atuais foram mantidos e continuam editáveis.` | 14px, `--text-muted` — **emprestada** do formulário de produto |

→ Problema 1: essa legenda é a **quinta** frase possível nesse mesmo card, todas com a mesma tipografia e a mesma cor: `Quantidade 0 — não entra no total.`, o aviso de quantidade absurda (esse sim em `--info-text`), `Confira os campos desta peça — ela não entra no total até ser corrigida.` e a linha de dinheiro. Nada distingue "você digitou algo errado" de "o mundo mudou embaixo desta peça".
→ Problema 2: a legenda fala do que foi **mantido** e nunca do que foi **perdido** — que os números desta peça pararam de acompanhar o catálogo. Se ela não for lida, o vendedor segue achando que a peça continua vinculada.
→ Problema 3: expandindo o card, o seletor `Usar produto salvo` volta para `— Manual —` e some o selo `do catálogo: {nome}`. Esses dois sinais (o único par que realmente conta a história) estão dentro do conteúdo expandido, longe da legenda, e invisíveis com o card fechado.
→ Problema 4: no fim do card expandido aparece o campo `Nome da peça no catálogo` (placeholder `Peça 2 · Kit suporte + base`) — porque, no próximo salvamento, esta peça vira um produto NOVO no catálogo em vez de uma referência. É uma consequência real e nada a liga visualmente à legenda.
→ Problema 5: nem o resumo do kit (`Total do kit`, `{n} peça(s) fora do total — confira os avisos nas peças acima.`) nem a linha da lista de kits no Catálogo (que diz só `2 peça(s)`) mencionam que alguma peça degradou. Quem abre pela lista não tem aviso nenhum antes de entrar.

## Conteúdo e dados reais
- Nome da peça: `Peça {n} · {nome do produto}` quando viva; `Peça {n} · (avulsa)` quando degradada. Nunca "— Manual —" como rótulo de estado ("— Manual —" é só o valor do seletor).
- Quantidade: inteiro ≥ 0, sufixo `un`. `0` é permitido e legendado (`Quantidade 0 — não entra no total.`).
- Dinheiro sempre pt-BR com centavos: custo unitário `R$ 24,24`, total da linha com 5 unidades `R$ 121,20`; um kit de três peças chega fácil a `R$ 1.234,56` no `Total do kit`.
- A peça degradada continua **priceável**: os últimos valores conhecidos (custo do rolo, peso, tempo de impressão, etc.) viraram campos editáveis comuns, com os mesmos rótulos do formulário da calculadora.
- Seletor `Usar produto salvo`: opções = `— Manual —` + os produtos salvos. Selecionar um produto **aposenta a legenda** na hora (a peça voltou a ser referência viva) e mostra `do catálogo: {nome}` ou `do catálogo: {nome} · ajustado por você`.
- Nada aqui é derivado de preço guardado: o kit nunca armazenou dinheiro, todo número é recalculado na abertura.

## Estados obrigatórios
1. **Degradada, colapsada (repouso)** — o estado padrão desta peça. Mostra `Peça 2 · (avulsa)`, a quantidade, a linha de dinheiro e a frase `Os valores atuais foram mantidos e continuam editáveis.`
2. **Degradada, expandida** — mesma frase + seletor em `— Manual —` + campos com os últimos valores + o campo `Nome da peça no catálogo`.
3. **Foco / hover / pressionado** no cabeçalho expansível e no botão remover — o cabeçalho inteiro é alvo de toque ≥44px; anel roxo de 3px no foco.
4. **Degradada + inválida** — as duas legendas empilhadas (`Confira os campos desta peça — ela não entra no total até ser corrigida.` acima ou abaixo da frase de degradação: **decida a ordem e mostre**), e a peça fora do total.
5. **Degradada + quantidade 0** — `Quantidade 0 — não entra no total.` somada à legenda.
6. **Resolvida** — o vendedor escolheu um produto salvo no seletor: a legenda desaparece e entra `do catálogo: Suporte de fone`. Desenhe esse "depois", porque hoje o alívio é só um silêncio.
7. **Premium pausado** — a página traz a faixa `Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.`; a peça degradada continua legível e recalculável, mas o caminho de conserto (salvar de novo) está fechado. Precisa conviver sem virar duas tarjas competindo.
8. **Tarifas offline** — a página pode exibir `Não foi possível atualizar as taxas` / `Usando a referência salva no dispositivo — o cálculo continua funcionando…` com `Tentar novamente`. Duas honestidades diferentes na mesma tela; mostre que não se confundem.
9. **Carregando** — enquanto o kit ainda não chegou do servidor não existe peça alguma: nada pode piscar "(avulsa)" antes da resposta.

## Viewports
- **390px (mobile)** — obrigatório: é o layout onde o card ocupa a largura toda, as legendas quebram em duas ou três linhas e o cabeçalho já disputa espaço com a quantidade e o botão remover.
- **1280px (desktop)** — obrigatório: acima desse corte a página vira duas colunas (peças à esquerda em `minmax(0, 1fr)`, resumo do kit fixo à direita em 480px). É aqui que se decide se o resumo da direita ganha ou não uma menção às peças degradadas.
- **1920px** — opcional, só se a proposta mudar de forma (a coluna de peças fica bem mais larga e a legenda pode virar uma linha só).

## Regras que o desenho não pode quebrar
- **Nunca dizer "removido", "excluído" ou "deletado".** Existe um teste que trava qualquer regressão para essas palavras. O produto pode ter sido apagado noutra sessão, por outra pessoa; a interface não conta um evento que não presenciou.
- **Nada de `tf-alert` para esta peça.** A decisão homologada é legenda calma, não alerta: degradar é normal e recuperável, e um alerta grita "algo aconteceu com você". Se a proposta precisar de mais peso, o peso tem que vir de hierarquia (posição, ícone, um `tf-badge` discreto), não de tom de erro.
- **Peça nascida manual e peça degradada são o MESMO estado honesto** — por design, os dados não distinguem uma da outra. O que se pode sinalizar é a mudança percebida na sessão, nunca uma origem que o app não sabe.
- **Degradação é dita, não escondida**: nada de campo vazio silencioso, nada de `R$ 0,00` que na verdade é "não sei". Os últimos valores conhecidos aparecem como números normais e editáveis.
- Frase honesta em elemento de largura total, jamais dentro de `placeholder`.
- Contraste medido contra o fundo real do card (`--surface-card`), nos dois temas — a legenda hoje usa `--text-muted`, que no escuro é `#8c8f9d`.

## Armadilhas já pagas neste projeto
- **Legenda cinza indistinguível**: este projeto já mediu que `toBeVisible`/`toContainText` passam em texto que ninguém consegue ler ou achar. Uma quinta frase igual às outras quatro é aprovada por todo teste e falha com o vendedor.
- **Rótulo repetido**: o nome que uma peça materializada recebe já começa com `Peça {n} · …`, então concatenar o prefixo de novo produz `Peça 1 · Peça 1 · Kit X`. Qualquer marcador novo no cabeçalho tem que caber depois de um nome já longo.
- **Overflow horizontal medido**: números grandes (`R$ 1.234.567,89`) e nomes de kit longos já estouraram colunas aqui. A 390px, o cabeçalho + quantidade + botão remover não podem empurrar nada para fora.
- **Placeholder que corta a frase**: já aconteceu em 2026-08-06 — a parte honesta do texto sumiu dentro de um campo estreito.
- **Legenda que se retira sozinha**: quando o vendedor revincula, tudo simplesmente some. Um sumiço sem confirmação já foi lido como bug em outra tela deste app.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. `390px` — card degradado colapsado, em contexto: uma peça viva acima e uma peça degradada abaixo, para que a diferença entre as duas seja o objeto do desenho.
2. `390px` — card degradado expandido, com o seletor em `— Manual —`, os campos com últimos valores e o campo `Nome da peça no catálogo`.
3. `390px` — as combinações: degradada + inválida, degradada + quantidade 0, e o estado resolvido (`do catálogo: Suporte de fone`, sem legenda).
4. `1280px` — a página de kits em duas colunas com uma peça degradada na lista, mostrando o que (se algo) o resumo da direita e o `Total do kit` dizem a respeito.
5. `1280px` — a linha da lista de kits no Catálogo (`Kit suporte + base` · `2 peça(s)`), com e sem a proposta de marcador, para o dono comparar.

Componha com os primitivos existentes: `tf-card --pad-md` para a peça; `tf-field` + `tf-inputwrap` + `tf-input --num` para a quantidade; `tf-select` para `Usar produto salvo`; `tf-btn --ghost --sm` para remover; `tf-icon` (Lucide, traço 2px) para o chevron e para qualquer marcador; `tf-tnum` em todo dinheiro; `tf-badge --neutral` ou `--info` se a proposta incluir marcador de linha; `tf-brow` para o detalhamento do preço da peça. **Não crie primitivo novo** — e, se criar, diga em voz alta que é novo e por que nenhum dos existentes serve. Um floreio de grafismo, no máximo, e não neste card.

## Perguntas em aberto para o dono
1. A peça degradada merece um **marcador de linha** (ícone ou `tf-badge` no cabeçalho, visível com o card fechado), ou a legenda calma continua sendo o único sinal? A decisão de 2026-07-12 escolheu só a legenda; a auditoria questiona se ela é lida.
2. O **resumo do kit** e a **linha da lista de kits** devem contar quantas peças estão nesse estado (algo como "1 peça sem vínculo"), ou isso vira alarme sobre um estado que é recuperável e comum?
3. Quando o vendedor **revincula** um produto e a legenda some, deve haver uma confirmação positiva (um selo momentâneo, um toast) ou o silêncio basta?
4. A consequência "esta peça vai virar um produto novo no catálogo no próximo salvamento" deve ser dita **na peça degradada** — como já é dita para a peça ajustada (`Você ajustou esta peça — ela será salva como uma peça nova no catálogo.`) — ou fica só implícita no campo `Nome da peça no catálogo`?

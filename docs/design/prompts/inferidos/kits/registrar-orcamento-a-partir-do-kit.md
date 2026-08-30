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

- **Onde vive:** Um botão secundário centralizado numa faixa própria, entre a barra/cartão "Total do kit" e a caixa bordada de "Nome do kit" + "Salvar kit". No mobile fica logo acima daquela caixa; no desktop é o terceiro item da coluna direita de 480px, entre o resumo e a caixa de salvar.
- **Como o vendedor chega:** O vendedor terminou de montar o kit, olhou o preço e quer mandar isso para um cliente — ou guardar o preço de hoje. Só existe para quem tem Premium ATIVO: com o Premium pausado, ou sem Premium, o botão não é renderizado (não é cinza, não é isca).
- **Vizinhança imediata:** Ícone de disquete + o rótulo "Salvar em Orçamentos". Acima dele, o total do kit; a um cartão de distância, embaixo, o botão "Salvar kit" — duas ações de gravar que começam com o mesmo verbo e fazem coisas opostas: "Salvar kit" guarda uma coisa VIVA que recalcula sempre, "Salvar em Orçamentos" congela o preço de hoje num documento imutável. O botão fica desabilitado enquanto nenhuma peça tiver entrado no total.
- **Dados que chegam (e o que ela devolve):** No momento do toque (não antes), congela o que está na tela: as peças válidas com suas quantidades e nomes, os totais do kit, os preços por canal e a proveniência (de qual kit salvo isto veio, quando houver). O congelamento acontece uma vez só, na abertura da folha.
- **O que acontece depois:** Abre a folha lateral "Salvar em Orçamentos" (rótulo, validade, base do preço: varejo ou atacado), por cima do compositor, que continua atrás. Confirmado, o registro passa a existir na aba Orçamentos — e se o aparelho estiver offline, ele vai para a fila que drena depois. Editar ou apagar o kit depois disso não muda nada no documento congelado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# "Salvar em Orçamentos" dentro do compositor de kits

## O que desenhar
A ação que congela o kit que está na tela como um **orçamento** (documento imutável, com a data de hoje),
e a folha que ela abre. Ela vive na aba **Kits** (`/kits`), na mesma coluna do resumo: hoje aparece entre o
cartão "Total do kit" e o cartão de "Salvar kit". Quem usa é o vendedor Premium ativo, no fim da composição —
já viu o preço do kit e quer guardar aquele número com a data para mandar ao cliente. Precisa desenhar
**duas coisas**: (1) a ação em si, convivendo com "Salvar kit" a um cartão de distância; (2) a folha de
confirmação que ela abre.

## Por que este prompt existe
Nada disso foi desenhado. No canvas do 018 (`Abas-Desktop.dc.html`), a coluna direita de Kits tem exatamente
quatro blocos — Total do kit, Preços por canal (kit), Nome do kit e "Salvar kit" — e **nenhum** botão de
orçamento: a busca por "Salvar em Orçamentos" e por "Registrar" no arquivo dá zero. O protótipo de 2026-07-02
desenhou o Histórico como lista + detalhe congelado + exportar; a **ação de registrar a partir de outra tela**
nunca foi desenhada, e kits não existiam no protótipo. Resultado: duas ações de gravar com efeitos
irreversivelmente diferentes — "Salvar kit" cria uma coisa **viva** que recalcula sempre, "Salvar em
Orçamentos" cria um documento **congelado e imutável** — dividem o mesmo canto da tela, começam com o mesmo
verbo, e não há nenhuma hierarquia visual que as distinga. É a confusão mais provável de todo o fluxo de kits.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` (linhas ~577-665) e
`apps/web/src/features/history/record-snapshot-sheet.tsx`.

Ordem atual da coluna direita, de cima para baixo:

| # | Bloco | Conteúdo real |
|---|---|---|
| 1 | Preços por canal (kit) | "Mercado Livre · Clássico — R$ 268,90", legenda "3 peça(s) somaram neste canal" |
| 2 | Total do kit | "Custo total R$ 96,40" + Varejo **R$ 241,00** + Atacado **R$ 192,80** |
| 3 | **A ação desta ficha** | botão secundário, ícone de disquete 18px, "Salvar em Orçamentos", **centralizado** |
| 4 | Cartão "Salvar kit" | campo "Nome do kit" (placeholder "Kit suporte + base") + botão primário "Salvar kit" |

→ O botão de orçamento é **secundário e centralizado**, sozinho no meio de duas caixas com borda: ele não
pertence visualmente a nada. Não tem título, nem uma linha dizendo o que é congelar. Um vendedor que leu
"Salvar em Orçamentos" logo acima de "Salvar kit" não tem como saber que uma coisa recalcula e a outra não.
→ Desabilitado quando **nenhuma peça válida entrou no total** — e nesse estado ele **não diz nada**. A
explicação existe, mas está no cartão acima: "Sem preço ainda" / "O preço do kit aparece assim que ao menos
uma peça estiver completa e válida."
→ Quando o Premium **não** está ativo, o botão **não existe** (não é cinza, não é teaser — decisão do dono
Q15, 2026-07-13). Mas "Salvar kit", ao lado, continua visível e responde honestamente. Duas ações vizinhas
com políticas opostas de presença, sem desenho que explique a diferença.
→ No mobile o "Total do kit" é uma barra `sticky` no rodapé com `z-index: 10`, e este botão vem **depois**
dela no fluxo: durante a rolagem ele passa por baixo da barra. O lugar dele no mobile precisa ser decidido.

A folha que abre (painel ancorado na borda **direita**, `min(92vw, 26rem)` — ~416px no desktop, ~358px em
390px), nesta ordem:

1. Título: **"Salvar em Orçamentos"** (a terceira vez que a mesma frase aparece: botão, título e submit)
2. Texto: "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje."
3. Campo "Rótulo (opcional)", dica "Cliente, pedido…", máx. 120 caracteres
4. Campo "Validade da proposta", numérico 1–3650, com o sufixo "dias" à direita do campo
5. Grupo "Preço que você está cotando": duas opções em linha de 44px, rótulo à esquerda e valor à direita —
   "Varejo · **R$ 241,00**" (pré-selecionada) e "Atacado · **R$ 192,80**"
6. Legenda: "Cotado em 20/08/2026"
7. Botão primário: **"Salvar em Orçamentos"**

## Conteúdo e dados reais
- Os valores da folha são **congelados quando a folha abre** — não mudam depois, mesmo que o kit seja editado
  atrás dela. Isso é a promessa central da peça e hoje só está dita na frase do item 2.
- Dinheiro sempre `R$ 0.000,00`, dígitos tabulares. Faixa plausível de um kit: R$ 45,00 a R$ 1.284,90;
  desenhe pelo menos um estado com **R$ 12.480,00** para provar que a linha do rádio não estoura.
- "Validade da proposta" é **opcional** e não é prazo de expiração do registro: é a validade que o vendedor
  prometeu ao cliente. Nada apaga o orçamento depois.
- Só existe a opção Atacado se o kit tiver preço de atacado; com um único preço, o grupo mostra uma linha só.
- O rótulo em branco é gravado como "sem rótulo", nunca como texto vazio.

## Estados obrigatórios
- **Repouso / hover / foco visível / pressionado** do botão de origem, no contexto real da coluna.
- **Desabilitado** — nenhuma peça válida no total. Precisa de uma razão legível junto do botão (hoje não há).
- **Ausente** — sem Premium ativo o botão simplesmente não está lá. Desenhe a coluna **sem** ele e mostre que
  o espaço não fica quebrado; não desenhe versão cinza nem teaser.
- **Premium pausado** — o botão some, e no topo da página fica: "Premium pausado — você pode reabrir e
  recalcular este kit. Salvar precisa do Premium ativo."
- **Folha em repouso** (o estado principal) e **folha enviando** — o submit fica desabilitado durante o envio;
  hoje ele **não** troca de texto, enquanto o "Salvar kit" vizinho troca para "Salvando…". → resolver.
- **Sucesso** — aviso "Registro salvo em Orçamentos." (tom sucesso), folha fecha.
- **Offline** — grava no aparelho e avisa: "Pendente neste dispositivo. Sincroniza sozinho quando houver
  conexão." (tom informativo, **nunca** vermelho, **nunca** "não é premium").
- **Envio pausado por plano** — "Envio pausado — o Premium não está ativo. O registro continua neste aparelho."
- **Sessão expirada** — "Envio pausado — sua sessão expirou. O registro continua neste aparelho."
  (a palavra "conexão" é proibida aqui: a rede está boa, quem morreu foi a sessão).
- **Recusado pelo servidor** — "Não foi possível registrar. O servidor não aceitou este registro." (perigo).
- **O aparelho não conseguiu guardar** — "Não foi possível guardar o registro neste aparelho. Ele não foi
  salvo." (perigo) e **a folha continua aberta**, com tudo preenchido: o vendedor não perde a cotação.

## Viewports
- **Mobile 390px** — a peça existe no mobile e é onde o conflito com a barra fixada do "Total do kit"
  acontece. Desenhe a coluna rolando e a folha ocupando ~92% da largura.
- **Desktop 1280px** — o corte do 018: a coluna da direita tem 480px fixos e é `sticky`. É aqui que os três
  blocos (total, ação, salvar kit) aparecem juntos na mesma tela, e é aqui que a confusão fica mais visível.
- **Desktop 1920px** — só se a folha de 416px ancorada à direita mudar de leitura numa tela larga.

## Regras que o desenho não pode quebrar
- **Congelado ≠ vivo.** O desenho tem que dizer, em palavras, que "Salvar em Orçamentos" guarda os números de
  hoje para sempre e "Salvar kit" guarda uma receita que recalcula. Não pode ficar só na hierarquia.
- **Freemium binário**: sem Premium ativo a ação **não aparece**. Nada de affordance cinza que promete e nega.
- "Salvo" só é dito quando o servidor confirmou. Pendente é pendente, e diz que está só neste aparelho.
- **Falha de rede nunca vira "não é premium"**, e falha de sessão nunca vira falha de rede.
- Frases honestas moram em texto de largura cheia, **nunca dentro de placeholder** (o placeholder só carrega
  exemplos curtos, como "Cliente, pedido…").
- Alvo de toque ≥44px — inclusive cada linha de rádio inteira, não só a bolinha.
- Contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Rótulo longo comendo o número**: no readout do kit, "Preço atacado" (111px) não coube em 101px e a
  reticência apareceria no caso normal de 5 dígitos. Quem cede é sempre o rótulo, nunca o valor.
- **Placeholder que corta a frase honesta** (016/PR-F): a frase foi para o placeholder, o campo estreitou e
  metade sumiu. Placeholder carrega número, não promessa.
- **Elemento visualmente coberto passa em teste**: "está visível" não sabe de oclusão. O botão que passa por
  baixo da barra fixada é exatamente essa classe — resolva no desenho, com posição, não empilhando camadas.
- **Transbordo horizontal medido**: valores de 5 dígitos na linha do rádio, com o rótulo à esquerda e o valor
  empurrado à direita, é o ponto onde 390px estoura.
- **Duas ações com o mesmo verbo lado a lado** já custou uma correção neste app: "Atualizar" (nosso) a 8px de
  "Atualizar forma de pagamento" (Mercado Pago) virou "Recarregar". Aqui são dois "Salvar".

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Kits a 1280px, coluna direita completa em repouso, com a ação desenhada em relação a "Salvar kit".
2. A mesma coluna nos estados: ação desabilitada (com razão legível) e ação ausente (sem Premium ativo).
3. A folha aberta em repouso, a 1280px, com valores reais e com o caso de R$ 12.480,00.
4. A folha nos estados enviando · aparelho não guardou (folha aberta com o aviso) — e os avisos de sucesso,
   pendente e sessão expirada.
5. Kits a 390px: a coluna rolando com a barra "Total do kit" fixada, mostrando onde a ação fica.

Reutilize os primitivos existentes, não crie novos: o botão de origem é o `tf-btn--secondary` com ícone; a
folha é o `tf-dialog--sheet-right`; os campos são `tf-field` + `tf-inputwrap`/`tf-input`; os valores dos
rádios usam `tf-price` (ou o par rótulo/valor do `tf-brow`); os avisos são `tf-alert` nos tons `info`,
`success` e `danger`; o cartão de "Salvar kit" continua sendo `tf-card`.

## Perguntas em aberto para o dono
1. **O rótulo continua "Salvar em Orçamentos"?** Ele é o mesmo em três lugares (botão, título e submit da
   folha) e colide com "Salvar kit" logo abaixo. Se puder mudar, mudar **qual** — e a copy já está homologada
   na tela de Orçamentos vazia ("…toque em 'Salvar em Orçamentos'"), então trocar aqui obriga a trocar lá.
2. **Qual das duas ações é a principal no kit?** Hoje "Salvar kit" é primária e o orçamento é secundário.
   É a hierarquia que o dono quer, ou o vendedor chega no kit para cotar?
3. **O botão desabilitado deve dizer por quê**, ou basta o "Sem preço ainda" do cartão acima?
4. **No mobile, a ação fica onde?** Acima da barra fixada, dentro dela, ou só no fim da rolagem?

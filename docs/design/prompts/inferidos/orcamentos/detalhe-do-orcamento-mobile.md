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

## O mapa funcional de Orçamentos (registros congelados, exportação, comparação)

### Orçamentos — o que a área é

A quarta aba (rotulada **"Orçamentos"**, rota `/historico`) é a prateleira dos **registros congelados**: cada registro é a afirmação do vendedor sobre *o que ele cotou naquele dia*, com data, e os valores ficam parados para sempre. É o oposto da aba Simulações, que recalcula tudo com os preços de hoje toda vez que abre. O vocabulário é deliberado e vale para todo desenho: diz-se **"Valor cotado"**, nunca "Preço" (preço é o que a Calcular diz *hoje*); diz-se **"salvo"** só quando o servidor confirmou.

**Como o vendedor chega.** Pela barra de abas (mobile) ou pelo menu lateral (desktop). Mas o registro **nasce fora daqui**: no rodapé da Calcular, no rodapé do compositor de Kits e no rodapé da ficha de produto do Catálogo existe um botão **"Salvar em Orçamentos"** que abre a folha de gravação. Ele volta a esta aba para *provar depois o que cobrou* — mostrar ao cliente, exportar um PDF, ou perguntar "meu custo subiu desde que cotei?".

**Rotas.**
- `/historico` — a lista (com busca e filtro de período, paginada por "Carregar mais", nunca carregada inteira).
- `/historico?snapshot={clientSnapshotId}` — o registro. **Abaixo de 1280px** ele toma a tela inteira (com "← Voltar"); **a partir de 1280px** a mesma rota vira **mestre-detalhe**: lista à esquerda, registro na coluna direita fixa (`position:sticky`, rolagem própria), e o primeiro registro abre sozinho.

**O que a área guarda e onde.** Três camadas, sempre unidas numa lista só: (1) o **servidor** (a conta), (2) um **cache local por uid** que responde quando a rede falha, (3) a **outbox** — a fila durável no aparelho. Gravar é *sempre* enfileirar-e-drenar: online a fila esvazia dentro da mesma interação e o registro volta `synced`; offline ele fica `pending` e sincroniza sozinho depois (quatro gatilhos: abertura do app, volta da rede, foco da janela, aba visível). Estados possíveis de um registro: `synced` · `pending` · `blocked` (Premium não ativo) · `unauthenticated` (sessão expirou) · `failed` (servidor recusou).

**De que depende.** Do **entitlement do servidor** (a última palavra sobre o plano — nunca um sinalizador do cliente); do motor **`pricing-core`**, usado *apenas* em "Recalcular hoje" e "Comparar com hoje" — a leitura do registro **não recalcula nada**, todo número é uma string gravada; do **catálogo de tarifas** servido+cacheado (só nesses dois recálculos); da **sessão Firebase**; e do **catálogo de produtos/kits**, consultado só para saber se a origem ainda existe (nunca para um valor).

**O que ela alimenta.** Um cálculo vira registro congelado; um registro vira **PDF de orçamento para o cliente** ou **CSV da conta**; "Recalcular hoje" cria um **registro novo** (o original é imutável — só o rótulo pode ser editado); a ficha técnica leva de volta ao produto/kit de origem, quando ele ainda existe.

**Como muda por estado.**
- **Grátis / deslogado** — a aba inteira é substituída por uma porta honesta: título "Guarde seus orçamentos com a data", subtítulo, "Assinar Premium" e o rodapé "A calculadora continua grátis e sem limite." Nenhuma lista, nenhum registro.
- **Premium ativo** — tudo: gravar, ler, renomear, excluir, recalcular, exportar.
- **Premium pausado (lapsed)** — **nada é apagado**. A lista e os registros continuam legíveis; some a barra gerenciar, some "Recalcular hoje", "Exportar" fica visível-e-desabilitado com o motivo impresso. Uma faixa calma explica: escrever precisa do Premium ativo.
- **Offline** — leitura pelo cache com faixa "Modo leitura offline"; gravar funciona (vira pendente); exportar **não** funciona (o arquivo é gerado no servidor); comparar/recalcular usam o catálogo salvo no aparelho e avisam que ele pode estar desatualizado.
- **Sessão expirada** — os registros novos param na fila com "Envio pausado · sessão expirada", e o caminho de volta ("Entrar de novo") aparece no banner e dentro do registro. O aviso genérico de falha de carga **cala** para não virar uma terceira voz sobre o mesmo fato.

## O ponto exato de inserção desta peça

- **Onde vive:** A rota /historico?snapshot={id} abaixo de 1280px: página cheia, coluna única, rolagem longa. Ordem real dos blocos no código, de cima para baixo: (1) link "← Voltar"; (2) PageHeader com o rótulo do registro; (3) badge de sincronização solto; (4) Card da alegação ("Cotado em {data} às {hora}" / "Valor cotado" + total / base / "Validade da proposta: {n} dias"); (5) faixa de Premium pausado; (6) barra gerenciar [Editar rótulo][Excluir]; (7) alerta de sincronização; (8) legenda "Valores congelados em {data}" (+ a de reaproveitamento); (9) PEÇAS DO KIT; (10) DETALHAMENTO; (11) linha Custo total; (12) PREÇOS POR CANAL; (13) Card FICHA TÉCNICA; (14) o botão "Comparar com hoje"; (15) a fileira final [Recalcular hoje] [Exportar] com flex-wrap.
- **Como o vendedor chega:** Tocando um card da lista, ou por um link compartilhado que abre direto nesta rota. Chega para ser MOSTRADO a um cliente, ou para virar arquivo.
- **Vizinhança imediata:** Acima: a moldura do shell (barra superior e suas faixas). O "← Voltar" é a única coisa entre o topo da página e o título. Abaixo: a barra de 5 abas. O bloco 4 (o Card da alegação) é o único elemento com peso de destaque — é proibido tratamento de PriceHero aqui, porque este número não é um preço de hoje. As duas ações que o vendedor mais quer (Recalcular, Exportar) moram no FIM do scroll.
- **Dados que chegam (e o que ela devolve):** Um documento congelado inteiro, resolvido pelo clientSnapshotId (funciona igual para um registro que só existe na outbox). Todo número é string gravada — nada é somado, nada é derivado, o pricing-core não é chamado. Uma linha ausente no payload NÃO vira R$ 0,00: ela simplesmente não é renderizada. O catálogo vivo é consultado para UMA coisa só: se o produto/kit de origem ainda existe, para oferecer o link "Abrir produto/Abrir kit". Se a origem sumiu, nada aqui muda de cor, de tom ou de legenda — essa ausência é a promessa.
- **O que acontece depois:** Daqui saem quatro caminhos: exportar (folha), recalcular (diálogo → cria um registro NOVO e navega para ele), comparar (painel in-place), e gerenciar (renomear/excluir; excluir volta para a lista). "← Voltar" retorna à lista.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Registro congelado em tela cheia (celular)

## O que desenhar
A tela inteira de **um orçamento congelado** no celular: o documento que o vendedor abre a partir da lista de Orçamentos e **mostra ao cliente na tela do telefone**. É a peça mais "documento" do app — nada nela é recalculado, todo número é uma string gravada no dia da cotação e apenas formatada para leitura. Ela vive em `/historico?snapshot=<id>` e, no celular, ocupa a tela toda (no desktop ≥1280px o mesmo conteúdo é a coluna direita do mestre-detalhe, sem "Voltar" e sem título próprio — esse modo já foi desenhado pelo dono e **não é o alvo deste prompt**). Antes dela vem a lista de Orçamentos; depois dela, só o que ela mesma oferece: recalcular, exportar, comparar, renomear, excluir.

## Por que este prompt existe
A **ordem de leitura dos 11 blocos** numa coluna de 390px nunca foi desenhada — foi decidida no código, na ordem em que os incrementos E4/E6/016 foram implementados. Autoridade: `PROTOTIPO_PARCIAL`. O protótipo de 2026-07-02 (`HistoryScreen.jsx`, §E6) desenhava **outra coisa**: um bottom-sheet com PriceHero centrado (`tone=accent`), três linhas de breakdown e [Duplicar]/[Exportar]. O produto abandonou as três: virou página inteira, **proibiu o PriceHero no congelado** (a proibição está escrita no cabeçalho de `snapshot-detail-page.tsx` — o valor congelado nunca recebe o tratamento do preço vivo) e "Duplicar" nunca existiu.
Há ainda uma **divergência declarada contra a única spec textual que existia**: `ux-history.md:362` pedia a ficha técnica "colapsável, calma"; o código entrega `TechnicalSheet` como **Card sempre aberto**, e ainda pendura nela a ressalva do relógio do aparelho (decisão F2). Diga no desenho qual das duas vence.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual, de cima para baixo (celular):

| # | Bloco | Forma hoje | Observação |
|---|---|---|---|
| 1 | Link "Voltar" (com seta) | link discreto, cor `--text-muted` | volta para a lista |
| 2 | Título da página | cabeçalho com o rótulo do registro, ou o nome capturado da origem, ou "Cálculo avulso" | |
| 3 | Badge de sincronização | badge solto, sem card, só quando ≠ sincronizado | tom `danger` se falhou, `info` nos demais |
| 4 | **Card da alegação** | "Cotado em 14/08/2026 às 19:32" · "Valor cotado" + **R$ 196,44** · "preço de varejo" · "Validade da proposta: 7 dias" | número em negrito tabular, **sem** PriceHero |
| 5 | Banner "Premium pausado" | alerta `info` | só quando o plano está pausado |
| 6 | Barra gerenciar | [Editar rótulo] [Excluir], botões secundários pequenos | só com Premium **ativo** e registro **sincronizado** |
| 7 | Alerta de sincronização | alerta com título + corpo + ações | só quando ≠ sincronizado |
| 8 | Legendas congeladas | "Valores congelados em 14/08/2026" (+ a frase de reaproveitamento) | texto solto, caption, `--text-muted` |
| 9 | Peças do kit | bloco solto, título de seção em versalete | só em kit |
| 10 | Detalhamento | bloco solto com linhas rótulo→valor | **não** é Card |
| 11 | Custo total | linha de breakdown com ênfase de total | |
| 12 | Preços por canal | bloco solto, um agrupamento por canal | **não** é Card |
| 13 | **Card** Ficha técnica | sempre aberto | |
| 14 | Comparar com hoje | botão fantasma que vira Card com duas linhas | |
| 15 | Ações | [Recalcular hoje] [Exportar], lado a lado, quebrando linha | **no fim de um scroll longo** |

→ **As duas ações primárias morrem no fim do scroll.** No celular, quem quer exportar rola por detalhamento, canais e ficha técnica antes de encontrar [Exportar]. O desenho do dono para o desktop já resolveu isso: a barra [Exportar] [Recalcular hoje] [Comparar com hoje] [Excluir] fica **logo abaixo do card da alegação**, separada por uma linha. Resolva também no celular.
→ **A hierarquia visual é acidental**: alegação e ficha técnica são Card; detalhamento, peças e canais são texto solto. Não há regra por trás disso — só a ordem em que foram escritos. Decida o que é superfície elevada e o que é texto corrido, e seja consistente.
→ **O valor cotado compete com o detalhamento**: os dois usam número em negrito e tabular. O valor cotado é a alegação; o detalhamento é prova. Isso precisa aparecer no peso, **sem** promover o congelado a PriceHero.
→ **O badge solto (3) flutua** entre título e card, sem âncora — e repete, em duas palavras, o que o alerta (7) diz em duas frases.
→ **A ficha técnica sempre aberta** empurra o comparar e as ações mais cinco linhas para baixo.

## Conteúdo e dados reais
Textos literais (não reescreva o que já foi homologado):
- "Voltar" · "Valor cotado" · "preço de varejo" / "preço de atacado" · "Cotado em {data} às {hora}" · "Validade da proposta: {n} dias"
- "Valores congelados em {data}" · "Estes valores foram reaproveitados de um congelamento anterior — a origem não estava disponível para repreçar."
- Seções: "Peças do kit" · "Detalhamento" · "Preços por canal" · "Ficha técnica"
- Detalhamento: "Material" · "Energia" · "Máquina" · "Falha / perdas" · "Acabamento" · "Mão de obra" · linhas de outros custos com o nome que o vendedor deu ("Embalagem") · "Custo total"
- Canal: "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "Canal" · "Preço para anunciar · Varejo" · "Recebido líquido · Varejo" (idem Atacado) · "sem comissão informada — este canal não teve preço" · "{n} de {total} peças"
- Kit: "{n} un" — uma **contagem**, nunca "3×", porque o total ao lado já está multiplicado
- Ficha técnica: "Calculado com a fórmula versão 2026.08" · "Registro criado a partir de: {nome}" · "Abrir produto" / "Abrir kit" · "Este registro guarda os valores como foram calculados naquele dia. Ele não muda quando você edita o catálogo nem quando a fórmula do app é atualizada." · "Data registrada pelo seu aparelho no momento da cotação."
- Ações: "Recalcular hoje" · "Exportar" · "Comparar com hoje" · "Editar rótulo" · "Excluir"

Números verdadeiros para popular as pranchetas (são os do canvas do dono): Valor cotado **R$ 196,44** (varejo) · Material R$ 3,78 · Energia R$ 0,36 · Máquina R$ 3,55 · Falha / perdas R$ 0,77 · Acabamento R$ 4,69 · Mão de obra R$ 6,19 · Embalagem R$ 2,50 · **Custo total R$ 21,84** · Mercado Livre: anúncio R$ 231,88 / líquido R$ 196,44 · Shopee: anúncio R$ 252,84 / líquido R$ 196,44. Validade 7 dias.
Regras dos dados: **linha ausente nunca vira R$ 0,00** — se o vendedor não cobrou acabamento, a linha simplesmente não existe; um preço de canal vazio some, não vira zero. O rótulo do registro é texto livre, opcional, até 120 caracteres (sem rótulo, o título é o nome capturado da origem; sem origem, "Cálculo avulso").

## Estados obrigatórios
- **Carregando**: indicador centrado, com o "Voltar" e o cabeçalho já no lugar.
- **Erro de leitura (frio)**: alerta `danger` "Não foi possível carregar seus orçamentos." + botão "Tentar novamente". **Nunca** "não encontrado" — dizer que o orçamento sumiu quando o que falhou foi a leitura é uma mentira cara.
- **Registro inexistente**: alerta `info` "Registro não encontrado." (sem botão).
- **Pronto e sincronizado**: sem badge, sem alerta — a maioria dos casos.
- **Pendente**: badge "Pendente neste dispositivo" + alerta `info` "Ainda não sincronizado" / "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." + a linha muted da durabilidade ("Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde.") + [Descartar] (e [Tentar agora] quando online).
- **Envio pausado (Premium)**: badge "Envio pausado · precisa de Premium" + alerta `info` "Envio pausado".
- **Sessão expirada**: badge "Envio pausado · sessão expirada" + alerta `info` "Sessão expirada" + botão secundário "Entrar de novo". Nunca fale em conexão aqui.
- **Falhou**: badge "Não foi possível registrar" + alerta `danger` de mesmo título + código de suporte em caption + [Tentar novamente] [Descartar].
- **Premium pausado (lapsed)**: alerta `info` "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium." A barra [Editar rótulo]/[Excluir] **desaparece**; [Exportar] fica desabilitado com "Exportar precisa do Premium ativo." **abaixo do botão, em texto legível** — não é tooltip, porque no toque não há hover.
- **Offline**: [Exportar] desabilitado com "Exportar precisa de conexão."; com o comparar aberto, a linha "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados."
- **Comparar**: fechado (botão fantasma) · aberto (duas linhas de **peso idêntico** — "Cotado em 14/08/2026" e "Hoje" — mais a nota "Comparação informativa: este registro não muda. Para gravar o valor de hoje, use \"Recalcular hoje\".") · indisponível ("Não foi possível calcular o valor de hoje para este registro com o seu catálogo atual.").
- **Documento ilegível** (payload de versão futura): os blocos 8–14 somem; cabeçalho, card da alegação e a linha de ações **permanecem**.
- **Foco / hover / pressionado** nos alvos: "Voltar", "Abrir produto/kit", cada botão e o link de entrar de novo — anel de foco visível sobre o fundo real de cada superfície.
- **Sem permissão** não é estado desta peça: o vendedor gratuito nunca chega aqui (o teaser barra antes, na lista).

## Viewports
- **390px (obrigatória)** — é a viewport nativa desta peça, e é exatamente onde a ordem de leitura foi inferida.
- **360px (estresse)** — o projeto já homologa jornadas a 360px; é ali que a linha de ações e os pares rótulo→valor quebram primeiro.
Não desenhe desktop aqui: acima de 1280px este conteúdo entra como coluna direita do mestre-detalhe, já desenhado no canvas do dono, e o corte é estrutural (abaixo dele o app nem monta a árvore de desktop).

## Regras que o desenho não pode quebrar
- **Zero recomputação, e isso é visível**: o valor congelado **não** usa o tratamento do preço vivo (nada de PriceHero, nada de destaque em cor de acento no total). Se aumentar o valor cotado, aumente por tipografia, não por cor.
- **Ausência não é zero**: nenhuma linha placeholder "R$ 0,00", nenhum travessão inventado no lugar de uma linha que não existe.
- **Procedência dita**: data, versão da fórmula e a ressalva do relógio do aparelho não podem sumir dentro de um acordeão fechado por padrão sem que alguém decida isso (ver Perguntas).
- **Degradação nunca escondida**: a frase de reaproveitamento e a de "sem comissão informada" são texto de leitura, em elemento de largura total, nunca truncadas.
- **Falha de rede nunca vendida como falta de Premium**, e vice-versa: são quatro alertas distintos, com quatro títulos distintos.
- **Alvos ≥44px** em "Voltar", nos botões da barra gerenciar e nas ações — inclusive quando a linha quebra em duas.
- **Contraste medido contra o fundo real** de cada bloco: o card da alegação, o alerta colorido e o fundo da página são três fundos diferentes.

## Armadilhas já pagas neste projeto
- **Overflow horizontal se mede, não se olha**: um rótulo longo ("Orçamento — Maria Aparecida, pedido #10482") no cabeçalho e um valor grande (**R$ 12.345,67**) na linha de "Valor cotado" já estouraram colunas neste app. Desenhe com esses valores, não com os curtos.
- **Frase honesta dentro de placeholder some**: honestidade mora em elemento de largura total, nunca como sufixo cortado de um campo.
- **Texto ocluso passa em teste**: um bloco empurrado para fora ou coberto continua "visível" para as asserções — a prova é geométrica, então dê margens que sobrevivam a 360px.
- **Duas ações no fim de um scroll longo** já foi medido como o defeito desta tela; não repita por inércia de implementação.
- **Badge e alerta dizendo a mesma coisa** é ruído: decida qual carrega o estado de sincronização.

## Entregável
Pranchetas a 390px (com as quebras críticas repetidas a 360px), **tema escuro como padrão e tema claro como first-class**:
1. Peça única, sincronizada, com dois canais — a prancheta canônica, com a ordem de leitura redesenhada.
2. Kit, com "Peças do kit" (3 linhas, "{n} un") e o rollup "{n} de {total} peças" em um canal.
3. Premium pausado: banner, barra gerenciar ausente, Exportar desabilitado com a razão em texto.
4. Pendente e offline: badge, alerta, linha de durabilidade e [Descartar].
5. Comparar com hoje aberto, com as duas linhas de mesmo peso e a nota informativa.
6. Carregando e erro de leitura, lado a lado.
Reutilize os primitivos existentes, sem criar novos: `tf-card` no card da alegação e na ficha técnica, `tf-alert` (tons `info` e `danger`) nos quatro alertas, `tf-badge` no estado de sincronização, `tf-brow` / `tf-brow--total` nas linhas de detalhamento e no custo total, `tf-btn` (`--primary`, `--secondary`, `--ghost`, `--danger-ghost`, `--sm`) nas ações, `tf-historico__section` nos títulos de seção, `tf-historico__meta` nas legendas e `tf-tnum` em todo dinheiro. Marque explicitamente na entrega qual bloco virou Card e qual virou texto corrido — é a decisão central que este prompt pede.

## Perguntas em aberto para o dono
1. **Ficha técnica: Card aberto ou colapsável?** A spec pedia "colapsável, calma"; o código entrega sempre aberto. Qual vence — e, se colapsar, a ressalva do relógio do aparelho (decisão F2) fica visível ou colapsa junto?
2. **A barra de ações sobe para logo abaixo da alegação, como no seu canvas de desktop?** E, se subir, "Excluir" entra nela no celular (hoje mora numa barra separada, acima) ou continua apartado de [Exportar]/[Recalcular hoje]?
3. **"Comparar com hoje" é um botão ou um bloco já aberto?** Hoje é um botão fantasma solto no meio da página, sem seção que o anuncie.

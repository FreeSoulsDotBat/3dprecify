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

- **Onde vive:** Uma folha lateral (Sheet) que se abre por cima de TRÊS telas fora desta área: o rodapé da Calcular (abaixo do bloco "Preços por canal" e do botão "Salvar simulação", centralizada), o rodapé do compositor de Kits (logo abaixo do resumo do kit) e o rodapé da ficha de produto do Catálogo. Dentro da folha, de cima para baixo: SheetTitle "Salvar em Orçamentos" · SheetDescription ("Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.") · campo "Rótulo (opcional)" com hint "Cliente, pedido…" · campo "Validade da proposta" com o sufixo "dias" dentro da moldura do input · o fieldset "Preço que você está cotando" (radios com rótulo à esquerda e valor em negrito tabular empurrado para a direita) · a linha "Cotado em {data}" · o botão de envio.
- **Como o vendedor chega:** O vendedor acaba de calcular uma peça, montar um kit ou abrir um produto salvo, viu o preço, e toca no botão secundário com ícone de disquete "Salvar em Orçamentos". O botão só EXISTE com Premium ativo — sem ele não é um botão cinza nem um gancho de venda: ele simplesmente não está lá (a calculadora grátis não é balcão de vendas).
- **Vizinhança imediata:** Por baixo da folha fica a tela de origem congelada com o resultado ainda visível — os números que o vendedor está prestes a congelar. Na Calcular, o botão de abertura fica logo abaixo de "Salvar simulação", os dois centralizados; a folha entra pela direita e escurece o resto.
- **Dados que chegam (e o que ela devolve):** O payload é congelado no INSTANTE em que a folha abre — os números lidos antes de confirmar são exatamente os gravados; nada é re-derivado no envio. Chegam os dois totais possíveis (varejo e atacado) do resultado em tela: o fieldset lista só os que existem (com um só, ele renderiza um radio solitário já marcado). A data e o fuso vêm do relógio do APARELHO. O id do registro é sorteado agora, não no envio — é ele que garante que um reenvio não duplique.
- **O que acontece depois:** Ao enviar, o registro é enfileirado de forma durável e a fila é drenada na hora. A folha fecha e um aviso efêmero diz a verdade sobre onde o registro chegou: "Registro salvo em Orçamentos." (servidor confirmou) · "Pendente neste dispositivo…" · "Envio pausado — o Premium não está ativo" · "Envio pausado — sua sessão expirou" · ou o vermelho de recusa. Se o APARELHO não conseguiu guardar, a folha FICA ABERTA com tudo preenchido. O registro passa a existir na aba Orçamentos. A escolha da base é irreversível: depois de gravado, só o rótulo é editável.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Folha "Salvar em Orçamentos" — onde o registro congelado nasce

## O que desenhar

A folha modal que abre quando o vendedor toca em **"Salvar em Orçamentos"** depois de calcular um preço.
Ela aparece em três lugares (calculadora avulsa, ficha de produto do catálogo e compositor de kits) e é
sempre a mesma peça. Nela o vendedor dá um rótulo opcional ao registro, diz por quantos dias a proposta
vale e — a parte que importa — **declara qual preço ele está cotando: varejo ou atacado**. Ao confirmar,
os valores da tela são congelados como estavam naquele dia e viram um documento imutável no Orçamentos
(ADR-0019: depois de salvo, só o rótulo pode mudar). A folha é premium-only: sem premium ativo o botão nem
existe — não é botão cinza, não é isca de venda.

## Por que este prompt existe

A folha inteira foi inferida por IA a partir de requisito textual (`009/T010`), sem nenhum desenho: o
protótipo de 2026-07-02 desenhou só o caminho **grátis** ("Ação Salvar → dispara bottom-sheet de upsell",
§E4/§E5), onde salvar sempre terminava no upsell — a folha de **gravação** premium nunca existiu. O que
falta é a hierarquia entre os três campos: hoje a decisão **irreversível** (a base cotada) tem o mesmo
peso visual do rótulo opcional, e é a única das três que muda o significado do registro. Errada, o
Orçamentos passa a mentir sobre o que foi cobrado, em silêncio e para sempre. (Varejo×atacado aparece no
protótipo só como segmented control de **resultado** na calculadora — lá é visualização, aqui é
declaração permanente.)

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/history/record-snapshot-sheet.tsx` + `.css`; textos em
`shared/i18n/messages.pt-br.ts` (`historico.*`).

Ordem atual, de cima para baixo, dentro de um painel `tf-dialog--sheet` **ancorado à direita**
(`width: min(92vw, 26rem)`, altura total, cantos arredondados só à esquerda, botão X de 44×44px no canto
superior direito, scrim por trás):

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título | "Salvar em Orçamentos" | `tf-dialog__title` — caixa alta, fonte de título |
| 2 | Descrição | "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje." | muted, `fs-body-sm` |
| 3 | Campo texto | rótulo "Rótulo (opcional)", hint abaixo "Cliente, pedido…" | opcional, máx. 120 caracteres, sem contador |
| 4 | Campo número | rótulo "Validade da proposta", sufixo "dias" dentro do `tf-inputwrap` | 1 a 3650, opcional, vazio ⇒ não registra validade |
| 5 | Grupo de escolha | legenda "Preço que você está cotando"; opções "Varejo" e "Atacado" | rádios nativos, valor em negrito tabular empurrado para a direita |
| 6 | Linha de data | "Cotado em 20/08/2026" | muted, `fs-body-sm`, não editável |
| 7 | Botão | "Salvar em Orçamentos" | primário, largura natural, último elemento |

→ **Problema 1 (o motivo deste prompt):** o item 5 é uma caixa com borda fina de 1px, legenda cinza em
0,875rem e dois rádios nativos de sistema — visualmente **menos** presente que o campo de rótulo acima
dele. É a única decisão irreversível da folha e parece o item menos importante.
→ **Problema 2:** o botão de confirmar repete literalmente o texto do título e do botão que abriu a folha
("Salvar em Orçamentos" três vezes na mesma interação). O terceiro não diz o que vai acontecer agora.
→ **Problema 3:** os dois campos são opcionais, mas só um diz isso — "Rótulo (opcional)" escreve a palavra
dentro do rótulo (o DS tem marca "opcional" própria) e "Validade da proposta" não marca nada.
→ **Problema 4:** enquanto grava, o botão apenas **morre** (fica desabilitado, sem spinner e sem trocar de
texto). Não há nenhum "Salvando…" — o DS tem estado de carregamento com spinner e o Kits já usa a palavra.
→ **Problema 5:** a data ("Cotado em 20/08/2026") é parte da declaração e está desenhada como nota de
rodapé cinza.
→ **Problema 6:** validade fora de 1–3650 cai na validação nativa do navegador (balão do sistema
operacional, fora do DS, às vezes em outro idioma). O DS tem estado de erro por campo e ele não é usado.

## Conteúdo e dados reais

- **Rótulo** — texto livre, opcional, até 120 caracteres. Exemplo real: `Ana — pedido 214`. Em branco,
  nada é gravado (não vira string vazia).
- **Validade da proposta** — inteiro em dias, 1 a 3650, opcional. Exemplo: `15`. Não é prazo de validade
  do registro (nada expira): é o prazo que o vendedor **prometeu** ao cliente.
- **Base cotada** — exatamente duas opções, "Varejo" e "Atacado", cada uma com o dinheiro congelado ao
  lado, em números tabulares. Números do seed do projeto: custo total R$ 16,16 → **Varejo R$ 24,24** ·
  **Atacado R$ 21,01**. Varejo vem pré-selecionado (é o caso comum). Desenhe também com um valor grande —
  **R$ 24.215,76** — porque o kit de 5 peças chega lá e a linha não pode quebrar nem cortar.
- **Data** — data do aparelho, no formato `20/08/2026`. Mostrada antes de gravar porque faz parte da
  declaração, não é efeito colateral.
- **Caso de uma opção só** — quando o cálculo congelado traz apenas um dos dois preços, o grupo desenha um
  rádio solitário já marcado: parece escolha e não é. Precisa de um tratamento próprio (ver Perguntas).

## Estados obrigatórios

1. **Repouso** — varejo já marcado, campos vazios, botão ativo. É o estado que o vendedor mais vê.
2. **Foco** — anel de foco visível em campo de texto, em campo numérico com sufixo e **na linha inteira do
   rádio** (a linha toda é o alvo, 44px de altura mínima, não só a bolinha).
3. **Hover / pressionado** — nas duas linhas de base e no botão de confirmar.
4. **Base alternada** — "Atacado" marcado. Mostre que a escolha ficou inequívoca à distância de um relance.
5. **Gravando** — botão desabilitado durante o envio; desenhe com spinner e o texto que o dono escolher
   (hoje não existe texto; o Kits usa "Salvando…").
6. **Erro de campo** — validade fora de 1–3650 dias, usando o estado de erro do DS por campo.
7. **Falha do aparelho (a folha NÃO fecha)** — o dispositivo não conseguiu nem guardar localmente: toast
   de perigo com "Não foi possível guardar o registro neste aparelho. Ele não foi salvo." e a folha
   permanece aberta com tudo preenchido — o vendedor não perdeu a cotação.
8. **Sucesso** — folha fecha, toast de sucesso "Registro salvo em Orçamentos."
9. **Pendente (offline)** — folha fecha, toast informativo "Pendente neste dispositivo. Sincroniza sozinho
   quando houver conexão."
10. **Envio pausado — premium** — toast informativo "Envio pausado — o Premium não está ativo. O registro
    continua neste aparelho."
11. **Envio pausado — sessão** — toast informativo "Envio pausado — sua sessão expirou. O registro
    continua neste aparelho." (a palavra "conexão" nunca aparece aqui: a causa é outra).
12. **Recusa do servidor** — toast de perigo "Não foi possível registrar. O servidor não aceitou este registro."
13. **Sem premium ativo** — a folha não existe e o botão que a abre também não. Não desenhe versão cinza.

Os estados 8 a 12 acontecem com a folha já fechada: desenhe cada toast sobre a tela de onde ela foi
chamada, não dentro da folha.

## Viewports

- **390px (obrigatório)** — é onde o vendedor realmente trabalha. Hoje o painel ocupa 92vw ancorado à
  direita, deixando uma faixa de scrim de ~32px à esquerda: mostre se isso é intencional ou se em telas
  estreitas a folha deve subir de baixo.
- **1280px (obrigatório)** — o corte desktop do 018. Hoje é literalmente o mesmo painel de 26rem colado na
  borda direita, sem variante: folha estreita e altíssima, seis elementos no topo e muito vazio embaixo.
- **1920px** — mesma folha, para mostrar como ela convive com o rail de navegação e a lista atrás.

## Regras que o desenho não pode quebrar

- **A base é a decisão principal da folha.** Ela precisa de mais peso visual que o rótulo opcional — e
  isso não pode virar um alerta vermelho: é uma escolha normal e correta, não um perigo.
- **Cada número aparece colado à sua base.** "Varejo" sem R$ ao lado é escolha às cegas.
- **Falha de rede nunca é vendida como falta de premium**, e sessão expirada nunca é chamada de conexão:
  são três textos distintos e todos já existem.
- **Frase honesta nunca dentro de placeholder.** "Cliente, pedido…" é hint abaixo do campo (é assim hoje;
  mantenha) — placeholder carrega só número.
- **Alvo ≥ 44×44px** em cada linha de rádio, no X de fechar e no botão.
- **Contraste medido contra o fundo real da folha** (superfície de card sobre scrim), não contra o fundo
  da página.
- **Nada de novo primitivo.** Só a composição muda.

## Armadilhas já pagas neste projeto

- **Valor grande estoura a coluna:** o valor da base é empurrado para a direita por espaçamento
  automático; com R$ 24.215,76 a 390px ele encosta no texto "Atacado". Desenhe a linha com o número
  grande, não só com 24,24.
- **Texto ocluso passa em teste:** o título reserva espaço para o X à direita; qualquer coisa nova no topo
  precisa desse mesmo respiro medido, e não basta "estar lá".
- **Rolagem no eixo vertical:** o painel rola; com teclado aberto a 390px, o botão de confirmar precisa
  continuar alcançável — mostre o estado com teclado virtual ocupando metade da tela.

## Entregável

Pranchetas, no tema escuro (padrão) **e** no claro, ambos de primeira classe:

1. **390px — repouso**, com os três campos e a nova hierarquia da base.
2. **390px — "Atacado" marcada** + a variante com valor grande (R$ 24.215,76).
3. **390px — foco e erro**: foco na linha de rádio, e validade com erro de faixa.
4. **390px — gravando** (botão com spinner) e **falha do aparelho** (folha aberta + toast de perigo).
5. **390px — os quatro toasts** (salvo / pendente / pausado premium / sessão) sobre a tela de origem.
6. **1280px e 1920px — repouso**, mostrando a forma da folha no desktop.
7. **390px — caso de uma base só**, com a proposta de tratamento.

Reutilize os primitivos existentes, nomeadamente: a folha em `tf-dialog--sheet` com seu X de fechar; o
título em `tf-dialog__title` e a introdução em `tf-dialog__desc`; os dois campos com o wrapper de campo do
DS (rótulo + hint + erro + marca "opcional") e o input em `tf-inputwrap` com afixo para o sufixo "dias";
o botão de confirmar como botão primário com estado de carregamento; os avisos como toasts nos tons
`success` / `info` / `danger` que já existem. Para a escolha de base, avalie o controle segmentado do DS
como alternativa aos rádios nativos — mas só se ele couber com o dinheiro de cada opção visível; se não
couber, mantenha a lista de linhas e resolva o peso por tipografia e superfície, sem inventar componente.

## Perguntas em aberto para o dono

1. Quando só existe **uma** base possível, o que a folha deve mostrar: o rádio solitário já marcado (hoje),
   uma linha de leitura sem escolha ("Cotando: Varejo — R$ 24,24"), ou nada?
2. A folha deve avisar **antes** de confirmar que o aparelho está offline e o registro ficará pendente, ou
   a honestidade continua só no toast depois de fechar?
3. A folha deve dizer em texto que a escolha é **irreversível** (ex.: "Depois de salvo, só o rótulo pode
   ser alterado")? É copy nova e afeta o tom da peça inteira.
4. O botão de confirmar deve continuar repetindo "Salvar em Orçamentos" ou receber um texto próprio (ex.:
   "Congelar este preço")? E qual é o texto do estado gravando?
5. A validade deve ter um valor sugerido (ex.: 15 dias) ou continuar em branco por padrão? Pré-preencher
   grava uma promessa que o vendedor não digitou.
6. No desktop, a folha continua ancorada à direita ou vira diálogo central?

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

- **Onde vive:** A rota /historico a partir de 1280px: uma grade de duas colunas dentro da página, abaixo do título "Orçamentos" e do subtítulo. À esquerda, a lista COMPLETA (filtros, faixas, cards, [Carregar mais]) sem cabeçalho próprio; à direita, um <aside> com o registro congelado sem "← Voltar" e sem segundo título de página. A coluna direita é FIXA (sticky, colada ao topo) com altura máxima de quase a tela inteira e rolagem própria — o documento rola sem levar a lista junto.
- **Como o vendedor chega:** Basta abrir a aba num notebook ou monitor. Abaixo de 1280px esta árvore nem é montada — o mobile continua sendo lista OU registro, nunca os dois.
- **Vizinhança imediata:** À esquerda de tudo, o menu lateral do shell (que recolhe para um trilho estreito em telas menores). Dentro da grade, o card ABERTO da lista se declara com borda e fundo de destaque, do mesmo jeito que o Catálogo marca o item escolhido.
- **Dados que chegam (e o que ela devolve):** A proporção depende da largura: de 1280 a 1439px as colunas dividem por fração (a lista tem um piso de leitura de 320px e fica um pouco MENOR que o documento — quem precisa de espaço aqui é a tabela de detalhamento e os preços por canal); de 1440px para cima a lista volta à largura fixa de 520px desenhada. Qual registro está aberto mora na URL (?snapshot=), nunca num estado local — não existe uma segunda verdade sobre isso.
- **O que acontece depois:** Com a lista carregada e nenhum registro escolhido, o PRIMEIRO abre sozinho (substituindo a entrada no histórico do navegador, para o Voltar não ter de desfazer isso). Clicar noutro card troca só a coluna direita. Se a lista estiver vazia — inclusive por filtro —, a coluna direita mostra o estado vazio FRIO ("Nenhum registro ainda").

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Orçamentos no desktop: a lista e o documento entre 1280 e 1440px

## O que desenhar
A tela **Orçamentos** (o registro congelado do que o vendedor já cotou) na composição de duas colunas do
desktop: à esquerda a lista de registros com seus filtros, à direita o documento aberto — claim, detalhamento
de custos, preços por canal, ficha técnica e as ações. Ela só existe acima de 1280px; abaixo disso a lista
ocupa a tela inteira e abrir um registro é uma navegação. O vendedor vive aqui depois de fechar uma venda ou
quando um cliente volta perguntando "quanto você me passou mês passado?" — ele varre a lista à esquerda e lê
o documento à direita, sem perder a lista de vista. Precisamos do desenho **na faixa 1280–1440px**, que é
exatamente onde fica o notebook comum (1366px) e onde hoje ninguém desenhou nada.

## Por que este prompt existe
O desenho de referência (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) tem **uma única largura: 1920px**
— nenhum `@media`, nenhum segundo artboard, nenhuma anotação de breakpoint. A prancheta fixa
`grid-template-columns: 520px minmax(0,1fr)`, e isso é verdade só a 1920. A 1280 essa mesma regra dava
**lista 520px × documento 432px**: a lista ficava MAIOR que o documento, invertendo a prioridade da tela
(quem precisa de espaço aqui é o registro, com sua tabela de detalhamento e os preços por canal). O código
então inventou uma segunda regra que o desenho não tem — `minmax(320px, 0.85fr) minmax(0, 1.15fr)` abaixo de
1440, com os 520px fixos voltando só em `@media (min-width:1440px)` — e mais: fez a coluna direita
`position: sticky` com scroll próprio e altura de janela, e fez o primeiro registro da lista abrir sozinho.
**Nada disso foi desenhado.** Foram achados de homologação do próprio agente que construiu, registrados em
comentário de CSS, nascidos depois do desenho e contra ele.

## O que já existe hoje (não invente do zero — corrija)

**Coluna esquerda (a lista), de cima para baixo:**
1. Cabeçalho da página: título "Orçamentos" + subtítulo "O que você cotou, com a data. Os valores ficam
   congelados como estavam no dia." (fica acima das duas colunas, largura cheia).
2. Faixas de aviso quando existem (Premium pausado, offline, fila pendente) — hoje ficam acima da grade.
3. Barra de filtros: campo de busca com rótulo "Buscar por rótulo" e placeholder "Cliente, pedido…"
   (máx. 120 caracteres); abaixo, chips "Tudo" · "30 dias" · "90 dias" · "Período…" — hoje **empilhados em
   coluna**, porque a regra foi escrita para 390px. → A 1280px isso gasta duas linhas verticais num espaço
   que já é o mais apertado da tela.
4. Cards de registro, um embaixo do outro: rótulo (uma linha, com reticências), badge de sincronização quando
   houver, "Cotado em 14/08/2026 · Kit · 3 peças", "Valor cotado" à esquerda e **R$ 1.234,56** à direita,
   e a legenda da base ("preço de varejo" / "preço de atacado"). A data vem SEMPRE antes do dinheiro.
5. Botão "Carregar mais" quando há mais páginas.

**Coluna direita (o documento aberto):** sem cabeçalho próprio e sem o link "Voltar" (a lista está ali ao
lado). Na ordem: badge de sincronização (se houver) · o card do claim ("Cotado em 14/08/2026 às 15:42",
"Valor cotado" + **R$ 1.234,56**, a base, "Validade da proposta: 15 dias") · avisos · rename/excluir ·
"Valores congelados em 14/08/2026" · "Peças do kit" com linhas "Suporte de fone · 3 un · R$ 405,00" ·
"Detalhamento" (material, energia, máquina, falhas, acabamento, mão de obra, outros custos) · o custo total ·
"Preços por canal" · "Ficha técnica" · "Comparar com hoje" · e por fim os botões "Recalcular hoje" e
"Exportar".

**A grade:** hoje, 1280–1439px → `minmax(320px, 0.85fr) minmax(0, 1.15fr)`; ≥1440px → `520px + resto`.
→ Isso produz um **salto de ~40px na largura da lista exatamente em 1440px** que ninguém desenhou nem viu.
→ A coluna direita é `sticky`, presa ao topo, com `max-height` de janela e **barra de rolagem própria**:
num notebook 1366×768 sobram ~700px de altura para um documento que tem sete blocos. Ninguém desenhou como
esse scroll interno se anuncia, nem onde as ações "Recalcular hoje"/"Exportar" ficam quando ele existe.
→ Quando a busca não acha nada, a coluna direita mostra o vazio **FRIO**: "Nenhum registro ainda" com o corpo
"Calcule uma peça ou um kit e toque em 'Salvar em Orçamentos' para guardar o preço com a data." — ao lado de
uma lista que tem registros e só está filtrada. É uma frase falsa naquele contexto.

## Conteúdo e dados reais
- Larguras aproximadas com a barra lateral de 240px e goteiras: a **1280px** sobram ~960px para as duas
  colunas; a **1366px**, ~1070px; a **1440px**, ~1140px. O gap entre colunas é de 24–28px.
- Dinheiro sempre em `R$ 1.234,56`, alinhado à direita, com algarismos tabulares. Valores plausíveis vão de
  R$ 16,16 (peça pequena) a R$ 9.876,54 (kit grande) — **desenhe pelo menos um card e um documento com o
  valor de 4 dígitos**, que é onde a coluna estoura.
- Rótulos de registro são texto livre do vendedor e chegam longos: use "Reposição bancada — Marcenaria
  Andrade / pedido 4471" como caso adverso na lista E no título do documento.
- Badges de sincronização, literais: "Pendente neste dispositivo" · "Envio pausado · precisa de Premium" ·
  "Envio pausado · sessão expirada" · "Não foi possível registrar".
- Faixa de fila, literal: "3 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora".
- Premium pausado, literal: "Premium pausado — seus registros continuam aqui e podem ser abertos. Para
  salvar, renomear, excluir ou exportar, reative o Premium."
- Offline, literal: título "Modo leitura offline", corpo "Seus registros continuam aqui. Novos registros
  ficam pendentes neste dispositivo até você voltar a ficar online."
- Busca sem resultado, literal: "Nenhum registro encontrado para “pedido 4471”." + botão "Limpar busca".
- O filtro de período customizado abre uma folha com "De" / "Até" / "Aplicar"; ativo, vira o chip
  "Período: 2026-07-01 – 2026-07-31" com "Limpar filtro" ao lado.

## Estados obrigatórios
Para a **grade** (o que este prompt existe para resolver): 1280px · ~1366px · 1439px · 1440px. Mostre a
proporção pretendida em cada um e o que acontece na virada.

Para a **coluna esquerda**: lista com registros (repouso) · card **aberto/selecionado** (hoje: borda e fundo
de acento — precisa ler como "é este que estou lendo à direita", e não como hover) · hover e foco de teclado
num card (são links) · carregando (spinner) · lista vazia FRIA · busca sem resultado · erro frio de leitura
("Não foi possível carregar seus orçamentos." + "Tentar novamente") · com fila pendente · Premium pausado.

Para a **coluna direita**: documento carregado · carregando · registro não encontrado ("Registro não
encontrado.") · erro frio com retry · **vazio porque nada está selecionado** (hoje é o vazio frio — precisa de
uma frase própria) · **vazio porque o filtro não achou nada** (idem) · documento com scroll interno (indique
como o corte se anuncia) · Premium pausado (as ações de escrita somem e a faixa explica) · offline
("Exportar precisa de conexão." aparece no lugar do botão) · registro ainda pendente ("Sincronize para
exportar.").

## Viewports
Desenhe **1280px** e **1366px** obrigatoriamente — é a faixa que nunca foi desenhada e onde o produto está
errado hoje. Desenhe também **1440px** só para mostrar a transição para a regra que já existe (lista de
520px). **1920px já está desenhado**: não refaça, use como âncora. **Não desenhe mobile**: abaixo de 1280px
esta composição não existe no código — a lista é tela cheia e o registro é outra tela.

## Regras que o desenho não pode quebrar
- **O documento tem prioridade sobre a lista.** Em nenhuma largura da faixa a lista pode ficar mais larga
  que o documento — foi exatamente esse o defeito.
- **A data vem antes do dinheiro**, no card e no documento. O card é uma linha de razão, não um preço vivo:
  nada de tratamento de preço-herói, nada de cor que leia como "atual".
- **"Valor cotado", nunca "Preço".** Preço é o que a calculadora diz hoje.
- **Vazio filtrado ≠ vazio frio.** A coluna direita não pode afirmar "Nenhum registro ainda" quando a lista
  tem registros e só o filtro não achou.
- **Falha de rede nunca vira "não é premium"**, e Premium pausado nunca esconde o registro: ele continua
  legível, só a escrita para.
- Frase honesta mora em elemento de largura cheia, **nunca em placeholder** (o placeholder corta).
- Alvos de toque/clique ≥44px nos cards e nas ações; contraste medido contra o fundo real do card
  selecionado (acento suave), não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: a coluna estreita da faixa 1280 é onde "R$ 9.876,54" ao lado
  de um rótulo longo estoura. Desenhe com o valor de 4 dígitos e o rótulo comprido juntos.
- **Texto ocluso passa em teste**: um elemento fora da área visível ou embaixo de outro continua "visível"
  para o código. O corte do scroll interno da coluna direita é exatamente esse risco.
- **Barra de rolagem clássica não aparece em captura headless**: o scroll interno precisa se anunciar
  visualmente (sombra, borda, corte de conteúdo), não só existir.
- **Marcação de seleção esquecida**: já aconteceu aqui — o registro abria à direita e nenhum card ficava
  marcado. O vendedor perdia o vínculo entre o que escolheu e o que lê.
- **Salto no breakpoint**: a mudança de regra em 1440 é uma descontinuidade real; ou o desenho a assume de
  propósito, ou ela é um defeito silencioso.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, não um afterthought)**:
1. 1280px — estado pleno: lista com 5 registros, o primeiro aberto à direita, faixa de fila no topo.
2. 1366px — o mesmo, com o rótulo longo e o valor de 4 dígitos.
3. 1440px — só a grade, para mostrar a virada para a lista de 520px.
4. 1280px — busca sem resultado à esquerda e a coluna direita no estado vazio correspondente.
5. 1280px — Premium pausado (ações de escrita ausentes) e offline.

Reutilize os primitivos existentes, sem criar nenhum novo: `tf-card` (com o modificador de card aberto) para
os registros, `tf-input` dentro de `tf-inputwrap` para a busca, `tf-btn` (`--sm`, `--secondary`, `--ghost`)
para chips e ações, `tf-badge` para o estado de sincronização, `tf-alert` (`--info` / `--danger`) para as
faixas, o bloco de detalhamento e o estado vazio já existentes. Anote na prancheta as larguras resultantes
de cada coluna em cada viewport — o número é o entregável tanto quanto a imagem.

## Perguntas em aberto para o dono
1. Na faixa 1280–1440, qual é a proporção certa entre lista e documento? Manter a lista em fração com piso de
   leitura (o que o código improvisou) ou fixá-la numa largura menor, por exemplo 420px, e dar todo o resto ao
   documento? E o salto de ~40px na largura da lista exatamente em 1440 é aceitável, ou você quer transição
   contínua até os 520px do desenho de 1920?
2. Quando a busca não acha nada, o que a coluna direita deve dizer? Ela hoje repete a frase do vazio frio
   ("Nenhum registro ainda"), que é falsa nesse contexto — mas não existe copy aprovada para o caso.
3. Num notebook 1366×768 o documento não cabe na altura. Deve rolar sozinho dentro da coluna (como hoje) ou a
   página inteira deve rolar junta? E se for scroll interno, "Recalcular hoje" e "Exportar" ficam no fim do
   conteúdo ou fixos no rodapé da coluna, sempre alcançáveis?
4. Abrir automaticamente o primeiro registro da lista é desejado a 1280px? A 1920 preenche a tela; a 1280 ele
   também consome a coluna mais estreita com um documento que o vendedor talvez não tenha pedido.

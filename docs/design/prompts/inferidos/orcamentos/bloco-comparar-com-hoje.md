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

- **Onde vive:** Dentro do registro congelado, entre o Card "FICHA TÉCNICA" e a fileira final [Recalcular hoje][Exportar]. Começa como um único botão fantasma (ghost) solto, alinhado à esquerda, escrito "Comparar com hoje". Ao ser tocado, ele se SUBSTITUI no mesmo lugar por um Card com: a base dita uma vez no topo ("preço de varejo") · a linha "Cotado em {data}" com o valor à direita · a linha "Hoje" com o valor à direita, as duas com peso visual IDÊNTICO · a nota de catálogo desatualizado quando offline · um alerta informativo sobre o modelo aposentado · e a nota de fecho ("Comparação informativa: este registro não muda…").
- **Como o vendedor chega:** O vendedor está olhando um orçamento de dois meses atrás e quer saber se o custo dele subiu. Um toque no botão fantasma abre o painel no lugar — não é folha, não é diálogo, nada cobre a tela.
- **Vizinhança imediata:** Acima: o Card da ficha técnica (versão da fórmula, origem, nota do relógio do aparelho). Abaixo, colada: a fileira de botões que EFETIVAMENTE gravam ou exportam.
- **Dados que chegam (e o que ela devolve):** O botão só existe se a origem (produto ou kit) ainda resolve no catálogo — sem origem, nem o gatilho aparece. Ao abrir, o pricing-core reprecifica UMA vez, com o catálogo de tarifas atual, na MESMA base do registro (um orçamento de atacado é comparado com o atacado de hoje). Se o recálculo não conseguir chegar a um número novo de verdade, o painel diz isso e nada é rotulado como "Hoje".
- **O que acontece depois:** Nada é gravado — o painel é puramente informativo e não mostra a diferença calculada (a aritmética de dinheiro mora no motor). Quem quiser transformar o valor de hoje num registro usa "Recalcular hoje", logo abaixo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Bloco "Comparar com hoje" — o congelado ao lado do preço de hoje

## O que desenhar
O painel que responde "meu custo subiu desde que cotei?" dentro de um orçamento já salvo. Ele vive no
DETALHE de um registro de Orçamentos (`/historico?snapshot=…`), depois da "Ficha técnica" e antes da
fileira de ações [Recalcular hoje] [Exportar]. Quem usa é o vendedor que abriu um orçamento antigo — em
geral porque o cliente voltou a falar dele — e quer saber se o preço que ele cotou em julho ainda paga a
conta hoje. É uma consulta, não uma edição: o painel calcula o preço de hoje na hora, mostra os dois
números lado a lado e **não grava nada**. Hoje ele é um botão discreto que, ao ser tocado, se troca no
lugar por um card com as duas linhas. Desenhar: o gatilho, o painel aberto, e os três estados honestos
que ele já tem (offline, modelo aposentado, "não deu para calcular").

## Por que este prompt existe
O painel inteiro foi inferido: nenhum protótipo, nenhum canvas, nenhum ux-*.md o descreve. O canvas do
dono (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linha 315) desenha **só o gatilho** — um
`tf-btn--secondary` "Comparar com hoje" na fileira de ações, junto de Exportar e Recalcular hoje — e o
código o renderiza diferente: um botão fantasma solto entre a ficha técnica e a fileira. O protótipo
antigo (`HistoryScreen.jsx`) tem um "Comparar", mas é **outra funcionalidade**: compara dois registros
salvos entre si, mostra a linha "Diferença", e nunca foi construído. A decisão mais delicada da peça — as
duas linhas terem **peso visual idêntico**, para que "Hoje" não pareça o novo valor do registro — existe
hoje apenas como um comentário no CSS, sem nenhum desenho por trás.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/compare-today.tsx` + `historico-page.css` (`.tf-compare`) + copy em
`messages.pt-br.ts` (`historico.compare*`).

Fechado (repouso):
- um botão fantasma com o texto **"Comparar com hoje"**, sozinho numa linha, logo abaixo da ficha técnica.
  → **problema**: ele fica órfão, longe das outras duas ações do documento, e o canvas do dono o coloca na
  fileira. Duas autoridades divergem; o desenho precisa resolver (ver Perguntas em aberto).
- se a origem do registro (produto ou kit) não existe mais, o botão **simplesmente não aparece** — sem
  aviso, sem botão desabilitado. Isso é decisão consciente (FR-503) e deve continuar.

Aberto (o botão some e vira um card no mesmo lugar):

| Ordem | Conteúdo | Texto literal hoje |
|---|---|---|
| 1 | legenda da base, dita **uma vez** para as duas linhas | "preço de varejo" **ou** "preço de atacado" |
| 2 | linha 1 — o congelado | "Cotado em 03/07/2026" · **R$ 30,90** |
| 3 | linha 2 — o vivo | "Hoje" · **R$ 61,80** |
| 4 | só offline | "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados." |
| 5 | só se o congelado é de um modelo aposentado | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 6 | a ressalva final, sempre | "Comparação informativa: este registro não muda. Para gravar o valor de hoje, use \"Recalcular hoje\"." |

Comportamento atual, verificado no código:
- as duas linhas usam a **mesma** classe, mesmo tamanho, mesmo peso; o valor vai à direita, alinhado por
  números tabulares. Isso é intencional e é a regra central da peça.
- **não existe diferença calculada** — nem número, nem seta, nem "subiu 12%". Decisão registrada: a
  aritmética de dinheiro mora no `pricing-core`, e dois números rotulados já respondem a pergunta.
- → **problema**: depois de aberto **não há como fechar**. Não existe X, "Fechar" nem seta; o card fica
  até o vendedor sair do registro.
- → **problema**: o estado "não deu para calcular" é um parágrafo mudo, cinza, sozinho dentro de um card —
  sem título, sem ícone, sem saída. O vendedor pediu uma resposta e recebeu um texto apagado.
- não há carregando: o cálculo é síncrono. Mas o gatilho **aparece atrasado**, quando o catálogo do
  vendedor termina de carregar — um pop-in que o desenho precisa prever.

## Conteúdo e dados reais
- **Valores**: sempre `R$ 1.234,56` (vírgula decimal, ponto de milhar), numerais tabulares. Faixa real de
  uma peça: `R$ 16,16` a `R$ 300,00`; um kit passa fácil de `R$ 1.000,00`. Desenhe também com
  **R$ 12.345,67** nas duas linhas para provar que a coluna aguenta.
- **Data**: `03/07/2026`, formatada com o fuso que o aparelho capturou no dia da cotação — a data faz parte
  da afirmação, não é detalhe de renderização.
- **Base**: exatamente uma das duas legendas ("preço de varejo" / "preço de atacado"), nunca as duas. Um
  orçamento de atacado é comparado com o atacado de hoje; misturar as bases inventaria um aumento que não
  aconteceu.
- **Modelo**: a versão citada na nota estrutural é literal do registro (ex.: `3.1.0`); a nota só existe
  para registros anteriores ao modelo 4.0.0.
- Nada aqui é editável, nada é opcional para o vendedor preencher: tudo é derivado.

## Estados obrigatórios
1. **Gatilho em repouso** — "Comparar com hoje", alvo ≥44px.
2. **Gatilho em foco / hover / pressionado** — foco visível medido contra o fundo real do card do registro.
3. **Gatilho ausente** — origem apagada: nada no lugar, sem buraco e sem explicação. Desenhe a fileira de
   ações sem ele para provar que não fica um vão.
4. **Aberto, subiu** — R$ 30,90 × R$ 61,80, pesos idênticos.
5. **Aberto, não mudou** — o **mesmo** número duas vezes, cada um com seu rótulo. Não colapse em uma linha:
   "não mudou" é uma resposta que o vendedor precisa VER.
6. **Aberto, offline** — mais a frase de catálogo salvo no aparelho (linha 4 da tabela), em texto completo,
   nunca truncada.
7. **Aberto, modelo aposentado** — mais o alerta informativo (linha 5), dentro do card.
8. **Não foi possível calcular** — "Não foi possível calcular o valor de hoje para este registro com o seu
   catálogo atual." O valor congelado **continua onde estava**, na ficha acima, e nunca é rerrotulado como
   "Hoje". Este estado precisa de desenho de verdade: tom, ícone e — se o dono aprovar — uma saída.
9. **Premium pausado** — o bloco **continua funcionando**: ler e comparar não é operação paga. Acima dele o
   registro já mostra "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium." Não desenhe cadeado, blur nem teaser aqui.
10. **Registro ainda não sincronizado** — o detalhe já carrega o alerta "Ainda não sincronizado" acima; a
    comparação funciona igual. Mostre a convivência dos dois blocos numa prancheta.

## Viewports
- **Mobile 390px** — o caso principal: o detalhe é uma página inteira e o card abre no fluxo, empurrando a
  fileira de ações para baixo. Prove que "Cotado em 03/07/2026" e **R$ 12.345,67** cabem na mesma linha, ou
  defina como quebram.
- **Desktop 1280px** — o registro vive no painel direito de um mestre-detalhe grudento (lista à esquerda),
  e nesse corte o painel é o mais estreito que existe (perto de 500px, com rolagem própria). É o teste
  duro da peça.
- **Desktop 1920px** — o painel fica largo; decida se as duas linhas continuam empilhadas ou ganham
  respiro, sem virar duas colunas que sugiram "antes → depois" com um vencedor.

## Regras que o desenho não pode quebrar
- **Peso idêntico nas duas linhas.** "Hoje" com destaque tipográfico, cor de acento ou tamanho maior
  transforma uma consulta informativa em "o novo valor do seu orçamento". É a mentira que esta peça existe
  para não contar.
- **Todo número diz o que é e QUANDO.** Nenhum total aparece sem rótulo e sem data/base.
- **Nunca imprimir um "Hoje" que não foi calculado hoje.** Se o cálculo falhou, é o estado 8 — jamais o
  número congelado com rótulo novo.
- **Sem diferença calculada** (número, percentual, seta, barra comparativa ou qualquer codificação visual
  de tamanho): isso é aritmética de dinheiro e não é desta superfície.
- **O registro não muda.** A ressalva final é obrigatória e vive em texto corrido de largura cheia — nunca
  em placeholder, tooltip, ou linha que possa ser cortada por reticências.
- **Falha de rede nunca vira "precisa de Premium"**, e Premium pausado nunca bloqueia a leitura.
- Alvos ≥44px; contraste do texto cinza (legendas e ressalva) medido contra o fundo real do card, que já
  está sobre o fundo da página — dois níveis de superfície.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: valores de 5 dígitos em coluna estreita já estouraram card neste projeto
  (E2) e já colidiram glifos num PDF (E4). Desenhe com o número grande, não com o bonito.
- **Frase honesta cortada**: em 016 uma frase honesta foi parar num placeholder e apareceu clipada. As
  frases dos estados 6, 7 e 8 são conteúdo, não decoração — elas nunca truncam.
- **Rolagem no eixo vertical dentro do painel desktop**: o painel direito já rola sozinho; um card que
  cresce (com alerta + duas notas) pode criar uma segunda barra de rolagem. Desenhe o caso mais alto
  possível (offline + modelo aposentado + ressalva) e veja onde ele termina.
- **Um bloco que abre e não fecha** vira estado permanente da tela; no desktop, com a lista ao lado, o
  vendedor troca de registro e não entende se aquilo continua aberto.
- **Alerta dentro de card dentro de painel**: três fundos empilhados apagam a hierarquia — o alerta
  informativo precisa continuar legível ali dentro.

## Entregável
Pranchetas, tema escuro (padrão) **e** tema claro, ambos completos:
1. 390px — fechado, no contexto: ficha técnica acima, fileira de ações abaixo.
2. 390px — aberto, caso "subiu" (R$ 30,90 × R$ 61,80).
3. 390px — aberto, caso "não mudou" (mesmo número duas vezes).
4. 390px — aberto, offline + modelo aposentado (o card mais alto que existe).
5. 390px — "não foi possível calcular".
6. 1280px — o painel direito do mestre-detalhe com o bloco aberto, no caso alto.
7. 1920px — o mesmo, com o painel largo.
8. Um recorte de estados do gatilho: repouso, hover, foco, pressionado.

Reutilize os primitivos existentes, sem criar novos: **`tf-btn--secondary`** para o gatilho (ou `ghost`, se
o dono decidir manter fora da fileira), **`tf-card`** para o painel, **`tf-tnum`** nos dois valores,
**`tf-alert` tom `info`** para a nota do modelo aposentado, e o estilo de legenda/hint já usado em
`tf-historico__meta` / `tf-historico__basis` para a base, a nota de offline e a ressalva final.

## Perguntas em aberto para o dono
1. **Onde fica o gatilho**: na fileira de ações como `tf-btn--secondary` (canvas, linha 315) ou solto e
   fantasma acima dela (código de hoje)? Na fileira ele ganha peso de ação — e esta não grava nada.
2. **Dá para fechar depois de aberto?** Hoje não. Se sim, o gatilho vira alternador ("Comparar com hoje" ↔
   o quê?) — e no desktop, ao trocar de registro na lista, ele volta fechado ou fica aberto?
3. **A recusa em mostrar a diferença vale também para o desenho?** Nada de número e percentual, isso está
   decidido — mas uma pista visual neutra (uma seta sem valor, uma cor de tendência) ainda é permitida ou
   também é proibida?
4. **O estado "não foi possível calcular" oferece alguma saída?** Explicar por quê (catálogo mudou, peça do
   kit incompleta) exigiria informação que a peça hoje não tem; oferecer "Recalcular hoje" ali seria mandar
   o vendedor para uma ação que grava.
5. **A ordem de leitura** deve ser sempre congelado-primeiro (cronológica, como hoje) ou hoje-primeiro (o
   que ele veio buscar)?

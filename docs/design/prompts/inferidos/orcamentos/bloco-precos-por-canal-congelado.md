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

- **Onde vive:** Dentro do registro congelado, entre a linha destacada do "Custo total" e o Card "FICHA TÉCNICA". Uma <h2> em caixa alta ("PREÇOS POR CANAL") seguida de um bloco por canal: o nome do marketplace em negrito ("Mercado Livre · Clássico", "Shopee") e, sob ele, até QUATRO linhas de preço com legenda dupla — "Preço de anúncio · varejo", "Recebido líquido · varejo", "Preço de anúncio · atacado", "Recebido líquido · atacado" — cada uma com o valor em negrito à direita. No lugar (ou ao lado) dos números podem aparecer três recados curtos em texto cinza pequeno, todos com a MESMA aparência entre si e igual a qualquer outra legenda da tela.
- **Como o vendedor chega:** Sem gesto: existe quando o cálculo original tinha marketplaces ligados. É onde o vendedor confere o que receberia líquido em cada canal naquele dia.
- **Vizinhança imediata:** Acima: o bloco DETALHAMENTO e a linha do Custo total. Abaixo: o Card da ficha técnica e, depois dele, o gatilho "Comparar com hoje".
- **Dados que chegam (e o que ela devolve):** Valores congelados, apenas formatados — nunca recalculados. Um preço nulo é ausente, nunca R$ 0,00. Os três recados de exceção: "sem comissão informada — este canal não teve preço" (substitui as quatro linhas: o canal fica, porque o vendedor DE FATO escolheu aquele marketplace); o erro gravado naquele canal, ecoado como texto; e, em kit, a contagem do rollup ("3 de 5 peças"). O nome do marketplace é traduzido quando conhecido, e o valor cru é fallback.
- **O que acontece depois:** Nada: é leitura pura. Estes números entram no PDF/CSV se o vendedor exportar, e são a base do que "Comparar com hoje" reprecifica.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Preços por canal dentro de um orçamento congelado

## O que desenhar
O cartão **"Preços por canal"** que aparece dentro do detalhe de um orçamento salvo (aba Orçamentos →
abrir um registro). É onde o vendedor confere, meses depois, quanto teria anunciado e quanto teria
**recebido líquido** em cada marketplace *no dia em que cotou*. Cada canal é um bloco com o nome do
marketplace e até **quatro linhas de dinheiro** (anúncio e líquido × varejo e atacado). Mas o mesmo
bloco também precisa contar três coisas que **não são preço**: um canal que não teve comissão
informada, um erro gravado naquele canal e, quando o orçamento é de um kit, quantas peças realmente
somaram naquele canal. Hoje essas três frases são visualmente idênticas entre si e idênticas a
qualquer legenda cinza da tela. Esse é o problema central a resolver.

## Por que este prompt existe
O protótipo de 2026-07-02 desenhou só o **caso feliz**: dois canais ("Mercado Livre · Clássico" e
"Shopee"), cada um com duas linhas — "anúncio" e "líquido" — e nada mais. O produto de hoje tem
**quatro linhas por canal** (o desdobramento varejo/atacado nunca foi desenhado) e três recados de
exceção criados em 2026-08 sem autoridade de desenho nenhuma. Uma IA decidiu que os três seriam
`tf-historico__meta` — a legenda cinza pequena, a mesma do rodapé da ficha técnica. Resultado: "sem
comissão informada — este canal não teve preço" tem exatamente o mesmo peso visual que "Data
registrada pelo seu aparelho", e fica lado a lado com canais que **têm** preço. É uma frase que
existe justamente para impedir uma leitura errada, vestida como rodapé.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro de um bloco de canal (arquivo de origem: `pages/historico/snapshot-detail-page.tsx`):

| # | Elemento | Texto/valor real | Observação |
|---|---|---|---|
| 1 | Título da seção | `Preços por canal` | caixa alta, 0.8125rem, cinza (`tf-historico__section`) |
| 2 | Nome do canal | `Mercado Livre`, `Shopee`, `Amazon`, `Outro`, ou `Canal` | negrito, tamanho de corpo |
| 3 | Linha 1 | `Preço para anunciar · Varejo` — **R$ 231,88** | rótulo à esquerda, valor à direita |
| 4 | Linha 2 | `Recebido líquido · Varejo` — **R$ 196,44** | |
| 5 | Linha 3 | `Preço para anunciar · Atacado` — **R$ 176,90** | |
| 6 | Linha 4 | `Recebido líquido · Atacado` — **R$ 149,20** | |
| 7 | Recado A | `sem comissão informada — este canal não teve preço` | **substitui** as 4 linhas |
| 8 | Recado B | o erro gravado naquele canal, ecoado literal (ex.: `Corrija os campos deste canal para ver os preços.`) | pode coexistir com as 4 linhas |
| 9 | Recado C | `3 de 5 peças` | só em kit; convive com as 4 linhas |

→ **Problema 1:** os itens 7, 8 e 9 são hoje o MESMO estilo (cinza, 0.8125rem). Um é uma recusa
honesta, o outro é uma falha, o terceiro é uma informação neutra de composição. Três naturezas, uma
aparência.
→ **Problema 2:** a legenda dupla `Preço para anunciar · Atacado` é longa; em 390px, com um valor de
5 dígitos, ela e o dinheiro disputam a mesma linha (o valor é empurrado para a direita com
`margin-inline-start:auto`, tabular-nums, e não quebra).
→ **Problema 3:** o recado A começa em minúscula e no meio da frase ("sem comissão…"), o que reforça
a leitura de rodapé em vez de recado.
→ **Problema 4:** com 3 ou 4 canais salvos, o cartão vira uma coluna longa de blocos indistintos —
não há separação visual entre um canal e o seguinte, só um respiro de 4px.

## Conteúdo e dados reais
- **Nome do canal**: vem gravado; quando o marketplace não foi informado, o texto é literalmente
  `Canal`. Nomes conhecidos: `Mercado Livre`, `Shopee`, `Amazon`, `Outro`. Um registro antigo pode
  trazer texto livre que o app não conhece e mostra cru — desenhe supondo nome de até ~28 caracteres.
- **Dinheiro**: string congelada, apenas formatada — `R$ 1.234,56`. Faixa plausível: `R$ 8,90` a
  `R$ 4.780,00`. Use `R$ 231,88`, `R$ 196,44`, `R$ 176,90`, `R$ 149,20` nas pranchetas.
- **Nenhuma das quatro linhas é obrigatória.** Um registro pode ter só varejo (o mais comum), só
  atacado, ou só anúncio sem líquido. Linha ausente **não é R$ 0,00** — ela simplesmente não existe.
  Desenhe pelo menos uma prancheta com um canal de duas linhas ao lado de um de quatro.
- **Contagem de kit**: dois inteiros — `{n} de {total} peças` (ex.: `3 de 5 peças`). Existe uma frase
  irmã já escrita no app e **não exibida aqui**: `2 sem este canal`.
- **Nada nesse cartão é recalculado.** Todo número é um valor gravado no dia da cotação; o cartão
  vive logo abaixo de "Detalhamento" / "Custo total" e logo acima de "Ficha técnica".

## Estados obrigatórios
1. **Repouso completo** — 1 canal com as quatro linhas; e uma variação com 3 canais empilhados.
2. **Canal parcial** — só `Preço para anunciar · Varejo` e `Recebido líquido · Varejo`. Não pode
   parecer quebrado nem sugerir que faltou algo.
3. **Canal sem comissão** — nenhum número, só `sem comissão informada — este canal não teve preço`.
   O nome do canal continua ali (o vendedor DE FATO escolheu aquele marketplace). Precisa ser
   inconfundível ao lado de um canal com preço.
4. **Canal com erro gravado** — o texto do erro ecoado como está, podendo aparecer **junto** com as
   quatro linhas (erro e preço não se excluem no registro).
5. **Canal de kit (rollup)** — as quatro linhas mais `3 de 5 peças`. Mostre também o caso `5 de 5
   peças`, que é neutro e não deve gritar.
6. **Erro + sem comissão no mesmo canal** — o pior caso combinado; desenhe.
7. **Premium pausado (`lapsed`)** — o registro continua **totalmente legível**; o cartão não muda em
   nada. Desenhe-o dentro da tela com a faixa de plano pausado no topo, para provar que ele não é
   escondido nem esmaecido.
8. **Sem conexão** — igual ao repouso. O valor é local e congelado: offline não degrada nada aqui e
   **não pode** ganhar aviso, tom cinza ou selo de "desatualizado".
9. **Carregando / erro de leitura / registro inexistente** — pertencem à página inteira, não ao
   cartão; não desenhe variação própria, só saiba que o cartão não aparece nesses casos.
10. **Sem estado interativo** — hoje não há botão, link ou campo dentro do cartão. Se o seu desenho
    introduzir algum alvo tocável (ex.: um "?" que explica "recebido líquido"), ele precisa de
    repouso/hover/foco/pressionado e ≥44px, e isso vira decisão nova a marcar como proposta.

## Viewports
- **390px (mobile)** — obrigatório: é a rota `/historico/$id` em página inteira e a leitura mais
  frequente. É onde a legenda dupla + dinheiro de 5 dígitos colidem.
- **1280px (desktop)** — o detalhe vira a **coluna direita** de um mestre-detalhe (largura útil de
  ~560px, sem cabeçalho de página próprio). O cartão é o mesmo conteúdo em menos largura do que se
  imagina; não assuma folga.
- **1920px** — no protótipo o cartão fica em uma coluna à direita, ao lado de "Detalhamento" em duas
  colunas. Mostre como as quatro linhas e os recados se comportam nessa largura maior sem virar uma
  linha esticada com um oceano entre rótulo e valor.

## Regras que o desenho não pode quebrar
- **Ausência nunca vira zero.** Nenhuma linha fantasma com `R$ 0,00`, nenhum traço `—` no lugar de um
  valor que não foi gravado (o `—` só existe na lista de peças do kit, não aqui).
- **Nada é recalculado.** O cartão não pode sugerir "valor de hoje", nem ganhar botão de atualizar;
  quem faz isso é "Recalcular hoje", fora do cartão.
- **Frase honesta nunca dentro de placeholder ou truncada.** As três frases de exceção vivem em
  elementos de largura cheia e quebram em várias linhas; jamais reticências.
- **Falha de rede não é premium, e premium pausado não apaga leitura.**
- **Contraste medido contra o fundo real do cartão**, nos dois temas — a legenda cinza atual
  (`--text-muted` em 0.8125rem) é justamente o que apaga os três recados.
- **A hierarquia tem que separar dinheiro / recusa / falha / composição.** Quatro naturezas, no
  máximo três tratamentos visuais; nenhum deles pode ser "igual ao rodapé".

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado.** Já custou 100,5px de estouro com botão nascendo fora da
  viewport. Em 390px, `Preço para anunciar · Atacado` + `R$ 1.234,56` é o par mais perigoso desta
  peça — desenhe com o valor mais largo, não com o mais bonito.
- **Texto ocluso passa em teste.** Um recado escondido atrás de outro elemento continua "visível"
  para qualquer asserção de texto; a única prova é a imagem.
- **Placeholder que corta a frase honesta** — já aconteceu: frases de honestidade em campo estreito
  perdem o final. Por isso os recados A/B/C nunca podem virar sufixo de linha.
- **Legenda muda = legenda ignorada.** O mesmo cinza para "aviso" e para "nota de rodapé" já foi
  apontado em homologação em outras telas deste app.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. `390 · repouso` — 2 canais, um com 4 linhas e um com 2.
2. `390 · exceções` — um canal sem comissão, um canal com erro, um canal de kit com `3 de 5 peças`,
   empilhados no mesmo cartão (é assim que o vendedor encontra na vida real).
3. `390 · valor extremo` — `R$ 12.345,67` nas quatro linhas com legenda dupla.
4. `1280 · coluna direita (~560px)` — repouso + um caso de exceção.
5. `1920 · duas colunas` — o cartão ao lado de "Detalhamento".
6. `Anatomia` — a escala visual proposta: valor, rótulo, recusa, falha, composição, lado a lado com
   uma legenda comum, para provar que se distinguem.

Reutilize os primitivos existentes: o contêiner é o **card do DS** (`tf-card`); o título usa o estilo
de seção já existente (`tf-historico__section`); as linhas de dinheiro reaproveitam a linha
rótulo-valor já usada no "Detalhamento" (`tf-brow` / `tf-historico__piece`, com numerais tabulares).
Para a recusa e para o erro, prefira **tons já existentes no DS** (`tf-alert` info/danger, ou selo
`tf-badge`) a inventar um estilo novo — e diga qual escolheu e por quê. Não crie primitivo novo.

## Perguntas em aberto para o dono
1. Um canal **sem comissão** deve manter o nome com o mesmo peso dos canais que têm preço, ou o bloco
   inteiro deve ser rebaixado/marcado (o vendedor escolheu aquele canal, mas não há preço nenhum)?
2. A contagem de kit deve dizer também o que aconteceu com as peças restantes? A frase `2 sem este
   canal` já está escrita no app e **não é mostrada** neste cartão — é omissão a corrigir ou decisão?
3. Existe o caso `0 de 5 peças` (nenhuma peça somou naquele canal)? Se sim, isso é um canal sem
   preço, um erro, ou ainda outra coisa?
4. Varejo e atacado devem aparecer **sempre** juntos, ou o desenho deve dar destaque ao par que
   corresponde à base do orçamento (o registro sabe se foi cotado em varejo ou em atacado) e recolher
   o outro?

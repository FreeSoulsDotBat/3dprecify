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

- **Onde vive:** Dentro do registro congelado, logo abaixo da legenda "Valores congelados em {data}" (e da eventual legenda de reaproveitamento) e logo acima do bloco "DETALHAMENTO". É uma <h2> pequena em caixa alta ("PEÇAS DO KIT") seguida de uma lista sem separador nenhum entre as linhas — cada peça é uma linha só, com baseline compartilhada: nome capturado da peça à esquerda, a contagem em cinza logo depois ("3 un" — nunca "3×", porque o total já vem multiplicado) e o total em negrito empurrado para a direita.
- **Como o vendedor chega:** Sem gesto: aparece só quando o registro é de um KIT (o que se anuncia desde o card da lista, "Kit · {n} peças"). O vendedor rola o registro para mostrar ao cliente o que compõe o preço.
- **Vizinhança imediata:** Imediatamente acima, a legenda cinza dos valores congelados; imediatamente abaixo, o bloco DETALHAMENTO com as linhas de custo (material, energia, máquina, falhas, acabamento, mão de obra e os "outros custos" com os nomes que o vendedor digitou), e depois a linha destacada do Custo total.
- **Dados que chegam (e o que ela devolve):** Os nomes vêm CAPTURADOS no dia da cotação — um produto renomeado depois não reescreve o orçamento antigo, e uma peça sem nome cai no texto "Cálculo avulso". Cada peça é exibida na MESMA base do registro (um kit cotado em atacado itemiza em atacado). Uma peça sem valor para essa base mostra um travessão. Nada aqui trunca — ao contrário do rótulo do card na lista.
- **O que acontece depois:** Nada: é leitura. As linhas não são clicáveis e não levam ao kit — o caminho de volta à origem, quando ela ainda existe, mora mais abaixo, no Card da ficha técnica ("Abrir kit").

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Bloco "Peças do kit" dentro do orçamento congelado

## O que desenhar

A lista itemizada das peças de um kit dentro do **detalhe de um registro da aba Orçamentos** — o
documento congelado e imutável (ADR-0019), aquele que o vendedor abre na frente do cliente para provar
o que cobrou e quando. O bloco só existe quando o registro é de um kit; um registro de peça única não
o tem. Cada linha é uma peça do kit **como ela foi capturada no dia**: o nome que ela tinha então, a
quantidade e o valor daquela peça já multiplicado pela quantidade. É a prova itemizada de "por que o
total deu R$ 1.348,00" — e é a única parte do documento em que o cliente confere item a item.

## Por que este prompt existe

O bloco nunca foi desenhado. O protótipo é de 2026-07-02, **anterior ao próprio conceito de kit** (E3
chegou em 2026-07-11), e o canvas do dono (018) foi verificado inteiro: a aba Orçamentos vai do card da
alegação direto para um grid de duas colunas com "Detalhamento" à esquerda e "Preços por canal" +
"Ficha técnica" à direita — **não há bloco de peças em lugar nenhum**, o registro exemplar é peça
única. Resta uma linha de ASCII em `ux-history.md` §3 (`Vaso G  3×  R$ 135,00`), e até ela foi
contrariada depois: a troca de "3×" por "3 un" veio de um comentário em revisão de código, não de
desenho. E a homologação **F11b-001 (severidade Alto, bloqueia provisionamento)** já mediu o preço
dessa ausência neste bloco exato — ver Armadilhas.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/snapshot-detail-page.tsx` (função `KitLines`),
`historico-page.css` (`.tf-historico__piece`, `.tf-historico__qty`, `.tf-historico__section`) e
`apps/web/src/shared/i18n/messages.pt-br.ts` (`historico.*`).

Forma atual: um título `<h2>` em **caixa alta, 13px, cinza, com letter-spacing** — "PEÇAS DO KIT" —
e, abaixo, uma pilha de linhas de 3 colunas com `gap` de 4px entre elas, **sem nenhum separador**:

| Coluna | Conteúdo | Comportamento atual |
|---|---|---|
| esquerda | nome capturado da peça — ex.: "Suporte Articulado para Monitor Duplo" | cor de corpo; **não trunca** (não há ellipsis nesta classe, ao contrário do rótulo do card da lista) |
| meio | quantidade: `"{n} un"` → **"3 un"** | cinza `--text-muted`, algarismos tabulares |
| direita | valor total da peça: **"R$ 405,00"** | `<strong>` empurrado por `margin-inline-start:auto`, tabular; **"—"** quando não há valor |

Vizinhança real de um registro de KIT, na ordem exata da tela: badge de sincronização (se ≠ sincronizado)
→ card da alegação ("Cotado em 12/08/2026 às 14:32", "Valor cotado **R$ 1.348,00**", "preço de varejo",
"Validade da proposta: 15 dias") → banner de premium pausado (quando for o caso) → ações de renomear/
excluir → "Valores congelados em 12/08/2026" → **PEÇAS DO KIT** → "Custo total R$ 981,40" → "PREÇOS POR
CANAL" → "FICHA TÉCNICA" → "Comparar com hoje" → [Recalcular hoje] [Exportar].

Problemas a resolver no desenho:

- → **Um kit de 8 ou 11 peças vira um bloco de texto contínuo.** `gap: 4px`, zero separador, zero
  zebra, zero respiro — enquanto o bloco vizinho ("Detalhamento") usa `tf-brow`, que tem `min-height:
  40px`, `padding` vertical e **borda entre linhas**. Duas listas coladas na mesma tela, com dois
  ritmos diferentes, sem regra que explique por quê.
- → **A coluna do valor é estreita demais e quebra o dinheiro em duas linhas** (medido: 81px). Ver
  Armadilhas.
- → **Nome longo não trunca e come a coluna do valor**, empurrando o `<strong>` para fora do lugar; a
  quantidade "3 un" chega a partir em `3` / `un`.
- → **A leitura "quantidade × preço" é ambígua justamente onde não pode ser.** O valor já vem
  multiplicado, então "3 un … R$ 405,00" não é preço unitário — mas nada na linha diz isso, e o
  cliente que multiplicar de novo chega a R$ 1.215,00.
- → **O bloco não diz a sua base.** As peças são itemizadas na base da manchete (um kit cotado em
  atacado itemiza em atacado); "preço de varejo" está lá em cima, no card da alegação, longe daqui.
- → **Num registro de kit, "Detalhamento" não existe** (o detalhamento gravado é de peça única). Então
  logo abaixo das peças aparece um "Custo total" **sozinho**, com a borda superior de 2px que a classe
  de total desenha — um total órfão, sem a lista que ele deveria fechar.
- → **`tf-historico__qty` significa duas coisas na mesma tela**: aqui é a quantidade ("3 un"); em
  "Preços por canal" é o rótulo da linha ("anúncio", "líquido").

## Conteúdo e dados reais

- **Nome** (texto, opcional): o nome **capturado**, nunca consultado hoje — renomear o produto no
  catálogo não reescreve um orçamento passado. Quando a peça foi um cálculo sem produto, o texto
  literal é **"Cálculo avulso"**.
- **Quantidade** (inteiro ≥ 1): formatada como `"{n} un"` → "1 un", "3 un", "12 un". Nunca "3×".
- **Valor** (dinheiro `R$ 1.234,56`): já multiplicado pela quantidade. Faixa real medida em produção
  de homologação: de **R$ 16,16** a **R$ 70.867,77** — e valores acima de mil são comuns num kit
  (R$ 1.107,72 · R$ 2.024,96 · R$ 3.471,12 · R$ 4.339,30). **"—"** quando o documento não guardou
  valor para a base cotada; nunca "R$ 0,00" (ausente ≠ zero, FR-507).
- Quantidade de linhas: de 1 a mais de 11 (medido: 11 peças num registro real).
- O documento guarda por peça, mas **não mostra hoje**: o detalhamento por unidade e as entradas
  resolvidas. Não invente esses números na prancheta; se propuser expor algo, marque como proposta.

## Estados obrigatórios

- **Repouso, kit curto** (3 peças, nomes curtos, todos com valor).
- **Repouso, kit longo** (11 peças) — o estado que prova o ritmo da lista.
- **Nome longo** (≥ 45 caracteres, sem espaços em parte dele) ao lado de **R$ 70.867,77**.
- **Peça sem nome**: a linha mostra "Cálculo avulso" com a mesma dignidade das outras.
- **Peça sem valor para a base cotada**: "—" no lugar do dinheiro.
- **Base atacado**: o mesmo bloco quando o kit foi cotado em atacado (a base precisa estar dita).
- **Ausente**: registro de peça única — o bloco não existe, e nada ocupa o seu lugar.
- **Premium pausado**: o bloco continua **inteiro e legível** — a pausa só suspende escrita; nada aqui
  some, escurece ou ganha cadeado.
- **Offline / registro pendente**: idêntico, sem nenhuma degradação — o documento contém os seus
  valores e não referencia nada, então nada nele pode apodrecer.
- **Carregando** e **erro de leitura**: são da página inteira, não deste bloco (spinner; ou "Não foi
  possível carregar seus orçamentos." + [Tentar novamente]). Desenhe apenas o que sobra no lugar.
- **Sem estado interativo**: hoje nenhuma linha é clicável, e isso é deliberado — não há hover, foco
  nem pressionado a desenhar. Se propuser um alvo tocável, ele é ≥ 44px e vai para Perguntas.

## Viewports

- **Mobile 390px** — obrigatório, e é onde o defeito medido dói mais: a 360px, 7 das 11 peças
  quebraram o valor em duas linhas. É a largura em que o vendedor mostra o orçamento ao cliente.
- **Desktop 1280px** — o detalhe é a **coluna direita** de um mestre-detalhe (018/US2): sem moldura de
  página, sem "Voltar", sem segundo `<h1>`, com rolagem própria e largura menor que a da janela. É a
  largura que decide se o bloco entra no grid de duas colunas do canvas ou atravessa as duas.
- **Desktop 1920px** — a mesma composição com folga; mostre o que fazer com o espaço extra sem esticar
  a coluna do dinheiro até desgrudar do nome.

## Regras que o desenho não pode quebrar

- **Zero recálculo**: todo número aqui é uma string gravada, apenas formatada. O desenho não pode
  sugerir soma, média ou "preço unitário" — esse número não existe no documento.
- **Ausente não é zero**: "—" é a única forma de dizer que não há valor. Nunca "R$ 0,00".
- **Nome capturado, não nome de hoje**: nada no bloco pode parecer link vivo para o catálogo. A
  regra das duas prateleiras é o produto inteiro aqui.
- **`R$` e o número são uma coisa só.** A copy do projeto já escreveu isso: *"Numa linha de PREÇO,
  separar o símbolo do valor é a única quebra que não se permite"*.
- **Leitura sem permissão**: nenhum estado de assinatura esconde, borra ou trunca este bloco.
- Contraste medido contra o fundo real do card (claro e escuro), alvos ≥ 44px se houver algum.

## Armadilhas já pagas neste projeto

- **F11b-001, severidade Alto, bloqueava provisionamento, neste bloco exato**: a coluna do valor mede
  **81px** e `R$ 70.867,77` renderiza com o "R$" numa linha e "70.867,77" na outra — em 1440px, 390px
  e 360px, sem transbordo (`scrollWidth === clientWidth`). **Nenhuma asserção de texto vê isso**:
  `toContainText("R$ 70.867,77")` passa. Só a imagem e a geometria pegam.
- Texto ocluso ou transbordado passa em teste de visibilidade — layout se homologa com caixas.
- Nome sem espaços (um código colado) não tem onde quebrar: 300 caracteres já geraram 2.100px de
  rolagem horizontal noutro bloco desta mesma família, e o culpado era um nó de texto pintando fora
  da caixa, invisível a qualquer medida de elemento.
- Frase honesta nunca mora em placeholder nem em texto cortado — se a base cotada ou o "já
  multiplicado" for dito, é em elemento de largura inteira.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como igual**:

1. Mobile 390px — kit de 3 peças (repouso).
2. Mobile 390px — kit de 11 peças com nome longo, valor de R$ 70.867,77, uma peça "Cálculo avulso" e
   uma com "—". É a prancheta que resolve o defeito medido.
3. Desktop 1280px — o bloco dentro da coluna direita do mestre-detalhe, mostrando a decisão de grid
   (uma coluna cheia ou metade) e a relação com o "Custo total" órfão logo abaixo.
4. Desktop 1920px — a mesma composição com folga.
5. Uma tira comparativa: a linha de peça ao lado de uma linha `tf-brow` de "Detalhamento", para
   justificar por que os dois ritmos são iguais ou por que são diferentes.

Reutilize os primitivos existentes em vez de criar novos: o título do bloco é o mesmo
`tf-historico__section` dos blocos vizinhos ("Detalhamento", "Preços por canal", "Ficha técnica"); a
linha de peça deve ser resolvida **ou** aproximando-a de `tf-brow` (rótulo + sub-rótulo + valor
tabular, com borda entre linhas) **ou** justificando por escrito por que ela permanece mais compacta;
o dinheiro usa a fonte numérica tabular do sistema; o card que abriga o bloco é `tf-card`. Entregue
também os valores de espaçamento, largura mínima da coluna de dinheiro e a regra de truncamento (ou de
quebra) do nome — são exatamente os três números que faltaram.

## Perguntas em aberto para o dono

1. **A base cotada aparece no bloco?** Hoje "preço de varejo/atacado" só é dito no card da alegação, e
   as peças são itemizadas nessa base sem repeti-la. Vira sub-rótulo do título ("PEÇAS DO KIT · preço
   de varejo"), legenda de rodapé, ou continua implícita?
2. **Diz-se que o valor já está multiplicado?** Uma frase curta ("valores já multiplicados pela
   quantidade") elimina a ambiguidade, mas acrescenta ruído a um documento que o cliente lê. Vale?
3. **O bloco ganha uma linha de soma das peças?** Hoje ele termina sem total próprio, e o "Custo
   total" logo abaixo é outra coisa (custo, não preço) — dois números perto que não se somam.
4. **Um kit longo (11+ peças) rola inteiro ou colapsa** ("ver todas as 11 peças")? No desktop a
   coluna já tem rolagem própria; no mobile, 11 linhas empurram o resto do documento para longe.
5. **Nome longo: trunca com reticências (e revela como?) ou quebra em duas linhas?** As duas escolhas
   são defensáveis e mudam a forma da linha inteira — mas num documento imutável, truncar esconde
   informação que ninguém pode mais editar.
6. **A peça deve poder abrir o produto de origem?** Hoje não abre, e a regra das duas prateleiras
   sugere que não deve; mas o vendedor pode querer ir do item ao catálogo.

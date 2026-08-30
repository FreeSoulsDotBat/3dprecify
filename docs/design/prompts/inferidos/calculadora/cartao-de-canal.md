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

## O mapa funcional de Calculadora e precificação

### A área "Calcular" (aba 1, rota `/calcular`)

**Como o vendedor chega.** `/calcular` é a porta do produto: a raiz `/` redireciona para cá e a aba é a
primeira do menu (`Calcular · Catálogo · Kits · Orçamentos · Conta` — no código: `/calcular`, `/catalogo`,
`/kits`, `/historico`, `/conta`). É a **única rota pública sem nenhum portão**: renderiza para anônimo,
grátis, Premium, online e offline. O menu é barra inferior até 425px e barra lateral acima disso (rail de
76px abaixo de 600px e a partir de 1280px por escolha do vendedor).

**O que ele vem fazer.** Digitar os custos de uma peça impressa e ler dois preços sugeridos (varejo e
atacado), com a conta aberta item a item. É a única tela do app que calcula preço a partir de campos
crus — e ela é **grátis e ilimitada**.

**Rotas da área.** Uma só: `/calcular`. Não há sub-rota; tudo o mais é folha/diálogo por cima
(a folha "Meus cenários", a folha de salvar cenário, a folha de gravar no histórico). O mesmo formulário
é *reusado* fora da área — a página de produto (`/catalogo?produto=…`) e o editor de linha de kit
(`/kits`) montam `CostsSection`, `FieldGroup`, `OtherCostsSection`, `MarketplaceSection`, `PriceResults`,
`TimeHmField` e `MachineCostFields` exatamente iguais.

**Layout.** Coluna única até 1023px, na ordem em que está escrito. A partir de `min-width:1024px` a
página sobe de 460px para 1120px e vira **duas colunas** (`.tf-calc-grid`) com um **rodapé de largura
total** (`.tf-calc-footer`, filhos capados em 720px e centrados) que carrega o resultado inteiro.

**O que a área guarda.** Nada por si só. O formulário vive em memória (React Hook Form); recarregar
perde tudo — e por isso existe um diálogo de aviso de saída quando há algo digitado. Persistir é sempre
uma ação Premium **para fora** da área: "Salvar cenário" (simulação) e "Salvar no histórico" (orçamento
congelado). O que a área lê de fora: o **catálogo de tarifas** (servido → cache local → semente
embutida, nunca bloqueia), o **entitlement** do servidor (`active` / `none` / `lapsed`), e as listas de
**filamentos e impressoras** do catálogo Premium (cache local por uid, respondem offline).

**Quem calcula.** `pricing-core`, no aparelho, sempre. O servidor nunca recalcula. Offline os preços
saem iguais; o que falha é só a atualização de tarifas e a escrita.

**O que a área alimenta depois.** Um cálculo válido vira (a) uma **simulação salva** — reabri-la traz a
Calcular preenchida de volta, com barra de contexto e selo de alterações não salvas; (b) um **orçamento
congelado** no Histórico (escrita offline vai para a fila/outbox e drena depois). No sentido inverso, o
Catálogo alimenta a Calcular pelo bloco "Usar do catálogo", e um kit reaberto como base traz um resumo
somente-leitura no lugar da conta escalar.

**Como muda por estado.**
- **Grátis / deslogado** — todos os custos, markup e os dois preços funcionam. A seção Marketplace vira
  um portão: chave desligada e desabilitada + "Vender em marketplaces faz parte do Premium." + teaser
  centrado, ocupando as **duas colunas**; "Outros custos" migra da esquerda para a direita para
  compensar. Some "Usar do catálogo" (vira um cartão de teaser com botão desabilitado) e somem os dois
  botões de gravar. "Meus cenários" continua visível para todos — é a porta honesta.
- **Premium ativo** — marketplace ligável, canais repetíveis com tarifas pré-preenchidas pelo catálogo,
  "Preços por canal" na cauda do detalhamento, e os dois botões de gravar no rodapé.
- **Premium pausado (lapsed)** — a Calcular se comporta como grátis para OFERECER (só `active` habilita);
  o que já foi salvo continua legível pela folha "Meus cenários", que exibe seu próprio aviso de plano.
- **Offline** — cálculo intacto; o selo de cada canal passa a dizer "referência embutida (offline)" e
  pode acusar "desatualizado"; um aviso não-bloqueante com "Tentar de novo" aparece no topo da lista de
  canais; gravar vai para a fila.
- **Sessão expirada** — faixa de sessão no topo do shell ("Entrar de novo"); as leituras Premium falham
  e o bloco "Usar do catálogo" pode cair no cartão de erro com "Tentar de novo"; a conta continua sendo
  feita normalmente.

## O ponto exato de inserção desta peça

- **Onde vive:** Dentro da seção Marketplace (coluna direita), um Card por canal, empilhados entre a chave mestra e o botão 'Adicionar canal'. O primeiro nasce sozinho já com Mercado Livre.
- **Como o vendedor chega:** O vendedor liga a chave 'Incluir marketplaces no preço' e o primeiro cartão já está lá; 'Adicionar canal' acrescenta os seguintes ao fim da pilha.
- **Vizinhança imediata:** Dentro do Card, ordem fixa e condicional: (1) linha `flex items-end` com o select 'Marketplace' ocupando o resto da largura e um botão fantasma '✕' à direita; (2) select 'Modalidade'; (3) o seletor de categoria; (4) select 'Você vende como'; (5) select 'mais de 450 pedidos?' — só quando CPF; (6) grade de duas colunas com até 4 campos de taxa (Comissão · Taxa fixa · Comissão mínima/item · Frete); (7) a legenda de faixa + regra da taxa fixa; (8) a legenda de subsídio de frete; (9) as chaves de taxa opcional; (10) uma linha `flex-wrap` com até 3 selos; (11) os dois avisos da Shopee. Acima do primeiro cartão: a chave mestra ou o alerta de falha de atualização; abaixo do último: 'Adicionar canal'.
- **Dados que chegam (e o que ela devolve):** Quais dos onze blocos existem é decidido pelo catálogo, marketplace a marketplace (o 'plano de campos'). Trocar o marketplace zera modalidade, categoria, perfil e as taxas que o novo plano não mostra; um campo que já tem valor continua visível mesmo fora do plano, para poder ser apagado.
- **O que acontece depois:** Cada cartão produz um bloco correspondente em 'Preços por canal', no rodapé. Um cartão com erro não derruba os irmãos — ele exibe sua própria frase lá embaixo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Cartão de um canal de venda (marketplace) na aba Calcular

## O que desenhar
O bloco editável de UM canal de venda dentro da seção "Marketplaces" da aba **Calcular**. Cada cartão diz em qual marketplace o vendedor pretende anunciar esta peça e quais taxas se aplicam ali; o preço do anúncio e o líquido saem depois, em outro cartão ("Como chegamos no preço"). Quem usa é o vendedor de peças 3D, no meio do cálculo, normalmente comparando 2 ou 3 canais lado a lado — os cartões empilham verticalmente e um botão **"Adicionar canal"** cria o próximo. É a peça mais densa e mais variável do produto: dependendo do marketplace escolhido no primeiro select, o mesmo cartão vai de ~4 a ~11 blocos de conteúdo.

## Por que este prompt existe
O cartão nunca foi desenhado. A auditoria classificou a autoridade como **NENHUMA** e o verificador confirmou: o protótipo de 2026-07-02 não tem "cartão de canal" — tem dois campos soltos dentro de uma colapsável (§E4); a auditoria do protótipo não cita canais em nenhum dos 16 achados; o `.design-import` (32 primitivos + 6 esqueletos) não tem componente de slot; e o canvas 018 (desktop) não cobre a aba Calcular. Cada bloco do código cita um FR ou um achado de homologação como origem — **nenhum cita desenho**. O que foi inferido por IA: a ORDEM dos onze blocos, o que acontece visualmente quando um canal mostra 3 blocos e o de baixo mostra 11, se um cartão deveria poder recolher/resumir quando há vários, e onde mora o remover — hoje um "✕" cru colado ao lado do select de marketplace.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro de um `Card` (padding md, empilhamento vertical com gap uniforme). Os blocos marcados "condicional" só aparecem para alguns marketplaces:

| # | Bloco | Aparece quando |
|---|---|---|
| 1 | Linha `flex items-end`: select **"Marketplace"** (ocupa a largura) + botão fantasma **"✕"** (aria-label "Remover canal") | sempre |
| 2 | Select **"Modalidade"** (Clássico / Premium / Profissional / Individual) | ML e Amazon |
| 3 | Seletor de categoria: **"Categoria do anúncio (opcional)"**, dica "A comissão muda conforme a categoria.", busca "Busque pelo produto…" | ML e Amazon |
| 4 | Select **"Você vende como"** (placeholder "Selecione" · "Pessoa física (CPF)" / "Pessoa jurídica (CNPJ)") | Shopee |
| 5 | Select **"Mais de 450 pedidos nos últimos 90 dias?"** ("Sim"/"Não") | Shopee **e** só se a resposta 4 for CPF |
| 6 | Grade 1fr 1fr com até 4 campos de taxa (ver abaixo) | sempre, quantidade variável |
| 7 | Legenda: "Tabela por faixa de preço — valores da faixa do seu anúncio." + "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já calculado." | tarifa bandada |
| 8 | Legenda de subsídio de frete (texto completo em "Conteúdo") | Shopee com anúncio já calculado |
| 9 | Checkbox de sobretaxa opcional (hoje "Manuseio volumoso", rótulo/valor vindos do catálogo) + legenda longa | Shopee |
| 10 | Linha `flex-wrap` com até 3 selos (Badge): selo de procedência, "estimativa de frete", "Taxa fixa: {fonte} · vigente desde {data}" | quando há resultado |
| 11 | Dois avisos Shopee em caixa (Alert): "A Shopee não publica a fórmula completa desta taxa" (condicional) e "Frete aferido pode gerar cobrança retroativa" (sempre na Shopee) | Shopee |

→ **Problema 1:** o "✕" é um glifo cru, sem área de toque desenhada, colado à direita de um select alto — é a única coisa destrutiva do cartão e a menos desenhada.
→ **Problema 2:** o cartão da Shopee tem ~3× a altura do cartão de "Outro". Não existe regra de desenho para essa variação, e não existe hierarquia interna: campos, legendas, selos e avisos leem todos com o mesmo peso, empilhados no mesmo gap.
→ **Problema 3:** com 3 canais abertos, o vendedor rola muito e perde de vista qual cartão está editando — não há cabeçalho fixo, resumo ou estado recolhido.
→ **Problema 4:** os selos de honestidade (bloco 10) — que são a razão de o número ser confiável — ficam no fim, como o elemento de menor peso visual.

## Conteúdo e dados reais
Os 4 campos de taxa, na ordem canônica fixa (a grade nunca reordena, só filtra):

| Rótulo | Unidade | Exemplo real | Obrigatório? |
|---|---|---|---|
| **Comissão** | % | `15` (marketplaces cobram tipicamente 10–20%) | opcional; sem ela o preço do canal não sai |
| **Taxa fixa** | R$ | `R$ 2,00` (Amazon Individual) | opcional |
| **Comissão mínima/item** | R$ | `R$ 6,50` | opcional |
| **Frete** | R$ | `R$ 12,00` — "Descontado do valor recebido (não é embutido no anúncio)." | opcional |

- Todo campo de taxa é marcado **opcional** e mostra, como *placeholder*, o valor que o catálogo está aplicando de verdade (ex.: `15` em Comissão, `2,00` em Taxa fixa). Placeholder = "não digitado por você"; um valor digitado vira "ajustado por você" no selo.
- Aviso in-loco no campo Comissão (abaixo do rótulo, não é erro): "Confira a comissão: 0,12%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."
- Legenda de frete Shopee (bloco 8), texto integral: "A Shopee oferece cupons de frete grátis (até R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar para você, se houver." seguida de "Fonte: Central do Vendedor Shopee, vigente desde 12/06/2026."
- Legenda da sobretaxa (bloco 9): "R$ 50,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido)." → é longa de propósito e **não pode ser truncada**.
- Selos possíveis (bloco 10): "Referência · atualizada em 06/08/2026", "referência embutida (offline)", "pode estar desatualizada", "ajustado por você", "sem referência — informe as taxas", "categoria não informada — usando a maior alíquota da tabela", "estimativa de frete", "Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/07/2026".
- Contexto numérico da tela: a semente calcula custo R$ 16,16, varejo R$ 24,24 e atacado R$ 21,01 — os valores de anúncio ficam nessa ordem de grandeza, mas a Comissão mínima e o Frete podem chegar a `R$ 1.234,56` numa peça grande (máscara de milhar aplicada no blur).

## Estados obrigatórios
- **Repouso** — o cartão de "Outro" (4 campos, nada mais) e o cartão da Shopee (tudo). Desenhe **os dois**, lado a lado, para que a regra de variação fique explícita.
- **Foco / hover / pressionado** nos selects, campos, checkbox e no "✕".
- **Campo com aviso** (não é erro): o aviso de comissão acima, em tom de atenção, com o campo ainda editável.
- **Erro de campo**: mensagem por campo + a linha de seção "Corrija os campos deste canal para ver os preços."
- **Sem comissão**: "Informe a comissão do canal para ver os preços."
- **Faixa sem tarifa publicada**: "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do canal para precificar."
- **Degradado / offline**: selo "referência embutida (offline)" e selo "pode estar desatualizada" — o cálculo continua funcionando.
- **Falha de atualização do catálogo** (fora do cartão, acima da pilha): Alert tom informativo "Não foi possível atualizar as taxas" / "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." + botão "Tentar novamente" (com estado carregando).
- **Sem permissão (grátis)**: a seção inteira colapsa para o switch "Incluir marketplaces no preço" **desabilitado** + a frase "Vender em marketplaces faz parte do Premium." + o CTA de assinatura centrado. Nenhum cartão, nenhum número parcial.
- **Único cartão** vs **N cartões**: mostre a pilha com 3 (ML, Shopee, Outro) e o botão "Adicionar canal".

## Viewports
- **Mobile 390px** — é onde a peça dói: a grade 1fr 1fr deixa ~150px por campo, e legendas de 3 linhas empilham. Obrigatório.
- **Desktop 1280px** — a Calcular tem layout desktop e o canvas 018 **não** cobriu esta aba; a pilha de cartões hoje herda a largura da coluna do formulário sem regra própria. Obrigatório.
- **1920px** — só se a sua proposta mudar a densidade (ex.: dois cartões por linha); caso contrário, diga explicitamente que 1280 escala.

## Regras que o desenho não pode quebrar
- **Freemium é binário**: sem assinatura não existe cartão nem número parcial de canal — existe a frase e o CTA. Nunca um cartão desabilitado com números embaçados.
- **Procedência sempre visível**: todo número pré-preenchido carrega selo dizendo de onde veio e quão fresco é. Se o selo não couber, o número não pode aparecer.
- **Degradação dita, não escondida**: offline e "pode estar desatualizada" são texto legível, não uma cor mais apagada.
- **Falha de rede nunca é falta de premium**: a falha de atualização usa tom informativo com retry, jamais um muro de erro nem o discurso de assinatura.
- **Frase honesta nunca vive em placeholder**: já custou um defeito — a regra "a taxa fixa é 50% do preço" foi tirada do sufixo do placeholder (cortava em "2,50 (= 50") e mora em legenda de largura total. Mantenha assim.
- **Placeholder ≠ valor**: o campo pré-preenchido mostra o valor do catálogo como placeholder porque um valor real faria o vendedor achar que ele mesmo vouchou por aquilo.
- **Alvo ≥44px** para o "✕", o checkbox e cada select.
- **Contraste medido** de legendas e selos contra o fundo real do `Card` — não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: 100,5px de estouro com botão nascendo fora da viewport já aconteceu nesta base; a grade 1fr 1fr com rótulo "Comissão mínima/item" a 390px é candidata direta.
- **Valor grande estoura a coluna**: teste o desenho com `R$ 1.234,56` em Comissão mínima e Frete ao mesmo tempo.
- **Texto ocluso passa em teste**: um elemento sobreposto ou cortado continua "visível" para asserção de texto — desenhe as caixas, não só o texto.
- **Placeholder que corta a frase**: 77–187px úteis num campo de taxa não comportam nenhuma explicação.
- **Legenda longa**: as legendas de sobretaxa e de subsídio de frete têm 2–4 linhas de verdade; se o desenho as tratar como uma linha, ele está desenhando outra coisa.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Cartão mínimo ("Outro": marketplace + 4 taxas + selo) — 390px e 1280px.
2. Cartão máximo (Shopee: os 11 blocos, com o CPF+450 pedidos respondido, sobretaxa marcada e os dois avisos) — 390px e 1280px.
3. Pilha de 3 canais + "Adicionar canal", mostrando como cartões de alturas muito diferentes convivem e como o vendedor sabe onde está.
4. Sua proposta para o **remover** e para um eventual **estado resumido/recolhido** de cartão (se você propuser um, desenhe recolhido e expandido).
5. Tira de estados: foco, aviso de comissão, erro, offline/degradado, falha de atualização com retry, e a faixa Premium sem permissão.

Reutilize os primitivos `tf-*` existentes, sem criar novos: `tf-card` para o cartão, `tf-field` + `tf-select` para marketplace/modalidade/perfil, `tf-field` + `tf-input` (numérico, prefixo R$ / sufixo %) para as taxas, `tf-checkbox` para a sobretaxa, `tf-badge` para os selos, `tf-alert` (tom info) para os avisos Shopee e para a falha de atualização, `tf-button` variantes ghost (remover) e secondary ("Adicionar canal" / "Tentar novamente"), `tf-switch` para "Incluir marketplaces no preço".

## Perguntas em aberto para o dono
1. **Um cartão de canal pode ser recolhido?** Com 3+ canais a pilha fica longa. Se puder, o que o cabeçalho recolhido mostra — só o nome do marketplace, ou nome + comissão aplicada + preço do anúncio? (Preço vem de outro cartão hoje; trazê-lo para o cabeçalho é decisão de produto.)
2. **Remover um canal pede confirmação?** Hoje o "✕" apaga direto, sem desfazer, e junto vão categoria, perfil e taxas digitadas.
3. **Os dois avisos da Shopee ficam sempre abertos?** O "Frete aferido" é estático e aparece em todo cartão Shopee — em três cartões Shopee ele se repete três vezes. Ele deve subir para o nível da seção, virar um ⓘ recolhido, ou continuar por cartão?
4. **Existe limite de canais?** O botão "Adicionar canal" não tem teto declarado; o desenho de 8 cartões empilhados é um cenário real ou não?

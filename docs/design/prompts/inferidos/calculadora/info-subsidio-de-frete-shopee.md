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

- **Onde vive:** Uma legenda de largura total dentro do cartão de canal Shopee, imediatamente ABAIXO da legenda de faixa/regra da taxa fixa e ACIMA das chaves de taxa opcional — ou seja, sob a grade de taxas, ao lado das outras legendas, e deliberadamente FORA do campo 'Frete'.
- **Como o vendedor chega:** Aparece sozinha, e só quando duas coisas são verdade: o catálogo publica a informação de subsídio para a Shopee E o canal já tem um preço de anúncio de varejo calculado, para resolver a faixa do cupom.
- **Vizinhança imediata:** Acima: a legenda 'Tabela por faixa de preço…' (quando existe) ou diretamente a grade de taxas — em particular o campo 'Frete', que é o vizinho conceitual. Abaixo: as chaves de taxa opcional, depois os selos.
- **Dados que chegam (e o que ela devolve):** Teto do cupom, fonte e data, todos lidos do catálogo; zero número escrito no código.
- **O que acontece depois:** Nada entra na conta: o campo 'Frete' continua sendo a ÚNICA origem de desconto. A legenda existe justamente porque o modelo antigo cobrava esse cupom do vendedor num campo que mostrava R$ 0,00.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# A legenda do subsídio de frete da Shopee, sob a grade de taxas

## O que desenhar
Uma legenda informativa que aparece dentro do cartão de um canal Shopee na aba **Calcular**, logo abaixo da grade de taxas (Comissão · Taxa fixa · Comissão mínima/item · Frete) e antes das sobretaxas opcionais e dos selos de procedência. Ela diz ao vendedor que a Shopee dá cupons de frete grátis até um teto **que depende da faixa de preço do anúncio que está na tela**, que esse custo é da Shopee e não dele, e que o campo "Frete" logo acima serve só para o que sobrar para ele. Quem lê é um vendedor leigo, no momento em que está conferindo por que o preço sugerido daquele canal ficou no valor que ficou.

## Por que este prompt existe
Nenhum protótipo do projeto modela frete em canal nenhum — as quatro autoridades de desenho só conhecem "taxa fixa + comissão", e o canvas 018 não cobre a aba Calcular. Esta peça nasceu inteira em código, no hotfix 016/A2 (2026-08-07), corrigindo um erro de R$ 20 a R$ 40 **por venda** que ficou meses no produto: o modelo antigo cobrava o cupom do vendedor num campo que exibia R$ 0,00. Foram decididos sem desenho: que a verdade nova seria uma **legenda** e não um valor de campo; sua vizinhança (embaixo da legenda de faixa, acima das sobretaxas); e — o ponto que continua em aberto — **como impedir que o vendedor leia o teto do cupom como um desconto que ele deveria digitar**. Autoridade de desenho: NENHUMA.

## O que já existe hoje (não invente do zero — corrija)
Um único `<p>` de largura total, tipografia `--fs-caption` em `--text-muted`, sem ícone, sem fundo, sem borda, sem separador — visualmente idêntico à legenda de faixa que fica imediatamente acima dele. Duas frases concatenadas com um espaço:

1. `"A Shopee oferece cupons de frete grátis (até R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar para você, se houver."`
2. `"Fonte: Central de Educação do Vendedor Shopee — Programa de Frete Grátis (subsídio oferecido pela Shopee a todos os vendedores), vigente desde 01/03/2026."`

Ordem real dentro do cartão do canal: seletor de Marketplace + botão ✕ → (modalidade/categoria quando houver) → "Você vende como" e "Mais de 450 pedidos nos últimos 90 dias?" (só Shopee) → grade de taxas em **duas colunas** → legenda de faixa `"Tabela por faixa de preço — valores da faixa do seu anúncio."` (+ a frase da regra de taxa fixa quando existir) → **esta legenda** → sobretaxa opcional (caixa de seleção) → selos de procedência → avisos Shopee.

→ Problemas a resolver no desenho: **(a)** a frase diz "no campo Frete", mas o campo Frete é a **quarta célula** da grade de duas colunas (coluna direita, segunda linha) — a legenda aponta para cima e para a esquerda, sem nenhuma âncora visual; **(b)** duas legendas de mesmo peso empilhadas — a de faixa e esta — e a segunda carrega dinheiro, não contexto; **(c)** a frase de fonte tem 106 caracteres de nome de fonte e engole a frase que importa; **(d)** existe um `sourceUrl` publicado (`seller.shopee.com.br/edu/article/23431`) que a tela **nunca** usa; **(e)** o número "até R$ 20,00" é o único valor em dinheiro da legenda e não tem nenhuma marca que o separe dos valores que o vendedor pode editar.

## Conteúdo e dados reais
| Dado | Origem | Valor real hoje |
| --- | --- | --- |
| Teto do cupom (`ceiling`) | catálogo, faixa resolvida pelo preço do anúncio varejo | anúncio < R$ 80,00 → **R$ 20,00** · R$ 80,00 a R$ 200,00 → **R$ 30,00** · ≥ R$ 200,00 → **R$ 40,00** |
| Preço que resolve a faixa | resultado do canal (preço de anúncio varejo) | ex.: R$ 24,24 → faixa R$ 20,00 |
| Fonte (`source`) | catálogo | "Central de Educação do Vendedor Shopee — Programa de Frete Grátis (subsídio oferecido pela Shopee a todos os vendedores)" |
| Vigência (`effectiveDate`) | catálogo | 01/03/2026 |
| Última revisão (`lastReviewed`) | catálogo | 07/08/2026 — **existe no dado e não é mostrado** |
| Link da fonte (`sourceUrl`) | catálogo | existe e **não é mostrado** |

O teto **não entra em conta nenhuma** — mexer nele no catálogo não move um centavo do resultado (há teste de propriedade garantindo isso). O único desconto possível continua sendo o que o vendedor digita no campo "Frete" (moeda, opcional, vazio por padrão, mostra `R$ 1.234,56` com máscara de milhar no blur). Nenhum número desta legenda pode ser desenhado como fixo: os três tetos vêm do dado e mudam sem tocar em código.

## Estados obrigatórios
- **Repouso, com teto resolvido** — três variantes a desenhar: R$ 20,00, R$ 30,00 e R$ 40,00 (o desenho tem que sobreviver ao teto que muda quando o preço muda de faixa).
- **Empilhada com a legenda de faixa** — "Tabela por faixa de preço — valores da faixa do seu anúncio." imediatamente acima, e, quando a faixa tem regra, também "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já calculado." Três blocos de texto miúdo seguidos: mostre como se distinguem.
- **Ausente (e é isto que o desenho precisa julgar)** — a legenda não renderiza quando o canal não é Shopee, quando o catálogo não publica o subsídio, **ou quando ainda não há preço calculado no canal**. Ou seja: existe um momento em que o campo "Frete" está editável e a verdade sobre o cupom não está na tela.
- **Com o campo "Frete" preenchido** — o vendedor digitou, por exemplo, R$ 5,00; o resultado passa a mostrar a linha "Frete" e a legenda "Descontado do valor recebido (não é embutido no anúncio)." Desenhe a coexistência: um valor que desconta e um teto que não.
- **Degradado / offline** — o catálogo veio do cache do dispositivo ou da referência embutida; ao lado, os selos de procedência dizem isso. A legenda continua verdadeira, mas o desenho precisa deixar claro que a data mostrada é de vigência, não de sincronização.
- **Falha ao atualizar taxas** — o alerta "Não foi possível atualizar as taxas" / "Usando a referência salva no dispositivo — o cálculo continua funcionando." aparece acima, com "Tentar novamente". A legenda permanece.
- **Sem permissão (Premium pausado ou plano gratuito)** — a seção de marketplaces inteira fica indisponível com "Vender em marketplaces faz parte do Premium.": a legenda **não** aparece. Desenhe o que o vendedor vê nesse lugar.
- **Vizinhança de avisos** — logo abaixo vem sempre o aviso compacto em tom informativo "Frete aferido pode gerar cobrança retroativa" com o gatilho "Sobre o frete aferido"; e, para CPF de alto volume sem preço, "A Shopee não publica a fórmula completa desta taxa". A legenda não pode competir nem se confundir com eles.
- **Foco / hover / pressionado** — só se o desenho propuser um alvo interativo (link para a fonte ou gatilho de dica). Nesse caso, alvo ≥ 44px e foco visível contra o fundo real do cartão.

## Viewports
Desenhar **390px** (é onde o vendedor usa a calculadora, e onde a grade de duas colunas deixa cada célula com ~150px — a frase "no campo Frete" tem que achar seu alvo numa tela estreita) e **1280px** (a calculadora existe no desktop; com o cartão largo, uma legenda de duas linhas em texto miúdo vira uma faixa cinza fácil de pular). 1920px só se a solução mudar de forma nessa largura.

## Regras que o desenho não pode quebrar
- **O teto não é desconto.** Nada no desenho pode sugerir que o número seja digitável, subtraível ou que já esteja aplicado. Se ele ganhar destaque visual, precisa ganhar junto a marca de que é informação de terceiro.
- **Procedência sempre junto do número** — fonte e data acompanham o teto; um teto sem fonte não pode ser desenhado.
- **Frase honesta nunca em placeholder nem cortada.** Esta lição já foi paga: um sufixo de placeholder cortou "2,50 (= 50" e produziu exatamente a leitura errada que a frase existia para impedir. Texto de honestidade vive em elemento de largura total, quebrando linha à vontade.
- **Falha de rede nunca vendida como falta de premium**, e degradação dita, não escondida.
- **Freemium binário**: sem entitlement ativo não existe meia-legenda — ou a seção é premium e verdadeira, ou é teaser honesto.
- **Zero número no desenho como constante**: 20/30/40 são exemplos de dado, não rótulos.
- Contraste medido contra o fundo real do cartão do canal (não contra o fundo da página), em tema escuro e claro.

## Armadilhas já pagas neste projeto
- Texto que passa em teste e é ilegível na tela: `toBeVisible` passa em elemento ocluso ou estourado — o que reprova esta peça é o olho, não a asserção.
- Overflow horizontal medido nos **dois** eixos: uma legenda de linha única com nome de fonte de 106 caracteres é candidata natural a estouro em 390px.
- Valor grande estourando a coluna: se um teto futuro vier como R$ 1.234,56, a linha tem que quebrar, não empurrar.
- Legenda de menor peso visual ao lado de um preço já descontado foi, literalmente, o defeito anterior desta mesma tela: a explicação era o elemento mais fraco do painel.

## Entregável
Pranchetas em **tema escuro (padrão) e claro (first-class)**: (1) o cartão do canal Shopee completo em 390px, com preço na faixa de R$ 20,00, mostrando a pilha legenda-de-faixa → legenda-do-subsídio → sobretaxa → selos → aviso de frete aferido; (2) a mesma peça em 1280px; (3) as três faixas (R$ 20,00 / R$ 30,00 / R$ 40,00) lado a lado; (4) o estado com "Frete" preenchido em R$ 5,00 e a linha de desconto no resultado; (5) o estado sem preço calculado — sua proposta para o vazio; (6) degradado/offline com os selos de procedência. Reutilize os primitivos existentes: o cartão do canal é o `tf-card`; a legenda deve continuar usando o tamanho de legenda e a cor de texto discreto do sistema; se propuser destaque, use o alerta informativo compacto (mesma família do aviso "Frete aferido pode gerar cobrança retroativa") e o gatilho de dica já existente, em vez de criar um componente novo; selos de procedência reaproveitam o selo de honestidade do slot. Marque explicitamente qual primitivo cada parte usa e o que muda em relação ao que existe hoje.

## Perguntas em aberto para o dono
1. O teto (R$ 20,00) deve ganhar peso visual — número destacado, ícone, faixa informativa — ou continuar em texto miúdo? Destacar melhora a leitura e **aumenta** o risco de o vendedor tratá-lo como desconto; essa troca é decisão de produto.
2. A fonte deve virar link para o artigo publicado (`sourceUrl` existe e hoje é ignorado), colapsar dentro de um gatilho de dica como o aviso de frete aferido, ou continuar por extenso na legenda?
3. Quando ainda **não há preço calculado** no canal, deve aparecer uma versão sem teto ("a Shopee subsidia o frete; o teto depende da faixa do seu preço") ou a legenda continua ausente, deixando o campo "Frete" sem contexto?
4. Quando o vendedor digita um valor no campo "Frete", a legenda deve mudar de texto ou ganhar uma confirmação ("este valor é seu; o cupom não") — ou permanece idêntica?
5. Mostrar a data de última revisão do dado (07/08/2026) além da vigência (01/03/2026), ou só a vigência?

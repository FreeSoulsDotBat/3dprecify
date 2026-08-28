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

- **Onde vive:** Terceiro bloco da COLUNA ESQUERDA quando a conta é Premium (abaixo de 'Mão de obra e custos'); na conta grátis a MESMA seção migra para a COLUNA DIREITA, logo abaixo de 'Markup'. No mobile é sempre a terceira seção da pilha.
- **Como o vendedor chega:** Rolando o formulário. Nasce sem nenhuma linha: só o título, a frase de ajuda e o botão de adicionar.
- **Vizinhança imediata:** Acima (Premium): o Card 'Mão de obra e custos'. Acima (grátis): o Card 'Markup'. Dentro: título 'Outros custos' com ⓘ → uma frase de ajuda em cinza → 0..N linhas, cada uma `flex items-end gap-2` com um campo de texto sem rótulo (só placeholder) ocupando 3 partes, um campo de dinheiro ocupando 2 partes, e um botão fantasma com o glifo '✕' → um botão secundário 'Adicionar custo' ao final. Abaixo (Premium): o topo da coluna direita; abaixo (grátis): a faixa do portão Marketplace.
- **Dados que chegam (e o que ela devolve):** Texto e valor digitados linha a linha; o erro de cada linha vem do motor (não do validador de formulário), então uma linha ruim se marca sozinha e as demais continuam somando.
- **O que acontece depois:** Cada item nomeado vira SUA PRÓPRIA linha do detalhamento no rodapé (nome em branco cai num rótulo neutro) e a soma entra no custo total.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Seção "Outros custos" da Calcular — lista de itens nomeados

## O que desenhar
O bloco da aba **Calcular** onde o vendedor acrescenta 0..N custos nomeados que somam ao custo total da
peça — embalagem, etiqueta, taxas, overhead. É um editor de lista: um título com ⓘ, uma legenda, as
linhas já criadas (cada uma = nome livre + valor em R$ + remover) e um botão de adicionar. Aparece no meio
do formulário, depois dos campos de custo da peça e da mão de obra, e antes do rodapé "Como chegamos no
preço", onde **cada item vira uma linha própria do detalhamento**. Quem usa é o vendedor de peças 3D no
momento em que está montando o custo — normalmente a última coisa que ele lembra de incluir, e o motivo
pelo qual o produto existe.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. A busca por "outros custos" nas quatro autoridades de protótipo
(`claude-design-prototype.md`, `-fixes.md`, `-fixes-r2.md`, `prototype-audit-2026-07-02.md`) deu zero, e a
`CalculatorScreen.jsx` só tinha um breakdown fixo, sem sub-custos. O único desenho existente com a string
é o `Abas-Desktop.dc.html` (linha 330), e ali é uma **linha de LEITURA** num orçamento congelado, na aba
Orçamentos (`Embalagem` / sub-rótulo `Outros custos` / R$ 2,50) — desenha como um outro-custo é lido depois
de salvo, não o editor. Portanto: a supressão dos rótulos por linha, a proporção 3:2, o "✕" tipográfico como
botão de remoção, a ausência total de estado vazio educativo e a **migração de coluna conforme o plano** foram
todas decididas em código, sem desenho.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`OtherCostsSection` / `OtherCostRow`) e
`apps/web/src/pages/calcular/calcular-page.tsx`.

Ordem atual, de cima para baixo:

1. Título **"Outros custos"** + ícone ⓘ colado à direita. O tooltip tem rótulo "Sobre outros custos" e o
   corpo: *"Itens nomeados que somam ao custo total: embalagem, etiqueta, taxas, overhead. A soma entra no
   custo total exatamente como um valor único faria, e cada item aparece na sua própria linha do
   detalhamento."*
2. Legenda em texto apagado: **"Embalagem, etiqueta, taxas, etc. Cada item soma ao custo total."**
3. As linhas (0..N). Cada linha é uma faixa horizontal alinhada pela base, com três controles:

| Controle | Proporção | Texto visível hoje | Nome acessível | Observação |
|---|---|---|---|---|
| Nome do custo | flex 3 | *só* o placeholder "Ex.: Embalagem" | "Nome do custo" | texto livre; pode ficar em branco |
| Valor | flex 2 | afixo R$ do campo de moeda | "Valor" | moeda pt-BR, aceita vazio |
| Remover | automática | o caractere **"✕"** | "Remover custo" | botão fantasma, tamanho `sm` |

4. Botão secundário `sm` **"Adicionar custo"**, sempre no fim da lista.

→ **Problema 1:** nenhuma linha tem rótulo visível. O significado dos dois campos mora inteiro no
placeholder "Ex.: Embalagem" e no afixo R$ — e o placeholder some no instante em que a pessoa digita.
→ **Problema 2:** o estado vazio é literalmente título + legenda + botão. Nada ensina o que entra ali,
justamente no bloco que existe para lembrar do custo esquecido.
→ **Problema 3:** o "✕" é um glifo tipográfico dentro de um botão fantasma pequeno, na borda direita da
linha — o alvo mais destrutivo do bloco é o menor e o mais discreto dele.
→ **Problema 4:** a linha alinha pela base; quando o erro aparece embaixo do campo de valor, os três
controles se deslocam na vertical.
→ **Problema 5 (posição por plano):** a seção **não é premium** — ela existe para todo mundo. Mas no
desktop ela troca de coluna: com marketplace liberado fica na coluna **esquerda** (abaixo de mão de obra);
sem marketplace, migra para a **direita** (abaixo do markup) para tapar o buraco deixado pelo gate — 1.671px
de vão medidos a 1440px antes dessa correção. O bloco é o único da tela cuja posição depende do plano.

## Conteúdo e dados reais
- **Nome**: texto livre, opcional, sem limite declarado. Exemplos verdadeiros do produto: `Embalagem`,
  `Etiqueta`, `Taxa de emissão`, `Overhead`. Um nome longo real de estresse: `Frete até a transportadora`.
- **Valor**: moeda em reais, formato pt-BR, `R$ 0,00`. Faixa plausível de um item: `R$ 0,35` (etiqueta) a
  `R$ 12,00` (caixa grande). Valor de estresse para largura: **`R$ 1.234,56`**.
- **Vazio ≠ erro**: valor em branco = linha não tocada — não entra na conta, não gera item, não acusa nada.
- **Nome em branco é aceito**: no detalhamento a linha aparece com o rótulo neutro **"Outros custos"**.
- **Derivado**: cada item vira uma linha do card "Como chegamos no preço", com o nome digitado e o valor em
  R$, logo antes da linha **"Custo total"**. Não existe subtotal da seção em lugar nenhum hoje.
- Sem aviso de plausibilidade: nenhum valor desta seção dispara os avisos "Nada foi recusado." que outros
  campos têm.
- Atenção à copy: o exemplo *"frete até a transportadora"* foi **removido de propósito** (016/US12) —
  o frete tem campo próprio dentro do canal de marketplace e citá-lo aqui sugeria dois lugares para o mesmo
  custo. **Não reintroduza frete como exemplo no desenho.**

## Estados obrigatórios
- **Vazio** (nenhuma linha): título, ⓘ, legenda e "Adicionar custo". Desenhe o que ele deveria ser além disso.
- **Repouso** com 1, 2 e 4 linhas preenchidas.
- **Foco** no campo de nome e no campo de valor (anel de foco visível sobre o fundo real da seção).
- **Hover** e **pressionado** em "Adicionar custo" e no botão de remover.
- **Erro por linha — valor inválido**: mensagem **"Informe um número válido."** sob o campo de valor.
- **Erro por linha — negativo**: **"Não pode ser negativo."** sob o campo de valor. Nas duas, as outras
  linhas continuam válidas e o preço continua sendo calculado com elas; a linha ruim falha sozinha.
- **Nome em branco com valor preenchido**: linha válida; mostre no desenho como o detalhamento lê
  "Outros custos".
- **Estresse**: linha com `Frete até a transportadora` + `R$ 1.234,56` a 390px.
- Não existem, nesta peça: carregando, offline, degradado, premium pausado, sem permissão — a seção é
  local, síncrona e não é gateada. Não invente nenhum deles.

## Viewports
- **Mobile 390px** — obrigatório: é a coluna única, onde os três controles dividem a mesma faixa e onde a
  proporção 3:2 aperta mais. Inclua a versão com erro e a versão de estresse.
- **Desktop 1280px** — a grade de duas colunas do formulário liga em **1024px** (não em 1280; registre isso).
  Desenhe as **duas posições**: dentro da coluna esquerda (conta com marketplace) e dentro da coluna direita
  (conta grátis, ao lado do markup). São larguras de coluna diferentes, e é onde a linha 3:2 quebra ou não.
- **1920px** — só se a decisão de largura máxima da linha mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- Frase honesta **nunca** dentro de placeholder: o que explica o campo tem de existir com o campo preenchido.
- Alvo de toque **≥44px** para remover e para adicionar — inclusive a 390px, e sem encostar no campo de valor.
- Contraste medido contra o fundo real da seção, nos dois temas.
- O erro pertence à **linha**, não à seção: nunca um banner no topo dizendo que "há erros".
- Zero overflow horizontal a 390px com o nome longo e o valor de seis dígitos — medido, não presumido.
- Nada nesta seção pode parecer bloqueado por plano: ela é igual para grátis e premium; só a posição muda.
- O total mostrado no rodapé é a soma exata das linhas — o desenho não pode sugerir taxa, arredondamento
  ou item automático que o produto não cria.

## Armadilhas já pagas neste projeto
- **Placeholder cortado** (016/PR-F): frase de sentido dentro de placeholder desaparece ou é clipada;
  placeholder carrega número/exemplo, não significado.
- **Overflow medido, não assumido** (016/PR-B e 014): `toBeVisible` passa em elemento ocluso e em coluna
  estourada — a largura da linha precisa fechar por geometria, com o valor grande dentro.
- **Coluna curta ao lado do gate** (016/US11): foi exatamente o buraco que jogou esta seção para a direita;
  o desenho tem de funcionar nas duas larguras de coluna, não numa só.
- **Tooltip que compete pela linha do controle** (016/US6): o ⓘ vive na linha do TÍTULO, nunca dentro da
  faixa de inputs — quando dividiu a faixa, sobrou 1px de campo visível a 360px.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro como primeira classe** (as duas versões de cada estado
principal):
1. `390 — vazio` (a proposta de estado vazio educativo)
2. `390 — três linhas em repouso`
3. `390 — erro em uma linha + estresse (nome longo, R$ 1.234,56)`
4. `1280 — coluna esquerda (premium)` e `1280 — coluna direita (grátis)`, lado a lado para comparar
5. `Anatomia da linha` — foco, hover, pressionado e o botão de remover em tamanho de alvo real

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap`/`tf-input` para o nome, o campo de
moeda com afixo R$ para o valor, botão **fantasma** para remover e botão **secundário `sm`** para
"Adicionar custo", o `InfoTip` já existente para o ⓘ e o estilo de rótulo de seção para o título. Se a sua
proposta de remoção substituir o "✕" tipográfico, use o ícone do conjunto do DS e diga qual.

## Perguntas em aberto para o dono
1. **Rótulos por linha**: mostrar "Nome do custo" e "Valor" visíveis (repetidos em cada linha), mostrar só
   na primeira linha como cabeçalho da lista, ou manter só o placeholder? Muda a altura de cada linha.
2. **Estado vazio**: ele deve apenas explicar, ou oferecer atalhos de um toque para os itens mais comuns
   (Embalagem, Etiqueta)? Sugestão pré-preenchida é decisão de produto, não de layout.
3. **Subtotal da seção**: mostrar "Soma dos outros custos: R$ 8,50" dentro do bloco, ou deixar a soma só no
   detalhamento do rodapé, como é hoje?
4. **Posição por plano**: a migração de coluna conforme entitlement continua? Ela é a única na tela e faz o
   mesmo bloco morar em lugares diferentes para dois usuários; se o gate for redesenhado, isso some.
5. **Limite de linhas**: existe um número máximo de itens, e o que acontece na lista longa (rolagem própria,
   nada)? Hoje não há limite.
6. **Nomes repetidos**: dois itens chamados "Embalagem" são um erro a avisar ou comportamento aceito?

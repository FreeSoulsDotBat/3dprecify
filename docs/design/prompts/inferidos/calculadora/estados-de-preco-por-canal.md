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

- **Onde vive:** Dentro de um bloco de canal em 'Preços por canal' (cauda do cartão do detalhamento, no rodapé), substituindo as linhas de números daquele canal ou daquele nível.
- **Como o vendedor chega:** Não é acionado — o vendedor chega ao rodapé para ler o preço e encontra uma frase no lugar do número.
- **Vizinhança imediata:** Sempre logo abaixo do título 'Marketplace · Modalidade' do canal, ou logo abaixo da legenda 'Varejo'/'Atacado' do nível. Quatro estados, todos como parágrafo solto, sem ícone e sem moldura: (a) faixa sem tarifa publicada — uma frase em cor de perigo no lugar do preço, POR NÍVEL (varejo e atacado podem cair em lados diferentes da lacuna); (b) líquido negativo — o valor renderizado como negativo, seguido de 'Canal não-lucrativo neste preço (frete maior que a margem).'; (c) canal válido sem comissão informada — 'Informe a comissão do canal para ver os preços.'; (d) canal com erro de campo — 'Corrija os campos deste canal para ver os preços.'. Nos casos (c) e (d) a frase substitui o bloco inteiro do canal; nos casos (a) e (b) ela convive com o outro nível, que pode estar precificado normalmente.
- **Dados que chegam (e o que ela devolve):** O resultado do canal (ou a sua ausência) vindo do motor; nenhum desses estados imprime R$ 0,00 no lugar de um número que não existe.
- **O que acontece depois:** O conserto é sempre lá em cima, no cartão daquele canal na coluna direita — e a tela não leva o vendedor até lá.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Quando o canal não tem preço: as quatro recusas de "Preços por canal"

## O que desenhar
Dentro da calculadora, no fim do cartão "Como chegamos no preço", existe o bloco **"Preços por canal"**: um
bloco por marketplace ativo (Mercado Livre · Shopee · Amazon · Outro), cada um mostrando duas seções —
"Varejo" e "Atacado" — com as linhas "Preço para anunciar" e "Recebido líquido". Esta peça é o que aparece
**no lugar desses números quando o produto se recusa a dar um preço**: (a) faixa de preço sem tarifa
publicada, (b) líquido negativo, (c) canal válido mas sem comissão informada, (d) canal com campo inválido.
Quem lê é o vendedor logo depois de preencher os custos, no momento em que ele desce a tela procurando o
número que vai colar no anúncio — e encontra uma frase. Hoje as quatro são parágrafos soltos, sem ícone,
sem moldura e sem hierarquia própria, escolhidos por um agente sem desenho.

## Por que este prompt existe
A matriz §G do protótipo de 2026-07-02 (linha 317) cobre "Resultado/breakdown" com cinco estados —
loading=skeleton, empty=**zerado (0,00)**, error=—, success=preço+breakdown, offline=mantém cálculo. Ela
**não prevê recusa de precificação; prevê o oposto**. E o "zerado 0,00" que ela manda desenhar é exatamente
o que o produto hoje **proíbe** (SC-817: imprimir R$ 0,00 sob selo de "Referência" custaria uma venda ao
vendedor). Ou seja: o código contraria a única regra de desenho explícita que existe sobre este espaço, e
está certo em contrariar — o que falta é o desenho da recusa. O `-fixes.md` item 11 ("se comissão ≥ 100%,
mostre erro amigável em vez de calcular") chega perto, mas é um caso só e é ERRO, não recusa honesta.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro de um bloco de canal:

1. Cabeçalho do canal: nome forte + modalidade em peso normal e cor apagada, separados por " · "
   (ex.: **"Mercado Livre** · Clássico"). Blocos empilhados são separados por uma linha de 1px no topo.
2. Legenda "Varejo" → linhas do nível → legenda "Atacado" → linhas do nível.
3. Selos de procedência do canal ("Referência atualizada em…", "estimativa de frete", "Taxa fixa vigente
   desde…") e, na Shopee, os dois avisos informativos.

Os quatro estados, literais:

| Estado | O que substitui | Texto pt-BR exato hoje | Como está pintado |
|---|---|---|---|
| (a) Faixa sem tarifa publicada | As duas linhas do NÍVEL (só do nível atingido) | "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do canal para precificar." | parágrafo de 12px em `--danger-text`, logo abaixo da legenda "Varejo"/"Atacado" |
| (b) Líquido negativo | Nada — o número aparece, negativo | "Canal não-lucrativo neste preço (frete maior que a margem)." | linha "Recebido líquido" com valor em `--danger` + parágrafo 12px em `--danger-text` |
| (c) Sem comissão informada | O bloco inteiro (varejo + atacado) | "Informe a comissão do canal para ver os preços." | parágrafo 12px em `--text-muted` |
| (d) Canal com erro | O bloco inteiro (varejo + atacado) | "Corrija os campos deste canal para ver os preços." | parágrafo 12px em `--text-muted` |

→ **Problema 1 — (a) e (c) terminam pedindo a mesma coisa e não são a mesma coisa.** "informe a comissão do
canal para precificar" (recusa por lacuna na tabela publicada, culpa do marketplace) vs. "Informe a comissão
do canal para ver os preços" (falta um dado que o vendedor ainda não digitou). O vendedor lê duas vezes a
mesma instrução para dois mundos diferentes. O desenho precisa separá-los visualmente mesmo que a copy fique.

→ **Problema 2 — (a) é o único em vermelho, e não é um erro do vendedor.** Vermelho aqui acusa quem não errou.

→ **Problema 3 — (c) e (d) são visualmente idênticos** (mesmo tamanho, mesma cor, mesma posição): "falta
preencher" e "tem campo inválido" pedem ações diferentes e não se distinguem.

→ **Problema 4 — nenhum dos quatro tem âncora visual.** São parágrafos de 12px onde antes havia números de
16–18px em fonte tabular; o olho que desce a tela procurando dinheiro pode simplesmente não parar ali.

→ **Problema 5 — (b) afirma uma causa.** "(frete maior que a margem)" só é verdade quando o vendedor digitou
frete; a linha "Frete" só existe quando ele digitou. Ver Perguntas em aberto.

## Conteúdo e dados reais
- Legendas de nível: "Varejo" e "Atacado". Linhas: "Preço para anunciar" e "Recebido líquido"; a linha
  opcional "Frete" aparece só quando declarada, com valor negativo e tom apagado (ex.: "Frete  − R$ 21,00"),
  seguida da legenda "Descontado do valor recebido (não é embutido no anúncio)."
- Dinheiro em pt-BR com fonte tabular, sinal de menos tipográfico: **R$ 24,24**, **R$ 1.234,56**, **− R$ 3,80**.
  Exemplo real do seed: varejo R$ 24,24, atacado R$ 21,01, custo total R$ 16,16.
- Um canal pode ter **um nível precificado e o outro não**: o desenho tem de mostrar, no mesmo cartão,
  "Varejo · Preço para anunciar R$ 24,24 / Recebido líquido R$ 18,90" e, logo abaixo, "Atacado · Sem tarifa
  publicada…". Esse é o caso que ninguém desenhou e é o mais importante.
- Na Shopee, quando o vendedor é CPF com mais de 450 pedidos em 90 dias e o nível cai sem tarifa, entra
  ACIMA de tudo um aviso informativo com título "A Shopee não publica a fórmula completa desta taxa" — ou
  seja, o estado (a) e um alerta informativo convivem no mesmo cartão e precisam não competir.
- Nomes de canal: "Mercado Livre", "Shopee", "Amazon", "Outro" (fallback: "Canal").

## Estados obrigatórios
- **Repouso precificado** (referência de contraste): duas linhas por nível, valores tabulares alinhados à direita.
- **(a) Sem tarifa publicada, um nível** — legenda do nível + a frase; o outro nível continua com números.
- **(a') Sem tarifa publicada, os dois níveis** — o cartão inteiro sem um número sequer.
- **(b) Líquido negativo** — "Recebido líquido" em tom de perigo com o valor **verdadeiro** (ex.: − R$ 3,80,
  nunca zerado) + "Canal não-lucrativo neste preço (frete maior que a margem)."
- **(c) Sem comissão informada** — "Informe a comissão do canal para ver os preços." no lugar do bloco.
- **(d) Canal com erro** — "Corrija os campos deste canal para ver os preços."; o campo culpado está acima,
  no formulário do canal, e o desenho pode (proposta sua) apontar para lá.
- **Carregando** — o cálculo é local e instantâneo; o que carrega é o catálogo de tarifas. Desenhe o bloco
  com skeleton apenas se você julgar que existe janela perceptível; diga qual escolheu.
- **Offline / catálogo desatualizado** — o cálculo continua e o selo muda ("referência embutida (offline)",
  "pode estar desatualizada"); os quatro estados acima continuam válidos por baixo do selo.
- **Premium pausado / sem permissão** — a seção inteira de marketplaces some (o interruptor "Incluir
  marketplaces no preço" fica desligado e desabilitado, com "Vender em marketplaces faz parte do Premium.");
  este bloco não renderiza. Não desenhe uma versão borrada dos números.

## Viewports
- **Mobile 390px** — obrigatório: é a tela onde o produto nasceu e onde a frase de (a), com 92 caracteres,
  quebra em 3 linhas dentro de um cartão já longo.
- **Desktop 1280px** — obrigatório: a calculadora tem layout largo desde 018 e a mesma frase, esticada, vira
  uma linha órfã de 12px perdida num cartão largo. Mostre como ela se ancora.
- 1920px não é necessário se 1280 resolver a ancoragem; diga se resolver.

## Regras que o desenho não pode quebrar
- **Nunca imprimir R$ 0,00 no lugar de um preço que não existe** (SC-817). Zero é um número e o vendedor
  usa números.
- **A recusa é dita em palavras, e só para o nível atingido** — varejo e atacado caem em lados diferentes da
  lacuna e o desenho não pode apagar os dois quando só um falhou.
- **Nenhuma frase honesta dentro de placeholder** (lição já paga em 016): estas quatro vivem em elementos de
  largura cheia, nunca dentro de um campo.
- **Falha de rede nunca vira "não é premium"** e nunca vira estes quatro estados: catálogo que não atualizou
  tem seu próprio aviso não-bloqueante ("Não foi possível atualizar as taxas" / "Usando a referência salva no
  dispositivo — o cálculo continua funcionando.").
- **Líquido negativo é mostrado, não corrigido nem clampado.**
- Contraste medido contra o fundo real do cartão (não contra o fundo da página) nos dois temas; qualquer
  alvo tocável ≥ 44px.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não presumido**: neste mesmo bloco, um rótulo longo sem espaços gerou 2.100px
  de rolagem a 1440px — e o culpado era um nó de texto pintando fora da caixa, invisível a qualquer medição
  de elemento. Nome de canal longo + frase de 92 caracteres em coluna estreita é o caso a desenhar.
- **Texto ocluso passa em teste**: um aviso empurrado para fora do cartão continua "presente". Mostre o
  cartão inteiro, com o aviso Shopee e os selos juntos, na altura real.
- **Valor grande estoura a coluna**: desenhe pelo menos uma linha com R$ 1.234,56 e uma com − R$ 1.234,56.
- **Seção Shopee mediu 1.248px de altura a 360px** e teve de colapsar um aviso para uma linha com ⓘ — não
  reintroduza blocos altos empilhados.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como first-class**, reutilizando os primitivos existentes —
`tf-card` para o cartão, `tf-brow` (com suas variantes `--muted`, `--negative`, `--total`) para as linhas de
dinheiro, `tf-alert--info`/`--compact` para os avisos Shopee, `tf-badge` para os selos de procedência,
`tf-info-tip` se algum estado precisar de detalhe sob demanda. Não crie primitivo novo; se um estado pedir
uma forma que não existe, componha-a com os que existem e diga o que compôs.
1. Bloco de canal precificado (referência) — 390 e 1280.
2. (a) um nível sem tarifa + o outro com números, no mesmo cartão — 390 e 1280.
3. (a') os dois níveis sem tarifa, na Shopee, com o aviso informativo acima — 390.
4. (b) líquido negativo com frete declarado — 390 e 1280.
5. (c) e (d) lado a lado, provando que se distinguem — 390.
6. Uma prancheta de comparação dos quatro estados fora de contexto, com a proposta de hierarquia
   (ícone? moldura? peso? cor?) explicada em uma linha cada.

## Perguntas em aberto para o dono
1. **(b) pode acontecer sem frete digitado?** A frase afirma "frete maior que a margem" como causa. Se o
   líquido puder ficar negativo por comissão + taxa fixa apenas, a frase mente nesse caso e precisa de duas
   redações — ou de uma redação que não afirme causa.
2. **(a) é aviso ou erro?** Ela hoje é vermelha, mas o vendedor não errou nada — quem não publicou a tarifa
   foi o marketplace. Ela vira tom neutro/atenção, ou o vermelho é intencional para travar a venda?
3. **(d) deve levar o vendedor ao campo culpado** (link/rolagem até o campo inválido do canal), ou continua
   uma frase passiva?

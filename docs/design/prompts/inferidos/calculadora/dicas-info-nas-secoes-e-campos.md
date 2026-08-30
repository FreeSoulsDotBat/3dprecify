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

- **Onde vive:** Dois usos espalhados por /calcular. (1) Colado a cada TÍTULO de seção: 'Custos da peça', 'Mão de obra e custos', 'Markup', 'Outros custos', 'Marketplace' (nas duas colunas) e 'Como chegamos no preço' (no rodapé) — seis lugares. (2) Na LINHA DO RÓTULO, à direita do nome do campo, em: gramas usadas, consumo médio, tarifa de energia, reserva de manutenção, taxa de falha, tempo/valor de acabamento, mão de obra e vida útil da máquina. Também aparece dentro do aviso compacto da Shopee, guardando o corpo do alerta.
- **Como o vendedor chega:** É acionado pelo vendedor: um glifo ⓘ que abre um texto curto explicando o que aquela seção calcula ou o que aquele número significa.
- **Vizinhança imediata:** No título de seção fica imediatamente à direita do texto do título, na mesma linha, acima do Card. No campo fica na linha do rótulo (é um irmão do rótulo, nunca aninhado dentro dele — mover para lá foi correção de homologação), à direita do nome e acima do controle.
- **Dados que chegam (e o que ela devolve):** Cada gatilho carrega um par nome+corpo, escritos a partir das fórmulas do produto ('Material = (custo do rolo ÷ peso do rolo) × gramas usadas…').
- **O que acontece depois:** Abre e fecha; não muda nada no cálculo. Os mesmos ⓘ aparecem, com o mesmo texto, na página de produto do Catálogo e no editor de linha de kit, que montam os mesmos campos.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Dicas ⓘ da calculadora — o gatilho, o cartão e a linha do rótulo

## O que desenhar
O sistema de dicas didáticas da calculadora: um glifo ⓘ que aparece (a) colado ao lado direito de cada **título de seção** e (b) à direita do **rótulo** de campos específicos, e o cartão flutuante que ele abre com 2 a 4 frases explicando *por que aquilo entra na conta* e *como o vendedor descobre o número dele*. Vive na aba **Calcular** (`/calcular`), a tela que o leigo abre primeiro, e reaparece integralmente dentro do editor de linha de kit (Premium). É o único lugar do produto onde o conceito é ensinado — quem nunca ouviu falar em "reserva de manutenção" ou "markup" só tem o ⓘ. Usado no meio do preenchimento, com o teclado aberto, normalmente na primeira vez que o vendedor esbarra num campo que não entende.

## Por que este prompt existe
Nada disso foi desenhado. O protótipo de 2026-07-02 usa `Tooltip` **uma única vez** e a §E4 (linha 234) fixa esse único hint: *Label do markup: "Markup"; hint: "Margem sobre o custo (não sobre o preço de venda)."* — e o `CalculatorScreen.jsx` (68-69) o colocava **dentro do `<label>`**, exatamente a construção que a homologação 016/B4 depois proibiu no app (um botão aninhado dobra o próprio nome no nome acessível do controle). A generalização para **6 títulos de seção** e **10 campos** foi decidida em código, caso a caso: densidade, tamanho do glifo, tom, e o lugar do gatilho. A passagem de "na linha do controle" para "na linha do rótulo" também foi correção de homologação (B4), não desenho — e ela nasceu de um defeito real: em "Tarifa de energia", com `R$` à esquerda e `/kWh` à direita, o ⓘ disputando a mesma linha deixou **1px de largura útil de input** a 360/390px.

## O que já existe hoje (não invente do zero — corrija)

**Seis títulos de seção, todos com ⓘ** (texto literal do título → nome acessível do gatilho):

| Título de seção | Rótulo do gatilho | O corpo explica |
|---|---|---|
| "Custos da peça" | "Sobre os custos da peça" | as 3 fórmulas: material, energia, máquina |
| "Mão de obra e custos" | "Sobre mão de obra e custos" | horas × valor da hora; outros custos |
| "Markup" | "Sobre o markup" | "Preço = custo total × (1 + markup%)" |
| "Como chegamos no preço" | "Sobre o cálculo do preço" | "Cada linha em reais soma exatamente ao custo total…" |
| "Marketplace" | "Sobre o marketplace" | "Anúncio = (preço + taxa fixa) ÷ (1 − comissão%)" |
| "Outros custos" | "Sobre outros custos" | itens nomeados que somam ao custo total |

→ **Problema 1 (o principal):** ⓘ em *praticamente todo* título. Nada distingue a seção que realmente precisa ensinar da que só herdou o padrão — "Como chegamos no preço" é, ela própria, a explicação, e ainda assim carrega um ⓘ.

**Dez campos com ⓘ no rótulo** (`fieldTips`), dos quais nove vivem nas grades de campos e um só aparece depois de "Ajustar horas direto":

| Rótulo visível | Prefixo/sufixo | Obrigatório | Rótulo do gatilho |
|---|---|---|---|
| "Gramas usadas" | `g` | sim | "Sobre as gramas usadas" |
| "Consumo médio" | `kW` | sim | "Sobre o consumo médio" |
| "Tarifa de energia" | `R$` + `/kWh` | sim | "Sobre a tarifa de energia" |
| "Vida útil da máquina" | `h` | sim (modo ajustar) | "Sobre a vida útil da máquina" |
| "Reserva de manutenção" | `R$` + `/h` | não → mostra "opcional" | "Sobre a reserva de manutenção" |
| "Taxa de falha" | `%` | não → "opcional" | "Sobre a taxa de falha" |
| "Tempo de acabamento" | `h` | não → "opcional" | "Sobre o tempo de acabamento" |
| "Valor do acabamento" | `R$` + `/h` | não → "opcional" | "Sobre o valor do acabamento" |
| "Mão de obra (horas)" | `h` | não → "opcional" | "Sobre a mão de obra (horas)" |
| "Valor da hora" | `R$` + `/h` | não → "opcional" | "Sobre o valor da hora" |

→ **Problema 2:** a linha do rótulo acumula três coisas que competem pela mesma largura numa grade de **duas colunas mesmo a 390px**: o rótulo (que reserva **duas linhas** de altura para manter os inputs alinhados), a palavra "opcional" empurrada para a direita, e o ⓘ. "Reserva de manutenção" quebra em duas linhas; "Mão de obra (horas)" quase.
→ **Problema 3:** o gatilho pinta 28×28px, mas a área de toque de 44px é um remendo assimétrico (estende −12px acima, −8px nos lados, −4px abaixo, porque abaixo há só 8px até o input). Isso é conta de sobrevivência, não desenho.
→ **Problema 4:** o mesmo glifo de 16px, com o mesmo botão de 28px, serve ao título de seção e ao rótulo de campo — não há hierarquia visual entre "esta seção inteira funciona assim" e "este campo significa isto".
→ **Problema 5:** o cartão mostra **só o corpo** — nenhum título visível. Quem vê "Sobre a tarifa de energia" é o leitor de tela; quem enxerga recebe um parágrafo solto.

## Conteúdo e dados reais
Os corpos são longos de propósito (todos ensinam a descobrir o número). Use estes textos verbatim nas pranchetas, sem reescrever:
- **Tarifa de energia:** "É o preço de cada unidade de luz — multiplicado pelas horas de impressão, vira o custo de energia da peça. Pegue sua conta de luz e divida o valor total pelos kWh consumidos no mês: esse é o preço real que você paga, já com impostos e bandeira. Sem a conta em mãos, a média do país fica perto de **R$ 0,85**." (esse R$ 0,85 é uma constante datada — projeção ANEEL dez/2026, revisão em 1º/jan.)
- **Vida útil da máquina** (o mais longo, ~330 caracteres, e o pior caso de altura do cartão): "…Fabricante não publica esse número: estime. Horas que você imprime por ano × anos até querer trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h."
- **Valor da hora:** "…quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.: R$ 3.000 ÷ 160 h = R$ 18,75."
- **Taxa de falha** (o mais curto): "…Ex.: 4 perdidas em 40 = 10%."

O cartão hoje: largura máxima `min(20rem, 100vw − 2 × gutter)`, corpo em `--fs-body-sm`, fundo `--surface-card`, borda `--border-subtle`, sombra média, seta apontando para o gatilho, lado preferido **acima** com 6px de folga e 12px de respiro contra a borda da tela. Nada disso vem da rede: **as dicas são texto estático**, sem carregamento, sem erro, sem gate de Premium.

## Estados obrigatórios
- **Repouso:** glifo em `--text-muted` sobre o fundo do cartão de seção. Quieto — é afordância inline, não controle primário.
- **Hover (só ponteiro fino):** glifo em `--accent-text` sobre `--accent-soft`, e o cartão **abre sozinho**. Em toque não existe hover: abre no tap.
- **Foco por teclado:** desenhe o anel de foco explicitamente — hoje ele é herdado e nunca foi especificado para um alvo de 28px com área de toque maior que ele.
- **Aberto/pressionado:** mesmo tratamento do hover; o cartão fica ancorado enquanto estiver aberto. Não é modal: nunca escurece nem bloqueia a página atrás.
- **Cartão acima × abaixo:** o lado padrão é acima; perto do topo ele vira para baixo. Desenhe os dois, com a seta.
- **Cartão colidindo com a borda a 390px:** encostado no respiro de 12px, com texto longo — o caso do "Vida útil da máquina".
- **Rótulo em duas linhas + "opcional" + ⓘ na mesma linha:** "Reserva de manutenção", coluna de ~165px.
- **Campo com aviso abaixo:** o ⓘ convive com um aviso de plausibilidade sob o input (ex.: "Confira o consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico…").
- **Campo com erro:** o erro **substitui** a legenda sob o campo ("Informe um número válido."); o ⓘ permanece intacto no rótulo.
- **Desabilitado / carregando / offline / Premium pausado: não existem aqui.** Não invente — a dica não depende de rede nem de assinatura, e fingir um estado seria mentir sobre a origem do texto.

## Viewports
- **390px (obrigatório):** é onde tudo dói — grade de duas colunas, teclado aberto, cartão de 20rem espremido. Desenhe também a seção "Custos da peça" inteira nesse tamanho, com todos os ⓘ visíveis ao mesmo tempo, para julgar densidade.
- **1280px (obrigatório):** a calculadora desktop redesenhada (018), onde existe hover real e o cartão tem espaço — decida se o comportamento muda ou se só respira.
- **360px:** não precisa de prancheta própria, mas é a largura de estresse que este projeto mede; se o desenho só cabe a 390, ele está errado.

## Regras que o desenho não pode quebrar
- O ⓘ mora na **linha do rótulo**, à direita do rótulo, **nunca na linha do controle** e nunca visualmente "dentro" do rótulo como se fosse parte do texto clicável dele — é irmão, não filho (B4: um botão aninhado no `<label>` corrompe o nome do controle).
- Alvo de toque **≥44×44px**, mesmo com o glifo pintando 28px — e a folga tem que caber sem colidir com o input logo abaixo (hoje sobram 8px).
- A dica **nunca altera cálculo nem validação**. Ela não pode parecer um botão de ação, um seletor ou algo que "aplica" o valor sugerido.
- Frase honesta **nunca dentro de placeholder** — os números de referência (R$ 0,85, salário mínimo por hora) vivem no corpo do cartão, em elemento de largura cheia, e devem se ler como *referência datada*, não como um valor que o app usou na conta.
- Contraste do glifo em repouso medido **contra o fundo real do cartão de seção** — em ambos os temas. `--text-muted` sobre `--surface-card` é o par a verificar.
- O cartão nunca ultrapassa a borda da tela a 390px, e nunca cobre o campo que ele está explicando enquanto o vendedor digita.

## Armadilhas já pagas neste projeto
- **1px de input** ("Tarifa de energia"): três afixos disputando uma linha numa coluna de metade de 390px. Qualquer desenho que devolva o ⓘ para perto do `/kWh` repete o defeito.
- **Elemento ocluso passa no teste**: `toBeVisible` é verdadeiro para um campo totalmente coberto pelo cartão da dica. Oclusão é geometria, não texto — desenhe onde o cartão pousa.
- **Escape que se desfaz sozinho**: fechar pelo teclado com o mouse parado sobre o gatilho reabria a dica imediatamente. Se o desenho depende de hover, ele precisa dizer o que acontece depois do Escape.
- **Rótulo que quebra e desalinha a grade**: os inputs de duas colunas só ficam alinhados porque o rótulo reserva duas linhas de altura. Um ⓘ que force uma terceira linha quebra o alinhamento inteiro.
- **Número que colide com outro número**: o tooltip da tarifa já disse R$ 0,85 enquanto o aviso do mesmo campo dizia R$ 0,95 — duas médias nacionais a uma tecla de distância.

## Entregável
Seis pranchetas, **tema escuro como padrão e tema claro como first-class** (as duas versões de cada uma):
1. **Anatomia do gatilho** — repouso, hover, foco por teclado, aberto; com a área de toque de 44px desenhada como overlay cotado sobre o glifo de 28px.
2. **O cartão** — corpo curto ("Taxa de falha") e corpo longo ("Vida útil da máquina"), lado acima e lado abaixo, com seta; e a decisão sobre título visível dentro do cartão.
3. **A linha do rótulo, os 4 casos difíceis** — "Tarifa de energia" (R$ + /kWh), "Reserva de manutenção" (2 linhas + "opcional"), "Taxa de falha" (%), "Gramas usadas" (g), na coluna estreita de 390px.
4. **Título de seção com ⓘ** — as 6 seções, mostrando a hierarquia proposta entre o ⓘ de seção e o ⓘ de campo.
5. **Densidade a 390px** — "Custos da peça" completa, todos os ⓘ ao mesmo tempo: o desenho que responde "quantos sobrevivem".
6. **1280px** — a mesma seção no desktop, com hover.

Reutilize os primitivos existentes, sem criar novos: o gatilho é `tf-infotip__trigger` com o `Icon name="info"` de 16px; o cartão é `tf-infotip__content` + `tf-infotip__arrow`; a linha do rótulo é `tf-field__label-row` (rótulo `tf-field__label`, asterisco `tf-field__req`, "opcional" `tf-field__optional`), e o controle é o `NumberField` com prefixo/sufixo. Se algum caso exigir um primitivo novo, diga qual e por quê em vez de desenhá-lo calado.

## Perguntas em aberto para o dono
1. **Densidade das seções:** ⓘ em todos os 6 títulos foi decisão de código, não sua. Quais seções realmente precisam ensinar? ("Como chegamos no preço" já é a explicação; "Markup" e "Marketplace" carregam fórmula.)
2. **O cartão mostra título visível?** Hoje o nome ("Sobre a tarifa de energia") existe só para leitor de tela; o vendedor vê um parágrafo sem cabeça.
3. **Os números de referência devem exibir data/fonte?** ("média do país perto de R$ 0,85" é projeção ANEEL dez/2026, revisável em 1º/jan.)
4. **No editor de linha de kit (Premium), a densidade é a mesma?** Lá os mesmos campos repetem várias vezes na tela, e com eles todos os ⓘ.
5. **No desktop, a dica precisa de um modo "fixado"** para o vendedor ler a conta enquanto digita, ou sair no primeiro movimento do mouse está certo?

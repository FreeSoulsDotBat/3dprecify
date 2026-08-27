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

- **Onde vive:** Penúltimo bloco de dentro do cartão de canal: uma linha `flex-wrap` logo abaixo das chaves de taxa opcional e acima dos avisos da Shopee.
- **Como o vendedor chega:** Ele aparece sozinho assim que o canal tem um resultado — o vendedor não o aciona, ele o lê depois de preencher as taxas.
- **Vizinhança imediata:** Acima: as chaves de taxa opcional (ou, se não houver, as legendas de faixa/subsídio, ou a grade de taxas). Abaixo: os avisos da Shopee, se for um canal Shopee; senão, o fim do cartão. Na mesma linha podem coexistir até três pílulas: o selo principal, um selo de 'estimativa' (subsídio de frete do ML) e um selo SEPARADO para a origem da taxa fixa.
- **Dados que chegam (e o que ela devolve):** Cinco estados vindos do cálculo do canal — referência, catch-all publicado, ajustado pelo vendedor, estimativa, sem referência — com dois modificadores: embutido (semente offline) e desatualizado (fora da janela de 30 dias). O texto é montado em tempo de execução e passa de 80 caracteres ('Referência: <fonte> (para <categoria>) · atualizado em 06/07/2026 · desatualizado').
- **O que acontece depois:** Nada acontece ao tocar — é declaração, não controle. É a peça que impede que um número pré-preenchido seja lido como número conferido pelo vendedor.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Selo de procedência e vigência da tarifa (e o selo separado da taxa fixa)

## O que desenhar
O selo de honestidade que fecha cada **slot de canal** dentro da aba **Calcular** do Precifica3D. O vendedor escolhe um marketplace (Mercado Livre, Shopee, Amazon, Outro), o app **pré-preenche** comissão, taxa fixa e frete a partir do catálogo de tarifas, e o selo é a única coisa na tela que diz **de onde veio aquele número e quando ele foi conferido pela última vez** — ou que confessa que não veio de lugar nenhum. Ele aparece logo abaixo da grade de campos de taxa e das legendas do slot (banda aplicada, subsídio de frete Shopee, sobretaxas opcionais), e logo acima dos avisos de risco da Shopee. Podem coexistir **até três selos na mesma linha** (`flex-wrap`): o selo principal da comissão, o selo `estimativa de frete` e o selo separado da **taxa fixa**, quando ela tem fonte própria. Origem no código: `apps/web/src/features/calculator/fee-seal.tsx` + `fee-seal.css`, montado por `fee-prefill.ts` e posicionado em `calculator-form.tsx`.

## Por que este prompt existe
A auditoria classificou a peça como `PROTOTIPO_PARCIAL`. O que foi desenhado em 2026-07-02 foi uma **nota fixa** — "Taxas de referência — confirme as taxas atuais do canal" —, uma frase única, sem estados, sem data, sem categoria de origem, sem catch-all, sem "embutida (offline)", sem "pode estar desatualizada" e **sem segundo selo**. O que existe hoje é outra coisa: uma união de **5 estados** com **2 modificadores** que compõem, texto montado em runtime, e nada disso passou por desenho. A prova material está no CSS: `fee-seal.css` sobrescreve o `Badge` do DS (`white-space: normal`, `text-align: left`, `line-height: 1.3`, borda hairline) porque o primitivo foi desenhado para status curto e o selo carrega parágrafo. **O componente foi dobrado para caber.** E a homologação 015 mediu o pior efeito: ele era o elemento de **menor peso visual** do painel enquanto os campos ao lado estavam vazios e o preço já vinha descontado.

## O que já existe hoje (não invente do zero — corrija)
A peça é um `Badge` (`tf-badge`) com tom `info` ou `neutral`, texto concatenado. Os 5 estados e os textos **literais** de hoje:

| Estado | Texto renderizado hoje (literal) | Tom |
|---|---|---|
| `reference` (online) | `Referência: Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias) · atualizada em 06/08/2026` | `info` |
| `reference` + categoria de origem | `Referência: Tabela de comissões da Amazon — Casa e Cozinha (comissão sobre base que inclui frete) (para Casa e Cozinha) · atualizada em 06/08/2026` | `info` |
| `reference` + `embedded` | `referência embutida (offline) (para Calçados) · atualizada em 06/08/2026` | `neutral` |
| `reference` + `stale` | `… · pode estar desatualizada` (sufixo que **compõe** com `embedded`) | `neutral` |
| `catchAll` | `categoria não informada — usando a maior alíquota da tabela` | `neutral` |
| `catchAll` + `embedded` + `stale` | `referência embutida (offline) · categoria não informada — usando a maior alíquota da tabela · pode estar desatualizada` | `neutral` |
| `adjusted` | `ajustado por você` | `neutral` |
| `estimate` | `estimativa de frete` | `info` |
| `none` | `sem referência — informe as taxas` | `neutral` |
| `FixedFeeSourceBadge` | `Taxa fixa: Amazon — Preços e planos · vigente desde 01/03/2026` | `neutral` |

→ **Problema 1 — comprimento.** O texto real do estado `reference` tem **~160 caracteres**, porque o campo `source` do catálogo é uma citação inteira ("Central de Educação do Vendedor Shopee — Política de Comissão 2026, vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias)"). Isso não é uma pílula: é um parágrafo dentro de um `border-radius: pill` de `min-height: 24px`. Desenhe a forma que esse conteúdo pede.
→ **Problema 2 — hierarquia invertida.** O selo é hoje `--fs-caption`, `--bg-muted` (que no tema escuro **é a mesma cor da superfície do card**, daí a borda hairline de emergência), enquanto o preço grande ao lado grita. O elemento que separa "este número é seu" de "este número é um palpite do catálogo" é o mais fraco da tela.
→ **Problema 3 — a redundância que já foi medida.** Na Amazon o `source` **já contém** o nome da categoria, e o código só omite o sufixo `(para …)` quando detecta a repetição literal — ou seja, o desenho precisa de um lugar próprio para a categoria de origem, não de um sufixo entre parênteses.
→ **Problema 4 — três selos numa linha.** `flex-wrap: wrap` com três badges de comprimentos muito diferentes não tem hierarquia nenhuma: o selo da taxa fixa (curto) pode acabar na primeira linha e o principal (longo) empurrado para baixo. Nada diz qual selo se refere a qual número.
→ **Problema 5 — o link nunca renderizado.** O catálogo carrega `sourceUrl` (ex.: `https://seller.shopee.com.br/edu/article/26839`) em toda entrada. **O selo nunca o mostra.** A fonte é citada e não é alcançável.

## Conteúdo e dados reais
- **Fonte (`source`)**: string livre do catálogo, **1 a ~140 caracteres**, obrigatória. Exemplos verdadeiros acima. Nunca abrevie no desenho sem dizer como o texto completo é alcançado.
- **Data de conferência (`lastReviewed` → "atualizada em")**: ISO → `dd/mm/aaaa`, ex.: `06/08/2026`. É a data em que **nós conferimos**, não a data em que o app baixou.
- **Vigência (`effectiveDate` → "vigente desde")**, só no selo da taxa fixa: ex.: `01/03/2026`.
- **Janela de desatualização**: **45 dias** (31 do ciclo mensal do robô + 14 de folga de entrega). O comentário do componente ainda diz "30-day window" — está **desatualizado no código**, use 45.
- **Categoria de origem (`originCategoryName`)**: opcional; pode ser um **ancestral** da categoria escolhida ("Calçados" quando o vendedor escolheu "Tênis de corrida").
- **Números que o selo respalda** (aparecem nos campos logo acima, não no selo): Comissão `20%`, Taxa fixa `R$ 4,00`, taxa por item Amazon Individual `R$ 2,00`, teto de cupom Shopee `R$ 20,00 / R$ 30,00 / R$ 40,00`. Preço da semente para composição: `R$ 24,24`.
- Nada no selo é editável e nada nele é derivado de conta do usuário: é 100% procedência.

## Estados obrigatórios
1. **`reference` online (repouso)** — tom `info`. Mostra `Referência: {fonte} · atualizada em {data}`. É o único estado "tudo certo" e mesmo assim **não é um selo verde**: não é aprovação, é atribuição.
2. **`reference` com categoria de origem** — acrescenta `(para {categoria})`. Precisa deixar claro que a alíquota é da categoria **nomeada**, que pode não ser a que o vendedor escolheu.
3. **`embedded` (offline / semente embutida)** — `referência embutida (offline)`. **Sem citar fonte nenhuma** (o head troca de lugar). É o estado que mais envelhece.
4. **`stale` (passou dos 45 dias)** — sufixo `· pode estar desatualizada`. **Compõe** com `embedded` e com `catchAll` — desenhe a combinação, não só o caso isolado.
5. **`catchAll`** — `categoria não informada — usando a maior alíquota da tabela`. Deliberadamente **não** é tom `info`: o vendedor está aceitando a maior alíquota da tabela e precisa ver isso como alerta brando, nunca como confirmação.
6. **`adjusted`** — `ajustado por você`. O usuário sobrescreveu o pré-preenchido; a procedência do catálogo deixou de valer.
7. **`none`** — `sem referência — informe as taxas`. O catálogo não cobre este slot; os campos estão vazios e é o vendedor que tem de digitar. **É o estado mais perigoso da lista** e hoje é o mais discreto.
8. **`estimate`** — `estimativa de frete`, selo adicional ao lado do principal (subsídio ML/Shopee).
9. **Selo da taxa fixa** (`Taxa fixa: {fonte} · vigente desde {data}`) — coexiste com o principal, respalda um **número diferente**.
10. **Foco de teclado / hover** — hoje **não existem**: o selo é um `span` estático. Se o desenho tornar a fonte alcançável (ver Perguntas), foco visível e alvo ≥44px passam a ser obrigatórios.
11. **Ausência total** — sem `outcome` (slot ainda sem cálculo) nada renderiza. Mostre esse vazio para que ele não seja confundido com "sem referência".

## Viewports
- **Mobile 390px** — obrigatório: é a largura de trabalho do vendedor e onde o texto de 160 caracteres realmente vive.
- **Mobile 360px** — obrigatório como **teste de estresse** do estado mais longo (`referência embutida (offline) · categoria não informada — usando a maior alíquota da tabela · pode estar desatualizada`) com os **três selos** presentes. Foi a 360px que este projeto já mediu overflow horizontal real.
- **Desktop 1280px** — a Calculadora renderiza no desktop e o canvas 018 **não cobre a aba Calcular**; hoje o selo simplesmente estica. Desenhe o que ele deve virar quando há largura sobrando (não é "a mesma pílula, mais larga").

## Regras que o desenho não pode quebrar
- **Procedência sempre nomeia o que ela respalda.** O selo da taxa fixa é separado justamente porque uma procedência que não diz de qual número ela é não é procedência.
- **Nunca apresentar tarifa de terceiro como fato nosso.** Nenhum estado pode ler como selo de aprovação/verificação.
- **Degradação dita, não escondida**: `offline`, `desatualizada` e `catch-all` são informações do usuário, não detalhes técnicos a esconder atrás de ícone mudo.
- **`catchAll` e `reference` nunca compartilham o mesmo tom.** Igualá-los é como o vendedor termina com a alíquota errada achando que é a dele.
- **Frase honesta fora de placeholder** e em elemento de largura total quando precisar — este projeto já cortou uma frase honesta pela metade dentro de um campo estreito.
- **Contraste medido contra o fundo real do card** nos dois temas — no escuro o `--bg-muted` do badge neutro coincide com a superfície do card.
- **Alvo ≥44px** para qualquer parte que vire clicável.
- O selo **não pode ser o elemento de menor peso visual do painel** quando o estado é `none`, `catchAll` ou `stale`.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido a 360px** (016/PR-B): `white-space: nowrap` no badge forçava a linha inteira como `min-content`; a correção foi feita no CSS, não no desenho.
- **Texto ocluso passa em teste** (014): `toBeVisible`/`toContainText` aprovam um elemento totalmente sobreposto ou estourado — layout se afirma com **caixas**, não com texto.
- **Sufixo cortado em campo estreito** (016/PR-F): a regra "taxa fixa = 50% do preço" virava `2,50 (= 50` em 77–187px úteis; por isso frases honestas saíram dos placeholders.
- **Selo invisível no tema escuro**: o fundo do badge neutro empatava com o card, e a borda hairline foi um remendo — resolva no desenho.
- **Slot com campos vazios e preço já descontado** (015): quando o pré-preenchimento falha, o vendedor vê um preço "pronto" com uma explicação minúscula ao lado.

## Entregável
Pranchetas, nos **temas escuro (padrão) e claro (first-class)**:
1. **Anatomia do selo** — a forma nova para texto longo, com os slots nomeados: rótulo do estado, fonte, categoria de origem, data, marca de desatualização.
2. **Os 9 estados em repouso**, empilhados e comparáveis, cada um com o texto pt-BR **literal** desta ficha.
3. **As combinações compostas**: `embedded + stale`, `catchAll + embedded + stale`, `reference + categoria de origem`.
4. **A linha de até três selos** (principal + `estimativa de frete` + `Taxa fixa`) a 390px e a 360px, com a hierarquia entre eles resolvida.
5. **O slot inteiro em contexto** a 390px e 1280px: grade de taxas → legenda de banda → selos → avisos Shopee.

Reutilize os primitivos existentes em vez de criar novos: o `tf-badge` (tons `neutral`/`info`) como base do selo — se a forma final precisar deixar de ser pílula, diga **qual** primitivo ela passa a ser em vez de inventar um componente órfão; `tf-card` como superfície do slot de canal; a escala de texto `--fs-caption` como piso, não como teto; e os tokens de status já existentes para os tons. Se o desenho exigir um primitivo novo (por exemplo, um bloco de procedência multilinha), **nomeie-o e justifique** — não o desenhe como exceção local de uma peça.

## Perguntas em aberto para o dono
1. **`sourceUrl` existe no catálogo e nunca é mostrado.** A fonte deve virar link alcançável (abrindo `seller.shopee.com.br/edu/article/26839`, `venda.amazon.com.br/precos`)? Isso muda a peça de estático para interativo — foco, hover, alvo ≥44px, e a decisão de abrir fora do app.
2. **O selo `none` ("sem referência — informe as taxas") merece virar aviso de bloqueio** em vez de pílula discreta? É o caso em que o app não sabe nada e o vendedor precisa agir.
3. **`stale` deve ter tom próprio** (alerta) em vez de reusar `neutral`, ou o alarme perde valor por disparar de mês em mês?
4. **A citação longa da fonte pode ser truncada** com o texto completo atrás de um "ver fonte"/tooltip, ou a procedência tem de aparecer inteira e sempre? (Truncar é decisão de produto, não de layout — este projeto já decidiu o contrário para frases de honestidade.)
5. **`Referência` vs `Taxa fixa`**: os dois selos usam rótulos com peso diferente ("Referência" nomeia a natureza, "Taxa fixa" nomeia o número). Deve haver um padrão único de rótulo — ex.: `Comissão: …` / `Taxa fixa: …`?

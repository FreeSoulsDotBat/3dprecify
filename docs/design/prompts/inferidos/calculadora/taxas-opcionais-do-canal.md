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

- **Onde vive:** Dentro do cartão de canal, entre as legendas (faixa/regra e subsídio de frete) e a linha dos selos.
- **Como o vendedor chega:** Não é acionado: renderiza sozinho quando o catálogo daquele marketplace publica alguma taxa opcional (hoje, o manuseio de item volumoso da Shopee). Sem nenhuma, o bloco simplesmente não existe.
- **Vizinhança imediata:** Acima: a legenda de subsídio de frete (Shopee) ou a legenda de faixa/regra, ou a grade de taxas. Cada item é um rótulo de largura total com o interruptor do DS e, logo abaixo, uma legenda de duas partes ('R$ X por pedido · fonte, dd/mm/aaaa'). Abaixo do bloco: a linha `flex-wrap` dos selos de vigência.
- **Dados que chegam (e o que ela devolve):** Rótulo, valor e procedência vêm inteiros do catálogo — nenhuma palavra ou número está escrito no código.
- **O que acontece depois:** Ligar a chave soma a taxa ao custo do canal, mudando anúncio e líquido daquele canal no bloco 'Preços por canal', no rodapé.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Chave de taxa opcional do canal (ex.: "Manuseio de item volumoso" da Shopee)

## O que desenhar
Dentro do card de um canal na calculadora (aba **Calcular**, seção "Incluir marketplaces no preço"), o marketplace pode publicar **encargos opcionais** que o vendedor liga ou desliga para AQUELA peça — hoje existe exatamente um no catálogo: a taxa de manuseio de item volumoso da Shopee, R$ 50,00 por pedido. A peça é o bloco que apresenta esse encargo: um controle liga/desliga, o rótulo que vem do catálogo, e a legenda que diz quanto custa, como incide e de onde o número saiu. Ela aparece depois da grade de taxas do canal (Comissão / Taxa fixa / Frete) e antes do selo de honestidade do slot. Quem usa: o vendedor leigo, no meio do preenchimento, decidindo se a peça que ele acabou de calcular é volumosa — e ligando um encargo que muda o preço do anúncio em dezenas de reais.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho conhece essa peça: busca por "surcharge", "volumoso" e "taxa opcional" nas quatro dá **zero**. O protótipo de 2026-07-02 desenha o canal com apenas dois eixos — "taxa fixa (R$) + comissão (%)" (§E4) — e não previu um encargo opcional. Tudo o que existe hoje foi inferido por IA: que o encargo seria uma **chave** (e não um chip, um checkbox de lista ou um campo de valor), que a proveniência ficaria numa legenda EMBAIXO, o que acontece com N encargos e o que acontece com zero. O preço material dessa inferência já foi pago: o controle nasceu como `<input type="checkbox">` nativo de **13×13px** — o único checkbox nativo de todo o código, fora do sistema que garante ≥44px em qualquer outro controle — e só virou `Switch` do DS depois que a homologação A2 **mediu** o alvo. O Switch existe entre os 32 primitivos, mas o protótipo só o usa em toggles de demonstração na Conta; ter o primitivo não é ter o bloco desenhado.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro do card do canal, de cima para baixo: marketplace → modalidade/categoria → perfil do vendedor (só Shopee) → **grade de taxas 2×2** → legenda de faixa de preço → legenda de subsídio de frete → **[esta peça]** → selo de honestidade → avisos da Shopee.

| Elemento | Como está hoje | Observação |
|---|---|---|
| Controle | `Switch` do DS, à esquerda | ✅ alvo ≥44px garantido por construção; ele é o `<label>` inteiro (clicar no texto alterna) |
| Rótulo | `"Manuseio de item volumoso"` — vem do catálogo, ao lado do Switch | ✅ nenhum texto inventado no código |
| Legenda | uma única linha de parágrafo, `--fs-caption`, `--text-muted`, largura total, abaixo da chave | → **problema**: são ~330 caracteres colados por " · " |
| Título do bloco | **não existe** | → o encargo aparece sem nenhuma palavra que o classifique como "opcional" ou "do canal" |
| N encargos | pilha vertical, `gap` pequeno, sem separador e sem cabeçalho | → com 2+, as legendas longas viram um muro indistinguível |
| Vazio | o bloco **não renderiza** (Mercado Livre e Amazon hoje) | correto, mas nunca foi desenhado |
| Efeito no resultado | **nenhum feedback local** — o preço muda lá em cima, na área de resultados | → ligar R$ 50,00 não dá recibo nenhum perto do controle |

A legenda literal, montada, hoje é esta única string:

> "R$ 50,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido). · Fonte: Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos, vigente desde 02/02/2026."

→ Cada frase dela existe por um motivo homologado (a taxa é por PEDIDO, não por item; a comissão incide sobre o encargo; a fonte é pública e datada) — **nenhuma pode ser cortada**. O problema é de forma, não de conteúdo: em 390px isso são 8–10 linhas de texto cinza-muted sob uma chave desligada, para um encargo que talvez nem se aplique. O desenho precisa dar hierarquia a isso (valor em destaque · regra de incidência · proveniência), possivelmente revelando parte só quando a chave está ligada.

→ Segundo problema: a legenda mostra **proveniência** ("Fonte: …, vigente desde 02/02/2026") mas nunca **frescor**. O dado carrega `lastReviewed: "2026-08-06"` e ele não aparece em lugar nenhum — enquanto a grade de taxas logo acima exibe selo com "atualizada em", "pode estar desatualizada" ou "referência embutida (offline)". Um encargo de R$ 50,00 com catálogo velho não avisa nada.

## Conteúdo e dados reais
- **Rótulo** (do catálogo): "Manuseio de item volumoso".
- **Valor**: R$ 50,00 — formatado em pt-BR, sempre com centavos. Faixa plausível de outros encargos futuros: R$ 1,00 a R$ 200,00 (desenhe a caixa aguentando "R$ 1.234,56").
- **Incidência**: por **pedido** (`appliesPer: "ORDER"`) — some inteira uma vez, não é rateada entre os itens. Um encargo futuro pode ser por item; o desenho não pode assumir "por pedido" como palavra fixa.
- **Fonte** (texto longo, do catálogo): "Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos". Existe também um `sourceUrl` (`seller.shopee.com.br/edu/article/3305`) que **hoje não é mostrado nem clicável** — se deve virar link é decisão do dono.
- **Datas**: vigente desde 02/02/2026; revisado em 06/08/2026 (dd/mm/aaaa, sempre).
- **Opcionalidade**: desligado é o padrão e é o estado em que a conta fica idêntica à de antes deste eixo existir. Nada é pré-marcado.
- **Derivado**: nada aqui é editável — valor, rótulo, fonte e datas são leitura pura do catálogo. O vendedor só decide sim/não.

## Estados obrigatórios
- **Repouso desligado** (o padrão): chave off, rótulo, legenda. Deve ler como "isto não está na sua conta".
- **Ligado**: chave on + evidência visível de que R$ 50,00 entrou no custo deste canal. Este é o estado que hoje não dá recibo nenhum.
- **Foco** (teclado): anel de foco visível na chave, contra o fundo do card do canal — não contra o fundo da página.
- **Hover** e **pressionado**: no alvo inteiro (chave + rótulo), já que o rótulo alterna.
- **Desabilitado**: o código nunca desabilita esta chave hoje — mas o toggle-mãe "Incluir marketplaces no preço" é desabilitado no free com a frase **"Vender em marketplaces faz parte do Premium."**. Desenhe o caso: com a seção de marketplaces fora, este bloco simplesmente não existe (não é uma chave cinza com cadeado).
- **Vazio**: marketplace sem encargos publicados (ML, Amazon) — o bloco não renderiza. Mostre a prancheta do card SEM ele, para provar que nada fica "faltando".
- **Múltiplos**: dois encargos empilhados, cada um com sua legenda longa — o caso que quebra a leitura.
- **Offline / referência embutida**: o app roda offline com o catálogo semeado; a chave continua funcionando e o número continua real. Precisa de uma marca de que a referência é a embutida — hoje só a grade de taxas acima carrega isso ("referência embutida (offline)").
- **Degradado / desatualizado**: catálogo antigo (o selo do slot já diz "pode estar desatualizada") — o desenho decide se o encargo herda esse aviso ou não.
- **Sem permissão / premium pausado**: idem desabilitado — a seção inteira sai; nunca uma chave que parece clicável e não faz nada.

## Viewports
- **Mobile 390px** — obrigatório e é o caso difícil: card de canal já denso, legenda de ~330 caracteres, chave de 44px, mais duas legendas acima (faixa de preço, subsídio de frete) e o selo abaixo.
- **Desktop 1280px** — a calculadora existe no desktop e o card do canal fica numa coluna estreita ao lado do resultado; a legenda não ganha largura infinita.
- **1920px** opcional, só se a decisão de largura máxima da legenda mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- **A frase honesta nunca mora dentro de um placeholder nem de um campo estreito** — este projeto já cortou uma frase para "2,50 (= 50". Legenda de honestidade vive em elemento de largura total.
- **Procedência sempre junto do número**: fonte + data visíveis, no mesmo bloco do valor; nunca só em tooltip.
- **Nenhum número inventado no desenho** além dos reais aqui listados — cada valor da tela vem do catálogo.
- **Desligado ≠ escondido**: o encargo existe no mundo mesmo desligado; o vendedor precisa poder descobrir que ele existe antes de ser cobrado por ele.
- **Falha de rede nunca vira "não é premium"** e catálogo velho nunca vira silêncio.
- **Alvo ≥44×44px** para a chave e para toda a área que alterna; contraste do texto muted medido contra o fundo REAL do card do canal (que não é o fundo da página).
- **Tema escuro é o padrão, claro é first-class** — a chave ligada precisa ser inequívoca nos dois.

## Armadilhas já pagas neste projeto
- O alvo de 13×13px desta mesma peça, achado só por **medição** na homologação A2 — qualquer controle que você desenhar aqui tem que ter o alvo declarado em pixels.
- **Texto ocluso/estourado passa em teste**: `toBeVisible` aprova elemento cortado. A legenda longa em 390px precisa ser desenhada com o texto REAL colado, não com "lorem".
- **Valor grande estoura a coluna**: desenhe também com "R$ 1.234,56" e com um rótulo de catálogo mais longo que "Manuseio de item volumoso".
- **Overflow horizontal medido**: a fonte é uma string longa sem espaços curtos ("Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos") — ela tem que quebrar linha, nunca empurrar o card.
- **Legenda que só o desenvolvedor lê**: o bloco hoje aparece entre duas outras legendas cinza de tamanho igual; sem hierarquia, tudo vira ruído e o encargo de R$ 50,00 é lido como rodapé.

## Entregável
Pranchetas, tema escuro e tema claro em pé de igualdade:
1. **390px — repouso desligado** (Shopee, um encargo), com a legenda completa real.
2. **390px — ligado**, mostrando como o desenho dá recibo dos R$ 50,00 no custo do canal.
3. **390px — dois encargos empilhados** (invente só a FORMA; use o mesmo dado duplicado com outro rótulo longo).
4. **390px — card de canal do Mercado Livre**, sem o bloco (estado vazio provado por ausência).
5. **1280px — card de canal completo**, com o bloco no contexto (grade de taxas acima, selo abaixo).
6. **Detalhe**: chave em repouso / hover / foco / ligado, com o alvo de toque desenhado como guia.

Reutilize os primitivos existentes, sem criar nada novo: o **Switch** do DS para a chave (ele já garante o alvo e a pele escura), o **Card** do canal como contêiner, o estilo de **caption** para a proveniência, e o **selo/badge** do slot como referência visual caso o encargo precise herdar frescor. Se algo aqui não couber em nenhum primitivo, diga qual e por quê em vez de desenhar um controle novo.

## Perguntas em aberto para o dono
1. A legenda longa deve aparecer **sempre**, ou parte dela (a regra "por pedido, comissão incide sobre ela") só quando a chave está **ligada**? A frase é homologada e não pode sumir de vez — a pergunta é de momento, não de conteúdo.
2. O encargo ligado deve mostrar seu impacto **localmente** (ex.: "+ R$ 50,00 no custo deste canal") ou basta o preço mudar lá no resultado? Isso decide se a peça ganha uma linha de valor própria.
3. O bloco deve ganhar um **título** (algo como "Taxas opcionais deste canal")? Hoje não tem nenhum, e com 2+ encargos a falta é sentida — mas o texto seria copy nova, não catalogada.
4. `sourceUrl` existe no dado e não é usado: a fonte deve virar **link clicável** para o artigo do marketplace, ou o app mantém a política de citar sem linkar?
5. Com catálogo **desatualizado ou embutido (offline)**, o encargo herda o aviso do selo do slot, ou o encargo opcional fica fora dessa sinalização por ser sempre uma escolha explícita do vendedor?

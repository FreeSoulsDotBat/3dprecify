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

- **Onde vive:** Primeiro bloco da coluna esquerda em /calcular (e o primeiro bloco do formulário em coluna única no mobile): título de seção 'Custos da peça' com ⓘ + um Card único sempre aberto.
- **Como o vendedor chega:** É a primeira coisa que o vendedor toca depois do topo da página. Chega com todos os campos vazios (ou pré-preenchidos se ele acabou de escolher um filamento/impressora em 'Usar do catálogo', logo acima).
- **Vizinhança imediata:** Acima: o cartão 'Usar do catálogo' (ou, no grátis, o cartão de teaser). Dentro do Card, em ordem: a grade `.tf-costs-grid` com SETE campos numéricos (Custo do rolo · Peso do rolo · Gramas usadas · Consumo médio kW · Tarifa de energia · Reserva de manutenção · Taxa de falha), depois o campo de Tempo de impressão (h+min) e por último o bloco inteiro da máquina. Abaixo do Card: o título 'Mão de obra e custos'.
- **Dados que chegam (e o que ela devolve):** Valores digitados pelo vendedor, ou escritos pelo bloco 'Usar do catálogo' (filamento → custo/peso do rolo; impressora → valor da máquina, vida útil, consumo, manutenção) e por uma simulação reaberta. Devolve os campos crus ao motor a cada tecla.
- **O que acontece depois:** Material, Energia, Máquina, Falha e Manutenção aparecem como linhas do detalhamento no rodapé. Um campo inválido apaga o resultado inteiro e o troca por um alerta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Seção "Custos da peça" — a grade que a calculadora abre inteira

## O que desenhar

O primeiro bloco de entrada da tela **Calcular preço** (`/calcular`) — e o mesmo bloco reaproveitado na
página cheia do produto no Catálogo. É um Card único, sempre aberto, com o título "Custos da peça" e um ⓘ
ao lado, onde o vendedor leigo digita tudo que forma o custo de produção de uma peça impressa: filamento,
energia, tempo, máquina, manutenção e falha. É a PRIMEIRA coisa que ele vê depois do cabeçalho da tela
(acima só existe, quando há catálogo, um card de "prefill" de filamento/impressora). Tudo que vem depois —
"Mão de obra e custos", "Markup", "Marketplace" e o detalhamento "Como chegamos no preço" — depende dos
números daqui. É gratuito: nenhum campo desta seção é premium, nenhum gate mora aqui.

## Por que este prompt existe

A ORGANIZAÇÃO desta seção nunca foi desenhada — foi inferida por um agente — e **contraria por escrito** o
protótipo de 2026-07-02, em três lugares. O protótipo cria o componente "Collapsible section — cabeçalho
tocável (≥44px) com chevron; usado nas seções avançadas da calculadora" (§D.2); o §E4 manda "Seções
COLÁVEIS (progressive disclosure): Energia · Máquina/Depreciação · Falha · Marketplace. Regra: mostre 1
aberta + 1 fechada — nunca tudo aberto de uma vez"; e o §I lista "Abrir todas as seções avançadas de uma
vez (intimida)" entre os antipadrões. O protótipo implementava isso literalmente (4 entradas básicas + três
seções coláveis). Hoje não existe UMA seção colável na feature inteira: os CAMPOS sobreviveram, a
organização desenhada foi negada.

## O que já existe hoje (não invente do zero — corrija)

Título da seção: **"Custos da peça"**, com ⓘ "Sobre os custos da peça" cujo corpo é:
"O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × gramas usadas. Energia = tempo de
impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão."

**Grade de 7 campos numéricos** (nesta ordem, todos no mesmo Card, sem separação visual entre obrigatório e
opcional além da tag "opcional" cinza à direita do rótulo):

| # | Rótulo (literal) | Prefixo/sufixo | Obrig.? | Semente | ⓘ / dica |
|---|---|---|---|---|---|
| 1 | Custo do rolo | R$ | sim | 100,00 | — |
| 2 | Peso do rolo | kg | sim | 1 | — |
| 3 | Gramas usadas | g | sim | 100 | ⓘ "Sobre as gramas usadas" |
| 4 | Consumo médio | kW | sim | 0,12 | dica sempre visível + ⓘ |
| 5 | Tarifa de energia | R$ … /kWh | sim | 1,00 | ⓘ "Sobre a tarifa de energia" |
| 6 | Reserva de manutenção | R$ … /h | **não** | 0 | ⓘ "Sobre a reserva de manutenção" |
| 7 | Taxa de falha | % | **não** | 0 | ⓘ "Sobre a taxa de falha" |

Dica sempre visível do campo 4: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)."

Depois da grade, no MESMO Card e sem título próprio:

- **Tempo de impressão** (obrigatório) — dois controles lado a lado: horas (aceita "2:30" digitado) e
  minutos, com sufixos "h" e "min". Semente 5 h / 0 min.
- **Valor da máquina** (obrigatório, R$) — semente **R$ 4.000,00**.
- **A pergunta da máquina**, em modo "ritmo" por padrão: dois selects — "Com que frequência ela roda?"
  (Poucas horas por semana · Quase todo dia · Praticamente o dia todo) e "Em quantos anos quer que ela se
  pague?" (1 anos … 5 anos) — seguidos da legenda derivada **"≈ R$ 1,11 por hora de impressão"** e do botão
  secundário pequeno "Ajustar horas direto".
- **Modo "ajustar"** (alternativo): some os dois selects e aparece o campo "Vida útil da máquina" em h
  (semente 3600) com seu ⓘ, mais o botão "Usar estimativa por ritmo".

→ **Problema 1 (o central):** três naturezas diferentes de controle — grade numérica, campo de tempo e uma
pergunta em linguagem natural — moram sob o mesmo título, sem hierarquia. O leigo leva 7 campos + tempo +
duas perguntas de uma vez.
→ **Problema 2:** obrigatório e opcional estão fundidos; a única distinção é a palavra "opcional".
→ **Problema 3:** a grade é `auto-fit` — o número de campos por linha é o que sobrar, não uma decisão. O
desenho deve DIZER quantos por linha em cada largura.
→ **Problema 4 (copy):** "1 anos" no primeiro item do select de payback.

## Conteúdo e dados reais

Todos os valores são texto pt-BR com vírgula decimal e máscara de milhar aplicada no **blur** — por isso
"R$ 4.000,00" só fica formatado depois do primeiro toque (desenhe já formatado, mas o estado cru existe).
Faixas plausíveis reais, extraídas dos avisos do produto: consumo médio perto de 0,12 kW
(acima de 5 kW já é chuveiro elétrico); tarifa perto da média nacional publicada; rolo de 1 kg; vida útil
1.200 h/ano × 3 anos = 3.600 h; taxa de falha tipo "4 perdidas em 40 = 10%". Com a semente completa o custo
total fecha em R$ 16,16 e o varejo em R$ 24,24 — use esses números nas pranchetas, não inventados.
Campos opcionais nascem em 0 e não contribuem com nada até serem tocados. Nada aqui é derivado, exceto a
legenda "≈ R$ 1,11 por hora de impressão", que é a divisão do valor da máquina pelas horas de vida útil.

## Estados obrigatórios

- **Repouso** (semente carregada, modo ritmo) — o estado da primeira visita.
- **Foco** — anel visível em campo, select e nos gatilhos ⓘ; a ordem de tabulação segue a leitura.
- **Hover / pressionado** — nos dois botões secundários e nos gatilhos ⓘ.
- **Erro de validação** — a mensagem SUBSTITUI a dica do campo. Frases literais: "Informe um número
  válido." · "Não pode ser negativo." · "Campo obrigatório." · "Valor muito alto." · "O peso do rolo deve
  ser maior que zero." · "A vida útil deve ser maior que zero."
- **Aviso de plausibilidade** — tom distinto de erro, entra como DICA, nunca como recusa. Ex.: "Confira o
  consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A
  etiqueta costuma trazer watts: 120 W são 0,12 kW. Nada foi recusado." Todo aviso termina em "Nada foi
  recusado." e é DESCRITIVO, nunca corretivo. Desenhe o campo com dica + aviso empilhados (o campo 4 pode
  ter os dois ao mesmo tempo).
- **Campo opcional em repouso** — tag "opcional" à direita do rótulo, valor 0.
- **Tooltip ⓘ aberto** — o corpo do texto é longo (3–4 frases); mostre um caso real, ex. o de "Sobre a taxa
  de falha".
- **Modo ritmo × modo ajustar** — as duas faces da pergunta da máquina, com o botão de troca em cada uma.

Não existem, nesta peça: carregando, vazio, offline, degradado, premium pausado ou sem permissão. O cálculo
roda offline e a seção é gratuita — não desenhe gate, selo nem skeleton aqui.

## Viewports

- **390px (mobile)** — obrigatório: é onde a seção é usada de verdade e onde a intimidação dói. Hoje a
  grade empacota 2 campos por linha.
- **1280px (desktop)** — obrigatório: o Card ocupa a COLUNA ESQUERDA de uma grade de duas colunas com
  largura de conteúdo limitada (~1120px), então sobra pouco mais de meia tela para ele. Diga quantos campos
  por linha cabem ali. 1920px é opcional — com a largura limitada, o desenho de 1280 se repete centralizado.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação**: o aviso de plausibilidade não pode ser vermelho nem parecer recusa — o
  produto aceitou o número.
- **Frase honesta nunca em placeholder**: avisos, dicas e a legenda "≈ R$ 1,11 por hora de impressão" moram
  em elementos de largura cheia; placeholder carrega só número.
- **Procedência do número derivado**: se a vida útil vem do ritmo, isso é dito em voz alta na legenda; o
  modo "ajustar" nunca some sem que o usuário tenha pedido.
- **Alvo ≥44px** em ⓘ, selects e nos dois botões secundários — o protótipo já exigia isso para o cabeçalho
  colável.
- **Contraste medido contra o fundo real do Card** (não o da página) — vale sobretudo para a tag "opcional"
  e para a legenda derivada. E zero rolagem a 360px, medida nos DOIS eixos.

## Armadilhas já pagas neste projeto

- **O clip de 1px**: "Tarifa de energia" carrega prefixo "R$" **e** sufixo "/kWh"; numa grade rígida de 2
  colunas a 360px sobrou 1px de largura visível para o NÚMERO. Qualquer coluna que você propuser precisa
  caber esse campo com folga real.
- **O reflow do grid**: mudar quantos campos cabem por linha reorganizou a leitura sem que ninguém
  decidisse. Decida.
- **Selects espremidos**: os dois da máquina precisavam de ~197px só de texto na opção mais longa e tinham
  87px a 360px — eles empilham em largura cheia quando não cabem. E "Em quantos anos quer que ela se
  pague?" quebra em 2 linhas: os dois rótulos reservam a mesma altura, senão um select desce sozinho.
- **Botão que não parece botão**: o "Ajustar horas direto" já foi texto puro sem borda; no toque não existe
  hover que revele a afordância.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como primeira classe (as duas para cada prancheta):

1. Mobile 390 — repouso, modo ritmo, semente completa.
2. Mobile 390 — um campo com erro + um campo com aviso de plausibilidade + um ⓘ aberto.
3. Mobile 390 — modo "ajustar horas direto".
4. Desktop 1280 — repouso, o Card na coluna esquerda, com entorno suficiente para se ver a proporção.
5. **Duas variantes de organização, lado a lado**, para o dono escolher: (A) tudo aberto como hoje, apenas
   com hierarquia e agrupamento visual; (B) o disclosure progressivo do protótipo — o essencial
   (material + tempo) aberto e os grupos avançados (Energia · Máquina · Falha) coláveis, com cabeçalho
   tocável e chevron, "1 aberta + 1 fechada".

Reutilize os primitivos `tf-*` existentes, sem criar novos: Card para o bloco, SectionTitle com ⓘ para o
título, Field (rótulo + tag "opcional" + dica + erro) para cada campo, NumberField com prefixo/sufixo para
os numéricos, Select para ritmo e payback, Button `secondary` `sm` para as trocas de modo, InfoTip para os
ⓘ. Se a variante B exigir um cabeçalho colável, ele é o componente do protótipo (§D.2) — desenhe-o como
primitivo novo apenas se o dono aprovar a variante B.

## Perguntas em aberto para o dono

1. **Volta o disclosure progressivo do protótipo (§E4: "1 aberta + 1 fechada, nunca tudo aberto") ou fica
   tudo aberto?** É a decisão que governa o desenho inteiro; hoje o código diz o contrário do desenho e
   ninguém registrou a mudança.
2. Se voltar: quais grupos? A divisão do protótipo era Energia · Máquina/Depreciação · Falha — Material e
   Tempo ficariam sempre visíveis?
3. Os dois campos opcionais (Reserva de manutenção, Taxa de falha) nascem visíveis ou atrás de um "ajustes
   finos"? Hoje a única distinção deles é a palavra "opcional".
4. A pergunta da máquina continua dentro de "Custos da peça" ou vira sua própria seção? São três naturezas
   de controle sob um título só.
5. "1 anos" no select de payback — corrigir para "1 ano" (singular)?

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

- **Onde vive:** Rodapé do Card 'Custos da peça' — o último bloco de dentro do cartão, abaixo do campo de tempo h+min.
- **Como o vendedor chega:** Descendo o primeiro cartão. Abre por padrão no MODO ESTIMATIVA; abre já no modo ajuste quando o valor de vida útil que veio de fora (simulação reaberta, impressora do catálogo) não corresponde a nenhuma combinação ritmo×payback.
- **Vizinhança imediata:** Acima: o campo de Tempo de impressão. Dentro do bloco, em ordem: campo 'Valor da máquina' (obrigatório, R$) → e então UM dos dois modos. Modo estimativa: dois selects lado a lado (a partir de ~240px cada; empilhados a 360/390px) — 'com que frequência ela roda' (3 opções) e 'em quantos anos quer que se pague' (1 a 5) — seguidos de uma legenda '≈ R$ X por hora de impressão' e de um botão secundário 'Ajustar horas direto' alinhado à esquerda. Modo ajuste: o campo cru 'Vida útil da máquina' (h) com ⓘ no rótulo e aviso de plausibilidade, mais um botão secundário de voltar. Abaixo do cartão inteiro: o título 'Mão de obra e custos'.
- **Dados que chegam (e o que ela devolve):** Lê o valor vivo de vida útil em horas do formulário e deduz o modo dele; escreve de volta as horas derivadas quando o vendedor mexe nos selects. A legenda de custo/hora é derivada de valor ÷ horas.
- **O que acontece depois:** Entra na linha 'Máquina' do detalhamento. Digitar 3 no campo cru de horas (pensando em anos) muda o custo/hora de R$ 1,11 para R$ 1.333,33 — daí o aviso.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# "Quanto custa a máquina" — a pergunta em linguagem natural, o custo/hora dito em voz alta e o modo de ajuste

## O que desenhar

O bloco final do card **"Custos da peça"**, na aba **Calcular** — a tela que qualquer visitante abre, sem
conta e sem premium. Ele vem depois da grade de campos de custo (rolo, peso, gramas, energia, tarifa) e do
campo de tempo de impressão (h + min), e é o último bloco antes do resultado. Quem o usa é um vendedor leigo
que acabou de comprar uma impressora e não sabe o que é depreciação: em vez de pedir "vida útil da máquina em
horas", a tela pergunta **quanto a máquina custou**, **com que frequência ela roda** e **em quantos anos ele
quer que ela se pague** — e devolve, em voz alta, quanto isso dá **por hora de impressão**. Existe um segundo
modo dentro do mesmo bloco, para quem já sabe o número e quer digitá-lo cru.

## Por que este prompt existe

Nada disto foi desenhado. Um agente decidiu que a pergunta viraria **dois Selects** (e não campos numéricos,
nem chips, nem um slider), decidiu o texto e a ordem das opções, decidiu que o número derivado seria uma
**legenda** e não um campo, e inventou a existência, o peso visual e a transição de um **segundo modo** dentro
do card. `autoridade: PROTOTIPO_PARCIAL` — há um ancestral real, e ele é parcial de um jeito específico: o
protótipo de 2026-07-02 (§E4/§E5 e os `-fixes` itens 34/17) desenha "responder o desgaste por uma escolha
nomeada em vez de digitar", mas **na aba Catálogo, no formulário de Impressora**, com o enum
"Básico 10% / Médio 20% / Profissional 30% / Intenso 45%" mapeando para um **percentual de desgaste** — não
para horas de vida útil, não com 3 ritmos × 5 paybacks, e não na tela Calcular. O `CalculatorScreen.jsx` do
protótipo (88-93) faz máquina com dois campos crus (Custo/hora × Horas). Ou seja: a ideia de "escolher em vez
de digitar" tem ancestral; **esta** peça — a pergunta em linguagem natural, a legenda derivada e o segundo
modo — não tem nenhum.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`MachineCostFields`) +
`machine-cost.ts` + os textos em `shared/i18n/messages.pt-br.ts`.

Ordem atual, de cima para baixo, dentro do card "Custos da peça":

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Campo dinheiro, obrigatório | rótulo **"Valor da máquina"** | prefixo `R$`, semente `4.000,00` |
| 2 | Select | **"Com que frequência ela roda?"** | 3 opções, ver abaixo |
| 3 | Select | **"Em quantos anos quer que ela se pague?"** | opções `1 anos` … `5 anos` |
| 4 | Legenda | **"≈ R$ 1,11 por hora de impressão"** | texto `--fs-caption` / `--text-muted` |
| 5 | Botão secundário `sm` | **"Ajustar horas direto"** | alinhado à esquerda |

Opções do ritmo, nesta ordem: **"Poucas horas por semana"** (260 h/ano) · **"Quase todo dia"** (1.200 h/ano) ·
**"Praticamente o dia todo"** (3.300 h/ano). Payback: 1 a 5 anos.

No **modo ajustar** os itens 2–5 somem e entram: o campo **"Vida útil da máquina"** (unidade `h`, obrigatório,
com ⓘ **"Sobre a vida útil da máquina"** na linha do rótulo) e o botão secundário `sm`
**"Usar estimativa por ritmo"** (a ficha da auditoria chamou este botão de "voltar" — o texto real é este).

Problemas que o desenho precisa resolver:

- → **"1 anos"**. O rótulo é o molde `"{n} anos"` aplicado a 1..5, e a primeira opção sai errada em português.
- → **A legenda derivada é o texto de MENOR contraste do card.** O número que justifica o bloco inteiro
  (`≈ R$ 1,11 por hora de impressão`) é caption cinza-mudo, com menos peso que qualquer rótulo de campo.
- → **No modo ajustar a legenda de custo/hora DESAPARECE.** Justamente o modo em que a pessoa digita o número
  cru — e erra — é o único sem o retorno "isso dá R$ X por hora".
- → **A troca de modo sobrescreve o que a pessoa digitou, calada.** "Usar estimativa por ritmo" reescreve as
  horas digitadas com ritmo × payback, sem aviso e sem desfazer.
- → **Os dois modos não se anunciam.** Não há título, nada nomeia "estimativa" contra "ajuste"; o segundo modo
  simplesmente troca o conteúdo do bloco.

## Conteúdo e dados reais

- **Valor da máquina** — dinheiro, obrigatório, prefixo `R$`, máscara de milhar aplicada no blur.
  Exemplo real (a semente da primeira visita): **R$ 4.000,00**.
- **Ritmo** — escolha, nunca digitado; 3 opções fixas (260 / 1.200 / 3.300 h/ano). Padrão: "Quase todo dia".
- **Payback** — escolha, 1 a 5 anos. Padrão: 3 anos.
- **Derivado** — `vida útil (h) = h/ano do ritmo × anos`; a semente 1.200 × 3 = **3.600 h**. O que aparece na
  tela é só **R$ 4.000,00 ÷ 3.600 h ≈ R$ 1,11 por hora de impressão** — as 3.600 h nunca são mostradas no modo
  estimativa. (Consequência real na tela: custo total R$ 16,16, varejo R$ 24,24, atacado R$ 21,01.)
- **Vida útil da máquina** (só no modo ajustar) — inteiro em horas, obrigatório, sufixo `h`.
  Erro de validação existente: **"A vida útil deve ser maior que zero."**
- **ⓘ "Sobre a vida útil da máquina"** — corpo já homologado: *"A impressora se gasta imprimindo. Espalhar o
  preço dela pelas horas faz cada peça devolver um pedaço da máquina — assim a próxima sai do negócio, não do
  seu bolso. Fabricante não publica esse número: estime. Horas que você imprime por ano × anos até querer
  trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h."*
- **Aviso de plausibilidade** (dispara com horas > 0 e < 100, abaixo do campo, sem recusar nada):
  *"Confira a vida útil: 3 horas é menos de uma semana ligada. Se você pensou em anos, multiplique pelas horas
  que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Nada foi recusado."*

## Estados obrigatórios

- **Repouso, modo estimativa** — os dois Selects preenchidos e a legenda derivada visível. É o estado da
  primeira visita.
- **Repouso, modo ajustar** — campo de horas + ⓘ + botão "Usar estimativa por ritmo". Abre por escolha da
  pessoa **ou** automaticamente quando o valor guardado não é produto de nenhum ritmo × payback (um cenário
  salvo, ou uma impressora do Catálogo, com 2.000 h, por exemplo) — o número guardado nunca é coagido.
- **Foco / hover / pressionado / desabilitado** de cada Select, do campo e dos dois botões.
- **Aviso de plausibilidade ativo** — o campo de horas com o texto acima abaixo dele, em tom de aviso, com o
  campo ainda aceitando o valor.
- **Erro de validação** — horas vazias ou zero: "A vida útil deve ser maior que zero."
- **Derivado impossível** — quando o valor da máquina está vazio ou a vida útil é 0, o custo/hora vira
  R$ 0,00. Desenhe o que a legenda diz nesse momento (hoje ela diz "≈ R$ 0,00 por hora de impressão", o que é
  uma afirmação falsa dita com a mesma confiança do número certo).
- **Transição entre os modos** — mostre os dois lados e o que acontece com o valor digitado ao voltar.

Não há estado de carregamento, de rede, de offline nem de premium **neste bloco**: o cálculo é local, a aba
Calcular é gratuita e nada aqui é gateado. Não desenhe cadeado, teaser nem "pausado" aqui.

## Viewports

- **390px (mobile)** — obrigatório, é a viewport principal do produto. Os dois Selects empilham em largura
  total; a opção mais larga ("Poucas horas por semana") mede ~197px de texto e não pode ser cortada nem
  reticenciada dentro do controle fechado.
- **1280px (desktop)** — obrigatório. Os dois Selects ficam lado a lado, cada um com no mínimo 240px, dentro
  do card "Custos da peça", que divide a tela com o painel de resultado. Mostre o bloco na largura real que
  ele tem nesse layout, não em largura livre.

## Regras que o desenho não pode quebrar

- **Procedência do número**: a legenda de custo/hora é um valor **derivado**, e o desenho precisa deixar claro
  que ele vem das duas escolhas acima — não é um campo, não é editável, e não pode parecer um.
- **Nada é recusado**: o aviso de plausibilidade **avisa**, não bloqueia. A frase termina em "Nada foi
  recusado." e essa promessa precisa ser visível no desenho.
- **Frase honesta fora de placeholder**: o aviso e a legenda derivada vivem em elementos de largura total; um
  placeholder de campo carrega apenas número.
- **Alvos ≥ 44px** nos dois Selects e nos dois botões, inclusive no mobile.
- **Contraste medido contra o fundo real do card** — inclusive (e principalmente) para a legenda derivada e
  para o texto do aviso, que hoje são os dois textos mais apagados do bloco.
- **O botão de trocar de modo precisa parecer clicável em repouso**, sem depender de hover ou foco: um
  aparelho de toque nunca passa por esses estados antes do toque.

## Armadilhas já pagas neste projeto

- **Digitar "3" pensando em anos** levava o custo/hora de R$ 1,11 para **R$ 1.333,33**, calado. O aviso existia
  no código, com teste verde, e **nenhuma tela o renderizava** — foi achado só por review humano, porque a
  bateria automatizada faz `continue` quando o campo não está montado, e a semente 3.600 h abre no modo
  estimativa, onde o campo nem existe. O desenho deste bloco é a defesa contra esse erro.
- **Rótulo de duas linhas desalinhando os Selects**: "Em quantos anos quer que ela se pague?" quebra em duas
  linhas onde "Com que frequência ela roda?" cabe em uma. Os dois rótulos reservam a mesma altura; desenhe as
  duas linhas de rótulo, não a versão curta idealizada.
- **Campo espremido em vez de reempilhado**: nesta mesma tela, uma coluna fixa deixou o número de um campo com
  1px visível a 360/390px. A regra é reempilhar, nunca comprimir — e o card não pode gerar rolagem lateral a
  390px com o texto real das opções.

## Entregável

Pranchetas, no **tema escuro** (padrão) e no **tema claro** (first-class, não uma nota de rodapé):

1. 390px — modo estimativa, repouso, com R$ 4.000,00 e "≈ R$ 1,11 por hora de impressão".
2. 390px — modo ajustar, repouso, com ⓘ aberto num recorte à parte.
3. 390px — modo ajustar com o aviso de plausibilidade ativo (valor 3) e com o erro de validação (valor 0).
4. 1280px — o bloco dentro do card "Custos da peça", Selects lado a lado.
5. Uma prancheta de estados: foco/hover/pressionado/desabilitado dos dois Selects e dos dois botões.
6. Um recorte da transição entre os modos, mostrando o que acontece com o valor digitado.

Reutilize os primitivos `tf-*` existentes, sem criar novos: `Card` para o contêiner, `Field` (rótulo +
`labelAddon` para o ⓘ + slot de aviso) para cada controle, `Select` para ritmo e payback, `NumberField`
(currency para o valor, `unit="h"` para as horas) para os campos, `InfoTip` para o ⓘ e `Button variant
secondary size sm` para os dois botões de troca de modo. Se a solução exigir um primitivo novo, diga qual e
por quê, em vez de desenhá-lo.

## Perguntas em aberto para o dono

1. **Trocar de modo destrói o número digitado?** Voltar para "Usar estimativa por ritmo" reescreve as horas
   digitadas sem avisar. Confirma pedir, avisar, ou manter o descarte calado?
2. **O que a legenda diz quando não há número honesto** (valor da máquina vazio ou vida útil 0)? Hoje ela
   afirma "≈ R$ 0,00 por hora de impressão".
3. **As 3.600 h derivadas devem aparecer no modo estimativa**, junto do custo/hora, ou o número em horas é
   deliberadamente escondido de quem escolheu não pensar em horas?
4. **"1 anos"**: vira "1 ano" (texto por opção) ou o rótulo muda de forma?
5. Quando o valor da máquina e a vida útil **vieram de uma impressora do Catálogo** (premium), este bloco
   deveria dizer isso? Hoje não diz nada, e o modo ajustar pode abrir sozinho por causa disso.

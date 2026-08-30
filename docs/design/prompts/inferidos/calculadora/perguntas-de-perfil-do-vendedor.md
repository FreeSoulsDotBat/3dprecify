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

- **Onde vive:** No MEIO do cartão de canal: logo abaixo do seletor de categoria e logo acima da grade de taxas. Só onde o catálogo do marketplace tem esse eixo (hoje, Shopee).
- **Como o vendedor chega:** O vendedor está descendo o cartão e encontra duas perguntas sobre ELE, não sobre a peça. A segunda só nasce quando a primeira for CPF.
- **Vizinhança imediata:** Acima: o seletor de categoria (quando existe) ou o select de Modalidade. Primeiro select: 'Você vende como' (CPF / CNPJ) com um placeholder que significa 'não respondi'. Segundo select, condicional: 'mais de 450 pedidos?' (SIM / NÃO). Abaixo: a grade de duas colunas com os campos de taxa.
- **Dados que chegam (e o que ela devolve):** As duas respostas juntas formam o determinante que o catálogo usa para escolher a tabela; não responder cai na tabela catch-all, e nada na tela diz isso hoje.
- **O que acontece depois:** Muda a tarifa aplicada (portanto os placeholders da grade de taxas logo abaixo e o texto do selo), e a combinação CPF + alto volume é a única que pode acender o aviso regressivo da Shopee no fim do cartão. Revelar/esconder a segunda pergunta muda a altura do cartão no meio dele.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Perguntas de perfil do vendedor no cartão de canal (Shopee: CPF/CNPJ e alto volume)

## O que desenhar

Duas perguntas cadastrais que hoje aparecem **dentro do cartão de canal** da tela Calculadora, e só
quando o canal escolhido é **Shopee**: "Você vende como" (Pessoa física / Pessoa jurídica) e, apenas se
a resposta for Pessoa física, "Mais de 450 pedidos nos últimos 90 dias?". Quem responde é o vendedor
leigo, no meio do fluxo de precificar uma peça — ele veio calcular preço, não preencher cadastro. A
resposta não é decorativa: ela escolhe **qual tabela de comissão da Shopee** o app usa, e portanto muda
o preço sugerido e o líquido na mesma tela. É preciso desenhar o par de perguntas, a revelação da
segunda, e — o que hoje não existe — **como a tela conta que não responder também é uma resposta**.

## Por que este prompt existe

Nasceram em 016/PR-F (2026-08-06), mais de um mês depois da última rodada do protótipo (2026-07-02) e
do sign-off "PARE de iterar com o Claude Design". Autoridade de desenho: **NENHUMA** — grep por "CPF",
"CNPJ" e "volume" nas quatro autoridades de layout, no readme do DS, na CalculatorScreen e no canvas
018 dá zero, e o protótipo não modela perfil de vendedor em lugar nenhum. Foi inferido por IA: que são
dois `select` nativos e não um par de escolhas visuais, que o placeholder "Selecione" representa "não
respondi", que a segunda pergunta aparece e some **no meio do cartão** mudando sua altura, e que a
consequência em dinheiro de não responder pode ficar sem nenhuma frase na tela.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (bloco `plan.sellerProfile`),
textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Ordem atual dentro do cartão de canal:

1. `select` "Marketplace" + botão ✕ "Remover canal" na mesma linha;
2. (outros marketplaces têm aqui "Modalidade" e/ou o seletor de categoria — **a Shopee não tem
   nenhum dos dois**, então as perguntas de perfil são o primeiro campo depois do marketplace);
3. **"Você vende como"** — `select` com placeholder;
4. **"Mais de 450 pedidos nos últimos 90 dias?"** — `select`, só quando a resposta acima é CPF;
5. grade de taxas: Comissão (%), Taxa fixa (R$), Frete (R$);
6. legendas: banda aplicada, subsídio de frete da Shopee;
7. selo de procedência (`Referência …`) e, na Shopee, os dois avisos honestos.

| Campo | Rótulo literal | Opções literais | Placeholder | Obrigatório |
|---|---|---|---|---|
| `sellerType` | "Você vende como" | "Pessoa física (CPF)" · "Pessoa jurídica (CNPJ)" | "Selecione" | Não |
| `highVolume` | "Mais de 450 pedidos nos últimos 90 dias?" | "Sim" · "Não" | "Selecione" | Não |

→ **Nada na tela diz que não responder assume o regime CNPJ.** A única pista é o texto do selo de
procedência, que nomeia a fonte "vendedor CNPJ (e CPF com menos de 450 pedidos/90 dias)" — uma frase
técnica, no rodapé do cartão, que ninguém lê como resposta à pergunta de cima.
→ **A segunda pergunta entra e sai no meio do cartão**, empurrando a grade de taxas para baixo sem
aviso e sem transição desenhada.
→ **O mesmo placeholder "Selecione" serve para as duas perguntas**, inclusive para uma pergunta de
Sim/Não — onde "Selecione" não significa nada.
→ **Uma pergunta cadastral no meio de um formulário de precificação**: o rótulo "Você vende como" não
diz que se trata do documento com que a loja está registrada na Shopee. E os dois campos reservam
**uma linha só** de rótulo, sendo "Mais de 450 pedidos nos últimos 90 dias?" a frase mais longa do
cartão — exatamente o tipo que corta em 390px.

## Conteúdo e dados reais

- A pergunta só existe para a **Shopee** — ela vem do catálogo de tarifas (`determinantsSchema:
  { sellerProfile: ["CPF_ALTO_VOLUME"] }`). Para Mercado Livre, Amazon e "Outro" o bloco inteiro não
  aparece. Não desenhe uma versão genérica para todos os canais.
- **Só a combinação Pessoa física + Sim** muda de tabela. Pessoa jurídica (com qualquer volume),
  Pessoa física + Não, e qualquer pergunta em branco caem na **mesma tabela**, byte a byte.
- Diferença real em dinheiro (fonte: art. 26839 da Central do Vendedor Shopee, vigente 2026-03-01):
  **+R$ 3,00 por item vendido** na faixa. Tabela padrão: 20% + R$ 4,00 (de R$ 8,00 a R$ 80,00);
  14% + R$ 16,00 (R$ 80–100); 14% + R$ 20,00 (R$ 100–200); 14% + R$ 26,00 (acima de R$ 200,00).
  Tabela CPF de alto volume: 20% + R$ 7,00 (de R$ 12,00 a R$ 80,00), e as faixas seguintes com
  R$ 19,00 / R$ 23,00 / R$ 29,00.
- **Abaixo de R$ 12,00 a tabela CPF de alto volume não existe** — o nível de preço fica "sem
  referência" e a Shopee não publica a fórmula da taxa regressiva. É esse o caso que dispara o aviso
  "A Shopee não publica a fórmula completa desta taxa".
- Exemplo numérico para as pranchetas: peça com preço sugerido **R$ 24,24** (varejo) — em branco paga
  20% + R$ 4,00; com Pessoa física + Sim passa a 20% + R$ 7,00. As duas respostas são **opcionais**:
  sem validação, sem asterisco, sem mensagem de erro hoje.

## Estados obrigatórios

- **Repouso, nada respondido** — as duas perguntas em branco (só a primeira visível). Precisa mostrar
  que o cálculo já está usando a tabela padrão (CNPJ / CPF abaixo de 450 pedidos); hoje não mostra
  nada, e esse é o buraco central deste prompt. Mais **foco / hover / pressionado**, alvo ≥44px.
- **Pessoa jurídica escolhida** — a segunda pergunta não aparece (e se já tinha sido respondida antes,
  a resposta é ignorada pelo cálculo; ela não some do formulário, só deixa de ser lida).
- **Pessoa física escolhida, volume em branco** — a segunda pergunta aparece. Desenhe a entrada dela
  como parte da composição, não como um salto de altura.
- **Pessoa física + Não** — visualmente respondido, mas o cálculo é o mesmo da tabela padrão. O desenho
  deve deixar isso honesto, sem sugerir que a resposta "não fez nada".
- **Pessoa física + Sim** — tabela de alto volume; o cartão passa a mostrar o selo com a fonte "vendedor
  CPF com mais de 450 pedidos em 90 dias (taxa adicional de R$ 3,00 por item)".
- **Pessoa física + Sim com preço abaixo de R$ 12,00** — nível sem referência (selo "sem referência —
  informe as taxas") **mais** o alerta informativo, título literal "A Shopee não publica a fórmula
  completa desta taxa", corpo que cita os dois pontos oficiais e termina em "informe a taxa
  manualmente se precisar calcular este preço".
- **Offline / catálogo embutido** — o cartão exibe o selo "referência embutida (offline)"; as perguntas
  continuam funcionando normalmente (o mapeamento é local). Não invente estado de carregamento para
  elas: elas não fazem requisição.
- **Canal não-Shopee** — o bloco inteiro ausente. Mostre esse contraste em uma prancheta.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça vive de verdade e onde a frase de 450 pedidos corta
  (confira a leitura também a 360px, o piso já medido neste projeto).
- **Desktop 1280px** — o cartão de canal aparece numa coluna mais larga; a decisão aqui é se as duas
  perguntas ficam lado a lado (e o que a segunda faz com a altura) ou empilhadas como no mobile.

## Regras que o desenho não pode quebrar

- **A procedência do número é dita, sempre.** Se a tabela usada mudou por causa da resposta, o cartão
  diz qual regime está valendo — e diz também quando a resposta está em branco.
- **Não responder não pode parecer neutro.** É uma premissa de cálculo com efeito em dinheiro; a tela
  precisa afirmar a premissa, não escondê-la atrás de um placeholder.
- **Nenhuma frase honesta dentro de placeholder.** Este projeto já pagou por isso: em 77–187px úteis o
  texto corta no meio ("2,50 (= 50") e vira leitura errada. Frase explicativa vive em elemento de
  largura total.
- **Zero fórmula inventada.** Onde a Shopee não publica a regra (abaixo de R$ 12,00 para CPF de alto
  volume), a tela informa e oferece entrada manual — nunca estima.
- **Nada aqui é premium/freemium**: as perguntas existem para qualquer vendedor — sem cadeado, teaser
  ou degradação. Alvo ≥44px e contraste medido contra o fundo real do cartão (que já tem fundo próprio
  dentro da tela — não meça contra o fundo da página).

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** A seção Shopee já mediu 1248px de altura a 360px e
  metade disso eram os dois avisos; e um scroll horizontal só apareceu quando alguém mediu o eixo
  vertical também. Desenhe com a soma do cartão em mente, não só com a peça isolada.
- **Rótulo comprido em rótulo de uma linha.** "Mais de 450 pedidos nos últimos 90 dias?" é a frase mais
  longa do cartão; se o desenho a encurtar, a informação "90 dias" e o número "450" não podem sumir.
- **Legenda que promete menos do que acontece.** Já houve legenda dizendo "+R$ 50" enquanto o anúncio
  subia R$ 74,28, porque a comissão incide sobre o custo adicionado. Se o desenho mostrar o impacto dos
  R$ 3,00, ele precisa dizer que o preço do anúncio sobe **mais** que isso.

## Entregável

Pranchetas, tema **escuro** (padrão) e **claro** (first-class), do cartão de canal inteiro com a peça
dentro dele — nunca a peça recortada, porque o problema é justamente a vizinhança:

1. 390px — Shopee, nada respondido, com a afirmação da premissa em uso;
2. 390px — Pessoa física selecionada, segunda pergunta revelada (mostre o antes/depois da altura);
3. 390px — Pessoa física + Sim, preço R$ 24,24, selo da tabela de alto volume;
4. 390px — Pessoa física + Sim, preço abaixo de R$ 12,00: sem referência + o alerta informativo;
5. 1280px — o mesmo cartão na coluna larga, com a decisão de arranjo das duas perguntas;
6. 390px — canal Mercado Livre, para mostrar a ausência do bloco.

Reutilize os primitivos existentes, não crie novos: o cartão é `tf-card`; a moldura rótulo+controle é
`tf-field`; as escolhas podem continuar em `tf-select` (nativo, abre a roda do sistema no mobile) ou
migrar para `tf-segmented`, que já existe na casa para escolha de valor com dois itens — **mostre as
duas alternativas e recomende uma**, considerando que "não respondido" precisa continuar existindo como
estado; a frase de premissa/procedência usa a legenda do cartão (mesmo estilo das legendas de banda e
subsídio); o alerta usa `tf-alert` tom informativo, e o detalhe longo pode colapsar em `tf-info-tip`
como já faz o aviso de frete aferido; o selo de procedência é o badge de selo já existente.

## Perguntas em aberto para o dono

1. Perfil do vendedor é uma propriedade **da conta** (perguntada uma vez, em Conta, e reaproveitada) ou
   **do cálculo** (perguntada em cada cartão de canal, como hoje)? Isso muda a peça de raiz.
2. Quando as perguntas estão em branco, a tela deve **afirmar a premissa** ("estamos usando a tabela de
   CNPJ") ou **pedir a resposta antes de precificar** (estado incompleto)? A segunda opção interrompe o
   fluxo de quem só quer um preço rápido.
3. O vendedor sabe se passou de 450 pedidos em 90 dias? Se não souber, a tela deve ensinar onde ver
   esse número no painel da Shopee — e isso é copy nova, que precisa de decisão.
4. "Você vende como" deve dizer explicitamente que se trata do documento cadastrado na Shopee (e não do
   documento da pessoa)? Hoje o rótulo é ambíguo e não há legenda.

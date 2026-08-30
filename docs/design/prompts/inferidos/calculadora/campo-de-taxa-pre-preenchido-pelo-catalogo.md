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

- **Onde vive:** Dentro da grade de duas colunas de taxas do cartão de canal (Comissão · Taxa fixa · Comissão mínima/item · Frete) — é o estado normal desses campos, mais as duas legendas de largura total logo abaixo da grade.
- **Como o vendedor chega:** O vendedor escolhe marketplace/modalidade/categoria e os campos já 'sabem' o valor: eles ficam VAZIOS, com o número que o catálogo está aplicando em cinza, no placeholder.
- **Vizinhança imediata:** Acima da grade: os selects de perfil do vendedor (ou a categoria, ou a modalidade). Abaixo da grade, em largura total: a legenda 'Tabela por faixa de preço — valores da faixa do seu anúncio' seguida, quando houver, de 'taxa fixa = {pct}% do preço' — na legenda, nunca como sufixo do campo (com 77–187px úteis o sufixo cortava para '2,50 (= 50'). Abaixo dessa legenda: a legenda de subsídio de frete e depois as chaves de taxa opcional.
- **Dados que chegam (e o que ela devolve):** O valor aplicado vem do catálogo resolvido para o preço da tela; digitar por cima troca o selo para 'ajustado'. O erro de cada campo vem do motor, por canal.
- **O que acontece depois:** O placeholder MUDA sozinho quando o preço do anúncio troca de faixa — e é essa mudança silenciosa que a legenda de faixa existe para explicar.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Campo de taxa que já está sendo cobrada pelo catálogo

## O que desenhar
O campo numérico de taxa dentro de um **slot de canal** da Calculadora (bloco "Marketplaces", um card por
canal: Mercado Livre, Shopee, Amazon). São quatro campos numa grade de 2 colunas — Comissão (%), Taxa fixa
(R$), Comissão mínima/item (R$), Frete (R$) — e o problema de desenho é um só: **como a interface mostra um
número que o catálogo JÁ está aplicando no preço, sem que o vendedor tenha digitado nada**. Quem usa é o
vendedor leigo, no momento em que ele olha o preço do anúncio e pergunta "de onde saiu esse desconto?".
Junto do campo vivem duas legendas de largura total sob a grade (faixa de preço + regra da taxa fixa) e os
selos de procedência. Origem no código: `apps/web/src/features/calculator/calculator-form.tsx`
(`ChannelFeeField`, linhas 692-760, e o `ChannelSlot` que o envolve).

## Por que este prompt existe
A peça nunca foi desenhada — autoridade **NENHUMA**. A convenção de hoje (campo vazio + valor do catálogo
como *placeholder* cinza) foi decidida em código, e o verificador adversarial mostrou que ela é o **oposto**
da única convenção que algum protótipo chegou a expressar: o `-fixes.md` de 2026-07-02 mandava "corrija ML
Clássico para R$ 6,75 + 14%", isto é, o valor de referência **preenchido** no campo. O código escolheu
placeholder porque um valor preenchido faria o marcador de "editado pelo vendedor" (`overridden`, que o
cenário salvo grava) mentir. Nenhuma das duas leituras foi homologada por desenho. E o custo de errar já foi
medido: na homologação 015, quatro campos vazios liam **"Comissão 0,00 %"** enquanto "Preços por canal"
mostrava um preço com 15% já descontados — a pior leitura possível.

## O que já existe hoje (não invente do zero — corrija)

Grade de 2 colunas (`1fr 1fr`, gap `--space-3`) dentro do card do canal:

| Campo | Rótulo literal | Afixo | Placeholder quando o catálogo aplica | Placeholder sem referência |
|---|---|---|---|---|
| `commissionPct` | "Comissão" | sufixo `%` | `20` (Shopee faixa R$ 12–80) | **"0,00"** → problema |
| `fixedFee` | "Taxa fixa" | prefixo `R$` | `7,00` | **"0,00"** → problema |
| `minPerItem` | "Comissão mínima/item" | prefixo `R$` | `6,75` | "0,00" |
| `freightCost` | "Frete" | prefixo `R$` | — | "0,00" |

- Todo campo mostra a etiqueta discreta **"opcional"** à direita do rótulo.
- → O placeholder de fallback `"0,00"` é o mesmo tom cinza do placeholder de referência. **Um número cinza
  hoje significa duas coisas opostas** ("o catálogo cobra 20%" e "não há referência nenhuma") e nada na
  peça distingue as duas.
- → O placeholder de percentual não tem casas decimais (`20`) e o de dinheiro tem (`7,00`), porque vêm de
  formatações diferentes. Lado a lado na mesma grade, isso lê como inconsistência.
- Sob a grade, **um único parágrafo** de largura total concatena duas frases:
  "Tabela por faixa de preço — valores da faixa do seu anúncio." + "Nesta faixa, a taxa fixa é 50% do preço
  do anúncio — o placeholder mostra o valor já calculado."
  → As duas dizem coisas diferentes (uma é aviso de volatilidade, a outra é a regra de UM campo) e hoje
  formam um bloco cinza indistinto, no mesmo peso visual do resto.
- Abaixo, em linhas separadas do mesmo tom: subsídio de frete da Shopee, sobretaxa opcional (Switch) e os
  selos em `Badge`.

## Conteúdo e dados reais
- **Números verdadeiros do catálogo semente (2026-08-06)**, Shopee CNPJ: faixa `R$ 12,00–80,00` → 20% +
  R$ 7,00; `R$ 80,00–100,00` → 14% + R$ 19,00; `R$ 200,00+` → 14% + R$ 29,00. Catch-all abaixo de R$ 8,00:
  20% + **taxa fixa = 50% do preço** (anúncio de R$ 6,00 ⇒ placeholder `3,00`). ML Clássico: 14% + R$ 6,75;
  ML Premium: 19% + R$ 6,75. Amazon Individual: R$ 2,00 por item.
- **O placeholder muda sozinho** quando o preço do anúncio troca de faixa (o anúncio sobe de R$ 79,00 para
  R$ 81,00 e a comissão cai de 20% para 14%, o fixo salta de R$ 7,00 para R$ 19,00). Isso é o coração da
  peça: um número que se mexe sem o vendedor tocar nele.
- Selos existentes, verbatim: "Referência: {fonte} (para {categoria}) · atualizada em 06/08/2026" ·
  "referência embutida (offline)" · "· pode estar desatualizada" · "categoria não informada — usando a maior
  alíquota da tabela" · "ajustado por você" · "sem referência — informe as taxas" · "estimativa de frete" ·
  selo separado "Taxa fixa · {fonte} · vigente desde {data}".
- Aviso de plausibilidade no campo Comissão (não é erro, não recusa nada): "Confira a comissão: 0,12%.
  Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi
  recusado."
- Campos de dinheiro ganham máscara de milhar **no blur** ("4000,00" vira "4.000,00"); percentual nunca.

## Estados obrigatórios
1. **Repouso com referência** — campo vazio, placeholder `20` / `7,00`, selo de referência com fonte e data.
2. **Repouso sem referência** — o catálogo não cobre este caso; hoje mostra `0,00` cinza + selo "sem
   referência — informe as taxas". Desenhe uma representação que **não pareça a alíquota zero**.
3. **Faixa recém-trocada** — o mesmo campo com outro número, sem o vendedor ter tocado. Precisa de alguma
   marca de que aquilo acabou de mudar (o desenho decide; hoje não há nenhuma).
4. **Foco** — cursor no campo ainda vazio: o número do catálogo continua legível ou some?
5. **Digitado (ajustado por você)** — o vendedor escreveu `18`; o selo do slot passa a "ajustado por você" e
   o número do catálogo **desaparece**. Desenhe como (ou se) ele continua acessível para voltar atrás.
6. **Erro do campo** — borda de erro + mensagem por campo; a linha do canal diz "Corrija os campos deste
   canal para ver os preços."
7. **Aviso (não-erro)** — a frase da comissão 0,12% abaixo do campo, em tom de atenção, sem borda vermelha.
8. **Faixa sem tarifa publicada** — "Sem tarifa publicada para a faixa de preço deste anúncio — informe a
   comissão do canal para precificar."
9. **Offline / referência embutida** — selo "referência embutida (offline)" em tom neutro; o placeholder
   continua funcionando (o cálculo é local).
10. **Falha de atualização** — "Não foi possível atualizar as taxas" / "Usando a referência salva no
    dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." +
    "Tentar novamente". Nunca vira parede de erro.
11. **Sem permissão (freemium)** — o bloco inteiro desabilitado com a razão dita ao lado: "Vender em
    marketplaces faz parte do Premium." Nunca um controle cinza mudo.
12. **Desabilitado / hover / pressionado** dos controles do slot (Switch da sobretaxa, botão "Remover
    canal" — hoje um "✕").

## Viewports
- **Mobile 390px** — obrigatório e é onde a peça quebra: a grade de 2 colunas deixa entre **77px e 187px**
  úteis por campo. É a largura que já cortou texto aqui.
- **Desktop 1280px** — a Calculadora desktop existe desde 016/PR-B; o slot vive numa coluna mais larga e a
  grade de 2 colunas passa a caber com folga. Mostre o que fazer com o espaço (a legenda vira lateral? os
  quatro campos viram uma linha?).
- 1920px opcional, só se a sua solução mudar de forma além de 1280px.

## Regras que o desenho não pode quebrar
- **Frase honesta nunca dentro de placeholder.** Já foi pago: a regra "= 50% do preço" como sufixo do campo
  cortava para `2,50 (= 50` — parêntese aberto e um número solto, exatamente a leitura errada que a frase
  existia para impedir. Texto explicativo mora em elemento de largura total.
- **Procedência sempre dita.** Todo número que a tela aplica sem o vendedor digitar precisa dizer de onde
  veio e de quando é. Selo silencioso = número inventado.
- **Degradação dita, nunca escondida.** Catálogo velho, catch-all e "sem referência" são afirmações
  diferentes e não podem ter o mesmo peso visual de uma referência confirmada.
- **Falha de rede não é falta de premium** e nunca bloqueia o cálculo (que roda offline).
- **Freemium binário**: ou o bloco funciona, ou está desabilitado com a razão em texto legível ao lado.
- Alvo de toque ≥44×44px em qualquer controle do slot (o "✕" de remover e o Switch já foram achados aqui).
- Contraste do placeholder medido **contra o fundo real do input**, não contra o fundo do card: ele carrega
  informação de dinheiro, não é decoração — e um placeholder padrão costuma ficar abaixo do mínimo.

## Armadilhas já pagas neste projeto
- Campo vazio ao lado de um preço já descontado: quatro campos lendo "Comissão 0,00 %" com 15% aplicados no
  preço (015/A8). É a razão desta peça existir.
- Sufixo que corta em coluna estreita (016/PR-F, reverify r5-*): medir com 77px, não com o desktop.
- Texto ocluso/estourado passa em `toBeVisible` e `toContainText` — layout aqui se decide com caixa, não com
  string.
- Valor grande estourando coluna: R$ 1.234,56 com máscara de milhar num campo de 77px úteis.
- Legenda longa (a da sobretaxa tem ~230 caracteres) empurrando o card — ela precisa quebrar linha à
  vontade, e ainda assim não pode virar um muro cinza.

## Entregável
Pranchetas, tema **escuro como padrão e claro como first-class** (as duas para as pranchetas 1 e 3):
1. Slot de canal completo em repouso, mobile 390px, Shopee com referência (grade + as duas legendas + selos).
2. **Matriz de estados do campo Comissão** em 390px: repouso com referência · repouso sem referência · foco ·
   digitado/ajustado · erro · aviso 0,12% · desabilitado por freemium.
3. **A troca de faixa**, dois quadros lado a lado: anúncio R$ 6,00 (fixa `3,00`, regra de 50%) e anúncio
   R$ 27,55 (20% + R$ 7,00) — mostrando como o vendedor percebe que o número se mexeu.
4. O mesmo slot em desktop 1280px.

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap` + `tf-input--num` com afixo `R$`
(`tf-inputwrap__affix--strong`) e sufixo `%`; `tf-field` com rótulo e a etiqueta `tf-field__optional`
("opcional"); `tf-field__aviso` para a frase de plausibilidade; `Badge` para os selos (tons info/neutro);
`Card padding="md"` para o slot; `Switch` para a sobretaxa; `tf-price--*` só nos preços resultantes, nunca
no campo. Se a sua solução exigir uma marca nova (um "valor herdado" que não é placeholder nem valor),
descreva-a como variante de `tf-inputwrap`, não como componente novo.

## Perguntas em aberto para o dono
1. **Placeholder cinza ou valor preenchido?** O protótipo de 2026-07-02 mandava preencher (R$ 6,75 + 14%);
   o código escolheu placeholder para que o marcador "ajustado por você" não minta. Qual convenção vale — e
   se for preenchido, como a tela distingue "veio do catálogo" de "eu digitei"?
2. **Sem referência, o campo mostra o quê?** Hoje mostra `0,00`, indistinguível de uma alíquota zero. Vale
   um travessão "—", vazio puro, ou outra marca?
3. **A legenda deve nomear a faixa em números** ("de R$ 12,00 a R$ 80,00: 20% + R$ 7,00") ou continuar
   genérica ("valores da faixa do seu anúncio")?
4. Quando o vendedor digita por cima, o valor do catálogo deve permanecer visível em algum lugar (para
   comparar e para voltar), ou some de propósito?

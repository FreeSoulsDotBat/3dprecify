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

- **Onde vive:** A rota /calcular inteira, acima de 1024px: `.tf-calc-page` (máx. 1120px, centrada) contendo, em ordem, a pilha de topo em largura total, a grade `.tf-calc-grid` de duas colunas e o rodapé `.tf-calc-footer` também em largura total.
- **Como o vendedor chega:** É a primeira tela do app: a aba Calcular no menu (barra inferior ≤425px, barra lateral acima) ou a raiz `/` redirecionando. Chega sempre — anônimo, grátis, Premium, online ou offline — e normalmente com o formulário zerado (nada persiste entre recargas).
- **Vizinhança imediata:** Acima da grade: título 'Calcular preço' centrado, a frase freemium, o botão 'Meus cenários' e (quando houver) a barra de cenário carregado, avisos, resumo de kit e o cartão 'Usar do catálogo'. Coluna ESQUERDA, de cima para baixo: 'Custos da peça' → 'Mão de obra e custos' → 'Outros custos' (só Premium). Coluna DIREITA: 'Markup' → 'Outros custos' (só na conta grátis) → 'Marketplace' (só Premium). Na conta grátis o portão do Marketplace sai da coluna e vira uma faixa de largura total (`grid-column: 1/-1`) logo abaixo das duas colunas. Abaixo de tudo, o rodapé com o resultado.
- **Dados que chegam (e o que ela devolve):** A grade em si não recebe dado: ela recebe a decisão de entitlement (`active` ⇒ marketplace na direita; qualquer outra coisa ⇒ portão em largura total e 'Outros custos' migrado). Abaixo de 1024px nada disso existe — é uma coluna só, na ordem escrita.
- **O que acontece depois:** Cada campo digitado recalcula na hora (o motor roda local) e o rodapé se reescreve. O rodapé é sempre o último a ser lido, por decisão: ele soma tudo que as duas colunas alimentaram, canais incluídos.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Calcular no desktop — as entradas em duas colunas e o preço no rodapé

## O que desenhar
A tela **Calcular preço** em desktop: a que o vendedor abre todo dia, e a única sem desenho desktop próprio.
É onde ele digita o custo da peça (filamento, energia, máquina, mão de obra), escolhe o markup, configura os
canais de marketplace e lê o preço sugerido. Vive dentro do shell com a barra lateral recolhível (018), como
primeira aba. Hoje, de 1024px para cima, o corpo abre para 1120px e as seções de entrada se partem em duas
colunas, com o resultado num rodapé centralizado de largura total. Desenhe a tela inteira — cabeçalho, as
duas colunas, o rodapé de resultado — em 1280px e 1920px, no estado normal e nos estados reais do código.

## Por que este prompt existe
O corte em duas colunas nunca foi desenhado: um agente decidiu qual seção mora em qual coluna, em que ordem,
e onde o resultado fica. `PROTOTIPO_PARCIAL` — em 2026-07-02 um protótipo desktop da Calcular **existiu**,
mas era a versão E1 (4 campos básicos, 3 colapsáveis, 2 cartões de preço, 1 card de detalhamento), o
artefato não está no repositório, e a tela de hoje ganhou catálogo, tempo em h+min, pergunta da máquina,
outros custos, canais de marketplace, cenários e histórico. Do protótipo só sobreviveu um número:
`--content-max` 1120px. Pior: **a única instrução desktop que a autoridade dá para esta tela** (§F.3,
"desktop 2 colunas" para Varejo × Atacado) **não é a que o código implementa** — os dois cartões de preço
são `auto-fit minmax(210px, 1fr)` e o corte em duas colunas foi aplicado às *seções de entrada*, que é outra
coisa. O dono já reprovou o desktop das outras quatro abas exatamente por esse motivo.

## O que já existe hoje (não invente do zero — corrija)

Ordem vertical atual, do topo:

1. **Título** "Calcular preço", centralizado (`tf-page-header--center`).
2. **A promessa**, centralizada, em legenda: *"Calcular custo e markup é grátis, sem limite. Vender em
   marketplaces, salvar e exportar fazem parte do Premium."*
3. **Botão fantasma alinhado à direita**: ícone + *"Minhas simulações"*. → em 1120px de largura ele fica
   sozinho num trecho vazio enorme, longe do título; parece perdido.
4. **Cartão "Usar do catálogo"** (só Premium com itens salvos): legenda *"Preenche os campos com o item
   salvo — você ainda pode editar tudo."* + os selects *"Filamento salvo"* e *"Impressora salva"*
   (placeholder *"Escolher…"*).
5. **A grade de duas colunas** (`min-width: 1024px`, `1fr 1fr`, `align-items: start`):

| Coluna | Conta ativa (Premium) | Conta grátis / deslogada |
| --- | --- | --- |
| Esquerda | Custos da peça · Mão de obra e custos · Outros custos | Custos da peça · Mão de obra e custos |
| Direita | Markup · Marketplace | Markup · **Outros custos** (migrou de coluna) |
| Largura total | — | O portão de Marketplace, atravessando as duas colunas |

→ **O buraco medido**: com a conta grátis, o portão de marketplace (205px de altura) na coluna direita
contra 2.521px de coluna esquerda deixou **1.671px de vazio** a 1440px. O remendo foi mandar o portão
atravessar a grade e mudar "Outros custos" de coluna conforme a assinatura. O desenho precisa resolver isso
de verdade, não com um caso especial por estado de conta.

6. **Rodapé de largura total, centralizado**, com cada filho capado em **720px**: o card *"Como chegamos no
   preço"* (detalhamento + *"Preços por canal"* fundido no mesmo card), o aviso de atacado acima do varejo,
   os dois cartões de preço lado a lado, e os botões *"Salvar cenário"* e *"Salvar no histórico"* (Premium,
   ausentes fora dele). → o cap de 720px ninguém desenhou: joga fora 400px de largura no bloco mais
   importante. → **não existe painel de resultado fixo**: quem edita o markup no fim de uma coluna de
   2.500px não vê o preço mudar — precisa rolar até o rodapé. É a decisão mais cara que ninguém tomou.

## Conteúdo e dados reais

**Custos da peça** (grade `auto-fit minmax(170px, 1fr)`, 2 a 4 campos por linha): "Custo do rolo" (R$) ·
"Peso do rolo" (kg, típico 1) · "Gramas usadas" (g) · "Consumo médio" (kW, ~0,12) · "Tarifa de energia"
(**o campo mais largo da tela: prefixo "R$" e sufixo "/kWh" em volta do número**) — estes cinco
obrigatórios — · "Reserva de manutenção" (R$ /h) e "Taxa de falha" (%), opcionais. No mesmo card: o tempo de
impressão em **h + min**, e a pergunta da máquina — *"Com que frequência ela roda?"* (Poucas horas por
semana · Quase todo dia · Praticamente o dia todo, mínimo 240px cada), *"Em quantos anos quer que ela se
pague?"*, a legenda derivada *"≈ R$ 1,25 por hora de impressão"* e o escape *"Ajustar horas direto"*.

**Mão de obra e custos**: "Mão de obra (horas)", "Valor da hora", "Tempo de acabamento", "Valor do
acabamento". **Outros custos**: 0..N itens nomeados, legenda *"Embalagem, etiqueta, taxas, etc. Cada item
soma ao custo total."*, *"Adicionar custo"* / *"Remover custo"*, campos "Nome do custo" (placeholder
*"Ex.: Embalagem"*) e "Valor". **Markup**: "Markup varejo" (%) e "Markup atacado" (%), com a dica *"Margem
sobre o custo total (não sobre o preço de venda)."*

**Marketplace**: switch *"Incluir marketplaces no preço"*, e um bloco por canal com Marketplace, Modalidade,
Comissão, Taxa fixa, Comissão mínima/item, Frete (*"Descontado do valor recebido (não é embutido no
anúncio)."*), mais as perguntas da Shopee (*"Você vende como"*; *"Mais de 450 pedidos nos últimos 90
dias?"*). Cada seção tem um ⓘ no título.

**Números verdadeiros** (a semente que o produto mostra na primeira visita, e que devem aparecer nas
pranchetas): custo total **R$ 16,16**; markup varejo 50% → **Preço varejo R$ 24,24**; markup atacado 30% →
**Preço atacado R$ 21,01**. As linhas do detalhamento: Material · Energia · Máquina · Falha / perdas ·
Acabamento · Mão de obra · (cada "outro custo" pela sua própria linha) · **Custo total** em destaque ·
Preço varejo (legenda "markup 50%") · Preço atacado (legenda "markup 30%"). Os dois cartões de preço são
`tf-price` tamanho md, centralizados, com legenda "markup 50%" / "markup 30%", tons accent e energy.
Desenhe **também** uma prancheta com um preço de seis dígitos (R$ 950.096,00) — é o caso que já quebrou.

## Estados obrigatórios
- **Repouso / foco / hover / pressionado** nos campos e botões — o foco precisa ser visível dentro de uma
  coluna densa, não só num campo isolado.
- **Formulário inválido**: o rodapé inteiro **some** e no lugar fica um alerta de perigo com
  *"Confira os campos destacados para ver o preço."* → em duas colunas o campo culpado pode estar fora da
  vista de quem lê o alerta lá embaixo. Mostre esse estado.
- **Aviso de plausibilidade** (informativo, nunca erro, nunca bloqueia): *"Confira o consumo: 120 kW. Acima
  de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. (…) Nada foi recusado."*
- **Atacado acima do varejo** (informativo, no rodapé): *"O preço de atacado ficou acima do varejo. Nada foi
  recusado — só confira se é isso mesmo."*
- **Grátis / deslogado**: switch de marketplace desabilitado com a razão ao lado —
  *"Vender em marketplaces faz parte do Premium."* — e o portão atravessando as duas colunas.
  Sem "Salvar cenário" e sem "Salvar no histórico" (ausentes, não desabilitados).
- **Catálogo de taxas desatualizado / offline**: *"Não foi possível atualizar as taxas"* com o corpo
  *"Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as
  taxas manualmente."* + *"Tentar novamente"*. Nunca vendido como "não é Premium".
- **Falha ao ler o catálogo salvo**: *"Não foi possível carregar seus itens salvos agora."* + *"Tentar novamente"*.
- **Faixa sem tarifa publicada**: *"Sem tarifa publicada para a faixa de preço deste anúncio — informe a
  comissão do canal para precificar."* · **Canal no prejuízo**: *"Canal não-lucrativo neste preço (frete
  maior que a margem)."*
- **Simulação carregada**: a barra de contexto no topo (nome, alterações não salvas, Renomear / Duplicar /
  Salvar alterações / Abrir origem) — e, se a base é um kit, o resumo somente-leitura no lugar dos campos.
- **Premium pausado (lapsed)** · **campo desabilitado** dentro de um canal · **hover/pressionado** nos botões.

## Viewports
**1280px e 1920px são o entregável** — é aí que a peça existe e é aí que ninguém desenhou. Em 1280 a régua é
"cabe o suficiente para valer duas colunas"; em 1920 a pergunta é **o que acontece com os ~800px que sobram
hoje** ao lado dos 1120px fixos (a página não cresce, e a barra lateral do 018 já mudou o espaço
disponível). Desenhe também **390px como referência, não como redesenho**: a coluna única mobile mantém a
ordem de hoje e está aqui só para provar que o desenho desktop não a arrasta junto.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou o recurso está lá funcionando, ou o portão diz que é Premium. Nunca um recurso
  que parece disponível e falha ao tocar.
- **Falha de rede nunca é vendida como falta de assinatura** — o alerta de taxas desatualizadas e o de
  catálogo não podem parecer portão de Premium.
- **A procedência do número é dita**: nenhuma linha do detalhamento aparece sem rótulo, e "Preços por canal"
  mora dentro do mesmo card do detalhamento.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega só número/exemplo (já custou uma
  homologação aqui). **Alvo ≥44px** em todo controle, inclusive "Remover custo" e "Remover canal".
  **Contraste medido contra o fundo real do card**, não contra o fundo da página.
- Aviso é aviso: descritivo, nunca escrito como erro — o produto não recusou nada.

## Armadilhas já pagas neste projeto
- **Buraco vertical medido**: 1.671px de coluna vazia quando um bloco curto (o portão) fica ao lado de uma
  coluna de 2.521px. Qualquer proposta de duas colunas tem de responder o que acontece quando os dois lados
  têm alturas muito diferentes.
- **Estouro horizontal**: um preço de seis dígitos já quebrou no meio do dígito (`950.096` em duas linhas), e
  "Tarifa de energia" já deixou o número com 1px visível. Números não quebram — a caixa cede.
- **Texto que passa em teste e está ocluso**: ocultação não é propriedade do texto — desenhe com caixas, e
  deixe explícito onde há rolagem interna (captura headless não vê barra de rolagem clássica).

## Entregável
Pranchetas: (1) 1280px Premium normal, com os números da semente; (2) 1920px Premium, decidindo o espaço que
sobra; (3) 1280px conta grátis com o portão de marketplace (o caso do buraco); (4) 1280px formulário
inválido; (5) 1280px com simulação carregada + alerta de taxas desatualizadas; (6) 1280px com preço de seis
dígitos; (7) 390px de referência, sem alteração. Escuro é o padrão, claro é de primeira classe — entregue ao
menos a 1 e a 3 nos dois temas.
Reutilize os primitivos existentes, sem criar novos: `tf-card` por seção, `tf-section-title` com o ⓘ,
`tf-field` (com prefixo/sufixo) em todo campo, `tf-select` nos selects, `tf-switch` no "Incluir marketplaces
no preço", `tf-alert` (`danger`/`info`) nos avisos, `tf-button` (`primary`/`secondary`/`ghost`) nas ações e
`tf-price` (md, centralizado, tons accent e energy) nos dois cartões de preço.

## Perguntas em aberto para o dono
1. **O preço acompanha a rolagem?** Hoje o resultado é rodapé: quem mexe no markup no fim de uma coluna
   longa não vê o número mudar. Vira painel fixo à direita (terceira coluna), barra fixa no rodapé, ou
   continua onde está? Essa decisão muda a grade inteira.
2. **O corte é em 1024px ou 1280px?** O 018 fixou **1280px** para as outras quatro abas; esta tela corta em
   **1024px**. Duas telas do mesmo produto mudando de layout em larguras diferentes é incoerência visível.
3. **A página continua parando em 1120px a 1920px?** Ou o conteúdo respira até o limite do shell?
4. **O cap de 720px do rodapé fica?** Ele centraliza o resultado, mas em 1120px joga fora 400px de largura
   justamente no bloco mais importante.
5. **Marketplace é mesmo vizinho de Markup na coluna direita?** Ou a direita deveria ser reservada ao
   resultado, com todas as entradas à esquerda?
6. **"Outros custos" trocar de coluna conforme a assinatura é intencional** ou remendo? Um vendedor que
   assina vê a seção mudar de lugar.
7. **A §F.3 ("desktop 2 colunas" para Varejo × Atacado) segue valendo** para os dois cartões de preço, ou
   foi substituída pelo comportamento atual de empacotamento automático?

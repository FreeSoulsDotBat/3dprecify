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

- **Onde vive:** Terceiro controle de dentro do cartão de canal, entre o select 'Modalidade' e o select 'Você vende como'. Só existe onde o catálogo publica uma árvore de categorias para aquele marketplace (Mercado Livre e Amazon têm; Shopee não).
- **Como o vendedor chega:** O vendedor escolhe o marketplace, depois a modalidade, e este é o próximo campo — é ele que decide QUAL comissão será cobrada.
- **Vizinhança imediata:** Acima: o select de Modalidade. Abaixo: o select 'Você vende como' (ou, onde não houver perfil, direto a grade de taxas). Estados, todos no mesmo lugar: (a) BUSCA — campo de texto com placeholder, uma linha viva de contagem ('N categorias encontradas' / 'Mostrando 8 de 23' / a frase de 'busque de outro jeito'), uma lista de até 8 botões mostrando o CAMINHO completo com '›' à direita, e — só enquanto nada foi digitado — um botão secundário 'Ver todas as categorias (N)' que abre uma árvore recursiva com rolagem própria (~40vh) e disclosure ▸/▾ apenas nos nós que têm filhos; (b) ESCOLHIDO — o campo vira um quadro com o caminho num chip e um botão fantasma 'Limpar' dentro do próprio frame; (c) escolhido mas ausente do catálogo — o mesmo quadro dizendo isso; (d) marketplace sem árvore — só uma frase, em duas versões conforme o canal já tenha ou não referência de tarifa.
- **Dados que chegam (e o que ela devolve):** A árvore vem do mesmo catálogo de tarifas que traz as taxas (esparsa por construção). A frase do estado vazio é derivada do SELO do canal, para nunca discordar dele.
- **O que acontece depois:** Escolher a categoria muda a comissão pré-preenchida e o texto do selo logo abaixo da grade de taxas; trocar de marketplace apaga a categoria, porque ela pertence à taxonomia antiga.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Seletor de categoria do marketplace (busca + árvore) dentro do slot de canal

## O que desenhar
O campo que o vendedor usa, dentro de cada card de canal da tela **Calcular**, para dizer em que
categoria do marketplace o anúncio vai entrar — e que, por consequência, decide a **comissão cobrada
dele**. Vive no card `Canal` logo abaixo do seletor de *Marketplace* (e da *Modalidade*, quando o canal
tem uma) e logo acima das perguntas de perfil do vendedor e dos campos de dinheiro (*Comissão*, *Taxa
fixa*, *Comissão mínima/item*, *Frete*). Tem duas afordâncias no mesmo lugar: **buscar** por texto e
**navegar** uma árvore hierárquica recolhida atrás de um botão. Quem usa: o vendedor premium montando o
preço de um produto, no meio de um formulário longo, quase sempre no celular.

## Por que este prompt existe
Nada disto foi desenhado: a auditoria confirmou **zero** ocorrências de "categoria" nas quatro
autoridades de desenho do projeto (os 3 markdown de design, o `.design-import/readme.md`, o
`CalculatorScreen.jsx` do protótipo de 2026-07-02 e o canvas `Abas-Desktop.dc.html` do 018) — o eixo
categoria→comissão nasceu no incremento 014, um ano-produto depois do protótipo, e o canvas 018 não
cobre a aba Calcular. O `.design-import` não tem nem primitivo de busca nem de árvore entre os 32 que
lista. O próprio código confessa a ausência no cabeçalho: *"layout, the drill-vs-search affordance and
where this sits inside the slot are `designer-ux`'s"*. Foram inferidos por IA: o layout, a escolha
busca-vs-árvore, o que é chip e o que é lista, os glifos `▸ ▾ ›`, a densidade da árvore e o corte em 8
resultados.

## O que já existe hoje (não invente do zero — corrija)
Ordem vertical atual, de cima para baixo, quando nada foi escolhido:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Rótulo do campo (`tf-field__label`, compacto) | `Categoria do anúncio (opcional)` |
| 2 | Dica sob o rótulo | `A comissão muda conforme a categoria.` |
| 3 | Campo de busca (`tf-inputwrap` + `tf-input`, o MESMO par do campo de dinheiro) | placeholder `Busque pelo produto…` |
| 4 | Linha de contagem (live region sempre montada, some quando vazia) | `1 categoria encontrada` · `{n} categorias encontradas` · `Mostrando {n} de {total} — refine a busca para ver as demais.` |
| 5 | Lista de resultados — até **8** botões, superfície elevada, sombra, divisórias entre itens | cada item = **caminho completo** + um `›` apagado à direita |
| 6 | Botão secundário pequeno, alinhado à esquerda (só aparece com a busca vazia) | `Ver todas as categorias (38)` / aberto: `Ocultar categorias` |
| 7 | Dentro do painel aberto: contagem FORA da área rolável | `38 categorias no catálogo` |
| 8 | Árvore recursiva com rolagem própria de `40vh`; disclosure `▸`/`▾` de 44px **ao lado** do item, só onde há filhos; subnível indentado com filete à esquerda | itens mostram só o **nome do nó**, não o caminho |

→ **Problemas que o desenho precisa resolver:**
→ a lista de resultados já foi lida, em homologação, como **um segundo campo preenchido** (com 1
resultado, "Calçados" numa moldura parecia valor digitado). A correção foi paliativa (superfície
elevada + raio menor + divisórias) — desenhe uma lista que não possa ser confundida com um campo.
→ a busca e a árvore são **mutuamente exclusivas por acidente de implementação**: digitou uma letra, o
botão "Ver todas as categorias" some. Nada no desenho explica isso ao vendedor.
→ na busca o item mostra o **caminho completo**; na árvore mostra só o **nome**. Duas gramáticas
diferentes para a mesma decisão, na mesma peça.
→ o `›` de cada item é decorativo e diz "isto se toca" (não existe hover no celular), mas fica
indistinguível do `›` separador do caminho quando o caminho quebra em duas linhas.
→ o rótulo diz `(opcional)` no campo que define a alíquota. É verdade contratual (nada bloqueia o
cálculo) e péssima hierarquia de atenção.

## Conteúdo e dados reais
- **Caminho completo, sempre, nos resultados de busca** — o Mercado Livre publica *Celulares e
  Telefones* a **18%** e *Celulares e Smartphones* a **16%**: nome nu transforma 2 pontos percentuais
  do preço do vendedor em cara-ou-coroa. Exemplo real para prancheta:
  `Celulares e Telefones › Acessórios para Celulares › Suportes`.
- **Espinha rasa também existe**: Amazon = **38 categorias de um nível só**. Nenhum nó tem filho, nenhum
  `▸` aparece, e a "árvore" degrada sozinha para lista simples. Desenhe esse caso.
- **Um nó intermediário é selecionável** — o `▸` só abre/fecha filhos, nunca é a única forma de escolher.
- **Corte de resultados**: 8 visíveis, contagem sempre pelo **total real**. Nunca "8 encontradas" com 31
  existentes (isso já aconteceu e passou em todos os testes).
- Vizinhança de dinheiro no mesmo card, para calibrar peso visual: `Comissão`, `Taxa fixa`,
  `Comissão mínima/item`, e o selo de procedência que fica ao lado deles — `Referência · atualizada em
  06/08/2026`, `sem referência — informe as taxas`, `categoria não informada — usando`.

## Estados obrigatórios
1. **Repouso, vazio** — busca vazia, sem contagem (a linha some, não fica reservando altura), botão
   `Ver todas as categorias (38)` visível.
2. **Digitando com resultados** — contagem + até 8 itens em fluxo (a lista **empurra** o conteúdo para
   baixo; nunca flutua sobre o formulário: sobreposição já custou três defeitos de hit-testing neste
   projeto).
3. **Digitando com resultados truncados** — `Mostrando 8 de 31 — refine a busca para ver as demais.`
4. **Busca sem resultado** — a lista some e sobra a frase inteira, que é conselho, não erro:
   `Não achou? Busque pelo produto, não pelo material — um suporte de celular fica em “Acessórios para
   Celulares”.` Ela é longa: precisa de linha de largura total, nunca de placeholder.
5. **Árvore aberta** — `Ocultar categorias`, `38 categorias no catálogo` fora da rolagem, painel com
   rolagem própria (`40vh`), níveis 1, 2 e 3 visíveis com `▾` no aberto e `▸` no fechado.
6. **Escolhido** — o rótulo e a moldura do campo PERMANECEM (uma categoria escolhida já apareceu como
   texto solto entre "Modalidade" e "Comissão"); dentro da moldura, o caminho completo em chip que
   **cresce em altura** e o botão fantasma `Limpar` encostado na borda direita.
7. **Escolhido fora do catálogo** — mesma moldura, texto em tom apagado e peso normal:
   `A categoria escolhida não está neste catálogo — limpe e escolha outra.` + `Limpar`.
8. **Espinha vazia — com taxa de referência**: só a frase `A lista de categorias ainda não está
   disponível para este canal.` (sem campo de busca).
9. **Espinha vazia — sem referência**: `Este canal ainda não tem taxa de referência — informe a comissão
   nos campos abaixo.`
10. **Foco visível** em: input, cada item de resultado, cada `▸`, cada item da árvore e o `Limpar` — o
    foco vai para o `Limpar` no instante em que o vendedor escolhe.
11. **Hover / pressionado** nos itens (fundo sutil) — e o desenho não pode depender só de hover.

## Viewports
- **390px — obrigatório.** É o uso real. Um caminho de três níveis não cabe numa linha: mostre-o
  quebrado em 2–3 linhas dentro do item e dentro do chip, com o alvo crescendo junto (piso 44px).
- **1280px — obrigatório também.** A peça renderiza no desktop hoje sem nunca ter sido desenhada para
  ele (o canvas do 018 não cobre Calcular). No desktop `40vh` é muito mais alto e o card do canal é bem
  mais largo: mostre como a lista e a árvore se comportam com largura sobrando, em vez de esticarem
  itens de 44px por 900px de linha vazia.

## Regras que o desenho não pode quebrar
- **A peça nunca fala de dinheiro.** Ela conhece só a lista de nomes; quem afirma procedência da taxa é
  o selo do mesmo card. Nenhuma frase daqui pode dizer ou insinuar "a taxa exibida é a correta" — essa
  frase existiu, era falsa para 100% dos usuários, e foi removida.
- **Contagem honesta sempre**: o número mostrado é o total real, nunca o número de itens na tela.
- **Sempre expandido, nunca colapsado atrás de "avançado"** — campo colapsado + número plausível
  pré-preenchido é exatamente como um vendedor aceita uma alíquota que não é dele.
- **Escolher é opcional como regra, obrigatório como afordância**: não bloqueie o cálculo, mas não deixe
  a decisão parecer acessória.
- Frase honesta jamais dentro de placeholder (ela corta em todos os viewports).
- Alvos ≥ 44px, inclusive o `▸`, que é botão próprio e nunca fica dentro do botão do item.
- Contraste medido contra o fundo REAL da lista (superfície elevada), não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Lista lida como campo preenchido** (homologação 014, achado só no screenshot: nenhuma asserção viu).
- **Contagem mentindo o total** ("8 encontradas" com 31 existentes) — invisível a qualquer teste.
- **Árvore inline empurrando a página**: 38 nós renderizados de uma vez levaram a página a 1.795px e
  jogaram o preço final para y≈4.800 em 360px, ANTES de qualquer interação. Daí a árvore recolhida com
  rolagem própria — o desenho não pode desfazer isso.
- **Chip em branco ao lado de "Limpar"** quando o id escolhido não está na espinha: nomeava nada.
- **Texto ocluso/estourado passa em teste**: o caminho longo e o `Limpar` disputam a mesma linha —
  desenhe a quebra, não confie no corte.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**, todas mostrando a peça **dentro do card de
canal** (com *Marketplace*, *Modalidade* acima e *Comissão* abaixo, para provar hierarquia e não só o
componente isolado):
1. 390px — repouso vazio; 2. 390px — busca com 3 resultados; 3. 390px — busca truncada (8 de 31);
4. 390px — sem resultado; 5. 390px — árvore aberta com 3 níveis; 6. 390px — escolhido (caminho de 3
níveis, 2 linhas); 7. 390px — escolhido fora do catálogo; 8. 390px — espinha vazia (as duas frases);
9. 1280px — repouso + busca com resultados; 10. 1280px — árvore aberta; 11. tira de estados
(foco/hover/pressionado/desabilitado) dos itens e do `▸`.
Reutilize os primitivos: `tf-field` + `tf-field__label--tight` (rótulo e dica), `tf-inputwrap` +
`tf-input` (busca e moldura do escolhido — o mesmo par do campo de dinheiro, não um sósia),
`Button variant="secondary" size="sm"` (abrir/fechar árvore), `Button variant="ghost" size="sm"`
(`Limpar`), tipografia de legenda para as linhas de contagem/aviso. **Só invente forma nova para o que
o DS não tem**: o item de resultado, a divisória, o chip do escolhido e a linha da árvore.

## Perguntas em aberto para o dono
1. Busca e árvore hoje são exclusivas (digitou → o botão da árvore some). É intencional, ou a busca
   deveria **filtrar a árvore** e manter uma superfície só?
2. Item de resultado mostra caminho completo; item de árvore mostra só o nome. Unificar em caminho
   completo (mais seguro contra homônimos, muito mais alto) ou manter as duas gramáticas?
3. O rótulo `(opcional)` — mantém a palavra, troca por algo que diga "sem isto usamos a tabela geral",
   ou o selo do card já basta?
4. O corte em **8** resultados foi inferido. Vira lista rolável completa (como a árvore) ou continua
   corte + pedido de refinamento?
5. Nós intermediários são escolhíveis, mas nada distingue visualmente um nó que tem tarifa própria de um
   que herda a do pai. Deve distinguir?

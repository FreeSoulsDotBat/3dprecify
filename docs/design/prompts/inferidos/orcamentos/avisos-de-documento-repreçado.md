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

## O mapa funcional de Orçamentos (registros congelados, exportação, comparação)

### Orçamentos — o que a área é

A quarta aba (rotulada **"Orçamentos"**, rota `/historico`) é a prateleira dos **registros congelados**: cada registro é a afirmação do vendedor sobre *o que ele cotou naquele dia*, com data, e os valores ficam parados para sempre. É o oposto da aba Simulações, que recalcula tudo com os preços de hoje toda vez que abre. O vocabulário é deliberado e vale para todo desenho: diz-se **"Valor cotado"**, nunca "Preço" (preço é o que a Calcular diz *hoje*); diz-se **"salvo"** só quando o servidor confirmou.

**Como o vendedor chega.** Pela barra de abas (mobile) ou pelo menu lateral (desktop). Mas o registro **nasce fora daqui**: no rodapé da Calcular, no rodapé do compositor de Kits e no rodapé da ficha de produto do Catálogo existe um botão **"Salvar em Orçamentos"** que abre a folha de gravação. Ele volta a esta aba para *provar depois o que cobrou* — mostrar ao cliente, exportar um PDF, ou perguntar "meu custo subiu desde que cotei?".

**Rotas.**
- `/historico` — a lista (com busca e filtro de período, paginada por "Carregar mais", nunca carregada inteira).
- `/historico?snapshot={clientSnapshotId}` — o registro. **Abaixo de 1280px** ele toma a tela inteira (com "← Voltar"); **a partir de 1280px** a mesma rota vira **mestre-detalhe**: lista à esquerda, registro na coluna direita fixa (`position:sticky`, rolagem própria), e o primeiro registro abre sozinho.

**O que a área guarda e onde.** Três camadas, sempre unidas numa lista só: (1) o **servidor** (a conta), (2) um **cache local por uid** que responde quando a rede falha, (3) a **outbox** — a fila durável no aparelho. Gravar é *sempre* enfileirar-e-drenar: online a fila esvazia dentro da mesma interação e o registro volta `synced`; offline ele fica `pending` e sincroniza sozinho depois (quatro gatilhos: abertura do app, volta da rede, foco da janela, aba visível). Estados possíveis de um registro: `synced` · `pending` · `blocked` (Premium não ativo) · `unauthenticated` (sessão expirou) · `failed` (servidor recusou).

**De que depende.** Do **entitlement do servidor** (a última palavra sobre o plano — nunca um sinalizador do cliente); do motor **`pricing-core`**, usado *apenas* em "Recalcular hoje" e "Comparar com hoje" — a leitura do registro **não recalcula nada**, todo número é uma string gravada; do **catálogo de tarifas** servido+cacheado (só nesses dois recálculos); da **sessão Firebase**; e do **catálogo de produtos/kits**, consultado só para saber se a origem ainda existe (nunca para um valor).

**O que ela alimenta.** Um cálculo vira registro congelado; um registro vira **PDF de orçamento para o cliente** ou **CSV da conta**; "Recalcular hoje" cria um **registro novo** (o original é imutável — só o rótulo pode ser editado); a ficha técnica leva de volta ao produto/kit de origem, quando ele ainda existe.

**Como muda por estado.**
- **Grátis / deslogado** — a aba inteira é substituída por uma porta honesta: título "Guarde seus orçamentos com a data", subtítulo, "Assinar Premium" e o rodapé "A calculadora continua grátis e sem limite." Nenhuma lista, nenhum registro.
- **Premium ativo** — tudo: gravar, ler, renomear, excluir, recalcular, exportar.
- **Premium pausado (lapsed)** — **nada é apagado**. A lista e os registros continuam legíveis; some a barra gerenciar, some "Recalcular hoje", "Exportar" fica visível-e-desabilitado com o motivo impresso. Uma faixa calma explica: escrever precisa do Premium ativo.
- **Offline** — leitura pelo cache com faixa "Modo leitura offline"; gravar funciona (vira pendente); exportar **não** funciona (o arquivo é gerado no servidor); comparar/recalcular usam o catálogo salvo no aparelho e avisam que ele pode estar desatualizado.
- **Sessão expirada** — os registros novos param na fila com "Envio pausado · sessão expirada", e o caminho de volta ("Entrar de novo") aparece no banner e dentro do registro. O aviso genérico de falha de carga **cala** para não virar uma terceira voz sobre o mesmo fato.

## O ponto exato de inserção desta peça

- **Onde vive:** Duas ressalvas em DOIS pesos visuais diferentes, em três lugares. (a) A legenda de reaproveitamento é um parágrafo cinza pequeno colado logo ABAIXO de "Valores congelados em {data}", dentro do registro — a oitava posição da pilha, antes das peças do kit. (b) A nota estrutural do modelo aposentado é um Alert informativo, e aparece em dois lugares: dentro do diálogo "Recalcular hoje" (abaixo da descrição e da nota de offline, acima de [Voltar]/[Recalcular]) e dentro do painel "Comparar com hoje" (entre a linha "Hoje" e a nota de fecho "Comparação informativa…").
- **Como o vendedor chega:** Sem gesto: (a) aparece ao abrir um registro nascido de um recálculo que NÃO conseguiu reprecificar; (b) aparece ao abrir o diálogo de recálculo ou o painel de comparação sobre um registro calculado por um modelo de fórmula antigo.
- **Vizinhança imediata:** A legenda (a) fica espremida entre a legenda dos valores congelados, logo acima, e o primeiro bloco de conteúdo (peças ou detalhamento), logo abaixo — no meio de outras legendas cinzas de mesmo tamanho. O alerta (b) fica colado ao número novo que ele qualifica.
- **Dados que chegam (e o que ela devolve):** (a) vem de uma marca gravada no próprio documento no momento do recálculo — ela é permanente, porque o registro é imutável e a distinção existe aqui ou não existe em lugar nenhum. (b) é derivada da VERSÃO da fórmula guardada no documento: o modelo antigo tinha um campo "Desperdício" que não existe mais, então parte da diferença entre os dois números pode vir só da mudança do modelo, não de um custo que subiu.
- **O que acontece depois:** Nada acontece — são ressalvas de leitura. O peso delas é o ponto: a informação de que a DATA é de hoje mas o NÚMERO não é de hoje viaja hoje como legenda descartável, do lado do valor que ela desmente.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Os dois avisos de honestidade do orçamento repreçado

## O que desenhar

Duas ressalvas curtas dentro da aba **Orçamentos** (o documento congelado, imutável), no detalhe de um
registro. A primeira aparece quando o app **reemitiu um documento antigo com a data de hoje** por não
conseguir repreçar (a origem sumiu do catálogo, ou o aparelho estava offline e ela não carregou). A
segunda aparece quando um número novo fica ao lado de um valor congelado **calculado por uma versão da
fórmula que não existe mais** (o modelo pré-4.0.0, que tinha o campo Desperdício). Quem lê é o vendedor
decidindo se recota um cliente — o momento em que uma frase omitida vira preço errado no WhatsApp.

## Por que este prompt existe

As duas frases nasceram em 2026-08 (SC-818 do 014 e T037 do 016) — **um mês depois** do protótipo
(2026-07-02) e da spec textual. Não existem em `claude-design-prototype.md`, nem nos dois fixes, nem
em `HistoryScreen.jsx`; a ficha técnica do canvas do dono traz só três linhas (versão da fórmula,
origem com link, nota do relógio do aparelho). Nenhuma das duas ressalvas aparece em qualquer lugar do
canvas. Uma IA decidiu sozinha **dois pesos visuais diferentes para duas ressalvas equivalentes** — e
deu o peso MENOR justamente para a mais grave.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/{snapshot-detail-page,recalc-today,compare-today}.tsx` e
`historico-page.css`.

| # | Onde aparece hoje | Forma atual | Texto literal em pt-BR |
|---|---|---|---|
| 1 | Detalhe do registro, logo abaixo de "Valores congelados em 12/08/2026" e ACIMA de todos os números | parágrafo cinza `tf-historico__meta`, 0.8125rem, `--text-muted` | "Estes valores foram reaproveitados de um congelamento anterior — a origem não estava disponível para repreçar." |
| 2 | Diálogo "Recalcular hoje", entre a descrição e os botões | `Alert tone="info"` (ícone + caixa) | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 3 | Card "Comparar com hoje", entre as duas linhas de valor e a nota final | o MESMO `Alert tone="info"`, texto idêntico | (idem acima) |

Vizinhança real do aviso 1, na ordem da tela: "Cotado em 12/08/2026 às 14:32" → "Valor cotado
R$ 24,24" → "preço de varejo" → "Validade da proposta: 15 dias" → *(banner "Premium pausado" quando
for o caso)* → "Valores congelados em 12/08/2026" → **aviso 1** → Peças do kit → Detalhamento → Preços
por canal → Ficha técnica ("Calculado com a fórmula versão 3.1.0", "Registro criado a partir de:
Vaso G", "Abrir produto", o explicador longo, "Data registrada pelo seu aparelho…").

Problemas a resolver no desenho:

- → **O aviso mais grave é o mais fraco.** "A data é de hoje mas o número não é de hoje" é o que
  impede o documento de mentir, e viaja como legenda de 13px, cinza, na mesma pele de outras quatro
  linhas cinzas da tela ("Valores congelados em…", "Validade da proposta…", "Data registrada pelo seu
  aparelho…", "Calculado com a fórmula versão…"). Some no meio.
- → **O aviso 1 não existe na LISTA.** O card mostra rótulo, "Cotado em {data} · Peça única", "Valor
  cotado R$ 24,24" e "preço de varejo" — nada mais. Um registro reaproveitado é **idêntico** a um
  repreço verdadeiro até o vendedor abrir. (Ver Perguntas.)
- → **Dois pesos para duas ressalvas equivalentes**, sem regra que explique por quê.
- → No desktop (≥1280px) a coluna do documento tem rolagem própria (`position: sticky`, altura máxima
  `100dvh` menos margens). O aviso 1 fica no topo e **pode rolar para fora da tela enquanto os números
  continuam visíveis** — exatamente o estado que ele existe para impedir.

## Conteúdo e dados reais

- Dinheiro: sempre `R$ 1.234,56`, com algarismos tabulares, nunca truncado. Valores plausíveis do
  seed: **R$ 16,16 · R$ 21,01 · R$ 24,24**; um kit chega fácil a **R$ 1.348,00**.
- `{versao}` no aviso 2/3 é uma versão semver real gravada no documento: **"3.1.0"** (pré-remoção) ou
  "3.0.0". A fórmula atual do app é **4.1.0**. A regra é `major < 4`, e nada além disso.
- O aviso 1 é ligado por um campo booleano gravado uma vez, para sempre, dentro do documento imutável
  (`repricedFromFrozen`). Não é derivado, não some, não pode ser corrigido depois.
- O aviso 2/3 é **derivado** da versão gravada — não há campo novo no documento.
- Data e hora vêm do aparelho, formato pt-BR: "Cotado em 12/08/2026 às 14:32".
- Diálogo, quando o repreço deu certo: "Isso cria um NOVO registro com os valores do seu catálogo hoje.
  O registro de 12/08/2026 continua como está." Botões: "Voltar" e "Recalcular".
- No card de comparação as duas linhas têm **peso idêntico** de propósito: "Cotado em 12/08/2026 —
  R$ 24,24" e "Hoje — R$ 27,90", com "preço de varejo" dito uma vez acima das duas, e abaixo:
  'Comparação informativa: este registro não muda. Para gravar o valor de hoje, use "Recalcular hoje".'

## Estados obrigatórios

1. **Repouso sem aviso** — documento repreçado de verdade, modelo 4.x: nenhuma das duas frases
   aparece. É o estado mais comum; desenhe-o para provar que o aviso não é decoração permanente.
2. **Documento reaproveitado** — aviso 1 presente. Mostre-o no detalhe **e** proponha a marcação
   equivalente no card da lista (ver Perguntas).
3. **Modelo aposentado no diálogo de recálculo** — aviso 2 dentro do diálogo, junto com "Voltar" e
   "Recalcular". Só aparece quando o repreço REALMENTE aconteceu (há número novo na tela).
4. **Modelo aposentado na comparação** — aviso 3 dentro do card "Comparar com hoje", entre os dois
   valores e a nota informativa.
5. **Os dois juntos** — é possível: um registro reaproveitado guarda a versão antiga, então ao abrir
   ele mais tarde (já online, origem de volta) o documento carrega o aviso 1 e a comparação carrega o
   aviso 3. Desenhe essa pilha; ela é o pior caso de ruído.
6. **Offline** — uma linha muda a mais, hoje também cinza: "Sem conexão: usando os valores do catálogo
   salvos neste aparelho, que podem estar desatualizados." Aparece no diálogo e na comparação, antes
   do aviso do modelo. Nunca em tom de erro.
7. **Comparação impossível** — no lugar dos dois valores: "Não foi possível calcular o valor de hoje
   para este registro com o seu catálogo atual." Só isso; o valor congelado fica onde estava.
8. **Recálculo sem origem** — a descrição do diálogo troca para: "Não foi possível localizar a origem
   deste registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro
   e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." Neste caso o aviso 2
   **não** aparece (não há número novo para comparar) — e é justamente este caminho que gera o aviso 1
   no registro que nasce daí.
9. **Premium pausado** — "Recalcular hoje" some inteiro (é escrita) e o aviso 2 vai junto; a comparação
   e o aviso 3 continuam legíveis. No topo do documento: "Premium pausado — seus registros continuam
   aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium."
10. **Carregando / confirmando** — "Recalcular" fica ocupado com o rótulo mantido e os avisos visíveis.
11. **Foco / hover / pressionado** nos botões do diálogo e no "Comparar com hoje" (hoje fantasma), e
    foco visível no card do registro aberto na lista.

## Viewports

- **Mobile 390px** — obrigatório: documento, diálogo e card de comparação existem no telefone, e é lá
  que a frase longa do aviso 2 (~200 caracteres) mais ameaça empurrar os botões para fora.
- **Desktop 1280px** — obrigatório: aqui Orçamentos é mestre-detalhe; lista e documento dividem a
  largura e a coluna do documento rola sozinha. É o viewport onde o aviso 1 pode sair de vista.
- **Desktop 1440px+** — desejável: a lista volta a 520px fixos e o documento fica mais largo; vale ver
  se o aviso ganha ou perde presença.

## Regras que o desenho não pode quebrar

- Nenhuma das duas frases pode virar placeholder, tooltip, "ver mais", acordeão fechado ou legenda
  truncada com reticências. Frase honesta mora em elemento de largura cheia e é lida sem interação.
- Falha de rede **nunca** vira tom de erro nem sugestão de que falta Premium: offline e "origem não
  encontrada" são informação calma, não punição.
- O aviso 1 não pode ser mais fraco que a linha "Valores congelados em {data}" que ele qualifica — ele
  contradiz parcialmente essa linha, e o desenho tem de deixar isso legível.
- O aviso 2/3 não pode sugerir que **toda** a diferença vem do modelo: a frase diz "parte da diferença
  acima pode vir daí", e o desenho não pode transformar isso em veredito.
- O valor congelado nunca é reetiquetado como "Hoje", e as duas linhas da comparação mantêm o mesmo
  peso: destacar "Hoje" faria uma comparação informativa parecer a nova verdade.
- Contraste medido contra o fundo real da caixa (o `Alert` info tem fundo próprio); alvo ≥44px nos
  botões do diálogo; zero rolagem horizontal, medida nos dois eixos, não estimada.

## Armadilhas já pagas neste projeto

- **Frase honesta dentro de placeholder foi cortada** (016/PR-F): o sufixo sumia e a honestidade ia
  junto. Estas duas frases são longas; se couberem só cortando, o desenho está errado, não o texto.
- **Texto ocluso passa em teste** (014): `toBeVisible` não vê um aviso empurrado para fora da caixa
  rolante. Desenhe a caixa do diálogo com a frase inteira dentro, no telefone.
- **Rolagem vertical que o headless não enxerga** (016/PR-B): a coluna do documento no desktop rola de
  verdade; o aviso não pode depender de o vendedor rolar para cima.
- **Valor grande estoura a coluna** (E4/close-out): um kit de R$ 1.348,00 ao lado de um rótulo longo
  colidiu num PDF sem teste nenhum perceber — as duas linhas da comparação têm essa mesma forma.
- **Cinza empilhado vira invisível**: já são quatro linhas `--text-muted` seguidas antes do aviso 1.

## Entregável

Pranchetas, tema escuro (padrão) e tema claro (first-class, mesma fidelidade):

1. Detalhe a 390px **com** o aviso 1 — e a mesma prancheta sem ele, para comparar o peso.
2. Card da lista a 390px propondo a marcação do registro reaproveitado (se o dono disser sim).
3. Diálogo "Recalcular hoje" a 390px com o aviso 2, incluindo a variante offline (duas ressalvas
   empilhadas + dois botões).
4. Card "Comparar com hoje" a 390px, aberto, com os dois valores e o aviso 3.
5. Mestre-detalhe a 1280px com o documento reaproveitado à direita, mostrando o aviso ao rolar.
6. O pior caso: documento reaproveitado **e** modelo aposentado na mesma tela.

Reutilize os primitivos existentes, sem criar novos: **Card** para o documento, o card de comparação e
os cards da lista; **Alert** (tom `info`) para os avisos do modelo aposentado; **Badge** se a marcação
da lista for por selo; **Button** nas variantes secundária (Voltar/Recalcular hoje) e fantasma
(Comparar com hoje); **Dialog** para o recálculo; **Icon** para o ícone do alerta. Se o aviso 1 precisar
subir de peso, prefira reusar o `Alert` que já existe a inventar um quinto tratamento de legenda.

## Perguntas em aberto para o dono

1. **O registro reaproveitado deve se declarar na LISTA?** Hoje não se declara: o card é idêntico ao de
   um repreço verdadeiro, e a diferença só aparece ao abrir. Se sim, é selo, legenda ou mudança de tom?
2. **Os dois avisos devem ter o mesmo peso?** Se não, qual é o mais grave para você: "o número não é de
   hoje" ou "parte da diferença vem da fórmula antiga"?
3. **Quando os dois caem na mesma tela, mostram-se os dois?** Um resume o outro, um vira secundário, ou
   ambos ficam inteiros?
4. **A nota do modelo aposentado deveria aparecer também no documento congelado sozinho** (ao lado de
   "Calculado com a fórmula versão 3.1.0"), e não só quando há um número novo ao lado?

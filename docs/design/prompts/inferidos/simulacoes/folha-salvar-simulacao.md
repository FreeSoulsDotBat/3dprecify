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

## O mapa funcional de Simulações salvas (cenários de marketplace)

### Simulações salvas (cenários de marketplace) — mapa funcional da área

**O que é.** Uma *simulação* é uma estratégia de venda guardada: a combinação de canais (Mercado Livre, Shopee, Amazon…), modalidade, categoria, taxas ajustadas à mão, markup e a base de custo que estavam na tela quando o vendedor salvou. Ela **não guarda preço**. Ao reabrir, o app recalcula tudo com os preços e as tarifas de hoje — é o oposto do Orçamento, que congela um número para sempre. Toda a copy da área existe para sustentar essa diferença ("Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." / "Recalculado com os preços de hoje"), e por regra **nenhum cartão de simulação mostra data nem dinheiro** — só nome, nota e um carimbo relativo ("Atualizado há 2 dias").

**Como o vendedor chega.** A área **não tem rota própria**: ela vive inteiramente como folhas (`Sheet` ancorado à direita, largura `min(92vw, 26rem)`, altura total, sobre um scrim) e blocos dentro da aba **Calcular** (`/calcular`). Decisão técnica registrada no código: uma sub-rota `/calcular/cenarios` abriria em branco no recarregamento (o app usa `base:'./'`, e qualquer rota de 2 segmentos morre no cold load). Três portas existem:
- **"Minhas simulações"** — botão fantasma no topo do `/calcular`, abre a folha da lista. Visível para **todo mundo**, inclusive grátis e deslogado.
- **"Salvar simulação"** — botão no rodapé do `/calcular`, abaixo do resultado. **Só existe com Premium ativo** (não é teaser, é ausência).
- **"Salvar simulação"** — o mesmo botão dentro da ficha de produto salvo do Catálogo (`/catalogo/produtos/$id`), que grava a simulação **referenciando aquele produto**.

**As rotas envolvidas.** `/calcular` (a única casa da área: lista, salvar, barra de contexto, resumo de kit, avisos) · `/catalogo` com `?produto=` e `/kits?id=` (destinos do botão "Abrir origem", quando a base de custo é um produto ou um kit do catálogo).

**O que a área guarda, e onde.** No **servidor** (Postgres, por usuário): nome, nota e o documento de configuração (`config`), com paginação *keyset* por `created_at DESC` e busca por nome. No **cache local IndexedDB, chaveado por uid**: uma cópia de leitura da lista não filtrada, pré-carregada antes da resposta do servidor e usada como fallback quando a rede falha; **purgada no logout**. Escrita **não tem outbox**: diferente de Orçamentos, salvar/renomear/duplicar/excluir offline **falha na hora, honestamente** — nunca entra em fila, nunca finge que salvou.

**De que depende.** Do **entitlement** vindo do servidor (`active` · `lapsed` · `none`) — o cliente só decora, quem barra é o servidor · do **catálogo de tarifas** servido + cacheado + com semente embutida (é ele que faz o recálculo "de hoje" mudar) · do motor **`pricing-core`** em TypeScript, que calcula no dispositivo, inclusive offline · da **sessão Firebase** (sem sessão não há lista) · e das entidades **produto** e **kit** do Catálogo, quando a base de custo é uma referência.

**O que ela alimenta depois.** Reaberta, a simulação **vira a calculadora**: os 17 campos escalares são repovoados e o cálculo roda ao vivo. Dali o vendedor pode **congelar um orçamento** (Histórico/Orçamentos) a partir da simulação — o orçamento nasce carimbado com a procedência `SCENARIO` (id + nome como estavam ao abrir). E pode **duplicar-para-ajustar**: a cópia nasce no servidor como "Cópia de {nome}" e passa a ser o objeto editado.

**Estados por situação:**
- **Grátis / deslogado** — a porta "Minhas simulações" aparece igual, mas a folha inteira vira um **teaser Premium** ("Salve suas simulações…" + "Assinar" + "A calculadora continua grátis."), e o subtítulo da lista é suprimido para não repetir a promessa. O botão "Salvar simulação" **não existe** no rodapé.
- **Premium ativo** — lista, busca, abrir, renomear, duplicar, excluir, salvar alterações: tudo liberado.
- **Premium pausado (lapsed)** — **leitura completa, escrita congelada**: abre e recalcula normalmente, mas os três ícones de cada cartão ficam desabilitados, um alerta "Premium pausado" aparece no topo da lista e a mesma frase se repete embaixo de cada cartão e na barra de contexto. Não há CTA de reativação dentro desses avisos.
- **Offline** — a lista é servida do cache com o alerta "Modo leitura offline"; o cálculo continua funcionando (o motor é local); qualquer escrita responde "Esta ação precisa de conexão." Quando lapso e offline coincidem, a justificativa do lapso vence.
- **Sessão expirada** — o 401 não apaga o cache; a área depende do banner global "Entrar de novo" para o vendedor voltar.

**Corte desktop.** O app tem um limiar de composição em **1280px** (`useIsWide`), usado hoje por Catálogo, Kits, Orçamentos e Conta (lista + ficha ao lado). **Nada da área de Simulações usa esse limiar** — em 1920px ela renderiza exatamente o layout de celular. O `/calcular` em si vira duas colunas a partir de 1024px, mas todos os blocos de simulação ficam **fora da grade**, em faixa única de largura total.

## O ponto exato de inserção desta peça

- **Onde vive:** Segunda folha lateral direita da área (mesmo primitivo, mesma largura ≈416px, altura total), aberta POR CIMA da rota `/calcular` — ou de `/catalogo/produtos/$id`. Ordem vertical literal: título "Salvar simulação" → parágrafo de introdução ("Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje.") → campo **Nome** (obrigatório, 120 caracteres) → campo **Nota (opcional)** (textarea de 3 linhas, 500 caracteres) → parágrafo cinza pequeno "Base de custo: {nome}" → mensagem de erro, quando houver → botão de submit "Salvar simulação". Não há botão Cancelar nem rodapé fixo.
- **Como o vendedor chega:** Por um dos dois botões "Salvar simulação": o do rodapé do Calcular, abaixo do resultado, ou o da ficha de produto do Catálogo. Chega SEMPRE com Premium ativo (sem isso o botão não existe) e com o cálculo já válido na tela. No instante em que a folha abre, a configuração é CONGELADA — o que será salvo é o que estava na tela naquele momento, mesmo que a página atrás mude depois.
- **Vizinhança imediata:** Por baixo do scrim fica o rodapé de preços de onde ela foi chamada: no Calcular, o bloco de resultado com "Como chegamos no preço"/"Preços por canal", o próprio botão "Salvar simulação" e, logo abaixo dele, o botão "Salvar no histórico". Dentro da folha, o X de fechar sobreposto no topo direito, sobre o título.
- **Dados que chegam (e o que ela devolve):** Recebe o documento `config` construído a partir do formulário vivo (campos, canais, taxas, base de custo) e um rótulo já resolvido para o eco: "avulsa" quando o cálculo é solto, ou "{nome do produto} (referência do catálogo)" quando veio da ficha. Devolve `POST /api/v1/scenarios`, cujo gate real é o entitlement ATIVO no servidor.
- **O que acontece depois:** Em 201 real: toast "Simulação salva." e a folha fecha, devolvendo a calculadora inalterada (o cálculo continua exatamente onde estava — salvar não abre a simulação). Em falha: a folha PERMANECE aberta com nome e nota intactos e a frase honesta e específica aparece acima do botão ("Salvar uma simulação precisa de conexão." quando offline; a recusa do servidor quando é o entitlement).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Folha "Salvar simulação" — nome, nota e o eco da base de custo

## O que desenhar
A folha (painel deslizante) que aparece quando um vendedor **premium** termina de comparar canais na calculadora e toca em "Salvar simulação". Ela captura duas coisas — um **nome** e uma **nota opcional** — e é o único momento em que o produto pergunta "como você quer chamar essa estratégia?". Ela vive em dois lugares: na aba **Calcular** (base de custo avulsa, logo abaixo do bloco "Preços por canal") e dentro do **produto do Catálogo** (base de custo = a referência do catálogo). O que é salvo não é um preço congelado: é a *estratégia* (canais, taxas ajustadas, base de custo), que recalcula com os preços de hoje toda vez que for reaberta — e essa distinção entre Simulações e Orçamentos é justamente o que o vendedor precisa entender **antes** de nomear.

## Por que este prompt existe
Esta folha nunca foi desenhada: a ordem, a hierarquia e o comportamento saíram direto do JSX (`apps/web/src/features/scenarios/save-scenario-sheet.tsx`), inferidos de requisito textual. O protótipo de 2026-07-02 tem uma folha de formulário parecida ("Adicionar filamento", `CatalogScreen.jsx`), mas ela é **ancorada embaixo** e tem um rodapé com **[Cancelar][Salvar]** lado a lado — a construída é ancorada à **direita**, não tem rodapé e não tem Cancelar. E o objeto é outro: no protótipo, salvar era *gated* ("Ação Salvar → dispara bottom-sheet de UPSELL"), então uma folha de salvar simulação não podia existir lá. O documento `ux-scenarios.md` §10.1 item 4 pede este protótipo com prioridade "High" — nunca foi feito.

## O que já existe hoje (não invente do zero — corrija)
Ordem literal na tela, de cima para baixo:

| # | Elemento | Texto literal em pt-BR |
|---|---|---|
| 1 | Título da folha | "Salvar simulação" |
| 2 | Parágrafo de introdução (cinza, `--text-muted`, `fs-body-sm`) | "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje." |
| 3 | Campo obrigatório, texto de uma linha | rótulo "Nome" (com marca de obrigatório) |
| 4 | Campo opcional, área de texto de 3 linhas | rótulo "Nota (opcional)" + a marca "opcional" à direita do rótulo |
| 5 | Linha de eco, **cinza, tamanho pequeno**, sem rótulo destacado | "Base de custo: avulsa" · "Base de custo: Suporte de fone de ouvido (referência do catálogo)" |
| 6 | Linha de erro do envio (vermelha), só quando existe | ver Estados |
| 7 | Botão de envio, largura total | "Salvar simulação" |
| — | Fechar | apenas o "✕" de 44×44px no canto superior direito. **Não existe Cancelar.** |

→ **O problema central**: o item 5 é a única informação que diz *o que está sendo guardado*, e hoje ele aparece **por último, em cinza, do tamanho de uma legenda**, depois dos campos. A pessoa nomeia antes de saber o que nomeia. O desenho deve resolver isso — a base de custo é contexto de cabeçalho, não rodapé.
→ **Sem contador de caracteres** apesar de dois limites reais (120 e 500). No Nome o navegador trava em 121 caracteres e só então a mensagem de erro aparece; na Nota não há trava nenhuma — dá para digitar 900 caracteres e só descobrir no clique.
→ **Sem nome sugerido.** A folha abre com o campo vazio, embora o app já saiba o produto/base e a data.
→ **A folha é ancorada à direita, ocupando a altura toda** (largura = min(92vw, 26rem)). Em 390px isso vira uma gaveta lateral de ~359px colada na borda direita — herdado do primitivo, não decidido.
→ **O botão de envio não tem estado de carregando**: durante o POST ele só fica desabilitado (o primitivo de botão tem estado com giro e rótulo mantido, e a folha de "Renomear simulação" usa esse estado; esta não).
→ **Mensagem escrita e nunca exibida**: "Esta simulação ficou grande demais para salvar. Reduza o número de peças ou de custos e tente de novo." existe no arquivo de textos e **nenhuma tela a renderiza**. Se o desenho previr o caso de payload grande, ele precisa ter lugar visível — frase honesta que ninguém vê é frase que não existe.
→ **Beco sem saída**: se a calculadora não produziu um resultado válido, o botão de envio abre desabilitado e a folha não mostra explicação nenhuma (a frase "Corrija os campos da calculadora antes de salvar." só é acionada por um envio que o botão desabilitado impede). Desenhe esse caso com a frase visível, não com um botão morto.

## Conteúdo e dados reais
- **Nome** — texto livre, obrigatório, máximo **120 caracteres**. Erros literais: "Dê um nome à simulação." (vazio) e "Máximo de 120 caracteres." (estourou). Espaços nas pontas são descartados no envio.
- **Nota** — texto livre, opcional, máximo **500 caracteres**, 3 linhas visíveis. Erro literal: "Máximo de 500 caracteres."
- **Base de custo** — somente leitura, derivada do que estava na tela quando a folha abriu (é congelada na abertura: quem escreve o nome não altera mais o que será salvo). Três formas possíveis do sufixo: "avulsa", "referência do catálogo", "kit do catálogo" — hoje só as duas primeiras chegam à tela. Exemplos reais para desenhar: `Base de custo: avulsa` e `Base de custo: Suporte de fone de ouvido (referência do catálogo)`.
- **Nome longo sem espaço** é um caso real e já quebrou layout: desenhe o eco com quebra em qualquer ponto (120 caracteres colados têm de quebrar dentro do painel de ~359px, nunca vazar).
- **Sucesso** — um aviso flutuante de tom positivo com "Simulação salva." e a folha fecha. Só em gravação real: nada de "salvo!" otimista.
- Números que circulam ao redor desta folha, se precisar mostrar contexto na prancheta: preço sugerido `R$ 24,24`, alternativas `R$ 16,16` e `R$ 21,01`.

## Estados obrigatórios
1. **Gatilho ausente** — sem premium ativo o botão "Salvar simulação" simplesmente **não existe** na calculadora (não é cinza, não é isca). Desenhe a região sem ele, para mostrar que a página livre fica intacta.
2. **Gatilho inerte** — botão visível e desabilitado enquanto a calculadora está inválida; precisa de uma explicação legível ao lado ("Corrija os campos da calculadora antes de salvar."), hoje inexistente.
3. **Repouso da folha** — campos vazios, botão de envio habilitado.
4. **Foco** — anel de foco visível no campo de texto e na área de texto, e no "✕".
5. **Digitando com erro no Nome** — a mensagem "Dê um nome à simulação." **não** aparece antes da pessoa digitar; ela aparece assim que o campo foi tocado **ou** depois de uma tentativa de envio (regra criada em resposta a um defeito real: o clique não fazia nada e nada era dito). Desenhe as duas situações: campo intocado silencioso e campo em erro depois do clique.
6. **Limite estourado** — Nome com 121 caracteres ("Máximo de 120 caracteres."), Nota com 501+ ("Máximo de 500 caracteres."). Mostre onde o contador deveria estar.
7. **Enviando** — botão ocupado (giro + rótulo mantido), campos ainda legíveis, "✕" ainda alcançável.
8. **Erro de gravação** — a folha **permanece aberta com tudo digitado intacto**, e a linha vermelha diz a causa medida. Sem conexão: "Salvar uma simulação precisa de conexão." Falha do servidor: a mensagem específica do erro. Nunca uma falha de rede vendida como "não é premium".
9. **Documento grande demais** — a frase citada acima, hoje sem lugar na tela.
10. **Sucesso** — aviso "Simulação salva." e fechamento.
11. **Premium pausado / sem permissão** — o gatilho some (mesmo caso 1). Se a assinatura vencer entre abrir a folha e enviar, o servidor recusa e o caso 8 é o que aparece: desenhe essa recusa com texto honesto, não com um upsell disfarçado de erro.

## Viewports
- **390px (mobile)** — obrigatório: é o uso principal e é onde a âncora lateral de altura cheia é mais questionável. Mostre também o comportamento com teclado virtual aberto (o botão de envio não pode ficar inalcançável).
- **1280px (desktop)** — obrigatório: a mesma folha aparece na calculadora e dentro do produto do Catálogo. Em 1280 o painel de 416px convive com a página atrás; mostre a relação com o conteúdo escurecido por trás.
- **1920px** — opcional, só se a proporção do painel mudar sua recomendação.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou o vendedor tem premium ativo e a folha existe inteira, ou o gatilho não existe. Nada de campo desabilitado com cadeado, nada de isca dentro da folha.
- **Procedência do número**: o eco da base de custo é a origem do que está sendo salvo — ele precisa estar visível **antes** do envio e legível sem esforço.
- **A promessa tem de aparecer**: "recalcula com os preços de hoje" é o que separa Simulação de Orçamento; não pode virar letra miúda.
- **Frase honesta nunca em placeholder** e nunca dentro de um elemento estreito que corte o texto — erros e explicações vivem em elementos de largura total.
- **Erro nunca cria fato**: falha de gravação mantém os valores; nada de fechar a folha e perder o que foi digitado.
- **Alvos ≥44×44px** (o "✕", o botão de envio) e contraste medido contra a superfície real da folha, nos dois temas.
- Se você propuser um botão **Cancelar** (o protótipo tinha), diga onde ele fica sem competir com o envio — e lembre que o vocabulário do produto usa "Voltar", nunca "Cancelar", em superfícies de simulação.

## Armadilhas já pagas neste projeto
- **Texto ocluso passa em teste**: elemento visível para o código e coberto na tela. Verifique o empilhamento do painel, do escurecimento de fundo e do aviso flutuante de sucesso.
- **Estouro horizontal medido**: um nome de 120 caracteres sem espaço já ameaçou vazar o painel de 390px; o eco precisa quebrar em qualquer ponto.
- **Placeholder que corta a frase**: já aconteceu de a frase honesta caber só como sufixo de um campo e ser truncada — não repita.
- **Aviso que existe no código e nunca aparece**: é literalmente o caso da mensagem de "grande demais"; todo texto de estado precisa de uma prancheta que o mostre.
- **Barra de rolagem clássica não aparece em captura**: se o conteúdo da folha passar da altura, desenhe explicitamente onde ele rola e o que fica fixo.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (igualmente acabado)**:
1. Folha em repouso, 390px — com a base de custo reposicionada como contexto de cabeçalho.
2. Folha com Nome em erro depois de tentar salvar, 390px.
3. Folha em envio + folha em erro de gravação com valores intactos ("Salvar uma simulação precisa de conexão."), 390px.
4. Folha com limites (contador de Nome e de Nota) e nome longo sem espaço no eco, 390px.
5. Folha em 1280px, sobre a calculadora, mostrando o escurecimento e a ancoragem escolhida.
6. Região do gatilho na calculadora nos três casos: presente, inerte com explicação, e ausente (sem premium).
7. Estado de sucesso: aviso "Simulação salva." e a folha saindo.

Reutilize os primitivos existentes, sem inventar novos: painel deslizante `tf-dialog--sheet` (com o fecho `tf-dialog__x` de 44×44) para a folha; `tf-dialog__title` para "Salvar simulação" e `tf-dialog__desc` para a introdução; `tf-field` (rótulo + marca "opcional" + linha de erro com `--danger-text`) envolvendo `tf-input` para Nome e Nota; `tf-btn` primário de largura total, com o estado `loading` de giro, para o envio; `tf-btn--secondary` para o gatilho na calculadora; o aviso flutuante padrão de tom positivo para "Simulação salva."; e, se o eco virar bloco de contexto, uma superfície `tf-card` discreta ou `tf-badge` para o sufixo de origem.

## Perguntas em aberto para o dono
1. **O eco da base de custo sobe para o topo?** Ele é a informação que diz o que está sendo salvo, mas hoje é a última linha em cinza. Quer contexto de cabeçalho (acima do Nome), ou mantém como confirmação final?
2. **"Base de custo: avulsa"** é uma frase que um vendedor leigo entende? "avulsa" é vocabulário interno. Existe rótulo aprovado para "não veio do catálogo"?
3. **Nome sugerido**: a folha deve abrir com algo pré-preenchido (nome do produto + data, por exemplo) e editável, ou o campo vazio é intencional para forçar uma escolha consciente?
4. **Cancelar/Voltar**: o protótipo tinha rodapé com dois botões; a peça construída só tem o "✕". Fica só o "✕" ou entra um "Voltar" explícito?
5. **Ancoragem em mobile**: gaveta lateral de altura cheia (como está) ou folha de baixo (como o protótipo de "Adicionar filamento")? Isso muda toda a composição em 390px.
6. **Documento grande demais**: a mensagem existe e nunca é mostrada. É um estado que ainda deve existir? Se sim, a recusa aparece na folha ou antes, no gatilho?

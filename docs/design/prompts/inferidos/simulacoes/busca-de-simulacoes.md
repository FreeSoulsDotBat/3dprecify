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

- **Onde vive:** Primeiro elemento do corpo da lista, dentro da folha "Minhas simulações": um `Field tightLabel` sem rótulo visível envolvendo um `tf-inputwrap` > `tf-input` de largura total do painel, com placeholder "Buscar por nome…" e SEM ícone de lupa e SEM "x" de limpar inline. O estado "nada encontrado" ocupa o lugar da pilha de cartões, logo abaixo dos alertas.
- **Como o vendedor chega:** O vendedor abre a folha e o campo já está ali, entre o subtítulo-promessa e os cartões. Só existe no ramo Premium (o teaser substitui o corpo inteiro). Digitação com debounce de 250ms: nada acontece enquanto ele digita, e então a lista troca.
- **Vizinhança imediata:** Acima: o subtítulo "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.". Abaixo, na ordem: o alerta "Modo leitura offline" (se houver), o alerta "Premium pausado" (se houver), um alerta vermelho de erro de duplicação (se houver) e então os cartões — ou o vazio de busca. O X de fechar da folha fica acima e à direita, sobre o título.
- **Dados que chegam (e o que ela devolve):** O termo digitado vira `q` na chamada ao servidor (resultado filtrado NÃO é persistido no cache offline — só a lista completa é). Devolve a mesma lista `ScenarioOut`, filtrada por nome. Não devolve contagem de resultados.
- **O que acontece depois:** Com resultados, a pilha de cartões é substituída pelos que casam. Sem resultados, aparece um `EmptyState` com o MESMO ícone `boxes` do vazio geral, título "Nenhuma simulação encontrada para “{termo}”." e um botão secundário "Limpar busca" que zera o campo e devolve a lista inteira.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Busca dentro de "Minhas simulações" (campo + "nada encontrado")

## O que desenhar
O campo de busca por nome que fica no topo da folha **"Minhas simulações"** — o painel lateral que o
vendedor abre pelo cabeçalho da tela Calcular para reabrir uma estratégia salva (canais, taxas
ajustadas, base de custo) — e o estado **"nada encontrado"** que aparece quando a busca não devolve
nenhuma linha. Quem usa: um vendedor Premium que já acumulou dezenas de simulações e precisa achar
"Camiseta Shopee 3 canais" sem rolar a lista inteira. O momento é sempre de pressa: ele está com a
calculadora aberta, quer trocar de cenário e voltar. A peça é pequena (um campo + um vazio), mas é a
única porta de entrada para uma lista que cresce sem limite.

## Por que este prompt existe
Ninguém desenhou esta busca. Ela foi inferida a partir de requisito textual e saiu **sem lupa, sem
rótulo visível, sem "x" de limpar e sem contador de resultados** — enquanto o dono desenhou o MESMO
componente duas vezes no canvas de 018, e nas duas **com a lupa dentro do `tf-inputwrap`** (Catálogo,
`placeholder="Buscar no catálogo…"`; Orçamentos, `placeholder="Cliente, pedido…"`). Ou seja: o código
contraria uma regra de desenho explícita do próprio produto. O canvas exclui a aba Calcular por
escrito, então a busca DESTE painel nunca teve prancheta. Registro corroborante de que ninguém olhou:
o campo chegou a ser publicado **1×1px, invisível**, e só foi descoberto depurando no navegador real
(o comentário está no próprio arquivo). Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`.

## O que já existe hoje (não invente do zero — corrija)
A folha, de cima para baixo: título "Minhas simulações" · subtítulo "Estratégias salvas. Cada uma
recalcula com os preços de hoje quando você abre." · **campo de busca** · alertas (offline / premium
pausado) · lista de cards · "Carregar mais".

| Peça | Como está hoje | Problema |
|---|---|---|
| Rótulo do campo | Nenhum visível. O `aria-label` é a própria frase do placeholder | → o placeholder some ao digitar e o campo fica anônimo |
| Placeholder | "Buscar por nome…" | → é a única pista de que aquilo é uma busca |
| Ícone | **nenhum** | → o desenho do dono tem lupa em toda busca deste produto |
| Limpar | só o botão "Limpar busca" DENTRO do vazio | → com resultados na tela não há como limpar sem apagar à mão |
| Contador | não existe | → o Catálogo mostra a contagem ao lado do campo; aqui não |
| Feedback ao digitar | debounce de 250ms e a busca vai ao **servidor** | → ver "Estados obrigatórios": hoje isso apaga o campo da tela |
| Vazio da busca | `EmptyState` ícone `boxes`, título "Nenhuma simulação encontrada para “{termo}”.", botão "Limpar busca" | → **mesmo ícone** do vazio geral; sem descrição de saída |
| Vazio geral | `EmptyState` ícone `boxes`, "Nenhuma simulação salva ainda" + "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a calculadora" | → indistinguível do vazio de busca à primeira vista |

Para comparação, o Catálogo (desenhado) usa: lupa + rótulo `sr-only` "Buscar no catálogo" + contagem
ao lado + vazio de busca com ícone PRÓPRIO (`package`), título "Nada encontrado para essa busca" e
descrição "Tente outro termo, ou limpe a busca para ver tudo de novo."

## Conteúdo e dados reais
- **Termo de busca**: texto livre, sem mínimo de caracteres, casado contra o **nome** da simulação
  (nome: obrigatório, até 120 caracteres). A busca roda no servidor a cada 250ms parados.
- **Card de resultado** (o que a busca devolve): nome em 1 linha com reticências · nota opcional em 2
  linhas com reticências (até 500 caracteres) · legenda "Atualizado há 2 dias" (nunca uma data — as
  formas reais são "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas") · três botões
  fantasma em linha à direita: renomear (lápis), duplicar (cópia), excluir (lixeira), 18px cada.
- **Eco do termo** no vazio: o título repete literalmente o que foi digitado, entre aspas curvas.
  Exemplo real de estouro: buscar `Camiseta preta estampada personalizada Shopee frete grátis` produz
  um título de mais de 60 caracteres dentro de um painel de no máximo 416px.
- **Sem total conhecido**: a lista é paginada por cursor ("Carregar mais"), então só existe a
  quantidade **já carregada** — um contador não pode prometer "de X".

## Estados obrigatórios
1. **Repouso, vazio**: lupa + placeholder "Buscar por nome…", rótulo legível (não só para leitor de tela).
2. **Foco**: borda e anel na cor de foco lidos como UM traço só (o produto já teve borda dupla aqui).
3. **Hover** do campo e dos botões de ação do card.
4. **Preenchido com resultados**: o termo visível, o "x" de limpar disponível, e a contagem do que está
   na tela (ver perguntas ao dono para a copy exata).
5. **Buscando (o estado que hoje não existe e é o principal pedido)**: como a busca vai ao servidor e a
   consulta filtrada não tem cache, hoje a tela inteira é substituída por um `Spinner` — **o campo
   desaparece e o foco se perde no meio da digitação**. Desenhe um carregamento que mantenha o campo
   montado e no lugar: indicador dentro/ao lado do campo e a área de resultados em espera.
6. **Vazio de busca**: "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca" — com ícone
   DIFERENTE do vazio geral e uma descrição que diga a saída ("Tente outro termo…").
7. **Vazio geral (para contraste, na mesma prancheta)**: "Nenhuma simulação salva ainda" + o corpo e o
   botão "Voltar para a calculadora".
8. **Offline**: hoje, com termo digitado, cai na parede vermelha "Não foi possível carregar suas
   simulações." + "Tentar novamente" — sem dizer que a causa é conexão e sem oferecer a lista guardada.
   Sem termo, aparece o alerta informativo "Modo leitura offline" / "Suas simulações continuam aqui e
   podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." Desenhe o estado
   honesto da BUSCA offline (a copy depende da decisão do dono, abaixo).
9. **Erro de carga**: alerta de perigo "Não foi possível carregar suas simulações." + "Tentar novamente".
10. **Premium pausado**: alerta informativo "Premium pausado" / "Suas simulações continuam aqui e podem
    ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." A busca
    e o abrir continuam funcionando; os três botões do card ficam desabilitados com a legenda "Premium
    pausado — reative para renomear, duplicar, editar ou excluir." (offline a legenda é "Esta ação
    precisa de conexão.").
11. **Sem permissão / grátis**: o campo NÃO existe — o painel inteiro vira o teaser de Premium. Não
    desenhe uma busca desabilitada aqui; a porta é binária.

## Viewports
- **Mobile 390px** — é onde o vendedor mais usa; o painel ocupa 92vw (≈359px) e o campo divide a linha
  com um eventual contador.
- **Desktop 1280px** — a mesma folha, ancorada na borda e limitada a 26rem (≈416px). O redesenho
  desktop de 018 não cobre a aba Calcular, então este painel é hoje idêntico nos dois tamanhos:
  desenhe os dois e diga explicitamente se o contador cabe na mesma linha do campo em 359px ou desce.

## Regras que o desenho não pode quebrar
- **A frase honesta nunca mora num placeholder.** O rótulo do campo precisa existir como texto, não
  como texto que evapora ao primeiro caractere.
- **Falha de rede nunca é vendida como "você não tem nada"** nem como "não é premium": um vazio de
  busca offline tem de dizer que a causa é conexão.
- **O vazio de busca não pode parecer o vazio de "você nunca salvou nada"** — o vendedor tem dados; dizer
  o contrário é mentir sobre os dados dele (regra já escrita no Catálogo, palavra por palavra).
- **Alvo ≥44px** para o "x" de limpar e para os três botões de ação do card, inclusive dentro de um
  campo de altura padrão.
- **Contraste medido contra o fundo real do campo** (superfície de card dentro de painel sobre overlay),
  não contra o fundo da página.
- Freemium binário: sem Premium, teaser inteiro — nunca uma busca "quase funcionando".

## Armadilhas já pagas neste projeto
- **O campo 1×1px**: esconder o rótulo escondeu o controle inteiro, e nenhum teste viu. Se o rótulo for
  visualmente oculto, mostre na prancheta que o campo permanece com altura e largura de verdade.
- **Ocluso passa no teste**: elemento coberto ou estourado continua "visível" para asserção de texto.
  Meça as caixas, e meça **os dois eixos** — o eixo vertical já escondeu um scroll neste produto.
- **Tamanho adversarial**: o eco “{termo}” no título do vazio, um nome de 120 caracteres e uma nota
  colada sem espaços (500 caracteres de um token só) têm de truncar com reticências VISÍVEIS dentro de
  416px, sem empurrar o painel para o lado.
- **Placeholder que corta a frase**: números cabem em placeholder; explicação, não.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**, nos dois viewports:
1. Campo em repouso · foco · preenchido com "x" de limpar · buscando (com o campo ainda na tela).
2. Painel com resultados: campo + contador + 3 cards (um com nota longa truncada).
3. Vazio de busca com termo curto e vazio de busca com termo longo (o teste de estouro).
4. Vazio geral, lado a lado com o vazio de busca, para provar que são distinguíveis.
5. Offline com termo digitado · premium pausado (cards com ações desabilitadas e a legenda).

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap` + `tf-input` para o campo (com o
mesmo SVG de lupa dos artboards de Catálogo e Orçamentos, 18px, cor de texto suave); `tf-btn--ghost`
`tf-btn--sm` para o "x" de limpar e para lápis/cópia/lixeira; `tf-empty` (com `tf-empty__icon`) para os
dois vazios; `tf-btn--secondary` para "Limpar busca", "Tentar novamente" e "Carregar mais";
`tf-alert--info` e `tf-alert--danger` para offline/pausado/erro; `tf-card` `padding="sm"` para cada
resultado; o spinner do DS para o carregamento. A contagem é legenda em texto suave, não `tf-badge`,
a menos que você mostre por que o badge lê melhor.

## Perguntas em aberto para o dono
1. **Busca offline**: hoje ela só existe no servidor, e sem conexão vira parede de erro. Deve buscar no
   que já está guardado no aparelho (e então a lista filtrada offline é confiável), ou dizer "a busca
   precisa de conexão" e devolver a lista completa guardada?
2. **Contador**: mostrar sempre (como no Catálogo) ou só durante a busca? E qual a frase, já que o total
   não é conhecido — "3 encontradas" pode virar mentira quando "Carregar mais" trouxer mais.
3. **Copy do vazio de busca**: manter o eco do termo ("Nenhuma simulação encontrada para “X”.") ou
   unificar com a frase já homologada do Catálogo ("Nada encontrado para essa busca" + "Tente outro
   termo, ou limpe a busca para ver tudo de novo.")?
4. **Mínimo de caracteres** antes de disparar a busca no servidor (hoje 1 caractere já dispara), e a
   busca deve casar também a **nota**, ou só o nome?

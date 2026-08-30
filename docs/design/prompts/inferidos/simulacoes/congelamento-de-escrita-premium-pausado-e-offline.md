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

- **Onde vive:** Não é uma peça só — é um estado montado por acúmulo em três lugares simultâneos. (1) Um `Alert tone="info"` "Premium pausado" entre o campo de busca e o primeiro cartão, dentro da folha "Minhas simulações" (só quando existe pelo menos um item e a lista não é cache velho); no caso offline, o alerta equivalente é "Modo leitura offline", com um "Tentar novamente" embutido. (2) Os três ícones de ação de TODOS os cartões desabilitados. (3) Uma linha de 12px cinza alinhada à DIREITA repetida embaixo de CADA cartão, com a frase inteira ("Premium pausado — reative para renomear, duplicar, editar ou excluir." ou "Esta ação precisa de conexão."). E a MESMA frase aparece de novo na barra de contexto, ocupando a largura toda embaixo da faixa de botões.
- **Como o vendedor chega:** Sozinho, sem gesto: a assinatura vence (o servidor passa a responder `lapsed`) ou o aparelho perde a rede. O vendedor só descobre ao abrir a folha ou ao tentar uma ação. Ler e recalcular continuam funcionando integralmente — o motor de cálculo é local.
- **Vizinhança imediata:** Numa lista de 6 cartões, o painel exibe o alerta no topo MAIS seis repetições da mesma frase, uma colada no rodapé de cada cartão. Se estiver offline E lapsado ao mesmo tempo, o código escolhe a justificativa do lapso. Nenhum desses avisos contém CTA de reativação — o caminho para reativar está em outra aba (Conta).
- **Dados que chegam (e o que ela devolve):** Dois sinais: o entitlement do servidor (`lapsed`) e o estado online do navegador. Deles saem `writesDisabled` e a frase `writesReason`, propagados para cada cartão e para a barra de contexto. Nenhuma mutação sai enquanto o estado durar.
- **O que acontece depois:** Voltando a conexão ou reativando o Premium, os ícones voltam a ficar ativos, o alerta some e as linhas de justificativa desaparecem de todos os cartões. Nada fica pendente: como não há fila offline para simulações, nenhuma escrita represada dispara sozinha depois.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Congelamento de escrita em Simulações — "Premium pausado" e "Modo leitura offline"

## O que desenhar

O estado em que o vendedor **pode ler tudo e não pode escrever nada** dentro de "Minhas simulações" — a gaveta (Sheet) aberta pelo cabeçalho da tela Calcular, e a barra de contexto que aparece na Calcular quando uma simulação está carregada. Ele acontece por duas causas diferentes: (a) a assinatura Premium **lapsou** (`status: "lapsed"` — o vendedor já foi premium, os dados continuam dele) e (b) o aparelho está **offline**. Em ambas, abrir e recalcular continuam funcionando; renomear, duplicar, salvar alterações e excluir ficam bloqueados. É a hora mais delicada da jornada: o produto precisa dizer "isso é seu, está aqui, só não dá para mexer agora" sem virar um muro de avisos nem uma cobrança agressiva.

## Por que este prompt existe

O estado nunca foi desenhado — foi montado por acúmulo, direto no JSX. O protótipo de 2026-07-02 **não podia** tê-lo: a E8 era explicitamente "Upsell (sem checkout)", então existia grátis × premium e não existia assinatura que EXPIROU; a matriz §G tem coluna offline para Login/Calcular/Catálogo/Histórico/Exportar/Conta ("leitura mock ok, salvar off") e **nenhuma linha de simulações**.
Pior: o código **contraria** a única autoridade de desenho que existe. O canvas 018 tem `{{ writeBlocked }}` desabilitando o botão **primário** de cada aba, **sem nenhuma frase de justificativa repetida por item**; e o único alerta desenhado ali tem um CTA que AGE ("Sincronizar agora"). O que foi construído é o oposto: a mesma frase repetida embaixo de **cada** cartão, e nenhum caminho para reativar.

## O que já existe hoje (não invente do zero — corrija)

Gaveta "Minhas simulações" (`features/scenarios/scenarios-list-sheet.tsx`), de cima para baixo:

| Peça | Conteúdo literal hoje | Observação |
|---|---|---|
| Título da gaveta | "Minhas simulações" | |
| Subtítulo | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." | |
| Busca | placeholder "Buscar por nome…" | sem label visível |
| Alerta offline (`stale`) | título "Modo leitura offline" + "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + botão "Tentar novamente" | tom `info`; **tem** ação |
| Alerta lapso | título "Premium pausado" + "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." | tom `info`; **não tem** nenhuma ação → problema |
| Cartão (× N) | nome (1 linha, truncada) · nota (2 linhas, com "…") · "Atualizado há 2 dias" · 3 ícones: lápis / cópia / lixeira | os 3 ficam `disabled` |
| Linha embaixo de **cada** cartão | "Premium pausado — reative para renomear, duplicar, editar ou excluir." **ou** "Esta ação precisa de conexão." | → **o defeito central**: com 12 simulações, a mesma frase 12 vezes, alinhada à direita, em `text-muted`, tamanho xs |
| Rodapé | "Carregar mais" | |

→ O alerta de lapso **só aparece se `items.length > 0` e a lista não estiver `stale`** — ou seja, offline **e** lapsado ao mesmo tempo mostra só o offline, e o vendedor com zero simulações lapsado não recebe explicação nenhuma, só ícones mortos. Ninguém desenhou essa arbitragem.
→ Nenhum dos dois avisos leva a lugar nenhum. O CTA de reativação existe no produto ("Assinar novamente", em `/conta`) e não é oferecido aqui. O Catálogo já usa um alerta irmão — "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos." — igualmente sem botão.

Barra de contexto (`features/scenarios/scenario-context-bar.tsx`), quando uma simulação está carregada na Calcular:

- "Simulação: {nome}" (1 linha truncada) + legenda "Recalculado com os preços de hoje" + badge "Alterações não salvas" quando sujo;
- botões: "Abrir origem" (só quando a referência resolve) · "Renomear" · "Duplicar" · "Salvar alterações" · "Fechar simulação";
- congelado: os três primeiros ficam `disabled` e **a mesma frase de justificativa aparece de novo**, em largura total, abaixo da fileira de botões.

## Conteúdo e dados reais

- Nome da simulação: obrigatório, até **120 caracteres** ("Máximo de 120 caracteres."); nota opcional até **500** ("Máximo de 500 caracteres."). Desenhe com nome longo de verdade (ex.: "Caneca 350 ml — Shopee frete grátis + Mercado Livre clássico vs premium").
- "Atualizado {quando}" é **relativo, nunca data**: "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas".
- Números de exemplo para a Calcular ao fundo da barra de contexto: preço sugerido **R$ 24,24**, custo **R$ 16,16**, um cenário maior **R$ 1.234,56** (teste a máscara de milhar).
- Estados de direito reais: `none` (nunca assinou → aparece o teaser, **não** este estado), `active`, `lapsed`. Offline é ortogonal e vem do navegador.
- Toasts de sucesso só existem em resposta real (201/200/204) — no estado congelado **nenhum** deles pode aparecer.

## Estados obrigatórios

1. **Repouso premium ativo e online** — referência: os três ícones/botões vivos, nenhum aviso.
2. **Premium pausado (lapsado), online** — lista legível, ações mortas, explicação dita **uma vez**: "Premium pausado" + "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."
3. **Offline, premium ativo** — "Modo leitura offline" + "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente".
4. **Lapsado E offline ao mesmo tempo** — hoje o código escolhe lapso e some com o offline. Desenhe explicitamente qual vence, ou como as duas causas convivem em um bloco só.
5. **Lapsado com a lista vazia** (nenhuma simulação salva) — hoje o vendedor vê só o EmptyState "Nenhuma simulação salva ainda" e nenhuma menção ao lapso.
6. **Desabilitado** — o alvo dos ícones lápis/cópia/lixeira congelados: continue com ≥44px de área, contraste legível (desabilitado não é invisível), e cursor/foco que não mintam clicabilidade.
7. **Foco por teclado sobre um controle desabilitado** — mostre como a justificativa chega a quem navega por teclado/leitor de tela sem que ela precise estar impressa N vezes na tela.
8. **Carregando** (spinner central) e **erro frio** (alerta `danger` "Não foi possível carregar suas simulações." + "Tentar novamente") — nunca um muro de erro por cima de dados já em mãos.
9. **Falha de escrita ao tentar mesmo assim** — "Esta ação precisa de conexão." (só quando a causa foi medida) e a mensagem genérica quando não foi.
10. **Barra de contexto congelada** — com "Alterações não salvas" ligado: o vendedor mexeu, não pode salvar. É o pior momento do estado e precisa de desenho próprio.

## Viewports

- **390px (mobile)** — obrigatório: é onde a gaveta ocupa a tela inteira e onde a repetição por cartão dói mais (a frase quebra em 2 linhas × N cartões).
- **1280px (desktop)** — o corte do 018; a gaveta e a barra de contexto existem lá com a barra lateral presente, e o `{{ writeBlocked }}` do canvas 018 já governa os botões primários das outras abas: o desenho precisa ser coerente com ele.
- 1920px opcional, só se a solução mudar de forma com mais largura (ex.: aviso fixo lateral em vez de topo).

## Regras que o desenho não pode quebrar

- **Freemium binário**: `none` vê o teaser; `lapsed` **não é** grátis — os dados são dele, a linguagem é "pausado", nunca "expirado", "bloqueado" ou "perdido". Tom calmo, não punitivo.
- **Falha de rede nunca é vendida como falta de Premium**, e vice-versa. As duas causas têm frases distintas e não podem se confundir visualmente.
- **Degradação dita, não escondida**: não basta desabilitar; o motivo tem de estar legível — mas **uma vez**, num lugar previsível, não colado a cada item.
- Frase honesta **fora de placeholder** e fora de elemento com largura apertada — ela precisa caber inteira.
- Alvos ≥44px, inclusive desabilitados. Contraste medido contra o fundo real do cartão, nos dois temas.
- Nenhum toast de sucesso pode existir neste estado.

## Armadilhas já pagas neste projeto

- **Aviso repetido N vezes** é o defeito que originou este prompt: `text-right text-xs` embaixo de cada cartão, idêntico, até 12×.
- **Overflow horizontal medido**: nome de 120 caracteres + fileira de 3 ícones na mesma linha já empurrou botões para fora da viewport em outra tela (100,5px medidos, botão nascido fora). Desenhe com o nome longo, não com "Caneca".
- **Texto ocluso passa em teste**: `toBeVisible` aprova o que está sobreposto. Se o aviso ficar fixo (sticky), diga o que ele cobre e o que empurra.
- **Placeholder que corta a frase honesta** — já aconteceu: frases de honestidade vivem em elementos de largura total, placeholders só carregam números.
- **Um alerta sem ação vira ruído**: o único alerta desenhado no canvas 018 tem "Sincronizar agora". Este tem zero.

## Entregável

Pranchetas, tema **escuro (padrão)** e **claro (first-class)**, reusando os primitivos existentes — não crie componentes novos:

1. 390px — gaveta "Minhas simulações", 4 cartões, **premium pausado**: `Alert` tom `info` no topo (título "Premium pausado") com a justificativa dita **uma vez** e um caminho de reativação (`Button` secundário; a copy do produto para isso é "Assinar novamente"), `Card padding="sm"` por simulação, os 3 `Button variant="ghost" size="sm"` desabilitados **sem** a linha repetida embaixo.
2. 390px — mesma lista **offline**, com "Modo leitura offline" e "Tentar novamente".
3. 390px — o caso conflitante: **lapsado + offline**.
4. 390px — **lapsado com lista vazia** (`EmptyState` ícone `boxes`).
5. 390px — barra de contexto congelada na Calcular (`Card padding="sm"`), com badge `neutral` "Alterações não salvas" e "Salvar alterações" desabilitado.
6. 1280px — a mesma gaveta com a barra lateral do 018 ao lado, mostrando a coerência com o `{{ writeBlocked }}` das outras abas.
7. Um detalhe ampliado (zoom) do **cartão congelado**: os três ícones desabilitados, com a marcação de como o motivo é comunicado a quem foca por teclado.

Marque nas pranchetas o que é `Alert`, `Card`, `Button`, `Badge`, `EmptyState`, `Field`/`tf-input` e `Icon`, e anote tamanho de alvo nos ícones.

## Perguntas em aberto para o dono

1. **Lapsado + offline ao mesmo tempo**: mostrar as duas causas juntas, ou eleger uma? Qual, e por quê? (Hoje o código escolhe o lapso e silencia o offline — sem decisão registrada.)
2. **O aviso de "Premium pausado" deve levar direto ao checkout/`/conta`?** Ele não leva a lugar nenhum hoje, e o Catálogo tem o mesmo alerta igualmente mudo. Se sim, o botão é "Assinar novamente" (a copy do painel de plano) ou uma frase nova?
3. **Lista vazia + lapsado**: o vendedor sem nenhuma simulação salva deve ver o aviso de lapso, ou o EmptyState puro basta?
4. **O aviso deve grudar no topo** (sticky) enquanto rola uma lista longa, ou pode sair de vista depois de lido?

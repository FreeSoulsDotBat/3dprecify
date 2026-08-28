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

- **Onde vive:** A mesma rota `/calcular` a partir de 1280px, com a barra lateral de navegação de 240px à esquerda. Hoje TODAS as peças da área ignoram o limiar desktop: a folha da lista continua um painel de no máximo 416px encostado na borda direita (o resto da janela fica só com o scrim), a barra de contexto é uma faixa fina de botões atravessando a largura inteira, a folha "Salvar simulação" ocupa a altura toda para dois campos, e o cartão de resumo de kit fica em faixa única. O formulário do Calcular, esse sim, vira duas colunas a partir de 1024px — mas os blocos de simulação ficam todos FORA dessa grade, acima dela.
- **Como o vendedor chega:** É onde o vendedor de fato compara canais: sentado no computador, com a aba Calcular aberta e a barra lateral montada. O gesto de entrada é o mesmo do celular — o botão fantasma "Minhas simulações" no topo, alinhado à direita de uma faixa que agora tem quase mil pixels.
- **Vizinhança imediata:** À esquerda, o menu lateral com as cinco abas. Ao centro, o Calcular em duas colunas (custos à esquerda; markup e marketplace à direita) com o rodapé de preços atravessando as duas. As outras quatro abas do app (Catálogo, Kits, Orçamentos, Conta) já adotam neste mesmo limiar o padrão lista-à-esquerda + ficha-de-560px-à-direita, desenhado pelo dono — Simulações é a única área premium que não participa dele.
- **Dados que chegam (e o que ela devolve):** Exatamente os mesmos dados do mobile: lista do servidor unida ao cache uid-keyed, entitlement, catálogo de tarifas e o cálculo local. Nenhum componente da área consulta o gate de largura (`useIsWide`) — não há um único ramo de render específico para tela larga.
- **O que acontece depois:** O comportamento é idêntico ao do celular: abrir um cartão FECHA o painel e repovoa a calculadora — mesmo havendo espaço de sobra para lista e cálculo conviverem lado a lado; comparar duas simulações exige abrir uma, ler, reabrir o painel e abrir a outra.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga`

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

# Simulações em tela larga (≥1280px)

## O que desenhar
Toda a área de **Simulações** do Precifica3D quando o vendedor está no computador. Simulação é a
estratégia salva de precificação: uma combinação de marketplaces, taxas e markup que, ao ser reaberta,
**recalcula com os preços de hoje** (é o oposto de Orçamentos, que congela o dia). Ela vive inteira
dentro da aba **Calcular**: uma entrada "Minhas simulações" no topo da página, uma folha lateral com a
lista, uma folha de salvar, e — quando uma simulação está aberta — uma barra de contexto acima da
calculadora, mais o resumo somente-leitura de kit quando a base de custo é um kit. Quem usa: o vendedor
que, sentado no computador, quer comparar canais lado a lado antes de anunciar.

## Por que este prompt existe
Nada aqui foi desenhado para tela larga — nem adaptado. A medição da auditoria: zero ocorrências de
`useIsWide`, `matchMedia`, `min-width`, `md:` ou `lg:` em todo o código de Simulações. Em 1920px o
vendedor recebe **exatamente o layout de celular**: cartões de largura total dentro de um painel
estreito, uma barra de contexto como faixa fina atravessando a página, e uma folha de altura inteira
para dois campos. O canvas do dono (`Abas-Desktop.dc.html`) tem quatro pranchetas — Catálogo, Kits,
Orçamentos e Conta — e **nenhuma é Simulações**; a linha 454 é um placeholder explícito ("A tela
Calcular está no outro arquivo"), e é exatamente onde Simulações mora. Autoridade de desenho: NENHUMA.
O que foi inferido por omissão é justamente o que este prompt precisa resolver: que a lista **não** vira
lista+ficha (o padrão que o dono desenhou para as outras três telas), que a barra de contexto **não**
vira cabeçalho, e que a largura da tela não serve para nada.

## O que já existe hoje (não invente do zero — corrija)

**1. A entrada** — botão fantasma alinhado à direita, ícone `boxes` + "Minhas simulações". Visível para
todo mundo, inclusive grátis e deslogado (é a porta honesta). → hoje é um botãozinho perdido à direita de
uma página centrada; em 1920px ele fica sozinho num vazio de mais de mil pixels.

**2. A lista** (folha lateral) — título "Minhas simulações"; subtítulo, **só quando há lista**,
"Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."; campo de busca **sem
rótulo visível**, placeholder "Buscar por nome…"; cartões empilhados; botão "Carregar mais" ao fim.
Cada cartão: nome em uma linha truncada · nota opcional em 2 linhas com reticências · "Atualizado há 2
dias" (nunca uma data) · e três botões-ícone à direita (lápis, cópia, lixeira = Renomear · Duplicar ·
Excluir). → os três ícones de 18px numa linha justificada à direita são alvos apertados e ilegíveis como
ação; → no desktop a folha estreita desperdiça a tela e força rolagem para uma lista que caberia inteira.

**3. A barra de contexto** (quando uma simulação está aberta) — cartão acima da calculadora com
"Simulação: {nome}", a legenda "Recalculado com os preços de hoje", o selo "Alterações não salvas"
quando há edição pendente, "Fechar simulação" à direita, e uma fileira que embrulha com "Abrir origem"
(só quando a referência ainda resolve), "Renomear", "Duplicar", "Salvar alterações". → em tela larga
essa fileira embrulha ou se espalha; ela é um **cabeçalho de trabalho**, não um cartão qualquer.

**4. Salvar** — botão secundário "Salvar simulação" com ícone `save`, **premium-only e simplesmente
ausente** para quem não tem Premium ativo (nunca desabilitado, nunca isca). Abre folha com título
"Salvar simulação", intro "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo.
Ao reabrir, ela recalcula com os preços de hoje.", campos "Nome" (obrigatório) e "Nota (opcional)", o eco
somente-leitura "Base de custo: avulsa" e o botão "Salvar simulação". → uma folha de altura inteira para
dois campos é desperdício em 1920px.

**5. Resumo de kit** (base de custo = kit) — cartão "Kit: {nome}" com a dica "Preços por canal do kit,
recalculados com os preços de hoje." e, por marketplace, "Varejo: R$ 24,24" / "Atacado: R$ 21,01".
→ é uma **tabela** disfarçada de lista vertical; no desktop deve virar comparação lado a lado.

## Conteúdo e dados reais
- **Nome**: obrigatório, máximo 120 caracteres. Vazio ⇒ "Dê um nome à simulação."; longo ⇒ "Máximo de
  120 caracteres."
- **Nota**: opcional, máximo 500 caracteres ⇒ "Máximo de 500 caracteres." Pode vir sem espaço nenhum.
- **Atualizado {quando}**: "agora mesmo", "há 7 min", "há 3 h", "há 2 dias", "há 5 semanas". Nunca data.
- **Base de custo**: "avulsa", "referência do catálogo" ou "kit do catálogo".
- **Dinheiro**: sempre `R$ 24,24`, e precisa caber `R$ 1.234,56` e `R$ 12.345,67` sem estourar coluna.
- **Marketplaces**: "Mercado Livre", "Shopee", "Amazon", "Outro". Canal inválido no kit:
  "Corrija os campos deste canal para ver os preços." (com a contagem entre parênteses); rollup inteiro
  inválido: "Confira os campos destacados para ver o preço."
- **Aviso de campo aposentado** (persistente, nunca toast): "O documento salvo continha Desperdício (g).
  O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."

## Estados obrigatórios
- **Carregando a lista**: apenas um spinner centrado, sem esqueleto falso de dados.
- **Erro frio** (nada em cache): alerta de perigo "Não foi possível carregar suas simulações." + botão
  "Tentar novamente". Nunca uma parede de erro por cima de dados que já estão na mão.
- **Vazio**: ícone `boxes`, "Nenhuma simulação salva ainda", "Monte uma comparação de canais na
  calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a
  calculadora". (→ "toque" é copy de celular; no desktop ela mente. Anote como problema, mas **não
  reescreva**: a frase é homologada — veja Perguntas em aberto.)
- **Busca sem resultado**: "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca".
- **Offline (leitura)**: alerta informativo "Modo leitura offline" / "Suas simulações continuam aqui e
  podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente";
  ações de escrita desabilitadas com a razão "Esta ação precisa de conexão."
- **Premium pausado (lapsed)**: alerta "Premium pausado" / "Suas simulações continuam aqui e podem ser
  abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."; razão nas
  ações: "Premium pausado — reative para renomear, duplicar, editar ou excluir."
- **Sem Premium / deslogado**: **um** teaser no lugar da lista — "Salve suas simulações" / "Salve uma
  combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os
  preços de hoje." / "A calculadora continua grátis." Sem subtítulo de lista junto (seriam duas promessas
  coladas — defeito já corrigido uma vez).
- **Degradado** (a referência de catálogo sumiu): legenda informativa que diz que os valores manuais
  foram mantidos — **jamais** "removido/excluído/deletado".
- **Alterações não salvas**: selo neutro na barra de contexto; "Salvar alterações" só habilita com
  alteração real; fechar pede confirmação "Descartar as alterações não salvas desta simulação?" com
  "Voltar" e "Descartar" (nunca "Cancelar").
- **Excluir**: diálogo central "Excluir a simulação “{nome}”?" / "Esta ação não pode ser desfeita." com
  "Voltar" e "Excluir".
- **Repouso, foco visível, hover, pressionado, desabilitado** em cada botão, ícone e cartão — inclusive
  o cartão inteiro, que hoje é clicável (abrir).

## Viewports
- **1280px** — o corte real do produto (`useIsWide`, decisão do dono): acima dele a composição desktop
  monta; abaixo dela nada muda. Desenhe o caso apertado, com a barra lateral de 240px já descontada.
- **1920px** — a tela do vendedor no dia a dia, e onde o problema dói hoje (o resto da tela vazio). As
  outras pranchetas do dono usam `max-width: 1720px` no conteúdo; siga o mesmo teto.
- **390px** — desenhe **como referência do que existe hoje**, sem redesenhar: o mobile é intocado por
  propriedade (o código do celular é o mesmo, não um equivalente). Serve para provar que a peça larga é
  uma composição nova e não um estiramento.

## Regras que o desenho não pode quebrar
- **Freemium binário**: ou a lista, ou **um** teaser. Nunca lista quebrada, nunca dois teasers, nunca
  botão de salvar cinza para quem não tem Premium — ele é **ausente**.
- **Procedência do número**: a promessa é "Recalculado com os preços de hoje". Nenhuma data em lugar
  nenhum da área — data é linguagem de Orçamentos.
- **Falha de rede nunca vendida como falta de Premium**: offline diz "precisa de conexão"; pausado diz
  "reative o Premium". São dois textos e dois estados diferentes.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega só exemplo; explicação vive em
  elemento de largura inteira (o projeto já pagou por uma frase cortada em sufixo de placeholder).
- **Alvo ≥44px** para cada uma das três ações do cartão, inclusive quando viram ícones.
- **Contraste medido contra o fundo real** do painel/ficha, não contra o fundo da página.
- **Degradação dita, não escondida**; e o aviso de campo aposentado permanece na tela enquanto a
  simulação estiver aberta.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido nos DOIS eixos** — em headless a barra de rolagem clássica não aparece;
  já houve rolagem no eixo vertical passando batida. Nenhuma coluna pode empurrar a página.
- **Nome de 120 caracteres e nota de 500 sem um único espaço**: têm de truncar com reticências visíveis,
  nunca empurrar "Duplicar"/"Salvar alterações" para fora.
- **Valor grande estourando a coluna**: teste o layout de preços com `R$ 12.345,67` (um PDF já quebrou
  assim, invisível para testes de texto).
- **Texto ocluso passa em teste**: nenhuma asserção acusa um elemento sob outro — desenhe as
  sobreposições explicitamente, inclusive **folha dentro de folha** (renomear abre uma segunda camada
  sobre a lista: a de baixo continua legível e o foco fica claro).
- **Máscara de milhar perdida ao reabrir programaticamente** — mostre o campo reaberto já com máscara.

## Entregável
Pranchetas em **1280px** e **1920px**, no **tema escuro (padrão)** e no **tema claro** (first-class):
1. **Simulações — lista** na largura cheia, com a busca, a lista e (se a resposta do dono for essa) a
   ficha à direita, no mesmo idioma das outras telas do dono: `minmax(0,1fr) 560px`, ficha `sticky`.
2. **Simulação aberta** — a barra de contexto como cabeçalho de trabalho acima da calculadora, com nome,
   promessa, selo de alterações e as quatro ações em uma linha só.
3. **Salvar simulação** na largura larga (dois campos + eco da base de custo).
4. **Resumo de kit** como comparação por marketplace lado a lado.
5. **Estados**: vazio · busca sem resultado · erro frio · offline · Premium pausado · teaser · degradado.

Reuse os primitivos existentes, sem criar novos: `Card` para cartão e barra de contexto, `Alert` (tons
`info`/`danger`) para offline/pausado/degradado/erro, `EmptyState` para vazio e busca vazia, `Field` +
`tf-input`/`tf-inputwrap` para busca, nome e nota, `Button` (`ghost`/`secondary`/`danger`) com `Icon`
(`boxes`, `pencil`, `copy`, `trash-2`, `save`), `Badge` neutro para "Alterações não salvas", `Sheet` para
salvar/renomear, `Dialog` central para excluir, `Spinner` para carregando, `PremiumTeaser` para a porta
honesta, e o `PageHeader` da aba Calcular como âncora superior.

## Perguntas em aberto para o dono
1. **Simulações vira mestre-detalhe como as outras três telas?** Se sim, **o que a ficha da direita
   mostra** — hoje não existe nenhuma prévia de simulação: abrir uma simulação *é* preencher a
   calculadora. Uma ficha exigiria decidir um conteúdo que o produto ainda não tem (prévia de preços por
   canal? só metadados? um botão "Abrir na calculadora"?).
2. **A área continua dentro de Calcular, ou Simulações ganha lugar próprio no menu no desktop?** Hoje é
   uma folha sobre a calculadora, e "Calcular Desktop" está fora deste incremento — isto muda onde a
   peça pode morar.
3. **A copy de celular ("toque em “Salvar simulação”", "Voltar para a calculadora") ganha versão de
   desktop?** Ela é homologada; trocá-la é decisão sua, não do desenho.
4. **A barra de contexto deve ficar fixa no topo** enquanto o vendedor rola a calculadora longa, ou rola
   junto com o conteúdo?

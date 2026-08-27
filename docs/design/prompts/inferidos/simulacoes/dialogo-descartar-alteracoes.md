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

- **Onde vive:** Diálogo CENTRAL (`Dialog variant="center"`, largura `min(92vw, 32rem)`, cantos arredondados, sombra, sobre scrim) aberto a partir da barra de contexto no topo do `/calcular`. Conteúdo mínimo, em coluna: o título-pergunta "Descartar as alterações não salvas desta simulação?" e, logo abaixo, uma linha `flex justify-end gap-2` com "Voltar" (ghost) e "Descartar" (vermelho). NÃO há corpo/descrição.
- **Como o vendedor chega:** Aparece quando o vendedor toca em "Fechar simulação" na barra de contexto E o selo "Alterações não salvas" está aceso — ou seja, exatamente quando há trabalho a perder. Sem alterações, o fechar acontece direto e este diálogo nunca aparece.
- **Vizinhança imediata:** Por baixo do scrim: a barra de contexto no topo da página, com o nome da simulação e o botão "Salvar alterações" ainda habilitado a poucos pixels dali; abaixo dela, o formulário com as edições ainda visíveis. O X de fechar do primitivo fica no topo direito do próprio diálogo. Contraste interno: o diálogo de EXCLUIR simulação, na folha da lista, tem corpo explicativo ("Esta ação não pode ser desfeita.") — este não tem.
- **Dados que chegam (e o que ela devolve):** Recebe apenas o booleano de alterações pendentes. Não recebe nem exibe QUAIS campos mudaram, nem quantos, nem o antes/depois. Não oferece terceira saída ("Salvar e fechar").
- **O que acontece depois:** "Voltar" fecha o diálogo e mantém tudo como estava, com as alterações intactas. "Descartar" fecha o diálogo E a simulação: a barra de contexto some, a calculadora volta ao modo avulso e os campos permanecem na tela com os valores editados, agora sem vínculo com nenhuma simulação salva.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Diálogo de descarte ao fechar uma simulação com alterações não salvas

## O que desenhar
A caixa modal que aparece quando o vendedor toca em **"Fechar simulação"** na barra de contexto da calculadora (aba **Calcular**) **e existem alterações pendentes** — ou seja, ele mexeu em canais, taxas, custos ou base desde que reabriu a simulação salva e ainda não gravou. Se não há alteração pendente, o diálogo não aparece: fecha direto. É a única barreira do produto inteiro entre o trabalho do vendedor e o desaparecimento dele, e dura dois toques: [Voltar] volta para a calculadora com tudo intacto; [Descartar] fecha a simulação e joga fora as edições. Não há rede envolvida, não há espera: a decisão é local e instantânea.

## Por que este prompt existe
Nunca houve desenho de nenhuma confirmação destrutiva neste projeto. O protótipo de 2026-07-02 cobre banner offline, erro global e 404 (E9 Transversais), e a rodada 1 acrescentou a tela genérica de erro 500 — nenhuma confirmação; a matriz §G não tem essa linha; o `.design-import/` exporta só `PriceHero.jsx` e `IconButton.jsx`. O canvas 018 desenha botões "Excluir" em duas fichas mas **nenhum artboard do diálogo que eles abrem**. A única autoridade é textual (ux §4.1 define a frase e o par [Voltar][Descartar]; §10.2/G3 manda "compor com Dialog + Button danger sem inventar primitiva" — instrução de composição, não desenho). O que a IA inferiu sozinha: a **ausência de corpo** (não há `DialogDescription`, então a caixa não diz o que se perde), a ausência de uma terceira saída, o alinhamento à direita, a ordem dos botões e o tamanho. E há uma incoerência interna que ninguém decidiu: **o diálogo de EXCLUIR, no mesmo épico, TEM corpo** ("Esta ação não pode ser desfeita.") — duas confirmações destrutivas com anatomias diferentes, e a mais explicativa é a do risco menor.

## O que já existe hoje (não invente do zero — corrija)
Um `Dialog variant="center"` com scrim sobre a tela inteira, cartão centralizado de `min(92vw, 32rem)`, padding de 24px, raio `xl`, borda sutil e sombra grande. Dentro, uma coluna com `gap` de 12px e **dois** elementos:

| Ordem | Elemento | Conteúdo literal | Observação |
| --- | --- | --- | --- |
| 1 | `DialogTitle` | `"Descartar as alterações não salvas desta simulação?"` | → o estilo de título do DS é **caixa alta + fonte de título + `letter-spacing` largo, 18px**: a pergunta renderiza como `DESCARTAR AS ALTERAÇÕES NÃO SALVAS DESTA SIMULAÇÃO?` — 51 caracteres gritados, que a 390px ocupam 3 linhas. Uma pergunta em versalete não se lê como pergunta. |
| 2 | Linha de botões | `[Voltar]` fantasma · `[Descartar]` perigo, justificados **à direita**, `gap` de 8px | → tamanho padrão (o resto da barra de contexto usa `sm`); nenhum estado de carregamento existe nem faz sentido aqui |
| — | **Corpo** | **não existe** | → o buraco central deste prompt: a caixa não diz **o que** se perde nem **o que sobrevive** |
| — | `X` de fechar | `aria-label` "Fechar", canto superior direito, alvo ≥44×44px, ativo por padrão no primitivo | → uma **terceira** afordância que ninguém desenhou e que faz exatamente o mesmo que [Voltar]; o título já reserva 40px de recuo à direita por causa dela |

Comportamento herdado do primitivo: `Esc` e clique no scrim fecham o diálogo = mesmo efeito de [Voltar] (nunca descartam), foco preso dentro da caixa, foco devolvido ao botão "Fechar simulação" ao sair.

Para comparação direta, o **diálogo de excluir** da folha "Minhas simulações": título `"Excluir a simulação “{nome}”?"` + corpo `"Esta ação não pode ser desfeita."` + `[Voltar]` `[Excluir]` — mesmíssima geometria, mesma cor de botão, e é o único dos dois que explica.

## Conteúdo e dados reais
- **Gatilho**: botão fantasma `"Fechar simulação"` na barra de contexto; o diálogo só existe quando o selo `"Alterações não salvas"` está aceso naquela barra.
- **Rótulos fixos**: `"Voltar"` — nunca "Cancelar" (FR-014, regra escrita do produto) — e `"Descartar"`.
- **O que realmente se perde** (verificado no código, e é isto que precisa virar corpo): apenas as edições feitas desde que a simulação foi aberta. **A simulação salva continua existindo, com o conteúdo da última gravação.** Nada é excluído, nada é irreversível no sentido do outro diálogo. Não escreva o texto final por conta própria — a frase exata é pergunta para o dono; desenhe o bloco com um texto de trabalho e marque-o como provisório.
- **Nome da simulação**: 1 a 120 caracteres. Hoje o diálogo **não** o cita; o de excluir cita. Use nas pranchetas `"Vaso hexagonal — Shopee"` e `"Suporte de headset com pé reforçado — comparação Shopee x Mercado Livre x loja própria (agosto)"` se decidir mostrar o nome — o segundo prova que a linha aguenta 96 caracteres.
- **Nenhuma data, em lugar nenhum**: a promessa da simulação é "Recalculado com os preços de hoje"; a caixa não pode dizer "salvo em 12/08".
- Nenhum valor em dinheiro aparece aqui. Não invente um resumo de preço no corpo.

## Estados obrigatórios
1. **Repouso** — a caixa aberta sobre a calculadora escurecida pelo scrim; a simulação por trás continua visível o suficiente para o vendedor lembrar o que estava fazendo.
2. **Foco em [Voltar]** e **foco em [Descartar]** — anel de foco medido contra a superfície do cartão, não contra o fundo da página. Diga qual dos dois recebe o foco inicial: é a decisão de segurança mais barata desta peça.
3. **Hover e pressionado** nos dois botões e no `X`.
4. **Escritas travadas — o estado que hoje é invisível e importa mais que todos**: quando o vendedor está **offline** (`"Esta ação precisa de conexão."`) ou com **Premium pausado** (`"Premium pausado — reative para renomear, duplicar, editar ou excluir."`), o botão "Salvar alterações" da barra está **desabilitado**. Nessa situação o descarte é a única saída possível e o trabalho vai embora sem recurso — e a caixa atual não diz uma palavra sobre isso. Desenhe a variante que reconhece a trava, com o motivo em texto de corpo (nunca em `placeholder`, nunca só cor).
5. **Sem alterações pendentes** — desenhe o "não-estado" só para deixar registrado: a caixa **não abre**, o fechamento é imediato e silencioso.
6. **Título longo em 390px** — a pergunta em três linhas com o recuo do `X` respeitado, para provar que o cabeçalho não colide com o botão de fechar.

Sem estados de carregamento, vazio, erro ou degradado: esta peça não fala com a rede.

## Viewports
- **390px (mobile)** — obrigatória e é a mais crítica: o cartão vira 92vw ≈ 358px, sobram ~310px de conteúdo, e é onde a pergunta em caixa alta explode em três linhas e a dupla de botões justificada à direita fica espremida. Mostre a alternativa de botões em largura total empilhados, se ela ler melhor, e diga qual você recomenda.
- **1280px (desktop)** — o cartão fixa em 512px centrado; o problema muda de figura: uma caixa de 512px com duas linhas de texto e dois botões no canto tem um vazio no meio que precisa de ritmo.
- 1920px não precisa de prancheta própria (o cartão não cresce); se o scrim mudar de leitura numa tela larga, diga isso em uma linha.

## Regras que o desenho não pode quebrar
- **A ação destrutiva nunca é a mais fácil de acertar sem querer.** [Descartar] é o único elemento em tom de perigo da caixa; [Voltar] é a saída barata e não pode parecer desabilitado por ser fantasma.
- **Nada de "Cancelar"**: o rótulo homologado é "Voltar".
- **Honestidade de escopo**: o corpo não pode sugerir que a simulação salva será apagada — não será. E, se a variante travada existir, não pode vender falha de rede como limitação de Premium nem o contrário.
- **Distinguir os dois destrutivos**: descartar edições e excluir a simulação não podem ser a mesma caixa vermelha. A diferença de gravidade tem de estar no desenho, não só no verbo.
- Alvo de toque ≥44px nos dois botões e no `X`; contraste medido contra `--surface-card` **por cima do scrim**, não contra o fundo da página.
- Frase honesta sempre em elemento de largura plena — nunca em sufixo de campo ou `placeholder` (lição já paga em 016).

## Armadilhas já pagas neste projeto
- **Texto que estoura sem quebrar teste**: `toBeVisible`/`toContainText` passam num título ocluído. A pergunta em caixa alta com `letter-spacing` largo é exatamente o tipo de string que transborda a 390px sem nenhuma asserção reclamar — desenhe medindo caixas.
- **Recuo reservado ao `X`**: o título já carrega 40px de `padding-right`; um desenho que ignore isso produz colisão só na implementação.
- **Botão nascido fora da viewport** (custou 100,5px de overflow no épico de billing): a fileira justificada à direita dentro de um cartão de 92vw é a mesma geometria que falhou lá.
- **Selo/afirmação que ninguém vê** (o toast que nunca renderizou, também no billing): se o desenho prometer um retorno visual após [Descartar], ele tem de sobreviver ao desmonte da tela — prefira não prometer.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não uma amostra)**:
1. Repouso a 390px — versão atual (só pergunta + botões) e **versão corrigida com corpo**, lado a lado, para o dono comparar.
2. Repouso a 1280px, versão corrigida.
3. Variante **escritas travadas** (offline e Premium pausado), 390px.
4. Estados de interação: foco inicial, hover e pressionado em [Voltar] e [Descartar].
5. Uma prancheta de **coerência**: este diálogo ao lado do de excluir simulação, mostrando qual anatomia comum os dois passam a ter e onde a gravidade os separa.

Reaproveite os primitivos existentes, sem criar nenhum: `tf-dialog` centrado (scrim `tf-dialog__overlay`, `tf-dialog__x` para o fechar), `tf-dialog__title` para a pergunta, `tf-dialog__desc` para o corpo novo, `tf-btn--ghost` em "Voltar", `tf-btn--danger` em "Descartar" e, se a variante travada precisar de destaque, o `tf-alert` de tom informativo — nunca um bloco novo.

## Perguntas em aberto para o dono
1. **Qual é a frase do corpo?** A verdade técnica é "só as edições desta sessão se perdem; a simulação salva continua como estava" — mas a redação final é copy de produto e precisa ser sua, não minha.
2. **Existe uma terceira saída "Salvar e fechar"?** A copy `"Salvar como novo"` está escrita no dicionário e **nunca foi renderizada em lugar nenhum** — funcionalidade planejada e esquecida, ou copy morta? E, se existir, o que ela faz quando o vendedor está offline ou com Premium pausado, casos em que salvar é impossível?
3. **O diálogo deve nomear a simulação** (`"Descartar as alterações de “{nome}”?"`), como o de excluir faz, ou o nome é ruído aqui?
4. **O `X` de fechar fica?** Hoje ele existe e duplica o [Voltar]; a alternativa é uma caixa sem escape visual, só [Voltar]/[Descartar] + `Esc`.
5. **As duas confirmações destrutivas convergem para uma anatomia única** (título + corpo + [Voltar][ação]) ou a exclusão ganha um degrau a mais de atrito, por destruir o objeto?

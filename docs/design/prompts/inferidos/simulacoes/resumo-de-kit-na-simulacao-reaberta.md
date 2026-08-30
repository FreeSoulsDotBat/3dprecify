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

- **Onde vive:** Rota `/calcular`, faixa de largura total ACIMA do formulário: um `Card padding="sm"` inserido logo depois da barra de contexto (e depois dos avisos de campo aposentado, quando existem) e ANTES de qualquer bloco da calculadora. Conteúdo em coluna: "Kit: {nome}" em 14px semibold → legenda 12px "Preços por canal do kit, recalculados com os preços de hoje." → um alerta azul quando houve linhas excluídas → e a lista por marketplace: nome do canal em 14px medium e, abaixo, "Varejo: R$ x" e "Atacado: R$ y" em 12px cinza. Sem destaque de preço, sem hierarquia de valor.
- **Como o vendedor chega:** Só aparece quando o vendedor reabre, pela folha "Minhas simulações", uma simulação cuja base de custo é um KIT do catálogo. Como um kit é multi-peça, não há formulário escalar para hidratar — este cartão é a única representação da simulação na tela.
- **Vizinhança imediata:** Acima: a barra de contexto "Simulação: {nome}" e, entre elas, até dois alertas azuis empilhados (o de campo aposentado do documento e o equivalente rolado das linhas do kit). Abaixo: o botão "Salvar no histórico" do kit, e logo em seguida o formulário da calculadora — cujos campos continuam com os valores que estavam ali ANTES da reabertura, sem nenhuma relação com os números exibidos neste cartão, e sem nada na tela dizendo isso.
- **Dados que chegam (e o que ela devolve):** Recebe o documento `config` da simulação e o contexto de catálogo; um cálculo local aplica o ÚNICO conjunto de canais da simulação uniformemente a todas as linhas do kit e devolve o rollup por marketplace, além da contagem de linhas que não puderam ser precificadas. Nada aqui é editável.
- **O que acontece depois:** Nada é editável neste cartão: para mexer nas linhas do kit, o vendedor usa "Abrir origem" na barra de contexto, que navega para `/kits?id=…`. O botão logo abaixo congela EXATAMENTE estes números como orçamento. Fechar a simulação faz o cartão sumir e devolve a calculadora ao modo avulso — com os campos antigos, agora sem contradição visível.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Simulação de kit reaberta dentro de Calcular

## O que desenhar

O bloco somente-leitura que aparece no TOPO da aba **Calcular** quando o vendedor reabre uma simulação salva
cuja base de custo é um **kit** (várias peças). Uma simulação de kit não tem como preencher o formulário de
peça única que existe logo abaixo — então, em vez de hidratar campos, o produto mostra aqui o recálculo do
kit inteiro com os preços de hoje, por marketplace. Quem usa: vendedor Premium que salvou uma comparação de
canais em cima de um kit e voltou dias depois para ver quanto ele custa/rende agora. A peça vive entre a barra
de contexto "Simulação: {nome}" (com "Abrir origem", "Duplicar", "Fechar simulação") e o formulário da
calculadora. Origem no código: `features/calculator/kit-basis-summary.tsx`, montado por
`pages/calcular/calcular-page.tsx`.

## Por que este prompt existe

O dono DESENHOU um rollup de kit — no canvas 018, no aside da aba **Kits** — e é exatamente esse vocabulário
que falta aqui: card "Total do kit" com uma linha `tf-brow` de custo, `tf-price tf-price--accent tf-price--md`
para Varejo (2.25rem, inteiro/decimais separados), `tf-price` menor (1.5rem) para Atacado, um card "Preços por
canal (kit)" com linhas `tf-brow` (marketplace + `tf-brow__sub` + valor à direita) e o aviso de peças
excluídas como `tf-field__hint` DISCRETO. O canvas 018 exclui **Calcular** por escrito, e o bloco construído
não usa nada disso: tudo em 12px `text-muted`, sem hierarquia de preço, com um `Alert tone="info"` reciclando
uma frase de erro de outra tela. E o coração do achado nunca foi desenhado por ninguém: **um resumo
somente-leitura flutuando sobre um formulário órfão** — os campos da calculadora abaixo continuam com os
valores de antes da reabertura, sem relação com os preços exibidos em cima, e nada na tela diz isso.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual de cima para baixo, dentro de um único `Card padding="sm"`:

| # | Elemento | Texto literal hoje | Tipografia hoje |
|---|---|---|---|
| 1 | Título | `"Kit: {nome}"` (ex.: "Kit: Kit suporte + base") | 14px semibold, `--text-strong` |
| 2 | Legenda | `"Preços por canal do kit, recalculados com os preços de hoje."` | 12px `--text-muted` |
| 3 | Aviso de peças fora do total (só se houver) | `"Corrija os campos deste canal para ver os preços. (2)"` | `Alert tone="info"` |
| 4 | Bloco por marketplace | "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "—" | 14px medium |
| 5 | Preço varejo do canal | `"Varejo: R$ 24,24"` | 12px `--text-muted` |
| 6 | Preço atacado do canal | `"Atacado: R$ 16,16"` | 12px `--text-muted` |
| 7 | Fallback sem nenhuma linha válida | `"Confira os campos destacados para ver o preço."` | `Alert tone="info"` |

→ **Problema 1 (o principal):** nada aqui diz que os campos abaixo NÃO são esta simulação. O comentário no
código admite: os campos "ficam como estavam antes da reabertura".
→ **Problema 2:** o item 3 concatena a frase de erro de OUTRA tela (a linha de canal da calculadora) com um
número entre parênteses. O produto já tem a frase certa, usada na aba Kits:
`"{n} peça(s) fora do total — confira os avisos nas peças acima."`
→ **Problema 3:** o preço do kit — o número que o vendedor veio ver — está em 12px cinza, do mesmo tamanho da
legenda. Na aba Kits o mesmo dado é `PriceHero`/`tf-price--accent`.
→ **Problema 4:** o item 7 é um `Alert tone="info"` de tom errado (não é informação, é ausência de preço) e
usa a frase da calculadora de peça única. Existe frase honesta pronta: `"Sem preço ainda"` +
`"O preço do kit aparece assim que ao menos uma peça estiver completa e válida."`
→ **Problema 5:** custo total, líquido recebido e contagem de peças por canal existem no dado e não aparecem.

## Conteúdo e dados reais

Dados disponíveis no recálculo (todos já calculados, nada é somado na tela):

- **Custo total do kit** — dinheiro, ex.: `R$ 38,90`. Rótulo já existente: `"Custo total"`.
- **Preço varejo / atacado do kit** — dinheiro, ex.: `R$ 24,24` e `R$ 16,16`; um kit grande chega a
  `R$ 1.234,56` (cinco dígitos + centavos é caso NORMAL, não extremo).
- **Por marketplace** (lista, 1 a 4 hoje: Mercado Livre, Shopee, Amazon, Outro; quando o canal não tem
  marketplace o rótulo é `"Canal"`): preço de anúncio varejo, recebido líquido varejo, preço de anúncio
  atacado, recebido líquido atacado, `"{n} peça(s) somaram neste canal"` e, quando houver,
  `"{n} peça(s) sem preço neste canal — não entrou na soma."`; canal sem nenhuma contribuição:
  `"Nenhuma peça com preço neste canal."`
- **Peças excluídas** — inteiro ≥ 0; excluída = a peça não pôde ser calculada, nunca zerada em silêncio.
- **Campo aposentado** (documento salvo antes da versão 4.0.0 do modelo) — frase persistente, já homologada:
  `"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo
  abaixo não o inclui."`
- **Nome da base** — o nome do kit no catálogo; pode ter até 120 caracteres, e precisa truncar em uma linha.
- Abaixo do bloco existe ainda o botão de congelar no histórico (`"Salvar no histórico"`), que congela ESTE
  rollup, não os campos da calculadora — o desenho precisa deixar visualmente claro a que ele pertence.

## Estados obrigatórios

1. **Repouso, kit inteiro válido** — título, custo total, par varejo/atacado com hierarquia de preço, e a
   lista por canal. Legenda de procedência: `"Preços por canal do kit, recalculados com os preços de hoje."`
   (nunca uma data).
2. **Parcial** — uma ou mais peças fora do total: caption discreta `"{n} peça(s) fora do total — confira os
   avisos nas peças acima."` O total continua visível e continua verdadeiro para as peças que entraram.
3. **Nenhuma peça válida** — sem preço nenhum: `"Sem preço ainda"` + `"O preço do kit aparece assim que ao
   menos uma peça estiver completa e válida."` Nunca três zeros.
4. **Canal sem contribuição** — `"Nenhuma peça com preço neste canal."` no lugar dos quatro valores.
5. **Documento antigo (degradado)** — a frase do campo aposentado, persistente enquanto a simulação estiver
   aberta (não é toast, não pisca).
6. **Formulário órfão** — o estado que hoje não existe e é o motivo deste prompt: como a peça declara que os
   campos abaixo não pertencem a esta simulação (ver Perguntas em aberto).
7. **Offline** — o recálculo é local e continua funcionando: `"Você está offline. O cálculo continua
   funcionando."` Escrever (renomear/duplicar/salvar) é que fica indisponível:
   `"Esta ação precisa de conexão."`
8. **Premium pausado** — a simulação ABRE e RECALCULA; só a escrita congela:
   `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`
9. **Foco / hover / pressionado / desabilitado** nos alvos que existem ao redor do bloco: "Abrir origem",
   "Fechar simulação", "Salvar no histórico". Anel de foco visível sobre o fundo real do card.
10. **Nome muito longo** — 120 caracteres truncados em uma linha, sem empurrar nada para fora.

## Viewports

- **Mobile 390px** — é onde o vendedor mais reabre simulação; desenhe primeiro. Verifique também a régua de
  **360px**, que é a largura onde este projeto já mediu aperto de dinheiro.
- **Desktop 1280px** — a partir dessa largura o app tem a barra lateral recolhível do 018; mostre o bloco com
  a coluna larga (o rollup por canal pode virar colunas; o par de preço não pode se perder num card de 900px).
A peça existe nos dois; não há versão exclusiva de um deles.

## Regras que o desenho não pode quebrar

- **Procedência do número**: o preço é recálculo com o catálogo de hoje, e a frase que diz isso fica em
  elemento de largura inteira — nunca dentro de placeholder, nunca truncada.
- **Nunca um zero falso**: sem linha válida não existe "R$ 0,00"; existe ausência declarada.
- **Degradação dita, não escondida**: peça excluída e campo aposentado aparecem, com tom calmo — o discreto do
  canvas 018 (`tf-field__hint`), não um alarme.
- **Falha de rede nunca vendida como falta de Premium** e vice-versa: offline e Premium pausado têm frases
  próprias e ambos mantêm o recálculo funcionando.
- **Somente leitura de verdade**: nenhum campo editável nesta peça; editar as peças do kit acontece em
  "Abrir origem".
- **Alvo ≥ 44px** em qualquer coisa tocável; contraste medido contra o fundo real do card (o 12px `text-muted`
  de hoje sobre card escuro é justamente o que precisa ser revisto).

## Armadilhas já pagas neste projeto

- **Dinheiro de 5 dígitos em duas colunas a 360px**: a barra de total do kit já foi consertada por isso — duas
  colunas deixavam ~89px por valor e "R$ 1.234,56" não cabe em 89px em nenhuma tipografia. Uma coluna por
  linha devolveu ~216px ao número.
- **Rótulo longo trava o número**: "Preço atacado" (111px) não cabe onde "Atacado" cabe; use rótulos curtos no
  readout.
- **Frase honesta cortada**: honestidade mora em elemento de largura inteira; placeholder carrega só número.
- **Texto ocluso passa em teste**: sobreposição não é propriedade de texto — desenhe as caixas, não confie em
  "o texto está lá".
- **Sticky dentro de sticky**: se o resumo virar coluna fixa no desktop, quem fixa é a coluna, não o card.
- **Copy reciclada de outra tela** gerou este prompt; toda frase aqui fala de kit e de peça.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. Mobile 390px — kit inteiro válido (estado 1), com o formulário da calculadora visível abaixo para mostrar a
   relação entre as duas partes.
2. Mobile 390px — parcial (estado 2) + documento degradado (estado 5) na mesma prancheta.
3. Mobile 390px — sem preço ainda (estado 3) e canal sem contribuição (estado 4).
4. Mobile 360px — variação de estresse com `R$ 1.234,56` e nome de kit de 120 caracteres.
5. Desktop 1280px — kit válido, com a barra de contexto da simulação acima e o botão de histórico abaixo.
6. Estados de offline e Premium pausado (podem dividir uma prancheta).

Reutilize os primitivos existentes: `tf-card` para o contêiner; `tf-price tf-price--accent tf-price--md` para
Varejo e `tf-price tf-price--md` para Atacado (o par que o canvas 018 já definiu); `tf-brow` (com
`tf-brow__label`, `tf-brow__sub`, `tf-brow__val`) para custo total e para cada linha de canal;
`tf-field__hint` para a caption de peças excluídas e para a de procedência; `tf-badge` só se houver um selo de
estado; `tf-alert` **apenas** para o aviso de campo aposentado. Não crie primitivo novo — se algo não couber
nos existentes, marque na prancheta e explique por quê.

## Perguntas em aberto para o dono

1. **O que acontece com o formulário da calculadora enquanto uma simulação de kit está aberta?** Esconder,
   desabilitar com uma frase, ou manter editável com aviso de que não pertence a esta simulação? É a decisão
   de produto que este prompt não pode tomar sozinho, e ela muda o desenho inteiro.
2. **Se o formulário continuar editável, o que "Salvar alterações" salva** — a simulação de kit (que não mudou)
   ou os campos de peça única (que não são dela)? Hoje os dois convivem na mesma tela.
3. **O resumo deve listar as peças do kit** (nome + quantidade, com as excluídas marcadas), ou só o total e o
   rollup por canal? O dado das peças existe; a aba Kits mostra a lista, esta superfície não.
4. **O título deve ser "Kit: {nome}" ou "Total do kit"** (o rótulo já desenhado no canvas 018)? São
   vocabulários diferentes para a mesma coisa em duas abas.

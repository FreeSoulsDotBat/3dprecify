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

- **Onde vive:** Rota `/calcular`, imediatamente abaixo da entrada "Minhas simulações" e ACIMA de todo o resto da página: um `Card padding="sm"` de largura total, NO FLUXO (rola junto com a página, não é fixo). Duas linhas + uma faixa de botões: linha 1 = "Simulação: {nome}" truncado em uma linha, à esquerda, com "Fechar simulação" (ghost) encostado à direita; linha 2 = "Recalculado com os preços de hoje" em 12px cinza, seguido de " · " e do selo "Alterações não salvas" quando o vendedor mexeu em algo; depois, alertas condicionais; e por fim um `flex flex-wrap gap-2` com até quatro botões nesta ordem: "Abrir origem" (ghost) · "Renomear" (ghost) · "Duplicar" (secondary) · "Salvar alterações" (primário, habilitado só quando há alteração).
- **Como o vendedor chega:** Nasce no instante em que o vendedor abre um cartão na folha "Minhas simulações" (ou duplica uma simulação): a folha fecha e a barra aparece no topo da página, sem transição, com o formulário abaixo já repovoado. É o ÚNICO sinal de que a calculadora está exibindo uma estratégia salva.
- **Vizinhança imediata:** Acima: a entrada "Minhas simulações" e, acima dela, a frase freemium e o título "Calcular". Abaixo, na ordem: o aviso de campo aposentado (quando a simulação é antiga), o resumo de kit (quando a base é um kit), o cartão de teaser/erro do seletor de catálogo, e então o formulário ("Custos da peça") — os campos que ela governa e que, numa tela de celular rolada para baixo, já não a acompanham.
- **Dados que chegam (e o que ela devolve):** Recebe `{id, name, note}` da simulação aberta, a base de custo já resolvida pelo servidor (tipo, referência e se está degradada), o sinal `dirty` (assinatura do formulário comparada com a de quando abriu/salvou), o entitlement (`lapsed`) e o estado online. Devolve `PUT` (salvar alterações), `PATCH` (renome), `POST /duplicate` e navegação para a origem.
- **O que acontece depois:** "Salvar alterações" grava a configuração inteira, dispara "Simulação atualizada." e apaga o selo de alterações não salvas. "Fechar simulação" some com a barra e devolve a calculadora ao modo avulso — mas se houver alterações não salvas, abre antes o diálogo de descarte. "Abrir origem" navega para `/catalogo?produto=…` ou `/kits?id=…`. "Duplicar" troca a simulação carregada pela cópia, no lugar.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Barra de contexto da simulação carregada ("Simulação: {nome}")

## O que desenhar
A faixa que aparece no topo da calculadora (aba **Calcular**) quando o vendedor abre uma simulação salva — o único sinal na tela inteira de que os campos abaixo não são um cálculo avulso, e sim uma estratégia salva sendo reeditada. Ela vive entre o cabeçalho da página ("Calcular" + a frase de freemium + o botão fantasma "Minhas simulações") e os campos de custo que ela governa. Quem a usa: o vendedor premium que reabriu uma simulação pela folha "Minhas simulações" e agora mexe em preços, canais e taxas — e precisa saber, a qualquer momento, **qual** simulação está aberta, **se** o que ele mexeu já foi salvo, e como salvar, duplicar, renomear, abrir a origem ou fechar. É a peça que carrega toda a gestão do objeto aberto.

## Por que este prompt existe
Nunca houve desenho desta peça. O protótipo de 2026-07-02 **não tem o conceito de simulação**: a tela `CalculatorScreen.jsx` é `TopBar` → dois `PriceHero` (varejo/atacado) → alerta de peso → card de entradas, e nada acima dos inputs. O canvas 018 exclui Calcular por escrito. A barra foi inferida de texto de spec por uma IA, e o resultado **contraria a spec em dois pontos verificados**: (1) a spec pede a barra "pinned at the top" e o que existe é um `Card` no fluxo, que rola para fora da tela junto com o resto; (2) a spec previa um menu "⋯" e a implementação achatou tudo em **cinco affordances soltas** na mesma faixa, com pesos visuais diferentes e ordem nunca decidida. Além disso, a linha "Base de custo: {…}" que o wireframe da spec traz **não existe** na barra construída — o `costBasis` só serve, hoje, para decidir o alerta de degradação e para habilitar "Abrir origem". A `ux §10.1` classifica esta barra como o item #1 "Highest" a prototipar; nunca foi.

## O que já existe hoje (não invente do zero — corrija)
Um `Card` de padding pequeno, coluna, `gap` de 8px, em quatro blocos empilhados:

| Bloco | Conteúdo atual | Observação |
| --- | --- | --- |
| Linha 1 (esq.) | `"Simulação: {nome}"` em 14px semibold, **uma linha só**, truncada com reticências | O truncamento é deliberado (defeito já pago: um nome de 120 caracteres empurrava "Duplicar"/"Salvar alterações" para fora da tela) |
| Linha 1 (dir.) | Botão fantasma **"Fechar simulação"** | → é a ação de saída, mas está no lugar de maior destaque da faixa, colada no nome |
| Linha 2 | `"Recalculado com os preços de hoje"` em 12px muted; quando há edição pendente, acrescenta `" · "` + `Badge` neutra **"Alterações não salvas"** | → o badge é injetado **dentro do parágrafo**, separado por um ponto médio: um selo de estado disfarçado de continuação de frase |
| Alertas condicionais | `Alert` info com `"Os valores atuais foram mantidos e continuam editáveis."` (base degradada) e/ou `Alert` perigo com o erro da última ação | |
| Linha de ações | `flex flex-wrap gap-2`, nesta ordem: **"Abrir origem"** (fantasma, condicional) · **"Renomear"** (fantasma) · **"Duplicar"** (secundário) · **"Salvar alterações"** (primário); e, quando as escritas estão travadas, uma linha de 12px muted ocupando a largura toda com o motivo | → quatro pesos diferentes numa fileira que **quebra em duas linhas a 390px**; a ordem coloca a ação primária na ponta direita, onde o wrap a joga sozinha para a segunda linha |

Vizinhos imediatos, fora do card (não redesenhar, mas prever no layout): logo abaixo pode aparecer um `Alert` info persistente `"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."`, e, quando a base é um **kit**, o bloco somente-leitura `"Kit: {nome}"` + `"Preços por canal do kit, recalculados com os preços de hoje."`.

## Conteúdo e dados reais
- **Nome da simulação** — obrigatório, texto livre, 1 a 120 caracteres. Exemplos verdadeiros para as pranchetas: `"Vaso hexagonal — Shopee"` (curto), `"Suporte de headset com pé reforçado — comparação Shopee x Mercado Livre x loja própria (agosto)"` (longo, para provar o truncamento).
- **Nota** — opcional, até 500 caracteres. Existe no objeto salvo e **não é mostrada** na barra hoje.
- **Base de custo** — três tipos, com os rótulos em pt-BR que já existem na folha de salvar: `"avulsa"`, `"referência do catálogo"`, `"kit do catálogo"`; a frase-molde é `"Base de custo: {nome}"`. Só é exibida ao salvar; a barra a esconde.
- **Derivado, nunca digitado**: o subtítulo `"Recalculado com os preços de hoje"` — regra dura: **nenhuma data em lugar nenhum** desta barra. Não existe "salvo em 12/08"; a promessa é o recálculo vivo.
- **Estado de edição pendente** — booleano derivado de comparar o formulário com a assinatura da última gravação. Governa o badge e o botão "Salvar alterações".
- **Renomear** abre uma folha com título `"Renomear simulação"`, campo `"Nome"` (obrigatório) e botão `"Salvar alterações"`; o campo aceita digitar até 121 caracteres para que o 121º dispare a recusa.
- Toasts de sucesso (só em resposta real do servidor): `"Simulação atualizada."`, `"Simulação duplicada."`, `"Simulação renomeada."`.
- Copy órfã encontrada no dicionário e **nunca renderizada**: `"Salvar como novo"` — ver Perguntas em aberto.

## Estados obrigatórios
1. **Repouso, sem alterações** — nome + subtítulo vivo; "Salvar alterações" **desabilitado**; sem badge.
2. **Com alterações pendentes** — badge `"Alterações não salvas"` visível; "Salvar alterações" habilitado e é o único elemento primário da faixa.
3. **Salvando** / **Duplicando** — o botão correspondente em carregamento (rótulo permanece legível, largura não pode saltar); os demais permanecem operáveis.
4. **Base degradada** (a referência de produto/kit não resolve mais) — `Alert` info `"Os valores atuais foram mantidos e continuam editáveis."` e o botão **"Abrir origem" some**. Nunca a palavra "removido", "excluído" ou "deletado".
5. **Base avulsa** — sem "Abrir origem": desenhe a fileira com três botões, não com um buraco.
6. **Erro de ação** — `Alert` perigo dentro do card, com a mensagem do servidor ou `"Algo deu errado. Tente novamente."`.
7. **Offline** — "Renomear", "Duplicar" e "Salvar alterações" desabilitados + a linha `"Esta ação precisa de conexão."`. "Abrir origem" e "Fechar simulação" continuam ativos.
8. **Premium pausado** — os mesmos três desabilitados + `"Premium pausado — reative para renomear, duplicar, editar ou excluir."` A simulação **continua aberta e recalculando**: nada aqui pode sugerir que o cálculo parou.
9. **Fechar com alterações pendentes** — diálogo centrado: título `"Descartar as alterações não salvas desta simulação?"`, botão fantasma `"Voltar"` (nunca "Cancelar") e botão de perigo `"Descartar"`.
10. **Foco visível, hover e pressionado** em cada um dos cinco alvos — inclusive nos fantasmas, que hoje são os menos evidentes da faixa.
11. **Nome longo** — truncado em uma linha; o nome completo precisa continuar acessível de alguma forma (proponha).

## Viewports
- **390px (obrigatório)** — é onde o defeito dói: a fileira quebra em duas linhas, e o motivo do travamento ocupa uma terceira. Desenhe a barra com nome longo + badge + quatro ações + linha de motivo, e mostre a altura total resultante.
- **1280px (obrigatório)** — a página da calculadora sai de 460px e vai a 1120px a partir de 1024px. A barra vira uma faixa larga com quatro botões pequenos amontoados à esquerda e "Fechar simulação" isolado na outra ponta, com ~800px de vazio no meio. Resolva essa faixa, não a copie.
- **1920px** — o conteúdo continua limitado a 1120px centralizado; só desenhe se a solução de 1280px mudar de comportamento.

## Regras que o desenho não pode quebrar
- **Nenhuma data.** O subtítulo afirma o recálculo vivo; qualquer carimbo temporal aqui é uma alegação que o produto não pode sustentar.
- **Degradação dita, não escondida.** A base que não resolve mais gera a frase calma e a remoção do link — nunca um link quebrado, nunca "removido".
- **Falha de rede nunca vendida como falta de premium**, e vice-versa: as duas frases travadas são diferentes de propósito e não podem colapsar numa só.
- **Frase honesta fora de placeholder** — o motivo do travamento e o alerta de degradação vivem em elemento próprio de largura total, nunca dentro de um campo ou como sufixo cortável.
- **Premium pausado não pausa o cálculo**: o badge/estado da barra não pode ser degradado visualmente a ponto de sugerir que o preço abaixo é falso.
- **Toque ≥44px** em todos os cinco alvos, inclusive nos fantasmas de 390px depois do wrap.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — o card é uma superfície elevada.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não estimado**: já houve 100,5px de estouro com botão nascendo fora da viewport nesta base de código. A faixa de ações a 390px é exatamente essa geometria.
- **Nome longo empurrando ações para fora da tela** — o motivo do truncamento de uma linha. Qualquer proposta que devolva o nome a duas linhas precisa dizer o que impede a reincidência.
- **Selo enfiado em parágrafo**: o badge separado por `" · "` sobrevive a qualquer teste de texto e é ilegível como estado. Trate-o como estado.
- **Barra que rola para fora** — o único indicador de "você está editando um objeto salvo" desaparece assim que o vendedor rola até os campos que está editando; ele salva ou não salva às cegas.
- **Ação destrutiva/de saída no ponto de maior peso**: "Fechar simulação" ocupa hoje o canto superior direito, o mesmo lugar que, na ficha de Orçamentos do canvas, é reservado à edição de rótulo — lá a ação destrutiva é deslocada de propósito.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. **390px — repouso limpo** e **390px — com alterações pendentes** (nome longo truncado, badge, fileira completa).
2. **390px — travado**, uma prancheta cobrindo offline e outra premium pausado, com a frase correspondente.
3. **390px — base degradada** (alerta info, sem "Abrir origem") e **390px — erro de ação** (alerta perigo).
4. **1280px — repouso e com alterações pendentes**, resolvendo a faixa larga.
5. **Diálogo de descarte** (390px e 1280px) e **folha "Renomear simulação"** (390px).
6. Uma prancheta de **anatomia**: hierarquia proposta das cinco affordances (quais ficam expostas, quais colapsam), com a justificativa em uma linha ao lado de cada.

Reutilize os primitivos existentes, sem criar novos: `Card` com padding pequeno como casca; `Badge` neutro para "Alterações não salvas"; `Button` nas variantes fantasma/secundário/primário/perigo já existentes, tamanho pequeno; `Alert` tom info para degradação e tom perigo para erro; `Dialog` centrado para o descarte; `Sheet` para renomear, com `Field` + `tf-input`. Se a solução exigir um menu de ações secundárias, use o padrão de menu já presente no DS em vez de inventar um novo controle.

## Perguntas em aberto para o dono
1. **A barra deve ficar fixa no topo enquanto o vendedor rola os campos** (como a spec pediu) ou continuar rolando junto? Fixa custa altura permanente no celular; rolando, o vendedor edita sem ver qual simulação está aberta.
2. **A linha "Base de custo: {nome}" entra na barra?** Ela existe na folha de salvar e sumiu aqui; se entrar, mostra o nome da referência, o tipo (`"avulsa"` / `"referência do catálogo"` / `"kit do catálogo"`), ou os dois?
3. **Quais das cinco ações continuam expostas e quais colapsam num menu?** A decisão muda a peça inteira e ninguém a tomou — a implementação achatou o "⋯" por conta própria.
4. **Ao fechar com alterações pendentes, existe uma terceira saída "Salvar e fechar"?** Hoje só há "Voltar" e "Descartar".
5. **"Salvar como novo" deve existir nesta barra?** A copy está escrita e nunca foi renderizada em lugar nenhum — é funcionalidade planejada e esquecida, ou copy morta a remover?
6. **A nota (até 500 caracteres) aparece na barra?** Ela é salva e nunca mostrada depois; quem escreve uma nota provavelmente espera relê-la ao reabrir.

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

- **Onde vive:** Rota `/catalogo/produtos/$id` (a ficha de um produto SALVO), no bloco `tf-calc-footer` ao final da página. Ordem exata: bloco de resultado (`PriceResults` do produto) → `RecordSnapshotButton` "Salvar no histórico" (sem wrapper de centralização) → `<div className="flex justify-center">` com o botão secundário "Salvar simulação". Aqui o par aparece na ORDEM INVERSA à do Calcular.
- **Como o vendedor chega:** O vendedor entra em Catálogo → Produtos → abre um produto já salvo e rola até o fim da ficha. O botão só aparece quando as três condições valem juntas: produto já existente (tem id), cálculo válido na tela e Premium ativo.
- **Vizinhança imediata:** Acima: os preços do produto e, colado, o "Salvar no histórico". Ao redor, mais acima na página, o formulário do produto com suas seções de custo e a seção de marketplace. Abaixo: o fim da ficha. Nada na tela explica que este segundo botão cria um objeto de outra natureza.
- **Dados que chegam (e o que ela devolve):** Recebe o mesmo `config` do formulário da ficha, MAS com uma referência de produto anexada — a base de custo nasce como `PRODUCT`, não avulsa — e manda para a folha o rótulo "{nome do produto} (referência do catálogo)". Devolve o mesmo `POST /api/v1/scenarios`.
- **O que acontece depois:** Abre a MESMA folha "Salvar simulação" descrita acima. A diferença aparece só depois: ao reabrir essa simulação, ela segue o produto do catálogo — reflete alterações feitas nele e, se o produto for apagado, degrada para os últimos valores conhecidos com um aviso calmo; e a barra de contexto ganha o botão "Abrir origem", que traz o vendedor de volta a esta mesma ficha.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# "Salvar simulação" no rodapé da ficha de produto

## O que desenhar
O par de ações que fecha a ficha de produto do Catálogo (`apps/web/src/pages/catalogo/produto-page.tsx`,
rodapé `tf-calc-footer`, depois do bloco de preços): hoje são dois botões secundários empilhados —
**"Salvar em Orçamentos"** e, logo abaixo, **"Salvar simulação"** — mais a folha (sheet) que o segundo
abre. Quem está ali é um vendedor premium editando um produto JÁ salvo do catálogo: ele veio ajustar
custo/markup de uma peça, viu o preço recalculado, e no fim da página encontra dois botões de salvar de
mesmo peso visual que fazem coisas diferentes (um congela um orçamento com data; o outro guarda uma
estratégia que recalcula com os preços de hoje). Desenhe o rodapé inteiro — a relação entre as duas ações
— e a folha "Salvar simulação" com todos os seus estados.

## Por que este prompt existe
Esta segunda porta de criação de simulação **nunca foi desenhada**. Foi inferida por IA a partir de um
requisito textual (o comentário no código diz que "fecha FR-606a no lado da UI"): a spec de simulações
(`specs/010-e5-saved-scenarios/ux-scenarios.md`) coloca TODAS as entradas dentro da Calcular (§11-F1,
"Option A — inside Calcular") e não menciona a ficha do produto uma única vez. E o dono, no canvas 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`), desenhou a ficha do Catálogo botão a botão —
"Duplicar", "Excluir", "Salvar alterações", "Usar no cálculo" — e **nenhuma dessas ações é criar
simulação**. Ou seja: o código contraria o único desenho existente da ficha. Além disso, o par ambíguo
"salvar isto ou salvar aquilo?" da Calcular foi reproduzido aqui numa segunda tela, num contexto (catálogo)
em que o vendedor não está pensando em canais de marketplace.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual do rodapé, de cima para baixo:

1. Bloco de preços (`PriceResults`) ou, se a entrada for inválida, um alerta de perigo com a nota de
   entrada inválida.
2. Botão secundário com ícone de disquete: **"Salvar em Orçamentos"** — sem nenhum wrapper, portanto
   alinhado à esquerda do container.
3. Botão secundário com ícone de disquete: **"Salvar simulação"** — dentro de um wrapper centralizado.
   → **Problema medido no código**: dois botões irmãos, mesmo variant, mesmo ícone, e alinhamentos
   diferentes (um à esquerda, outro centralizado). É um desalinhamento acidental, não uma hierarquia.
   → **Problema de significado**: nada no rodapé explica a diferença entre "Orçamentos" (congelado, com
   data) e "simulação" (recalcula hoje). A frase que explica isso existe no produto, mas mora em outra
   tela ("Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.").

Quando o botão "Salvar simulação" aparece: **só** com produto já salvo (`editing`) + preço válido
(`result` e `input`) + entitlement do servidor `active`. Sem premium ativo ele **não existe** — não é
cinza, não é teaser (postura SC-109 herdada). Produto novo ainda não salvo: não aparece, e nada diz por quê.

A folha que abre (`features/scenarios/save-scenario-sheet.tsx`), na ordem exata:

| Elemento | Texto literal hoje | Regras |
|---|---|---|
| Título | "Salvar simulação" | idêntico ao rótulo do gatilho |
| Intro | "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje." | 2 linhas em 390px |
| Campo Nome | rótulo "Nome", obrigatório, texto livre | máx. 120 caracteres |
| Campo Nota | rótulo "Nota (opcional)", textarea 3 linhas | máx. 500 caracteres |
| Eco da base | "Base de custo: Vaso G (referência do catálogo)" | somente leitura, tom `--text-muted`, quebra em qualquer caractere |
| Botão de envio | "Salvar simulação" | primário, largura total do formulário |

→ **Problema**: o gatilho e o botão de envio têm exatamente o mesmo texto — depois de clicar em "Salvar
simulação" o vendedor encontra outro "Salvar simulação". O desenho precisa diferenciar (ou registrar como
pergunta ao dono).

## Conteúdo e dados reais
- Nome do produto de exemplo: **"Vaso G"**; o eco fica **"Base de custo: Vaso G (referência do catálogo)"**.
  Os outros dois rótulos possíveis da mesma linha são "avulsa" e "kit do catálogo" — desenhe com o de
  produto, que é o caso desta peça.
- Preços do rodapé, com números reais da seed: **"Preço varejo" R$ 24,24** e **"Preço atacado" R$ 21,01**;
  "Custo total" R$ 16,16. Use um caso adversarial numa das pranchetas: **R$ 1.234,56** e um nome de produto
  longo sem espaços (120 caracteres) no eco da base.
- Nome da simulação: obrigatório, 1–120 caracteres, sem máscara. Nota: opcional, 0–500.
- Nada aqui é editável além de nome e nota — a base de custo é o que estava na tela quando a folha abriu
  (congelada na abertura); ela é **derivada**, nunca um campo.

## Estados obrigatórios
- **Rodapé com premium ativo**: os dois botões visíveis. Desenhe a hierarquia que você propõe.
- **Rodapé sem premium ativo / Premium pausado**: "Salvar simulação" (e "Salvar em Orçamentos") somem por
  completo. Na mesma página já existe, acima, o alerta informativo "Premium pausado" com o corpo que
  explica a leitura preservada — mostre como o rodapé fica sem os botões, sem buraco visual.
- **Produto ainda não salvo**: rodapé sem o botão. Mostre o rodapé nesse estado.
- **Preço inválido**: no lugar do bloco de preços, um alerta de perigo; sem botão de simulação.
- **Gatilho**: repouso, hover, foco visível, pressionado, e desabilitado (existe: o gatilho fica inerte
  quando a calculadora está inválida — nunca um clique morto).
- **Folha aberta, campos vazios (repouso)**: sem erro nenhum — a mensagem só aparece depois de digitar ou
  de tentar salvar (defeito já pago: o submit voltava calado e nada acontecia).
- **Erro de validação**: "Dê um nome à simulação." · "Máximo de 120 caracteres." · "Máximo de 500 caracteres."
- **Salvando**: botão de envio em carregamento, campos preservados, folha não fecha.
- **Erro de rede (offline)**: linha de erro **"Salvar uma simulação precisa de conexão."** dentro da folha,
  em `--danger-text`, com a folha ABERTA e nome/nota intactos. Nunca um toast de sucesso.
- **Erro de conteúdo grande demais**: "Esta simulação ficou grande demais para salvar. Reduza o número de
  peças ou de custos e tente de novo."
- **Erro de estado da calculadora**: "Corrija os campos da calculadora antes de salvar."
- **Sucesso**: folha fecha e aparece o toast de sucesso **"Simulação salva."** — só em resposta real do
  servidor. Desenhe o toast, incluindo onde ele aparece em 390px sem cobrir a barra de navegação.

## Viewports
- **Mobile 390px** — é onde o vendedor realmente usa o catálogo; a folha é bottom sheet, o rodapé é uma
  coluna única e os dois botões ficam empilhados.
- **Desktop 1280px** — a ficha de produto usa a grade de duas colunas e o rodapé atravessa a largura toda,
  centralizado, com cada bloco limitado a 720px. É aí que o desalinhamento dos dois botões fica mais
  gritante (um centralizado no bloco de 720px, o outro colado à esquerda). Desenhe esse rodapé.
- 1920px é opcional: o rodapé não muda depois de 1024px (mesmo teto de 720px).

## Regras que o desenho não pode quebrar
- **Freemium é binário**: sem entitlement ativo do servidor, a ação não existe — nada de botão cinza com
  cadeado, nada de teaser no meio de uma tarefa de catálogo.
- **Falha de rede nunca é vendida como "não é premium"**: a frase offline diz conexão, e a folha continua
  aberta com o que foi digitado.
- **Procedência do número**: o eco "Base de custo: …" declara de onde vem o cálculo; ele é congelado na
  abertura da folha e não pode parecer editável.
- **Frase honesta nunca em placeholder**: erros, aviso de offline e o eco da base vivem em elementos de
  largura total, nunca dentro de um campo.
- **Alvo ≥44px** nos dois botões do rodapé e no botão de envio; **contraste medido** do texto de erro
  contra o fundo real da folha, nos dois temas.
- Toast de sucesso só depois da confirmação real — não desenhe uma confirmação otimista.

## Armadilhas já pagas neste projeto
- **Botão nascido fora do viewport** e **overflow horizontal de 100,5px** já aconteceram num rodapé de
  ações parecido: meça a largura dos dois botões lado a lado em 390px antes de propor uma linha.
- **Toast que nunca renderiza** porque a folha desmonta antes do callback — desenhe o toast como estado
  da tela de fundo, não como elemento dentro da folha.
- **Nome de 120 caracteres sem espaço** estoura o eco da base numa folha de 390px; a quebra tem de ser em
  qualquer caractere.
- **Texto ocluso passa em teste**: o rodapé fica embaixo da barra de navegação inferior no mobile se o
  espaçamento final não for previsto.
- **Valor grande estoura a coluna**: R$ 1.234,56 (e seis dígitos) no bloco de preços logo acima.

## Entregável
Pranchetas, em tema escuro (padrão) **e** claro, ambos como primeira classe:
1. Rodapé da ficha de produto, 390px — premium ativo, dois botões, hierarquia proposta.
2. Rodapé, 390px — produto não salvo / premium pausado (sem botões) e preço inválido.
3. Rodapé, 1280px — travessia de largura total, teto de 720px, alinhamento corrigido.
4. Folha "Salvar simulação", 390px — repouso, com foco no campo Nome.
5. Folha — erro de validação e erro offline (pode ser a mesma prancheta em duas colunas).
6. Folha — enviando, e a tela de fundo com o toast "Simulação salva.".
7. Caso adversarial: nome de produto de 120 caracteres no eco + R$ 1.234,56 no bloco de preços.

Reutilize os primitivos existentes, sem criar novos: botão secundário `tf-*` com ícone para os dois
gatilhos do rodapé, botão primário para o envio, `tf-input`/`tf-inputwrap` para Nome, textarea do mesmo
primitivo para Nota, o campo com rótulo/obrigatório/opcional e slot de erro para os dois campos, o alerta
(tons `info` e `danger`) para "Premium pausado" e entrada inválida, a folha (sheet) com título e descrição,
e o toast de sucesso. O bloco de preços acima já existe — referencie-o, não redesenhe.

## Perguntas em aberto para o dono
1. **Esta ação deve existir na ficha do produto?** O canvas 018 desenhou a ficha do Catálogo com quatro
   ações explícitas e nenhuma delas cria simulação; a spec põe todas as entradas na Calcular. Se a resposta
   for "não", o entregável vira o rodapé sem esse botão (e "Usar no cálculo" leva a Calcular).
2. Se ficar: **qual é a hierarquia entre "Salvar em Orçamentos" e "Salvar simulação"?** Uma delas é a ação
   principal, ou as duas têm o mesmo peso? Hoje as duas são secundárias e estão desalinhadas por acidente.
3. **O rodapé deve explicar a diferença** entre congelar um orçamento e guardar uma simulação, ali mesmo?
   Existe frase homologada para isso em outra tela; reaproveitá-la aqui é decisão de produto.
4. O gatilho e o botão de envio dizem os dois "Salvar simulação". **O envio deve ter outro rótulo?**
5. Com **Premium pausado** o vendedor vê a ficha inteira, o alerta "Premium pausado", e os botões
   simplesmente somem. Isso está certo, ou nessa aba (que ele acessou como premium) o botão deve aparecer
   inerte com a frase "Premium pausado — reative para renomear, duplicar, editar ou excluir."?
6. O rótulo da base **"(referência do catálogo)"** é vocabulário do vendedor ou nosso? Ele aparece depois,
   na lista de simulações, colado ao nome do produto.

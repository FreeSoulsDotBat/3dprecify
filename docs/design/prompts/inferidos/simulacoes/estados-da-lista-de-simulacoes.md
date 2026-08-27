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

- **Onde vive:** Ocupam o corpo da folha "Minhas simulações", abaixo do título/subtítulo. Carregando: substitui TUDO (busca inclusive) por um `Spinner` centralizado com 32px de respiro em cima e embaixo. Erro frio: substitui tudo por um `Alert tone="danger"` de largura total + botão secundário "Tentar novamente" abaixo dele. Cache offline: um `Alert tone="info"` "Modo leitura offline" ENTRE a busca e os cartões, com o "Tentar novamente" embutido dentro do próprio alerta. Paginação: um `Button variant="secondary"` de largura total "Carregar mais" como último elemento, abaixo do último cartão.
- **Como o vendedor chega:** O vendedor não escolhe nenhum deles: chegam pela rede. Abrir a folha pela primeira vez na sessão mostra o spinner; abrir sem rede e sem cache mostra o erro frio; abrir sem rede COM cache mostra a lista completa com o aviso azul; rolar uma lista longa até o fim revela o "Carregar mais".
- **Vizinhança imediata:** Carregando e erro frio ficam sozinhos no painel, sem busca e sem cartões. O aviso de offline empilha com o de "Premium pausado" quando ambos valem (offline primeiro). "Carregar mais" fica colado no último cartão (12px) e não diz quantas faltam nem quando a lista acabou.
- **Dados que chegam (e o que ela devolve):** Vêm do hook de leitura: `isLoading` (primeira leitura sem nada em cache), `isError` (falha COM cache vazio), `stale` (servindo cache porque a leitura falhou), `hasMore`/`isFetchingMore` (cursor keyset, sem limite superior). Devolvem `refetch()` e `loadMore()`.
- **O que acontece depois:** "Tentar novamente" refaz a leitura no lugar — se der certo, o alerta some e os cartões aparecem/atualizam; se falhar de novo, o mesmo alerta permanece. "Carregar mais" acrescenta a próxima página ao FIM da pilha, mantendo a rolagem; o botão desaparece quando não há mais páginas.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Estados da lista "Minhas simulações": carregando · erro frio · cache offline · paginação

## O que desenhar

O **corpo** do painel "Minhas simulações" nos momentos em que ele **não** está mostrando a lista pronta. O
painel é um sheet ancorado à direita (`tf-dialog--sheet-right`, `min(92vw, 26rem)` — no máximo **416px,
inclusive em 1920px**), aberto pelo cabeçalho da aba **Calcular**; dentro dele vivem, em ordem: título, a
linha de descrição, o campo de busca, eventuais avisos, os cartões e o botão de paginação. Quem usa é o
vendedor Premium que salvou estratégias de canal e quer reabrir uma — na feira, no celular, com rede ruim.
Esta peça é o que ele vê **antes** de a lista existir: primeira leitura, falha total, cópia local do
aparelho, e o fim de uma lista longa.

## Por que este prompt existe

Os quatro estados foram montados com primitivas cruas, sem desenho: carregando é um `Spinner` solto com
`py-8` e **nenhuma palavra**; erro frio é um `Alert tone="danger"` com um botão `secondary` embaixo; o
cache offline é um `Alert tone="info"` com um "Tentar novamente" **dentro** do alerta; a paginação é um
botão `secondary` de largura cheia dizendo só "Carregar mais". O verificador adversarial confirmou: os
**padrões** existem no protótipo de 2026-07-02, mas sempre para **outras** listas (esqueleto de linhas em
`CatalogScreen.jsx`; "Tentar novamente" homologado para Catálogo e Histórico; "Carregar mais" desenhado no
canvas de Orçamentos como `tf-btn--ghost tf-btn--sm` centralizado) — e o construído **diverge de todos
eles**. O estado "cache offline / leitura local" desta lista **não está desenhado em lugar nenhum**: a
matriz §G do protótipo tem coluna offline para Login, Calcular, Catálogo, Histórico, Exportar e Conta, e
nenhuma linha para simulações.

→ Correção de fato: **não existe primitivo `Skeleton` no DS de hoje** (`shared/ui` não tem nenhum;
`catalog-panel.tsx` também cai no `Spinner`). Pedir esqueleto é **propor um primitivo novo** — diga isso.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/scenarios/scenarios-list-sheet.tsx`, `entities/scenario/use-scenarios.ts`,
textos em `shared/i18n/messages.pt-br.ts` (`messages.scenarios`).

| Estado (nome real no código) | Quando acontece | O que é mostrado hoje |
| --- | --- | --- |
| `isLoading` | primeira leitura em voo **e nada em cache** | só `<Spinner/>` centralizado, `py-8`. Sem texto, sem esqueleto, e **o campo de busca some da tela** |
| `isError` | o servidor recusou **e não há nada em cache** (falha fria) | `Alert tone="danger"` "Não foi possível carregar suas simulações." + `Button secondary` "Tentar novamente" abaixo. Sem busca, sem título |
| `stale` | uma leitura falhou **mas há cópia local** | `Alert tone="info"` título "Modo leitura offline", corpo "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + `Button secondary size=sm` "Tentar novamente" embutido no alerta |
| `lapsed` | Premium pausado, lista carregada | `Alert tone="info"` "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." |
| `hasMore` | há mais páginas (keyset, sem cap) | `Button variant="secondary"` largura cheia, "Carregar mais"; vira spinner interno enquanto busca a página |
| vazio | nenhuma simulação salva | `EmptyState` ícone `boxes`, "Nenhuma simulação salva ainda", corpo "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." + "Voltar para a calculadora" |
| vazio de busca | busca sem resultado | `EmptyState` ícone `boxes`, "Nenhuma simulação encontrada para “{termo}”." + "Limpar busca" |

Problemas que o desenho precisa resolver (marcados no que li):

→ **O carregando não diz nada** (um spinner mudo não distingue "estou buscando" de "travou") **e engole o
campo de busca**: a busca só existe no caminho final e toda busca filtrada ignora o cache, então a cada
termo digitado o corpo cai para o spinner e o campo **desmonta e volta**. A busca tem de ser moldura
permanente do corpo, nunca conteúdo do estado "pronto".
→ **"Tentar novamente" some ao ser tocado no erro frio** (o clique devolve o corpo ao spinner mudo: o erro
desaparece e nada afirma "estou tentando") e **não dá retorno nenhum dentro do alerta offline** (a lista já
tem dados, nada muda em voo nem numa segunda falha — lê-se como botão morto).
→ **Erro frio e cache offline não têm hierarquia visual**: duas caixas do mesmo formato; a diferença ("não
tenho nada" × "tenho uma cópia local") só existe na cor e no texto. E **"Premium pausado" usa o mesmo
`tone="info"` do offline** — pior, só aparece quando **não** está stale, então offline+pausado some.
→ **Até três blocos empilham acima do primeiro cartão** (busca + aviso offline/pausado + erro de
duplicação): num sheet de 416px, a lista some abaixo da dobra.
→ **A paginação é muda** sobre quantidade e sobre fim: nunca diz quantas faltam e, no fim, o botão só some.
→ **O motivo do bloqueio de escrita se repete em cada cartão** ("Esta ação precisa de conexão." / "Premium
pausado — reative para renomear, duplicar, editar ou excluir."): com 12 cartões, 12 vezes a mesma frase.

## Conteúdo e dados reais

O cartão **não mostra preço** — e isso é regra, não esquecimento: o preço só existe depois do recálculo com
os preços de hoje, então exibi-lo na lista seria uma alegação sem data. O cartão carrega:

- **Nome** — obrigatório, até 120 caracteres, uma linha com reticências. Ex.: `Vaso espiral 15 cm — Shopee × ML`.
- **Nota** — opcional, até 500 caracteres, 2 linhas com reticências explícitas; `overflow-wrap: anywhere`
  para que um token de 500 caracteres **sem espaço** ainda corte com "…". Ex.: `Frete grátis acima de R$ 79; margem apertada`.
- **Tempo relativo** — "Atualizado há 2 dias" (`agora mesmo` · `há 7 min` · `há 3 h` · `há 3 semanas`).
- **Três ações**: ícones `pencil`, `copy`, `trash-2` (18px) alinhados à direita.
- Descrição fixa do painel: "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."
- Busca: placeholder "Buscar por nome…" (também é o `aria-label` — não há rótulo visível).
- Volume plausível: de 1 a algumas dezenas; a paginação é keyset, **sem teto**, e o contrato devolve só o
  cursor da próxima página — **não devolve total**.

## Estados obrigatórios

1. **Carregando frio** (primeira leitura, nada em cache) — esqueleto coerente com o cartão real (nome,
   nota de duas linhas, linha de tempo, três alvos à direita), 3 repetições, **com a busca já visível e
   desabilitada**, e uma frase de espera curta. Nunca um spinner mudo.
2. **Erro frio** — "Não foi possível carregar suas simulações." + "Tentar novamente"; nada de lista nem de
   cartões fantasmas, e a causa é desconhecida (**não diga "sem internet"**). Mais a variante **tentando de
   novo**: botão carregando, mensagem de erro **ainda visível**.
3. **Cache offline (stale)** — "Modo leitura offline" + "Suas simulações continuam aqui e podem ser
   abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente"; a lista
   aparece normalmente abaixo, com as escritas desabilitadas.
4. **Premium pausado** — "Premium pausado" / "Suas simulações continuam aqui e podem ser abertas e
   recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." **Visualmente distinto**
   do aviso offline.
5. **Offline + pausado ao mesmo tempo** — desenhe a composição; hoje o código esconde um dos dois.
6. **Carregando mais** (`isFetchingMore`, a lista intacta, só o rodapé muda) e **fim da lista paginada**.
7. **Vazio** e **vazio de busca** — os dois `EmptyState` já citados, com os textos literais.
8. **Ações desabilitadas** (offline/pausado) — os três ícones desabilitados, motivo dito **uma vez**.
9. **Foco, hover e pressionado** do cartão (ele inteiro é um botão), dos três ícones e do botão de
   paginação — anel visível sobre o cartão, alvo ≥44px mesmo com ícone de 18px.

## Viewports

- **390px (mobile)** — obrigatório: o sheet ocupa 92vw (≈359px) e é onde o vendedor lê a lista com rede ruim; mostre a rolagem (o aviso de offline sai da viewport quando ele desce até "Carregar mais").
- **1280px (desktop)** — obrigatório: o sheet continua com **416px fixos**, ancorado à direita, sobre a
  página Calcular escurecida pelo scrim. **O desktop não ganha largura nenhuma** — a coluna útil é a mesma
  do celular. 1920px é opcional: a peça não muda (se ela deve virar mestre-detalhe, é pergunta ao dono).

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de permissão.** Nenhum destes estados pode escorregar para
  "assine o Premium"; o teaser é outra peça e só existe para conta grátis/deslogada.
- **Degradação dita, nunca escondida**: se o que está na tela veio do aparelho e não do servidor, isso é
  declarado em texto de largura cheia, **nunca dentro de um placeholder** e nunca cortado.
- **O erro frio não inventa causa** ("Não foi possível carregar" é o teto do que se sabe); **o cartão não
  traz data absoluta**, só o tempo relativo.
- **O sucesso só aparece depois do sucesso real**: nenhuma marca de "atualizado" pode vir do clique em
  "Tentar novamente" — só do retorno. **Alvos ≥44×44px** nos três ícones e no botão de paginação, com
  **contraste medido contra a superfície real do sheet** (`--surface-card` sobre o scrim).
- **Escuro é o padrão; claro é first-class** — info × danger precisam se distinguir nos dois temas, e não
  só pela cor (ícone + título carregam a diferença).

## Armadilhas já pagas neste projeto

- **Overflow medido, não estimado** (já custou 100,5px de estouro e um botão fora da viewport): numa coluna
  de 359px, um nome de 120 caracteres e uma nota de 500 sem espaço são o teste real.
- **Texto ocluso passa em teste** — um aviso empilhado que empurra o primeiro cartão para fora da dobra é
  defeito de desenho, não detalhe.
- **A rolagem vertical é invisível em headless**: o sheet tem `overflow: auto` — desenhe já contando que
  ela rola, decidindo se cabeçalho e busca acompanham.
- **Frase honesta em placeholder é frase perdida** (o placeholder só diz "Buscar por nome…"); **reticências
  sem quebra possível não aparecem**; **botão sem resposta ao clique é lido como quebrado**.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro**, nas duas larguras (390px e 1280px):

1. Carregando frio (esqueleto de 3 cartões + busca desabilitada + frase de espera).
2. Erro frio, em repouso e com "Tentar novamente" carregando.
3. Cache offline: aviso + lista + ações desabilitadas + o motivo dito uma vez.
4. Premium pausado, e a variante offline+pausado.
5. Rodapé de paginação: "Carregar mais" em repouso, carregando, e o **fim da lista**; vazio e vazio de busca.
6. Detalhe: cartão com nome de 120 caracteres e nota de 500 sem espaço (para provar o corte) e os três
   ícones com o alvo de 44px desenhado.

Reutilize os primitivos existentes em vez de criar novos: `tf-card` (`padding="sm"`) no cartão,
`tf-alert--danger` no erro frio, `tf-alert--info` em offline e pausado (resolva a colisão de significado
por título/ícone/estrutura, não inventando um tom novo), `tf-btn--secondary` no "Tentar novamente" do erro
frio, `tf-btn--ghost tf-btn--sm` nas ações do cartão, `tf-empty-state` (ícone `boxes`) nos dois vazios,
`tf-input`/`tf-inputwrap` na busca. **A única peça que pode ser nova é o esqueleto** — se propuser um
`tf-skeleton`, entregue-o como primitivo nomeado, com variantes e medidas: hoje ele não existe no DS.

## Perguntas em aberto para o dono

1. No desktop (018), "Minhas simulações" continua sendo um sheet de 416px à direita, ou vira mestre-detalhe
   como Catálogo? A resposta muda todos os estados desta peça.
2. Offline **e** Premium pausado juntos: hoje só o aviso de offline aparece. As duas verdades empilham, ou
   uma tem precedência — e qual?
3. "Carregar mais" deve declarar quantas faltam ("Carregar mais · 12 restantes") e o fim deve ser marcado
   ("Fim da lista · 37 simulações")? Hoje o contrato keyset não devolve total — declarar exige mudá-lo.
4. O motivo do bloqueio de escrita pode ser dito **uma vez** no topo, em vez de repetir em cada cartão?
5. O cartão deve mostrar a base de custo (produto/kit/avulsa) ou os canais, ou nome + nota + tempo é
   deliberadamente todo o conteúdo?

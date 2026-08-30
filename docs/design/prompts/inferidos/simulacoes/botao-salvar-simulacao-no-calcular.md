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

- **Onde vive:** Rota `/calcular`, dentro do bloco `tf-calc-footer` — a faixa final de largura total que atravessa as duas colunas do formulário. Ordem exata do rodapé: bloco de resultado (`PriceResults`: total, "Como chegamos no preço", "Preços por canal") → `<div className="flex justify-center">` com o `Button variant="secondary"` de ícone `save` e rótulo **"Salvar simulação"** → outro `<div className="flex justify-center">` com o `RecordSnapshotButton` **"Salvar no histórico"**. Dois botões centralizados, quase idênticos, empilhados.
- **Como o vendedor chega:** O vendedor preenche a calculadora, rola até o preço e encontra o par logo abaixo do resultado. O botão só EXISTE com Premium ativo; sem isso ele some por completo (nem cinza, nem teaser). Com o cálculo inválido ele fica visível porém desabilitado.
- **Vizinhança imediata:** Acima: o bloco de preços (o último número que o vendedor leu). Imediatamente abaixo, a 12px: "Salvar no histórico", o botão do objeto de regra OPOSTA — um recalcula com os preços de hoje, o outro congela para sempre — sem nenhuma legenda distinguindo os dois. Abaixo dele, o fim da página.
- **Dados que chegam (e o que ela devolve):** Recebe o estado vivo do formulário e o resultado calculado localmente pelo motor `pricing-core` (portanto funciona também offline, embora salvar não); recebe o entitlement do servidor, que decide se ele existe. Devolve a abertura da folha "Salvar simulação", congelando a configuração no ato.
- **O que acontece depois:** Abre a folha lateral de nome/nota por cima da página. Salvo com sucesso, a folha fecha, um toast confirma e a calculadora fica exatamente como estava — a nova simulação só aparecerá quando o vendedor abrir "Minhas simulações".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# A zona de salvar no fim da Calcular: "Salvar simulação" + "Salvar em Orçamentos"

## O que desenhar
O bloco de ações que fecha a aba **Calcular**, logo abaixo do resultado (detalhamento, avisos e os dois
cartões de preço Varejo/Atacado). Hoje esse bloco é um par de botões empilhados e centralizados, quase
idênticos, que salvam **duas coisas de natureza oposta**: uma *simulação* (estratégia que **recalcula com
os preços de hoje** toda vez que é reaberta) e um *orçamento* (documento **congelado** no dia, imutável).
Quem usa é o vendedor que acabou de ver o preço e precisa decidir o que fazer com ele — é o último gesto
da jornada de precificar. Desenhe a zona inteira, não um botão solto: a decisão de desenho é a
**hierarquia e a distinção** entre os dois salvares.

## Por que este prompt existe
Nenhuma autoridade desenhou o **par**. Foi inferido em código: a ordem (simulação em cima, orçamento
embaixo), o peso `secondary` para os dois, o mesmo ícone de disquete nos dois, o empilhamento centralizado
e o estado desabilitado sem nenhuma explicação ao lado. O protótipo de 2026-07-02
(`.design-import/ui_kits/precifica3d/CalculatorScreen.jsx`) cobre **uma** ação neste ponto: um botão
`primary`, full-width, com glow e ícone de salvar — "Salvar cálculo" — em **linha horizontal** com um
`outline` "Compartilhar", e a frase freemium centralizada logo abaixo. A correção item 33 já tirou o glow
daí (o prompt fixa "um glow por zona", e o glow foi para o PriceHero). O segundo salvar (simulação) nem
existia no protótipo. Ou seja: o slot está desenhado com **uma** ação primária; o produto entrega **duas**
secundárias iguais. O canvas desktop 018 não cobre a Calcular.

## O que já existe hoje (não invente do zero — corrija)
Contêiner: coluna vertical, espaçamento uniforme; a partir de 1024px cada bloco fica centralizado e limitado
a 720px de largura. Ordem atual, de cima para baixo:

| # | Elemento | Texto literal hoje | Comportamento real |
|---|---|---|---|
| 1 | Detalhamento + preços por canal | "Detalhamento", "Preços por canal" | cartão único |
| 2 | Aviso (quando atacado > varejo) | alerta tom `info` | opcional |
| 3 | Dois cartões de preço | "Varejo" / "Atacado" + "markup 100%" | ex.: **R$ 24,24** e **R$ 16,16** |
| 4 | Botão A (simulação) | **"Salvar simulação"** | `secondary`, ícone `save` 18px, centralizado |
| 5 | Botão B (orçamento) | **"Salvar em Orçamentos"** | `secondary`, ícone `save` 18px, centralizado |

→ **Problema 1:** 4 e 5 são visualmente indistinguíveis — mesmo peso, mesmo ícone, mesmo alinhamento, um
colado no outro — e significam coisas opostas. Nada na tela diz qual recalcula e qual congela.
→ **Problema 2:** o botão A fica **visível porém desabilitado** enquanto o formulário está inválido, sem
nenhuma frase adjacente explicando por quê (a frase honesta existe — "Corrija os campos da calculadora antes
de salvar." — mas só aparece **dentro** da folha, que um botão desabilitado nunca abre).
→ **Problema 3:** o botão B **desaparece** quando o resultado não existe ou quando a simulação carregada é
de base kit (nesse caso um botão igual reaparece junto do resumo do kit, mais acima). A mesma zona mostra
2, 1 ou 0 botões conforme o contexto, e o desenho precisa aguentar as três contagens.
→ **Problema 4:** a promessa freemium ("Calcular custo e markup é grátis, sem limite. Vender em
marketplaces, salvar e exportar fazem parte do Premium.") vive **no topo** da página, longe daqui — a zona
de salvar não tem legenda nenhuma.

## Conteúdo e dados reais
- Rótulos de botão, verbatim: **"Salvar simulação"** e **"Salvar em Orçamentos"**.
- A diferença entre os dois, já escrita no produto (use como fonte da legenda que faltar):
  simulações — *"Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre."*;
  orçamentos — *"O que você cotou, com a data. Os valores ficam congelados como estavam no dia."*
- Folha de "Salvar simulação": título "Salvar simulação"; intro *"Guardamos a estratégia desta tela —
  canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje."*; campo
  **"Nome"** (obrigatório, máx. 120 caracteres), campo **"Nota (opcional)"** (máx. 500), eco somente-leitura
  **"Base de custo: avulsa"** (ou "referência do catálogo" / "kit do catálogo"), botão de envio "Salvar
  simulação". Sucesso: toast "Simulação salva."
- Folha de "Salvar em Orçamentos": intro *"Vamos guardar os valores exatamente como estão nesta tela, com a
  data de hoje."*; "Rótulo (opcional)" com dica "Cliente, pedido…", "Validade da proposta" em **dias**,
  **"Preço que você está cotando"** com escolha "Varejo"/"Atacado". Sucesso: "Registro salvo em Orçamentos."
- Valores plausíveis para as pranchetas: preço varejo **R$ 24,24**, atacado **R$ 16,16**; casos de estouro
  a testar: **R$ 1.234,56** e **R$ 128.450,00**.

## Estados obrigatórios
- **Repouso** — os dois botões disponíveis, com o resultado válido acima.
- **Hover / foco / pressionado** — foco com anel visível (o produto testa isso); alvo mínimo 44px de altura.
- **Desabilitado (só o "Salvar simulação")** — formulário inválido. Desenhe **onde** mora a explicação:
  hoje a única pista é o alerta que substitui o resultado, "Confira os campos destacados para ver o preço."
- **Carregando** — envio em andamento dentro da folha (botão de envio inerte); nunca um "salvo" otimista.
- **Erro na folha** — frases reais: "Salvar uma simulação precisa de conexão." · "Esta simulação ficou grande
  demais para salvar. Reduza o número de peças ou de custos e tente de novo." · "Dê um nome à simulação."
- **Offline** — assimetria real e obrigatória de mostrar: o **orçamento** tem fila local e fica "Pendente
  neste dispositivo"; a **simulação** não tem fila e simplesmente exige conexão.
- **Sessão expirada** — vocabulário próprio, jamais "sem conexão": "sua sessão expirou" + "Entrar de novo".
- **Sem Premium ativo** — os dois botões **não existem** (não são cinzas, não são isca). A zona fica só com
  o resultado. Desenhe essa versão: é o que a maioria dos visitantes vê.
- **Premium pausado** — mesmo tratamento de ausência aqui; a frase "Premium pausado — reative para renomear,
  duplicar, editar ou excluir." vive nas listas, não nesta zona.
- **Só um botão** — resultado válido com simulação de base kit carregada: sobra apenas "Salvar simulação".

## Viewports
- **Mobile 390px** (obrigatório) — é a tela real do vendedor, e a zona fica no fim de uma página longa.
  Faça também um recorte de estresse em **360px** com "R$ 128.450,00" acima dos botões.
- **Desktop 1280px** — a coluna centraliza e cada bloco fica capado em 720px: dois botões pequenos
  centralizados num vão largo é exatamente onde a solução horizontal do protótipo pode voltar.
- **1920px** opcional, para confirmar que o cap de 720px não deixa a zona órfã no meio da tela.

## Regras que o desenho não pode quebrar
1. **Freemium é binário**: sem Premium ativo a ação não aparece — nem cinza, nem com cadeado, nem "assine
   para salvar" colado no resultado. A porta honesta é a entrada "Minhas simulações", junto do título.
2. **Falha de rede nunca vira "não é premium"** e vice-versa: offline, sessão expirada e Premium pausado são
   três frases diferentes e não podem compartilhar o mesmo desenho de aviso.
3. **A procedência do número é dita**: o que congela precisa parecer congelado; o que recalcula precisa dizer
   que recalcula. A distinção não pode depender só do rótulo do botão.
4. **Frase honesta nunca dentro de placeholder** nem cortada por reticências — ela mora em elemento de
   largura total.
5. **Um glow por zona** — o glow desta zona já foi gasto no cartão de preço acima.
6. Alvo ≥44px, contraste medido contra o fundo real do cartão, zero rolagem horizontal.

## Armadilhas já pagas neste projeto
- Botão nascido fora da viewport e 100px de overflow horizontal em zona de ação: meça a caixa, não confie no
  texto.
- Valor grande estourando a coluna: aqui o preço já quebrou no meio do dígito a 360px antes de a grade ser
  corrigida — qualquer legenda nova abaixo dos botões precisa aguentar seis dígitos acima dela.
- Legenda cortada por vir presa a um campo estreito: se você criar a legenda diferenciadora, dê a ela a
  largura do bloco.
- Botão habilitado que não faz nada visível: o "Salvar simulação" já ficou mudo ao ser clicado — todo estado
  inerte precisa de causa escrita ao lado.

## Entregável
Pranchetas, tema **escuro** (padrão) e **claro** (first-class), reutilizando os primitivos existentes —
`tf-btn` nas variantes já disponíveis para os dois salvares, `tf-card` para a moldura do resultado acima,
`tf-alert` para os avisos, `tf-sheet` para as duas folhas, `tf-field` para Nome/Nota/Rótulo/Validade e
`tf-price` para os cartões Varejo/Atacado. Não crie primitivo novo; se a solução exigir um bloco novo
(por exemplo, uma legenda de duas linhas sob cada ação), descreva-o como composição dos existentes.
Pranchetas pedidas: (1) 390px repouso com os dois botões; (2) 390px sem Premium (zona sem ação nenhuma);
(3) 390px com "Salvar simulação" desabilitado + a explicação onde você decidir colocá-la; (4) 390px estado
offline/pendente contrastando as duas ações; (5) 1280px repouso; (6) folha "Salvar simulação" aberta a 390px
com erro de conexão visível. Marque explicitamente qual das duas ações você elegeu como primária.

## Perguntas em aberto para o dono
1. Qual das duas é a ação **primária** no fim da Calcular — guardar a estratégia (simulação) ou registrar a
   cotação (orçamento)? A hierarquia visual depende disso e ninguém decidiu.
2. Os dois salvares continuam sendo dois botões irmãos, ou viram **uma** ação com escolha (menu/split) —
   como no protótipo, que tinha um único "Salvar cálculo"?
3. Os rótulos ficam como estão? "Salvar simulação" e "Salvar em Orçamentos" não são simétricos (um nomeia o
   objeto, o outro nomeia o destino) — trocar exige sua palavra, a copy já foi homologada.
4. Cada botão ganha uma legenda curta de diferenciação ("recalcula com os preços de hoje" × "congela os
   valores de hoje")? Isso adiciona duas linhas de texto na dobra final da página.
5. A ação "Compartilhar" do protótipo foi descartada de vez ou está apenas pendente? Ela ocupa metade da
   linha horizontal desenhada em 2026-07-02.

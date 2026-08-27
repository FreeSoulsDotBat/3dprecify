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

- **Onde vive:** Rota `/calcular`, terceiro elemento da página, dentro de um `<div className="flex justify-end">` — portanto encostado na margem DIREITA, em linha própria de largura total. É um `Button variant="ghost" size="sm"` com o ícone `boxes` (16px) à esquerda do rótulo "Minhas simulações".
- **Como o vendedor chega:** É o primeiro elemento interativo depois do cabeçalho: o vendedor abre a aba Calcular (a aba inicial do app) e ele já está na primeira dobra. Chega sempre, em qualquer estado de conta — é a porta honesta e byte-idêntica para grátis, deslogado e Premium.
- **Vizinhança imediata:** Acima: o `PageHeader` centralizado "Calcular" e, colada nele, a frase freemium centralizada ("calcular é grátis… salvar é Premium"), que foi promovida para a primeira dobra por decisão do dono. Abaixo: nada visível até o próximo bloco — que pode ser a barra de contexto de uma simulação aberta, um alerta de campo aposentado, o resumo de kit, o cartão de teaser do seletor de catálogo, ou direto o formulário ("Custos da peça").
- **Dados que chegam (e o que ela devolve):** Não recebe dado nenhum: não sabe quantas simulações existem, não consulta entitlement e não distingue quem tem 12 simulações de quem nunca salvou nenhuma. Devolve apenas `setScenariosOpen(true)`.
- **O que acontece depois:** Abre a folha "Minhas simulações" por cima da página (scrim + painel deslizando da direita). Nada mais na tela muda, exceto a supressão do teaser do seletor de catálogo enquanto a folha estiver aberta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# A porta "Minhas simulações" no topo do Calcular

## O que desenhar

A entrada única para todo o recurso de Simulações (a metade "recalcula com os preços de hoje" do
Premium), que hoje vive como um botão fantasma pequeno no topo da tela **Calcular preço** — a tela que
o vendedor abre primeiro e onde ele passa quase todo o tempo. Ela precisa ser desenhada para três
públicos que hoje veem exatamente o mesmo pixel: quem nunca salvou nada (grátis ou deslogado), quem tem
simulações salvas e quer voltar a uma, e quem está com o **Premium pausado** e ainda pode abrir e
recalcular, mas não pode salvar. O escopo deste prompt é a **porta** (o bloco entre o título da página e
o corpo da calculadora), não a folha lateral que ela abre — a folha só entra como destino, para que a
porta prometa o que ela realmente encontra do outro lado.

## Por que este prompt existe

Ninguém desenhou esta porta. O código a inferiu do requisito: um `Button variant="ghost" size="sm"`
com ícone `boxes` emprestado do catálogo, alinhado à direita, sem contador, sem estado, byte-idêntico
para grátis, deslogado, premium ativo e premium pausado. O protótipo de 2026-07-02 (E4 + §F) desenha a
Calcular inteira — recompute ao vivo, seções coláveis, seletor do catálogo, PriceHero, breakdown,
varejo×atacado, a ação Salvar e a folha de upsell — e **nenhuma entrada de lista de simulações**; o
esqueleto `CalculatorScreen.jsx` tem exatamente duas ações na barra superior (tema e Conta) e nada no
corpo que navegue para simulações. O canvas 018 exclui a Calcular por escrito. E a `ux-scenarios.md`
§10.2/G4 chega a pedir com todas as letras "Design the header entry now" — pedido que nunca virou pixel.
Consequência medida em impacto: metade do valor pago fica atrás de um fantasma no canto.

## O que já existe hoje (não invente do zero — corrija)

Ordem atual dos elementos no topo da tela, de cima para baixo:

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título da página (centralizado) | "Calcular preço" | `PageHeader`, centralizado |
| 2 | Legenda freemium (centralizada, `caption`) | "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium." | frase homologada, promovida à primeira dobra por decisão do dono — **não reescrever** |
| 3 | **A porta** (alinhada à direita) | ícone `boxes` + "Minhas simulações" | botão fantasma, `size="sm"`, ~16px de ícone |
| 4 | Barra de contexto (só quando há simulação aberta) | "Simulação: {nome}" + "Recalculado com os preços de hoje" | já desenhada, fora deste escopo |
| 5 | Corpo da calculadora | seções de custo / markup / canais | fora deste escopo |

→ **Problema 1 — hierarquia invertida.** O item 3 é a porta de um recurso inteiro e pesa menos que
qualquer campo do formulário abaixo dele. O olho vai do título centralizado direto para o primeiro
campo e nunca passa pela direita.
→ **Problema 2 — sem estado.** O botão não diz se existem simulações salvas, quantas, nem qual foi a
última. Quem tem 12 simulações vê o mesmo que quem tem zero.
→ **Problema 3 — o ícone é emprestado.** `boxes` é o ícone do catálogo/kits; aqui sugere "peças", não
"estratégias de preço salvas".
→ **Problema 4 — alinhamento à direita num contêiner que cresce.** A partir de 1024px a página se alarga
de 460px para até 1120px; a porta viaja para a borda direita de um bloco largo, ainda mais longe do olho,
enquanto título e frase freemium seguem centralizados: três alinhamentos em três elementos seguidos.
→ **Problema 5 — Premium pausado é invisível na porta.** O aviso "Premium pausado" só aparece **depois**
que a folha abre. Na porta, um assinante congelado e um assinante ativo são idênticos.

## Conteúdo e dados reais

- Rótulo da porta (chave `scenarios.navEntry`): **"Minhas simulações"**. O título da folha que ela abre
  é o mesmo: "Minhas simulações".
- Subtítulo da folha (só para quem tem acesso): "Estratégias salvas. Cada uma recalcula com os preços de
  hoje quando você abre."
- Cada simulação salva tem: **nome** (obrigatório, até 120 caracteres, ex.: "Caneca 3D — ML Clássico"),
  **nota** (opcional, até 500 caracteres) e um relativo de atualização, nunca uma data:
  "Atualizado há 2 dias", "Atualizado agora mesmo", "Atualizado há 3 semanas".
- **Não existe data em lugar nenhum** desta área — é regra do produto (§0.2). Se o desenho quiser dar
  contexto na porta, o vocabulário disponível é o relativo ("há 2 dias"), nunca "salvo em 14/08".
- Quantidade: a lista é paginada com "Carregar mais", então o número total pode não ser conhecido. Um
  contador exato ("3 salvas") só é honesto para números pequenos e já carregados — ver Perguntas.
- Teaser de quem não tem Premium (título/subtítulo/legenda, textos aprovados pelo dono, não parafrasear):
  "Salve suas simulações" / "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar
  quando quiser — sempre com os preços de hoje." / "A calculadora continua grátis."
- Nada de dinheiro nesta peça: o preço (ex.: `R$ 24,24`) vive no PriceHero, bem abaixo.

## Estados obrigatórios

1. **Repouso — sem nenhuma simulação salva (premium ativo).** A porta continua visível e convidativa; do
   outro lado ela encontra o vazio "Nenhuma simulação salva ainda" + "Monte uma comparação de canais na
   calculadora e toque em 'Salvar simulação' para guardá-la e reabrir quando quiser." A porta não pode
   prometer uma lista que está vazia.
2. **Repouso — com simulações salvas.** É aqui que o desenho tem de ganhar peso: alguma evidência de que
   há conteúdo do outro lado (contagem, nome da última, ou densidade visual — o desenho decide a forma,
   o dono decide a regra; ver Perguntas).
3. **Grátis / deslogado.** A porta é **visível para todo mundo** — é a porta honesta, não um segredo. Ela
   abre o teaser acima. O desenho não pode escondê-la, nem marcá-la com cadeado que sugira "erro", nem
   duplicar o CTA de compra na própria porta (só um CTA de compra por tela).
4. **Premium pausado (`lapsed`).** Abrir e recalcular continuam funcionando; salvar, renomear, duplicar e
   excluir, não. Frases existentes: "Premium pausado" / "Suas simulações continuam aqui e podem ser
   abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."
5. **Offline.** A porta continua clicável e a lista continua legível (leitura em cache): "Modo leitura
   offline" / "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir
   precisam de conexão." A porta **não** pode parecer desligada — a calculadora inteira funciona offline.
6. **Carregando.** A lista carrega com um spinner **depois** que a folha abre; a porta em si não tem
   estado de carregamento hoje. Se o desenho quiser mostrar contagem na porta, precisa de um repouso
   sem-número enquanto o número não existe (nunca "0" enquanto carrega).
7. **Erro de carga (frio).** "Não foi possível carregar suas simulações." + "Tentar novamente" — dentro
   da folha; a porta não muda.
8. **Foco / hover / pressionado / desabilitado.** Foco visível obrigatório (é um alvo de navegação por
   teclado). **Desabilitado não existe para esta porta em nenhum estado** — nem offline, nem grátis, nem
   pausado. Se o desenho propuser um desabilitado, ele está errado.

## Viewports

- **390px (obrigatório)** — é a tela onde o vendedor realmente usa o produto e onde a porta some hoje:
  desenhar a primeira dobra inteira (título + frase freemium + porta + começo do primeiro campo) para
  provar que a porta é vista sem rolar.
- **1280px (obrigatório)** — a página se alarga para até 1120px acima de 1024px, e é exatamente aí que o
  alinhamento à direita mais atrapalha. Desenhar como a porta se comporta na largura maior sem virar um
  elemento perdido no canto.
- 1920px é dispensável: acima de 1024px o conteúdo trava em 1120px e nada mais muda.

## Regras que o desenho não pode quebrar

- **Freemium binário e honesto.** A porta é a mesma para todos; o que muda é o que ela encontra. Nunca
  esconder o recurso de quem não pagou, nunca fingir que ele está ligado.
- **Nenhuma data.** Só relativos ("há 2 dias"). Uma data escrita seria uma alegação que o produto não faz.
- **Falha de rede nunca vendida como falta de Premium**, e o contrário também: offline diz "precisa de
  conexão", pausado diz "reative o Premium". São frases diferentes porque são causas diferentes.
- **Frase honesta nunca dentro de placeholder** e nunca dentro de um elemento que corta texto: se a porta
  ganhar uma legenda, ela vive em elemento de largura cheia.
- **Alvo de toque ≥ 44px** — o botão fantasma `size="sm"` de hoje muito provavelmente não chega lá.
- **Um CTA de compra por tela.** Se o teaser de Premium já está visível na tela, a porta não pode carregar
  um segundo "Assinar".
- **Contraste medido contra o fundo real da Calcular**, não contra um fundo de prancheta.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, não olhado.** Já custou 100,5px de estouro com um botão nascido fora da
  viewport. Se a porta virar uma linha com nome + contagem + ícone, desenhe com um nome longo de verdade
  ("Caneca personalizada com logotipo do cliente — Shopee frete grátis") e prove onde o texto corta.
- **Texto ocluso passa em teste.** O desenho deve deixar claro o que trunca e com que marcador — a lista
  já usa reticências explícitas na nota, porque o corte silencioso não avisa nada.
- **Rolagem vertical que o headless não vê.** A primeira dobra precisa caber de verdade a 390px: a frase
  freemium só foi promovida ao topo porque a promessa antiga vivia a 97% da altura da página.
- **Ícone emprestado vira significado errado.** `boxes` já significa catálogo/kits em três telas.

## Entregável

Pranchetas, em **tema escuro (padrão) e claro (first-class)**:

1. **390px — primeira dobra da Calcular** com a porta redesenhada, estado "com simulações salvas".
2. **390px — a mesma dobra**, estado "nenhuma simulação salva ainda" (grátis/deslogado e premium-zero,
   se o desenho os diferenciar).
3. **390px — Premium pausado** e **offline**, lado a lado, mostrando o que muda na porta.
4. **1280px — a dobra na largura de 1120px**, provando o alinhamento, mais o **detalhe do componente**
   em repouso / hover / foco / pressionado, com a medida do alvo anotada.

Reutilizar os primitivos existentes, sem inventar novos: o contêiner da porta como `tf-card` (se ganhar
corpo) ou o próprio `tf-btn` numa variante já existente (se continuar botão); a contagem, se houver, com
o primitivo de selo/badge já usado no projeto; o ícone do conjunto existente, mas **não** `boxes`. A
folha de destino já está composta com `tf-sheet` + `tf-card` + `tf-empty-state` + `tf-alert` — o desenho
da porta não deve pedir mudanças lá.

## Perguntas em aberto para o dono

1. **A porta mostra contagem?** "Minhas simulações (3)" só é honesto enquanto a lista couber numa página;
   com paginação, o total pode não ser conhecido. Alternativas: sem número, número só até um teto
   ("9+"), ou nome da última simulação em vez de contagem.
2. **A porta muda de peso quando o vendedor é grátis?** Hoje é idêntica. Ela deve continuar idêntica (a
   porta honesta) ou ganhar uma legenda que diga que do outro lado há uma oferta?
3. **"Premium pausado" aparece na porta ou só dentro da folha?** Mostrar na porta avisa antes do clique;
   também espalha um aviso de cobrança para dentro da tela de cálculo.
4. **A porta continua no topo, ou passa a viver junto do PriceHero**, ao lado de "Salvar simulação" —
   onde a intenção de salvar/reabrir nasce? O código a colocou no topo por ser "nav-like", nunca por
   decisão de produto homologada.

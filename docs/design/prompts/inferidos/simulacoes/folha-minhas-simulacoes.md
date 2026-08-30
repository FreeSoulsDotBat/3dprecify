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

- **Onde vive:** Folha lateral direita (`Sheet`/`SheetContent`, `side="right"`, largura `min(92vw, 26rem)` ≈ 416px no máximo, do topo ao rodapé da janela, padding `--space-5`, cantos arredondados só à esquerda, scrim escuro por trás) montada por cima da rota `/calcular`. Não é rota: nada muda na URL. Ordem vertical literal dentro dela: título "Minhas simulações" → subtítulo-promessa (só quando há lista) → campo de busca → alertas de estado → pilha de cartões (gap 8px) → botão "Carregar mais".
- **Como o vendedor chega:** O vendedor toca em "Minhas simulações", o botão fantasma alinhado à direita logo abaixo do título da aba Calcular. Chega em qualquer estado: logado ou não, Premium ou grátis, online ou offline, com ou sem simulação aberta na calculadora. A folha é a MESMA para todos — o que muda é o miolo.
- **Vizinhança imediata:** Por baixo do scrim fica a página Calcular inteira, rolada onde estava (título "Calcular", frase freemium centralizada, a própria entrada "Minhas simulações", o formulário e o rodapé de preços) — e o teaser do seletor de catálogo é explicitamente escondido enquanto esta folha está aberta, para não haver dois CTAs de compra simultâneos. Dentro da folha, acima de tudo, o X de fechar do primitivo `Dialog` (alvo ≥44×44px) sobreposto no canto superior direito, sobre o título.
- **Dados que chegam (e o que ela devolve):** Recebe a lista do servidor (`GET /api/v1/scenarios`, keyset por `created_at DESC`, com `q` opcional) unida ao cache local IndexedDB chaveado por uid; recebe o entitlement do servidor (`active`/`lapsed`/`none`), o estado da sessão e o sinal online/offline. Devolve, quando o vendedor abre um cartão, o documento `config` bruto + `{id, name, note}` para a página Calcular.
- **O que acontece depois:** Abrir um cartão CHAMA `onOpenChange(false)`: a folha fecha sem transição e, embaixo dela, a calculadora aparece já repovoada, com a barra de contexto "Simulação: {nome}" recém-nascida no topo. Fechar pelo X ou pelo scrim devolve a página exatamente como estava.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Folha lateral "Minhas simulações" — a lista inteira

## O que desenhar
O painel onde o vendedor guarda e reabre as estratégias de preço dele. Ele vive **por cima da tela Calcular**: é uma folha (sheet) ancorada à direita, que sobe quando o vendedor toca no botão discreto "Minhas simulações" (ícone `boxes`, alinhado à direita, logo abaixo do título da página). Dentro dela ele busca, lê, renomeia, duplica, exclui e — o ato principal — **reabre** uma simulação; ao reabrir, a folha fecha e a calculadora atrás é repovoada com aquela estratégia, recalculada com os preços de hoje. É a única tela do produto onde o trabalho salvo do vendedor aparece como uma lista, e ela nunca passou por um designer.

## Por que este prompt existe
O frame inteiro foi inferido por IA a partir de requisito textual: largura, altura, densidade, a ordem vertical (título → subtítulo → busca → alertas → cards → "Carregar mais"), onde fica o X, e o que acontece com a página atrás. A auditoria confirmou a ausência de protótipo nas quatro autoridades: o prompt do protótipo de 2026-07-02 desenhou E1–E9 (Splash, Login, Shell, Calcular, Catálogo, Histórico, Conta, Upsell, Transversais) e **nenhuma tela de cenários**; os dois prompts de correção colocam "simulador de marketplace" por escrito numa lista de escopo **futuro**; os 6 esqueletos de UI kit não têm `ScenarioScreen`; e o canvas desktop de 018 tem 4 pranchetas (Catálogo, Kits, Orçamentos, Conta) — Calcular não está lá. Ou seja: esta peça existe em produção, é ALTA prioridade, e ninguém nunca a viu desenhada.

## O que já existe hoje (não invente do zero — corrija)
Container: folha à direita, `min(92vw, 26rem)` de largura (**máx. 416px**), altura total da janela, cantos arredondados só à esquerda, sombra grande, overlay escurecendo a Calcular atrás. Botão X de fechar embutido no canto superior direito (alvo ≥44×44px já garantido); o título reserva espaço à direita para não colidir com ele.

Ordem vertical atual, com gap de 12px entre blocos e 8px entre cards:

| Ordem | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da folha | "Minhas simulações" |
| 2 | Subtítulo (**só para quem tem Premium**) | "Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre." |
| 3 | Campo de busca (sem rótulo visível) | placeholder "Buscar por nome…" |
| 4 | Alertas de estado (0 a 2) | ver "Estados obrigatórios" |
| 5 | Pilha de cards | um card por simulação |
| 6 | Botão secundário, só se houver mais páginas | "Carregar mais" |

Card (hoje: `Card` com padding pequeno, tudo empilhado com 4px):
- nome em uma linha, peso médio, **truncado com reticências** — ex.: "Chaveiro 4un — ML + Shopee";
- nota opcional, cor apagada, **cortada em 2 linhas** com reticências explícitas (quebra até dentro de palavra sem espaço) — ex.: "Testar frete grátis a partir de R$ 79 no ML clássico";
- linha pequena e apagada: "Atualizado há 2 dias" (também "agora mesmo", "há 12 min", "há 5 h", "há 3 semanas") — **nunca uma data**, é convenção de produto: a data seria uma alegação sobre o preço, e o preço é sempre recalculado hoje;
- fileira de 3 botões-ícone fantasma alinhados à direita, ícones de 18px: lápis (Renomear) · cópia (Duplicar) · lixeira (Excluir);
- quando as escritas estão bloqueadas, uma quarta linha minúscula e apagada à direita com o motivo.

Toda a área de texto do card é **um único alvo clicável** que abre a simulação.

→ Problemas que o desenho precisa resolver, não repetir:
- **Sem hierarquia entre buscar, ler e reabrir.** Os três pesos visuais hoje são quase iguais: a busca, o nome e a fileira de ícones competem no mesmo card estreito de ~380px úteis.
- **O motivo repetido N vezes.** Offline ou com Premium pausado, o alerta do topo já diz a frase inteira e **cada card repete** "Esta ação precisa de conexão." / "Premium pausado — reative para renomear, duplicar, editar ou excluir." Com 10 cards, a mesma frase aparece 11 vezes.
- **Três ícones fantasma pequenos, colados, com 4px entre eles**, num painel de dedo — risco de alvo abaixo de 44px e de toque errado (o vizinho da lixeira é o duplicar).
- **A folha fecha sem retorno visual nenhum.** Reabrir um card fecha o painel e troca a calculadora inteira embaixo, sem transição, sem confirmação, sem nada dizendo "carreguei a sua simulação".
- **Duplicar dá um salto.** Duplicar cria a cópia, mostra um aviso de sucesso e **abre a cópia imediatamente**, fechando a folha — o vendedor pediu uma cópia e foi levado para outra tela.
- **A lista não mostra número nenhum.** Nenhum preço, nenhum canal, nenhuma contagem: para comparar duas estratégias é obrigatório abrir uma, depois a outra.
- **A busca não tem rótulo visível** (só placeholder e rótulo acessível) — e esta é a peça onde o campo de busca já nasceu com 1×1px, invisível, e passou nos testes.

## Conteúdo e dados reais
- **Nome** (obrigatório, até 120 caracteres) — "Máximo de 120 caracteres." / vazio: "Dê um nome à simulação."
- **Nota** (opcional, até 500 caracteres) — "Máximo de 500 caracteres."
- **Atualizado em** (derivado, relativo, nunca data absoluta).
- A lista é paginada por cursor e **não tem total**: existe "Carregar mais" e nada que diga quantas faltam.
- A lista é a **união** do que veio do servidor com o cache do aparelho; offline, ela continua legível.
- Volume plausível: de 0 a algumas dezenas. Desenhe pelo menos uma prancheta com ~8 cards visíveis e rolagem.
- Textos duros a usar VERBATIM nos rótulos e nos avisos (já homologados): "Abrir", "Renomear", "Duplicar", "Excluir", "Voltar", "Tentar novamente", "Carregar mais", "Limpar busca", "Salvar alterações".
- Diálogos de apoio que abrem a partir daqui (desenhe pelo menos o de excluir): renomear = folha aninhada com título "Renomear simulação", campos "Nome" e "Nota (opcional)", botão "Salvar alterações"; excluir = diálogo central "Excluir a simulação “Chaveiro 4un — ML + Shopee”?" + "Esta ação não pode ser desfeita." + "Voltar" / "Excluir".
- Avisos de sucesso (aparecem só em resposta real do servidor): "Simulação renomeada." · "Simulação duplicada." · "Simulação excluída."

## Estados obrigatórios
1. **Carregando (frio)** — hoje só um spinner centrado com bastante respiro vertical, sem título, sem esqueleto. Desenhe o que deve aparecer.
2. **Repouso com lista** — o caso comum, 1 a 8 cards.
3. **Vazio (nunca salvou nada)** — ícone `boxes`, título "Nenhuma simulação salva ainda", corpo "Monte uma comparação de canais na calculadora e toque em “Salvar simulação” para guardá-la e reabrir quando quiser." e botão "Voltar para a calculadora".
4. **Vazio de busca** — "Nenhuma simulação encontrada para “chaveiro”." + botão "Limpar busca". A busca fica visível e preenchida.
5. **Erro frio** (nada em cache, nada servido) — alerta de perigo "Não foi possível carregar suas simulações." + botão "Tentar novamente". Nunca cobre dados já em mãos.
6. **Offline / leitura degradada** — alerta informativo, título "Modo leitura offline", corpo "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão." + "Tentar novamente"; os 3 ícones de cada card ficam desabilitados, **abrir continua funcionando**.
7. **Premium pausado (lapsed)** — alerta informativo, título "Premium pausado", corpo "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." Mesma regra: leitura viva, escrita travada.
8. **Erro de uma ação** (duplicar falhou) — alerta de perigo acima da lista, com a frase específica; offline vira "Esta ação precisa de conexão.".
9. **Sem permissão / porta honesta** — quem está deslogado **ou** nunca comprou Premium vê o mesmo painel com o mesmo título e, no lugar da lista, o convite: "Salve suas simulações" / "Salve uma combinação de marketplaces, taxas e markup para reabrir e comparar quando quiser — sempre com os preços de hoje." / "A calculadora continua grátis." Nesse estado o subtítulo da lista **não aparece** (senão a mesma promessa é dita duas vezes coladas).
10. **Foco de teclado** em: campo de busca, área clicável do card, cada botão-ícone, "Carregar mais", X de fechar.
11. **Hover e pressionado** do card inteiro (é um botão) e dos botões-ícone.
12. **Desabilitado** dos 3 botões-ícone — precisa ser lido como "bloqueado por um motivo dito", não como "quebrado".
13. **Carregando parcial** — "Carregar mais" em estado de carregamento com a lista já visível acima.

## Viewports
- **390px (obrigatório)** — é a tela real do vendedor. A folha ocupa 92vw ≈ 359px; com o respiro interno sobram ~320px de conteúdo, e é aí que nome truncado, nota de 2 linhas e 3 ícones disputam espaço.
- **1280px** — a folha vira uma faixa de 416px sobre uma calculadora larga. Mostre a relação com o que fica atrás (overlay, o que ainda se lê, onde cai o X).
- **1920px** — mesma folha de 416px num monitor grande: 78% da tela é overlay inerte. Desenhe o que faz sentido aí (a resposta pode ser "outra proporção" — veja as perguntas ao dono). Calcular **não** foi redesenhada no canvas desktop de 018, então esta é a primeira vez que alguém decide como esta lista se comporta no desktop.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** ou a lista real, ou o convite Premium — nunca uma lista vazia fingindo que o recurso está ligado.
- **Nenhuma data em lugar nenhum.** Só tempo relativo. Uma data seria uma alegação sobre um preço que é sempre recalculado hoje.
- **Falha de rede nunca vendida como falta de Premium**, e vice-versa: cada alerta diz a causa medida.
- **Degradação dita, não escondida:** offline e Premium pausado continuam permitindo LER e ABRIR; o que trava é escrever, e o motivo aparece.
- **Frase honesta nunca dentro de placeholder** (placeholder some ao digitar e é cortado por largura) — se houver algo a afirmar, é texto de verdade em elemento de largura cheia.
- **Alvos ≥44×44px** para os 3 botões-ícone, para o X e para a área clicável do card.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — a nota apagada sobre superfície de card é o par crítico.
- **Confirmação sempre para excluir**; sucesso só quando o servidor confirmou.

## Armadilhas já pagas neste projeto
- **Campo de busca invisível**: nesta mesma peça, o controle inteiro já foi ao ar com 1×1px porque o rótulo foi escondido junto — passou em todo teste de texto. Deixe explícito no desenho o tamanho e o contorno do campo.
- **Texto cortado sem sinal de corte**: a nota já cortava em 2 linhas sem reticência quando era uma palavra única gigante. Desenhe com uma nota adversarial (uma palavra de 60 caracteres) e com um nome de 120 caracteres.
- **Estouro horizontal medido**: já houve 100,5px de estouro e um botão nascido fora da viewport nesta base. A 390px, nada pode empurrar a folha para o lado.
- **Rolagem no eixo vertical que o headless não vê** — o painel tem altura total e rola; deixe claro onde começa e termina a área rolável e se título/busca ficam fixos.
- **Contagem que mente**: já houve um "8 encontrados" com 31 resultados. Se o desenho introduzir contador, ele precisa ser da lista carregada, e a paginação torna isso ambíguo.
- **Aviso de sucesso que nunca renderizou** porque o painel desmontou antes: se o desenho depender de um toast após fechar a folha, diga onde ele aparece e sobre o quê.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não uma sobra)**:
1. 390px — repouso com 8 cards e rolagem; 2. 390px — vazio (nunca salvou); 3. 390px — vazio de busca; 4. 390px — offline com escritas travadas; 5. 390px — Premium pausado; 6. 390px — erro frio; 7. 390px — carregando; 8. 390px — porta honesta (convite Premium); 9. 390px — diálogo de excluir sobre a folha; 10. 1280px — repouso, com a Calcular visível atrás; 11. 1920px — repouso; 12. um recorte ampliado do card em repouso/hover/pressionado/desabilitado, com o alvo de 44px marcado.

Reutilize os primitivos `tf-*` existentes, sem criar novos: a folha é `Sheet`/`SheetContent` ancorado à direita com `SheetTitle` e `SheetDescription`; cada item é um `Card` de padding pequeno; a busca é o par `Field` + `tf-input` dentro de `tf-inputwrap`; os avisos de estado são `Alert` (tom `info` para offline/pausado, `danger` para falha); vazio e vazio-de-busca são `EmptyState` com ícone `boxes`; as ações do card são `Button variant="ghost" size="sm"` com `Icon` (`pencil`, `copy`, `trash-2`); "Carregar mais" e "Tentar novamente" são `Button variant="secondary"`; excluir usa `Dialog` central com `Button variant="danger"`; o carregamento é `Spinner`. Se algum estado exigir um primitivo que não existe, **diga isso explicitamente** em vez de desenhar um componente novo por conta própria.

## Perguntas em aberto para o dono
1. **Desktop:** a folha continua com 416px sobre a Calcular a 1280/1920px, ou no desktop as simulações viram um painel lateral fixo/mais largo (na linguagem das 4 abas de 018)? Calcular nunca foi redesenhada no desktop, e isso muda a peça inteira.
2. **O card mostra algum número?** Hoje não mostra nenhum — nem preço, nem canal, nem nº de peças. Comparar duas estratégias exige abrir as duas. Se for para mostrar, qual número é honesto num card que só recalcula ao abrir?
3. **Duplicar deve abrir a cópia na hora** (fechando a folha, como hoje) ou permanecer na lista com a cópia já criada e visível?
4. **Reabrir merece retorno visual?** Hoje a folha some e a calculadora troca em silêncio. Quer um aviso ("Simulação carregada"), uma transição, ou o silêncio é proposital?
5. **O motivo do bloqueio** (offline / Premium pausado) deve ficar só no alerta do topo, ou repetido em cada card como hoje?
6. **Contagem/ordenação:** a lista é sempre por atualização mais recente e sem total. Vale expor a contagem carregada e/ou uma ordenação alternativa?

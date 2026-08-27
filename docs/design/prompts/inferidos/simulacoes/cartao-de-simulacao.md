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

- **Onde vive:** Dentro da folha "Minhas simulações", na pilha vertical de cartões (`flex flex-col gap-2` = 8px entre cartões) que começa logo abaixo dos alertas de estado. Cada cartão é um `Card padding="sm"` de largura total do painel (≈ 380px úteis), com duas partes: um `<button>` de bloco inteiro (nome em uma linha truncada `text-sm font-medium` → nota opcional em 2 linhas com reticências → carimbo relativo `text-xs` cinza) e, IRMÃ dele e fora da área clicável, a linha de ações.
- **Como o vendedor chega:** Aparece assim que a lista carrega para um vendedor Premium (ativo ou pausado) que já salvou pelo menos uma simulação. É o objeto que ele lê para escolher qual estratégia reabrir.
- **Vizinhança imediata:** Acima do primeiro cartão: o campo de busca e, quando existirem, os alertas "Modo leitura offline" / "Premium pausado" / erro de duplicação. Entre cartões: 8px de gap. Abaixo do último: o botão "Carregar mais" (quando há mais páginas). Dentro do próprio cartão, sob a linha de ações, pode aparecer ainda uma linha cinza de 12px justificada à direita com a justificativa do congelamento de escrita.
- **Dados que chegam (e o que ela devolve):** Uma entrada `ScenarioOut` da união servidor+cache: `name`, `note` (pode ser nula), `updatedAt` (convertido em "há N min/h/dias/semanas" no cliente — nunca exibido como data) e `id`. Não recebe nem exibe preço algum. Devolve `onOpen()` com o `config` completo.
- **O que acontece depois:** Tocar no bloco fecha a folha e repovoa a calculadora com aquela simulação; a barra de contexto surge no topo do Calcular. As três ações da linha inferior seguem por caminhos próprios (folha de renomear, duplicação imediata, diálogo de exclusão).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Cartão de simulação na lista "Minhas simulações"

## O que desenhar
O cartão de uma simulação salva dentro da folha lateral "Minhas simulações", aberta pelo cabeçalho
da calculadora. É o objeto central da funcionalidade: o vendedor Premium abre a folha, varre uma
lista de estratégias salvas ("Shopee agressivo", "Mercado Livre clássico", "Feira presencial") e
escolhe qual reabrir — reabrir CARREGA a estratégia na calculadora e **recalcula tudo com os preços
de hoje**. Cada cartão carrega nome, nota opcional, um carimbo relativo de última alteração e uma
linha de ações (renomear · duplicar · excluir). Desenhe o cartão isolado e em lista, com todos os
estados, dentro da folha real — `min(92vw, 26rem)`, ou seja ~359px no mobile e 416px no desktop.

## Por que este prompt existe
O cartão nunca foi desenhado: a anatomia atual foi inferida de requisito textual. E a inversão que
mais importa é justamente a que ninguém desenhou — **este cartão é o único card de lista do produto
que, por regra, NÃO pode mostrar dinheiro**. Todos os cards de lista já desenhados aqui ostentam um
valor: o protótipo de Histórico (`data · produto · preço`), o de Catálogo (avatar + custo) e o
canvas de 018 (total em 1.125rem em Orçamentos, `money` em Catálogo). Uma simulação não tem preço
armazenado — o número só existe depois de reabrir e recalcular — então um preço no cartão seria uma
mentira de procedência. O mesmo vale para o carimbo: os cards desenhados mostram **data**; aqui a
regra proíbe data-alegação e só permite tempo relativo. Falta desenhar exatamente isso: um card de
lista sem dinheiro e sem data que ainda assim pareça o objeto principal da tela.

## O que já existe hoje (não invente do zero — corrija)
Um `Card padding="sm"` (16px, `--surface-card`, borda `--border-subtle`, raio de card), coluna com
4px de gap. Dentro, de cima para baixo:

| # | Conteúdo | Estilo hoje | Observação |
|---|---|---|---|
| 1 | Nome da simulação | 0.875rem, `font-medium`, uma linha com `truncate` | livre, digitado; obrigatório |
| 2 | Nota (opcional) | **0.875rem** `--text-muted`, `line-clamp-2` + `overflow-wrap:anywhere` | só quando existe |
| 3 | `"Atualizado há 2 dias"` | 0.75rem `--text-muted` | nunca uma data |
| 4 | Linha de ações à direita: ✏️ ✂️ 🗑️ (`pencil`, `copy`, `trash-2`, 18px, botão ghost `sm`) | fora do bloco clicável, irmã | rótulos só em `aria-label`: "Renomear {nome}", "Duplicar {nome}", "Excluir {nome}" |
| 5 | Motivo do bloqueio (só quando as ações estão desabilitadas) | 0.75rem `--text-muted`, alinhado à direita | frase inteira, ver estados |

Os itens 1–3 formam **um único `<button>` de bloco inteiro** (`aria-label` "Abrir {nome}"); as
ações ficam FORA dele. Não há badge, não há avatar, não há preço, não há data.

→ **Problema 1 — hierarquia inexistente:** nome e nota têm o MESMO tamanho (0.875rem). O que muda é
só peso e cor. Uma nota de duas linhas domina o cartão e o nome se perde.
→ **Problema 2 — o cartão não diz o que ele é:** nada nele distingue uma simulação (recalcula hoje)
de um orçamento congelado (preço do dia em que foi salvo). A frase que faz essa distinção aparece
UMA vez, no subtítulo da folha: `"Estratégias salvas. Cada uma recalcula com os preços de hoje
quando você abre."` — no cartão, silêncio. Vendedor que rolou a lista já perdeu a frase de vista.
→ **Problema 3 — o bloco é clicável mas não parece clicável:** é um `<button>` sem tratamento de
hover, sem estado pressionado e sem a borda/realce de `tf-card--interactive`, que é o idioma que o
resto do produto usa para "isto abre".
→ **Problema 4 — duplicar não tem retorno visual:** o ícone de duplicar dispara uma chamada de rede
que pode levar segundos e o botão não tem estado de carregando. O usuário toca de novo.
→ **Problema 5 — erro sem dono:** quando duplicar falha, o aviso vermelho aparece ACIMA da lista
inteira, sem indicar qual cartão falhou.
→ **Problema 6 — repetição:** o motivo do bloqueio (item 5) é estado da CONTA/CONEXÃO e se repete em
cada cartão; com 12 simulações, "Premium pausado — reative para renomear, duplicar, editar ou
excluir." aparece 12 vezes, embaixo do aviso do topo que já diz a mesma coisa.

Ao redor: título `"Minhas simulações"`, subtítulo (acima), campo de busca com placeholder
`"Buscar por nome…"`, faixas de aviso (offline / Premium pausado), a lista com 8px entre cartões e,
no fim, o botão `"Carregar mais"`. Tocar no bloco FECHA a folha e leva à calculadora.

## Conteúdo e dados reais
Cada simulação carrega apenas: id, **nome** (obrigatório, até 120 caracteres — `"Máximo de 120
caracteres."`), **nota** (opcional, até 500 — `"Máximo de 500 caracteres."`), a configuração salva
(canais, taxas ajustadas, base de custo) e as datas de criação/alteração. **Não existe preço, não
existe contagem de canais e não existe nome da base de custo no dado da lista** — tudo isso vive
dentro da configuração e nunca foi derivado para o cartão.

Carimbo relativo, literal, montado como `"Atualizado {quando}"`: `agora mesmo` · `há 7 min` ·
`há 3 h` · `há 1 dia` · `há 2 dias` · `há 5 semanas`. Nunca "12/08/2026".

Nomes reais para as pranchetas: "Shopee agressivo", "Mercado Livre clássico · frete grátis",
"Feira de artesanato — preço de balcão". Notas reais: "Só vale enquanto o cupom de frete durar" /
"Testar margem menor e ver se compensa no volume".

## Estados obrigatórios
- **Repouso com nota** e **repouso sem nota** — o cartão sem nota tem 2 linhas; o com nota tem até
  4. Desenhe os dois lado a lado: a diferença de altura na lista é o que se está resolvendo.
- **Hover** (desktop) e **pressionado** — hoje inexistentes; o bloco inteiro é o alvo.
- **Foco de teclado** — são QUATRO paradas de foco por cartão (bloco + três ícones). Mostre o anel
  em cada uma; o anel no bloco inteiro precisa caber sem estourar a folha.
- **Ações desabilitadas por offline** — três ícones apagados + a frase `"Esta ação precisa de
  conexão."`; acima da lista, a faixa `"Modo leitura offline"` com o corpo `"Suas simulações
  continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."`
  O bloco de abrir CONTINUA ativo — offline se lê e se abre.
- **Ações desabilitadas por Premium pausado** — mesma forma, frase `"Premium pausado — reative para
  renomear, duplicar, editar ou excluir."`; faixa do topo `"Premium pausado"` +
  `"Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear,
  duplicar ou excluir, reative o Premium."` Abrir e recalcular seguem permitidos — a degradação é
  dita, e é só de escrita.
- **Duplicando** — o estado que o código não tem: o cartão precisa mostrar que a cópia está sendo
  criada.
- **Falha de escrita no cartão** — desenhe como o cartão que falhou se identifica (hoje não se
  identifica). Frases reais: `"Esta ação precisa de conexão."` ou a mensagem específica da API.
- **Adversarial** — nome de 120 caracteres sem espaço nenhum e nota de 500 caracteres em um único
  token. Nome trunca em uma linha; nota corta na segunda linha **com reticência visível**.
- **Lista vazia** e **sem permissão** (grátis/deslogado vê a oferta Premium, nunca a lista) não são
  o cartão — desenhe só como referência de contexto se ajudar a compor a prancheta da folha.

## Viewports
- **Mobile 390px** — a folha ocupa 92vw (~359px) e o cartão ~327px de conteúdo. É o uso principal.
- **Desktop 1280px** — a MESMA folha lateral, travada em 26rem (416px), sobreposta à calculadora.
  O cartão não vira grade de duas colunas nem ganha coluna de dinheiro: a folha é a mesma.
Não há versão de página cheia desta lista, e não há variante 1920px distinta de 1280px — a largura
é fixa; mostre 1280px só para provar o cartão contra o fundo escurecido da calculadora atrás.

## Regras que o desenho não pode quebrar
- **Nenhum valor em reais no cartão.** Nem "a partir de", nem preço antigo, nem margem. O preço de
  uma simulação só existe depois de reabrir e recalcular; qualquer número ali é procedência falsa.
- **Nenhuma data.** Só o tempo relativo — o cartão informa há quanto tempo mudou, não afirma um dia.
- **Falha de rede nunca vira "não é Premium"** e Premium pausado nunca esconde as simulações: o
  conteúdo continua legível e abrível nos dois casos; o que congela é a escrita, e isso é escrito.
- **As frases honestas ficam em texto próprio**, nunca dentro de placeholder e nunca truncadas: se
  não couber, o cartão cresce.
- **Alvos de toque ≥44px** para os três ícones — hoje são três botões `sm` colados com 4px de gap na
  ponta direita de um cartão de 327px; verifique que não viram uma fileira de alvos que se tocam.
- Contraste medido contra `--surface-card` real, nos dois temas — a legenda `--text-muted` de
  0.75rem é o pior caso.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: nome longo dentro de uma folha estreita já empurrou
  botões para fora da tela em outra peça deste produto. Meça a largura do cartão contra a folha.
- **Texto ocluso passa em teste**: teste algum afirma que o nome "está visível" mesmo quando ele foi
  cortado pela linha de ações. Prove com caixas, não com a presença do texto.
- **Clamp sem reticência**: uma nota de 500 caracteres sem espaço não mostra "…" por padrão — a
  reticência precisa ser visível no desenho, não implícita.
- **Estado de conta repetido por item** já foi problema no Catálogo (o mesmo aviso 40 vezes).
  Decida no desenho onde ele mora: no cartão, na faixa do topo, ou nos dois com pesos diferentes.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class, não um apêndice):
1. **Anatomia** — cartão com nota e cartão sem nota, cotados: tamanhos, pesos, gaps, alvos.
2. **Interação** — repouso · hover · pressionado · foco no bloco · foco em cada ícone.
3. **Escrita congelada** — variante offline e variante Premium pausado, cada uma com a faixa do topo
   correspondente, mostrando a relação entre faixa e cartão.
4. **Trabalho e erro** — duplicando e falha de escrita atribuída ao cartão certo.
5. **Adversarial** — nome de 120 caracteres sem espaço + nota de 500 caracteres em um token só.
6. **Em contexto** — a folha inteira em 390px e em 1280px com 4 cartões, busca, faixa e
   "Carregar mais".
Reutilize os primitivos existentes: `tf-card--pad-sm` (com `tf-card--interactive` para o bloco
clicável), `tf-btn--ghost tf-btn--sm` + ícones `pencil`/`copy`/`trash-2` na linha de ações,
`tf-badge` se a resposta ao Problema 2 for um selo, `tf-alert` (tom `info`) para as faixas do topo,
`tf-inputwrap`/`tf-input` para a busca. Não crie primitivo novo; se algo faltar, aponte o que falta.

## Perguntas em aberto para o dono
1. **O cartão deve dizer, nele mesmo, que reabrir recalcula?** Um selo permanente ("recalcula hoje")
   em todo cartão vira ruído; a frase só no topo some ao rolar. É decisão de produto, não de layout.
2. **O cartão pode mostrar a base de custo e os canais salvos** (ex.: "Base: Vaso hexagonal ·
   Shopee, Mercado Livre")? O dado existe dentro da configuração salva, mas nunca foi derivado para
   a lista, e isso muda a densidade do cartão inteiro.
3. **As três ações continuam como ícones na face do cartão, ou viram um menu "⋯"?** O desenho de UX
   original pedia menu; o código compôs ícones inline por falta do primitivo de menu. Ícone visível
   custa três alvos por cartão; menu custa um toque a mais.
4. **O motivo do bloqueio deve repetir em cada cartão** ou basta a faixa do topo?

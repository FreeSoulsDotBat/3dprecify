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

- **Onde vive:** Não é uma tela — é um movimento disparado de dois lugares e que reescreve o que está na tela. Origem A: o ícone de cópia (o do meio dos três) na linha de ações de um cartão, dentro da folha "Minhas simulações". Origem B: o botão "Duplicar" (secondary, terceiro da faixa) na barra de contexto no topo do `/calcular`. Não há folha, campo de nome nem confirmação em nenhum dos dois caminhos.
- **Como o vendedor chega:** É o gesto central da funcionalidade: "esta estratégia está boa, quero uma variação dela sem perder a original". Exige Premium ativo e conexão — com Premium pausado ou offline os dois gatilhos estão desabilitados.
- **Vizinhança imediata:** Na origem A, o ícone está a 4px do lápis à esquerda e a 4px da lixeira à direita, no canto inferior direito do cartão. Na origem B, o botão está entre "Renomear" (ghost, à esquerda) e "Salvar alterações" (primário, à direita), numa faixa que quebra em várias linhas no celular.
- **Dados que chegam (e o que ela devolve):** Chama `POST /api/v1/scenarios/{id}/duplicate`. O NOME da cópia vem pronto do servidor: "Cópia de {nome}" — e, se passar de 120 caracteres, o servidor trunca a base com reticências. O vendedor nunca vê nem confirma esse nome no ato. A resposta traz a cópia completa (id, nome, nota, config).
- **O que acontece depois:** Um toast "Simulação duplicada." e a troca de contexto. Pela origem A: a folha da lista FECHA e a calculadora aparece repovoada com a CÓPIA — a barra de contexto passa a exibir "Simulação: Cópia de …". Pela origem B: a simulação carregada é substituída pela cópia NO LUGAR, sem sair da tela, sem transição; o selo de alterações não salvas zera e, a partir dali, tudo que ele editar e salvar vai para a CÓPIA, não para a original. Se a duplicação falhar, um alerta vermelho aparece no topo da lista (origem A) ou dentro da barra de contexto (origem B).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Aviso de campo aposentado numa simulação antiga` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Duplicar-para-ajustar: a troca de contexto que hoje só um toast anuncia

## O que desenhar
O movimento central das **Simulações** (Premium): o vendedor tem uma estratégia salva que funciona, quer testar uma variação ("e se eu subir a margem?") sem estragar a original, e toca em **Duplicar**. A partir daí a tela inteira passa a editar **outro objeto** — uma cópia nova, com nome escolhido pelo servidor. Desenhe esse instante e o que vem depois dele, nos **dois pontos de entrada que existem hoje**: (a) o ícone de copiar no cartão da folha "Minhas simulações", que fecha a folha e repovoa a calculadora com a cópia; (b) o botão "Duplicar" na **barra de contexto** da simulação carregada, que troca a simulação por baixo do vendedor, no lugar, sem sair da tela. Origem no código: `features/scenarios/scenarios-list-sheet.tsx`, `features/scenarios/scenario-context-bar.tsx`, `backend/app/api/scenarios.py`.

## Por que este prompt existe
O fluxo inteiro só existe como **comportamento** — nunca foi desenhado. A auditoria achou "Duplicar" desenhado três vezes (o sheet de detalhe do Histórico, onde o botão é ilustrativo e nem tem handler; a ficha do Catálogo no canvas 018; nada em Kits/Orçamentos) e **nenhuma delas é este fluxo**: nenhuma mostra o que acontece DEPOIS de duplicar. O item 7 do §10.1 da ux pede exatamente "o protótipo de Duplicate + a interação de nome de 120 caracteres" e ele nunca foi feito. Resultado: o movimento que a spec chama de *headline* acontece sem aviso visual, com um nome que o vendedor não escolheu e não confirma.

## O que já existe hoje (não invente do zero — corrija)

**Entrada A — cartão na folha "Minhas simulações"** (`tf-card`, padding sm): nome em uma linha truncada · nota opcional em 2 linhas com reticências explícitas · "Atualizado há 2 dias" · e, à direita, uma fileira de três ícones fantasma de 18px: lápis (Renomear), **copiar (Duplicar)**, lixeira (Excluir). Rótulos acessíveis: `"Duplicar {nome da simulação}"`.

**Entrada B — barra de contexto** (`tf-card` acima da calculadora, quando há simulação carregada):

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | `"Simulação: Caneca 350ml — Shopee"` | uma linha, truncada |
| Legenda viva | `"Recalculado com os preços de hoje"` | **nunca** uma data |
| Selo de sujeira | `"Alterações não salvas"` (`tf-badge`, tom neutro) | só quando há edições pendentes |
| Ações | `"Abrir origem"` (fantasma, só quando a referência resolve) · `"Renomear"` (fantasma) · **`"Duplicar"` (secundário, sm)** · `"Salvar alterações"` (primário, sm) | envolvem linha em telas estreitas |
| Fechar | `"Fechar simulação"` (fantasma) | |

**O que acontece ao tocar em Duplicar (hoje):** o servidor cria a cópia e nomeia sozinho `"Cópia de " + nome`; se passar de 120 caracteres, ele corta a **base** e cola reticências (`"Cópia de Caneca 350ml — Shopee com frete grá…"`), preservando sempre o prefixo. Volta um toast verde **`"Simulação duplicada."`** que some sozinho em 5 segundos, e a calculadora inteira é repovoada com a cópia.

→ **Não há confirmação nem campo de nome no ato.** O vendedor nunca vê nem edita o nome antes de ele existir.
→ **O toast é o único aviso de que o objeto editado mudou.** Ele é `aria-live="polite"`, dura 5s, e some. Quem olhou para o lado continua editando achando que é a original.
→ **Pela entrada A, a folha fecha e a página vira outra simulação sem nenhuma transição** — nada liga o cartão tocado ao novo estado da tela.
→ **Duplicar com "Alterações não salvas" descarta as alterações sem perguntar.** A cópia sai do que está **salvo no servidor**, não do que está na tela; e diferente de "Fechar simulação" (que abre o diálogo `"Descartar as alterações não salvas desta simulação?"`), Duplicar não confirma nada.
→ **Duplicar duas vezes produz dois nomes idênticos** — não há numeração. Duplicar uma cópia produz `"Cópia de Cópia de …"`.
→ **O ícone de copiar do cartão não tem estado de carregando** (o botão da barra de contexto tem). Entre o toque e a troca de tela, nada acontece visivelmente.

## Conteúdo e dados reais
- **Nome**: obrigatório, ≤ 120 caracteres. Erros já existentes: `"Dê um nome à simulação."` · `"Máximo de 120 caracteres."`
- **Nota**: opcional, ≤ 500 caracteres. Erro: `"Máximo de 500 caracteres."` A cópia **herda a nota** da original.
- **Prefixo do servidor**: `"Cópia de "` (9 caracteres, sobra 110 para a base + 1 para o `…`).
- **Carimbo de tempo**: `"Atualizado {quando}"` com `agora mesmo` · `há 7 min` · `há 3 h` · `há 2 dias` · `há 5 semanas`. Nunca uma data absoluta.
- **Preço na calculadora por trás** (use números verdadeiros da seed): preço sugerido **R$ 24,24**, custo **R$ 16,16**, um segundo canal em **R$ 21,01**.
- **Derivado, não digitado**: tudo na calculadora recalcula com os preços de hoje ao abrir a cópia — a cópia guarda a *estratégia* (canais, taxas ajustadas, base de custo), não o preço congelado.

## Estados obrigatórios
1. **Repouso** — ícone/botão Duplicar disponível.
2. **Foco visível** e **hover** — o alvo do cartão tem 18px de ícone; a área tocável precisa de ≥ 44px.
3. **Pressionado / carregando** — o botão da barra de contexto tem giro de carregando; **desenhe também o do cartão**, que hoje não tem.
4. **Desabilitado — offline**: botão apagado + linha de razão `"Esta ação precisa de conexão."`, e no topo da lista o alerta info `"Modo leitura offline"` / `"Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."`
5. **Desabilitado — Premium pausado**: `"Premium pausado — reative para renomear, duplicar, editar ou excluir."`, com o alerta info `"Premium pausado"` / `"Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium."`
6. **Erro de escrita** — `tf-alert` tom perigo acima da lista (entrada A) ou dentro da barra (entrada B), com a frase específica; nunca um erro genérico e nunca um sucesso falso.
7. **Sucesso** — toast verde `"Simulação duplicada."` **e** o estado permanente que este desenho precisa inventar: como a tela declara "você agora edita a cópia".
8. **Cópia com nome truncado** — desenhe o caso real de 120 caracteres, com o `…` visível.
9. **Base de custo degradada** — o alerta info reaproveitado do catálogo, que **nunca** diz "removido/excluído"; a cópia herda essa condição.
10. **Alterações não salvas + Duplicar** — o estado que hoje não existe: o que a tela pergunta (ou declara) antes de descartar.
11. **Sem permissão** — grátis/deslogado nem chega aqui: a folha inteira vira o teaser Premium. Não desenhe um Duplicar apagado para o grátis.

## Viewports
- **Mobile 390px — obrigatório e primário.** É onde o vendedor vive; a barra de contexto já quebra suas 4 ações em duas linhas nessa largura.
- **Desktop 1280px** — a página Calcular **não tem ramo largo** (não entrou no redesenho 018): a folha vira um painel lateral sobre a mesma coluna. Desenhe, porque a troca de contexto sem transição fica ainda mais invisível numa tela grande, onde a barra de contexto pode estar longe do olhar.

## Regras que o desenho não pode quebrar
- **Nenhuma data.** A promessa é `"Recalculado com os preços de hoje"`; carimbo só relativo.
- **Toast só em 201 real.** Nada de otimismo: o sucesso é dito depois do servidor confirmar.
- **Falha de rede nunca vendida como falta de Premium** — e vice-versa. As duas frases são distintas e ambas já existem.
- **Freemium binário**: ou é Premium e a lista aparece, ou é o teaser honesto. Sem meio-termo desabilitado.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega exemplo, não explicação (`"Buscar por nome…"` é placeholder legítimo).
- **"Voltar", nunca "Cancelar"** em diálogos.
- **Degradação é dita, não escondida.**
- Alvos ≥ 44px; contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **O toast que nunca renderizou**: numa entrega anterior o diálogo desmontava antes do callback disparar e a mensagem de confirmação ficou no código sem nunca aparecer na tela. Aqui a folha **fecha no mesmo movimento** em que o toast é disparado — se a confirmação depender da folha, ela morre com ela. O aviso precisa viver fora do que fecha.
- **Nome de 120 caracteres estourando a coluna**: o nome já é uma linha truncada justamente porque empurrava [Duplicar]/[Salvar alterações] para fora da tela. Desenhe com o nome longo, não com "Teste 1".
- **Texto ocluso passa em teste**: um elemento coberto ou transbordado continua "visível" para asserções de texto. Layout se prova com caixas — deixe folga explícita.
- **Overflow horizontal medido**: nenhum elemento pode nascer fora dos 390px.
- **Campo que some**: uma busca já foi entregue com 1×1px, invisível e "presente". Todo controle precisa de área desenhada.

## Entregável
Pranchetas, tema **escuro como padrão** e **claro em pé de igualdade** (as duas para as pranchetas 1, 3 e 5):
1. **390px — cartão da lista**, com os três ícones de ação, incluindo repouso/foco/carregando no ícone de copiar.
2. **390px — o instante da duplicação pela entrada A**: o que o vendedor vê entre o toque e a calculadora repovoada.
3. **390px — barra de contexto da cópia recém-criada**, com o nome `"Simulação: Cópia de Caneca 350ml — Shopee"` e o aviso permanente de que este objeto é uma cópia.
4. **390px — Duplicar com "Alterações não salvas"**: sua proposta de confirmação (ou de declaração), reusando a linguagem do diálogo de descarte que já existe.
5. **390px — estados travados**: offline e Premium pausado, com as frases literais.
6. **390px — nome truncado em 120 caracteres** e **erro de escrita**.
7. **1280px** — a mesma troca de contexto na tela larga.

Reuse os primitivos existentes, sem criar novos: `tf-card` (cartão e barra de contexto), `tf-btn--ghost tf-btn--sm` (ícones de ação e "Renomear"), `tf-btn--secondary tf-btn--sm` ("Duplicar"), `tf-btn` primário ("Salvar alterações"), `tf-badge` neutro ("Alterações não salvas"), `tf-alert` tom info (offline / Premium pausado / degradado) e tom perigo (erro de escrita), o toast padrão, o diálogo centrado para confirmação e a folha para renomear.

## Perguntas em aberto para o dono
1. **Nome da cópia**: duplicar duas vezes gera dois `"Cópia de X"` idênticos. Numerar (`"Cópia 2 de X"`), pedir o nome no ato (um campo antes de criar), ou aceitar a colisão?
2. **Duplicar com alterações não salvas**: a cópia deve sair do que está **salvo** (comportamento de hoje, descartando o que está na tela) ou do que está **na tela**? A mensagem `"Salvar como novo"` existe no dicionário do app e **nunca foi usada em lugar nenhum** — ela era este movimento?
3. **Entrada A**: depois de duplicar pelo cartão, a folha deve mesmo fechar e virar a cópia na calculadora, ou deve continuar aberta mostrando a cópia recém-criada na lista, deixando o vendedor decidir quando abrir?
4. **Aviso de troca de contexto**: basta o toast de 5 segundos, ou a barra de contexto deve carregar uma marca permanente ("cópia de …") enquanto a cópia estiver aberta?

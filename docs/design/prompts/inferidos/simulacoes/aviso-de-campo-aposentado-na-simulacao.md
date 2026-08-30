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

- **Onde vive:** Rota `/calcular`: um `Alert tone="info"` PERSISTENTE (não é toast) de largura total, inserido entre a barra de contexto "Simulação: {nome}" e todo o resto da página. Quando a simulação tem base KIT existe um SEGUNDO alerta irmão, com a mesma cara, renderizado logo antes do cartão de resumo do kit — os dois podem aparecer empilhados.
- **Como o vendedor chega:** Só aparece ao reabrir uma simulação ANTIGA — salva antes de o modelo de cálculo aposentar um campo (hoje, "Desperdício (g)"). O vendedor não fez nada para provocá-lo: ele abre a estratégia que salvou meses atrás e o aviso já está lá, e permanece enquanto a simulação estiver aberta.
- **Vizinhança imediata:** Imediatamente acima: a barra de contexto com o nome da simulação e a linha "Recalculado com os preços de hoje". Imediatamente abaixo: o resumo do kit (se for kit) ou o formulário da calculadora. O número que efetivamente mudou por causa disso está a uma página inteira de rolagem, no rodapé.
- **Dados que chegam (e o que ela devolve):** Recebe a lista de campos descartados na hidratação do documento salvo (no caso do kit, deduplicada em todas as linhas) e monta uma frase dizendo qual campo o documento continha, que o modelo atual não o usa mais e que o recálculo abaixo não o inclui. Não recebe nem exibe a diferença de preço.
- **O que acontece depois:** Nada acontece a partir dele: não tem ação, não pode ser dispensado, e some apenas quando o vendedor fecha a simulação. Se ele salvar as alterações, o documento é regravado já sem o campo aposentado — e o aviso não voltará na próxima abertura.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Folha "Minhas simulações" (a lista inteira)` · `Entrada "Minhas simulações" no topo do Calcular` · `Cartão de simulação na lista` · `Linha de ações do cartão (renomear · duplicar · excluir)` · `Campo de busca por nome + estado "nada encontrado"` · `Estados da lista: carregando · erro frio · cache offline · paginação` · `Estado vazio — nenhuma simulação salva ainda` · `Porta honesta para grátis / deslogado dentro da folha de Simulações` · `Folha "Salvar simulação" (nome · nota · eco da base de custo)` · `Botão "Salvar simulação" abaixo do resultado, colado no "Salvar no histórico"` · `"Salvar simulação" dentro da ficha de produto do Catálogo` · `Barra de contexto "Simulação: {nome}" (com a simulação aberta)` · `Confirmação de descarte ao fechar com alterações não salvas` · `Renomear simulação — duas folhas diferentes para a mesma ação` · `Duplicar-para-ajustar (o movimento central do E5)` · `Congelamento de escrita — "Premium pausado" (lapsado) e offline` · `Resumo somente-leitura de simulação com base KIT` · `Registrar orçamento a partir de uma simulação (ponte E5→E4)` · `Toda a área de Simulações em tela larga (≥1280px)`

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

# Aviso de campo aposentado ao reabrir uma simulação antiga

## O que desenhar

O bloco de aviso que aparece na tela **Calcular** quando o vendedor reabre uma **simulação salva antes de o
campo "Desperdício (g)" ser aposentado do modelo de preço**. O documento salvo ainda carrega esse campo; o
motor de cálculo de hoje recusa a chave, então a simulação reabre e **recalcula um preço diferente do que ela
dava no dia em que foi salva**. Este aviso é a única coisa no produto que explica essa diferença. Ele vive
logo abaixo da barra de contexto "Simulação: {nome}", acima de todo o formulário, e some quando a simulação é
fechada. Quem o lê é o vendedor que abriu uma simulação antiga esperando o mesmo número e viu outro.

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. Não existe protótipo, nem `ux-*.md` do increment 016, nem uma prancheta
no canvas — o protótipo mais antigo é de 2026-07-02, quase um ano antes de o campo existir para ser
aposentado. Uma IA decidiu sozinha que a explicação de uma **divergência de preço** é uma faixa de texto
informativa no topo da página: sem mostrar a diferença, sem antes/depois, sem nenhuma ligação com o número
que mudou — e, quando a simulação é de kit, **dois avisos idênticos empilhados**. Pior: a mesma regra de
negócio já foi desenhada certo em outro lugar do produto (no Histórico, a nota estrutural fica **colada ao
número**, e a frase diz "parte da diferença **acima** pode vir daí"). Aqui a mesma verdade ficou órfã no topo.

## O que já existe hoje (não invente do zero — corrija)

Ordem vertical real da tela Calcular com uma simulação carregada:

| # | Bloco | Texto literal hoje |
|---|---|---|
| 1 | Título da página + promessa freemium | (centralizados) |
| 2 | Botão de navegação | "Meus cenários" |
| 3 | Barra de contexto (card `tf-card` padding sm) | "Simulação: {nome}" · legenda "Recalculado com os preços de hoje" · selo "Alterações não salvas" · "Fechar simulação" · ações "Abrir origem" · "Renomear" · "Duplicar" · "Salvar alterações" |
| 3b | Dentro da barra, quando a origem degradou | "Os valores atuais foram mantidos e continuam editáveis." |
| **4** | **ESTA PEÇA** — `tf-alert` tom info, ícone `info` 20px, **sem título**, só corpo | **"O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."** |
| 4b | Só quando a simulação é de KIT: **um segundo alerta idêntico**, com a mesma frase, imediatamente antes do resumo do kit | (mesma frase) |
| 5 | Formulário (uma coluna no mobile, duas a partir de 1024px) | campos de custo, markup, canais |
| 6 | Rodapé centralizado, largura máx. 720px | "Como chegamos no preço", cartões "Preço varejo" / "Preço atacado", "Salvar cenário" |

→ **Problema 1:** o aviso está no bloco 4 e o número que ele explica está no bloco 6. No mobile 390px isso são
várias telas de rolagem; no desktop o formulário vira duas colunas e o preço desce para o rodapé centralizado.
A palavra "abaixo" na frase promete uma proximidade que não existe.
→ **Problema 2:** o aviso não mostra **nada** da diferença — nem o valor de antes, nem quanto mudou, nem em
qual dos dois preços (varejo/atacado) mudou.
→ **Problema 3:** no caso de kit, dois alertas com a **mesma frase literal**, um em cima do outro.
→ **Problema 4:** o `tf-alert` está sendo usado sem título; a frase inteira é um parágrafo corrido de
`--fs-body-sm`, do mesmo peso de qualquer outra legenda da página.

## Conteúdo e dados reais

- Nome do campo aposentado: sempre em pt-BR — **"Desperdício (g)"**. A chave técnica (`wasteGrams`) **nunca**
  aparece na tela. Hoje é o único campo aposentado, mas a frase aceita **vários nomes separados por vírgula**
  ("Desperdício (g), Outro campo (un)") — desenhe prevendo dois ou três nomes na mesma linha.
- A frase é montada de um template com `{campo}`: o desenho não pode quebrar a linha de um jeito que dependa
  do comprimento do nome.
- Preços de exemplo verdadeiros do produto (use estes, não invente): **R$ 16,16**, **R$ 24,24**, **R$ 21,01**.
  Rótulos dos cartões de preço: "Preço varejo" e "Preço atacado".
- **O documento de simulação NÃO guarda o preço antigo nem a versão do modelo** (só o congelado do Histórico
  guarda `modelVersion`). Ou seja: com os dados de hoje é **impossível** mostrar "antes R$ 24,24 → agora
  R$ 21,01" nesta tela. Desenhe a peça sabendo disso — e se a sua melhor proposta exigir o valor antigo, marque
  a prancheta como **"depende de decisão do dono"** em vez de inventar o número.
- Frase irmã, já homologada, que resolve o mesmo problema no Histórico (referência de tom, **não** para copiar
  aqui): "O valor congelado foi calculado pelo modelo {versao}, que incluía o campo Desperdício. O modelo atual
  não tem mais esse campo — parte da diferença acima pode vir daí."
- A legenda da barra de contexto é **"Recalculado com os preços de hoje"** e **nunca** há data em nenhuma
  superfície de simulação — o aviso também não pode trazer data.

## Estados obrigatórios

1. **Ausente (o caso comum).** Documento salvo depois da aposentadoria: nada é renderizado. Nenhum espaço
   reservado, nenhuma faixa vazia.
2. **Repouso, simulação escalar (avulsa ou de produto).** Um alerta info com a frase completa.
3. **Repouso, simulação de kit.** Hoje o alerta aparece **duas vezes**; o desenho precisa resolver isso — uma
   declaração só, no lugar certo, com o resumo do kit logo abaixo.
4. **Vários campos aposentados.** Mesma frase, com dois ou três nomes em `{campo}` — a linha cresce.
5. **Convivendo com a nota de degradação.** Quando a origem degradou, "Os valores atuais foram mantidos e
   continuam editáveis." já aparece dentro da barra de contexto: mostre a prancheta com os dois avisos juntos
   e prove que não viram uma parede de faixas coloridas.
6. **Convivendo com "Alterações não salvas".** O selo neutro na barra logo acima do aviso.
7. **Offline / Premium pausado.** O aviso **não muda** — ele é derivado do documento, não de rede. As ações da
   barra é que ficam desabilitadas com a legenda "Esta ação precisa de conexão." Desenhe para deixar claro que
   o aviso não é um erro de conexão.
8. **Sem estado de carregando e sem estado de erro próprios.** A peça é pura derivação do documento já
   carregado — não invente spinner nem "tentar de novo".
9. **Foco/hover/pressionado** só se o seu desenho introduzir algum controle (ex.: "ver o que mudou"). Se
   introduzir, ele precisa de alvo ≥44px e estado de foco visível.

## Viewports

- **Mobile 390px** — obrigatório: é onde a distância entre o aviso e o preço é pior (o formulário inteiro
  entre os dois) e onde a frase de 150 caracteres ocupa 4 linhas ao lado de um ícone de 20px.
- **Desktop 1280px** — obrigatório: a partir de 1024px o formulário vira duas colunas e a página abre até
  ~1120px, com o rodapé de preço centralizado em 720px. O aviso continua em largura total no topo. Meça e
  anote na prancheta a distância vertical entre o aviso e o cartão "Preço varejo".
- 1920px não precisa de prancheta própria: o conteúdo continua limitado a ~1120px centralizados.

## Regras que o desenho não pode quebrar

- **Persistente, nunca um toast.** A divergência de preço tem de continuar visível enquanto a simulação
  estiver aberta. Nada que pisque e suma.
- **Nome do campo sempre em pt-BR.** "Desperdício (g)", nunca `wasteGrams`.
- **Nunca dizer "removido/excluído/deletado"** sobre dados do vendedor — o campo saiu do modelo, o documento
  dele continua íntegro.
- **Nunca vender isso como problema de conexão nem como limite de plano.** Não é falha de rede e não é
  freemium: é mudança de modelo. Nada de "Assinar" perto desta peça.
- **Nunca esconder a degradação atrás de um "saiba mais" fechado por padrão.** A frase principal fica visível
  no repouso; um detalhe expansível pode existir *além* dela, nunca no lugar dela.
- **Frase honesta fora de placeholder** — ela vive em elemento de largura total, nunca como sufixo de campo.
- **Sem data em nenhuma superfície de simulação.**
- Contraste medido de verdade: o texto do alerta info é `--info-text` sobre `--tf-info-soft`, nos dois temas.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** O headless não enxerga barra de rolagem clássica; já custou
  uma correção medir só o eixo X. A cadeia de `min-width: 0` da página existe justamente porque um preço muito
  longo esticava a página inteira. Um alerta com texto longo não pode reintroduzir isso.
- **Distância mata a mensagem — já medido.** Em 2026-08-03 a promessa freemium vivia a 97% da altura da página
  (4,6 telas de rolagem a 360px) e foi movida para a primeira dobra por decisão do dono. Aqui o erro é o
  espelho: a explicação está no topo e o número está no fim.
- **Texto ocluso passa em teste.** `toBeVisible` passa em elemento coberto ou estourado; o que decide é a
  geometria. Se o aviso encostar no rodapé fixo ou numa folha aberta, o teste não avisa.
- **Nome longo trunca.** O nome da simulação na barra logo acima é uma linha só, truncada — 120 caracteres não
  podem empurrar nada. O aviso abaixo herda essa vizinhança.
- **Empilhamento de faixas.** Barra de contexto + nota de degradação + este aviso + (kit) o aviso gêmeo podem
  somar quatro blocos antes do primeiro campo. Isso é um problema de desenho, não de código.

## Entregável

Pranchetas (tema **escuro** como padrão; **claro** como first-class para as pranchetas 1 e 3):

1. **Mobile 390px — simulação escalar, estado atual anotado**: barra de contexto + aviso + começo do
   formulário, com a distância até o preço marcada em px.
2. **Mobile 390px — simulação de kit**: como fica com o resumo do kit, resolvendo a duplicação.
3. **Mobile 390px — a proposta**: onde a declaração deve viver para ficar ligada ao número que mudou (junto do
   bloco de preço, ecoada no topo, ancorada, ou o que você defender) — com a justificativa escrita na prancheta.
4. **Desktop 1280px — a página com simulação carregada**, formulário em duas colunas e o rodapé de preço,
   mostrando a mesma solução no layout largo.
5. **Convivência**: uma prancheta com aviso de degradação + selo "Alterações não salvas" + este aviso juntos.
6. Variante com **dois nomes de campo** na frase.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` tom **info** (ícone `info` 20px, corpo
`--fs-body-sm`) para a declaração; `tf-alert__title` se você decidir que a peça precisa de um título curto;
`tf-card` padding sm para a barra de contexto; `tf-badge` neutro para "Alterações não salvas"; `tf-button`
ghost/secondary/sm para as ações da barra e para qualquer controle novo que você propuser; o bloco de preço do
rodapé usa o `tf-price` existente com "Preço varejo" / "Preço atacado".

## Perguntas em aberto para o dono

1. **Mostrar a diferença exige guardar o preço antigo.** O documento de simulação não guarda preço congelado
   nem versão do modelo (só o Histórico guarda). Vale mudar isso para poder dizer "antes R$ 24,24 → hoje
   R$ 21,01", ou a declaração continua qualitativa ("parte da diferença pode vir daí")?
2. **A declaração deve ficar no topo, junto do preço, ou nos dois lugares?** Se nos dois, o texto se repete
   igual ou o de cima vira uma linha curta que aponta para o de baixo?
3. **No kit, a declaração é uma só, rolada para o kit inteiro, ou uma por linha afetada?** Hoje o código já
   deduplica para uma; o desenho pode querer nomear quais peças do kit tinham o campo.
4. **O aviso pode ser dispensado pelo vendedor?** Se sim, ele volta na próxima reabertura da mesma simulação
   ou fica dispensado para sempre?
5. **Existe uma ação a oferecer junto ao aviso** — por exemplo "salvar alterações" para o documento passar a
   viver no modelo atual e o aviso sumir de vez — ou a peça é puramente informativa?

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

## O mapa funcional de Orçamentos (registros congelados, exportação, comparação)

### Orçamentos — o que a área é

A quarta aba (rotulada **"Orçamentos"**, rota `/historico`) é a prateleira dos **registros congelados**: cada registro é a afirmação do vendedor sobre *o que ele cotou naquele dia*, com data, e os valores ficam parados para sempre. É o oposto da aba Simulações, que recalcula tudo com os preços de hoje toda vez que abre. O vocabulário é deliberado e vale para todo desenho: diz-se **"Valor cotado"**, nunca "Preço" (preço é o que a Calcular diz *hoje*); diz-se **"salvo"** só quando o servidor confirmou.

**Como o vendedor chega.** Pela barra de abas (mobile) ou pelo menu lateral (desktop). Mas o registro **nasce fora daqui**: no rodapé da Calcular, no rodapé do compositor de Kits e no rodapé da ficha de produto do Catálogo existe um botão **"Salvar em Orçamentos"** que abre a folha de gravação. Ele volta a esta aba para *provar depois o que cobrou* — mostrar ao cliente, exportar um PDF, ou perguntar "meu custo subiu desde que cotei?".

**Rotas.**
- `/historico` — a lista (com busca e filtro de período, paginada por "Carregar mais", nunca carregada inteira).
- `/historico?snapshot={clientSnapshotId}` — o registro. **Abaixo de 1280px** ele toma a tela inteira (com "← Voltar"); **a partir de 1280px** a mesma rota vira **mestre-detalhe**: lista à esquerda, registro na coluna direita fixa (`position:sticky`, rolagem própria), e o primeiro registro abre sozinho.

**O que a área guarda e onde.** Três camadas, sempre unidas numa lista só: (1) o **servidor** (a conta), (2) um **cache local por uid** que responde quando a rede falha, (3) a **outbox** — a fila durável no aparelho. Gravar é *sempre* enfileirar-e-drenar: online a fila esvazia dentro da mesma interação e o registro volta `synced`; offline ele fica `pending` e sincroniza sozinho depois (quatro gatilhos: abertura do app, volta da rede, foco da janela, aba visível). Estados possíveis de um registro: `synced` · `pending` · `blocked` (Premium não ativo) · `unauthenticated` (sessão expirou) · `failed` (servidor recusou).

**De que depende.** Do **entitlement do servidor** (a última palavra sobre o plano — nunca um sinalizador do cliente); do motor **`pricing-core`**, usado *apenas* em "Recalcular hoje" e "Comparar com hoje" — a leitura do registro **não recalcula nada**, todo número é uma string gravada; do **catálogo de tarifas** servido+cacheado (só nesses dois recálculos); da **sessão Firebase**; e do **catálogo de produtos/kits**, consultado só para saber se a origem ainda existe (nunca para um valor).

**O que ela alimenta.** Um cálculo vira registro congelado; um registro vira **PDF de orçamento para o cliente** ou **CSV da conta**; "Recalcular hoje" cria um **registro novo** (o original é imutável — só o rótulo pode ser editado); a ficha técnica leva de volta ao produto/kit de origem, quando ele ainda existe.

**Como muda por estado.**
- **Grátis / deslogado** — a aba inteira é substituída por uma porta honesta: título "Guarde seus orçamentos com a data", subtítulo, "Assinar Premium" e o rodapé "A calculadora continua grátis e sem limite." Nenhuma lista, nenhum registro.
- **Premium ativo** — tudo: gravar, ler, renomear, excluir, recalcular, exportar.
- **Premium pausado (lapsed)** — **nada é apagado**. A lista e os registros continuam legíveis; some a barra gerenciar, some "Recalcular hoje", "Exportar" fica visível-e-desabilitado com o motivo impresso. Uma faixa calma explica: escrever precisa do Premium ativo.
- **Offline** — leitura pelo cache com faixa "Modo leitura offline"; gravar funciona (vira pendente); exportar **não** funciona (o arquivo é gerado no servidor); comparar/recalcular usam o catálogo salvo no aparelho e avisam que ele pode estar desatualizado.
- **Sessão expirada** — os registros novos param na fila com "Envio pausado · sessão expirada", e o caminho de volta ("Entrar de novo") aparece no banner e dentro do registro. O aviso genérico de falha de carga **cala** para não virar uma terceira voz sobre o mesmo fato.

## O ponto exato de inserção desta peça

- **Onde vive:** Ocupam a página /historico INTEIRA, antes de a aba existir, dentro da mesma moldura mínima (título "Orçamentos" e nada mais). Dois estados: um giro de carregamento centralizado, sem uma palavra, com folga vertical generosa; e um alerta VERMELHO centralizado "Não foi possível verificar seu plano." com um botão secundário "Tentar novamente" logo abaixo dele. Nenhum dos dois mostra lista, filtro ou card.
- **Como o vendedor chega:** O assinante toca na aba Orçamentos com rede ruim. É a primeira coisa que ele vê — antes da lista, antes de qualquer faixa.
- **Vizinhança imediata:** Abaixo do título "Orçamentos" e acima de nada. Fora da página, a moldura do shell (barra superior / menu lateral) e a barra de abas.
- **Dados que chegam (e o que ela devolve):** Duas perguntas encadeadas, e a ordem importa: a sessão ainda está carregando (giro) → não autenticado (porta honesta do Premium) → o plano ainda está carregando (giro de novo) → plano "nunca concedido" (porta honesta) → o servidor não respondeu e não há nada em cache (o alerta vermelho). Um Premium pausado NÃO cai aqui: ele passa direto para a lista e é avisado com calma. Uma sessão em boot nunca pode piscar a porta de vendas para quem já é assinante.
- **O que acontece depois:** "Tentar novamente" refaz a consulta de plano. Dando certo, a aba inteira aparece; dando errado, a mesma parede vermelha permanece.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Momento em que o registro pendente vira sincronizado`

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

# Porta do plano em Orçamentos: "verificando" e "não foi possível verificar seu plano"

## O que desenhar

Os dois estados de guarda que rodam **antes** de a aba Orçamentos existir. Quando o vendedor toca em
Orçamentos, a tela não abre direto: o app primeiro precisa saber quem ele é (sessão) e se o Premium
está ativo (plano). Enquanto a resposta não chega, ele vê um estado de espera; se ela não vier nunca
— rede ruim, servidor fora, primeiro acesso offline sem plano guardado no aparelho — ele vê um estado
de falha com um botão de tentar de novo. É a **primeira coisa** que um assinante vê ao abrir a aba em
condição ruim. Depois dessa porta vêm três destinos: a lista de orçamentos, o convite Premium honesto
(conta nunca-Premium) ou a lista em modo "Premium pausado". Origem no código:
`apps/web/src/pages/historico/historico-page.tsx` (`GateChecking`, `GateError`, `GateShell`).

## Por que este prompt existe

Nenhuma autoridade de desenho cobre estes dois estados: eles foram inferidos por IA a partir do
achado C5 de uma revisão de PR, e o próprio comentário no código registra isso. O protótipo de
2026-07-02 **contradiz** o que foi construído — ele desenhou, mediu e verificou um carregamento em
**esqueleto com shimmer** (reduced-motion respeitado, contraste corrigido no escuro), e sobre **a
lista**, não sobre o plano; o app entregou um spinner mudo. Já a falha de **consulta ao plano** não
existe em autoridade nenhuma: os dois artefatos de referência alternam Premium/não-Premium sem
qualquer estado intermediário. O intermediário é o que falta desenhar.

## O que já existe hoje (não invente do zero — corrija)

Os dois estados vivem dentro da mesma moldura (`GateShell`): título de página **"Orçamentos"** e, sob
ele, o conteúdo da guarda. Nada mais.

| Estado | Quando dispara (código real) | O que aparece hoje |
|---|---|---|
| Verificando | `sessionStatus === "loading"` **ou** entitlement na primeira leitura sem nada em cache | Título "Orçamentos" + um `Spinner` centralizado com `py-8`. **Zero palavras na tela.** |
| Não verificou | Consulta encerrada, sem resposta e sem plano guardado no aparelho (offline / servidor fora) | Título "Orçamentos" + `Alert tone="danger"` com "Não foi possível verificar seu plano." + botão secundário "Tentar novamente", tudo centralizado |

Textos literais de hoje (não reinvente; cite estes):

- Título da página: **"Orçamentos"**
- Erro: **"Não foi possível verificar seu plano."**
- Botão: **"Tentar novamente"**
- O spinner só tem rótulo para leitor de tela: **"Carregando…"** (genérico do primitivo, invisível)

→ **Problema 1 — o carregamento é mudo.** A aba Kits, com a guarda gêmea, mostra spinner **+ a frase
"Verificando seu plano…"** (`bom-page.tsx`). Orçamentos não tem sequer essa chave de texto. O mesmo
momento do produto fala em uma tela e cala na outra.

→ **Problema 2 — o tom diverge da família.** Kits usa `Alert tone="info"` para exatamente a mesma
frase; Orçamentos usa `tone="danger"` (vermelho, `role="alert"`, anúncio assertivo) ocupando a página
inteira. Falhou uma **consulta**, não o Premium — e vermelho de página inteira lê como "sua assinatura
caiu".

→ **Problema 3 — a legenda da aba some.** A linha "O que você cotou, com a data. Os valores ficam
congelados como estavam no dia." aparece na lista, mas **não** na guarda: sobra um título solto.

→ **Problema 4 — no desktop é um oceano.** A guarda roda **antes** do corte de 1280px, então o mesmo
bloquinho centralizado cai numa página que vai até 1720px de largura. A 1920px é um spinner de 24px
no meio de uma tela vazia.

→ **Problema 5 — "Tentar novamente" não dá retorno.** O clique dispara nova consulta, mas o botão não
tem estado de "tentando": nada muda na tela. Em rede ruim o vendedor clica três vezes achando que não
pegou.

→ **Problema 6 — um spinner, duas perguntas.** "Vendo quem é você" e "vendo seu plano" viram o mesmo
pixel; pode ser a decisão certa, mas foi tomada por omissão.

## Conteúdo e dados reais

- Não há campo, número nem dinheiro nesta peça: ela é anterior a qualquer dado. Nada de `R$`, nada de
  data — inventar um valor aqui seria inventar um orçamento. Nem nome de conta, e-mail, plano,
  expiração ou valor de assinatura.
- O que a lista mostraria **depois** (e que um esqueleto imitaria, se for esse o caminho): por card,
  nesta ordem — rótulo ("Suporte de fone — Cliente Ana"), a data **acima** do dinheiro ("Cotado em
  12/08/2026 · Peça única"), a linha "Valor cotado" com **R$ 24,24** e, sob ela, "preço de varejo". A
  data vir antes do dinheiro é regra estrutural e vale para o esqueleto também: um retângulo grande
  no topo, imitando um preço, seria uma promessa errada.
- Conta **Premium pausada** nunca chega nestes dois estados: ela vai direto para a lista, com faixa
  própria. Não desenhe "pausado" aqui.

## Estados obrigatórios

1. **Verificando (repouso).** O que o app está fazendo, dito em palavras. A frase da família já
   existe e deve ser reaproveitada literalmente: **"Verificando seu plano…"** Nunca a palavra
   "Premium" isolada, nunca "Gratuito" — o plano ainda é desconhecido.
2. **Verificando > 3 s.** Uma segunda leitura calma para rede ruim (não invente a frase: veja
   Perguntas em aberto). Precisa existir visualmente, mesmo que a copy fique com o dono.
3. **Não foi possível verificar (repouso).** A frase exata **"Não foi possível verificar seu plano."**
   + botão **"Tentar novamente"**. Precisa ler como "a consulta falhou", não como "você perdeu o
   Premium".
4. **Botão "Tentar novamente":** repouso, hover, foco visível pelo teclado, pressionado, e **tentando**
   (a nova consulta em curso — hoje inexistente e necessário).
5. **Offline declarado.** O app sabe se está sem conexão e já tem vocabulário próprio para isso em
   outras faixas desta mesma aba ("Modo leitura offline"). Desenhe a variante em que a causa provável
   é ausência de rede, com tom calmo — sem prometer que os registros aparecerão, porque nesse ponto
   nada foi carregado.
6. **Movimento reduzido.** Toda animação (giro do spinner ou shimmer de esqueleto) precisa de uma
   versão estática equivalente — o protótipo de 2026-07-02 já pagou esse item.

Não desenhe aqui: vazio (é da lista), degradado, Premium pausado, sem permissão — nenhum é alcançável
por esta peça.

## Viewports

- **390px (mobile)** — obrigatório: é o caminho principal e o cenário em que a rede ruim acontece de
  verdade.
- **1280px (desktop, início do corte)** — obrigatório: é onde a página passa a valer a largura toda e
  o bloco centralizado fica órfão.
- **1920px** — obrigatório para esta peça, e é o pior caso: a página chega a 1720px de largura e o
  conteúdo da guarda é um spinner. Mostre o que preenche (ou o que limita) essa largura.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como "não é Premium".** É a razão de a peça existir. Nenhum convite
  para assinar, nenhum preço, nenhum botão de compra nestes dois estados.
- **Nada afirma o plano antes de saber.** Nem "Gratuito", nem "Premium", nem selo, nem badge.
- **A frase honesta mora em elemento de largura cheia**, nunca em placeholder e nunca cortada por
  reticências — armadilha já paga neste projeto.
- **Vermelho é para o que o vendedor perdeu**, não para o que o app não conseguiu perguntar. Se o
  desenho mantiver `danger`, precisa justificar; a família (Kits) usa `info`.
- **Alvo de toque ≥ 44px** no "Tentar novamente", com folga em 390px.
- **Contraste medido contra o fundo real** de cada tema — o esqueleto do protótipo só passou depois
  de ser corrigido para ficar visível no escuro (1,79:1 registrado).
- **Uma voz por fato.** Se a guarda já diz que não conseguiu verificar, não empilhe uma segunda
  mensagem dizendo o mesmo com outras palavras.

## Armadilhas já pagas neste projeto

- **Esqueleto quase invisível no tema escuro** — pego em auditoria (PARTIAL em V2, corrigido em V3).
  Se houver esqueleto, ele precisa de contraste medido no escuro **e** de um modo de demonstração,
  senão ninguém consegue verificar.
- **Tela larga preenchida por bloco estreito** — o 016 mediu 39% de uso da largura em telas iguais a
  esta e o 018 nasceu disso. Um spinner sozinho em 1720px repete o defeito.
- **Overflow horizontal medido**, nos dois eixos: uma frase longa centralizada em 390px estoura com
  facilidade, e o teste automatizado não vê barra de rolagem clássica. Texto fora da tela passa em
  asserção — posicione tudo dentro da dobra em 390px.
- **Anúncio para leitor de tela ≠ texto na tela.** O rótulo invisível "Carregando…" existe hoje e não
  ajuda ninguém que enxerga. Os dois precisam dizer a mesma coisa.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como cidadão de primeira classe** (o mesmo conjunto
nos dois):

1. Verificando — 390px, 1280px, 1920px.
2. Verificando prolongado (> 3 s) — 390px e 1920px.
3. Não foi possível verificar — 390px, 1280px, 1920px.
4. Variante offline do estado 3 — 390px.
5. Estados do botão "Tentar novamente" (repouso · hover · foco · pressionado · tentando) — detalhe
   ampliado.
6. Versão sem movimento (estático) do estado de carregamento escolhido.

Reutilize os primitivos existentes, não crie família nova: o título vem do cabeçalho de página; a
mensagem de falha é o `Alert` (com o tom que o desenho decidir, dentro dos existentes); o botão é o
`Button` secundário; a espera é o `Spinner`, com rótulo **visível** ao lado. **Uma exceção
declarada:** se o desenho escolher esqueleto de lista, ele é um primitivo **novo** — não existe nada
equivalente hoje no design system — e precisa vir especificado (tamanhos, raio, contraste nos dois
temas, versão sem movimento), não como enfeite de uma tela só.

## Perguntas em aberto para o dono

1. **Esqueleto ou spinner com frase?** O protótipo desenhou esqueleto para a lista; aqui o que carrega
   é o **plano**, e o resultado pode ser "você não é Premium" — nesse caso o esqueleto teria desenhado
   uma lista que nunca vai existir. Vale a pena, ou a espera de plano é spinner + frase e o esqueleto
   fica reservado para o carregamento da lista?
2. **Tom da falha de consulta: `info` (como Kits) ou `danger` (como Orçamentos hoje)?** É a mesma
   frase, o mesmo evento e duas telas discordando. Precisa de uma resposta única para a família toda
   (Orçamentos, Kits, Catálogo, Simulações).
3. **A falha deve distinguir "você está offline" de "o servidor não respondeu"?** O app sabe a
   diferença e já usa vocabulário próprio para offline nesta mesma aba. Distinguir é mais honesto e
   custa uma segunda copy.
4. **Qual a frase da espera prolongada?** Depois de alguns segundos, o vendedor merece uma segunda
   leitura — e ela não existe em lugar nenhum do produto hoje.

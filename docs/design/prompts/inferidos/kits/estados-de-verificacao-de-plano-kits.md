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

## O mapa funcional de Kits / BOM multi-peça

### O que é a área Kits

O vendedor de impressão 3D às vezes não anuncia uma peça: anuncia um **conjunto** ("suporte + base", "kit de 3 vasos"). A aba **Kits** é onde ele monta esse conjunto peça por peça e vê o preço do kit inteiro — custo total, preço de varejo, preço de atacado e, se ele usa marketplaces, quanto sai o anúncio e quanto sobra líquido em cada canal.

### Como ele chega e o que encontra

- **Aba 3 da navegação** (`/kits`, rótulo "Kits") → cai no **compositor vazio**, pronto para montar um kit novo.
- **`/kits?id=<id>`** → o mesmo compositor **hidratado com um kit salvo** (veio da aba Kits dentro do Catálogo, ou de um "Salvar kit" que acabou de acontecer). As peças chegam já resolvidas pelo servidor.
- **`/kits?id=<id>&copy=true`** → duplicar: carrega os mesmos dados, o nome ganha o sufixo "(cópia)" e **salvar cria um kit novo** — nada é escrito sem o vendedor mandar.
- **`/catalogo?tab=kits`** → a *lista* de kits salvos (quarta pílula do Catálogo, ao lado de Filamentos · Impressoras · Produtos). Não é uma segunda tela de edição: abrir uma linha manda de volta para `/kits?id=`.

A rota `/kits` é **pública** — quem está deslogado ou sem Premium chega nela e vê um teaser honesto, nunca um chute para fora.

### O que a área guarda, e o que ela só calcula

Um kit salvo guarda **estrutura, nunca dinheiro**: nome, ordem das peças, quantidade e, por peça, ou uma **referência viva** a um produto do catálogo ou os valores próprios daquela peça. Preço **nenhum** é armazenado — ele é recalculado do zero a cada abertura, pelo motor `pricing-core`, que roda **no aparelho e offline**. Por isso a linha da lista de kits só sabe dizer "3 peça(s)", jamais um valor.

As leituras (kits salvos, produtos do catálogo) vêm do servidor e ficam num **cache local por conta**; se a rede falhar, o cache continua servindo e a tela diz que o dado pode estar desatualizado. **As escritas de kit são só online** — o servidor é quem decide o direito de gravar, então não existe fila/outbox para "Salvar kit" e não existe confirmação otimista: o toast "Kit salvo." e o recibo só aparecem depois de uma resposta real.

### De que depende

Catálogo de **tarifas de marketplace** servido + cacheado (alimenta os preços por canal de todas as peças de uma vez) · **entitlement** consultado no servidor (`active` · `lapsed` · `none`) · **sessão Firebase** · o catálogo de **produtos** do vendedor (o seletor de peça) · o motor `pricing-core`.

### O que a área alimenta depois

- **Salvar kit** escreve no catálogo do vendedor: cada peça que não é referência vira um **produto novo em Produtos** (materialização) — e é isso que o recibo pós-salvamento conta.
- **Salvar em Orçamentos** congela o kit como documento (aba Orçamentos): o preço de hoje vira registro imutável, itemizado peça a peça. Sai da esfera do "vivo".
- Um kit salvo também pode virar base de um cálculo na aba Calcular.

### Como muda por estado

| estado | o que o vendedor vê |
|---|---|
| **grátis / deslogado** | nenhum compositor: só o cabeçalho e o teaser Premium honesto |
| **Premium ativo** | tudo: compor, salvar, duplicar, congelar em Orçamentos |
| **Premium pausado (lapsed)** | **criar** está fechado (painel calmo de reativação + "Ver meus kits"); **reabrir e recalcular** um kit salvo continua funcionando, com faixa informativa no topo; "Salvar kit" continua **visível** e responde honestamente ao ser tocado; "Salvar em Orçamentos" **não existe** ali |
| **offline** | calcular funciona inteiro; leituras vêm do cache; salvar kit falha e diz por quê — falha de rede nunca é vendida como "você não tem Premium" |
| **sessão expirada** | volta ao teaser deslogado; o "Entrar" promete voltar para `/kits` |
| **plano não verificável** | estado próprio: "Verificando seu plano…" ou a parede "Não foi possível verificar seu plano." + "Tentar novamente" — deliberadamente diferente de "você não tem Premium" |

## O ponto exato de inserção desta peça

- **Onde vive:** Duas telas que substituem TODO o compositor dentro da mesma moldura mínima da aba: uma seção com o cabeçalho "Monte seus kits" e nada mais abaixo dele. Mais uma terceira aparição, esta como faixa: um alerta informativo no topo do compositor, entre o cabeçalho e as peças.
- **Como o vendedor chega:** O vendedor toca "Kits" na barra de abas e o app precisa perguntar ao servidor qual é o plano dele antes de montar qualquer coisa. Se a resposta demora, ele vê (a); se não vem resposta nenhuma e não há resposta anterior, ele vê (b); se a re-checagem falha mas a última resposta ainda diz ativo, ele vê (c) e continua trabalhando.
- **Vizinhança imediata:** (a) "Verificando seu plano…": um giro centralizado com o texto abaixo, sozinho numa página vazia sob o cabeçalho. (b) A parede: um alerta de tom informativo com "Não foi possível verificar seu plano." e, abaixo dele, um botão secundário "Tentar novamente" — nada mais na página. (c) A faixa: o MESMO texto como alerta informativo no topo do compositor, imediatamente abaixo do cabeçalho e acima da faixa de Premium pausado, da faixa de tarifas e da primeira peça — o trabalho todo continua visível embaixo.
- **Dados que chegam (e o que ela devolve):** A consulta de entitlement ao servidor (ativo · pausado · nenhum) e a informação de que a última resposta está velha. Nunca uma marca local: o app não decide sozinho que alguém é Premium.
- **O que acontece depois:** "Tentar novamente" refaz a consulta ali mesmo. Uma resposta "ativo" monta o compositor; "nenhum" leva ao teaser Premium; "pausado" leva ao painel de reativação. A distinção é inegociável: "não sabemos do seu plano" nunca pode ser lido como "você não tem Premium".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Verificação de plano na aba Kits: "checando" e a parede de "não sei"

## O que desenhar
Os estados que a aba **Kits** (`/kits`) mostra ANTES de decidir se o vendedor vê o compositor de kits, o teaser
de Premium ou um aviso de plano pausado. São dois momentos curtos e decisivos: (a) enquanto o app pergunta ao
servidor qual é o plano da conta — hoje um spinner com "Verificando seu plano…" ocupando a página inteira; e
(b) quando essa pergunta não tem resposta nenhuma (offline no primeiro acesso, servidor fora, sessão sem cache)
— hoje uma parede com "Não foi possível verificar seu plano." e um botão "Tentar novamente". Some-se a isso a
faixa que aparece no topo do compositor quando a re-checagem falha mas a última resposta do servidor ainda diz
"ativo". Quem usa: o vendedor que abriu a aba Kits para montar um anúncio, muitas vezes na oficina, com Wi-Fi
ruim. É o que ele vê nos 300ms–8s em que o produto ainda não sabe quem ele é.

## Por que este prompt existe
Nada disso foi desenhado. O canvas do 018 (`Abas-Desktop.dc.html`) modela o plano como um enum de dois ramos
(`premium | free`) — não existe "checando" nem "falhou a checagem" em nenhum dos quatro artboards, e um grep por
"Verificando" e "Não foi possível" no arquivo não acha nada. O protótipo de 2026-07 tem um Splash "Verificando
sessão…", mas isso é SESSÃO e é a abertura do app, não uma parede de entitlement por aba; a §E9 cobre erro
global e 404, a §E8 é o upsell. A auditoria de 2026-07-02 listou "missing states" e citou skeletons e load-error
de Catálogo/Histórico — nunca verificação de plano. Ou seja: os dois estados que decidem se o vendedor acredita
que **perdeu o Premium** ou que **a rede falhou** nasceram inteiramente de código.

## O que já existe hoje (não invente do zero — corrija)
Todos os estados usam a mesma casca (`GateShell`): um `PageHeader` com o `<h1>` "Monte seus kits" e nada mais,
dentro de um container `tf-page-wide` — 460px no mobile, 1120px a partir de 1024px e **1720px a partir de
1280px** (o 018 alargou). O conteúdo empilha em coluna com espaçamento uniforme.

| Estado (código) | O que renderiza hoje | Texto literal |
|---|---|---|
| Sessão em bootstrap | Spinner centralizado + legenda, bloco com respiro vertical grande | "Verificando seu plano…" |
| Sem resposta do servidor (`isError && !data`) | `Alert tone="info"` de largura total **+ botão secundário SOLTO abaixo** | "Não foi possível verificar seu plano." · "Tentar novamente" |
| Resposta ainda não chegou (`!data`) | O mesmo bloco de spinner acima | "Verificando seu plano…" |
| Lapsed reabrindo kit, lista carregando | O **mesmo** bloco de spinner | "Verificando seu plano…" |
| Re-checagem falhou, último "ativo" vale | `Alert tone="info"` no topo do compositor, **sem título e sem ação** | "Não foi possível verificar seu plano." |
| Sem Premium (`status: none`) / deslogado | `tf-premium-teaser` (título, subtítulo, botão Assinar, legenda) | "Monte e precifique kits com várias peças" · "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro, por canal." · "A calculadora de peça única continua grátis." |
| Premium pausado, sem kit aberto | `Alert tone="info"` COM título + botão secundário abaixo | "Premium pausado" · "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium." · "Ver meus kits" |
| Premium pausado, kit reaberto | Faixa no topo do compositor | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." |

→ **A mesma frase serve a dois significados opostos.** "Não foi possível verificar seu plano." é ao mesmo tempo
a parede ("não sabemos nada, você não passa daqui") e a faixa calma ("seu Premium está ativo, só não conseguimos
reconfirmar agora"). São mensagens diferentes; a copy é uma só.
→ **`tone="info"` carrega três significados na mesma cor**: falha de verificação, plano pausado e taxas
desatualizadas. Um vendedor com Wi-Fi ruim pode ver as três faixas azuis empilhadas no topo, sem hierarquia.
→ **O botão "Tentar novamente" fica FORA do alerta**, colado à esquerda, enquanto no mesmo arquivo o alerta de
taxas ("Não foi possível atualizar as taxas") põe o botão DENTRO do bloco. Duas gramáticas na mesma tela.
→ **O botão de retry não mostra que está tentando.** Ele dispara a re-consulta e nada muda visualmente: o
vendedor clica de novo, e de novo.
→ **Nada limita o tempo do spinner.** Ele pode ficar sozinho numa página vazia indefinidamente.
→ **A 1280–1920px o problema explode**: um spinner de ~24px e uma linha de 12px flutuando no meio de um
container de 1720px, com um `<h1>` no topo e vazio absoluto abaixo.

## Conteúdo e dados reais
- O servidor responde exatamente três status: `none`, `active`, `lapsed`, mais os campos opcionais `source` e
  `expiresAt` (ISO). **Nenhum deles é mostrado nestes estados** — nem data de expiração, nem origem.
- A última resposta do servidor é lembrada no dispositivo (por conta). Só existe parede quando não há resposta
  **nem fresca nem lembrada** — primeiro acesso offline, cache limpo, ou troca de conta.
- Offline não pausa a consulta: ela **roda e falha**, de propósito, para que o produto saiba dizer "isto é do
  último acesso" em vez de passar por atual.
- Nenhum número de dinheiro aparece nesta peça. O primeiro `R$` só surge no compositor (ex.: "Total do kit"
  R$ 1.234,56) e no teaser de assinatura (R$ 15,99/mês ou R$ 155,88/ano) — não invente preço aqui.
- Nada é editável nestes estados: são leitura + no máximo um botão.

## Estados obrigatórios
1. **Checando (primeira montagem)** — spinner + "Verificando seu plano…". Precisa de uma forma que não seja
   "página quebrada": desenhe a alternativa ao spinner nu (esqueleto do compositor, por exemplo) e diga qual
   você recomenda.
2. **Checando prolongado (>3s)** — hoje idêntico ao anterior. Desenhe o que muda quando demora (não existe copy
   para isso; veja Perguntas em aberto).
3. **Parede "não sei" (repouso)** — "Não foi possível verificar seu plano." + "Tentar novamente". Precisa deixar
   claro, sem ler o texto duas vezes, que **isto não é falta de Premium**.
4. **Parede — botão em foco visível, hover, pressionado e carregando** (o carregando não existe hoje: desenhe).
5. **Parede após retry falhado** — o que muda na segunda tentativa sem virar acusação nem repetir o mesmo bloco.
6. **Re-checagem falhou com Premium ativo (faixa)** — o compositor inteiro visível, funcionando, com o aviso no
   topo. É o estado que separa "sua rede falhou" de "você perdeu o plano".
7. **Premium pausado, sem kit aberto** — "Premium pausado" + o corpo calmo + "Ver meus kits".
8. **Premium pausado, kit reaberto (faixa)** — o banner conviverá com o compositor cheio.
9. **Sem Premium** — o teaser `tf-premium-teaser` com a copy KITS acima. Este estado é a referência de contraste:
   a parede do item 3 **não pode parecer com ele**.
10. **Empilhamento** — faixa de re-checagem + faixa de plano pausado + "Não foi possível atualizar as taxas"
    (com seu próprio botão dentro) no topo da mesma tela. Mostre a hierarquia que resolve isso.

## Viewports
- **390px** — a aba existe no mobile e é onde o vendedor está quando a rede cai. A parede e o spinner precisam
  caber sem rolagem.
- **1280px** — o corte do 018: a partir daqui a página passa a usar a largura da tela.
- **1920px** — obrigatório para os estados 1, 2 e 3, porque é exatamente onde o conteúdo mínimo (um spinner, um
  alerta de uma linha) fica boiando num container de até 1720px. Se a resposta for limitar a largura do bloco de
  estado independentemente da página, mostre esse limite medido.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium.** A parede não pode ter botão de assinar, preço, ou
  qualquer elemento visual emprestado do teaser.
- **Nada de assumir premium por otimismo**: o compositor só aparece com uma resposta do servidor. "Checando" não
  pode mostrar campos que sugiram que já passou.
- **Vocabulário não punitivo**: "expirou", "bloqueado", "suspenso" são proibidos. O plano pausado é calmo, e os
  kits salvos continuam sendo dados do vendedor.
- **A frase honesta vive em elemento de largura total**, nunca em placeholder ou legenda que possa cortar.
- **Alvo de toque ≥44px** para "Tentar novamente" e "Ver meus kits", inclusive quando o botão for secundário.
- **Contraste medido contra o fundo real do alerta**, não contra o fundo da página.
- **O aviso de re-checagem não pode derrubar o trabalho**: o compositor permanece inteiro atrás dele.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport**: a homologação do E6 mediu 100,5px de overflow horizontal num painel de
  plano. Meça a caixa, não confie na aparência.
- **Texto ocluso passa em teste**: um elemento pode estar "visível" para o código e coberto na tela. Layout se
  homologa por geometria.
- **Rolagem no eixo Y invisível em headless**: o 016 perdeu um scroll vertical porque o headless não desenha a
  barra clássica. Se o bloco de estado tiver altura fixa, declare-a.
- **Toast não é lugar de aviso de estado**: no E6 um toast simplesmente nunca renderizou porque o container
  desmontava antes. Um estado de plano precisa estar na página, persistente.
- **Frase cortada por placeholder** (016/PR-F): honestidade não mora em texto auxiliar de campo.
- **Flash de estado errado**: já aconteceu de o painel de "Premium pausado" piscar por cima de uma reabertura
  válida enquanto a lista carregava. O desenho precisa de um estado de espera que não pareça uma resposta.

## Entregável
Pranchetas, no tema escuro (padrão) **e** no tema claro (first-class), reutilizando os primitivos existentes —
nomeadamente `tf-page-header` para o título, `tf-spinner` para a checagem, `tf-alert` (com seus tons) para os
avisos, `tf-btn--secondary` para as ações de retorno, `tf-card`/`tf-empty` para a moldura do bloco de estado e
`tf-premium-teaser` intocado para o ramo free. Não crie primitivo novo; se algum estado exigir uma variação,
descreva-a como variação do primitivo existente.

1. **390px**: checando · checando prolongado · parede (repouso) · parede (botão carregando) · faixa de
   re-checagem sobre o compositor · plano pausado sem kit.
2. **1280px** e **1920px**: os mesmos seis, com atenção ao vazio do container largo.
3. Uma prancheta de **contraste lado a lado**: parede "não sei" × teaser "sem Premium" × faixa "pausado" — a
   distinção que o produto trata como inegociável, provada visualmente.
4. Uma prancheta de **empilhamento** com as três faixas simultâneas e a hierarquia proposta.
5. Onde você mudar a copy, entregue a frase pt-BR proposta ao lado da atual, com a razão em uma linha.

## Perguntas em aberto para o dono
1. Depois de quantos segundos "Verificando seu plano…" deixa de ser aceitável, e o que aparece então? Não existe
   copy de espera longa nem de tempo esgotado no produto hoje.
2. A parede de "não sei" é **tela cheia** (substitui o compositor, como hoje) ou **bloco** dentro de um esqueleto
   do compositor desabilitado? A escolha muda o quanto o vendedor sente que perdeu acesso.
3. "Não foi possível verificar seu plano." deve virar **duas frases distintas** — uma para a parede (sem resposta
   nenhuma) e outra para a faixa (Premium ativo, só não reconfirmado)? Se sim, o dono aprova a copy de cada uma.
4. A parede deve oferecer uma **saída alternativa** além de "Tentar novamente" — por exemplo, um caminho para a
   calculadora de peça única, que é grátis e funciona offline — ou isso confunde com upsell?
5. O tom da parede continua `info` (azul, o mesmo de plano pausado e taxas desatualizadas) ou ganha um tom
   próprio de "atenção"? Hoje três significados diferentes dividem uma cor.

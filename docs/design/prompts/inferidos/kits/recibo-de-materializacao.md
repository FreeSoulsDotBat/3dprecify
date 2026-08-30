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

- **Onde vive:** Dentro da caixa bordada de salvar, logo abaixo do botão "Salvar kit" — o último bloco da tela no mobile, e o fim do último cartão da coluna direita no desktop (uma coluna de 480px que já rola por dentro). Nunca é folha, diálogo nem toast: é conteúdo que nasce inline e empurra o layout.
- **Como o vendedor chega:** Só depois de o servidor confirmar a gravação. O vendedor tocou "Salvar kit", viu o toast "Kit salvo." e, na mesma respirada, o recibo aparece embaixo do botão. Some se ele começar outro kit.
- **Vizinhança imediata:** Título "O que este kit fez no seu catálogo" → uma lista sem teto, uma linha por peça, cada uma dizendo "{nome} — criado no catálogo" ou "{nome} — já existia no catálogo, referenciado" → quando houver ao menos uma referenciada, um alerta informativo: "As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui." → um botão secundário "Ver meus kits". Acima de tudo isso, dentro da mesma caixa: o campo "Nome do kit" e o botão "Salvar kit".
- **Dados que chegam (e o que ela devolve):** A resposta real do servidor ao salvar, que traz uma marcação por posição de peça (criada ou referenciada); os nomes vêm do que o vendedor digitou (ou do placeholder derivado). Nenhum valor é inventado localmente — sem 2xx não há recibo.
- **O que acontece depois:** "Ver meus kits" leva a /catalogo?tab=kits. As peças criadas passam a existir na aba Produtos. A URL já mudou para /kits?id=…, então um segundo "Salvar kit" edita este kit em vez de duplicá-lo.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Recibo "O que este kit fez no seu catálogo"

## O que desenhar
O bloco de confirmação que nasce **dentro do cartão de salvar** do compositor de Kits (`/kits`), logo abaixo
do botão "Salvar kit", e **só depois de um 2xx real do servidor**. Ele é o único lugar do produto em que o
vendedor descobre duas verdades: (1) salvar um kit **escreveu peças novas no catálogo dele**, e (2) numa peça
que já existia no catálogo, **os valores que ele acabou de digitar foram descartados** em favor dos valores do
produto salvo. Quem lê é o vendedor Premium ativo, no segundo exato em que termina de montar o kit — no
celular, ou no desktop com a coluna direita rolando. Origem no código: `apps/web/src/pages/bom/bom-page.tsx`
(cartão de salvar, o último da coluna direita no desktop) + `apps/web/src/pages/bom/bom-page.css`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Nenhum artboard, em nenhuma versão, jamais mostrou um estado
pós-salvamento de kit — no canvas o cartão de salvar termina no botão e na dica, e o protótipo de 2026-07 só
tem o padrão genérico "Toast — feedback efêmero" (§D.2), com §E sem kits. A única autoridade é **textual**:
`ux-bom.md` §1.9 (um esboço ASCII no amendment de 2026-07-12) e **ADR-0017 §3** (a regra de que a referência
vence os valores digitados) — decisão, não desenho. Foi inferido sem desenho: se isto é bloco inline que
empurra o layout, folha, toast expandido ou tela; a hierarquia entre *criado* e *referenciado*; por quanto
tempo permanece; e como fica com 8–10 peças dentro de uma coluna de 480px que já rola sozinha.

## O que já existe hoje (não invente do zero — corrija)
Ordem real dentro do cartão bordado de salvar (borda 1px `--border`, raio de cartão, padding 16, gap 12):

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Field obrigatório | "Nome do kit" · placeholder "Kit suporte + base" | pré-existente |
| 2 | Alert de erro | mensagem honesta do servidor | `tone="danger"`; vira `tone="info"` se Premium pausado |
| 3 | Botão primário | "Salvar kit" / "Salvando…" | desabilitado enquanto salva |
| 4 | Título do recibo | **"O que este kit fez no seu catálogo"** | parágrafo 14px, peso medium, **sem ícone e sem régua** — o esboço do ux tinha um separador, o código não → decidir no desenho |
| 5 | Lista | **"{nome} — criado no catálogo"** · **"{nome} — já existia no catálogo, referenciado"** | lista **sem teto de altura**, gap 4px, 14px em `--text-muted`, **sem marcador e sem nenhuma distinção visual entre criado e referenciado** → a diferença mais importante do bloco está só na palavra |
| 6 | Alert `tone="info"` | **"As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui."** | aparece só quando ao menos uma peça foi referenciada |
| 7 | Botão secundário | **"Ver meus kits"** | navega para `/catalogo?tab=kits` |

→ No mesmo instante do 2xx dispara também um **toast `success` "Kit salvo." (5s)**. São **duas confirmações
simultâneas** que nunca foram desenhadas juntas: o toast pode cobrir o recibo, e no desktop o recibo pode
nascer fora da área visível enquanto o toast é a única coisa que o vendedor vê.
→ O recibo é **apagado no início de cada novo "Salvar"** (o estado volta a nulo antes da requisição): quem
salva de novo vê o recibo sumir — e ele não volta se der erro.
→ O que vem **acima** no mesmo eixo: o resumo do kit (total e preços por canal) e o botão secundário
"Salvar em Orçamentos". O recibo é o **último** conteúdo da coluna.

## Conteúdo e dados reais
- Uma linha por peça do kit, **na ordem das peças**, vinda de `materializations[]`: `position` (inteiro),
  `productId` (uuid — **chega e hoje não é usado na tela**) e `action` ∈ `created` | `referenced`.
- O `{nome}` é o campo "Nome da peça no catálogo" da linha, pré-preenchido **"Peça {n} · {kit}"**. Exemplos
  verdadeiros: `Peça 1 · Kit Suporte + base` · `Base do suporte` · e o caso ruim real
  `Peça 3 · Kit suporte + base para Galaxy S23 Ultra` (48 caracteres numa coluna de 480px).
- Quantidade de linhas: **mínimo 1** (o servidor recusa kit vazio), **sem máximo** — 8–10 peças é plausível.
- Se o `position` não casar com nenhuma linha na tela, o nome sai **vazio**: a linha vira " — criado no
  catálogo". → estado feio real, o desenho precisa não quebrar nele.
- **Não há dinheiro neste bloco.** O preço vive no resumo acima (ex.: total do kit `R$ 1.234,56`). Não invente
  valor aqui — se o desenho quiser lembrar o preço, isso é pergunta para o dono, não decisão sua.

## Estados obrigatórios
1. **Ausente** — antes do primeiro 2xx nada existe; o cartão termina no botão.
2. **Salvando** — botão "Salvando…" desabilitado e o **recibo anterior já apagado**; nada de esqueleto que
   prometa conteúdo que pode não vir.
3. **Sucesso — tudo criado**: só a lista, **sem** o alerta info.
4. **Sucesso — tudo referenciado**: lista + alerta info com a frase do supersede.
5. **Sucesso — misto** (o caso mais comum e o mais difícil): criadas e referenciadas na mesma lista.
6. **Sucesso — lista vazia**: quando `materializations` volta vazio, o bloco **hoje aparece com título, lista
   vazia e o botão** → um recibo que não diz nada. Desenhe o que essa caixa deve ser.
7. **Lista longa** — 9 peças, dentro da coluna que já rola.
8. **Erro de salvamento** — Alert `danger` e **nenhum** recibo: "Salvar faz parte do Premium." ·
   "Você não tem acesso a este recurso." · erro desconhecido.
9. **Offline** — Alert `danger` com **"Criar e editar precisam de conexão."**; falha de rede **nunca** é
   vendida como "não é Premium".
10. **Premium pausado** — banner calmo **"Premium pausado — você pode reabrir e recalcular este kit. Salvar
    precisa do Premium ativo."**, e a recusa de salvar chega em `tone="info"`, não em vermelho.
11. **Foco, hover e pressionado** de "Ver meus kits" (alvo ≥ 44px, foco visível contra o fundo do cartão).

## Viewports
- **390px (obrigatório)** — o cartão está em fluxo único; o resumo do kit é uma **barra fixa no rodapé**, então
  o recibo pode nascer **atrás dela**. Desenhe o recibo com essa barra presente na prancheta.
- **1280px (obrigatório)** — é o corte do 018: coluna direita de **480px**, grudada (`sticky`), com altura
  máxima de uma tela e rolagem própria. O recibo cresce no **fim** dessa coluna: com 9 peças ele nasce abaixo
  da dobra da própria coluna.
- **1920px** — mesma composição, mais respiro; mostre se a lista do recibo ganha duas colunas ou não.

## Regras que o desenho não pode quebrar
- **Só depois do 2xx.** Nada otimista, nada de "salvando com sucesso" antecipado.
- **A frase do supersede (ADR-0017 §3) é texto de primeira classe** — nunca placeholder, nunca tooltip, nunca
  toast efêmero. É a verdade mais surpreendente do fluxo e o vendedor não pode descobri-la reabrindo o kit e
  achando outros números.
- **"criado no catálogo" não pode ficar atrás de um "ver detalhes".** Escrever no catálogo do vendedor é o
  fato, não o detalhe.
- Falha de rede ≠ falta de Premium; recusa por plano pausado é calma, não punitiva.
- Alvo de toque ≥ 44px; contraste do texto muted medido contra o **fundo do cartão**, não contra o fundo da
  página.
- Zero rolagem horizontal a 360px com o nome de peça longo.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport** (E6 PR-B, 100,5px de overflow medidos): aqui o risco é literal — o recibo
  é o último filho de uma coluna que já rola; com 9 peças, "Ver meus kits" pode nascer fora da área visível.
- **Rolagem no eixo Y invisível em headless** (016/PR-B): a coluna de 480px rola sozinha; mostre no desenho
  onde a rolagem começa e o que fica escondido.
- **Texto ocluso passa em teste** (014): o toast "Kit salvo." pode cobrir o topo do recibo e nenhum teste vê.
- **Nome grande estoura a coluna** (E4, o PDF): desenhe a linha com o nome de 48 caracteres, não com "Base".
- **Frase honesta cortada** (016/PR-F): o alerta info tem 108 caracteres — ele precisa de largura total e de
  quebra em 2–3 linhas a 390px, jamais de truncamento com reticências.

## Entregável
Pranchetas, tema **escuro (padrão)** e **claro (first-class)**:
1. 390px — recibo misto com 3 peças, barra de resumo fixa visível;
2. 390px — lista longa com 9 peças + o alerta info;
3. 1280px — a coluna direita inteira (resumo → "Salvar em Orçamentos" → cartão de salvar com o recibo),
   mostrando a rolagem e onde "Ver meus kits" cai;
4. 1280px — a trinca de estados: salvando · erro em `danger` · Premium pausado em `info`;
5. 1280px — o caso de lista vazia;
6. 1920px — a composição final.

Reutilize os primitivos existentes, sem criar novos: a caixa é o **cartão bordado que já existe** (`tf-card` /
borda `--border` + raio de cartão); o aviso do supersede é **`tf-alert--info`** com o ícone que o primitivo já
traz; "Ver meus kits" é **botão secundário `tf-btn`**; se propuser um selo para separar *criado* de
*referenciado*, use **`tf-badge`**; ícones só do conjunto `Icon` já existente. O título é tipografia de bloco,
não um `tf-price`.

## Perguntas em aberto para o dono
1. **Permanência**: hoje o recibo fica na tela até o próximo "Salvar" (ou até a página re-hidratar) e some se o
   vendedor sair. Ele deve reaparecer quando o kit for reaberto depois? Deve poder ser fechado?
2. **Cada peça criada vira link para o produto no catálogo?** O `productId` chega na resposta e não é usado —
   transformar a linha em link é decisão de produto (abre uma saída competindo com "Ver meus kits").
3. **Hierarquia criado × referenciado**: uma lista única (como hoje), dois grupos com títulos, ou selos? A
   escolha muda o que o vendedor entende ser "novo no meu catálogo".
4. **Lista vazia**: mostrar a caixa vazia como hoje, mostrar uma frase ("nenhuma peça nova foi criada") ou não
   mostrar nada?
5. **Toast + recibo ao mesmo tempo**: mantém as duas confirmações, ou o toast some quando o recibo aparece?

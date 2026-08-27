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

- **Onde vive:** Duas superfícies diferentes na mesma aba. (a) Substitui o compositor inteiro em /kits sem ?id= — sob o cabeçalho "Monte seus kits", e nada mais. (b) Uma faixa no topo do compositor em /kits?id=…, entre a faixa de plano desatualizado e a faixa de falha de tarifas, com o compositor completo abaixo dela.
- **Como o vendedor chega:** O pagamento falhou ou a assinatura caducou. (a) é o que ele encontra ao tocar "Kits" pretendendo montar um kit novo; (b) é o que ele encontra ao abrir um kit salvo pela lista do Catálogo — o momento de maior risco de ele achar que perdeu os dados.
- **Vizinhança imediata:** (a) Um alerta de tom informativo (calmo, não vermelho) titulado "Premium pausado", com o corpo dizendo que os kits salvos continuam ali e podem ser reabertos e recalculados, e que criar ou editar pede a reativação; abaixo dele, um único botão secundário "Ver meus kits". Não há CTA de reativação nesta tela. (b) A faixa informativa no topo, e mais abaixo, na caixa de salvar, o botão "Salvar kit" VISÍVEL e clicável — a recusa vem depois do toque, como um alerta de tom informativo dentro da própria caixa, nunca vermelho. E o botão "Salvar em Orçamentos" simplesmente NÃO EXISTE nesse estado (não é desabilitado: não é renderizado).
- **Dados que chegam (e o que ela devolve):** O entitlement do servidor com estado "pausado". A lista de kits salvos continua carregando normalmente (os dados são do vendedor, não uma vista alugada). O cálculo continua rodando inteiro no aparelho.
- **O que acontece depois:** "Ver meus kits" leva a /catalogo?tab=kits, onde as linhas ganham a marca "somente leitura". Reabrir um kit de lá cai na superfície (b). O caminho de volta ao Premium não existe nesta tela — vive na aba Conta.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Premium pausado em Kits — o painel de reativação e a faixa do kit reaberto

## O que desenhar
Duas superfícies irmãs da aba **Kits** (`/kits`) que só aparecem quando o vendedor tem Premium **pausado** (o
servidor respondeu `status = "lapsed"` — ele já foi assinante, o pagamento falhou ou a assinatura terminou, e
os kits dele continuam salvos). (a) **O painel de reativação**: quem entra em Kits para CRIAR um kit novo não
recebe compositor nenhum — recebe uma tela curta explicando que criar/editar precisa do Premium ativo. (b) **A
faixa do kit reaberto**: quem abre um kit salvo (`/kits?id=…`) recebe o compositor INTEIRO, funcionando —
recalcula, troca quantidade, vê preço por canal — com uma faixa no topo dizendo que salvar é o que está
pausado, e com o botão "Salvar kit" **visível e habilitado**, que responde honestamente quando tocado. É o
momento de maior medo do produto: o assinante que falhou o pagamento precisa ver, em menos de dois segundos,
que **nada foi apagado**.

## Por que este prompt existe
Nada disso foi desenhado. O `.dc.html` do canvas não conhece as palavras "pausado" nem "lapsed": a fronteira
desenhada é **binária** (`isPremium` / `isFree`), e o briefing de 2026-07 §J a fixa assim ("Entitlement
binário: sem quota/contador"). A §E7 (Conta, "plano atual Free/Premium") e a §E8 (upsell) não têm estado de
lapso; a matriz da §G também não. A auditoria de protótipo de 2026-07-02 não toca no assunto. A única
autoridade é **textual** — `ux-bom.md` §3 e FR-409/Q3 —, ou seja: requisito, nunca desenho. O resultado é que
as duas superfícies foram montadas com `Alert` de propósito geral, e **o caminho de volta ao Premium não
existe em nenhuma das duas**. Pior: o próprio `ux-bom.md` §3 desenha, no ASCII, o painel de lapso com **a
lista dos kits salvos logo abaixo do aviso** ("… saved BOM rows … (open → read + re-price)") — o código não
mostra lista nenhuma, só um botão que leva embora.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` + `apps/web/src/shared/i18n/messages.pt-br.ts`.

**(a) Painel de reativação** (lapsed, sem `?id=`) — a tela inteira é isto, nesta ordem:

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho da página | "Monte seus kits" (sem subtítulo — o subtítulo some neste ramo) |
| `Alert tone="info"`, com título | Título: "Premium pausado" |
| Corpo do Alert | "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium." |
| Botão secundário | "Ver meus kits" → leva a `/catalogo?tab=kits` |

→ **Problema 1: não há CTA de reativação.** A única ação é ir embora. O destino de reativação **já existe no
app** (`/conta?assinar=1`, a oferta em folha dentro da Conta) e é usado por todos os teasers.
→ **Problema 2: o Catálogo tem copy de reativação e Kits não.** Filamento, impressora e produto já mostram um
`Alert tone="info"` com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e
editar. Seus itens estão salvos."** Kits ficou sem esse par.
→ **Problema 3: a página cabe num cartão e ocupa uma tela de 1720px.** Desde o 018 a largura máxima de `/kits`
no desktop é 1720px; esse ramo renderiza um aviso e um botão nesse vão. Parece quebrado.
→ **Problema 4: o vendedor não vê nenhum kit.** Ele é informado de que "seus kits continuam aqui" e não vê
nenhum. A frase pede prova; o §3 do `ux-bom.md` já previa a lista ali.

**(b) Kit reaberto** (lapsed, com `?id=`) — o compositor completo, mais:

| Elemento | Conteúdo literal hoje |
|---|---|
| Faixa no topo, `Alert tone="info"` sem título | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." |
| Bloco de salvar (coluna direita no desktop, fim da página no mobile) | Campo "Nome do kit" (obrigatório, placeholder "Kit suporte + base") + botão primário "Salvar kit" |
| Recusa, após tocar em Salvar | `Alert` de tom **`info`** (decisão explícita, não `danger`) com a frase do servidor: "Salvar faz parte do Premium." |

→ **Problema 5: um botão primário cheio que existe para recusar.** A decisão de NÃO desabilitar é consciente e
está certa (um botão desabilitado não explica nada), mas hoje ele é visualmente idêntico ao "Salvar kit" de
quem tem Premium ativo. Nada antecipa a recusa; o vendedor descobre depois de digitar o nome.
→ **Problema 6: a recusa aparece longe do topo.** No mobile, faixa e recusa ficam a uma rolagem inteira de
distância, dizendo a mesma coisa com palavras diferentes.
→ Enquanto isso, o irmão **Simulações** resolve o mesmo caso com uma legenda junto às ações:
"Premium pausado — reative para renomear, duplicar, editar ou excluir." Três telas, três formas. Unifique.

## Conteúdo e dados reais
- O estado vem do servidor (`GET /api/v1/entitlement` → `"none" | "active" | "lapsed"`). **Só "lapsed" abre
  estas superfícies**; "none" recebe o teaser de venda ("Monte e precifique kits com várias peças"), que aqui
  seria mentira — o vendedor já teve o recurso.
- Kits salvos permanecem legíveis por contrato (FR-409). Reabrir e **recalcular funcionam**: o preço é
  recomputado no aparelho, não lido de um registro. Exemplo real de um kit reaberto em lapso: "Total do kit"
  R$ 24,24 no varejo e R$ 16,16 no atacado, com o rodapé "Varejo" / "Atacado".
- Sem preço, sem data de cobrança, sem contador de dias restantes em nenhuma das duas superfícies (a oferta
  com valores mora na Conta). Nada de "expirou", "bloqueado", "suspenso" — palavras banidas por FR-014.
- O destino de reativação existente: a oferta dentro da Conta (`/conta?assinar=1`). A saída existente para os
  kits salvos: a aba Kits do Catálogo (`/catalogo?tab=kits`).
- No compositor reaberto, "Nome do kit" continua obrigatório e o botão continua fazendo a validação local
  antes da recusa do servidor — ou seja, é possível receber primeiro "Dê um nome ao kit para salvar." e só
  depois "Salvar faz parte do Premium.". Desenhe a ordem que evita esse duplo tropeço.

## Estados obrigatórios
1. **Verificando o plano** — enquanto a resposta do servidor não chega: spinner + "Verificando seu plano…".
   Nunca piscar o painel de pausado antes de saber (defeito já pago: o painel de reativação piscou por cima de
   um kit válido em reabertura).
2. **Painel de reativação (repouso)** — o caso (a) acima.
3. **Kit reaberto com faixa (repouso)** — o caso (b): compositor completo, faixa no topo.
4. **Salvar: repouso · foco · hover · pressionado** — o botão que vai recusar, nos quatro. Alvo ≥44px.
5. **Salvar: carregando** — o rótulo vira "Salvando…" e o botão fica desabilitado durante a chamada. Sim, a
   recusa também passa por esse estado; é honesto (a decisão é do servidor).
6. **Salvar: recusado por lapso** — "Salvar faz parte do Premium." em tom `info`, jamais vermelho.
7. **Salvar: recusado por falta de conexão** — "Criar e editar precisam de conexão." Precisa ser **visivelmente
   diferente** do caso 6: falha de rede nunca pode ser lida como perda de Premium, e vice-versa.
8. **Plano não verificável** — a leitura do plano falhou e não há resposta anterior: "Não foi possível
   verificar seu plano." + botão "Tentar novamente". Isto **não é** premium pausado e não pode se parecer.
9. **Sem nenhum kit salvo, em lapso** — a frase "Seus kits salvos continuam aqui" fica falsa. Diga o que há.
10. **Foco de teclado visível** em todos os botões e no campo de nome, no tema escuro e no claro.

## Viewports
- **Mobile 390px** — é a viewport principal do produto e onde a faixa, o compositor e o bloco de salvar ficam
  mais distantes um do outro. Desenhe as duas superfícies aqui.
- **Desktop 1280px** — o corte em que Kits vira duas colunas (peças à esquerda, resumo/salvar numa coluna de
  480px fixada à direita). A faixa de lapso atravessa as duas colunas; o botão que recusa vive na coluna
  direita, fixada — pense na relação entre a faixa lá em cima e a recusa lá na direita.
- **Desktop 1920px** — porque o painel de reativação (a) tem 1720px de largura útil e hoje mostra um aviso
  solitário. É a viewport em que o problema 3 é visível; desenhe a resposta.

## Regras que o desenho não pode quebrar
- **Freemium binário, com uma exceção nomeada**: quem nunca teve Premium recebe o teaser de venda; quem TEVE
  recebe estas superfícies. Nunca venda a um assinante pausado o recurso que ele já usou.
- **Calmo, nunca punitivo.** Tom `info`, jamais `danger`/vermelho, jamais linguagem de bloqueio.
- **Nada foi apagado** precisa ser a primeira coisa legível, não a terceira linha.
- **O botão que vai recusar continua visível e tocável** — a decisão de não desabilitar é do produto. Mas a
  recusa não pode ser surpresa: o desenho tem que antecipá-la sem apagar o botão.
- **Falha de rede nunca vendida como "não é premium"**, e falha de leitura do plano nunca vendida como lapso.
- **A frase honesta vive em elemento de largura cheia**, nunca em placeholder ou sufixo de campo (já cortou).
- Contraste medido contra o fundo real do `Alert` (que tem fundo próprio), não contra o fundo da página.
- Alvo de toque ≥44px em "Salvar kit", "Ver meus kits" e no CTA de reativação que você propuser.

## Armadilhas já pagas neste projeto
- **Estouro horizontal medido.** Uma superfície de cobrança já nasceu com 100,5px de estouro e um botão fora da
  viewport. Meça caixas, não confie em "parece caber": "Premium pausado — você pode reabrir e recalcular este
  kit. Salvar precisa do Premium ativo." é longa a 390px.
- **Texto ocluso passa em teste.** Um elemento coberto continua "visível" para asserção de texto — só o
  desenho e a geometria pegam. Vale para a faixa sob a coluna fixada do desktop.
- **Nome longo estoura a coluna.** Desenhe com um nome de kit adversarial: "Kit suporte de bancada + base
  reforçada + tampa (revisão 3)".
- **Piscada de estado.** O painel de reativação já apareceu por cima de um kit em carregamento. Estado que vai
  mudar não se desenha como se já tivesse mudado — daí a prancheta 1.
- **Divergência entre telas irmãs.** Catálogo, Kits, Orçamentos e Simulações escreveram quatro variações do
  mesmo lapso. O que você desenhar aqui deve ser reaproveitável nas outras três.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Painel de reativação — 390px, 1280px e 1920px (a mesma peça nas três larguras).
2. Kit reaberto com a faixa — 390px e 1280px, com o compositor real ao redor (duas ou três peças).
3. Tira de estados do bloco de salvar: repouso · foco · hover · pressionado · carregando · recusado por lapso ·
   recusado por falta de conexão.
4. Os estados de borda: verificando o plano, plano não verificável, lapso sem nenhum kit salvo.

Reutilize os primitivos existentes, sem criar novos: `tf-alert--info` para a faixa e para o painel (com
`tf-alert__title` quando houver título), `tf-btn` primário para "Salvar kit", `tf-btn` secundário para "Ver
meus kits" e para o CTA de reativação, `tf-card` como moldura do bloco de salvar, `tf-field` + `tf-input` para
"Nome do kit", `tf-badge` se propuser um selo de estado do plano, `tf-empty-state` para o lapso sem kits e
`tf-spinner` para a verificação. Se a peça pedir algo que nenhum primitivo resolve, diga qual e por quê — não
desenhe um componente novo em silêncio.

## Perguntas em aberto para o dono
1. O painel de reativação deve **listar os kits salvos** ali mesmo (como o `ux-bom.md` §3 desenhou) ou continuar
   apenas apontando para a aba Kits do Catálogo? Muda a peça de um aviso para uma tela.
2. O CTA de reativação leva à **oferta da Conta** (`/conta?assinar=1`, o que os teasers já fazem) ou o dono
   quer um caminho próprio para quem está pausado (que é reativação, não primeira compra)?
3. **Antecipar a recusa no botão** — trocar o rótulo "Salvar kit", acrescentar legenda ao lado, ou manter o
   botão idêntico ao do premium ativo e deixar a antecipação por conta da faixa? É decisão de produto, e as
   três mudam a leitura do risco.
4. O painel de reativação deve repetir a copy do Catálogo ("Reative o Premium" / "Reative o Premium para voltar
   a criar e editar. Seus itens estão salvos.") para haver **uma só voz de lapso** no app, ou a copy de Kits
   ("Seus kits salvos continuam aqui…") fica por ser mais específica?

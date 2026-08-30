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

- **Onde vive:** O corpo inteiro da tela /kits quando não há nenhuma peça — ele substitui a grade de duas colunas do desktop e toda a pilha do mobile. Fica logo abaixo do cabeçalho "Monte seus kits" e das faixas de aviso, se houver.
- **Como o vendedor chega:** É a porta de entrada da aba: quem toca "Kits" na barra de abas e ainda não começou nada cai aqui. Quem acabou de assinar o Premium também. E quem estava editando um kit salvo e volta pela aba (URL sem ?id=) tem a tela limpa e cai aqui de novo.
- **Vizinhança imediata:** Um bloco centralizado com ícone de caixa/pacote (o mesmo ícone que o Catálogo usa — não existe glifo próprio de "kit" no conjunto), título "Monte seu kit peça por peça", corpo "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro." e DOIS botões empilhados e centralizados: "Adicionar peça" (primário) e "Ver meus kits" (fantasma, menor). Não há resumo, nem barra de total, nem cartão de canais — a tela está literalmente vazia fora disso.
- **Dados que chegam (e o que ela devolve):** Nenhum dado externo: é o ramo "zero peças" do compositor. O botão secundário só faz sentido porque existe uma lista de kits salvos em outra aba.
- **O que acontece depois:** "Adicionar peça" cria a primeira peça JÁ EXPANDIDA e troca este vazio pela composição completa (lista + resumo + caixa de salvar). "Ver meus kits" leva a /catalogo?tab=kits.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Estado vazio do compositor de kits (/kits, antes da primeira peça)

## O que desenhar
A primeira tela que o vendedor vê na aba **Kits** depois que o servidor confirmou Premium ativo e antes de existir
qualquer peça no compositor. É a porta de entrada da funcionalidade mais cara do produto: quem chega aqui ou acabou
de assinar (veio do teaser de Kits), ou clicou na aba **Kits** do menu vindo de outra tela, ou removeu a última peça
de um kit que estava montando. Ela vive dentro da mesma `<section>` da página `/kits`, logo abaixo do cabeçalho
"Monte seus kits", e some no instante em que a primeira peça entra — dando lugar ao compositor de duas colunas
(lista de peças à esquerda, resumo e salvar à direita, acima de 1280px).

## Por que este prompt existe
Nada disto foi desenhado. O canvas do 018 tem exatamente dois ramos no bloco Kits — `isFree` (o teaser de assinatura)
e `isPremium` (três peças já populadas) — e **nenhum ramo vazio**; o protótipo de 2026-07-02 desenha empty-states de
Catálogo (§E5, "educativo" + semente) e de Histórico (§E6, gated para free), mas §E **não lista a aba Kits**. A única
autoridade é textual: `ux-bom.md` §1.8, e o §6.1 item 7 classificou o vazio como *Low / DS-ready* — pedido, não
desenho. O que está no ar hoje é copy escrita por IA mais um *nit* de review de 2026-07-12 (o segundo botão), com um
ícone assumidamente emprestado: `package`, o **mesmo glifo do Catálogo**, porque a própria `ux-bom` §6.2-G3 registra
que não existe ícone de montagem no conjunto.
E há uma contradição explícita com o desenho do 018: no canvas desktop, "Ver meus kits" e "Adicionar peça" são ações
do **cabeçalho da página**, à direita do título — no código o cabeçalho não tem ações, e esses dois botões existem só
dentro do vazio, empilhados e centralizados. Ninguém desenhou como as duas coisas convivem.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` (ramo `lines.length === 0`), primitivo `EmptyState`
(`shared/ui/empty-state.tsx`), textos em `shared/i18n/messages.pt-br.ts` → `messages.bom`.

| Parte | Texto/valor literal hoje | Observação |
|---|---|---|
| Título da página (acima, sempre visível) | "Monte seus kits" | `h1`, recebe foco na navegação |
| Descrição da página | "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas" | |
| Ícone do vazio | glifo `package` em quadrado 56×56, raio `--radius-lg`, fundo `--accent-soft`, glifo 28px | → **emprestado do Catálogo** |
| Título do vazio | "Monte seu kit peça por peça" | `h2`, `--fs-lg` |
| Corpo do vazio | "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro." | `--fs-body-sm`, `--text-muted` |
| Botão primário | "Adicionar peça" (com glifo `plus` 16px à esquerda) | cria a Peça 1, quantidade "1", já expandida |
| Botão secundário | "Ver meus kits" — variante *ghost*, tamanho *sm* | navega para `/catalogo?tab=kits` |
| Caixa | coluna centralizada, `max-width: 28rem` (448px), `padding: 40px 20px`, `gap` de 12px | idêntica em qualquer largura |

Problemas que o desenho precisa resolver:

- → **A mesma frase três vezes na mesma jornada.** O teaser de Kits diz "Some peças avulsas ou produtos do seu
  catálogo, com quantidade, e veja o preço do kit inteiro, **por canal**."; o vazio repete a frase sem o "por canal";
  e a descrição da página diz o mesmo com outras palavras, dois centímetros acima. Quem pagou lê o argumento de venda
  outra vez, no lugar de aprender a usar.
- → **O vazio esconde o destino.** Nome do kit, botão "Salvar kit", "Total do kit", "Preços por canal (kit)" e o
  botão de gravar orçamento vivem TODOS dentro do ramo com peças — no vazio a coluna direita simplesmente não existe.
  O vendedor não vê onde o preço vai aparecer nem que o kit vai precisar de nome.
- → **Desktop desenhado por omissão.** A página chega a 1720px de largura útil acima de 1280px; a caixa de 448px fica
  centrada num vazio enorme, e a estrutura de duas colunas (`1fr` + 480px fixos) aparece de supetão na primeira peça.
- → **Dois vazios idênticos.** Catálogo → Produtos usa `EmptyState` com o MESMO `package`; `boxes` já é de Simulações.
  Kits e Catálogo são telas irmãs e hoje têm exatamente a mesma cara.
- → **A porta para os kits salvos é o controle mais fraco da tela** (ghost, sm) e é a única daqui. Pior: o vazio
  ignora que o vendedor pode ter 12 kits salvos — a página já carrega essa lista e não usa o número.

## Conteúdo e dados reais
- Dados verdadeiros disponíveis nesta tela e hoje não usados: **quantidade de kits salvos** (rótulo do canvas:
  "3 kit(s)") e o último kit salvo, no formato do canvas: **"Kit suporte + base · 3 peça(s) · custo R$ 52,34 ·
  varejo R$ 157,02"**. Também já está carregada a lista de produtos do catálogo, que alimenta o seletor
  "Usar produto salvo" de cada peça.
- Ao tocar "Adicionar peça": nasce a "Peça 1", **Quantidade** = `1` (inteiro ≥ 0, unidade "un"), campos vazios, já
  expandida para edição. Nenhum preço existe até a peça ficar válida — e a copy honesta para isso já está escrita:
  "Sem preço ainda" / "O preço do kit aparece assim que ao menos uma peça estiver completa e válida."
- O nome do kit é obrigatório para salvar (rótulo "Nome do kit", placeholder "Kit suporte + base", erro "Dê um nome
  ao kit para salvar."). Se o desenho quiser antecipar esse campo no vazio, é este.
- Nenhum valor em dinheiro é exibido no vazio hoje. Se o desenho introduzir um exemplo ilustrativo, ele **precisa**
  estar rotulado como exemplo — este produto não mostra número sem procedência.

## Estados obrigatórios
1. **Vazio, sem kits salvos** — o primeiro contato real (recém-assinante). Ensina o que é uma "peça" e o que é um
   "kit".
2. **Vazio, COM kits salvos** — hoje idêntico ao anterior; o desenho precisa diferenciar (quantos kits existem e um
   caminho forte até eles). Rótulo já homologado para essa porta: "Ver meus kits".
3. **Vazio por remoção da última peça** — o vendedor tinha trabalho na tela e ficou sem nada, sem desfazer. Diga se é
   a mesma prancheta ou se merece tratamento próprio.
4. **Vazio + aviso de taxas desatualizadas** (convive, acima): `Alert` informativo, título "Não foi possível
   atualizar as taxas", corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também
   pode informar as taxas manualmente.", botão "Tentar novamente".
5. **Vazio + revalidação de plano falhou, mas o Premium está ativo** (convive, acima): `Alert` informativo com
   "Não foi possível verificar seu plano." — e o compositor continua inteiro, nada bloqueado.
6. **Verificando o plano** (antecede o vazio): spinner + "Verificando seu plano…".
7. **Sem resposta nenhuma do servidor sobre o plano** (no lugar do vazio): "Não foi possível verificar seu plano." +
   botão "Tentar novamente".
8. **Premium pausado, criando um kit novo** (no lugar do vazio — é a peça irmã e vale uma prancheta): `Alert`
   informativo "Premium pausado" + "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar
   ou editar, reative o Premium." + botão secundário "Ver meus kits".
9. **Free ou deslogado** (antecede, não é esta peça): o teaser de assinatura. Está aqui só para você saber de onde o
   vendedor vem e não repetir o argumento de venda depois da compra.
10. **Botões**: repouso, foco visível por teclado, hover, pressionado. "Adicionar peça" nunca fica desabilitado aqui.

## Viewports
- **390px (mobile)** — obrigatório: é onde a maior parte dos vendedores usa o app, e a caixa de 448px já é mais larga
  que a tela. Desenhe com a navegação inferior ocupando o rodapé.
- **1280px (o corte do 018)** — obrigatório: é o primeiro pixel em que a página vira duas colunas (`1fr` + 480px) e
  em que o menu lateral de 240px come largura. O vazio precisa dizer o que vem depois.
- **1920px** — obrigatório: a página chega a 1720px úteis. Mostre onde a caixa de 448px mora nesse vazio, ou proponha
  outra composição para ele.

## Regras que o desenho não pode quebrar
- **Freemium binário**: quem vê esta tela JÁ é Premium ativo. Nada de "assine", "desbloqueie", coroa ou upsell aqui.
- **Falha de rede nunca é vendida como "não é premium"**: os avisos dos itens 4 e 5 são informativos e não bloqueiam.
- **"Pausado" nunca é punição**: "expirou", "bloqueado" e "suspenso" são palavras proibidas no produto.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega exemplo, não explicação (o produto já pagou
  esse erro: a frase foi cortada na largura do campo).
- **Nenhum número sem procedência**: se aparecer dinheiro, ou é do vendedor, ou está rotulado como exemplo.
- **Alvo de toque ≥ 44×44px**, inclusive no botão *ghost sm* — hoje ele é o menor controle da tela.
- **Contraste medido contra o fundo real**: o quadrado do ícone usa `--accent-soft` com glifo `--accent-text`, e o
  corpo usa `--text-muted` sobre o fundo da página — nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido, não estimado**: a homologação do 018 achou 131px de transbordo culpando a *página inteira*, e
  o item-9 do 016 era rolagem no eixo **vertical**, que headless não enxerga. Uma caixa centralizada de 448px numa
  tela de 390px é exatamente a geometria que produz isso.
- **Ícone emprestado passa em qualquer teste**: nenhuma asserção distingue o `package` de Kits do `package` do
  Catálogo. Se o glifo certo não existe no conjunto, dizer isso é a resposta — o 018 abriu esse precedente ao
  acrescentar a lupa porque "sem lupa no conjunto, a imagem mostrou na hora o que nenhuma asserção mostrou".
- **Botão nascido fora da viewport**: já aconteceu aqui (100,5px de transbordo, botão fora da tela). Dois botões
  empilhados dentro de caixa centrada é a mesma família de risco no mobile.
- **Texto ocluído passa em `toBeVisible`**: layout se verifica com caixas, não com asserção de texto.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como cidadão de primeira classe**:
1. Vazio sem kits salvos — 390px · 1280px · 1920px.
2. Vazio com kits salvos (a variante que hoje não existe) — 390px · 1280px.
3. Vazio + aviso de taxas desatualizadas — 390px (o caso mais apertado).
4. Premium pausado no caminho de criação — 390px · 1280px.
5. Estados dos dois botões (repouso/foco/hover/pressionado) em uma prancheta pequena.

Reutilize os primitivos existentes, sem inventar novos: `EmptyState` (quadrado de ícone + `h2` + parágrafo + área de
ação), `Button` primário com o glifo `plus` para "Adicionar peça", `Button` secundário para "Ver meus kits" (proponha
subir de *ghost/sm* para *secondary*, se concordar), `Alert` informativo para os avisos, `PageHeader` para título e
descrição, e `Card` caso o vazio ganhe um esqueleto do resumo à direita. Se o desenho precisar de um glifo de
"montagem/kit" que o conjunto não tem, **desenhe-o e nomeie-o** em vez de reusar `package` mais uma vez.

## Perguntas em aberto para o dono
1. A aba Kits deve abrir **vazia** (como hoje) ou já com a **Peça 1 aberta** para preencher? O código sabe fazer as
   duas; ninguém decidiu qual ensina melhor.
2. Neste mesmo vazio, **criar** e **consultar** disputam a atenção. "Ver meus kits" deve virar um caminho forte
   (lista dos kits salvos ali mesmo, com contagem) ou continuar um link discreto?
3. As ações "Adicionar peça" e "Ver meus kits" ficam **no cabeçalho da página** no desktop, como o canvas do 018
   desenhou e o código não implementou, ou permanecem só dentro do vazio? Nos dois lugares, o vazio passa a ter
   botões duplicados na mesma tela.
4. O texto do vazio deve **repetir** a promessa do teaser ou passar a ensinar a mecânica (peça avulsa × produto do
   catálogo × quantidade)? Trocar a copy significa mexer numa frase já homologada.
5. Vale um glifo próprio de "kit/montagem" no conjunto de ícones, ou o `package` compartilhado com o Catálogo está
   aceito conscientemente?

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

- **Onde vive:** Dentro do cartão da peça, imediatamente abaixo dos parágrafos de aviso — o cartão cresce e empurra as peças seguintes para baixo. Não é folha nem diálogo: é conteúdo inline, e no desktop ele cresce dentro da coluna esquerda enquanto a coluna direita do resumo permanece parada.
- **Como o vendedor chega:** Tocando o cabeçalho da peça (chevron/"Editar esta peça"), ou automaticamente quando o vendedor acabou de tocar "Adicionar peça". Abrir uma peça recolhe a anterior.
- **Vizinhança imediata:** De cima para baixo, aninhado três níveis (cartão da peça › cartão de seção › campos): cartão do seletor "Usar produto salvo" (só quando existem produtos salvos) → título "Custos da peça" com cartão de campos obrigatórios em grade + tempo de impressão em horas e minutos + o bloco da pergunta de custo de máquina → grupo "Markup" → um único botão de divulgação cujo rótulo é a concatenação de três títulos, "Mão de obra · Outros custos · Marketplace", que quando aberto revela os custos opcionais, mão de obra, outros custos e a seção inteira de marketplace com seus cartões de canal → e, no fim, o bloco de resultado DAQUELA peça (ou um alerta vermelho "não dá para calcular"). Depois dele ainda pode vir o campo "Nome da peça no catálogo". É literalmente o corpo da calculadora hospedado dentro de uma linha.
- **Dados que chegam (e o que ela devolve):** Recebe os valores atuais da peça, a lista de produtos salvos e o id vinculado. Usa o catálogo de tarifas para pré-preencher e validar cada canal. A cada tecla, os valores sobem para a página, que recalcula a peça e o kit inteiro pelo pricing-core.
- **O que acontece depois:** Cada mudança repercute imediatamente na linha de dinheiro do cartão recolhido, no "Total do kit" e nos "Preços por canal (kit)". Recolher a peça não perde nada: os valores continuam vivos na página. Uma peça inválida some do total e ganha a legenda de exclusão.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Editor da peça, aberto dentro da linha do kit

## O que desenhar
A gaveta que se abre DENTRO do card de uma peça, na aba **Kits** (`/bom`, "Monte seus kits"), quando o
vendedor toca em **"Editar esta peça"**. Ela não é um resumo: é a calculadora inteira — os mesmos campos,
as mesmas seções e o mesmo motor da tela *Calcular* — hospedada dentro de uma linha de uma lista que pode
ter 3, 5 ou 10 peças. Quem usa é o vendedor montando um anúncio de kit e digitando, peça por peça, o custo
de cada uma; ele entra aqui várias vezes na mesma sessão, alternando entre peças. Só uma peça fica aberta
por vez (abrir a segunda fecha a primeira). Precisamos das pranchetas do card ABERTO — o card fechado já
tem desenho, o que ele abre nunca teve.

## Por que este prompt existe
Nada disto foi desenhado. O protótipo de 2026-07-02 cobre a calculadora **como tela solta** (§E4) e não
serve nem de versão anterior: lá a divulgação progressiva são QUATRO seções coláveis nomeadas
(Energia · Máquina/Depreciação · Falha · Marketplace) com a regra "1 aberta + 1 fechada, nunca tudo aberto";
o que está no ar é UMA divulgação única cujo rótulo nasceu de um `join(" · ")` de três títulos de seção que
já existiam — para não escrever copy nova — e os campos obrigatórios sempre visíveis. O desenho de desktop
de 2026-08 (`Abas-Desktop.dc.html`, linha 198) desenha o card fechado e o botão "Editar esta peça", e para
ali: percorrendo as 646 linhas não há nenhum quadro do estado aberto. A autoridade textual (`ux-bom.md`
§1.3/§1.4 e §6.1 item 2) pedia este protótipo exatamente para *"confirm the secondary disclosure keeps the
line short"*, marcado **High** — e ele nunca foi produzido. Ou seja: a única regra de desenho escrita sobre
esta peça é "mantenha a linha curta", e ninguém mediu se ela foi cumprida.

## O que já existe hoje (não invente do zero — corrija)
Ordem exata do que aparece dentro do card aberto, de cima para baixo:

| # | Bloco | Conteúdo real |
|---|---|---|
| 1 | Card do seletor de produto | Rótulo "Usar produto salvo", um select cujo primeiro item é "— Manual —"; abaixo, quando há produto ligado, a legenda "do catálogo: {nome}" ou "do catálogo: {nome} · ajustado por você" |
| 2 | Título de seção | "Custos da peça" + ⓘ ("Sobre os custos da peça") |
| 3 | Card com grade de campos obrigatórios | 5 campos em `tf-costs-grid` (colunas de no mínimo 170px) |
| 4 | Tempo de impressão | Dois campos lado a lado: horas ("h") e minutos ("min") |
| 5 | Pergunta de custo de máquina | "Valor da máquina" + dois selects: "Com que frequência ela roda?" e "Em quantos anos quer que ela se pague?", com a legenda derivada "≈ R$ 0,83 por hora de impressão" e o link "Ajustar horas direto" |
| 6 | Seção Markup | "Markup" + ⓘ, dois campos ("Markup varejo", "Markup atacado") |
| 7 | **O botão de divulgação** | Uma linha de texto secundário com chevron e o rótulo **"Mão de obra · Outros custos · Marketplace"** |
| 8 | (quando aberto) | Card com "Reserva de manutenção" e "Taxa de falha" — **sem título nenhum** · seção "Mão de obra e custos" (4 campos) · seção "Outros custos" (lista 0..N, "Adicionar custo") · seção "Marketplace" com o interruptor "Incluir marketplaces no preço" e os canais |
| 9 | Resultado da peça | "Como chegamos no preço" + card de detalhamento (Material · Energia · Máquina · Falha / perdas · Acabamento · Mão de obra · cada "outro custo" · **Custo total** · **Preço varejo** · Preço atacado) — ou, se algo estiver inválido, um alerta de perigo com "Confira os campos destacados para ver o preço." |
| 10 | (depois do editor, ainda no card) | O campo "Nome da peça no catálogo" quando a peça vai virar item do catálogo, precedido de "Você ajustou esta peça — ela será salva como uma peça nova no catálogo." |

→ **O rótulo do item 7 é o problema central deste prompt.** "Mão de obra · Outros custos · Marketplace"
não é um nome, é uma lista de três nomes; e ele mente por omissão, porque também esconde "Reserva de
manutenção" e "Taxa de falha", que não aparecem no rótulo. Desenhe a alternativa (veja as perguntas ao
dono).
→ **Profundidade**: hoje é Card (a linha) → Card (o seletor) / Card (custos) / Card (markup) / Card
(detalhamento). Quatro molduras aninhadas, todas com a mesma borda e o mesmo fundo. Precisa de hierarquia
visual — não de mais bordas.
→ **Altura**: com a divulgação aberta e dois canais, este bloco passa de duas telas de 390px. Nada segura
o topo: ao rolar, o vendedor perde de vista de qual peça se trata.
→ **O resultado da peça não se distingue do total do kit**: os dois usam "Custo total" e "Preço varejo",
com a mesma tipografia, na mesma tela.
→ **Os canais de marketplace são preenchidos aqui e não devolvem preço aqui**: o bloco "Preços por canal"
não é renderizado dentro da linha (só o rollup do kit, na coluna da direita, mostra "Preços por canal
(kit)"). O vendedor digita comissão, taxa fixa e frete de um canal e não vê o anúncio daquela peça em
lugar nenhum.

## Conteúdo e dados reais
Campos obrigatórios sempre visíveis (item 3), com unidade e exemplo verdadeiro:
"Custo do rolo" `R$ 120,00` · "Peso do rolo" `1` kg · "Gramas usadas" `45` g · "Consumo médio" `0,12` kW
(dica sob o campo: "Consumo médio real da impressora, não a potência de placa (~0,12 kW).") ·
"Tarifa de energia" `R$ 0,85` /kWh. Cada um tem um ⓘ no fim da linha do RÓTULO — nunca dentro da linha do
input (a dica competindo com o sufixo "/kWh" já espremeu "Tarifa de energia" a 1px de campo visível).
Tempo: "Tempo de impressão" = `3` h + `40` min. Máquina: "Valor da máquina" `R$ 2.500,00`.
Markup: "Markup varejo" `100` % (dica "Margem sobre o custo total (não sobre o preço de venda).") e
"Markup atacado" `60` %. Opcionais escondidos: "Reserva de manutenção" `R$ 0,50` /h · "Taxa de falha" `8` %
· "Tempo de acabamento" `0,25` h · "Valor do acabamento" `R$ 20,00` /h · "Mão de obra (horas)" `0,33` h ·
"Valor da hora" `R$ 18,75` /h. "Outros custos": itens nomeados, placeholder "Ex.: Embalagem", valor
`R$ 3,50`. Resultado de exemplo de uma peça: Material `R$ 5,40` · Energia `R$ 0,37` · Máquina `R$ 3,04` ·
Falha / perdas `R$ 0,71` · Acabamento `R$ 5,00` · Mão de obra `R$ 6,19` · **Custo total `R$ 24,21`** ·
**Preço varejo `R$ 48,42`** (legenda "markup 100%") · Preço atacado `R$ 38,74` (legenda "markup 60%").
No cabeçalho da linha, que continua visível com a peça aberta: "Peça 1 · Suporte de celular", campo
"Quantidade" com sufixo "un", e a legenda "R$ 24,21 /un · Total da linha (2×) R$ 48,42".

## Estados obrigatórios
- **Fechado** (referência): a linha resumida com o botão "Editar esta peça"; aberto, o rótulo vira
  "Recolher" e o chevron aponta para cima.
- **Divulgação fechada** (padrão ao abrir) e **divulgação aberta** — as duas pranchetas, para se poder
  medir a altura de cada uma.
- **Repouso / foco / hover / pressionado** nos dois botões-linha (o cabeçalho da peça e o da divulgação):
  ambos são áreas de toque de largura inteira, mínimo 44px de altura, e o foco precisa de anel visível
  contra o fundo do CARD, não o da página.
- **Peça inválida**: o resultado vira alerta de tom perigo com "Confira os campos destacados para ver o
  preço."; no cabeçalho aparece "Confira os campos desta peça — ela não entra no total até ser corrigida."
- **Aviso de plausibilidade** (não é erro; nada foi recusado): sob o campo, ex. "Confira o consumo: 120 kW.
  Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma
  trazer watts: 120 W são 0,12 kW. Nada foi recusado." Precisa de tom próprio, distinto do erro vermelho de
  validação, e o campo continua editável.
- **Peça vinda do catálogo** e **peça ajustada depois de vinda do catálogo**: as legendas do item 1, mais
  "Você ajustou esta peça — ela será salva como uma peça nova no catálogo."
- **Peça degradada** (o produto de origem sumiu do catálogo): legenda calma, valores mantidos e editáveis;
  a frase NUNCA diz "removido" nem "excluído".
- **Quantidade 0**: "Quantidade 0 — não entra no total."
- **Taxas desatualizadas / falha de rede**: o alerta vive no topo da PÁGINA, não dentro da linha ("Não foi
  possível atualizar as taxas" + "Usando a referência salva no dispositivo — o cálculo continua
  funcionando. Você também pode informar as taxas manualmente." + "Tentar novamente"). Desenhe a linha
  sabendo que esse bloco pode estar acima dela, empurrando tudo para baixo.
- **Sem estado premium aqui**: o portão do Premium é da página inteira, antes desta peça existir. Não
  desenhe cadeado, borrão nem teaser dentro da linha.

## Viewports
**390px** (obrigatório, é onde dói): a grade de custos cai para uma coluna e é aqui que a altura do card
aberto precisa ser medida em telas. **1280px**: a página vira duas colunas — peças à esquerda, resumo do
kit à direita numa coluna de 480px que gruda ao rolar; o card da peça passa a ter ~700–800px de largura e a
grade de custos ganha 3–4 colunas. Desenhe as duas larguras da MESMA peça aberta, com os MESMOS dados, para
se poder comparar a altura resultante. 1920px pode ser derivado de 1280px (a coluna do resumo não cresce).

## Regras que o desenho não pode quebrar
- O número tem de dizer **de onde veio**: "do catálogo: {nome}" e "· ajustado por você" são selo de
  procedência, não decoração — não podem virar um ícone mudo.
- **Aviso nunca vira erro**: toda frase de plausibilidade termina em "Nada foi recusado." e o desenho tem de
  sustentar isso — se ela ficar vermelha ao lado de uma validação vermelha, o vendedor conclui que o
  produto recusou, e o produto não recusou.
- **Falha de rede nunca é vendida como "não é premium"** e nunca bloqueia: o cálculo segue com a referência
  salva no aparelho.
- Frase honesta mora em elemento de largura inteira, **nunca em placeholder** (placeholder carrega só
  número) — as legendas do item 5 e da seção de marketplace são compridas de propósito.
- Alvo de toque ≥44px nos dois botões-linha e no "x" de remover peça; contraste medido contra o fundo do
  card, que já é mais claro/escuro que o fundo da página.
- Uma peça aberta por vez: o desenho não pode depender de duas abertas para fazer sentido.

## Armadilhas já pagas neste projeto
- **Rolagem medida nos DOIS eixos**: uma versão anterior desta área vazou no eixo vertical interno e o
  navegador headless não enxerga barra clássica. Nada aqui pode transbordar em 390px.
- **Valor grande estoura a coluna**: `R$ 1.234.567,89` num campo ou numa linha de detalhamento já quebrou
  layout antes — entregue pelo menos uma prancheta com um valor de 7 dígitos.
- **Texto ocluso passa em teste**: um rótulo coberto ou cortado continua "visível" para o teste. O ⓘ ao
  lado de "Tarifa de energia" é exatamente esse caso.
- **Rótulo cortado**: "Poucas horas por semana" mede ~197px e é a opção mais larga do select de ritmo;
  "Em quantos anos quer que ela se pague?" quebra em duas linhas e desalinha o select vizinho se os dois
  rótulos não reservarem a mesma altura.
- **Prefixo duplicado**: o nome da peça já pode conter "Peça 1 · " — o cabeçalho não repete o prefixo.

## Entregável
Pranchetas em tema **escuro** (padrão) e **claro** (first-class — as duas, não uma amostra):
1. Card aberto com a divulgação fechada, 390px. 2. Card aberto com a divulgação aberta e um canal de
marketplace preenchido, 390px (é a prancheta que mede a altura real). 3. Card aberto com a divulgação
fechada, 1280px, com o resumo do kit visível à direita. 4. Card aberto em estado inválido + um aviso de
plausibilidade, 390px. 5. Detalhe do botão de divulgação nos quatro estados
(repouso/hover/foco/pressionado), com o rótulo que você propuser. 6. Detalhe do bloco de resultado da peça,
mostrando como ele se distingue visualmente do total do kit.
Reutilize os primitivos existentes, sem criar novos: `tf-card` para as molduras (e proponha qual nível
perde a borda), `tf-field`/`tf-inputwrap`/`tf-input` para cada campo com seu sufixo de unidade,
`tf-costs-grid` para a grade de custos, `tf-brow` para cada linha do detalhamento, `tf-price` para
varejo/atacado, `tf-alert` (`--danger` no inválido, `--info` nos avisos), `tf-btn--ghost tf-btn--sm` para o
cabeçalho e o remover, `tf-badge` se precisar marcar procedência, `tf-tnum` em todo número.

## Perguntas em aberto para o dono
1. **Como esse botão deve se chamar?** Hoje é "Mão de obra · Outros custos · Marketplace" — três títulos
   colados — e ele esconde também manutenção e taxa de falha. Um nome único ("Mais ajustes desta peça"?)
   ou a volta às seções nomeadas separadas do protótipo de 2026-07?
2. **Uma divulgação ou várias?** O protótipo antigo mandava "1 aberta + 1 fechada, nunca tudo aberto".
   Vale a mesma regra dentro de uma linha de kit, ou aqui a divulgação única é a decisão certa?
3. **O que fica aberto por padrão quando a peça vem do catálogo?** Ela já chega preenchida — abrir os
   campos obrigatórios pode ser ruído.
4. **O vendedor precisa ver o preço de canal POR PEÇA?** Hoje só existe o total por canal do kit; ele
   digita as taxas na peça e o retorno aparece a uma coluna de distância.
5. **Marketplace deveria estar dentro da peça?** É o único bloco aqui que fala do ANÚNCIO (que é do kit
   inteiro), não do custo da peça.

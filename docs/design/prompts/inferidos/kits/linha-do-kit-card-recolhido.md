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

- **Onde vive:** Um cartão por peça, empilhados na primeira posição do corpo da tela /kits (abaixo das faixas de aviso, acima do botão "Adicionar peça"). No mobile ocupam a largura toda; no desktop ≥1280px são a coluna ESQUERDA da grade (o resto sobra depois dos 480px do resumo).
- **Como o vendedor chega:** Nasce ao tocar "Adicionar peça" (e já nasce expandida), ou chega pronta e recolhida quando o vendedor reabre um kit salvo. É a unidade que ele mais repete: um kit típico tem de 2 a 5 delas.
- **Vizinhança imediata:** Dentro do cartão, uma linha superior com três coisas lado a lado: o botão expansível (chevron + "Peça 2 · Vaso G", ou "Peça 2 · (avulsa)" quando não há produto vinculado), um campo numérico estreito de 96px com sufixo "un" e SEM rótulo visível, e um botão fantasma com ícone "x" para remover. Logo abaixo, até cinco parágrafos cinzas do mesmo tamanho, nesta ordem: o dinheiro da linha ("R$ 12,40 /un · Total da linha (2×) R$ 24,80"), "Quantidade 0 — não entra no total.", o aviso de quantidade absurda, "Confira os campos desta peça — ela não entra no total até ser corrigida." e a legenda de peça degradada. Abaixo do último cartão: o botão "Adicionar peça".
- **Dados que chegam (e o que ela devolve):** Recebe da página o índice (1-based), o nome do produto vinculado ou nulo, a quantidade digitada, o resultado por linha vindo do pricing-core (nulo quando a peça é inválida) e as marcas invalid/degraded. Devolve para a página: mudança de quantidade, abrir/recolher e remover.
- **O que acontece depois:** Tocar o botão expansível abre o editor completo da peça DENTRO do próprio cartão (e recolhe qualquer outra peça aberta — só uma fica aberta por vez). Mudar a quantidade recalcula o total do kit na hora. O "x" remove a peça sem confirmação.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Card da peça recolhido — a linha do kit

## O que desenhar

A unidade que se repete na aba **Kits** (`/kits`, "Monte seus kits"): cada peça do kit é um card que,
recolhido, mostra **quem é a peça, quantas unidades e quanto ela custa**, e que expande para hospedar o
editor completo daquela peça. O vendedor vê de três a dez destes empilhados, um embaixo do outro, com um
botão "Adicionar peça" abaixo da pilha e o resumo "Total do kit" ao lado (desktop) ou depois (mobile). É a
peça que ele mais repete na tela e a única que ele compara entre si — se a linha não deixa comparar
"quanto custa a Peça 1 contra a Peça 3", o kit inteiro fica ilegível.

## Por que este prompt existe

A anatomia que está no ar nunca foi desenhada: ela foi montada a partir de requisito textual em 2026-07-12
(008/T005) e nunca passou por prancheta em nenhuma largura. Existe **um** desenho parcial — o canvas de
018 (`Abas-Desktop.dc.html`, artboard de 1920px) — e ele é **outro card**: cabeçalho com rótulo + selo de
origem lado a lado, a palavra "Quantidade" **visível**, ícone de **lixeira** para remover, uma grade de
quatro métricas e dois botões de rodapé. Esse card **não foi implementado** (018/US3 mexeu só na variante
do resumo e no CSS da grade da página). Abaixo de 1280px não existe desenho nenhum. Este prompt pede as
duas larguras e a reconciliação entre o que está no ar e o que o canvas já prometeu.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/bom/bom-line-card.tsx` (a linha) · `pages/bom/bom-page.tsx` (a pilha) ·
`specs/018-abas-desktop/design/Abas-Desktop.dc.html`, linhas 184-198 e 516-518 (o desenho de 1920px).

Card recolhido, hoje, de cima para baixo — **tudo empilhado com o mesmo peso tipográfico**:

| Elemento | Como está no ar | Como o canvas de 1920px desenhou |
|---|---|---|
| Rótulo | Botão de linha inteira, altura mín. 44px, chevron de 16px + `"Peça 1 · Vaso G"` (14px, medium) | `"Peça 1 · Vaso G"` em 16px forte, **com a origem ao lado** |
| Origem | **Não aparece recolhida** — `"do catálogo: Vaso G"` / `"— Manual —"` só existem dentro do editor expandido | `"do catálogo: Vaso G"` em 13px muted, na mesma linha do rótulo |
| Peça avulsa | `"Peça 2 · (avulsa)"` (o código concatena o `·`) | `"Peça 2 (avulsa)"` — sem o `·`. → duas grafias para a mesma coisa |
| Quantidade | Campo de **96px**, sufixo `"un"`, placeholder `"1"`, **sem rótulo visível** — só o `aria-label` "Quantidade — Peça 1 · Vaso G" | Rótulo `"Quantidade"` visível antes de um campo de **104px** |
| Remover | Botão fantasma com ícone **"x"** de 16px | Botão fantasma com ícone de **lixeira**, alvo mín. 44px, dica "Remover peça" |
| Dinheiro | Um parágrafo cinza, texto corrido: `"R$ 21,84 /un · Total da linha (2×) R$ 43,68"` | Grade de 4 métricas rotuladas: Gramas · Impressão · Custo unitário · Total da linha (2×) |
| Legendas | Até quatro parágrafos cinzas de 14px, iguais entre si e iguais ao dinheiro | Alerta de perigo para a peça inválida; legendas separadas |
| Ações | Nenhuma visível — "Editar esta peça"/"Recolher" existem **só** no `aria-label` do chevron | Rodapé com `"Editar esta peça"` e `"Usar produto salvo"` |

→ Problemas a resolver no desenho: (1) **hierarquia zero** — o número que importa (Total da linha) tem o
mesmo tamanho, cor e peso do aviso de plausibilidade e da legenda de degradação; (2) `"R$ 21,84 /un"`
**não diz que é CUSTO** (é o custo unitário calculado, não preço) — procedência silenciada; (3) a origem da
peça (catálogo × manual) some justamente quando a linha recolhe, que é quando o vendedor compara; (4) a
palavra "Quantidade" só existe para leitor de tela; (5) nada define o comportamento com nome longo.

## Conteúdo e dados reais

- **Rótulo**: `"Peça {n} · {nome do produto}"`; sem produto vinculado, `"Peça 2 · (avulsa)"`. O nome vem do
  catálogo e pode ser longo — desenhe com `"Suporte articulado para celular com base pesada e regulagem"`.
- **Quantidade**: inteiro, obrigatório, `1` é o valor sugerido pelo placeholder; teto real **2.147.483.647**.
- **Custo unitário** (derivado, nunca digitado): `R$ 21,84`. **Total da linha**: custo unitário × quantidade —
  `R$ 43,68` para 2 un. A faixa plausível vai de `R$ 0,87` a `R$ 1.234,56`; o aviso de absurdo só dispara
  acima de `R$ 100.000,00`.
- **Métricas do canvas** (existem hoje dentro do editor e podem subir para a linha): Gramas `42 g`,
  Impressão `3 h 30 min`, e o caso incompleto `— g` / `—`.
- **Origem**: `"do catálogo: Vaso G"`, `"do catálogo: Vaso G · ajustado por você"`, `"— Manual —"`.

## Estados obrigatórios

1. **Recolhida em repouso, peça válida e vinculada** — rótulo, origem, quantidade, custo unitário e total.
2. **Recolhida, peça avulsa** — `"Peça 2 · (avulsa)"`, sem selo de catálogo. Não é erro: é uma peça legítima.
3. **Expandida** — o card vira cabeçalho + editor completo abaixo, chevron apontando para cima. O cabeçalho
   precisa continuar legível sem virar um título de seção.
4. **Foco de teclado** — anel de 3px no botão do cabeçalho (que ocupa a linha inteira), no campo de
   quantidade e no botão de remover, sem que a borda do card ou o card vizinho corte o anel.
5. **Hover e pressionado** do cabeçalho e do botão de remover — o cabeçalho é um alvo largo; deixe claro que
   ele é clicável inteiro e que o botão de remover **não** dispara ao tocar na linha.
6. **Quantidade 0** — legenda `"Quantidade 0 — não entra no total."`, com a linha visivelmente fora da soma.
7. **Aviso de plausibilidade** — quantidade acima do teto: *"Confira a quantidade: 3.000.000.000. O máximo
   por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."* É **aviso, nunca
   recusa**: o campo continua editável e a peça continua no kit.
8. **Peça inválida** — *"Confira os campos desta peça — ela não entra no total até ser corrigida."* O canvas
   usa um alerta de perigo e uma borda de perigo no card; hoje é um parágrafo cinza igual aos outros.
9. **Degradada** (o produto do catálogo foi apagado depois de o kit ser salvo) — *"Os valores atuais foram
   mantidos e continuam editáveis."* Tom calmo, **nunca** "produto removido/excluído"; a linha volta a ser
   manual e segue editável.
10. **Nome longo** — como o rótulo se comporta em 390px sem empurrar quantidade e remover para fora.
11. **Valor grande** — `R$ 1.234,56 /un · Total da linha (999×) R$ 1.234.325,44` na coluna estreita.

Estados que esta peça **não** tem, e é bom saber: não existe variante grátis nem premium pausado (a página
inteira vira teaser antes de qualquer linha existir), não existe carregando (o cálculo é local e imediato) e
não existe offline (calcular funciona offline; a linha não muda). Não invente nenhum dos três.

## Viewports

- **390px** — obrigatório, e é o caso não desenhado mais crítico: cabeçalho + campo de 96px + botão de
  remover competem na mesma linha, e abaixo vêm até quatro legendas do mesmo peso.
- **1280px** — o corte do layout desktop. A coluna de peças é a flexível ao lado de uma coluna fixa de 480px
  com 24px de gap; com a barra lateral aberta (240px) sobram **≈490px** para o card. É a largura em que o
  cabeçalho do canvas (rótulo + origem + "Quantidade" + campo de 104px + lixeira) precisa provar que cabe.
- **1920px** — a largura em que o canvas foi desenhado; a coluna de peças chega a ≈1200px e a grade de quatro
  métricas respira. Mostre o mesmo card nas três larguras, para que a degradação seja decisão e não acaso.

## Regras que o desenho não pode quebrar

- **Procedência do número**: todo dinheiro na linha diz o que é. `"/un"` sozinho não distingue custo de preço;
  se o número é custo, a palavra "custo" aparece.
- **Degradação dita, não escondida**: a peça cujo produto sumiu continua no kit com os valores que tinha, e o
  desenho conta isso — sem alarme vermelho e sem sumir com a linha.
- **Aviso nunca vira erro**: o aviso de quantidade não pode receber a mesma cor e o mesmo ícone da peça
  inválida — um bloqueia o total, o outro não bloqueia nada.
- **Frase honesta fora de placeholder**: nenhuma dessas legendas pode viver dentro do campo de quantidade; o
  campo carrega só o número e o sufixo `"un"`.
- **Alvos ≥44px** no cabeçalho, no campo e no botão de remover, inclusive quando o card aperta em 390px.
- **Contraste ≥4.5:1 medido contra o fundo do card**, não contra o fundo da página.
- **Remover é destrutivo e imediato** — o alvo não pode ficar colado no chevron a ponto de o polegar errar.

## Armadilhas já pagas neste projeto

- **Overflow horizontal se mede, não se olha**: em 016 um card de kit estourou a coluna e o teste passou.
  Desenhe o caso "nome longo + total de sete dígitos" e mostre onde o texto quebra.
- **Texto ocluso passa em teste**: um rótulo truncado é aprovado por qualquer verificação de visibilidade. Se
  o nome trunca, diga com quantos caracteres e o que resta legível.
- **Máscara de milhares que estoura o campo** (016/PR-C): o campo de quantidade precisa comportar
  `2.147.483.647` sem cortar.
- **Uma pilha de parágrafos cinzas iguais é invisível**: com quatro legendas do mesmo peso juntas, o vendedor
  não lê nenhuma.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par obrigatório**:

1. A linha recolhida em repouso, nas três larguras (390 / 1280 / 1920), com a peça vinculada ao catálogo.
2. Uma pilha de **três** linhas em 1280px — vinculada, avulsa e inválida — provando a comparação entre elas.
3. A matriz de estados em 390px: quantidade 0 · aviso de plausibilidade · inválida · degradada · nome longo ·
   valor de sete dígitos.
4. A linha expandida (cabeçalho + as primeiras linhas do editor, só para mostrar a transição).
5. Foco, hover e pressionado do cabeçalho e do botão de remover.

Reutilize os primitivos existentes, sem criar novos: `tf-card` para o card; `tf-inputwrap tf-inputwrap--sm`
com `tf-inputwrap__affix` = `"un"` para a quantidade; `tf-btn tf-btn--ghost tf-btn--sm` para remover;
`tf-tnum` em todo número; `tf-alert tf-alert--danger` para a peça inválida; `tf-field__aviso` para o aviso de
plausibilidade; `tf-field__hint` para as legendas calmas; `tf-badge` se a origem virar selo.

## Perguntas em aberto para o dono

1. A grade de quatro métricas do canvas (Gramas · Impressão · Custo unitário · Total da linha) vale para as
   três larguras, ou em 390px a linha recolhida fica só com **Total da linha**? São dois produtos diferentes.
2. Os dois botões de rodapé do canvas ("Editar esta peça" / "Usar produto salvo") entram na linha recolhida —
   e, se entrarem, "Editar esta peça" passa a ser um botão além do chevron, ou substitui o chevron?
3. `"Peça 2 · (avulsa)"` (código) ou `"Peça 2 (avulsa)"` (canvas)? Uma das duas grafias morre.
4. A origem (`"do catálogo: Vaso G"` / `"— Manual —"`) deve ser visível na linha recolhida, ou continua só
   dentro do editor? O canvas diz que sim; o produto no ar diz que não.

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

- **Onde vive:** A rota /historico abaixo de 1280px, tela inteira e coluna única. A composição vertical é, de cima para baixo: título "Orçamentos" (PageHeader) · linha de subtítulo cinza ("O que você cotou, com a data. Os valores ficam congelados como estavam no dia.") · até três faixas de aviso · barra de filtros · a pilha de cards (gap var(--space-4), sem separador, sem cabeçalho fixo, sem agrupamento por mês, sem contagem) · o botão [Carregar mais] centralizado.
- **Como o vendedor chega:** Pela quarta posição da barra de abas do rodapé, rotulada "Orçamentos". Chega quase sempre com a lista já existindo — o registro nasceu em outra aba (Calcular, Kits ou a ficha de produto do Catálogo) e ele volta aqui para achar um cliente específico ou mostrar um orçamento antigo.
- **Vizinhança imediata:** Acima de tudo, a barra superior do shell (logo centralizado, tema, Sair) e as faixas globais do shell (offline, sessão expirada) — que já podem estar empilhadas antes de a página começar. Abaixo, a barra de 5 abas. Dentro da página, cada card é um <Link> inteiro clicável com: rótulo em negrito (trunca com ellipsis em UMA linha), badge de sincronização quando não sincronizado, a linha cinza "Cotado em {data} · Peça única|Kit · {n} peças", a linha de dinheiro ("Valor cotado" à esquerda, total em negrito tabular à direita) e a legenda da base ("preço de varejo"/"preço de atacado"). Data SEMPRE acima do dinheiro — a regra que impede o card de ser lido como preço de hoje.
- **Dados que chegam (e o que ela devolve):** Uma lista única costurada de três fontes: o servidor (paginação keyset), o cache local por uid (quando a rede falha) e a outbox do aparelho — servidor vence, mas um registro só enfileirado nunca some da lista. Cada item traz rótulo, data do aparelho + offset, total congelado, base, tipo (peça/kit) e estado de sincronização. A entrada da aba depende do entitlement do servidor: sem Premium ativo ou nunca concedido, esta tela não existe (vira a porta honesta).
- **O que acontece depois:** Tocar num card navega para /historico?snapshot={id}, que abaixo de 1280px substitui a tela inteira pelo registro congelado. [Carregar mais] anexa a próxima página abaixo e some quando a última entra — não há teto silencioso atrás dele.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Aba Orçamentos no celular — a lista completa em 390px

## O que desenhar
A tela inteira da aba **Orçamentos** no celular (390px de largura): a pilha vertical que o vendedor vê ao tocar em "Orçamentos" na barra de abas inferior. É a aba premium mais aberta no telefone e a única prova de que as cotações dele existem — ele chega aqui para achar *o orçamento daquele cliente* e dizer quanto cobrou e quando. A peça vai do cabeçalho da página até o botão "Carregar mais" no fim da lista, passando por até três faixas de aviso empilhadas, a barra de filtros, e a pilha de cards de registro congelado. O detalhe de um registro é outra tela (o card leva para ela); aqui só a lista.

## Por que este prompt existe
A composição vertical abaixo de 1280px nunca foi desenhada. O que existe: o protótipo de 2026-07-02 (`claude-design-prototype.md` §E6/§G, `HistoryScreen.jsx`) desenhou uma lista mock de 390px com **outra anatomia** — `ListItem` com ícone quadrado accent-soft, título, subtítulo "data · markup 50%", valor à direita e chevron. O construído inverteu isso de propósito (FR-523: data ACIMA do dinheiro, sem chevron, sem ícone). E o canvas do dono (`Abas-Desktop.dc.html`, ago/2026) desenha o card com a anatomia exata de hoje — mas num artboard único de 1920px, sem nenhum breakpoint e sem nada sobre 390px. **Nenhuma das autoridades trata o que este prompt precisa resolver: os avisos de topo empilhados, a densidade da pilha longa e o [Carregar mais].**

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` + `.css`, textos em `messages.pt-br.ts` (`historico`).

Ordem vertical real, de cima para baixo:

| # | Elemento | Texto literal hoje | Quando aparece |
|---|---|---|---|
| 1 | Título h1 | "Orçamentos" | sempre |
| 2 | Legenda | "O que você cotou, com a data. Os valores ficam congelados como estavam no dia." | sempre |
| 3 | Alerta `info` | "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou exportar, reative o Premium." | Premium lapsed |
| 4 | Alerta `info` com título | "Modo leitura offline" / "Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar a ficar online." | servindo cache, offline |
| 4b | Alerta `danger` + botão | "Não foi possível carregar seus orçamentos." + [Tentar novamente] na MESMA faixa | servindo cache, online |
| 5 | Banner da fila (`info` ou `danger`) + até 3 botões | ver "Estados obrigatórios" | há registro não sincronizado |
| 6 | Barra de filtros | busca + chips de período | há lista ou filtro ativo |
| 7 | Pilha de cards | — | — |
| 8 | Botão centralizado | "Carregar mais" | há próxima página |

→ **Problema 1 a resolver no desenho:** 3, 4 e 5 podem coexistir. Três faixas + título + legenda + barra de filtros empurram o **primeiro card para fora da primeira tela** em 390px. O desenho precisa decidir a densidade, a ordem e — se for o caso — a compressão desses avisos, sem esconder nenhum dos três fatos.

Anatomia do card (`Card padding="sm"`, coluna, gap `--space-1`, o card inteiro é um link):
- `.tf-historico__label` — o rótulo do cliente, **negrito 600, uma linha, com reticências**;
- badge de sincronização à direita (só quando não sincronizado), empurrado por `margin-left:auto`;
- `.tf-historico__meta` — "Cotado em 12/07/2026 · Peça única" (ou "Kit · 4 peças"), caption 0.8125rem, cor muted;
- `.tf-historico__money` — linha `space-between`, `baseline`: à esquerda "Valor cotado", à direita o total em `strong` com `tabular-nums`;
- `.tf-historico__basis` — caption abaixo: "preço de varejo" ou "preço de atacado";
- ações inline só em card travado: [Tentar agora] ou [Tentar novamente] + [Descartar] (danger).

→ **Problema 2:** o rótulo é o **único** jeito de achar o orçamento certo — e é justamente o campo que trunca em uma linha; com o badge ao lado, sobra ainda menos. Data e dinheiro estão declarados no código como "a alegação, nunca truncam".
→ **Problema 3 (divergência a resolver):** o canvas do dono desenha a linha do dinheiro com a **base à esquerda** ("preço de varejo") e o total à direita — **sem a palavra "Valor cotado"**. O código mostra "Valor cotado" na esquerda e a base numa linha separada abaixo. São duas anatomias diferentes; o desenho de 390px precisa escolher uma (e a escolha vale para as duas larguras).
→ **Problema 4:** não há separador, cabeçalho fixo, agrupamento por mês nem contagem de registros. Com 40 registros a pilha é 40 cards iguais separados por `--space-4`.

## Conteúdo e dados reais
- **Rótulo**: texto livre do vendedor, opcional. Sem rótulo, cai para o nome da origem capturada, e sem origem para "Cálculo avulso". Exemplos reais para desenhar: "Maria — pedido 42", "Cliente Ana Paula Ribeiro — suportes de bancada 3ª remessa" (o caso que trunca), "Cálculo avulso".
- **Data**: `dd/mm/aaaa`, renderizada no fuso do aparelho no momento da cotação. Ex.: "Cotado em 12/07/2026".
- **Tipo**: "Peça única" ou "Kit · {n} peças" (n = número de linhas do documento congelado; ex. "Kit · 4 peças").
- **Total**: string monetária congelada, `R$ 1.234,56`. Desenhe também o caso grande: `R$ 12.480,00`. Nunca truncar.
- **Base**: "preço de varejo" | "preço de atacado".
- **Badges de sincronização** (literais): "Pendente neste dispositivo" · "Envio pausado · precisa de Premium" · "Envio pausado · sessão expirada" · "Não foi possível registrar" (esta em tom `danger`; as outras `info`).
- **Busca**: rótulo do campo "Buscar por rótulo", placeholder "Cliente, pedido…", `type="search"`, máx. 120 caracteres, debounce de 250 ms.
- **Chips de período**: "Tudo" (padrão), "30 dias", "90 dias", "Período…". O ativo vira `primary`, os demais `secondary`.
- **Faixa de período customizado ativa**: "Período: 01/07/2026 – 31/07/2026" + [Limpar filtro].
- **Folha do período**: título "Período…", campos "De" e "Até" (calendário), botões [Voltar] e [Aplicar].
- **Paginação**: o servidor pagina por keyset; "Carregar mais" traz a próxima página e some quando a última entra. Não há teto silencioso.

## Estados obrigatórios
1. **Repouso com lista** — 4 a 6 cards, um deles com rótulo longo que trunca e um com total de 5 dígitos.
2. **Verificando o plano** — só o título "Orçamentos" e um spinner centralizado (nada de teaser piscando).
3. **Sem Premium / deslogado** — o teaser fechado: "Guarde seus orçamentos com a data" / "Cada cotação fica guardada com a data e a versão da fórmula — para você provar depois o que cobrou, mesmo que o catálogo mude." / botão de assinar / "A calculadora continua grátis e sem limite."
4. **Plano não verificável** — "Não foi possível verificar seu plano." + [Tentar novamente]. **Nunca o teaser**: falha de rede não é "você não é premium".
5. **Premium pausado (lapsed)** — a lista aparece inteira e legível, com a faixa `info` do item 3 da tabela.
6. **Carregando a lista** — spinner centralizado, sem esqueleto de card hoje (avalie se o desenho pede um).
7. **Erro frio** (nada em cache, nada na fila) — "Não foi possível carregar seus orçamentos." + [Tentar novamente], centralizados. Nunca sobre dados que o vendedor já tem.
8. **Leitura offline** — faixa "Modo leitura offline" e a lista abaixo, íntegra.
9. **Vazio frio** — ilustração/ícone de histórico, "Nenhum registro ainda", "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data." + [Ir para a calculadora].
10. **Busca sem resultado** — "Nenhum registro encontrado para “Maria”." + [Limpar busca]. É um estado **diferente** do vazio frio e não pode se parecer com ele.
11. **Fila pendente, online** — "2 registro(s) pendente(s) neste dispositivo." + [Sincronizar agora].
12. **Fila pendente, offline** — "Sem conexão. 2 registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." (sem botão de sincronizar).
13. **Fila bloqueada** — "1 registro(s) não foram enviados: o Premium não está ativo." + [Ver].
14. **Sessão expirada** — "1 registro(s) não foram enviados: sua sessão expirou." + [Ver] + [Entrar de novo].
15. **Fila com falha** — faixa `danger`: "1 registro(s) não puderam ser registrados." + [Ver].
16. **Card travado** — badge + a dupla [Tentar novamente] / [Descartar] dentro do próprio card, que continua sendo um link para o detalhe.
17. **Carregando mais** — o botão "Carregar mais" em estado de carregamento, com os cards já vistos intactos.
18. **Foco de teclado** e **pressionado** no card inteiro (é um alvo grande e clicável) e nos chips.
19. **Pilha longa** — 40 registros: mostre onde a leitura cansa e o que o desenho propõe (ou não) para isso.

## Viewports
**390px (obrigatório)** — é onde a peça vive e o único lugar onde ela nunca foi desenhada. Inclua também um recorte de **360px** para o pior caso real de aparelho pequeno (é a largura em que o projeto já mede overflow). **Não desenhe desktop aqui**: acima de 1280px esta aba vira mestre‑detalhe (lista de ~520px + o documento à direita), que é outra peça e já está no canvas do dono. Se algo do seu desenho de 390px implicar mudança no card do desktop (o Problema 3), diga isso explicitamente em vez de redesenhar a outra tela.

## Regras que o desenho não pode quebrar
- **A data vem antes do dinheiro. Sempre** (FR-523). Um card não pode ser lido como um preço vivo; a primeira coisa sob o rótulo é quando foi cotado.
- **"Valor cotado", nunca "Preço"** — preço é o que a calculadora diz hoje. Nada de tratamento de PriceHero, nada de cor que leia como "atual".
- **Total sem base é alegação ambígua**: a base ("preço de varejo"/"preço de atacado") acompanha o número em toda superfície.
- **Falha de rede nunca é vendida como "não é premium"** (estado 4) e **erro nunca cobre dados que o vendedor já tem** (estados 7 vs 8).
- **Freemium binário**: ou a lista inteira, ou o teaser. Nada de lista borrada, contagem provocativa ou card meio visível.
- **Lapsed não apaga nada**: ler continua livre; só escrever pede Premium ativo. O tom é calmo — "expirou/bloqueado/suspenso" são proibidos.
- **Nenhuma frase honesta dentro de placeholder** — placeholder carrega exemplo ("Cliente, pedido…"), nunca explicação.
- **Alvo ≥44px** em card, chips, botões das faixas e [Carregar mais]. Os chips hoje são `size="sm"`: se o desenho os mantiver pequenos, diga qual é a altura do alvo.
- **Contraste medido contra o fundo real** do card e da faixa `accent-soft`, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido nos DOIS eixos** — o headless não vê barra de rolagem clássica; o projeto já perdeu um item por medir só X. A faixa da fila (`flex-wrap`) com três botões e o texto "Sem conexão. 2 registro(s) pendente(s)…" é o candidato número um a estourar em 360px.
- **Texto ocluso passa em teste** — `toBeVisible` não vê elemento coberto ou fora do container; o rótulo espremido pelo badge é exatamente esse caso.
- **Valor grande estoura a coluna** — foi um defeito real no PDF do E4. Desenhe com `R$ 12.480,00` ao lado de um rótulo longo, não com "R$ 24,24".
- **Frase honesta cortada** — o 016 pagou por isso: a frase de honestidade mora em elemento de largura inteira, o placeholder carrega só o exemplo.
- **A barra de abas fica fixa no rodapé** (com `safe-area-inset-bottom`): o último card e o [Carregar mais] não podem terminar embaixo dela.

## Entregável
Pranchetas de 390px, em **tema escuro (padrão) e tema claro (first-class)**, reutilizando os primitivos `tf-*` — nenhum componente novo:
1. **Repouso com lista** (5 cards, um truncando, um com total grande) — `tf-card--pad-sm` + `tf-badge` + `tf-btn--ghost` no "Carregar mais".
2. **Pior caso de topo**: as três faixas empilhadas (`tf-alert` info + info + danger) acima da barra de filtros — a prancheta que justifica este prompt.
3. **Barra de filtros** em repouso, com chip de período ativo e com a folha "Período…" aberta (`tf-input` + `tf-btn--sm` + `tf-sheet`).
4. **Vazio frio** e **busca sem resultado**, lado a lado, para provar que não se confundem (`tf-empty-state`).
5. **Portas do premium**: teaser QUOTES e "Não foi possível verificar seu plano." (`tf-premium-teaser`, `tf-alert--danger`).
6. **Cards em estado excepcional**: pendente, sessão expirada, falha com [Tentar novamente]/[Descartar] (`tf-badge--info` / `tf-badge--danger`, `tf-btn--danger`).
7. **Pilha longa** (40 registros, recorte de rolagem) com a sua proposta de densidade — separador, agrupamento ou nada, dito e justificado.
Em cada prancheta, marque as medidas do alvo tocável e as sobras horizontais em 360px.

## Perguntas em aberto para o dono
1. **Agrupamento e contagem**: a pilha longa ganha cabeçalho por mês ("Julho de 2026") e/ou uma contagem de registros? Hoje não há nenhum dos dois, e é decisão de produto, não de layout.
2. **Anatomia da linha do dinheiro**: fica "Valor cotado" + total, com a base numa linha abaixo (código de hoje), ou base à esquerda + total à direita, sem "Valor cotado" (canvas de 1920px)? A resposta vale para as duas larguras.
3. **Três avisos ao mesmo tempo**: podem ser condensados numa faixa só quando coexistirem, ou os três fatos precisam ser lidos separadamente mesmo custando a primeira tela?
4. **Paginação**: "Carregar mais" continua sendo o gesto no celular, ou o dono quer carregamento ao rolar? (Isso muda o fim da lista e a relação com a barra de abas fixa.)

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

- **Onde vive:** Uma folha lateral sem botão de fechar, aberta pelo quarto chip da fileira de período ("Período…"), na barra de filtros da lista. Conteúdo: título "Período…" · dois campos empilhados, "De" e "Até", cada um um seletor de data NATIVO do sistema · e o par [Voltar] / [Aplicar] alinhado à direita.
- **Como o vendedor chega:** O vendedor tentou 30 e 90 dias, não achou, e toca em "Período…" — o último chip da fileira, o que pode ter embrulhado para a segunda linha em 390px.
- **Vizinhança imediata:** Por baixo da folha fica a lista com a barra de filtros e os cards. É o único componente de data do produto inteiro.
- **Dados que chegam (e o que ela devolve):** O rascunho é semeado com o intervalo em vigor ao abrir. O campo "Até" é tratado como inclusivo (o dia inteiro, até o último milissegundo). Um campo em branco é simplesmente OMITIDO — vira um limite aberto — mas nada na tela diz isso. Não há validação nenhuma: "De" posterior a "Até" é aceito sem aviso, e não há atalho tipo "este mês".
- **O que acontece depois:** [Aplicar] fecha a folha, marca o chip "Período…" como ativo, faz aparecer a linha "Período: {de} – {ate}" com o "Limpar filtro" ao lado, e relê a lista. [Voltar] descarta o rascunho.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Folha "Período…" — o intervalo de datas dos Orçamentos

## O que desenhar
O painel que abre quando o vendedor toca em **"Período…"** na barra de filtros da aba **Orçamentos**
(o registro congelado de cada cotação). A barra tem quatro controles em linha — `Tudo`, `30 dias`,
`90 dias`, `Período…` — e os três primeiros filtram na hora; o quarto abre esta folha, onde ele
escolhe um intervalo **De/Até** e confirma. É o **único componente de data do produto inteiro**, e é
usado num momento específico: o vendedor tem dezenas de orçamentos e quer achar "aquele de julho"
para reenviar ao cliente ou comparar com o preço de hoje. Depois de aplicar, a folha fecha, a lista
recarrega do servidor com o intervalo e uma marca de filtro ativo aparece abaixo dos botões.

## Por que este prompt existe
Nunca houve desenho de data neste produto. A única fonte é uma **recomendação escrita** no
`ux-history.md` §9.2 (gap G4): *"no date primitive… preset chips + a Sheet with two native
`<input type=date>`"* — e o código seguiu a recomendação ao pé da letra. Ou seja: a decisão de
entregar o **seletor nativo do sistema operacional** (que aparece diferente no Android, no iOS e no
desktop, com tipografia e cores que não são as nossas) nunca foi desenhada, só herdada do navegador.
Junto vieram três omissões que também nunca passaram por desenho: **não há validação** quando "De" é
posterior a "Até", **não há atalho** nenhum (este mês, ano passado), e **em lugar nenhum se diz que
deixar um campo em branco significa "sem limite"** — embora o filtro aceite intervalo aberto e
simplesmente omita o campo vazio.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (`HistoryFilterBar`), textos em
`messages.pt-br.ts` → `historico.*`.

A folha é uma `Sheet` ancorada na **borda direita**, altura inteira da tela, largura
`min(92vw, 416px)`, e **sem o botão X de fechar** (`showClose={false}`). Conteúdo, na ordem exata:

| Ordem | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Título da folha | `"Período…"` | → é o **mesmo texto do botão que a abriu**. Reticências num botão significam "abre um painel"; como título de painel já aberto, prometem uma continuação que não vem. |
| 2 | Campo 1 (`Field` + input nativo de data) | rótulo `"De"` | sem dica, sem marca de "opcional", sem exemplo de formato |
| 3 | Campo 2 (`Field` + input nativo de data) | rótulo `"Até"` | idem |
| 4 | Botão secundário | `"Voltar"` | → é o **único** caminho visível de saída (não há X); Esc e o toque no scrim funcionam, mas nada os anuncia |
| 5 | Botão primário | `"Aplicar"` | alinhado à direita, colado no "Voltar" |

Fora da folha, o que ela produz:

- marca de filtro ativo: `"Período: {de} – {ate}"` + botão fantasma `"Limpar filtro"`;
  → os valores entram **crus, em ISO**: a marca lê `Período: 2026-07-01 – 2026-07-31` enquanto
  **todo card da lista** diz `Cotado em 31/07/2026`. Duas grafias de data na mesma tela.
- lista sem resultado: `"Nenhum registro encontrado para “{termo}”."` + `"Limpar busca"`;
  → num filtro só de período o `{termo}` vira `2026-07-01 – —`, e a frase passa a dizer que não
  achou registro "para 2026-07-01 – —", que não é português nem é o que aconteceu.

→ **Aplicar com os dois campos em branco**: o botão `Período…` fica **destacado como ativo** (estado
primário), mas nada é filtrado e nenhuma marca aparece. A barra afirma um filtro que não existe.
→ **De posterior a Até**: aceito sem aviso; a lista volta vazia e a tela culpa a busca.
→ O título reserva um vão à direita para um X que não é renderizado — espaço morto no cabeçalho.

## Conteúdo e dados reais
- **De** e **Até** são datas de calendário (dia inteiro), não horários. O limite superior é
  **inclusivo até o último milissegundo do dia escolhido** — quem escolhe `31/07/2026` recebe os
  orçamentos daquele dia também. Isso é verdade no código e **não está escrito em lugar nenhum**.
- Ambos são **opcionais e independentes**: só "De" = "de 01/07/2026 até hoje"; só "Até" = "tudo até
  31/07/2026"; os dois vazios = sem filtro.
- Faixa plausível: o produto tem orçamentos desde 2026; datas futuras não retornam nada.
- Exemplo real para a prancheta: `De 01/07/2026` · `Até 31/07/2026`, marca ativa
  `Período: 01/07/2026 – 31/07/2026`, lista com um card `Cotado em 18/07/2026 · Valor cotado
  R$ 1.234,56 · preço de varejo`.
- Os presets vizinhos, para o desenho ficar coerente: `"Tudo"`, `"30 dias"`, `"90 dias"` (contados
  para trás a partir de hoje, pelo relógio do aparelho).

## Estados obrigatórios
1. **Repouso, folha recém-aberta** — os dois campos com o valor já aplicado (a folha reabre com o
   rascunho do que está em vigor), ou vazios na primeira vez.
2. **Foco** em cada campo de data (anel de foco visível sobre o fundo da folha, medido).
3. **Hover / pressionado** em `Voltar`, `Aplicar` e no botão `Período…` que a abriu.
4. **Aplicar desabilitado ou não** — hoje ele nunca desabilita; mostre a decisão que você propõe
   para o caso "dois campos em branco" (ver Perguntas ao dono).
5. **Erro de intervalo invertido** — "De" depois de "Até". O `Field` já tem linha de erro própria
   (vermelha, abaixo do campo, com papel de alerta); use-a. Não existe frase homologada para este
   caso: proponha uma e marque como proposta.
6. **Carregando após aplicar** — a folha fecha e a lista é substituída por um indicador centralizado
   enquanto o servidor responde; a marca `Período: 01/07/2026 – 31/07/2026` já está visível.
7. **Sem resultado no intervalo** — estado vazio da lista com a frase de "nada encontrado" e o
   caminho de volta (`Limpar filtro`).
8. **Offline** — hoje o filtro de período **depende do servidor**: sem rede a consulta filtrada volta
   vazia e a tela mostra "nenhum registro", com o aviso `"Modo leitura offline"` /
   `"Seus registros continuam aqui. Novos registros ficam pendentes neste dispositivo até você voltar
   a ficar online."` acima da barra. A folha em si não diz nada. **Isso é uma falha de rede aparecendo
   como ausência de dados** — desenhe o estado que conta a verdade dentro da folha.
9. **Premium pausado** — o vendedor **pode** ler e filtrar; a página já mostra
   `"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear,
   excluir ou exportar, reative o Premium."`. A folha **não** ganha cadeado nem trava.
10. **Filtro ativo combinado com busca** — a busca por rótulo (`"Cliente, pedido…"`) pode estar
    preenchida ao mesmo tempo; mostre a barra com os dois filtros vivos.

## Viewports
- **Mobile 390px** — é onde a peça nasceu e onde o seletor nativo domina a tela. A folha ocupa
  ~359px (92vw) na borda direita, altura inteira. Desenhe também a barra de filtros com os quatro
  controles **quebrando linha** (é o que o CSS faz), porque é ali que "Período…" pode cair sozinho
  numa segunda linha.
- **Desktop 1280px** — a mesma folha existe: acima de 1280px a aba vira mestre-detalhe, com a lista
  e seus filtros numa coluna à esquerda (mínimo 320px) e o **orçamento congelado à direita**. A folha
  ancorada na direita **cobre justamente o documento aberto**. Mostre esse enquadramento e resolva-o.
- **Desktop 1920px** — a coluna da lista passa a 520px fixos e sobra muito espaço à direita; vale
  mostrar se a folha continua sendo a forma certa nessa largura ou se o intervalo cabe na própria
  barra.

## Regras que o desenho não pode quebrar
- **Uma data só tem uma grafia na tela.** Se o card diz `18/07/2026`, a marca de filtro não pode
  dizer `2026-07-18`.
- **O que é opcional é dito, não adivinhado.** "Campo em branco = sem limite" precisa estar escrito
  em texto de dica (não em placeholder — placeholder some ao digitar e é cortado quando o campo é
  estreito; frase honesta nunca mora em placeholder neste projeto).
- **Falha de rede nunca vira "não existe".** Offline, a folha não pode deixar o vendedor concluir que
  seus orçamentos de julho sumiram.
- **Nada aqui é gate de Premium.** Filtrar é leitura; leitura continua aberta no plano pausado.
- **Alvos de toque ≥44px**, inclusive nos campos de data e nos dois botões do rodapé.
- **Contraste medido contra o fundo real da folha** (superfície de card sobre scrim), nos dois temas.
- O painel tem **uma saída visível**; se o X continuar ausente, `Voltar` precisa ser inequívoco.

## Armadilhas já pagas neste projeto
- **Texto que passa em teste e não aparece na tela.** Marca de filtro e frase de vazio já foram
  medidas por asserção de texto e nada acusou a data em ISO — só olhando é que se vê.
- **Overflow horizontal a 390px**: quatro controles + a marca `Período: 01/07/2026 – 31/07/2026` +
  `Limpar filtro` na mesma faixa estouram a coluna se não quebrarem. Desenhe a quebra, não confie
  nela.
- **Valor longo estourando a linha**: no desktop a marca fica numa coluna que pode encolher a 320px.
- **Placeholder que corta a frase honesta** (016/PR-F): a explicação do intervalo aberto vai em
  elemento de largura inteira.
- **Rótulo repetido com significados diferentes**: "Limpar filtro" (período) e "Limpar busca"
  (rótulo) convivem na mesma tela — não crie um terceiro "Limpar".

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Folha aberta em repouso — 390px e 1280px (esta com o orçamento congelado atrás, para mostrar a
   oclusão).
2. Folha com intervalo preenchido + foco no segundo campo.
3. Folha em erro de intervalo invertido.
4. Folha no estado offline.
5. Barra de filtros com o período aplicado, em 390px (com quebra de linha) e 1280px.
6. Lista sem resultado no intervalo.
7. Opcional, se você propuser: a variante com atalhos ("Este mês", "Mês passado", "Este ano") acima
   dos campos — marcada claramente como **proposta**, porque não existe hoje.

Reaproveite os primitivos existentes, sem criar novos: a folha é o `Sheet`/`SheetContent`
(ancorado à direita) com `SheetTitle`; cada data é um `Field` (que já tem rótulo, marca "opcional",
linha de dica e linha de erro) envolvendo o `tf-input`; o rodapé é `Button` secundário + `Button`
primário; os presets e a marca de filtro ativo usam `Button` `sm` (primário quando ativo, secundário
quando não) e `Button` `ghost` para o "Limpar filtro"; o aviso offline é o `Alert` de tom
informativo; o vazio é o `EmptyState`. Se o desenho pedir um calendário próprio, ele é um
**componente novo** e precisa vir descrito como tal, com todos os estados de célula.

## Perguntas em aberto para o dono
1. **Seletor nativo ou calendário desenhado?** Manter o do sistema operacional é rápido e acessível,
   mas quebra a identidade visual e aparece diferente em cada aparelho. Um calendário nosso é um
   primitivo novo no design system. Essa escolha muda a peça inteira.
2. **Atalhos de período**: entram ("Este mês", "Mês passado", "Este ano") ou os três presets atuais
   (`Tudo`, `30 dias`, `90 dias`) bastam? Se entrarem, substituem os presets ou convivem?
3. **Aplicar com os dois campos em branco** deve equivaler a `Tudo` (limpando o filtro), ficar
   desabilitado, ou mostrar erro?
4. **Offline**: a folha "Período…" deve ficar indisponível com uma frase honesta enquanto não há
   rede, ou continuar abrindo e explicar o resultado depois?

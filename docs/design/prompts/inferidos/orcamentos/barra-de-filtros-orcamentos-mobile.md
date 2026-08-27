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

- **Onde vive:** No topo da lista de /historico, imediatamente ABAIXO da última faixa de aviso (o banner da fila) e imediatamente ACIMA do primeiro card. Empilha três coisas: um campo de busca com LABEL VISÍVEL "Buscar por rótulo" e placeholder "Cliente, pedido…"; uma fileira de quatro botões pequenos que embrulha, na ordem Tudo · 30 dias · 90 dias · Período… (o ativo em primário, os outros em secundário — são Buttons, não um grupo segmentado); e, quando há intervalo escolhido, uma quarta linha cinza "Período: {de} – {ate}" seguida de um botão fantasma "Limpar filtro". No desktop, a mesma barra fica no topo da coluna esquerda.
- **Como o vendedor chega:** Aparece sozinha assim que existe ao menos um registro (ou um filtro já em vigor). O vendedor recorre a ela quando o histórico cresceu e ele precisa achar o orçamento de um cliente.
- **Vizinhança imediata:** Acima: até três faixas de aviso empilhadas. Abaixo: a pilha de cards, ou um dos dois estados vazios.
- **Dados que chegam (e o que ela devolve):** A busca ESPERA 250 ms antes de virar consulta ao servidor — o campo continua respondendo a cada tecla, mas a lista só é relida quando o termo assenta. Os presets viram um limite inferior de data; "Período…" abre a folha de intervalo. O filtro refina a leitura do SERVIDOR e nunca toca a fila: uma busca não consegue esconder um orçamento pendente do próprio vendedor.
- **O que acontece depois:** A lista abaixo é relida e repaginada. Existem DUAS formas divergentes de limpar: "Limpar filtro" (na linha do intervalo) volta o período para "Tudo" mas NÃO zera a busca; "Limpar busca" (no estado vazio) zera os três de uma vez.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Barra de filtros dos Orçamentos no celular

## O que desenhar
A faixa de filtro da aba **Orçamentos** (rota `/historico`) no celular: um campo de busca por rótulo,
uma escolha de período com quatro opções, e — quando o período é um intervalo escolhido à mão — uma
linha que declara o intervalo ativo com um jeito de desfazê-lo. Ela vive entre os avisos do topo
(banner de fila pendente, "Modo leitura offline", "Premium pausado") e a pilha de cards de orçamento
congelado. Quem usa é o vendedor Premium procurando o orçamento de um cliente específico numa lista
que é **ilimitada e paginada sob demanda** ("Carregar mais"): rolar não é alternativa, o filtro é o
único caminho até um registro antigo.

## Por que este prompt existe
O único desenho que existe desta barra é **desktop** (`Abas-Desktop.dc.html`, linhas 269–278) e o
código **não bate com ele**: o desenho tem lupa dentro do campo e `aria-label` invisível, presets como
`tf-badge--neutral` clicáveis (32px) na ordem 30 dias / 90 dias / Tudo / Período…, com o ativo pintado
em `accent-soft`. O código tem label **visível**, quatro `Button size="sm"` primary/secondary e a ordem
Tudo / 30 dias / 90 dias / Período… Não existe nenhuma prancheta mobile, e o protótipo de 2026-07-02
não ajuda: **não há busca nem filtro em lugar nenhum nele** (§E6 não menciona, a matriz §G não lista,
`HistoryScreen.jsx` não tem) — a busca nasceu no PR-B de 2026-07, depois do protótipo. Então: forma,
ordem, quebra de linha em 390px e as duas maneiras divergentes de limpar foram todas inferidas.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (`HistoryFilterBar`), `historico-page.css`
(`.tf-historico__filters`, `__chips`, `__filterchip`) e `shared/i18n/messages.pt-br.ts` (`historico.*`).

| Parte | Como está hoje | Problema |
|---|---|---|
| Busca | `Field` com label **visível** "Buscar por rótulo" empilhado sobre um `tf-inputwrap`; placeholder "Cliente, pedido…"; `type="search"`, `maxLength 120`; debounce de 250 ms até a leitura no servidor | → rótulo e placeholder dizem a mesma coisa duas vezes e custam uma linha inteira da tela; **não há ícone de lupa** (o desenho desktop tem) |
| Presets | Quatro `Button size="sm"` numa fileira com `flex-wrap`, ordem "Tudo" · "30 dias" · "90 dias" · "Período…"; ativo = `primary` (bloco cheio de accent), inativos = `secondary` | → quatro botões lado a lado leem como **quatro ações**, não como uma escolha entre quatro; o ativo em primary compete com a ação primária da tela |
| Largura | Medido: 390px − 32px de gutter = **358px úteis**; os quatro botões (padding 16px de cada lado, `fs-body-sm`) somam ≈343px + 24px de gaps | → sobra ~15px. Qualquer fonte de sistema um pouco mais larga joga "Período…" para uma **segunda linha**, e a barra passa a ocupar 3 linhas antes do primeiro card |
| Intervalo ativo | Linha em `fs-caption`/`text-muted`: `Período: {de} – {ate}` com as datas **cruas do input** (ex.: "2026-07-01 – 2026-07-31"), seguida de um `Button ghost sm` "Limpar filtro" | → data em formato de máquina numa frase para humano; e o botão fica colado ao texto, sem hierarquia |
| Duas limpezas | "Limpar filtro" (no chip) volta **só** o período para "Tudo" e **mantém a busca digitada**. "Limpar busca" (no vazio de resultado) zera **busca + período + datas** | → dois rótulos parecidos com escopos diferentes; quem clica em "Limpar filtro" e continua sem resultado não entende por quê |
| Folha "Período…" | `Sheet` com título "Período…", campos "De" e "Até" (`type="date"`), rodapé "Voltar" (secondary) + "Aplicar" (primary) | → sem atalhos ("este mês", "mês passado") e sem dizer que o "Até" inclui o dia inteiro |
| Quando aparece | A barra só é renderizada se **há lista** ou **já há filtro em força**. Ledger frio e vazio: nenhuma barra | correto — desenhe sabendo disso |

## Conteúdo e dados reais
- Textos literais em pt-BR (não reescrever sem dizer que está reescrevendo): `"Buscar por rótulo"`,
  `"Cliente, pedido…"`, `"Tudo"`, `"30 dias"`, `"90 dias"`, `"Período…"`, `"De"`, `"Até"`,
  `"Aplicar"`, `"Voltar"`, `"Período: {de} – {ate}"`, `"Limpar filtro"`, `"Limpar busca"`,
  `"Nenhum registro encontrado para “{termo}”."`, `"Carregar mais"`.
- A busca casa **apenas o rótulo** do registro — campo opcional, escrito pelo vendedor na hora de
  salvar ("Rótulo (opcional)", dica "Cliente, pedido…"). Um registro salvo sem rótulo aparece na lista
  como `"Cálculo avulso"` e **nunca** é encontrado por busca.
- Exemplo verdadeiro para preencher as pranchetas: termo digitado `Ateliê Marina — pedido 118`;
  cards abaixo com `"Cotado em 12/08/2026"`, `"Valor cotado"` **R$ 1.234,56**, legenda
  `"preço de varejo"`, e um segundo card `"Kit · 4 peças"` com **R$ 389,90**.
- `{termo}` na frase de vazio recebe o termo **debounced**; se só houve período, recebe o rótulo do
  período ("30 dias", "90 dias") ou o intervalo ("2026-07-01 – 2026-07-31").
- Presets são limites inferiores calculados no aparelho (30/90 dias atrás); o intervalo à mão manda as
  duas pontas, com o "Até" incluindo o dia inteiro até o último milissegundo.

## Estados obrigatórios
- **Repouso** — nenhum filtro, "Tudo" selecionado, campo de busca vazio mostrando o placeholder.
- **Foco no campo** — anel de foco do DS visível contra o fundo real do card, nos dois temas.
- **Digitando** — termo no campo; hoje **não há nenhum sinal** de que uma leitura vai disparar em
  250 ms; decida se algo aparece (e o quê) ou se o silêncio é intencional.
- **Carregando** — a lista abaixo some e vira um `Spinner`; **a barra continua no lugar** com o que foi
  digitado. Desenhe esse par (barra viva + lista carregando), porque é o que o vendedor vê.
- **Preset selecionado / não selecionado / pressionado / com hover** — quatro pílulas, uma escolhida.
- **Intervalo à mão ativo** — a linha "Período: 01/07/2026 – 31/07/2026" com sua saída.
- **Vazio por filtro** — `EmptyState` com `"Nenhum registro encontrado para “Ateliê Marina — pedido 118”."`
  e o botão `"Limpar busca"`. Nunca o vazio frio ("Nenhum registro ainda").
- **Offline com filtro** — o filtro é um refinamento **do servidor**: sem conexão a leitura filtrada não
  cai no cache do aparelho, de propósito, então sobra só a fila local; com a fila vazia a tela cai hoje
  no muro vermelho `"Não foi possível carregar seus orçamentos."` + `"Tentar novamente"`, com a barra
  ainda oferecendo o filtro como se funcionasse. Desenhe o estado honesto.
- **Premium pausado** — o alerta `"Premium pausado — seus registros continuam aqui e podem ser abertos…"`
  fica acima; a barra continua **inteiramente utilizável** (ler e filtrar não exigem Premium ativo).
- **Sessão expirada** — o banner de sessão manda; a barra não repete a causa nem oferece "tentar de novo".
- **Barra ausente** — ledger vazio e sem filtro: nada de campo de busca sobre o nada.

## Viewports
- **390px — obrigatório e principal.** É onde a barra não cabe por ~15px e onde a decisão de forma se
  paga. Todas as pranchetas de estado saem daqui.
- **1280px — uma prancheta de reconciliação.** Acima do corte a mesma barra vive na coluna mestre do
  mestre-detalhe (a coluna mede ≈410px a 1280px, ganhando largura fixa de 520px só a partir de 1440px).
  É o **mesmo componente**: se a solução de 390px não sobreviver a 410px, ela está errada. Mostre-a ao
  lado do que o `Abas-Desktop.dc.html` já desenhou e diga qual das duas formas vence.

## Regras que o desenho não pode quebrar
- **Vazio por filtro nunca se veste de ledger vazio.** O vendedor tem histórico; esta busca é que erra.
- **Falha de rede nunca é vendida como "nada encontrado"** nem como "não é premium". Sem conexão, a
  frase diz *conexão* — em elemento de texto próprio, **nunca dentro de um placeholder** (o placeholder
  some quando se digita e é cortado pela largura do campo).
- **A fila local nunca é filtrada.** Um orçamento ainda não sincronizado aparece na lista *mesmo que não
  case com a busca* — é dado do vendedor e sumir seria pior. O desenho precisa de um jeito de isso não
  parecer bug (o card já traz o selo "Pendente neste dispositivo").
- **Alvo ≥44px em toda pílula e no "Limpar filtro".** O `tf-badge` de 32px do desenho desktop está
  abaixo do mínimo no celular — se a forma de badge for adotada, ela sobe para 44px de altura mínima.
- **Sem rolagem horizontal em nenhum eixo** e sem texto ocluso: a barra é medida por caixa, não por
  "o texto está lá".
- **Contraste do estado selecionado medido contra o fundo real** (`accent-soft` no claro e no escuro),
  não contra um cinza imaginado.
- **O selecionado não pode competir com a ação primária da tela**: um filtro é uma escolha, não um botão
  de confirmar.

## Armadilhas já pagas neste projeto
- **Overflow medido nos dois eixos.** O headless não enxerga barra de rolagem clássica; o 016/PR-B
  perdeu um item inteiro por medir só a horizontal. Aqui a soma dos quatro presets é o risco.
- **Asserção de texto é cega para colisão.** "está visível" passa com o elemento ocluso ou estourado
  (014, três vezes numa fase). O que decide esta barra é geometria.
- **Frase honesta em placeholder é frase perdida** (016/PR-F): placeholder carrega exemplo, nunca aviso.
- **Sintoma de layout se diagnostica em navegador real** (E5, três vezes): não confie que "cabe".
- **Valor longo estoura a linha**: "Período: 01/07/2026 – 31/07/2026" + "Limpar filtro" na mesma linha,
  a 358px, é o caso adversarial desta peça.

## Entregável
Pranchetas, tema **escuro como padrão e claro como cidadão de primeira classe** (ambos desenhados):

1. 390px — repouso, com três cards de orçamento abaixo para dar contexto.
2. 390px — busca ativa com o termo longo do exemplo + resultado.
3. 390px — carregando (barra viva, lista em spinner).
4. 390px — vazio por busca, com a frase exata e "Limpar busca".
5. 390px — intervalo à mão ativo (linha do período + saída).
6. 390px — folha "Período…" aberta, com "De", "Até", "Voltar" e "Aplicar".
7. 390px — offline com filtro em força.
8. 1280px — a mesma barra na coluna mestre de ≈410px, comparada ao desenho desktop existente.

**Reutilize os primitivos, não crie novos**: `Segmented` (`tf-segmented`, bandeja com pílula
selecionada, já com 44px de altura mínima e navegação por setas — foi extraído no 018 justamente para
ter um dono só) **ou** `Badge` (`tf-badge`) clicável para os presets — escolha um e justifique;
`tf-inputwrap` + `tf-input` para a busca, com o ícone de lupa do `Icon` dentro do wrap; `Button`
`ghost`/`sm` para "Limpar filtro"; `Sheet` para a folha de período; `EmptyState` para o vazio;
`Alert` tom `info` (nunca `danger`) para o estado offline.

## Perguntas em aberto para o dono
1. **As duas limpezas viram uma só?** Hoje "Limpar filtro" zera só o período e "Limpar busca" zera os
   três. Um único "Limpar filtros" é mais simples, mas apaga um termo que o vendedor pode querer manter
   enquanto troca o período. Qual escopo é o certo — e como cada rótulo o declara?
2. **Qual ordem dos presets?** Código: Tudo · 30 dias · 90 dias · Período… Desenho desktop:
   30 dias · 90 dias · Tudo · Período… A primeira posição comunica qual é o padrão.
3. **Filtrar sem conexão: bloquear ou deixar tentar?** Desabilitar a barra com um aviso é honesto e
   fecha uma porta; deixar tentar e explicar mantém a porta e exige uma frase boa. Hoje o app deixa
   tentar e devolve um erro genérico vermelho.
4. **A busca cobre só o rótulo.** Um registro salvo sem rótulo ("Cálculo avulso") é inatingível por
   busca. Isso deve ser dito na barra (uma dica sob o campo), aceito em silêncio, ou a busca deveria
   cobrir mais campos (o que é mudança de contrato, não de desenho)?
5. **O período à mão merece atalhos** ("este mês", "mês passado", "este ano") na folha, ou dois campos de
   data bastam para o vendedor que procura o pedido de um cliente?

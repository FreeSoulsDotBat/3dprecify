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

- **Onde vive:** O topo do corpo de /historico, entre o subtítulo da página e a barra de filtros. Podem empilhar TRÊS faixas nesta ordem fixa: (1) "Premium pausado — seus registros continuam aqui e podem ser abertos…" (info, parágrafo de duas frases); (2) OU a faixa "Modo leitura offline" (info, com título e corpo) OU o erro de carga (vermelho) que traz o botão [Tentar novamente] DENTRO do próprio alerta, num arranjo que embrulha; (3) o banner agregado da fila. No desktop as três moram no topo da coluna esquerda.
- **Como o vendedor chega:** Sem gesto nenhum: são condições da sessão e da rede. Todas aparecem antes do primeiro orçamento.
- **Vizinhança imediata:** Acima delas, ainda fora da página, podem existir as faixas globais do shell (offline, sessão expirada) — o que faz o primeiro card ser empurrado para bem longe do topo em 390px. Abaixo: o campo "Buscar por rótulo" e a fileira de chips.
- **Dados que chegam (e o que ela devolve):** A faixa de plano vem do entitlement do servidor. A segunda faixa depende de DUAS coisas: a lista estar sendo servida do cache local E se o aparelho está offline (calma, esperada) ou online (o vendedor pode tentar de novo). Com a SESSÃO EXPIRADA o aviso genérico CALA — o banner do shell e o banner da fila já dizem a causa, e o retry dele só renderia outro 401. Este par de faixas nunca vira uma parede de erro: as linhas abaixo continuam renderizando sobre dados que o vendedor já tem. A parede inteira só existe numa falha FRIA (nada em cache, nada na fila), mais abaixo na mesma página.
- **O que acontece depois:** [Tentar novamente] relê a lista. Corrigida a causa, a faixa some sozinha; nenhuma delas é dispensável por toque.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Faixas de aviso no topo de Orçamentos

## O que desenhar
A pilha de faixas de aviso que aparece na aba **Orçamentos** (a lista de documentos congelados), entre o
cabeçalho da página e a barra de filtros — portanto ACIMA do primeiro registro. São três avisos de página
que podem coexistir: "Premium pausado", o par "Modo leitura offline" / "erro de carga com Tentar novamente
dentro da faixa", e a faixa da fila de envio. Quem vê é o vendedor que abriu Orçamentos para consultar o
que já cotou — ele não veio resolver um problema de sistema, veio ler um número. Desenhe a pilha inteira
(a convivência entre as faixas), não cada faixa isolada.

## Por que este prompt existe
Nenhum desenho jamais definiu a CONVIVÊNCIA. O código escolheu sozinho a ordem (pausado → offline/erro →
fila), a regra de silenciar o alerta genérico quando a sessão expirou, e a densidade de até três faixas
antes do primeiro registro em 390px. Autoridade parcial: `claude-design-prototype-fixes.md` item 17 cobre
"Não foi possível carregar. Tente de novo." + botão "Tentar novamente" (verificado no protótipo de
2026-07-02), mas como estado de falha de carga — nunca como uma faixa fina COM BOTÃO DENTRO sobre dados que
o vendedor já tem em cache. "Modo leitura offline" e "Premium pausado" não têm desenho em autoridade
alguma: o protótipo só conhecia free × premium (o estado `lapsed` nasce depois, com a entitlement de
E2/E6), e o banner offline do shell é outro objeto, em outro lugar da tela. O desenho desktop de 018
(`Abas-Desktop.dc.html`, linha 264) desenha SÓ a faixa da fila — e a desenha diferente do que foi
construído (ver abaixo), o que é uma contradição a resolver, não um detalhe.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` + `historico-page.css` + `messages.pt-br.ts`.
Ordem real de renderização, de cima para baixo:

| # | Faixa | Quando aparece | Tom | Ação dentro |
|---|-------|----------------|-----|-------------|
| 1 | Premium pausado | entitlement `lapsed` | info | nenhuma |
| 2a | Erro de carga sobre cache | leitura veio do cache **e** o aparelho está online | danger | botão "Tentar novamente" |
| 2b | Modo leitura offline | leitura veio do cache **e** o aparelho está offline | info | nenhuma |
| 3 | Fila de envio | há registros não sincronizados | info ou danger | até 3 botões |

Textos literais de hoje (não reescrever sem motivo dito):
- Pausado: **"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear,
  excluir ou exportar, reative o Premium."** (uma frase única, sem título, sem botão).
- Offline: título **"Modo leitura offline"** + corpo **"Seus registros continuam aqui. Novos registros
  ficam pendentes neste dispositivo até você voltar a ficar online."**
- Erro sobre cache: **"Não foi possível carregar seus orçamentos."** + botão **"Tentar novamente"**.
- Fila, um texto por precedência falhou > bloqueado > sessão > pendente:
  "{n} registro(s) não puderam ser registrados." (danger) · "{n} registro(s) não foram enviados: o Premium
  não está ativo." · "{n} registro(s) não foram enviados: sua sessão expirou." · "Sem conexão. {n}
  registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." ·
  "{n} registro(s) pendente(s) neste dispositivo."
- Botões da fila: **"Ver"** · **"Entrar de novo"** · **"Sincronizar agora"** (este com estado de carga).

→ **Problema 1**: a faixa 2a põe o botão DENTRO do Alert, num contêiner com `flex-wrap` e
`justify-content: space-between`. Em 390px o botão quebra para a segunda linha e encosta na direita, sem
alinhamento com nada. Esse padrão "Alert que contém botão" não está desenhado em lugar nenhum do produto.
→ **Problema 2**: o desenho desktop existente usa uma variante `tf-alert--compact` de UMA linha, com o
texto no lugar do `tf-alert__title` e o botão FORA do corpo do alerta, à direita, centrado verticalmente.
O construído usa outra composição. Uma das duas tem de morrer — decida no desenho.
→ **Problema 3**: três faixas empilhadas somam ~3 × (padding 16px + duas linhas de texto) e empurram o
primeiro registro para fora da primeira tela em 390px.
→ **Problema 4**: com Premium pausado, a mesma causa pode ser dita duas vezes — a faixa 1 e a faixa 3
("o Premium não está ativo") aparecem juntas.

Vizinhança que NÃO é esta peça, mas divide a tela: o banner do shell de sessão expirada ("Sua sessão
expirou" / "Entre de novo para continuar de onde parou." / "Entrar de novo") e o banner offline global do
shell ("Você está offline. O cálculo continua funcionando."). Ambos ficam acima, fora da página. Mais
abaixo, o erro FRIO (nada em cache) é outro objeto: alerta centralizado + botão "Tentar novamente" embaixo,
no lugar da lista.

## Conteúdo e dados reais
- `{n}` é uma contagem inteira de registros, tipicamente 1–5, sem teto — desenhe também com 12.
- Não há dinheiro dentro das faixas. O dinheiro está logo abaixo, nos cards: rótulo "Valor cotado" com
  valores como **R$ 24,24** e **R$ 1.234,56**, sob "Cotado em 07/08/2026".
- O que a barra de filtros mostra logo abaixo das faixas: campo com placeholder "Cliente, pedido…" e os
  chips "30 dias" · "90 dias" · "Tudo" · "Período…".
- Nada aqui é opcional em conteúdo: cada faixa só existe quando o fato existe.

## Estados obrigatórios
1. **Nenhuma faixa** — o caso normal e o mais importante de desenhar: filtros e primeiro registro colados
   no cabeçalho.
2. **Só pausado** (info, frase única acima).
3. **Só offline** (info, com título "Modo leitura offline" + corpo de duas linhas).
4. **Só erro sobre cache** (danger, com "Tentar novamente" inline) — repouso, hover, foco visível e
   pressionado do botão dentro de um fundo já tingido de vermelho suave.
5. **Fila com 1 pendente, online** — texto + "Sincronizar agora".
6. **Fila sincronizando** — "Sincronizar agora" em carga, texto inalterado.
7. **Fila com problema** (danger) — texto de falha + "Ver"; e a variante sessão expirada com "Ver" +
   "Entrar de novo" lado a lado.
8. **Fila offline** — texto longo "Sem conexão. {n} registro(s)…", SEM botão de sincronizar (o código não
   oferece uma ação que não pode funcionar).
9. **Pilha de três** — pausado + offline + fila, empilhadas, em 390px: mostre onde fica a dobra.
10. **Sessão expirada** — o alerta genérico de carga é SILENCIADO (a causa conhecida cala a genérica);
    quem fala é o banner do shell e a faixa da fila. Desenhe esse recorte para provar que ele é legível.

## Viewports
- **390px** — obrigatório: é onde a pilha dói. Mostre a pilha de três e onde o primeiro card começa.
- **1280px** — a lista de Orçamentos vira mestre-detalhe (lista à esquerda, documento congelado à direita).
  As faixas ficam ACIMA da grade de duas colunas, ocupando a largura toda. Desenhe uma faixa com botão
  nessa largura: o espaço vazio entre texto e botão fica enorme e precisa de uma decisão.
- **1920px** — só se a decisão de largura máxima da faixa mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- Falha de rede NUNCA pode ser vendida como falta de Premium, e vice-versa: são quatro causas distintas
  (offline · erro de servidor · Premium pausado · sessão expirada) e cada faixa nomeia exatamente a sua.
- Degradação é dita, nunca escondida: se a lista veio do cache, a faixa existe. E as linhas abaixo
  continuam renderizando — nunca uma parede de erro sobre dados que o vendedor já tem.
- Freemium binário: "pausado" não é punitivo. Nada foi apagado, ler continua funcionando; só escrever
  precisa de Premium ativo. Palavras banidas: "expirou", "bloqueado", "suspenso" (para o plano).
- Frase honesta vive em elemento de largura cheia, nunca em placeholder e nunca truncada com reticências.
- Alvo de toque ≥44px para qualquer botão dentro das faixas, inclusive os `sm`.
- Contraste medido contra o fundo tingido do alerta (info-soft / danger-soft), não contra o fundo da
  página.

## Armadilhas já pagas neste projeto
- Overflow horizontal medido em px: a faixa de fila em 390px tem texto longo + até dois botões na mesma
  linha. Já custou 100,5px de estouro numa peça irmã, com um botão nascendo fora da viewport.
- Texto ocluso passa em teste: `toBeVisible` é verdadeiro para um elemento coberto. Se uma faixa cobrir o
  primeiro card no desktop com a coluna grudenta, o teste não vê — o desenho tem de ver.
- Legenda cortada: a frase de pausado tem 130 caracteres. Em 390px são 4 linhas; não a comprima num chip.
- Um número grande em `{n}` ("12 registro(s) não puderam ser registrados.") muda a quebra de linha.
- Headless não enxerga barra de rolagem clássica: a densidade da pilha é decisão de desenho, não de teste.

## Entregável
Pranchetas em **tema escuro (padrão)** e **claro (first-class)**:
1. 390px — os 10 estados listados, como uma coluna de recortes do topo da página.
2. 390px — a pilha de três, tela inteira, com a dobra marcada.
3. 1280px — as faixas sobre o mestre-detalhe, incluindo a faixa com botão em largura total.
4. Uma prancheta de **anatomia**: a faixa com ação — decidir entre o botão dentro do corpo do alerta ou
   fora dele à direita, com as medidas.

Reutilize os primitivos existentes, não crie novos: `tf-alert` com `tf-alert--info` / `tf-alert--danger`
(ícone + `tf-alert__title` + `tf-alert__text`), `tf-btn--secondary` + `tf-btn--sm` para as ações inline,
`tf-badge` para os chips de período abaixo. Se propuser a variante compacta de uma linha, nomeie-a
`tf-alert--compact` — ela já existe no desenho desktop de 018 e não existe no produto.

## Perguntas em aberto para o dono
1. Quando o Premium está pausado E há registros bloqueados na fila, a mesma causa aparece em duas faixas.
   A faixa da fila deve calar (como a genérica cala sob sessão expirada), ou as duas devem falar?
2. Existe teto de faixas simultâneas? Se três é demais, qual é a regra — colapsar em uma faixa única
   "3 avisos" que expande, ou sacrificar a menos urgente?
3. A faixa "Premium pausado" deve ganhar uma ação ("Reativar Premium") ou continuar só texto? Hoje ela é a
   única sem saída, e a saída existe em outro lugar do app.
4. A variante de uma linha (`tf-alert--compact`, botão fora do corpo) do desenho desktop substitui o padrão
   construído em TODAS as faixas com ação, ou é exclusiva do desktop?

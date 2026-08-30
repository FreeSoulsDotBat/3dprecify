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

- **Onde vive:** O botão [Exportar] é o segundo da fileira final do registro congelado, à direita de [Recalcular hoje], no fim do scroll (no desktop, essa mesma fileira fica no pé da coluna direita). Logo ABAIXO do botão, quando ele está desabilitado, mora um parágrafo pequeno com o motivo — nunca um tooltip. A folha que ele abre traz: título "Exportar" · fieldset "O que exportar" com dois radios ("Orçamento para o cliente (PDF)" / "Meus orçamentos (CSV)"), o de PDF podendo estar desabilitado com a SUA própria frase de motivo por baixo · (só no PDF) a linha do interruptor "Incluir detalhamento de custos" com o aviso de dano colado logo abaixo dele · a descrição do que vai no arquivo · o botão de envio, cujo rótulo muda por formato ("Gerar PDF" / "Baixar CSV").
- **Como o vendedor chega:** O vendedor rolou o registro inteiro e quer entregar um documento ao cliente, ou levar a planilha da conta. O botão só aparece para Premium ativo ou pausado — grátis/deslogado não tem afordância nenhuma.
- **Vizinhança imediata:** Imediatamente acima da fileira de botões fica o painel "Comparar com hoje" (ou seu gatilho), e acima dele o Card da ficha técnica. À esquerda do [Exportar], [Recalcular hoje]. Por baixo da folha, o registro congelado inteiro.
- **Dados que chegam (e o que ela devolve):** O artefato é renderizado pelo SERVIDOR, e três fatos decidem a tela: o plano (pausado bloqueia tudo), a conexão (offline bloqueia tudo) e se ESTE registro já chegou à conta (sem id de servidor não há PDF — mas o CSV, que é da conta inteira, continua disponível). A precedência dos motivos é: Premium pausado > offline > registro pendente (este último aplicado só ao radio do PDF). O interruptor de custos começa DESLIGADO toda vez que a folha abre.
- **O que acontece depois:** O navegador recebe o arquivo — e o arquivo É o retorno: não existe aviso de sucesso. Se falhar, a folha PERMANECE ABERTA com as escolhas intactas e um aviso vermelho aparece (com texto próprio se o plano caiu no meio do caminho).

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Folha de exportação PDF/CSV — e o botão "Exportar" desabilitado que diz por quê

## O que desenhar
A peça é o par **gatilho + folha** que sai do detalhe de um orçamento congelado (aba Orçamentos → um
registro aberto). O gatilho é o botão `Exportar`, que vive lado a lado com `Recalcular hoje` e
`Comparar com hoje` no rodapé de ações do registro; a folha é o painel que ele abre, onde o vendedor
escolhe **o que** exportar (o PDF do orçamento para o cliente ou o CSV de todos os seus orçamentos),
decide se o PDF vai levar o detalhamento de custos, e dispara a geração. O documento é renderizado no
servidor: sem conexão ou sem o registro sincronizado não existe arquivo — e é por isso que o botão
fica **visível e desabilitado com o motivo impresso**, nunca escondido e nunca com tooltip. É a única
superfície do app cujo resultado sai do app e chega ao cliente final do vendedor.

## Por que este prompt existe
O protótipo de 2026-07-02 conhecia só o gatilho: §E6 lista "Exportar (PDF/CSV, Premium)" e a matriz §G
dá uma linha com "disabled se free | desabilitado" — dois estados, e nenhuma palavra sobre **como** se
explica um botão morto. Tudo o que veio depois foi inferido por IA sem desenho: a folha inteira, o
seletor de formato, o switch de custos, o aviso de dano, a regra "visível-e-desabilitado com a frase
impressa por baixo", e os motivos `Premium pausado` e `registro pendente` (o protótipo só conhecia
free × premium). No canvas desktop do dono (018) existem **dois** botões `Exportar` — um no cabeçalho
da aba, outro na ficha do registro — e nenhum painel, nenhum formato, nenhum aviso, nenhuma frase de
motivo. O switch que expõe a margem do vendedor ao cliente dele nunca passou por um designer.

## O que já existe hoje (não invente do zero — corrija)

**O gatilho** (`features/history/export-sheet.tsx` + `.css`)

| Elemento | Hoje |
|---|---|
| Botão | `tf-btn--secondary`, rótulo **"Exportar"**, sem ícone no app (o canvas 018 usa ícone `download`) |
| Desabilitado | `opacity: 0.55` sobre o secundário → **contraste não medido** |
| Frase do motivo | `<p>` logo abaixo, `color: var(--text-muted)`, `0.875rem`, ligada por `aria-describedby` |
| Ausência total | conta free / deslogada / sem resposta do servidor: **o botão não é renderizado** |

→ A frase do motivo é um parágrafo solto embaixo do botão, sem contêiner, sem ícone, sem tom —
idêntica a uma legenda qualquer da página. Ela precisa **ler como a explicação daquele botão**.
→ O desabilitado a 0,55 de opacidade sobre fundo escuro precisa de tratamento desenhado
(borda/superfície), não de transparência.

**A folha** (`Sheet` = `tf-dialog--sheet-right`, `width: min(92vw, 26rem)`, altura total, X de fechar
no canto). Ordem atual, de cima para baixo:

1. Título **"Exportar"** — a mesma palavra do botão que a abriu.
2. `fieldset` com legenda **"O que exportar"** e dois radios, cada linha com `min-height: 44px`:
   **"Orçamento para o cliente (PDF)"** e **"Meus orçamentos (CSV)"**.
   → São radios HTML crus dentro de uma caixa com borda; não há primitivo desenhado para essa escolha.
3. Se o PDF estiver bloqueado (registro nunca chegou ao servidor): o radio de PDF fica desabilitado e
   ganha **sua própria** frase por baixo — **"Sincronize para exportar."** — e a folha já abre com o
   CSV selecionado.
4. Só quando o formato é PDF: linha `space-between` com o rótulo **"Incluir detalhamento de custos"**
   à esquerda e o `Switch` (`tf-switch`, trilho 44×24, alvo 44×44) à direita, **desligado sempre que
   a folha abre**.
5. O aviso de dano, colado ao switch por um `margin-block-start: calc(-1 * var(--space-3))` — uma
   gambiarra de aproximação. → O desenho deve dizer como esse par (switch + consequência) se agrupa
   de verdade: mesma caixa, mesmo tom, uma unidade.
6. A descrição do que viaja no arquivo (`SheetDescription`, texto longo).
7. Botão de submit, largura natural, rótulo que muda por formato: **"Gerar PDF"** ou **"Baixar CSV"**.

→ Não existe botão "Cancelar": a única saída é o X do canto.
→ Não existe feedback de sucesso — decisão consciente registrada em comentário: *o arquivo é o
feedback*. Não invente um "pronto!", mas mostre o que acontece quando a folha fecha.

## Conteúdo e dados reais
Textos literais em pt-BR, homologados — **copie-os, não reescreva**:

- Aviso de custos, peça única: *"Seu cliente veria as linhas gravadas — material, energia, máquina,
  falhas, acabamento, mão de obra e os seus outros custos — e poderia calcular a sua margem."*
- Aviso de custos, **kit** (o documento leva UMA linha, não o detalhe peça a peça): *"Seu cliente
  veria o custo total gravado do kit — e poderia calcular a sua margem."*
- O que viaja no PDF: *"O orçamento leva: itens, quantidades, o valor cotado, a data, a validade, o
  rótulo deste registro (impresso como “Referência”), e identifica você pelo nome e e-mail da sua
  conta."*
- Nota do CSV: *"O CSV vem da sua conta: registros ainda não sincronizados não entram nele."*
- Motivos: *"Exportar precisa do Premium ativo."* · *"Exportar precisa de conexão."* ·
  *"Sincronize para exportar."*
- Falha: *"Não foi possível gerar o arquivo."* (toast, tom `danger`)

Números reais do registro que fica **atrás** da folha: valor cotado **R$ 24,24**, Material
**R$ 3,78**, Energia **R$ 0,36**, "Validade da proposta: 7 dias", rótulo editável (ex.: "Suporte de
fone — Ana"). Arquivos gerados: `orcamento.pdf` e `historico.csv`. Os avisos têm 130 e 76 caracteres
e a descrição do PDF tem 210 — numa folha de 359px de largura útil, são o teste de fogo do desenho.

## Estados obrigatórios
**Gatilho**
1. **Repouso** — secundário habilitado, sem frase por baixo.
2. **Hover / foco visível / pressionado** — três tratamentos distintos; o foco usa o anel do DS.
3. **Desabilitado por Premium pausado** — frase *"Exportar precisa do Premium ativo."* Precedência
   máxima: é o único motivo que o vendedor não resolve esperando. Duas linhas acima já existe o
   banner *"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium."* → desenhe os dois na mesma prancheta e mostre
   que **não** viram redundância barulhenta.
4. **Desabilitado por offline** — frase *"Exportar precisa de conexão."*
5. **Ausente** — conta free/deslogada: nenhum botão, nenhum espaço reservado, nenhum fantasma.

**Folha**
6. **Repouso, PDF** — radio PDF marcado, switch desligado, aviso e descrição visíveis.
7. **Repouso, CSV** — o bloco do switch e o aviso **somem** por inteiro; entra a nota do CSV. Mostre
   que o painel não fica com um buraco.
8. **PDF bloqueado (registro pendente)** — radio PDF desabilitado + *"Sincronize para exportar."*,
   CSV pré-selecionado. O motivo vale para **uma** opção, não para a folha.
9. **Switch ligado** — o aviso de dano é o mesmo texto; o que muda é o peso visual. Ligar o switch é
   uma decisão de risco: o estado ligado precisa **parecer** uma escolha assumida.
10. **Gerando** — o submit com spinner inline (`aria-busy`), rótulo mantido, cursor `progress`; os
    radios e o switch continuam onde estavam.
11. **Erro** — toast `danger` *"Não foi possível gerar o arquivo."* (ou a frase do lapso, se o
    Premium caiu no meio) e **a folha permanece aberta com as escolhas intactas**.
12. **Sucesso** — a folha fecha, sem toast. Desenhe o quadro do "depois": o registro de volta, e nada
    afirmando um arquivo que o app não consegue verificar.

## Viewports
- **Mobile 390px** — obrigatório: é onde o vendedor está. A folha ancorada à direita ocupa 92vw
  (≈359px) em altura total. → Avaliar no desenho se o mobile deveria usar a variante **bottom sheet**
  do primitivo (`tf-dialog--sheet-bottom`, `max-height: 85vh`), que o DS já tem, em vez da lateral.
- **Desktop 1280px** — o corte do redesenho 018. A folha (máx. 26rem = 416px) sobre a ficha do
  registro à direita. Mostre o gatilho **na ficha**, no rodapé de ações, junto de `Recalcular hoje`,
  `Comparar com hoje` e `Excluir`.
- 1920px reaproveita o 1280 sem mudança de composição — não precisa de prancheta própria.

## Regras que o desenho não pode quebrar
- **A frase do motivo nunca é tooltip e nunca é placeholder.** Num aparelho de toque não há hover, e
  um botão morto sem explicação lê como bug. A frase é texto persistente, em elemento de largura
  cheia (lição 016: frase honesta cortada em sufixo de placeholder já custou uma homologação).
- **Freemium é binário e o servidor é quem diz.** Free não vê o botão; `lapsed` vê o botão desabilitado
  com o motivo. Nunca inventar um estado "quase premium".
- **Falha de rede nunca é vendida como falta de Premium** — e vice-versa: são duas frases diferentes,
  e o lapso vem antes do offline na precedência.
- **A consequência mora ao lado do controle que a causa.** O aviso de exposição de margem não pode
  virar link "saiba mais", nota de rodapé, nem sumir num acordeão.
- **A palavra "margem" só aparece no aviso** — ela nunca é uma linha impressa no PDF.
- Alvos ≥44px em cada linha de radio e no switch; contraste medido contra o fundo real da folha,
  incluindo o texto `--text-muted` dos avisos e o botão desabilitado.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado.** Os três textos longos em 359px são a situação exata que
  já estourou o layout duas vezes (100,5px de overflow com botão nascido fora da viewport, E6 PR-B).
- **Texto ocluso passa em teste.** `toBeVisible` aprova um elemento coberto ou fora da área rolável;
  valide onde o submit cai quando o aviso longo empurra tudo para baixo.
- **Margem negativa de aproximação não é agrupamento.** O `-space-3` que puxa o aviso para junto do
  switch é o sintoma de um grupo que nunca foi desenhado.
- **Toast que nunca renderiza.** Já houve aqui um diálogo desmontando antes do callback e a mensagem
  nunca aparecendo. O toast de erro depende de a folha continuar aberta — mostre onde ele cai em
  relação a ela, e que não fica atrás dela.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não afterthought)**:
(1) gatilho — repouso, hover, foco, pressionado, mobile e desktop; (2) gatilho desabilitado —
Premium pausado com o banner acima, e offline; (3) folha PDF em repouso, switch desligado, em 390px e
1280px; (4) folha com o switch ligado; (5) folha em CSV; (6) folha com o PDF bloqueado por registro
pendente; (7) gerando + erro, com o toast sobre a folha aberta.

Reutilize os primitivos existentes, sem criar novos: `Button` (`tf-btn--secondary` no gatilho,
`tf-btn--primary` no submit, com o estado `loading`), `Sheet`/`SheetContent` (`tf-dialog--sheet`) com
`SheetTitle` e `SheetDescription`, `Switch` (`tf-switch`), `Alert` (`tone="info"`) para o banner de
lapso, `toast` (`tone="danger"`) para a falha, e o anel de foco do DS. Se a escolha de formato pedir
um controle melhor que dois radios crus, avalie primeiro o `Segmented` (`tf-segmented`) que já existe
— e diga por que serve ou não serve para uma escolha em que uma das opções pode estar desabilitada
com motivo próprio.

## Perguntas em aberto para o dono
1. **O canvas desktop 018 tem um segundo botão `Exportar` no cabeçalho da aba Orçamentos** (com
   `disabled={{ writeBlocked }}`), que não existe no app. Ele é o atalho do **CSV da conta inteira**?
   Se for, ele abre a mesma folha (com o PDF sempre bloqueado, porque não há registro escolhido) ou
   baixa o CSV direto? E a frase do motivo dele é qual?
2. **A folha no mobile deve virar bottom sheet?** O primitivo já suporta; a lateral em 92vw foi
   herdada, não escolhida.
3. **Falta uma saída explícita.** A folha só fecha pelo X. Entra um "Cancelar" ao lado do submit, ou
   o X é a decisão?
4. **O switch de custos deveria pedir confirmação?** Hoje é um toque só, e o dano é irreversível
   depois que o PDF chega ao cliente. Manter um toque (com o aviso ao lado) ou exigir um segundo
   passo é decisão de produto, não de desenho.

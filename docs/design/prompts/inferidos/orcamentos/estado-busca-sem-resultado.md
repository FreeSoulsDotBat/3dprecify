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

- **Onde vive:** No corpo da lista de /historico, no lugar exato onde estariam os cards: logo abaixo da barra de filtros, centralizado. É um EmptyState com o ícone de histórico, cujo TÍTULO é a frase inteira com o termo interpolado ("Nenhum registro encontrado para “{termo}”."), SEM descrição nenhuma, seguido de um botão secundário "Limpar busca".
- **Como o vendedor chega:** O vendedor digitou o nome de um cliente no campo "Buscar por rótulo", ou escolheu um período, e a leitura filtrada não trouxe nada.
- **Vizinhança imediata:** Acima: a barra de filtros com o termo ainda no campo e o chip de período ainda marcado — e, acima dela, as faixas de aviso. Abaixo: nada; o [Carregar mais] não existe aqui.
- **Dados que chegam (e o que ela devolve):** O "termo" é o valor EFETIVO sob o qual a lista foi lida (o termo já assentado, não a tecla recém-digitada); num filtro só de período, ele vira o intervalo formatado ("01/07/2026 – 31/07/2026"). A distinção entre este estado e o vazio frio é rigorosa: uma lista vazia SOB filtro é sempre uma busca que não achou, nunca "você não tem orçamentos" — mas os dois usam o MESMO ícone e o mesmo componente. O estado não mostra quais filtros estão em vigor.
- **O que acontece depois:** "Limpar busca" zera os TRÊS de uma vez (termo, período e intervalo) e a lista completa volta. O outro caminho de limpeza — o "Limpar filtro" da linha do intervalo, na barra acima — faz coisa diferente: só volta o período para "Tudo".

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Busca sem resultado na aba Orçamentos

## O que desenhar
O estado que a lista de **Orçamentos** (os registros congelados de preço) mostra quando o vendedor busca por um rótulo — "Cliente, pedido…" — ou aperta um filtro de período e **a lista volta vazia**. Quem usa é um vendedor que tem histórico, está procurando um orçamento específico para reenviar a um cliente, e precisa entender em dois segundos que *a busca* não achou — e não que *o histórico dele sumiu*. A peça vive dentro da lista, logo abaixo da barra de filtros (que continua visível, com o termo ainda digitado no campo), tanto no mobile quanto na coluna esquerda do mestre-detalhe do desktop.

## Por que este prompt existe
Nenhum protótipo desenhou busca em Orçamentos, então o vazio-de-busca também nunca foi desenhado. O que foi desenhado e homologado é o **vazio frio** ("Seus cálculos salvos aparecem aqui" + CTA, item 18 dos fixes do protótipo). O vazio de busca foi decidido **em cima dele, em código**: mesmo componente, mesmo ícone `history`, a frase inteira empurrada para o título e sem corpo. E o próprio código registra que essa confusão já custou um bug: ler o campo cru em vez do valor com debounce "flashava a tela fria de você-não-tem-histórico durante os 250 ms". O desenho tem que resolver o que o debounce só remendou — as duas telas continuam com a mesma arte.

## O que já existe hoje (não invente do zero — corrija)

A barra de filtros, que permanece visível durante o vazio:

| Elemento | Texto literal hoje | Observação |
| --- | --- | --- |
| Campo de busca | rótulo "Buscar por rótulo", placeholder "Cliente, pedido…" | `type=search`, limite de 120 caracteres, debounce de 250 ms |
| Chips de período | "Tudo" · "30 dias" · "90 dias" · "Período…" | o ativo vira botão primário; quebram em várias linhas em 390px |
| Chip do período custom | "Período: {de} – {ate}" + "Limpar filtro" | aparece só quando há intervalo escolhido |

O estado vazio de busca, hoje:

- Ícone `history` (**o mesmo do vazio frio** → problema central: o vendedor vê a mesma arte para "você não tem nada" e "sua busca não achou").
- Título: **"Nenhum registro encontrado para “{termo}”."** — frase inteira, com ponto final, no lugar do título → problema: título comprido, sem corpo, e o Catálogo do mesmo app faz o oposto ("Nada encontrado para essa busca" + "Tente outro termo, ou limpe a busca para ver tudo de novo.").
- Botão secundário **"Limpar busca"**, colocado **fora** do bloco vazio (no Catálogo ele fica dentro, como ação do próprio estado) → problema: duas telas irmãs com anatomias diferentes.
- Não mostra **quais filtros estão em vigor** — se a busca está vazia e só o período filtra, o `{termo}` vira o rótulo do período.

Comparação obrigatória — o vazio frio, que **não é** esta peça: ícone `history`, título "Nenhum registro ainda", corpo "Calcule uma peça ou um kit e toque em “Salvar em Orçamentos” para guardar o preço com a data.", botão "Ir para a calculadora".

→ **Defeito real a corrigir no desenho do desktop:** no mestre-detalhe (≥1280px), quando a busca não acha nada a coluna esquerda mostra o vazio de busca **e a coluna direita mostra o vazio FRIO** ("Nenhum registro ainda" + "Calcule uma peça…"). Metade da tela afirma exatamente a mentira que o debounce existiu para evitar.

## Conteúdo e dados reais
- `{termo}` é o texto **efetivamente buscado** (o valor com debounce), entre aspas curvas: `Nenhum registro encontrado para “Loja do Marcos”.` Pode ter até 120 caracteres — desenhe com um termo longo de verdade, colado sem espaços, além do exemplo curto.
- Quando a busca está vazia e o filtro é só de período, `{termo}` vira o rótulo do período: `“30 dias”`, `“90 dias”` ou o intervalo custom. → **O intervalo custom sai hoje no formato do campo de data (“2026-07-01 – 2026-07-31”), não em pt-BR** — a ficha da auditoria supôs "01/07/2026 – 31/07/2026", que é o que deveria aparecer.
- Quando os dois filtros estão ativos (termo + período), a frase nomeia **só o termo** — o período em vigor fica invisível para quem lê o vazio.
- Os registros que a busca não achou são orçamentos congelados: cada card traz a data acima do dinheiro ("Cotado em 14/07/2026"), o rótulo do vendedor, "Valor cotado" **R$ 1.234,56** e a legenda da base ("preço de varejo" / "preço de atacado"). Nada disso aparece no vazio — mas é o vocabulário do entorno.
- Registros ainda **não sincronizados nunca são filtrados**: eles continuam na lista mesmo sob busca. Ou seja, "vazio de busca" só existe quando não há nem fila pendente casando.

## Estados obrigatórios
1. **Repouso (busca por termo)** — a frase com o termo, a ação de limpar, a barra de filtros acima ainda mostrando o que foi digitado.
2. **Repouso (só período)** — mesma peça nomeando o período; o chip do período segue ativo/primário acima.
3. **Termo + período juntos** — o desenho precisa dizer os dois filtros em vigor, não só um.
4. **Termo longo (120 caracteres)** — o pior caso do título, sem estourar a coluna de 520px do desktop nem os 390px do mobile.
5. **Carregando (250 ms de debounce e a leitura seguinte)** — hoje entra um spinner centralizado e o vazio some; desenhe o que o vendedor vê entre a tecla e a resposta, sem piscar o vazio frio.
6. **Foco / hover / pressionado / desabilitado do botão "Limpar busca"** — alvo ≥ 44px, foco visível contra o fundo real do bloco.
7. **Vazio frio (contraste explícito)** — desenhe-o lado a lado com o de busca **na mesma prancheta**, para provar que os dois não se confundem: se só a frase muda, o desenho falhou.
8. **Offline com filtro ativo** — hoje a busca é uma leitura no servidor e o cache do aparelho é só o histórico **sem filtro**; offline, a lista filtrada não cai no cache e a tela mostra o muro vermelho "Não foi possível carregar seus orçamentos." + "Tentar novamente". → Desenhe o estado honesto que falta: *buscar precisa de conexão; seus registros continuam aqui sem filtro*.
9. **Premium pausado** — o banner informativo "Premium pausado — seus registros continuam aqui e podem ser abertos..." fica acima; o vazio de busca não muda de tom por causa disso.
10. **Coluna direita do desktop sem registro escolhido** — o que ela mostra quando a busca não achou nada (ver defeito acima).

## Viewports
- **Mobile 390px** — é onde a peça nasceu: filtros empilhados, chips quebrando em duas linhas, o vazio ocupando a largura toda.
- **Desktop 1280px** — o mestre-detalhe: lista de largura fixa **520px** à esquerda, registro à direita. É o corte em que o vazio de busca e o vazio frio aparecem **ao mesmo tempo** na tela, cada um numa coluna. Desenhar este é obrigatório.
- **Desktop 1920px** — só se a proporção mudar algo; a coluna da lista continua 520px, então o que cresce é o registro.

## Regras que o desenho não pode quebrar
- **Uma busca que não acha nunca pode parecer perda de dados.** Arte, ícone e tom precisam separar "não achei com esse filtro" de "você não tem nada".
- **Falha de rede não é resultado vazio.** Offline/erro nunca podem ser desenhados como "nenhum registro encontrado".
- **A frase honesta mora em elemento de largura cheia**, nunca em placeholder e nunca truncada — placeholder carrega número, não explicação.
- **O caminho de volta é sempre alcançável**: limpar a busca (e o período) sem ter que adivinhar; alvo ≥ 44px.
- **Nada de inventar registro para preencher** a coluna direita do desktop.
- Contraste medido contra o fundo real do card/coluna, em tema escuro **e** claro.

## Armadilhas já pagas neste projeto
- **Texto ocluso ou estourado passa em teste**: `toContainText` aprova um título que vazou da coluna. O termo de 120 caracteres é o caso adversarial obrigatório — meça a caixa, não a string.
- **Overflow horizontal medido nos dois eixos** (o headless não enxerga barra clássica; o item 9 do 016 morreu no eixo vertical).
- **Divergência entre telas irmãs**: Catálogo e Orçamentos resolvem o mesmo problema de duas formas; escolha uma anatomia e diga qual, sem inventar copy nova para o Catálogo aqui.
- **Piscar o estado errado durante o debounce** foi bug real; o desenho da transição é parte da entrega.

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (first-class)**:
1. Mobile 390px — vazio de busca por termo, com a barra de filtros acima.
2. Mobile 390px — vazio por período e vazio com termo+período (pode ser uma prancheta com dois blocos).
3. Mobile 390px — comparação vazio de busca × vazio frio, lado a lado.
4. Mobile 390px — offline/erro com filtro ativo (o estado honesto proposto).
5. Desktop 1280px — mestre-detalhe inteiro com a busca sem resultado: coluna esquerda **e** o que a direita passa a dizer.
6. Estados do botão "Limpar busca": repouso, hover, foco, pressionado.

Reutilize os primitivos existentes, sem criar novos: o bloco vazio é o `EmptyState` (ícone + título + descrição + ação — use a **descrição** e o slot de **ação**, hoje ignorados nesta tela); o botão de limpar é `Button variant="secondary"`; os chips de período são `Button size="sm"` primário/secundário; o campo é `tf-input` dentro de `Field`; o aviso de offline/pausado é `Alert` (tom `info` para offline, `danger` só para falha real); o carregando é `Spinner`. Se o ícone `history` precisar de um irmão para "busca sem resultado", proponha-o como variante do conjunto de ícones da DS, não como ilustração avulsa.

## Perguntas em aberto para o dono
1. O vazio de busca deve **listar os filtros em vigor** (termo + período) ou só nomear o termo? Hoje só o termo aparece, e um período ativo fica invisível.
2. O estado deve oferecer **limpar só a busca** e **limpar tudo** como duas ações, ou um único "Limpar busca" que já zera o período (o que ele faz hoje, apesar do rótulo dizer só "busca")?
3. Offline com filtro ativo: mostrar a lista **sem filtro** com um aviso ("buscar precisa de conexão"), ou não mostrar lista nenhuma e só o aviso?
4. Orçamentos e Catálogo devem convergir para a **mesma frase** de busca vazia ("Nada encontrado para essa busca" + corpo), ou o Orçamentos mantém a frase com o termo citado?

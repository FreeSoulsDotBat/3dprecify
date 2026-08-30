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

- **Onde vive:** Um diálogo modal central, disparado pelo botão secundário [Recalcular hoje] — o PRIMEIRO da fileira final do registro congelado, à esquerda de [Exportar]. Conteúdo, de cima para baixo: título "Recalcular hoje" · uma de DUAS descrições alternativas · a nota de catálogo offline em texto cinza pequeno · um alerta informativo sobre o modelo aposentado · e o par [Voltar] / [Recalcular] alinhado à direita.
- **Como o vendedor chega:** O vendedor está no fim do registro (muitas vezes depois de abrir "Comparar com hoje") e decide gravar o preço de hoje. O botão só existe com Premium ATIVO — em Premium pausado ele desaparece e a faixa calma no topo explica por quê.
- **Vizinhança imediata:** Por baixo do diálogo fica o registro congelado inteiro, com o painel de comparação possivelmente aberto. À direita do botão que o abre, [Exportar] com sua eventual frase de motivo.
- **Dados que chegam (e o que ela devolve):** Ao ABRIR, o pricing-core reprecifica uma vez. O resultado decide a redação: se a origem foi encontrada e repreçou de verdade, o texto diz que isso cria um NOVO registro com os valores do catálogo de hoje e que o registro de {data} continua como está; se a origem não foi localizada, o texto avisa que dá para recalcular usando os valores guardados e a fórmula atual, mas que isso NÃO reflete os preços de hoje. O número resultante NÃO é mostrado antes de confirmar.
- **O que acontece depois:** [Recalcular] grava um registro NOVO (mesmo caminho de fila da folha de gravação), com a mesma base do original, e um aviso efêmero diz onde ele chegou. O registro original fica intocado. Se a origem não repreçou, o registro novo nasce carregando a marca disso — que vira a legenda de reaproveitamento na leitura.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Diálogo "Recalcular hoje" — confirmar a criação de um novo orçamento

## O que desenhar

O diálogo modal central que aparece quando o vendedor, olhando um **orçamento congelado** já salvo
(aba Orçamentos → detalhe do registro), toca em **"Recalcular hoje"**. A ação não altera o registro
aberto: ela **cria um registro novo e permanente**, com os valores do catálogo de hoje, herdando o
mesmo rótulo do original. O diálogo é o único momento em que dá para desistir — depois de confirmar,
o registro é imutável (não existe editar nem desfazer; só existe excluir). Quem usa é o vendedor que
cotou para um cliente semanas atrás e quer saber/registrar quanto cobraria hoje.

## Por que este prompt existe

O diálogo **nunca foi desenhado**. O gatilho está (`Abas-Desktop.dc.html`, `tf-btn--secondary`
"Recalcular hoje" na ficha do registro), mas aquele arquivo não tem um único diálogo, e o protótipo de
2026-07-02 é anterior à função — "Recalcular hoje" nasceu em 15/07/2026 e a tela de histórico do
protótipo oferece só [Duplicar]/[Exportar]. A única autoridade é texto ASCII (`ux-history.md` §4.4 +
§10-F3). Tudo o que é forma foi inferido pela IA que implementou: dois pesos visuais diferentes para
dois avisos igualmente decisivos, e — o ponto mais grave — **o resultado do recálculo não aparece
antes de gravar**: o vendedor assina em branco e só descobre o número por um toast.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/historico/recalc-today.tsx` (+ `compare-today.tsx` no mesmo detalhe).
Estrutura atual do diálogo, na ordem em que aparece:

| # | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título (`tf-dialog__title`, caixa alta) | "Recalcular hoje" |
| 2 | Descrição — caso A, **repreçou de verdade** | "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de 08/08/2026 continua como está." |
| 2' | Descrição — caso B, **origem não encontrada** | "Não foi possível localizar a origem deste registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro e a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." |
| 3 | Aviso de offline (só sem conexão) | "Sem conexão: usando os valores do catálogo salvos neste aparelho, que podem estar desatualizados." |
| 4 | Aviso estrutural (só quando repreçou e o congelado é de modelo aposentado) | "O valor congelado foi calculado pelo modelo 3.1.0, que incluía o campo Desperdício. O modelo atual não tem mais esse campo — parte da diferença acima pode vir daí." |
| 5 | Ações, alinhadas à direita | [Voltar] (`tf-btn--secondary`) · [Recalcular] (`tf-btn--primary`) |

→ **Não existe número nenhum no diálogo.** Nem o valor do registro original, nem o valor que será
gravado. Ele já foi calculado quando o diálogo abriu — está pronto, só não é mostrado. Resolva isso.
→ **O aviso 4 mente por dangling**: a frase diz "parte da **diferença acima** pode vir daí" e acima
dela não há diferença nenhuma. Essa copy foi escrita para o bloco "Comparar com hoje" (que mostra dois
números) e reaproveitada aqui. Ou o diálogo passa a ter os números, ou a frase precisa mudar.
→ **Dois pesos visuais para dois avisos igualmente decisivos**: o offline é um `<p>` mudo, cinza,
13px, sem ícone; o estrutural é `tf-alert--info` com ícone e caixa. Nada justifica a diferença.
→ **O diálogo não tem X de fechar** (`showClose={false}`); Esc e clique no scrim fecham. E [Voltar]
não desabilita durante a gravação: dá para fechar no meio da escrita.
→ **Falha na gravação não aparece no diálogo**: sai um toast vermelho de 5s ("Não foi possível
guardar o registro neste aparelho. Ele não foi salvo.") e o diálogo **continua aberto**, sem marca
nenhuma do que houve. Este projeto já pagou por confiar em toast: um toast que nunca renderizou
sustentava a única confirmação de uma ação.
→ Nada diz que o novo registro **herda o rótulo** do original ("Cliente Ana · pedido 132") e que a
**validade da proposta não é herdada** (começa em branco).

## Conteúdo e dados reais

- Registro de exemplo (use estes números): rótulo **"Cliente Ana · pedido 132"**, "Cotado em
  08/08/2026 às 14:20", tipo "Peça única", base **"preço de varejo"**, valor cotado **R$ 196,44**.
  Valor recalculado hoje, exemplo: **R$ 213,90**. Um segundo exemplo, kit: "Kit suporte + base",
  "Kit · 3 peças", **R$ 512,80** → **R$ 498,15** (o valor pode CAIR — não desenhe só o caso de alta).
- Vocabulário fixado no produto: o número antigo é **"Valor cotado"** com a data; o número novo é
  **"Hoje"**. Legenda de base sempre presente: "preço de varejo" / "preço de atacado". Os dois números
  são SEMPRE da mesma base — nunca varejo contra atacado.
- **O app não calcula a diferença** entre os dois (aritmética de dinheiro mora no motor de preço).
  Não desenhe "+8,9%" nem seta de variação sem que o dono decida (ver Perguntas em aberto).
- No caso B (origem sumiu), o valor gravado é **igual** ao congelado (R$ 196,44) — e o registro criado
  carrega para sempre a legenda "Estes valores foram reaproveitados de um congelamento anterior — a
  origem não estava disponível para repreçar."
- Textos dos toasts pós-confirmação (não invente outros): sucesso "Registro salvo em Orçamentos." ·
  pendente "Pendente neste dispositivo. Sincroniza sozinho quando houver conexão." · bloqueado "Envio
  pausado — o Premium não está ativo. O registro continua neste aparelho." · falha do servidor "Não
  foi possível registrar. O servidor não aceitou este registro." O toast é só mensagem: **não tem
  botão nem link**, e some sozinho em 5s.

## Estados obrigatórios

1. **Repouso — caso A (repreçou)**: descrição do item 2 + os dois números (cotado × hoje) + base.
2. **Repouso — caso B (origem não encontrada)**: descrição 2' + o valor que será gravado, dito como
   reaproveitado, não como "preço de hoje".
3. **Offline** (pode acontecer em A e em B): aviso do item 3. É informação, não erro — mas precisa o
   mesmo peso do aviso estrutural.
4. **Modelo aposentado** (só em A): aviso do item 4, empilhado abaixo do offline. Desenhe o caso
   **os dois avisos juntos** — é o pior caso de altura e ele existe.
5. **Confirmando**: [Recalcular] com spinner (`tf-btn--loading`, rótulo permanece), [Voltar] inerte,
   scrim ainda bloqueando. Nada de diálogo que pisca duas vezes.
6. **Falha ao gravar**: o diálogo **permanece aberto** e mostra a falha dentro dele (`tf-alert--danger`
   com a frase literal "Não foi possível guardar o registro neste aparelho. Ele não foi salvo."), com
   o botão voltando a ser acionável para tentar de novo.
7. **Foco**: primeiro foco visível ao abrir, anel roxo de 3px, e mostre o percurso Tab entre
   [Voltar] e [Recalcular].
8. **Premium pausado / plano ainda verificando**: o gatilho "Recalcular hoje" **simplesmente não
   existe** — a ação é escrita e escrita exige Premium ativo; o aviso de plano pausado já está na
   página. Desenhe a ficha do registro **sem** o botão, mostrando que os botões restantes
   (Exportar · Comparar com hoje) não dançam de posição quando ele aparece/some.

## Viewports

- **Mobile 390px** — obrigatório: é o uso principal e o pior caso de altura (modal de 358px de largura,
  teto de 85% da tela, com título + descrição longa do caso B + dois avisos + dois botões).
- **Desktop 1280px** — obrigatório: o diálogo abre sobre o mestre-detalhe de Orçamentos (lista à
  esquerda, ficha do registro à direita), largura travada em 512px, centralizado sobre o scrim.
- **1920px** não precisa de prancheta própria: o modal continua com 512px e só o scrim cresce.

## Regras que o desenho não pode quebrar

- **Procedência em todo número**: o valor antigo sempre vem com a data ("Cotado em 08/08/2026"); o
  novo sempre com "Hoje". Dois valores nus lado a lado são um enigma, não uma informação.
- **Falha de rede nunca é upsell**: offline aqui significa "catálogo salvo neste aparelho, pode estar
  desatualizado" — nunca "isso é Premium".
- **Degradação dita, não escondida**: no caso B o diálogo tem de deixar claro que o registro novo vai
  ter a data de hoje com números de antes.
- **A frase honesta mora em elemento de largura total** — os dois avisos ocupam a largura do diálogo,
  nunca ficam espremidos ao lado de um botão.
- **Alvo ≥44px** nos dois botões, inclusive a 390px, onde eles dividem a linha.
- **Contraste medido contra o fundo real** do diálogo (`--surface-card`), não contra a página atrás do
  scrim — vale especialmente para o cinza do aviso de offline. Um acento por zona: [Recalcular] é o
  único botão de acento.

## Armadilhas já pagas neste projeto

- **Botão que nasce fora da tela**: o modal rola por dentro (teto de 85% da altura). Com descrição
  longa + dois avisos, a linha de ações pode ficar abaixo da dobra do próprio diálogo. Desenhe a
  solução (rodapé fixo dentro do modal ou a garantia de que a pilha cabe) e mostre o pior caso medido.
- **Toast como única confirmação**: já houve um toast que nunca renderizou porque o diálogo desmontava
  antes. Tudo que é decisivo (a falha, e idealmente o número gravado) precisa existir **no diálogo**.
- **Valor grande que estoura a linha**: teste com R$ 12.480,75 nos dois números lado a lado a 390px —
  números tabulares, sem quebrar a linha no meio do valor.
- **Texto ocluso passa em teste**: o aviso estrutural é longo (duas linhas no desktop, quatro a
  390px). Mostre-o inteiro, sem corte, sem "…".

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como par de cada uma**:

1. 390px — caso A em repouso, com os números cotado × hoje.
2. 390px — caso A com **offline + aviso estrutural empilhados** (pior caso de altura, com a régua da
   altura visível).
3. 390px — caso B (origem não encontrada).
4. 390px — confirmando (spinner) e falha ao gravar (alerta dentro do diálogo) — pode ser uma prancheta
   com os dois quadros.
5. 1280px — caso A sobre o mestre-detalhe de Orçamentos, com foco visível em [Recalcular].
6. 1280px — a ficha do registro **sem** o botão (Premium pausado), provando que o resto não se desloca.

Componha com os primitivos existentes, sem criar novos: `tf-dialog` (modal central) com
`tf-dialog__title` e `tf-dialog__desc`; os dois valores como duas linhas rotuladas em `tf-card--flat`
ou `tf-brow`, com `tf-tnum` nos números — **não** use `tf-price` aqui (o herói de preço é da
calculadora, e este número é um registro, não um preço vivo); `tf-alert--info` para offline e para o
aviso estrutural (mesmo peso para os dois); `tf-alert--danger` para a falha de gravação;
`tf-btn--secondary` em [Voltar] e `tf-btn--primary` (+`--loading`) em [Recalcular]. Sem grafismo aqui:
o floreio orgânico é de tela cheia, não de modal de confirmação.

## Perguntas em aberto para o dono

1. **Mostrar o número novo antes de gravar** resolve a assinatura em branco, mas o bloco "Comparar com
   hoje", logo acima na mesma página, existe justamente para mostrar esse par sem gravar nada. O
   diálogo passa a repetir a comparação, ou o fluxo vira "compare primeiro, recalcule depois" (e aí o
   diálogo só confirma)?
2. **A diferença entre os dois valores** (em R$ e/ou %) deve aparecer? Hoje o app se recusa a
   calculá-la fora do motor de preço; se a resposta for sim, é mudança de produto, não de desenho.
3. **O rótulo herdado** ("Cliente Ana · pedido 132") deve ser apenas informado no diálogo, ou editável
   ali mesmo — já que dois registros com o mesmo nome vão conviver na lista?
4. Depois de confirmar, o vendedor **continua no registro antigo** e o novo aparece em outro ponto da
   lista. Deve haver um caminho imediato para o registro recém-criado? (O toast atual não comporta
   link, então isso mudaria o desenho.)

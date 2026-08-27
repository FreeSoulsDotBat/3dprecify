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

- **Onde vive:** O MESMO par de botões pequenos renderizado em dois lugares muito diferentes: (a) no PÉ do card da lista — dentro de um card que é inteiramente um link clicável — logo abaixo da legenda da base; e (b) no FIM do alerta de sincronização dentro do registro congelado, depois da ressalva de durabilidade, do código de suporte e do link "Entrar de novo". O par é [Tentar agora|Tentar novamente] (secundário) + [Descartar] (vermelho SÓLIDO). O descarte abre um diálogo central: "Descartar este registro?" / "Ele não foi enviado para a sua conta e não poderá ser recuperado." + [Voltar]/[Descartar].
- **Como o vendedor chega:** Sem gesto: os botões aparecem sozinhos no card (e no alerta) de todo registro travado — Premium não ativo, sessão expirada, ou recusa do servidor. Um pendente saudável NÃO os recebe no card: ele é drenado pelo banner do topo.
- **Vizinhança imediata:** No card: colados abaixo da linha "Valor cotado" e da legenda da base, dentro da mesma borda que navega ao ser tocada — por isso cada botão precisa engolir o toque para não abrir o registro por acidente. No alerta do registro: o último elemento de uma pilha de até quatro.
- **Dados que chegam (e o que ela devolve):** O estado de sincronização decide o rótulo do retry ("Tentar agora" para pendente, "Tentar novamente" nos demais) e se o retry aparece: um pendente OFFLINE não ganha botão de tentar, porque tentar não faria nada.
- **O que acontece depois:** [Tentar] recoloca a entrada na fila e dispara a drenagem; em caso de sucesso o card perde o badge e os botões, sem nenhum outro aviso. [Descartar], depois da confirmação, apaga a entrada da fila do aparelho — e ela não volta de lugar nenhum.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Ações do registro travado — [Tentar novamente] / [Descartar] e a confirmação do descarte

## O que desenhar
O par de ações que um orçamento **preso na fila** oferece ao vendedor, e o diálogo que confirma o
descarte. Um orçamento é salvo primeiro no aparelho e só depois enviado para a conta; quando esse
envio não acontece — Premium não ativo, sessão expirada, servidor recusou — o registro fica travado.
Sem uma saída ali, ele nunca sincroniza e nunca some: envenena todo sign-out futuro (o app volta a
avisar "você tem registros não sincronizados" para sempre). O mesmo par aparece em **dois lugares**
da aba Orçamentos: dentro do card da lista (que é inteiro clicável e abre o registro) e dentro do
alerta de estado, na tela/coluna de detalhe. Quem usa: o vendedor, no momento em que descobre que a
cotação que ele acabou de fazer não subiu.

## Por que este prompt existe
A peça nasceu de texto (`ux-history.md` §1.5 dá só a copy da confirmação; §9.2/G5 diz "Dialog +
Button danger" como padrão dos confirms destrutivos) e de uma revisão de código — nunca de um
desenho. Nenhuma das três autoridades desenhadas tem fila, logo nenhuma tem ação de fila: o protótipo
§E6 é lista mock + vazio + detalhe + Exportar, a matriz §G do Histórico não tem coluna para isto, e o
card do canvas do dono (linhas 281–292) foi relido botão a botão — tem rótulo, badge, meta e a linha
de dinheiro, e **nenhum botão dentro**. Ou seja: a decisão de enfiar dois botões, um deles destrutivo
e vermelho sólido, dentro de um card inteiramente clicável em 390px, foi tomada por uma IA sem
desenho.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/entry-actions.tsx`, com os contextos em
`pages/historico/historico-page.tsx` (card da lista) e `pages/historico/snapshot-detail-page.tsx`
(alerta do detalhe).

| Contexto | O que envolve os botões | Estados em que aparecem |
|---|---|---|
| Card da lista | um card que é **um link inteiro** — qualquer toque abre o registro | só travado: Premium pausado, sessão expirada, recusado pelo servidor |
| Alerta do detalhe | bloco de alerta (tom informativo, ou vermelho quando recusado), abaixo do texto do estado | todos os não sincronizados, **inclusive o apenas pendente** |

Comportamento e textos literais de hoje:

- Botão de retry com rótulo **variável**: "Tentar agora" quando o registro está apenas pendente
  (acontece só no detalhe) e "Tentar novamente" nos demais casos. → dois rótulos para a mesma ação,
  diferença que ninguém desenhou nem explicou.
- O retry **some** quando o registro está pendente e o aparelho está offline (um retry offline não
  faria nada). → o botão desaparece sem dizer por quê, e o vizinho "Descartar" pula de lugar.
- Botão "Descartar" em vermelho **sólido**, dentro do card. → é este o problema central: vermelho
  cheio, alvo de 44px, dentro de uma área em que qualquer toque navega. O DS já tem o precedente da
  correção — a variante contornada vermelha nasceu em 2026-08-03 exatamente para "o destrutivo que
  NÃO é a ação padrão".
- Confirmação (diálogo centralizado, sem botão de fechar): título "Descartar este registro?", corpo
  "Ele não foi enviado para a sua conta e não poderá ser recuperado.", e no rodapé, à direita,
  "Voltar" (contornado) + "Descartar" (vermelho sólido).
- Os dois botões engolem o clique para o card não navegar. Isso é invisível no desenho, mas explica
  por que eles precisam de **folga clara** em volta — o dedo erra por milímetros.
- Não há nenhuma confirmação de sucesso: depois de "Tentar novamente" a lista só se refaz. Se deu
  certo, a insígnia some; se falhou de novo, a insígnia vira "Não foi possível registrar". → o
  desenho precisa dizer o que aparece durante e depois.
- No desktop (≥1280px) a aba é mestre-detalhe: lista à esquerda (520px em 1920px), registro à
  direita. O **mesmo registro** mostra o par de botões duas vezes ao mesmo tempo — no card marcado e
  no alerta da direita. → ninguém desenhou essa duplicação.

## Conteúdo e dados reais
- Card em volta (para compor a prancheta): rótulo do registro (uma linha, corta com reticências),
  insígnia de estado, "Cotado em 12/08/2026 · Peça única", e a linha de dinheiro "Valor cotado" à
  esquerda com **R$ 24,24** à direita, e abaixo a legenda "preço de varejo".
- Insígnias por estado (texto exato): "Pendente neste dispositivo" · "Envio pausado · precisa de
  Premium" · "Envio pausado · sessão expirada" · "Não foi possível registrar".
- Alertas do detalhe (título + corpo, verbatim): "Ainda não sincronizado" / "Este registro está só
  neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar
  online." · "Envio pausado" / "Este registro não foi enviado para a sua conta: o Premium não está
  ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é
  enviado automaticamente." · "Sessão expirada" / "Este registro não foi enviado para a sua conta:
  sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo." · "Não foi
  possível registrar" / "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você
  pode tentar de novo ou descartar."
- No estado recusado o alerta ainda imprime, em texto secundário, "Código de suporte: 422".
- No estado de sessão expirada existe, ao lado das ações, um link com cara de botão contornado:
  "Entrar de novo".
- Nada aqui é editável e nada tem unidade: são duas ações e uma confirmação. Os únicos números na
  peça são o valor cotado do card e o código de suporte.

## Estados obrigatórios
1. **Repouso — pendente (só no detalhe, online):** "Tentar agora" contornado + "Descartar".
2. **Repouso — pendente e offline:** o retry **não existe**; sobra "Descartar" sozinho. Desenhe como
   fica esse alinhamento solitário — é o estado mais fácil de errar.
3. **Repouso — Premium pausado / sessão expirada / recusado:** "Tentar novamente" + "Descartar",
   no card e no alerta.
4. **Foco por teclado** em cada botão — anel visível sobre o fundo do card E sobre o fundo do alerta
   (os dois fundos são diferentes; meça os dois).
5. **Hover** (desktop) e **pressionado** (leve escala no toque) — inclusive mostrando que o hover do
   botão **não** acende o card inteiro por baixo.
6. **Retry carregando:** rodinha dentro do botão, rótulo mantido, botão inerte.
7. **Descarte carregando:** o mesmo, no botão de confirmar do diálogo.
8. **Diálogo de confirmação** em repouso, com o foco no botão seguro.
9. **Depois do descarte, no desktop:** o registro aberto à direita deixou de existir — a coluna passa
   a mostrar o aviso "Registro não encontrado." Desenhe esse encadeamento.
10. **Depois de um retry que falhou de novo:** a insígnia volta para "Não foi possível registrar" e
    os botões continuam ali.

## Viewports
- **Mobile 390px** — obrigatório, e é onde mora o risco: card inteiro clicável, polegar, e dois
  botões que quebram para a segunda linha quando o espaço acaba.
- **Desktop 1280px e 1920px** — a aba vira mestre-detalhe (coluna da lista de 520px em 1920px, mais
  estreita em 1280px). É preciso resolver a duplicação: mesmas ações no card marcado e no painel.
- Não desenhe tablet: o corte é binário em 1280px, não existe terceiro layout.

## Regras que o desenho não pode quebrar
- **A falha nunca é vendida como upgrade.** "Envio pausado · precisa de Premium" é uma coisa; sessão
  expirada e recusa do servidor são outras. Nenhuma das três pode virar convite para assinar, e
  nenhuma pode ser explicada como "sem conexão" quando a conexão está intacta.
- **Descartar é irreversível, e o desenho tem de dizer isso antes do toque**, não só no diálogo.
- **O destrutivo dentro de um card clicável não pode ter o peso de um botão cheio** — use a variante
  contornada; o vermelho sólido fica reservado ao confirmar do diálogo, onde o vendedor já pediu.
- Nada de "Cancelar" em lugar nenhum: a saída segura se chama "Voltar" (regra de copy do projeto).
- Alvo mínimo de 44×44px mesmo nos botões pequenos, e **espaço morto entre o botão destrutivo e a
  borda do card** — a área de toque de "Descartar" não pode encostar na do card.
- Contraste medido contra o fundo real de cada contexto: o card e o alerta vermelho não têm o mesmo
  fundo, e o mesmo botão precisa passar nos dois, em tema escuro e claro.
- Botão que não pode funcionar não é desenhado desabilitado e mudo: hoje o retry pendente offline
  simplesmente some — se ele passar a ficar visível, precisa de uma frase que diga por quê.

## Armadilhas já pagas neste projeto
- Frase honesta em campo estreito é frase cortada: qualquer explicação ("não poderá ser recuperado")
  vive em elemento de largura cheia, nunca espremida ao lado de um botão.
- Rótulo longo estoura coluna: "Tentar novamente" + "Descartar" lado a lado em 390px, dentro de um
  card com preenchimento pequeno, é o caso clássico de overflow horizontal medido. Desenhe a quebra.
- Elemento visível em teste e ocluso na tela: os botões ficam no fim do card, logo acima do card
  seguinte — mostre a folga real, medida, entre um card e outro.
- Ação sem retorno visível: já custou um defeito neste projeto um botão cuja confirmação nunca
  aparecia. Se a decisão for não ter aviso de sucesso, o desenho precisa mostrar qual sinal substitui
  isso (a insígnia sumindo, o card saindo da lista).

## Entregável
Pranchetas, em **tema escuro (padrão) e claro (igualmente acabado)**:
1. Card da lista travado em 390px, nos três estados travados, com os botões em repouso.
2. O mesmo card com foco por teclado, hover e pressionado — e o card por baixo em hover.
3. O bloco de ações dentro do alerta do detalhe, nos quatro estados (incluindo pendente offline, sem
   retry, e sessão expirada com "Entrar de novo" ao lado).
4. Retry carregando.
5. O diálogo "Descartar este registro?" — repouso e confirmando (carregando).
6. Desktop 1920px: a tela inteira com lista + detalhe e o registro travado marcado, resolvendo a
   duplicação das ações.

Reutilize os primitivos existentes, sem criar nada novo: `tf-btn` tamanho pequeno para as duas ações
(contornado no retry, contornado-vermelho no descartar do card, vermelho sólido só no confirmar do
diálogo), `tf-badge` para a insígnia de estado, `tf-alert` para o bloco do detalhe, `tf-card` para o
item da lista e `tf-dialog` centralizado para a confirmação.

## Perguntas em aberto para o dono
1. Os dois rótulos de retry ("Tentar agora" para pendente × "Tentar novamente" nos travados) devem
   continuar diferentes, ou vira uma frase só? A diferença apareceu no código, não numa decisão.
2. As ações destrutivas devem continuar dentro do card da lista, ou o card só abre o registro e o
   descarte passa a viver apenas no detalhe (um toque a mais para o vendedor, zero descarte
   acidental)?
3. No desktop, quando o registro travado está aberto à direita, o par de botões do card deve
   desaparecer (mantendo só os do painel), ou os dois ficam?
4. Um retry bem-sucedido deve avisar em algum lugar ("Registro sincronizado.", frase que já existe no
   app), ou o sumiço da insígnia basta?

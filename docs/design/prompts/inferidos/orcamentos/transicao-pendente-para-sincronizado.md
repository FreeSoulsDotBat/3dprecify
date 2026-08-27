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

- **Onde vive:** Não tem lugar próprio — e é isso que a peça é. O momento acontece em dois pontos ao mesmo tempo: o BADGE do card na lista (a segunda coisa dentro do card, à direita do rótulo) simplesmente some, e o banner agregado no topo da lista desaparece junto. No registro aberto, o alerta de sincronização inteiro some do meio da pilha e o conteúdo abaixo dele sobe.
- **Como o vendedor chega:** O vendedor não faz nada. A fila drena em segundo plano a partir de quatro gatilhos — abrir o app / entrar na conta, a rede voltar, a janela ganhar foco, a aba ficar visível — e ainda quando o Premium volta a ficar ativo (o que libera uma fila recusada). Ele também pode ter tocado em [Sincronizar agora] no banner.
- **Vizinhança imediata:** O que fica ao redor é exatamente o que já estava: o mesmo card, na mesma posição da lista, com o mesmo rótulo, a mesma data e o mesmo valor cotado — menos o selo.
- **Dados que chegam (e o que ela devolve):** A confirmação de que o registro chegou à conta. Existe até uma frase escrita para anunciar isso a leitor de tela ("Registro sincronizado."), mas ela NUNCA foi ligada a nenhum componente: é copy que existe no pacote e não aparece em lugar nenhum.
- **O que acontece depois:** O registro passa a ter id de servidor, e com isso três coisas mudam de estado sem nenhum anúncio: a barra [Editar rótulo][Excluir] passa a existir no registro, o PDF do orçamento deixa de estar bloqueado na folha de exportação, e o diálogo de saída com fila pendente para de aparecer por causa dele. Hoje o vendedor só descobre tudo isso reparando que um selo sumiu.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"`

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

# O momento em que o orçamento pendente chega à conta

## O que desenhar
O instante `pendente → sincronizado` de um orçamento na aba **Orçamentos**. O vendedor calculou e salvou uma peça sem sinal (ou com o Premium pausado, ou com a sessão expirada); o registro ficou guardado só no aparelho, marcado com o selo "Pendente neste dispositivo". Depois — quando a conexão volta, quando ele traz o app para a frente, quando ele entra de novo — a fila drena em segundo plano e o registro finalmente chega à conta. É esse "chegou" que precisa de desenho: o que aparece, onde aparece, por quanto tempo, e o que muda no card, na lista e no registro aberto. Quem usa é o vendedor que precisa saber se já pode limpar os dados do app ou trocar de aparelho sem perder o orçamento.

## Por que este prompt existe
Hoje **não existe momento nenhum**. O único sinal é negativo: o selo some e o alerta de fila desaparece. Sem toast, sem transição, sem anúncio para leitor de tela. A decisão foi tomada por não ter sido tomada.
Pior: a especificação de UX de 2026-07-02 (`ux-history.md` §1.5) pede **o oposto do que foi construído** — "o selo some, um toast de sucesso **de verdade** dispara, o card fica no lugar (sem reordenar)… anunciar com `aria-live=polite` → *Registro sincronizado.*". A frase pt-BR chegou a ser escrita (`messages.pt-br.ts:1008`) e **nunca foi ligada a nenhum componente** — existe uma única ocorrência dela em todo o código, a própria definição.
Nenhuma autoridade desenhada cobre a peça: o protótipo antigo não tem fila, e o desenho de desktop `Abas-Desktop.dc.html` desenha o alerta de fila **estático**, sem nenhum "depois".

## O que já existe hoje (não invente do zero — corrija)

O **antes** (o registro pendente) está todo desenhado e homologado. É o **depois** que falta.

| Onde | O que existe hoje (texto literal) | O que acontece no momento da sincronização |
|---|---|---|
| Card da lista | Selo `tf-badge--info` "Pendente neste dispositivo" | → o selo **some**, sem nenhum outro sinal |
| Alerta de fila (topo da lista) | `tf-alert--info`: "1 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora" | → o alerta **some** quando a fila zera; com N pendentes, só o número muda |
| Registro aberto (detalhe) | `tf-alert` "Ainda não sincronizado" + "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." + "Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde." | → os três blocos **somem de uma vez** |
| Ações do registro | "Editar rótulo" e "Excluir" **não existem** enquanto pendente | → **aparecem do nada**, sem aviso |
| Exportar | O PDF fica desabilitado com a razão embaixo: "Sincronize para exportar." | → o rádio destrava e a razão some |
| Sair da conta | Diálogo "{n} registro(s) ainda não foram sincronizados" | → o diálogo deixa de aparecer |
| Leitor de tela | nada | → nada (a frase "Registro sincronizado." existe e não é usada) |

→ **Problema central**: o único evento positivo da jornada offline é comunicado por subtração. O vendedor descobre que o orçamento chegou reparando que um selo sumiu.
→ **Problema de layout**: a saída do selo e a entrada de "Editar rótulo"/"Excluir" mexem na altura do card e do registro **sem nenhuma continuidade visual** — a página pula.
→ **Problema de lugar**: a fila drena a partir de quatro gatilhos (abrir o app, voltar a ficar online, o app ganhar foco, a aba voltar a ficar visível) mais a volta do Premium a ativo. Ou seja, **o momento pode acontecer com o vendedor em qualquer tela**, inclusive na Calculadora — e não só olhando a lista de Orçamentos.

## Conteúdo e dados reais
- Um card de orçamento tem, nesta ordem: rótulo ("Cliente Ana — vasos") ou o nome capturado da origem ou "Cálculo avulso"; o selo de sincronização (só se não sincronizado); "Cotado em 12/08/2026 · Kit · 3 peças"; "Valor cotado" com **R$ 1.234,56** em destaque; e a legenda da base: "preço de varejo" ou "preço de atacado". Valores reais do produto vão de **R$ 16,16** a alguns milhares — desenhe com um valor curto e um longo.
- A **data vem estruturalmente antes do dinheiro** e o card **nunca reordena** ao sincronizar: a chave de ordenação é a data da cotação, que não muda.
- A frase de sucesso já escrita e a usar literalmente: **"Registro sincronizado."**
- Existe um toast pronto no DS com quatro tons (`neutral`, `info`, `success`, `danger`), ícone à esquerda (círculo com check no `success`), mensagem, botão de fechar, e auto-dispensa em 5 s. A região do toast já é `aria-live="polite"`.
- Quando o vendedor pede a drenagem à mão, o botão "Sincronizar agora" entra em estado de carregamento — esse é o único "durante" que existe hoje.

## Estados obrigatórios
1. **Antes (repouso, pendente)** — card com o selo "Pendente neste dispositivo" e o alerta de fila no topo. Ponto de partida do par antes/depois.
2. **Durante (drenando)** — a fila está sendo enviada. Manual: "Sincronizar agora" em carregamento. Automático: hoje não há sinal nenhum; decida se há e qual (discreto, nunca alarmante — não é um erro).
3. **O momento (sincronizado)** — o selo sai, o toast de sucesso "Registro sincronizado." entra, o card **fica no lugar**, o anúncio educado dispara.
4. **Depois (repouso, sincronizado)** — card limpo, sem selo, sem alerta de fila; "Editar rótulo"/"Excluir" disponíveis, exportar destravado.
5. **N registros de uma vez** — a fila drena inteira; **nunca N toasts**. Um único sinal agregado (a copy do plural não existe — ver Perguntas).
6. **Aconteceu fora da tela** — sincronizou enquanto o vendedor estava na Calculadora ou com o app em segundo plano. O momento passou; o que ele vê ao voltar?
7. **Transição que NÃO é sucesso — Premium pausado**: o selo **troca no lugar** para "Envio pausado · precisa de Premium"; o alerta vira "1 registro(s) não foram enviados: o Premium não está ativo."
8. **Transição que NÃO é sucesso — sessão expirada**: selo "Envio pausado · sessão expirada"; alerta "1 registro(s) não foram enviados: sua sessão expirou." + botão "Entrar de novo".
9. **Transição que NÃO é sucesso — recusa do servidor**: selo em tom de perigo "Não foi possível registrar"; alerta "1 registro(s) não puderam ser registrados." + botão "Ver".
10. **Offline** — a fila não drena; o alerta diz "Sem conexão. 1 registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online." e o botão "Sincronizar agora" **não existe** (nunca um botão que não pode funcionar).
11. **Movimento reduzido** — a mesma leitura sem animação.
12. **Foco e teclado** — o toast tem botão de fechar alcançável; a entrada do toast não rouba o foco de quem está digitando.

## Viewports
- **Mobile 390px** — é onde a jornada offline realmente acontece (o vendedor grava o orçamento na feira, sem sinal). Obrigatório. Atenção: o toast não pode cobrir a navegação inferior nem o botão "Sincronizar agora".
- **Desktop 1280px** — acima desse corte a aba vira mestre-detalhe: filtros + lista numa coluna de 520px à esquerda, o registro congelado à direita. O momento acontece **nas duas colunas ao mesmo tempo** (o selo sai do card selecionado e o bloco "Ainda não sincronizado" sai do detalhe) — é o caso mais difícil e precisa de prancheta própria.
- 1920px opcional: só se o posicionamento do toast mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- **Confirmação não é preço.** O momento confirma uma entrega, não anuncia um valor. Nada de tratamento de preço em destaque, nada de número novo, nada que sugira que o valor congelado mudou — ele é imutável por definição.
- **O card não reordena e não muda de conteúdo.** Só o selo sai.
- **Falha de rede nunca vira "não é premium"** e sessão expirada nunca vira "sem conexão" — as palavras "conexão"/"online" são proibidas no caso de sessão expirada, de propósito.
- **Nada de sucesso inventado.** Só é "sincronizado" o que o servidor confirmou; uma resposta perdida continua pendente. O desenho não pode ter um estado "provavelmente enviado".
- **Frase honesta nunca dentro de placeholder** nem cortada por largura fixa — o texto de honestidade mora em elemento de largura total.
- **Sem tempestade de toasts**: N registros = um sinal.
- Alvo tocável ≥ 44px (fechar do toast incluído), contraste medido contra o fundo real do toast, e selo/estado sempre **texto + ícone**, nunca só cor.
- Tema escuro é o padrão; o claro é de primeira classe, não um ajuste.

## Armadilhas já pagas neste projeto
- **O toast que nunca renderizou** (homologação do E6/PR-B): a copy estava no pacote afirmando um reconhecimento que nunca chegou à tela — o componente desmontava antes do retorno. É **exatamente a classe desta peça**: "Registro sincronizado." existe há um ano e nunca apareceu. O desenho tem de deixar explícito **de onde** o sinal nasce e **quanto tempo** ele fica, para que a implementação seja verificável em imagem.
- **Texto ocluso passa em teste**: um selo saindo e dois botões entrando mudam a altura; meça o deslocamento em vez de confiar em "está visível".
- **Overflow horizontal medido**: o alerta de fila tem texto + até três botões na mesma linha ("Ver", "Entrar de novo", "Sincronizar agora"). A 390px isso já estourou antes.
- **Valor grande estoura a coluna**: desenhe pelo menos um card com **R$ 1.234,56** e um kit de 3 peças na coluna de 520px do desktop.

## Entregável
Pranchetas, em escuro e com as duas primeiras repetidas no claro:
1. **Mobile 390 — par antes/depois** da lista: alerta de fila + card pendente → card limpo + toast de sucesso.
2. **Mobile 390 — o momento fora da tela**: o vendedor está na Calculadora quando a fila drena.
3. **Desktop 1280 — mestre-detalhe, par antes/depois**: coluna esquerda (lista com o card selecionado) + coluna direita (registro com "Ainda não sincronizado" → registro limpo, com "Editar rótulo"/"Excluir"/"Exportar" já disponíveis).
4. **As três transições que não são sucesso**, lado a lado (Premium pausado · sessão expirada · recusa do servidor), para provar que a linguagem do sucesso não se confunde com nenhuma delas.
5. **Estado offline + N pendentes**, com o sinal agregado.

Reutilize os primitivos existentes, sem criar nenhum: `tf-toast--success` (com o ícone de check e o botão de fechar) para o momento; `tf-alert--info` / `tf-alert--danger` para a fila; `tf-badge--info` / `tf-badge--danger` para o selo do card; `tf-card` para o registro; `tf-btn--secondary tf-btn--sm` para "Sincronizar agora" / "Ver" / "Entrar de novo"; `tf-spinner` para o "durante". Marque na prancheta a duração e a posição do toast.

## Perguntas em aberto para o dono
1. O sinal de sucesso aparece **em qualquer tela** (a fila drena com o vendedor na Calculadora) ou só quando ele está em Orçamentos? Fora da tela, ele é dispensável ou o vendedor precisa saber?
2. Com **vários registros** sincronizando juntos, qual a frase? Hoje só existe o singular "Registro sincronizado." — um plural ("{n} orçamentos sincronizados.") precisa ser escrito e aprovado.
3. O toast leva uma ação ("Ver registro") ou é só confirmação?
4. Quando a sincronização acontece com o app em segundo plano e o vendedor volta depois, o momento já passou: mostrar um resumo calmo ("tudo sincronizado") ou nada?
5. As ações que **aparecem** no momento ("Editar rótulo", "Excluir", exportar destravado) surgem sob o dedo de quem está lendo o registro. Elas entram imediatamente ou o desenho deve segurar/anunciar essa mudança?

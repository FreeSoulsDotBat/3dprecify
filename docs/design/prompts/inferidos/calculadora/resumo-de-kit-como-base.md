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

## O mapa funcional de Calculadora e precificação

### A área "Calcular" (aba 1, rota `/calcular`)

**Como o vendedor chega.** `/calcular` é a porta do produto: a raiz `/` redireciona para cá e a aba é a
primeira do menu (`Calcular · Catálogo · Kits · Orçamentos · Conta` — no código: `/calcular`, `/catalogo`,
`/kits`, `/historico`, `/conta`). É a **única rota pública sem nenhum portão**: renderiza para anônimo,
grátis, Premium, online e offline. O menu é barra inferior até 425px e barra lateral acima disso (rail de
76px abaixo de 600px e a partir de 1280px por escolha do vendedor).

**O que ele vem fazer.** Digitar os custos de uma peça impressa e ler dois preços sugeridos (varejo e
atacado), com a conta aberta item a item. É a única tela do app que calcula preço a partir de campos
crus — e ela é **grátis e ilimitada**.

**Rotas da área.** Uma só: `/calcular`. Não há sub-rota; tudo o mais é folha/diálogo por cima
(a folha "Meus cenários", a folha de salvar cenário, a folha de gravar no histórico). O mesmo formulário
é *reusado* fora da área — a página de produto (`/catalogo?produto=…`) e o editor de linha de kit
(`/kits`) montam `CostsSection`, `FieldGroup`, `OtherCostsSection`, `MarketplaceSection`, `PriceResults`,
`TimeHmField` e `MachineCostFields` exatamente iguais.

**Layout.** Coluna única até 1023px, na ordem em que está escrito. A partir de `min-width:1024px` a
página sobe de 460px para 1120px e vira **duas colunas** (`.tf-calc-grid`) com um **rodapé de largura
total** (`.tf-calc-footer`, filhos capados em 720px e centrados) que carrega o resultado inteiro.

**O que a área guarda.** Nada por si só. O formulário vive em memória (React Hook Form); recarregar
perde tudo — e por isso existe um diálogo de aviso de saída quando há algo digitado. Persistir é sempre
uma ação Premium **para fora** da área: "Salvar cenário" (simulação) e "Salvar no histórico" (orçamento
congelado). O que a área lê de fora: o **catálogo de tarifas** (servido → cache local → semente
embutida, nunca bloqueia), o **entitlement** do servidor (`active` / `none` / `lapsed`), e as listas de
**filamentos e impressoras** do catálogo Premium (cache local por uid, respondem offline).

**Quem calcula.** `pricing-core`, no aparelho, sempre. O servidor nunca recalcula. Offline os preços
saem iguais; o que falha é só a atualização de tarifas e a escrita.

**O que a área alimenta depois.** Um cálculo válido vira (a) uma **simulação salva** — reabri-la traz a
Calcular preenchida de volta, com barra de contexto e selo de alterações não salvas; (b) um **orçamento
congelado** no Histórico (escrita offline vai para a fila/outbox e drena depois). No sentido inverso, o
Catálogo alimenta a Calcular pelo bloco "Usar do catálogo", e um kit reaberto como base traz um resumo
somente-leitura no lugar da conta escalar.

**Como muda por estado.**
- **Grátis / deslogado** — todos os custos, markup e os dois preços funcionam. A seção Marketplace vira
  um portão: chave desligada e desabilitada + "Vender em marketplaces faz parte do Premium." + teaser
  centrado, ocupando as **duas colunas**; "Outros custos" migra da esquerda para a direita para
  compensar. Some "Usar do catálogo" (vira um cartão de teaser com botão desabilitado) e somem os dois
  botões de gravar. "Meus cenários" continua visível para todos — é a porta honesta.
- **Premium ativo** — marketplace ligável, canais repetíveis com tarifas pré-preenchidas pelo catálogo,
  "Preços por canal" na cauda do detalhamento, e os dois botões de gravar no rodapé.
- **Premium pausado (lapsed)** — a Calcular se comporta como grátis para OFERECER (só `active` habilita);
  o que já foi salvo continua legível pela folha "Meus cenários", que exibe seu próprio aviso de plano.
- **Offline** — cálculo intacto; o selo de cada canal passa a dizer "referência embutida (offline)" e
  pode acusar "desatualizado"; um aviso não-bloqueante com "Tentar de novo" aparece no topo da lista de
  canais; gravar vai para a fila.
- **Sessão expirada** — faixa de sessão no topo do shell ("Entrar de novo"); as leituras Premium falham
  e o bloco "Usar do catálogo" pode cair no cartão de erro com "Tentar de novo"; a conta continua sendo
  feita normalmente.

## O ponto exato de inserção desta peça

- **Onde vive:** Na pilha de topo de /calcular, entre os avisos de campo aposentado e o botão de gravar do kit — ou seja, acima do cartão 'Usar do catálogo' e bem acima da grade de duas colunas.
- **Como o vendedor chega:** Só existe por um caminho: o vendedor abre a folha 'Meus cenários' (botão no topo) e reabre uma simulação cuja base é um KIT. Um kit é multi-peça e não cabe no formulário escalar, então este resumo passa a ser a fonte do resultado.
- **Vizinhança imediata:** Acima: a barra de cenário carregado e, quando houver, o alerta de campo aposentado do kit. Dentro: um Card compacto com o nome do kit em 14px, uma frase de ajuda em 12px, um alerta informativo contando as linhas excluídas (quando houver) e, por marketplace, o nome em 14px seguido de duas linhas de 12px ('Varejo: R$ X' / 'Atacado: R$ Y'). Abaixo: um botão de gravar no histórico exclusivo deste modo. Mais abaixo, o formulário escalar inteiro continua visível e EDITÁVEL, embora não alimente nada do que está sendo mostrado aqui.
- **Dados que chegam (e o que ela devolve):** O documento do cenário e o catálogo de tarifas; o resumo aplica o conjunto de canais do cenário uniformemente a todas as linhas do kit e soma.
- **O que acontece depois:** Gravar congela exatamente estes números (os do resumo, não os dos campos abaixo). Editar as PEÇAS do kit é em /kits, pelo 'Abrir origem' da barra de cenário — nunca aqui.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Resumo do kit como base do cálculo (Calcular, somente leitura)

## O que desenhar
O bloco que aparece na aba **Calcular** quando o vendedor reabre uma **simulação salva cuja base é um KIT** (um produto multi-peça). Um kit não tem forma escalar para hidratar o formulário da calculadora — são N peças — então, em vez de preencher os campos, a tela mostra **um resumo próprio, somente leitura, com o preço por canal do kit inteiro, recalculado com os preços de hoje**. Ele vive logo abaixo da barra de contexto da simulação carregada e **acima do formulário da calculadora**, que continua na tela inteiro, visível e editável, mas **não alimenta nada** do que está sendo mostrado. Quem usa: vendedor Premium que já montou um kit na aba Kits, salvou uma simulação a partir dele, e agora reabre para conferir o preço de hoje ou registrar um orçamento. Origem no código: `apps/web/src/features/calculator/kit-basis-summary.tsx` e `apps/web/src/pages/calcular/calcular-page.tsx`.

## Por que este prompt existe
Autoridade de desenho: **NENHUMA**. Kits (E3) e simulações com base kit (E5) são posteriores ao protótipo de 2026-07-02 — não existe uma linha sobre kit dentro da Calcular em nenhum artefato de desenho. Tudo aqui foi decidido em código: o cartão, a hierarquia tipográfica, o alerta reaproveitado de outro contexto e o botão de gravar próprio. O canvas 018 desenhou o **mesmo conteúdo** no outro lugar (a aba Kits): lá o preço do kit é `tf-price--accent` com **2,25rem** para o Varejo e 1,5rem muted para o Atacado, sob o título "Total do kit", mais um cartão "Preços por canal (kit)" com uma linha por canal. Aqui, na Calcular, os dois níveis de preço saíram em **12px cinza**, como se fossem legenda. O canvas 018 declara Calcular fora do seu escopo por escrito — logo, esta peça nunca foi desenhada por ninguém.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual na página Calcular, de cima para baixo:

1. Título "Calcular" (centralizado) e a frase de promessa freemium.
2. Botão fantasma "Meus cenários", alinhado à direita.
3. **Barra de contexto da simulação**: "Simulação: {nome}", legenda "Recalculado com os preços de hoje" (nunca uma data), ações "Abrir origem", "Renomear", "Duplicar", "Salvar alterações", "Fechar simulação" e a etiqueta "Alterações não salvas".
4. (Condicional) alerta informativo de campo aposentado: "O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui."
5. **← ESTA PEÇA** — hoje um `Card padding="sm"` com:
   - título 14px semibold: `"Kit: {nome}"` → ex. **"Kit: Kit suporte + base"**;
   - legenda 12px muted: `"Preços por canal do kit, recalculados com os preços de hoje."`;
   - (condicional) `Alert tone="info"`: `"Corrija os campos deste canal para ver os preços. (2)"` → **problema: essa frase é emprestada de outro contexto.** Aqui o número não conta canais, conta **linhas do kit excluídas do rollup**, e não existe "campo deste canal" nesta tela para corrigir — ela é somente leitura;
   - por marketplace: nome 14px medium ("Mercado Livre" / "Shopee" / "Amazon" / "Outro", ou **"—"** quando o canal não tem marketplace declarado) e, abaixo, **duas linhas de 12px cinza**: `"Varejo: R$ 24,24"` e `"Atacado: R$ 16,16"` → **problema central: o preço final do kit, que é o resultado da tela inteira, está tipografado como legenda.**
   - quando nenhuma linha do kit é precificável, o bloco inteiro vira um `Alert tone="info"` com `"Confira os campos destacados para ver o preço."` → **problema: não há campo destacado nenhum nesta tela.**
6. Botão **"Salvar em Orçamentos"** próprio deste modo (congela exatamente os números deste resumo). O botão normal de salvar da calculadora é **suprimido** enquanto um kit está carregado — de propósito, para não existir uma segunda oferta que congelaria os campos intocados.
7. **O formulário completo da calculadora**, visível e editável, com os valores que já estavam ali antes da reabertura → **problema: é a maior chance de leitura errada do produto inteiro.** A tela mostra um resultado que não vem dos campos que ela exibe, e nada no desenho diz isso.

## Conteúdo e dados reais
| Dado | Origem | Formato / faixa | Exemplo real |
|---|---|---|---|
| Nome do kit | referência do catálogo (ou o nome da simulação, se a referência não resolve) | texto livre, pode ser longo | "Kit suporte + base para monitor" |
| Canais | conjunto único de canais da simulação, aplicado igual a todas as peças | 1..4 canais | Mercado Livre, Shopee |
| Preço de anúncio varejo (por canal) | recalculado agora, do catálogo de hoje | `R$ 1.234,56`, pode ser nulo | R$ 24,24 |
| Preço de anúncio atacado (por canal) | idem, pode ser nulo | `R$ 1.234,56` | R$ 16,16 |
| Linhas excluídas | contagem de peças do kit que não puderam ser precificadas | inteiro ≥ 1 quando aparece | 2 |
| Campo aposentado descartado | documento salvo antes da versão atual do modelo | nome em pt-BR, nunca a chave técnica | "Desperdício (g)" |

Não existe aqui: data, custo unitário por peça, lista de peças, campo editável. Tudo é derivado; nada é entrada. Um canal pode trazer **só varejo**, **só atacado** ou **os dois** — o desenho precisa aguentar as três formas sem buraco visual.

## Estados obrigatórios
- **Repouso, completo** — dois ou mais canais, cada um com varejo e atacado.
- **Um canal só** — não pode parecer um cartão quebrado nem sobrar área vazia.
- **Canal parcial** — só varejo ou só atacado presente.
- **Canal sem marketplace declarado** — o rótulo é literalmente **"—"**; mostre como o desenho evita que isso leia como erro.
- **Com peças excluídas** — alerta informativo com a contagem; diga quantas e o que fazer (a ação real é "Abrir origem", na barra acima).
- **Nada precificável** — o resumo inteiro é substituído por um aviso informativo. Precisa dizer a verdade: o kit não pôde ser precificado, e o conserto é no kit, não aqui.
- **Campo aposentado descartado** — alerta informativo persistente (não um toast) acima do resumo, com a frase inteira citada acima.
- **Offline** — a simulação continua abrindo e recalculando; escrever não. Frase existente: "Suas simulações continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."
- **Premium pausado** — "Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear, duplicar ou excluir, reative o Premium." O preço continua sendo mostrado; a etiqueta de estado não degrada o número.
- **Sem entitlement ativo** — o botão "Salvar em Orçamentos" simplesmente **não existe** (ausência, nunca botão morto).
- **Nome muito longo** — título "Kit: …" com um nome de 60+ caracteres.
- Estados de interação: hover/foco/pressionado só nos elementos clicáveis (o botão e, se você propuser, um atalho para a origem). **O corpo do resumo não é clicável — desenhe-o de modo que não pareça.**

## Viewports
- **Mobile 390px** — obrigatório: é onde a Calcular é mais usada e onde o resumo compete por altura com o formulário inteiro logo abaixo.
- **Desktop 1280px** — obrigatório, porque a peça existe no desktop hoje sem nenhum desenho (o canvas 018 tratou Catálogo/Kits/Orçamentos/Conta e deixou Calcular de fora, por escrito). Desenhe pelo menos o repouso completo e o estado "nada precificável".

## Regras que o desenho não pode quebrar
- **Procedência do número acima de tudo**: o desenho tem que deixar impossível confundir o preço do kit com o resultado dos campos abaixo. Essa é a razão de a peça existir.
- **Nunca uma data** nesta superfície. A promessa é "recalculado com os preços de hoje", dita em texto, não em carimbo temporal.
- **Degradação dita, não escondida**: peça excluída e campo descartado aparecem como informação persistente, nunca somem sozinhos.
- **Falha de rede nunca vira "não é Premium"** — offline e Premium pausado têm frases distintas e ambas já existem.
- **Freemium binário**: ou o botão de salvar está lá inteiro, ou não está. Nada de botão desabilitado insinuando compra.
- Frase honesta sempre em elemento de largura cheia, nunca dentro de placeholder ou sufixo cortável.
- Alvo de toque ≥44px no botão; contraste medido contra o fundo real do cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Preço grande estoura a coluna**: `R$ 1.234,56` com quatro canais empilhados já quebrou layout em outras telas; teste o desenho com valores de quatro dígitos e nome de kit longo.
- **Overflow horizontal medido, não olhado**: nada pode ultrapassar 390px de largura; o eixo vertical também conta (barra de rolagem clássica não aparece em captura headless).
- **Texto ocluso passa em teste**: o alerta informativo empilhado sobre o resumo já é uma pilha de três avisos possíveis — mostre a pior combinação (descartado + excluídas + canal parcial) em uma prancheta.
- **Copy emprestada de outro contexto** ("Corrija os campos deste canal…" numa tela sem campos) é exatamente a classe de defeito que só aparece quando alguém desenha a peça olhando para ela.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como cidadão de primeira classe:
1. Mobile 390px — repouso completo, dois canais, varejo + atacado.
2. Mobile 390px — pior caso: alerta de campo descartado + alerta de peças excluídas + um canal parcial + nome longo.
3. Mobile 390px — "nada precificável".
4. Desktop 1280px — repouso completo, e como o resumo se relaciona visualmente com o formulário morto abaixo.
5. Um recorte comparativo: a hierarquia de preço do canvas 018 ("Total do kit", Varejo `tf-price--accent`) ao lado da proposta desta peça, para o dono decidir.

Reutilize os primitivos existentes, sem criar novos: `tf-card` (`--pad-sm`) para o contêiner; `tf-price` / `tf-price--accent` para o preço, se a resposta for elevar a hierarquia; `tf-brow` (rótulo + subrótulo + valor à direita) para cada linha de canal, que é exatamente a forma que o canvas 018 já usa em "Preços por canal (kit)"; `tf-badge` para estado ("Ao vivo" / "Premium pausado"); o alerta informativo do DS para as degradações; `tf-btn--primary` para "Salvar em Orçamentos"; `tf-field__hint` para a legenda.

## Perguntas em aberto para o dono
1. **Qual é "o número" desta tela?** No composer de Kits o Varejo é 2,25rem accent porque há um preço só. Aqui há um preço por canal. O resumo deve eleger um canal principal, elevar todos igualmente, ou manter os dois níveis pequenos como hoje?
2. **O que acontece com o formulário editável abaixo** enquanto um kit está carregado: continua como está (visível, editável, inerte), fica recolhido, fica visivelmente desativado, ou some? É o que decide o desenho inteiro da peça.
3. **Que frase substitui "Corrija os campos deste canal para ver os preços."** para peças do kit excluídas, já que aqui não há campo para corrigir e a ação real está em "Abrir origem"?
4. **Calcular entra no tratamento desktop do 018?** O canvas a deixou de fora por escrito; se ela ganhar coluna direita fixa, este resumo é o candidato natural a morar nela.

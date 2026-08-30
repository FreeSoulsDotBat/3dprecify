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

- **Onde vive:** Dentro da seção Marketplace (coluna direita), no TOPO da lista de canais: abaixo da linha da chave 'Incluir marketplaces no preço' e acima do primeiro cartão de canal. Só para conta Premium e com a chave ligada.
- **Como o vendedor chega:** Aparece sozinho quando a busca online de tarifas falha (offline, servidor fora, sessão morta). É pegajoso de propósito: não pisca durante a retentativa.
- **Vizinhança imediata:** Acima: a linha da chave mestra. Abaixo: o primeiro Card de canal. É um alerta de tom informativo com título, corpo e, embutido nele, um botão secundário 'Tentar de novo' que mostra estado de carregamento enquanto tenta.
- **Dados que chegam (e o que ela devolve):** O estado da atualização do catálogo (falhou / tentando) e a ação de refazer a busca. Nenhuma tarifa se perde: a versão salva ou a semente embutida continua pré-preenchendo tudo.
- **O que acontece depois:** Nenhum cálculo é impedido. Convive com o selo de cada canal, que já diz algo parecido em outra forma ('referência embutida (offline) · desatualizado').

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Aviso de falha ao atualizar as taxas (não bloqueante), na seção Marketplaces

## O que desenhar

Um aviso curto, com botão de retentativa embutido, que aparece no topo da lista de canais dentro da seção
**"Marketplaces"** da tela **Calcular** (aba principal do app) quando a busca online da tabela de tarifas
falhou. Quem o vê é o vendedor Premium que já ligou a chave "Incluir marketplaces no preço" e está
preenchendo/lendo os canais (Mercado Livre, Shopee, Amazon, Outro). O ponto central: **nada parou**. As
tarifas continuam pré-preenchidas pela referência salva no dispositivo (cache) ou pela semente embutida no
app, e todo preço continua sendo calculado localmente. O aviso é uma NOTA, não uma parede de erro — e o
desenho precisa fazer essa diferença ser lida em meio segundo, sem que o vendedor ache que o número na
tela está quebrado. Ele fica logo acima dos cartões de canal e do botão "Adicionar canal".

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. Tom (info e não perigo), posição (topo da lista de canais), o botão
dentro do próprio alerta e a convivência com o selo de procedência de cada canal foram todos decididos no
código, por inferência de requisito textual (005/US3). O catálogo de tarifas nem existia no protótipo de
2026-07-02. O padrão vizinho existe e é **outra coisa**: o item 17 do `-fixes.md` desenha "Não foi possível
carregar. Tente de novo." + "Tentar novamente" para Catálogo e Histórico — um estado que **substitui** uma
lista que não carregou. Aqui nada foi substituído: a seção inteira continua funcionando com dado embutido.
O problema real, não resolvido por ninguém: **duas superfícies dizem coisas parecidas com formas
diferentes** — este alerta no topo ("não foi possível atualizar") e, dois centímetros abaixo, o selo de cada
canal ("Referência: <fonte> · atualizada em 06/07/2026"). O vendedor pode ler as duas como contradição.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`MarketplaceSection`),
`apps/web/src/pages/calcular/calcular-page.tsx`, `apps/web/src/features/calculator/fee-seal.tsx`,
textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Composição atual, de cima para baixo dentro da seção:

| Ordem | Elemento | Conteúdo literal hoje |
|---|---|---|
| 1 | Título de seção + info | "Marketplaces" |
| 2 | Linha de chave (full width, rótulo à esquerda, switch à direita) | "Incluir marketplaces no preço" |
| 3 | **O aviso desta peça** (`Alert tone="info"`, ícone 20px, `role="status"`) | Título: "Não foi possível atualizar as taxas" |
| 3b | Corpo do aviso (parágrafo) | "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." |
| 3c | Botão dentro do alerta (`Button variant="secondary" size="sm"`, margem superior curta) | "Tentar novamente" |
| 4 | Lista de cartões de canal, cada um com seu selo de procedência | ver "Conteúdo e dados reais" |
| 5 | Botão secundário | "Adicionar canal" |

→ **Problema 1 (o principal):** o aviso e o selo de cada canal falam do mesmo assunto sem se enxergarem. O
aviso diz "não foi possível atualizar"; o selo abaixo diz "Referência: Tabela de comissões do Mercado Livre
· atualizada em 06/07/2026" com tom **info** (azul), que lê como "está tudo fresco". O desenho tem de
resolver essa relação — uma delas cede: hierarquia, tom, ou fusão.
→ **Problema 2:** quando a referência em uso é a semente embutida, o selo já diz "referência embutida
(offline) · atualizada em 06/07/2026 · pode estar desatualizada". Nesse caso o aviso do topo é quase
redundante — só acrescenta o botão. Desenhe a versão em que as duas coexistem sem soar repetitiva.
→ **Problema 3:** o botão nasce colado ao corpo do texto, herdando o alinhamento do parágrafo. Falta uma
decisão de desenho sobre onde a ação vive dentro do bloco (à direita do título? em rodapé próprio?).
→ **Problema 4:** o aviso só existe **dentro** da seção Marketplaces ligada. Se o vendedor tiver a chave
desligada, ou não for Premium, a falha acontece e ninguém é avisado. Isso pode estar certo — mas nunca foi
desenhado. Ver "Perguntas em aberto".
→ **Problema 5:** a mesma tela Calcular já tem, mais acima, um alerta de retentativa com tom **perigo**
("Não foi possível carregar seus itens salvos agora." + "Tentar novamente"). Os dois podem aparecer juntos:
dois alertas com o mesmo botão e tons diferentes na mesma coluna. Desenhe essa colisão explicitamente.

## Conteúdo e dados reais

- **Título do aviso** (literal, homologado): "Não foi possível atualizar as taxas".
- **Corpo** (literal): "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você
  também pode informar as taxas manualmente." — a frase está correta e é honesta; **não a reescreva**, e
  ela **não pode** ir para dentro de placeholder ou de elemento que corte texto.
- **Botão** (literal): "Tentar novamente".
- **Selos de procedência por canal** (pílulas pequenas, um por cartão de canal — todos textos reais):
  - `Referência: Tabela de comissões do Mercado Livre · atualizada em 06/07/2026` (tom info)
  - `referência embutida (offline) · atualizada em 06/07/2026` (tom neutro)
  - `… · pode estar desatualizada` (sufixo, quando passou de 30 dias)
  - `categoria não informada — usando a maior alíquota da tabela` (tom neutro)
  - `ajustado por você` / `sem referência — informe as taxas` / `estimativa de frete`
  - selo separado da taxa fixa: `Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/08/2026`
- **Números reais ao redor** (para as pranchetas não usarem valores fictícios): comissão 14%, taxa fixa
  R$ 2,00, preço do anúncio R$ 24,24, líquido R$ 16,16. Nenhum desses números muda quando a atualização
  falha — esse é exatamente o ponto do aviso.
- Nada aqui é campo editável: o aviso é só texto + uma ação. Ele **não** tem estado de "fechado/dispensado"
  no código de hoje.

## Estados obrigatórios

1. **Ausente** — o padrão: a busca teve sucesso. Nenhum aviso; a seção começa direto na lista de canais.
   Desenhe esta prancheta como linha de base para medir o deslocamento que o aviso causa.
2. **Repouso (falha travada)** — aviso visível com título, corpo e botão "Tentar novamente" ativo. Esse
   estado é **pegajoso**: uma vez levantado, só baixa quando uma atualização finalmente dá certo.
3. **Retentativa em andamento** — o mesmo aviso, **sem sumir**, com o botão em estado de carregamento
   (spinner + rótulo). O aviso permanecer é intencional: piscar entre "falhou" e "falhou" é pior que ficar.
   Desenhe o botão em `loading` com largura estável (não pode encolher/pular quando o spinner entra).
4. **Retentativa falhou de novo** — visualmente igual ao estado 2. Nenhum contador, nenhuma escalada de
   tom no código atual. Se você propuser um reconhecimento ("tentamos de novo às 14h32"), marque como
   proposta, não como existente.
5. **Sucesso após retentativa** — o aviso desaparece e os selos abaixo passam a exibir a data nova.
   Desenhe o "depois": o vendedor precisa perceber que algo mudou, senão o botão parece não ter feito nada.
6. **Foco de teclado no botão** — anel de foco visível sobre o fundo do alerta (fundo tonal, não o fundo da
   página): o contraste tem de ser medido contra o fundo do próprio alerta.
7. **Hover / pressionado** no botão secundário dentro de superfície tonal.
8. **Convivência com o selo desatualizado** — aviso no topo + pelo menos um cartão de canal abaixo com
   "referência embutida (offline) · … · pode estar desatualizada" visível na mesma prancheta.
9. **Convivência com o alerta de perigo do catálogo pessoal** — os dois alertas empilhados na mesma tela.
10. **Não renderizado por falta de permissão** — conta sem Premium: a seção mostra "Vender em marketplaces
    faz parte do Premium." + CTA de assinatura, e o aviso **não** aparece mesmo com a falha acontecendo.
11. **Chave desligada** — "Incluir marketplaces no preço" em off: corpo da seção oculto, aviso oculto.

## Viewports

- **Mobile 390px** — obrigatório e prioritário: é onde a peça mais dói. O aviso empurra a lista de canais
  para baixo e o botão de 44px tem de caber numa coluna estreita sem quebrar o rótulo em duas linhas.
- **Desktop 1280px** — a tela Calcular tem grade multi-coluna no desktop (018), e a seção Marketplaces
  ocupa colunas diferentes conforme a conta é Premium ou não. Desenhe o aviso na largura real da coluna em
  que ele vive, não numa faixa full-width imaginária.
- 1920px é opcional aqui: acima de 1280px a coluna não muda de natureza, só de folga.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de premium** e nunca vira parede de erro: o cálculo continua,
  e a peça tem de parecer uma nota, não um bloqueio. Nada de vermelho, nada de ícone de alarme.
- **Procedência do número é obrigatória e não pode ser escondida**: se o desenho fundir o aviso com o selo,
  o resultado ainda tem de dizer de onde veio cada tarifa e quando foi revista.
- **Degradação dita, não maquiada**: "referência embutida (offline)" e "pode estar desatualizada" são
  afirmações que o vendedor precisa conseguir ler — não podem virar só um ícone ou uma cor.
- **A frase honesta fica em texto corrido, nunca em placeholder** e nunca em elemento que trunca.
- **Alvo de toque ≥44px** para "Tentar novamente", inclusive no estado de carregamento.
- **Contraste medido contra o fundo tonal do alerta**, não contra o fundo da página — o texto secundário
  dentro de superfície tonal é onde esse erro costuma passar.
- O aviso **não** pode ganhar um "X" de dispensar sem decisão do dono: dispensar uma degradação silencia
  uma verdade que continua valendo.

## Armadilhas já pagas neste projeto

- **Texto que passa em teste e está ocluso/estourado**: assertivas de texto não veem colisão de layout.
  Meça caixas. Uma fonte longa dentro do selo ("Tabela de comissões da Amazon — Calçados (…)") é o caso
  real que estoura a pílula.
- **Overflow horizontal medido nos DOIS eixos** a 390px: já perdemos um item por medir só um.
- **Botão que nasce fora da viewport** dentro de bloco tonal — aconteceu na tela de Conta (100,5px).
- **Frase honesta cortada por sufixo/placeholder** — o corpo deste aviso é longo (duas orações); ele tem de
  caber inteiro a 390px sem reticências.
- **Órfão de CTA**: em faixa larga, o botão distante do texto que o motiva já custou uma correção (149,6px
  de distância). No desktop, ancore a ação ao texto.
- **Alerta que muda de altura ao entrar em carregamento** faz a lista abaixo pular; a lista de canais é
  clicável logo abaixo.

## Entregável

Pranchetas em **tema escuro (padrão)** e **tema claro (first-class, mesma qualidade)**:

1. `Marketplaces — sem falha (linha de base)` — 390px e 1280px.
2. `Aviso em repouso` — 390px e 1280px, com dois cartões de canal visíveis abaixo e seus selos.
3. `Retentativa em andamento` — botão em carregamento, 390px.
4. `Depois do sucesso` — aviso ausente, selo com data nova em destaque momentâneo, 390px.
5. `Colisão de alertas` — o alerta de perigo do catálogo pessoal acima e este aviso abaixo, 1280px.
6. `Sem Premium / chave desligada` — comprovando que o aviso não aparece, 390px.
7. Um detalhe ampliado (2x) do bloco do aviso mostrando foco, hover e pressionado no botão.

Reutilize os primitivos existentes, sem criar novos: o bloco é o **`tf-alert` no tom informativo** (com seu
ícone de 20px), o título usa o slot de título do próprio alerta, o corpo é parágrafo de texto secundário, a
ação é o **`tf-btn` secundário tamanho `sm`** com estado de carregamento, os selos por canal são o
**`tf-badge`** nos tons neutro/info, os canais vivem em **`tf-card`**, e a chave é o **`tf-switch`**. Se a
sua solução para o Problema 1 exigir uma peça nova, apresente-a como variante de um primitivo existente e
diga qual, explicitamente.

## Perguntas em aberto para o dono

1. **Quem cede na relação aviso × selo?** Três caminhos possíveis e nenhum decidido: (a) o aviso some e o
   selo de cada canal ganha a ação de retentativa; (b) o aviso fica e os selos abaixo perdem o tom info
   enquanto a falha estiver travada; (c) os dois ficam como estão e o aviso ganha uma frase que amarra
   ("os valores abaixo são da referência salva").
2. **A falha deve ser avisada quando a seção Marketplaces está desligada ou a conta não é Premium?** Hoje
   não é. É decisão de produto: o catálogo só serve aos canais, mas a falha é do app, não da seção.
3. **O aviso pode ser dispensado pelo vendedor?** Hoje não pode. Se puder, volta na próxima sessão ou fica
   dispensado enquanto a falha durar?
4. **Retentativa automática:** hoje só existe a manual. Se o app tentar sozinho de tempos em tempos, o
   desenho precisa de um estado "tentando novamente sozinho" que não existe hoje.

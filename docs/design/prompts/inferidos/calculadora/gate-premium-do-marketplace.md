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

- **Onde vive:** Uma faixa de LARGURA TOTAL (as duas colunas) logo abaixo da grade de duas colunas e acima do rodapé, na conta grátis/deslogada. No mobile é simplesmente a última seção da pilha.
- **Como o vendedor chega:** O vendedor grátis desce o formulário e chega no lugar onde estaria a seção Marketplace. Ele não clicou em nada.
- **Vizinhança imediata:** Acima: as duas colunas — esquerda terminando em 'Mão de obra e custos', direita terminando em 'Outros custos' (que migrou para cá justamente por causa deste portão). Dentro: o mesmo título 'Marketplace' com ⓘ, a mesma linha de largura total com o texto 'Incluir marketplaces no preço' à esquerda e o interruptor à direita — DESLIGADO e desabilitado —, depois um bloco centrado com a legenda 'Vender em marketplaces faz parte do Premium.' e o teaser de assinatura centrado logo abaixo. Abaixo da faixa: o rodapé com o resultado (que continua calculando varejo e atacado normalmente).
- **Dados que chegam (e o que ela devolve):** O entitlement do servidor; só `active` habilita. Estado indefinido, em verificação ou com erro degrada para 'não entitulado' — nunca para um 'sim' presumido.
- **O que acontece depois:** Assinar leva ao fluxo de compra (deslogado passa pelo login antes, preservando a intenção). Nada de canal é computado enquanto isso — nenhum número parcial, nenhum número falso.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Gate Premium da seção "Marketplace" na Calcular grátis

## O que desenhar
O bloco que ocupa o lugar da seção **Marketplace** na tela **Calcular** quando a conta NÃO é Premium ativa — e, junto com ele, a montagem da página inteira nesse estado. Quem vê isso é o vendedor que acabou de calcular custo e markup de uma peça (o cálculo básico continua grátis) e chegou na parte que grosseia o preço para Mercado Livre / Shopee / Amazon. Ele vê o título da seção, uma chave desligada e travada, uma frase e um "Assinar Premium". No desktop esse bloco não fica na coluna onde a seção Marketplace mora para o assinante: ele atravessa a grade inteira, e o bloco "Outros custos" muda de coluna para tapar o buraco. São duas montagens diferentes da mesma tela, decididas pelo plano — e nenhuma das duas foi desenhada.

## Por que este prompt existe
Tudo aqui foi inferido em código: manter a chave visível-porém-morta em vez de trocar a seção por um teaser, centralizar o texto, e sobretudo **recompor o layout desktop em função do plano**. Autoridade é `PROTOTIPO_PARCIAL`: existe precedente desenhado para gate INLINE dentro da Calcular, e ele diz o CONTRÁRIO do que o código faz — o `-fixes.md` item 1 manda, para o card "Do catálogo", *substituir o bloco por um teaser compacto* ("Preencha direto do seu catálogo — recurso Premium" + link "Ver Premium"), e o audit V2 registra isso FIXED e renderizado. O canvas 018 desenha o teaser Premium completo (ícone + título + subtítulo + preço + CTA lg + legenda) para Catálogo/Kits/Orçamentos/Conta; a Calcular não usa essa forma. **Nenhuma autoridade de desenho trata mudança de layout desktop por entitlement.** Foi exatamente aqui que a homologação mediu **1.671px de buraco** a 1440px e o CTA órfão a **~950px** da legenda que o motiva.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/calcular/calcular-page.tsx`, `features/calculator/calculator-form.tsx` (`MarketplaceSection`), `calculator-form.css`, textos em `shared/i18n/messages.pt-br.ts`.

Ordem atual do bloco, de cima para baixo (todos os textos são literais do produto):

| # | Elemento | Conteúdo real hoje |
|---|---|---|
| 1 | Título de seção + ⓘ | "Marketplace" (mesmo `sectionLabel` das outras seções) + InfoTip "Sobre o marketplace" → "Calcula o preço para anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa." |
| 2 | Linha de chave, largura total | rótulo à esquerda "Incluir marketplaces no preço", Switch à direita — **sempre `checked=false` e `disabled`** |
| 3 | Legenda | "Vender em marketplaces faz parte do Premium." — centralizada |
| 4 | Faixa de upgrade (`TeaserUpgrade align="center"`) | linha de preço "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário "Assinar Premium"; a faixa tem borda superior de 1px e centraliza tudo |

→ Problema 1: **a chave morta.** Um controle visível, desligado e travado é a única coisa acionável do bloco e ela não faz nada. O padrão já desenhado para gate inline nesta mesma tela é substituir o bloco por um teaser compacto.
→ Problema 2: **o bloco não é um Card.** Todas as outras seções da Calcular ("Custos da peça", "Mão de obra e custos", "Markup") são `tf-card`; o gate é texto solto sobre o fundo da página, e a 1120px de largura ele vira uma faixa fina e perdida.
→ Problema 3: **a recomposição por plano.** Grátis: coluna esquerda = Custos da peça + Mão de obra; coluna direita = Markup + **Outros custos**; e o gate atravessando as duas colunas embaixo. Premium: Outros custos volta para a **esquerda** e Marketplace ocupa a direita. Ou seja, no segundo em que o vendedor assina, "Outros custos" salta de coluna. Ninguém desenhou essa transição.
→ Problema 4: **o gate não distingue quem nunca foi Premium de quem VENCEU.** `lapsed` e `none` recebem a mesma frase.

## Conteúdo e dados reais
- Preços verdadeiros e únicos (vêm de `messages.billing`, fonte única): mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, exibido como **"equivalente a R$ 12,99/mês"**. Nunca existe "de/por" nem preço riscado — o desconto ~19% é o delta real, e fabricar um riscado seria mentira.
- Destino do "Assinar Premium": a OFERTA (a folha de planos dentro de `/conta`), nunca um checkout direto — mensal e anual têm preços diferentes e escolher por ele seria decidir no lugar dele. Deslogado, o caminho passa por entrar antes, preservando a intenção.
- Nenhum número de canal é exibido neste estado: sem comissão, sem taxa fixa, sem anúncio, sem líquido. Zero parcial, zero fake.
- Contexto numérico da tela em volta, para as pranchetas ficarem críveis (valores de semente do produto): custo total **R$ 16,16**, preço varejo **R$ 24,24**, preço atacado **R$ 21,01**.
- Logo acima, no topo da tela, o vendedor grátis já viu outro teaser — "Preencha o cálculo com um toque" / "O cálculo de custo e markup continua grátis." Os dois convivem na MESMA página: o desenho precisa evitar que a Calcular vire uma vitrine com dois pedidos de assinatura empilhados.

## Estados obrigatórios
1. **Grátis, nunca assinou** (`status = none`) — o estado padrão descrito acima.
2. **Premium vencido** (`status = lapsed`) — hoje idêntico ao anterior; o desenho precisa decidir se diz "seu Premium venceu" (ver Perguntas em aberto).
3. **Deslogado** — mesmo bloco; o botão leva a entrar antes de assinar. O desenho deve deixar claro que existe um passo a mais.
4. **Consultando o plano** (primeira leitura em voo, sem resposta guardada) — hoje cai no gate por segurança (nunca se supõe premium). Precisa de um repouso que não pareça uma negativa definitiva.
5. **Sem resposta do servidor / offline** — mesmo tratamento: cai no gate. **Regra dura:** falha de rede NUNCA pode ser vendida como "você não é Premium". Se o desenho não distingue, precisa ao menos de uma linha que não acuse o vendedor.
6. **Resposta lembrada do dispositivo** (`stale`) — o app está servindo a última palavra conhecida do servidor, não uma fresca. Nas outras superfícies isso é dito; aqui não é.
7. **Premium ativo** — o gate NÃO existe: a seção Marketplace real ocupa a coluna direita. Desenhar uma prancheta desse estado só para mostrar o antes/depois da montagem.
8. Estados de interação do CTA: repouso, hover, foco visível, pressionado. O Switch travado precisa de um desabilitado que leia como "bloqueado", não como "quebrado".

## Viewports
- **390px (mobile)** — obrigatório: é a coluna única, o gate aparece na mesma posição de sempre e o único risco é a faixa de preço + botão não caberem lado a lado (ela já quebra em duas linhas por desenho).
- **1280px** — o corte de desktop declarado no 018; é aqui que a grade de duas colunas e a faixa de largura total precisam ser resolvidas.
- **1920px** — a largura em que o dono redesenhou o produto; mostrar que a faixa não vira um filete de 1120px com um botão sozinho no meio de muito vazio.
- Registrar (não precisa prancheta): hoje a grade de duas colunas liga a partir de **1024px**, antes do corte de 1280px do 018 — entre 1024 e 1279 já existe a montagem de duas colunas.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** ou o recurso é seu, ou é do Premium — nunca um meio-termo com números parciais na tela.
- **Nada de preço inventado:** os únicos valores de assinatura que podem aparecer são R$ 15,99/mês e o equivalente mensal de R$ 12,99 do anual.
- **Frase honesta nunca vive dentro de placeholder** nem de campo estreito: "Vender em marketplaces faz parte do Premium." (ou o que a substituir) precisa de um elemento de largura própria.
- **Falha de rede não é falta de plano** — nenhum estado de erro pode ser rotulado como "recurso Premium".
- **Degradação dita, não escondida:** se o plano vem de memória do dispositivo, isso se diz.
- Alvo de toque ≥ 44px no CTA e no Switch (mesmo travado, ele recebe foco de leitor de tela).
- Contraste medido contra o fundo real da Calcular, nos dois temas — o gate não tem Card hoje, então o texto assenta direto no fundo da página.
- O texto e o CTA precisam ler como **uma unidade**: a métrica que motivou o `align="center"` foi um botão órfão a ~950px da frase que o justifica; qualquer alternativa proposta tem de manter essa proximidade explícita.

## Armadilhas já pagas neste projeto
- **O buraco de 1.671px** (medido a 1440px): o gate tem ~205px de altura e ficava confinado numa coluna de 850px ao lado de uma coluna de 2.521px. Qualquer desenho que devolva o gate para uma coluna curta reabre esse buraco — se propuser isso, mostre com o que a outra coluna é preenchida.
- **CTA órfão** — já custou 149,6px de deslocamento numa peça e ~950px nesta; o botão nunca fica sozinho na ponta de uma faixa larga.
- **Overflow horizontal** — a faixa de preço + botão já estourou 100,5px numa homologação, com botão nascendo fora da viewport. Ela quebra em duas linhas a 390px por desenho: mantenha isso.
- **Texto ocluso passa em teste** — assertions de texto não enxergam colisão de layout; o desenho precisa mostrar as caixas, não só as frases.
- **Valor grande estoura a coluna** — a Calcular já pagou por dígitos que empurram a página; a faixa de preço da assinatura é fixa, mas o bloco vizinho ("Outros custos", que muda de coluna neste estado) carrega dinheiro digitado pelo usuário.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como cidadão de primeira classe:
1. **390px — gate em repouso**, na página inteira (do teaser do topo até os cards de preço), para provar que os dois pedidos de assinatura convivem.
2. **1280px — montagem grátis completa**, mostrando as duas colunas + a faixa do gate, com as alturas reais das colunas indicadas.
3. **1280px — montagem Premium** ao lado, para tornar visível o salto de "Outros custos" entre colunas (e propor como suavizá-lo, ou como evitá-lo).
4. **1920px — gate em repouso**, resolvendo o vazio lateral.
5. **Prancheta de estados**: consultando, sem resposta/offline, resposta lembrada, Premium vencido, e os estados do CTA (repouso/hover/foco/pressionado) + o Switch travado (se ele sobreviver ao desenho).

Reutilize os primitivos existentes, sem criar novos: `tf-card` para dar corpo ao bloco (hoje ele não tem), o título de seção com o ⓘ (`InfoTip`) exatamente como nas demais seções, `tf-switch` para a chave, `tf-btn tf-btn--primary` para "Assinar Premium", a legenda no estilo de caption já usado nas seções, e — se a proposta for adotar a forma do canvas 018 — o `tf-premium-teaser` (título / subtítulo / faixa de preço / CTA / legenda), que já existe e já é usado nas outras quatro abas. Se o desenho substituir o bloco pelo teaser, deixe explícito o que acontece com o rótulo "Incluir marketplaces no preço", que hoje é o único nome do recurso na tela.

## Perguntas em aberto para o dono
1. **A chave morta fica ou sai?** O padrão desenhado para gate inline nesta tela ("Do catálogo") manda substituir o bloco por um teaser compacto; o código manteve o Switch visível e travado. Vale a mesma regra aqui?
2. **Premium vencido merece frase própria?** Hoje quem já pagou e venceu lê a mesma frase de quem nunca assinou ("Vender em marketplaces faz parte do Premium.") — a alternativa seria reconhecer o vencimento e oferecer a renovação.
3. **"Outros custos" deve mesmo trocar de coluna conforme o plano?** É a decisão que cria duas montagens da mesma tela; a alternativa é uma ordem única em que só o conteúdo do slot de Marketplace muda.
4. **Dois pedidos de assinatura na mesma tela** (o teaser "Preencha o cálculo com um toque" no topo e este gate embaixo) — mantém os dois, funde num só, ou um deles vira apenas um link discreto?

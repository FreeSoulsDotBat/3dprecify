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

- **Onde vive:** Dentro do Card 'Custos da peça', imediatamente ABAIXO da grade dos sete campos numéricos e ACIMA do bloco 'Valor da máquina'.
- **Como o vendedor chega:** O vendedor desce a grade de custos e este é o próximo controle. É o único campo obrigatório que não mora na grade.
- **Vizinhança imediata:** Acima: a última linha da grade de custos (Taxa de falha / Reserva de manutenção, conforme a largura). Abaixo: o campo 'Valor da máquina'. Dentro do próprio campo: um único rótulo 'Tempo de impressão' (obrigatório) e, em uma linha `flex gap-2`, DOIS controles numéricos — horas (unidade 'h', aceita relógio digitado tipo '2:30' ou '2h30') e minutos (unidade 'min'). Rótulo, dica e erro são compartilhados pelos dois.
- **Dados que chegam (e o que ela devolve):** Recebe um número decimal de horas do formulário e o mostra como h+min; devolve o decimal recomposto a cada mexida. Recebe também o aviso de plausibilidade do campo (150 no lugar das horas quando o vendedor queria minutos), que ocupa a linha da dica.
- **O que acontece depois:** Alimenta Energia, Máquina e Falha no detalhamento. Também aparece igual no editor de linha de kit (/kits), que monta este mesmo controle.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Tempo de impressão em horas + minutos

## O que desenhar
O campo em que o vendedor informa quanto tempo a peça fica na impressora. Ele vive na aba **Calcular**, dentro do card **"Custos da peça"**, logo abaixo da grade de campos numéricos (Custo do rolo · Peso do rolo · Gramas usadas · Consumo médio · Tarifa de energia) e logo acima do bloco da máquina ("Com que frequência ela roda?"). É um controle de largura inteira do card, com **dois campos numéricos lado a lado** — horas e minutos — sob **um único rótulo, um único hint e um único erro**. É o campo que multiplica o custo de máquina e o custo de energia: um engano aqui não aparece como erro, aparece como preço. O usuário é o vendedor leigo, que na prática está copiando o tempo estimado do fatiador (PrusaSlicer, Cura, Bambu Studio) para dentro do app.

## Por que este prompt existe
A forma deste campo nunca foi desenhada — foi decidida em código. O protótipo de 2026-07-02 (`CalculatorScreen.jsx`, §E4 das autoridades) tem **um** campo decimal, rótulo "Horas", unidade "h", placeholder "0,0", dentro da colapsável Energia. O par h+min, o parser de relógio (`2:30`) e o rascunho de digitação **não existem em desenho nenhum** — nem no canvas 018, que não cobre Calcular. Foi inferido: que são dois campos e não um; a proporção entre eles (nenhuma — os dois herdam o mesmo `flex`, sem razão declarada); o que um rótulo/erro/hint compartilhado por dois controles deve parecer; e o que a interface mostra **durante** a digitação. O preço já cobrado por essa ausência: digitar `2:30` virava **30 horas** — 60× o valor pretendido, em silêncio. Só um review de PR pegou; a homologação visual foi cega ao defeito.

## O que já existe hoje (não invente do zero — corrija)

| Parte | Como está hoje | Texto literal |
|---|---|---|
| Rótulo do par | Um só, acima dos dois campos, com asterisco de obrigatório | `Tempo de impressão` + `*` |
| Campo esquerdo | `NumberField` com sufixo de unidade, texto alinhado à direita, tabular | unidade `h`, placeholder `0`, nome acessível `Horas de impressão` |
| Campo direito | `NumberField` idêntico | unidade `min`, placeholder `0`, nome acessível `Minutos de impressão` |
| Arranjo | `flex`, `gap` de 8px, **sem proporção declarada** | — |
| Hint | Só existe quando dispara o aviso de plausibilidade (>100 h) | ver abaixo |
| Erro | Linha abaixo, tom `--danger` | `Campo obrigatório.` / `Não pode ser negativo.` |

→ **Os dois campos têm exatamente o mesmo peso visual.** Horas e minutos não são grandezas equivalentes: horas carrega o custo, minutos é o ajuste fino. Nada no desenho atual diz qual é qual além do sufixo minúsculo `h`/`min` em `--text-muted`.
→ **O campo aceita `2:30`, `2h30`, `2h30m` e `2h 30m` no campo de HORAS — e nada na tela conta isso.** É a porta de entrada mais usada (é o formato que o fatiador imprime) e é invisível.
→ **Este é o único campo do card sem tooltip `ⓘ`.** Todos os vizinhos ganharam um `InfoTip` na linha do rótulo (US6); este não tem `labelAddon` nenhum.
→ **A borda dos dois campos NUNCA fica vermelha.** O erro é renderizado como texto abaixo, mas o estado de erro não chega aos controles — a mensagem aparece sem que nenhum campo se identifique como o culpado.
→ **O campo nunca fica vazio.** Apagar tudo devolve `0`; logo o placeholder `0` é decorativo e a mensagem `Campo obrigatório.` é inalcançável pela digitação.

## Conteúdo e dados reais
- **Horas**: inteiro ≥ 0, sem casa decimal (digitar `2,5` não é aceito como decimal). Valor semente do formulário: **5 h**. Aceita também relógio: `2:30`, `2h30`, `2h30m`, `2h 30m` (minutos de 1–2 dígitos, no máximo 59 nessa forma).
- **Minutos**: inteiro ≥ 0. **Não é travado em 59**: `2 h` + `90 min` é normalizado na hora para **3 h 30 min** — o número que a pessoa digitou desaparece e outro aparece no lugar.
- **Leitura de volta**: um orçamento salvo com 5,5 h reabre mostrando `5` e `30`. Um documento com valor ruim/vazio reabre como `0`/`0`, nunca como texto quebrado.
- **Aviso de plausibilidade** (acima de 100 h), tom `info`, nunca vermelho, e o número **não é recusado**:
  `Confira o tempo: 150 horas equivalem a 6,3 dias imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado.`
- **Faixa real de uso**: peças pequenas 0 h 45 min; peças grandes 18 h; lotes noturnos 30–40 h. Acima de 100 h é quase sempre minutos digitados no campo errado.
- **O que este campo produz**: horas decimais para o motor de cálculo. Ele multiplica o custo de máquina e o de energia — 5 h a R$ 0,92/h de máquina + 0,15 kW × R$ 0,89/kWh dão algo como **R$ 5,27** no custo da peça. O campo não mostra esse dinheiro; o card "Como chegamos no preço" mostra.

## Estados obrigatórios
1. **Repouso preenchido** — `5` h / `30` min, sufixos legíveis, números alinhados à direita.
2. **Repouso "zerado"** — `0` / `0` (o estado real de um formulário limpo; não existe estado vazio).
3. **Foco** — anel de foco no campo focado apenas, borda na cor do anel (um traço só, nunca borda dupla); o outro campo permanece em repouso, e o rótulo compartilhado precisa continuar dizendo a que par ele pertence.
4. **Digitando um relógio (estado intermediário)** — o texto `2:` / `2h` fica na tela e **nenhum número é recalculado ainda**. Este estado existe hoje e não tem tratamento visual algum. Precisa de um: a pessoa precisa saber que o app está esperando ela terminar, não que ela quebrou o campo.
5. **Relógio reconhecido** — `2h30` se torna `2` no campo de horas e `30` no de minutos. A transformação acontece e nada a confirma. Desenhe a confirmação.
6. **Minutos transbordando** — `90` min vira `1 h 30 min` somado às horas. Mesma exigência: dizer o que aconteceu.
7. **Hover** — borda mais forte, por campo, não pelo par.
8. **Desabilitado** — fundo esmaecido, cursor negado (aplica quando o par é usado em contexto somente-leitura).
9. **Aviso de plausibilidade** — a frase acima, em tom `info`, abaixo do par, ocupando a **largura inteira do card** (nunca dentro do input, nunca truncada).
10. **Erro** — `Campo obrigatório.` ou `Não pode ser negativo.` abaixo do par, substituindo o hint, com os dois controles marcados em vermelho (hoje não são).

## Viewports
- **390px (mobile)** e **360px (o piso já medido do projeto)** — é onde o par disputa espaço: dois inputs com sufixo, dentro de um card com `padding`, mais o rótulo e a linha de aviso. Obrigatório.
- **1280px (desktop)** — a Calcular desktop é de duas colunas; o card "Custos da peça" ocupa uma coluna de ~560–640px, **não a tela toda**. Desenhe o par nessa largura, não esticado: dois campos de 300px cada para dizer "2h30" é ridículo, e essa é exatamente a decisão que ninguém tomou.
- Não há versão exclusiva de desktop nem de mobile: é o mesmo componente nos dois.

## Regras que o desenho não pode quebrar
- **Aviso não é erro.** A frase dos 100 h é `info`, jamais `danger`, e termina em "Nada foi recusado." — pintá-la de vermelho diria o contrário do que ela está escrita para dizer.
- **A frase honesta nunca mora num placeholder.** Placeholder carrega número; explicação carrega elemento de largura inteira. (Regra paga em 016.)
- **Nenhuma normalização silenciosa.** Se o app mexer no número que a pessoa digitou (relógio reconhecido, minutos ≥ 60), a tela diz. Um campo que engole a entrada em silêncio é pior que um que recusa.
- **Alvo de toque ≥ 44px** em cada um dos dois campos, inclusive a 360px.
- **Sem overflow horizontal.** Um valor de 6 dígitos no campo de horas (`100000`) tem que caber ou truncar de forma medida — não empurrar o sufixo `h` para fora do card.
- **Contraste medido contra o fundo do card** (`--surface-card`), não contra o fundo da página: os sufixos `h`/`min` são o texto mais fraco da peça.
- Sem freemium aqui: este campo é gratuito e igual para todo mundo.

## Armadilhas já pagas neste projeto
- **O defeito de 60×**: `2:30` funcionava colado e não funcionava digitado, e o resultado silencioso era 30 horas. Qualquer desenho que não dê feedback ao estado intermediário reabre essa porta.
- **`2h30m` preservando os minutos antigos**: a versão anterior do parser recusava o sufixo `m` e mantinha o número velho — recusar é aceitável, recusar e ficar com outro número não é.
- **A grade de custos que clipava 1px do input** ("Tarifa de energia"): sufixo largo + prefixo + coluna estreita já estouraram uma vez. O par h+min tem dois wrappers com sufixo na mesma linha.
- **Texto ocluso passa em teste**: `toBeVisible` não enxerga um sufixo empurrado para fora da caixa. A prancheta precisa mostrar a geometria real a 360px, não uma aproximação confortável.
- **Homologação cega**: este campo específico já passou por homologação visual sem que ninguém visse o erro de 60×. O desenho tem que tornar o erro visível a olho nu.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:
1. O par em repouso a 390px, dentro do card "Custos da peça", com o campo anterior e o posterior visíveis para dar contexto de ritmo vertical.
2. A matriz de estados do par a 390px: repouso zerado · foco no campo de horas · digitando `2:` (intermediário) · relógio reconhecido · minutos transbordando · aviso de plausibilidade · erro.
3. O par a 1280px na coluna de ~600px, com a proporção horas:minutos que você propuser, declarada em números.
4. Um recorte a 360px com `100000` no campo de horas e o aviso completo abaixo, provando que nada estoura.

Reutilize os primitivos: o wrapper é o `Field` do DS (rótulo + `*` de obrigatório + hint + erro, com `labelAddon` livre à direita do rótulo caso proponha o `ⓘ`); cada campo é um `NumberField` com `unit` (`h` / `min`), números tabulares alinhados à direita; o aviso é a linha `tf-field__aviso` em tom `info`; o card é o `Card` de padding `md`. **Não crie um componente novo de time-picker, nem stepper, nem máscara** — o que falta aqui é forma e feedback, não um controle novo.

## Perguntas em aberto para o dono
1. **O atalho do fatiador deve ser anunciado?** Hoje `2:30` / `2h30` funciona e nada na tela conta. Vale uma frase fixa no hint (algo como "pode colar o tempo do fatiador: 2h30") — que custa uma linha permanente em todo formulário — ou fica como facilidade escondida?
2. **Este campo ganha o `ⓘ` que todos os vizinhos têm?** Se sim, o texto precisa ser escrito por você: o que é o tempo de impressão, de onde tirar, e por que ele mexe em dois custos ao mesmo tempo.
3. **Minutos ≥ 60 devem ser aceitos e transbordados (comportamento de hoje) ou recusados?** Aceitar é mais gentil com quem cola "150" pensando em minutos; transbordar sem avisar é o que a peça faz agora.
4. **Existe teto para horas?** Digitar `100000` é aceito hoje, só ganha aviso. Se houver um limite de negócio (48 h? 200 h?), ele muda o desenho do estado de erro.

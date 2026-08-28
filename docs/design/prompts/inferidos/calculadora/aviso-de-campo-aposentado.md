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

- **Onde vive:** Na pilha de topo de /calcular, imediatamente ABAIXO da barra de cenário carregado e ACIMA do resumo de kit (quando houver) e do cartão 'Usar do catálogo'.
- **Como o vendedor chega:** Aparece só ao reabrir, pela folha 'Meus cenários', uma simulação salva antes da mudança do modelo de preço — uma que ainda carrega um campo que o motor não aceita mais.
- **Vizinhança imediata:** Acima: a barra de cenário carregado (nome da simulação, ações de renomear/duplicar/salvar alterações, selo de alterações não salvas). Abaixo: o resumo de kit, ou o teaser, ou o cartão 'Usar do catálogo'. É um alerta informativo permanente — não é um aviso passageiro e não tem como fechar; fica enquanto a simulação estiver aberta. Duas variantes: a de uma simulação escalar e a de kit, esta deduplicada linha a linha para dizer uma vez só.
- **Dados que chegam (e o que ela devolve):** A lista de campos descartados no recálculo do documento antigo; o próprio motor recusa a chave aposentada, e o alerta apenas declara isso.
- **O que acontece depois:** O preço mostrado abaixo já é o recalculado SEM o campo aposentado. Salvar as alterações grava o documento no formato novo. É a peça de topo que mais compete por espaço: pode dividir a dobra com a barra de cenário, o resumo de kit, o teaser e o cartão de erro do picker.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”`

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

# Aviso de campo aposentado ao reabrir uma simulação antiga

## O que desenhar

O bloco de aviso que aparece na tela **Calcular preço** quando o vendedor reabre uma simulação salva
antes da mudança do modelo de preço (pricing-core 4.0.0), e que por isso carregava um campo que o
modelo atual não usa mais — hoje apenas "Desperdício (g)". A peça é um bloco informativo permanente
(não um toast) que fica logo abaixo da barra da simulação carregada e permanece na tela enquanto
aquela simulação estiver aberta. Quem a lê é o vendedor que acabou de abrir uma estratégia guardada e
está olhando um preço que **mudou sozinho** desde o dia em que ele salvou. Esse é o momento em que a
confiança no número está mais frágil na jornada inteira, e este bloco é a única explicação que existe.

## Por que este prompt existe

Nada disso foi desenhado. O bloco nasceu de um requisito de texto (016/US10, FR-913) e a IA decidiu
tudo o que é visual: que seria um alerta permanente e não um toast, que usaria o tom `info`, e que
ficaria empilhado no topo da página — exatamente onde já podem competir a barra de simulação, o resumo
de kit, o teaser de Premium e o card de erro do seletor de catálogo. Autoridade de desenho: **NENHUMA**
— confirmado por verificação adversarial contra os protótipos de 2026-07-02, o `prototype-audit`, o
`.design-import` e o canvas do 018; nenhum deles trata de migração de modelo de preço na interface. O
mais próximo é um item de "carimbo de versão da fórmula" no Histórico, que é outra coisa.

## O que já existe hoje (não invente do zero — corrija)

Ordem real da pilha do topo da página `Calcular preço`, de cima para baixo:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da página (centralizado) | "Calcular preço" |
| 2 | Legenda freemium (centralizada, corpo pequeno) | "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium." |
| 3 | Botão fantasma alinhado à direita, com ícone | "Minhas simulações" |
| 4 | Barra da simulação carregada | "Simulação: {nome}" · "Recalculado com os preços de hoje" · selo "Alterações não salvas" · "Abrir origem" · "Fechar simulação" |
| 5 | **ESTA PEÇA** — bloco `info` | "O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui." |
| 6 | (só se a base for kit) gêmeo do mesmo aviso + resumo do kit | mesma frase acima · "Kit: {nome}" · "Preços por canal do kit, recalculados com os preços de hoje." |
| 7 | (às vezes) card de teaser Premium | bloco de compra com preço e "Assinar" |
| 8 | (às vezes) card de erro do seletor de catálogo | bloco `danger` com botão de repetir |

O bloco de hoje usa o primitivo `tf-alert--info`: superfície tingida suave (`--tf-info-soft`), ícone
`info` de 20px em `--info-text`, corpo em `--text-body` no tamanho `body-sm`, padding `space-4`,
canto `radius-md`, ícone e texto separados por `space-3`. Largura: a coluna da página (460px no
mobile, até 1120px a partir de 1024px), com `space-4` de respiro entre cada item da pilha.

Problemas que o desenho precisa resolver:

- → O bloco **não tem título**. O primitivo tem um slot de título em negrito e ele está vazio: a frase
  inteira chega como um parágrafo de corpo pequeno, sem hierarquia, no meio de até três outros blocos
  de tom suave. Nada nele diz, em uma linha, "seu preço mudou e aqui está o motivo".
- → A frase explica o que o sistema fez ("o recálculo abaixo não o inclui") e **nunca diz a
  consequência** para o vendedor: que o preço exibido pode ser diferente do que ele salvou. É a
  informação que ele está procurando e ela não está escrita.
- → "O documento salvo" é linguagem de sistema. O vendedor salvou uma **simulação**, não um documento.
- → O campo "Desperdício (g)" não existe mais em lugar nenhum do formulário abaixo. O aviso cita um
  campo que o leitor não consegue localizar na tela, e não há nenhuma âncora visual entre os dois.
- → No desktop o bloco vira uma faixa de até 1120px com uma sentença curta: comprimento de linha
  desconfortável e muito espaço vazio à direita do texto.
- → Quando a base é um kit, o mesmo aviso aparece com a mesma frase logo antes do resumo do kit — dois
  blocos de tom suave colados um no outro.

## Conteúdo e dados reais

- **A frase, verbatim (homologada em 016/T036):** "O documento salvo continha {campo}. O modelo de
  preço atual não usa mais esse campo — o recálculo abaixo não o inclui."
- **`{campo}`** é sempre o nome em pt-BR, nunca a chave técnica. Hoje existe **um único** valor
  possível: "Desperdício (g)". O código já junta vários nomes com vírgula — o desenho tem de sobreviver
  a "Desperdício (g), Perda de suporte (g), Taxa de secagem (R$)" sem quebrar.
- **Quando aparece:** só ao reabrir uma simulação salva antes do modelo atual. O caso comum, de longe,
  é **não aparecer nada** — um documento salvo depois da mudança nunca carrega campo aposentado.
- **Variante escalar** (base avulsa ou referência de produto): um bloco, abaixo da barra da simulação.
- **Variante kit**: mesmo bloco, mesma frase, declarado **uma única vez** para o kit inteiro mesmo que
  várias peças carreguem o campo — e posicionado entre a barra da simulação e o resumo "Kit: {nome}".
- **Persistência:** fica na tela enquanto a simulação estiver aberta. Some quando o vendedor usa
  "Fechar simulação". Não tem botão de fechar próprio hoje.
- **Números ao redor** que contextualizam a peça: o preço recalculado que aparece logo abaixo, no
  formato do produto — por exemplo R$ 24,24 sugerido no varejo. É esse número que mudou.

## Estados obrigatórios

1. **Repouso — variante escalar, um campo.** A frase completa com "Desperdício (g)".
2. **Repouso — variante kit.** A mesma frase acima do resumo "Kit: {nome}" e da legenda "Preços por
   canal do kit, recalculados com os preços de hoje." Mostre os dois juntos: a colisão é o problema.
3. **Vários campos aposentados.** Três nomes na lista, com quebra de linha, para provar que a frase
   respira. Nunca reticências, nunca corte.
4. **Ausente.** A mesma pilha do topo sem o aviso — o caso comum. Serve para mostrar que a inclusão do
   bloco não desloca nem esconde nada do que já estava ali.
5. **Empilhado com os vizinhos.** Uma prancheta com o pior caso real: barra da simulação + selo
   "Alterações não salvas" + este aviso + resumo do kit + card de teaser Premium. É a competição que a
   IA criou sem ninguém decidir, e é isso que o desenho precisa hierarquizar.
6. **Premium pausado.** A barra da simulação acima já diz "Premium pausado"; o aviso coexiste com ela.
   Mostre que os dois não viram a mesma mancha visual.
7. **Offline.** A simulação foi reaberta do cache; o aviso de campo aposentado continua válido e
   idêntico — ele não fala de rede, e nada aqui pode sugerir que a divergência veio de conexão.
8. **Tema claro e tema escuro** do estado 1, com o contraste do texto medido contra a superfície
   tingida real, não contra o fundo da página.

O bloco **não tem nada interativo hoje** — não desenhe hover, foco, pressionado ou desabilitado a menos
que você proponha uma ação (fechar, ou um link de "entender"). Se propuser, desenhe os estados dela e
diga que é proposta, não o que existe.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça foi construída e onde a coluna de 460px é o limite
  real. O piso medido deste projeto é **360px**; confira que a frase mais longa (três campos) não
  provoca rolagem horizontal nessa largura.
- **Desktop 1280px** — obrigatório: a página da calculadora se alarga para até 1120px a partir de
  1024px e o bloco acompanha. É o viewport em que o problema de comprimento de linha e de espaço
  morto aparece. (O redesenho 018 não tocou a calculadora — aqui ainda é coluna única centralizada.)
- 1920px é dispensável: acima de 1120px o bloco não cresce mais.

## Regras que o desenho não pode quebrar

- **A frase honesta vive em elemento de largura total.** Nunca dentro de placeholder, nunca truncada,
  nunca com `line-clamp`. Este projeto já pagou por uma frase de honestidade cortada pela metade.
- **Divergência dita, não escondida.** O aviso existe para explicar um preço que mudou. Ele não pode
  ficar secundário a ponto de ser ignorado, nem alarmante a ponto de sugerir que o número atual está
  errado — o número atual é o **certo**; o antigo é que era de outro modelo.
- **Falha de rede nunca vendida como outra coisa, e vice-versa.** Nada neste bloco pode insinuar
  conexão, sincronização ou perda de dados. Nada foi perdido: o documento salvo continua intacto.
- **Nada de data.** A superfície de simulações não exibe datas em lugar nenhum (a promessa é "recalcula
  com os preços de hoje"). Não invente "salvo em 12/07".
- **Nada de venda.** Este bloco não é lugar de CTA de Premium; ele já disputa espaço com um teaser.
- **Alvo tocável ≥44px** para qualquer ação que você proponha, e contraste medido contra a superfície
  tingida (`--tf-info-soft`), que é onde o texto de fato assenta.

## Armadilhas já pagas neste projeto

- **Rolagem horizontal medida nos DOIS eixos.** A lista de nomes de campo tem de quebrar linha; se ela
  empurrar a coluna, o headless não enxerga a barra clássica e o defeito passa.
- **Texto ocluso passa em teste.** `visível` não é propriedade do texto: o bloco não pode ficar atrás do
  cabeçalho fixo nem ser empurrado para fora da primeira dobra quando a barra da simulação cresce com o
  selo "Alterações não salvas".
- **Valor grande estoura a coluna.** A cadeia de flex desta página já cedeu uma vez a um preço
  astronômico; o corpo do alerta precisa poder encolher, não empurrar.
- **Um bloco a mais no topo é um bloco a menos de calculadora.** A primeira dobra desta página já foi
  corrigida uma vez por conter a afirmação errada de valor; empilhar mais um aviso permanente sem
  hierarquia repete o problema por outro caminho.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como primeira classe (o estado 8 em ambos, os demais
podem ficar só no escuro):

1. Mobile 390px — estado 1 (escalar, um campo).
2. Mobile 390px — estado 3 (três campos, frase longa).
3. Mobile 390px — estado 2 (kit: aviso + "Kit: {nome}" + legenda do resumo).
4. Mobile 390px — estado 5 (pilha do pior caso, com barra da simulação e teaser).
5. Mobile 390px — estado 4 (ausente), lado a lado com a 1 para comparar o deslocamento.
6. Desktop 1280px — estado 1 e estado 5.
7. Estado 8 — a 1 nos dois temas.

Reutilize os primitivos existentes; não crie novos. O bloco é o **`tf-alert` em tom `info`**, com o
ícone `info` de 20px que ele já traz e o **slot de título** que hoje está vazio — se você propuser um
título, ele entra ali, não em um elemento novo. A barra da simulação, o resumo de kit, o card de teaser
e o card de erro do seletor são componentes que já existem: desenhe-os apenas como contexto, sem
redesenhá-los. Se a sua solução for mudar o **lugar** do aviso (por exemplo, ancorá-lo junto ao preço
recalculado em vez da pilha do topo), mostre as duas versões e diga qual você defende e por quê.

## Perguntas em aberto para o dono

1. A frase deve dizer a **consequência** — que o preço recalculado pode ser diferente do que foi salvo
   — ou o dono prefere manter só a explicação técnica do descarte? Isso muda o título, o tom e o
   tamanho do bloco, e é decisão de produto, não de desenho.
2. "O documento salvo" fica ou vira "A simulação salva"? A frase atual é copy homologada em 016/T036;
   trocar palavra homologada é decisão do dono.
3. O aviso deve poder ser **dispensado** pelo vendedor (um "×" que o fecha para aquela simulação), ou é
   permanente por princípio enquanto a simulação estiver aberta? Hoje é permanente, por escolha da IA.
4. Quando a base é kit, o aviso deve continuar como bloco separado ou ser absorvido como uma linha
   dentro do resumo "Kit: {nome}"? São dois blocos de tom suave colados hoje.

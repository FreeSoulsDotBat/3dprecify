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

- **Onde vive:** A faixa logo ACIMA da grade de duas colunas: é o último elemento da pilha de topo, imediatamente antes de 'Custos da peça'.
- **Como o vendedor chega:** Aparece sozinho ao abrir /calcular, em uma de três montagens conforme quem está olhando e o que está salvo.
- **Vizinhança imediata:** Acima: o teaser (no grátis), o resumo de kit, os avisos de campo aposentado, a barra de cenário carregado, o botão 'Meus cenários' — nessa ordem inversa. Abaixo: sempre o título 'Custos da peça'. As três montagens: (a) Premium com itens salvos — Card com o rótulo 'Usar do catálogo', a frase 'Preenche os campos com o item salvo — você ainda pode editar tudo.' e dois selects lado a lado ('Filamento salvo' e 'Impressora salva'), que podem aparecer sozinhos se só um tipo tiver itens; (b) grátis/deslogado — Card com o teaser de Premium e, como afordância, um botão secundário DESABILITADO escrito 'Usar do catálogo'; (c) falha real de leitura sem cache — Card com alerta de perigo e um botão 'Tentar de novo'.
- **Dados que chegam (e o que ela devolve):** As listas de filamentos e impressoras do catálogo Premium, por uid, que respondem do cache local depois de uma leitura online. Escolher um item escreve nos campos do formulário abaixo.
- **O que acontece depois:** Filamento preenche custo e peso do rolo; impressora preenche valor da máquina, vida útil, consumo e reserva de manutenção — e a vida útil vinda de lá pode abrir o bloco da máquina já no modo 'ajustar'. Os campos continuam editáveis: é pré-preenchimento, nunca travamento.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Seção Marketplace — chave “Incluir marketplaces no preço” e canais repetíveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Bloco "Usar do catálogo" no topo da Calcular — e as três identidades da mesma faixa

## O que desenhar

Uma faixa fixa no topo do formulário de **Calcular preço**, logo acima da seção "Custos da peça"
(e, no desktop, acima da grade de duas colunas custos/markup). Ela é a ponte entre o Catálogo
premium e o cálculo: quem tem filamentos e impressoras salvos escolhe um em cada seletor e os
campos do formulário se preenchem sozinhos. É o primeiro elemento que o vendedor vê ao abrir a
tela para orçar uma peça — antes de digitar qualquer número. O problema de desenho é que **essa
mesma faixa, na mesma posição, tem três identidades completamente diferentes** (seletores /
convite de venda / erro de leitura) e uma quarta situação em que ela simplesmente não existe.
Elas nunca foram desenhadas juntas.

## Por que este prompt existe

A ficha da auditoria classifica esta peça como `PROTOTIPO_PARCIAL`: dois dos três estados têm
ancestral desenhado — o protótipo de 2026-07-02 (§E4, linhas 245-246) pedia "dropdowns Filamento ▾
e Impressora ▾ **+ link 'inserir manualmente' como fallback sempre disponível**", e o
`-fixes.md` item 1 desenhou o card de teaser compacto do usuário grátis com o link **"Ver
Premium"**. Nunca foram desenhados: (1) o estado de **falha de leitura com retentativa**, que
nasceu em 016/T072-A8; (2) a troca do link "Ver Premium" por um **botão desabilitado**; (3) o
**sumiço silencioso** quando a conta é premium mas não tem nenhum item salvo; (4) o "inserir
manualmente", que o protótipo exigia e que o `CalculatorScreen.jsx` exportado nem chegou a
implementar. O item (2) é o caso em que **o código contraria uma decisão de desenho explícita**:
onde havia um link para o Premium, hoje há um botão cinza inerte.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/calcular/calcular-page.tsx` (linhas 397-467),
`apps/web/src/features/calculator/catalog-prefill.ts`,
`apps/web/src/shared/billing/premium-teaser.tsx`, textos em
`apps/web/src/shared/i18n/messages.pt-br.ts`.

**Montagem (a) — premium com itens salvos.** Um card com, nesta ordem: título de seção
"Usar do catálogo" · legenda "Preenche os campos com o item salvo — você ainda pode editar tudo."
· uma grade **fixa de duas colunas iguais** com dois selects rotulados "Filamento salvo" e
"Impressora salva", ambos com o placeholder "Escolher…".
→ A grade é `1fr 1fr` **também no mobile de 390px**: dois selects de ~170px lado a lado, tendo
que exibir nomes como "PLA Preto Voolt 1,75mm" ou "Creality Ender 3 V3 SE (oficina)".
→ Se o vendedor salvou só filamentos, **um select ocupa metade e a outra metade fica vazia**.
→ Depois de escolher, **nada na tela diz que os campos abaixo vieram daquele item**; se o vendedor
editar "Custo do rolo" à mão, o select continua exibindo o nome do filamento, agora mentindo.
→ O hook de leitura tem uma bandeira `stale` (lista servida do cache offline depois de a leitura
online falhar) e **a tela não a lê**: uma lista possivelmente desatualizada aparece idêntica a uma
lista fresca. Há um comentário no código afirmando que o card mostra esse aviso; ele não mostra.
→ O hook tem `isLoading`, e **não há estado de carregamento**: o card aparece de repente quando os
itens chegam, empurrando o formulário para baixo.

**Montagem (b) — conta grátis ou deslogada.** Um card com o teaser premium unificado: título
"Preencha o cálculo com um toque" · subtítulo "O catálogo guarda seus filamentos e impressoras
salvos: no Premium, eles preenchem os campos abaixo sozinhos — e continuam editáveis." · a linha
de preço "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" com o botão primário
"Assinar Premium" · a legenda "O cálculo de custo e markup continua grátis." · e, por último, a
afordância desabilitada: um **botão secundário inerte escrito "Usar do catálogo"**.
→ Esse botão é o item inferido. Ele é o único elemento cinza-inerte da tela, fica **abaixo** do
"Assinar Premium" (duas afordâncias de topo competindo) e não tem estado de foco nem explicação
própria — é preciso ler o subtítulo três linhas acima para saber por que ele está morto.

**Montagem (c) — falha real de leitura, sem cache.** Um card contendo um alerta de tom **perigo**
com o título "Não foi possível carregar seus itens salvos agora." e, dentro dele, um botão
secundário pequeno "Tentar novamente".
→ Só aparece para conta autenticada e **só quando há falha de verdade**; um 403 de direito
(conta sem premium) nunca cai aqui, e "você ainda não salvou nada" é silêncio proposital.
→ Não há estado de "tentando de novo" no botão: o clique dispara duas releituras e a tela não muda.

**Situação (d) — silêncio.** Conta premium, catálogo vazio: **nenhum card**. O formulário começa
direto em "Custos da peça" e nada convida a cadastrar o primeiro filamento.

## Conteúdo e dados reais

| Elemento | Conteúdo real | Observação |
|---|---|---|
| Select "Filamento salvo" | opções = nomes salvos; 1ª opção "Escolher…" | pode ter 0, 1 ou dezenas |
| Select "Impressora salva" | idem | independente do de filamento |
| Campos que o filamento preenche | "Custo do rolo" (R$ 110,00) · "Peso do rolo" (1,000 kg) | continuam editáveis |
| Campos que a impressora preenche | "Valor da máquina" (R$ 1.899,00) · "Vida útil da máquina" (2.000 h) · "Consumo médio" (0,12 kW) · "Reserva de manutenção" (R$ 0,35/h) | 4 campos de uma vez |
| Linha de preço do teaser | "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" | texto único, nunca recomposto |
| Erro | "Não foi possível carregar seus itens salvos agora." + "Tentar novamente" | tom perigo |

Nomes de itens são texto livre do vendedor: desenhe com um nome curto ("PLA Preto") **e** com um
nome longo real ("PLA Silk Bicolor Azul/Prata 1,75mm — rolo da promoção") na mesma prancheta.
Nenhum campo desta peça é obrigatório: escolher do catálogo é sempre opcional.

## Estados obrigatórios

1. **Repouso premium com os dois seletores** — nada escolhido, ambos em "Escolher…".
2. **Premium com apenas um seletor** (só filamentos salvos, ou só impressoras) — resolva a metade vazia.
3. **Item escolhido** — o select mostra o nome; decida se e como a peça declara "estes 2 (ou 4)
   campos abaixo foram preenchidos a partir daqui".
4. **Foco e hover no select** — anel de foco visível sobre o fundo do card, não sobre o da página.
5. **Carregando** — a lista ainda não chegou (hoje inexistente; o card materializa do nada).
6. **Lista servida do cache / possivelmente desatualizada** (`stale`) — hoje invisível.
7. **Erro de leitura com retentativa** — "Não foi possível carregar seus itens salvos agora." +
   "Tentar novamente", e o estado do botão **durante** a retentativa.
8. **Grátis/deslogado (teaser)** — com o botão "Usar do catálogo" desabilitado: mostre repouso,
   foco (um alvo desabilitado ainda precisa ser explicável) e a versão deslogada.
9. **Premium sem nenhum item salvo** — hoje é ausência total; desenhe a alternativa para o dono decidir.

## Viewports

- **390px (mobile)** — obrigatório: é onde a grade `1fr 1fr` aperta dois nomes longos em ~170px
  cada, e onde o card do teaser (título + subtítulo + preço + botão + legenda + botão inerte)
  empilha seis elementos antes do primeiro campo do formulário.
- **1280px (desktop, o corte do 018)** — obrigatório: a faixa é **largura total**, acima da grade
  de duas colunas do formulário; dois selects sozinhos numa faixa larga precisam de uma proporção
  decidida, não esticada.
- **1920px** — mostre a mesma faixa no limite superior, onde o risco é o oposto: dois selects
  perdidos num campo de largura enorme e um teaser centralizado com muito ar.

## Regras que o desenho não pode quebrar

- **Freemium binário**: quem não é premium não vê seletor funcionando "com um item de exemplo".
  Ou tem acesso, ou vê o convite. Nada de meia-porta.
- **Falha de rede nunca é vendida como falta de assinatura**: a montagem (c) não pode se parecer
  com a montagem (b). São a mesma posição da tela — precisam ser inconfundíveis à distância.
- **Ausência de itens não é erro**: o vendedor que ainda não cadastrou nada não pode ver tom de
  perigo nem texto de falha.
- **Preencher nunca é travar**: os campos preenchidos continuam editáveis, e o desenho não pode
  sugerir cadeado, campo somente-leitura ou valor "oficial".
- **Procedência do número**: se a peça declarar de onde veio o valor, essa declaração é de texto
  corrido no card, **nunca dentro de um placeholder** (uma frase honesta em placeholder some ao
  digitar e é cortada pela largura do campo — já pago no 016/PR-F).
- **Alvos ≥44px** para os dois selects e para os botões, inclusive o desabilitado.
- **Contraste medido contra o fundo real do card**, não contra o fundo da página — o card tem
  superfície própria, e o botão desabilitado é o elemento de menor contraste da tela.

## Armadilhas já pagas neste projeto

- **Grade de duas colunas fixa no mobile**: `1fr 1fr` não vira uma coluna a 390px. Nome longo =
  texto cortado ou estouro horizontal medido em pixels, e `toBeVisible` passa em cima disso.
- **Dois CTAs de compra na mesma tela**: este teaser já ficou visível atrás da folha de Simulações,
  cada um com o seu "Assinar" (016/T010-A3, mesma classe do E6/T038-D4). Se o desenho propuser o
  teaser em posição fixa ou sobreposta, ele reabre isso.
- **Card que desaparece em silêncio**: foi exatamente o defeito 016/T072-A8. Sumir é uma decisão
  de desenho, não um efeito colateral.
- **Frase honesta cortada**: a legenda "Preenche os campos com o item salvo — você ainda pode
  editar tudo." precisa de largura total do card; não a coloque ao lado de um select.
- **Valor grande estourando a coluna**: "R$ 1.899,00" e "2.000 h" chegam juntos nos quatro campos
  da impressora logo abaixo — desenhe a faixa sabendo o que ela empurra.

## Entregável

Pranchetas, **tema escuro como padrão e tema claro em pé de igualdade**:

1. Premium, dois seletores, repouso — 390 · 1280 · 1920.
2. Premium, um seletor só, e a versão com item escolhido (nome longo).
3. Carregando + lista desatualizada (`stale`) — a proposta para os dois buracos de hoje.
4. Erro com retentativa (incluindo o botão em retentativa) — 390 · 1280.
5. Grátis/deslogado com a afordância desabilitada — 390 · 1280 — e, ao lado, a **alternativa**
   ao botão inerte (o link "Ver Premium" que o protótipo previa), para o dono comparar.
6. Premium sem itens: o silêncio de hoje vs. a proposta de convite ao Catálogo.

Reutilize os primitivos existentes, sem criar novos: o contêiner é o **card** com padding médio;
o título usa o estilo de **rótulo de seção** e a legenda o de **caption**; os seletores são
**Field + Select** com rótulo justo; o erro é o **Alert de tom perigo** com **Button secundário
pequeno** dentro; o convite é o **PremiumTeaser** já unificado (título, subtítulo, linha de preço +
"Assinar Premium", legenda, afordância) — a estrutura dele é fechada e não deve ser rearranjada,
apenas posicionada.

## Perguntas em aberto para o dono

1. O protótipo pedia um link **"inserir manualmente" sempre disponível** ao lado dos seletores.
   Hoje ele não existe (os campos já são editáveis). Ele volta como afordância explícita, ou a
   editabilidade dos campos basta?
2. Conta premium com **catálogo vazio**: continua silêncio total, ou ganha um convite discreto
   para cadastrar o primeiro filamento/impressora?
3. A afordância do gate deve ser o **botão desabilitado "Usar do catálogo"** (o que existe) ou o
   **link "Ver Premium"** (o que foi desenhado)? A troca nunca foi decidida por ninguém.
4. Depois de escolher um item, a peça deve **declarar a procedência** dos campos preenchidos — e,
   se o vendedor editar um deles à mão, o nome escolhido deve continuar exibido?
5. Lista servida do cache offline (`stale`): mostra aviso de "pode estar desatualizado" dentro do
   card, ou o catálogo salvo é considerado estável o bastante para não avisar?

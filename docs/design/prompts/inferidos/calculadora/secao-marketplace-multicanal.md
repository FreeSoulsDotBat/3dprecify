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

- **Onde vive:** Último bloco da COLUNA DIREITA de /calcular, abaixo do Card 'Markup' (conta Premium). Na conta grátis a seção sai da coluna e vira uma faixa de largura total abaixo das duas colunas — ver o portão.
- **Como o vendedor chega:** É o fim do caminho de entrada: o vendedor já digitou custos, mão de obra e markup e agora diz onde vende. A chave mestra começa LIGADA para quem é Premium.
- **Vizinhança imediata:** Acima: o Card 'Markup' (e, no grátis, 'Outros custos'). Dentro, em ordem: título 'Marketplace' com ⓘ → uma linha inteira com o texto 'Incluir marketplaces no preço' à esquerda e o interruptor à direita → (se ligado) o alerta opcional de falha de atualização do catálogo → N cartões de canal empilhados com gap → um botão secundário 'Adicionar canal'. Abaixo: nada nessa coluna — o próximo elemento é o rodapé de largura total.
- **Dados que chegam (e o que ela devolve):** Recebe o catálogo de tarifas (servido, cacheado ou semente) e o entitlement. Devolve, por canal, um resultado calculado localmente — anúncio e líquido para varejo e atacado.
- **O que acontece depois:** Com a chave desligada, nada de canal é computado nem mostrado (o preço direto varejo/atacado continua intacto). Com ela ligada, cada canal aparece no bloco 'Preços por canal', na cauda do cartão do detalhamento, lá no rodapé — nunca aqui.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Calcular no desktop — grade de duas colunas + rodapé centralizado` · `Seção “Custos da peça” — grade fundida de campos obrigatórios e opcionais` · `Campo de tempo de impressão em horas + minutos` · `Bloco “quanto custa a máquina” — ritmo + payback + custo/hora derivado + modo ajustar` · `Seção “Outros custos” — linhas nomeadas adicionáveis` · `Cartão de um canal — composição, ordem e densidade` · `Seletor de categoria do marketplace — busca, contagem, resultados e árvore` · `Selo de origem e vigência da tarifa (e o selo separado da taxa fixa)` · `Perguntas de perfil do vendedor (CPF/CNPJ e alto volume)` · `Chaves de taxa opcional do canal (ex.: item volumoso)` · `Campo de taxa com valor do catálogo no placeholder + legendas de faixa e regra` · `Os dois avisos honestos da Shopee (taxa não publicada e frete aferido)` · `Informação do subsídio de frete da Shopee sob a grade de taxas` · `Bloco “Preços por canal” dentro de “Como chegamos no preço”` · `Estados de um canal sem preço: faixa sem tarifa, líquido negativo, sem comissão, canal com erro` · `Avisos de plausibilidade por campo (aviso que não é erro)` · `Avisos que só o resultado denuncia (preço zero, custo absurdo, atacado acima do varejo)` · `Estado “não dá para calcular” — o resultado inteiro substituído por um alerta` · `Estado de falha (não bloqueante) na atualização do catálogo de tarifas` · `Gate Premium da seção Marketplace na conta grátis` · `Bloco “Usar do catálogo” na Calcular e seus três estados` · `Resumo somente-leitura de um kit como base do cálculo` · `Dicas ⓘ nos títulos de seção e nos rótulos de campo` · `“Como chegamos no preço” e os dois cartões de preço final` · `Topo da Calcular — título, promessa freemium e a porta “Meus cenários”` · `Aviso persistente de campo aposentado ao reabrir uma simulação antiga`

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

# Seção Marketplace: a chave mestra e a pilha de canais

## O que desenhar

A seção "Marketplace" da tela **Calcular** (`/calcular`): título com ⓘ, a linha de largura total com a
chave **"Incluir marketplaces no preço"** e, quando ligada, uma **lista repetível de cartões de canal** —
cada cartão é um marketplace (Mercado Livre, Shopee, Amazon, Outro) com suas perguntas e suas taxas — mais
o botão "Adicionar canal" no fim. É onde mora a promessa central do produto: comparar o mesmo produto em
Shopee × ML × Amazon no mesmo cálculo. Quem usa é o vendedor 3D que já preencheu custo e markup acima e
quer saber por quanto anunciar em cada canal. No desktop (≥1024px) ocupa a coluna DIREITA de uma grade de
duas; no mobile é uma seção empilhada. Os PREÇOS por canal **não** ficam aqui — desde 016/US5 vivem no
rodapé, em "Como chegamos no preço". Esta peça é só a ENTRADA.

## Por que este prompt existe

O protótipo de 2026-07-02 (§E4) desenhou **um** canal: um select (Shopee / ML Clássico / ML Premium /
Nenhum) e dois campos (taxa fixa R$ + comissão %), numa seção colapsável compartilhada com "Falha". A
repetição, o interruptor mestre e tudo que veio depois nasceram sem desenho — busca por "Incluir
marketplaces no preço" e "Adicionar canal" nas quatro autoridades de design devolve **zero**. Hoje um
cartão pode ter 8 controles + 2 legendas + 2 selos + 2 avisos, e N deles empilham numa coluna de meia tela:
é a maior fonte de altura da página. E com a chave **desligada** a tela não mostra nada — nem um resumo do
que se perdeu.

## O que já existe hoje (não invente do zero — corrija)

**Cabeçalho.** Título `Marketplace` com ⓘ; o tooltip diz: *"Sobre o marketplace — Calcula o preço para
anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio =
(preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a
taxa fixa."*

**Linha da chave.** `<label>` de largura total, clicável inteiro: **"Incluir marketplaces no preço"** à
esquerda (tom secundário), Switch à direita, FORA de qualquer área colapsável para a seção ser sempre
religável. Desligar esconde os canais e para de calcular.
→ Problema: desligada, a seção some inteira e **não sobra nenhuma frase** dizendo o que deixou de ser
calculado — o vendedor não tem como saber que perdeu a comparação de canais.

**Cartão de canal** (`Card`, padding md, controles com gap-3), na ordem real do código:

| # | Controle | Rótulo literal | Tipo / unidade | Quando aparece |
|---|---|---|---|---|
| 1 | Marketplace | `Marketplace` | Select: "Mercado Livre", "Shopee", "Amazon", "Outro" | sempre |
| 1b | Remover | botão ✕ (`aria-label` "Remover canal") | ghost, sm, ao lado do select | sempre |
| 2 | Modalidade | `Modalidade` | Select: ML → "Clássico"/"Premium"; Amazon → "Profissional"/"Individual" | só onde o catálogo declara o eixo |
| 3 | Categoria | picker de categoria com busca | só onde o catálogo publica a espinha (hoje ML/Amazon; Shopee não tem) |
| 4 | Perfil | `Você vende como` | Select "Pessoa física (CPF)" / "Pessoa jurídica (CNPJ)", placeholder "Selecione" | só Shopee |
| 5 | Volume | `Mais de 450 pedidos nos últimos 90 dias?` | Select "Sim"/"Não" | só Shopee **e** só se CPF |
| 6 | Comissão | `Comissão` | número, unidade `%` | conforme o plano do canal |
| 7 | Taxa fixa | `Taxa fixa` | dinheiro | idem |
| 8 | Mínimo | `Comissão mínima/item` | dinheiro | idem |
| 9 | Frete | `Frete` | dinheiro; dica "Descontado do valor recebido (não é embutido no anúncio)." | idem |

Os campos 6–9 ficam numa **grade de 2 colunas** dentro do cartão. Nascem VAZIOS, com o placeholder
mostrando o valor que o catálogo aplica (ex.: `14,5` em Comissão, `2,00` em Taxa fixa) — placeholder e não
valor preenchido, porque preenchido faria o vendedor achar que ele digitou. → Problema medido em 016/PR-F:
a frase da REGRA nunca cabe como sufixo de placeholder (77–187px úteis: saía "2,50 (= 50").

**Abaixo da grade, na ordem:** legenda de banda ("Tabela por faixa de preço — valores da faixa do seu
anúncio." + "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já
calculado.") · legenda do subsídio Shopee · checkbox de sobretaxa opcional vinda do catálogo (ex.: manuseio
de volumoso) · a linha de **selos de honestidade** · os avisos Shopee.
→ Problema: até seis blocos de texto miúdo em sequência num cartão de ~560px (desktop) ou 390px (mobile),
sem hierarquia desenhada entre eles.

**Fim da lista:** `Button` secondary sm **"Adicionar canal"**, à esquerda. Sem limite de canais no código.

## Conteúdo e dados reais

- Selos, ao pé do cartão: "Referência · atualizada em {data}", "pode estar desatualizada", "referência
  embutida (offline)", "ajustado por você", "sem referência — informe as taxas", "estimativa de frete",
  "categoria não informada — usando a maior alíquota da tabela", e o selo SEPARADO "Taxa fixa · vigente
  desde {data}" quando a tarifa fixa tem outra fonte que a comissão.
- Subsídio de frete Shopee (informação, nunca desconto): *"A Shopee oferece cupons de frete grátis (até
  R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar
  para você, se houver."* + "Fonte: {fonte}, vigente desde {data}." · Sobretaxa opcional: *"{valor} por
  pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide
  sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido)."*
- Números verdadeiros: semente **R$ 16,16** (custo), **R$ 24,24** (varejo), **R$ 21,01** (atacado); taxa
  fixa Amazon Individual **R$ 2,00**; teto de cupom Shopee **R$ 20,00**; comissão típica 10%–20% (abaixo
  disso dispara aviso de plausibilidade), faixa 0–99,99% (≥100% erra **só** aquele cartão); dinheiro ≥ 0.
  Use **R$ 1.234,56** em pelo menos um campo para provar a máscara de milhar. Os campos 6–9 são todos
  opcionais — o preço calcula com o que houver e o selo diz de onde veio.

## Estados obrigatórios

- **Chave ligada, um canal (padrão)** — primeira visita: um cartão só, Amazon Profissional, placeholders
  vindos do catálogo. **Chave desligada** — hoje: seção vazia (ver Perguntas em aberto).
- **Sem permissão (grátis)** — Switch **desabilitado e falso**; abaixo, centrada, a frase "Vender em
  marketplaces faz parte do Premium." com o botão de assinar colado nela, lidos como uma unidade. Aqui a
  seção atravessa as DUAS colunas do desktop, não fica presa numa.
- **Falha de atualização das taxas** — `Alert` tom **info** (nunca perigo), título "Não foi possível
  atualizar as taxas", corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando.
  Você também pode informar as taxas manualmente." e botão secundário "Tentar novamente".
- **Retentando** — o mesmo alerta com o botão carregando; o alerta **não** pisca para fora.
- **Offline / degradado** — selo "referência embutida (offline)", ou "sem referência — informe as taxas" e
  aí os campos ficam vazios, sem placeholder nenhum.
- **Erro no canal** — comissão ≥100%: "A comissão deve ser menor que 100%." só naquele cartão, os outros
  seguem calculando. E, quando o anúncio cai numa faixa sem tarifa publicada: "Sem tarifa publicada para a
  faixa de preço deste anúncio — informe a comissão do canal para precificar."
- **Avisos Shopee** — "A Shopee não publica a fórmula completa desta taxa" (só CPF alto volume sem tarifa,
  corpo verbatim citando R$10/R$6,50 e R$8/R$6) e o de frete aferido, sempre presente em canal Shopee,
  hoje colapsado numa linha com o gatilho "Sobre o frete aferido".
- **Foco, hover, pressionado, desabilitado** do Switch, do ✕ e do "Adicionar canal"; e **muitos canais** —
  4 cartões empilhados (ML + Shopee + Amazon + Outro), o pior caso real de altura, nunca visto.

## Viewports

- **390px** — onde a peça nasceu e onde a grade de 2 colunas dos campos de taxa fica mais apertada; a linha
  da chave precisa do texto inteiro sem quebrar em 2 linhas ao lado do Switch.
- **1280px** — a coluna direita (~560px úteis) com 4 cartões empilhados, e a página em miniatura ao lado
  para deixar visível o desequilíbrio das colunas. **1920px** — a largura de referência do dono (018),
  mesmo caso de 4 canais.

## Regras que o desenho não pode quebrar

- **Freemium binário**: sem assinatura, zero número de canal — nem parcial, nem exemplo, nem borrado.
- **Procedência sempre dita**: número do catálogo carrega selo; ajustado à mão vira "ajustado por você";
  campo com placeholder de catálogo **não** pode parecer campo digitado.
- **Falha de rede nunca é falta de permissão** (e vice-versa): alerta info e gate Premium, peças distintas.
- **Cupom da Shopee é dinheiro da Shopee**: informação ao lado do campo, nunca desconto dentro do "Frete".
- **Frase honesta nunca em placeholder** — placeholders carregam só números.
- Alvos ≥44px, inclusive o ✕ de remover (hoje é ghost `sm`); contraste medido contra o fundo do `Card`,
  não contra o fundo da página.

## Armadilhas já pagas neste projeto

- **Overflow medido nos dois eixos**: legenda longa ou valor de quatro dígitos num cartão de coluna de
  560px já estourou a coluna (`min-width: 0` existe por isso); e texto ocluso passa em teste — layout se
  afirma com caixas, não com asserção de texto.
- **Sufixo de placeholder cortado** (016/PR-F): "2,50 (= 50" — parêntese aberto e número solto.
- **Órfão de 149,6px** (CTA longe da legenda que o motiva, por isso o gate ganhou centro) e o buraco de
  1.671px a 1440px quando o gate ficou aninhado numa coluna só.
- **Campo vazio ao lado de preço descontado**: "Comissão 0,00 %" com o preço mostrando 15% aplicados.

## Entregável

Pranchetas, tema **escuro** como padrão e **claro** como equivalente de primeira classe:
1. 390px — chave ligada, um canal (Amazon), estado de repouso.
2. 390px — chave desligada (com a sua proposta do que fica no lugar).
3. 390px — sem permissão: switch desabilitado + "Vender em marketplaces faz parte do Premium." + CTA.
4. 390px — Shopee completo: perfil CPF + 450 pedidos + subsídio + sobretaxa + dois avisos + selos.
5. 1280px — coluna direita com quatro canais + "Adicionar canal", página em miniatura ao lado.
6. 1280px — alerta info de falha de atualização e o cartão com erro de comissão ≥100% ao mesmo tempo.
7. 1920px — o mesmo caso de quatro canais, mais um detalhe ampliado da linha da chave e da linha de selos
   com foco/hover/pressionado/desabilitado.

Reutilize os primitivos, sem criar nenhum: `tf-card` (canal), `tf-switch` (chave), `tf-select`
(marketplace/modalidade/perfil), `tf-field` + `tf-input` (taxas), `tf-checkbox` (sobretaxa), `tf-alert` tom
info (falha), `tf-badge` (selos), `tf-button--secondary` ("Adicionar canal"/"Tentar novamente") e
`tf-button--ghost` (✕).

## Perguntas em aberto para o dono

1. Com a chave **desligada**, o que fica no lugar? Nada (hoje), uma frase do tipo "os preços na tela são
   de venda direta, sem marketplace", ou um resumo do último cálculo por canal?
2. Existe **limite de canais**? O código não tem nenhum, e nada impede dez cartões do mesmo marketplace —
   inclusive: repetir o mesmo canal (ML Clássico e ML Premium lado a lado) é uso pretendido?
3. Um cartão preenchido deveria poder **colapsar** (mostrando só "Shopee · 20% · R$ 4,00"), para que
   quatro canais não custem 2.500px de página?
4. Remover um canal preenchido pede confirmação, ou desfazer basta?

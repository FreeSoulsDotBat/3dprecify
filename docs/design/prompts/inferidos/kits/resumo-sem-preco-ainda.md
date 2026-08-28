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

## O mapa funcional de Kits / BOM multi-peça

### O que é a área Kits

O vendedor de impressão 3D às vezes não anuncia uma peça: anuncia um **conjunto** ("suporte + base", "kit de 3 vasos"). A aba **Kits** é onde ele monta esse conjunto peça por peça e vê o preço do kit inteiro — custo total, preço de varejo, preço de atacado e, se ele usa marketplaces, quanto sai o anúncio e quanto sobra líquido em cada canal.

### Como ele chega e o que encontra

- **Aba 3 da navegação** (`/kits`, rótulo "Kits") → cai no **compositor vazio**, pronto para montar um kit novo.
- **`/kits?id=<id>`** → o mesmo compositor **hidratado com um kit salvo** (veio da aba Kits dentro do Catálogo, ou de um "Salvar kit" que acabou de acontecer). As peças chegam já resolvidas pelo servidor.
- **`/kits?id=<id>&copy=true`** → duplicar: carrega os mesmos dados, o nome ganha o sufixo "(cópia)" e **salvar cria um kit novo** — nada é escrito sem o vendedor mandar.
- **`/catalogo?tab=kits`** → a *lista* de kits salvos (quarta pílula do Catálogo, ao lado de Filamentos · Impressoras · Produtos). Não é uma segunda tela de edição: abrir uma linha manda de volta para `/kits?id=`.

A rota `/kits` é **pública** — quem está deslogado ou sem Premium chega nela e vê um teaser honesto, nunca um chute para fora.

### O que a área guarda, e o que ela só calcula

Um kit salvo guarda **estrutura, nunca dinheiro**: nome, ordem das peças, quantidade e, por peça, ou uma **referência viva** a um produto do catálogo ou os valores próprios daquela peça. Preço **nenhum** é armazenado — ele é recalculado do zero a cada abertura, pelo motor `pricing-core`, que roda **no aparelho e offline**. Por isso a linha da lista de kits só sabe dizer "3 peça(s)", jamais um valor.

As leituras (kits salvos, produtos do catálogo) vêm do servidor e ficam num **cache local por conta**; se a rede falhar, o cache continua servindo e a tela diz que o dado pode estar desatualizado. **As escritas de kit são só online** — o servidor é quem decide o direito de gravar, então não existe fila/outbox para "Salvar kit" e não existe confirmação otimista: o toast "Kit salvo." e o recibo só aparecem depois de uma resposta real.

### De que depende

Catálogo de **tarifas de marketplace** servido + cacheado (alimenta os preços por canal de todas as peças de uma vez) · **entitlement** consultado no servidor (`active` · `lapsed` · `none`) · **sessão Firebase** · o catálogo de **produtos** do vendedor (o seletor de peça) · o motor `pricing-core`.

### O que a área alimenta depois

- **Salvar kit** escreve no catálogo do vendedor: cada peça que não é referência vira um **produto novo em Produtos** (materialização) — e é isso que o recibo pós-salvamento conta.
- **Salvar em Orçamentos** congela o kit como documento (aba Orçamentos): o preço de hoje vira registro imutável, itemizado peça a peça. Sai da esfera do "vivo".
- Um kit salvo também pode virar base de um cálculo na aba Calcular.

### Como muda por estado

| estado | o que o vendedor vê |
|---|---|
| **grátis / deslogado** | nenhum compositor: só o cabeçalho e o teaser Premium honesto |
| **Premium ativo** | tudo: compor, salvar, duplicar, congelar em Orçamentos |
| **Premium pausado (lapsed)** | **criar** está fechado (painel calmo de reativação + "Ver meus kits"); **reabrir e recalcular** um kit salvo continua funcionando, com faixa informativa no topo; "Salvar kit" continua **visível** e responde honestamente ao ser tocado; "Salvar em Orçamentos" **não existe** ali |
| **offline** | calcular funciona inteiro; leituras vêm do cache; salvar kit falha e diz por quê — falha de rede nunca é vendida como "você não tem Premium" |
| **sessão expirada** | volta ao teaser deslogado; o "Entrar" promete voltar para `/kits` |
| **plano não verificável** | estado próprio: "Verificando seu plano…" ou a parede "Não foi possível verificar seu plano." + "Tentar novamente" — deliberadamente diferente de "você não tem Premium" |

## O ponto exato de inserção desta peça

- **Onde vive:** Ocupa exatamente o lugar da barra "Total do kit": no mobile, colada no rodapé acima da barra de abas; no desktop, o topo da coluna direita de 480px. Substitui o total inteiro — e, junto com ele, some o cartão "Preços por canal (kit)", porque sem peça válida não existe canal nenhum.
- **Como o vendedor chega:** É o primeiro estado que praticamente todo vendedor vê: ele adiciona a primeira peça e ainda não terminou de preencher os campos. Também volta a aparecer se ele invalidar todas as peças.
- **Vizinhança imediata:** Um cartão com três parágrafos empilhados: "Total do kit" (em negrito) → "Sem preço ainda" → "O preço do kit aparece assim que ao menos uma peça estiver completa e válida.". Acima dele, na coluna, a lista de peças (com suas legendas de peça inválida); abaixo, o botão "Salvar em Orçamentos" (desabilitado neste estado) e a caixa de salvar. No desktop, sobra muito espaço vazio na coluna de 480px sob os três parágrafos.
- **Dados que chegam (e o que ela devolve):** Nada de rede: é o ramo do resumo quando o motor não devolveu nenhuma linha válida. Deliberadamente NÃO mostra R$ 0,00 — a ausência de preço é dita, não fingida com zeros.
- **O que acontece depois:** Assim que uma peça fica completa e válida, este cartão é substituído pelo total cheio (Custo total + Varejo + Atacado) e o cartão de canais aparece acima dele; o botão "Salvar em Orçamentos" deixa de estar desabilitado.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# Total do kit no estado "Sem preço ainda"

## O que desenhar

O bloco de resumo da aba **Kits** (o compositor: "Monte seus kits") no momento em que o vendedor já
adicionou peça(s) mas **nenhuma delas chegou ao total** — campos incompletos ou quantidade inválida.
É o mesmo bloco que, com preço, mostra "Custo total" + Varejo + Atacado + os preços por canal; aqui ele
não tem número nenhum para mostrar e precisa dizer isso sem mentir. Ocupa exatamente o mesmo lugar do
total cheio: no **mobile** é a barra colada no rodapé, acima da TabBar de 64px; no **desktop ≥1280px** é o
topo da coluna fixa de 480px à direita da lista de peças. Quem vê: qualquer vendedor nos primeiros 30
segundos da aba — é o estado mais frequente da tela e o único do resumo que nenhum artboard desenhou.

## Por que este prompt existe

O estado foi decidido numa revisão de código ("review 2026-07-12", comentário no próprio
`apps/web/src/features/bom/assembly-summary.tsx`), não num desenho. **Autoridade de desenho: nenhuma.**
O protótipo de 2026-07-02 desenha o herói de preço **sempre com preço**, e a matriz de estados da §G
registra para Resultado/breakdown a linha "empty: zerado (0,00)" — literalmente o oposto do que o produto
faz hoje. E o produto está certo: R$ 0,00 seria uma mentira. O artboard de Kits do 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) só existe **populado**, com três peças e valores
calculados. O que nunca foi desenhado é como a ausência ocupa o espaço do total e como ela se liga aos
avisos das peças que a causaram.

## O que já existe hoje (não invente do zero — corrija)

Um `tf-card` (padding md) com **três parágrafos empilhados**, gap de 4px, e nada mais:

| Ordem | Papel | Texto literal (pt-BR, homologado) | Como está hoje |
|---|---|---|---|
| 1 | Título do bloco | `Total do kit` | 14px, semibold, `--text-strong` |
| 2 | Estado | `Sem preço ainda` | 14px, `--text-muted` |
| 3 | Explicação | `O preço do kit aparece assim que ao menos uma peça estiver completa e válida.` | 12px, `--text-muted` |

Comportamento real, verificado no código:

- → **Título e estado têm o mesmo tamanho** e diferem só na cor: o bloco se lê como duas legendas
  empilhadas, sem hierarquia. No desktop isso vira três linhas de texto no topo de uma coluna de 480px
  com o resto vazio.
- → **A contagem de peças fora do total NÃO aparece neste ramo.** O texto
  `{n} peça(s) fora do total — confira os avisos nas peças acima.` existe e é o único ponteiro para a
  causa, mas ele só renderiza quando **algumas** peças ficam de fora. Com 3 peças e as 3 incompletas —
  o caso deste estado — o vendedor não vê contagem nem ponteiro nenhum.
- → **Não há rollup de canal aqui** (sem peça válida não há canal): o card "Preços por canal (kit)"
  some, o que no desktop abre um segundo buraco na coluna.
- Este estado **nunca** é a tela de zero peças: com a lista vazia a página mostra o estado vazio próprio
  ("Monte seu kit peça por peça"). Sempre há **pelo menos um cartão de peça à esquerda/acima**.
- Ao lado/abaixo, na mesma coluna: o botão `Salvar em Orçamentos` fica **desabilitado** (nenhuma linha
  para congelar) → e não diz por quê; o campo `Nome do kit` (placeholder `Kit suporte + base`) e o botão
  `Salvar kit`, que fica **habilitado** e só depois do clique responde
  `Confira as peças com aviso antes de salvar.`
- → O artboard populado do 018 traz um `tf-badge--success` **"Ao vivo"** ao lado de "Total do kit". O
  código nunca implementou esse badge — e neste estado um selo verde "Ao vivo" sobre um total que não
  existe seria falso.

## Conteúdo e dados reais

- **Cartão de peça (contexto à esquerda/acima)**: rótulo `Peça 1 · (avulsa)`, campo `Quantidade` com
  sufixo `un`, e o aviso que causa este estado:
  `Confira os campos desta peça — ela não entra no total até ser corrigida.`
- **O total cheio, para o qual este estado dá lugar** (números verdadeiros do cenário de referência,
  1 peça, qtd 1): `Custo total` **R$ 27,55**; `Varejo` **R$ 41,33**; `Atacado` **R$ 35,82**. Com 3 peças
  os valores sobem para a faixa de R$ 100 a R$ 1.500 — **desenhe com `R$ 1.234,56`** ao mostrar o
  "depois", porque foi um valor curto que deixou um aperto de largura dormir por meses.
- Rótulos do par de preços na barra fixada são propositalmente curtos: `Varejo` e `Atacado` (nunca
  "Preço atacado", que mede 111px e trunca no orçamento de ~85px).
- O bloco é **derivado**: sem campo, sem número, sem estado próprio.

## Estados obrigatórios

1. **Repouso (o estado desta peça)**: título + "Sem preço ainda" + a frase explicativa, com hierarquia
   de verdade. Calmo — **não é erro**: sem vermelho, sem ícone de alerta, sem borda `--danger`.
2. **Repouso com contagem** (variação a desenhar para o dono decidir): o mesmo bloco declarando quantas
   peças estão fora e apontando para os avisos, usando o texto que já existe:
   `3 peça(s) fora do total — confira os avisos nas peças acima.`
3. **Parcial (estado vizinho, já existe)**: total completo (Custo total + Varejo + Atacado) **mais** a
   legenda de excluídas. Desenhe-o lado a lado para provar que os dois se lêem como a mesma família.
4. **Com preço (o "depois")**: o mesmo espaço ocupado pelo total cheio. Prove que a troca não empurra a
   lista de peças nem faz a barra saltar de altura.
5. **Premium pausado**: acima da tela aparece o alerta
   `Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo.` O resumo
   continua **idêntico** (calcular é sempre grátis) e o botão `Salvar em Orçamentos` **desaparece** — não
   fica cinza, não vira isca.
6. **Offline**: também **idêntico** — o cálculo do kit é local. "Sem preço ainda" jamais pode ser lido
   como falha de rede, e falha de rede jamais pode aparecer dentro deste bloco (a falha do catálogo de
   tarifas tem alerta próprio no topo da página).
7. **Carregando**: não existe dentro deste bloco (o cálculo é síncrono). Não desenhe esqueleto nem
   spinner aqui — um esqueleto de preço é justamente o R$ 0,00 disfarçado que este estado combate.
8. **Desabilitado (vizinho)**: `Salvar em Orçamentos` desabilitado, com foco visível preservado.
9. **Foco / hover / pressionado**: só se o desenho propuser algo clicável (pergunta 3) — aí com alvo
   ≥44px e anel de foco de 3px.

## Viewports

- **390px (obrigatório)** — o estado vive no mobile como barra `sticky` no rodapé. Desenhe **com a TabBar
  de 64px visível na prancheta**: o recuo da barra é medido a partir dela, não do chão do viewport.
  Mostre também o cartão de peça com aviso logo acima, porque a relação entre os dois é o ponto.
- **1280px (obrigatório)** — layout de duas colunas: lista de peças em `minmax(0, 1fr)` e a coluna do
  resumo com **480px** fixos, gap de 24px; a coluna inteira é `sticky` a 16px do topo, com altura máxima
  de `100dvh − 32px`. Nada fica no rodapé. Desenhe a **coluna inteira** (resumo + Salvar em Orçamentos +
  card de nome/Salvar kit) para que o buraco vertical fique visível e resolvido.
- **1920px (desejável)** — mesma coluna de 480px com a lista mais larga: é onde o vazio dói mais.

## Regras que o desenho não pode quebrar

- **Ausência não é zero.** Nada de `R$ 0,00`, `R$ --,--`, traço no lugar do valor ou esqueleto cinza com
  forma de preço. Se não há preço, não há herói de preço.
- **Calmo, não punitivo.** É espera normal, não falha do vendedor: tom no máximo `--info`, nunca
  `--danger`, e nenhum verbo de bloqueio.
- **Nunca upsell.** Calcular é grátis e ilimitado; este bloco jamais insinua que o preço aparece com
  Premium.
- **Nunca falha de rede.** O cálculo é offline; este estado não pode emprestar linguagem de conexão.
- **A frase honesta em elemento de largura total**, nunca em placeholder.
- **Mesmo lugar, mesma família**: sem preço e com preço são o mesmo cartão em dois momentos — mesma
  borda, raio, padding e posição.
- **Contraste medido contra o fundo real do cartão** (`--surface-card`, não o `--bg-base` atrás dele) —
  a frase explicativa é o texto mais fraco da tela e é a que carrega a informação.
- **Altura no mobile**: a barra não pode passar de ~1/3 do viewport de 390×844. Fixar mais coisa no
  rodapé já custou 2/3 da tela uma vez, e comeu a lista de peças.

## Armadilhas já pagas neste projeto

- **Sticky medido do chão errado**: a barra do total já parou 56px **dentro** da TabBar, com os dígitos
  cortados durante toda a composição do kit. Por isso a prancheta mobile tem que mostrar a TabBar.
- **Duas colunas de preço a 360px**: sobram 89px por valor e "R$ 1.234,56" não cabe nem em texto corrido
  — por isso o par virou duas **linhas de leitura** (rótulo à esquerda, valor à direita). Se este desenho
  propuser qualquer prévia numérica, ela segue a mesma regra: quem cede é o rótulo, nunca o número.
- **Coluna com rolagem invisível**: a coluna de 480px tem `overflow-y: auto`; em teste headless a barra
  clássica não aparece. Desenhe o conteúdo curto o bastante para não provocar rolagem interna.
- **Texto que "passa no teste" e ninguém lê**: asserções de texto são cegas a oclusão e overflow — o
  estado só está desenhado quando a frase inteira aparece na imagem, nos dois temas, e nenhuma frase
  deste bloco pode virar placeholder (ele corta).

## Entregável

Pranchetas (tema **escuro primeiro**, claro em paridade, não como rascunho):

1. `390 · escuro` — repouso: peça com aviso + barra "Sem preço ainda" acima da TabBar.
2. `390 · claro` — o mesmo.
3. `390 · escuro` — variação com contagem + ponteiro para os avisos (pergunta 1).
4. `390 · escuro` — o "depois": mesmo espaço com Custo total R$ 1.234,56 + Varejo/Atacado, para
   comparar altura e posição.
5. `1280 · escuro` **e** `1280 · claro` — a coluna de 480px inteira no estado sem preço (resumo +
   Salvar em Orçamentos desabilitado + card Nome do kit/Salvar kit), resolvendo os 480px sem rollup.
6. `1920 · escuro` (desejável) — mesma coluna, lista larga.

Componha com os primitivos existentes, sem criar novos: `tf-card` (padding md) como contêiner —
o **mesmo** do total com preço; `tf-title` (ou h2 de 1.125rem) para "Total do kit"; Inter corpo para
"Sem preço ainda" e para a frase explicativa; `tf-badge--neutral` **apenas se** o dono aprovar uma
etiqueta de estado (nunca `--success`); `tf-brow` só se houver contagem em forma de linha; `tf-alert`
só se o ponteiro para os avisos virar aviso próprio; `tf-btn--ghost --sm` se houver ação de navegação
até a peça incompleta. **Zero `tf-price` nesta prancheta** — é exatamente o primitivo que não pode
aparecer sem número. `tf-grafismo`: no máximo um floreio, e provavelmente nenhum — a tela já tem a
lista de peças carregando a composição.

## Perguntas em aberto para o dono

1. Quando **todas** as peças estão fora do total, o bloco deve dizer quantas e apontar para os avisos?
   O texto `{n} peça(s) fora do total — confira os avisos nas peças acima.` já existe e hoje não aparece
   justamente nesse caso. Reaproveitar, escrever um específico ("nenhuma peça entrou no total ainda"),
   ou manter só a frase genérica?
2. O badge **"Ao vivo"** do artboard populado deve existir no produto? Se sim, o que ele diz neste
   estado — some, ou vira uma etiqueta neutra de espera?
3. O bloco deve **levar** o vendedor até a primeira peça incompleta (link/botão que rola e abre a peça)?
   Isso cria o primeiro alvo interativo dentro do resumo, com foco/hover/pressionado próprios.
4. No desktop, os ~400px que sobram na coluna de 480px enquanto não há preço: ficam vazios, ou o card de
   nome/Salvar kit sobe para ocupá-los (e desce quando o preço aparece)?
5. O `Salvar em Orçamentos` desabilitado deve explicar por quê enquanto não há preço, ou continua mudo?

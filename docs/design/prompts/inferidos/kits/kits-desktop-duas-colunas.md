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

- **Onde vive:** A tela /kits inteira a partir de 1280px: uma grade de duas colunas — as peças à esquerda (largura elástica) e uma coluna fixa de 480px à direita. O cabeçalho "Monte seus kits" e as faixas de aviso ficam acima da grade, atravessando as duas colunas.
- **Como o vendedor chega:** O mesmo caminho de sempre (menu lateral / aba "Kits"), só que numa janela larga. É a única superfície da área com desenho do dono, feita no redesenho desktop de 2026-08.
- **Vizinhança imediata:** Coluna esquerda: os cartões de peça empilhados e, no fim deles, o botão "Adicionar peça". Coluna direita, de cima para baixo e nesta ordem: cartão "Preços por canal (kit)" → cartão "Total do kit" (aqui ele NÃO gruda no rodapé; a coluna inteira é que acompanha a rolagem, presa a 16px do topo) → botão "Salvar em Orçamentos" centralizado → caixa bordada com "Nome do kit" + "Salvar kit" + o recibo pós-salvamento. A coluna tem altura máxima da janela e rola por dentro quando esses quatro blocos não cabem. Detalhes que o desenho pedia e o produto não tem: o cabeçalho da página não carrega ações ("Ver meus kits" e "Adicionar peça" ficaram fora dele), não existe o selo "Ao vivo" ao lado do total, e o par varejo/atacado continua sendo o leitor compacto de UMA coluna — rótulo à esquerda, valor à direita — desenhado para os 89px de um celular de 360px, e não os dois cartões de preço previstos para 1920px.
- **Dados que chegam (e o que ela devolve):** Exatamente os mesmos dados do mobile: o corte de 1280px só decide o arranjo e a variante do resumo (coluna vs. barra colada no rodapé). Abaixo do corte os invólucros da grade somem e a mesma árvore vira uma pilha única — o mobile não é uma segunda implementação, é a mesma.
- **O que acontece depois:** Todas as ações são as mesmas (adicionar, expandir, salvar kit, congelar orçamento); a diferença é que o preço fica permanentemente visível à direita enquanto o vendedor digita à esquerda, em vez de disputar espaço com a barra de abas do rodapé.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)`

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

# Kits no desktop: peças à esquerda, ficha do kit à direita

## O que desenhar
A tela **Monte seus kits** (`/kits`) na composição desktop de duas colunas, a partir de 1280px: à esquerda a lista de peças que o vendedor está montando (cada peça é um cartão que abre para edição), à direita uma coluna fixa de 480px com a ficha do kit — total, preços por canal, gravar orçamento e salvar. É o momento em que o vendedor de impressão 3D monta um anúncio composto ("Kit suporte + base") e precisa ver o preço do conjunto inteiro mudar enquanto mexe nas peças. Abaixo de 1280px a mesma tela é uma coluna única com o total colado no rodapé — esse é o mobile homologado e ele **não muda**; aqui o que se desenha é o desktop e a fronteira entre os dois.

## Por que este prompt existe
Esta é a única superfície da área com desenho do dono: `Abas-Desktop.dc.html` (linhas 155–243, 1920px) definiu a grade `minmax(0,1fr) 480px`, o aside grudado, o cartão "Total do kit", o "Preços por canal (kit)" e o cartão de salvar — tudo implementado. Mesmo assim quatro coisas foram decididas sem desenho: **(a)** o canvas põe "Ver meus kits" e "Adicionar peça" como ações no cabeçalho da página, e o código não tem isso — o cabeçalho recebe só título e descrição, e "Adicionar peça" só existe no fim da lista; **(b)** o canvas marca o total com um selo verde "Ao vivo" que nunca foi implementado (grep no código: zero ocorrências); **(c)** o par varejo/atacado, que o canvas desenha como **dois cartões** (Varejo em destaque a 2,25rem, Atacado a 1,5rem), no código continua sendo o *readout* de uma coluna — duas linhas rótulo-à-esquerda/valor-à-direita, com fundo, borda e sombra removidos — que foi projetado para os 89px por valor de um viewport de **360px**, e vale igualzinho a 1920px porque não há media query; **(d)** a coluna da direita rola por dentro (`max-height` + `overflow-y`) quando resumo + canais + salvar + recibo não cabem na altura da janela, e essa rolagem não está desenhada em lugar nenhum. Além disso, **abaixo de 1280px e para dentro de cada cartão de peça não existe desenho nenhum** — o protótipo de 2026-07 não tem esta aba.

## O que já existe hoje (não invente do zero — corrija)

Cabeçalho da página: título **"Monte seus kits"**, descrição **"Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas"**. Sem nenhum botão.
→ O canvas prometeu dois botões aqui ("Ver meus kits" secundário, "Adicionar peça" primário) e eles não vieram. Desenhe a linha de ações do cabeçalho e diga o que acontece com o "Adicionar peça" do fim da lista quando o do topo existir (duplicar não é problema; sumir com o de baixo, numa lista de 12 peças, é).

Coluna esquerda — cada peça é um cartão recolhido que expande:

| Elemento | Texto/valor real | Observação |
|---|---|---|
| Título da peça | `"Peça 1 · Suporte de parede"` ou `"Peça 1 · (avulsa)"` | prefixo `Peça {n}`; `(avulsa)` quando não vem do catálogo |
| Botão de expandir | rótulo acessível `"Peça 1 · … — Editar esta peça"` / `"Recolher"` | seta ▲/▼ à esquerda |
| Quantidade | campo numérico, sufixo `un`, placeholder `1` | inteiro ≥ 0; 96px de largura |
| Remover | botão fantasma com ✕, rótulo `"Remover peça — Peça 1 · …"` | |
| Linha de dinheiro | `R$ 12,72 /un · Total da linha (3×) R$ 38,16` | lida do motor, nada é multiplicado na tela |
| Nome no catálogo | campo `"Nome da peça no catálogo"`, placeholder `Peça 1 · Kit suporte + base` | só aparece quando a peça **não** salva como referência |

→ O canvas desenhou o cartão de peça com uma grade de 4 métricas (Gramas / Impressão / Custo unitário / Total da linha) que o código **não tem** — hoje há uma linha corrida de texto. Decida no desenho: a grade de 4 colunas do canvas é a versão desktop do resumo da peça, e o mobile fica com a linha corrida.
→ Não há desenho nenhum do cartão **expandido** (o editor de peça inteiro entra ali dentro, dentro dos 1fr da coluna esquerda). É a maior lacuna de todas.

Coluna direita — hoje, de cima para baixo: cartão **"Preços por canal (kit)"**, depois o cartão **"Total do kit"**, depois o botão **"Salvar em Orçamentos"** centralizado, depois o cartão de salvar (**"Nome do kit"** + **"Salvar kit"**).
→ Ordem invertida em relação ao canvas, que põe "Total do kit" **primeiro**. A manchete de dinheiro está abaixo da tabela de canais.

Cartão "Total do kit" hoje: título `"Total do kit"` (sem selo), linha `"Custo total" — R$ 38,16`, e o par comprimido `Varejo · R$ 95,40` / `Atacado · R$ 76,32` em duas linhas de leitura sem cartão nenhum.
→ O canvas quer: selo `tf-badge--success` **"Ao vivo"** ao lado do título; a linha de custo com um sub-rótulo contando as peças; **Varejo como cartão de destaque a 2,25rem** e **Atacado como cartão discreto a 1,5rem**.

## Conteúdo e dados reais
- **Custo total** — soma dos custos das peças × quantidade. Exemplo: `R$ 38,16`.
- **Varejo** / **Atacado** — os dois preços sugeridos do kit. Exemplo: `R$ 95,40` e `R$ 76,32`. Rótulos curtos **"Varejo"** e **"Atacado"** (não "Preço varejo": o rótulo longo mede 111px e estoura o orçamento do readout compacto — no cartão de destaque do desktop isso deixa de ser problema, mas o vocabulário homologado é este).
- **Caso adversarial obrigatório**: um kit de 40 peças caras chega a `R$ 12.345,67`. Desenhe o cartão de Varejo com esse número, não com `R$ 95,40`.
- **Peças fora do total**: `"3 peça(s) fora do total — confira os avisos nas peças acima."` — legenda pequena no pé do cartão de total.
- **Sem preço ainda**: quando nenhuma peça é válida, o cartão **não** mostra `R$ 0,00`; mostra `"Sem preço ainda"` + `"O preço do kit aparece assim que ao menos uma peça estiver completa e válida."`
- **Preços por canal (kit)**: um bloco por marketplace. Cada bloco tem o nome do canal (ex.: `Mercado Livre · Clássico`) e **quatro** linhas — `Varejo · Preço do anúncio`, `Varejo · Recebido líquido`, `Atacado · Preço do anúncio`, `Atacado · Recebido líquido` — mais `"2 peça(s) somaram neste canal"` e, quando houver, `"1 peça(s) sem preço neste canal — não entrou na soma."` Sem nenhuma peça: `"Nenhuma peça com preço neste canal."` → O canvas desenhou **uma linha por canal**; o real são quatro mais duas legendas. Com dois canais o cartão passa de 300px de altura sozinho — é ele que estoura a coluna.
- **Salvar**: campo `"Nome do kit"` (obrigatório), placeholder `"Kit suporte + base"`; botão `"Salvar kit"` (`"Salvando…"` enquanto envia). Depois de salvar aparece `"O que este kit fez no seu catálogo"` com linhas `"{nome} — criado no catálogo"` / `"{nome} — já existia no catálogo, referenciado"` e, se houve referência, o aviso `"As peças referenciadas usam os valores do produto que já estava salvo, não os que você digitou aqui."` + botão `"Ver meus kits"`.
- **Salvar em Orçamentos**: botão secundário com ícone de disquete, desabilitado enquanto nenhuma peça válida existe. Não é o mesmo que salvar o kit — congela o que foi cotado hoje.

## Estados obrigatórios
- **Repouso** — 3 peças recolhidas, ficha completa à direita, nada rolando.
- **Uma peça expandida** — o cartão cresce dentro da coluna esquerda com o editor completo; a coluna direita continua ancorada no topo.
- **Foco / hover / pressionado** — anel de foco visível nos cartões clicáveis, no campo de quantidade e nos botões; o cartão de peça inteiro é um alvo de toque, então o hover precisa dizer que ele abre.
- **Vazio** — nenhuma peça: ícone de pacote, `"Monte seu kit peça por peça"`, `"Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro."`, botão `"Adicionar peça"` e, abaixo, o ghost `"Ver meus kits"`. **Nesse estado a grade de duas colunas não existe** — o vazio ocupa a largura toda.
- **Sem preço ainda** — há peças, nenhuma válida: o cartão de total na sua versão honesta (acima), sem cartão de canais.
- **Peça inválida** — no cartão: `"Confira os campos desta peça — ela não entra no total até ser corrigida."`; no total: a legenda de peças fora.
- **Quantidade 0** — `"Quantidade 0 — não entra no total."` (é um zero verdadeiro, não uma exclusão).
- **Peça degradada** — a peça foi reaberta sobre o último valor conhecido porque o produto de origem sumiu: legenda calma reaproveitada do catálogo, **nunca** "produto removido/excluído".
- **Carregando o plano** — spinner + `"Verificando seu plano…"`.
- **Falha ao verificar o plano** — `"Não foi possível verificar seu plano."` + `"Tentar novamente"`. Isso é rede, **não** é "você não é premium".
- **Catálogo de tarifas desatualizado** — alerta informativo no topo, com botão de recarregar; não bloqueia nada, os preços continuam computando.
- **Sem premium** — a porta honesta do teaser ocupa a página inteira (um único teaser na tela, nunca dois).
- **Premium pausado** — `"Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo."` como faixa informativa; o botão "Salvar kit" continua **visível e clicável**, e responde com um aviso em tom informativo (não vermelho) quando tocado.
- **Salvando** — `"Salvando…"`, botão desabilitado.
- **Coluna direita mais alta que a janela** — o estado que ninguém desenhou: com dois canais + resumo + salvar + recibo, a ficha passa de 100vh e rola por dentro. Desenhe como isso se apresenta (o total tem que continuar legível; se a rolagem interna cortar a manchete de dinheiro, o desenho falhou).

## Viewports
- **1920px** — o viewport em que o dono desenhou; grade `1fr / 480px`, página limitada a 1720px.
- **1280px** — o primeiro pixel da composição desktop. É o caso apertado: 480px de ficha deixam ~700px de lista com o menu lateral. Prove que o cartão de peça expandido cabe aí.
- **1279px** — o último pixel antes do corte, com o total colado no rodapé. Não é para redesenhar o mobile; é para mostrar a fronteira e o que o vendedor perde/ganha ao cruzá-la.
- **390px** — só como referência do que **não pode mudar**: o readout compacto de uma coluna e a barra fixada no rodapé.

## Regras que o desenho não pode quebrar
- **Nenhum número é somado na tela.** Todo valor vem do motor de preço; o desenho não pode sugerir um total "aproximado" nem arredondar.
- **Peça excluída é dita, nunca zerada.** Uma peça inválida some do total *e* aparece uma legenda contando quantas.
- **Zero não é a mesma coisa que "ainda não".** `R$ 0,00` só quando o valor é realmente zero.
- **Falha de rede nunca é vendida como "não premium".** As duas frases são diferentes e têm ações diferentes.
- **Pausado é calmo.** As palavras "expirou", "bloqueado" e "suspenso" são proibidas. E a recusa de salvar em conta pausada é uma resposta esperada, não um erro vermelho.
- **Frase honesta em elemento de largura inteira**, nunca dentro de um placeholder (placeholder carrega número, não explicação).
- **Alvos ≥44px** — o cartão de peça, a quantidade, o remover.
- **Contraste medido contra o fundo real**: o par varejo/atacado é o caso conhecido — texto em tom accent sobre superfície clara já apagou uma vez quando o fundo do cartão foi removido.

## Armadilhas já pagas neste projeto
- **A regra de 360px valendo a 1920px.** O readout compacto existe porque a 360px sobravam 89px por valor. Ele nunca foi limitado por media query, então o vendedor no monitor grande lê a manchete de dinheiro no formato de aperto. O desenho tem que declarar as duas formas e onde cada uma vale.
- **Um `sticky` dentro de outro.** Quem gruda no desktop é a **coluna inteira**; o resumo dentro dela não gruda sozinho, senão a camada de dentro parece solta. Se o desenho pedir "total sempre visível" dentro de uma coluna que rola, isso é uma decisão nova — diga-a com todas as letras.
- **Valor grande estourando a coluna.** Um inteiro sem ponto de quebra empurra o cartão e depois a página inteira. Desenhe com `R$ 12.345,67` e mostre quem cede — o rótulo trunca, o número nunca.
- **Rótulo longo trancando o número.** "Preço atacado" (111px) já não coube; por isso os rótulos são "Varejo"/"Atacado".
- **Transbordo horizontal medido, não estimado.** A largura da coluna esquerda é `minmax(0, 1fr)` justamente porque um filho largo, sem isso, empurra a grade.
- **Texto ocluso passa em teste.** Um número escondido atrás da barra fixa ou cortado pela rolagem interna passa em toda asserção de texto — só a imagem pega.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro, ambos em pé de igualdade:
1. **1920px · repouso** — 3 peças recolhidas + ficha completa, com o cabeçalho ganhando as duas ações.
2. **1920px · peça expandida** — o editor dentro do cartão, ficha intacta.
3. **1280px · o caso apertado** — a mesma coisa no primeiro pixel do desktop.
4. **1920px · coluna direita rolando** — dois canais, ficha mais alta que a janela.
5. **1920px · vazio** e **1920px · sem preço ainda**.
6. **1920px · degradações** — peça inválida + peça degradada + premium pausado numa só prancheta.
7. **1279px** — a fronteira, com a barra fixa no rodapé.

Reutilize os primitivos existentes, sem criar nada novo: `tf-card` para peça, total, canais e salvar; `tf-brow` (com `tf-brow__sub`) para "Custo total" e para cada linha de canal; `tf-price` nas variantes `--accent --md/--lg --center` para Varejo e `tf-price --md` discreto para Atacado; `tf-badge--success` para o "Ao vivo"; `tf-inputwrap`/`tf-input` (com afixo `un`) para quantidade e nome; `tf-btn` nas variantes `--primary`, `--secondary`, `--ghost` e `--sm`/`--lg`; `tf-alert` (`--danger` para peça inválida, `--info` para pausado e catálogo desatualizado); `tf-field__hint` para as legendas honestas; `tf-empty` para o vazio; `tf-page-header` para o cabeçalho.

## Perguntas em aberto para o dono
1. **O selo "Ao vivo" fala do quê?** No canvas ele está colado no total. Ele significa "este número recalcula enquanto você digita" ou "as tarifas de marketplace estão atualizadas"? São duas promessas diferentes — a segunda pode ficar falsa quando o catálogo de tarifas não atualiza, e aí o selo precisaria de um estado alternativo.
2. **Ordem da coluna direita**: "Total do kit" primeiro (como o canvas) ou "Preços por canal" primeiro (como o código está)? Com o cartão de canais na frente, a manchete de dinheiro só aparece depois de ~300px de tabela.
3. **Com o "Adicionar peça" no cabeçalho, o botão do fim da lista continua existindo?** Numa lista de 12 peças o de baixo é o que está perto do trabalho; o de cima é o que está sempre visível.
4. **A grade de 4 métricas por peça (Gramas / Impressão / Custo unitário / Total da linha) do canvas é para valer?** Ela exige mostrar gramas e tempo no cartão recolhido, que hoje só existem dentro do editor.
5. **Quando a ficha não cabe na altura da janela, o que fica sempre visível?** Rolar a coluna inteira (hoje) esconde o total; fixar o total dentro da coluna cria uma segunda camada grudada. É uma decisão de produto, não de CSS.

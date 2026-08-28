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

- **Onde vive:** A TERCEIRA faixa do topo da tela /kits: abaixo do cabeçalho, abaixo da faixa "Não foi possível verificar seu plano." e abaixo da faixa "Premium pausado", e imediatamente acima da primeira peça (ou do estado vazio). Aparece uma vez para o kit inteiro, nunca por peça.
- **Como o vendedor chega:** Sem ação do vendedor: o app tentou atualizar a tabela de tarifas dos marketplaces e não conseguiu (rede caiu, servidor não respondeu). Ele está no meio da montagem quando isso surge acima do conteúdo.
- **Vizinhança imediata:** Um alerta de tom informativo com título, um parágrafo de corpo e um botão secundário pequeno "Tentar novamente" que ganha um giro enquanto tenta. Não bloqueia nada: as tarifas conhecidas continuam pré-preenchendo os canais e todos os preços continuam sendo calculados. No pior caso as três faixas coexistem, e as três juntas empurram a primeira peça para fora da primeira dobra no celular.
- **Dados que chegam (e o que ela devolve):** O estado do catálogo de tarifas servido+cacheado: falhou a atualização, está tentando de novo. O valor exibido nos campos continua vindo do último catálogo válido (servido antes, ou o embarcado no app).
- **O que acontece depois:** "Tentar novamente" refaz a busca ali mesmo; dando certo, a faixa some e os canais passam a usar as tarifas novas. A faixa não pisca durante a tentativa — ela persiste até haver uma resposta boa.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Campo 'Nome da peça no catálogo' e o aviso de que a peça vira produto` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# A pilha de avisos no topo da tela de Kits (e o aviso de tarifas não atualizadas)

## O que desenhar

A faixa de avisos que fica entre o cabeçalho "Monte seus kits" e a primeira peça do kit, na tela
`/kits` do Precifica3D — e, dentro dela, o aviso "Não foi possível atualizar as taxas", que hoje é o
único dos três que tem título, corpo e um botão de ação. Quem vê é um vendedor Premium montando ou
reabrindo um kit (várias peças impressas vendidas como um anúncio só). Os três avisos aparecem antes
de qualquer conteúdo real: são a primeira coisa que ele lê quando abre o app com internet ruim, com o
plano ainda sendo reconferido, ou com o Premium pausado. Desenhe a PILHA (ordem, densidade, quanto ela
pode ocupar) e o aviso de tarifas como peça detalhada dentro dela.

## Por que este prompt existe

Nada disso foi desenhado. O aviso de tarifas foi inferido por uma IA a partir de requisito textual:
alguém decidiu sozinho que ele seria um alerta de tom informativo, no topo, uma vez para o kit inteiro
(não por peça), não bloqueante, com botão e indicador de espera. No canvas de 1920px do 018 o bloco
Kits tem exatamente UM alerta, e ele é o de peça inválida DENTRO do card da peça — não existe nenhum
alerta no topo da página de Kits, logo não existe pilha desenhada. No protótipo de 2026-07 (§E9) há um
"banner offline" no shell e um erro global, mas o catálogo de tarifas nem existia então. O único
alerta de topo já desenhado em qualquer lugar está em Orçamentos e é sobre outra coisa (ver abaixo) —
é a referência de forma mais próxima que temos, e ela contradiz o que o código de Kits faz.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/pages/bom/bom-page.tsx` (três alertas em sequência, linhas 447/452/459) e
`apps/web/src/shared/i18n/messages.pt-br.ts`. Ordem atual, de cima para baixo, dentro da mesma coluna
com 16px entre os blocos:

| # | Aviso | Quando aparece | Texto literal hoje | Ação |
|---|-------|----------------|--------------------|------|
| 1 | Plano não conferido | a reconsulta do plano falhou, mas a última resposta do servidor dizia ativo | "Não foi possível verificar seu plano." (sem título, sem corpo) | nenhuma |
| 2 | Premium pausado | conta com Premium pausado reabrindo um kit salvo | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." | nenhuma |
| 3 | Tarifas não atualizadas | a busca online da tabela de tarifas falhou (fica ligado até um sucesso) | título "Não foi possível atualizar as taxas" + corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." | botão secundário pequeno "Tentar novamente", empilhado abaixo do corpo |

→ Os três usam o MESMO tom informativo, o mesmo ícone (ⓘ) e o mesmo fundo. Três blocos idênticos
empilhados leem como um bloco só de três parágrafos — nada indica que são três assuntos diferentes,
nem qual deles pede ação.
→ Não há ordem pensada: a ordem de hoje é a ordem em que o código foi escrito. O único com botão é o
último, ou seja, o mais longe do polegar e o mais provável de ficar fora da primeira dobra.
→ Em Orçamentos o alerta de topo equivalente já é COMPACTO: uma linha só, título e botão
"Sincronizar agora" lado a lado, verticalmente centralizados. Em Kits a mesma função virou bloco alto
com o botão embaixo. Duas formas para a mesma coisa no mesmo app.
→ O aviso de tarifas aparece mesmo com o kit VAZIO (acima do estado vazio "Monte seu kit peça por
peça") e mesmo quando nenhuma peça vende em marketplace — ele fala de um número que o vendedor ainda
não usou. Na calculadora o mesmo aviso só aparece dentro da seção de marketplaces, quando ela está
ligada.
→ Acima de tudo isso ainda pode existir a faixa offline do shell, em largura cheia: "Você está
offline. O cálculo continua funcionando." E acima da pilha vem o cabeçalho da página: título "Monte
seus kits" + descrição "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos
cadastrados ou peças avulsas".

## Conteúdo e dados reais

- Os textos acima são literais e já homologados: **não reescreva**. Se algum for ruim, aponte no
  entregável em vez de trocar.
- O aviso de tarifas fala da tabela de comissões de marketplace (Mercado Livre, Shopee, Amazon) que
  alimenta os preços por canal do kit — hoje 79+ entradas, versão datada (`2026-08-06.1`). Quando a
  atualização falha, o app usa a cópia salva no aparelho ou a semente que veio no build; **nenhum
  preço deixa de ser calculado**.
- Escala dos números que aparecem logo abaixo da pilha, para dimensionar o desenho: "Total do kit"
  com custo total e preços por canal, na casa de `R$ 24,24` / `R$ 21,01` / `R$ 16,16`; quantidade por
  peça com sufixo "un".
- O aviso não tem contador, nem data, nem "última atualização" — esse dado não existe na tela hoje.
  Mostrar a data da referência salva é decisão de produto (ver perguntas ao final).
- O botão "Tentar novamente" tem 44px de altura real (o mínimo de toque vence a altura nominal de 36px
  do tamanho pequeno) — não desenhe um botão de 36px.

## Estados obrigatórios

- **Repouso, um aviso só** — o caso comum: apenas "Não foi possível atualizar as taxas".
- **Repouso, pilha de dois e de três** — desenhe as duas combinações reais: (plano + tarifas) e
  (plano + Premium pausado + tarifas). É o estado que ninguém nunca desenhou e é o motivo deste prompt.
- **Foco de teclado no "Tentar novamente"** — anel de foco visível sobre o fundo tingido do alerta,
  não sobre o fundo da página.
- **Hover e pressionado do botão** — sutis; nada aqui é urgente.
- **Tentando de novo (carregando)** — o botão em espera com indicador; o aviso **continua visível
  durante a tentativa** (ele é fixo de propósito: já piscou e sumiu no meio do retry, e isso foi
  corrigido). O texto não muda.
- **Sucesso** — o aviso simplesmente desaparece; não há mensagem de "atualizado".
- **Offline de verdade** — a faixa offline do shell aparece ACIMA de tudo; desenhe a convivência das
  duas, porque dizem coisas parecidas com palavras diferentes.
- **Premium pausado** — aviso 2 presente; note que nesse estado o botão "Salvar kit" continua visível
  e responde com honestidade quando tocado, nunca desabilitado e mudo.
- **Kit vazio** — a pilha acima do estado vazio "Monte seu kit peça por peça".

## Viewports

- **Mobile 390px** — obrigatório, e é o viewport que dói: é onde a pilha empurra a primeira peça para
  fora da dobra. Estimativa a partir dos tokens (16px de padding, texto de 14px, ~294px de largura útil
  de texto): aviso de tarifas ~180px, Premium pausado ~92px, plano ~52px, mais 32px de folgas ≈ 356px;
  somando o cabeçalho da página (~85px) e a barra superior, passa de metade dos ~724px de área útil
  antes da primeira peça. **Meça no desenho e marque a dobra** — a estimativa é minha, a medida é sua.
- **Desktop 1280px** — o corte em que a tela vira duas colunas (peças à esquerda, resumo fixo de 480px
  à direita). Hoje a pilha fica ACIMA das duas colunas, em largura cheia: mostre se ela deve continuar
  assim ou entrar na coluna das peças.
- **Desktop 1920px** — a página vai até 1720px de largura; um alerta de uma frase esticado por 1720px
  vira uma linha de texto de dois metros. Resolva.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é "você não é Premium".** Os três avisos falam de coisas diferentes: rede,
  plano em reconferência, plano pausado. O desenho tem que deixar isso legível sem obrigar a ler o
  parágrafo inteiro.
- **Não bloqueante é não bloqueante.** Nada de modal, de sobreposição, de qualquer coisa que impeça
  montar o kit. O preço continua saindo com a referência salva — a frase já diz isso e ela precisa
  aparecer inteira, nunca cortada e nunca dentro de um placeholder de campo.
- **Degradação dita, não escondida.** É legítimo compactar, mas se a frase "o cálculo continua
  funcionando" sair da tela ela precisa continuar alcançável (um ⓘ, um expandir) — não pode
  simplesmente sumir.
- **Alvo de toque ≥44px** para "Tentar novamente", inclusive no formato compacto de uma linha.
- **Contraste medido contra o fundo real do alerta** (a superfície tingida), nos dois temas — não
  contra o fundo da página.
- **A ordem tem que ser defensável.** Proponha uma ordem e escreva o critério em uma linha (ex.: o que
  pede ação primeiro; o que fala de dinheiro antes do que fala de plano).

## Armadilhas já pagas neste projeto

- **Overflow se mede, não se olha.** Um botão que nasceu fora da viewport já custou 100,5px de estouro
  nesta app, e teste de texto passa em elemento estourado. Mostre a caixa.
- **Frase honesta em lugar apertado se perde.** Já aconteceu aqui: a parte honesta de uma frase ficou
  dentro de um campo e foi cortada. Frase de honestidade mora em elemento de largura cheia.
- **Aviso que pisca durante o retry** — já corrigido no código; o desenho não pode reintroduzir um
  "some enquanto tenta".
- **Empilhamento sem ordem empurra o conteúdo real para fora da dobra** — é exatamente o impacto que a
  auditoria registrou nesta peça.

## Entregável

Pranchetas em tema escuro (padrão) e tema claro, ambos completos:

1. Mobile 390px — pilha de três avisos, com a linha da dobra marcada e a altura de cada bloco anotada.
2. Mobile 390px — a mesma pilha na sua proposta compactada, com a mesma medição, para comparar.
3. Mobile 390px — o aviso de tarifas em repouso / tentando de novo / com foco no botão.
4. Desktop 1280px — a pilha no contexto das duas colunas (peças + resumo fixo à direita).
5. Desktop 1920px — o mesmo, resolvendo a largura de 1720px.
6. Mobile 390px — a pilha sobre o kit vazio, com a faixa offline do shell presente.

Reutilize os primitivos existentes, sem criar novos: o bloco de alerta (`tf-alert`, tom informativo) e
a variante compacta que já existe — a mesma que Orçamentos usa no "Sincronizar agora"; o botão
secundário pequeno (`tf-btn--secondary tf-btn--sm`) para "Tentar novamente", com o estado de espera do
próprio botão; o ícone informativo do conjunto do DS; e o cabeçalho de página existente acima da pilha.
Se o desenho precisar de um agrupamento novo (um "acordeão de avisos", por exemplo), descreva-o com os
primitivos existentes e diga por que a variante compacta não bastou.

## Perguntas em aberto para o dono

1. **Ordem dos três avisos** — qual a prioridade quando coexistem? Ninguém decidiu; a de hoje é
   acidental.
2. **O aviso de tarifas deve aparecer com o kit vazio, ou só quando existir ao menos uma peça?** Na
   calculadora ele só aparece dentro da seção de marketplaces, quando ligada; em Kits aparece sempre.
3. **Compactar para uma linha custa esconder "o cálculo continua funcionando" e "você pode informar as
   taxas manualmente".** Pode ir para um ⓘ, ou essa frase precisa ficar sempre visível?
4. **Mostrar a data da referência salva** (ex.: "referência de 06/08") deixaria o aviso mais honesto,
   mas é dado novo na tela. Vale?
5. **Confirmar o sucesso do "Tentar novamente"** — hoje o bloco só some, sem nenhuma confirmação. O
   vendedor precisa ser avisado de que deu certo?

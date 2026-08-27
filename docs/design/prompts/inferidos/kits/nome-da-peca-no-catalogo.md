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

- **Onde vive:** O último bloco de dentro da peça expandida, depois do resultado da própria peça e antes de o cartão da peça se fechar. É condicional: existe apenas nas peças que vão virar produto novo (avulsas, ou vinculadas-e-editadas) e desaparece sozinho quando a peça volta a ser uma referência limpa.
- **Como o vendedor chega:** Ninguém abre este bloco: ele nasce sob os pés do vendedor enquanto ele digita — no momento em que edita uma peça vinculada, ou desde o início se a peça é avulsa.
- **Vizinhança imediata:** Um parágrafo pequeno (só no caso da peça vinculada que foi ajustada): "Você ajustou esta peça — ela será salva como uma peça nova no catálogo." e, colado abaixo dele, um campo de texto rotulado "Nome da peça no catálogo", cujo placeholder já sugere um nome derivado ("Peça 2 · Kit suporte + base"). Acima: o bloco de resultado da peça. Abaixo: a borda do cartão e a próxima peça.
- **Dados que chegam (e o que ela devolve):** Nada de rede: o bloco lê o estado local da peça (vinculada? ajustada?) e o nome do kit digitado na caixa de salvar, para montar o placeholder. Devolve o nome com que a peça vai nascer no catálogo — se ficar vazio, vale o placeholder.
- **O que acontece depois:** No "Salvar kit", esse nome é o que aparece no recibo ("{nome} — criado no catálogo") e é a linha que passa a existir de verdade na aba Produtos do Catálogo do vendedor.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Compositor de kits em mobile (a tela /kits inteira abaixo de 1280px)` · `Card da peça recolhido (a linha do kit)` · `Editor da peça expandido dentro da linha (formulário completo da calculadora aninhado)` · `Seletor 'Usar produto salvo' e o selo de origem da peça` · `Recibo 'O que este kit fez no seu catálogo' (pós-salvamento)` · `Cartão 'Preços por canal (kit)'` · `Estado 'Sem preço ainda' do Total do kit` · `Estado vazio do compositor de kits` · `Estados de verificação de plano na aba Kits (checando e parede de erro)` · `Superfícies de Premium pausado em Kits (painel de reativação e faixa no kit reaberto)` · `Peça degradada (produto referenciado apagado depois do salvamento)` · `Controle de quantidade e seus avisos (zero e limite do banco)` · `Ação 'Salvar em Orçamentos' dentro do compositor de kits` · `Aviso de falha ao atualizar o catálogo de tarifas na tela de kits` · `Aba Kits dentro do Catálogo (lista de kits salvos e a ficha do kit)` · `Composição desktop de Kits em duas colunas (o que o canvas cobriu — e o que sobrou inferido)`

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

# "Nome da peça no catálogo" — o campo que anuncia que a peça vai virar produto

## O que desenhar
Dentro da aba **Kits** (montagem de um kit peça por peça), cada peça é um card que se expande num
formulário longo (custos, tempo, markup, canais). No **fim** desse formulário expandido aparece — só
às vezes — um campo de texto chamado "Nome da peça no catálogo", às vezes precedido de uma frase de
aviso. Ele existe porque, ao salvar o kit, toda peça que **não** é uma referência viva a um produto
salvo é **materializada**: uma linha nova nasce no catálogo de Produtos do vendedor, com o nome que
estiver ali. Quem usa é o vendedor Premium montando ou reabrindo um kit, no momento em que ainda dá
para escolher o nome — depois de salvar, a peça já está no catálogo. O que precisa ser desenhado é
**a peça inteira desse anúncio**: como se diz que editar uma peça vinculada muda o destino dela, se
isso é um campo, um aviso ou um passo do salvar, e o que acontece com a hierarquia quando o campo
some sozinho.

## Por que este prompt existe
Nada disso foi desenhado. A auditoria confirmou: no protótipo desktop (`Abas-Desktop.dc.html`) o
aside de Kits tem exatamente três coisas — "Nome do kit", "Salvar kit" e a dica "Confira as peças
com aviso antes de salvar" — e o card da peça **não tem nenhum campo de nome**; grep por "Nome da
peça" e por "ajustou" no protótipo: zero. A auditoria de 2026-07-02 e o `.design-import/` também não
têm nada. A regra vem da ADR-0017 (decisão técnica) e do `ux-bom.md` (texto do designer-ux) —
nenhum dos dois é desenho. Resultado: um **efeito colateral real no catálogo do vendedor** (linhas
novas aparecendo em Produtos) hoje é comunicado por um campo que aparece e some sozinho no rodapé de
um formulário longo, precedido por uma legenda de 12px com o mesmo peso visual de outras quatro
legendas possíveis no mesmo card.

## O que já existe hoje (não invente do zero — corrija)
A regra que liga tudo (`kit-save.ts`): **uma peça só é salva como referência viva enquanto está
vinculada a um produto salvo E não foi tocada.** No instante em que o vendedor edita um campo de uma
peça vinculada, ela vira avulsa — e vai nascer no catálogo. Peça avulsa desde o início: idem.

Estado atual do bloco, na ordem em que aparece dentro do card expandido:

| Ordem | Elemento | Texto literal hoje | Problema |
|---|---|---|---|
| 1 | Frase de aviso (`<p>` 12px, cor `--text-muted`), só quando a peça **era** vinculada e foi editada | "Você ajustou esta peça — ela será salva como uma peça nova no catálogo." | → Mesmo peso, cor e tamanho de legendas neutras do mesmo card; é a única frase que anuncia uma **consequência** e não se distingue de um comentário |
| 2 | Campo de texto com rótulo | "Nome da peça no catálogo" | → Rótulo genérico: não diz *quando* nem *por que* esse nome importa. Não é marcado como obrigatório nem como opcional |
| 3 | Placeholder do campo | "Peça 1 · Kit suporte + base" (derivado: `Peça {n} · {nome do kit}`; sem nome de kit, só "Peça 1") | → **O placeholder não é dica, é o valor real.** Campo vazio = esse nome vai para o catálogo. Isso contraria a regra da casa ("frase honesta nunca vive em placeholder") |

O que o vendedor vê **depois** de salvar, no bloco de salvar (já existe e funciona): título "O que
este kit fez no seu catálogo", uma lista com "{nome} — criado no catálogo" / "{nome} — já existia no
catálogo, referenciado", e, quando houve referência, o alerta informativo "As peças referenciadas
usam os valores do produto que já estava salvo, não os que você digitou aqui." → esse é o **recibo**;
o que falta desenhar é o **anúncio antes**.

As outras legendas que disputam o mesmo card, todas em texto pequeno e cinza (é isso que achata a
frase do item 1):
- "{custo}/un · Total da linha (3×) R$ 405,00"
- "Quantidade 0 — não entra no total."
- o aviso de quantidade acima do teto (classe `tf-field__aviso`)
- "Confira os campos desta peça — ela não entra no total até ser corrigida."
- "Os valores atuais foram mantidos e continuam editáveis." (peça degradada)
- e, dentro do editor, o selo do vínculo: "do catálogo: Suporte de fone" / "do catálogo: Suporte de
  fone · ajustado por você"

→ O selo "· ajustado por você" e a frase "Você ajustou esta peça…" dizem a **mesma** coisa em dois
lugares distantes do mesmo card, com pesos diferentes e sem se referirem um ao outro.

## Conteúdo e dados reais
- **Campo**: texto livre, uma linha. Sem máscara, sem limite visível. Valor efetivo = o que foi
  digitado (com trim) **ou**, se vazio, o nome derivado "Peça {n} · {kit}".
- **Nome do kit** (campo do bloco de salvar, rótulo "Nome do kit", obrigatório, placeholder "Kit
  suporte + base") é a fonte do sufixo derivado: mudar o nome do kit muda o placeholder de **todas**
  as peças sem nome próprio, silenciosamente.
- **Quantidade** por peça: inteiro ≥ 0, unidade "un".
- **Dinheiro** no card, para calibrar a hierarquia: custo unitário e "Total da linha (3×)
  R$ 405,00"; no resumo do kit, "Total do kit" com Varejo R$ 24,24 e Atacado R$ 21,01.
- **Onde vive**: aba Kits. Mobile: lista de peças em coluna única, com o resumo do kit fixado no
  rodapé. Desktop (≥1280px): duas colunas — peças à esquerda, resumo + "Nome do kit" + "Salvar kit"
  numa coluna direita de 480px, grudada na rolagem.

## Estados obrigatórios
Desenhe **o card da peça expandido** em cada um destes, porque a diferença entre eles é justamente o
que nunca foi desenhado:

1. **Peça avulsa (nasceu manual)** — o campo aparece, sem a frase de aviso. É o caso "normal": ela
   sempre ia virar produto.
2. **Peça vinculada e intocada** — o campo **não existe**; o selo diz "do catálogo: Suporte de
   fone". Nada nasce no catálogo. Desenhe o card sem o bloco, para mostrar o contraste.
3. **Peça vinculada e editada (a transição)** — o selo vira "do catálogo: Suporte de fone · ajustado
   por você" e o bloco **aparece** com a frase "Você ajustou esta peça — ela será salva como uma peça
   nova no catálogo." Este é o estado central do prompt: desenhe como esse surgimento é percebido no
   meio de um formulário longo (o vendedor pode estar rolado longe dele).
4. **Volta atrás (revinculação)** — o vendedor escolhe de novo o produto no seletor "Usar produto
   salvo" e o bloco **desaparece** junto com o que ele tinha digitado. Desenhe o que fica no lugar:
   hoje não fica nada.
5. **Campo em repouso / foco / preenchido** — repouso mostra o derivado em cor de placeholder; foco
   com o anel do DS; preenchido com o nome do vendedor.
6. **Peça degradada** (o produto de origem foi apagado depois do kit salvo) — o card mostra "Os
   valores atuais foram mantidos e continuam editáveis." e a peça salva como avulsa: o bloco aparece
   com o nome que ela já tinha. Nunca dizer "removido/excluído".
7. **Peça inválida** — "Confira os campos desta peça — ela não entra no total até ser corrigida."
   convivendo com o bloco de nome no mesmo card.
8. **Premium pausado, kit reaberto** — a faixa "Premium pausado — você pode reabrir e recalcular
   este kit. Salvar precisa do Premium ativo." está no topo. O bloco de nome continua visível e
   editável (a ação de salvar é que responde honestamente ao ser tocada) — desenhe se ele deve
   mudar de tom aqui.
9. **Depois de salvar (recibo)** — o bloco "O que este kit fez no seu catálogo" com uma peça
   "criado no catálogo" e outra "já existia no catálogo, referenciado", mais o alerta informativo.
   Desenhe a ligação visual entre o anúncio (antes) e o recibo (depois).

## Viewports
- **Mobile 390px** — obrigatório: é onde o formulário é mais longo e onde o bloco fica mais
  distante do topo do card; e onde o rodapé fixado com o total do kit disputa espaço.
- **Desktop 1280px** — obrigatório: é o corte onde a coluna direita nasce (peças à esquerda,
  resumo/"Nome do kit"/"Salvar kit" à direita). A pergunta de layout muda: o anúncio pode viver
  perto do botão Salvar, ou só dentro do card da peça?
- 1920px opcional, só se a coluna de peças mudar de comportamento.

## Regras que o desenho não pode quebrar
- **Frase honesta nunca em placeholder.** O nome derivado "Peça 1 · Kit suporte + base" é o valor
  que vai para o catálogo — não pode ser comunicado apenas como texto cinza dentro do campo.
- **Nada nasce no catálogo em silêncio.** O vendedor tem de saber, antes de tocar em "Salvar kit",
  quantas peças vão virar produto e com que nomes.
- **Editar uma peça vinculada tem consequência, e ela é reversível.** O desenho deve dizer as duas
  metades: virou peça nova; dá para revincular.
- **Nunca punitivo.** Nada de "expirou", "bloqueado", "suspenso"; o Premium pausado é calmo e os
  dados continuam do vendedor.
- **Falha de rede nunca é "não é premium".** Se o catálogo de produtos não carregou, o seletor "Usar
  produto salvo" some — e o bloco de nome aparece por consequência. Isso não pode ler como decisão
  do vendedor.
- **Alvo ≥44px** para o campo e para qualquer ação nova; contraste medido contra o fundo real do
  card (o card já está sobre a superfície da página, não sobre o fundo base).

## Armadilhas já pagas neste projeto
- **Legenda de 12px cinza é onde as frases importantes morrem.** Este card já empilha até cinco
  legendas do mesmo tamanho e cor; a única que anuncia consequência não pode ser a sexta.
- **Prefixo duplicado.** O nome derivado já contém "Peça 1 · "; o cabeçalho do card também monta
  "Peça 1 · {nome}". Um nome derivado salvo e reaberto já produziu "Peça 1 · Peça 1 · Kit X".
- **Nome longo estoura coluna.** Um nome de peça digitado longo já derrubou o layout de um PDF de
  orçamento (colisão de glifos, invisível para teste de texto). Desenhe o campo, o recibo e o
  cabeçalho do card com um nome de ~60 caracteres real, não com "Peça 1".
- **Sufixo cortado.** Em 016, uma frase honesta colocada como sufixo de placeholder foi clipada e
  ninguém viu: frases honestas vivem em elemento de largura cheia.
- **Overflow horizontal medido em ambos os eixos.** O card expandido no mobile já é o lugar mais
  apertado do produto.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class, não uma variação de segunda):
1. Card da peça expandido, **mobile 390px**, nos estados 1, 2, 3 e 4 (avulsa · vinculada intocada ·
   vinculada-e-editada · revinculada), lado a lado para o contraste ficar legível.
2. O mesmo bloco em **desktop 1280px**, no layout de duas colunas, mostrando onde o anúncio vive em
   relação ao "Salvar kit" da coluna direita.
3. Estados 6, 7 e 8 (degradada · inválida · Premium pausado) — um card cada, mobile.
4. O recibo pós-salvar ("O que este kit fez no seu catálogo") ligado visualmente ao anúncio.

Reutilize os primitivos existentes, sem criar novos: `Card` (padding md) para a peça; `Field` com
`label`/`hint`/`required`/`optional` para o campo de nome — o `hint` é o lugar natural para tirar a
frase derivada de dentro do placeholder; `tf-input` dentro de `tf-inputwrap`; `Alert` com tom `info`
para o anúncio de consequência e para o recibo; `Badge` se a peça precisar de um selo "vai para o
catálogo" no cabeçalho do card; `Select` para "Usar produto salvo"; `Button` secundário/ghost para
qualquer ação de desfazer; `Icon` do conjunto existente. Se o anúncio precisar de um tom que o
`Alert info` não dá, proponha a variação **dentro** do Alert, não um componente novo.

## Perguntas em aberto para o dono
1. **Isto é um campo, um aviso ou um passo do salvar?** As três leituras são defensáveis: campo por
   peça (hoje), aviso agregado perto do "Salvar kit" ("2 peças vão virar produtos novos"), ou uma
   confirmação no momento de salvar, listando os nomes. Muda o desenho inteiro.
2. **O nome derivado deve ser pré-preenchido de verdade no campo** (texto real, editável, visível)
   em vez de ficar como placeholder? Isso torna o destino explícito, mas enche o formulário de
   nomes que o vendedor não escolheu.
3. **Revincular apaga o nome digitado.** Deve avisar antes ("você digitou um nome; ao usar o produto
   salvo ele será descartado"), guardar o nome para se o vendedor editar de novo, ou seguir
   descartando em silêncio?
4. **"Nome da peça no catálogo" é o rótulo certo?** Ele não diz que a peça *vai nascer* no catálogo.
   Alternativa a decidir pelo dono, não por mim.

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

## O mapa funcional de Orçamentos (registros congelados, exportação, comparação)

### Orçamentos — o que a área é

A quarta aba (rotulada **"Orçamentos"**, rota `/historico`) é a prateleira dos **registros congelados**: cada registro é a afirmação do vendedor sobre *o que ele cotou naquele dia*, com data, e os valores ficam parados para sempre. É o oposto da aba Simulações, que recalcula tudo com os preços de hoje toda vez que abre. O vocabulário é deliberado e vale para todo desenho: diz-se **"Valor cotado"**, nunca "Preço" (preço é o que a Calcular diz *hoje*); diz-se **"salvo"** só quando o servidor confirmou.

**Como o vendedor chega.** Pela barra de abas (mobile) ou pelo menu lateral (desktop). Mas o registro **nasce fora daqui**: no rodapé da Calcular, no rodapé do compositor de Kits e no rodapé da ficha de produto do Catálogo existe um botão **"Salvar em Orçamentos"** que abre a folha de gravação. Ele volta a esta aba para *provar depois o que cobrou* — mostrar ao cliente, exportar um PDF, ou perguntar "meu custo subiu desde que cotei?".

**Rotas.**
- `/historico` — a lista (com busca e filtro de período, paginada por "Carregar mais", nunca carregada inteira).
- `/historico?snapshot={clientSnapshotId}` — o registro. **Abaixo de 1280px** ele toma a tela inteira (com "← Voltar"); **a partir de 1280px** a mesma rota vira **mestre-detalhe**: lista à esquerda, registro na coluna direita fixa (`position:sticky`, rolagem própria), e o primeiro registro abre sozinho.

**O que a área guarda e onde.** Três camadas, sempre unidas numa lista só: (1) o **servidor** (a conta), (2) um **cache local por uid** que responde quando a rede falha, (3) a **outbox** — a fila durável no aparelho. Gravar é *sempre* enfileirar-e-drenar: online a fila esvazia dentro da mesma interação e o registro volta `synced`; offline ele fica `pending` e sincroniza sozinho depois (quatro gatilhos: abertura do app, volta da rede, foco da janela, aba visível). Estados possíveis de um registro: `synced` · `pending` · `blocked` (Premium não ativo) · `unauthenticated` (sessão expirou) · `failed` (servidor recusou).

**De que depende.** Do **entitlement do servidor** (a última palavra sobre o plano — nunca um sinalizador do cliente); do motor **`pricing-core`**, usado *apenas* em "Recalcular hoje" e "Comparar com hoje" — a leitura do registro **não recalcula nada**, todo número é uma string gravada; do **catálogo de tarifas** servido+cacheado (só nesses dois recálculos); da **sessão Firebase**; e do **catálogo de produtos/kits**, consultado só para saber se a origem ainda existe (nunca para um valor).

**O que ela alimenta.** Um cálculo vira registro congelado; um registro vira **PDF de orçamento para o cliente** ou **CSV da conta**; "Recalcular hoje" cria um **registro novo** (o original é imutável — só o rótulo pode ser editado); a ficha técnica leva de volta ao produto/kit de origem, quando ele ainda existe.

**Como muda por estado.**
- **Grátis / deslogado** — a aba inteira é substituída por uma porta honesta: título "Guarde seus orçamentos com a data", subtítulo, "Assinar Premium" e o rodapé "A calculadora continua grátis e sem limite." Nenhuma lista, nenhum registro.
- **Premium ativo** — tudo: gravar, ler, renomear, excluir, recalcular, exportar.
- **Premium pausado (lapsed)** — **nada é apagado**. A lista e os registros continuam legíveis; some a barra gerenciar, some "Recalcular hoje", "Exportar" fica visível-e-desabilitado com o motivo impresso. Uma faixa calma explica: escrever precisa do Premium ativo.
- **Offline** — leitura pelo cache com faixa "Modo leitura offline"; gravar funciona (vira pendente); exportar **não** funciona (o arquivo é gerado no servidor); comparar/recalcular usam o catálogo salvo no aparelho e avisam que ele pode estar desatualizado.
- **Sessão expirada** — os registros novos param na fila com "Envio pausado · sessão expirada", e o caminho de volta ("Entrar de novo") aparece no banner e dentro do registro. O aviso genérico de falha de carga **cala** para não virar uma terceira voz sobre o mesmo fato.

## O ponto exato de inserção desta peça

- **Onde vive:** A barra fica dentro do registro congelado, na sexta posição: logo ABAIXO do Card da alegação (e da faixa de Premium pausado, se houver) e logo ACIMA do alerta de sincronização. São dois botões pequenos lado a lado, com peso visual IDÊNTICO e ambos secundários: [Editar rótulo] e [Excluir]. Cada um abre um diálogo modal central: o de renomear traz um campo de texto pré-preenchido ("Rótulo (opcional)", até 120 caracteres) + [Voltar]/[Salvar rótulo]; o de excluir traz "Excluir este registro?" / "Esta ação não pode ser desfeita." + [Voltar]/[Excluir] em vermelho.
- **Como o vendedor chega:** O vendedor abriu o registro e quer corrigir o nome do cliente, ou limpar um orçamento que não vale mais. A barra só existe com Premium ATIVO e para um registro já SINCRONIZADO — um registro ainda na fila não tem id de servidor e é removido pelo [Descartar] do alerta, não por aqui.
- **Vizinhança imediata:** Acima: o Card branco com o valor cotado, a data e a validade. Abaixo: o alerta de sincronização (quando existe) e a legenda "Valores congelados em {data}".
- **Dados que chegam (e o que ela devolve):** O rótulo é o ÚNICO campo mutável do documento — todo o resto é imutável por contrato. O campo é semeado com o rótulo atual toda vez que o diálogo abre; um campo em branco LIMPA o rótulo (vira nulo, nunca string vazia). O diálogo de exclusão NÃO ecoa qual registro vai sumir.
- **O que acontece depois:** Renomear fecha o diálogo e dispara um aviso efêmero verde ("Rótulo atualizado."); o título do registro e o card da lista passam a mostrar o nome novo. Excluir fecha o diálogo, mostra "Registro excluído." e NAVEGA de volta para /historico.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Renomear rótulo e excluir registro — os dois gatilhos e os dois diálogos

## O que desenhar
A superfície de gerência de UM orçamento congelado, dentro do detalhe de `/historico/{id}` ("Orçamentos"):
os dois gatilhos ("Editar rótulo" e "Excluir") e os dois diálogos modais que eles abrem. Quem usa é o
vendedor que abriu um orçamento já salvo — em geral para corrigir o rótulo depois que o cliente virou um
nome de verdade ("Cliente João · pedido 412"), ou para apagar um registro de teste. O rótulo é o ÚNICO
campo mutável do documento (ADR-0019); todo o resto é imutável. Excluir é a única operação irreversível
do app sobre esse documento. Os gatilhos só aparecem quando o Premium está **ativo** E o registro já
**sincronizou** — um registro pendente não tem id no servidor e é descartado pela fila, não por aqui.

## Por que este prompt existe
Metade desta superfície tem desenho, a outra metade nenhuma — e a metade desenhada **contradiz o código**.
O canvas `Abas-Desktop.dc.html` (018) coloca "Editar rótulo" como botão fantasma pequeno com ícone de
lápis colado ao `<h2>` do rótulo, dentro do bloco da alegação, e "Excluir" como `tf-btn--danger-ghost`
empurrado para o fim da fileira de ações (`margin-left:auto`), separado de Exportar/Recalcular/Comparar
por toda a largura da linha. O código faz outra coisa: junta os dois como `secondary` neutros, do mesmo
tamanho, colados por 8px, numa barra própria DEPOIS do card da alegação. Nem a posição, nem o peso, nem o
tom batem. E **nenhum dos dois diálogos existe em autoridade nenhuma** — o canvas não tem um único
diálogo, o protótipo de 2026-07-02 não tinha renomear nem excluir (§E6 não os cita), e `ux-history.md` §3
só traz um ASCII com ✎ e 🗑. Os dois modais que estão no ar hoje foram inferidos por IA a partir de
texto.

## O que já existe hoje (não invente do zero — corrija)

**A barra** (`features/history/snapshot-manage.tsx`), renderizada entre o card "Valor cotado" e o alerta
de sincronização:

| elemento | como está hoje | observação |
|---|---|---|
| "Editar rótulo" | `Button size="sm" variant="secondary"` | sem ícone |
| "Excluir" | `Button size="sm" variant="secondary"` | → **mesmo peso visual do renomear, sendo irreversível** |
| container | `flex gap-2` | → no 390px os dois ficam colados a 8px, ambos alcançáveis pelo polegar |

→ O desenho do 018 já resolveu isto no desktop e o código não seguiu. Desenhe a versão certa para **os
dois** viewports, e não repita o empate de peso.

**Diálogo 1 — renomear.** Título "Editar rótulo" (o mesmo texto do gatilho). Um único campo de texto,
rótulo "Rótulo (opcional)", pré-preenchido com o rótulo atual, `maxLength` 120, sem dica, sem contador,
sem placeholder. Rodapé alinhado à direita: [Voltar] `secondary` + [Salvar rótulo] primário.
→ A folha de salvar (`record-snapshot-sheet.tsx`) mostra o MESMO campo **com** a dica "Cliente, pedido…";
aqui ela sumiu — a mesma pergunta, feita duas vezes, com ajudas diferentes.
→ Salvar com o campo **vazio apaga o rótulo** (grava `null`), e nada na tela diz isso.
→ Sucesso é só o toast "Rótulo atualizado." (tom `success`) e o diálogo fecha; falha é o toast
"Não foi possível atualizar o rótulo." (tom `danger`) com o diálogo ABERTO e o texto digitado intacto.
Nenhum estado de erro dentro do campo.

**Diálogo 2 — excluir.** Título "Excluir este registro?", descrição "Esta ação não pode ser desfeita.",
rodapé [Voltar] `secondary` + [Excluir] `danger`.
→ **O diálogo não diz QUAL registro vai sumir.** O mesmo app já faz isso certo em dois outros lugares: o
catálogo pergunta "Excluir “PLA Azul”?" e as simulações também ecoam o nome. Aqui, não.
→ Sucesso: toast "Registro excluído." e a tela volta para a lista `/historico`.
→ Falha: toast "Não foi possível excluir o registro." e o diálogo permanece aberto.

**A moldura dos dois** (`tf-dialog`): caixa centrada de `min(92vw, 32rem)`, `max-height: 85vh`, padding
`--space-6`, cantos `--radius-xl`, sobre o scrim `--surface-overlay`. **O título do diálogo é renderizado
em CAIXA ALTA com tracking largo** — "EDITAR RÓTULO" e "EXCLUIR ESTE REGISTRO?". Nenhum dos dois tem o X
de fechar (`showClose={false}`), mas o título ainda reserva `--space-10` de padding à direita para um X
que não existe → o texto fica visivelmente descentrado. Corrija no desenho.

## Conteúdo e dados reais
- Identidade do registro: o rótulo quando existe; senão o nome da origem gravada; senão o literal
  "Cálculo avulso". Exemplo real para as pranchetas: rótulo "Cliente João · pedido 412", "Cotado em
  06/08/2026 às 14:32", "Valor cotado **R$ 24,24**", legenda "preço de varejo", "Validade da proposta:
  7 dias".
- Campo rótulo: texto livre, **opcional**, até 120 caracteres, sem validação — qualquer texto salva.
  Desenhe também um rótulo longo de verdade (120 caracteres) e prove que ele não estoura o campo nem
  empurra o rodapé para fora dos 85vh.
- Nada mais do documento é editável: valores, data, canais, ficha técnica e detalhamento são congelados.

## Estados obrigatórios
1. **Barra em repouso** — os dois gatilhos com hierarquia diferente (renomear discreto, excluir em tom de
   perigo e afastado). Foco visível com o anel do DS; hover e pressionado nos dois.
2. **Barra ausente** — Premium `lapsed`: os gatilhos simplesmente não existem, e logo acima aparece o
   alerta `info` "Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar,
   renomear, excluir ou exportar, reative o Premium." Desenhe esse recorte: a ausência precisa ficar
   explicada, não misteriosa.
3. **Barra ausente por registro pendente** — o registro ainda não chegou à conta; no lugar aparece o
   alerta "Ainda não sincronizado" com o corpo dele. Uma prancheta bastando o recorte.
4. **Renomear — repouso**, com o campo pré-preenchido e o cursor no fim do texto.
5. **Renomear — foco no campo** (anel) e **campo vazio** (o estado que apaga o rótulo).
6. **Renomear — salvando**: o botão [Salvar rótulo] com spinner inline, rótulo mantido, interação
   bloqueada; [Voltar] no mesmo instante.
7. **Renomear — falhou**: diálogo aberto, texto preservado, toast `danger` "Não foi possível atualizar o
   rótulo.".
8. **Excluir — repouso**, com o registro identificado.
9. **Excluir — excluindo**: [Excluir] `danger` com spinner, bloqueado.
10. **Excluir — falhou**: toast `danger` "Não foi possível excluir o registro.", diálogo aberto.
11. **Toasts de sucesso**: "Rótulo atualizado." e "Registro excluído." (tom `success`), sobre a tela de
    destino certa — o segundo já na lista de Orçamentos.

## Viewports
- **Mobile 390px** — obrigatório: é onde os dois gatilhos hoje ficam colados e onde o diálogo ocupa 92vw
  (≈359px). Mostre o rodapé de dois botões com alvo ≥44px e sem estouro horizontal.
- **Desktop 1280px** — obrigatório: é o corte do 018, onde o detalhe vive na coluna direita do
  mestre-detalhe (~560px) e os gatilhos precisam conviver com "Exportar" (primário), "Recalcular hoje" e
  "Comparar com hoje" na mesma fileira. O diálogo aqui é a caixa centrada de 512px.
- **1920px** opcional: o diálogo não muda de tamanho; só desenhe se quiser mostrar o scrim numa tela larga.

## Regras que o desenho não pode quebrar
- **O irreversível não pode ter o peso do reversível.** Excluir e renomear jamais lado a lado, mesmo
  tamanho, mesmo tom.
- **Confirmação nomeia o objeto.** Quem confirma precisa ler qual registro morre — é a regra que o
  catálogo e as simulações já seguem neste app.
- **Freemium binário e honesto**: sem Premium ativo os gatilhos NÃO aparecem em versão desabilitada com
  cadeado; eles somem, e o banner de pausa explica. Não invente um estado "meio ativo".
- **Falha de rede nunca vira outra coisa.** As duas operações só funcionam online; se o desenho propuser
  uma mensagem para o caso sem conexão, ela precisa dizer "conexão", e nunca sugerir que o problema é o
  plano ou que o registro foi perdido.
- **Nada aqui promete alterar o documento.** Renomear muda só o rótulo; o desenho não pode insinuar que
  valores possam ser corrigidos.
- Alvos ≥44×44px em ambos os viewports, inclusive [Voltar]. Contraste medido contra `--surface-card` sobre
  o scrim, nos dois temas.

## Armadilhas já pagas neste projeto
- **Frase honesta em placeholder é frase perdida** (016/PR-F): a explicação de que o campo vazio apaga o
  rótulo, se existir, vai em elemento próprio — nunca dentro do input.
- **Texto ocluso passa em teste** (014): o rodapé do diálogo com dois botões e um rótulo longo já é o
  cenário clássico de estouro; desenhe medindo caixas, não confiando na frase.
- **Valor grande estoura a coluna** (E4/T034): se o diálogo de exclusão passar a ecoar o registro,
  ele carrega um rótulo de até 120 caracteres — desenhe com um de verdade, truncando com elegância.
- **Ausência sem explicação lê como bug** (E6/PR-B): a barra que some no `lapsed` só é honesta porque o
  banner está logo acima; mantenha os dois no mesmo recorte.

## Entregável
Pranchetas nos **dois temas** (escuro é o padrão, claro é first-class), agrupadas em três blocos:
(A) os gatilhos em contexto — 390px e 1280px, incluindo os recortes de `lapsed` e de registro pendente;
(B) o diálogo de renomear em seus cinco estados; (C) o diálogo de excluir em seus três.
Reutilize os primitivos existentes, sem criar novos: a moldura é `tf-dialog` (título `tf-dialog__title`,
descrição `tf-dialog__desc`); o campo é `tf-field` + `tf-input` dentro de `tf-inputwrap`; os botões são
`tf-btn` nas variantes `--ghost`/`--sm` (renomear), `--danger-ghost` (gatilho de excluir),
`--secondary` (Voltar), `--primary` (Salvar rótulo) e `--danger` (Excluir do modal); o retorno é
`tf-toast--success` / `tf-toast--danger`; a explicação de pausa é o alerta em tom `info`.

## Perguntas em aberto para o dono
1. Adotamos a posição do canvas 018 — "Editar rótulo" fantasma com lápis colado ao rótulo, "Excluir"
   `danger-ghost` no fim da fileira de ações — e **matamos a barra separada**, inclusive no mobile? Ou o
   mobile mantém uma barra própria com hierarquia corrigida?
2. O diálogo de exclusão passa a ecoar o registro. Quando o registro **não tem rótulo**, o que ele deve
   citar: o nome da origem gravada, o literal "Cálculo avulso", ou o valor e a data ("R$ 24,24, cotado em
   06/08/2026")? Ecoar um nome de origem pode afirmar uma procedência que o vendedor nunca escreveu.
3. Apagar o rótulo (salvar o campo vazio) é um caminho intencional? Se for, ele merece dizer-se — texto
   de ajuda, ou uma ação explícita "Remover rótulo" — e isso muda o rodapé do diálogo.
4. Sem conexão, renomear e excluir devem ficar **bloqueados com motivo dito** (a família já tem "Criar e
   editar precisam de conexão.") ou continuar clicáveis e falhar com toast? Hoje falham com um toast que
   não nomeia a causa.

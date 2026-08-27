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

- **Onde vive:** No topo da lista de /historico, dentro do fluxo da página: DEPOIS da faixa de Premium pausado e da faixa de leitura offline / erro de carga, e ANTES da barra de filtros. É a terceira e última faixa possível antes do primeiro card. No desktop ele mora no topo da coluna esquerda (a lista), não sobre o registro. O Alert carrega o texto à esquerda e, num grupo à direita que pode embrulhar, até três controles pequenos: [Ver], [Entrar de novo] (um link vestido de botão) e [Sincronizar agora] (com estado de carregamento).
- **Como o vendedor chega:** Aparece sozinho sempre que existir pelo menos um registro não sincronizado na fila deste aparelho. O vendedor não o pede.
- **Vizinhança imediata:** Imediatamente acima pode haver duas outras faixas; imediatamente abaixo, o campo "Buscar por rótulo" da barra de filtros e a fileira de chips de período. Mais acima ainda, fora da página, as faixas globais do shell.
- **Dados que chegam (e o que ela devolve):** A contagem por estado da fila. O TEXTO é escolhido por precedência — falhou > Premium pausado > sessão expirada > pendente offline > pendente — e só "falhou" usa o tom vermelho. Os botões seguem regras próprias: [Ver] aparece quando existe algo que precisa de decisão humana; "Entrar de novo" só quando há entrada com sessão expirada; [Sincronizar agora] só quando há pendente saudável E o aparelho está online (nunca um botão que não pode funcionar).
- **O que acontece depois:** [Ver] rola suavemente até o primeiro card problemático e o centraliza — mas o card de destino NÃO recebe nenhum destaque ao chegar. [Sincronizar agora] drena a fila e o banner desaparece se tudo passar. "Entrar de novo" vai ao login e volta para /historico.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Banner agregado da fila de envio (Orçamentos)

## O que desenhar
A faixa que aparece no topo da lista de **Orçamentos** (rota `/historico`) sempre que existe pelo menos um
registro que ainda **não chegou à conta** do vendedor — ficou parado neste aparelho. Ela é a única voz
agregada sobre a fila: diz quantos registros estão parados, **por qual motivo**, e oferece a ação que faz
sentido para aquele motivo. Quem lê é o vendedor que acabou de salvar um orçamento (muitas vezes numa
feira, no celular, com sinal ruim) e precisa saber, sem abrir card nenhum, se o que ele gravou existe só
no telefone. A peça vive acima da barra de busca/período e acima dos cards; cada card ainda carrega seu
próprio selo de estado — o banner **resume**, nunca substitui.

## Por que este prompt existe
O canvas do dono (`Abas-Desktop.dc.html`, linha 265) desenha **um** caso: `tf-alert--info` compacto com
"1 registro(s) pendente(s) neste dispositivo." e um botão "Sincronizar agora". As outras **quatro
redações** — falhou, Premium pausado, sessão expirada, pendente offline —, o tom `danger`, e os botões
**[Ver]** e **[Entrar de novo]** nunca foram desenhados: nasceram de requisito textual (`ux-history.md`
§2.2) e de dois hotfixes (016/A3). Nunca se desenhou como um alerta acomoda a frase mais longa **e até
três botões** em 390px, nem como o [Ver] sinaliza o card de destino ao chegar nele. O protótipo antigo
(2026-07-02) não ajuda: ele tem o banner offline genérico do shell e nenhuma fila.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (função `QueueBanner`, ~linha 553) +
`shared/i18n/messages.pt-br.ts` (§ `historico`, linhas 945–956 e 1016).

A frase é **uma só**, escolhida por precedência `falhou > pausado > sessão expirada > pendente offline >
pendente`:

| Situação | Frase literal em pt-BR | Tom |
|---|---|---|
| ≥1 falhou | `"{n} registro(s) não puderam ser registrados."` | **danger** |
| ≥1 bloqueado | `"{n} registro(s) não foram enviados: o Premium não está ativo."` | info |
| ≥1 sessão expirada | `"{n} registro(s) não foram enviados: sua sessão expirou."` | info |
| pendente, offline | `"Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online."` | info |
| pendente, online | `"1 registro(s) pendente(s) neste dispositivo."` | info |

Os controles aparecem **por condição**, todos `tf-btn--secondary tf-btn--sm`, dentro de um bloco que
permite quebra de linha (`display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between`):

- **"Ver"** — quando há falhou/pausado/sessão expirada. Rola suavemente até o primeiro card problemático.
- **"Entrar de novo"** — só quando há sessão expirada. É um link vestido de botão; leva ao login e volta.
- **"Sincronizar agora"** — só quando há pendente **e** o aparelho está online; ganha spinner enquanto envia.

→ **Problema 1**: a precedência esconde metade da verdade. Com 2 falhados + 3 pendentes o vendedor lê só
"2 registro(s) não puderam ser registrados." e vê um "Sincronizar agora" cuja razão de existir não está
escrita em lugar nenhum da faixa.
→ **Problema 2**: `"{n} registro(s)"` é copy de programador. "1 registro(s)" está na tela hoje.
→ **Problema 3**: o [Ver] chega ao card **sem nenhuma marca nele** — o vendedor rolou e não sabe qual era.
→ **Problema 4**: `tf-btn--sm` tem **36px** de altura (`--control-h-sm`), abaixo do alvo mínimo de 44px.
→ **Problema 5**: no desktop, o canvas põe a faixa **em largura cheia acima das duas colunas**; o código a
renderiza **dentro da coluna esquerda da lista** (520px a partir de 1440px; ~510px em 1280px). Os três
botões precisam caber na largura que o desenho escolher — e o desenho precisa escolher.

## Conteúdo e dados reais
- `{n}` é uma contagem inteira ≥ 1, sem teto. Desenhe com **1**, com **12** e com **128**.
- Estados de sincronização reais por registro: `pending`, `blocked`, `unauthenticated`, `failed`, `synced`.
- Os selos dos cards abaixo (mesmo vocabulário; não repita nem contradiga): `"Pendente neste dispositivo"`,
  `"Envio pausado · precisa de Premium"`, `"Envio pausado · sessão expirada"`, `"Não foi possível registrar"`.
- O card logo abaixo mostra, nesta ordem: rótulo (ex.: "Cliente João — vaso G"), o selo, `"Cotado em
  12/07/2026 · Kit · 3 peças"`, e só então `Valor cotado   R$ 275,00` com a legenda da base ("preço de varejo").
- Vizinhos que podem estar na tela **ao mesmo tempo**, empilhados acima: o banner sticky de sessão
  (`"Sua sessão expirou"` / `"Entre de novo para continuar de onde parou."` / `[Entrar de novo]`), o
  `"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou
  exportar, reative o Premium."` e o `"Modo leitura offline"`. Três alertas seguidos é cenário real.

## Estados obrigatórios
1. **Pendente online** — info, frase curta, um botão "Sincronizar agora".
2. **Pendente offline** — info, a frase longa (139 caracteres), **nenhum botão** (não se oferece o que não funciona).
3. **Premium pausado** — info, "Ver" (+ "Sincronizar agora" se houver pendente saudável online).
4. **Sessão expirada** — info, "Ver" + "Entrar de novo" (+ "Sincronizar agora" quando couber).
5. **Falhou** — **danger**, "Ver" (+ os outros dois no caso misto). O único vermelho da peça.
6. **Máximo simultâneo** — falhou + sessão expirada + pendente online = frase de falha e **três botões**.
   Este é o desenho que precisa provar que cabe em 390px.
7. **Sincronizando** — o "Sincronizar agora" em carregamento, largura estável, sem pular o layout.
8. **Foco de teclado** em cada um dos três controles (anel visível sobre o fundo tingido do alerta).
9. **Hover** e **pressionado** dos botões sobre `--tf-info-soft` e sobre `--tf-danger-soft`.
10. **Resolvido** — a fila zerou e a faixa **some**. Desenhe o "depois" (a lista sem a faixa) e diga o que o
    vendedor vê como confirmação de que o envio deu certo — hoje, nada.
11. **Chegada do [Ver]** — o card de destino precisa de um destaque de chegada, distinto do card aberto do
    mestre-detalhe (que já usa `--accent` + `--accent-soft`).

## Viewports
- **390px (mobile)** — obrigatório, é o uso principal (feira, celular, sinal ruim). Prancheta dedicada para
  o estado 6 (três botões) e para o estado 2 (frase longa).
- **1280px (desktop)** — o mestre-detalhe: aqui a faixa tem ~510px se ficar dentro da coluna da lista, ou
  ~1200px se ficar acima das duas colunas. Desenhe a posição que você defender e diga qual é.
- **1440px** — a coluna da lista trava em 520px; vale conferir se a decisão tomada em 1280 continua de pé.
  1920px segue a mesma regra de 1440 e não precisa de prancheta própria.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium, e sessão expirada nunca é chamada de conexão.**
  As palavras "conexão"/"online" são **proibidas** na frase de sessão expirada — foi um defeito real (016/A3).
- **Nunca um botão que não pode funcionar**: sem conexão não existe "Sincronizar agora".
- **O `danger` é só para "falhou"** — o único estado em que o servidor recusou o registro de vez. Premium
  pausado e sessão expirada não destruíram nada: o registro continua no aparelho, e dizer o contrário mente.
- **A faixa não vende Premium.** Ela informa; o convite mora no teaser da página, não aqui.
- Alvo de toque **≥44px** nos três botões, inclusive quando quebram para a segunda linha.
- Contraste do texto medido contra o fundo tingido real do alerta (`--tf-info-soft` / `--tf-danger-soft`),
  nunca contra o fundo da página.
- A frase honesta é **texto de verdade**: nunca placeholder, nunca truncada com reticências.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: no E6/T028 um botão nasceu **fora da viewport** e a página vazou 100,5px.
  Três botões `sm` somam ~334px mais 16px de espaçamento; a largura útil dentro do alerta em 390px é ~294px
  (390 − 32 de margem − 32 de padding do alerta − 20 do ícone − 12 do gap). **Não cabe.** O desenho resolve
  isso de propósito, em vez de entregar a decisão ao `flex-wrap`.
- **Texto ocluso passa em teste**: `toBeVisible` aprova um botão coberto; layout aqui se prova com caixas.
- **Placeholder que corta frase honesta** (016/PR-F): frase honesta mora em elemento de largura cheia.
- **Rolagem no eixo Y invisível em headless** (016/PR-B): a faixa não pode criar rolagem interna própria.
- O canvas do dono transcreveu a string do código de 2026-07-15 — ele **ratifica** o caso feliz, não o antecede.

## Entregável
Pranchetas em tema **escuro** (padrão) e **claro** (first-class, as mesmas pranchetas):
1. As cinco redações em 390px, empilhadas, para comparar peso visual entre elas.
2. O estado 6 (três botões) em 390px — o teste de carga da peça.
3. A faixa em 1280px na posição que você defender, com a lista e o detalhe atrás.
4. Foco / hover / pressionado / carregando, ampliados.
5. O antes-e-depois do [Ver]: a faixa, o rolar, o card de destino destacado.
6. A pilha real: banner sticky de sessão + faixa da fila + lista.

Reutilize os primitivos: `tf-alert` (`--info` e `--danger`, com o ícone que o tom já traz) para a faixa;
`tf-btn tf-btn--secondary` para os três controles (proponha o tamanho que atenda 44px em vez de criar um
botão novo); `tf-badge` para os selos dos cards; `tf-card` para os cards. **Atenção**: o `tf-alert--compact`
usado no canvas **não é um primitivo compartilhado** — ele mora hoje em
`features/calculator/shopee-warnings.css`. Se o desenho depender dele, diga isso explicitamente, para que
ele seja promovido em vez de copiado.

## Perguntas em aberto para o dono
1. **Estado misto**: com falhados **e** pendentes ao mesmo tempo, a faixa deve dizer as duas verdades (duas
   linhas) ou continuar dizendo só a mais grave? Hoje só a mais grave aparece — e sobra um botão sem frase
   que o explique.
2. **"{n} registro(s)"**: pode ser reescrito para "1 registro" / "12 registros"? A string está homologada
   desde 2026-07-15 e foi transcrita para o seu canvas, então a troca é decisão sua, não do desenho.
3. **Confirmação de sucesso**: quando o "Sincronizar agora" termina bem, o vendedor deve ver algo? A frase
   "Registro sincronizado." existe no código e **nunca é exibida**; hoje a faixa simplesmente desaparece.
4. **Posição no desktop**: largura cheia acima das duas colunas (como no seu canvas) ou dentro da coluna da
   lista (como o código faz hoje)? Isso muda quanto espaço os três botões têm.

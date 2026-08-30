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

- **Onde vive:** Um diálogo modal central, BLOQUEANTE, montado no shell do app (portanto por cima de QUALQUER aba, não só de Orçamentos). Etapa 1: título com a contagem ("{n} registro(s) ainda não foram sincronizados") · a explicação · um alerta VERMELHO de falha parcial quando houver · e três botões EMPILHADOS verticalmente: [Sincronizar agora] primário, [Sair e descartar] vermelho, [Voltar] secundário — com a frase "Precisa de conexão para enviar." centralizada entre os dois primeiros quando o aparelho está offline. Etapa 2: a confirmação destrutiva substitui TODO o conteúdo do mesmo diálogo ("Descartar {n} registro(s) e sair?" + [Voltar]/[Descartar e sair]).
- **Como o vendedor chega:** O vendedor toca em "Sair" — na barra superior do mobile ou no rodapé do menu lateral do desktop, ou na aba Conta. A saída é INTERCEPTADA e fica pendurada até ele responder. Se a fila estiver vazia, o diálogo nem aparece.
- **Vizinhança imediata:** Por baixo fica a tela onde ele estava (qualquer aba). Não há lista dos registros em risco dentro do diálogo — só a contagem.
- **Dados que chegam (e o que ela devolve):** A contagem vem da fila deste aparelho, para este uid. A conectividade é observada ao vivo: um diálogo aberto offline REABILITA [Sincronizar agora] no instante em que a rede volta.
- **O que acontece depois:** [Sincronizar agora] drena a fila; se tudo passar, a saída prossegue sem perda. Se sobrar alguma coisa, NÃO se sai: a contagem do título é reescrita e o alerta vermelho de falha parcial aparece dentro da etapa 1. [Sair e descartar] → confirmação → apaga a fila do aparelho e sai (o único ponto do app onde sair destrói trabalho para sempre). [Voltar] cancela a saída.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Alerta de estado do registro não sincronizado (4 estados)` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Sair da conta com orçamentos ainda não sincronizados

## O que desenhar
O diálogo bloqueante que aparece quando o vendedor toca em **Sair** e ainda existem orçamentos gravados só
neste aparelho (a fila de envio, o *outbox*). Ele intercepta o logout em qualquer ponto do app — hoje há
dois "Sair": o do rodapé do rail de navegação no desktop e o da aba **Conta** — e segura a saída até o
vendedor decidir. São **três telas do mesmo diálogo**: (1) a decisão, com a contagem do que está em risco;
(2) a confirmação destrutiva, que substitui todo o conteúdo do mesmo quadro; (3) a etapa 1 de novo, agora
com um aviso de que a sincronização foi PARCIAL. É o único ponto do produto onde sair da conta pode
destruir trabalho do vendedor para sempre: sair apaga a fila deste aparelho, e a fila é a única cópia de
um orçamento que nunca chegou à conta.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho desenhou esta peça. O protótipo de 2026-07-02 (`claude-design-prototype.md`)
descreve a Conta como "email · plano · toggle de tema · Sair · Sobre/versão" e a matriz de estados registra
"Conta | offline: logout ok, sync off" — o logout é tratado como trivial, **porque no protótipo a fila
nem existia**. No canvas de desktop do dono há dois "Sair" e nenhum guarda, nenhum diálogo, nenhuma contagem.
A fonte real é `ux-history.md` §5 (um ASCII das duas etapas) e o próprio §9.1 item 4, que classifica
"Sign-out-with-queue dialog — High" como **explicitamente pendente de protótipo em pixel**. O terceiro
estado (falha parcial) não está nem na spec textual: nasceu de um review de código. Foram inferidos sem
desenho: o empilhamento vertical dos três botões, a posição do aviso de falha parcial e — o mais grave —
a **ausência de qualquer lista dos registros em risco**: hoje o vendedor decide descartar sem ver o que
vai perder.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/features/history/sign-out-outbox-guard.tsx` + `shared/i18n/messages.pt-br.ts`.
O quadro é um diálogo central (largura `min(92vw, 32rem)`, altura máx. 85vh, rolagem interna) e
**não tem botão X** — sair é decisão explícita; Esc / clique fora equivalem a "Voltar" (continua logado).

**Etapa 1 — a decisão**

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título | "{n} registro(s) ainda não foram sincronizados" | `{n}` = itens na fila; ex.: "3 registro(s) ainda não foram sincronizados" |
| Corpo | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | frase honesta, manter verbatim |
| Aviso de falha parcial (condicional) | "{n} registro(s) não puderam ser enviados. Eles continuam neste aparelho." | bloco de alerta em tom perigo, hoje logo abaixo do corpo |
| Botão 1 (primário) | "Sincronizar agora" | desabilitado sem conexão **e** enquanto sincroniza |
| Legenda offline | "Precisa de conexão para enviar." | centralizada, entre o botão 1 e o botão 2, só quando offline |
| Botão 2 (perigo) | "Sair e descartar" | leva à etapa 2 |
| Botão 3 (secundário) | "Voltar" | fecha, permanece logado |

Os três botões estão **empilhados verticalmente**, largura total, nesta ordem — o destrutivo fica ACIMA do
"Voltar".

**Etapa 2 — a confirmação destrutiva** (substitui todo o conteúdo do mesmo quadro)

| Elemento | Texto literal hoje |
|---|---|
| Título | "Descartar {n} registro(s) e sair?" |
| Corpo | "Eles não foram enviados para a sua conta e não poderão ser recuperados." |
| Botões | linha alinhada à direita: "Voltar" (secundário) + "Descartar e sair" (perigo) |

→ **Problemas a resolver no desenho:**
→ 1. **Não existe lista do que está em risco.** O vendedor lê "3 registro(s)" e escolhe apagar às cegas.
→ 2. **Não existe estado de carregando visível.** Ao sincronizar, o botão só fica desabilitado — mesmo
     rótulo, nenhum indicador; uma fila de 20 itens parece um botão morto.
→ 3. **O aviso de falha parcial não diz a CAUSA.** O app tem vocabulário honesto por causa em outros
     lugares ("Envio pausado · precisa de Premium", "Envio pausado · sessão expirada", "Não foi possível
     registrar") e aqui joga tudo num "não puderam ser enviados" genérico — e "Sincronizar agora"
     continua oferecido mesmo quando nenhuma dessas causas pode ser resolvida por uma nova tentativa.
→ 4. **A ordem dos botões coloca a ação destrutiva antes da saída segura**, sem separação visual entre elas.
→ 5. Contagem em "registro(s)" — a forma de plural mais preguiçosa do produto, e ela aparece no TÍTULO.

## Conteúdo e dados reais
Cada registro da fila já tem, hoje, todo o conteúdo necessário para ser mostrado (é o mesmo material do
card da lista de Orçamentos):

- **Título**: o rótulo dado pelo vendedor ("Cliente João", "Feira do maker"), ou o nome do produto/kit de
  origem, ou o texto "Cálculo avulso" quando não há nem um nem outro.
- **Data**: "Cotado em 03/07/2026".
- **Tipo**: "Peça única" ou "Kit · 4 peças".
- **Dinheiro**: rótulo "Valor cotado" + o valor, ex.: **R$ 1.234,56** (valores reais do produto vão de
  ~R$ 16,16 a alguns milhares; a máscara de milhar é obrigatória).
- **Base**: legenda "preço de varejo" ou "preço de atacado".
- **Selo de estado**: "Pendente neste dispositivo" (informativo) · "Envio pausado · precisa de Premium" ·
  "Envio pausado · sessão expirada" · "Não foi possível registrar" (perigo).

A contagem `{n}` é derivada: é o tamanho real da fila no momento, e **é reescrita** depois de uma
sincronização parcial (de 5 pode virar 2, com o mesmo diálogo aberto). Faixa plausível: 1 a algumas
dezenas — desenhe o quadro para 1, para 3 e para 12+.

## Estados obrigatórios
1. **Repouso, online** — etapa 1 com os três botões, "Sincronizar agora" ativo.
2. **Offline** — "Sincronizar agora" desabilitado + a legenda "Precisa de conexão para enviar." visível
   entre ele e "Sair e descartar". A legenda é a explicação de um botão morto: não pode sumir nem virar
   tooltip.
3. **Sincronizando** — o primário ocupado; mostre o progresso de forma honesta (o app sabe quantos faltam).
4. **Falha parcial** — volta à etapa 1 com o alerta em tom perigo "{n} registro(s) não puderam ser
   enviados. Eles continuam neste aparelho." e o título já com a contagem NOVA. O vendedor **não** foi
   deslogado: essa é a regra.
5. **Confirmação destrutiva** (etapa 2) — o quadro inteiro trocado, foco inicial no caminho seguro.
6. **Foco / hover / pressionado / desabilitado** de cada botão, incluindo o anel de foco sobre o fundo do
   diálogo (não sobre o fundo da página).
7. **Sucesso total** — o diálogo simplesmente fecha e o logout acontece; nada a desenhar além da ausência.
8. **Envio pausado por Premium ou por sessão expirada** entre os itens da fila — precisa aparecer no
   desenho (é a causa mais comum de falha parcial e a que "tentar de novo" nunca resolve).

## Viewports
- **Mobile 390px** — obrigatório: é onde o vendedor mais usa o app e onde o quadro chega a ~359px de
  largura útil; a pilha vertical de botões nasceu daqui.
- **Desktop 1280px** — obrigatório: o incremento 018 pôs um "Sair" no rodapé do rail de navegação e outro
  na aba Conta; o quadro fica travado em 512px de largura sobre a área de trabalho, e a pilha vertical de
  três botões largura-total fica visivelmente estranha nessa largura. Se o desenho separar os layouts,
  diga qual é o corte.
- **Desktop 1920px** — só se o quadro mudar de tamanho ou de ancoragem; caso contrário, declare
  explicitamente que é idêntico ao de 1280px.

## Regras que o desenho não pode quebrar
- **Nunca vender falha de rede como problema de plano nem o contrário.** Cada causa tem a sua frase, e
  "conexão" não pode aparecer quando o motivo é sessão expirada ou Premium pausado.
- **A frase honesta vive em elemento de largura total**, nunca em placeholder e nunca cortada por
  reticências — já custou uma homologação neste projeto.
- **Não existe caminho silencioso.** Nenhum toast depois do fato, nenhum descarte sem a etapa 2, nenhum
  logout automático depois de falha parcial.
- **A saída segura precisa ser visualmente inconfundível** em relação ao descarte; um vendedor com pressa
  tocando no lugar errado perde trabalho para sempre.
- **Alvo mínimo 44×44px** em todos os botões, inclusive na linha da etapa 2.
- **Contraste medido contra o fundo real do diálogo** (que já é uma superfície elevada), não contra o
  fundo da página, nos dois temas.
- O quadro rola internamente (85vh máx.): se o desenho introduzir uma lista, ela precisa de um limite de
  altura próprio e os botões precisam continuar alcançáveis sem rolar até o fim.

## Armadilhas já pagas neste projeto
- **Estouro medido nos DOIS eixos.** O headless não enxerga barra de rolagem clássica; o item 9 da
  homologação de 016 era rolagem no eixo VERTICAL. Um diálogo com lista é candidato natural a estourar.
- **Nome longo estoura a coluna do dinheiro.** "Cliente João da Silva Comércio de Peças" ao lado de
  R$ 1.234,56 já quebrou layout de PDF neste produto porque o teste lia texto, não geometria. Desenhe
  com o rótulo mais longo plausível, não com "Cliente A".
- **Texto ocluso passa em teste.** Se algo ficar atrás do rodapé de botões ou fora do quadro, nenhum
  teste de texto acusa — só o desenho e a medida de caixa.
- **Máscara de milhar sumindo** em reabertura programática já foi achado real (R5): mostre R$ 1.234,56,
  nunca R$ 1234.56.
- **Botão nascido fora da viewport**: em 012/PR-B um botão de um diálogo nasceu 100px fora da tela em
  390px. A pilha vertical de três botões + alerta + lista é exatamente a receita para repetir isso.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como cidadão de primeira classe**, em 390px e 1280px:
1. Etapa 1 online, fila com 3 registros.
2. Etapa 1 offline (legenda "Precisa de conexão para enviar." no lugar).
3. Etapa 1 sincronizando.
4. Etapa 1 após falha parcial, com o alerta em tom perigo e a contagem reescrita.
5. Etapa 2, a confirmação destrutiva.
6. Uma prancheta de estresse: 12+ registros, rótulo longo, valor na casa dos milhares.

Reutilize os primitivos existentes, sem criar novos: o **quadro do diálogo** (variante central, sem X),
**título e descrição do diálogo** para as duas etapas, o **bloco de alerta em tom perigo** para a falha
parcial, os **botões** nas variantes primário / perigo / secundário, o **selo** nos tons informativo e
perigo para o estado de cada registro, e o **card com padding pequeno** caso a lista de registros entre.
O dinheiro usa o estilo de preço já existente, com a máscara pt-BR.

## Perguntas em aberto para o dono
1. **A lista dos registros em risco entra?** É a correção mais importante possível aqui, mas muda o
   tamanho da peça. Se entra: entra na etapa 1, na etapa 2, ou nas duas? Mostra tudo com rolagem, ou os
   primeiros N com um "e mais X"? E o vendedor pode escolher o que descartar, ou continua sendo tudo-ou-nada?
2. **O aviso de falha parcial deve nomear a causa por registro** (Premium pausado / sessão expirada /
   recusado pelo servidor), como o resto do app já faz? E quando **nenhum** dos que sobraram pode ser
   resolvido por nova tentativa, "Sincronizar agora" continua sendo o botão primário?
3. **A ordem dos botões na etapa 1 muda?** Hoje o destrutivo fica acima de "Voltar". O senhor quer o
   destrutivo por último, separado, ou até rebaixado a link discreto?
4. **A contagem "registro(s)"** fica assim ou vira forma singular/plural de verdade ("1 orçamento" /
   "3 orçamentos")? Nota: o resto do produto já chama esses documentos de **Orçamentos**, mas este
   diálogo diz "registro" — pode ser incoerência de vocabulário a resolver.
5. **No desktop com o rail de 018**, o diálogo cobre a tela inteira ou fica ancorado à área de conteúdo?
   Nada no canvas responde isso.

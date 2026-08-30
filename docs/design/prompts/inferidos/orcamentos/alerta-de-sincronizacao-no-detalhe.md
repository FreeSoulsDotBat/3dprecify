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

- **Onde vive:** Dentro do registro congelado, na sétima posição da pilha: logo ABAIXO da barra gerenciar [Editar rótulo][Excluir] (quando ela existe) e imediatamente ACIMA da legenda "Valores congelados em {data}". Renderizado só quando o registro NÃO está sincronizado. Dentro dele podem empilhar até quatro elementos: o corpo do recado; a ressalva de durabilidade em texto cinza pequeno ("Enquanto não sincroniza, ele existe só aqui — se os dados do app forem limpos, ele se perde."); a linha "Código de suporte: {n}"; um link vestido de botão secundário pequeno "Entrar de novo"; e o par [Tentar novamente]/[Descartar].
- **Como o vendedor chega:** O vendedor abre um registro que ele acabou de gravar numa feira sem sinal, ou um que a lista marcou com badge. Não há gesto para abrir este alerta — ele está lá porque o registro ainda não chegou à conta.
- **Vizinhança imediata:** Acima: a barra gerenciar (ausente aqui, porque ela só aparece para registro sincronizado) e, mais acima, a faixa de Premium pausado e o Card da alegação com o valor cotado. Abaixo: a legenda dos valores congelados e todo o corpo do documento.
- **Dados que chegam (e o que ela devolve):** O estado de sincronização do registro decide título, corpo e tom: "Ainda não sincronizado" (pendente, info) · "Envio pausado" (Premium não ativo, info) · "Sessão expirada" (info) · "Não foi possível registrar" (o servidor recusou — o ÚNICO em tom vermelho). O código de suporte vem do último status HTTP guardado na fila.
- **O que acontece depois:** [Tentar novamente] recoloca a entrada na fila; num registro de sessão morta é um no-op seguro que passa a funcionar de verdade depois do login. [Descartar] abre a confirmação destrutiva. "Entrar de novo" leva ao login preservando a volta para /historico. Quando a fila drena, o alerta e o badge simplesmente somem.

## Peças vizinhas que têm prompt próprio

Estas superfícies da mesma área estão sendo desenhadas **separadamente**. Elas aparecem ao redor
no produto real, mas **não são o seu escopo aqui** — represente-as apenas como contexto, sem
redesenhá-las:

`Aba Orçamentos no celular (lista completa, 390px)` · `Registro congelado em tela cheia (celular)` · `Folha "Salvar em Orçamentos" (onde o registro nasce)` · `Folha de exportação PDF/CSV + o botão desabilitado com motivo` · `Banner agregado da fila (5 redações, [Ver], [Entrar de novo], [Sincronizar agora])` · `Bloco "Comparar com hoje" (então vs. hoje)` · `Diálogo de confirmação "Recalcular hoje"` · `Barra de filtros da lista no celular (busca + chips de período + chip ativo)` · `Folha "Período…" (intervalo de datas)` · `Ações do registro travado ([Tentar novamente] / [Descartar] + confirmação)` · `Barra gerenciar: diálogos de renomear rótulo e excluir registro` · `Bloco "Peças do kit" dentro do registro congelado` · `Preços por canal no registro congelado (e seus três estados honestos)` · `Diálogo de sair com registros na fila (+ confirmação destrutiva + falha parcial)` · `Estado "nenhum registro encontrado para {termo}"` · `Avisos de topo: leitura offline, erro de carga com retry inline, Premium pausado` · `Mestre-detalhe do desktop entre 1280 e 1440px` · `Avisos de honestidade sobre o documento repreçado (reaproveitado / modelo aposentado)` · `Porta do plano: "verificando" e "não foi possível verificar seu plano"` · `Momento em que o registro pendente vira sincronizado`

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

# Alerta de estado do registro não sincronizado (Orçamentos → registro aberto)

## O que desenhar
O bloco de aviso que aparece DENTRO de um orçamento salvo (aba **Orçamentos**, registro aberto) quando aquele
registro ainda **não chegou à conta do vendedor**. Ele é a única voz do produto que responde à pergunta mais
cara da tela: "o orçamento que eu acabei de fazer existe de verdade, ou só existe neste celular?". Quem lê é o
vendedor logo depois de salvar — muitas vezes numa feira, sem sinal, com o cliente na frente. São **quatro
estados não sincronizados** (`pendente`, `envio pausado por Premium`, `sessão expirada`, `não foi possível
registrar`) e um quinto que é a ausência da peça (`sincronizado` → nada aparece). Cada estado tem título, corpo,
e até três acessórios empilhados: uma ressalva de durabilidade, um código de suporte, um link de volta e o par
de botões [Tentar novamente] / [Descartar].

## Por que este prompt existe
Nenhuma autoridade de desenho conhece fila de sincronização. O protótipo de 2026-07-02 (§E6/§E9) só desenhou o
banner **offline do shell** (faixa ciano, "Offline — o cálculo continua funcionando"), que fala da **rede**, não
do registro; a matriz §G dá ao Histórico apenas skeleton/gated/falha; `HistoryScreen.jsx` não tem `syncState`;
e o desenho desktop `Abas-Desktop.dc.html` vai direto do card da alegação para o grid de Detalhamento/Canais,
sem alerta nenhum. A única fonte é `ux-history.md` §1.1/§1.2 — **spec textual**, que o próprio §9.1 classifica
como "Highest — the surface the product has never had". Pior: o quarto estado (`Sessão expirada`) nasceu no
hotfix 016/A3, de 2026-08-07, e não existe nem nessa spec. Ou seja: tom, hierarquia e densidade foram inferidos
por IA, e um estado inteiro foi inventado depois de toda autoridade.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/snapshot-detail-page.tsx` (função `SyncAlert`),
`apps/web/src/features/history/entry-actions.tsx`, textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Ordem vertical **atual** do registro aberto, de cima para baixo:

1. Um **badge** solto (pílula) com o mesmo estado — "Pendente neste dispositivo" / "Envio pausado · precisa de
   Premium" / "Envio pausado · sessão expirada" / "Não foi possível registrar";
2. Card da alegação (data/hora, valor cotado, base varejo/atacado, validade);
3. Faixa "Premium pausado — …" (quando o plano está `lapsed`);
4. Ações de gerenciar (renomear/excluir);
5. **→ o alerta desta peça, quinto, muito abaixo da dobra em 390px** — a informação mais urgente da tela chega
   depois do preço, do plano e de dois blocos de ação;
6. Legenda do congelado, detalhamento, canais, ficha técnica, comparar/recalcular/exportar.

Dentro do alerta, hoje, empilhados na mesma coluna: título · corpo (2–4 linhas) · ressalva de durabilidade
(só `pendente`, em texto muted 13px) · "Código de suporte: 422" (só `falhou`) · `<a>` cru vestido de botão
secundário pequeno "Entrar de novo" (só `sessão expirada`) · a dupla [Tentar agora|Tentar novamente] +
[Descartar]. **→ até seis elementos dentro de uma caixa de 358px de largura útil.**

Problemas a resolver no desenho:
- **→ O badge do topo repete o alerta.** Em `falhou`, "Não foi possível registrar" aparece duas vezes,
  idênticas, com 400px entre elas. Decida no desenho quem carrega o estado: o badge, o alerta, ou os dois com
  papéis diferentes (pílula = etiqueta, alerta = explicação).
- **→ Dois alertas info seguidos.** Com Premium pausado, a faixa "Premium pausado — …" e o alerta "Envio
  pausado" (mesma cor, mesmo ícone, mesma causa) ficam a poucos pixels um do outro dizendo quase a mesma coisa.
- **→ Em `pendente` offline o botão [Tentar agora] desaparece** (uma retentativa offline não faria nada), e o
  alerta fica com **[Descartar] como única ação visível** — a única saída oferecida é destrutiva.
- **→ "Entrar de novo" é um link vestido de botão**, misturado na mesma linha visual dos botões reais.
- **→ "Código de suporte: 422"** é o status HTTP cru. Para o vendedor é um número sem significado.
- **→ Nada disso foi desenhado no desktop**: no mestre-detalhe (≥1280px) o registro é a coluna direita,
  `sticky`, com rolagem própria — o alerta pode sair de vista enquanto a coluna rola.

## Conteúdo e dados reais
Textos **literais**, homologados, a usar sem reescrever (a copy é boa; o problema é a forma):

| Estado | Título | Corpo |
|---|---|---|
| `pending` | "Ainda não sincronizado" | "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." |
| `blocked` | "Envio pausado" | "Este registro não foi enviado para a sua conta: o Premium não está ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é enviado automaticamente." |
| `unauthenticated` | "Sessão expirada" | "Este registro não foi enviado para a sua conta: sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo." |
| `failed` | "Não foi possível registrar" | "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você pode tentar de novo ou descartar." |

Acessórios (texto exato): ressalva de durabilidade — "Enquanto não sincroniza, ele existe só aqui — se os dados
do app forem limpos, ele se perde." · "Código de suporte:" + número (ex.: `422`, `500`) · "Entrar de novo" ·
botões "Tentar agora" (só `pendente`), "Tentar novamente" (`pausado`/`sessão`/`falhou`), "Descartar" ·
confirmação de descarte: "Descartar este registro?" / "Ele não foi enviado para a sua conta e não poderá ser
recuperado." com [Voltar] e [Descartar].

Dados do registro ao redor, para popular a prancheta com números verdadeiros: valor cotado **R$ 24,24**
(base varejo) ou **R$ 21,01** (atacado); data/hora "Cotado em 14/08/2026 às 19:32"; um caso adversarial de
rótulo longo — "Kit engrenagens planetárias — cliente Marcenaria São Jorge (2ª remessa)".

## Estados obrigatórios
- **Ausente (`sincronizado`)** — a peça simplesmente não existe; desenhe o registro sem ela, para provar que a
  ausência não deixa buraco no ritmo vertical.
- **`pendente` online** — tom calmo (info), título "Ainda não sincronizado", ressalva de durabilidade em texto
  secundário, [Tentar agora] + [Descartar].
- **`pendente` offline** — mesmo texto, **sem** [Tentar agora]. Precisa de uma saída não destrutiva visível
  (nem que seja só a frase que explica que ele sincroniza sozinho ganhando peso).
- **`envio pausado · Premium`** — info, com a faixa "Premium pausado" possivelmente logo acima: mostre as duas
  juntas numa prancheta e resolva a duplicação.
- **`sessão expirada`** — info, com o caminho de volta "Entrar de novo" e os dois botões.
- **`não foi possível registrar`** — único tom perigo (vermelho), com "Código de suporte: 422".
- **Ações em andamento** — [Tentar agora] com spinner; [Descartar] pressionado; diálogo de confirmação aberto
  por cima.
- **Foco de teclado** em cada botão e no link, e **hover** dos dois botões.

## Viewports
- **390px (obrigatório)** — é onde a peça dói: 358px de largura útil, até seis elementos empilhados, e ela hoje
  nasce abaixo da dobra. Desenhe também a versão de rótulo longo.
- **1280px** — o registro é a coluna direita do mestre-detalhe (lista à esquerda), com rolagem própria e topo
  fixo; a coluna do registro tem folga de ~1.15 de fração. Mostre o alerta no topo dessa coluna.
- **1920px** — lista fixa de 520px e o registro com todo o resto (~1.100px). O risco aqui é o oposto: um alerta
  de duas linhas esticado por 1.100px vira uma faixa de texto longuíssima. Proponha a largura máxima do corpo.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como limite de plano, e vice-versa.** As quatro causas são diferentes e cada
  frase já diz a sua: "conexão"/"online" só podem aparecer em `pendente`. Não unifique tons a ponto de os
  quatro estados ficarem indistinguíveis.
- **Só `falhou` é perigo.** Os outros três são situações normais; pintar `pendente` de vermelho transforma uma
  feira sem sinal em pânico. E o inverso: `falhou` não pode ser discreto.
- **A ressalva de durabilidade é verdadeira e assustadora** ("se os dados do app forem limpos, ele se perde") —
  ela vive só aqui, no detalhe, em tom secundário, nunca no card da lista, nunca em tom de alarme.
- **Descartar é destrutivo e sempre confirmado**; nunca pode ser o botão de maior peso visual do bloco.
- **Frase honesta nunca em placeholder nem truncada** — nenhum dos corpos acima pode ganhar reticências.
- **Alvo ≥44px** para os dois botões e para o link "Entrar de novo".
- **Contraste medido contra o fundo real do alerta** (a caixa é uma superfície tingida, não o fundo da página):
  título, ícone e o texto secundário da ressalva precisam passar em cima do tingido, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: um rótulo longo ou "R$ 1.234,56" ao lado dos dois botões já
  estourou colunas antes; em 390px meça, com caixas, que nada ultrapassa 390.
- **Texto ocluso passa em teste**: um elemento visualmente coberto continua "visível" para o código. A densidade
  desta caixa é justamente onde isso acontece.
- **Botão nascido fora da viewport** (billing, 100,5px de overflow) — a linha de ações é o candidato natural
  a repetir isso quando os dois botões não cabem lado a lado.
- **Sufixo cortado**: em 016 uma frase honesta foi clipada porque morava num elemento estreito. Os corpos aqui
  têm 4 linhas em 390px — reserve a altura.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Os quatro estados em 390px, um por prancheta, dentro do registro real (badge + card da alegação acima) —
   com a proposta de onde o alerta passa a viver na ordem vertical.
2. `pendente` offline e `pausado + faixa Premium pausado` — os dois casos de conflito.
3. A linha de ações em detalhe: repouso / hover / foco / carregando / pressionado, e o diálogo de descarte.
4. Coluna direita em 1280px e em 1920px, com a largura máxima do corpo do alerta resolvida.

Reutilize os primitivos existentes, não crie novos: a caixa é o **`tf-alert`** (tons `info` e `danger`, com
ícone e título já previstos); a pílula do topo é o **`tf-badge`**; os dois botões são **`tf-btn--sm`** nas
variantes `secondary` e `danger`; a ressalva e o código de suporte usam a classe de texto secundário do
Histórico (`tf-historico__meta`, 13px, cor muted); o "Entrar de novo" deve ser um botão de verdade, não um link
maquiado; a confirmação é o **`tf-dialog`**.

## Perguntas em aberto para o dono
1. **Badge e alerta ao mesmo tempo?** Hoje o mesmo estado aparece duas vezes na mesma tela (em `falhou`, com
   texto idêntico). Mantemos os dois com papéis distintos, ou o badge some quando o alerta está presente?
2. **Onde o alerta entra na ordem vertical?** Ele é a informação mais urgente e hoje é o quinto bloco, abaixo da
   dobra em 390px. Sobe para o topo do registro (acima do valor cotado) ou permanece onde está?
3. **"Código de suporte: 422" deve continuar sendo o status HTTP cru?** O vendedor não tem o que fazer com esse
   número, e não há instrução de para onde levá-lo (não há canal de suporte citado na tela).
4. **Em `pendente` offline, qual é a saída não destrutiva?** Sem [Tentar agora], a única ação oferecida é
   [Descartar]. Aceitamos um alerta cuja única ação é destrutiva, ou o botão fica visível e desabilitado com o
   motivo ("Precisa de conexão para enviar", frase que já existe no guarda de sair da conta)?

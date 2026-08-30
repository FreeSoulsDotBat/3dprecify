# Cartão de um canal de venda (marketplace) na aba Calcular

## O que desenhar
O bloco editável de UM canal de venda dentro da seção "Marketplaces" da aba **Calcular**. Cada cartão diz em qual marketplace o vendedor pretende anunciar esta peça e quais taxas se aplicam ali; o preço do anúncio e o líquido saem depois, em outro cartão ("Como chegamos no preço"). Quem usa é o vendedor de peças 3D, no meio do cálculo, normalmente comparando 2 ou 3 canais lado a lado — os cartões empilham verticalmente e um botão **"Adicionar canal"** cria o próximo. É a peça mais densa e mais variável do produto: dependendo do marketplace escolhido no primeiro select, o mesmo cartão vai de ~4 a ~11 blocos de conteúdo.

## Por que este prompt existe
O cartão nunca foi desenhado. A auditoria classificou a autoridade como **NENHUMA** e o verificador confirmou: o protótipo de 2026-07-02 não tem "cartão de canal" — tem dois campos soltos dentro de uma colapsável (§E4); a auditoria do protótipo não cita canais em nenhum dos 16 achados; o `.design-import` (32 primitivos + 6 esqueletos) não tem componente de slot; e o canvas 018 (desktop) não cobre a aba Calcular. Cada bloco do código cita um FR ou um achado de homologação como origem — **nenhum cita desenho**. O que foi inferido por IA: a ORDEM dos onze blocos, o que acontece visualmente quando um canal mostra 3 blocos e o de baixo mostra 11, se um cartão deveria poder recolher/resumir quando há vários, e onde mora o remover — hoje um "✕" cru colado ao lado do select de marketplace.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro de um `Card` (padding md, empilhamento vertical com gap uniforme). Os blocos marcados "condicional" só aparecem para alguns marketplaces:

| # | Bloco | Aparece quando |
|---|---|---|
| 1 | Linha `flex items-end`: select **"Marketplace"** (ocupa a largura) + botão fantasma **"✕"** (aria-label "Remover canal") | sempre |
| 2 | Select **"Modalidade"** (Clássico / Premium / Profissional / Individual) | ML e Amazon |
| 3 | Seletor de categoria: **"Categoria do anúncio (opcional)"**, dica "A comissão muda conforme a categoria.", busca "Busque pelo produto…" | ML e Amazon |
| 4 | Select **"Você vende como"** (placeholder "Selecione" · "Pessoa física (CPF)" / "Pessoa jurídica (CNPJ)") | Shopee |
| 5 | Select **"Mais de 450 pedidos nos últimos 90 dias?"** ("Sim"/"Não") | Shopee **e** só se a resposta 4 for CPF |
| 6 | Grade 1fr 1fr com até 4 campos de taxa (ver abaixo) | sempre, quantidade variável |
| 7 | Legenda: "Tabela por faixa de preço — valores da faixa do seu anúncio." + "Nesta faixa, a taxa fixa é 50% do preço do anúncio — o placeholder mostra o valor já calculado." | tarifa bandada |
| 8 | Legenda de subsídio de frete (texto completo em "Conteúdo") | Shopee com anúncio já calculado |
| 9 | Checkbox de sobretaxa opcional (hoje "Manuseio volumoso", rótulo/valor vindos do catálogo) + legenda longa | Shopee |
| 10 | Linha `flex-wrap` com até 3 selos (Badge): selo de procedência, "estimativa de frete", "Taxa fixa: {fonte} · vigente desde {data}" | quando há resultado |
| 11 | Dois avisos Shopee em caixa (Alert): "A Shopee não publica a fórmula completa desta taxa" (condicional) e "Frete aferido pode gerar cobrança retroativa" (sempre na Shopee) | Shopee |

→ **Problema 1:** o "✕" é um glifo cru, sem área de toque desenhada, colado à direita de um select alto — é a única coisa destrutiva do cartão e a menos desenhada.
→ **Problema 2:** o cartão da Shopee tem ~3× a altura do cartão de "Outro". Não existe regra de desenho para essa variação, e não existe hierarquia interna: campos, legendas, selos e avisos leem todos com o mesmo peso, empilhados no mesmo gap.
→ **Problema 3:** com 3 canais abertos, o vendedor rola muito e perde de vista qual cartão está editando — não há cabeçalho fixo, resumo ou estado recolhido.
→ **Problema 4:** os selos de honestidade (bloco 10) — que são a razão de o número ser confiável — ficam no fim, como o elemento de menor peso visual.

## Conteúdo e dados reais
Os 4 campos de taxa, na ordem canônica fixa (a grade nunca reordena, só filtra):

| Rótulo | Unidade | Exemplo real | Obrigatório? |
|---|---|---|---|
| **Comissão** | % | `15` (marketplaces cobram tipicamente 10–20%) | opcional; sem ela o preço do canal não sai |
| **Taxa fixa** | R$ | `R$ 2,00` (Amazon Individual) | opcional |
| **Comissão mínima/item** | R$ | `R$ 6,50` | opcional |
| **Frete** | R$ | `R$ 12,00` — "Descontado do valor recebido (não é embutido no anúncio)." | opcional |

- Todo campo de taxa é marcado **opcional** e mostra, como *placeholder*, o valor que o catálogo está aplicando de verdade (ex.: `15` em Comissão, `2,00` em Taxa fixa). Placeholder = "não digitado por você"; um valor digitado vira "ajustado por você" no selo.
- Aviso in-loco no campo Comissão (abaixo do rótulo, não é erro): "Confira a comissão: 0,12%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."
- Legenda de frete Shopee (bloco 8), texto integral: "A Shopee oferece cupons de frete grátis (até R$ 20,00 nesta faixa de preço) — o custo é da Shopee, não seu. Informe no campo Frete só o que sobrar para você, se houver." seguida de "Fonte: Central do Vendedor Shopee, vigente desde 12/06/2026."
- Legenda da sobretaxa (bloco 9): "R$ 50,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido)." → é longa de propósito e **não pode ser truncada**.
- Selos possíveis (bloco 10): "Referência · atualizada em 06/08/2026", "referência embutida (offline)", "pode estar desatualizada", "ajustado por você", "sem referência — informe as taxas", "categoria não informada — usando a maior alíquota da tabela", "estimativa de frete", "Taxa fixa: venda.amazon.com.br/precos · vigente desde 01/07/2026".
- Contexto numérico da tela: a semente calcula custo R$ 16,16, varejo R$ 24,24 e atacado R$ 21,01 — os valores de anúncio ficam nessa ordem de grandeza, mas a Comissão mínima e o Frete podem chegar a `R$ 1.234,56` numa peça grande (máscara de milhar aplicada no blur).

## Estados obrigatórios
- **Repouso** — o cartão de "Outro" (4 campos, nada mais) e o cartão da Shopee (tudo). Desenhe **os dois**, lado a lado, para que a regra de variação fique explícita.
- **Foco / hover / pressionado** nos selects, campos, checkbox e no "✕".
- **Campo com aviso** (não é erro): o aviso de comissão acima, em tom de atenção, com o campo ainda editável.
- **Erro de campo**: mensagem por campo + a linha de seção "Corrija os campos deste canal para ver os preços."
- **Sem comissão**: "Informe a comissão do canal para ver os preços."
- **Faixa sem tarifa publicada**: "Sem tarifa publicada para a faixa de preço deste anúncio — informe a comissão do canal para precificar."
- **Degradado / offline**: selo "referência embutida (offline)" e selo "pode estar desatualizada" — o cálculo continua funcionando.
- **Falha de atualização do catálogo** (fora do cartão, acima da pilha): Alert tom informativo "Não foi possível atualizar as taxas" / "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." + botão "Tentar novamente" (com estado carregando).
- **Sem permissão (grátis)**: a seção inteira colapsa para o switch "Incluir marketplaces no preço" **desabilitado** + a frase "Vender em marketplaces faz parte do Premium." + o CTA de assinatura centrado. Nenhum cartão, nenhum número parcial.
- **Único cartão** vs **N cartões**: mostre a pilha com 3 (ML, Shopee, Outro) e o botão "Adicionar canal".

## Viewports
- **Mobile 390px** — é onde a peça dói: a grade 1fr 1fr deixa ~150px por campo, e legendas de 3 linhas empilham. Obrigatório.
- **Desktop 1280px** — a Calcular tem layout desktop e o canvas 018 **não** cobriu esta aba; a pilha de cartões hoje herda a largura da coluna do formulário sem regra própria. Obrigatório.
- **1920px** — só se a sua proposta mudar a densidade (ex.: dois cartões por linha); caso contrário, diga explicitamente que 1280 escala.

## Regras que o desenho não pode quebrar
- **Freemium é binário**: sem assinatura não existe cartão nem número parcial de canal — existe a frase e o CTA. Nunca um cartão desabilitado com números embaçados.
- **Procedência sempre visível**: todo número pré-preenchido carrega selo dizendo de onde veio e quão fresco é. Se o selo não couber, o número não pode aparecer.
- **Degradação dita, não escondida**: offline e "pode estar desatualizada" são texto legível, não uma cor mais apagada.
- **Falha de rede nunca é falta de premium**: a falha de atualização usa tom informativo com retry, jamais um muro de erro nem o discurso de assinatura.
- **Frase honesta nunca vive em placeholder**: já custou um defeito — a regra "a taxa fixa é 50% do preço" foi tirada do sufixo do placeholder (cortava em "2,50 (= 50") e mora em legenda de largura total. Mantenha assim.
- **Placeholder ≠ valor**: o campo pré-preenchido mostra o valor do catálogo como placeholder porque um valor real faria o vendedor achar que ele mesmo vouchou por aquilo.
- **Alvo ≥44px** para o "✕", o checkbox e cada select.
- **Contraste medido** de legendas e selos contra o fundo real do `Card` — não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: 100,5px de estouro com botão nascendo fora da viewport já aconteceu nesta base; a grade 1fr 1fr com rótulo "Comissão mínima/item" a 390px é candidata direta.
- **Valor grande estoura a coluna**: teste o desenho com `R$ 1.234,56` em Comissão mínima e Frete ao mesmo tempo.
- **Texto ocluso passa em teste**: um elemento sobreposto ou cortado continua "visível" para asserção de texto — desenhe as caixas, não só o texto.
- **Placeholder que corta a frase**: 77–187px úteis num campo de taxa não comportam nenhuma explicação.
- **Legenda longa**: as legendas de sobretaxa e de subsídio de frete têm 2–4 linhas de verdade; se o desenho as tratar como uma linha, ele está desenhando outra coisa.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Cartão mínimo ("Outro": marketplace + 4 taxas + selo) — 390px e 1280px.
2. Cartão máximo (Shopee: os 11 blocos, com o CPF+450 pedidos respondido, sobretaxa marcada e os dois avisos) — 390px e 1280px.
3. Pilha de 3 canais + "Adicionar canal", mostrando como cartões de alturas muito diferentes convivem e como o vendedor sabe onde está.
4. Sua proposta para o **remover** e para um eventual **estado resumido/recolhido** de cartão (se você propuser um, desenhe recolhido e expandido).
5. Tira de estados: foco, aviso de comissão, erro, offline/degradado, falha de atualização com retry, e a faixa Premium sem permissão.

Reutilize os primitivos `tf-*` existentes, sem criar novos: `tf-card` para o cartão, `tf-field` + `tf-select` para marketplace/modalidade/perfil, `tf-field` + `tf-input` (numérico, prefixo R$ / sufixo %) para as taxas, `tf-checkbox` para a sobretaxa, `tf-badge` para os selos, `tf-alert` (tom info) para os avisos Shopee e para a falha de atualização, `tf-button` variantes ghost (remover) e secondary ("Adicionar canal" / "Tentar novamente"), `tf-switch` para "Incluir marketplaces no preço".

## Perguntas em aberto para o dono
1. **Um cartão de canal pode ser recolhido?** Com 3+ canais a pilha fica longa. Se puder, o que o cabeçalho recolhido mostra — só o nome do marketplace, ou nome + comissão aplicada + preço do anúncio? (Preço vem de outro cartão hoje; trazê-lo para o cabeçalho é decisão de produto.)
2. **Remover um canal pede confirmação?** Hoje o "✕" apaga direto, sem desfazer, e junto vão categoria, perfil e taxas digitadas.
3. **Os dois avisos da Shopee ficam sempre abertos?** O "Frete aferido" é estático e aparece em todo cartão Shopee — em três cartões Shopee ele se repete três vezes. Ele deve subir para o nível da seção, virar um ⓘ recolhido, ou continuar por cartão?
4. **Existe limite de canais?** O botão "Adicionar canal" não tem teto declarado; o desenho de 8 cartões empilhados é um cenário real ou não?

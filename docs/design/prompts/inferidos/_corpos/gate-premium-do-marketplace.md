# Gate Premium da seção "Marketplace" na Calcular grátis

## O que desenhar
O bloco que ocupa o lugar da seção **Marketplace** na tela **Calcular** quando a conta NÃO é Premium ativa — e, junto com ele, a montagem da página inteira nesse estado. Quem vê isso é o vendedor que acabou de calcular custo e markup de uma peça (o cálculo básico continua grátis) e chegou na parte que grosseia o preço para Mercado Livre / Shopee / Amazon. Ele vê o título da seção, uma chave desligada e travada, uma frase e um "Assinar Premium". No desktop esse bloco não fica na coluna onde a seção Marketplace mora para o assinante: ele atravessa a grade inteira, e o bloco "Outros custos" muda de coluna para tapar o buraco. São duas montagens diferentes da mesma tela, decididas pelo plano — e nenhuma das duas foi desenhada.

## Por que este prompt existe
Tudo aqui foi inferido em código: manter a chave visível-porém-morta em vez de trocar a seção por um teaser, centralizar o texto, e sobretudo **recompor o layout desktop em função do plano**. Autoridade é `PROTOTIPO_PARCIAL`: existe precedente desenhado para gate INLINE dentro da Calcular, e ele diz o CONTRÁRIO do que o código faz — o `-fixes.md` item 1 manda, para o card "Do catálogo", *substituir o bloco por um teaser compacto* ("Preencha direto do seu catálogo — recurso Premium" + link "Ver Premium"), e o audit V2 registra isso FIXED e renderizado. O canvas 018 desenha o teaser Premium completo (ícone + título + subtítulo + preço + CTA lg + legenda) para Catálogo/Kits/Orçamentos/Conta; a Calcular não usa essa forma. **Nenhuma autoridade de desenho trata mudança de layout desktop por entitlement.** Foi exatamente aqui que a homologação mediu **1.671px de buraco** a 1440px e o CTA órfão a **~950px** da legenda que o motiva.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/calcular/calcular-page.tsx`, `features/calculator/calculator-form.tsx` (`MarketplaceSection`), `calculator-form.css`, textos em `shared/i18n/messages.pt-br.ts`.

Ordem atual do bloco, de cima para baixo (todos os textos são literais do produto):

| # | Elemento | Conteúdo real hoje |
|---|---|---|
| 1 | Título de seção + ⓘ | "Marketplace" (mesmo `sectionLabel` das outras seções) + InfoTip "Sobre o marketplace" → "Calcula o preço para anunciar em um marketplace de modo que, após a comissão e a taxa fixa, você receba o preço-base. Anúncio = (preço + taxa fixa) ÷ (1 − comissão%). Recebido líquido = o que sobra após a comissão sobre o anúncio e a taxa fixa." |
| 2 | Linha de chave, largura total | rótulo à esquerda "Incluir marketplaces no preço", Switch à direita — **sempre `checked=false` e `disabled`** |
| 3 | Legenda | "Vender em marketplaces faz parte do Premium." — centralizada |
| 4 | Faixa de upgrade (`TeaserUpgrade align="center"`) | linha de preço "Premium: R$ 15,99/mês · no plano anual, equivalente a R$ 12,99/mês" + botão primário "Assinar Premium"; a faixa tem borda superior de 1px e centraliza tudo |

→ Problema 1: **a chave morta.** Um controle visível, desligado e travado é a única coisa acionável do bloco e ela não faz nada. O padrão já desenhado para gate inline nesta mesma tela é substituir o bloco por um teaser compacto.
→ Problema 2: **o bloco não é um Card.** Todas as outras seções da Calcular ("Custos da peça", "Mão de obra e custos", "Markup") são `tf-card`; o gate é texto solto sobre o fundo da página, e a 1120px de largura ele vira uma faixa fina e perdida.
→ Problema 3: **a recomposição por plano.** Grátis: coluna esquerda = Custos da peça + Mão de obra; coluna direita = Markup + **Outros custos**; e o gate atravessando as duas colunas embaixo. Premium: Outros custos volta para a **esquerda** e Marketplace ocupa a direita. Ou seja, no segundo em que o vendedor assina, "Outros custos" salta de coluna. Ninguém desenhou essa transição.
→ Problema 4: **o gate não distingue quem nunca foi Premium de quem VENCEU.** `lapsed` e `none` recebem a mesma frase.

## Conteúdo e dados reais
- Preços verdadeiros e únicos (vêm de `messages.billing`, fonte única): mensal **R$ 15,99/mês**; anual **R$ 155,88/ano**, exibido como **"equivalente a R$ 12,99/mês"**. Nunca existe "de/por" nem preço riscado — o desconto ~19% é o delta real, e fabricar um riscado seria mentira.
- Destino do "Assinar Premium": a OFERTA (a folha de planos dentro de `/conta`), nunca um checkout direto — mensal e anual têm preços diferentes e escolher por ele seria decidir no lugar dele. Deslogado, o caminho passa por entrar antes, preservando a intenção.
- Nenhum número de canal é exibido neste estado: sem comissão, sem taxa fixa, sem anúncio, sem líquido. Zero parcial, zero fake.
- Contexto numérico da tela em volta, para as pranchetas ficarem críveis (valores de semente do produto): custo total **R$ 16,16**, preço varejo **R$ 24,24**, preço atacado **R$ 21,01**.
- Logo acima, no topo da tela, o vendedor grátis já viu outro teaser — "Preencha o cálculo com um toque" / "O cálculo de custo e markup continua grátis." Os dois convivem na MESMA página: o desenho precisa evitar que a Calcular vire uma vitrine com dois pedidos de assinatura empilhados.

## Estados obrigatórios
1. **Grátis, nunca assinou** (`status = none`) — o estado padrão descrito acima.
2. **Premium vencido** (`status = lapsed`) — hoje idêntico ao anterior; o desenho precisa decidir se diz "seu Premium venceu" (ver Perguntas em aberto).
3. **Deslogado** — mesmo bloco; o botão leva a entrar antes de assinar. O desenho deve deixar claro que existe um passo a mais.
4. **Consultando o plano** (primeira leitura em voo, sem resposta guardada) — hoje cai no gate por segurança (nunca se supõe premium). Precisa de um repouso que não pareça uma negativa definitiva.
5. **Sem resposta do servidor / offline** — mesmo tratamento: cai no gate. **Regra dura:** falha de rede NUNCA pode ser vendida como "você não é Premium". Se o desenho não distingue, precisa ao menos de uma linha que não acuse o vendedor.
6. **Resposta lembrada do dispositivo** (`stale`) — o app está servindo a última palavra conhecida do servidor, não uma fresca. Nas outras superfícies isso é dito; aqui não é.
7. **Premium ativo** — o gate NÃO existe: a seção Marketplace real ocupa a coluna direita. Desenhar uma prancheta desse estado só para mostrar o antes/depois da montagem.
8. Estados de interação do CTA: repouso, hover, foco visível, pressionado. O Switch travado precisa de um desabilitado que leia como "bloqueado", não como "quebrado".

## Viewports
- **390px (mobile)** — obrigatório: é a coluna única, o gate aparece na mesma posição de sempre e o único risco é a faixa de preço + botão não caberem lado a lado (ela já quebra em duas linhas por desenho).
- **1280px** — o corte de desktop declarado no 018; é aqui que a grade de duas colunas e a faixa de largura total precisam ser resolvidas.
- **1920px** — a largura em que o dono redesenhou o produto; mostrar que a faixa não vira um filete de 1120px com um botão sozinho no meio de muito vazio.
- Registrar (não precisa prancheta): hoje a grade de duas colunas liga a partir de **1024px**, antes do corte de 1280px do 018 — entre 1024 e 1279 já existe a montagem de duas colunas.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** ou o recurso é seu, ou é do Premium — nunca um meio-termo com números parciais na tela.
- **Nada de preço inventado:** os únicos valores de assinatura que podem aparecer são R$ 15,99/mês e o equivalente mensal de R$ 12,99 do anual.
- **Frase honesta nunca vive dentro de placeholder** nem de campo estreito: "Vender em marketplaces faz parte do Premium." (ou o que a substituir) precisa de um elemento de largura própria.
- **Falha de rede não é falta de plano** — nenhum estado de erro pode ser rotulado como "recurso Premium".
- **Degradação dita, não escondida:** se o plano vem de memória do dispositivo, isso se diz.
- Alvo de toque ≥ 44px no CTA e no Switch (mesmo travado, ele recebe foco de leitor de tela).
- Contraste medido contra o fundo real da Calcular, nos dois temas — o gate não tem Card hoje, então o texto assenta direto no fundo da página.
- O texto e o CTA precisam ler como **uma unidade**: a métrica que motivou o `align="center"` foi um botão órfão a ~950px da frase que o justifica; qualquer alternativa proposta tem de manter essa proximidade explícita.

## Armadilhas já pagas neste projeto
- **O buraco de 1.671px** (medido a 1440px): o gate tem ~205px de altura e ficava confinado numa coluna de 850px ao lado de uma coluna de 2.521px. Qualquer desenho que devolva o gate para uma coluna curta reabre esse buraco — se propuser isso, mostre com o que a outra coluna é preenchida.
- **CTA órfão** — já custou 149,6px de deslocamento numa peça e ~950px nesta; o botão nunca fica sozinho na ponta de uma faixa larga.
- **Overflow horizontal** — a faixa de preço + botão já estourou 100,5px numa homologação, com botão nascendo fora da viewport. Ela quebra em duas linhas a 390px por desenho: mantenha isso.
- **Texto ocluso passa em teste** — assertions de texto não enxergam colisão de layout; o desenho precisa mostrar as caixas, não só as frases.
- **Valor grande estoura a coluna** — a Calcular já pagou por dígitos que empurram a página; a faixa de preço da assinatura é fixa, mas o bloco vizinho ("Outros custos", que muda de coluna neste estado) carrega dinheiro digitado pelo usuário.

## Entregável
Pranchetas, tema escuro como padrão e tema claro como cidadão de primeira classe:
1. **390px — gate em repouso**, na página inteira (do teaser do topo até os cards de preço), para provar que os dois pedidos de assinatura convivem.
2. **1280px — montagem grátis completa**, mostrando as duas colunas + a faixa do gate, com as alturas reais das colunas indicadas.
3. **1280px — montagem Premium** ao lado, para tornar visível o salto de "Outros custos" entre colunas (e propor como suavizá-lo, ou como evitá-lo).
4. **1920px — gate em repouso**, resolvendo o vazio lateral.
5. **Prancheta de estados**: consultando, sem resposta/offline, resposta lembrada, Premium vencido, e os estados do CTA (repouso/hover/foco/pressionado) + o Switch travado (se ele sobreviver ao desenho).

Reutilize os primitivos existentes, sem criar novos: `tf-card` para dar corpo ao bloco (hoje ele não tem), o título de seção com o ⓘ (`InfoTip`) exatamente como nas demais seções, `tf-switch` para a chave, `tf-btn tf-btn--primary` para "Assinar Premium", a legenda no estilo de caption já usado nas seções, e — se a proposta for adotar a forma do canvas 018 — o `tf-premium-teaser` (título / subtítulo / faixa de preço / CTA / legenda), que já existe e já é usado nas outras quatro abas. Se o desenho substituir o bloco pelo teaser, deixe explícito o que acontece com o rótulo "Incluir marketplaces no preço", que hoje é o único nome do recurso na tela.

## Perguntas em aberto para o dono
1. **A chave morta fica ou sai?** O padrão desenhado para gate inline nesta tela ("Do catálogo") manda substituir o bloco por um teaser compacto; o código manteve o Switch visível e travado. Vale a mesma regra aqui?
2. **Premium vencido merece frase própria?** Hoje quem já pagou e venceu lê a mesma frase de quem nunca assinou ("Vender em marketplaces faz parte do Premium.") — a alternativa seria reconhecer o vencimento e oferecer a renovação.
3. **"Outros custos" deve mesmo trocar de coluna conforme o plano?** É a decisão que cria duas montagens da mesma tela; a alternativa é uma ordem única em que só o conteúdo do slot de Marketplace muda.
4. **Dois pedidos de assinatura na mesma tela** (o teaser "Preencha o cálculo com um toque" no topo e este gate embaixo) — mantém os dois, funde num só, ou um deles vira apenas um link discreto?

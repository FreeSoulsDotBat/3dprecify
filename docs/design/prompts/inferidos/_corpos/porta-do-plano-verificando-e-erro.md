# Porta do plano em Orçamentos: "verificando" e "não foi possível verificar seu plano"

## O que desenhar

Os dois estados de guarda que rodam **antes** de a aba Orçamentos existir. Quando o vendedor toca em
Orçamentos, a tela não abre direto: o app primeiro precisa saber quem ele é (sessão) e se o Premium
está ativo (plano). Enquanto a resposta não chega, ele vê um estado de espera; se ela não vier nunca
— rede ruim, servidor fora, primeiro acesso offline sem plano guardado no aparelho — ele vê um estado
de falha com um botão de tentar de novo. É a **primeira coisa** que um assinante vê ao abrir a aba em
condição ruim. Depois dessa porta vêm três destinos: a lista de orçamentos, o convite Premium honesto
(conta nunca-Premium) ou a lista em modo "Premium pausado". Origem no código:
`apps/web/src/pages/historico/historico-page.tsx` (`GateChecking`, `GateError`, `GateShell`).

## Por que este prompt existe

Nenhuma autoridade de desenho cobre estes dois estados: eles foram inferidos por IA a partir do
achado C5 de uma revisão de PR, e o próprio comentário no código registra isso. O protótipo de
2026-07-02 **contradiz** o que foi construído — ele desenhou, mediu e verificou um carregamento em
**esqueleto com shimmer** (reduced-motion respeitado, contraste corrigido no escuro), e sobre **a
lista**, não sobre o plano; o app entregou um spinner mudo. Já a falha de **consulta ao plano** não
existe em autoridade nenhuma: os dois artefatos de referência alternam Premium/não-Premium sem
qualquer estado intermediário. O intermediário é o que falta desenhar.

## O que já existe hoje (não invente do zero — corrija)

Os dois estados vivem dentro da mesma moldura (`GateShell`): título de página **"Orçamentos"** e, sob
ele, o conteúdo da guarda. Nada mais.

| Estado | Quando dispara (código real) | O que aparece hoje |
|---|---|---|
| Verificando | `sessionStatus === "loading"` **ou** entitlement na primeira leitura sem nada em cache | Título "Orçamentos" + um `Spinner` centralizado com `py-8`. **Zero palavras na tela.** |
| Não verificou | Consulta encerrada, sem resposta e sem plano guardado no aparelho (offline / servidor fora) | Título "Orçamentos" + `Alert tone="danger"` com "Não foi possível verificar seu plano." + botão secundário "Tentar novamente", tudo centralizado |

Textos literais de hoje (não reinvente; cite estes):

- Título da página: **"Orçamentos"**
- Erro: **"Não foi possível verificar seu plano."**
- Botão: **"Tentar novamente"**
- O spinner só tem rótulo para leitor de tela: **"Carregando…"** (genérico do primitivo, invisível)

→ **Problema 1 — o carregamento é mudo.** A aba Kits, com a guarda gêmea, mostra spinner **+ a frase
"Verificando seu plano…"** (`bom-page.tsx`). Orçamentos não tem sequer essa chave de texto. O mesmo
momento do produto fala em uma tela e cala na outra.

→ **Problema 2 — o tom diverge da família.** Kits usa `Alert tone="info"` para exatamente a mesma
frase; Orçamentos usa `tone="danger"` (vermelho, `role="alert"`, anúncio assertivo) ocupando a página
inteira. Falhou uma **consulta**, não o Premium — e vermelho de página inteira lê como "sua assinatura
caiu".

→ **Problema 3 — a legenda da aba some.** A linha "O que você cotou, com a data. Os valores ficam
congelados como estavam no dia." aparece na lista, mas **não** na guarda: sobra um título solto.

→ **Problema 4 — no desktop é um oceano.** A guarda roda **antes** do corte de 1280px, então o mesmo
bloquinho centralizado cai numa página que vai até 1720px de largura. A 1920px é um spinner de 24px
no meio de uma tela vazia.

→ **Problema 5 — "Tentar novamente" não dá retorno.** O clique dispara nova consulta, mas o botão não
tem estado de "tentando": nada muda na tela. Em rede ruim o vendedor clica três vezes achando que não
pegou.

→ **Problema 6 — um spinner, duas perguntas.** "Vendo quem é você" e "vendo seu plano" viram o mesmo
pixel; pode ser a decisão certa, mas foi tomada por omissão.

## Conteúdo e dados reais

- Não há campo, número nem dinheiro nesta peça: ela é anterior a qualquer dado. Nada de `R$`, nada de
  data — inventar um valor aqui seria inventar um orçamento. Nem nome de conta, e-mail, plano,
  expiração ou valor de assinatura.
- O que a lista mostraria **depois** (e que um esqueleto imitaria, se for esse o caminho): por card,
  nesta ordem — rótulo ("Suporte de fone — Cliente Ana"), a data **acima** do dinheiro ("Cotado em
  12/08/2026 · Peça única"), a linha "Valor cotado" com **R$ 24,24** e, sob ela, "preço de varejo". A
  data vir antes do dinheiro é regra estrutural e vale para o esqueleto também: um retângulo grande
  no topo, imitando um preço, seria uma promessa errada.
- Conta **Premium pausada** nunca chega nestes dois estados: ela vai direto para a lista, com faixa
  própria. Não desenhe "pausado" aqui.

## Estados obrigatórios

1. **Verificando (repouso).** O que o app está fazendo, dito em palavras. A frase da família já
   existe e deve ser reaproveitada literalmente: **"Verificando seu plano…"** Nunca a palavra
   "Premium" isolada, nunca "Gratuito" — o plano ainda é desconhecido.
2. **Verificando > 3 s.** Uma segunda leitura calma para rede ruim (não invente a frase: veja
   Perguntas em aberto). Precisa existir visualmente, mesmo que a copy fique com o dono.
3. **Não foi possível verificar (repouso).** A frase exata **"Não foi possível verificar seu plano."**
   + botão **"Tentar novamente"**. Precisa ler como "a consulta falhou", não como "você perdeu o
   Premium".
4. **Botão "Tentar novamente":** repouso, hover, foco visível pelo teclado, pressionado, e **tentando**
   (a nova consulta em curso — hoje inexistente e necessário).
5. **Offline declarado.** O app sabe se está sem conexão e já tem vocabulário próprio para isso em
   outras faixas desta mesma aba ("Modo leitura offline"). Desenhe a variante em que a causa provável
   é ausência de rede, com tom calmo — sem prometer que os registros aparecerão, porque nesse ponto
   nada foi carregado.
6. **Movimento reduzido.** Toda animação (giro do spinner ou shimmer de esqueleto) precisa de uma
   versão estática equivalente — o protótipo de 2026-07-02 já pagou esse item.

Não desenhe aqui: vazio (é da lista), degradado, Premium pausado, sem permissão — nenhum é alcançável
por esta peça.

## Viewports

- **390px (mobile)** — obrigatório: é o caminho principal e o cenário em que a rede ruim acontece de
  verdade.
- **1280px (desktop, início do corte)** — obrigatório: é onde a página passa a valer a largura toda e
  o bloco centralizado fica órfão.
- **1920px** — obrigatório para esta peça, e é o pior caso: a página chega a 1720px de largura e o
  conteúdo da guarda é um spinner. Mostre o que preenche (ou o que limita) essa largura.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como "não é Premium".** É a razão de a peça existir. Nenhum convite
  para assinar, nenhum preço, nenhum botão de compra nestes dois estados.
- **Nada afirma o plano antes de saber.** Nem "Gratuito", nem "Premium", nem selo, nem badge.
- **A frase honesta mora em elemento de largura cheia**, nunca em placeholder e nunca cortada por
  reticências — armadilha já paga neste projeto.
- **Vermelho é para o que o vendedor perdeu**, não para o que o app não conseguiu perguntar. Se o
  desenho mantiver `danger`, precisa justificar; a família (Kits) usa `info`.
- **Alvo de toque ≥ 44px** no "Tentar novamente", com folga em 390px.
- **Contraste medido contra o fundo real** de cada tema — o esqueleto do protótipo só passou depois
  de ser corrigido para ficar visível no escuro (1,79:1 registrado).
- **Uma voz por fato.** Se a guarda já diz que não conseguiu verificar, não empilhe uma segunda
  mensagem dizendo o mesmo com outras palavras.

## Armadilhas já pagas neste projeto

- **Esqueleto quase invisível no tema escuro** — pego em auditoria (PARTIAL em V2, corrigido em V3).
  Se houver esqueleto, ele precisa de contraste medido no escuro **e** de um modo de demonstração,
  senão ninguém consegue verificar.
- **Tela larga preenchida por bloco estreito** — o 016 mediu 39% de uso da largura em telas iguais a
  esta e o 018 nasceu disso. Um spinner sozinho em 1720px repete o defeito.
- **Overflow horizontal medido**, nos dois eixos: uma frase longa centralizada em 390px estoura com
  facilidade, e o teste automatizado não vê barra de rolagem clássica. Texto fora da tela passa em
  asserção — posicione tudo dentro da dobra em 390px.
- **Anúncio para leitor de tela ≠ texto na tela.** O rótulo invisível "Carregando…" existe hoje e não
  ajuda ninguém que enxerga. Os dois precisam dizer a mesma coisa.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como cidadão de primeira classe** (o mesmo conjunto
nos dois):

1. Verificando — 390px, 1280px, 1920px.
2. Verificando prolongado (> 3 s) — 390px e 1920px.
3. Não foi possível verificar — 390px, 1280px, 1920px.
4. Variante offline do estado 3 — 390px.
5. Estados do botão "Tentar novamente" (repouso · hover · foco · pressionado · tentando) — detalhe
   ampliado.
6. Versão sem movimento (estático) do estado de carregamento escolhido.

Reutilize os primitivos existentes, não crie família nova: o título vem do cabeçalho de página; a
mensagem de falha é o `Alert` (com o tom que o desenho decidir, dentro dos existentes); o botão é o
`Button` secundário; a espera é o `Spinner`, com rótulo **visível** ao lado. **Uma exceção
declarada:** se o desenho escolher esqueleto de lista, ele é um primitivo **novo** — não existe nada
equivalente hoje no design system — e precisa vir especificado (tamanhos, raio, contraste nos dois
temas, versão sem movimento), não como enfeite de uma tela só.

## Perguntas em aberto para o dono

1. **Esqueleto ou spinner com frase?** O protótipo desenhou esqueleto para a lista; aqui o que carrega
   é o **plano**, e o resultado pode ser "você não é Premium" — nesse caso o esqueleto teria desenhado
   uma lista que nunca vai existir. Vale a pena, ou a espera de plano é spinner + frase e o esqueleto
   fica reservado para o carregamento da lista?
2. **Tom da falha de consulta: `info` (como Kits) ou `danger` (como Orçamentos hoje)?** É a mesma
   frase, o mesmo evento e duas telas discordando. Precisa de uma resposta única para a família toda
   (Orçamentos, Kits, Catálogo, Simulações).
3. **A falha deve distinguir "você está offline" de "o servidor não respondeu"?** O app sabe a
   diferença e já usa vocabulário próprio para offline nesta mesma aba. Distinguir é mais honesto e
   custa uma segunda copy.
4. **Qual a frase da espera prolongada?** Depois de alguns segundos, o vendedor merece uma segunda
   leitura — e ela não existe em lugar nenhum do produto hoje.

# Interruptor (Switch) — a trilha, o polegar e o alvo que ninguém enxerga

## O que desenhar
O interruptor liga/desliga do Precifica3D: uma trilha em pílula com um polegar que desliza, sempre
rotulado por um texto que vive FORA dele (o componente não escreve nada por conta própria). Ele
aparece em quatro momentos reais da jornada do vendedor: na **Conta**, na linha "Tema" (só abaixo de
1280px — acima disso o tema vira um controle segmentado "Claro / Escuro"); em **Calcular**, no
interruptor-mestre "Incluir marketplaces no preço" (desabilitado para quem não é Premium); em
**Calcular**, em cada sobretaxa opcional de canal; e na folha de **exportação do Histórico**, em
"Incluir detalhamento de custos" (só quando o formato é PDF). É a mesma peça de 44×24 nos quatro —
o que muda é o que está escrito ao lado dela e o que acontece quando ela está desligada.

## Por que este prompt existe
As duas metades do tema já estão desenhadas (o interruptor no protótipo antigo, as pílulas
Claro/Escuro no canvas 018 do dono), e elas são mutuamente exclusivas por largura — isso não é
defeito. O que nunca foi desenhado é a **MEDIDA**: a auditoria de acessibilidade item 11 mediu
"switch 28", a V3 mediu "46×44", e o app terminou com raiz de 44×44 e trilha visível de 44×24. Ou
seja, o alvo de toque é maior que a peça que o vendedor enxerga — e essa relação, que é a decisão
visual mais importante do componente, saiu de uma planilha de auditoria, não de um desenho. O §E7
do documento de referência só diz "toggle de tema (Dark↔Light)".

## O que já existe hoje (não invente do zero — corrija)
Lido de `apps/web/src/shared/ui/switch.{tsx,css}` e dos quatro pontos de uso.

| Parte | Medida/valor real hoje |
| --- | --- |
| Raiz (alvo) | `min-width` e `min-height` = 44px, fundo transparente, sem borda, `cursor: pointer` |
| Trilha visível | 44 × 24px, raio pílula (999px), centrada dentro da raiz |
| Trilha desligada | cor de borda padrão (cinza neutro 300 no claro) |
| Trilha ligada | roxo de destaque (`--accent`) |
| Polegar | 20 × 20px, círculo BRANCO em ambos os temas, sombra pequena, a 2px do topo e da esquerda |
| Deslocamento ao ligar | 20px para a direita, 130ms, ease-out (anulado em "reduzir movimento") |
| Foco | o anel de foco vai na TRILHA, não na raiz; a raiz não tem contorno |
| Desabilitado | opacidade 0,55 sobre o estado atual + `cursor: not-allowed` |

→ **O alvo extra só existe no eixo vertical.** A raiz tem 44px de largura e a trilha também tem
44px: horizontalmente o alvo é exatamente a peça; a folga de 10px acima e 10px abaixo é a única
área "escondida". O desenho precisa decidir e mostrar isso — inclusive o espaçamento mínimo entre
dois interruptores empilhados (a lista de sobretaxas empilha vários), para que as folgas invisíveis
não encostem umas nas outras.
→ **Não existe hover.** Nenhuma regra de `:hover` no CSS. No desktop (onde três dos quatro
interruptores continuam existindo) o ponteiro passa por cima e nada acontece.
→ **Não existe pressionado.** Entre o clique e a transição de 130ms não há resposta imediata.
→ **No tema claro, desligado, o polegar branco fica sobre uma trilha cinza-clara** e só a sombra
pequena os separa. É o pior contraste da peça e precisa ser resolvido no desenho, medido contra o
fundo real (o cartão branco da Conta), não contra um cinza imaginado.
→ **O rótulo clicável é inconsistente**: na lista de sobretaxas o texto está dentro de um `label`,
então clicar na frase alterna; na Conta e na exportação o rótulo só aponta por `aria-labelledby`, e
clicar no texto não faz nada.

## Conteúdo e dados reais
Textos literais pt-BR que ficam ao lado do interruptor (não reescreva — são copy homologada):

- Conta: rótulo **"Tema"**; no desktop, as duas pílulas **"Claro"** e **"Escuro"** com ícones de sol
  e lua. Ligado = escuro (o padrão da v1).
- Calcular, mestre: **"Incluir marketplaces no preço"**; quando a conta não é Premium o interruptor
  é desabilitado e FALSO, e abaixo aparece **"Vender em marketplaces faz parte do Premium."** com o
  botão de assinar centrado.
- Calcular, sobretaxa: rótulo do próprio custo ao lado, e abaixo, em legenda, o texto real
  **"R$ 2,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque
  a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do
  pedido)."** seguido de **"Fonte: Amazon, vigente desde 06/08/2026."**
- Exportação (só PDF): rótulo **"Incluir detalhamento de custos"** e, imediatamente abaixo, o aviso
  **"Seu cliente veria as linhas gravadas — material, energia, máquina, falhas, acabamento, mão de
  obra e os seus outros custos — e poderia calcular a sua margem."** (na versão de kit:
  **"Seu cliente veria o custo total gravado do kit — e poderia calcular a sua margem."**).

O interruptor em si não tem dado, unidade nem faixa: é binário. Tudo o que ele carrega de número
está nas legendas acima — que podem ser longas (a da sobretaxa passa de 200 caracteres) e precisam
de linha inteira, nunca de uma coluna espremida ao lado da peça.

## Estados obrigatórios
1. **Desligado em repouso** — trilha cinza, polegar à esquerda.
2. **Ligado em repouso** — trilha roxa, polegar à direita.
3. **Foco por teclado** — anel na trilha, nos dois estados; mostre que ele não corta contra o
   cartão nem contra a lateral da tela a 390px.
4. **Hover** (a desenhar: hoje não existe) — nos dois estados, desktop.
5. **Pressionado** (a desenhar: hoje não existe) — a resposta antes dos 130ms.
6. **Desabilitado desligado** — opacidade 0,55; é o estado REAL do "Incluir marketplaces no preço"
   para conta gratuita, e é o único desabilitado que o produto usa hoje.
7. **Movimento reduzido** — o polegar salta sem transição; nada mais muda.
8. **Alvo de toque** — uma prancheta com o retângulo de 44×44 revelado em pontilhado sobre a peça,
   em duas linhas empilhadas, para ver as folgas se tocarem.

Não existem, e não devem ser inventados: carregando, erro, vazio, offline. Nenhuma das quatro
instâncias faz chamada de rede ao alternar — a mudança é local e imediata.

## Viewports
- **390px (mobile)** — obrigatório: é o único lugar onde o interruptor de tema existe, e onde os
  outros três convivem com rótulos longos.
- **1280px (desktop)** — obrigatório: acima desse corte o tema deixa de ser interruptor e vira o
  segmentado "Claro / Escuro", mas os outros três interruptores continuam lá. Desenhe a linha "Tema"
  no desktop também, com o segmentado, para deixar registrado que ali NÃO há interruptor.
- 1920px não é necessário: a peça tem tamanho fixo e não reflui.

## Regras que o desenho não pode quebrar
- **Freemium binário**: o interruptor de marketplaces desabilitado significa "isto é do Premium",
  dito em texto ao lado. Nunca um interruptor meio-ligado, nunca um número de canal parcial atrás
  dele.
- **Falha de rede nunca vira "não é premium"** — e como o interruptor não faz rede, ele também
  nunca deve parecer estar tentando algo.
- **A frase honesta vive em elemento de largura inteira**, embaixo do interruptor, nunca cortada e
  nunca dentro de um espaço estreito ao lado dele.
- **Alvo ≥ 44×44px** em todos os estados, incluindo o desabilitado.
- **Contraste medido contra o fundo real** de cada tela (cartão da Conta, folha da exportação,
  formulário de Calcular), nos dois temas — inclusive o polegar branco sobre trilha clara e o
  conjunto inteiro a 0,55 de opacidade.
- O componente **não escreve texto**: qualquer palavra que apareça no desenho é do rótulo vizinho.

## Armadilhas já pagas neste projeto
- **O rótulo espremido a 390px**: o mestre de marketplaces já foi corrigido uma vez porque o texto
  quebrava em duas linhas ao lado do interruptor; hoje ele ocupa uma linha inteira, rótulo à
  esquerda e interruptor à direita. Mantenha essa forma.
- **Teste passa em elemento ocluso**: alvo e sobreposição se provam com CAIXAS, não com "o texto
  está lá". Entregue as medidas do retângulo de toque.
- **Legenda cortada**: a frase da sobretaxa e o aviso da exportação são longos de propósito; se
  couberem só truncados, o desenho está errado, não a copy.
- **Rolagem horizontal medida**: a 390px, a linha rótulo+interruptor não pode estourar 1px sequer.

## Entregável
Pranchetas, tema escuro e tema claro lado a lado (o escuro é o padrão, o claro é first-class):
1. **Matriz de estados** — os 7 estados acima × ligado/desligado, em tamanho real e ampliado.
2. **Anatomia com o alvo revelado** — cotas de 44×44 (raiz), 44×24 (trilha), 20px (polegar), 2px de
   folga e o deslocamento de 20px; duas linhas empilhadas mostrando o espaçamento mínimo seguro.
3. **Os quatro contextos reais a 390px** — Tema, marketplaces (gratuito, desabilitado, com a frase
   do Premium), uma sobretaxa com a legenda completa, e a exportação com o aviso.
4. **A 1280px** — a linha "Tema" com o segmentado Claro/Escuro (sem interruptor) e os outros três
   interruptores no seu lugar.

Reutilize os primitivos existentes: `tf-switch` para a peça (é ela que está sendo redesenhada, não
substituída), `tf-segmented` para o controle de tema do desktop, o cartão do DS para as linhas da
Conta, e os ícones de sol e lua já existentes a 16px. Não crie um primitivo novo de toggle.

## Perguntas em aberto para o dono
1. O desabilitado por **falta de Premium** deve ser visualmente igual a qualquer outro desabilitado
   (opacidade 0,55), ou merece um tratamento próprio — cadeado, cor distinta — já que a frase
   "Vender em marketplaces faz parte do Premium." aparece logo abaixo?
2. Clicar no **rótulo** deve alternar o interruptor em todos os quatro casos? Hoje alterna só na
   lista de sobretaxas; na Conta e na exportação o texto é inerte. Uniformizar muda o tamanho real
   do alvo e, no caso da exportação, coloca o aviso de exposição de custos a um clique de distância
   do próprio texto que o explica.

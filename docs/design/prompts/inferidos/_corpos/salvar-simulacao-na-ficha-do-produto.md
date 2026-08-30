# "Salvar simulação" no rodapé da ficha de produto

## O que desenhar
O par de ações que fecha a ficha de produto do Catálogo (`apps/web/src/pages/catalogo/produto-page.tsx`,
rodapé `tf-calc-footer`, depois do bloco de preços): hoje são dois botões secundários empilhados —
**"Salvar em Orçamentos"** e, logo abaixo, **"Salvar simulação"** — mais a folha (sheet) que o segundo
abre. Quem está ali é um vendedor premium editando um produto JÁ salvo do catálogo: ele veio ajustar
custo/markup de uma peça, viu o preço recalculado, e no fim da página encontra dois botões de salvar de
mesmo peso visual que fazem coisas diferentes (um congela um orçamento com data; o outro guarda uma
estratégia que recalcula com os preços de hoje). Desenhe o rodapé inteiro — a relação entre as duas ações
— e a folha "Salvar simulação" com todos os seus estados.

## Por que este prompt existe
Esta segunda porta de criação de simulação **nunca foi desenhada**. Foi inferida por IA a partir de um
requisito textual (o comentário no código diz que "fecha FR-606a no lado da UI"): a spec de simulações
(`specs/010-e5-saved-scenarios/ux-scenarios.md`) coloca TODAS as entradas dentro da Calcular (§11-F1,
"Option A — inside Calcular") e não menciona a ficha do produto uma única vez. E o dono, no canvas 018
(`specs/018-abas-desktop/design/Abas-Desktop.dc.html`), desenhou a ficha do Catálogo botão a botão —
"Duplicar", "Excluir", "Salvar alterações", "Usar no cálculo" — e **nenhuma dessas ações é criar
simulação**. Ou seja: o código contraria o único desenho existente da ficha. Além disso, o par ambíguo
"salvar isto ou salvar aquilo?" da Calcular foi reproduzido aqui numa segunda tela, num contexto (catálogo)
em que o vendedor não está pensando em canais de marketplace.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual do rodapé, de cima para baixo:

1. Bloco de preços (`PriceResults`) ou, se a entrada for inválida, um alerta de perigo com a nota de
   entrada inválida.
2. Botão secundário com ícone de disquete: **"Salvar em Orçamentos"** — sem nenhum wrapper, portanto
   alinhado à esquerda do container.
3. Botão secundário com ícone de disquete: **"Salvar simulação"** — dentro de um wrapper centralizado.
   → **Problema medido no código**: dois botões irmãos, mesmo variant, mesmo ícone, e alinhamentos
   diferentes (um à esquerda, outro centralizado). É um desalinhamento acidental, não uma hierarquia.
   → **Problema de significado**: nada no rodapé explica a diferença entre "Orçamentos" (congelado, com
   data) e "simulação" (recalcula hoje). A frase que explica isso existe no produto, mas mora em outra
   tela ("Estratégias salvas. Cada uma recalcula com os preços de hoje quando você abre.").

Quando o botão "Salvar simulação" aparece: **só** com produto já salvo (`editing`) + preço válido
(`result` e `input`) + entitlement do servidor `active`. Sem premium ativo ele **não existe** — não é
cinza, não é teaser (postura SC-109 herdada). Produto novo ainda não salvo: não aparece, e nada diz por quê.

A folha que abre (`features/scenarios/save-scenario-sheet.tsx`), na ordem exata:

| Elemento | Texto literal hoje | Regras |
|---|---|---|
| Título | "Salvar simulação" | idêntico ao rótulo do gatilho |
| Intro | "Guardamos a estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de hoje." | 2 linhas em 390px |
| Campo Nome | rótulo "Nome", obrigatório, texto livre | máx. 120 caracteres |
| Campo Nota | rótulo "Nota (opcional)", textarea 3 linhas | máx. 500 caracteres |
| Eco da base | "Base de custo: Vaso G (referência do catálogo)" | somente leitura, tom `--text-muted`, quebra em qualquer caractere |
| Botão de envio | "Salvar simulação" | primário, largura total do formulário |

→ **Problema**: o gatilho e o botão de envio têm exatamente o mesmo texto — depois de clicar em "Salvar
simulação" o vendedor encontra outro "Salvar simulação". O desenho precisa diferenciar (ou registrar como
pergunta ao dono).

## Conteúdo e dados reais
- Nome do produto de exemplo: **"Vaso G"**; o eco fica **"Base de custo: Vaso G (referência do catálogo)"**.
  Os outros dois rótulos possíveis da mesma linha são "avulsa" e "kit do catálogo" — desenhe com o de
  produto, que é o caso desta peça.
- Preços do rodapé, com números reais da seed: **"Preço varejo" R$ 24,24** e **"Preço atacado" R$ 21,01**;
  "Custo total" R$ 16,16. Use um caso adversarial numa das pranchetas: **R$ 1.234,56** e um nome de produto
  longo sem espaços (120 caracteres) no eco da base.
- Nome da simulação: obrigatório, 1–120 caracteres, sem máscara. Nota: opcional, 0–500.
- Nada aqui é editável além de nome e nota — a base de custo é o que estava na tela quando a folha abriu
  (congelada na abertura); ela é **derivada**, nunca um campo.

## Estados obrigatórios
- **Rodapé com premium ativo**: os dois botões visíveis. Desenhe a hierarquia que você propõe.
- **Rodapé sem premium ativo / Premium pausado**: "Salvar simulação" (e "Salvar em Orçamentos") somem por
  completo. Na mesma página já existe, acima, o alerta informativo "Premium pausado" com o corpo que
  explica a leitura preservada — mostre como o rodapé fica sem os botões, sem buraco visual.
- **Produto ainda não salvo**: rodapé sem o botão. Mostre o rodapé nesse estado.
- **Preço inválido**: no lugar do bloco de preços, um alerta de perigo; sem botão de simulação.
- **Gatilho**: repouso, hover, foco visível, pressionado, e desabilitado (existe: o gatilho fica inerte
  quando a calculadora está inválida — nunca um clique morto).
- **Folha aberta, campos vazios (repouso)**: sem erro nenhum — a mensagem só aparece depois de digitar ou
  de tentar salvar (defeito já pago: o submit voltava calado e nada acontecia).
- **Erro de validação**: "Dê um nome à simulação." · "Máximo de 120 caracteres." · "Máximo de 500 caracteres."
- **Salvando**: botão de envio em carregamento, campos preservados, folha não fecha.
- **Erro de rede (offline)**: linha de erro **"Salvar uma simulação precisa de conexão."** dentro da folha,
  em `--danger-text`, com a folha ABERTA e nome/nota intactos. Nunca um toast de sucesso.
- **Erro de conteúdo grande demais**: "Esta simulação ficou grande demais para salvar. Reduza o número de
  peças ou de custos e tente de novo."
- **Erro de estado da calculadora**: "Corrija os campos da calculadora antes de salvar."
- **Sucesso**: folha fecha e aparece o toast de sucesso **"Simulação salva."** — só em resposta real do
  servidor. Desenhe o toast, incluindo onde ele aparece em 390px sem cobrir a barra de navegação.

## Viewports
- **Mobile 390px** — é onde o vendedor realmente usa o catálogo; a folha é bottom sheet, o rodapé é uma
  coluna única e os dois botões ficam empilhados.
- **Desktop 1280px** — a ficha de produto usa a grade de duas colunas e o rodapé atravessa a largura toda,
  centralizado, com cada bloco limitado a 720px. É aí que o desalinhamento dos dois botões fica mais
  gritante (um centralizado no bloco de 720px, o outro colado à esquerda). Desenhe esse rodapé.
- 1920px é opcional: o rodapé não muda depois de 1024px (mesmo teto de 720px).

## Regras que o desenho não pode quebrar
- **Freemium é binário**: sem entitlement ativo do servidor, a ação não existe — nada de botão cinza com
  cadeado, nada de teaser no meio de uma tarefa de catálogo.
- **Falha de rede nunca é vendida como "não é premium"**: a frase offline diz conexão, e a folha continua
  aberta com o que foi digitado.
- **Procedência do número**: o eco "Base de custo: …" declara de onde vem o cálculo; ele é congelado na
  abertura da folha e não pode parecer editável.
- **Frase honesta nunca em placeholder**: erros, aviso de offline e o eco da base vivem em elementos de
  largura total, nunca dentro de um campo.
- **Alvo ≥44px** nos dois botões do rodapé e no botão de envio; **contraste medido** do texto de erro
  contra o fundo real da folha, nos dois temas.
- Toast de sucesso só depois da confirmação real — não desenhe uma confirmação otimista.

## Armadilhas já pagas neste projeto
- **Botão nascido fora do viewport** e **overflow horizontal de 100,5px** já aconteceram num rodapé de
  ações parecido: meça a largura dos dois botões lado a lado em 390px antes de propor uma linha.
- **Toast que nunca renderiza** porque a folha desmonta antes do callback — desenhe o toast como estado
  da tela de fundo, não como elemento dentro da folha.
- **Nome de 120 caracteres sem espaço** estoura o eco da base numa folha de 390px; a quebra tem de ser em
  qualquer caractere.
- **Texto ocluso passa em teste**: o rodapé fica embaixo da barra de navegação inferior no mobile se o
  espaçamento final não for previsto.
- **Valor grande estoura a coluna**: R$ 1.234,56 (e seis dígitos) no bloco de preços logo acima.

## Entregável
Pranchetas, em tema escuro (padrão) **e** claro, ambos como primeira classe:
1. Rodapé da ficha de produto, 390px — premium ativo, dois botões, hierarquia proposta.
2. Rodapé, 390px — produto não salvo / premium pausado (sem botões) e preço inválido.
3. Rodapé, 1280px — travessia de largura total, teto de 720px, alinhamento corrigido.
4. Folha "Salvar simulação", 390px — repouso, com foco no campo Nome.
5. Folha — erro de validação e erro offline (pode ser a mesma prancheta em duas colunas).
6. Folha — enviando, e a tela de fundo com o toast "Simulação salva.".
7. Caso adversarial: nome de produto de 120 caracteres no eco + R$ 1.234,56 no bloco de preços.

Reutilize os primitivos existentes, sem criar novos: botão secundário `tf-*` com ícone para os dois
gatilhos do rodapé, botão primário para o envio, `tf-input`/`tf-inputwrap` para Nome, textarea do mesmo
primitivo para Nota, o campo com rótulo/obrigatório/opcional e slot de erro para os dois campos, o alerta
(tons `info` e `danger`) para "Premium pausado" e entrada inválida, a folha (sheet) com título e descrição,
e o toast de sucesso. O bloco de preços acima já existe — referencie-o, não redesenhe.

## Perguntas em aberto para o dono
1. **Esta ação deve existir na ficha do produto?** O canvas 018 desenhou a ficha do Catálogo com quatro
   ações explícitas e nenhuma delas cria simulação; a spec põe todas as entradas na Calcular. Se a resposta
   for "não", o entregável vira o rodapé sem esse botão (e "Usar no cálculo" leva a Calcular).
2. Se ficar: **qual é a hierarquia entre "Salvar em Orçamentos" e "Salvar simulação"?** Uma delas é a ação
   principal, ou as duas têm o mesmo peso? Hoje as duas são secundárias e estão desalinhadas por acidente.
3. **O rodapé deve explicar a diferença** entre congelar um orçamento e guardar uma simulação, ali mesmo?
   Existe frase homologada para isso em outra tela; reaproveitá-la aqui é decisão de produto.
4. O gatilho e o botão de envio dizem os dois "Salvar simulação". **O envio deve ter outro rótulo?**
5. Com **Premium pausado** o vendedor vê a ficha inteira, o alerta "Premium pausado", e os botões
   simplesmente somem. Isso está certo, ou nessa aba (que ele acessou como premium) o botão deve aparecer
   inerte com a frase "Premium pausado — reative para renomear, duplicar, editar ou excluir."?
6. O rótulo da base **"(referência do catálogo)"** é vocabulário do vendedor ou nosso? Ele aparece depois,
   na lista de simulações, colado ao nome do produto.

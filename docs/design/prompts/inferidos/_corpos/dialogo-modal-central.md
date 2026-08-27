# A caixa de confirmação central (excluir · sair · cancelar assinatura)

## O que desenhar

A caixa modal centralizada que aparece toda vez que o usuário pede algo irreversível ou que exige
decisão explícita: excluir um filamento, uma impressora, um orçamento congelado ou uma simulação
salva; sair do app com registros na fila offline; recalcular um congelado com os preços de hoje;
cancelar a assinatura Premium. Vive por cima de qualquer aba (Calcular, Catálogo, Kits,
Orçamentos, Conta), escurece o resto da tela e prende o foco: em 6 dos 9 pontos de uso ela **não
tem X** — só se sai escolhendo. É a última tela que o vendedor vê antes de perder um dado. Origem
no código: `apps/web/src/shared/ui/dialog.tsx` + `dialog.css` (variante `center`).

## Por que este prompt existe

Autoridade de desenho: **NENHUMA**. A caixa inteira foi inferida a partir de uma decisão técnica —
o próprio arquivo declara "ADR-0007, decision C1 = build now". O protótipo de 2026-07-02 desenhou
**só a Sheet** (§D.2, o upsell contextual); o readme lista `Sheet` entre os 32 primitivos e **não
lista Dialog/Modal**. O canvas de desktop também não tem nenhuma: o dono desenhou o botão
**"Excluir"** na ficha e nos Orçamentos, nunca o que acontece depois do clique. Largura, respiro,
ordem dos botões, peso do botão perigoso e o X que às vezes existe e às vezes não saíram de
escolhas de implementação, caller a caller.

## O que já existe hoje (não invente do zero — corrija)

Geometria atual: largura `min(92vw, 32rem)` (≈358px em 390 · 512px no desktop), `max-height: 85vh`
com rolagem interna, padding `--space-6`, raio `--radius-xl`, borda `--border-subtle`, sombra
`--shadow-lg`, scrim `--surface-overlay`, `gap --space-3` entre filhos. Título em `--font-title`,
CAIXA ALTA, `--fs-lg`, `--text-strong`, com `padding-right: --space-10` reservado para o X.
Descrição em `--text-muted`, `--fs-body-sm`. X de 44×44 (`--touch-min`) no canto superior direito.

Os 9 usos reais e o que cada um mostra:

| Onde | Título (literal) | Corpo | Botões (ordem atual) | X? |
| --- | --- | --- | --- | --- |
| Excluir filamento/impressora (`catalog-panel`) | "Excluir “{nome}”?" | "Esta ação não pode ser desfeita." | "Voltar" (ghost) · "Excluir" (danger) | **sim** |
| Excluir simulação (`scenarios-list-sheet`) | "Excluir a simulação “{nome}”?" | "Esta ação não pode ser desfeita." | "Voltar" (ghost) · "Excluir" (danger) | **sim** |
| Descartar alterações (`scenario-context-bar`) | "Descartar as alterações não salvas desta simulação?" | *(nenhum)* | "Voltar" (ghost) · "Descartar" (danger) | **sim** |
| Cancelar assinatura (`plan-panel`) | "Cancelar a assinatura?" | "Seu Premium continua ativo até {data}." + legenda "Depois disso, seus itens salvos ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." | "Voltar" (secondary, **preenchido**) · "Cancelar assinatura" (**danger-ghost**) | **sim** |
| Descartar registro da fila (`entry-actions`) | "Descartar este registro?" | "Ele não foi enviado para a sua conta e não poderá ser recuperado." | "Voltar" (secondary) · "Descartar" (danger) | não |
| Excluir congelado (`snapshot-manage`) | "Excluir este registro?" | "Esta ação não pode ser desfeita." | "Voltar" (secondary) · "Excluir" (danger) | não |
| Editar rótulo (`snapshot-manage`) | "Editar rótulo" | campo "Rótulo (opcional)", máx. 120 caracteres | "Voltar" (secondary) · "Salvar rótulo" (primary) | não |
| Recalcular hoje (`recalc-today`) | "Recalcular hoje" | "Isso cria um NOVO registro com os valores do seu catálogo hoje. O registro de {data} continua como está." | "Voltar" (secondary) · "Recalcular" (primary) | não |
| Sair com fila pendente (`sign-out-outbox-guard`) | "{n} registro(s) ainda não foram sincronizados" | "Eles estão só neste dispositivo. Se você sair agora sem enviar, eles são apagados deste aparelho e não vão para a sua conta." | **coluna**: "Sincronizar agora" (primary) · "Sair e descartar" (danger) · "Voltar" (secondary) | não |

→ **A mesma classe de ação tem e não tem X.** Excluir um filamento fecha no X; excluir um
congelado, não. Não há regra — há dois costumes.
→ **A saída segura tem dois pesos.** "Voltar" é `ghost` em Catálogo/Simulações e `secondary` nas
demais. Em Cancelar assinatura a hierarquia foi **invertida de propósito** (decisão do dono
2026-08-03, medida: "Voltar" fantasma 85,6×48px contra "Cancelar assinatura" vermelho preenchido
187,6×48px — o destrutivo era 2,2× mais largo e o único com fundo). A inversão vive em **uma**
caixa; as outras oito seguem com o destrutivo preenchido.
→ **O ritmo vertical é remontado por chamador**: uns usam o `gap --space-3` da caixa, outros
empilham um agrupador interno, outros empurram a régua de botões com margem própria.
→ **O corredor do X existe mesmo quando não há X** — nas 6 caixas sem X o título quebra mais cedo
por causa de um botão que não está lá.
→ **A CAIXA ALTA cai sobre nome digitado**: "EXCLUIR “PLA VERMELHO 1KG”?" — e sobre frases longas:
"DESCARTAR AS ALTERAÇÕES NÃO SALVAS DESTA SIMULAÇÃO?", 49 caracteres em fonte de título, sem corpo
nenhum embaixo.

## Conteúdo e dados reais

- Nomes ecoados no título vêm do catálogo do usuário e vão de "PLA" a rótulos de até 120
  caracteres. Exemplos verdadeiros: "PLA Vermelho 1kg", "Creality Ender 3 V3 SE", "Vaso
  hexagonal — 15/07/2026", "Shopee — vaso grande com brinde de frete".
- `{n}` na guarda de saída é a fila offline: plausível 1–3, possível 40+. `{data}` é data curta
  ("15/07/2026"; no plano, "12/09/2026").
- Nada nesta caixa mostra dinheiro hoje. O recálculo confirma uma ação cujo resultado
  (ex.: `R$ 24,24` → `R$ 27,80`) só aparece **depois** que a caixa fecha — ver Perguntas em aberto.
- Campo único existente: "Rótulo (opcional)", texto livre, `maxLength=120`, pré-preenchido. Aviso
  em faixa: "Este filamento é usado em {n} produto(s). Eles manterão os últimos valores,
  editáveis." (e o gêmeo "Esta impressora é usada em {n} produto(s)…").

## Estados obrigatórios

- **Foco, hover e pressionado** — o foco entra na caixa e não sai; anel `--ring` visível em cada
  botão, no campo e no X, desenhado sobre `--surface-card` (não sobre a página). Hover nos cinco
  pesos de botão e no X (hoje o X clareia e ganha `--bg-muted`).
- **Carregando** — o botão da ação fica em `loading` enquanto a exclusão/cancelamento/recálculo
  roda, a caixa **continua aberta** e o "Voltar" precisa de estado definido nesse intervalo.
- **Erro** — faixa `danger` acima da régua, caixa aberta: "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes."
- **Aviso honesto (info)** — faixa com o texto de item referenciado; a ação **continua disponível**.
- **Offline** — na guarda de saída: "Sincronizar agora" **desabilitado** com a explicação abaixo,
  "Precisa de conexão para enviar."; no recálculo, a nota "Sem conexão: usando os valores do
  catálogo salvos neste aparelho, que podem estar desatualizados."
- **Degradado** — recálculo sem origem no catálogo: "Não foi possível localizar a origem deste
  registro no seu catálogo agora. Dá para recalcular usando os valores guardados neste registro e
  a fórmula atual — mas isso não reflete os preços de hoje do seu catálogo." (o corpo mais alto
  que a caixa recebe hoje).
- **Sem saída pelo X** — nas 6 caixas em que a única saída é escolher, precisa ficar visualmente
  claro que ambas as saídas estão na régua de botões.
- **Sucesso parcial e segunda etapa** — a guarda de saída mostra a faixa `danger` "{n} registro(s)
  não puderam ser enviados. Eles continuam neste aparelho." **sem fechar**, e troca o próprio
  conteúdo por "Descartar {n} registro(s) e sair?" + "Eles não foram enviados para a sua conta e
  não poderão ser recuperados." com "Voltar" · "Descartar e sair".

## Viewports

- **390px (mobile)** — obrigatório: a caixa ocupa 92vw (≈358px) e é onde a régua de dois botões
  lado a lado aperta; desenhe também a versão com **três** botões (guarda de saída) e a caixa com
  **campo de texto** (teclado aberto contra `max-height: 85vh`).
- **1280px (desktop)** — obrigatório: é o corte do redesenho 018; a caixa fica em 512px centrada
  sobre barra lateral + lista + ficha, e o scrim precisa funcionar sobre três colunas.
- **1920px** — uma prancheta só para a proporção: a caixa **não cresce** além de 32rem, então ali
  é um retângulo pequeno num campo escuro grande. Se isso não estiver certo, proponha o ajuste.

## Regras que o desenho não pode quebrar

1. **"Voltar" nunca vira "Cancelar"** (FR-014, anotado no próprio arquivo de textos). Numa caixa
   chamada "Cancelar a assinatura?", um botão "Cancelar" é ambíguo por construção.
2. **Nada some em silêncio**: toda exclusão ecoa o nome do que será excluído e diz que não dá para
   desfazer.
3. **Falha de rede nunca é vendida como falta de plano** e nunca é vendida como sucesso: botão que
   não pode funcionar mostra o motivo escrito, não fica só apagado.
4. **A frase honesta mora em elemento de largura cheia** — nunca em placeholder, nunca cortada por
   reticências — e **degradação é dita**: o recálculo sem origem tem que parecer diferente do
   recálculo normal.
5. **Alvo ≥44×44px** para o X e para cada botão, inclusive quando dois dividem 358px; e
   **contraste medido contra o fundo real** (`--surface-card` sobre scrim, não sobre a página) —
   o `danger-ghost` é o pior caso.
6. **A confirmação de sucesso não pode morar dentro da caixa**: ela desmonta no instante da ação,
   então qualquer aviso de "pronto" desenhado aqui simplesmente não aparece (já aconteceu).

## Armadilhas já pagas neste projeto

- **Um diálogo desta família já estourou 100,5px na horizontal, com um botão nascido fora da
  viewport** — e o teste passou. Layout se prova com caixa medida, não com "o texto está lá".
- **Um toast de confirmação ficou no pacote e nunca renderizou** (0 inserções em 8s) porque a
  caixa desmontava antes — daí a regra 6.
- **Texto ocluso passa em teste**; e **nome grande estoura coluna** (já aconteceu num PDF de
  orçamento). Desenhe o título com um nome de 120 caracteres, não com "PLA".

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não cortesia)**: (1) confirmação
destrutiva de duas ações, 390px e 1280px; (2) a mesma com faixa `info` de item referenciado e com
faixa `danger` de erro; (3) a caixa com campo "Rótulo (opcional)" em 390px com teclado; (4) a
guarda de saída nas duas etapas, incluindo o offline com botão desabilitado e a explicação; (5) o
recálculo normal e degradado; (6) o cancelamento de assinatura com a hierarquia invertida; (7) o
estado carregando; (8) uma prancheta de foco com o anel em cada elemento; (9) 1920px.

Reutilize os primitivos, sem criar novos: a caixa é a variante `center` do `tf-dialog` (mesmo
scrim, raio e sombra da `Sheet`), o título `tf-dialog__title`, o corpo `tf-dialog__desc`, os
avisos `tf-alert` nos tons `info` e `danger`, os botões `tf-btn` nos cinco pesos já existentes, o
campo `tf-input` dentro de `tf-inputwrap` com o rótulo do `Field`, e o X `tf-dialog__x`. O que se
espera de novo não é primitivo: é **a regra** — uma régua de botões única, um ritmo vertical único
e uma decisão explícita sobre o X.

## Perguntas em aberto para o dono

1. **O X vira regra ou some?** Hoje 6 caixas prendem a saída e 4 não. Qual é a regra: toda
   confirmação destrutiva se fecha só escolhendo, ou toda caixa pode ser fechada no X e o
   "Voltar" já basta como saída segura?
2. **A inversão de hierarquia de 2026-08-03 (saída segura preenchida, ação destrutiva em
   `danger-ghost`) vale para todas as confirmações irreversíveis, ou continua exclusiva do
   cancelamento de assinatura?** Isso muda o desenho de 8 caixas.
3. **A CAIXA ALTA do título continua sobre nome digitado pelo usuário** ("EXCLUIR “PLA VERMELHO
   1KG”?"), ou o nome mantém a grafia original dentro de um título em caixa alta?
4. **A caixa de "Recalcular hoje" deve mostrar o número** (ex.: "de R$ 24,24 para R$ 27,80")
   antes de confirmar, ou o novo valor continua aparecendo só depois, no registro criado? Hoje ela
   confirma uma ação cujo efeito o usuário só vê quando a caixa já fechou.

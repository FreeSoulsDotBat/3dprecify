# Botão destrutivo: `danger` (sólido) e `danger-ghost` (contornado)

## O que desenhar
As duas variantes vermelhas do botão do Precifica3D e a linha de ações em que elas vivem. Elas aparecem
sempre que o vendedor está prestes a perder algo: excluir um filamento/impressora/produto do catálogo,
excluir um registro do Histórico, descartar um cálculo que ainda não subiu para a conta, sair da conta com
registros pendentes, excluir uma simulação salva, e cancelar a assinatura Premium. São dois papéis
diferentes: o **sólido** é a ação irreversível quando ela É o que o usuário veio fazer (o "Excluir" dentro
do diálogo de confirmação), e o **contornado** é a ação irreversível quando ela NÃO é a ação padrão (o
gatilho "Excluir" ao lado de "Duplicar" numa ficha, e o "Cancelar assinatura" ao lado de um "Voltar"
preenchido).

## Por que este prompt existe
As duas variantes nasceram no código, não numa prancheta: `danger` é herdada do kit original, cujo readme
admite que "success/danger" foram acrescentados **fora** do manual de marca; `danger-ghost` foi criada em
2026-08-03 numa correção de bug (015/A8), para inverter uma hierarquia que a medição mostrou errada.
Autoridade parcial: o canvas do dono (018, `Abas-Desktop.dc.html`) **já decide a colocação** — usa
`tf-btn--danger-ghost` na ficha do Catálogo (l. 125, ao lado de "Duplicar", tamanho `sm`) e nas ações do
Orçamento (l. 316, isolado à direita com `margin-left:auto`, longe de "Exportar"). O que continua sem
desenho é a **pele**: a variante sólida em qualquer contexto, e os estados hover / foco / pressionado /
desabilitado / carregando dos dois vermelhos, nos dois temas.

## O que já existe hoje (não invente do zero — corrija)
Geometria real do botão (vale para as duas variantes): altura 48px, raio 14px, borda 1,5px, rótulo 16px
semibold, alvo mínimo 44×44px, pressionar reduz para 0,97 de escala.
→ **Medido**: o tamanho `sm` NÃO fica com 36px de altura — o mínimo de 44px vence; o `sm` só encurta o
padding e leva o rótulo a 14px. O "Excluir" `sm` do canvas é um botão de **44px de altura**, desenhe assim.

| Contexto (origem no app) | Gatilho hoje | Confirmação hoje | → problema |
| --- | --- | --- | --- |
| Catálogo, diálogo de exclusão (`catalog-panel.tsx`) | — | "Voltar" *ghost* + "Excluir" **sólido**, com carregando | a saída segura não tem peso nenhum |
| Histórico, registro salvo (`snapshot-manage.tsx`) | "Excluir" **secondary** (cinza) | "Voltar" *secondary* + "Excluir" **sólido** | gatilho destrutivo idêntico a "Editar rótulo" |
| Histórico, registro pendente (`entry-actions.tsx`) | "Descartar" **sólido `sm`**, solto na lista | "Voltar" + "Descartar" **sólido** | vermelho cheio dentro de uma lista |
| Simulações, linha da lista (`scenarios-list-sheet.tsx`) | lixeira **ghost, só ícone**, sem vermelho | "Voltar" *ghost* + "Excluir" **sólido** | terceira aparência para a mesma ação |
| Conta / Plano (`plan-panel.tsx`) | — | "Voltar" **secondary preenchido** + "Cancelar assinatura" **contornado** | única inversão deliberada, e a certa |
| Canvas 018, ficha e barra do Orçamento | "Excluir" **danger-ghost `sm`** | — | é esta a regra que falta escrever |

→ Quatro tratamentos diferentes para "excluir" convivem hoje (ícone ghost, cinza, sólido, contornado). O
desenho precisa resolver isso numa regra só, e o canvas do dono já aponta para o contornado no gatilho.

Textos literais em pt-BR (não reescreva; use exatamente):
- "Excluir “{nome}”?" · "Esta ação não pode ser desfeita." · "Excluir" · "Voltar"
- "Excluir este registro?" · "Não foi possível excluir o registro."
- "Descartar este registro?" · "Ele não foi enviado para a sua conta e não poderá ser recuperado." · "Descartar"
- "{n} registro(s) ainda não foram sincronizados" · "Sincronizar agora" · "Precisa de conexão para enviar."
  · "Sair e descartar" · "Descartar {n} registro(s) e sair?" · "Descartar e sair"
- "Cancelar a assinatura?" · "Seu Premium continua ativo até {data}." · "Depois disso, seus itens salvos
  ficam disponíveis só para leitura — nada é apagado, e você pode reativar quando quiser." · "Cancelar
  assinatura" · "Não foi possível cancelar agora. Nada mudou — tente de novo em instantes."
- Razões de bloqueio: "Esta ação precisa de conexão." · "Premium pausado — reative para renomear,
  duplicar, editar ou excluir."

## Conteúdo e dados reais
- Vermelhos em uso: base `#ef3340`, profundo `#c41f2b`, suave `#fde4e6` no tema claro e vermelho a 16% no
  escuro. O vermelho *de texto* é o profundo no tema claro e o base no escuro (calibrado contra o fundo real
  em que ele aparece, não contra branco teórico).
- Sólido hoje: fundo vermelho base, rótulo **branco** nos dois temas; hover troca o fundo para o profundo.
  → **Medi agora: branco sobre `#ef3340` dá ~4,0:1**, e o rótulo tem 16px semibold — não conta como "texto
  grande", então isso **reprova o AA de 4,5:1**. Pior: o hover (`#c41f2b`, ~5,9:1) é mais legível que o
  repouso, e o repouso é o estado em que o vendedor lê antes de clicar em algo irreversível.
- Contornado hoje: fundo transparente, rótulo no vermelho de texto, borda no vermelho base; no hover ganha
  o preenchimento suave e a borda escurece.
- Nomes reais que entram no título do diálogo: "PLA Preto 1,75mm", "Ender 3 V3 SE", "Kit Vaso Grande +
  Prato" — o campo de rótulo aceita até 120 caracteres.
- Diálogo do Premium com data real: "Seu Premium continua ativo até 12/09/2026."

## Estados obrigatórios
1. **Repouso** — sólido e contornado lado a lado, para comparar peso.
2. **Hover** — sólido escurece o fundo; contornado ganha o preenchimento suave e escurece a borda.
3. **Foco por teclado** — anel de 2px, hoje **roxo** (a mesma cor do foco de todo o app) inclusive no botão
   vermelho. Desenhe e decida: anel roxo sobre borda vermelha, ou anel vermelho? Mostre o escolhido.
4. **Pressionado** — 0,97 de escala, sem mudança de cor.
5. **Desabilitado** — hoje é só opacidade 0,55 sobre a mesma cor; num vermelho isso vira rosa apagado e o
   contornado perde legibilidade. Desenhe o desabilitado **com a razão ao lado**, nunca sozinho: "Esta ação
   precisa de conexão." (offline) e "Premium pausado — reative para renomear, duplicar, editar ou excluir."
6. **Carregando** — spinner à esquerda **e o rótulo continua** ("Excluir" com spinner). O botão cresce nesse
   estado: desenhe a linha de ações já acomodando o crescimento.
7. **Erro depois da tentativa** — o diálogo continua aberto, com o aviso vermelho acima da linha de botões
   ("Não foi possível excluir o registro." / "Não foi possível cancelar agora. Nada mudou — tente de novo
   em instantes.") e o botão de volta ao repouso.

## Viewports
- **390px (mobile)**: a peça existe em todas as telas listadas. Desenhe a linha de ações do diálogo (dois
  botões alinhados à direita) e o caso vertical de três botões empilhados do "sair com pendências".
- **1280px (desktop)**: é onde o canvas 018 coloca o contornado — ficha do Catálogo (ao lado de "Duplicar")
  e barra de ações do Orçamento (empurrado à direita, separado de "Exportar" / "Recalcular hoje" /
  "Comparar com hoje"). Desenhe as duas linhas de ação inteiras, não o botão isolado.
- 1920px é opcional: a linha de ações não muda de forma, só de largura disponível.

## Regras que o desenho não pode quebrar
- **A saída segura tem peso igual ou maior.** No diálogo de cancelamento, "Voltar" é preenchido e "Cancelar
  assinatura" é contornado — decisão do dono (015/A8), não se inverte de volta.
- **O rótulo da saída segura é sempre "Voltar"**, nunca "Cancelar": uma tela de cancelamento com um botão
  "Cancelar" é ambígua por construção.
- **Nada de exclusão sem confirmação**: o gatilho abre um diálogo, sempre.
- **Falha de rede nunca é vendida como "não é premium"** e vice-versa: as duas razões de bloqueio são frases
  distintas e ambas aparecem como texto de apoio visível, nunca como dica só no hover.
- Contraste medido **contra o fundo real** (o vermelho sólido, o suave sobre o card, a borda sobre o cartão).
- Alvo ≥44×44px em todos os tamanhos, inclusive no botão só de ícone.

## Armadilhas já pagas neste projeto
- **Largura desigual medida**: "Cancelar assinatura" mediu 187,6×48px contra 85,6×48px do "Voltar" — a linha
  de dois botões com rótulos muito diferentes já estourou caixa neste app. Desenhe com o rótulo mais longo
  real, não com um "Excluir" curto.
- **Título com nome longo**: "Excluir “{nome}”?" com 120 caracteres precisa quebrar em duas linhas dentro do
  diálogo, sem vazar e sem truncar o "?" que o torna uma pergunta.
- **Frase honesta fora de placeholder**: as razões de bloqueio e os avisos de erro vivem em elementos de
  largura cheia; este projeto já perdeu uma frase por cortá-la dentro de um campo estreito.
- **Ocluso passa no teste**: um botão coberto por outro elemento continua "visível" para o teste automático.
  A linha de ações precisa de folga desenhada entre o destrutivo e o vizinho.

## Entregável
Pranchetas, **tema escuro e tema claro lado a lado** (o escuro é o padrão do app, o claro é first-class):
1. Matriz de estados dos dois vermelhos (repouso, hover, foco, pressionado, desabilitado, carregando), nos
   tamanhos `md` (48px) e `sm` (também com 44px de alvo).
2. Diálogo de exclusão do Catálogo, 390px — com o aviso de tom `info` de item referenciado presente.
3. Diálogo de cancelamento do Premium, 390px — a hierarquia invertida, com as três linhas de texto.
4. "Sair com pendências", 390px — os três botões empilhados, um deles desabilitado com a legenda.
5. Ficha do Catálogo e barra de ações do Orçamento, 1280px — a colocação que o canvas 018 já fixou.
Reutilize os primitivos existentes, sem criar novos: o botão `tf-btn` nas variantes `--danger` e
`--danger-ghost` (com `--sm` onde o canvas manda), o `tf-dialog` para as confirmações, o `tf-alert` no tom
`danger` para o erro pós-tentativa e no tom `info` para o aviso de item referenciado, e o `tf-spinner`
dentro do botão no estado carregando. A razão de bloqueio é texto de apoio, não um componente novo.

## Perguntas em aberto para o dono
1. O rótulo branco sobre o vermelho base reprova o contraste AA (~4,0:1 medido, rótulo de 16px). Aceita
   trocar o **repouso** do sólido para o vermelho profundo (que já é o hover, ~5,9:1) — o que muda a cara do
   botão em cinco telas já homologadas — ou mantemos e registramos a exceção?
2. Regra única para o **gatilho** de exclusão fora do diálogo: hoje convivem lixeira-ícone cinza
   (Simulações), botão cinza (Histórico) e vermelho cheio (registro pendente), e o canvas 018 usa o
   contornado. Padronizamos tudo no contornado, inclusive na lista de Simulações?
3. "Descartar" e "Excluir" são dois verbos para duas coisas diferentes (o que nunca chegou à conta vs. o que
   já está salvo). A distinção é intencional e fica, ou unificamos em "Excluir"?

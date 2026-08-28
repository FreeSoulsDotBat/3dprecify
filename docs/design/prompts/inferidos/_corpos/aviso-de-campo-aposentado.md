# Aviso de campo aposentado ao reabrir uma simulação antiga

## O que desenhar

O bloco de aviso que aparece na tela **Calcular preço** quando o vendedor reabre uma simulação salva
antes da mudança do modelo de preço (pricing-core 4.0.0), e que por isso carregava um campo que o
modelo atual não usa mais — hoje apenas "Desperdício (g)". A peça é um bloco informativo permanente
(não um toast) que fica logo abaixo da barra da simulação carregada e permanece na tela enquanto
aquela simulação estiver aberta. Quem a lê é o vendedor que acabou de abrir uma estratégia guardada e
está olhando um preço que **mudou sozinho** desde o dia em que ele salvou. Esse é o momento em que a
confiança no número está mais frágil na jornada inteira, e este bloco é a única explicação que existe.

## Por que este prompt existe

Nada disso foi desenhado. O bloco nasceu de um requisito de texto (016/US10, FR-913) e a IA decidiu
tudo o que é visual: que seria um alerta permanente e não um toast, que usaria o tom `info`, e que
ficaria empilhado no topo da página — exatamente onde já podem competir a barra de simulação, o resumo
de kit, o teaser de Premium e o card de erro do seletor de catálogo. Autoridade de desenho: **NENHUMA**
— confirmado por verificação adversarial contra os protótipos de 2026-07-02, o `prototype-audit`, o
`.design-import` e o canvas do 018; nenhum deles trata de migração de modelo de preço na interface. O
mais próximo é um item de "carimbo de versão da fórmula" no Histórico, que é outra coisa.

## O que já existe hoje (não invente do zero — corrija)

Ordem real da pilha do topo da página `Calcular preço`, de cima para baixo:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Título da página (centralizado) | "Calcular preço" |
| 2 | Legenda freemium (centralizada, corpo pequeno) | "Calcular custo e markup é grátis, sem limite. Vender em marketplaces, salvar e exportar fazem parte do Premium." |
| 3 | Botão fantasma alinhado à direita, com ícone | "Minhas simulações" |
| 4 | Barra da simulação carregada | "Simulação: {nome}" · "Recalculado com os preços de hoje" · selo "Alterações não salvas" · "Abrir origem" · "Fechar simulação" |
| 5 | **ESTA PEÇA** — bloco `info` | "O documento salvo continha Desperdício (g). O modelo de preço atual não usa mais esse campo — o recálculo abaixo não o inclui." |
| 6 | (só se a base for kit) gêmeo do mesmo aviso + resumo do kit | mesma frase acima · "Kit: {nome}" · "Preços por canal do kit, recalculados com os preços de hoje." |
| 7 | (às vezes) card de teaser Premium | bloco de compra com preço e "Assinar" |
| 8 | (às vezes) card de erro do seletor de catálogo | bloco `danger` com botão de repetir |

O bloco de hoje usa o primitivo `tf-alert--info`: superfície tingida suave (`--tf-info-soft`), ícone
`info` de 20px em `--info-text`, corpo em `--text-body` no tamanho `body-sm`, padding `space-4`,
canto `radius-md`, ícone e texto separados por `space-3`. Largura: a coluna da página (460px no
mobile, até 1120px a partir de 1024px), com `space-4` de respiro entre cada item da pilha.

Problemas que o desenho precisa resolver:

- → O bloco **não tem título**. O primitivo tem um slot de título em negrito e ele está vazio: a frase
  inteira chega como um parágrafo de corpo pequeno, sem hierarquia, no meio de até três outros blocos
  de tom suave. Nada nele diz, em uma linha, "seu preço mudou e aqui está o motivo".
- → A frase explica o que o sistema fez ("o recálculo abaixo não o inclui") e **nunca diz a
  consequência** para o vendedor: que o preço exibido pode ser diferente do que ele salvou. É a
  informação que ele está procurando e ela não está escrita.
- → "O documento salvo" é linguagem de sistema. O vendedor salvou uma **simulação**, não um documento.
- → O campo "Desperdício (g)" não existe mais em lugar nenhum do formulário abaixo. O aviso cita um
  campo que o leitor não consegue localizar na tela, e não há nenhuma âncora visual entre os dois.
- → No desktop o bloco vira uma faixa de até 1120px com uma sentença curta: comprimento de linha
  desconfortável e muito espaço vazio à direita do texto.
- → Quando a base é um kit, o mesmo aviso aparece com a mesma frase logo antes do resumo do kit — dois
  blocos de tom suave colados um no outro.

## Conteúdo e dados reais

- **A frase, verbatim (homologada em 016/T036):** "O documento salvo continha {campo}. O modelo de
  preço atual não usa mais esse campo — o recálculo abaixo não o inclui."
- **`{campo}`** é sempre o nome em pt-BR, nunca a chave técnica. Hoje existe **um único** valor
  possível: "Desperdício (g)". O código já junta vários nomes com vírgula — o desenho tem de sobreviver
  a "Desperdício (g), Perda de suporte (g), Taxa de secagem (R$)" sem quebrar.
- **Quando aparece:** só ao reabrir uma simulação salva antes do modelo atual. O caso comum, de longe,
  é **não aparecer nada** — um documento salvo depois da mudança nunca carrega campo aposentado.
- **Variante escalar** (base avulsa ou referência de produto): um bloco, abaixo da barra da simulação.
- **Variante kit**: mesmo bloco, mesma frase, declarado **uma única vez** para o kit inteiro mesmo que
  várias peças carreguem o campo — e posicionado entre a barra da simulação e o resumo "Kit: {nome}".
- **Persistência:** fica na tela enquanto a simulação estiver aberta. Some quando o vendedor usa
  "Fechar simulação". Não tem botão de fechar próprio hoje.
- **Números ao redor** que contextualizam a peça: o preço recalculado que aparece logo abaixo, no
  formato do produto — por exemplo R$ 24,24 sugerido no varejo. É esse número que mudou.

## Estados obrigatórios

1. **Repouso — variante escalar, um campo.** A frase completa com "Desperdício (g)".
2. **Repouso — variante kit.** A mesma frase acima do resumo "Kit: {nome}" e da legenda "Preços por
   canal do kit, recalculados com os preços de hoje." Mostre os dois juntos: a colisão é o problema.
3. **Vários campos aposentados.** Três nomes na lista, com quebra de linha, para provar que a frase
   respira. Nunca reticências, nunca corte.
4. **Ausente.** A mesma pilha do topo sem o aviso — o caso comum. Serve para mostrar que a inclusão do
   bloco não desloca nem esconde nada do que já estava ali.
5. **Empilhado com os vizinhos.** Uma prancheta com o pior caso real: barra da simulação + selo
   "Alterações não salvas" + este aviso + resumo do kit + card de teaser Premium. É a competição que a
   IA criou sem ninguém decidir, e é isso que o desenho precisa hierarquizar.
6. **Premium pausado.** A barra da simulação acima já diz "Premium pausado"; o aviso coexiste com ela.
   Mostre que os dois não viram a mesma mancha visual.
7. **Offline.** A simulação foi reaberta do cache; o aviso de campo aposentado continua válido e
   idêntico — ele não fala de rede, e nada aqui pode sugerir que a divergência veio de conexão.
8. **Tema claro e tema escuro** do estado 1, com o contraste do texto medido contra a superfície
   tingida real, não contra o fundo da página.

O bloco **não tem nada interativo hoje** — não desenhe hover, foco, pressionado ou desabilitado a menos
que você proponha uma ação (fechar, ou um link de "entender"). Se propuser, desenhe os estados dela e
diga que é proposta, não o que existe.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça foi construída e onde a coluna de 460px é o limite
  real. O piso medido deste projeto é **360px**; confira que a frase mais longa (três campos) não
  provoca rolagem horizontal nessa largura.
- **Desktop 1280px** — obrigatório: a página da calculadora se alarga para até 1120px a partir de
  1024px e o bloco acompanha. É o viewport em que o problema de comprimento de linha e de espaço
  morto aparece. (O redesenho 018 não tocou a calculadora — aqui ainda é coluna única centralizada.)
- 1920px é dispensável: acima de 1120px o bloco não cresce mais.

## Regras que o desenho não pode quebrar

- **A frase honesta vive em elemento de largura total.** Nunca dentro de placeholder, nunca truncada,
  nunca com `line-clamp`. Este projeto já pagou por uma frase de honestidade cortada pela metade.
- **Divergência dita, não escondida.** O aviso existe para explicar um preço que mudou. Ele não pode
  ficar secundário a ponto de ser ignorado, nem alarmante a ponto de sugerir que o número atual está
  errado — o número atual é o **certo**; o antigo é que era de outro modelo.
- **Falha de rede nunca vendida como outra coisa, e vice-versa.** Nada neste bloco pode insinuar
  conexão, sincronização ou perda de dados. Nada foi perdido: o documento salvo continua intacto.
- **Nada de data.** A superfície de simulações não exibe datas em lugar nenhum (a promessa é "recalcula
  com os preços de hoje"). Não invente "salvo em 12/07".
- **Nada de venda.** Este bloco não é lugar de CTA de Premium; ele já disputa espaço com um teaser.
- **Alvo tocável ≥44px** para qualquer ação que você proponha, e contraste medido contra a superfície
  tingida (`--tf-info-soft`), que é onde o texto de fato assenta.

## Armadilhas já pagas neste projeto

- **Rolagem horizontal medida nos DOIS eixos.** A lista de nomes de campo tem de quebrar linha; se ela
  empurrar a coluna, o headless não enxerga a barra clássica e o defeito passa.
- **Texto ocluso passa em teste.** `visível` não é propriedade do texto: o bloco não pode ficar atrás do
  cabeçalho fixo nem ser empurrado para fora da primeira dobra quando a barra da simulação cresce com o
  selo "Alterações não salvas".
- **Valor grande estoura a coluna.** A cadeia de flex desta página já cedeu uma vez a um preço
  astronômico; o corpo do alerta precisa poder encolher, não empurrar.
- **Um bloco a mais no topo é um bloco a menos de calculadora.** A primeira dobra desta página já foi
  corrigida uma vez por conter a afirmação errada de valor; empilhar mais um aviso permanente sem
  hierarquia repete o problema por outro caminho.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como primeira classe (o estado 8 em ambos, os demais
podem ficar só no escuro):

1. Mobile 390px — estado 1 (escalar, um campo).
2. Mobile 390px — estado 3 (três campos, frase longa).
3. Mobile 390px — estado 2 (kit: aviso + "Kit: {nome}" + legenda do resumo).
4. Mobile 390px — estado 5 (pilha do pior caso, com barra da simulação e teaser).
5. Mobile 390px — estado 4 (ausente), lado a lado com a 1 para comparar o deslocamento.
6. Desktop 1280px — estado 1 e estado 5.
7. Estado 8 — a 1 nos dois temas.

Reutilize os primitivos existentes; não crie novos. O bloco é o **`tf-alert` em tom `info`**, com o
ícone `info` de 20px que ele já traz e o **slot de título** que hoje está vazio — se você propuser um
título, ele entra ali, não em um elemento novo. A barra da simulação, o resumo de kit, o card de teaser
e o card de erro do seletor são componentes que já existem: desenhe-os apenas como contexto, sem
redesenhá-los. Se a sua solução for mudar o **lugar** do aviso (por exemplo, ancorá-lo junto ao preço
recalculado em vez da pilha do topo), mostre as duas versões e diga qual você defende e por quê.

## Perguntas em aberto para o dono

1. A frase deve dizer a **consequência** — que o preço recalculado pode ser diferente do que foi salvo
   — ou o dono prefere manter só a explicação técnica do descarte? Isso muda o título, o tom e o
   tamanho do bloco, e é decisão de produto, não de desenho.
2. "O documento salvo" fica ou vira "A simulação salva"? A frase atual é copy homologada em 016/T036;
   trocar palavra homologada é decisão do dono.
3. O aviso deve poder ser **dispensado** pelo vendedor (um "×" que o fecha para aquela simulação), ou é
   permanente por princípio enquanto a simulação estiver aberta? Hoje é permanente, por escolha da IA.
4. Quando a base é kit, o aviso deve continuar como bloco separado ou ser absorvido como uma linha
   dentro do resumo "Kit: {nome}"? São dois blocos de tom suave colados hoje.

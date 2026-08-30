# "Nome da peça no catálogo" — o campo que anuncia que a peça vai virar produto

## O que desenhar
Dentro da aba **Kits** (montagem de um kit peça por peça), cada peça é um card que se expande num
formulário longo (custos, tempo, markup, canais). No **fim** desse formulário expandido aparece — só
às vezes — um campo de texto chamado "Nome da peça no catálogo", às vezes precedido de uma frase de
aviso. Ele existe porque, ao salvar o kit, toda peça que **não** é uma referência viva a um produto
salvo é **materializada**: uma linha nova nasce no catálogo de Produtos do vendedor, com o nome que
estiver ali. Quem usa é o vendedor Premium montando ou reabrindo um kit, no momento em que ainda dá
para escolher o nome — depois de salvar, a peça já está no catálogo. O que precisa ser desenhado é
**a peça inteira desse anúncio**: como se diz que editar uma peça vinculada muda o destino dela, se
isso é um campo, um aviso ou um passo do salvar, e o que acontece com a hierarquia quando o campo
some sozinho.

## Por que este prompt existe
Nada disso foi desenhado. A auditoria confirmou: no protótipo desktop (`Abas-Desktop.dc.html`) o
aside de Kits tem exatamente três coisas — "Nome do kit", "Salvar kit" e a dica "Confira as peças
com aviso antes de salvar" — e o card da peça **não tem nenhum campo de nome**; grep por "Nome da
peça" e por "ajustou" no protótipo: zero. A auditoria de 2026-07-02 e o `.design-import/` também não
têm nada. A regra vem da ADR-0017 (decisão técnica) e do `ux-bom.md` (texto do designer-ux) —
nenhum dos dois é desenho. Resultado: um **efeito colateral real no catálogo do vendedor** (linhas
novas aparecendo em Produtos) hoje é comunicado por um campo que aparece e some sozinho no rodapé de
um formulário longo, precedido por uma legenda de 12px com o mesmo peso visual de outras quatro
legendas possíveis no mesmo card.

## O que já existe hoje (não invente do zero — corrija)
A regra que liga tudo (`kit-save.ts`): **uma peça só é salva como referência viva enquanto está
vinculada a um produto salvo E não foi tocada.** No instante em que o vendedor edita um campo de uma
peça vinculada, ela vira avulsa — e vai nascer no catálogo. Peça avulsa desde o início: idem.

Estado atual do bloco, na ordem em que aparece dentro do card expandido:

| Ordem | Elemento | Texto literal hoje | Problema |
|---|---|---|---|
| 1 | Frase de aviso (`<p>` 12px, cor `--text-muted`), só quando a peça **era** vinculada e foi editada | "Você ajustou esta peça — ela será salva como uma peça nova no catálogo." | → Mesmo peso, cor e tamanho de legendas neutras do mesmo card; é a única frase que anuncia uma **consequência** e não se distingue de um comentário |
| 2 | Campo de texto com rótulo | "Nome da peça no catálogo" | → Rótulo genérico: não diz *quando* nem *por que* esse nome importa. Não é marcado como obrigatório nem como opcional |
| 3 | Placeholder do campo | "Peça 1 · Kit suporte + base" (derivado: `Peça {n} · {nome do kit}`; sem nome de kit, só "Peça 1") | → **O placeholder não é dica, é o valor real.** Campo vazio = esse nome vai para o catálogo. Isso contraria a regra da casa ("frase honesta nunca vive em placeholder") |

O que o vendedor vê **depois** de salvar, no bloco de salvar (já existe e funciona): título "O que
este kit fez no seu catálogo", uma lista com "{nome} — criado no catálogo" / "{nome} — já existia no
catálogo, referenciado", e, quando houve referência, o alerta informativo "As peças referenciadas
usam os valores do produto que já estava salvo, não os que você digitou aqui." → esse é o **recibo**;
o que falta desenhar é o **anúncio antes**.

As outras legendas que disputam o mesmo card, todas em texto pequeno e cinza (é isso que achata a
frase do item 1):
- "{custo}/un · Total da linha (3×) R$ 405,00"
- "Quantidade 0 — não entra no total."
- o aviso de quantidade acima do teto (classe `tf-field__aviso`)
- "Confira os campos desta peça — ela não entra no total até ser corrigida."
- "Os valores atuais foram mantidos e continuam editáveis." (peça degradada)
- e, dentro do editor, o selo do vínculo: "do catálogo: Suporte de fone" / "do catálogo: Suporte de
  fone · ajustado por você"

→ O selo "· ajustado por você" e a frase "Você ajustou esta peça…" dizem a **mesma** coisa em dois
lugares distantes do mesmo card, com pesos diferentes e sem se referirem um ao outro.

## Conteúdo e dados reais
- **Campo**: texto livre, uma linha. Sem máscara, sem limite visível. Valor efetivo = o que foi
  digitado (com trim) **ou**, se vazio, o nome derivado "Peça {n} · {kit}".
- **Nome do kit** (campo do bloco de salvar, rótulo "Nome do kit", obrigatório, placeholder "Kit
  suporte + base") é a fonte do sufixo derivado: mudar o nome do kit muda o placeholder de **todas**
  as peças sem nome próprio, silenciosamente.
- **Quantidade** por peça: inteiro ≥ 0, unidade "un".
- **Dinheiro** no card, para calibrar a hierarquia: custo unitário e "Total da linha (3×)
  R$ 405,00"; no resumo do kit, "Total do kit" com Varejo R$ 24,24 e Atacado R$ 21,01.
- **Onde vive**: aba Kits. Mobile: lista de peças em coluna única, com o resumo do kit fixado no
  rodapé. Desktop (≥1280px): duas colunas — peças à esquerda, resumo + "Nome do kit" + "Salvar kit"
  numa coluna direita de 480px, grudada na rolagem.

## Estados obrigatórios
Desenhe **o card da peça expandido** em cada um destes, porque a diferença entre eles é justamente o
que nunca foi desenhado:

1. **Peça avulsa (nasceu manual)** — o campo aparece, sem a frase de aviso. É o caso "normal": ela
   sempre ia virar produto.
2. **Peça vinculada e intocada** — o campo **não existe**; o selo diz "do catálogo: Suporte de
   fone". Nada nasce no catálogo. Desenhe o card sem o bloco, para mostrar o contraste.
3. **Peça vinculada e editada (a transição)** — o selo vira "do catálogo: Suporte de fone · ajustado
   por você" e o bloco **aparece** com a frase "Você ajustou esta peça — ela será salva como uma peça
   nova no catálogo." Este é o estado central do prompt: desenhe como esse surgimento é percebido no
   meio de um formulário longo (o vendedor pode estar rolado longe dele).
4. **Volta atrás (revinculação)** — o vendedor escolhe de novo o produto no seletor "Usar produto
   salvo" e o bloco **desaparece** junto com o que ele tinha digitado. Desenhe o que fica no lugar:
   hoje não fica nada.
5. **Campo em repouso / foco / preenchido** — repouso mostra o derivado em cor de placeholder; foco
   com o anel do DS; preenchido com o nome do vendedor.
6. **Peça degradada** (o produto de origem foi apagado depois do kit salvo) — o card mostra "Os
   valores atuais foram mantidos e continuam editáveis." e a peça salva como avulsa: o bloco aparece
   com o nome que ela já tinha. Nunca dizer "removido/excluído".
7. **Peça inválida** — "Confira os campos desta peça — ela não entra no total até ser corrigida."
   convivendo com o bloco de nome no mesmo card.
8. **Premium pausado, kit reaberto** — a faixa "Premium pausado — você pode reabrir e recalcular
   este kit. Salvar precisa do Premium ativo." está no topo. O bloco de nome continua visível e
   editável (a ação de salvar é que responde honestamente ao ser tocada) — desenhe se ele deve
   mudar de tom aqui.
9. **Depois de salvar (recibo)** — o bloco "O que este kit fez no seu catálogo" com uma peça
   "criado no catálogo" e outra "já existia no catálogo, referenciado", mais o alerta informativo.
   Desenhe a ligação visual entre o anúncio (antes) e o recibo (depois).

## Viewports
- **Mobile 390px** — obrigatório: é onde o formulário é mais longo e onde o bloco fica mais
  distante do topo do card; e onde o rodapé fixado com o total do kit disputa espaço.
- **Desktop 1280px** — obrigatório: é o corte onde a coluna direita nasce (peças à esquerda,
  resumo/"Nome do kit"/"Salvar kit" à direita). A pergunta de layout muda: o anúncio pode viver
  perto do botão Salvar, ou só dentro do card da peça?
- 1920px opcional, só se a coluna de peças mudar de comportamento.

## Regras que o desenho não pode quebrar
- **Frase honesta nunca em placeholder.** O nome derivado "Peça 1 · Kit suporte + base" é o valor
  que vai para o catálogo — não pode ser comunicado apenas como texto cinza dentro do campo.
- **Nada nasce no catálogo em silêncio.** O vendedor tem de saber, antes de tocar em "Salvar kit",
  quantas peças vão virar produto e com que nomes.
- **Editar uma peça vinculada tem consequência, e ela é reversível.** O desenho deve dizer as duas
  metades: virou peça nova; dá para revincular.
- **Nunca punitivo.** Nada de "expirou", "bloqueado", "suspenso"; o Premium pausado é calmo e os
  dados continuam do vendedor.
- **Falha de rede nunca é "não é premium".** Se o catálogo de produtos não carregou, o seletor "Usar
  produto salvo" some — e o bloco de nome aparece por consequência. Isso não pode ler como decisão
  do vendedor.
- **Alvo ≥44px** para o campo e para qualquer ação nova; contraste medido contra o fundo real do
  card (o card já está sobre a superfície da página, não sobre o fundo base).

## Armadilhas já pagas neste projeto
- **Legenda de 12px cinza é onde as frases importantes morrem.** Este card já empilha até cinco
  legendas do mesmo tamanho e cor; a única que anuncia consequência não pode ser a sexta.
- **Prefixo duplicado.** O nome derivado já contém "Peça 1 · "; o cabeçalho do card também monta
  "Peça 1 · {nome}". Um nome derivado salvo e reaberto já produziu "Peça 1 · Peça 1 · Kit X".
- **Nome longo estoura coluna.** Um nome de peça digitado longo já derrubou o layout de um PDF de
  orçamento (colisão de glifos, invisível para teste de texto). Desenhe o campo, o recibo e o
  cabeçalho do card com um nome de ~60 caracteres real, não com "Peça 1".
- **Sufixo cortado.** Em 016, uma frase honesta colocada como sufixo de placeholder foi clipada e
  ninguém viu: frases honestas vivem em elemento de largura cheia.
- **Overflow horizontal medido em ambos os eixos.** O card expandido no mobile já é o lugar mais
  apertado do produto.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class, não uma variação de segunda):
1. Card da peça expandido, **mobile 390px**, nos estados 1, 2, 3 e 4 (avulsa · vinculada intocada ·
   vinculada-e-editada · revinculada), lado a lado para o contraste ficar legível.
2. O mesmo bloco em **desktop 1280px**, no layout de duas colunas, mostrando onde o anúncio vive em
   relação ao "Salvar kit" da coluna direita.
3. Estados 6, 7 e 8 (degradada · inválida · Premium pausado) — um card cada, mobile.
4. O recibo pós-salvar ("O que este kit fez no seu catálogo") ligado visualmente ao anúncio.

Reutilize os primitivos existentes, sem criar novos: `Card` (padding md) para a peça; `Field` com
`label`/`hint`/`required`/`optional` para o campo de nome — o `hint` é o lugar natural para tirar a
frase derivada de dentro do placeholder; `tf-input` dentro de `tf-inputwrap`; `Alert` com tom `info`
para o anúncio de consequência e para o recibo; `Badge` se a peça precisar de um selo "vai para o
catálogo" no cabeçalho do card; `Select` para "Usar produto salvo"; `Button` secundário/ghost para
qualquer ação de desfazer; `Icon` do conjunto existente. Se o anúncio precisar de um tom que o
`Alert info` não dá, proponha a variação **dentro** do Alert, não um componente novo.

## Perguntas em aberto para o dono
1. **Isto é um campo, um aviso ou um passo do salvar?** As três leituras são defensáveis: campo por
   peça (hoje), aviso agregado perto do "Salvar kit" ("2 peças vão virar produtos novos"), ou uma
   confirmação no momento de salvar, listando os nomes. Muda o desenho inteiro.
2. **O nome derivado deve ser pré-preenchido de verdade no campo** (texto real, editável, visível)
   em vez de ficar como placeholder? Isso torna o destino explícito, mas enche o formulário de
   nomes que o vendedor não escolheu.
3. **Revincular apaga o nome digitado.** Deve avisar antes ("você digitou um nome; ao usar o produto
   salvo ele será descartado"), guardar o nome para se o vendedor editar de novo, ou seguir
   descartando em silêncio?
4. **"Nome da peça no catálogo" é o rótulo certo?** Ele não diz que a peça *vai nascer* no catálogo.
   Alternativa a decidir pelo dono, não por mim.

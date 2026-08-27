# O anel de foco — a única pista de onde o cursor está

## O que desenhar
O indicador de foco de teclado (`:focus-visible`) do Precifica3D, peça por peça: botão, campo de
texto/número, campo em erro, pílula do grupo segmentado, chave (switch), cartão clicável, item do menu
de navegação, opção de lista (o seletor de categoria), botão de fechar de diálogo e de toast, e o link
ou botão "cru" que não veste nenhuma classe do DS. Não é uma tela: é um estado que aparece em TODAS as
telas — Calculadora, Catálogo, Kits, Orçamentos, Histórico, Conta — e é a única coisa que diz a quem
navega por Tab onde ele está. Quem usa: teclado, leitor de tela com foco visual, e qualquer pessoa num
desktop 1920px que prefira Tab a mouse (o público desktop cresceu com o 018).

## Por que este prompt existe
O anel TEM desenho — o token exportado do Claude Design (`.design-import/tokens/elevation.css`) crava
`--ring-width: 3px` com DUAS camadas (sólido + halo 28%), e o readme do kit diz literalmente "Focus:
visible 3px purple ring, :focus-visible only, never removed". O app divergiu conscientemente: redefiniu
`--ring-width: 2px` com UMA camada só, com o motivo escrito no comentário ("the former double-layer read
as a double border, so the halo is dropped"). Ou seja: **o código contraria uma regra de desenho
explícita, com justificativa, e ninguém decidiu qual das duas vale.** O que não tem desenho em lugar
nenhum é o foco POR PEÇA: nenhuma das 6 telas do ui_kit e nenhum quadro do canvas renderiza um estado de
foco. Foi nesse vazio que nasceram **cinco linguagens diferentes** de foco, cada uma inventada no
arquivo onde a anterior não servia.

## O que já existe hoje (não invente do zero — corrija)

As cinco linguagens vivas, todas em `:focus-visible`, todas com 2px:

| Peça | Como o foco aparece hoje | Cor |
| --- | --- | --- |
| Campo (`.tf-inputwrap:focus-within`) | anel EXTERNO 2px colado na borda + a própria borda repintada da cor do anel, para lerem como um traço só | `--focus-ring` (claro `#7800ff` · escuro `#9a4bff`) |
| Campo em ERRO | anel de 2px vermelho translúcido (38%), borda continua vermelha — o roxo não entra | `--danger` a 38% |
| Botão `.tf-btn`, cartão clicável, X do diálogo, X do toast, trilho do switch, opção do seletor de categoria | o MESMO anel externo 2px do campo | `--focus-ring` |
| Link/botão "cru" (sem classe do DS) | contorno 2px **afastado 2px** da peça — outra forma, não o anel | `--focus-ring` |
| Pílula do grupo segmentado | contorno 2px afastado 2px, e usando um token DIFERENTE | `--accent` (`#7800ff` nos DOIS temas) |
| Item do menu (`.tf-nav__item`) | anel **INTERNO** 2px abraçando a forma arredondada do item + fundo `--accent-soft` | `--focus-ring` |

→ **Problema 1 — a espessura.** A marca especificou 3px + halo; o app entrega 2px sem halo. Precisa de
uma decisão desenhada, não de dois arquivos discordando.

→ **Problema 2 — três formas para a mesma ideia** (anel externo colado · contorno afastado 2px · anel
interno). Cada uma nasceu de um motivo REAL e bom, que o desenho tem de honrar em vez de apagar:
o afastado existe porque uma troca de fundo sumiria justamente no item já selecionado; o interno existe
porque no menu o item ativo já é um fundo suave e um anel externo repintava a "caixa roxa" que o dono
reclamou — sem ele, focar um item já ativo não mudava NADA na tela.

→ **Problema 3 — o segmentado usa `--accent`, não `--focus-ring`.** No tema escuro `--accent` continua
`#7800ff` enquanto `--focus-ring` clareia para `#9a4bff` — o anel do segmentado é o único que fica roxo
escuro sobre bandeja escura. Medir contra o fundo real (`--bg-muted` / `--surface-raised` no escuro).

→ **Problema 4 — peça sem foco nenhum.** O "abrir/fechar" da árvore do seletor de categorias
(`.category-picker__expand`) só troca a cor do texto no foco. Cor como único sinal, e fraco.

→ **Problema 5 — o botão de fechar.** X do diálogo e X do toast usam o anel externo colado; num canto,
2px de anel externo podem cair fora da caixa arredondada e ser cortados.

## Conteúdo e dados reais
A peça não tem texto próprio. O que ela precisa respeitar como contexto:
- Alturas de controle **36 / 48 / 56px**; alvo mínimo **44×44px**; raios **6 (xs) / 14 (md, campos e
  botões) / 18 / 24 / pílula**. O anel acompanha o raio da peça, pílula inclusive.
- Cores do anel: claro `--focus-ring: #7800ff`; escuro `--focus-ring: #9a4bff`. Fundos sobre os quais o
  anel realmente aparece: claro `#ffffff` (cartão) e neutro-100 (`--bg-muted`); escuro `#14151a`
  (`--surface-card` E `--bg-muted` — são o MESMO valor) e neutro-800 (`--surface-raised`).
- O trilho do switch tem 44×24px com polegar de 20px dentro de um alvo de 44×44 — o anel envolve o
  TRILHO, não o alvo invisível.
- Campos que recebem foco carregam dinheiro em fonte tabular alinhada à direita, com prefixo e sufixo
  dentro da moldura: `R$ 1.234,56`, `R$ 24,24`, `R$ 16,16`. O anel envolve a moldura inteira (prefixo +
  número + sufixo), nunca só o número.
- Pílulas do segmentado hoje: rótulos curtos ("Escuro" / "Claro" / "Sistema", abas da Conta), com ícone
  opcional de 16px à esquerda, dentro de uma bandeja que ROLA na horizontal quando não cabe.
- Alto contraste do Windows (`forced-colors`): o anel de sombra some, e hoje só link/botão/campo e o
  item do menu têm substituto (contorno 2px na cor `Highlight`). Desenhar como cada peça se comporta
  quando o sistema decide as cores.

## Estados obrigatórios
- **Repouso** — nenhum anel. Nunca desenhar foco permanente.
- **Foco de teclado (`:focus-visible`)** — o estado central deste prompt, em cada peça da tabela acima.
- **Foco + hover** — o mouse já mudou fundo/borda (o botão secundário troca `--border-default` por
  `--border-strong`; a opção de lista ganha `--bg-muted`); o anel continua legível por cima disso.
- **Foco + pressionado** — o botão encolhe (escala 0,97) enquanto apertado; mostrar o anel acompanhando
  a escala sem "descolar" da peça.
- **Foco + selecionado/ativo** — a pílula já selecionada (fundo em relevo + sombra) e o item de menu já
  ativo (fundo suave). Se o foco não for VISÍVEL nesses dois, o desenho falhou.
- **Foco + erro** — campo inválido: borda vermelha mantida, anel vermelho translúcido, mensagem de erro
  abaixo. O roxo não pode voltar por cima do vermelho.
- **Foco + aviso de plausibilidade** — o campo aceita o número e mostra um aviso em tom `info` no hint;
  o anel de foco é o roxo normal, nunca o vermelho (o número não foi recusado).
- **Desabilitado** — não recebe foco: opacidade 0,55 e cursor bloqueado. Desenhar para deixar explícito
  que a ausência de anel ali é intencional.
- **Foco programático em elemento não interativo** — o `<h1>` que recebe foco a cada navegação **não
  mostra anel nenhum** (é afordância de leitor de tela, não escolha do usuário). Manter assim.
- **Alto contraste forçado** — contorno de cor do sistema, sem sombra.
- **Movimento reduzido** — o anel aparece sem transição.

## Viewports
- **Mobile 390px** — o anel existe no mobile (teclado externo, navegação assistiva e o próprio
  navegador). Interessa aqui o que ENCOSTA na borda: campo de largura total, cujo anel externo de 2–3px
  mais o afastamento não podem criar transbordo horizontal na página.
- **Desktop 1280px** — o corte do 018: barra de navegação lateral focável, lista à esquerda, ficha à
  direita. É o viewport onde a jornada por Tab é real.
- **Desktop 1920px** — a autoridade de layout do 018; mostrar o percurso completo de Tab numa tela
  (barra → cabeçalho → lista → ficha) para provar que o anel é achável em qualquer densidade.

## Regras que o desenho não pode quebrar
- Foco só em `:focus-visible`. **Nunca removido** — remover é defeito duro, não escolha estética.
- O anel precisa ser visível sobre o **fundo real** de cada peça, medido — e no escuro `--surface-card` e
  `--bg-muted` são o mesmo `#14151a`, então "escureceu um pouco" não é sinal.
- O foco jamais pode ser transmitido só por **cor de texto** (WCAG 1.4.1) nem ficar abaixo de 3:1 contra
  o vizinho (1.4.11).
- O anel não pode se confundir com **erro** (vermelho) nem com **selecionado** (fundo em relevo). Três
  significados, três leituras distinguíveis.
- Alvo de toque **≥44px** continua valendo com o anel desenhado; o anel não substitui área clicável.
- O anel segue o raio da peça — nada de retângulo duro sobre pílula.
- Regra de honestidade da casa: se o anel some em alguma situação, ela é justamente a que deve ser
  desenhada (item já ativo, fundo igual ao da peça, tema escuro, canto cortado).

## Armadilhas já pagas neste projeto
- **Duas bordas.** O halo de 2 camadas leu como borda dupla no campo; e no escuro a borda de destaque
  (`#7800ff`) diferia do anel (`#9a4bff`), o que também virou borda dupla. Por isso hoje a borda é
  repintada da cor do anel. Qualquer desenho novo tem de mostrar borda + anel JUNTOS, não o anel isolado.
- **A "caixa roxa" no menu.** Um anel externo no item de navegação foi reclamado pelo dono; a correção
  foi o anel interno. Não reintroduzir a caixa externa.
- **O selecionado invisível.** No escuro, a pílula selecionada era o mesmo `#14151a` da bandeja —
  contraste 1,00:1, pílula inexistente na tela. Um foco feito por troca de fundo teria o mesmo destino.
- **Transbordo horizontal medido.** A página não pode rolar na horizontal; um anel afastado num elemento
  colado na borda de um 390px é candidato a criar exatamente isso.
- **Estado ocluso passa em teste.** Asserção de presença aprova elemento coberto ou cortado — o anel se
  homologa por imagem e por geometria, nunca por "o elemento está lá".
- **Sombra some em alto contraste.** Anel feito de sombra desaparece em `forced-colors`; hoje há
  substituto só para parte das peças.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro como igual** (cada prancheta nos dois):
1. **Catálogo de foco por peça** — repouso e foco lado a lado, com a medida do anel anotada: `tf-btn`
   (primário, secundário, fantasma, perigo), `tf-inputwrap` (normal, com prefixo `R$`, em erro),
   `tf-segmented` (item comum e item já selecionado), `tf-switch` (ligado e desligado),
   `tf-card--interactive`, item do menu (comum e já ativo), opção de lista do seletor de categoria, X de
   diálogo, X de toast, e o link/botão cru.
2. **A decisão da espessura** — 2px camada única × 3px sólido + halo 28%, na MESMA peça, nos dois temas,
   sobre `#14151a` e sobre branco, para o dono escolher olhando.
3. **Percurso de Tab em 1280px** — uma tela real do 018 com a ordem de foco numerada, provando que o
   anel é achável em cada parada.
4. **Casos adversos** — foco sobre item já ativo, foco sobre campo em erro, foco em peça encostada no
   canto (X do diálogo), foco em alto contraste forçado, foco em 390px colado na borda.

Reutilizar os primitivos `tf-*` existentes; nenhum primitivo novo. O anel é um ESTADO deles: `tf-btn`,
`tf-field`/`tf-inputwrap`, `tf-segmented`, `tf-switch`, `tf-card`, `tf-toast`, `tf-dialog` e o item de
navegação do app. Se o desenho concluir que alguma peça precisa de forma própria de foco, dizer POR QUÊ
na prancheta — a regra é uma linguagem só, com exceções justificadas e escritas.

## Perguntas em aberto para o dono
1. **2px ou 3px?** O token exportado diz 3px + halo; o app diz 2px sem halo, e o comentário defende a
   escolha. Uma das duas fontes precisa deixar de ser verdade.
2. **Uma linguagem só, ou três com regra?** Aceita-se "anel colado nas peças de superfície, contorno
   afastado nas pílulas, anel interno no menu" como REGRA desenhada — ou o desenho deve unificar tudo?
3. **O segmentado migra de `--accent` para `--focus-ring`?** Isso muda a cor do anel dele no tema escuro
   (de `#7800ff` para `#9a4bff`).
4. **O "abrir/fechar" da árvore de categorias ganha anel?** Hoje só muda a cor do texto.
5. **Existe um "pular para o conteúdo"?** Não há nenhum no app; sem ele, todo Tab de toda página começa
   percorrendo a navegação inteira. É decisão de produto, não de estilo.

# Tempo de impressão em horas + minutos

## O que desenhar
O campo em que o vendedor informa quanto tempo a peça fica na impressora. Ele vive na aba **Calcular**, dentro do card **"Custos da peça"**, logo abaixo da grade de campos numéricos (Custo do rolo · Peso do rolo · Gramas usadas · Consumo médio · Tarifa de energia) e logo acima do bloco da máquina ("Com que frequência ela roda?"). É um controle de largura inteira do card, com **dois campos numéricos lado a lado** — horas e minutos — sob **um único rótulo, um único hint e um único erro**. É o campo que multiplica o custo de máquina e o custo de energia: um engano aqui não aparece como erro, aparece como preço. O usuário é o vendedor leigo, que na prática está copiando o tempo estimado do fatiador (PrusaSlicer, Cura, Bambu Studio) para dentro do app.

## Por que este prompt existe
A forma deste campo nunca foi desenhada — foi decidida em código. O protótipo de 2026-07-02 (`CalculatorScreen.jsx`, §E4 das autoridades) tem **um** campo decimal, rótulo "Horas", unidade "h", placeholder "0,0", dentro da colapsável Energia. O par h+min, o parser de relógio (`2:30`) e o rascunho de digitação **não existem em desenho nenhum** — nem no canvas 018, que não cobre Calcular. Foi inferido: que são dois campos e não um; a proporção entre eles (nenhuma — os dois herdam o mesmo `flex`, sem razão declarada); o que um rótulo/erro/hint compartilhado por dois controles deve parecer; e o que a interface mostra **durante** a digitação. O preço já cobrado por essa ausência: digitar `2:30` virava **30 horas** — 60× o valor pretendido, em silêncio. Só um review de PR pegou; a homologação visual foi cega ao defeito.

## O que já existe hoje (não invente do zero — corrija)

| Parte | Como está hoje | Texto literal |
|---|---|---|
| Rótulo do par | Um só, acima dos dois campos, com asterisco de obrigatório | `Tempo de impressão` + `*` |
| Campo esquerdo | `NumberField` com sufixo de unidade, texto alinhado à direita, tabular | unidade `h`, placeholder `0`, nome acessível `Horas de impressão` |
| Campo direito | `NumberField` idêntico | unidade `min`, placeholder `0`, nome acessível `Minutos de impressão` |
| Arranjo | `flex`, `gap` de 8px, **sem proporção declarada** | — |
| Hint | Só existe quando dispara o aviso de plausibilidade (>100 h) | ver abaixo |
| Erro | Linha abaixo, tom `--danger` | `Campo obrigatório.` / `Não pode ser negativo.` |

→ **Os dois campos têm exatamente o mesmo peso visual.** Horas e minutos não são grandezas equivalentes: horas carrega o custo, minutos é o ajuste fino. Nada no desenho atual diz qual é qual além do sufixo minúsculo `h`/`min` em `--text-muted`.
→ **O campo aceita `2:30`, `2h30`, `2h30m` e `2h 30m` no campo de HORAS — e nada na tela conta isso.** É a porta de entrada mais usada (é o formato que o fatiador imprime) e é invisível.
→ **Este é o único campo do card sem tooltip `ⓘ`.** Todos os vizinhos ganharam um `InfoTip` na linha do rótulo (US6); este não tem `labelAddon` nenhum.
→ **A borda dos dois campos NUNCA fica vermelha.** O erro é renderizado como texto abaixo, mas o estado de erro não chega aos controles — a mensagem aparece sem que nenhum campo se identifique como o culpado.
→ **O campo nunca fica vazio.** Apagar tudo devolve `0`; logo o placeholder `0` é decorativo e a mensagem `Campo obrigatório.` é inalcançável pela digitação.

## Conteúdo e dados reais
- **Horas**: inteiro ≥ 0, sem casa decimal (digitar `2,5` não é aceito como decimal). Valor semente do formulário: **5 h**. Aceita também relógio: `2:30`, `2h30`, `2h30m`, `2h 30m` (minutos de 1–2 dígitos, no máximo 59 nessa forma).
- **Minutos**: inteiro ≥ 0. **Não é travado em 59**: `2 h` + `90 min` é normalizado na hora para **3 h 30 min** — o número que a pessoa digitou desaparece e outro aparece no lugar.
- **Leitura de volta**: um orçamento salvo com 5,5 h reabre mostrando `5` e `30`. Um documento com valor ruim/vazio reabre como `0`/`0`, nunca como texto quebrado.
- **Aviso de plausibilidade** (acima de 100 h), tom `info`, nunca vermelho, e o número **não é recusado**:
  `Confira o tempo: 150 horas equivalem a 6,3 dias imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado.`
- **Faixa real de uso**: peças pequenas 0 h 45 min; peças grandes 18 h; lotes noturnos 30–40 h. Acima de 100 h é quase sempre minutos digitados no campo errado.
- **O que este campo produz**: horas decimais para o motor de cálculo. Ele multiplica o custo de máquina e o de energia — 5 h a R$ 0,92/h de máquina + 0,15 kW × R$ 0,89/kWh dão algo como **R$ 5,27** no custo da peça. O campo não mostra esse dinheiro; o card "Como chegamos no preço" mostra.

## Estados obrigatórios
1. **Repouso preenchido** — `5` h / `30` min, sufixos legíveis, números alinhados à direita.
2. **Repouso "zerado"** — `0` / `0` (o estado real de um formulário limpo; não existe estado vazio).
3. **Foco** — anel de foco no campo focado apenas, borda na cor do anel (um traço só, nunca borda dupla); o outro campo permanece em repouso, e o rótulo compartilhado precisa continuar dizendo a que par ele pertence.
4. **Digitando um relógio (estado intermediário)** — o texto `2:` / `2h` fica na tela e **nenhum número é recalculado ainda**. Este estado existe hoje e não tem tratamento visual algum. Precisa de um: a pessoa precisa saber que o app está esperando ela terminar, não que ela quebrou o campo.
5. **Relógio reconhecido** — `2h30` se torna `2` no campo de horas e `30` no de minutos. A transformação acontece e nada a confirma. Desenhe a confirmação.
6. **Minutos transbordando** — `90` min vira `1 h 30 min` somado às horas. Mesma exigência: dizer o que aconteceu.
7. **Hover** — borda mais forte, por campo, não pelo par.
8. **Desabilitado** — fundo esmaecido, cursor negado (aplica quando o par é usado em contexto somente-leitura).
9. **Aviso de plausibilidade** — a frase acima, em tom `info`, abaixo do par, ocupando a **largura inteira do card** (nunca dentro do input, nunca truncada).
10. **Erro** — `Campo obrigatório.` ou `Não pode ser negativo.` abaixo do par, substituindo o hint, com os dois controles marcados em vermelho (hoje não são).

## Viewports
- **390px (mobile)** e **360px (o piso já medido do projeto)** — é onde o par disputa espaço: dois inputs com sufixo, dentro de um card com `padding`, mais o rótulo e a linha de aviso. Obrigatório.
- **1280px (desktop)** — a Calcular desktop é de duas colunas; o card "Custos da peça" ocupa uma coluna de ~560–640px, **não a tela toda**. Desenhe o par nessa largura, não esticado: dois campos de 300px cada para dizer "2h30" é ridículo, e essa é exatamente a decisão que ninguém tomou.
- Não há versão exclusiva de desktop nem de mobile: é o mesmo componente nos dois.

## Regras que o desenho não pode quebrar
- **Aviso não é erro.** A frase dos 100 h é `info`, jamais `danger`, e termina em "Nada foi recusado." — pintá-la de vermelho diria o contrário do que ela está escrita para dizer.
- **A frase honesta nunca mora num placeholder.** Placeholder carrega número; explicação carrega elemento de largura inteira. (Regra paga em 016.)
- **Nenhuma normalização silenciosa.** Se o app mexer no número que a pessoa digitou (relógio reconhecido, minutos ≥ 60), a tela diz. Um campo que engole a entrada em silêncio é pior que um que recusa.
- **Alvo de toque ≥ 44px** em cada um dos dois campos, inclusive a 360px.
- **Sem overflow horizontal.** Um valor de 6 dígitos no campo de horas (`100000`) tem que caber ou truncar de forma medida — não empurrar o sufixo `h` para fora do card.
- **Contraste medido contra o fundo do card** (`--surface-card`), não contra o fundo da página: os sufixos `h`/`min` são o texto mais fraco da peça.
- Sem freemium aqui: este campo é gratuito e igual para todo mundo.

## Armadilhas já pagas neste projeto
- **O defeito de 60×**: `2:30` funcionava colado e não funcionava digitado, e o resultado silencioso era 30 horas. Qualquer desenho que não dê feedback ao estado intermediário reabre essa porta.
- **`2h30m` preservando os minutos antigos**: a versão anterior do parser recusava o sufixo `m` e mantinha o número velho — recusar é aceitável, recusar e ficar com outro número não é.
- **A grade de custos que clipava 1px do input** ("Tarifa de energia"): sufixo largo + prefixo + coluna estreita já estouraram uma vez. O par h+min tem dois wrappers com sufixo na mesma linha.
- **Texto ocluso passa em teste**: `toBeVisible` não enxerga um sufixo empurrado para fora da caixa. A prancheta precisa mostrar a geometria real a 360px, não uma aproximação confortável.
- **Homologação cega**: este campo específico já passou por homologação visual sem que ninguém visse o erro de 60×. O desenho tem que tornar o erro visível a olho nu.

## Entregável
Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:
1. O par em repouso a 390px, dentro do card "Custos da peça", com o campo anterior e o posterior visíveis para dar contexto de ritmo vertical.
2. A matriz de estados do par a 390px: repouso zerado · foco no campo de horas · digitando `2:` (intermediário) · relógio reconhecido · minutos transbordando · aviso de plausibilidade · erro.
3. O par a 1280px na coluna de ~600px, com a proporção horas:minutos que você propuser, declarada em números.
4. Um recorte a 360px com `100000` no campo de horas e o aviso completo abaixo, provando que nada estoura.

Reutilize os primitivos: o wrapper é o `Field` do DS (rótulo + `*` de obrigatório + hint + erro, com `labelAddon` livre à direita do rótulo caso proponha o `ⓘ`); cada campo é um `NumberField` com `unit` (`h` / `min`), números tabulares alinhados à direita; o aviso é a linha `tf-field__aviso` em tom `info`; o card é o `Card` de padding `md`. **Não crie um componente novo de time-picker, nem stepper, nem máscara** — o que falta aqui é forma e feedback, não um controle novo.

## Perguntas em aberto para o dono
1. **O atalho do fatiador deve ser anunciado?** Hoje `2:30` / `2h30` funciona e nada na tela conta. Vale uma frase fixa no hint (algo como "pode colar o tempo do fatiador: 2h30") — que custa uma linha permanente em todo formulário — ou fica como facilidade escondida?
2. **Este campo ganha o `ⓘ` que todos os vizinhos têm?** Se sim, o texto precisa ser escrito por você: o que é o tempo de impressão, de onde tirar, e por que ele mexe em dois custos ao mesmo tempo.
3. **Minutos ≥ 60 devem ser aceitos e transbordados (comportamento de hoje) ou recusados?** Aceitar é mais gentil com quem cola "150" pensando em minutos; transbordar sem avisar é o que a peça faz agora.
4. **Existe teto para horas?** Digitar `100000` é aceito hoje, só ganha aviso. Se houver um limite de negócio (48 h? 200 h?), ele muda o desenho do estado de erro.

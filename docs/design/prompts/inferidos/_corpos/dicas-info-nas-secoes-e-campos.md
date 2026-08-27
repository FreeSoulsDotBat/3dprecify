# Dicas ⓘ da calculadora — o gatilho, o cartão e a linha do rótulo

## O que desenhar
O sistema de dicas didáticas da calculadora: um glifo ⓘ que aparece (a) colado ao lado direito de cada **título de seção** e (b) à direita do **rótulo** de campos específicos, e o cartão flutuante que ele abre com 2 a 4 frases explicando *por que aquilo entra na conta* e *como o vendedor descobre o número dele*. Vive na aba **Calcular** (`/calcular`), a tela que o leigo abre primeiro, e reaparece integralmente dentro do editor de linha de kit (Premium). É o único lugar do produto onde o conceito é ensinado — quem nunca ouviu falar em "reserva de manutenção" ou "markup" só tem o ⓘ. Usado no meio do preenchimento, com o teclado aberto, normalmente na primeira vez que o vendedor esbarra num campo que não entende.

## Por que este prompt existe
Nada disso foi desenhado. O protótipo de 2026-07-02 usa `Tooltip` **uma única vez** e a §E4 (linha 234) fixa esse único hint: *Label do markup: "Markup"; hint: "Margem sobre o custo (não sobre o preço de venda)."* — e o `CalculatorScreen.jsx` (68-69) o colocava **dentro do `<label>`**, exatamente a construção que a homologação 016/B4 depois proibiu no app (um botão aninhado dobra o próprio nome no nome acessível do controle). A generalização para **6 títulos de seção** e **10 campos** foi decidida em código, caso a caso: densidade, tamanho do glifo, tom, e o lugar do gatilho. A passagem de "na linha do controle" para "na linha do rótulo" também foi correção de homologação (B4), não desenho — e ela nasceu de um defeito real: em "Tarifa de energia", com `R$` à esquerda e `/kWh` à direita, o ⓘ disputando a mesma linha deixou **1px de largura útil de input** a 360/390px.

## O que já existe hoje (não invente do zero — corrija)

**Seis títulos de seção, todos com ⓘ** (texto literal do título → nome acessível do gatilho):

| Título de seção | Rótulo do gatilho | O corpo explica |
|---|---|---|
| "Custos da peça" | "Sobre os custos da peça" | as 3 fórmulas: material, energia, máquina |
| "Mão de obra e custos" | "Sobre mão de obra e custos" | horas × valor da hora; outros custos |
| "Markup" | "Sobre o markup" | "Preço = custo total × (1 + markup%)" |
| "Como chegamos no preço" | "Sobre o cálculo do preço" | "Cada linha em reais soma exatamente ao custo total…" |
| "Marketplace" | "Sobre o marketplace" | "Anúncio = (preço + taxa fixa) ÷ (1 − comissão%)" |
| "Outros custos" | "Sobre outros custos" | itens nomeados que somam ao custo total |

→ **Problema 1 (o principal):** ⓘ em *praticamente todo* título. Nada distingue a seção que realmente precisa ensinar da que só herdou o padrão — "Como chegamos no preço" é, ela própria, a explicação, e ainda assim carrega um ⓘ.

**Dez campos com ⓘ no rótulo** (`fieldTips`), dos quais nove vivem nas grades de campos e um só aparece depois de "Ajustar horas direto":

| Rótulo visível | Prefixo/sufixo | Obrigatório | Rótulo do gatilho |
|---|---|---|---|
| "Gramas usadas" | `g` | sim | "Sobre as gramas usadas" |
| "Consumo médio" | `kW` | sim | "Sobre o consumo médio" |
| "Tarifa de energia" | `R$` + `/kWh` | sim | "Sobre a tarifa de energia" |
| "Vida útil da máquina" | `h` | sim (modo ajustar) | "Sobre a vida útil da máquina" |
| "Reserva de manutenção" | `R$` + `/h` | não → mostra "opcional" | "Sobre a reserva de manutenção" |
| "Taxa de falha" | `%` | não → "opcional" | "Sobre a taxa de falha" |
| "Tempo de acabamento" | `h` | não → "opcional" | "Sobre o tempo de acabamento" |
| "Valor do acabamento" | `R$` + `/h` | não → "opcional" | "Sobre o valor do acabamento" |
| "Mão de obra (horas)" | `h` | não → "opcional" | "Sobre a mão de obra (horas)" |
| "Valor da hora" | `R$` + `/h` | não → "opcional" | "Sobre o valor da hora" |

→ **Problema 2:** a linha do rótulo acumula três coisas que competem pela mesma largura numa grade de **duas colunas mesmo a 390px**: o rótulo (que reserva **duas linhas** de altura para manter os inputs alinhados), a palavra "opcional" empurrada para a direita, e o ⓘ. "Reserva de manutenção" quebra em duas linhas; "Mão de obra (horas)" quase.
→ **Problema 3:** o gatilho pinta 28×28px, mas a área de toque de 44px é um remendo assimétrico (estende −12px acima, −8px nos lados, −4px abaixo, porque abaixo há só 8px até o input). Isso é conta de sobrevivência, não desenho.
→ **Problema 4:** o mesmo glifo de 16px, com o mesmo botão de 28px, serve ao título de seção e ao rótulo de campo — não há hierarquia visual entre "esta seção inteira funciona assim" e "este campo significa isto".
→ **Problema 5:** o cartão mostra **só o corpo** — nenhum título visível. Quem vê "Sobre a tarifa de energia" é o leitor de tela; quem enxerga recebe um parágrafo solto.

## Conteúdo e dados reais
Os corpos são longos de propósito (todos ensinam a descobrir o número). Use estes textos verbatim nas pranchetas, sem reescrever:
- **Tarifa de energia:** "É o preço de cada unidade de luz — multiplicado pelas horas de impressão, vira o custo de energia da peça. Pegue sua conta de luz e divida o valor total pelos kWh consumidos no mês: esse é o preço real que você paga, já com impostos e bandeira. Sem a conta em mãos, a média do país fica perto de **R$ 0,85**." (esse R$ 0,85 é uma constante datada — projeção ANEEL dez/2026, revisão em 1º/jan.)
- **Vida útil da máquina** (o mais longo, ~330 caracteres, e o pior caso de altura do cartão): "…Fabricante não publica esse número: estime. Horas que você imprime por ano × anos até querer trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h."
- **Valor da hora:** "…quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.: R$ 3.000 ÷ 160 h = R$ 18,75."
- **Taxa de falha** (o mais curto): "…Ex.: 4 perdidas em 40 = 10%."

O cartão hoje: largura máxima `min(20rem, 100vw − 2 × gutter)`, corpo em `--fs-body-sm`, fundo `--surface-card`, borda `--border-subtle`, sombra média, seta apontando para o gatilho, lado preferido **acima** com 6px de folga e 12px de respiro contra a borda da tela. Nada disso vem da rede: **as dicas são texto estático**, sem carregamento, sem erro, sem gate de Premium.

## Estados obrigatórios
- **Repouso:** glifo em `--text-muted` sobre o fundo do cartão de seção. Quieto — é afordância inline, não controle primário.
- **Hover (só ponteiro fino):** glifo em `--accent-text` sobre `--accent-soft`, e o cartão **abre sozinho**. Em toque não existe hover: abre no tap.
- **Foco por teclado:** desenhe o anel de foco explicitamente — hoje ele é herdado e nunca foi especificado para um alvo de 28px com área de toque maior que ele.
- **Aberto/pressionado:** mesmo tratamento do hover; o cartão fica ancorado enquanto estiver aberto. Não é modal: nunca escurece nem bloqueia a página atrás.
- **Cartão acima × abaixo:** o lado padrão é acima; perto do topo ele vira para baixo. Desenhe os dois, com a seta.
- **Cartão colidindo com a borda a 390px:** encostado no respiro de 12px, com texto longo — o caso do "Vida útil da máquina".
- **Rótulo em duas linhas + "opcional" + ⓘ na mesma linha:** "Reserva de manutenção", coluna de ~165px.
- **Campo com aviso abaixo:** o ⓘ convive com um aviso de plausibilidade sob o input (ex.: "Confira o consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico…").
- **Campo com erro:** o erro **substitui** a legenda sob o campo ("Informe um número válido."); o ⓘ permanece intacto no rótulo.
- **Desabilitado / carregando / offline / Premium pausado: não existem aqui.** Não invente — a dica não depende de rede nem de assinatura, e fingir um estado seria mentir sobre a origem do texto.

## Viewports
- **390px (obrigatório):** é onde tudo dói — grade de duas colunas, teclado aberto, cartão de 20rem espremido. Desenhe também a seção "Custos da peça" inteira nesse tamanho, com todos os ⓘ visíveis ao mesmo tempo, para julgar densidade.
- **1280px (obrigatório):** a calculadora desktop redesenhada (018), onde existe hover real e o cartão tem espaço — decida se o comportamento muda ou se só respira.
- **360px:** não precisa de prancheta própria, mas é a largura de estresse que este projeto mede; se o desenho só cabe a 390, ele está errado.

## Regras que o desenho não pode quebrar
- O ⓘ mora na **linha do rótulo**, à direita do rótulo, **nunca na linha do controle** e nunca visualmente "dentro" do rótulo como se fosse parte do texto clicável dele — é irmão, não filho (B4: um botão aninhado no `<label>` corrompe o nome do controle).
- Alvo de toque **≥44×44px**, mesmo com o glifo pintando 28px — e a folga tem que caber sem colidir com o input logo abaixo (hoje sobram 8px).
- A dica **nunca altera cálculo nem validação**. Ela não pode parecer um botão de ação, um seletor ou algo que "aplica" o valor sugerido.
- Frase honesta **nunca dentro de placeholder** — os números de referência (R$ 0,85, salário mínimo por hora) vivem no corpo do cartão, em elemento de largura cheia, e devem se ler como *referência datada*, não como um valor que o app usou na conta.
- Contraste do glifo em repouso medido **contra o fundo real do cartão de seção** — em ambos os temas. `--text-muted` sobre `--surface-card` é o par a verificar.
- O cartão nunca ultrapassa a borda da tela a 390px, e nunca cobre o campo que ele está explicando enquanto o vendedor digita.

## Armadilhas já pagas neste projeto
- **1px de input** ("Tarifa de energia"): três afixos disputando uma linha numa coluna de metade de 390px. Qualquer desenho que devolva o ⓘ para perto do `/kWh` repete o defeito.
- **Elemento ocluso passa no teste**: `toBeVisible` é verdadeiro para um campo totalmente coberto pelo cartão da dica. Oclusão é geometria, não texto — desenhe onde o cartão pousa.
- **Escape que se desfaz sozinho**: fechar pelo teclado com o mouse parado sobre o gatilho reabria a dica imediatamente. Se o desenho depende de hover, ele precisa dizer o que acontece depois do Escape.
- **Rótulo que quebra e desalinha a grade**: os inputs de duas colunas só ficam alinhados porque o rótulo reserva duas linhas de altura. Um ⓘ que force uma terceira linha quebra o alinhamento inteiro.
- **Número que colide com outro número**: o tooltip da tarifa já disse R$ 0,85 enquanto o aviso do mesmo campo dizia R$ 0,95 — duas médias nacionais a uma tecla de distância.

## Entregável
Seis pranchetas, **tema escuro como padrão e tema claro como first-class** (as duas versões de cada uma):
1. **Anatomia do gatilho** — repouso, hover, foco por teclado, aberto; com a área de toque de 44px desenhada como overlay cotado sobre o glifo de 28px.
2. **O cartão** — corpo curto ("Taxa de falha") e corpo longo ("Vida útil da máquina"), lado acima e lado abaixo, com seta; e a decisão sobre título visível dentro do cartão.
3. **A linha do rótulo, os 4 casos difíceis** — "Tarifa de energia" (R$ + /kWh), "Reserva de manutenção" (2 linhas + "opcional"), "Taxa de falha" (%), "Gramas usadas" (g), na coluna estreita de 390px.
4. **Título de seção com ⓘ** — as 6 seções, mostrando a hierarquia proposta entre o ⓘ de seção e o ⓘ de campo.
5. **Densidade a 390px** — "Custos da peça" completa, todos os ⓘ ao mesmo tempo: o desenho que responde "quantos sobrevivem".
6. **1280px** — a mesma seção no desktop, com hover.

Reutilize os primitivos existentes, sem criar novos: o gatilho é `tf-infotip__trigger` com o `Icon name="info"` de 16px; o cartão é `tf-infotip__content` + `tf-infotip__arrow`; a linha do rótulo é `tf-field__label-row` (rótulo `tf-field__label`, asterisco `tf-field__req`, "opcional" `tf-field__optional`), e o controle é o `NumberField` com prefixo/sufixo. Se algum caso exigir um primitivo novo, diga qual e por quê em vez de desenhá-lo calado.

## Perguntas em aberto para o dono
1. **Densidade das seções:** ⓘ em todos os 6 títulos foi decisão de código, não sua. Quais seções realmente precisam ensinar? ("Como chegamos no preço" já é a explicação; "Markup" e "Marketplace" carregam fórmula.)
2. **O cartão mostra título visível?** Hoje o nome ("Sobre a tarifa de energia") existe só para leitor de tela; o vendedor vê um parágrafo sem cabeça.
3. **Os números de referência devem exibir data/fonte?** ("média do país perto de R$ 0,85" é projeção ANEEL dez/2026, revisável em 1º/jan.)
4. **No editor de linha de kit (Premium), a densidade é a mesma?** Lá os mesmos campos repetem várias vezes na tela, e com eles todos os ⓘ.
5. **No desktop, a dica precisa de um modo "fixado"** para o vendedor ler a conta enquanto digita, ou sair no primeiro movimento do mouse está certo?

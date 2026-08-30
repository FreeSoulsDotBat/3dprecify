# Aviso de plausibilidade — a mensagem que avisa sem recusar

## O que desenhar
A terceira categoria de mensagem de campo do Precifica3D: nem dica, nem erro. Ela aparece embaixo de um campo da tela **Calcular** quando o vendedor digita um número **perfeitamente válido que provavelmente significa outra coisa** — 120 no campo que pede kW (a etiqueta da impressora fala em watts), 3 no campo de vida útil que pede horas (ele pensou em anos), 0,12 no campo de comissão que pede 12. Nada é recusado: o formulário continua calculando e continua salvando. Quem a vê é o vendedor leigo, no meio da digitação, e é exatamente ele quem não vai reparar numa linha de texto pequena que só muda de cor. Desenhe **a categoria inteira**: o aviso num campo, o aviso convivendo com a dica do mesmo campo, o aviso morrendo quando entra um erro de verdade, três avisos ao mesmo tempo no formulário, o aviso de resultado (que hoje é outro componente) e o aviso na linha de peça de um kit.

## Por que este prompt existe
A peça nasceu em 2026-08-13 corrigindo nove achados de severidade ALTA de uma homologação automatizada, e nasceu **sem nenhum desenho**: a matriz de estados do design system só tem `error`, e os três documentos de correção pedem sempre *validação inline* — recusa, nunca aviso. Grep por "aviso"/"plausib" nas quatro autoridades de desenho: zero. O canvas 018 usa a palavra duas vezes, mas ali "peças com aviso" são peças **inválidas** de um kit, renderizadas em `tf-alert--danger` — é erro com outro nome. Ou seja: a defesa principal do usuário leigo contra erro de casa decimal foi inferida por uma IA e hoje existe como **uma cor de texto no lugar da dica, sem ícone, sem título, sem afordância**. Autoridade de desenho: NENHUMA.

## O que já existe hoje (não invente do zero — corrija)
O aviso ocupa o **slot da dica** do campo. Regras reais do código (`shared/ui/field.tsx`, `field.css`, `features/calculator/calculator-form.tsx`):

| Situação | O que a tela faz hoje |
| --- | --- |
| Campo com aviso, sem dica | uma linha de texto na cor `--info-text`, tamanho legenda, no lugar da dica |
| Campo com aviso **e** dica | a dica ganha linha própria e o aviso entra abaixo, com `space-1` de respiro |
| Campo com aviso **e** erro | → **o aviso some**: o `Field` troca a dica pelo erro. Só a recusa aparece |
| Aviso no resultado (preço zerado / custo absurdo) | um `tf-alert--info` de largura cheia, **com ícone**, texto de duas frases coladas |
| Aviso de quantidade na peça de kit | um parágrafo solto, fora do `Field`, em `text-sm` (maior que o do formulário) |

→ **Três problemas que o desenho tem de resolver.** (1) O aviso e a dica são o mesmo objeto visual, distintos só pela cor: quem lê rápido lê "mais uma explicaçãozinha cinza-azulada". (2) A mesma categoria fala em **duas línguas visuais** — no campo é texto puro sem ícone; no resultado é um `tf-alert--info` com ícone; na linha de kit é um terceiro tamanho. (3) As frases têm 150–230 caracteres em tamanho de legenda; com três campos avisando ao mesmo tempo, a seção "Energia" vira um muro de texto azul que ninguém lê.

→ Detalhe de acessibilidade lido no código: o aviso entra no `aria-describedby` do campo (é descrição, não status), então **ele não é anunciado quando aparece** — e ele aparece a cada tecla digitada, sem espera pelo `blur`. Quem digita `1200` passa por `120` e vê o aviso piscar no meio do caminho.

## Conteúdo e dados reais
As frases são homologadas e obedecem a três regras já decididas: **descritiva, nunca corretiva**; **toda frase termina em "Nada foi recusado."**; **toda frase ensina a converter**. Use-as literais no desenho (`{v}` = o valor digitado):

- Consumo médio (kW, obrigatório) → *"Confira o consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts: 120 W são 0,12 kW. Nada foi recusado."* Este campo **também tem dica**: *"Consumo médio real da impressora, não a potência de placa (~0,12 kW)."* — é o caso "dica + aviso juntos".
- Tarifa de energia (R$ /kWh, obrigatório) → *"Confira a tarifa: R$ 12 por kWh está bem acima do que se paga no Brasil (perto de R$ 0,85). Na conta de luz, divida o valor total pelos kWh do mês. Nada foi recusado."*
- Vida útil da máquina (h, obrigatório, **só existe no modo manual** — no modo "ritmo" o campo nem é montado) → *"Confira a vida útil: 3 horas é menos de uma semana ligada. Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Nada foi recusado."*
- Peso do rolo (kg, obrigatório) → *"Confira o peso do rolo: 1.000 kg. O rolo comum tem 1 kg — se você informou gramas, 1.000 g são 1 kg. Nada foi recusado."*
- Gramas usadas (g, obrigatório) → *"Confira as gramas: 60.000 g são mais de 50 kg de filamento numa peça só. Se você informou o peso do ROLO, o campo pede o que a PEÇA consome. Nada foi recusado."*
- Tempo de impressão (h + min, obrigatório) → *"Confira o tempo: 150 horas equivalem a 6,3 dias imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado."* (a frase mais longa da lista, e a de maior valor: 150 h por engano multiplica o custo por 15).
- Valor da hora (R$ /h, opcional) → *"Confira o valor da hora: R$ 3.000. Se você informou quanto quer ganhar por mês, divida pelas horas do mês — R$ 3.000 ÷ 160 h = R$ 18,75. Nada foi recusado."*
- Reserva de manutenção (R$ /h, opcional) → *"Confira a reserva de manutenção: R$ 1.200 por HORA. Se você informou o gasto do ano inteiro, divida pelas horas que imprime no ano. Nada foi recusado."*
- Comissão (%, opcional, dentro do cartão de canal) → *"Confira a comissão: 0,12%. Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."*
- Quantidade (peça de kit) → *"Confira a quantidade: 3.000.000.000. O máximo por peça é 2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."*
- No **resultado**, sem campo culpado: *"O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado."* e *"Confira os custos: R$ 6.000.061,6 para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado."* → hoje as duas frases são **concatenadas num único parágrafo** quando disparam juntas.

→ Repare no dinheiro: a formatação do valor digitado descarta os centavos — sai **"R$ 6.000.061,6"** e **"R$ 3.000"**, e não `R$ 6.000.061,60`. Está fora do padrão de dinheiro do produto; trate no desenho como texto a corrigir, não como fatalidade.

Textos de recusa que **substituem** o aviso, para o quadro de contraste: *"Informe um número válido."*, *"Não pode ser negativo."*, *"Campo obrigatório."*, *"A vida útil deve ser maior que zero."*, *"A comissão deve ser menor que 100%."*, *"O peso do rolo deve ser maior que zero."*

## Estados obrigatórios
1. **Repouso sem aviso** — campo normal, dica cinza (quando existe). É a linha de base contra a qual o aviso precisa se destacar.
2. **Aviso simples** — campo válido, valor implausível, sem dica. Ex.: Peso do rolo com 1.000.
3. **Aviso + dica** — Consumo médio: a dica em cinza numa linha, o aviso abaixo. As duas precisam ser distinguíveis sem ler.
4. **Aviso com o campo em foco** — o aviso aparece enquanto se digita; mostre como ele convive com o anel de foco e com o teclado virtual no mobile.
5. **Erro de verdade** — o aviso desaparece e entra a recusa em vermelho. Desenhe lado a lado com o estado 2 para provar que **aviso ≠ erro** no relance.
6. **Três avisos simultâneos** — a seção de Energia + a de Máquina avisando juntas. É o estado que ninguém desenhou e o que mais assusta.
7. **Aviso de resultado** — o bloco de largura cheia junto ao preço, com preço R$ 0,00; e a variante com as duas frases (preço zero + custo absurdo).
8. **Aviso na linha de peça de um kit** — o mesmo objeto visual dentro de um card menor, ao lado da legenda de custo da linha.
9. **Campo sem aviso possível** — modo "ritmo": a vida útil não é editável, então nem aviso existe. Mostrar para o desenho não presumir que todo campo tem o slot.
10. **Aviso com valor absurdamente longo** — "3.000.000.000" e "R$ 6.000.061,6" dentro da frase, no campo mais estreito.

## Viewports
- **Mobile 390px — obrigatório.** É onde o vendedor de verdade preenche, e onde a frase de 230 caracteres ocupa cinco linhas empurrando o campo seguinte para fora da dobra.
- **360px como teste de estresse** de uma prancheta só (o campo mais estreito, com o número mais longo): é a largura em que este projeto já mediu overflow horizontal duas vezes.
- **Desktop 1280px** — o formulário existe em duas colunas no desktop; o aviso não pode desalinhar a linha em que dois campos dividem a largura (a etiqueta já reserva duas linhas justamente para manter os inputs alinhados; o aviso, abaixo, é o novo risco).
Não precisa de 1920px: nada nesta peça muda entre 1280 e 1920 além da largura da coluna.

## Regras que o desenho não pode quebrar
- **Aviso nunca vira validação.** Nada de tom de recusa, nada de vermelho, nada que sugira que o campo foi rejeitado, nada que iniba o botão de salvar. É decisão registrada do dono, e a frase "Nada foi recusado." é essa promessa dita ao usuário — ela é obrigatória e **não pode viver dentro de um placeholder nem ser truncada com reticências**.
- **Aviso não é erro, e o desenho precisa provar isso sem cor**: se a única diferença entre os dois for a matiz, quem enxerga mal lê recusa onde não houve.
- **A frase ensina a converter** — o exemplo numérico ("120 W são 0,12 kW", "R$ 3.000 ÷ 160 h = R$ 18,75") é a parte útil da mensagem; não desenhe uma versão "resumida" que corte o exemplo.
- **Procedência do número**: o limiar tem origem real (5 kW = faixa de chuveiro; R$ 0,85/kWh = a mesma constante datada que o tooltip do campo usa). Se o desenho quiser mostrar o limiar, ele mostra o limiar — não inventa outro número.
- Qualquer afordância nova (fechar, "entendi", expandir) é **alvo de toque ≥ 44px** e não pode ficar por cima do campo.
- Contraste medido contra o fundo real do cartão nos **dois temas** — o azul de informação em texto de legenda é o candidato natural a reprovar.

## Armadilhas já pagas neste projeto
- **Frase honesta cortada**: já aconteceu de a frase de honestidade viver num elemento estreito e o sufixo sumir. "Nada foi recusado." é o fim de toda frase — é justamente o pedaço que um truncamento come.
- **Texto que passa no teste e não aparece na tela**: asserção de texto é cega a oclusão e a overflow. Desenhe caixas, não parágrafos soltos — e diga a altura máxima que o aviso pode ocupar antes de empurrar o resto.
- **Overflow horizontal medido a 360px** com número longo dentro da frase (hoje o texto quebra em qualquer ponto da palavra para evitar isso — no desenho, prefira que o número caiba).
- **Aviso que existe e nunca renderiza**: o aviso de vida útil ficou meses com limiar, frase e teste verdes e **nenhuma tela chamando** — porque o campo mora num controle próprio. Se o desenho tratar o aviso como propriedade do campo, deixe explícito que ele vale também para os campos "especiais" (tempo h+min, vida útil, comissão, quantidade de kit).
- **Um resumo que grita vira ruído**: um produto que avisa demais treina o vendedor a ignorar avisos. Se propuser um resumo no topo do formulário, ele tem de ser mais discreto que os avisos, não mais.

## Entregável
Pranchetas, tema **escuro por padrão e claro como first-class** (as duas versões de cada uma):
1. **Anatomia do aviso** — o objeto isolado, com e sem dica, medidas e hierarquia interna; ao lado, a mesma anatomia do erro, para o contraste ficar explícito.
2. **Campo em 390px** nos estados 2, 3, 4 e 5.
3. **Seção com três avisos simultâneos** em 390px (o muro de texto e a sua solução).
4. **Resultado com aviso** (preço R$ 0,00 e a variante de duas frases).
5. **Linha de peça de kit com aviso de quantidade.**
6. **Desktop 1280px** — a linha de dois campos em que só um avisa.
7. **Estresse 360px** com o número mais longo.

Reutilize os primitivos existentes, sem criar família nova: o campo é o `Field` (etiqueta + `labelAddon` do `?` + slot de mensagem); o texto do aviso é o slot de mensagem do próprio `Field`, não um bloco novo; o aviso de resultado é `tf-alert` no tom `info`; o ícone, se entrar, é o mesmo `Icon` do `tf-alert--info`; a cor é o token semântico de informação, nunca uma matiz crua. Se o desenho concluir que o aviso de campo precisa de ícone, **ele precisa ser o mesmo ícone do alerta de resultado** — a categoria é uma só.

## Perguntas em aberto para o dono
1. **Quando o campo tem erro E aviso, o aviso deve mesmo sumir?** Hoje some (a recusa come a dica inteira). É defensável, mas nunca foi decidido — e há o caso "vida útil = 0": a recusa diz "deve ser maior que zero" e a lição sobre anos×horas evapora.
2. **O aviso aparece a cada tecla ou só quando o vendedor sai do campo?** Hoje é a cada tecla, então ele pisca no meio da digitação de um número maior. Espera pelo `blur` é mais calma e chega mais tarde.
3. **O aviso pode ser dispensado ("entendi")?** E, se for, ele volta quando o valor é redigitado igual? Hoje não há nenhuma afordância — o aviso fica para sempre enquanto o número estiver lá.
4. **Com três ou mais avisos, existe algum resumo?** Um contador junto ao botão de calcular/salvar, uma marca na seção, ou nada — e, se existir, ele continua sendo aviso (não bloqueia o salvar).
5. **O aviso de campo ganha ícone, igualando-se ao de resultado, ou o de resultado perde o ícone, igualando-se ao de campo?** Hoje são duas línguas para a mesma categoria, e unificar é decisão de produto, não de layout.

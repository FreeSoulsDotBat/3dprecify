# Conteúdo dos tooltips didáticos — US6 / FR-908 (T023)

**Incremento**: 016-correcao-homologacao · **Fatia**: PR-C · **Data da pesquisa**: 2026-08-05/06
**Autorização**: dono autorizou pesquisa em fonte externa (US6-AC2).

**Regra que este arquivo cumpre (US6-AC2/AC3, Constituição II)**: cada tooltip responde, nesta ordem,
(a) *por que este número entra na conta* e (b) *como você descobre o seu*; toda afirmação factual com
número carrega fonte; o que é estimativa/heurística está **rotulado como tal**; nenhum número vira
recomendação. O texto em **Tooltip** é o que vai para a tela (i18n `messages.pt-br.ts`); a
**Procedência** NÃO vai para a tela.

**Convenções do texto de tela**: pt-BR leigo, voz "você", frases curtas, ~50 palavras no máximo,
zero jargão (nunca "amortização", "CAPEX", "kWh nominal", "duty cycle"), nenhuma marca citada
(categoria genérica: *tomada medidora de consumo*), nenhuma promessa que o produto não cumpre.

---

## Consumo médio (kW)

**Tooltip (texto final, pt-BR leigo, 48 palavras):**
A luz que a máquina gasta enquanto imprime entra no custo de cada peça — sem ela, você cobra menos do
que gasta. Cuidado: o número da fonte (ex.: 350 W) é o máximo, não o gasto real. Meça com uma tomada
medidora de consumo. Sem medidor, estime entre 0,07 e 0,15 kW.

**Procedência:**
- Faixa 0,07–0,15 kW: "o consumo médio durante a impressão geralmente fica entre 70 W e 150 W" e "a
  maioria das impressoras 3D domésticas de filamento tem uma potência que varia entre 50 W e 200 W
  quando estão aquecendo ou imprimindo ativamente" —
  https://www.micro24horas.com.br/computador/impressora-3d-gasta-muita-luz-entenda-o-consumo-diario-e-economize
  (lido 2026-08-05). Rotulado no texto como **estimativa** ("estime"), não como o valor da máquina do
  usuário.
- "A potência da fonte é o máximo, não o gasto real": "isso se refere ao consumo máximo em condições
  de pico, mas na prática, o consumo pode ser ainda menor, pois a impressora não demanda potência
  total o tempo todo" — https://mecolour.com.br/2024/12/02/quanto-consome-uma-impressora-3d/ (lido
  2026-08-05).
- Nome popular do aparelho no Brasil: os varejistas listam a categoria como **"medidor de consumo de
  tomada"** / **"wattímetro de tomada"** (Leroy Merlin, Magazine Luiza, Mercado Livre — busca
  2026-08-05). Adotamos "tomada medidora de consumo" no texto por ser a forma que um leigo entende
  sem saber o que é um wattímetro.
- **PREMISSA DA TAREFA CORRIGIDA — o preço ~R$ 40–70 NÃO se confirmou.** Nas listas consultadas em
  2026-08-05 o aparelho aparece **a partir de ~R$ 72** (Magazine Luiza) e comumente entre R$ 100 e
  R$ 190 (Amazon.com.br, Ponto Frio R$ 173,99, Descomplica R$ 159). Por isso **o preço ficou FORA do
  texto de tela**: é um número que envelhece dentro de uma string de i18n e não sobrevive à regra
  "nenhum número sem fonte". Ver §Notas de escopo.

---

## Tarifa de energia (R$/kWh)

**Tooltip (texto final, pt-BR leigo, 49 palavras):**
É o preço de cada unidade de luz — multiplicado pelas horas de impressão, vira o custo de energia da
peça. Pegue sua conta de luz e divida o valor total pelos kWh consumidos no mês: esse é o preço real
que você paga, já com impostos e bandeira. Sem a conta em mãos, a média do país fica perto de
R$ 0,85.

**Procedência:**
- Onde o número aparece na conta brasileira: desde a Resolução Normativa ANEEL 1.000/2021 "a conta
  deve apresentar TUSD e TE em linhas separadas, com tarifa unitária (R$/kWh) e quantidade
  consumida", na seção de detalhamento dos valores —
  https://bulbeenergia.com.br/blog/como-entender-a-conta-de-luz-blog/ (lido 2026-08-05).
  **Escolha de UX deliberada**: o texto NÃO manda o leigo somar TUSD + TE (duas siglas, e ainda
  faltariam tributos e bandeira). Manda dividir o total pelos kWh — resultado equivalente para o
  bolso e verificável sem entender a fatura.
- Bandeira tarifária vem discriminada na própria fatura (verde/amarela/vermelha P1/P2), e também no
  portal da ANEEL e no app da distribuidora — https://sualuz.com.br/blog/como-ler-conta-de-luz-bandeira-tarifaria/
  e https://bulbeenergia.com.br/blog/bandeiras-tarifarias-na-conta-de-luz/ (via busca 2026-08-05;
  os adicionais citados — amarela +R$ 1,88/100 kWh, vermelha P1 +R$ 4,46/100 kWh — **não foram
  conferidos na fonte primária ANEEL** e por isso NÃO entram no texto).
- Média nacional ≈ R$ 0,85/kWh: projeção ANEEL de tarifa residencial média de **R$ 851/MWh** para
  dez/2026 (contra R$ 786/MWh em dez/2025) —
  https://eixos.com.br/energia-eletrica/aneel-projeta-alta-media-de-8-para-tarifas-de-energia-eletrica/
  e https://www.infomoney.com.br/economia/aneel-projeta-alta-media-de-8-para-tarifas-de-consumidores-de-energia-eletrica/
  (busca 2026-08-05). É **média nacional projetada** e varia muito por distribuidora e estado — o
  texto a apresenta só como último recurso ("sem a conta em mãos"), nunca como recomendação.

---

## Vida útil da máquina (h)

> Nota de produto: a tela nova (US8) pergunta *quanto custou* + *com que frequência roda* + *em
> quantos anos quer que se pague*, e **deriva** as horas. Este tooltip serve o modo **"ajustar"**,
> onde o número bruto ainda é digitado.

**Tooltip (texto final, pt-BR leigo, 50 palavras):**
A impressora se gasta imprimindo. Espalhar o preço dela pelas horas faz cada peça devolver um pedaço
da máquina — assim a próxima sai do negócio, não do seu bolso. Fabricante não publica esse número:
estime. Horas que você imprime por ano × anos até querer trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h.

**Procedência:**
- "Fabricante não publica esse número" — **ausência de fonte, e é isso que estamos afirmando**: nas
  fontes consultadas ninguém publica vida útil em HORAS; falam em ANOS e de forma qualitativa. A
  matéria dedicada à durabilidade de uma marca popular cita apenas relatos de "3, 5 ou até mais de
  7 anos" com manutenção regular e **não menciona datasheet, garantia ou horas de operação** —
  https://melhorimpressora3d.com.br/quanto-tempo-dura-uma-impressora-bambu-lab-vida-util-real/ (lido
  2026-08-05). Um fabricante de impressoras fala em "1 a 3 anos antes de necessitar de grandes
  reparos" e "5 anos ou mais quando devidamente conservada" —
  https://eu.qidi3d.com/pt/blogs/noticias-1/quanto-tempo-dura-uma-impressora-3d (lido 2026-08-05).
  Nenhum número de horas foi copiado dessas fontes para o texto, justamente porque não existe.
- O exemplo "1.200 h/ano × 3 anos = 3.600 h" é **heurística declarada** e foi escolhido para casar
  com o ritmo intermediário já aprovado pelo dono na US8 (RITMOS = 260 · 1.200 · 3.300 h/ano;
  spec.md US8-AC2: 1.200 h/ano × 3 anos ≈ 3.600 h). É aritmética do próprio app, não um dado externo.

---

## Reserva de manutenção (R$/h)

**Tooltip (texto final, pt-BR leigo, 50 palavras):**
Bico, correia, mesa e lubrificação acabam com o uso. Guardar centavos por hora faz a troca sair do
preço das peças, e não do seu prejuízo. Some o que gastou em peças no último ano e divida pelas horas
que imprimiu. Sem histórico, olhe o preço de um bico e de uma correia na sua loja.

**Procedência:**
- Itens que se gastam e com que frequência: bicos de latão "podem precisar ser substituídos após 1 a
  3 meses de uso regular"; correias "geralmente precisam ser substituídas a cada 6 a 18 meses";
  chapas flexíveis "a cada 3 a 6 meses"; engrenagens da extrusora "1-2 anos" —
  https://eu.qidi3d.com/pt/blogs/noticias-1/quanto-tempo-dura-uma-impressora-3d (lido 2026-08-05).
  Essas frequências **não entraram no texto de tela** (estouram as 50 palavras e variam demais por
  material e uso); ficam disponíveis para o material de apoio longo, se houver.
- Ordem de grandeza dos consumíveis no Brasil, para quem for conferir na loja: bico de latão 0,4 mm
  **R$ 11,99–12,90** — https://www.printalot.com.br/bicos (lido 2026-08-05); correia GT2 6 mm
  **R$ 7,90–12,55 o metro** — https://acelera3d.com/produto/correia-gt2-6mm/ (lido 2026-08-05);
  bicos "a partir de R$ 4" em outra loja — https://3dlab.com.br/produto/bico-para-impressora-3d/
  (via busca 2026-08-05, página não lida diretamente). **Nenhum desses preços entrou no texto**: são
  de duas lojas em uma data, envelhecem, e a decisão de UX foi mandar o vendedor olhar o preço na
  loja dele em vez de fixar um número na tela.
- A conta "gasto anual em peças ÷ horas impressas no ano" é **heurística declarada** (rateio simples),
  não vem de fonte externa.

---

## Taxa de falha (%)

> Escopo: este texto diz apenas **o que a taxa de falha É**. A distinção entre falha e desperdício
> (purga, suporte, brim) é PR-D / T038b — ver §Notas de escopo.

**Tooltip (texto final, pt-BR leigo, 50 palavras):**
Uma impressão que dá errado por completo já consumiu material, luz e horas — e quem paga essa conta é
o preço das que dão certo. Descubra a sua contando: impressões perdidas ÷ impressões começadas × 100.
Ex.: 4 perdidas em 40 = 10%. Quem está começando costuma ficar mais alto.

**Procedência:**
- Fórmula e método de contagem: "failure rate = (failed parts / attempted parts) × 100", contando
  "how many prints you started (not finished, STARTED)" e registrando "prints that ended in an
  unusable part OR that you stopped mid-print"; exemplo do artigo: "40 prints attempted in a month,
  4 failed. Rate = 4/40 = 10%" — https://print-calc.com/blog/3d-printing-failure-rate (lido
  2026-08-05). O exemplo do tooltip é o mesmo da fonte.
- "Quem está começando costuma ficar mais alto": a mesma fonte dá 15–25% nos primeiros 6 meses,
  8–15% entre 1 e 2 anos, 3–8% acima de 2 anos e 2–5% em fazenda de impressão. **Optamos por NÃO
  imprimir a tabela de faixas na tela**: são quatro números, estouram as 50 palavras e viram
  âncora — o vendedor passaria a digitar a faixa em vez de contar as próprias impressões, que é
  exatamente o comportamento que a US6 quer. A frase qualitativa preserva o fato sem virar
  recomendação.
- Uma segunda referência ("abaixo de 5% é excelente, 5–10% é típico de hobby") apareceu em resumo de
  busca (https://www.3d-printed.org/what-is-the-failure-rate-of-3d-printing/) e **não foi conferida
  na página**; não sustenta nada no texto.

---

## Tempo de acabamento (h)

**Tooltip (texto final, pt-BR leigo, 44 palavras):**
Lixar, colar, pintar e montar é trabalho seu depois que a impressora parou. Fora da conta, ele vira
trabalho de graça. Cronometre uma peça parecida, do fim da impressão até ela ficar pronta para
entregar. Poucos minutos viram fração de hora: 15 min = 0,25 h.

**Procedência:**
- **Heurística declarada** (cronometrar uma vez e reaproveitar): não é fato externo, é método de
  auto-medição. Não há fonte porque não há dado universal — o acabamento depende da peça e do
  acabamento que o vendedor entrega.
- A conversão 15 min = 0,25 h é aritmética. Ela existe no texto porque a US7 só converte o campo de
  **tempo de impressão** para h+min; o acabamento continua decimal nesta fatia, e o leigo trava
  exatamente aí.

---

## Valor do acabamento (R$/h)

**Tooltip (texto final, pt-BR leigo, 42 palavras):**
Diz quanto vale uma hora do seu acabamento — é o que transforma esse tempo em dinheiro no preço final.
Use o que você cobraria de alguém para fazer o mesmo trabalho manual. Se não tem referência, comece
com o mesmo valor da sua hora de trabalho.

**Procedência:**
- **Heurística declarada** (preço de reposição do próprio trabalho, ancorado no campo "Valor da
  hora"): não há fonte externa e não deve haver — qualquer número aqui seria recomendação de preço,
  que a Constituição II proíbe e que o produto não tem base para dar.
- O piso legal de comparação (salário mínimo por hora) ficou só no campo "Valor da hora", para não
  repetir a mesma âncora em dois tooltips vizinhos.

---

## Mão de obra (horas)

**Tooltip (texto final, pt-BR leigo, 46 palavras):**
É o seu tempo fora da impressora: preparar o arquivo, tirar da mesa, limpar, embalar e postar. Sem
contar, esse tempo sai do seu lucro. Cronometre um pedido inteiro uma vez e anote. Se varia muito,
tire a média de 3 pedidos. 20 min = 0,33 h.

**Procedência:**
- **Heurística declarada** (cronometrar um pedido, média de 3): método de auto-medição, sem fato
  externo. A lista de atividades (fatiar/preparar, retirar, limpar, embalar, postar) é descrição do
  próprio fluxo do vendedor, não dado de terceiro.

---

## Valor da hora (R$/h)

**Tooltip (texto final, pt-BR leigo, 50 palavras):**
É quanto vale uma hora do seu trabalho. Sem esse número, você entrega horas de graça no preço.
Descubra o seu assim: quanto quer ganhar por mês ÷ horas que pretende trabalhar no mês. Ex.:
R$ 3.000 ÷ 160 h = R$ 18,75. Só para comparar, o salário mínimo dá R$ 7,37 a hora.

**Procedência:**
- Salário mínimo 2026 = **R$ 1.621,00**, equivalente a **R$ 7,37 por hora** na base de 220 horas
  mensais (Decreto 12.797/2025) — https://www.salario.com.br/trabalhista/salario-minimo/ ,
  https://exame.com/economia/qual-sera-o-valor-do-salario-minimo-por-hora-em-2026/ e
  https://contabilidade.com/blog/salario-minimo-2026-por-dia-e-por-hora-veja-os-valores-atualizados-e-como-calcular/
  (busca 2026-08-05; **resultados concordantes entre si, mas não conferidos no texto do Decreto**).
  O texto o apresenta explicitamente como **régua de comparação** ("só para comparar"), nunca como
  sugestão do que cobrar — cobrar o mínimo legal por hora de trabalho autônomo seria péssima
  recomendação, e o app não recomenda preço.
  **Manutenção**: este número muda todo 1º de janeiro; a string precisa entrar na lista de revisão
  anual de conteúdo (ver §Notas de escopo).
- A conta "ganho mensal desejado ÷ horas do mês" é **heurística declarada**. O exemplo R$ 3.000 ÷
  160 h é ilustrativo (160 h ≈ 8 h × 20 dias), não meta nem recomendação.

---

## Notas de escopo

**1. Resolução do "11" (achado B1 do analyze).** O plano e a spec falam em **11 tooltips**; a US6
lista **9 campos nominais** "+ os que a US8 introduzir". A conciliação: **9 campos aqui + 2 controles
novos da US8** = 11. Os 2 da US8 são **"com que frequência a máquina roda"** (3 opções, sem digitar) e
**"em quantos anos quer que ela se pague"**. O texto explicativo desses dois **viaja com a própria
tela** da US8 — a pergunta já é a explicação, e o valor derivado é dito em voz alta ("≈ R$ 1,11 por
hora de impressão", US8-AC2) — por isso não estão neste arquivo. O terceiro controle da US8 ("quanto
custou a impressora") não é campo novo: é o `machineValue` que já existe.

**2. "Gramas usadas" está FORA, de propósito.** O conteúdo dela pertence ao **PR-D / T038b**, junto
com a reescrita de "Taxa de falha": a frase "purga, suporte e brim entram nas GRAMAS; falha é a
impressão inteira perdida" (FR-914) **só vira verdade quando o campo Desperdício morrer**. Escrevê-la
agora seria publicar na tela uma afirmação falsa no estado atual do produto. Pelo mesmo motivo, o
tooltip de **Taxa de falha** acima diz apenas o que a taxa É, sem citar desperdício/purga/suporte —
essa distinção entra no PR-D e **substituirá** o texto acima, não o complementará.

**3. Campos sem fonte externa — e isso é dito, não preenchido.** Quatro tooltips são **heurística
declarada** por natureza, e nenhuma pesquisa mudaria isso: *Tempo de acabamento*, *Valor do
acabamento*, *Mão de obra (horas)* e a conta de *Valor da hora*. São métodos de auto-medição do
próprio negócio; qualquer número externo aqui seria recomendação de preço, que o produto não dá.
*Vida útil da máquina* é o caso mais delicado: a **ausência** de vida útil publicada em horas é ela
mesma a informação, e está afirmada com as duas fontes que só falam em anos.

**4. Premissa da tarefa que NÃO se confirmou.** O briefing supunha tomada medidora de consumo a
"~R$ 40–70". Nas listas consultadas em 2026-08-05 o piso é **~R$ 72** e a faixa comum vai de R$ 100 a
R$ 190. Decisão: **nenhum preço de aparelho na tela** — envelhece dentro da string de i18n e não
sobrevive à regra "nenhum número sem fonte". O tooltip manda medir; onde comprar e por quanto é
assunto de material de apoio, não de tooltip.

**5. Dois números têm data de validade e precisam de revisão anual de conteúdo**: a média de
R$ 0,85/kWh (projeção ANEEL para 2026) e o salário mínimo de R$ 7,37/h (muda todo 1º de janeiro).
Sugestão para T025: manter ambos em chaves de i18n separadas e nomeadas de forma óbvia, para que a
troca anual não exija reescrever a frase inteira.

**6. Fontes lidas diretamente (10)**: micro24horas · mecolour · bulbe (conta de luz) · Qidi
(vida útil/peças) · melhorimpressora3d (vida útil) · print-calc (taxa de falha) · Printalot (bico) ·
Acelera3D (correia) — mais os resumos de busca de eixos/InfoMoney (tarifa média ANEEL) e
salario.com.br/Exame/Contabilidade.com (salário mínimo), estes dois **rotulados acima como não
conferidos em fonte primária**. Bloqueadas por HTTP 403 (não usadas): calc3dpro, 3dlab, Leroy Merlin,
Mercado Livre.

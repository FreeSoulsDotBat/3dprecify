# Avisos que só o resultado denuncia

## O que desenhar

O bloco de avisos que aparece **dentro do resultado da calculadora**, depois que o formulário já está
válido e o preço já foi calculado. São avisos que **nenhum campo isolado poderia dar**, porque cada campo,
sozinho, está perfeitamente correto: o vendedor zerou tudo o que não entendia e chegou a um preço de venda
de R$ 0,00; ou errou uma casa decimal em três campos diferentes e chegou a um custo de R$ 6.000.061,60; ou
digitou um markup de atacado maior que o de varejo. O produto **não recusa** nenhum desses casos — ele
calcula, entrega o número e avisa. Quem lê é o vendedor leigo, no momento em que ele está prestes a fechar
a tela e anunciar o preço. Vive na aba **Calcular** (`/calcular`), no rodapé de resultados, e reaparece
igual na ficha de produto do Catálogo e no editor de linha de kit.

## Por que este prompt existe

Estes avisos nunca foram desenhados. Nenhuma das quatro autoridades de desenho prevê aviso sobre o
RESULTADO: o §G trata o resultado como sempre-verdadeiro ("success: preço + breakdown", "recompute ao
vivo"), e o único estado de recusa desenhado é peso = 0, que é validação de campo. A peça nasceu de uma
homologação automatizada (achados CF-001-LEIGO-D-P5 e D-P6) e de uma decisão do dono (015/A8), ambas
**depois** da construção — registro, não protótipo. O que foi inferido sem desenho: que os dois avisos são
`info` e não erro, sua posição relativa ao detalhamento e aos cartões de preço, e a decisão de **concatenar
N frases num parágrafo único**. O resultado é que a frase que impede um anúncio por R$ 0,00 tem hoje
exatamente o mesmo peso visual de qualquer outra nota informativa da tela.

## O que já existe hoje (não invente do zero — corrija)

A ordem atual dentro do rodapé de resultados, de cima para baixo:

1. Título de seção **"Como chegamos no preço"** com ⓘ.
2. **Aviso de resultado** — um bloco `info` (fundo ciano suave, ícone ⓘ, texto corrido), presente só quando
   há avisos. → **Todas as frases disparadas viram um parágrafo só, separadas por espaço.** Com dois avisos
   ativos (preço zero + custo absurdo é impossível junto, mas custo absurdo + gramas absurdas não é) o
   bloco vira um muro de texto sem hierarquia.
3. O Card do detalhamento: Material · Energia · Máquina · Falha / perdas · Acabamento · Mão de obra ·
   linhas de "Outros custos" · **Custo total** · Preço varejo (`markup 60%`) · Preço atacado
   (`markup 30%`) · opcionalmente "Preços por canal".
4. **Aviso de atacado acima do varejo** — outro bloco `info`, solto **entre** o Card e os cartões de preço.
5. Os dois cartões finais `tf-price-hero` centralizados: "Preço varejo" (tom accent) e "Preço atacado"
   (tom energy), grade `auto-fit` com piso de 210px (empilha a 360px).

Textos literais de hoje, a citar sem reescrever (exceto onde marcado):

| Gatilho | Frase exata hoje |
|---|---|
| Custo e preço zerados (peça existe) | "O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado." |
| Custo total > R$ 100.000 | "Confira os custos: R$ {v} para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais em algum campo. Nada foi recusado." |
| Atacado > varejo | "O preco de atacado ficou acima do varejo. Nada foi recusado — so confira se e isso mesmo." |
| Formulário inválido (sem resultado) | "Confira os campos destacados para ver o preço." (bloco `danger`, ocupa o lugar de todo o resultado) |

→ **A frase do atacado está sem acentuação no código** ("preco", "so confira se e isso mesmo"). É defeito
de texto, não de desenho — mas o desenho deve mostrar a forma acentuada correta: "O preço de atacado ficou
acima do varejo. Nada foi recusado — só confira se é isso mesmo."

→ **Os dois avisos estão em lugares diferentes da mesma pilha** (um antes do Card, outro depois) sem que
nada explique a diferença ao leitor.

→ **Não existe tom intermediário no DS.** O `tf-alert` tem `neutral`, `info`, `success` e `danger`. Existem
tokens `--tf-warning` / `--tf-warning-soft` (laranja) mas **não existe** `--warning-text` nem
`tf-alert--warning`. Hoje o aviso é `info` por eliminação, não por escolha.

## Conteúdo e dados reais

- **Preço zero**: dispara quando `custo total = R$ 0,00` **e** `preço varejo = R$ 0,00`, e **só** se a peça
  existir (gramas > 0 ou tempo > 0) — formulário recém-aberto e vazio não é erro.
- **Custo absurdo**: dispara acima de **R$ 100.000,00** de custo de uma peça. Exemplo real medido na
  homologação: **R$ 6.000.061,60**. O número entra na frase formatado em pt-BR com até 4 casas.
- **Atacado acima do varejo**: comparação entre os **preços resultantes**, não entre os markups digitados.
  Exemplo verdadeiro: varejo R$ 24,24 (markup 60%) e atacado R$ 30,30 (markup 100%).
- Os mesmos blocos podem coexistir com avisos **de campo** (mesma família de texto, mesma cor `--info-text`,
  mas renderizados como legenda solta abaixo do input, sem caixa) — ex.: "Confira o consumo: 120 kW. Acima
  de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer
  watts: 120 W são 0,12 kW. Nada foi recusado."
- Toda frase da família termina em **"Nada foi recusado."** e toda frase **ensina a converter**. Isso é
  regra escrita, não estilo: o desenho não pode encurtar a frase a ponto de perder a conversão.
- Cifras longas de verdade a testar no layout: `R$ 6.000.061,60`, `R$ 950.096,00`, `R$ 0,00`.

## Estados obrigatórios

- **Ausente** (o normal): nenhum aviso dispara, nada ocupa espaço, o resultado é só preço + detalhamento.
- **Um aviso**: o caso comum. Mostre com a frase inteira, legível, sem truncar.
- **Vários avisos juntos**: hoje concatenados num parágrafo. Desenhe a alternativa — cada frase como item
  próprio, com hierarquia entre elas — e mostre o pior caso com três frases longas.
- **Atacado acima do varejo**: aviso independente dos anteriores, pode aparecer sozinho ou somado a eles.
- **Sem resultado (formulário inválido)**: bloco `danger` "Confira os campos destacados para ver o preço."
  substitui todo o resultado — desenhe para provar que o aviso de resultado **é visualmente diferente da
  recusa**, porque essa distinção é a razão de ele existir.
- **Coexistência com o aviso de campo**: prancheta mostrando um aviso ⓘ abaixo de um input **e** o aviso de
  resultado ao mesmo tempo, para provar que não lêem como duplicata.
- **Foco de teclado e leitura assistiva**: o bloco é região `status` (polido, não assertivo). Se o desenho
  propuser qualquer elemento interativo dentro dele (link "ver campo", botão de recolher), esse elemento
  precisa de estado de foco visível e alvo ≥ 44px.
- **Recolhido / compacto**: existe precedente na casa (`tf-alert--compact`: ícone + título curto numa linha
  + ⓘ que abre o corpo inteiro). Mostre se ele serve aqui — e se não servir, diga por quê.

## Viewports

- **Mobile 390px** — obrigatório: é onde a peça mais dói. As frases têm 150–230 caracteres e caem em 5–8
  linhas; com dois avisos concatenados o bloco empurra os cartões de preço para fora da primeira dobra.
- **Mobile 360px** — o piso medido do projeto, onde os cartões de preço já empilham e uma cifra de seis
  dígitos já quebrou no meio do número em regressão passada.
- **Desktop 1280px** — a peça vive no rodapé de resultados também no desktop, num container mais largo: o
  bloco de aviso vira uma faixa muito larga e curta, e a relação de peso com os cartões de preço muda.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O produto calculou, o produto salva, nada foi recusado. Se o desenho
  fizer o bloco parecer erro, o vendedor conclui que o produto recusou — e a decisão do dono (2026-08-03)
  é explicitamente a oposta.
- **Mas o aviso também não pode ficar invisível.** É a única coisa entre o vendedor e um anúncio por
  R$ 0,00. Um bloco `info` com o mesmo peso de qualquer nota da tela já falhou nesse trabalho.
- **A frase honesta nunca mora em placeholder nem em tooltip fechado** — placeholder carrega número, não
  promessa. Se o desenho recolher o corpo, o que fica visível tem que ser suficiente para o vendedor saber
  que algo está errado no preço.
- **Nenhum número é inventado nem arredondado para caber.** Se `R$ 6.000.061,60` não cabe, o layout cede,
  nunca o número.
- **Contraste medido contra o fundo real do bloco** (fundo tonal suave, não o fundo da página), nos dois
  temas.

## Armadilhas já pagas neste projeto

- **Overflow horizontal medido, nos dois eixos.** A seção Shopee mediu 1248px de altura a 360px, com 48%
  dela ocupada por dois avisos — foi o que obrigou a criar o alerta compacto. Um bloco de aviso é a peça
  que mais cresce quando ninguém mede.
- **Texto ocluso passa em teste.** `toBeVisible` aprova um aviso empurrado para fora da coluna. Layout aqui
  se prova com caixas, não com asserção de texto.
- **Número grande quebra no meio do dígito** antes de a página estourar — foi exatamente o que aconteceu
  com os cartões de preço a 360px. O aviso de custo absurdo é justamente o que carrega o maior número da
  tela.
- **Frase cortada por sufixo** — uma frase de honestidade já foi clipada por viver num elemento estreito.
  Estes textos precisam de largura total.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:

1. **Estado ausente** — o rodapé de resultado limpo, para referência de contraste (390px).
2. **Um aviso** — preço zero, 390px e 1280px.
3. **Vários avisos** — custo absurdo + gramas absurdas + atacado acima do varejo, no pior caso a 360px.
4. **Aviso vs. recusa** — lado a lado: o bloco de resultado com aviso e o bloco `danger` "Confira os campos
   destacados para ver o preço.", provando que se lêem como coisas diferentes.
5. **Variante compacta**, se você propuser uma: fechada e aberta.

Reutilize os primitivos existentes, nomeando-os: o bloco é `tf-alert` (com a variante `tf-alert--compact`
quando couber, ícone `info` de 20px, corpo em `--fs-body-sm`); as cifras dentro do detalhamento são
`tf-breakdown-row`; os cartões finais são `tf-price-hero` (tons `accent` e `energy`, tamanho `md`,
centralizados); o detalhamento vive dentro de um `tf-card` com padding `md`; qualquer detalhe recolhido usa
o `tf-info-tip` da casa (já é acessível por teclado e toque). **Não crie um primitivo novo** — se a peça
precisar de um tom que o `tf-alert` não tem, diga isso explicitamente como uma variante nova do `tf-alert`
(ex.: `tf-alert--warning` sobre `--tf-warning-soft`), não como um componente inédito.

## Perguntas em aberto para o dono

1. **Estes avisos devem ter um tom próprio, entre `info` e `danger`?** O DS já tem os tokens laranja
   (`--tf-warning` / `--tf-warning-soft`) mas nenhum tom de alerta os usa, e falta o par de texto
   (`--warning-text`). Criar `tf-alert--warning` daria a estes avisos o peso que o `info` não dá **sem**
   fazê-los parecer recusa — mas é uma variante nova no DS, e a decisão é sua.
2. **Preço zero merece tratamento diferente de custo absurdo?** Preço zero significa "isto não pode ser
   anunciado" e custo absurdo significa "isto provavelmente está errado". Hoje os dois têm exatamente o
   mesmo peso e podem cair no mesmo parágrafo.
3. **O aviso de atacado deve continuar entre o detalhamento e os cartões de preço, ou juntar-se aos demais
   num único lugar acima do detalhamento?** Hoje estão separados e nada explica por quê.
4. **O aviso deve poder apontar para o campo suspeito** (um "ver campo" que rola até ele)? O módulo já
   sabe qual campo causou cada aviso de faixa, mas o aviso de resultado, por definição, não tem campo
   culpado — e um link que leva a lugar nenhum é pior que nenhum link.

# Campo — a terceira camada de mensagem (o aviso de plausibilidade)

## O que desenhar

A faixa de mensagem que fica **abaixo do controle** de um campo do Precifica3D e que hoje carrega três coisas
diferentes no mesmo lugar: a **dica** (texto neutro, sempre presente), o **aviso de plausibilidade** (o número
é estranho, mas foi aceito e o preço continua sendo calculado) e o **erro** (o número foi recusado). Ela vive
na calculadora de preço — a tela onde o vendedor digita custo do rolo, gramas, tempo de impressão, consumo,
tarifa, vida útil da máquina — e também no editor de linha de kit e no bloco de canal do marketplace. Quem a
usa é um vendedor leigo, no exato segundo em que ele digitou um número plausível que significa outra coisa
(120 W escritos num campo que pede kW; 3 anos escritos num campo que pede horas). Desenhar isto é desenhar a
**hierarquia entre três tons no mesmo slot** — um azul que não recusa, um vermelho que recusa, e um cinza que
só explica.

## Por que este prompt existe

O contrato desenhado do Field tem **duas** camadas: `hint` e `error`, com o erro SUBSTITUINDO o hint (§D.1); o
§E4 desenhou apenas o erro do peso do rolo. O código inventou uma terceira, `.tf-field__aviso`, datada no
próprio CSS como "Homologação automatizada (2026-08-13)": uma linha extra empurrada para dentro do hint e
pintada com `--info-text`. Nenhuma autoridade de desenho trata de **níveis de mensagem** — o canvas do dono usa
`tf-field` sem hint, sem erro e sem aviso. Ou seja: a única coisa entre o vendedor e um preço absurdo é uma
linha azul que ninguém desenhou, a um passo de ser lida como erro (e recusar) ou de sumir (e não avisar).
Correção de rota registrada: o módulo é `shared/lib/plausibilidade.ts`; o comentário do `field.css` ainda
aponta para `features/calculator/plausibilidade.ts`, que **não existe**.

## O que já existe hoje (não invente do zero — corrija)

Anatomia atual do campo, de cima para baixo:

| Parte | Como está hoje | Observação |
| --- | --- | --- |
| Linha do rótulo | rótulo + `*` obrigatório (cor `--energy`) + ⓘ irmão do rótulo + etiqueta "opcional" empurrada à direita | reserva **duas linhas** de altura para alinhar grades de 2 colunas |
| Controle | `tf-inputwrap` com prefixo `R$` e/ou sufixo de unidade (`kW`, `h`, `g`, `/kWh`) | borda vermelha quando há erro |
| Camada 1 — dica | caption em `--text-muted` | ex.: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)." |
| Camada 2 — aviso | caption em `--info-text`, empilhada logo abaixo da dica, `margin-top` de 1 passo | **sem ícone, sem fundo, sem borda: só cor** → problema |
| Camada 3 — erro | caption em `--danger-text`, peso médio, `role="alert"` | **substitui a dica E o aviso** |

→ O aviso só se distingue da dica pela **cor**. Quem não percebe matiz não percebe que há aviso.
→ O aviso **não muda nada no controle**: a borda do input continua idêntica à do repouso. Nada puxa o olho de
volta para o campo que causou o aviso.
→ O CSS do aviso carrega `overflow-wrap: anywhere` — sintoma de que alguém já teve medo do estouro horizontal.
→ A mesma classe é reusada **fora** do Field, na linha de kit, num parágrafo `text-sm` (maior que o caption do
Field): a mesma peça aparece em dois tamanhos.
→ O aviso do RESULTADO (preço zero / custo absurdo) usa uma peça completamente diferente: um `tf-alert--info`
com ícone e fundo. Dois pesos visuais para a mesma família de mensagem, sem hierarquia declarada.

## Conteúdo e dados reais

Os textos são literais e já homologados — **não reescreva**. Todos terminam com "Nada foi recusado.":

- Consumo médio (kW, obrigatório, faixa real ~0,05–0,25 kW, limiar 5): *"Confira o consumo: 120 kW. Acima de
  5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A etiqueta costuma trazer watts:
  120 W são 0,12 kW. Nada foi recusado."*
- Vida útil da máquina (h, obrigatório, limiar mínimo 100 h): *"Confira a vida útil: 3 horas é menos de uma
  semana ligada. Se você pensou em anos, multiplique pelas horas que imprime por ano — 1.200 h/ano × 3 anos =
  3.600 h. Nada foi recusado."*
- Tempo de impressão (h + min, obrigatório, limiar 100 h): *"Confira o tempo: 150 horas equivalem a 6,3 dias
  imprimindo sem parar. Se você quis dizer minutos, use o campo de minutos ao lado. Nada foi recusado."*
- Peso do rolo (kg, limiar 50): *"Confira o peso do rolo: 1.000 kg. O rolo comum tem 1 kg — se você informou
  gramas, 1.000 g são 1 kg. Nada foi recusado."*
- Comissão do canal (%, opcional, limiar mínimo 1%): *"Confira a comissão: 0,12%. Marketplaces costumam cobrar
  entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi recusado."*
- Quantidade da peça de kit (limiar 2.147.483.647): *"Confira a quantidade: 5.000.000.000. O máximo por peça é
  2.147.483.647. Acima disso o kit não consegue ser salvo. Nada foi recusado."*
- Resultado, sem campo culpado: *"O custo total ficou em R$ 0,00 e o preço de venda também — por esse preço não
  dá para vender. Confira os campos de custo que ficaram zerados. Nada foi recusado."* e *"Confira os custos:
  R$ 6.000.061,60 para uma peça é muito acima do que costuma acontecer. Normalmente é uma casa decimal a mais
  em algum campo. Nada foi recusado."*

**Medida que decide o desenho:** a frase mais longa tem ~230 caracteres. Em caption, dentro de uma coluna de
grade de 2 colunas a 390px, isso ocupa de 6 a 8 linhas empurrando o campo seguinte para baixo. É o caso normal,
não o extremo.

→ Dentro das frases o dinheiro sai **sem centavos** ("R$ 3.000", "R$ 0,1234"), enquanto o resto do produto
escreve `R$ 1.234,56` — decisão do dono (ver perguntas).

## Estados obrigatórios

1. **Repouso, só dica** — caption cinza, uma linha. É o estado da imensa maioria dos campos.
2. **Repouso, sem dica e sem aviso** — nada abaixo do controle; o espaço não fica reservado.
3. **Aviso ativo, com dica** — dica cinza na primeira linha, aviso azul empilhado abaixo. Desenhe com a frase
   longa de verdade (o consumo), não com um lorem curto.
4. **Aviso ativo, sem dica** — o aviso é a única linha (é o caso do tempo de impressão e da comissão).
5. **Erro** — o vermelho substitui dica **e** aviso; a borda do controle fica vermelha inclusive com foco.
6. **Erro + valor implausível ao mesmo tempo** — o desenho precisa mostrar quem vence (hoje: o erro; o aviso
   desaparece por completo).
7. **Foco** — anel roxo no controle; mostre como a mensagem de três camadas convive com o anel.
8. **Hover** (borda mais forte) e **digitando** — o aviso aparece e some **a cada tecla**, porque nasce do
   valor cru do campo; desenhe a transição, um flash abrupto é ruído.
9. **Desabilitado** — controle esmaecido; a dica permanece.
10. **Aviso de resultado** — o bloco `tf-alert--info` abaixo do preço, com uma ou **duas** frases concatenadas
    na mesma caixa (é o que o código faz).
11. **Campo obrigatório vs. opcional** — o `*` e a etiqueta "opcional" na mesma linha do rótulo, com o aviso
    aceso, para provar que a densidade continua legível.

## Viewports

- **Mobile 390px** — obrigatório e prioritário: é onde a frase longa colide com a grade de 2 colunas dos custos
  da peça. Desenhe um par de campos lado a lado com o da esquerda em aviso.
- **Desktop 1280px** — é o corte do redesenho das abas; o mesmo campo aparece na ficha lateral e no formulário
  de custos. Mostre a frase cabendo em 2–3 linhas. 1920px é dispensável: acima de 1280 nada muda no campo.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação.** O número foi aceito, o preço continua sendo calculado e o formulário continua
  podendo ser salvo. Nada no desenho — nem cor, nem ícone, nem borda — pode dizer "recusado".
- **Vermelho é exclusivo da recusa.** Um aviso pintado de vermelho diria o contrário do que a frase está
  escrita para dizer.
- O erro tem prioridade absoluta e é anunciado por assistiva; o aviso é visual e precisa ser perceptível
  **sem** foco, porque ele fala do valor que já está lá.
- **Cor não pode ser o único sinal** (o único diferencial atual entre dica e aviso é matiz), e o contraste do
  azul precisa ser medido contra o fundo real do formulário nos dois temas.
- A frase honesta nunca mora em placeholder nem em elemento truncado: ela quebra em quantas linhas precisar,
  em elemento de largura total da coluna.
- Alvo de toque do controle ≥44px; o aviso é texto, não alvo — não transforme em botão nem em "ver mais" que
  esconda a frase.
- O aviso não pode empurrar o preço para fora da tela nem desalinhar os inputs da grade de 2 colunas.

## Armadilhas já pagas neste projeto

- **Estouro horizontal medido, não olhado.** O `overflow-wrap: anywhere` já está no CSS porque a frase longa
  ameaça a coluna; qualquer desenho precisa mostrar a frase inteira dentro da largura, sem reticências.
- **Um aviso que existia e nunca aparecia.** O limiar, a frase e o teste unitário do "vida útil da máquina"
  estavam verdes e nenhuma tela renderizava o aviso — o vendedor levava o custo/hora de R$ 1,11 para
  R$ 1.333,33, calado. Desenhe o estado aceso de cada campo listado, um por um, para que a falta seja visível.
- **Texto que passa em teste e some na tela.** Assertivas de texto não enxergam ocultação nem colisão.
- **Empurrão de layout.** A reserva de duas linhas no rótulo existe para manter os inputs alinhados; o aviso,
  que aparece e some ao digitar, é o novo candidato a desalinhar a grade.

## Entregável

Pranchetas, tema **escuro** primeiro e **claro** como par de primeira classe de cada uma:

1. **Anatomia das três camadas** — o mesmo campo ("Consumo médio", `R$`/`kW`, valor 120) em quatro variações
   empilhadas: só dica · dica + aviso · só aviso · erro. Com legenda nomeando cada camada.
2. **Matriz de estados** — repouso, hover, foco, digitando com aviso aceso, erro, erro+implausível,
   desabilitado.
3. **Contexto real 390px** — a grade de 2 colunas dos custos da peça com um campo em aviso e o vizinho em
   repouso, provando o alinhamento dos inputs.
4. **Contexto real 1280px** — o mesmo formulário na largura do desktop.
5. **Hierarquia campo × resultado** — o aviso de campo e o bloco de aviso do resultado na mesma prancheta,
   mostrando que são a mesma família em dois pesos.

Reutilize os primitivos existentes, sem criar novos: `tf-field` (rótulo, `*`, "opcional", dica, erro),
`tf-inputwrap` com afixos de moeda/unidade, `tf-field__aviso` como a camada nova a ser desenhada de verdade, e
`tf-alert` no tom `info` para o aviso de resultado. Um eventual ícone deve sair do conjunto já usado no produto.

## Perguntas em aberto para o dono

1. O aviso de campo ganha **ícone** (ou algum sinal que não seja cor), sabendo que qualquer glifo de alerta
   corre o risco de ser lido como recusa?
2. Quando há erro E valor implausível no mesmo campo, o aviso deve mesmo **sumir** (comportamento atual) ou
   aparecer abaixo do erro?
3. O **controle** deve sinalizar de alguma forma que há um aviso (uma borda ou um afixo em tom `info`), ou o
   sinal continua exclusivamente na linha de texto abaixo?
4. O dinheiro dentro das frases sai sem centavos ("R$ 3.000", "R$ 0,1234"). Padroniza em `R$ 1.234,56`?
5. "Nada foi recusado." repete no fim de **todas** as frases. Vira um elemento fixo da peça (uma etiqueta ou
   um sufixo visual constante) ou continua como parte do texto de cada mensagem?
6. Na linha de kit o aviso aparece maior (`text-sm`) e fora de um campo. É a mesma peça em dois tamanhos, ou
   ele deve ser normalizado no tamanho caption do Field?

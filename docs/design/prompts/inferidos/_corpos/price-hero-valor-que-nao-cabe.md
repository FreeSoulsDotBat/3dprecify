# PriceHero — o preço quando ele não cabe

## O que desenhar

O `PriceHero` é o leitor de preço em destaque do Precifica3D: um rótulo em caixa alta, o número grande com
a moeda pequena e elevada à esquerda e os centavos reduzidos à direita, e uma legenda embaixo. Ele aparece
no fim da aba **Calcular** (o par "Preço varejo" / "Preço atacado", lado a lado ou empilhados), na **barra
fixada do kit** (o par Varejo/Atacado abaixo do "Custo total"), e é o formato do número congelado no
**Histórico**. É a última coisa que o vendedor olha antes de fechar a tela — o produto inteiro existe para
produzir esse número. O que precisa ser desenhado aqui **não é o caso bonito**: é o comportamento do
readout quando o valor **não cabe** na caixa — quando ele precisa encolher, quebrar entre partes, ou rolar
por dentro — em cada tom, tamanho e viewport.

## Por que este prompt existe

A autoridade é **PROTÓTIPO PARCIAL**. O desenho original (`.design-import/components/data/PriceHero.jsx`)
é o mais completo do repositório — CSS inteiro, 5 tons, 3 tamanhos, a divisão moeda/inteiro/centavos — e o
canvas instancia o componente duas vezes, sempre com valores pequenos (**R$ 3,00**, **R$ 20,65**). O caso
nominal está coberto. O que nunca foi desenhado é o valor que transborda, e as quatro correções que o app
precisou fazer **contradizem o desenho, uma a uma**: o desenho não tem `flex-wrap`, não tem rolagem, não
impede a quebra no meio do número, crava entrelinha 1 (a causa medida da barra de rolagem do item 9 da
homologação 016) e centraliza o cartão por `align-items` (a causa medida do transbordo em 016/T016). Cada
um desses defeitos foi descoberto com o preço já na tela do dono. Este prompt pede o desenho que faltou.

## O que já existe hoje (não invente do zero — corrija)

Anatomia real (origem: `apps/web/src/shared/ui/price-hero.tsx` + `price-hero.css`):

| Parte | Conteúdo | Tratamento atual |
| --- | --- | --- |
| `label` | ex. "Preço varejo" | 13px, semibold, CAIXA ALTA, opacidade 0,9 — opcional |
| `cur` | "R$" | 0,4em do número, elevado 0,55em, opacidade 0,85 |
| `int` | "1.234" | 1em — o tamanho manda na linha inteira |
| `dec` | ",56" | 0,5em, bold |
| `cap` | ex. "markup 50%" | 12px, medium, opacidade 0,92 — opcional |

Tons: `plain` (sem fundo nem borda), `accent` (roxo com glow — **é o padrão**), `energy`, `inverse`,
`success`. Tamanhos: `md` (36px), `default` (fluido 40→60px), `lg` (fluido 48→76px). Modificador `center`.

Onde vive hoje, com os textos literais:

- **Calcular** — dois cartões numa grade `auto-fit` com piso de **210px**: `accent` + "Preço varejo" +
  legenda "markup 50%"; `energy` + "Preço atacado" + legenda "markup 30%". Ambos `md`, centralizados.
  Acima deles, quando o atacado sai maior que o varejo, um alerta de tom `info` (nunca de erro).
- **Barra fixada do kit** — os mesmos dois valores, empilhados em **uma coluna**, rótulos curtos
  "Varejo" e "Atacado" (o longo "Preço atacado" mede 111px e tranca num orçamento de ~101px), e abaixo,
  quando há peça fora da conta: "{n} peça(s) fora do total — confira os avisos nas peças acima."
  → **Problema**: nesta barra nenhum dos dois declara tom, então **os dois herdam `accent`** — dois blocos
  roxos com glow, empilhados, dentro de um cartão. Isso nunca foi desenhado; foi herdado do valor padrão.
- → **Problema**: o componente aceita `children` (um espaço livre depois da legenda) que nenhum uso
  exercita. Ou o desenho diz para que serve, ou ele não deveria existir.

## Conteúdo e dados reais

- O valor é sempre **dinheiro em reais**, formatado pt-BR com **duas casas** e **algarismos tabulares**:
  separador de milhar ".", decimal ",". Exemplos verdadeiros do produto: `R$ 16,16`, `R$ 24,24`,
  `R$ 21,01`, `R$ 35,93`, `R$ 44,14`.
- Faixa realista: de `R$ 0,00` (valor ausente cai em zero, não em vazio) até seis dígitos,
  `R$ 123.456,78`. Um preço de seis dígitos ocupa **147px** a 36px de corpo — foi medido, não estimado.
- Fora da faixa realista existe o caso patológico que o motor aceita: um custo de 15 dígitos multiplicado
  por um markup de 9 dígitos, ordem de 10^24. Nenhum tamanho de fonte resolve isso, porque o corpo fluido
  responde à **largura da tela**, não ao **comprimento do número**.
- Rótulo e legenda são ambos opcionais; a legenda é hoje o único lugar onde cabe procedência
  ("markup 50%", "Varejo · markup 50%"). O prefixo "R$" é configurável mas nunca foi trocado.

## Estados obrigatórios

Desenhe cada um com o número de verdade dentro, não com "R$ 0,00" de enfeite:

1. **Repouso nominal** — `R$ 24,24`, nos cinco tons e nos três tamanhos.
2. **Zero** — `R$ 0,00`. É o primeiro paint da tela de cálculo, antes de qualquer entrada.
3. **Valor longo (cabe apertado)** — `R$ 123.456,78` em `md`, dentro de uma coluna de 210px.
4. **Valor que não cabe — quebra entre partes** — a linha pode dobrar **entre** "R$", inteiro e centavos,
   nunca **dentro** do inteiro. Mostre como fica: `R$ 18.130` quebrado como `18.13` / `0` já aconteceu
   neste produto, e "18.13" é **outro número** para quem lê. Desenhe o alinhamento das duas linhas.
5. **Valor que não cabe de jeito nenhum — rolagem interna** — último recurso: o número rola dentro da
   própria linha, com todos os dígitos legíveis. → **É aqui que o desenho tem trabalho real a fazer**:
   hoje nada avisa que existem dígitos fora da vista.
6. **Centralizado vs. alinhado à esquerda** — os dois convivem no produto (Calcular centraliza, a barra
   do kit não). Desenhe os dois; o centralizado **não pode** deixar o cartão crescer além da coluna.
7. **Par lado a lado** (>= 420px de faixa) e **par empilhado** (<= 390px) — a decisão é da grade, mas o
   readout precisa parecer intencional nas duas.
8. **Com aviso acima** — o alerta `info` de "atacado acima do varejo" imediatamente antes do par.
9. **Sem legenda** e **sem rótulo** — ambas as partes são opcionais e o cartão precisa continuar equilibrado.

Não há estado de carregamento, erro, offline ou desabilitado **dentro** deste readout: hoje quem decide isso
é a tela ao redor. Se o desenho achar que a procedência do número (ao vivo / último conhecido / congelado)
tem que aparecer no próprio cartão, proponha — mas veja a pergunta ao dono.

## Viewports

- **360px** — obrigatório, e não é exagero: é a largura em que cada defeito deste componente foi medido.
  A 360px, duas colunas deixavam 108px para um valor que precisa de 124px, e na barra do kit deixavam 89px,
  que não comportam "R$ 1.234,56" nem em texto corrido.
- **390px** — o mobile de referência do produto.
- **1280px** — o corte desktop do increment 018, onde o par de preços vive na ficha da direita e ganha
  largura sobrando; o risco aqui é o oposto, um número pequeno perdido num cartão largo demais.

## Regras que o desenho não pode quebrar

- **O número nunca é partido ao meio.** Quebrar o inteiro renderiza um valor diferente do calculado, e
  nenhuma verificação automática enxerga isso: um bloco quebrado ainda reporta que "coube".
- **Nenhum dígito pode ser escondido.** Cortar com reticências ou ocultar por transbordo é mentir sobre
  dinheiro. As saídas honestas são encolher, quebrar entre partes, ou rolar — nessa ordem.
- **O cartão jamais empurra a página.** A largura do cartão é a da coluna; o que sobra é resolvido por
  dentro. Meça o transbordo horizontal da página, não a "visibilidade" do elemento.
- **Nenhuma barra de rolagem clássica atravessando o cartão.** A entrelinha 1 fazia o conteúdo ficar 4px
  mais alto que a caixa, o navegador desenhava uma barra de 15px e ela empurrava o preço 7,5px do centro.
  A altura da linha precisa acomodar o número com folga.
- **Contraste medido contra o fundo real de cada tom** — o roxo com glow, o laranja de energia e o fundo
  invertido são três fundos diferentes; o valor e a legenda precisam passar nos três, em tema escuro e claro.
- **A legenda é texto de verdade, em elemento de largura cheia** — nunca uma frase honesta espremida onde
  ela possa ser cortada.

## Armadilhas já pagas neste projeto

- Centralizar por alinhamento de itens (em vez de alinhamento de texto) fez o bloco do número crescer até
  a largura natural dele e abrir a página inteira. O cartão precisa continuar esticado na coluna.
- Grade de duas colunas fixas em toda largura: o número foi o que cedeu, quebrando no meio, para a página
  não transbordar. O piso de coluna precisa ser derivado do número, não escolhido.
- Rótulo longo estourando o orçamento de largura da barra do kit ("Preço atacado" = 111px em ~101px) —
  duas grafias diferentes para o mesmo conceito nasceram desse aperto.
- Valores de exemplo curtos escondem tudo: o protótipo original testava R$ 3,00 e R$ 20,65 e por isso
  nenhum desses defeitos apareceu no desenho. **Use valores adversariais em toda prancheta.**

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (primeira classe, não uma variação tardia)**:

1. **Anatomia** do readout com as cinco partes nomeadas e as proporções (moeda 0,4em elevada, centavos
   0,5em), no tamanho `default`.
2. **Matriz tom × tamanho**: 5 tons × 3 tamanhos, valor `R$ 24,24`.
3. **A escada do transbordo**: o mesmo cartão de 210px com `R$ 24,24` → `R$ 1.234,56` → `R$ 123.456,78` →
   um valor absurdo de 20+ dígitos, mostrando encolher → quebrar entre partes → rolar, e **como o usuário
   percebe** que está rolando.
4. **Par de preços em contexto**, a 360px, 390px e 1280px, com o alerta `info` acima.
5. **Barra fixada do kit** com os dois readouts e a linha "{n} peça(s) fora do total…".

Reutilize os primitivos existentes, sem criar novos: `tf-price` (com `tf-price__label`, `__cur`, `__int`,
`__dec`, `__cap`) para o readout, `tf-card` para a caixa da barra do kit, `tf-alert` de tom `info` para o
aviso de atacado acima do varejo. Se algo faltar, diga que falta em vez de inventar um primitivo novo.

## Perguntas em aberto para o dono

1. Quando o valor rola por dentro (último recurso), deve existir um sinal visível de que há dígitos fora
   da vista — degradê na borda, seta, o cartão inteiro mudando de aparência — ou o produto prefere que
   esse caso simplesmente nunca chegue à tela na faixa realista?
2. Na barra fixada do kit, Varejo e Atacado devem repetir os tons de Calcular (roxo/laranja), ou os dois
   ficam neutros ali? Hoje ambos herdam o roxo com glow por acidente do valor padrão.
3. Existe um rótulo único para o par, ou "Varejo"/"Atacado" e "Preço varejo"/"Preço atacado" continuam
   sendo duas grafias legítimas conforme a largura disponível?
4. A procedência do número (calculado agora / último conhecido offline / congelado no histórico) deve
   caber na legenda do próprio PriceHero, ou continua sendo responsabilidade da tela ao redor?
5. Qual é o teto que o produto se compromete a mostrar **sem** encolher nem quebrar — seis dígitos
   (`R$ 123.456,78`) é suficiente, ou existe cliente que precifica acima disso?

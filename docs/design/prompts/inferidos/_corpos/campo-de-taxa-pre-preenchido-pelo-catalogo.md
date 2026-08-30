# Campo de taxa que já está sendo cobrada pelo catálogo

## O que desenhar
O campo numérico de taxa dentro de um **slot de canal** da Calculadora (bloco "Marketplaces", um card por
canal: Mercado Livre, Shopee, Amazon). São quatro campos numa grade de 2 colunas — Comissão (%), Taxa fixa
(R$), Comissão mínima/item (R$), Frete (R$) — e o problema de desenho é um só: **como a interface mostra um
número que o catálogo JÁ está aplicando no preço, sem que o vendedor tenha digitado nada**. Quem usa é o
vendedor leigo, no momento em que ele olha o preço do anúncio e pergunta "de onde saiu esse desconto?".
Junto do campo vivem duas legendas de largura total sob a grade (faixa de preço + regra da taxa fixa) e os
selos de procedência. Origem no código: `apps/web/src/features/calculator/calculator-form.tsx`
(`ChannelFeeField`, linhas 692-760, e o `ChannelSlot` que o envolve).

## Por que este prompt existe
A peça nunca foi desenhada — autoridade **NENHUMA**. A convenção de hoje (campo vazio + valor do catálogo
como *placeholder* cinza) foi decidida em código, e o verificador adversarial mostrou que ela é o **oposto**
da única convenção que algum protótipo chegou a expressar: o `-fixes.md` de 2026-07-02 mandava "corrija ML
Clássico para R$ 6,75 + 14%", isto é, o valor de referência **preenchido** no campo. O código escolheu
placeholder porque um valor preenchido faria o marcador de "editado pelo vendedor" (`overridden`, que o
cenário salvo grava) mentir. Nenhuma das duas leituras foi homologada por desenho. E o custo de errar já foi
medido: na homologação 015, quatro campos vazios liam **"Comissão 0,00 %"** enquanto "Preços por canal"
mostrava um preço com 15% já descontados — a pior leitura possível.

## O que já existe hoje (não invente do zero — corrija)

Grade de 2 colunas (`1fr 1fr`, gap `--space-3`) dentro do card do canal:

| Campo | Rótulo literal | Afixo | Placeholder quando o catálogo aplica | Placeholder sem referência |
|---|---|---|---|---|
| `commissionPct` | "Comissão" | sufixo `%` | `20` (Shopee faixa R$ 12–80) | **"0,00"** → problema |
| `fixedFee` | "Taxa fixa" | prefixo `R$` | `7,00` | **"0,00"** → problema |
| `minPerItem` | "Comissão mínima/item" | prefixo `R$` | `6,75` | "0,00" |
| `freightCost` | "Frete" | prefixo `R$` | — | "0,00" |

- Todo campo mostra a etiqueta discreta **"opcional"** à direita do rótulo.
- → O placeholder de fallback `"0,00"` é o mesmo tom cinza do placeholder de referência. **Um número cinza
  hoje significa duas coisas opostas** ("o catálogo cobra 20%" e "não há referência nenhuma") e nada na
  peça distingue as duas.
- → O placeholder de percentual não tem casas decimais (`20`) e o de dinheiro tem (`7,00`), porque vêm de
  formatações diferentes. Lado a lado na mesma grade, isso lê como inconsistência.
- Sob a grade, **um único parágrafo** de largura total concatena duas frases:
  "Tabela por faixa de preço — valores da faixa do seu anúncio." + "Nesta faixa, a taxa fixa é 50% do preço
  do anúncio — o placeholder mostra o valor já calculado."
  → As duas dizem coisas diferentes (uma é aviso de volatilidade, a outra é a regra de UM campo) e hoje
  formam um bloco cinza indistinto, no mesmo peso visual do resto.
- Abaixo, em linhas separadas do mesmo tom: subsídio de frete da Shopee, sobretaxa opcional (Switch) e os
  selos em `Badge`.

## Conteúdo e dados reais
- **Números verdadeiros do catálogo semente (2026-08-06)**, Shopee CNPJ: faixa `R$ 12,00–80,00` → 20% +
  R$ 7,00; `R$ 80,00–100,00` → 14% + R$ 19,00; `R$ 200,00+` → 14% + R$ 29,00. Catch-all abaixo de R$ 8,00:
  20% + **taxa fixa = 50% do preço** (anúncio de R$ 6,00 ⇒ placeholder `3,00`). ML Clássico: 14% + R$ 6,75;
  ML Premium: 19% + R$ 6,75. Amazon Individual: R$ 2,00 por item.
- **O placeholder muda sozinho** quando o preço do anúncio troca de faixa (o anúncio sobe de R$ 79,00 para
  R$ 81,00 e a comissão cai de 20% para 14%, o fixo salta de R$ 7,00 para R$ 19,00). Isso é o coração da
  peça: um número que se mexe sem o vendedor tocar nele.
- Selos existentes, verbatim: "Referência: {fonte} (para {categoria}) · atualizada em 06/08/2026" ·
  "referência embutida (offline)" · "· pode estar desatualizada" · "categoria não informada — usando a maior
  alíquota da tabela" · "ajustado por você" · "sem referência — informe as taxas" · "estimativa de frete" ·
  selo separado "Taxa fixa · {fonte} · vigente desde {data}".
- Aviso de plausibilidade no campo Comissão (não é erro, não recusa nada): "Confira a comissão: 0,12%.
  Marketplaces costumam cobrar entre 10% e 20% — se você quis dizer 12%, escreva 12 e não 0,12. Nada foi
  recusado."
- Campos de dinheiro ganham máscara de milhar **no blur** ("4000,00" vira "4.000,00"); percentual nunca.

## Estados obrigatórios
1. **Repouso com referência** — campo vazio, placeholder `20` / `7,00`, selo de referência com fonte e data.
2. **Repouso sem referência** — o catálogo não cobre este caso; hoje mostra `0,00` cinza + selo "sem
   referência — informe as taxas". Desenhe uma representação que **não pareça a alíquota zero**.
3. **Faixa recém-trocada** — o mesmo campo com outro número, sem o vendedor ter tocado. Precisa de alguma
   marca de que aquilo acabou de mudar (o desenho decide; hoje não há nenhuma).
4. **Foco** — cursor no campo ainda vazio: o número do catálogo continua legível ou some?
5. **Digitado (ajustado por você)** — o vendedor escreveu `18`; o selo do slot passa a "ajustado por você" e
   o número do catálogo **desaparece**. Desenhe como (ou se) ele continua acessível para voltar atrás.
6. **Erro do campo** — borda de erro + mensagem por campo; a linha do canal diz "Corrija os campos deste
   canal para ver os preços."
7. **Aviso (não-erro)** — a frase da comissão 0,12% abaixo do campo, em tom de atenção, sem borda vermelha.
8. **Faixa sem tarifa publicada** — "Sem tarifa publicada para a faixa de preço deste anúncio — informe a
   comissão do canal para precificar."
9. **Offline / referência embutida** — selo "referência embutida (offline)" em tom neutro; o placeholder
   continua funcionando (o cálculo é local).
10. **Falha de atualização** — "Não foi possível atualizar as taxas" / "Usando a referência salva no
    dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente." +
    "Tentar novamente". Nunca vira parede de erro.
11. **Sem permissão (freemium)** — o bloco inteiro desabilitado com a razão dita ao lado: "Vender em
    marketplaces faz parte do Premium." Nunca um controle cinza mudo.
12. **Desabilitado / hover / pressionado** dos controles do slot (Switch da sobretaxa, botão "Remover
    canal" — hoje um "✕").

## Viewports
- **Mobile 390px** — obrigatório e é onde a peça quebra: a grade de 2 colunas deixa entre **77px e 187px**
  úteis por campo. É a largura que já cortou texto aqui.
- **Desktop 1280px** — a Calculadora desktop existe desde 016/PR-B; o slot vive numa coluna mais larga e a
  grade de 2 colunas passa a caber com folga. Mostre o que fazer com o espaço (a legenda vira lateral? os
  quatro campos viram uma linha?).
- 1920px opcional, só se a sua solução mudar de forma além de 1280px.

## Regras que o desenho não pode quebrar
- **Frase honesta nunca dentro de placeholder.** Já foi pago: a regra "= 50% do preço" como sufixo do campo
  cortava para `2,50 (= 50` — parêntese aberto e um número solto, exatamente a leitura errada que a frase
  existia para impedir. Texto explicativo mora em elemento de largura total.
- **Procedência sempre dita.** Todo número que a tela aplica sem o vendedor digitar precisa dizer de onde
  veio e de quando é. Selo silencioso = número inventado.
- **Degradação dita, nunca escondida.** Catálogo velho, catch-all e "sem referência" são afirmações
  diferentes e não podem ter o mesmo peso visual de uma referência confirmada.
- **Falha de rede não é falta de premium** e nunca bloqueia o cálculo (que roda offline).
- **Freemium binário**: ou o bloco funciona, ou está desabilitado com a razão em texto legível ao lado.
- Alvo de toque ≥44×44px em qualquer controle do slot (o "✕" de remover e o Switch já foram achados aqui).
- Contraste do placeholder medido **contra o fundo real do input**, não contra o fundo do card: ele carrega
  informação de dinheiro, não é decoração — e um placeholder padrão costuma ficar abaixo do mínimo.

## Armadilhas já pagas neste projeto
- Campo vazio ao lado de um preço já descontado: quatro campos lendo "Comissão 0,00 %" com 15% aplicados no
  preço (015/A8). É a razão desta peça existir.
- Sufixo que corta em coluna estreita (016/PR-F, reverify r5-*): medir com 77px, não com o desktop.
- Texto ocluso/estourado passa em `toBeVisible` e `toContainText` — layout aqui se decide com caixa, não com
  string.
- Valor grande estourando coluna: R$ 1.234,56 com máscara de milhar num campo de 77px úteis.
- Legenda longa (a da sobretaxa tem ~230 caracteres) empurrando o card — ela precisa quebrar linha à
  vontade, e ainda assim não pode virar um muro cinza.

## Entregável
Pranchetas, tema **escuro como padrão e claro como first-class** (as duas para as pranchetas 1 e 3):
1. Slot de canal completo em repouso, mobile 390px, Shopee com referência (grade + as duas legendas + selos).
2. **Matriz de estados do campo Comissão** em 390px: repouso com referência · repouso sem referência · foco ·
   digitado/ajustado · erro · aviso 0,12% · desabilitado por freemium.
3. **A troca de faixa**, dois quadros lado a lado: anúncio R$ 6,00 (fixa `3,00`, regra de 50%) e anúncio
   R$ 27,55 (20% + R$ 7,00) — mostrando como o vendedor percebe que o número se mexeu.
4. O mesmo slot em desktop 1280px.

Reutilize os primitivos existentes, sem criar novos: `tf-inputwrap` + `tf-input--num` com afixo `R$`
(`tf-inputwrap__affix--strong`) e sufixo `%`; `tf-field` com rótulo e a etiqueta `tf-field__optional`
("opcional"); `tf-field__aviso` para a frase de plausibilidade; `Badge` para os selos (tons info/neutro);
`Card padding="md"` para o slot; `Switch` para a sobretaxa; `tf-price--*` só nos preços resultantes, nunca
no campo. Se a sua solução exigir uma marca nova (um "valor herdado" que não é placeholder nem valor),
descreva-a como variante de `tf-inputwrap`, não como componente novo.

## Perguntas em aberto para o dono
1. **Placeholder cinza ou valor preenchido?** O protótipo de 2026-07-02 mandava preencher (R$ 6,75 + 14%);
   o código escolheu placeholder para que o marcador "ajustado por você" não minta. Qual convenção vale — e
   se for preenchido, como a tela distingue "veio do catálogo" de "eu digitei"?
2. **Sem referência, o campo mostra o quê?** Hoje mostra `0,00`, indistinguível de uma alíquota zero. Vale
   um travessão "—", vazio puro, ou outra marca?
3. **A legenda deve nomear a faixa em números** ("de R$ 12,00 a R$ 80,00: 20% + R$ 7,00") ou continuar
   genérica ("valores da faixa do seu anúncio")?
4. Quando o vendedor digita por cima, o valor do catálogo deve permanecer visível em algum lugar (para
   comparar e para voltar), ou some de propósito?

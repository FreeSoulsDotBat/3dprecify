# Seção "Custos da peça" — a grade que a calculadora abre inteira

## O que desenhar

O primeiro bloco de entrada da tela **Calcular preço** (`/calcular`) — e o mesmo bloco reaproveitado na
página cheia do produto no Catálogo. É um Card único, sempre aberto, com o título "Custos da peça" e um ⓘ
ao lado, onde o vendedor leigo digita tudo que forma o custo de produção de uma peça impressa: filamento,
energia, tempo, máquina, manutenção e falha. É a PRIMEIRA coisa que ele vê depois do cabeçalho da tela
(acima só existe, quando há catálogo, um card de "prefill" de filamento/impressora). Tudo que vem depois —
"Mão de obra e custos", "Markup", "Marketplace" e o detalhamento "Como chegamos no preço" — depende dos
números daqui. É gratuito: nenhum campo desta seção é premium, nenhum gate mora aqui.

## Por que este prompt existe

A ORGANIZAÇÃO desta seção nunca foi desenhada — foi inferida por um agente — e **contraria por escrito** o
protótipo de 2026-07-02, em três lugares. O protótipo cria o componente "Collapsible section — cabeçalho
tocável (≥44px) com chevron; usado nas seções avançadas da calculadora" (§D.2); o §E4 manda "Seções
COLÁVEIS (progressive disclosure): Energia · Máquina/Depreciação · Falha · Marketplace. Regra: mostre 1
aberta + 1 fechada — nunca tudo aberto de uma vez"; e o §I lista "Abrir todas as seções avançadas de uma
vez (intimida)" entre os antipadrões. O protótipo implementava isso literalmente (4 entradas básicas + três
seções coláveis). Hoje não existe UMA seção colável na feature inteira: os CAMPOS sobreviveram, a
organização desenhada foi negada.

## O que já existe hoje (não invente do zero — corrija)

Título da seção: **"Custos da peça"**, com ⓘ "Sobre os custos da peça" cujo corpo é:
"O custo de produção da peça. Material = (custo do rolo ÷ peso do rolo) × gramas usadas. Energia = tempo de
impressão × consumo médio × tarifa. Máquina = (valor da máquina ÷ vida útil em horas) × tempo de impressão."

**Grade de 7 campos numéricos** (nesta ordem, todos no mesmo Card, sem separação visual entre obrigatório e
opcional além da tag "opcional" cinza à direita do rótulo):

| # | Rótulo (literal) | Prefixo/sufixo | Obrig.? | Semente | ⓘ / dica |
|---|---|---|---|---|---|
| 1 | Custo do rolo | R$ | sim | 100,00 | — |
| 2 | Peso do rolo | kg | sim | 1 | — |
| 3 | Gramas usadas | g | sim | 100 | ⓘ "Sobre as gramas usadas" |
| 4 | Consumo médio | kW | sim | 0,12 | dica sempre visível + ⓘ |
| 5 | Tarifa de energia | R$ … /kWh | sim | 1,00 | ⓘ "Sobre a tarifa de energia" |
| 6 | Reserva de manutenção | R$ … /h | **não** | 0 | ⓘ "Sobre a reserva de manutenção" |
| 7 | Taxa de falha | % | **não** | 0 | ⓘ "Sobre a taxa de falha" |

Dica sempre visível do campo 4: "Consumo médio real da impressora, não a potência de placa (~0,12 kW)."

Depois da grade, no MESMO Card e sem título próprio:

- **Tempo de impressão** (obrigatório) — dois controles lado a lado: horas (aceita "2:30" digitado) e
  minutos, com sufixos "h" e "min". Semente 5 h / 0 min.
- **Valor da máquina** (obrigatório, R$) — semente **R$ 4.000,00**.
- **A pergunta da máquina**, em modo "ritmo" por padrão: dois selects — "Com que frequência ela roda?"
  (Poucas horas por semana · Quase todo dia · Praticamente o dia todo) e "Em quantos anos quer que ela se
  pague?" (1 anos … 5 anos) — seguidos da legenda derivada **"≈ R$ 1,11 por hora de impressão"** e do botão
  secundário pequeno "Ajustar horas direto".
- **Modo "ajustar"** (alternativo): some os dois selects e aparece o campo "Vida útil da máquina" em h
  (semente 3600) com seu ⓘ, mais o botão "Usar estimativa por ritmo".

→ **Problema 1 (o central):** três naturezas diferentes de controle — grade numérica, campo de tempo e uma
pergunta em linguagem natural — moram sob o mesmo título, sem hierarquia. O leigo leva 7 campos + tempo +
duas perguntas de uma vez.
→ **Problema 2:** obrigatório e opcional estão fundidos; a única distinção é a palavra "opcional".
→ **Problema 3:** a grade é `auto-fit` — o número de campos por linha é o que sobrar, não uma decisão. O
desenho deve DIZER quantos por linha em cada largura.
→ **Problema 4 (copy):** "1 anos" no primeiro item do select de payback.

## Conteúdo e dados reais

Todos os valores são texto pt-BR com vírgula decimal e máscara de milhar aplicada no **blur** — por isso
"R$ 4.000,00" só fica formatado depois do primeiro toque (desenhe já formatado, mas o estado cru existe).
Faixas plausíveis reais, extraídas dos avisos do produto: consumo médio perto de 0,12 kW
(acima de 5 kW já é chuveiro elétrico); tarifa perto da média nacional publicada; rolo de 1 kg; vida útil
1.200 h/ano × 3 anos = 3.600 h; taxa de falha tipo "4 perdidas em 40 = 10%". Com a semente completa o custo
total fecha em R$ 16,16 e o varejo em R$ 24,24 — use esses números nas pranchetas, não inventados.
Campos opcionais nascem em 0 e não contribuem com nada até serem tocados. Nada aqui é derivado, exceto a
legenda "≈ R$ 1,11 por hora de impressão", que é a divisão do valor da máquina pelas horas de vida útil.

## Estados obrigatórios

- **Repouso** (semente carregada, modo ritmo) — o estado da primeira visita.
- **Foco** — anel visível em campo, select e nos gatilhos ⓘ; a ordem de tabulação segue a leitura.
- **Hover / pressionado** — nos dois botões secundários e nos gatilhos ⓘ.
- **Erro de validação** — a mensagem SUBSTITUI a dica do campo. Frases literais: "Informe um número
  válido." · "Não pode ser negativo." · "Campo obrigatório." · "Valor muito alto." · "O peso do rolo deve
  ser maior que zero." · "A vida útil deve ser maior que zero."
- **Aviso de plausibilidade** — tom distinto de erro, entra como DICA, nunca como recusa. Ex.: "Confira o
  consumo: 120 kW. Acima de 5 kW já é faixa de chuveiro elétrico — uma impressora fica perto de 0,12 kW. A
  etiqueta costuma trazer watts: 120 W são 0,12 kW. Nada foi recusado." Todo aviso termina em "Nada foi
  recusado." e é DESCRITIVO, nunca corretivo. Desenhe o campo com dica + aviso empilhados (o campo 4 pode
  ter os dois ao mesmo tempo).
- **Campo opcional em repouso** — tag "opcional" à direita do rótulo, valor 0.
- **Tooltip ⓘ aberto** — o corpo do texto é longo (3–4 frases); mostre um caso real, ex. o de "Sobre a taxa
  de falha".
- **Modo ritmo × modo ajustar** — as duas faces da pergunta da máquina, com o botão de troca em cada uma.

Não existem, nesta peça: carregando, vazio, offline, degradado, premium pausado ou sem permissão. O cálculo
roda offline e a seção é gratuita — não desenhe gate, selo nem skeleton aqui.

## Viewports

- **390px (mobile)** — obrigatório: é onde a seção é usada de verdade e onde a intimidação dói. Hoje a
  grade empacota 2 campos por linha.
- **1280px (desktop)** — obrigatório: o Card ocupa a COLUNA ESQUERDA de uma grade de duas colunas com
  largura de conteúdo limitada (~1120px), então sobra pouco mais de meia tela para ele. Diga quantos campos
  por linha cabem ali. 1920px é opcional — com a largura limitada, o desenho de 1280 se repete centralizado.

## Regras que o desenho não pode quebrar

- **Aviso nunca vira validação**: o aviso de plausibilidade não pode ser vermelho nem parecer recusa — o
  produto aceitou o número.
- **Frase honesta nunca em placeholder**: avisos, dicas e a legenda "≈ R$ 1,11 por hora de impressão" moram
  em elementos de largura cheia; placeholder carrega só número.
- **Procedência do número derivado**: se a vida útil vem do ritmo, isso é dito em voz alta na legenda; o
  modo "ajustar" nunca some sem que o usuário tenha pedido.
- **Alvo ≥44px** em ⓘ, selects e nos dois botões secundários — o protótipo já exigia isso para o cabeçalho
  colável.
- **Contraste medido contra o fundo real do Card** (não o da página) — vale sobretudo para a tag "opcional"
  e para a legenda derivada. E zero rolagem a 360px, medida nos DOIS eixos.

## Armadilhas já pagas neste projeto

- **O clip de 1px**: "Tarifa de energia" carrega prefixo "R$" **e** sufixo "/kWh"; numa grade rígida de 2
  colunas a 360px sobrou 1px de largura visível para o NÚMERO. Qualquer coluna que você propuser precisa
  caber esse campo com folga real.
- **O reflow do grid**: mudar quantos campos cabem por linha reorganizou a leitura sem que ninguém
  decidisse. Decida.
- **Selects espremidos**: os dois da máquina precisavam de ~197px só de texto na opção mais longa e tinham
  87px a 360px — eles empilham em largura cheia quando não cabem. E "Em quantos anos quer que ela se
  pague?" quebra em 2 linhas: os dois rótulos reservam a mesma altura, senão um select desce sozinho.
- **Botão que não parece botão**: o "Ajustar horas direto" já foi texto puro sem borda; no toque não existe
  hover que revele a afordância.

## Entregável

Pranchetas, tema escuro como padrão e tema claro como primeira classe (as duas para cada prancheta):

1. Mobile 390 — repouso, modo ritmo, semente completa.
2. Mobile 390 — um campo com erro + um campo com aviso de plausibilidade + um ⓘ aberto.
3. Mobile 390 — modo "ajustar horas direto".
4. Desktop 1280 — repouso, o Card na coluna esquerda, com entorno suficiente para se ver a proporção.
5. **Duas variantes de organização, lado a lado**, para o dono escolher: (A) tudo aberto como hoje, apenas
   com hierarquia e agrupamento visual; (B) o disclosure progressivo do protótipo — o essencial
   (material + tempo) aberto e os grupos avançados (Energia · Máquina · Falha) coláveis, com cabeçalho
   tocável e chevron, "1 aberta + 1 fechada".

Reutilize os primitivos `tf-*` existentes, sem criar novos: Card para o bloco, SectionTitle com ⓘ para o
título, Field (rótulo + tag "opcional" + dica + erro) para cada campo, NumberField com prefixo/sufixo para
os numéricos, Select para ritmo e payback, Button `secondary` `sm` para as trocas de modo, InfoTip para os
ⓘ. Se a variante B exigir um cabeçalho colável, ele é o componente do protótipo (§D.2) — desenhe-o como
primitivo novo apenas se o dono aprovar a variante B.

## Perguntas em aberto para o dono

1. **Volta o disclosure progressivo do protótipo (§E4: "1 aberta + 1 fechada, nunca tudo aberto") ou fica
   tudo aberto?** É a decisão que governa o desenho inteiro; hoje o código diz o contrário do desenho e
   ninguém registrou a mudança.
2. Se voltar: quais grupos? A divisão do protótipo era Energia · Máquina/Depreciação · Falha — Material e
   Tempo ficariam sempre visíveis?
3. Os dois campos opcionais (Reserva de manutenção, Taxa de falha) nascem visíveis ou atrás de um "ajustes
   finos"? Hoje a única distinção deles é a palavra "opcional".
4. A pergunta da máquina continua dentro de "Custos da peça" ou vira sua própria seção? São três naturezas
   de controle sob um título só.
5. "1 anos" no select de payback — corrigir para "1 ano" (singular)?

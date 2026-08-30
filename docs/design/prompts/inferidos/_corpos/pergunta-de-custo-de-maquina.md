# "Quanto custa a máquina" — a pergunta em linguagem natural, o custo/hora dito em voz alta e o modo de ajuste

## O que desenhar

O bloco final do card **"Custos da peça"**, na aba **Calcular** — a tela que qualquer visitante abre, sem
conta e sem premium. Ele vem depois da grade de campos de custo (rolo, peso, gramas, energia, tarifa) e do
campo de tempo de impressão (h + min), e é o último bloco antes do resultado. Quem o usa é um vendedor leigo
que acabou de comprar uma impressora e não sabe o que é depreciação: em vez de pedir "vida útil da máquina em
horas", a tela pergunta **quanto a máquina custou**, **com que frequência ela roda** e **em quantos anos ele
quer que ela se pague** — e devolve, em voz alta, quanto isso dá **por hora de impressão**. Existe um segundo
modo dentro do mesmo bloco, para quem já sabe o número e quer digitá-lo cru.

## Por que este prompt existe

Nada disto foi desenhado. Um agente decidiu que a pergunta viraria **dois Selects** (e não campos numéricos,
nem chips, nem um slider), decidiu o texto e a ordem das opções, decidiu que o número derivado seria uma
**legenda** e não um campo, e inventou a existência, o peso visual e a transição de um **segundo modo** dentro
do card. `autoridade: PROTOTIPO_PARCIAL` — há um ancestral real, e ele é parcial de um jeito específico: o
protótipo de 2026-07-02 (§E4/§E5 e os `-fixes` itens 34/17) desenha "responder o desgaste por uma escolha
nomeada em vez de digitar", mas **na aba Catálogo, no formulário de Impressora**, com o enum
"Básico 10% / Médio 20% / Profissional 30% / Intenso 45%" mapeando para um **percentual de desgaste** — não
para horas de vida útil, não com 3 ritmos × 5 paybacks, e não na tela Calcular. O `CalculatorScreen.jsx` do
protótipo (88-93) faz máquina com dois campos crus (Custo/hora × Horas). Ou seja: a ideia de "escolher em vez
de digitar" tem ancestral; **esta** peça — a pergunta em linguagem natural, a legenda derivada e o segundo
modo — não tem nenhum.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/calculator/calculator-form.tsx` (`MachineCostFields`) +
`machine-cost.ts` + os textos em `shared/i18n/messages.pt-br.ts`.

Ordem atual, de cima para baixo, dentro do card "Custos da peça":

| # | Elemento | Texto literal hoje | Observação |
|---|---|---|---|
| 1 | Campo dinheiro, obrigatório | rótulo **"Valor da máquina"** | prefixo `R$`, semente `4.000,00` |
| 2 | Select | **"Com que frequência ela roda?"** | 3 opções, ver abaixo |
| 3 | Select | **"Em quantos anos quer que ela se pague?"** | opções `1 anos` … `5 anos` |
| 4 | Legenda | **"≈ R$ 1,11 por hora de impressão"** | texto `--fs-caption` / `--text-muted` |
| 5 | Botão secundário `sm` | **"Ajustar horas direto"** | alinhado à esquerda |

Opções do ritmo, nesta ordem: **"Poucas horas por semana"** (260 h/ano) · **"Quase todo dia"** (1.200 h/ano) ·
**"Praticamente o dia todo"** (3.300 h/ano). Payback: 1 a 5 anos.

No **modo ajustar** os itens 2–5 somem e entram: o campo **"Vida útil da máquina"** (unidade `h`, obrigatório,
com ⓘ **"Sobre a vida útil da máquina"** na linha do rótulo) e o botão secundário `sm`
**"Usar estimativa por ritmo"** (a ficha da auditoria chamou este botão de "voltar" — o texto real é este).

Problemas que o desenho precisa resolver:

- → **"1 anos"**. O rótulo é o molde `"{n} anos"` aplicado a 1..5, e a primeira opção sai errada em português.
- → **A legenda derivada é o texto de MENOR contraste do card.** O número que justifica o bloco inteiro
  (`≈ R$ 1,11 por hora de impressão`) é caption cinza-mudo, com menos peso que qualquer rótulo de campo.
- → **No modo ajustar a legenda de custo/hora DESAPARECE.** Justamente o modo em que a pessoa digita o número
  cru — e erra — é o único sem o retorno "isso dá R$ X por hora".
- → **A troca de modo sobrescreve o que a pessoa digitou, calada.** "Usar estimativa por ritmo" reescreve as
  horas digitadas com ritmo × payback, sem aviso e sem desfazer.
- → **Os dois modos não se anunciam.** Não há título, nada nomeia "estimativa" contra "ajuste"; o segundo modo
  simplesmente troca o conteúdo do bloco.

## Conteúdo e dados reais

- **Valor da máquina** — dinheiro, obrigatório, prefixo `R$`, máscara de milhar aplicada no blur.
  Exemplo real (a semente da primeira visita): **R$ 4.000,00**.
- **Ritmo** — escolha, nunca digitado; 3 opções fixas (260 / 1.200 / 3.300 h/ano). Padrão: "Quase todo dia".
- **Payback** — escolha, 1 a 5 anos. Padrão: 3 anos.
- **Derivado** — `vida útil (h) = h/ano do ritmo × anos`; a semente 1.200 × 3 = **3.600 h**. O que aparece na
  tela é só **R$ 4.000,00 ÷ 3.600 h ≈ R$ 1,11 por hora de impressão** — as 3.600 h nunca são mostradas no modo
  estimativa. (Consequência real na tela: custo total R$ 16,16, varejo R$ 24,24, atacado R$ 21,01.)
- **Vida útil da máquina** (só no modo ajustar) — inteiro em horas, obrigatório, sufixo `h`.
  Erro de validação existente: **"A vida útil deve ser maior que zero."**
- **ⓘ "Sobre a vida útil da máquina"** — corpo já homologado: *"A impressora se gasta imprimindo. Espalhar o
  preço dela pelas horas faz cada peça devolver um pedaço da máquina — assim a próxima sai do negócio, não do
  seu bolso. Fabricante não publica esse número: estime. Horas que você imprime por ano × anos até querer
  trocar. Ex.: 1.200 h/ano × 3 anos = 3.600 h."*
- **Aviso de plausibilidade** (dispara com horas > 0 e < 100, abaixo do campo, sem recusar nada):
  *"Confira a vida útil: 3 horas é menos de uma semana ligada. Se você pensou em anos, multiplique pelas horas
  que imprime por ano — 1.200 h/ano × 3 anos = 3.600 h. Nada foi recusado."*

## Estados obrigatórios

- **Repouso, modo estimativa** — os dois Selects preenchidos e a legenda derivada visível. É o estado da
  primeira visita.
- **Repouso, modo ajustar** — campo de horas + ⓘ + botão "Usar estimativa por ritmo". Abre por escolha da
  pessoa **ou** automaticamente quando o valor guardado não é produto de nenhum ritmo × payback (um cenário
  salvo, ou uma impressora do Catálogo, com 2.000 h, por exemplo) — o número guardado nunca é coagido.
- **Foco / hover / pressionado / desabilitado** de cada Select, do campo e dos dois botões.
- **Aviso de plausibilidade ativo** — o campo de horas com o texto acima abaixo dele, em tom de aviso, com o
  campo ainda aceitando o valor.
- **Erro de validação** — horas vazias ou zero: "A vida útil deve ser maior que zero."
- **Derivado impossível** — quando o valor da máquina está vazio ou a vida útil é 0, o custo/hora vira
  R$ 0,00. Desenhe o que a legenda diz nesse momento (hoje ela diz "≈ R$ 0,00 por hora de impressão", o que é
  uma afirmação falsa dita com a mesma confiança do número certo).
- **Transição entre os modos** — mostre os dois lados e o que acontece com o valor digitado ao voltar.

Não há estado de carregamento, de rede, de offline nem de premium **neste bloco**: o cálculo é local, a aba
Calcular é gratuita e nada aqui é gateado. Não desenhe cadeado, teaser nem "pausado" aqui.

## Viewports

- **390px (mobile)** — obrigatório, é a viewport principal do produto. Os dois Selects empilham em largura
  total; a opção mais larga ("Poucas horas por semana") mede ~197px de texto e não pode ser cortada nem
  reticenciada dentro do controle fechado.
- **1280px (desktop)** — obrigatório. Os dois Selects ficam lado a lado, cada um com no mínimo 240px, dentro
  do card "Custos da peça", que divide a tela com o painel de resultado. Mostre o bloco na largura real que
  ele tem nesse layout, não em largura livre.

## Regras que o desenho não pode quebrar

- **Procedência do número**: a legenda de custo/hora é um valor **derivado**, e o desenho precisa deixar claro
  que ele vem das duas escolhas acima — não é um campo, não é editável, e não pode parecer um.
- **Nada é recusado**: o aviso de plausibilidade **avisa**, não bloqueia. A frase termina em "Nada foi
  recusado." e essa promessa precisa ser visível no desenho.
- **Frase honesta fora de placeholder**: o aviso e a legenda derivada vivem em elementos de largura total; um
  placeholder de campo carrega apenas número.
- **Alvos ≥ 44px** nos dois Selects e nos dois botões, inclusive no mobile.
- **Contraste medido contra o fundo real do card** — inclusive (e principalmente) para a legenda derivada e
  para o texto do aviso, que hoje são os dois textos mais apagados do bloco.
- **O botão de trocar de modo precisa parecer clicável em repouso**, sem depender de hover ou foco: um
  aparelho de toque nunca passa por esses estados antes do toque.

## Armadilhas já pagas neste projeto

- **Digitar "3" pensando em anos** levava o custo/hora de R$ 1,11 para **R$ 1.333,33**, calado. O aviso existia
  no código, com teste verde, e **nenhuma tela o renderizava** — foi achado só por review humano, porque a
  bateria automatizada faz `continue` quando o campo não está montado, e a semente 3.600 h abre no modo
  estimativa, onde o campo nem existe. O desenho deste bloco é a defesa contra esse erro.
- **Rótulo de duas linhas desalinhando os Selects**: "Em quantos anos quer que ela se pague?" quebra em duas
  linhas onde "Com que frequência ela roda?" cabe em uma. Os dois rótulos reservam a mesma altura; desenhe as
  duas linhas de rótulo, não a versão curta idealizada.
- **Campo espremido em vez de reempilhado**: nesta mesma tela, uma coluna fixa deixou o número de um campo com
  1px visível a 360/390px. A regra é reempilhar, nunca comprimir — e o card não pode gerar rolagem lateral a
  390px com o texto real das opções.

## Entregável

Pranchetas, no **tema escuro** (padrão) e no **tema claro** (first-class, não uma nota de rodapé):

1. 390px — modo estimativa, repouso, com R$ 4.000,00 e "≈ R$ 1,11 por hora de impressão".
2. 390px — modo ajustar, repouso, com ⓘ aberto num recorte à parte.
3. 390px — modo ajustar com o aviso de plausibilidade ativo (valor 3) e com o erro de validação (valor 0).
4. 1280px — o bloco dentro do card "Custos da peça", Selects lado a lado.
5. Uma prancheta de estados: foco/hover/pressionado/desabilitado dos dois Selects e dos dois botões.
6. Um recorte da transição entre os modos, mostrando o que acontece com o valor digitado.

Reutilize os primitivos `tf-*` existentes, sem criar novos: `Card` para o contêiner, `Field` (rótulo +
`labelAddon` para o ⓘ + slot de aviso) para cada controle, `Select` para ritmo e payback, `NumberField`
(currency para o valor, `unit="h"` para as horas) para os campos, `InfoTip` para o ⓘ e `Button variant
secondary size sm` para os dois botões de troca de modo. Se a solução exigir um primitivo novo, diga qual e
por quê, em vez de desenhá-lo.

## Perguntas em aberto para o dono

1. **Trocar de modo destrói o número digitado?** Voltar para "Usar estimativa por ritmo" reescreve as horas
   digitadas sem avisar. Confirma pedir, avisar, ou manter o descarte calado?
2. **O que a legenda diz quando não há número honesto** (valor da máquina vazio ou vida útil 0)? Hoje ela
   afirma "≈ R$ 0,00 por hora de impressão".
3. **As 3.600 h derivadas devem aparecer no modo estimativa**, junto do custo/hora, ou o número em horas é
   deliberadamente escondido de quem escolheu não pensar em horas?
4. **"1 anos"**: vira "1 ano" (texto por opção) ou o rótulo muda de forma?
5. Quando o valor da máquina e a vida útil **vieram de uma impressora do Catálogo** (premium), este bloco
   deveria dizer isso? Hoje não diz nada, e o modo ajustar pode abrir sozinho por causa disso.

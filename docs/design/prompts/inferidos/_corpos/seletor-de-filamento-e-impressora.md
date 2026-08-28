# Seletor "Usar do catálogo" dentro do editor de produto

## O que desenhar
O cartão que liga o catálogo salvo ao cálculo de um produto: dois seletores — **"Filamento salvo"** e
**"Impressora salva"** — no topo do editor de página cheia de Produto (`apps/web/src/pages/catalogo/
produto-page.tsx`, o formulário que abre em `/catalogo/produtos/novo` e `/catalogo/produtos/{id}`),
logo abaixo do cartão de nome + "Salvar produto" e acima das duas colunas de custos/markup. Quem usa:
o vendedor premium que já cadastrou filamentos e impressoras e agora quer que um produto herde esses
números. O momento é decisivo: **escolher um item aqui reescreve seis campos de custo do formulário
abaixo**, e é também o único lugar onde o produto pode ficar **sem vínculo** ("— Manual —"). Desenhe o
cartão inteiro com todos os seus estados, e a saída "manual" como afordância explícita.

## Por que este prompt existe
O protótipo de 2026-07-02 (§E4, linhas 245-246) especificou "dropdowns Filamento ▾ e Impressora ▾ (puxam
do catálogo) **+ link 'inserir manualmente' como fallback SEMPRE DISPONÍVEL**", e §F item 4 repetiu a
interação. A dupla de selects, portanto, tem desenho. **O código contraria a regra explícita**: o link
sempre disponível virou uma *opção dentro do select* — e uma opção que só aparece com o rótulo
"— Manual —" quando o vínculo **já foi perdido**. Nunca foram desenhados: o cartão-invólucro com título
e dica, a marca (inexistente) de que um campo veio do catálogo, e **a sobrescrita silenciosa** dos
valores digitados. O canvas do 018 desenha os dois selects, mas dentro de um bloco "Referências" da
ficha de 560px — outra superfície, menor, que não é esta.

## O que já existe hoje (não invente do zero — corrija)

| Parte | Conteúdo literal hoje |
|---|---|
| Título do cartão | "Usar do catálogo" |
| Legenda | "Preenche os campos com o item salvo — você ainda pode editar tudo." |
| Select 1 | rótulo "Filamento salvo" (rótulo justo), caret `▾`, primeira opção "Escolher…" |
| Select 2 | rótulo "Impressora salva" (rótulo justo), caret `▾`, primeira opção "Escolher…" |
| Opções | os nomes salvos pelo vendedor: "PLA Preto 1kg", "PETG Branco", "Ender 3 V2", "Bambu A1" |
| Primeira opção, quando o vínculo se perdeu | "— Manual —" no lugar de "Escolher…" |
| Aviso acima do cartão (produto sem vínculo) | `Alert tone="info"`, título "Vincule um filamento e uma impressora salvos", corpo "Os valores atuais foram mantidos e continuam editáveis." |
| Premium pausado | o cartão inteiro fica inerte dentro de um `fieldset` desabilitado; acima, "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." |

→ **A saída manual só existe depois do estrago.** Num produto novo ou vinculado, não há nenhuma forma
visível de dizer "quero digitar à mão"; a opção "— Manual —" nasce apenas quando o vínculo já sumiu.
O desenho precisa da afordância de saída **sempre presente**, como o protótipo pediu.

→ **Escolher sobrescreve em silêncio.** Não há aviso antes, confirmação, desfazer, nem qualquer marca
de que os campos abaixo foram reescritos. O vendedor que ajustou "Custo do rolo" para R$ 129,90 e depois
trocou de filamento perde o valor sem ver nada acontecer — a mudança ocorre longe dos olhos, em outro
cartão, possivelmente fora da tela no mobile.

→ **Nada diz que um campo veio do catálogo.** Depois do preenchimento, "Custo do rolo" é um input
comum, idêntico a um digitado à mão. Editá-lo **não** desfaz o vínculo: o produto continua salvo
apontando para o filamento, com um número que discorda dele — e ninguém é avisado.

→ **Falta o estado de falha de leitura que a tela irmã tem.** Em Calcular existe
`Alert tone="danger"` com "Não foi possível carregar seus itens salvos agora." + botão "Tentar
novamente". Aqui não existe. Pior: no produto **novo**, uma lista vazia por *falha de rede* cai na
mesma tela de pré-requisito que diz **"Para criar um produto, salve antes um filamento e uma impressora
no catálogo."** — uma frase falsa para quem tem dez filamentos salvos e está sem conexão.

→ **Não há estado de carregando.** Enquanto as listas chegam, os selects já aparecem só com "Escolher…",
indistinguível de "catálogo vazio". O produto já tem a palavra certa para isso em outro lugar:
"carregando…".

## Conteúdo e dados reais
Escolher um **filamento** escreve dois campos: "Custo do rolo" (dinheiro, obrigatório, ex.:
`R$ 129,90`; padrão do app `R$ 100,00`) e "Peso do rolo" (kg, obrigatório, maior que zero, ex.: `1`).
Escolher uma **impressora** escreve quatro: "Valor da máquina" (`R$ 4.000,00`), "Vida útil da máquina"
(horas, ex.: `3600`), "Consumo médio" (kW, ex.: `0,12`) e "Reserva de manutenção" (R$/hora, ex.:
`R$ 0,00` — opcional, pode vir zerada). Os dois selects são independentes e opcionais entre si: dá para
vincular só a impressora. Num produto **novo**, salvar exige os dois vínculos; num produto **já salvo**,
qualquer um pode ficar sem vínculo, e aí os valores permanecem editáveis. Escolher a opção vazia
desvincula e **mantém** os números que estão na tela — não limpa nada. Listas típicas: 3 a 12 itens;
nomes de até ~40 caracteres, sem truncamento previsto hoje.

## Estados obrigatórios
1. **Repouso, vinculado** — os dois selects mostrando os nomes escolhidos; nenhum aviso.
2. **Repouso, produto novo** — ambos em "Escolher…"; a saída manual visível mesmo assim.
3. **Foco** — anel de foco visível no select nativo, sem deslocar o caret `▾`.
4. **Hover / pressionado** — no select e na afordância de saída manual.
5. **Carregando** — listas ainda chegando: o campo diz "carregando…", **nunca** "— Manual —" nem
   "Escolher…" (dizer "manual" é uma afirmação sobre a procedência do dado, não um spinner).
6. **Vazio de verdade** (o vendedor não salvou nada) — hoje o cartão some em silêncio; decida o que
   aparece, sem sugerir que houve erro.
7. **Falha de leitura sem cache** — "Não foi possível carregar seus itens salvos agora." + "Tentar
   novamente"; jamais a frase de pré-requisito.
8. **Sem vínculo / degradado** — a opção "— Manual —" selecionada + o alerta info "Vincule um filamento
   e uma impressora salvos" / "Os valores atuais foram mantidos e continuam editáveis.". O alerta some
   **no instante** em que os dois vínculos existem, antes de salvar.
9. **Premium pausado (somente leitura)** — os dois selects desabilitados e legíveis, com "Premium
   pausado" acima; a leitura e o recálculo continuam completos.
10. **Momento da sobrescrita** — o estado que hoje não existe: o que o vendedor vê no segundo em que
    seis campos mudam de valor.
11. **Offline** — leitura do catálogo salvo funciona; escrever exige conexão ("Modo leitura offline" /
    "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão.").

## Viewports
**390px (mobile)** e **1280px (desktop)** — o editor de página cheia existe nos dois, e o 018 manteve
deliberadamente a página cheia em vez de recompor o formulário dentro da ficha de 560px. No mobile os
dois selects empilham e os campos que eles reescrevem ficam **abaixo da dobra** — é onde a sobrescrita
silenciosa dói mais, então desenhe esse recorte. No desktop o cartão ocupa a largura toda, acima da
grade de duas colunas (custos à esquerda, markup/marketplace à direita); mostre a relação espacial
entre o seletor e os campos que ele altera. 1920px opcional, só se a faixa mudar de proporção.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca vira outra história**: nem "você não tem itens", nem "não é premium".
- **Procedência do número**: se um valor veio do catálogo, o desenho pode dizer isso; se foi editado
  depois, não pode continuar afirmando que veio.
- **Degradação dita, não escondida**: "sem vínculo" é um estado calmo e nomeado, com os valores
  preservados — nunca um campo em branco nem um erro.
- **A frase honesta vive em elemento de largura cheia**, nunca dentro do `placeholder` de um campo
  (isso já foi pago em 016: o sufixo é cortado).
- **Freemium binário**: grátis/deslogado não vê meio-seletor; premium pausado **lê tudo**.
- Alvo tocável ≥44px em ambos os selects e na saída manual; contraste medido contra o fundo real do
  cartão, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: nome longo de filamento dentro de um select em 390px — mede-se a
  caixa, não o texto; `toBeVisible` passa em elemento estourado.
- **Placeholder que corta a frase** (016): qualquer explicação dentro do campo é perdida.
- **"manual" como fallback de carregamento** (013/FB-04): já foi corrigido na lista, não reintroduza no
  seletor.
- **Cartão que simplesmente some** (016/T072-A8): o desaparecimento silencioso foi o defeito, não a
  solução.
- **Valor grande estourando coluna**: `R$ 4.000,00` e `3600` convivem na mesma faixa de campos
  reescritos.

## Entregável
Pranchetas em **tema escuro (padrão)** e **tema claro (first-class)**: (a) o cartão em repouso
vinculado, mobile e desktop; (b) o cartão com a saída manual sempre visível — sua proposta de forma para
o "inserir manualmente" do protótipo; (c) o momento da sobrescrita (a peça nova a inventar); (d) os
estados carregando / falha com "Tentar novamente" / sem vínculo com o alerta info / premium pausado;
(e) o recorte mobile mostrando seletor + campos reescritos na mesma coluna. Reutilize os primitivos:
`tf-card` (padding md) para o invólucro, `tf-field` + `tf-field__label--tight` para os rótulos,
`tf-inputwrap`/`tf-selectwrap` + `tf-select` com o caret `▾` para os seletores, `tf-alert--info` para
"Vincule um filamento e uma impressora salvos", `tf-alert--danger` para a falha de leitura,
`tf-button--secondary` `sm` para "Tentar novamente". Não crie primitivo novo — se a marca de
procedência precisar de um, proponha-a como variação de um existente e diga qual.

## Perguntas em aberto para o dono
1. **A saída manual é link, botão ou opção do select?** O protótipo pediu "inserir manualmente" sempre
   disponível; o código entregou uma opção que só aparece depois de perder o vínculo. Qual das duas
   vale — e, se for a do protótipo, ela desvincula mantendo os valores (comportamento atual) ou limpa?
2. **O que acontece quando escolher um item sobrescreveria um valor editado à mão?** Avisar antes
   (confirmação), avisar depois (com desfazer), ou sobrescrever e apenas marcar os campos como vindos
   do catálogo? Cada opção dá um desenho diferente.
3. **Um produto vinculado cujos números foram editados continua vinculado?** Hoje sim, em silêncio — o
   produto aponta para o filamento e guarda valores que discordam dele. Isso é intencional?
4. **No produto novo sem nenhum item salvo, o editor deve continuar bloqueado** pela tela de
   pré-requisito, ou abrir com o caminho manual liberado e o catálogo como atalho opcional?

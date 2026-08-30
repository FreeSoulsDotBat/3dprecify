# Cartão de simulação na lista "Minhas simulações"

## O que desenhar
O cartão de uma simulação salva dentro da folha lateral "Minhas simulações", aberta pelo cabeçalho
da calculadora. É o objeto central da funcionalidade: o vendedor Premium abre a folha, varre uma
lista de estratégias salvas ("Shopee agressivo", "Mercado Livre clássico", "Feira presencial") e
escolhe qual reabrir — reabrir CARREGA a estratégia na calculadora e **recalcula tudo com os preços
de hoje**. Cada cartão carrega nome, nota opcional, um carimbo relativo de última alteração e uma
linha de ações (renomear · duplicar · excluir). Desenhe o cartão isolado e em lista, com todos os
estados, dentro da folha real — `min(92vw, 26rem)`, ou seja ~359px no mobile e 416px no desktop.

## Por que este prompt existe
O cartão nunca foi desenhado: a anatomia atual foi inferida de requisito textual. E a inversão que
mais importa é justamente a que ninguém desenhou — **este cartão é o único card de lista do produto
que, por regra, NÃO pode mostrar dinheiro**. Todos os cards de lista já desenhados aqui ostentam um
valor: o protótipo de Histórico (`data · produto · preço`), o de Catálogo (avatar + custo) e o
canvas de 018 (total em 1.125rem em Orçamentos, `money` em Catálogo). Uma simulação não tem preço
armazenado — o número só existe depois de reabrir e recalcular — então um preço no cartão seria uma
mentira de procedência. O mesmo vale para o carimbo: os cards desenhados mostram **data**; aqui a
regra proíbe data-alegação e só permite tempo relativo. Falta desenhar exatamente isso: um card de
lista sem dinheiro e sem data que ainda assim pareça o objeto principal da tela.

## O que já existe hoje (não invente do zero — corrija)
Um `Card padding="sm"` (16px, `--surface-card`, borda `--border-subtle`, raio de card), coluna com
4px de gap. Dentro, de cima para baixo:

| # | Conteúdo | Estilo hoje | Observação |
|---|---|---|---|
| 1 | Nome da simulação | 0.875rem, `font-medium`, uma linha com `truncate` | livre, digitado; obrigatório |
| 2 | Nota (opcional) | **0.875rem** `--text-muted`, `line-clamp-2` + `overflow-wrap:anywhere` | só quando existe |
| 3 | `"Atualizado há 2 dias"` | 0.75rem `--text-muted` | nunca uma data |
| 4 | Linha de ações à direita: ✏️ ✂️ 🗑️ (`pencil`, `copy`, `trash-2`, 18px, botão ghost `sm`) | fora do bloco clicável, irmã | rótulos só em `aria-label`: "Renomear {nome}", "Duplicar {nome}", "Excluir {nome}" |
| 5 | Motivo do bloqueio (só quando as ações estão desabilitadas) | 0.75rem `--text-muted`, alinhado à direita | frase inteira, ver estados |

Os itens 1–3 formam **um único `<button>` de bloco inteiro** (`aria-label` "Abrir {nome}"); as
ações ficam FORA dele. Não há badge, não há avatar, não há preço, não há data.

→ **Problema 1 — hierarquia inexistente:** nome e nota têm o MESMO tamanho (0.875rem). O que muda é
só peso e cor. Uma nota de duas linhas domina o cartão e o nome se perde.
→ **Problema 2 — o cartão não diz o que ele é:** nada nele distingue uma simulação (recalcula hoje)
de um orçamento congelado (preço do dia em que foi salvo). A frase que faz essa distinção aparece
UMA vez, no subtítulo da folha: `"Estratégias salvas. Cada uma recalcula com os preços de hoje
quando você abre."` — no cartão, silêncio. Vendedor que rolou a lista já perdeu a frase de vista.
→ **Problema 3 — o bloco é clicável mas não parece clicável:** é um `<button>` sem tratamento de
hover, sem estado pressionado e sem a borda/realce de `tf-card--interactive`, que é o idioma que o
resto do produto usa para "isto abre".
→ **Problema 4 — duplicar não tem retorno visual:** o ícone de duplicar dispara uma chamada de rede
que pode levar segundos e o botão não tem estado de carregando. O usuário toca de novo.
→ **Problema 5 — erro sem dono:** quando duplicar falha, o aviso vermelho aparece ACIMA da lista
inteira, sem indicar qual cartão falhou.
→ **Problema 6 — repetição:** o motivo do bloqueio (item 5) é estado da CONTA/CONEXÃO e se repete em
cada cartão; com 12 simulações, "Premium pausado — reative para renomear, duplicar, editar ou
excluir." aparece 12 vezes, embaixo do aviso do topo que já diz a mesma coisa.

Ao redor: título `"Minhas simulações"`, subtítulo (acima), campo de busca com placeholder
`"Buscar por nome…"`, faixas de aviso (offline / Premium pausado), a lista com 8px entre cartões e,
no fim, o botão `"Carregar mais"`. Tocar no bloco FECHA a folha e leva à calculadora.

## Conteúdo e dados reais
Cada simulação carrega apenas: id, **nome** (obrigatório, até 120 caracteres — `"Máximo de 120
caracteres."`), **nota** (opcional, até 500 — `"Máximo de 500 caracteres."`), a configuração salva
(canais, taxas ajustadas, base de custo) e as datas de criação/alteração. **Não existe preço, não
existe contagem de canais e não existe nome da base de custo no dado da lista** — tudo isso vive
dentro da configuração e nunca foi derivado para o cartão.

Carimbo relativo, literal, montado como `"Atualizado {quando}"`: `agora mesmo` · `há 7 min` ·
`há 3 h` · `há 1 dia` · `há 2 dias` · `há 5 semanas`. Nunca "12/08/2026".

Nomes reais para as pranchetas: "Shopee agressivo", "Mercado Livre clássico · frete grátis",
"Feira de artesanato — preço de balcão". Notas reais: "Só vale enquanto o cupom de frete durar" /
"Testar margem menor e ver se compensa no volume".

## Estados obrigatórios
- **Repouso com nota** e **repouso sem nota** — o cartão sem nota tem 2 linhas; o com nota tem até
  4. Desenhe os dois lado a lado: a diferença de altura na lista é o que se está resolvendo.
- **Hover** (desktop) e **pressionado** — hoje inexistentes; o bloco inteiro é o alvo.
- **Foco de teclado** — são QUATRO paradas de foco por cartão (bloco + três ícones). Mostre o anel
  em cada uma; o anel no bloco inteiro precisa caber sem estourar a folha.
- **Ações desabilitadas por offline** — três ícones apagados + a frase `"Esta ação precisa de
  conexão."`; acima da lista, a faixa `"Modo leitura offline"` com o corpo `"Suas simulações
  continuam aqui e podem ser abertas. Salvar, renomear, duplicar ou excluir precisam de conexão."`
  O bloco de abrir CONTINUA ativo — offline se lê e se abre.
- **Ações desabilitadas por Premium pausado** — mesma forma, frase `"Premium pausado — reative para
  renomear, duplicar, editar ou excluir."`; faixa do topo `"Premium pausado"` +
  `"Suas simulações continuam aqui e podem ser abertas e recalculadas. Para salvar, renomear,
  duplicar ou excluir, reative o Premium."` Abrir e recalcular seguem permitidos — a degradação é
  dita, e é só de escrita.
- **Duplicando** — o estado que o código não tem: o cartão precisa mostrar que a cópia está sendo
  criada.
- **Falha de escrita no cartão** — desenhe como o cartão que falhou se identifica (hoje não se
  identifica). Frases reais: `"Esta ação precisa de conexão."` ou a mensagem específica da API.
- **Adversarial** — nome de 120 caracteres sem espaço nenhum e nota de 500 caracteres em um único
  token. Nome trunca em uma linha; nota corta na segunda linha **com reticência visível**.
- **Lista vazia** e **sem permissão** (grátis/deslogado vê a oferta Premium, nunca a lista) não são
  o cartão — desenhe só como referência de contexto se ajudar a compor a prancheta da folha.

## Viewports
- **Mobile 390px** — a folha ocupa 92vw (~359px) e o cartão ~327px de conteúdo. É o uso principal.
- **Desktop 1280px** — a MESMA folha lateral, travada em 26rem (416px), sobreposta à calculadora.
  O cartão não vira grade de duas colunas nem ganha coluna de dinheiro: a folha é a mesma.
Não há versão de página cheia desta lista, e não há variante 1920px distinta de 1280px — a largura
é fixa; mostre 1280px só para provar o cartão contra o fundo escurecido da calculadora atrás.

## Regras que o desenho não pode quebrar
- **Nenhum valor em reais no cartão.** Nem "a partir de", nem preço antigo, nem margem. O preço de
  uma simulação só existe depois de reabrir e recalcular; qualquer número ali é procedência falsa.
- **Nenhuma data.** Só o tempo relativo — o cartão informa há quanto tempo mudou, não afirma um dia.
- **Falha de rede nunca vira "não é Premium"** e Premium pausado nunca esconde as simulações: o
  conteúdo continua legível e abrível nos dois casos; o que congela é a escrita, e isso é escrito.
- **As frases honestas ficam em texto próprio**, nunca dentro de placeholder e nunca truncadas: se
  não couber, o cartão cresce.
- **Alvos de toque ≥44px** para os três ícones — hoje são três botões `sm` colados com 4px de gap na
  ponta direita de um cartão de 327px; verifique que não viram uma fileira de alvos que se tocam.
- Contraste medido contra `--surface-card` real, nos dois temas — a legenda `--text-muted` de
  0.75rem é o pior caso.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: nome longo dentro de uma folha estreita já empurrou
  botões para fora da tela em outra peça deste produto. Meça a largura do cartão contra a folha.
- **Texto ocluso passa em teste**: teste algum afirma que o nome "está visível" mesmo quando ele foi
  cortado pela linha de ações. Prove com caixas, não com a presença do texto.
- **Clamp sem reticência**: uma nota de 500 caracteres sem espaço não mostra "…" por padrão — a
  reticência precisa ser visível no desenho, não implícita.
- **Estado de conta repetido por item** já foi problema no Catálogo (o mesmo aviso 40 vezes).
  Decida no desenho onde ele mora: no cartão, na faixa do topo, ou nos dois com pesos diferentes.

## Entregável
Pranchetas, tema escuro (padrão) e tema claro (first-class, não um apêndice):
1. **Anatomia** — cartão com nota e cartão sem nota, cotados: tamanhos, pesos, gaps, alvos.
2. **Interação** — repouso · hover · pressionado · foco no bloco · foco em cada ícone.
3. **Escrita congelada** — variante offline e variante Premium pausado, cada uma com a faixa do topo
   correspondente, mostrando a relação entre faixa e cartão.
4. **Trabalho e erro** — duplicando e falha de escrita atribuída ao cartão certo.
5. **Adversarial** — nome de 120 caracteres sem espaço + nota de 500 caracteres em um token só.
6. **Em contexto** — a folha inteira em 390px e em 1280px com 4 cartões, busca, faixa e
   "Carregar mais".
Reutilize os primitivos existentes: `tf-card--pad-sm` (com `tf-card--interactive` para o bloco
clicável), `tf-btn--ghost tf-btn--sm` + ícones `pencil`/`copy`/`trash-2` na linha de ações,
`tf-badge` se a resposta ao Problema 2 for um selo, `tf-alert` (tom `info`) para as faixas do topo,
`tf-inputwrap`/`tf-input` para a busca. Não crie primitivo novo; se algo faltar, aponte o que falta.

## Perguntas em aberto para o dono
1. **O cartão deve dizer, nele mesmo, que reabrir recalcula?** Um selo permanente ("recalcula hoje")
   em todo cartão vira ruído; a frase só no topo some ao rolar. É decisão de produto, não de layout.
2. **O cartão pode mostrar a base de custo e os canais salvos** (ex.: "Base: Vaso hexagonal ·
   Shopee, Mercado Livre")? O dado existe dentro da configuração salva, mas nunca foi derivado para
   a lista, e isso muda a densidade do cartão inteiro.
3. **As três ações continuam como ícones na face do cartão, ou viram um menu "⋯"?** O desenho de UX
   original pedia menu; o código compôs ícones inline por falta do primitivo de menu. Ícone visível
   custa três alvos por cartão; menu custa um toque a mais.
4. **O motivo do bloqueio deve repetir em cada cartão** ou basta a faixa do topo?

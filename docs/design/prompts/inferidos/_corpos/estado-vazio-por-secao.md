# Catálogo vazio: o primeiro contato de cada seção (Filamentos · Impressoras · Produtos · Kits)

## O que desenhar
O estado de **catálogo vazio por seção** — a tela que o vendedor Premium vê no seu primeiro dia, quando
abre `Catálogo` e ainda não salvou nada. São quatro variações da mesma peça, uma por aba da barra
segmentada (`Filamentos`, `Impressoras`, `Produtos`, `Kits`), e cada uma é o único conteúdo da página
naquele momento: acima dela ficam só o título "Catálogo" e as pílulas de seção; abaixo, nada. É o
onboarding real do produto — o vendedor acabou de pagar, entrou para "guardar meus filamentos" e o que
ele encontra aqui decide se ele salva o primeiro item ou fecha o app. Existe em mobile (390px) e em
desktop (≥1280px, onde a seção normalmente é um mestre-detalhe de duas colunas).

## Por que este prompt existe
A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`: a **estrutura** foi desenhada em 2026-07-02 e
o código a seguiu quase à risca (título "Nenhum {label} salvo", uma linha de corpo, um botão primário
"Adicionar {label}"). O que se perdeu na tradução foram três coisas. (1) O protótipo trazia **grafismo de
marca por seção** — espada para filamento/produto, arco para impressora, 84px; o código usa o mesmo
ícone genérico `package` de 28px nas quatro. (2) O protótipo tinha **duas ações**: a primária e um CTA
secundário de semeadura, "Começar com filamentos comuns", verificado renderizado na V3 (semeava PLA/PETG/
ABS); o construído tem uma só — a busca no código de hoje não encontra nenhuma linha de semeadura. (3) E
uma que nenhuma autoridade cobre: **o vazio dentro do mestre-detalhe do desktop**. Hoje o ramo do vazio é
avaliado antes do ramo de largura, então acima de 1280px o vazio ocupa a largura inteira e a coluna da
ficha, a busca e a contagem simplesmente não existem — a tela muda de arquitetura entre "zero itens" e
"um item".

## O que já existe hoje (não invente do zero — corrija)
A caixa vazia é o primitivo `tf-empty`: coluna centrada, largura máxima 28rem, `padding` generoso,
ícone dentro de um quadrado arredondado de 56px com fundo `accent-soft`, título, descrição em texto
esmaecido e um slot de ação.

| Seção | Título (literal) | Corpo (literal) | Botão primário |
|---|---|---|---|
| Filamentos | "Nenhum filamento salvo ainda" | "Salve seus filamentos uma vez e reutilize em cada cálculo." | "Adicionar filamento" |
| Impressoras | "Nenhuma impressora salva ainda" | "Salve os dados da sua impressora uma vez e reutilize em cada cálculo." | "Adicionar impressora" |
| Produtos | "Nenhum produto salvo ainda" | "Salve uma peça com seus custos e reabra com o preço sempre recalculado." | "Adicionar produto" |
| Kits | "Nenhum kit salvo ainda" | "Monte um kit com várias peças e reabra com o preço sempre recalculado." | "Montar kit" |

Essa copy é boa e foi homologada — **não reescreva os títulos nem os corpos**. O que precisa de desenho é
o resto:

- → **O ícone é o mesmo nas quatro seções** (`package`, 28px). O produto já tem o primitivo de grafismo de
  marca (`arco`, `espada`, `linha-curva`, `onda`), hoje usado no 404 e na tela de erro. Traga-o de volta
  para cá, em ~84px, com uma escolha por seção.
- → **Só existe uma ação.** O segundo caminho (semear exemplos) sumiu, e com ele o único jeito de o
  vendedor ver o catálogo funcionando antes de digitar um formulário inteiro.
- → **No desktop o vazio quebra a arquitetura da tela.** Com ≥1 item a seção é `lista (flexível) + ficha
  de 560px`, com uma barra de ferramentas em cima (campo de busca de até 420px, contagem "3 filamento(s)"
  alinhada à direita, botão "Adicionar filamento"). Com 0 itens, nada disso aparece: o `tf-empty` de 28rem
  fica sozinho e centrado num container de ~1600px, virando uma ilhota de conteúdo num oceano vazio.
- → **Vazio + Premium pausado não se falam.** O aviso "Premium pausado" só aparece quando existe pelo
  menos um item; num catálogo vazio o vendedor pausado vê "Adicionar filamento" como se pudesse salvar, e
  só descobre a verdade depois do clique, na gaveta que abre em modo leitura.
- Existe um **vazio diferente** já desenhado à parte: o da busca ("Nada encontrado para essa busca" /
  "Tente outro termo, ou limpe a busca para ver tudo de novo." / "Limpar busca"). Ele **não** é esta peça
  — não os unifique; dizer "nenhum filamento salvo" quando o vendedor tem 40 filamentos e filtrou seria
  mentira sobre os dados dele.

## Conteúdo e dados reais
- Cabeçalho da página: título "Catálogo" e a barra segmentada rotulada "Seções do catálogo" com as quatro
  pílulas. No desktop título e pílulas dividem a mesma faixa; no mobile a faixa quebra em duas linhas.
- Contagem (só quando há itens, mas útil para calibrar a barra): "{n} filamento(s)", "{n} impressora(s)",
  "{n} produto(s)", "{n} kit(s)"; um kit resume como "{n} peça(s)".
- Nenhum número de dinheiro aparece nesta peça — um catálogo vazio não tem preço, e a lista do catálogo
  nunca mostra preço nem quando está cheia (o preço é sempre recalculado ao abrir o item).
- Se o desenho propuser exemplos de semente, use nomes que o produto já usa como exemplo em outros
  lugares: "PLA Azul" para filamento, "Ender 3" para impressora, "Vaso G" para produto.
- Rótulos de ação já existentes que o desenho pode reaproveitar: "Tentar novamente", "Limpar busca",
  "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."

## Estados obrigatórios
1. **Vazio em repouso** (o caso principal, quatro variantes): grafismo da seção, título, corpo, ação(ões).
2. **Carregando** — hoje é apenas um `Spinner` centrado com respiro vertical, sem texto. Desenhe o que
   ocupa esse instante para que o vazio não pisque como se fosse resposta ("vazio" e "ainda não chegou"
   não podem parecer a mesma coisa).
3. **Erro de leitura** — faixa de tom perigo com "Não foi possível carregar seu catálogo." e botão
   secundário "Tentar novamente". Isto **substitui** o vazio; uma falha de rede jamais pode ser desenhada
   como "você não tem nada salvo".
4. **Offline (leitura degradada)** — faixa informativa (nunca perigo) "Modo leitura offline" + "Seus itens
   salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." Combinada com o vazio,
   o desenho tem de deixar claro que a ação primária vai falhar enquanto não houver conexão
   ("Criar e editar precisam de conexão.").
5. **Premium pausado + vazio** — o estado que hoje não existe: mostrar o aviso "Premium pausado" com
   "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." e
   apresentar a ação de forma honesta (reativar em vez de prometer um salvamento que será recusado).
6. **Sem direito (conta grátis / servidor recusou a leitura)** — caixa calma com ícone de coroa e a frase
   "Salvar faz parte do Premium." Não é o vazio do catálogo; é o convite honesto.
7. Estados de controle da ação primária: repouso, foco visível, hover, pressionado, desabilitado e
   carregando (quando a semente estiver gravando).

## Viewports
- **Mobile 390px** — a peça existe no mobile e é onde a maioria dos vendedores vê o app pela primeira vez.
  O grafismo de 84px + título + corpo + ação(ões) precisam caber acima da dobra, com a barra segmentada
  de quatro pílulas ainda visível.
- **Desktop 1280px** — o corte exato em que a seção vira mestre-detalhe (`lista + ficha de 560px`).
  Desenhe o vazio **dentro** dessa arquitetura: decida se a barra de ferramentas continua visível, o que
  ocupa a coluna da ficha quando não há item selecionado, e como a caixa vazia se ancora sem virar uma
  ilhota perdida.
- **Desktop 1920px** — acima de 1600px a lista de itens vira duas colunas; mostre que o vazio nessa
  largura não vira um bloco de 28rem centrado num vão de 1600px.

## Regras que o desenho não pode quebrar
- **Zero item salvo é um fato, falha de rede é outro.** Erro e offline têm superfícies próprias; nunca
  desenhe uma delas com a cara do vazio.
- **Freemium é binário e explícito**: ou a conta pode salvar, ou a peça diz que salvar é do Premium. Nada
  de botão que parece funcionar e recusa depois do clique.
- **Frase honesta nunca vive dentro de placeholder** — "Criar e editar precisam de conexão." e a linha do
  Premium pausado moram em elementos de largura cheia, não como sufixo de um campo.
- **Toda ação com alvo ≥44px**, inclusive o CTA secundário, que tende a nascer pequeno e "de texto".
- **Contraste medido contra o fundo real** do cartão/da caixa, nos dois temas — o quadrado do ícone usa
  fundo suave de acento e é onde o contraste costuma cair.
- Se houver semeadura, ela **grava dados na conta do vendedor**: o desenho tem de deixar isso explícito
  antes do clique e prever como o vendedor desfaz (excluir item por item já existe, com confirmação
  "Excluir “{nome}”?" / "Esta ação não pode ser desfeita.").

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: nomes colados pelo vendedor já produziram 4.948px de
  rolagem horizontal a 1440px nesta mesma tela. Se o desenho propuser um cartão de exemplo/semente,
  ele precisa quebrar nome longo sem espaço.
- **Texto ocluso passa em teste**: uma caixa centrada dentro de uma grade de duas colunas pode ser
  empurrada para fora da área visível sem que nenhuma verificação textual reclame — ancore a caixa na
  coluna certa e mostre a geometria.
- **Frase cortada em placeholder**: já aconteceu de a frase honesta ser posta como sufixo de campo e
  aparecer truncada. Placeholder carrega exemplo, não promessa.
- **O ícone genérico é o sintoma, não a doença**: quatro seções com a mesma arte fazem o vendedor achar
  que trocou de aba e nada mudou.

## Entregável
Pranchetas, no tema **escuro** (padrão) e no **claro** (first-class, não uma variação de cortesia):
1. Mobile 390px — as quatro variantes de vazio lado a lado (Filamentos, Impressoras, Produtos, Kits).
2. Mobile 390px — vazio + offline, e vazio + Premium pausado.
3. Desktop 1280px — vazio dentro do mestre-detalhe, com a decisão sobre barra de ferramentas e coluna da
   ficha visível.
4. Desktop 1920px — o mesmo em largura larga (lista em duas colunas quando cheia).
5. Uma prancheta de estados da ação: repouso/foco/hover/pressionado/desabilitado/carregando, e as
   superfícies vizinhas que substituem o vazio (carregando, erro, sem direito).

Reaproveite os primitivos existentes em vez de criar novos: a **caixa vazia** (`tf-empty`) com seus três
slots (arte, título, descrição, ação); o **grafismo de marca** (`tf-grafismo`, nomes `espada`, `arco`,
`linha-curva`, `onda`) no lugar do ícone genérico; o **botão** primário para a ação principal e o
secundário/fantasma para a ação de semeadura; a **faixa de aviso** (`tf-alert`, tons informativo e
perigo) para offline/erro/pausado; a **barra segmentada** (`tf-segmented`) para as pílulas de seção; o
**cartão** (`tf-card`) para qualquer exemplo ou para a coluna da ficha. Se algo realmente não existir,
diga qual primitivo faltou em vez de inventar um irmão parecido.

## Perguntas em aberto para o dono
1. **A semeadura volta?** O protótipo tinha "Começar com filamentos comuns" (PLA/PETG/ABS) e o produto de
   hoje não tem nada disso. Gravar itens na conta do vendedor em um clique é decisão de produto:
   entra, e para quais seções (impressora comum? produto de exemplo? kit?), ou fica de fora?
2. **Qual grafismo para Kits?** O protótipo só nomeou espada (filamento/produto) e arco (impressora); a
   seção Kits nasceu depois e não tem arte atribuída.
3. **No desktop, o vazio mantém a busca e a contagem visíveis?** Manter dá estabilidade de layout entre
   0 e 1 item; esconder dá uma tela de boas-vindas mais limpa. As duas são defensáveis e mudam o desenho.
4. **Produtos e Kits têm pré-requisito**: um produto exige um filamento e uma impressora salvos antes
   ("Para criar um produto, salve antes um filamento e uma impressora no catálogo."). O vazio de Produtos
   deve levar o vendedor de volta para Filamentos quando esse pré-requisito não estiver cumprido, ou
   apenas informar?

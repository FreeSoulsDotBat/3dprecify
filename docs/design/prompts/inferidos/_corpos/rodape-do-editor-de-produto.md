# Rodapé do editor de produto — o preço recalculado e as três ações que disputam o fim da página

## O que desenhar
O bloco final da página cheia de edição de produto (`/catalogo` → aba Produtos → abrir/criar um produto).
Depois do nome, dos dois seletores de catálogo (filamento e impressora) e das duas colunas de custos e
marketplace, vem este rodapé, que atravessa a largura inteira: o preço recalculado ao vivo com o
detalhamento de como ele foi montado e, embaixo dele, duas ações de persistência — "Salvar em Orçamentos"
e "Salvar simulação". Quem usa é o vendedor premium que acabou de ajustar um produto do catálogo e precisa
decidir o que fazer com o número que está vendo. É o último momento da tela: se a hierarquia aqui estiver
errada, ele erra a ação e só descobre depois.

## Por que este prompt existe
O bloco de resultado TEM desenho — o protótipo de 2026-07-02, §E4, desenha `PriceHero` com `tone="accent"`
e glow roxo, o detalhamento itemizado em `BreakdownRow` e a última linha em `emphasis="total"`, e o item 33
de `-fixes.md` moveu deliberadamente o glow do botão Salvar para o `PriceHero`, fixando que o foco visual
é a conta. O que nunca foi desenhado é o que veio DEPOIS dele: as duas ações de persistência e o
empilhamento das três coisas. O protótipo só conhecia "Ação Salvar → dispara bottom-sheet de upsell";
Orçamentos (§E6) e Simulações não existiam no inventário. Hoje as três estão empilhadas com peso visual
parecido, e a quarta ação — "Salvar produto", a única que grava o produto — ficou lá em cima, dentro do
primeiro cartão, fora de vista no momento da decisão.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/catalogo/produto-page.tsx` (rodapé), `features/calculator/calculator-form.tsx`
(`PriceResults`), `features/calculator/calculator-form.css` (`.tf-calc-footer`).

Ordem atual, de cima para baixo:

| # | Peça | Quando aparece | Observação |
|---|------|----------------|------------|
| 1 | Detalhamento + preços (`PriceResults`) | sempre que o cálculo é válido | tem desenho (§E4) |
| 1b | Alerta `danger` "Confira os campos destacados para ver o preço." | quando NÃO há resultado | ocupa o lugar inteiro do resultado |
| 2 | Botão secundário com ícone `save` (18px) "Salvar em Orçamentos" | só produto JÁ SALVO + preço válido + Premium ativo | some sem explicar |
| 3 | Botão secundário com ícone `save` (18px) "Salvar simulação" | mesmas condições | envolvido num `flex justify-center` avulso |
| — | "Salvar produto" | no primeiro cartão, no topo da página | **não está no rodapé** |

→ **Os dois botões são visualmente idênticos**: mesma variante secundária, mesmo ícone, mesmo tamanho,
rótulos que começam com a mesma palavra ("Salvar…"). Nada diz que um congela um valor para sempre e o
outro guarda uma estratégia que recalcula amanhã.
→ **O alinhamento diverge no mobile**: até 1024px o rodapé é uma coluna `stretch`, então "Salvar em
Orçamentos" nasce com a largura toda e "Salvar simulação", por causa do `flex justify-center`, nasce com a
largura do texto e centralizado. Dois botões irmãos, dois formatos. Acima de 1024px o rodapé centraliza
tudo e limita cada bloco a 720px, e a diferença some — ou seja, o defeito só existe onde o vendedor mais usa.
→ **A ordem contradiz a tela irmã**: em Calcular (`calcular-page.tsx`), o mesmo rodapé traz "Salvar
simulação" ANTES de "Salvar em Orçamentos". O corpo das duas telas é declaradamente idêntico (SC-305) e o
fim delas não é.
→ **A ação principal está fora do rodapé.** O vendedor chega ao fim com três botões e nenhum deles é o que
salva o produto que ele acabou de editar.
→ **As duas ações nunca aparecem durante a criação.** Num produto novo, ambas estão ausentes; ao salvar,
o app navega de volta para a lista. Elas só existem quando ele reabre o produto — e nada avisa isso.

## Conteúdo e dados reais
O detalhamento é um cartão com linhas rótulo→valor, todas em `R$`, na ordem: "Material", "Energia",
"Máquina", "Falha / perdas", "Acabamento", "Mão de obra", mais uma linha por item de "Outros custos"
(nome que o vendedor digitou), depois "Custo total" com ênfase `total`. Em seguida, ainda no mesmo cartão,
a derivação: "Preço varejo" com sublegenda "markup 50%" e ênfase `accent`, e "Preço atacado" com sublegenda
"markup 30%". Linhas opcionais em zero aparecem esmaecidas, não somem.

Exemplo verdadeiro (é a semente do produto): Custo total **R$ 16,16** · Preço varejo **R$ 24,24** ·
Preço atacado **R$ 21,01**. Desenhe também um caso alto — **R$ 128.940,00** — porque valor grande já quebrou
esta tela.

Quando há canais ativos, o mesmo cartão ganha, abaixo de uma divisória, o título "Preços por canal" e, por
canal, o par "Preço para anunciar" / "Recebido líquido". Sem canal ativo, o bloco inteiro não existe.

Abaixo do cartão vêm os cartões de preço sugerido (varejo e atacado sempre juntos), com as legendas
"Varejo" e "Atacado" — lado a lado onde couber, empilhados a partir de ~360px.

Os dois botões abrem folhas (bottom-sheets), não gravam direto. "Salvar em Orçamentos" abre a folha
homônima, com a introdução "Vamos guardar os valores exatamente como estão nesta tela, com a data de hoje.",
o campo "Rótulo (opcional)" (dica "Cliente, pedido…"), "Validade da proposta" em "dias" e a escolha
"Preço que você está cotando" entre "Varejo" e "Atacado". "Salvar simulação" abre a sua, com "Guardamos a
estratégia desta tela — canais, taxas ajustadas, base de custo. Ao reabrir, ela recalcula com os preços de
hoje.", "Nome" e "Nota (opcional)", e ecoa a base como "Base de custo: {nome do produto} (referência do
catálogo)". As folhas já têm desenho próprio; aqui interessa o gatilho, não o interior.

## Estados obrigatórios
- **Repouso, produto salvo e Premium ativo** — resultado completo + os dois botões. É o estado que precisa
  de hierarquia desenhada.
- **Sem resultado válido** — no lugar de todo o bloco de resultado, um alerta `danger` com a frase exata
  "Confira os campos destacados para ver o preço.". Os dois botões desaparecem junto (não há preço a
  guardar). Desenhe o rodapé inteiro assim, não só o alerta.
- **Produto novo, ainda não salvo** — resultado presente, os dois botões ausentes. Hoje sem nenhuma
  explicação; o desenho precisa resolver isso (ver Perguntas).
- **Premium pausado** — a página inteira acima já mostra o alerta `info` "Premium pausado…" e some com
  "Salvar produto"; aqui no rodapé o preço continua sendo recalculado normalmente (a leitura nunca é
  cortada) e os dois botões simplesmente somem. Desenhe o rodapé nesse estado.
- **Aviso de resultado zerado** — dentro do detalhamento, quando o custo dá R$ 0,00, um aviso que não mora
  em campo nenhum (não há campo culpado).
- **Atacado acima do varejo** — alerta `info`, entre o cartão e os cartões de preço, com a frase
  "O preço de atacado ficou acima do varejo. Nada foi recusado — só confira se é isso mesmo." Tom `info`
  de propósito: nada foi recusado.
- **Foco, hover, pressionado** nos dois botões — e eles ficam lado a lado no desktop, então o estado de
  foco precisa distinguir qual dos dois está selecionado sem depender de cor sozinha.
- **Desabilitado / carregando** — o gatilho pode vir desabilitado; a submissão dentro da folha tem estado
  de envio.
- **Offline** — os dois se comportam de forma OPOSTA e o rodapé não conta isso: "Salvar em Orçamentos"
  funciona offline e vira pendente ("Pendente neste dispositivo. Sincroniza sozinho quando houver
  conexão."), enquanto "Salvar simulação" é recusado com "Salvar uma simulação precisa de conexão.".

## Viewports
- **390px** — obrigatório: é onde a assimetria de alinhamento existe e onde a coluna única faz as três
  peças competirem em sequência. Desenhe repouso, sem-resultado e produto-novo.
- **1280px** — obrigatório (é o corte desktop do produto): o rodapé centraliza e limita cada bloco a 720px,
  então sobra espaço lateral e os dois botões podem conviver numa linha. Mostre repouso e Premium pausado.
- 1920px opcional, só se a solução mudar de forma (não deve: o teto de 720px já governa).

## Regras que o desenho não pode quebrar
- **Freemium é binário e as ações são premium-only por decisão do dono**: sem Premium ativo elas não são
  botões cinzas nem iscas — não existem. O desenho não pode inventar um estado "bloqueado clicável".
- **Rede caindo nunca vira "não é premium"** e vice-versa: o texto de pendência fala de conexão, o de
  Premium fala de Premium, e nenhum dos dois é usado no lugar do outro.
- **Procedência do número**: nenhum preço aqui é guardado — tudo é recalculado ao vivo. O rodapé não pode
  sugerir "preço salvo".
- **Congelado ≠ recalcula**: Orçamentos congela o valor no dia; Simulações recalcula ao reabrir. Se o
  desenho não deixar essa diferença visível ANTES do clique, ele não resolveu o problema desta peça.
- Frase honesta nunca dentro de placeholder, sempre em elemento de largura cheia.
- Alvo de toque ≥44px, inclusive quando os dois botões dividirem uma linha no desktop.
- Contraste medido contra o fundo real do cartão, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- Preço de seis dígitos já quebrou no meio do número (`950.096` em duas linhas) porque a grade era fixa em
  duas colunas a 360px. Qualquer arranjo lado a lado precisa de piso de largura e empilhar antes de cortar
  o dígito.
- Overflow horizontal medido nos DOIS eixos: um assert de texto passa em elemento ocluído ou estourado, e
  headless não enxerga barra de rolagem clássica.
- Botão que nasce fora da viewport já aconteceu nesta base (100,5px de estouro), e a primeira correção
  ainda deixava 467px — desenhe a largura máxima explicitamente.
- Sufixo de placeholder cortado: legenda que explica não pode viver colada ao número dentro do campo.

## Entregável
Pranchetas: (1) 390px repouso completo, (2) 390px sem resultado, (3) 390px produto novo, (4) 1280px
repouso, (5) 1280px Premium pausado — cada uma em **escuro (padrão) e claro (first-class)**. Reutilize os
primitivos existentes, sem criar novos: `Card` (`padding="md"`) para o detalhamento, `BreakdownRow` para
cada linha, `PriceHero`/os cartões de preço para varejo e atacado, `Alert` nos tons `danger` e `info`,
`Button` variante secundária com `Icon name="save"` nos dois gatilhos, e a folha (`Sheet`) apenas indicada,
não redesenhada. Entregue explicitamente: a hierarquia proposta entre resultado, ação principal e ações
secundárias, e como o vendedor enxerga a diferença entre "congelar hoje" e "recalcular depois" sem ler as
folhas.

## Perguntas em aberto para o dono
1. **Qual é a ação principal no fim desta página?** "Salvar produto" mora no topo. Ela desce para o rodapé,
   é repetida nos dois lugares, ou continua onde está e o rodapé assume que o produto já foi salvo?
2. **A ordem das duas ações**: aqui é Orçamentos → Simulação; em Calcular é Simulação → Orçamentos. As duas
   telas devem ser unificadas, e qual ordem manda?
3. **Produto novo**: as duas ações continuam simplesmente ausentes, ou aparecem desabilitadas com uma linha
   dizendo que precisam do produto salvo antes?
4. **Premium pausado**: o rodapé fica calado (o alerta do topo já explicou) ou repete ali, ao lado do preço,
   que salvar está pausado?
5. **A assimetria offline** (Orçamento pende, Simulação recusa) deve ser dita antes do clique, no rodapé,
   ou continua aparecendo só dentro da folha?

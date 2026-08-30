# Cartão "Preços por canal (kit)" — a soma do kit em cada marketplace

## O que desenhar

O cartão que mostra, para cada marketplace usado nas peças do kit, quanto o kit inteiro precisa ser
anunciado e quanto sobra líquido — em varejo e em atacado. Vive na aba **Kits** (`/kits`), dentro do resumo:
no mobile rola em fluxo normal acima da barra fixa "Total do kit"; no desktop (≥1280px) mora na coluna
direita de **480px**, `sticky` inteira. Quem lê é o vendedor no meio da montagem, já com custo e preço na
mão, decidindo se anunciar o kit em cada canal fecha a conta. O cartão só existe quando ao menos uma peça
tem canal — sem canal nenhum ele não é renderizado (nem título, nem zero), e essa ausência é deliberada.

## Por que este prompt existe

A **honestidade** deste cartão foi desenhada; a **densidade** não. O protótipo (canvas 018, linhas 224-228)
mostra o cartão com **uma linha por marketplace** — "Mercado Livre · Clássico" e "Shopee" — um valor cada e
a legenda honesta como subtítulo. O app emite **quatro linhas de dinheiro por marketplace** mais uma ou duas
legendas: com dois canais são 8 valores e até 4 legendas num cartão que ninguém julgou. Além disso, dois
estados de ausência não existem em nenhuma prancheta: o bloco vazio ("Nenhuma peça com preço neste canal.")
e o bloco **sintético** — um marketplace que aparece sem nenhum número, só com a legenda de exclusão.
`ux-bom.md` §6.1 item 3 já marcava este protótipo como *honesty-critical / High*; nunca foi feito.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/bom/channel-rollup.tsx` (+ `shared/ui/breakdown-row.css`,
`features/bom/assembly-summary.css`, `pages/bom/bom-page.css`).

Estrutura atual, de cima para baixo, dentro de um `tf-card` com `padding="md"`:

| Elemento | Texto literal hoje | Observação |
|---|---|---|
| Título do cartão | "Preços por canal (kit)" | é um `<p>` em 14px semibold — **não** é cabeçalho |
| Nome do marketplace | "Mercado Livre" / "Shopee" / "Amazon" / "Outro" / "Canal" | "Canal" é o rótulo de um slot sem marketplace escolhido |
| Linha 1 | "Varejo · Preço para anunciar" | `tf-brow` |
| Linha 2 | "Varejo · Recebido líquido" | `tf-brow` |
| Linha 3 | "Atacado · Preço para anunciar" | `tf-brow` |
| Linha 4 | "Atacado · Recebido líquido" | `tf-brow` |
| Legenda de contribuição | "3 peça(s) somaram neste canal" | 12px, `--text-muted` |
| Legenda de exclusão | "1 peça(s) sem preço neste canal — não entrou na soma." | 12px, `--text-muted`, só quando houver |
| Bloco vazio | "Nenhuma peça com preço neste canal." | substitui as 4 linhas |

→ **Os rótulos são concatenação de duas taxonomias**: a legenda do nível ("Varejo") mais o rótulo do
resultado ("Preço para anunciar"). Quatro rótulos longos e quase iguais empilhados fazem o olho comparar
palavra por palavra em vez de número com número — o desenho deve resolver isso, provavelmente agrupando
por nível (Varejo / Atacado) com o par anúncio/líquido dentro.

→ **A hierarquia visual está invertida e é um defeito medível.** As quatro linhas de um mesmo marketplace
são separadas por um filete `--border-subtle` (regra `.tf-brow + .tf-brow`), mas a fronteira **entre
marketplaces** usa `var(--border-soft, transparent)` — e `--border-soft` **não existe** em nenhum arquivo
de tokens do projeto. Ou seja: a separação mais forte do cartão é hoje literalmente invisível, nos dois
temas, e a mais fraca é a que se vê. Com dois canais o vendedor lê 8 linhas como uma lista só.

→ **A modalidade some.** O protótipo escreve "Mercado Livre · Clássico"; o app escreve só "Mercado Livre".
A soma é agregada **por marketplace**, não por marketplace+modalidade — duas peças, uma em Clássico e
outra em Premium, caem no mesmo bloco. Ver "Perguntas em aberto".

→ **O frete existe no dado e não aparece.** O cálculo carrega `freightCostVarejo`/`freightCostAtacado`
somados do kit e o cartão nunca os mostra; o frete já está descontado dentro de "Recebido líquido". Não é
mentira, mas é a mesma família do defeito A2 do hotfix (frete deduzido sem lugar onde se ver).

## Conteúdo e dados reais

- **Valores**: dinheiro pt-BR (`R$ 1.234,56`), fonte numérica tabular, à direita. Exemplos verdadeiros
  de um kit de 3 peças no Mercado Livre: anúncio varejo **R$ 187,40**, líquido varejo
  **R$ 132,88**, anúncio atacado **R$ 141,60**, líquido atacado **R$ 99,17**. Um kit grande chega a
  **R$ 1.234,56** e a quatro dígitos com facilidade — desenhe com esse valor, não com R$ 24,24.
- **Contagens**: inteiros ≥ 0. O "(s)" está na copy literal, não é plural resolvido → fica feio com n = 1;
  se achar que vale mudar, aponte, mas **não** reescreva a frase sozinho: ela é homologada.
- **Quantos blocos**: um por marketplace usado no kit, sem teto declarado. Hoje são no máximo 4 nomes
  conhecidos + "Canal", então desenhe **até 4 blocos** para ver a altura real.
- **Derivado**: todos os valores são somas Σ(valor da peça × quantidade) calculadas no motor. A tela não
  soma nada e não pode inventar zero: quando nenhuma peça alimentou o canal, os quatro valores vêm nulos.

## Estados obrigatórios

1. **Repouso, um canal** — 4 valores + "3 peça(s) somaram neste canal".
2. **Repouso, dois canais** — o caso denso: 8 valores + 2 legendas. É o estado que precisa de julgamento.
3. **Parcial** — canal com números **e** exclusão: as 4 linhas + "2 peça(s) somaram neste canal" +
   "1 peça(s) sem preço neste canal — não entrou na soma." As duas legendas convivem, e a segunda não pode
   parecer erro (não é alerta, não é vermelho — é uma constatação calma).
4. **Vazio** — nenhuma peça com preço naquele canal: o nome do marketplace + "Nenhuma peça com preço neste
   canal." e **nenhum número**. Nunca R$ 0,00.
5. **Sintético** — o canal existe só porque **todas** as suas linhas tinham campo inválido: nome +
   "Nenhuma peça com preço neste canal." + "2 peça(s) sem preço neste canal — não entrou na soma.". Zero
   dinheiro na tela; nunca foi desenhado e é o estado mais estranho — um marketplace sem um único valor.
6. **Ausência total do cartão** — nenhum canal em nenhuma peça: o cartão inteiro não é renderizado.
   Desenhe a prancheta da coluna **sem** ele, para mostrar que o vazio aqui é silêncio, não uma moldura oca.
7. **Canal sem marketplace escolhido** — o bloco se chama "Canal" (o slot ainda não nomeou o marketplace).
8. **Valor extremo** — quatro dígitos + milhar em todas as 8 linhas, para provar que rótulo e número não
   colidem.

Não há estados de carregamento, erro de rede, offline, degradado ou premium pausado **neste** cartão: ele
lê um cálculo local que já está em memória. O plano e o offline são resolvidos antes, na página.

## Viewports

- **Mobile 390px** — obrigatório: é onde o cartão nasceu e onde a densidade dói. Rola em fluxo normal,
  acima da barra fixa "Total do kit". Largura útil real ~358px com o padding do cartão.
- **Desktop 1280px** — obrigatório: a coluna direita tem **480px** fixos e é `sticky` com
  `max-height: calc(100dvh - 64px)` e rolagem própria. Com 3-4 canais o cartão sozinho passa da altura da
  coluna: mostre como ele se comporta aí (o resumo dividindo espaço com o total e o botão de salvar).

## Regras que o desenho não pode quebrar

- **Ausência nunca vira zero.** Canal sem contribuição mostra a frase, jamais R$ 0,00 — o zero fabricado é
  a mentira que este cartão existe para evitar.
- **Exclusão dita, não escondida.** Toda peça que ficou de fora aparece contada. Nenhuma legenda de
  exclusão pode ser cortada, colapsada atrás de "ver mais" ou virar tooltip: honestidade não mora em
  camada escondida (nem em placeholder — a lição do 016/PR-F).
- **Procedência do número.** Cada valor é soma do kit inteiro (peça × quantidade), não preço de uma peça —
  legível sem exigir dedução.
- **Não é alerta.** A legenda de exclusão é informativa: sem vermelho, sem ícone de erro, sem badge de
  perigo. Vermelho aqui faria o vendedor achar que o produto recusou algo.
- **Contraste medido** das legendas `--text-muted` em 12px contra a superfície real do cartão, nos dois temas.
- Se o desenho introduzir controle interativo (expandir/recolher um canal, por exemplo), alvo **≥44px**.

## Armadilhas já pagas neste projeto

- **Filete que não existe**: `--border-soft` sem definição = separador transparente. Qualquer separação que
  você desenhar precisa apontar para um token que existe (`--border-subtle` / `--border-strong`).
- **Valor longo estoura a coluna**: já aconteceu aqui — a linha de detalhamento teve de aprender a quebrar
  porque um valor grande empurrava rolagem horizontal a 390px. Desenhe com R$ 1.234,56 em todas as linhas.
- **Rótulo longo trava o número**: na barra fixa, "Preço atacado" (111px) não coube em ~101px e obrigou
  rótulos curtos próprios; os rótulos daqui são ainda maiores ("Varejo · Preço para anunciar") — meça.
- **Texto ocluso passa em teste**: um rótulo cortado por overflow continua "visível" para asserção textual.
  A prova é geométrica, e por isso o desenho precisa declarar o que cede quando falta largura (o rótulo,
  nunca o número).
- **Rolagem no eixo Y também conta**: a coluna do desktop rola sozinha, e um cartão que a estoura empurra
  o total do kit para fora do campo de visão.

## Entregável

Pranchetas, em **tema escuro (padrão)** e **tema claro (first-class)**:

1. `Kit · canais 390px` — um canal, estado de repouso.
2. `Kit · canais 390px · dois canais` — o caso denso, 8 valores + 2 legendas.
3. `Kit · canais 390px · vazio + sintético` — os dois estados de ausência lado a lado.
4. `Kit · canais 1280px coluna` — dentro da coluna de 480px, com o cartão "Total do kit" abaixo e o bloco
   de salvar, mostrando a altura acumulada com 3 canais.
5. `Kit · canais 1280px · sem canais` — a coluna sem o cartão, para provar o silêncio.

Reutilize os primitivos: contêiner `tf-card` (padding md); cada valor num `tf-brow` (`__label` / `__sub` /
`__val`, o valor em fonte numérica tabular à direita); o nome do marketplace vira `tf-brow__label` de bloco
ou subtítulo do cartão — não crie cabeçalho novo se um já resolve. Legendas em `--fs-caption` /
`--text-muted`. Se propuser agrupar por nível, use os rótulos curtos existentes ("Varejo", "Atacado") e
diga onde entram "Preço para anunciar" e "Recebido líquido". Anote em cada prancheta qual token de borda
separa os blocos.

## Perguntas em aberto para o dono

1. **A modalidade entra no nome do bloco?** O protótipo escreve "Mercado Livre · Clássico"; o app agrega
   por marketplace e escreve só "Mercado Livre". Se duas peças usam modalidades diferentes do mesmo
   marketplace, elas hoje somam no mesmo bloco — mostrar "Clássico" seria falso. Manter agregado por
   marketplace (e o desenho abandona a modalidade) ou passar a separar por marketplace+modalidade?
2. **O frete somado do kit deve aparecer?** O dado existe (`freightCostVarejo`/`freightCostAtacado`) e hoje
   só está embutido no "Recebido líquido". Depois do hotfix A2 (frete descontado num campo que mostrava
   R$ 0,00), vale decidir se o kit mostra o frete total ou continua só no líquido.
3. **Atacado sempre visível?** Metade das linhas é atacado. Se o vendedor não vende atacado, são 4 números
   inúteis por canal. O atacado deve poder ficar recolhido — e, se sim, isso vale para este cartão só ou
   para o resumo inteiro do kit?
4. **"1 peça(s)"** — a copy homologada carrega o "(s)" literal. Fica como está ou o desenho pode pedir
   plural resolvido ("1 peça somou neste canal")?

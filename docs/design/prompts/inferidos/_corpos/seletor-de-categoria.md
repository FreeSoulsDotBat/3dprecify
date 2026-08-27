# Seletor de categoria do marketplace (busca + árvore) dentro do slot de canal

## O que desenhar
O campo que o vendedor usa, dentro de cada card de canal da tela **Calcular**, para dizer em que
categoria do marketplace o anúncio vai entrar — e que, por consequência, decide a **comissão cobrada
dele**. Vive no card `Canal` logo abaixo do seletor de *Marketplace* (e da *Modalidade*, quando o canal
tem uma) e logo acima das perguntas de perfil do vendedor e dos campos de dinheiro (*Comissão*, *Taxa
fixa*, *Comissão mínima/item*, *Frete*). Tem duas afordâncias no mesmo lugar: **buscar** por texto e
**navegar** uma árvore hierárquica recolhida atrás de um botão. Quem usa: o vendedor premium montando o
preço de um produto, no meio de um formulário longo, quase sempre no celular.

## Por que este prompt existe
Nada disto foi desenhado: a auditoria confirmou **zero** ocorrências de "categoria" nas quatro
autoridades de desenho do projeto (os 3 markdown de design, o `.design-import/readme.md`, o
`CalculatorScreen.jsx` do protótipo de 2026-07-02 e o canvas `Abas-Desktop.dc.html` do 018) — o eixo
categoria→comissão nasceu no incremento 014, um ano-produto depois do protótipo, e o canvas 018 não
cobre a aba Calcular. O `.design-import` não tem nem primitivo de busca nem de árvore entre os 32 que
lista. O próprio código confessa a ausência no cabeçalho: *"layout, the drill-vs-search affordance and
where this sits inside the slot are `designer-ux`'s"*. Foram inferidos por IA: o layout, a escolha
busca-vs-árvore, o que é chip e o que é lista, os glifos `▸ ▾ ›`, a densidade da árvore e o corte em 8
resultados.

## O que já existe hoje (não invente do zero — corrija)
Ordem vertical atual, de cima para baixo, quando nada foi escolhido:

| # | Elemento | Texto literal hoje |
|---|---|---|
| 1 | Rótulo do campo (`tf-field__label`, compacto) | `Categoria do anúncio (opcional)` |
| 2 | Dica sob o rótulo | `A comissão muda conforme a categoria.` |
| 3 | Campo de busca (`tf-inputwrap` + `tf-input`, o MESMO par do campo de dinheiro) | placeholder `Busque pelo produto…` |
| 4 | Linha de contagem (live region sempre montada, some quando vazia) | `1 categoria encontrada` · `{n} categorias encontradas` · `Mostrando {n} de {total} — refine a busca para ver as demais.` |
| 5 | Lista de resultados — até **8** botões, superfície elevada, sombra, divisórias entre itens | cada item = **caminho completo** + um `›` apagado à direita |
| 6 | Botão secundário pequeno, alinhado à esquerda (só aparece com a busca vazia) | `Ver todas as categorias (38)` / aberto: `Ocultar categorias` |
| 7 | Dentro do painel aberto: contagem FORA da área rolável | `38 categorias no catálogo` |
| 8 | Árvore recursiva com rolagem própria de `40vh`; disclosure `▸`/`▾` de 44px **ao lado** do item, só onde há filhos; subnível indentado com filete à esquerda | itens mostram só o **nome do nó**, não o caminho |

→ **Problemas que o desenho precisa resolver:**
→ a lista de resultados já foi lida, em homologação, como **um segundo campo preenchido** (com 1
resultado, "Calçados" numa moldura parecia valor digitado). A correção foi paliativa (superfície
elevada + raio menor + divisórias) — desenhe uma lista que não possa ser confundida com um campo.
→ a busca e a árvore são **mutuamente exclusivas por acidente de implementação**: digitou uma letra, o
botão "Ver todas as categorias" some. Nada no desenho explica isso ao vendedor.
→ na busca o item mostra o **caminho completo**; na árvore mostra só o **nome**. Duas gramáticas
diferentes para a mesma decisão, na mesma peça.
→ o `›` de cada item é decorativo e diz "isto se toca" (não existe hover no celular), mas fica
indistinguível do `›` separador do caminho quando o caminho quebra em duas linhas.
→ o rótulo diz `(opcional)` no campo que define a alíquota. É verdade contratual (nada bloqueia o
cálculo) e péssima hierarquia de atenção.

## Conteúdo e dados reais
- **Caminho completo, sempre, nos resultados de busca** — o Mercado Livre publica *Celulares e
  Telefones* a **18%** e *Celulares e Smartphones* a **16%**: nome nu transforma 2 pontos percentuais
  do preço do vendedor em cara-ou-coroa. Exemplo real para prancheta:
  `Celulares e Telefones › Acessórios para Celulares › Suportes`.
- **Espinha rasa também existe**: Amazon = **38 categorias de um nível só**. Nenhum nó tem filho, nenhum
  `▸` aparece, e a "árvore" degrada sozinha para lista simples. Desenhe esse caso.
- **Um nó intermediário é selecionável** — o `▸` só abre/fecha filhos, nunca é a única forma de escolher.
- **Corte de resultados**: 8 visíveis, contagem sempre pelo **total real**. Nunca "8 encontradas" com 31
  existentes (isso já aconteceu e passou em todos os testes).
- Vizinhança de dinheiro no mesmo card, para calibrar peso visual: `Comissão`, `Taxa fixa`,
  `Comissão mínima/item`, e o selo de procedência que fica ao lado deles — `Referência · atualizada em
  06/08/2026`, `sem referência — informe as taxas`, `categoria não informada — usando`.

## Estados obrigatórios
1. **Repouso, vazio** — busca vazia, sem contagem (a linha some, não fica reservando altura), botão
   `Ver todas as categorias (38)` visível.
2. **Digitando com resultados** — contagem + até 8 itens em fluxo (a lista **empurra** o conteúdo para
   baixo; nunca flutua sobre o formulário: sobreposição já custou três defeitos de hit-testing neste
   projeto).
3. **Digitando com resultados truncados** — `Mostrando 8 de 31 — refine a busca para ver as demais.`
4. **Busca sem resultado** — a lista some e sobra a frase inteira, que é conselho, não erro:
   `Não achou? Busque pelo produto, não pelo material — um suporte de celular fica em “Acessórios para
   Celulares”.` Ela é longa: precisa de linha de largura total, nunca de placeholder.
5. **Árvore aberta** — `Ocultar categorias`, `38 categorias no catálogo` fora da rolagem, painel com
   rolagem própria (`40vh`), níveis 1, 2 e 3 visíveis com `▾` no aberto e `▸` no fechado.
6. **Escolhido** — o rótulo e a moldura do campo PERMANECEM (uma categoria escolhida já apareceu como
   texto solto entre "Modalidade" e "Comissão"); dentro da moldura, o caminho completo em chip que
   **cresce em altura** e o botão fantasma `Limpar` encostado na borda direita.
7. **Escolhido fora do catálogo** — mesma moldura, texto em tom apagado e peso normal:
   `A categoria escolhida não está neste catálogo — limpe e escolha outra.` + `Limpar`.
8. **Espinha vazia — com taxa de referência**: só a frase `A lista de categorias ainda não está
   disponível para este canal.` (sem campo de busca).
9. **Espinha vazia — sem referência**: `Este canal ainda não tem taxa de referência — informe a comissão
   nos campos abaixo.`
10. **Foco visível** em: input, cada item de resultado, cada `▸`, cada item da árvore e o `Limpar` — o
    foco vai para o `Limpar` no instante em que o vendedor escolhe.
11. **Hover / pressionado** nos itens (fundo sutil) — e o desenho não pode depender só de hover.

## Viewports
- **390px — obrigatório.** É o uso real. Um caminho de três níveis não cabe numa linha: mostre-o
  quebrado em 2–3 linhas dentro do item e dentro do chip, com o alvo crescendo junto (piso 44px).
- **1280px — obrigatório também.** A peça renderiza no desktop hoje sem nunca ter sido desenhada para
  ele (o canvas do 018 não cobre Calcular). No desktop `40vh` é muito mais alto e o card do canal é bem
  mais largo: mostre como a lista e a árvore se comportam com largura sobrando, em vez de esticarem
  itens de 44px por 900px de linha vazia.

## Regras que o desenho não pode quebrar
- **A peça nunca fala de dinheiro.** Ela conhece só a lista de nomes; quem afirma procedência da taxa é
  o selo do mesmo card. Nenhuma frase daqui pode dizer ou insinuar "a taxa exibida é a correta" — essa
  frase existiu, era falsa para 100% dos usuários, e foi removida.
- **Contagem honesta sempre**: o número mostrado é o total real, nunca o número de itens na tela.
- **Sempre expandido, nunca colapsado atrás de "avançado"** — campo colapsado + número plausível
  pré-preenchido é exatamente como um vendedor aceita uma alíquota que não é dele.
- **Escolher é opcional como regra, obrigatório como afordância**: não bloqueie o cálculo, mas não deixe
  a decisão parecer acessória.
- Frase honesta jamais dentro de placeholder (ela corta em todos os viewports).
- Alvos ≥ 44px, inclusive o `▸`, que é botão próprio e nunca fica dentro do botão do item.
- Contraste medido contra o fundo REAL da lista (superfície elevada), não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Lista lida como campo preenchido** (homologação 014, achado só no screenshot: nenhuma asserção viu).
- **Contagem mentindo o total** ("8 encontradas" com 31 existentes) — invisível a qualquer teste.
- **Árvore inline empurrando a página**: 38 nós renderizados de uma vez levaram a página a 1.795px e
  jogaram o preço final para y≈4.800 em 360px, ANTES de qualquer interação. Daí a árvore recolhida com
  rolagem própria — o desenho não pode desfazer isso.
- **Chip em branco ao lado de "Limpar"** quando o id escolhido não está na espinha: nomeava nada.
- **Texto ocluso/estourado passa em teste**: o caminho longo e o `Limpar` disputam a mesma linha —
  desenhe a quebra, não confie no corte.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**, todas mostrando a peça **dentro do card de
canal** (com *Marketplace*, *Modalidade* acima e *Comissão* abaixo, para provar hierarquia e não só o
componente isolado):
1. 390px — repouso vazio; 2. 390px — busca com 3 resultados; 3. 390px — busca truncada (8 de 31);
4. 390px — sem resultado; 5. 390px — árvore aberta com 3 níveis; 6. 390px — escolhido (caminho de 3
níveis, 2 linhas); 7. 390px — escolhido fora do catálogo; 8. 390px — espinha vazia (as duas frases);
9. 1280px — repouso + busca com resultados; 10. 1280px — árvore aberta; 11. tira de estados
(foco/hover/pressionado/desabilitado) dos itens e do `▸`.
Reutilize os primitivos: `tf-field` + `tf-field__label--tight` (rótulo e dica), `tf-inputwrap` +
`tf-input` (busca e moldura do escolhido — o mesmo par do campo de dinheiro, não um sósia),
`Button variant="secondary" size="sm"` (abrir/fechar árvore), `Button variant="ghost" size="sm"`
(`Limpar`), tipografia de legenda para as linhas de contagem/aviso. **Só invente forma nova para o que
o DS não tem**: o item de resultado, a divisória, o chip do escolhido e a linha da árvore.

## Perguntas em aberto para o dono
1. Busca e árvore hoje são exclusivas (digitou → o botão da árvore some). É intencional, ou a busca
   deveria **filtrar a árvore** e manter uma superfície só?
2. Item de resultado mostra caminho completo; item de árvore mostra só o nome. Unificar em caminho
   completo (mais seguro contra homônimos, muito mais alto) ou manter as duas gramáticas?
3. O rótulo `(opcional)` — mantém a palavra, troca por algo que diga "sem isto usamos a tabela geral",
   ou o selo do card já basta?
4. O corte em **8** resultados foi inferido. Vira lista rolável completa (como a árvore) ou continua
   corte + pedido de refinamento?
5. Nós intermediários são escolhíveis, mas nada distingue visualmente um nó que tem tarifa própria de um
   que herda a do pai. Deve distinguir?

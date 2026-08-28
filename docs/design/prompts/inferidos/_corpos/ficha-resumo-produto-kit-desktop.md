# Ficha de resumo de Produto e de Kit (coluna direita do Catálogo no desktop)

## O que desenhar

A coluna direita fixa de 560px do Catálogo no desktop (≥1280px), no caso em que o item selecionado é um **Produto** ou um **Kit**. O Catálogo desktop é um mestre-detalhe: à esquerda a lista de cartões com busca e contador, à direita a ficha do item clicado. Para Filamento e Impressora essa coluna É o editor (o mesmo formulário da gaveta, montado ali, com salvar inline). Para Produto e Kit o dono decidiu o contrário: a ficha **não edita** — o formulário completo de Produto continua sendo uma página inteira, e o Kit continua no compositor. Sobra a pergunta que ninguém desenhou: **o que uma ficha de 560px deve mostrar quando ela não edita?** Quem usa: o vendedor premium, dentro da aba Catálogo → seção Produtos ou Kits, no momento em que clica num item salvo para relembrar do que ele é feito antes de abrir o editor, duplicar, excluir ou levar para o cálculo.

## Por que este prompt existe

O que existe hoje foi inferido por IA a partir de texto, não desenhado: a coluna renderiza o kicker ("Produto salvo"), o nome, dois botões de ícone fantasma no canto (copiar/lixeira), **a mesma linha de resumo que o cartão da lista já mostrava** e um botão "Abrir para editar". Para produto essa linha são só os nomes das referências ("PLA Prata · Ender 3 V3") — nenhum número: nem gramas, nem tempo, nem custo, nem preço. Meia tela mostrando menos do que o cartão que o vendedor acabou de clicar.

`PROTOTIPO_PARCIAL`: o canvas de 2026-08 (`specs/018-abas-desktop/design/Abas-Desktop.dc.html`) desenha SIM um `<aside>` único servindo as quatro seções, e dá a produto e kit os mesmos campos que dá a filamento/impressora — produto: Nome do produto, Gramas usadas, Tempo de impressão, Taxa de falha, com um bloco "Referências" (filamento, impressora) e um alerta quando falta vínculo; kit: Nome do kit, Peças, Custo total, Markup varejo; rodapé "Salvar alterações" + "Usar no cálculo"; cabeça com "Duplicar" e "Excluir" como botões **de texto**. Ou seja: o desenho existente é mais rico que o construído — mas ele desenha uma ficha que EDITA, e a decisão do dono (registrada só em texto, `research.md` §E: "Rejeitado: recompor o formulário completo de Produto dentro de 560px") tornou essa ficha somente-leitura. Texto de decisão não é desenho. **O buraco é exatamente a ficha de leitura.**

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramo `else` da ficha), `products-panel.tsx`, `kits-panel.tsx`, `catalog-master-detail.css`.

| Elemento | Texto/valor literal hoje | Observação |
|---|---|---|
| Kicker | "PRODUTO SALVO" / "KIT SALVO" | caption, maiúsculas, letter-spacing 0.06em, cor `--text-muted` |
| Título | nome do item, ex.: "Suporte de fone" | `--fs-lg`, quebra em qualquer ponto (`overflow-wrap: anywhere`) |
| Ações no canto | dois botões **ícone fantasma**: copiar (só em Kits) e lixeira | → o canvas pedia botões de TEXTO "Duplicar"/"Excluir"; hoje só existe `aria-label` |
| Resumo | Produto: "PLA Prata · Ender 3 V3" · Kit: "3 peça(s)" | → **é a repetição literal do cartão da lista** |
| Nota (condicional) | "Vincule um filamento e uma impressora salvos" | Alert tom `info`, só em produto degradado/manual |
| Erro inline | frase honesta do servidor | Alert tom `danger` |
| Ação | "Abrir para editar" (Button secundário + ícone lápis) | leva à página cheia (`?produto=…`) ou ao compositor (`/kits?id=…`) |

→ Problemas a resolver no desenho: (1) 560px repetindo uma linha de 40 caracteres; (2) nenhum dado próprio da peça (gramas, tempo, falha, markup, peças do kit); (3) "Duplicar" só existe em Kit e só como ícone — Produto não tem duplicar nenhum; (4) "Excluir" mora ao lado de "Duplicar" com o mesmo peso visual, sem nada que diga que uma é destrutiva; (5) o canvas prometia "Usar no cálculo" e isso **não existe** na peça construída.

## Conteúdo e dados reais

Dados que o Produto salvo realmente carrega (wire `ProductOut`) e que hoje não aparecem:

- **Gramas impressas** — obrigatório, ex.: `45 g` (faixa real 1–2000 g)
- **Tempo de impressão** — obrigatório, guardado em horas decimais (`3.5`) e exibido no app como **"3 h 30 min"** (regra do 016/PR-C: horas decimais nunca aparecem cruas)
- **Taxa de falha** — opcional, ex.: `5 %`
- **Acabamento** — opcional: tempo (`0 h 30 min`) e valor por hora (`R$ 25,00/h`)
- **Mão de obra** — opcional: horas e valor por hora
- **Markup varejo / atacado** — obrigatórios, ex.: `120 %` e `60 %`
- **Tarifa de energia** — ex.: `R$ 0,92/kWh`
- **Referências** — filamento e impressora pelo NOME ("PLA Prata", "Ender 3 V3"); quando o vínculo não existe, a palavra literal é **"manual"**; enquanto as listas irmãs carregam, é **"carregando…"** (nunca "manual", que seria uma afirmação falsa sobre a procedência do dado)
- **Marketplace** — o produto pode ter canais salvos e custos adicionais ("outros custos")
- **Datas** — `createdAt` / `updatedAt` existem no wire e não são mostrados em lugar nenhum

Kit salvo (`BomOut`): nome, **linhas** com `quantidade`, `nome da peça` e um sinal `degradado` por linha (peça cujo produto de catálogo sumiu), ex.: "2× Base · 1× Tampa · 4× Pino". Um kit **nunca guardou preço** (FR-407: o preço é sempre recalculado ao abrir), então a ficha não pode exibir um valor "salvo" de kit.

## Estados obrigatórios

1. **Repouso — produto completo**: kicker, nome, dados da peça, referências resolvidas por nome.
2. **Repouso — kit**: kicker, nome, contagem "3 peça(s)" + a composição das linhas.
3. **Produto que precisa de atenção** (`filamentId` ou `printerId` nulos): Alert tom `info` com a frase exata "Vincule um filamento e uma impressora salvos", e as referências lendo "manual". Não é erro, não é vermelho — é um estado honesto e calmo.
4. **Kit com linha degradada**: a peça cujo produto sumiu precisa se declarar na ficha; hoje o `degraded` do wire não aparece em lugar nenhum desta coluna.
5. **Referências carregando**: os nomes lendo "carregando…" (placeholder neutro), o resto da ficha já legível.
6. **Erro de escrita inline**: Alert tom `danger` acima do conteúdo, com a frase que o servidor devolveu; a ficha continua legível.
7. **Offline (modo leitura)**: "Modo leitura offline" / "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." — tom `info`, nunca `danger`, e a ação de editar precisa dizer o porquê, não sumir sem explicação.
8. **Dado possivelmente velho** (cache): a legenda literal "pode estar desatualizada".
9. **Premium pausado (`lapsed`)**: "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." + a legenda "somente leitura" no item. Ler continua inteiro; a lixeira **não** pode abrir uma confirmação que funciona e depois falhar — o desenho precisa mostrar a interceptação honesta no toque.
10. **Foco / hover / pressionado / desabilitado** dos botões e do link de cada referência.
11. **Nada selecionado**: na prática o código sempre cai no primeiro item da lista visível, então a coluna vazia só existe quando a busca não achou nada — nesse caso a coluna direita some e a esquerda mostra "Nada encontrado para essa busca".

## Viewports

Desenhe **1280px** e **1920px** — a peça só existe acima do corte de 1280px; abaixo dele o componente nem monta esta árvore (no mobile, tocar num produto abre direto a página de edição, e não há coluna nenhuma). **Não desenhe mobile 390px para esta peça.** A diferença entre os dois viewports importa: a partir de 1600px a lista da esquerda vira duas colunas de cartões, e a ficha continua com os mesmos 560px — o desenho a 1920px precisa provar que 560px não parecem vazios ao lado de uma lista mais larga.

## Regras que o desenho não pode quebrar

- **A ficha não edita.** Nenhum campo digitável, nenhum "Salvar alterações". A edição sai daqui para a página cheia. Se o desenho quiser sugerir edição, é através da ação que navega.
- **Procedência do número.** Todo valor mostrado é o que o vendedor salvou, não um cálculo novo. Se a ficha mostrar qualquer número derivado (custo, preço), ele tem que dizer que é recalculado agora — e para kit não existe valor salvo nenhum (FR-407).
- **Nunca um preço de linha.** A lista da esquerda não mostra preço por regra (FR-310); se a ficha mostrar, o desenho precisa marcar visualmente que é outra coisa que a linha.
- **Degradação dita, não escondida**: "manual", "carregando…" e a linha de kit degradada aparecem como texto, não como campo em branco.
- **Falha de rede nunca vendida como falta de premium**: offline é `info` com a frase de offline; premium pausado é a frase de premium. As duas não se misturam.
- **Frase honesta fora de placeholder**: nenhuma dessas frases pode viver dentro de um campo de exemplo — placeholder carrega número, não honestidade.
- **Alvo ≥44px** em todo botão da cabeça da ficha (hoje são ícones `size="sm"`).
- **Contraste medido contra o fundo real do card**, incluindo o estado selecionado com `--accent-soft`.

## Armadilhas já pagas neste projeto

- **Nome comprido estoura a coluna.** Um nome de 500 caracteres sem espaço já gerou 4.948px de rolagem horizontal a 1440px nesta mesma tela. Desenhe a ficha com um nome absurdo (código colado sem espaço) e prove que ele quebra dentro dos 560px.
- **Número grande estoura a coluna.** Mostre a ficha com `R$ 1.234.567,89` e com `12.500 g` — o desenho tem que aguentar o valor grande, não o valor bonito.
- **A coluna fixa criando uma segunda barra de rolagem.** A ficha gruda no topo e só rola por dentro quando é mais alta que a janela. Rolagem horizontal ali é defeito, e headless não desenha barra clássica — meça os dois eixos.
- **Texto ocluso passa em teste.** `toBeVisible` passa em elemento totalmente coberto; o desenho precisa mostrar a hierarquia visual real, não confiar que "está no DOM".
- **Placeholder que corta a frase** (016): frases de honestidade moram em elementos de largura cheia.
- **Ação destrutiva com o mesmo peso da benigna**: excluir ao lado de duplicar, ambos ícones fantasma de 18px, é o convite ao clique errado.

## Entregável

Pranchetas, em **tema escuro (padrão) e tema claro (first-class, não um afterthought)**:

1. **1280px — Produto salvo, completo**: coluna esquerda (busca + contador + cartões) e a ficha direita cheia.
2. **1280px — Produto que precisa de atenção**: com o Alert `info` e as referências lendo "manual".
3. **1280px — Kit salvo**: com a composição das linhas e uma linha degradada.
4. **1920px — Produto salvo**: lista em duas colunas, ficha nos mesmos 560px.
5. **Estados**: offline em leitura · Premium pausado · erro inline · referências carregando · nome absurdo + valor gigante (a prancheta de estresse).

Reutilize os primitivos existentes, nomeadamente: `tf-card` para a moldura da ficha e para os cartões da lista; o kicker como caption em maiúsculas já existente (`tf-catalog-md__kicker`); `tf-alert` nos tons `info` e `danger` para atenção/offline/pausado/erro; `tf-button` variante `secondary` para a ação principal de navegação ("Abrir para editar"), variante `ghost` para as secundárias e o tratamento destrutivo para excluir; `tf-badge` se precisar marcar "somente leitura" ou uma linha degradada; `tf-input` dentro de `tf-inputwrap` para a busca da esquerda (já existe, não redesenhe). Se um valor monetário aparecer, use o primitivo de preço já existente em vez de tipografia solta. **Não crie primitivo novo** — se algo não couber nos existentes, marque na prancheta e explique por quê.

## Perguntas em aberto para o dono

1. **A ficha pode mostrar dinheiro?** Ela é somente-leitura e o produto guarda entradas, não preço. Mostrar um custo/preço exige recalcular na hora (e dizer isso). O canvas desenhou "Custo total" e "Markup varejo" para kit — mas kit nunca guardou preço. Vale recalcular ao vivo dentro da ficha, ou a ficha fica só com as entradas salvas e o número só existe no editor/cálculo?
2. **"Usar no cálculo" existe?** O canvas desenhou essa ação no rodapé da ficha, e ela não foi construída. É uma ação de verdade (levar o produto/kit direto para a calculadora) ou foi só cenografia do protótipo?
3. **Duplicar em Produto**: hoje só Kit tem duplicar. Produto ganha "Duplicar" também, ou a assimetria é intencional?
4. **Datas**: `criado em` / `atualizado em` existem no dado e nunca foram mostrados. O vendedor quer saber "atualizado em 12/08/2026", ou é ruído?
5. **Quanto do produto cabe na ficha**: só o essencial (gramas, tempo, falha, referências) ou tudo que foi salvo, incluindo acabamento, mão de obra, tarifa, canais de marketplace e outros custos? É a diferença entre uma ficha de 6 linhas e uma de 20.

# Chave de taxa opcional do canal (ex.: "Manuseio de item volumoso" da Shopee)

## O que desenhar
Dentro do card de um canal na calculadora (aba **Calcular**, seção "Incluir marketplaces no preço"), o marketplace pode publicar **encargos opcionais** que o vendedor liga ou desliga para AQUELA peça — hoje existe exatamente um no catálogo: a taxa de manuseio de item volumoso da Shopee, R$ 50,00 por pedido. A peça é o bloco que apresenta esse encargo: um controle liga/desliga, o rótulo que vem do catálogo, e a legenda que diz quanto custa, como incide e de onde o número saiu. Ela aparece depois da grade de taxas do canal (Comissão / Taxa fixa / Frete) e antes do selo de honestidade do slot. Quem usa: o vendedor leigo, no meio do preenchimento, decidindo se a peça que ele acabou de calcular é volumosa — e ligando um encargo que muda o preço do anúncio em dezenas de reais.

## Por que este prompt existe
Nenhuma das quatro autoridades de desenho conhece essa peça: busca por "surcharge", "volumoso" e "taxa opcional" nas quatro dá **zero**. O protótipo de 2026-07-02 desenha o canal com apenas dois eixos — "taxa fixa (R$) + comissão (%)" (§E4) — e não previu um encargo opcional. Tudo o que existe hoje foi inferido por IA: que o encargo seria uma **chave** (e não um chip, um checkbox de lista ou um campo de valor), que a proveniência ficaria numa legenda EMBAIXO, o que acontece com N encargos e o que acontece com zero. O preço material dessa inferência já foi pago: o controle nasceu como `<input type="checkbox">` nativo de **13×13px** — o único checkbox nativo de todo o código, fora do sistema que garante ≥44px em qualquer outro controle — e só virou `Switch` do DS depois que a homologação A2 **mediu** o alvo. O Switch existe entre os 32 primitivos, mas o protótipo só o usa em toggles de demonstração na Conta; ter o primitivo não é ter o bloco desenhado.

## O que já existe hoje (não invente do zero — corrija)
Ordem atual dentro do card do canal, de cima para baixo: marketplace → modalidade/categoria → perfil do vendedor (só Shopee) → **grade de taxas 2×2** → legenda de faixa de preço → legenda de subsídio de frete → **[esta peça]** → selo de honestidade → avisos da Shopee.

| Elemento | Como está hoje | Observação |
|---|---|---|
| Controle | `Switch` do DS, à esquerda | ✅ alvo ≥44px garantido por construção; ele é o `<label>` inteiro (clicar no texto alterna) |
| Rótulo | `"Manuseio de item volumoso"` — vem do catálogo, ao lado do Switch | ✅ nenhum texto inventado no código |
| Legenda | uma única linha de parágrafo, `--fs-caption`, `--text-muted`, largura total, abaixo da chave | → **problema**: são ~330 caracteres colados por " · " |
| Título do bloco | **não existe** | → o encargo aparece sem nenhuma palavra que o classifique como "opcional" ou "do canal" |
| N encargos | pilha vertical, `gap` pequeno, sem separador e sem cabeçalho | → com 2+, as legendas longas viram um muro indistinguível |
| Vazio | o bloco **não renderiza** (Mercado Livre e Amazon hoje) | correto, mas nunca foi desenhado |
| Efeito no resultado | **nenhum feedback local** — o preço muda lá em cima, na área de resultados | → ligar R$ 50,00 não dá recibo nenhum perto do controle |

A legenda literal, montada, hoje é esta única string:

> "R$ 50,00 por pedido, somado como custo do canal — o preço do anúncio sobe MAIS que isso, porque a comissão incide sobre ele também. Somado inteiro nesta unidade (não é dividido entre os itens do pedido). · Fonte: Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos, vigente desde 02/02/2026."

→ Cada frase dela existe por um motivo homologado (a taxa é por PEDIDO, não por item; a comissão incide sobre o encargo; a fonte é pública e datada) — **nenhuma pode ser cortada**. O problema é de forma, não de conteúdo: em 390px isso são 8–10 linhas de texto cinza-muted sob uma chave desligada, para um encargo que talvez nem se aplique. O desenho precisa dar hierarquia a isso (valor em destaque · regra de incidência · proveniência), possivelmente revelando parte só quando a chave está ligada.

→ Segundo problema: a legenda mostra **proveniência** ("Fonte: …, vigente desde 02/02/2026") mas nunca **frescor**. O dado carrega `lastReviewed: "2026-08-06"` e ele não aparece em lugar nenhum — enquanto a grade de taxas logo acima exibe selo com "atualizada em", "pode estar desatualizada" ou "referência embutida (offline)". Um encargo de R$ 50,00 com catálogo velho não avisa nada.

## Conteúdo e dados reais
- **Rótulo** (do catálogo): "Manuseio de item volumoso".
- **Valor**: R$ 50,00 — formatado em pt-BR, sempre com centavos. Faixa plausível de outros encargos futuros: R$ 1,00 a R$ 200,00 (desenhe a caixa aguentando "R$ 1.234,56").
- **Incidência**: por **pedido** (`appliesPer: "ORDER"`) — some inteira uma vez, não é rateada entre os itens. Um encargo futuro pode ser por item; o desenho não pode assumir "por pedido" como palavra fixa.
- **Fonte** (texto longo, do catálogo): "Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos". Existe também um `sourceUrl` (`seller.shopee.com.br/edu/article/3305`) que **hoje não é mostrado nem clicável** — se deve virar link é decisão do dono.
- **Datas**: vigente desde 02/02/2026; revisado em 06/08/2026 (dd/mm/aaaa, sempre).
- **Opcionalidade**: desligado é o padrão e é o estado em que a conta fica idêntica à de antes deste eixo existir. Nada é pré-marcado.
- **Derivado**: nada aqui é editável — valor, rótulo, fonte e datas são leitura pura do catálogo. O vendedor só decide sim/não.

## Estados obrigatórios
- **Repouso desligado** (o padrão): chave off, rótulo, legenda. Deve ler como "isto não está na sua conta".
- **Ligado**: chave on + evidência visível de que R$ 50,00 entrou no custo deste canal. Este é o estado que hoje não dá recibo nenhum.
- **Foco** (teclado): anel de foco visível na chave, contra o fundo do card do canal — não contra o fundo da página.
- **Hover** e **pressionado**: no alvo inteiro (chave + rótulo), já que o rótulo alterna.
- **Desabilitado**: o código nunca desabilita esta chave hoje — mas o toggle-mãe "Incluir marketplaces no preço" é desabilitado no free com a frase **"Vender em marketplaces faz parte do Premium."**. Desenhe o caso: com a seção de marketplaces fora, este bloco simplesmente não existe (não é uma chave cinza com cadeado).
- **Vazio**: marketplace sem encargos publicados (ML, Amazon) — o bloco não renderiza. Mostre a prancheta do card SEM ele, para provar que nada fica "faltando".
- **Múltiplos**: dois encargos empilhados, cada um com sua legenda longa — o caso que quebra a leitura.
- **Offline / referência embutida**: o app roda offline com o catálogo semeado; a chave continua funcionando e o número continua real. Precisa de uma marca de que a referência é a embutida — hoje só a grade de taxas acima carrega isso ("referência embutida (offline)").
- **Degradado / desatualizado**: catálogo antigo (o selo do slot já diz "pode estar desatualizada") — o desenho decide se o encargo herda esse aviso ou não.
- **Sem permissão / premium pausado**: idem desabilitado — a seção inteira sai; nunca uma chave que parece clicável e não faz nada.

## Viewports
- **Mobile 390px** — obrigatório e é o caso difícil: card de canal já denso, legenda de ~330 caracteres, chave de 44px, mais duas legendas acima (faixa de preço, subsídio de frete) e o selo abaixo.
- **Desktop 1280px** — a calculadora existe no desktop e o card do canal fica numa coluna estreita ao lado do resultado; a legenda não ganha largura infinita.
- **1920px** opcional, só se a decisão de largura máxima da legenda mudar em relação a 1280.

## Regras que o desenho não pode quebrar
- **A frase honesta nunca mora dentro de um placeholder nem de um campo estreito** — este projeto já cortou uma frase para "2,50 (= 50". Legenda de honestidade vive em elemento de largura total.
- **Procedência sempre junto do número**: fonte + data visíveis, no mesmo bloco do valor; nunca só em tooltip.
- **Nenhum número inventado no desenho** além dos reais aqui listados — cada valor da tela vem do catálogo.
- **Desligado ≠ escondido**: o encargo existe no mundo mesmo desligado; o vendedor precisa poder descobrir que ele existe antes de ser cobrado por ele.
- **Falha de rede nunca vira "não é premium"** e catálogo velho nunca vira silêncio.
- **Alvo ≥44×44px** para a chave e para toda a área que alterna; contraste do texto muted medido contra o fundo REAL do card do canal (que não é o fundo da página).
- **Tema escuro é o padrão, claro é first-class** — a chave ligada precisa ser inequívoca nos dois.

## Armadilhas já pagas neste projeto
- O alvo de 13×13px desta mesma peça, achado só por **medição** na homologação A2 — qualquer controle que você desenhar aqui tem que ter o alvo declarado em pixels.
- **Texto ocluso/estourado passa em teste**: `toBeVisible` aprova elemento cortado. A legenda longa em 390px precisa ser desenhada com o texto REAL colado, não com "lorem".
- **Valor grande estoura a coluna**: desenhe também com "R$ 1.234,56" e com um rótulo de catálogo mais longo que "Manuseio de item volumoso".
- **Overflow horizontal medido**: a fonte é uma string longa sem espaços curtos ("Central de Educação do Vendedor Shopee — Taxa de manuseio de itens volumosos") — ela tem que quebrar linha, nunca empurrar o card.
- **Legenda que só o desenvolvedor lê**: o bloco hoje aparece entre duas outras legendas cinza de tamanho igual; sem hierarquia, tudo vira ruído e o encargo de R$ 50,00 é lido como rodapé.

## Entregável
Pranchetas, tema escuro e tema claro em pé de igualdade:
1. **390px — repouso desligado** (Shopee, um encargo), com a legenda completa real.
2. **390px — ligado**, mostrando como o desenho dá recibo dos R$ 50,00 no custo do canal.
3. **390px — dois encargos empilhados** (invente só a FORMA; use o mesmo dado duplicado com outro rótulo longo).
4. **390px — card de canal do Mercado Livre**, sem o bloco (estado vazio provado por ausência).
5. **1280px — card de canal completo**, com o bloco no contexto (grade de taxas acima, selo abaixo).
6. **Detalhe**: chave em repouso / hover / foco / ligado, com o alvo de toque desenhado como guia.

Reutilize os primitivos existentes, sem criar nada novo: o **Switch** do DS para a chave (ele já garante o alvo e a pele escura), o **Card** do canal como contêiner, o estilo de **caption** para a proveniência, e o **selo/badge** do slot como referência visual caso o encargo precise herdar frescor. Se algo aqui não couber em nenhum primitivo, diga qual e por quê em vez de desenhar um controle novo.

## Perguntas em aberto para o dono
1. A legenda longa deve aparecer **sempre**, ou parte dela (a regra "por pedido, comissão incide sobre ela") só quando a chave está **ligada**? A frase é homologada e não pode sumir de vez — a pergunta é de momento, não de conteúdo.
2. O encargo ligado deve mostrar seu impacto **localmente** (ex.: "+ R$ 50,00 no custo deste canal") ou basta o preço mudar lá no resultado? Isso decide se a peça ganha uma linha de valor própria.
3. O bloco deve ganhar um **título** (algo como "Taxas opcionais deste canal")? Hoje não tem nenhum, e com 2+ encargos a falta é sentida — mas o texto seria copy nova, não catalogada.
4. `sourceUrl` existe no dado e não é usado: a fonte deve virar **link clicável** para o artigo do marketplace, ou o app mantém a política de citar sem linkar?
5. Com catálogo **desatualizado ou embutido (offline)**, o encargo herda o aviso do selo do slot, ou o encargo opcional fica fora dessa sinalização por ser sempre uma escolha explícita do vendedor?

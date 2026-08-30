# Catálogo carregando — o esqueleto da lista (e da ficha) no lugar do spinner

## O que desenhar
O estado de **carregamento da lista do Catálogo**, a tela premium onde o vendedor guarda filamentos,
impressoras, produtos e kits para reusar em cada cálculo. É o primeiro meio-segundo de toda visita a
`/catalogo` e de toda troca de aba (Filamentos · Impressoras · Produtos · Kits, cada aba busca sua
própria lista). Quem vê isso é o vendedor premium que já tem itens salvos e voltou para escolher um —
ele não está esperando um conteúdo novo, está esperando **o conteúdo que ele mesmo salvou** reaparecer.
Existe no mobile (lista simples) e no desktop ≥1280px (mestre-detalhe: lista à esquerda, ficha de
560px à direita), e as duas formas precisam do desenho.

## Por que este prompt existe
O código faz o painel inteiro virar um **spinner centralizado** (`Spinner` dentro de um bloco
`flex justify-center py-8`): busca, contagem de itens, botão "Adicionar filamento", lista e ficha
somem juntos e voltam juntos. Não é uma lacuna — é uma **contradição** com a única autoridade que
cobre este estado. O protótipo de 2026-07-02 (`.design-import/ui_kits/precifica3d/CatalogScreen.jsx`,
ramo `loading`) desenha um **Card sem padding com três linhas de esqueleto**: círculo 36×36 + duas
barras de texto (55% e 35%) por linha, separadas por `borderTop` de 1px — exatamente a forma da lista
que vai chegar. A matriz §G do prompt principal crava "Catálogo lista · loading = skeleton", o
`-fixes.md` item 16 e o `-fixes-r2.md` item 14 pedem de novo (o r2 ainda manda **aumentar a
visibilidade no tema escuro**), e a auditoria V3 registra o item como corrigido e MEDIDO
(contraste 1,79:1 no escuro, `prefers-reduced-motion` respeitado). Três autoridades pediram esqueleto,
uma o desenhou, e o produto entrega spinner. O que de fato nunca foi desenhado é o **esqueleto dentro
da grade de duas colunas do desktop** — e é aí que este prompt precisa decidir.

## O que já existe hoje (não invente do zero — corrija)
Ordem real da tela, de cima para baixo, com o que **permanece** e o que **some** durante o load:

| Elemento | Texto literal hoje | Durante `isLoading` |
| --- | --- | --- |
| Cabeçalho da página + abas segmentadas | "Filamentos" · "Impressoras" · "Produtos" · "Kits" | **permanece** (fica fora do painel) |
| Aviso offline (quando há cache antigo) | título "Modo leitura offline", corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." | permanece |
| Aviso premium pausado | título "Premium pausado", corpo "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar, reative o Premium." | permanece |
| Campo de busca (só desktop) | placeholder "Buscar no catálogo…", rótulo acessível "Buscar no catálogo" | → **some** |
| Contagem | "3 filamento(s)" / "12 produto(s)" / "2 kit(s)" | → **some** |
| Botão de adicionar | "Adicionar filamento" · "Adicionar impressora" · "Adicionar produto" · "Montar kit" | → **some** |
| Lista de cartões | nome + resumo (+ notas) | → **some**, vira spinner |
| Ficha de 560px (desktop) | kicker "FILAMENTO SALVO", nome, formulário ou resumo | → **some**, a grade colapsa |

→ Problema central: a tela pisca de **nada** para **tudo**. Some a barra de ferramentas inteira, o
grid de duas colunas colapsa e volta, e o conteúdo salta de posição quando os dados chegam.
→ Problema secundário: o spinner é o `tf-spinner` `md` (anel de 20px, cor `--accent`, rótulo de
leitor de tela "Carregando…") sozinho no meio de um bloco de 4rem — não sugere nem quantidade, nem
forma, nem coluna.
→ **Não existe primitivo de esqueleto no DS de hoje** (não há `tf-skeleton`). O protótipo tinha
`Skeleton variant="circle|text"`; o produto perdeu isso na travessia. Este desenho precisa
especificá-lo como peça nova do DS — é a única criação autorizada aqui.

## Conteúdo e dados reais
O esqueleto imita conteúdo verdadeiro, então desenhe sobre as medidas reais das linhas:

- **Filamento** — nome curto ("PLA Azul"), resumo em uma linha: `PLA · R$ 128,90 / 1 kg`
  (material opcional; quando falta, o resumo começa direto no dinheiro).
- **Impressora** — "Ender 3", resumo: `R$ 1.899,00 · 2.000 h · 0,12 kW`.
- **Produto/Kit** — nome + resumo com as referências, mais legendas eventuais: "manual",
  "Vincule um filamento e uma impressora salvos", "{n} peça(s)".
- Legendas que podem aparecer numa terceira linha do cartão: "pode estar desatualizada" (cache
  offline) e "somente leitura" (premium pausado). O esqueleto deve caber **2 a 3 linhas** de texto
  por cartão sem mudar de altura quando o conteúdo real chega.
- Existe um segundo carregamento, menor e já resolvido: enquanto as referências de um produto ainda
  não chegaram, o resumo mostra **"carregando…"** — nunca "manual", porque isso seria uma afirmação
  sobre a procedência do dado. Mantenha essa distinção visível no desenho.
- Contagem: o número real do vendedor, tipicamente 1 a 40 itens; a lista não é paginada.

## Estados obrigatórios
1. **Carregando — primeira carga (mobile)**: 3 cartões-esqueleto empilhados, com a mesma altura e o
   mesmo espaçamento dos cartões reais; a barra com contagem e botão "Adicionar filamento" **fica no
   lugar**, com a contagem substituída por uma barra-esqueleto curta (não por "0 filamento(s)" — isso
   seria mentir sobre os dados).
2. **Carregando — primeira carga (desktop ≥1280px)**: a grade `1fr / 560px` **não colapsa**. À
   esquerda, busca e botão presentes; 4 a 6 cartões-esqueleto. À direita, o cartão da ficha mantém a
   moldura de 560px com kicker, título e três blocos de campo esqueletizados.
3. **Recarga em segundo plano**: quando já existe lista na tela, o conteúdo **não** vira esqueleto —
   um indicador discreto basta. Desenhe essa variante; hoje ela não é distinguida da primeira carga.
4. **Vazio (nenhum item salvo)**: ícone, "Nenhum filamento salvo ainda", "Salve seus filamentos uma
   vez e reutilize em cada cálculo." e o botão "Adicionar filamento".
5. **Vazio da busca** (desktop): "Nada encontrado para essa busca" / "Tente outro termo, ou limpe a
   busca para ver tudo de novo." + "Limpar busca". Nunca confundir com o vazio do catálogo.
6. **Erro**: alerta de perigo com "Não foi possível carregar seu catálogo." e botão
   "Tentar novamente".
7. **Sem permissão (conta não ativa)**: estado calmo com ícone de coroa, sem preço e sem data.
8. **Offline com cache**: aviso informativo "Modo leitura offline" acima da lista, e cada cartão com
   a legenda "pode estar desatualizada" — jamais em tom de erro.
9. **Premium pausado**: aviso informativo "Premium pausado" + legenda "somente leitura" nos cartões;
   a lista continua completa.
10. **Movimento reduzido**: com `prefers-reduced-motion`, o esqueleto perde o brilho pulsante e fica
    estático — legível, não parado-quebrado.

## Viewports
- **390px (mobile)** — é onde o Catálogo nasceu e onde o esqueleto foi desenhado em 2026-07-02.
- **1280px (desktop)** — o corte do mestre-detalhe: lista em **uma** coluna + ficha de 560px.
- **1920px** — acima de 1600px a lista vira **duas colunas** de cartões ao lado da ficha; o esqueleto
  precisa mostrar essa forma, senão o load a 1920px continua parecendo outra tela.

## Regras que o desenho não pode quebrar
- **Continuidade de forma**: o esqueleto tem a geometria do conteúdo que vai chegar. Nada de salto de
  layout quando os dados aparecem — mesma altura de cartão, mesma coluna, mesma posição do botão.
- **Nenhum número inventado**: sem "0 filamento(s)", sem preços de exemplo, sem contagem chutada
  enquanto carrega. Barra cinza é honesta; número falso não.
- **Falha de rede nunca vira "não é premium"**: carregando é carregando; erro é o alerta com "Tentar
  novamente"; sem permissão é o estado de coroa. Três coisas distintas, três formas distintas.
- **Contraste medido no fundo real**: o item 14 do r2 existe porque o esqueleto sumia no tema escuro.
  A medição que fechou o item foi **1,79:1** contra o fundo do cartão — desenhe para pelo menos isso
  em ambos os temas, e diga o valor nos comentários da prancheta.
- **Anúncio para leitor de tela**: a região carregando precisa continuar anunciando "Carregando…";
  um esqueleto puramente visual não pode calar o que o spinner já dizia.
- **Alvo ≥44px** para o botão de adicionar e para o botão de limpar busca, que permanecem clicáveis.

## Armadilhas já pagas neste projeto
- **Esqueleto invisível no escuro** — pedido duas vezes (fixes item 16, r2 item 14) antes de ficar
  visível. Não repita: valide o tom claro E o escuro.
- **Nome sem espaço estoura a página** — um filamento com 500 caracteres colados gerou **4.948px** de
  rolagem horizontal a 1440px. O cartão-esqueleto define a largura máxima; o cartão real quebra a
  palavra. Nenhum dos dois pode empurrar a grade.
- **Rolagem no eixo vertical que o headless não vê** — a ficha de 560px rola por dentro
  (`max-height` da janela) e é fixa ao topo; se o esqueleto da ficha for mais alto que a janela, ele
  precisa rolar por dentro também, não esticar a página.
- **Frase honesta em placeholder** — nada do que precisa ser lido ("Modo leitura offline",
  "pode estar desatualizada") pode viver dentro de um campo ou ser cortado por reticências.
- **Piscar em carga rápida** — com cache quente a lista chega em poucos milissegundos; um esqueleto
  que aparece e some em 80ms é pior que nenhum. Trate o tempo mínimo/atraso explicitamente no desenho.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual** (as duas versões de cada uma):

1. `390 · Catálogo carregando` — barra de ferramentas presente + 3 cartões-esqueleto.
2. `390 · Catálogo carregado` (referência lado a lado, para provar que nada salta de posição).
3. `1280 · Catálogo carregando` — grade `1fr / 560px` inteira, com o esqueleto da ficha à direita.
4. `1920 · Catálogo carregando` — lista de esqueletos em duas colunas + ficha.
5. `Recarga em segundo plano` — lista real com o indicador discreto.
6. `Anatomia do esqueleto` — o novo primitivo em detalhe: variantes barra-de-texto e bloco, alturas,
   raios, cor de base e cor de brilho nos dois temas, versão sem animação, com os valores de
   contraste anotados.

Reutilize os primitivos existentes e nomeie-os na prancheta: o cartão da lista e o cartão da ficha são
`tf-card` (o da lista em modo interativo); a barra de ferramentas usa `tf-inputwrap` + `tf-input` para
a busca e `tf-button` `sm` para "Adicionar filamento"; os avisos são `tf-alert` (`info` para offline e
premium pausado, `danger` para o erro de carga); os vazios são `tf-empty`; o indicador de recarga em
segundo plano é o `tf-spinner` `sm` já existente. **Só um primitivo novo é autorizado**: `tf-skeleton`
(variantes texto e bloco), porque ele não existe no DS e o protótipo dependia dele.

## Perguntas em aberto para o dono
1. Durante o carregamento, o botão "Adicionar filamento" e a busca ficam **habilitados** (dá para
   começar a cadastrar antes de a lista chegar) ou desabilitados até os dados existirem?
2. Existe um tempo mínimo/atraso desejado antes de mostrar o esqueleto (por exemplo, nada por 150ms e
   depois esqueleto por pelo menos 300ms), ou o esqueleto aparece sempre, mesmo em cache quente?
3. A ficha de 560px durante a primeira carga deve mostrar esqueleto de formulário (Filamentos e
   Impressoras editam ali dentro) ou o esqueleto do resumo (Produtos e Kits só resumem e mandam para
   o editor de página cheia)? São dois conteúdos diferentes atrás da mesma moldura.

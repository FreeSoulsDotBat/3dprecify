# Estado vazio do compositor de kits (/kits, antes da primeira peça)

## O que desenhar
A primeira tela que o vendedor vê na aba **Kits** depois que o servidor confirmou Premium ativo e antes de existir
qualquer peça no compositor. É a porta de entrada da funcionalidade mais cara do produto: quem chega aqui ou acabou
de assinar (veio do teaser de Kits), ou clicou na aba **Kits** do menu vindo de outra tela, ou removeu a última peça
de um kit que estava montando. Ela vive dentro da mesma `<section>` da página `/kits`, logo abaixo do cabeçalho
"Monte seus kits", e some no instante em que a primeira peça entra — dando lugar ao compositor de duas colunas
(lista de peças à esquerda, resumo e salvar à direita, acima de 1280px).

## Por que este prompt existe
Nada disto foi desenhado. O canvas do 018 tem exatamente dois ramos no bloco Kits — `isFree` (o teaser de assinatura)
e `isPremium` (três peças já populadas) — e **nenhum ramo vazio**; o protótipo de 2026-07-02 desenha empty-states de
Catálogo (§E5, "educativo" + semente) e de Histórico (§E6, gated para free), mas §E **não lista a aba Kits**. A única
autoridade é textual: `ux-bom.md` §1.8, e o §6.1 item 7 classificou o vazio como *Low / DS-ready* — pedido, não
desenho. O que está no ar hoje é copy escrita por IA mais um *nit* de review de 2026-07-12 (o segundo botão), com um
ícone assumidamente emprestado: `package`, o **mesmo glifo do Catálogo**, porque a própria `ux-bom` §6.2-G3 registra
que não existe ícone de montagem no conjunto.
E há uma contradição explícita com o desenho do 018: no canvas desktop, "Ver meus kits" e "Adicionar peça" são ações
do **cabeçalho da página**, à direita do título — no código o cabeçalho não tem ações, e esses dois botões existem só
dentro do vazio, empilhados e centralizados. Ninguém desenhou como as duas coisas convivem.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` (ramo `lines.length === 0`), primitivo `EmptyState`
(`shared/ui/empty-state.tsx`), textos em `shared/i18n/messages.pt-br.ts` → `messages.bom`.

| Parte | Texto/valor literal hoje | Observação |
|---|---|---|
| Título da página (acima, sempre visível) | "Monte seus kits" | `h1`, recebe foco na navegação |
| Descrição da página | "Aqui você pode montar Kits para anúncios únicos de acordo com seus produtos cadastrados ou peças avulsas" | |
| Ícone do vazio | glifo `package` em quadrado 56×56, raio `--radius-lg`, fundo `--accent-soft`, glifo 28px | → **emprestado do Catálogo** |
| Título do vazio | "Monte seu kit peça por peça" | `h2`, `--fs-lg` |
| Corpo do vazio | "Some peças avulsas ou produtos do seu catálogo, com quantidade, e veja o preço do kit inteiro." | `--fs-body-sm`, `--text-muted` |
| Botão primário | "Adicionar peça" (com glifo `plus` 16px à esquerda) | cria a Peça 1, quantidade "1", já expandida |
| Botão secundário | "Ver meus kits" — variante *ghost*, tamanho *sm* | navega para `/catalogo?tab=kits` |
| Caixa | coluna centralizada, `max-width: 28rem` (448px), `padding: 40px 20px`, `gap` de 12px | idêntica em qualquer largura |

Problemas que o desenho precisa resolver:

- → **A mesma frase três vezes na mesma jornada.** O teaser de Kits diz "Some peças avulsas ou produtos do seu
  catálogo, com quantidade, e veja o preço do kit inteiro, **por canal**."; o vazio repete a frase sem o "por canal";
  e a descrição da página diz o mesmo com outras palavras, dois centímetros acima. Quem pagou lê o argumento de venda
  outra vez, no lugar de aprender a usar.
- → **O vazio esconde o destino.** Nome do kit, botão "Salvar kit", "Total do kit", "Preços por canal (kit)" e o
  botão de gravar orçamento vivem TODOS dentro do ramo com peças — no vazio a coluna direita simplesmente não existe.
  O vendedor não vê onde o preço vai aparecer nem que o kit vai precisar de nome.
- → **Desktop desenhado por omissão.** A página chega a 1720px de largura útil acima de 1280px; a caixa de 448px fica
  centrada num vazio enorme, e a estrutura de duas colunas (`1fr` + 480px fixos) aparece de supetão na primeira peça.
- → **Dois vazios idênticos.** Catálogo → Produtos usa `EmptyState` com o MESMO `package`; `boxes` já é de Simulações.
  Kits e Catálogo são telas irmãs e hoje têm exatamente a mesma cara.
- → **A porta para os kits salvos é o controle mais fraco da tela** (ghost, sm) e é a única daqui. Pior: o vazio
  ignora que o vendedor pode ter 12 kits salvos — a página já carrega essa lista e não usa o número.

## Conteúdo e dados reais
- Dados verdadeiros disponíveis nesta tela e hoje não usados: **quantidade de kits salvos** (rótulo do canvas:
  "3 kit(s)") e o último kit salvo, no formato do canvas: **"Kit suporte + base · 3 peça(s) · custo R$ 52,34 ·
  varejo R$ 157,02"**. Também já está carregada a lista de produtos do catálogo, que alimenta o seletor
  "Usar produto salvo" de cada peça.
- Ao tocar "Adicionar peça": nasce a "Peça 1", **Quantidade** = `1` (inteiro ≥ 0, unidade "un"), campos vazios, já
  expandida para edição. Nenhum preço existe até a peça ficar válida — e a copy honesta para isso já está escrita:
  "Sem preço ainda" / "O preço do kit aparece assim que ao menos uma peça estiver completa e válida."
- O nome do kit é obrigatório para salvar (rótulo "Nome do kit", placeholder "Kit suporte + base", erro "Dê um nome
  ao kit para salvar."). Se o desenho quiser antecipar esse campo no vazio, é este.
- Nenhum valor em dinheiro é exibido no vazio hoje. Se o desenho introduzir um exemplo ilustrativo, ele **precisa**
  estar rotulado como exemplo — este produto não mostra número sem procedência.

## Estados obrigatórios
1. **Vazio, sem kits salvos** — o primeiro contato real (recém-assinante). Ensina o que é uma "peça" e o que é um
   "kit".
2. **Vazio, COM kits salvos** — hoje idêntico ao anterior; o desenho precisa diferenciar (quantos kits existem e um
   caminho forte até eles). Rótulo já homologado para essa porta: "Ver meus kits".
3. **Vazio por remoção da última peça** — o vendedor tinha trabalho na tela e ficou sem nada, sem desfazer. Diga se é
   a mesma prancheta ou se merece tratamento próprio.
4. **Vazio + aviso de taxas desatualizadas** (convive, acima): `Alert` informativo, título "Não foi possível
   atualizar as taxas", corpo "Usando a referência salva no dispositivo — o cálculo continua funcionando. Você também
   pode informar as taxas manualmente.", botão "Tentar novamente".
5. **Vazio + revalidação de plano falhou, mas o Premium está ativo** (convive, acima): `Alert` informativo com
   "Não foi possível verificar seu plano." — e o compositor continua inteiro, nada bloqueado.
6. **Verificando o plano** (antecede o vazio): spinner + "Verificando seu plano…".
7. **Sem resposta nenhuma do servidor sobre o plano** (no lugar do vazio): "Não foi possível verificar seu plano." +
   botão "Tentar novamente".
8. **Premium pausado, criando um kit novo** (no lugar do vazio — é a peça irmã e vale uma prancheta): `Alert`
   informativo "Premium pausado" + "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar
   ou editar, reative o Premium." + botão secundário "Ver meus kits".
9. **Free ou deslogado** (antecede, não é esta peça): o teaser de assinatura. Está aqui só para você saber de onde o
   vendedor vem e não repetir o argumento de venda depois da compra.
10. **Botões**: repouso, foco visível por teclado, hover, pressionado. "Adicionar peça" nunca fica desabilitado aqui.

## Viewports
- **390px (mobile)** — obrigatório: é onde a maior parte dos vendedores usa o app, e a caixa de 448px já é mais larga
  que a tela. Desenhe com a navegação inferior ocupando o rodapé.
- **1280px (o corte do 018)** — obrigatório: é o primeiro pixel em que a página vira duas colunas (`1fr` + 480px) e
  em que o menu lateral de 240px come largura. O vazio precisa dizer o que vem depois.
- **1920px** — obrigatório: a página chega a 1720px úteis. Mostre onde a caixa de 448px mora nesse vazio, ou proponha
  outra composição para ele.

## Regras que o desenho não pode quebrar
- **Freemium binário**: quem vê esta tela JÁ é Premium ativo. Nada de "assine", "desbloqueie", coroa ou upsell aqui.
- **Falha de rede nunca é vendida como "não é premium"**: os avisos dos itens 4 e 5 são informativos e não bloqueiam.
- **"Pausado" nunca é punição**: "expirou", "bloqueado" e "suspenso" são palavras proibidas no produto.
- **Frase honesta nunca dentro de placeholder** — placeholder carrega exemplo, não explicação (o produto já pagou
  esse erro: a frase foi cortada na largura do campo).
- **Nenhum número sem procedência**: se aparecer dinheiro, ou é do vendedor, ou está rotulado como exemplo.
- **Alvo de toque ≥ 44×44px**, inclusive no botão *ghost sm* — hoje ele é o menor controle da tela.
- **Contraste medido contra o fundo real**: o quadrado do ícone usa `--accent-soft` com glifo `--accent-text`, e o
  corpo usa `--text-muted` sobre o fundo da página — nos dois temas.

## Armadilhas já pagas neste projeto
- **Transbordo medido, não estimado**: a homologação do 018 achou 131px de transbordo culpando a *página inteira*, e
  o item-9 do 016 era rolagem no eixo **vertical**, que headless não enxerga. Uma caixa centralizada de 448px numa
  tela de 390px é exatamente a geometria que produz isso.
- **Ícone emprestado passa em qualquer teste**: nenhuma asserção distingue o `package` de Kits do `package` do
  Catálogo. Se o glifo certo não existe no conjunto, dizer isso é a resposta — o 018 abriu esse precedente ao
  acrescentar a lupa porque "sem lupa no conjunto, a imagem mostrou na hora o que nenhuma asserção mostrou".
- **Botão nascido fora da viewport**: já aconteceu aqui (100,5px de transbordo, botão fora da tela). Dois botões
  empilhados dentro de caixa centrada é a mesma família de risco no mobile.
- **Texto ocluído passa em `toBeVisible`**: layout se verifica com caixas, não com asserção de texto.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como cidadão de primeira classe**:
1. Vazio sem kits salvos — 390px · 1280px · 1920px.
2. Vazio com kits salvos (a variante que hoje não existe) — 390px · 1280px.
3. Vazio + aviso de taxas desatualizadas — 390px (o caso mais apertado).
4. Premium pausado no caminho de criação — 390px · 1280px.
5. Estados dos dois botões (repouso/foco/hover/pressionado) em uma prancheta pequena.

Reutilize os primitivos existentes, sem inventar novos: `EmptyState` (quadrado de ícone + `h2` + parágrafo + área de
ação), `Button` primário com o glifo `plus` para "Adicionar peça", `Button` secundário para "Ver meus kits" (proponha
subir de *ghost/sm* para *secondary*, se concordar), `Alert` informativo para os avisos, `PageHeader` para título e
descrição, e `Card` caso o vazio ganhe um esqueleto do resumo à direita. Se o desenho precisar de um glifo de
"montagem/kit" que o conjunto não tem, **desenhe-o e nomeie-o** em vez de reusar `package` mais uma vez.

## Perguntas em aberto para o dono
1. A aba Kits deve abrir **vazia** (como hoje) ou já com a **Peça 1 aberta** para preencher? O código sabe fazer as
   duas; ninguém decidiu qual ensina melhor.
2. Neste mesmo vazio, **criar** e **consultar** disputam a atenção. "Ver meus kits" deve virar um caminho forte
   (lista dos kits salvos ali mesmo, com contagem) ou continuar um link discreto?
3. As ações "Adicionar peça" e "Ver meus kits" ficam **no cabeçalho da página** no desktop, como o canvas do 018
   desenhou e o código não implementou, ou permanecem só dentro do vazio? Nos dois lugares, o vazio passa a ter
   botões duplicados na mesma tela.
4. O texto do vazio deve **repetir** a promessa do teaser ou passar a ensinar a mecânica (peça avulsa × produto do
   catálogo × quantidade)? Trocar a copy significa mexer numa frase já homologada.
5. Vale um glifo próprio de "kit/montagem" no conjunto de ícones, ou o `package` compartilhado com o Catálogo está
   aceito conscientemente?

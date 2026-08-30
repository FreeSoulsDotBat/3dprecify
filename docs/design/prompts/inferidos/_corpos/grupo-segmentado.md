# Grupo segmentado — a bandeja com pílulas (`tf-segmented`)

## O que desenhar

Um controle de escolha única: uma bandeja arredondada com N pílulas lado a lado, uma delas em relevo
(a escolhida). Ele vive em dois lugares do produto, com significados diferentes: (1) no **Catálogo**,
trocando a seção visível — "Filamentos · Impressoras · Produtos · Kits" — e é a primeira coisa que o
vendedor toca ao abrir a aba, no mobile e no desktop; (2) na **Conta**, no desktop, escolhendo o
**tema** — "Claro · Escuro", cada pílula com um ícone (sol/lua) à esquerda do rótulo, dentro de uma
linha de um card de configuração. No mobile a Conta continua com o interruptor de hoje (decisão do
dono: "o mobile não se mexe"), então a peça só aparece lá no Catálogo. Desenhe o **componente**
(anatomia + estados) e as **duas aplicações reais**, não um controle genérico.

## Por que este prompt existe

A auditoria classificou esta peça como `PROTOTIPO_PARCIAL`. O canvas do dono desenhou a bandeja
**parada**, a 1920, com estilos inline próprios, nos dois usos. Tudo o mais foi inferido no código:
os dois tamanhos (`sm`/`md`), o piso de 44px de altura mesmo no pequeno, o hover, o **foco**, a
rolagem horizontal escondida quando a bandeja não cabe, o teclado (Tab entra uma vez, setas
percorrem) e a segunda semântica (o Catálogo é `tablist`, a Conta é `radiogroup`).
E há uma divergência já paga em produção: **o canvas escolheu `--surface-card` para a pílula
selecionada, e o código teve de trocar por `--surface-raised` + sombra**, porque no tema escuro
`--surface-card` e o fundo da bandeja `--bg-muted` são o mesmo `#14151a` — contraste **1,00:1**, ou
seja, **não havia pílula na tela**. Na Conta era pior: card, bandeja e pílula, os três, o mesmo
`#14151a`. Este desenho existe para que a decisão de cor volte a ser tomada no desenho — desta vez
medida contra o fundo real dos dois temas.

## O que já existe hoje (não invente do zero — corrija)

| Onde | Papel | Opções (textos LITERAIS, não reescrever) | Tamanho |
| --- | --- | --- | --- |
| Catálogo, topo da aba | `tablist` (troca o painel abaixo) | "Filamentos" · "Impressoras" · "Produtos" · "Kits"; nome do grupo para leitor de tela: "Seções do catálogo" | `sm` |
| Conta, linha de um card | `radiogroup` (é um valor) | "Claro" (ícone sol) · "Escuro" (ícone lua); rótulo da linha à esquerda: "Tema" | `sm` |

Medidas reais de hoje: bandeja com `padding` de 4px, `gap` 4px, raio 999px, fundo `--bg-muted`;
pílula com altura mínima **44px**, `padding` 8px/12px no `sm`, texto **12px** no `sm` e **14px** no
`md`, peso 600 em *todos* os itens, sem borda, raio 999px; ícone 16×16 com 8px de respiro até o
rótulo; rótulos **não quebram linha**.

→ **Problema 1 — o foco foge do padrão do DS.** Aqui o foco é `outline: 2px sólido` na cor de
destaque, com 2px de afastamento; **todos** os outros primitivos (`Button`, `Card`, `Switch`,
`Field`, `Dialog`, `Toast`) usam o anel `--ring` (sombra de 2px em `--focus-ring`). O motivo dado no
código é legítimo (o foco precisa aparecer **por cima da pílula já selecionada**), mas a forma nunca
foi desenhada. Resolva no desenho: ou o anel padrão passa a funcionar sobre a pílula, ou o outline
vira a exceção declarada.
→ **Problema 2 — a rolagem é invisível.** Quando as 4 pílulas não cabem (mobile 390px), a bandeja
rola na horizontal com a barra de rolagem **escondida**. Não existe nenhuma pista visual de que há
mais conteúdo à direita.
→ **Problema 3 — não existe estado pressionado.** Não há nenhum tratamento de "estou clicando
agora"; a única transição é de cor, em 0,15s.
→ **Problema 4 — o hover só age nos não-selecionados** (o texto passa de apagado para corpo). Passar
o mouse sobre a pílula já escolhida não devolve nada.
→ **Problema 5 — `md` não tem nenhum uso real hoje.** Os dois lugares usam `sm`.

## Conteúdo e dados reais

Nada aqui é número de negócio: a peça não mostra dinheiro, quantidade nem data. O conteúdo é
exatamente o das duas listas acima — 4 rótulos curtos no Catálogo (o mais longo, "Impressoras", com
11 caracteres) e 2 rótulos com ícone na Conta. Não há contador ao lado do rótulo, não há badge, não
há "novo". A escolha do Catálogo é **derivada da URL** (`?tab=produtos` etc.), então ela sobrevive a
recarregar e a voltar — o desenho tem de assumir que qualquer uma das quatro pílulas pode ser a
selecionada no primeiro pintar, inclusive a última. O tema escolhido na Conta vale para o app
inteiro na hora, sem confirmação e sem salvar.

## Estados obrigatórios

- **Repouso, não selecionado** — texto em `--text-muted`, fundo transparente sobre a bandeja.
- **Selecionado** — pílula em relevo: fundo `--surface-raised`, texto em `--accent-text`, sombra
  `--shadow-xs`. **Nos dois temas o relevo tem de existir por forma (sombra/superfície), não só por
  matiz** — é a regra que a peça reprovou uma vez.
- **Hover (não selecionado)** — texto sobe para `--text-body`. Diga se o fundo também reage.
- **Hover sobre o selecionado** — hoje não existe; decida se deve existir.
- **Foco visível por teclado** — obrigatório e tem de aparecer **também sobre a pílula selecionada**.
- **Pressionado** — não existe hoje; desenhe.
- **Selecionado + em foco** — o caso que quebra: dois sinais empilhados no mesmo elemento.
- **Transbordo** — as 4 pílulas do Catálogo a 390px não cabem; a bandeja rola dentro de si mesma e
  **a página nunca rola na horizontal**. Desenhe a pista de "tem mais à direita".
- **Grupo inteiro ausente (sem permissão)** — no Catálogo, conta grátis ou deslogada **não vê a
  bandeja**: o teaser premium ocupa o lugar de tudo. Não desenhe uma bandeja desabilitada para esse
  caso; desenhe a ausência.
- **Premium pausado (`lapsed`)** — a bandeja aparece normal e os painéis abaixo ficam só-leitura.
  Hoje o controle **não diz nada** sobre isso (ver pergunta ao dono).
- **Desabilitado / carregando / erro / offline** — o componente **não tem** esses estados hoje: as
  pílulas nunca somem, nunca esperam rede e nunca falham. Só desenhe um deles se propuser
  conscientemente que exista, e diga por quê.

## Viewports

- **390px (mobile)** — obrigatório, e é o caso mais duro: só o Catálogo, 4 pílulas, transbordo real.
  Mostre a bandeja com a primeira pílula selecionada e com a última selecionada.
- **1280px (desktop)** — o corte do desktop do 018. Os dois usos: a bandeja do Catálogo com folga, e
  a da Conta dentro da linha do card, com o rótulo "Tema" à esquerda.
- **1920px** — só se acrescentar algo; foi a largura do canvas original e a bandeja não muda de
  tamanho com a tela.

## Regras que o desenho não pode quebrar

- **Contraste medido contra o fundo real, não contra o branco.** No escuro a Conta empilha três
  superfícies: card → bandeja → pílula. Se duas delas resolverem para o mesmo valor, a peça some.
- **Estado nunca sinalizado só por cor** (WCAG 1.4.1) e **indicador de estado com pelo menos 3:1**
  contra o vizinho (1.4.11). Como todos os itens já são peso 600 e sem borda, se você tirar o relevo
  o único sinal vira a cor do texto — foi exatamente o defeito corrigido.
- **Alvo de toque ≥ 44px de altura em todos os tamanhos**, inclusive no `sm`.
- **Zero transbordo horizontal da página.** O contêiner que se declara rolável pode rolar; a página
  não pode.
- **Ícone é decoração**: o rótulo escrito ("Claro"/"Escuro") é que informa — nunca uma bandeja só de
  ícones.
- **Nenhuma pílula pode ser desenhada como "trancada"/premium**: o freemium aqui é binário e resolve
  fora do controle (teaser no lugar da tela inteira).

## Armadilhas já pagas neste projeto

- **A pílula invisível no escuro** (acima): a cor foi escolhida no desenho e corrigida no código;
  contraste 1,00:1 passou por todos os testes automatizados porque nenhum teste enxerga cor.
- **Barra de rolagem que o headless não vê**: no 016 um transbordo real passou batido porque a
  verificação media só um eixo. Se a rolagem é a solução, ela precisa de **pista visual desenhada**,
  não de confiança na barra do sistema.
- **Texto ocluso passa em teste**: `está visível` e `contém o texto` continuam verdadeiros para uma
  pílula empurrada para fora da bandeja. Layout se decide por caixa, não por texto.
- **Divergência canvas × código sem dono**: quando o desenho usa estilos inline próprios em vez dos
  tokens do DS, a correção acontece no código e o desenho fica mentindo. Use os tokens.

## Entregável

Pranchetas, tema **escuro como padrão e claro como primeira classe** (as duas versões de cada uma):

1. **Anatomia** — a bandeja com 2 e com 4 pílulas, cotas de altura (44px), respiros, raio, e os dois
   tamanhos `sm`/`md` lado a lado (ou a recomendação de aposentar o `md`).
2. **Matriz de estados** — repouso, hover, pressionado, foco, selecionado, selecionado+foco, para
   uma mesma bandeja.
3. **Catálogo a 390px** — inclusive o quadro de transbordo com a pista de continuação, e o quadro em
   que a pílula selecionada é a última.
4. **Catálogo a 1280px** e **Conta a 1280px** — esta última dentro da linha do card, com "Tema" à
   esquerda, mostrando no escuro os três níveis de superfície distinguíveis.

Reaproveite os primitivos existentes em vez de criar novos: a bandeja e as pílulas são a família
`tf-segmented` (bandeja `--bg-muted` + raio pill; pílula selecionada `--surface-raised` +
`--accent-text` + `--shadow-xs`), o cartão da Conta é o `Card` do DS, os ícones são os do conjunto
`Icon` a 16px, e o foco deve usar o anel `--ring` do DS a menos que você justifique a exceção.

## Perguntas em aberto para o dono

1. **Foco**: o grupo segmentado mantém o outline próprio (destaque, 2px, afastado) ou volta ao anel
   `--ring` que todo o resto do DS usa? É a única exceção do sistema hoje, e ninguém decidiu.
2. **Pista de rolagem no mobile**: desvanecimento na borda direita, setas, ou nada (aceitar que o
   usuário descubra arrastando)?
3. **Premium pausado**: quando a assinatura está pausada e os painéis do Catálogo ficam só-leitura,
   a bandeja deve dizer alguma coisa, ou o aviso continua sendo só do painel de baixo?
4. **Tamanho `md`**: ninguém usa. Fica no sistema como opção desenhada, ou é aposentado?

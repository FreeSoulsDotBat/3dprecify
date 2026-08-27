# Faixa de sessão expirada — o caminho de volta quando o servidor recusa a sessão

## O que desenhar
A faixa que aparece no topo do app inteiro quando o **servidor** recusa uma sessão que o aplicativo
ainda achava viva (um 401 com código de sessão expirada). Ela não é um erro de tela: é o **único
caminho de volta**, e aparece por cima de qualquer aba — Calcular, Catálogo, Kits, Orçamentos, Conta —
no meio do trabalho, tipicamente no instante em que o vendedor apertou "Salvar em Orçamentos" no fim
de uma página longa. O conteúdo embaixo continua editável e nada é destruído: os registros que não
foram enviados ficam guardados no aparelho. Quem a usa é o vendedor comum, no momento mais frágil de
uso do produto — ele acabou de fazer uma conta e descobriu que ela não subiu.

## Por que este prompt existe
Esta peça nunca foi desenhada. Ela nasceu num hotfix de 2026-08-07 (016/A3), cinco semanas depois do
protótipo de 2026-07-02 — que não tem faixa nem tela de sessão nenhuma. Tudo o que hoje define a peça
foi decidido por código: a **forma** (faixa larga sobre o shell, e não toast, folha ou diálogo), o
**tom** (`info`, não `danger`), a **ausência de qualquer dispensa** e — o mais grave — a **fixação no
topo, escolhida por medição de bug e não por desenho**: o comentário no arquivo registra que a faixa
montada no topo nascia 1.746px (1440) / 3.608px (360) fora da viewport, então virou `sticky` com um
`z-index: 40` escrito em estilo **inline** dentro do componente. É a superfície que governa o momento
mais frágil do uso, desenhada por acidente de correção.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/session-expiry-banner/session-expiry-banner.tsx`, montada em
`app-shell.tsx` logo abaixo da faixa de offline, **acima** da barra lateral e da barra superior.

| Elemento | Hoje | Observação |
|---|---|---|
| Contêiner | `Alert` tom `info` (fundo info-soft, ícone "info" 20px, `role="status"`) | Bloco com 16px de respiro interno, cantos arredondados, borda transparente |
| Título | "Sua sessão expirou" | Peso semibold, tamanho de corpo pequeno |
| Corpo | "Entre de novo para continuar de onde parou." | Uma linha |
| Ação | Botão primário **pequeno**, texto "Entrar de novo" | Leva para a tela de entrada preservando a página atual |
| Posicionamento | Fixo no topo da rolagem, sobreposto ao conteúdo | Estilo inline, sem classe própria |
| Dispensa | **Não existe** | Fica até o vendedor entrar de novo ou uma requisição voltar a dar certo |

→ O botão primário é da variante **pequena**: no aparelho, a altura fica abaixo dos 44px de alvo
mínimo. É o único alvo tocável da peça, e é o mais importante do app naquele instante.
→ O bloco é um "cartão" solto colado na borda: não tem tratamento de faixa (nada de largura total
com margem lateral resolvida), então a caixa arredondada encosta nas laterais da tela.
→ Como o bloco fica **por cima** do conteúdo que rola, o fundo dele precisa ser 100% opaco. Hoje é um
tom "soft" — se tiver transparência, o texto do orçamento passa por trás da frase.
→ Não há hierarquia definida entre esta faixa, a faixa de offline (que também usa fundo info e é
largura total, centralizada) e a barra superior. As duas faixas **podem aparecer ao mesmo tempo**, e o
resultado é duas tarjas azul-claras empilhadas dizendo coisas calmas diferentes.

## Conteúdo e dados reais
Textos literais, já homologados, que o desenho deve usar **exatos**:
- Título: **"Sua sessão expirou"**
- Corpo: **"Entre de novo para continuar de onde parou."**
- Ação: **"Entrar de novo"**

Textos da mesma família, que aparecem em outras superfícies **no mesmo instante** e precisam conviver
com a faixa sem se contradizer (não os reescreva, use-os para checar coerência):
- Faixa da fila de Orçamentos: "3 registro(s) não foram enviados: sua sessão expirou." + ação
  "Entrar de novo"
- Etiqueta no cartão do registro: "Envio pausado · sessão expirada"
- Aviso no detalhe do registro: título "Sessão expirada", corpo "Este registro não foi enviado para a
  sua conta: sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo."
- Faixa de offline (outra peça, pode estar visível junto): "Você está offline. O cálculo continua
  funcionando."

A peça **não tem dados variáveis**: nenhum número, nenhuma contagem, nenhuma data, nenhum nome de
usuário. Ela conhece exatamente um bit — expirou ou não. Não invente contador de registros pendentes
aqui (isso mora na faixa da fila, dentro de Orçamentos); se você achar que deveria estar aqui, isso é
pergunta para o dono, não decisão sua.

## Estados obrigatórios
1. **Ausente** — nada expirou: a faixa não existe, não reserva espaço nenhum. É o estado 99% do tempo.
2. **Repouso (expirado)** — título, corpo e o botão "Entrar de novo".
3. **Entrada da faixa** — ela aparece durante o trabalho, sem recarregar a página: mostre como ela
   entra (empurra o conteúdo ou sobrepõe?) sem fazer o vendedor perder o lugar onde estava.
4. **Foco no botão** (teclado) — anel de foco visível contra o fundo tintado da faixa, não contra o
   fundo da página.
5. **Hover** e **pressionado** do botão.
6. **Rolagem** — o estado que define a peça: a faixa parada no topo enquanto o conteúdo passa por
   trás. Desenhe esse instante, com texto de orçamento atrás, para provar a opacidade.
7. **Convivência com a faixa de offline** — as duas visíveis ao mesmo tempo. Mostre a ordem e a
   separação, ou defenda um desenho em que uma some.
8. **Convivência com a faixa da fila** — na aba Orçamentos, a faixa do shell no topo e a faixa
   "3 registro(s) não foram enviados: sua sessão expirou." dentro da página: duas vezes a mesma
   verdade em duas tarjas. Resolva visualmente essa redundância.
9. **Sem dispensa** — se o desenho propuser uma dispensa, mostre também o que sobra depois de
   dispensar (o caminho de volta não pode simplesmente sumir).

## Viewports
- **Mobile 390px** — obrigatório e prioritário: é onde a faixa custa mais caro (cada pixel dela é
  pixel de trabalho) e onde o alvo do botão é crítico. Desenhe também o instante logo depois do
  "Salvar em Orçamentos", com o vendedor no fim da página.
- **Desktop 1280px** — a faixa é renderizada **acima** da barra lateral e da barra superior, atravessa
  a largura inteira do shell. Precisa dizer o que acontece com o alinhamento da mensagem numa largura
  em que a frase ocupa uma fração da linha.
- **Desktop 1920px** — mesma pergunta, ampliada: uma frase curta centralizada num vão de 1920px vira
  texto perdido; uma frase alinhada à esquerda vira botão a 1600px de distância do olho.

## Regras que o desenho não pode quebrar
- **Nunca dizer "conexão" ou "offline".** A conexão está intacta; o que morreu foi a sessão. Essa
  disciplina é deliberada e foi paga por um defeito real (a cópia antiga prometia sincronização
  automática "quando houver conexão" com a conexão perfeita).
- **Nada foi perdido, e isso precisa continuar verdadeiro na leitura.** O tom não pode sugerir
  destruição de dados: os registros não enviados continuam no aparelho.
- **Um 401 nunca desconecta o vendedor.** A faixa convida; não expulsa, não bloqueia a tela, não
  esvazia o formulário. Nada de sobreposição modal que impeça continuar mexendo embaixo.
- **A frase honesta vive em texto de largura cheia**, nunca em espaço apertado que a corte.
- **Alvo de toque ≥44px** para "Entrar de novo" — o botão pequeno de hoje é o problema a corrigir.
- **Contraste medido contra o fundo real da faixa** (o fundo tintado), não contra o fundo da página,
  nos dois temas.
- **A faixa é opaca.** O conteúdo que rola por baixo não pode ser lido através dela.

## Armadilhas já pagas neste projeto
- **Botão nascido fora da viewport**: foi exatamente o que aconteceu aqui (1.746px / 3.608px fora) e a
  correção virou o desenho. O desenho novo tem que resolver isso por intenção, não por remendo.
- **Transbordo horizontal medido**: a 390px, título + corpo + botão numa faixa que encosta nas bordas
  já custou transbordo em outras peças. Nada pode ultrapassar a largura da tela em nenhum dos dois
  eixos.
- **Texto que passa em teste e está ocluso**: uma faixa sobreposta pode tapar o campo ou o botão que
  está logo abaixo dela na página. Mostre o que fica coberto quando a faixa aparece.
- **Duas tarjas da mesma cor dizendo coisas diferentes** já apareceram no produto e leem como uma só.

## Entregável
Pranchetas, tema escuro primeiro e tema claro como igual (nenhum dos dois é rascunho):
1. Mobile 390px — faixa em repouso, no topo de uma tela de Orçamentos com conteúdo real atrás.
2. Mobile 390px — o instante da rolagem, com texto passando por trás da faixa.
3. Mobile 390px — faixa + faixa de offline juntas, e faixa do shell + faixa da fila juntas.
4. Desktop 1280px — a faixa atravessando o shell acima da barra lateral e da barra superior.
5. Desktop 1920px — o mesmo, resolvendo o alinhamento no vão largo.
6. Detalhe em escala 1:1 dos estados do botão: repouso, hover, foco, pressionado, com a altura de
   alvo cotada.

Reaproveite os primitivos existentes em vez de criar novos: o bloco de aviso `tf-alert` no tom `info`
(ícone + título + corpo já fazem parte dele), o botão `tf-btn tf-btn--primary` numa altura que atinja
o alvo, o ícone do conjunto do app, e os espaçamentos e raios dos tokens. Se a faixa precisar de um
tratamento de largura total que o `tf-alert` não tem, descreva-o como **variação do alerta em faixa**,
não como componente novo.

## Perguntas em aberto para o dono
1. **A faixa pode ser dispensada?** Hoje não pode — fica até o vendedor entrar de novo. Se puder, qual
   é o caminho de volta depois de dispensar (um selo permanente na barra superior? nada?).
2. **Tom `info` ou `danger`?** O código escolheu `info` com o argumento de que nada foi destruído. É
   uma decisão de produto: o vendedor precisa se alarmar para agir, ou se acalmar para continuar?
3. **A faixa do shell deve dizer quantos registros ficaram parados?** Hoje ela não sabe disso de
   propósito, e essa informação aparece só dentro de Orçamentos — o que gera duas tarjas. O dono
   prefere uma faixa que conte ("3 registro(s) não foram enviados") ou duas superfícies separadas?
4. **Quando offline e sessão expirada acontecem juntos, quem manda?** As duas faixas empilhadas dizem
   duas verdades simultâneas — e uma delas ("entre de novo") é impossível de executar sem rede.

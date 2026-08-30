# Cartão de identidade da Conta — carregando, sessão expirada e falha

## O que desenhar

O primeiro cartão da aba **Conta**: o bloco que diz quem está logado (círculo com a inicial + o e-mail).
Ele fica no topo da primeira coluna, imediatamente acima do cartão **Plano** — é a primeira coisa que o
vendedor lê quando abre a Conta, e é o cartão que responde à pergunta "esta é a minha conta mesmo?".
O que precisa de desenho não é o cartão resolvido (esse já existe): são os **três estados em que ele não
tem o e-mail para mostrar** — enquanto o servidor não respondeu, quando a sessão expirou, e quando a
chamada falhou por outro motivo. É a mesma pessoa, no mesmo lugar, em três momentos diferentes.

## Por que este prompt existe

Os três estados foram decididos direto no código, sem nenhum desenho: o carregando virou um cartão com um
*spinner* solto no meio e nada mais; a sessão expirada virou uma tarja vermelha **sem nenhum botão**; e o
erro genérico virou a mesma tarja com um "Tentar novamente" abaixo. O canvas de layout do 018 desenha
**apenas o cartão resolvido** (avatar "M" + `maker@truthsforge.com` + o rótulo "Conectado como" — rótulo
que, aliás, o app **não** renderiza), e a lista de estados de referência traz só "Email Google".
A rodada 1 de homologação pediu esqueletos e um erro-com-retry, e isso foi desenhado e entregue — mas para
as **listas** de Catálogo e Histórico, não para este cartão. Esse padrão de lista é o precedente mais
próximo e é o ponto de partida, não a resposta: ele não sabe o que fazer com a variante **sem botão** (na
sessão expirada, tentar de novo não resolve nada — o caminho certo é voltar ao login) nem como o cartão
empilha no estreito. → O empilhamento atual do erro nasceu de uma **medição de defeito**, não de desenho.

## O que já existe hoje (não invente do zero — corrija)

| Estado (no código) | O que aparece hoje | Problema |
| --- | --- | --- |
| Carregando (`isLoading`) | Cartão vazio com um *spinner* centralizado. Rótulo só para leitor de tela: "Carregando…" | → O cartão muda de altura e de forma quando resolve: sai um spinner centralizado, entra uma linha avatar+e-mail alinhada à esquerda. Salta. |
| Sessão expirada (401 / `UNAUTHENTICATED` / `TOKEN_EXPIRED`) | Tarja vermelha com título **"Não foi possível carregar sua conta"** e o texto **"Sua sessão expirou. Entre novamente."** — e **nenhum botão** | → Não há porta de volta ao login desenhada. O texto manda "entre novamente" e não oferece onde. |
| Falha genérica (rede, 500, 404, 403) | Mesma tarja vermelha, texto vindo do código do erro, e abaixo o botão secundário **"Tentar novamente"** (que vira estado carregando enquanto refaz a chamada) | → O título afirma "sua conta" mesmo quando o problema é a rede. |
| Resolvido | Círculo de 44px com a **inicial maiúscula** do e-mail sobre a cor de acento + o e-mail em uma linha, com reticências se não couber | → O rótulo "Conectado como" existe na copy e no canvas, mas não é renderizado. |
| Sem dado (`data` vazio) | **O cartão inteiro desaparece** da página | → Buraco silencioso: a coluna começa direto no Plano, sem explicação. |

Correção à ficha da auditoria: o *design system* **não tem** hoje um primitivo `Skeleton` — só `Spinner`.
Se o desenho pedir esqueleto (e ele deveria), isso é um primitivo novo a especificar aqui.

## Conteúdo e dados reais

- **Avatar**: círculo de 44×44px, fundo de acento, uma letra — a primeira do e-mail, em maiúscula. É
  decorativo (o leitor de tela o ignora); a informação está no e-mail.
- **E-mail**: uma linha só, sem quebra, com reticências no fim quando estoura. Exemplos verdadeiros para
  desenhar: `maker@truthsforge.com` (curto) e `jonatan.fernandes.bossan@meuateliedeimpressao.com.br`
  (o caso que estoura a coluna a 390px). **Não** existe nome de exibição — o servidor devolve só `uid` e
  `email`.
- **Quando o e-mail é nulo**, o app cai para o `uid` opaco: `8f3c1d2a9b7e4f60a1c3d5e7`. Ilegível para
  humano, e é a única "identidade" que sobra. Desenhe esse caso.
- **Sem PII em dica de ferramenta**: o e-mail nunca vai para um `title`/tooltip (vazaria para a telemetria).
  Se não couber, o desenho tem que resolver por layout, não por tooltip.
- **Frases literais disponíveis** (não reescreva sem dizer que está reescrevendo):
  "Não foi possível carregar sua conta" · "Sua sessão expirou. Entre novamente." ·
  "Algo deu errado. Tente novamente." · "Você não tem acesso a este recurso." ·
  "Não encontramos o que você procura." · "Tentar novamente" · "Conectado como" · "Sair".
  Já existe no app, no Histórico, a ação **"Entrar de novo"** que leva ao login preservando a página de
  origem como retorno — é o precedente exato do caminho que falta aqui.

## Estados obrigatórios

1. **Carregando** — o cartão ocupando a MESMA caixa do resolvido (mesma altura, mesmo alinhamento), com a
   forma do avatar e a forma da linha de e-mail insinuadas. Nada de texto inventado.
2. **Resolvido** — avatar + e-mail; decidir se "Conectado como" entra e onde (ver perguntas).
3. **Sessão expirada** — tom de perigo, título "Não foi possível carregar sua conta", corpo "Sua sessão
   expirou. Entre novamente." e uma ação de volta ao login. **Sem** "Tentar novamente": repetir a chamada
   com um token morto só produz o mesmo erro.
4. **Falha genérica** — mesma tarja + "Tentar novamente" (secundário).
5. **Tentando de novo** — o botão "Tentar novamente" em estado carregando, desabilitado, sem que o cartão
   mude de tamanho.
6. **Sem identidade legível** — e-mail nulo, só o `uid`.
7. **Foco de teclado** em cada ação (o vendedor navega por Tab), **hover** e **pressionado** nos botões.

## Viewports

- **390px (mobile)** — obrigatório: a Conta é uma coluna só, o cartão ocupa a largura toda.
- **360px** — obrigatório e adversarial: é a largura em que o defeito real aconteceu.
- **1280px** — o corte do desktop: a Conta vira três colunas e este cartão vive na primeira
  (a mais larga, ~1,15 de 3). O cartão fica visivelmente mais largo e a tarja de erro fica curta demais
  se for desenhada só como faixa.
- **1920px** — o desenho de referência do 018 foi feito nesta largura; mostre que o cartão não vira uma
  faixa vazia com uma letra perdida à esquerda.

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é falta de Premium.** Este cartão não fala de plano, preço nem assinatura — nem
  quando falha. O cartão Plano, logo abaixo, é quem fala disso.
- **Sessão expirada não é problema de conexão.** A palavra "conexão"/"offline" não pode aparecer aqui:
  o app já pagou esse defeito uma vez, prometendo "sincroniza quando houver conexão" com a conexão intacta.
- **Nunca fabricar identidade.** Se o servidor não confirmou quem é, o cartão não mostra um e-mail
  lembrado, um nome de placeholder nem uma inicial genérica.
- **Toda ação tem alvo de toque de pelo menos 44px** e contraste medido contra o fundo real do cartão nos
  dois temas — inclusive o vermelho da tarja sobre o cartão escuro.
- **A frase honesta mora em elemento de largura inteira**, nunca dentro de campo, badge ou legenda curta que
  a corte no meio.
- **Nada de rolagem horizontal**, em nenhuma das quatro larguras.

## Armadilhas já pagas neste projeto

- O botão do erro **nasceu fora do cartão e fora da tela** a 360px (borda direita medida em 378,5 contra
  360 de tela) porque o cartão era uma linha feita para avatar+texto e o erro tem outra forma. O remendo
  foi empilhar. → O desenho precisa dizer que **erro e carregando têm arranjo próprio**, não o do resolvido.
- Na linha do Plano, ao lado, dois botões produziram **100,5px de transbordo** a 390px, com um botão
  inteiramente fora da viewport. Mesma família de defeito, mesma tela.
- Um e-mail longo é o valor grande que estoura a coluna: verifique com o e-mail comprido acima.
- Texto ocluído ou transbordado **passa** em teste automático — a prova é geométrica e visual.

## Entregável

Pranchetas do cartão isolado, **em tema escuro (padrão) e claro (igual em cuidado)**, uma por estado:
carregando · resolvido · sessão expirada · falha genérica · tentando de novo · identidade só com `uid`;
mais **uma prancheta de contexto** por viewport (390 e 1280) mostrando o cartão em erro **acima do cartão
Plano**, para provar que duas tarjas/ações vizinhas não competem. Reaproveite os primitivos existentes,
sem criar variantes novas: cartão para o contêiner, alerta em tom de perigo para as duas falhas, botão
secundário para "Tentar novamente" e para "Sair", indicador de atividade para o carregando do botão. Se
propuser um esqueleto de carregamento, especifique-o como **primitivo novo do DS** (ele ainda não existe),
com as duas formas que este cartão usa: um círculo de 44px e uma barra de linha única.

## Perguntas em aberto para o dono

1. Na sessão expirada, o cartão deve oferecer **"Entrar de novo"** (o mesmo caminho que o Histórico já usa,
   voltando para a Conta depois do login) ou **"Sair"**, que limpa a sessão morta e devolve à tela de
   entrada? São produtos diferentes: um preserva o destino, o outro descarta a sessão.
2. Sessão expirada é problema **deste cartão** ou **da página inteira**? Se o token morreu, o cartão Plano
   ao lado também vai falhar — o desenho pode mostrar duas tarjas vermelhas empilhadas dizendo a mesma
   coisa. Um aviso único no topo da Conta resolveria; é decisão de produto.
3. O rótulo **"Conectado como"** entra no cartão resolvido (o canvas o desenha, o app não o renderiza)?
   E se entrar, antes do e-mail ou depois?
4. Quando o e-mail é nulo e sobra o `uid` opaco: mostrar o `uid` cru, mostrar um texto de "conta sem
   e-mail", ou tratar como falha?

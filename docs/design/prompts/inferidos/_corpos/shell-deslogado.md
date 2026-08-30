# O shell deslogado — o app inteiro antes de existir uma conta

## O que desenhar
O chrome do aplicativo (barra superior + menu de navegação, nas duas variantes: TabBar inferior no
mobile e barra lateral no desktop) no estado em que **ninguém está conectado**. É o primeiro
contato: o vendedor abre o Precifica3D, cai em "Calcular" (a raiz `/` redireciona para `/calcular`)
e pode navegar livremente por Calcular, Catálogo, Kits e Orçamentos — todas públicas — sem nunca
ter criado conta. É o estado comercial mais importante do produto e é o único que nunca foi
desenhado.

## Por que este prompt existe
O shell anônimo foi **inferido inteiro**, sem nenhuma autoridade de desenho: as autoridades
consultadas descrevem o shell apenas como o destino DEPOIS do login (§E3), e o ciclo de sessão é
fechado como "Login fullscreen ↔ shell; Sair na Conta volta ao Login" — em E1–E9 não existe shell
anônimo, e a matriz §G não tem linha para ele. O canvas 018 desenha a barra superior sempre com
`maker@truthsforge.com` + "Sair"; o `isFree` desenhado lá é o usuário **logado sem Premium**, que
é outro estado. Consequência medida no código: quando a sessão não está autenticada, o bloco de
conta da barra superior devolve **nada** (`top-bar.tsx`: `if (status !== "authenticated") return null`),
e a palavra "Entrar" **não aparece em nenhum arquivo de `widgets/` ou `app/`**. O produto vende
"calcular é grátis" e entrega esse convite num shell sem porta.

## O que já existe hoje (não invente do zero — corrija)

Barra superior (`widgets/top-bar/top-bar.tsx`), estado deslogado:

| Elemento | Deslogado hoje | Logado hoje |
| --- | --- | --- |
| Logo | mark compacta ≤425px, lockup horizontal no desktop (40px de altura) | igual |
| Identidade | **ausente** (o bloco inteiro é `null`) | "Conectado como maker@truthsforge.com" (some abaixo de 640px) |
| Ação de sessão | **ausente** | botão secundário "Sair" |
| Tema | botão-ícone sol/lua, rótulo acessível "Alternar tema", 44×44px | igual |

→ Problema 1: a barra superior deslogada tem **logo + botão de tema e mais nada**. O lado direito
fica visualmente vazio no desktop (1280/1920px), onde o espaço é justamente o que sobra.

→ Problema 2: **não existe convite para entrar ou criar conta em lugar nenhum do chrome**. O único
caminho é tocar em "Conta" (5º item do menu) e ser *redirecionado* para a tela de login — a
fronteira do freemium só é descoberta por colisão.

Menu (`widgets/app-nav/app-nav.tsx`) — os cinco itens, na ordem, com os rótulos literais:
`Calcular` · `Catálogo` · `Kits` · `Orçamentos` (a rota é `/historico`, o rótulo visível é
"Orçamentos") · `Conta`. O landmark se chama "Navegação principal". No desktop recolhido o rótulo
sai da tela mas continua audível, e a dica de mouse devolve o nome.

→ Problema 3: os cinco itens são **visualmente idênticos**. Não há cadeado, badge, separador ou
qualquer marca distinguindo o que funciona deslogado (Calcular, e as três abas que mostram teaser)
do que **empurra para o login** (Conta, e Catálogo/Orçamentos quando carregam um produto ou um
orçamento específico pela URL).

→ Problema 4: nas abas públicas o deslogado vê o teaser Premium com o botão "Assinar Premium" —
que, para quem não tem conta, na verdade navega para o login. O rótulo promete cobrança e entrega
formulário de entrada.

## Conteúdo e dados reais
- Nome do app: "Precifica3D". A marca no logo é Truth's Forge (lockup inteiro no desktop, mark no mobile).
- Rótulos de menu: exatamente os cinco acima. Não renomear — "Orçamentos" já foi renomeado uma vez
  (016/US2) e é copy homologada.
- Botão de tema: rótulo acessível "Alternar tema"; estado pressionado = tema escuro. No desktop o
  018 prevê um **controle segmentado** com dois segmentos rotulados "Claro" e "Escuro" (ícones
  sol/lua, pílula de raio 999px) — desktop-only, por decisão do dono.
- Copy que JÁ existe e pode ser reaproveitada, se o desenho decidir trazê-la para o chrome:
  título "Entrar", subtítulo "Entre para acessar seu catálogo, orçamentos e conta.", botão
  "Entrar com Google", e a legenda honesta dos teasers "A calculadora continua grátis."
- Medidas reais: barra superior de 56px no mobile; barra lateral de 240px expandida e 76px
  recolhida; alvo mínimo de toque 44px.
- Exemplo numérico da tela por trás (Calcular público, primeira visita com dados semeados): preço
  sugerido **R$ 24,24**. O vendedor deslogado precisa ver esse número sem obstrução.

## Estados obrigatórios
1. **Anônimo** — o estado principal deste prompt. O chrome mostra logo, navegação e tema; o desenho
   precisa decidir onde entra o convite de entrada.
2. **Verificando sessão** — hoje o app inteiro é substituído por uma única linha de texto:
   "Verificando sessão…". Desenhe o que aparece nesse instante sem piscar identidade falsa.
3. **Login indisponível no ambiente** — indistinguível do anônimo no chrome; só na tela de login
   aparece "Login indisponível: Firebase não configurado neste ambiente."
4. **Autenticado**, para contraste — identidade + "Sair" (é o único estado que o canvas 018 cobre).
5. **Offline** — a faixa superior de status já existe e o cálculo continua funcionando; a frase da
   tela de login é "Você está offline. O login precisa de internet — o cálculo continua funcionando."
6. **Sessão expirada** — faixa fixa com a ação "Entrar de novo" (existe hoje, é a única ocorrência
   de "Entrar" no chrome, e só aparece para quem JÁ estava logado).
7. **Item de menu:** repouso · hover · foco visível (anel) · seção atual · recolhido (só ícone,
   rótulo audível) — nos cinco itens.
8. **Convite de entrada (o elemento novo):** repouso · hover · pressionado · foco · carregando (se
   levar direto ao Google) · desabilitado quando o login não está disponível no ambiente.

## Viewports
- **390px (mobile)** — obrigatório: a barra superior mobile centraliza o logo e ancora as ações à
  direita; o menu é a TabBar inferior de 5 itens. Mostre onde o convite cabe sem brigar com o logo
  centralizado nem com a TabBar.
- **1280px (desktop, o corte do 018)** — barra lateral expandida de 240px à esquerda de tudo, barra
  superior começando onde a lateral termina, logo alinhado à esquerda em vez de centralizado.
- **1920px** — a mesma composição com o lado direito da barra superior ainda mais vazio: é aqui que
  a ausência de identidade fica mais evidente.
- Desenhe também **1280px com o menu recolhido** (rail de 76px, só ícones): o convite precisa
  sobreviver ao recolhimento.

## Regras que o desenho não pode quebrar
- **Freemium binário e honesto:** entrar (conta) e assinar (Premium) são coisas DIFERENTES. Nada no
  chrome pode sugerir que criar conta libera Premium, nem que Premium é necessário para calcular.
- **Nada de identidade falsa:** enquanto a sessão está sendo verificada, não desenhe avatar,
  iniciais nem espaço reservado que pareça um usuário. O produto já pagou caro por "premium aparente".
- **Falha de rede nunca vira "faça login" nem "não é premium".** Offline é offline, com frase própria.
- **Frase honesta nunca dentro de placeholder** (lição do 016): "A calculadora continua grátis." e
  qualquer explicação da fronteira moram em elemento de largura plena, nunca cortadas.
- **Alvo ≥44px** em todos os controles do chrome, inclusive o convite novo, inclusive no rail de 76px.
- Contraste medido **contra o fundo real** da barra superior (superfície de card, não o fundo da página).

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado:** a 426px a barra lateral de 240px deixava ~150px de
  conteúdo e a página inteira acusava 131px de transbordo. Qualquer elemento novo na barra superior
  precisa caber em 390px junto com o logo e o tema.
- **O e-mail some abaixo de 640px** por regra de CSS — ou seja, entre 426 e 639px o lado direito já
  é quase vazio mesmo logado. Não desenhe assumindo que a identidade sempre aparece.
- **Texto ocluso passa em teste:** um convite empurrado para fora da barra ou coberto pelo logo
  centralizado continua "visível" para asserção de texto. Prove por geometria, com caixas.
- **Rótulo escondido não é rótulo removido:** no rail, o nome do item sai da tela mas continua
  audível. Se o convite virar só ícone, ele precisa do mesmo tratamento.

## Entregável
Pranchetas, **tema escuro como padrão e tema claro em pé de igualdade** (as duas versões de cada):
1. Barra superior deslogada — 390px, 1280px, 1920px.
2. Barra superior deslogada × autenticada, lado a lado a 1280px (a comparação é o argumento).
3. Shell deslogado completo a 390px (TabBar visível) e a 1280px (lateral expandida e recolhida),
   com "Calcular" ativo por trás.
4. Estados do convite de entrada: repouso, hover, pressionado, foco, desabilitado, carregando.
5. Estado "Verificando sessão…" e estado offline no chrome deslogado.
6. Proposta de marcação da fronteira nos itens de menu (o que hoje é Problema 3): no máximo duas
   alternativas, sem escolher por nós.

Reaproveite os primitivos existentes, sem criar novos: `tf-topbar` e seus filhos para a barra;
`tf-btn` (variante secundária ou ghost, tamanho `sm`) para o convite de entrada — o mesmo shape do
"Sair" atual; `tf-nav` / `tf-nav__item` / `tf-nav--rail` para o menu; `tf-topbar__theme` ou o
segmentado do canvas 018 para o tema; a faixa de status existente para offline e sessão expirada;
o conjunto de ícones do DS para qualquer ícone (nada desenhado à mão).

## Perguntas em aberto para o dono
1. O convite deslogado deve dizer **"Entrar"** (a copy que já existe na tela de login) ou **"Criar
   conta"** (o que o vendedor de primeira viagem realmente vai fazer)? São promessas diferentes e o
   código não decide isso.
2. O convite fica **permanente na barra superior** ou aparece só quando o vendedor esbarra na
   fronteira? Permanente é honesto e ocupa espaço escasso a 390px; contextual é mais limpo e mantém
   a fronteira invisível até a colisão — que é exatamente o defeito de hoje.
3. Os itens gateados do menu devem ganhar **marca visual** (cadeado/badge) para o deslogado, ou
   isso vende o produto como "bloqueado" antes de mostrar valor?
4. Quando um deslogado toca em "Assinar Premium" no teaser, ele hoje cai no login sem aviso. O botão
   deve **mudar de rótulo** para o deslogado, ou o login deve **explicar** que é etapa da assinatura?
5. O controle segmentado de tema ("Claro"/"Escuro") do canvas 018 vale também no estado deslogado,
   ou o deslogado fica com o botão-ícone atual?

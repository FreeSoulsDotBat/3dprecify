# Barra superior do mobile (56px): marca, "Sair" e tema

## O que desenhar
A faixa fixa de 56px que fica no topo de TODAS as telas do app no celular (≤425px), acima do conteúdo e
acima da barra de abas inferior (Calcular · Catálogo · Kits · Orçamentos · Conta). Hoje ela carrega três
coisas ao mesmo tempo: o símbolo da marca centralizado, o botão "Sair" e o botão de alternar tema. Quem a
usa é o vendedor de peças 3D no meio da jornada — ele quase nunca quer sair nem trocar de tema; ele quer
espaço para calcular preço. O desenho pedido é a decisão de COMPOSIÇÃO desses 56px: o que fica, o que sai,
e como a marca convive com o que sobrar.

## Por que este prompt existe
Nada disso foi desenhado — foi inferido por IA ao extrair o cabeçalho inline da versão 001. E não é só
ausência de protótipo: o protótipo **decide o contrário**. §E3 é literal — "**Header minimalista**: só
logo/símbolo. **Migração header→tabs (resolve o cramping mobile, TD-017):** identidade (email), **Sair** e
**toggle de tema** SAEM do header e vão para a aba **Conta**" — e §E7 recebe os três na Conta;
`.design-import/ui_kits/precifica3d/AccountScreen.jsx` materializa isso (tema como `Row`, "Sair" como
`ListItem`, e a única top-bar da tela é `<TopBar title="Conta"/>`, sem e-mail, sem "Sair", sem tema). O
canvas do 018 desenha uma top-bar com e-mail + tema + "Sair", mas dentro do artboard `data-layout="desktop"`
de 1920px, e o arquivo declara não cobrir mobile — viewport errada. **Resultado: o código contraria a única
autoridade que fala do assunto, e a duplicação nasceu daí** — "Sair" e o controle de tema existem hoje DUAS
vezes no mobile (aqui e na aba Conta), sem nenhuma decisão de desenho sobre qual manda.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/widgets/top-bar/top-bar.tsx` + `top-bar.css`; a duplicata em
`apps/web/src/pages/conta/conta-page.tsx`.

| Elemento | Como está hoje | Observação |
|---|---|---|
| Faixa | altura 56px (`--topbar-h`), fundo de cartão, borda inferior de 1px, respiro lateral = gutter da tela | fixa em todas as rotas |
| Marca | símbolo compacto (variante "mark"), 32px de altura, **posicionado em ABSOLUTO no centro** da faixa | → o centro é geométrico, não óptico: ele ignora a largura do cluster à direita |
| "Sair" | botão secundário pequeno, texto literal **"Sair"** | → 44px de alvo real; some junto com o cluster se a sessão não estiver autenticada |
| Tema | botão quadrado 44×44 só com ícone (lua no escuro, sol no claro), rótulo assistivo e `title` **"Alternar tema"** | → não diz para onde vai; sem texto visível |
| E-mail | `"Conectado como" + e-mail` existe no mesmo cluster, mas só aparece a partir de 640px | → **no mobile ele NUNCA aparece** (o ramo mobile só monta até 425px): é copy morta nesta viewport |
| Rota `/sign-in` | a marca é suprimida e vira um espaçador invisível (o cartão de login já mostra a marca) | a faixa fica com o cluster sozinho à direita |
| Acima da faixa | banner de offline e banner de sessão expirada, quando existirem | empurram a faixa para baixo |

→ Problemas a resolver no desenho, não a documentar: (a) **a marca centralizada em absoluto colide com um
cluster de largura variável** — hoje "Sair" + tema ocupam ~96px + gutter e não encostam nela a 390px, mas
qualquer rótulo maior, um e-mail reaparecendo ou uma fonte ampliada fecha essa folga sem aviso; (b) **a
duplicação**: o mesmo "Sair" e o mesmo controle de tema estão na aba Conta, que é uma das 5 abas fixas do
rodapé, a um toque de distância; (c) os 56px mais escassos do produto estão gastos com duas ações raras.

## Conteúdo e dados reais
- Marca: símbolo compacto, 32px de altura, texto alternativo **"Precifica3D"**.
- Botão de saída: texto exato **"Sair"** — não "Encerrar sessão", não "Logout".
- Tema: dois estados reais, escuro (ícone de lua, é o padrão do v1) e claro (ícone de sol); rótulo
  assistivo exato **"Alternar tema"**. Na aba Conta o mesmo tema aparece como interruptor no mobile, com a
  legenda da linha e as palavras "Claro"/"Escuro" já usadas no desktop.
- Identidade: prefixo exato **"Conectado como"** + e-mail (ex.: `jonatan.fbossan@gmail.com`), com corte por
  reticências a partir de 220px de largura. Só existe ≥640px.
- Sair não é imediato quando há registros na fila offline: abre um diálogo com o título
  **"{n} registro(s) ainda não foram sincronizados"** e as ações **"Sincronizar agora"** e
  **"Sair e descartar"** (com **"Precisa de conexão para enviar."** quando offline). O desenho da barra
  precisa saber que o botão pode ABRIR ALGO, não só sair.
- Nada aqui exibe dinheiro nem número derivado — é chrome puro. Se algum preço aparecer no desenho, está errado.

## Estados obrigatórios
- **Repouso autenticado**: marca + "Sair" + tema (ou o que o novo desenho decidir manter).
- **Não autenticado / carregando sessão**: o cluster de conta simplesmente não existe — sobra a marca e o
  tema. Desenhe essa faixa: ela é a primeira que o usuário novo vê.
- **Rota de login**: marca suprimida, faixa quase vazia.
- **Foco por teclado**: anel visível nos dois botões, medido contra o fundo de cartão da faixa (não contra
  o fundo da página).
- **Hover e pressionado** nos dois botões; o botão de tema tem estado "pressionado" permanente quando o
  tema é escuro (hoje ele muda cor de ícone e de borda) — mostre os dois.
- **Tema claro e tema escuro** da própria faixa, com a marca correta para cada um.
- **Offline**: o banner **"Você está offline. O cálculo continua funcionando."** aparece ACIMA da faixa —
  desenhe a pilha com ele.
- **Sessão expirada**: banner com **"Sua sessão expirou"**, **"Entre de novo para continuar de onde parou."**
  e a ação **"Entrar de novo"**, também acima da faixa. Nunca fale em conexão aqui — a rede está boa.
- **Sair com fila pendente**: o diálogo descrito acima cobrindo a tela.

## Viewports
Desenhe **390px** (principal) e **360px** (o aperto real — é a largura em que este projeto já mediu
transbordo horizontal três vezes). Um terceiro quadro a **425px** só se a sua composição mudar nesse limite.
**Não desenhe desktop**: acima de 425px o app monta outra estrutura (barra lateral à esquerda, top-bar
começando depois dela, marca alinhada à esquerda em vez de centralizada, e-mail visível) e essa peça já
tem desenho próprio no canvas do 018.

## Regras que o desenho não pode quebrar
- Alvo de toque ≥44px nos dois botões, com folga real dentro de 56px de altura.
- Zero transbordo horizontal a 360px, medido com a caixa e não "de olho": a soma marca + cluster + gutters
  tem que caber, e a marca centralizada em absoluto não pode passar por baixo do cluster.
- A frase honesta nunca mora em `title`/tooltip: se o tema precisa dizer o que faz, diga com texto ou
  mova-o para a Conta, onde a linha já é rotulada.
- Falha de rede jamais vira "faça upgrade" nem some silenciosamente: os dois banners de cima são
  primeiros-classe, não enfeite.
- Contraste medido contra o fundo real da faixa (superfície de cartão), inclusive do ícone de tema no
  estado pressionado.
- Uma única marca por tela: se a rota já mostra a marca no conteúdo (login), a faixa não repete.
- Se o desenho mantiver "Sair"/tema aqui E na Conta, ele precisa dizer explicitamente qual é o principal e
  por que os dois existem. Duplicação sem decisão é o defeito que originou este prompt.

## Armadilhas já pagas neste projeto
- Elemento centralizado em absoluto sobre vizinho de largura variável: `toBeVisible` passa com o elemento
  totalmente ocluído — oclusão não é propriedade de texto. Desenhe a folga; não confie no teste.
- Transbordo horizontal a 360px com botão nascendo fora da viewport (E6/T028) — a mesma classe reapareceu
  na Conta em 2026-08: `right 378,5 > 360`.
- Copy que existe no código e nunca aparece na tela (o "Conectado como" desta barra no mobile; o aviso do
  PR #58 que existia e nunca renderizou). Se um texto está no desenho, ele precisa ter uma viewport em que
  aparece.
- Rótulo que descreve estado em vez de ação: o rail aprendeu isso ("Recolher", não "Recolhido"). "Alternar
  tema" tem o mesmo cheiro — alterna para qual?

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro**, ambas 1:1, sem escala: (1) barra em repouso
autenticado a 390px; (2) barra a 360px com as caixas de medida visíveis; (3) barra sem sessão
(não autenticado); (4) barra na rota de login; (5) foco/hover/pressionado dos dois botões; (6) a pilha
completa com banner de offline e com banner de sessão expirada; (7) — se a sua proposta for a migração do
protótipo — como a aba Conta recebe "Sair" e tema no mobile, e como fica a faixa esvaziada. Reutilize os
primitivos existentes, sem inventar novos: `tf-btn--secondary --sm` para "Sair", o botão-ícone quadrado já
usado na barra para o tema (ou `tf-switch`/`tf-segmented` se ele migrar para a Conta), `tf-logo--mark` para
a marca, `tf-alert` para os banners, `tf-dialog` para a confirmação de saída com fila pendente, `tf-card`
para as linhas da Conta.

## Perguntas em aberto para o dono
1. **Vale a migração do protótipo (§E3/TD-017)?** Ou seja: "Sair" e tema saem da barra do mobile e ficam só
   na aba Conta — que já é uma das 5 abas fixas do rodapé — deixando a faixa com a marca sozinha? É a
   decisão que muda tudo neste desenho, e é de produto, não de código.
2. Se ficarem os dois lugares: **qual manda** e o que justifica repetir? (Hoje ambos escrevem no mesmo
   estado; não há conflito técnico, só ambiguidade de produto.)
3. Se o tema ficar na barra, ele deve dizer para onde vai ("Modo claro"/"Modo escuro") em vez de "Alternar
   tema"? A troca de rótulo é homologação de copy, não escolha do designer.
4. A marca no mobile deve continuar centralizada, ou alinhada à esquerda como no desktop do 018? Centralizar
   é a única razão do posicionamento absoluto que gera o risco de colisão.

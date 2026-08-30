# Página "Como tratamos seus dados" (rota `/privacidade`)

## O que desenhar
A página pública que responde "o que vocês fazem com meus dados". Ela vive fora do produto pago: é
alcançável **deslogada**, e o único caminho de entrada hoje é um link de rodapé na tela de login —
logo abaixo do botão "Entrar com Google", ou seja, exatamente no segundo em que o vendedor decide se
entrega o e-mail dele. Quem a usa é alguém em dúvida, no meio de uma ação, que quer ler pouco,
entender e voltar. Ela é montada dentro do shell (top-bar + menu lateral no desktop, tab bar no
mobile), então o vendedor vê o menu do produto ao redor de um texto que não pertence a nenhuma das
cinco abas. Desenhar: a leitura das cinco declarações, a hierarquia entre elas, e a volta.

## Por que este prompt existe
Nunca houve desenho desta página. O inventário §E (E1–E9) não tem tela de privacidade — o aviso
legal só aparece como frase solta de rodapé no kit de login antigo ("Ao continuar você concorda com
os Termos e a Política de Privacidade. Os cálculos funcionam offline."), **sem destino nenhum**. O
canvas do 018 desenha "Como tratamos seus dados", mas como um `tf-card` na terceira coluna da aba
Conta, com `<h2>` e **uma** frase: cobre o cartão, não a rota avulsa. O mesmo conteúdo existe hoje
em três tamanhos — **5 frases** na página, **2** no cartão da Conta, **1** no desenho — sem que
ninguém tenha desenhado a relação entre eles. A moldura da página (um cartão único de 448px, sem
volta, sem data) foi inferida por IA.

## O que já existe hoje (não invente do zero — corrija)
Uma seção de largura máxima **448px** (`max-w-md`) centrada, com um `<h1>` "Como tratamos seus
dados" e **um único cartão** (`Card padding="lg"`) contendo cinco parágrafos corridos, separados só
por um respiro de 12px. Sem subtítulos, sem separadores, sem ícones, sem data, sem botão de voltar.

Ordem atual e texto **literal** (nenhuma dessas frases pode ser reescrita sem o dono — a redação foi
ratificada por ele antes da UAT):

| # | Chave | Texto exato hoje |
|---|---|---|
| 1 | `google` | "Para entrar, usamos o Login com Google, que nos informa seu e-mail — usado apenas para identificar sua conta." |
| 2 | `monitoring` | "Registramos erros técnicos (Sentry) para corrigir falhas." |
| 3 | `noSale` | "Não vendemos seus dados nem fazemos rastreamento para publicidade." |
| 4 | `calculatorFree` | "A calculadora funciona sem login e não coleta nada." |
| 5 | `catalogData` | "Se você usar o Premium, salvamos seu catálogo (filamentos, impressoras e produtos) na sua conta para você reutilizar nos cálculos." |

Problemas a resolver no desenho:

→ **Não há volta.** O menu do shell tem cinco itens fixos — Calcular · Catálogo · Kits · Orçamentos
· Conta — e nenhum deles é "Entrar". Quem chegou pelo rodapé do login só volta pelo botão do
navegador; tocar em "Conta" deslogado devolve à tela de login **por acidente** (é uma rota guardada
que redireciona), não por desenho.
→ **A frase 2 e a frase 5 não são da mesma família.** "Registramos erros técnicos (Sentry)" e "Se
você usar o Premium, salvamos seu catálogo" respondem perguntas diferentes (o que é coletado ×
o que é guardado × o que NÃO fazemos), e o cartão único as apresenta como uma lista plana.
→ **"(Sentry)" é jargão** para um vendedor de impressão 3D. É o único nome de fornecedor no texto
sem uma palavra que explique o que ele é.
→ **Nenhuma data de vigência, nenhuma versão.** Uma política sem data é uma política que ninguém
consegue conferir se mudou.
→ **O `<h1>` é solto**, escrito à mão, e não usa o cabeçalho de página do produto — então, ao
contrário de todas as outras telas, o título não recebe foco quando o vendedor navega até aqui
(leitores de tela não são anunciados na chegada) e não existe o espaço de linha de apoio que o
cabeçalho padrão oferece.
→ **O desktop é uma coluna de 448px dentro de um `<main>` que vai até 1720px.** A página nem sequer
usa a largura padrão das telas do 016/018 (460px no mobile, 1120px a partir de 1024px, 1720px a
partir de 1280px). A 1920px o texto ocupa cerca de um quarto da área útil e o resto é vazio.

## Conteúdo e dados reais
Não há campos, números nem dinheiro nesta peça: é conteúdo estático, sem chamada de rede, sem
formulário e sem nada que o vendedor possa alterar. O que existe de concreto:

- **Título**: "Como tratamos seus dados" — o mesmo texto é o rótulo do link no rodapé do login e o
  `<h2>` do cartão da Conta (três lugares, uma string).
- **Link de origem** (tela de login, abaixo do cartão de entrada): sublinhado, tamanho pequeno, cor
  de texto secundário, medido em **181×20px** e forçado a **24px de altura mínima** por ser um link
  de rodapé solto, não um link dentro de uma frase.
- **Cartão gêmeo na Conta** (terceira coluna do desktop, abaixo do tema, acima de "Sair"): título +
  frases 1 e 3 apenas, **sem link para esta página** — a Conta mostra dois quintos da política sem
  dizer que existe mais.
- **Fora do escopo declarado**: não há gestão de consentimento, exclusão de dados, e-mail de contato
  nem "Termos de Uso"; o desenho **não pode sugerir** que existam.

## Estados obrigatórios
Poucos, e é honesto que sejam poucos — o código não tem carregamento, erro nem vazio aqui. Desenhe
só o que existe de verdade:

- **Repouso** — a página completa, deslogado (é o caso principal: veio do login).
- **Repouso, logado** — o mesmo conteúdo com a aba de origem ainda destacada no menu; mostre que a
  página não pertence a nenhuma aba e como isso é resolvido visualmente.
- **Foco de teclado** no link/botão de voltar e no título (anel de foco visível sobre o fundo real
  do cartão, não sobre o fundo da página).
- **Hover e pressionado** do controle de volta.
- **Offline** — a faixa de offline do shell aparece acima de tudo, mas a página **funciona inteira
  offline** (é texto): desenhe a faixa presente e nenhum aviso de "conteúdo indisponível".
- **Sessão expirada** — a faixa fixa "Entrar de novo" do shell também pode estar aqui; desenhe a
  convivência das duas faixas com o título.
- Não há estado premium, pausado, degradado nem sem permissão nesta peça — criar um é inventar
  produto.

## Viewports
- **390px (mobile)** — obrigatório: é o aparelho em que o vendedor lê isso, e a tab bar fixa embaixo
  come altura no fim do texto.
- **1280px** — o corte em que o menu lateral e a largura larga entram; é onde o cartão de 448px
  começa a parecer perdido.
- **1920px** — obrigatório *porque é onde o defeito é maior*: 448px de texto num `<main>` de até
  1720px. Precisa de uma decisão de medida de linha (o texto de leitura não deve virar uma linha de
  dois metros — mas também não pode ser um quarto da tela vazia).

## Regras que o desenho não pode quebrar
- **As cinco frases são texto ratificado.** Podem ser reagrupadas, tituladas e reordenadas; **não
  podem ser reescritas, resumidas nem suavizadas** neste desenho. Se alguma precisar mudar, isso vira
  pergunta ao dono, não uma edição.
- **Nada de linguagem de marketing** e **nenhum direito que não existe**: sem "seus dados estão
  seguros conosco", sem "solicite a exclusão", sem "Termos de Uso" clicável — nada está construído.
- **A frase 4 é uma promessa dura** ("A calculadora funciona sem login e não coleta nada.") e precisa
  de peso visual; **a frase 5 não é oferta** — é declaração de tratamento de dado, sem botão de
  assinar nem selo de premium ao lado.
- **Frase honesta nunca em placeholder** nem cortada por reticências: tudo aqui é conteúdo em
  elemento de largura cheia.
- **Alvo de toque ≥44px** no controle de volta (o link de origem vive com 24px por ser texto de
  rodapé; o botão desta página não tem essa desculpa) e **contraste medido contra o fundo real do
  cartão**, não contra o fundo da página.

## Armadilhas já pagas neste projeto
- **Transbordo medido nos dois eixos.** A frase 5 passa de 130 caracteres e a frase 1 tem um
  travessão que não quebra; a 390px, com a tab bar embaixo, o teste automatizado não vê barra de
  rolagem clássica — mede-se a geometria, inclusive no eixo vertical.
- **Texto ocluso passa em teste.** "Está visível" não é propriedade do texto: mostre caixas que não
  se sobrepõem, especialmente com as duas faixas do shell empilhadas no topo.
- **O desktop largo já foi um vazio de 37%** numa outra tela antes do 016; esta página é o último
  lugar com o problema na forma original.
- **Repetição sem procedência**: três cópias do mesmo texto com tamanhos diferentes é o que gerou
  esta ficha — um desenho que crie uma quarta versão piora o problema.

## Entregável
Pranchetas, todas em **tema escuro** (padrão) e com **pelo menos duas repetidas em tema claro** (o
claro é first-class e este texto tem muita superfície):

1. **Mobile 390px — repouso, deslogado**: a página inteira, do título ao fim do texto, com a tab bar.
2. **Mobile 390px — a chegada**: recorte da tela de login com o link de rodapé, para amarrar origem e
   destino (mostrando o rótulo "Como tratamos seus dados" como ele é hoje).
3. **Desktop 1280px — repouso**, com o menu lateral expandido.
4. **Desktop 1920px — repouso**, resolvendo a medida de linha e o vazio.
5. **Estados**: foco de teclado no controle de volta, hover/pressionado, e a versão com faixa de
   offline + faixa de sessão expirada presentes ao mesmo tempo.
6. **Relação com o cartão da Conta**: um recorte lado a lado da terceira coluna da Conta (título + 2
   frases) e o topo desta página, propondo como um remete ao outro.

Reutilize os primitivos existentes, sem criar novos: o **cabeçalho de página** do produto para o
título (é ele que dá o foco na chegada e a linha de apoio), o **cartão** (`tf-card`) para os blocos
de texto, o **botão secundário** com ícone para a volta, o **separador** do DS entre grupos, a
**faixa/alerta** do DS para os avisos do shell, e a **largura de página larga** do 016/018 no lugar
do `max-w-md`. Rótulos de seção usam o nível de título do DS abaixo do `<h1>`.

## Perguntas em aberto para o dono
1. **"Termos de Uso" existem?** O kit de login antigo prometia "os Termos e a Política de
   Privacidade"; hoje só a Política existe e não há rota de Termos. O desenho cita um único
   documento ou dois?
2. **Data de vigência / versão**: a página deve mostrar "Atualizado em {data}"? Não existe nada
   disso hoje, e criar o carimbo é decisão de produto (obriga a manter).
3. **A relação página × cartão da Conta**: o cartão da Conta continua com as 2 frases e sem link
   (como está e como o canvas 018 desenhou), ou vira um resumo **com** "Ler a política completa"?
   As duas respostas mudam o desenho dos dois lados.
4. **A volta**: quando o vendedor chega deslogado, o botão de voltar leva a **/sign-in** (a origem
   real) ou à calculadora (a única tela pública de produto)? O menu não tem "Entrar".
5. **A frase do Sentry**: "(Sentry)" pode ganhar cinco palavras de explicação — "um serviço que nos
   avisa quando algo quebra" — ou a redação ratificada é intocável?
6. **Cancelamento do Premium**: o texto deve dizer o que acontece com o catálogo salvo quando a
   assinatura acaba? Hoje a política não diz, e o produto tem lapso/pausa.
7. **Canal de contato**: existe um e-mail para pedido sobre dados? Não há nenhum no app; sem isso, o
   desenho não pode oferecer "Fale conosco".

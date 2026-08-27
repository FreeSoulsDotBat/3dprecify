# Catálogo que não carregou: o caminho de volta

## O que desenhar

O estado da aba **Catálogo** quando a leitura da lista falha e não há nada em cache para mostrar — e o
estado irmão, que mora no mesmo ponto do código, em que o servidor recusa a leitura por falta de Premium
ativo. É a área de conteúdo abaixo do cabeçalho "Catálogo" e das pílulas de seção (**Filamentos ·
Impressoras · Produtos · Kits**): no lugar da lista de itens salvos aparece hoje um bloco de erro. Quem
vê é o vendedor premium que abriu o app com internet ruim, com o servidor fora do ar, ou com a assinatura
em estado que o servidor não reconhece como ativa — normalmente no meio de um cálculo, indo buscar um
filamento salvo. Esse mesmo painel serve as quatro seções, então o desenho vale igual para Filamentos,
Impressoras, Produtos e Kits.

## Por que este prompt existe

O estado não foi inventado do zero: o protótipo de 2026-07-02 (`-fixes.md`, item 17) especificou
nominalmente "estado 'Não foi possível carregar. Tente de novo.' + botão 'Tentar novamente'" e a V2 marcou
`load-error+retry` como entregue — o rótulo do botão tem autoridade e não muda. O que **nunca foi
desenhado** é: (1) o título que o código realmente usa, diferente do especificado; (2) o **recipiente** —
alguém decidiu que isso seria um alerta vermelho com um botão pequeno enfiado dentro do corpo dele, em vez
de um estado de página com ação própria; (3) a consequência no desktop, porque o ramo de erro vem **antes**
do ramo de largura no código e por isso engole também a coluna da ficha; (4) o ramo `ENTITLEMENT_REQUIRED`,
que não tem autoridade nenhuma — o protótipo só conhecia a conta grátis (que vê um estado vazio COM
descrição e ação) e não conhecia um 403 de leitura para uma conta premium pausada/inativa.

## O que já existe hoje (não invente do zero — corrija)

Origem: `apps/web/src/features/catalog/catalog-panel.tsx` (ramos de `list.isError`),
`catalog-master-detail.css`, `shared/i18n/messages.pt-br.ts`.

| Ramo | O que aparece hoje | Problema |
| --- | --- | --- |
| Falha de leitura sem cache | `Alert` tom **danger** (fundo/borda de erro, ícone `circle-alert`, `role="alert"`), título **"Não foi possível carregar seu catálogo."**, e dentro do corpo do alerta um botão secundário **pequeno** "Tentar novamente" | → o botão é a única saída da tela e está no tamanho `sm`, dentro de um bloco de aviso; → o alerta vermelho ocupa a largura inteira e não tem corpo de texto, só título + botão; → nada explica que os itens continuam salvos no servidor |
| Leitura recusada por Premium | `EmptyState` com ícone de coroa e **só** o título **"Salvar faz parte do Premium."** — sem descrição e **sem nenhuma ação** | → beco sem saída: nenhum botão, nenhum caminho para reativar; → a frase fala de **salvar** enquanto o que falhou foi **ler** — é a mensagem errada nesse lugar |
| Ao tocar "Tentar novamente" | a nova busca torna a lista "carregando", então o bloco de erro **some inteiro** e vira um `Spinner` centralizado com folga vertical; falhando de novo, o alerta vermelho volta | → o conteúdo salta duas vezes e o botão não dá sinal nenhum de que foi apertado |
| Desktop ≥1280px | o ramo de erro vem antes do ramo de largura: some a grade mestre-detalhe inteira (lista à esquerda + ficha fixa de **560px** à direita), somem a busca "Buscar no catálogo…", a contagem "{n} filamento(s)" e o botão "Adicionar filamento" | → uma faixa vermelha de ~1200px de largura com um botão de ~140px perdido dentro dela |

Vizinhança que **já está desenhada e é o contraste que interessa**: quando a leitura falha mas existe cache
no aparelho, o painel mostra um alerta **tom info** (nunca vermelho) com título "Modo leitura offline" e
corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."; e o
Premium pausado mostra "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para
criar ou editar, reative o Premium." — os dois calmos, com título **e** corpo. O estado de falha total é o
único da família que grita e o único sem corpo explicativo.

## Conteúdo e dados reais

- Título atual (literal): **"Não foi possível carregar seu catálogo."** — o protótipo pedia "Não foi
  possível carregar. Tente de novo."; escolha uma e diga qual, mas mantenha o par título curto + frase de
  apoio.
- Ação (literal, com autoridade, **não reescrever**): **"Tentar novamente"**.
- Estado irmão de entitlement (literal hoje): **"Salvar faz parte do Premium."**
- Frases irmãs da mesma família, para calibrar tom e evitar cinco jeitos de dizer a mesma coisa:
  "Não foi possível carregar seus orçamentos." (Histórico), "Não foi possível carregar seus itens salvos
  agora." (seletor do cálculo), "Algo deu errado." / "Recarregar" (a tela cheia de erro do app — superfície
  diferente, não copie a linguagem dela aqui).
- O que a tela perdida continha, e que o desenho do erro precisa deixar recuperável: busca ("Buscar no
  catálogo…"), contagem ("3 filamento(s)"), "Adicionar filamento" / "Adicionar impressora" /
  "Adicionar produto" / "Montar kit", e a ficha do item selecionado.
- Nenhum dado numérico do vendedor aparece neste estado: não há preço, não há data. Não desenhe valores
  falsos de exemplo dentro do bloco de erro.

## Estados obrigatórios

1. **Erro de carga (repouso)** — o estado principal: título, uma frase de apoio honesta e a ação
   "Tentar novamente". A frase de apoio precisa dizer o que é verdade: os itens continuam salvos, o que
   falhou foi buscar a lista agora.
2. **Ação em foco por teclado** — anel de foco visível contra o fundo do bloco (que pode ser vermelho suave;
   meça o contraste contra ESSE fundo, não contra o fundo da página).
3. **Hover** e **pressionado** da ação.
4. **Nova tentativa em andamento** — hoje não existe: desenhe o que substitui o salto de conteúdo (ação em
   carregamento no próprio lugar, ou o bloco mantido com indicação de que está buscando). Sem prometer
   sucesso antes do servidor responder.
5. **Falhou de novo** — o que muda na segunda tentativa seguida (a mesma tela repetida sem reconhecimento
   nenhum é o pior caso).
6. **Leitura offline (cache presente)** — NÃO é este bloco: mostre lado a lado, no tom info, para provar
   que falha de rede com dados em mãos nunca vira vermelho.
7. **Premium pausado** — alerta info calmo acima da lista carregada, com a lista intacta.
8. **Sem permissão de leitura (`ENTITLEMENT_REQUIRED`)** — precisa de título, corpo e **uma ação**. Hoje
   tem só um título.
9. **Erro no desktop com a ficha** — como a coluna de 560px se comporta quando não há lista: some, vira
   espaço vazio, ou o bloco de erro ocupa a faixa inteira? É a decisão central do desenho.

## Viewports

- **Mobile 390px** — a lista é a tela inteira; o bloco de erro é tudo o que o vendedor vê. Alvo da ação
  ≥44px de altura e largura confortável para o polegar.
- **Desktop 1280px** — o primeiro pixel do mestre-detalhe (lista + ficha de 560px). É aqui que a decisão
  sobre a coluna da ficha aparece.
- **Desktop 1920px** — acima de 1600px a lista vira duas colunas; um bloco de erro esticado por ~1550px de
  largura é o caso feio a resolver (largura máxima de leitura, centralizado ou ancorado à esquerda).

## Regras que o desenho não pode quebrar

- **Falha de rede nunca é vendida como falta de Premium**, e o inverso também não: o bloco de erro de carga
  não pode conter oferta, preço, data ou CTA de assinatura.
- **Nada de preço nem de data** em qualquer estado de Premium (regra vigente na casa).
- **Freemium é binário**: a conta grátis já encontra o teaser antes desta tela; este estado é de conta
  premium, e confundir os dois é o defeito que ele já tem.
- **A frase honesta vive em elemento de largura cheia**, nunca dentro de um `placeholder` nem cortada por
  reticências — armadilha já paga neste projeto.
- **Vermelho é para o que falhou de verdade e não tem plano B.** Se existe cache, é info. O desenho precisa
  deixar essa hierarquia óbvia entre os três blocos.
- **Alvo de toque ≥44px** e contraste medido contra o fundo real do bloco, nos dois temas.
- Sem transbordo horizontal em nenhum viewport: nomes longos sem espaço já geraram 4.948px de rolagem
  nesta mesma tela, e o bloco de erro herda a mesma faixa.

## Armadilhas já pagas neste projeto

- Um estado que **substitui a página inteira** no desktop leva junto colunas que não têm relação com a
  falha — é exatamente o que acontece aqui com a ficha de 560px.
- Um botão pequeno dentro de um alerta passa em qualquer teste de texto e some aos olhos de quem está
  frustrado: teste visual, não textual.
- Estado vazio **sem ação** já foi julgado beco sem saída neste app (o vazio de busca ganhou "Limpar
  busca" justamente por isso).
- Conteúdo que salta (erro → spinner → erro) foi reprovado antes; o retorno visual tem que acontecer no
  lugar onde o dedo tocou.

## Entregável

Pranchetas, **tema escuro primeiro e tema claro como igual**:

1. Erro de carga — mobile 390px (repouso · ação em foco · nova tentativa em andamento).
2. Erro de carga — desktop 1280px, mostrando o que acontece com a coluna da ficha.
3. Erro de carga — desktop 1920px, com a largura máxima de leitura resolvida.
4. Comparativo dos três blocos empilhados: falha total (vermelho) · leitura offline com cache (info) ·
   Premium pausado (info) — para provar a hierarquia.
5. Sem permissão de leitura (`ENTITLEMENT_REQUIRED`) com título, corpo e ação, em 390px e 1280px.

Reutilize os primitivos existentes, sem criar componente novo: `tf-alert` (tons `danger`/`info`) para os
blocos de aviso, `tf-empty` (ícone + título + descrição + ação) para o estado de página, `tf-btn` nas
variantes `secondary`/`ghost` para as ações, `tf-spinner` para a busca em andamento, `tf-card` para a
moldura da área de conteúdo. Se a sua decisão for tirar a ação de dentro do alerta, mostre-a como
`tf-empty` com ação — o primitivo já existe e já tem esse encaixe.

## Perguntas em aberto para o dono

1. O bloco de erro deve ser **alerta vermelho** ou **estado de página** (`tf-empty` com ícone, corpo e
   ação)? Os dois primitivos existem; a escolha muda o peso visual da falha.
2. Vale o título do código ("Não foi possível carregar seu catálogo.") ou o do protótipo ("Não foi possível
   carregar. Tente de novo.")? E as quatro variantes irmãs — Catálogo, Orçamentos, seletor do cálculo —
   convergem para uma frase só?
3. No `ENTITLEMENT_REQUIRED` de **leitura**, qual é a ação? Levar para a Conta/reativação, ou só explicar?
   E qual frase, já que "Salvar faz parte do Premium." fala de escrita num erro de leitura?
4. No desktop, o erro ocupa a faixa inteira ou fica só na coluna da lista, com a coluna da ficha exibindo
   um estado próprio de "nada selecionado"?

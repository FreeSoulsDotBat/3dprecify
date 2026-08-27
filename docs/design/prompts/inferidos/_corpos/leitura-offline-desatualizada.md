# Catálogo em leitura offline — a faixa "Modo leitura offline" e a marca "pode estar desatualizada"

## O que desenhar
O estado do Catálogo (abas Filamentos · Impressoras · Produtos · Kits) quando a leitura online falhou
mas o aparelho ainda tem os itens salvos em cache: o vendedor abre o app na feira, sem sinal, e a
lista aparece completa — só que ninguém garante que aquilo é o que está no servidor. Hoje esse
momento produz três avisos diferentes ao mesmo tempo (a faixa global do shell, uma faixa dentro do
painel e uma linha em CADA item da lista) enquanto o botão "Adicionar filamento" continua convidando
para uma ação que só vai falhar na hora de salvar. Desenhe **como o Catálogo conta essa verdade uma
vez só**, no lugar certo, em mobile e desktop, sem transformar um estado calmo (dados servem, escrita
não) num campo minado de alertas.

## Por que este prompt existe
Ninguém desenhou esta peça: a faixa do painel, a linha por item e a convivência entre os três sinais
foram inferidas por IA a partir de texto de requisito. Pior — a autoridade que existe **contradiz o
código**. O protótipo de 2026-07-02 (§E3/§E9) desenha um "offline banner discreto em ciano" **no
shell**, e só; não há faixa dentro do painel nem rótulo por linha, e o `CatalogScreen.jsx` do
protótipo não tem nenhum dos dois. §E3 é explícito: "ações de rede (salvar/sync) ficam
DESABILITADAS"; a matriz §G repete "offline: leitura mock ok, salvar off" para a lista e "salvar
desabilitado" para o formulário. **O botão ativo é uma divergência do desenho, não uma lacuna.** E a
copy canônica do §D.2 é "Offline — o cálculo continua funcionando", diferente das duas frases que
estão no ar. O canvas do 018 (`Abas-Desktop.dc.html`) não desenha offline em nenhum dos quatro
artboards — o desktop nunca viu esse estado.

## O que já existe hoje (não invente do zero — corrija)
Três sinais podem aparecer simultaneamente:

| # | Onde | Texto literal | Gatilho real |
|---|---|---|---|
| 1 | Faixa full-bleed acima da barra superior (shell inteiro) | "Você está offline. O cálculo continua funcionando." | `navigator.onLine === false` |
| 2 | Alerta tom `info` no topo do painel do Catálogo | Título "Modo leitura offline" · corpo "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão." | a leitura online falhou **e** existe cache com itens |
| 3 | 3ª linha de legenda dentro de cada card da lista | "pode estar desatualizada" | o mesmo gatilho de #2, repetido item a item |

→ **Os gatilhos 1 e 2 não são a mesma coisa** e o desenho atual finge que são: dá para ter #2 sem #1
(o servidor devolveu erro com a rede funcionando) e #1 sem #2 (offline com cache válido e recente).
Nada na tela diferencia "você está sem internet" de "não consegui falar com o servidor".

→ **A linha por item se multiplica**: 30 filamentos salvos = 30 vezes "pode estar desatualizada" na
mesma tela, dizendo o que a faixa já disse uma vez.

→ **O convite continua de pé**: o botão "Adicionar filamento" (primário, com ícone `plus`) segue
ativo; a gaveta abre, o formulário aceita tudo, e só ao tocar Salvar aparece "Criar e editar precisam
de conexão." No desktop é pior: a ficha à direita **é** o editor do filamento/impressora, com Salvar
ativo, 560px de campos editáveis que não têm para onde ir.

→ **As linhas empilham**: um produto degradado offline com Premium pausado mostra, no mesmo card,
"Vincule um filamento e uma impressora salvos" + "pode estar desatualizada" + "somente leitura" — três
legendas cinza indistinguíveis abaixo do nome.

## Conteúdo e dados reais
- Card de filamento: nome em `--text-strong` semibold; resumo em legenda `--text-muted`, ex.:
  `PLA · R$ 129,90 / 1 kg`.
- Card de impressora, ex.: `R$ 2.499,00 · 2.000 h · 0,15 kW`. Kit: `3 peça(s)`. Produto: nomes das
  referências, ou `manual` quando a referência sumiu.
- Contador acima da lista: `12 filamento(s)` / `4 impressora(s)` (legenda, não título).
- Desktop ≥1280px: barra de ferramentas com busca (placeholder "Buscar no catálogo…", ícone `search`
  18px), o contador e o botão Adicionar; lista à esquerda em `minmax(0,1fr)`, ficha fixa de 560px à
  direita, gap `--space-6`. A ficha tem sobretítulo "Filamento salvo" / "Impressora salva" /
  "Produto salvo" / "Kit salvo" e o nome como `h2`.
- Mobile 390px: lista de cards `padding sm`, com botões-ícone de editar (`pencil`), duplicar (`copy`)
  e excluir (`trash-2`) à direita do bloco de texto.
- A faixa global usa fundo `--tf-info-soft` com texto `--info-text` (o par medido em V3), ícone
  `info` 18px, centralizada, sem animação. Nenhum número, nenhuma data, nenhum horário de última
  sincronização existe hoje — **não invente "atualizado há 2 h" se o dado não existe** (ver perguntas).

## Estados obrigatórios
1. **Online, repouso** — nenhuma faixa, nenhuma linha extra. É o contraste que dá sentido a todos os outros.
2. **Leitura offline / desatualizada (o foco)** — a lista completa e usável + o aviso, uma vez. Frase base:
   "Seus itens salvos continuam aqui para usar no cálculo. Criar e editar precisam de conexão."
3. **Offline do aparelho (shell)** — "Você está offline. O cálculo continua funcionando." Mostre como
   ela convive com o item 2 sem repetir a mesma informação duas vezes.
4. **Carregando** — spinner centralizado, sem lista fantasma.
5. **Erro sem cache** — alerta `danger` "Não foi possível carregar seu catálogo." com botão secundário
   "Tentar novamente". Nunca confundir com o estado 2: aqui não há nada para mostrar.
6. **Vazio real** — "Nenhum filamento salvo ainda" / "Salve seus filamentos uma vez e reutilize em cada cálculo."
7. **Vazio da busca** (desktop) — "Nada encontrado para essa busca" + "Limpar busca".
8. **Escrita bloqueada** — o que acontece ao tocar Adicionar/Salvar offline: hoje a gaveta abre e o
   erro "Criar e editar precisam de conexão." só aparece depois do toque em Salvar. Desenhe o
   comportamento que o desenho original pedia (ação inerte/desabilitada com o porquê visível ao lado)
   **e** o estado de erro pós-toque, para o dono comparar.
9. **Premium pausado** — "Premium pausado" / "Seus itens continuam aqui e podem ser usados no
   cálculo. Para criar ou editar, reative o Premium." + legenda "somente leitura" por item.
10. **Offline + Premium pausado + item degradado no mesmo card** — o pior empilhamento possível;
    mostre a hierarquia que impede as três legendas de virarem uma mancha cinza.
11. **Foco e hover** no card da lista e no botão Adicionar (o card do desktop é um `button` com
    `aria-current` no selecionado — o selecionado e o focado precisam ser distinguíveis).

## Viewports
- **390px** — obrigatório: é onde o offline realmente acontece (feira, cliente, celular). Mostre a
  faixa global + a do painel + um card com todas as legendas empilhadas, para medir a altura que
  sobra para a lista.
- **1280px** — obrigatório: o mestre-detalhe do 018 nunca teve este estado desenhado, e é onde a
  ficha-editor de 560px fica ativa oferecendo edição impossível.
- **1920px** opcional, só se a decisão de layout mudar entre 1280 e 1920.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium** e vice-versa: os cofres são diferentes,
  as frases são diferentes, os tons são diferentes. Offline é `info`, calmo; nunca `danger`.
- **A degradação é dita, não escondida**: sumir com o aviso para "ficar limpo" é a solução errada;
  a certa é dizê-lo uma vez, no lugar certo.
- **Nenhuma frase honesta dentro de placeholder** — placeholder só carrega número/exemplo.
- **Nenhum número inventado**: não existe timestamp de sincronização no produto.
- Alvos de toque ≥44px, contraste medido contra o fundo real do card (não contra o fundo da página).
- O mobile do 018 é código intocado: o que você desenhar para 390px deve caber no card atual, não
  exigir uma reescrita da lista.

## Armadilhas já pagas neste projeto
- **Transbordo horizontal medido, não olhado**: 100,5px de estouro e um botão nascido fora do
  viewport passaram por mais de mil testes verdes. Cada faixa nova come altura no 390px — desenhe
  com um nome longo de filamento e `R$ 2.499,00` no resumo.
- **Headless não vê a barra de rolagem clássica**: o eixo vertical também estoura; um painel com
  três avisos empurra o primeiro item da lista para fora da dobra.
- **Frase cortada por elemento estreito**: "Seus itens salvos continuam aqui para usar no cálculo."
  tem 51 caracteres — mostre-a em elemento de largura cheia, quebrando em duas linhas se preciso.
- **Texto ocluso passa em teste**: legendas empilhadas dentro de um card com botões-ícone à direita
  colidem no 390px sem que nenhuma asserção reclame.

## Entregável
Pranchetas, tema escuro (padrão) **e** claro, ambos tratados como primeiros:
1. `390 · Catálogo online` (referência) e `390 · Catálogo em leitura offline` (a proposta).
2. `390 · Card com todas as legendas` (degradado + offline + somente leitura).
3. `390 · Tentativa de criar offline` — a proposta de ação inerte + o erro pós-toque, lado a lado.
4. `1280 · Mestre-detalhe em leitura offline` — lista + ficha de 560px, deixando claro o que a ficha
   pode ou não fazer.
5. `1280 · Erro sem cache` vs `1280 · Leitura offline` — a diferença entre os dois, explícita.

Reutilize os primitivos existentes, sem criar novos: `Alert` tom `info` para o aviso do painel e tom
`danger` para o erro sem cache; a faixa do shell é o componente de banner já existente (fundo
`--tf-info-soft`, texto `--info-text`, ícone `info`); `Card` para a linha da lista; `EmptyState`
(ícones `package` / `crown`) para vazio e sem permissão; `Button` primário para Adicionar e
`secondary` para "Tentar novamente"; `Spinner` para carregando; `Icon` para `plus`, `pencil`, `copy`,
`trash-2`, `search`.

## Perguntas em aberto para o dono
1. **Qual dos três sinais sobrevive?** O desenho original prevê só a faixa do shell. Manter a faixa
   do painel (que fala de escrita, coisa que a do shell não fala) e matar a linha por item? Ou manter
   a linha por item porque ela é a única que marca *o dado*, e não *o app*?
2. **Adicionar/Salvar ficam desabilitados offline** (§E3 e §G do protótipo) **ou continuam ativos com
   falha honesta no fim** (código de hoje)? Desabilitar cumpre o desenho, mas esconde o motivo se não
   vier uma frase junto; deixar ativo cumpre "nada é fingido", mas gasta o trabalho do vendedor.
3. **"Sem internet" e "servidor não respondeu" são o mesmo aviso para o vendedor?** Hoje são dois
   gatilhos distintos com aparência quase igual.
4. **Qual copy vale**: o §D.2 canônico "Offline — o cálculo continua funcionando" ou as duas frases
   já implementadas e homologadas em outras telas?
5. **Vale registrar quando o cache foi salvo** ("salvo há 2 dias")? O produto não tem esse dado hoje;
   se a resposta for sim, isso vira requisito, não desenho.

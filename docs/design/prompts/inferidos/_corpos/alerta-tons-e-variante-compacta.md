# Alerta em bloco (`tf-alert`) — os quatro tons, o alerta sem título e a variante compacta

## O que desenhar
O bloco de mensagem inline do Precifica3D: uma faixa com fundo tingido, um ícone à esquerda e um corpo
de texto que explica algo que o vendedor precisa saber sem sair da tela. É a peça de feedback mais usada
do produto — mais de 30 pontos: a calculadora, a ficha do Catálogo ("vincule um filamento e uma impressora
salvos"), a linha de peça dos Kits, os Orçamentos ("modo leitura offline"), a Conta ("não foi possível
verificar seu plano"). Quem a lê é o vendedor no meio de uma tarefa: ela nunca é o assunto da tela, é
sempre a nota que muda o significado do número logo acima ou logo abaixo dela. Desenhe o componente
inteiro — os quatro tons, as três composições (título+corpo, só corpo, só título), a variante compacta com
ação, e a densidade em tela estreita.

## Por que este prompt existe
O protótipo de 2026-07-02 cobriu o alerta, mas parcialmente. O canvas 018 do dono desenhou três casos a
1920px — `info` na ficha do Catálogo, `danger` na peça inválida do Kit e, o mais importante, `info` +
`compact` nos Orçamentos com o botão "Sincronizar agora" à direita — o que **derruba** a acusação de que
a variante compacta seria uma gambiarra: ela foi desenhada pelo dono, com ação. O que continua sem
desenho, e foi decidido dentro do código, é: (1) os tons **`success`** e **`neutral`**, que existem no CSS
e que **nenhum ponto do app inteiro invoca** — são tons órfãos; (2) o alerta **sem título**, que é
justamente a forma mais comum (mais da metade dos usos passa só o corpo) e cujo resultado é um bloco
tingido com texto cinza e nenhuma hierarquia; (3) a **densidade a 360px**, que é o que forçou a
`.tf-alert--compact` a nascer fora do design system, dentro de `features/calculator/shopee-warnings.css`,
datada "016/PR-F homologação (A5)", porque a seção da Shopee media **1248px de altura a 360px** e 48%
disso eram dois avisos.

## O que já existe hoje (não invente do zero — corrija)
Anatomia atual: `[ícone 20px] [corpo: título opcional em semibold + texto opcional]`, em flex com gap
`--space-3`, padding `--space-4`, raio `--radius-md` e **uma borda de 1px sempre transparente** (está no
CSS e nenhum tom a pinta). → A borda transparente é um espaço reservado que ninguém usa: decida se o tom
ganha borda ou se ela sai.

| Tom | Fundo | Ícone + título | Ícone | Anúncio ao leitor de tela | Usado hoje? |
|---|---|---|---|---|---|
| `info` (padrão) | `--tf-info-soft` (ciano) | `--info-text` | círculo com "i" | educado (`status`) | sim — é a esmagadora maioria |
| `danger` | `--tf-danger-soft` (rosa/vermelho) | `--danger-text` | círculo com "!" | assertivo (`alert`) | sim |
| `success` | `--tf-success-soft` (verde) | `--success-text` | círculo com "✓" | educado | **nunca** |
| `neutral` | `--bg-muted` (cinza) | `--text-strong` | o MESMO ícone do `info` | educado | **nunca** |

→ `neutral` reaproveita o ícone de informação: dois tons distintos com o mesmo símbolo. → `success` e
`neutral` nunca foram exercitados em tela nenhuma, então ninguém sabe se lêem bem sobre os fundos reais.

Composições reais no código, todas legítimas hoje:
- **título + corpo** — "Modo leitura offline" + "Seus itens salvos continuam aqui para usar no cálculo.
  Criar e editar precisam de conexão."
- **só corpo, sem título** — "Os valores atuais foram mantidos e continuam editáveis." → sem título o
  texto sai em `--text-body` (cinza de corpo) e a única marca do tom é o ícone: um `danger` sem título tem
  a mesma cor de texto de um `info` sem título.
- **só título, sem corpo** — o que o canvas 018 desenhou: "Vincule um filamento e uma impressora salvos" e
  "Confira os campos desta peça — ela não entra no total até ser corrigida."
- **com ação dentro do corpo** — título "Não foi possível atualizar as taxas", corpo "Usando a referência
  salva no dispositivo — o cálculo continua funcionando. Você também pode informar as taxas manualmente."
  + botão secundário "Tentar novamente". → em outras telas o mesmo botão foi posto **fora** do alerta; a
  posição da ação nunca foi desenhada.
- **compacta** — em duas formas incompatíveis: no canvas 018 é `ícone + título esticado + botão
  "Sincronizar agora" à direita`, alinhado ao centro; no app é `ícone + título curto + gatilho ⓘ` com o
  corpo dentro do tooltip. → unifique: uma linha, um slot de ação à direita que aceita botão pequeno
  **ou** ⓘ.

O ícone é 20px no app e 18px no canvas 018. → Fixe um número.

## Conteúdo e dados reais
Textos literais já homologados, que **não devem ser reescritos**:
- "Modo leitura offline" / "Seus registros continuam aqui. Novos registros ficam pendentes neste
  dispositivo até você voltar a ficar online."
- "Premium pausado" / "Seus itens continuam aqui e podem ser usados no cálculo. Para criar ou editar,
  reative o Premium." — e a variante de uma linha: "Premium pausado — você pode reabrir e recalcular este
  kit. Salvar precisa do Premium ativo."
- "Reative o Premium" / "Reative o Premium para voltar a criar e editar. Seus itens estão salvos."
- "Não foi possível carregar seu catálogo." · "Não foi possível carregar seus orçamentos." · "Não foi
  possível verificar seu plano." · botão "Tentar novamente".
- "Os valores atuais foram mantidos e continuam editáveis." (degradação: o item de catálogo referenciado
  sumiu) · "Confira os campos destacados para ver o preço."
- Compacta no app: título "Frete aferido pode gerar cobrança retroativa" + gatilho "Sobre o frete
  aferido", que abre "Se o peso ou as dimensões cadastrados forem menores que os aferidos pela
  transportadora, a Shopee pode recobrar a diferença depois da entrega. Isso não entra no cálculo — é um
  risco a considerar ao cadastrar o anúncio."
- Compacta no canvas: "1 registro(s) pendente(s) neste dispositivo." + botão "Sincronizar agora".
  → "registro(s) pendente(s)" com parênteses de plural é copy ruim; no desenho apareça já resolvida:
  "1 registro pendente neste dispositivo." / "3 registros pendentes neste dispositivo."

O texto mais longo que o alerta carrega hoje tem **420 caracteres**, com aspas curvas e dinheiro no meio
da frase: "Para vendedores CPF com mais de 450 pedidos nos últimos 90 dias, a Shopee cobra uma taxa
adicional regressiva abaixo de R$ 12,00 — mas só divulga dois pontos: “um produto de R$10 tem uma taxa de
R$6,50, enquanto um de R$8 terá taxa de R$6”. Sem a fórmula completa, não aplicamos nenhuma estimativa —
informe a taxa manualmente se precisar calcular este preço." Use **esse texto** na prancheta de estresse,
não um lorem curto.

## Estados obrigatórios
- **Repouso, por tom** — `info`, `danger`, `success`, `neutral` lado a lado, com título + corpo, para que
  a diferença seja avaliável de uma vez. O que cada um significa: `info` = contexto ou limitação honesta
  (é o padrão do produto, inclusive para offline e Premium pausado, que **não são erros**); `danger` =
  algo falhou ou está inválido agora; `success` = confirmação do que o vendedor acabou de fazer;
  `neutral` = nota sem carga.
- **Sem título** (só corpo) — como a mensagem ganha hierarquia sem o semibold. Se a resposta for "o corpo
  assume a cor do tom quando não há título", desenhe assim.
- **Só título** (sem corpo) — a forma do canvas 018.
- **Com ação** — botão secundário pequeno "Tentar novamente" dentro do alerta: onde fica, quanto respira,
  e alvo ≥44px mesmo sendo um botão `sm`.
- **Compacta com ação à direita** — uma linha: ícone + frase + "Sincronizar agora".
- **Compacta com ⓘ** — uma linha: ícone + frase curta + gatilho; e o tooltip aberto com o corpo completo.
- **Erro / offline / vazio da tela ao redor** — o alerta é o próprio veículo do erro ("Não foi possível
  carregar seu catálogo.") e do offline; mostre-o como cabeçalho de uma lista vazia, não flutuando sozinho.
- **Foco de teclado** — no botão e no ⓘ dentro do alerta: o anel precisa ser visível sobre ciano, verde,
  rosa e cinza.
- **Empilhado** — dois e três alertas seguidos, o que acontece de verdade (offline + Premium pausado +
  falha de atualização de taxas na mesma tela).
- **Texto longo a 360px** — o caso de 420 caracteres, origem da variante compacta.

## Viewports
- **Mobile 390px** — obrigatório: é onde o componente vive a maior parte do tempo.
- **Mobile 360px** — obrigatório e não negociável nesta peça: 360 é a largura da medição real que criou a
  compacta. Desenhe ali os dois avisos da Shopee, um completo e um compacto, e anote a altura de cada um.
- **Desktop 1280px e 1920px** — o alerta aparece na ficha lateral do Catálogo (coluna estreita, ~560px),
  na linha de peça do Kit e como faixa larga acima da lista de Orçamentos. A mesma peça em coluna estreita
  e em largura total se comporta de forma muito diferente: mostre as duas.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium, e Premium pausado nunca é vendido como erro.**
  Offline e "Premium pausado" são `info`, calmos, e dizem o que **continua funcionando** antes do que não
  funciona. Nada de vermelho para eles.
- **Freemium é binário**: o alerta descreve o estado; nunca insinua um plano intermediário.
- **Degradação é dita, não escondida**: "Os valores atuais foram mantidos e continuam editáveis." precisa
  ser lida, não sussurrada em cinza claro.
- **Procedência do número**: quando o alerta fala de uma taxa, ele não pode sugerir um valor que o produto
  não calcula — o texto da Shopee existe exatamente para recusar a estimativa.
- **Frase honesta nunca mora em placeholder**, nem sozinha dentro de um tooltip — com uma exceção já
  ratificada: na compacta o corpo pode ir para o ⓘ **desde que o título visível já diga o risco**
  ("Frete aferido pode gerar cobrança retroativa").
- **Contraste medido contra o fundo real**: ícone e título com ≥4,5:1 sobre o fundo tingido do próprio
  tom, em tema escuro e claro — não sobre o fundo da página.
- **Alvo ≥44px** para qualquer botão ou gatilho ⓘ dentro do alerta, inclusive na compacta, cujo padding
  vertical é menor.
- `danger` é anunciado de forma assertiva pelo leitor de tela e interrompe; reserve-o ao que realmente
  interrompe.

## Armadilhas já pagas neste projeto
- **Altura medida, não estimada**: foi a medição de 1248px a 360px que criou a compacta. Todo alerta em
  tela estreita precisa ser desenhado com texto real e a altura anotada.
- **Placeholder que corta a frase honesta**: em 016/PR-F um sufixo de placeholder foi clipado e a
  honestidade sumiu. Frases honestas vivem em elementos de largura total.
- **Texto que passa no teste e não aparece na tela**: asserção de texto não enxerga oclusão nem transbordo.
  O alerta de 420 caracteres precisa ser desenhado com caixas, não com fé.
- **Valor grande estoura a coluna**: `R$ 1.234,56` no meio do corpo, na ficha lateral de 560px, precisa
  quebrar sem empurrar o bloco.
- **Duplicação fora do design system**: a compacta hoje é remontada à mão por quem a usa, o que já rendeu
  divergência de ícone e de estrutura. Trate-a como variante do mesmo componente.

## Entregável
Pranchetas em **tema escuro (padrão) e tema claro (first-class, mesmo cuidado)**:
1. **Matriz de tons** — os quatro tons × (título+corpo · só corpo · só título), a 1280px.
2. **Alerta com ação** — botão dentro e, ao lado, a mesma mensagem com o botão fora, para o dono comparar.
3. **Variante compacta** — as duas formas (botão à direita; ⓘ à direita), com o tooltip aberto.
4. **360px: antes e depois** — a seção Shopee com dois alertas completos vs. um completo + um compacto,
   com a altura total anotada em cada caso.
5. **Contexto real** — na ficha lateral do Catálogo e como faixa larga sobre a lista de Orçamentos, a 1920px.
6. **Foco e empilhamento**.

Reutilize os primitivos existentes, sem criar novos: `tf-alert` com
`tf-alert--{neutral,info,success,danger}` e `tf-alert--compact`; ícones do conjunto da casa (`info`,
`circle-check`, `circle-alert`); a ação é `tf-btn tf-btn--secondary tf-btn--sm`; o gatilho ⓘ é o `InfoTip`
da casa; corpo em `--fs-body-sm`; fundos em `--tf-info-soft` / `--tf-success-soft` / `--tf-danger-soft` /
`--bg-muted` e cores de tom em `--info-text` / `--success-text` / `--danger-text` / `--text-strong`.

## Perguntas em aberto para o dono
1. **`success` e `neutral` continuam existindo?** Nenhum ponto do app usa os dois. Se o produto nunca
   confirma nada com um bloco verde (confirmação hoje é toast ou badge), `success` pode sair — e `neutral`
   pode virar simplesmente texto de apoio, sem bloco tingido. Manter quatro tons dos quais dois nunca
   aparecem é decisão de produto, não de desenho.
2. **Alerta sem título: o corpo herda a cor do tom ou continua cinza?** É a forma mais comum da peça —
   mudar isso muda a leitura de dezenas de telas de uma vez.
3. **A ação fica dentro ou fora do alerta?** Os dois padrões estão em produção hoje ("Tentar novamente"
   dentro, no Catálogo; fora, no Histórico).
4. **Na compacta, quando o corpo pode migrar para o ⓘ?** A regra atual é informal ("quando o aviso é
   estático e sempre presente"). Vale também para o aviso de registros pendentes, ou só para avisos que
   não dependem do formulário?

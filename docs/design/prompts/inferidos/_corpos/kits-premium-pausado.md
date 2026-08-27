# Premium pausado em Kits — o painel de reativação e a faixa do kit reaberto

## O que desenhar
Duas superfícies irmãs da aba **Kits** (`/kits`) que só aparecem quando o vendedor tem Premium **pausado** (o
servidor respondeu `status = "lapsed"` — ele já foi assinante, o pagamento falhou ou a assinatura terminou, e
os kits dele continuam salvos). (a) **O painel de reativação**: quem entra em Kits para CRIAR um kit novo não
recebe compositor nenhum — recebe uma tela curta explicando que criar/editar precisa do Premium ativo. (b) **A
faixa do kit reaberto**: quem abre um kit salvo (`/kits?id=…`) recebe o compositor INTEIRO, funcionando —
recalcula, troca quantidade, vê preço por canal — com uma faixa no topo dizendo que salvar é o que está
pausado, e com o botão "Salvar kit" **visível e habilitado**, que responde honestamente quando tocado. É o
momento de maior medo do produto: o assinante que falhou o pagamento precisa ver, em menos de dois segundos,
que **nada foi apagado**.

## Por que este prompt existe
Nada disso foi desenhado. O `.dc.html` do canvas não conhece as palavras "pausado" nem "lapsed": a fronteira
desenhada é **binária** (`isPremium` / `isFree`), e o briefing de 2026-07 §J a fixa assim ("Entitlement
binário: sem quota/contador"). A §E7 (Conta, "plano atual Free/Premium") e a §E8 (upsell) não têm estado de
lapso; a matriz da §G também não. A auditoria de protótipo de 2026-07-02 não toca no assunto. A única
autoridade é **textual** — `ux-bom.md` §3 e FR-409/Q3 —, ou seja: requisito, nunca desenho. O resultado é que
as duas superfícies foram montadas com `Alert` de propósito geral, e **o caminho de volta ao Premium não
existe em nenhuma das duas**. Pior: o próprio `ux-bom.md` §3 desenha, no ASCII, o painel de lapso com **a
lista dos kits salvos logo abaixo do aviso** ("… saved BOM rows … (open → read + re-price)") — o código não
mostra lista nenhuma, só um botão que leva embora.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/bom/bom-page.tsx` + `apps/web/src/shared/i18n/messages.pt-br.ts`.

**(a) Painel de reativação** (lapsed, sem `?id=`) — a tela inteira é isto, nesta ordem:

| Elemento | Conteúdo literal hoje |
|---|---|
| Cabeçalho da página | "Monte seus kits" (sem subtítulo — o subtítulo some neste ramo) |
| `Alert tone="info"`, com título | Título: "Premium pausado" |
| Corpo do Alert | "Seus kits salvos continuam aqui e podem ser reabertos e recalculados. Para criar ou editar, reative o Premium." |
| Botão secundário | "Ver meus kits" → leva a `/catalogo?tab=kits` |

→ **Problema 1: não há CTA de reativação.** A única ação é ir embora. O destino de reativação **já existe no
app** (`/conta?assinar=1`, a oferta em folha dentro da Conta) e é usado por todos os teasers.
→ **Problema 2: o Catálogo tem copy de reativação e Kits não.** Filamento, impressora e produto já mostram um
`Alert tone="info"` com título **"Reative o Premium"** e corpo **"Reative o Premium para voltar a criar e
editar. Seus itens estão salvos."** Kits ficou sem esse par.
→ **Problema 3: a página cabe num cartão e ocupa uma tela de 1720px.** Desde o 018 a largura máxima de `/kits`
no desktop é 1720px; esse ramo renderiza um aviso e um botão nesse vão. Parece quebrado.
→ **Problema 4: o vendedor não vê nenhum kit.** Ele é informado de que "seus kits continuam aqui" e não vê
nenhum. A frase pede prova; o §3 do `ux-bom.md` já previa a lista ali.

**(b) Kit reaberto** (lapsed, com `?id=`) — o compositor completo, mais:

| Elemento | Conteúdo literal hoje |
|---|---|
| Faixa no topo, `Alert tone="info"` sem título | "Premium pausado — você pode reabrir e recalcular este kit. Salvar precisa do Premium ativo." |
| Bloco de salvar (coluna direita no desktop, fim da página no mobile) | Campo "Nome do kit" (obrigatório, placeholder "Kit suporte + base") + botão primário "Salvar kit" |
| Recusa, após tocar em Salvar | `Alert` de tom **`info`** (decisão explícita, não `danger`) com a frase do servidor: "Salvar faz parte do Premium." |

→ **Problema 5: um botão primário cheio que existe para recusar.** A decisão de NÃO desabilitar é consciente e
está certa (um botão desabilitado não explica nada), mas hoje ele é visualmente idêntico ao "Salvar kit" de
quem tem Premium ativo. Nada antecipa a recusa; o vendedor descobre depois de digitar o nome.
→ **Problema 6: a recusa aparece longe do topo.** No mobile, faixa e recusa ficam a uma rolagem inteira de
distância, dizendo a mesma coisa com palavras diferentes.
→ Enquanto isso, o irmão **Simulações** resolve o mesmo caso com uma legenda junto às ações:
"Premium pausado — reative para renomear, duplicar, editar ou excluir." Três telas, três formas. Unifique.

## Conteúdo e dados reais
- O estado vem do servidor (`GET /api/v1/entitlement` → `"none" | "active" | "lapsed"`). **Só "lapsed" abre
  estas superfícies**; "none" recebe o teaser de venda ("Monte e precifique kits com várias peças"), que aqui
  seria mentira — o vendedor já teve o recurso.
- Kits salvos permanecem legíveis por contrato (FR-409). Reabrir e **recalcular funcionam**: o preço é
  recomputado no aparelho, não lido de um registro. Exemplo real de um kit reaberto em lapso: "Total do kit"
  R$ 24,24 no varejo e R$ 16,16 no atacado, com o rodapé "Varejo" / "Atacado".
- Sem preço, sem data de cobrança, sem contador de dias restantes em nenhuma das duas superfícies (a oferta
  com valores mora na Conta). Nada de "expirou", "bloqueado", "suspenso" — palavras banidas por FR-014.
- O destino de reativação existente: a oferta dentro da Conta (`/conta?assinar=1`). A saída existente para os
  kits salvos: a aba Kits do Catálogo (`/catalogo?tab=kits`).
- No compositor reaberto, "Nome do kit" continua obrigatório e o botão continua fazendo a validação local
  antes da recusa do servidor — ou seja, é possível receber primeiro "Dê um nome ao kit para salvar." e só
  depois "Salvar faz parte do Premium.". Desenhe a ordem que evita esse duplo tropeço.

## Estados obrigatórios
1. **Verificando o plano** — enquanto a resposta do servidor não chega: spinner + "Verificando seu plano…".
   Nunca piscar o painel de pausado antes de saber (defeito já pago: o painel de reativação piscou por cima de
   um kit válido em reabertura).
2. **Painel de reativação (repouso)** — o caso (a) acima.
3. **Kit reaberto com faixa (repouso)** — o caso (b): compositor completo, faixa no topo.
4. **Salvar: repouso · foco · hover · pressionado** — o botão que vai recusar, nos quatro. Alvo ≥44px.
5. **Salvar: carregando** — o rótulo vira "Salvando…" e o botão fica desabilitado durante a chamada. Sim, a
   recusa também passa por esse estado; é honesto (a decisão é do servidor).
6. **Salvar: recusado por lapso** — "Salvar faz parte do Premium." em tom `info`, jamais vermelho.
7. **Salvar: recusado por falta de conexão** — "Criar e editar precisam de conexão." Precisa ser **visivelmente
   diferente** do caso 6: falha de rede nunca pode ser lida como perda de Premium, e vice-versa.
8. **Plano não verificável** — a leitura do plano falhou e não há resposta anterior: "Não foi possível
   verificar seu plano." + botão "Tentar novamente". Isto **não é** premium pausado e não pode se parecer.
9. **Sem nenhum kit salvo, em lapso** — a frase "Seus kits salvos continuam aqui" fica falsa. Diga o que há.
10. **Foco de teclado visível** em todos os botões e no campo de nome, no tema escuro e no claro.

## Viewports
- **Mobile 390px** — é a viewport principal do produto e onde a faixa, o compositor e o bloco de salvar ficam
  mais distantes um do outro. Desenhe as duas superfícies aqui.
- **Desktop 1280px** — o corte em que Kits vira duas colunas (peças à esquerda, resumo/salvar numa coluna de
  480px fixada à direita). A faixa de lapso atravessa as duas colunas; o botão que recusa vive na coluna
  direita, fixada — pense na relação entre a faixa lá em cima e a recusa lá na direita.
- **Desktop 1920px** — porque o painel de reativação (a) tem 1720px de largura útil e hoje mostra um aviso
  solitário. É a viewport em que o problema 3 é visível; desenhe a resposta.

## Regras que o desenho não pode quebrar
- **Freemium binário, com uma exceção nomeada**: quem nunca teve Premium recebe o teaser de venda; quem TEVE
  recebe estas superfícies. Nunca venda a um assinante pausado o recurso que ele já usou.
- **Calmo, nunca punitivo.** Tom `info`, jamais `danger`/vermelho, jamais linguagem de bloqueio.
- **Nada foi apagado** precisa ser a primeira coisa legível, não a terceira linha.
- **O botão que vai recusar continua visível e tocável** — a decisão de não desabilitar é do produto. Mas a
  recusa não pode ser surpresa: o desenho tem que antecipá-la sem apagar o botão.
- **Falha de rede nunca vendida como "não é premium"**, e falha de leitura do plano nunca vendida como lapso.
- **A frase honesta vive em elemento de largura cheia**, nunca em placeholder ou sufixo de campo (já cortou).
- Contraste medido contra o fundo real do `Alert` (que tem fundo próprio), não contra o fundo da página.
- Alvo de toque ≥44px em "Salvar kit", "Ver meus kits" e no CTA de reativação que você propuser.

## Armadilhas já pagas neste projeto
- **Estouro horizontal medido.** Uma superfície de cobrança já nasceu com 100,5px de estouro e um botão fora da
  viewport. Meça caixas, não confie em "parece caber": "Premium pausado — você pode reabrir e recalcular este
  kit. Salvar precisa do Premium ativo." é longa a 390px.
- **Texto ocluso passa em teste.** Um elemento coberto continua "visível" para asserção de texto — só o
  desenho e a geometria pegam. Vale para a faixa sob a coluna fixada do desktop.
- **Nome longo estoura a coluna.** Desenhe com um nome de kit adversarial: "Kit suporte de bancada + base
  reforçada + tampa (revisão 3)".
- **Piscada de estado.** O painel de reativação já apareceu por cima de um kit em carregamento. Estado que vai
  mudar não se desenha como se já tivesse mudado — daí a prancheta 1.
- **Divergência entre telas irmãs.** Catálogo, Kits, Orçamentos e Simulações escreveram quatro variações do
  mesmo lapso. O que você desenhar aqui deve ser reaproveitável nas outras três.

## Entregável
Pranchetas, em **tema escuro (padrão) e tema claro (first-class)**:
1. Painel de reativação — 390px, 1280px e 1920px (a mesma peça nas três larguras).
2. Kit reaberto com a faixa — 390px e 1280px, com o compositor real ao redor (duas ou três peças).
3. Tira de estados do bloco de salvar: repouso · foco · hover · pressionado · carregando · recusado por lapso ·
   recusado por falta de conexão.
4. Os estados de borda: verificando o plano, plano não verificável, lapso sem nenhum kit salvo.

Reutilize os primitivos existentes, sem criar novos: `tf-alert--info` para a faixa e para o painel (com
`tf-alert__title` quando houver título), `tf-btn` primário para "Salvar kit", `tf-btn` secundário para "Ver
meus kits" e para o CTA de reativação, `tf-card` como moldura do bloco de salvar, `tf-field` + `tf-input` para
"Nome do kit", `tf-badge` se propuser um selo de estado do plano, `tf-empty-state` para o lapso sem kits e
`tf-spinner` para a verificação. Se a peça pedir algo que nenhum primitivo resolve, diga qual e por quê — não
desenhe um componente novo em silêncio.

## Perguntas em aberto para o dono
1. O painel de reativação deve **listar os kits salvos** ali mesmo (como o `ux-bom.md` §3 desenhou) ou continuar
   apenas apontando para a aba Kits do Catálogo? Muda a peça de um aviso para uma tela.
2. O CTA de reativação leva à **oferta da Conta** (`/conta?assinar=1`, o que os teasers já fazem) ou o dono
   quer um caminho próprio para quem está pausado (que é reativação, não primeira compra)?
3. **Antecipar a recusa no botão** — trocar o rótulo "Salvar kit", acrescentar legenda ao lado, ou manter o
   botão idêntico ao do premium ativo e deixar a antecipação por conta da faixa? É decisão de produto, e as
   três mudam a leitura do risco.
4. O painel de reativação deve repetir a copy do Catálogo ("Reative o Premium" / "Reative o Premium para voltar
   a criar e editar. Seus itens estão salvos.") para haver **uma só voz de lapso** no app, ou a copy de Kits
   ("Seus kits salvos continuam aqui…") fica por ser mais específica?

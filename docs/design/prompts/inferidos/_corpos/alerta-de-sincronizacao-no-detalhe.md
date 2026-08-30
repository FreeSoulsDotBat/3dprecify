# Alerta de estado do registro não sincronizado (Orçamentos → registro aberto)

## O que desenhar
O bloco de aviso que aparece DENTRO de um orçamento salvo (aba **Orçamentos**, registro aberto) quando aquele
registro ainda **não chegou à conta do vendedor**. Ele é a única voz do produto que responde à pergunta mais
cara da tela: "o orçamento que eu acabei de fazer existe de verdade, ou só existe neste celular?". Quem lê é o
vendedor logo depois de salvar — muitas vezes numa feira, sem sinal, com o cliente na frente. São **quatro
estados não sincronizados** (`pendente`, `envio pausado por Premium`, `sessão expirada`, `não foi possível
registrar`) e um quinto que é a ausência da peça (`sincronizado` → nada aparece). Cada estado tem título, corpo,
e até três acessórios empilhados: uma ressalva de durabilidade, um código de suporte, um link de volta e o par
de botões [Tentar novamente] / [Descartar].

## Por que este prompt existe
Nenhuma autoridade de desenho conhece fila de sincronização. O protótipo de 2026-07-02 (§E6/§E9) só desenhou o
banner **offline do shell** (faixa ciano, "Offline — o cálculo continua funcionando"), que fala da **rede**, não
do registro; a matriz §G dá ao Histórico apenas skeleton/gated/falha; `HistoryScreen.jsx` não tem `syncState`;
e o desenho desktop `Abas-Desktop.dc.html` vai direto do card da alegação para o grid de Detalhamento/Canais,
sem alerta nenhum. A única fonte é `ux-history.md` §1.1/§1.2 — **spec textual**, que o próprio §9.1 classifica
como "Highest — the surface the product has never had". Pior: o quarto estado (`Sessão expirada`) nasceu no
hotfix 016/A3, de 2026-08-07, e não existe nem nessa spec. Ou seja: tom, hierarquia e densidade foram inferidos
por IA, e um estado inteiro foi inventado depois de toda autoridade.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/snapshot-detail-page.tsx` (função `SyncAlert`),
`apps/web/src/features/history/entry-actions.tsx`, textos em `apps/web/src/shared/i18n/messages.pt-br.ts`.

Ordem vertical **atual** do registro aberto, de cima para baixo:

1. Um **badge** solto (pílula) com o mesmo estado — "Pendente neste dispositivo" / "Envio pausado · precisa de
   Premium" / "Envio pausado · sessão expirada" / "Não foi possível registrar";
2. Card da alegação (data/hora, valor cotado, base varejo/atacado, validade);
3. Faixa "Premium pausado — …" (quando o plano está `lapsed`);
4. Ações de gerenciar (renomear/excluir);
5. **→ o alerta desta peça, quinto, muito abaixo da dobra em 390px** — a informação mais urgente da tela chega
   depois do preço, do plano e de dois blocos de ação;
6. Legenda do congelado, detalhamento, canais, ficha técnica, comparar/recalcular/exportar.

Dentro do alerta, hoje, empilhados na mesma coluna: título · corpo (2–4 linhas) · ressalva de durabilidade
(só `pendente`, em texto muted 13px) · "Código de suporte: 422" (só `falhou`) · `<a>` cru vestido de botão
secundário pequeno "Entrar de novo" (só `sessão expirada`) · a dupla [Tentar agora|Tentar novamente] +
[Descartar]. **→ até seis elementos dentro de uma caixa de 358px de largura útil.**

Problemas a resolver no desenho:
- **→ O badge do topo repete o alerta.** Em `falhou`, "Não foi possível registrar" aparece duas vezes,
  idênticas, com 400px entre elas. Decida no desenho quem carrega o estado: o badge, o alerta, ou os dois com
  papéis diferentes (pílula = etiqueta, alerta = explicação).
- **→ Dois alertas info seguidos.** Com Premium pausado, a faixa "Premium pausado — …" e o alerta "Envio
  pausado" (mesma cor, mesmo ícone, mesma causa) ficam a poucos pixels um do outro dizendo quase a mesma coisa.
- **→ Em `pendente` offline o botão [Tentar agora] desaparece** (uma retentativa offline não faria nada), e o
  alerta fica com **[Descartar] como única ação visível** — a única saída oferecida é destrutiva.
- **→ "Entrar de novo" é um link vestido de botão**, misturado na mesma linha visual dos botões reais.
- **→ "Código de suporte: 422"** é o status HTTP cru. Para o vendedor é um número sem significado.
- **→ Nada disso foi desenhado no desktop**: no mestre-detalhe (≥1280px) o registro é a coluna direita,
  `sticky`, com rolagem própria — o alerta pode sair de vista enquanto a coluna rola.

## Conteúdo e dados reais
Textos **literais**, homologados, a usar sem reescrever (a copy é boa; o problema é a forma):

| Estado | Título | Corpo |
|---|---|---|
| `pending` | "Ainda não sincronizado" | "Este registro está só neste dispositivo e ainda não chegou à sua conta. Ele sincroniza sozinho quando você voltar a ficar online." |
| `blocked` | "Envio pausado" | "Este registro não foi enviado para a sua conta: o Premium não está ativo. Ele continua aqui, neste dispositivo. Assim que o Premium voltar a ficar ativo, ele é enviado automaticamente." |
| `unauthenticated` | "Sessão expirada" | "Este registro não foi enviado para a sua conta: sua sessão expirou. Ele continua aqui, neste dispositivo. Entre de novo para enviá-lo." |
| `failed` | "Não foi possível registrar" | "O servidor não aceitou este registro. Ele não será reenviado sozinho. Você pode tentar de novo ou descartar." |

Acessórios (texto exato): ressalva de durabilidade — "Enquanto não sincroniza, ele existe só aqui — se os dados
do app forem limpos, ele se perde." · "Código de suporte:" + número (ex.: `422`, `500`) · "Entrar de novo" ·
botões "Tentar agora" (só `pendente`), "Tentar novamente" (`pausado`/`sessão`/`falhou`), "Descartar" ·
confirmação de descarte: "Descartar este registro?" / "Ele não foi enviado para a sua conta e não poderá ser
recuperado." com [Voltar] e [Descartar].

Dados do registro ao redor, para popular a prancheta com números verdadeiros: valor cotado **R$ 24,24**
(base varejo) ou **R$ 21,01** (atacado); data/hora "Cotado em 14/08/2026 às 19:32"; um caso adversarial de
rótulo longo — "Kit engrenagens planetárias — cliente Marcenaria São Jorge (2ª remessa)".

## Estados obrigatórios
- **Ausente (`sincronizado`)** — a peça simplesmente não existe; desenhe o registro sem ela, para provar que a
  ausência não deixa buraco no ritmo vertical.
- **`pendente` online** — tom calmo (info), título "Ainda não sincronizado", ressalva de durabilidade em texto
  secundário, [Tentar agora] + [Descartar].
- **`pendente` offline** — mesmo texto, **sem** [Tentar agora]. Precisa de uma saída não destrutiva visível
  (nem que seja só a frase que explica que ele sincroniza sozinho ganhando peso).
- **`envio pausado · Premium`** — info, com a faixa "Premium pausado" possivelmente logo acima: mostre as duas
  juntas numa prancheta e resolva a duplicação.
- **`sessão expirada`** — info, com o caminho de volta "Entrar de novo" e os dois botões.
- **`não foi possível registrar`** — único tom perigo (vermelho), com "Código de suporte: 422".
- **Ações em andamento** — [Tentar agora] com spinner; [Descartar] pressionado; diálogo de confirmação aberto
  por cima.
- **Foco de teclado** em cada botão e no link, e **hover** dos dois botões.

## Viewports
- **390px (obrigatório)** — é onde a peça dói: 358px de largura útil, até seis elementos empilhados, e ela hoje
  nasce abaixo da dobra. Desenhe também a versão de rótulo longo.
- **1280px** — o registro é a coluna direita do mestre-detalhe (lista à esquerda), com rolagem própria e topo
  fixo; a coluna do registro tem folga de ~1.15 de fração. Mostre o alerta no topo dessa coluna.
- **1920px** — lista fixa de 520px e o registro com todo o resto (~1.100px). O risco aqui é o oposto: um alerta
  de duas linhas esticado por 1.100px vira uma faixa de texto longuíssima. Proponha a largura máxima do corpo.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como limite de plano, e vice-versa.** As quatro causas são diferentes e cada
  frase já diz a sua: "conexão"/"online" só podem aparecer em `pendente`. Não unifique tons a ponto de os
  quatro estados ficarem indistinguíveis.
- **Só `falhou` é perigo.** Os outros três são situações normais; pintar `pendente` de vermelho transforma uma
  feira sem sinal em pânico. E o inverso: `falhou` não pode ser discreto.
- **A ressalva de durabilidade é verdadeira e assustadora** ("se os dados do app forem limpos, ele se perde") —
  ela vive só aqui, no detalhe, em tom secundário, nunca no card da lista, nunca em tom de alarme.
- **Descartar é destrutivo e sempre confirmado**; nunca pode ser o botão de maior peso visual do bloco.
- **Frase honesta nunca em placeholder nem truncada** — nenhum dos corpos acima pode ganhar reticências.
- **Alvo ≥44px** para os dois botões e para o link "Entrar de novo".
- **Contraste medido contra o fundo real do alerta** (a caixa é uma superfície tingida, não o fundo da página):
  título, ícone e o texto secundário da ressalva precisam passar em cima do tingido, nos dois temas.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido, não olhado**: um rótulo longo ou "R$ 1.234,56" ao lado dos dois botões já
  estourou colunas antes; em 390px meça, com caixas, que nada ultrapassa 390.
- **Texto ocluso passa em teste**: um elemento visualmente coberto continua "visível" para o código. A densidade
  desta caixa é justamente onde isso acontece.
- **Botão nascido fora da viewport** (billing, 100,5px de overflow) — a linha de ações é o candidato natural
  a repetir isso quando os dois botões não cabem lado a lado.
- **Sufixo cortado**: em 016 uma frase honesta foi clipada porque morava num elemento estreito. Os corpos aqui
  têm 4 linhas em 390px — reserve a altura.

## Entregável
Pranchetas, **tema escuro primeiro e tema claro como igual**:
1. Os quatro estados em 390px, um por prancheta, dentro do registro real (badge + card da alegação acima) —
   com a proposta de onde o alerta passa a viver na ordem vertical.
2. `pendente` offline e `pausado + faixa Premium pausado` — os dois casos de conflito.
3. A linha de ações em detalhe: repouso / hover / foco / carregando / pressionado, e o diálogo de descarte.
4. Coluna direita em 1280px e em 1920px, com a largura máxima do corpo do alerta resolvida.

Reutilize os primitivos existentes, não crie novos: a caixa é o **`tf-alert`** (tons `info` e `danger`, com
ícone e título já previstos); a pílula do topo é o **`tf-badge`**; os dois botões são **`tf-btn--sm`** nas
variantes `secondary` e `danger`; a ressalva e o código de suporte usam a classe de texto secundário do
Histórico (`tf-historico__meta`, 13px, cor muted); o "Entrar de novo" deve ser um botão de verdade, não um link
maquiado; a confirmação é o **`tf-dialog`**.

## Perguntas em aberto para o dono
1. **Badge e alerta ao mesmo tempo?** Hoje o mesmo estado aparece duas vezes na mesma tela (em `falhou`, com
   texto idêntico). Mantemos os dois com papéis distintos, ou o badge some quando o alerta está presente?
2. **Onde o alerta entra na ordem vertical?** Ele é a informação mais urgente e hoje é o quinto bloco, abaixo da
   dobra em 390px. Sobe para o topo do registro (acima do valor cotado) ou permanece onde está?
3. **"Código de suporte: 422" deve continuar sendo o status HTTP cru?** O vendedor não tem o que fazer com esse
   número, e não há instrução de para onde levá-lo (não há canal de suporte citado na tela).
4. **Em `pendente` offline, qual é a saída não destrutiva?** Sem [Tentar agora], a única ação oferecida é
   [Descartar]. Aceitamos um alerta cuja única ação é destrutiva, ou o botão fica visível e desabilitado com o
   motivo ("Precisa de conexão para enviar", frase que já existe no guarda de sair da conta)?

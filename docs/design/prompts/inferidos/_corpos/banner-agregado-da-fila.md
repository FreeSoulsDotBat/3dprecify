# Banner agregado da fila de envio (Orçamentos)

## O que desenhar
A faixa que aparece no topo da lista de **Orçamentos** (rota `/historico`) sempre que existe pelo menos um
registro que ainda **não chegou à conta** do vendedor — ficou parado neste aparelho. Ela é a única voz
agregada sobre a fila: diz quantos registros estão parados, **por qual motivo**, e oferece a ação que faz
sentido para aquele motivo. Quem lê é o vendedor que acabou de salvar um orçamento (muitas vezes numa
feira, no celular, com sinal ruim) e precisa saber, sem abrir card nenhum, se o que ele gravou existe só
no telefone. A peça vive acima da barra de busca/período e acima dos cards; cada card ainda carrega seu
próprio selo de estado — o banner **resume**, nunca substitui.

## Por que este prompt existe
O canvas do dono (`Abas-Desktop.dc.html`, linha 265) desenha **um** caso: `tf-alert--info` compacto com
"1 registro(s) pendente(s) neste dispositivo." e um botão "Sincronizar agora". As outras **quatro
redações** — falhou, Premium pausado, sessão expirada, pendente offline —, o tom `danger`, e os botões
**[Ver]** e **[Entrar de novo]** nunca foram desenhados: nasceram de requisito textual (`ux-history.md`
§2.2) e de dois hotfixes (016/A3). Nunca se desenhou como um alerta acomoda a frase mais longa **e até
três botões** em 390px, nem como o [Ver] sinaliza o card de destino ao chegar nele. O protótipo antigo
(2026-07-02) não ajuda: ele tem o banner offline genérico do shell e nenhuma fila.

## O que já existe hoje (não invente do zero — corrija)
Origem: `apps/web/src/pages/historico/historico-page.tsx` (função `QueueBanner`, ~linha 553) +
`shared/i18n/messages.pt-br.ts` (§ `historico`, linhas 945–956 e 1016).

A frase é **uma só**, escolhida por precedência `falhou > pausado > sessão expirada > pendente offline >
pendente`:

| Situação | Frase literal em pt-BR | Tom |
|---|---|---|
| ≥1 falhou | `"{n} registro(s) não puderam ser registrados."` | **danger** |
| ≥1 bloqueado | `"{n} registro(s) não foram enviados: o Premium não está ativo."` | info |
| ≥1 sessão expirada | `"{n} registro(s) não foram enviados: sua sessão expirou."` | info |
| pendente, offline | `"Sem conexão. {n} registro(s) pendente(s) neste dispositivo — sincronizam sozinhos quando você voltar a ficar online."` | info |
| pendente, online | `"1 registro(s) pendente(s) neste dispositivo."` | info |

Os controles aparecem **por condição**, todos `tf-btn--secondary tf-btn--sm`, dentro de um bloco que
permite quebra de linha (`display:flex; flex-wrap:wrap; gap:8px; justify-content:space-between`):

- **"Ver"** — quando há falhou/pausado/sessão expirada. Rola suavemente até o primeiro card problemático.
- **"Entrar de novo"** — só quando há sessão expirada. É um link vestido de botão; leva ao login e volta.
- **"Sincronizar agora"** — só quando há pendente **e** o aparelho está online; ganha spinner enquanto envia.

→ **Problema 1**: a precedência esconde metade da verdade. Com 2 falhados + 3 pendentes o vendedor lê só
"2 registro(s) não puderam ser registrados." e vê um "Sincronizar agora" cuja razão de existir não está
escrita em lugar nenhum da faixa.
→ **Problema 2**: `"{n} registro(s)"` é copy de programador. "1 registro(s)" está na tela hoje.
→ **Problema 3**: o [Ver] chega ao card **sem nenhuma marca nele** — o vendedor rolou e não sabe qual era.
→ **Problema 4**: `tf-btn--sm` tem **36px** de altura (`--control-h-sm`), abaixo do alvo mínimo de 44px.
→ **Problema 5**: no desktop, o canvas põe a faixa **em largura cheia acima das duas colunas**; o código a
renderiza **dentro da coluna esquerda da lista** (520px a partir de 1440px; ~510px em 1280px). Os três
botões precisam caber na largura que o desenho escolher — e o desenho precisa escolher.

## Conteúdo e dados reais
- `{n}` é uma contagem inteira ≥ 1, sem teto. Desenhe com **1**, com **12** e com **128**.
- Estados de sincronização reais por registro: `pending`, `blocked`, `unauthenticated`, `failed`, `synced`.
- Os selos dos cards abaixo (mesmo vocabulário; não repita nem contradiga): `"Pendente neste dispositivo"`,
  `"Envio pausado · precisa de Premium"`, `"Envio pausado · sessão expirada"`, `"Não foi possível registrar"`.
- O card logo abaixo mostra, nesta ordem: rótulo (ex.: "Cliente João — vaso G"), o selo, `"Cotado em
  12/07/2026 · Kit · 3 peças"`, e só então `Valor cotado   R$ 275,00` com a legenda da base ("preço de varejo").
- Vizinhos que podem estar na tela **ao mesmo tempo**, empilhados acima: o banner sticky de sessão
  (`"Sua sessão expirou"` / `"Entre de novo para continuar de onde parou."` / `[Entrar de novo]`), o
  `"Premium pausado — seus registros continuam aqui e podem ser abertos. Para salvar, renomear, excluir ou
  exportar, reative o Premium."` e o `"Modo leitura offline"`. Três alertas seguidos é cenário real.

## Estados obrigatórios
1. **Pendente online** — info, frase curta, um botão "Sincronizar agora".
2. **Pendente offline** — info, a frase longa (139 caracteres), **nenhum botão** (não se oferece o que não funciona).
3. **Premium pausado** — info, "Ver" (+ "Sincronizar agora" se houver pendente saudável online).
4. **Sessão expirada** — info, "Ver" + "Entrar de novo" (+ "Sincronizar agora" quando couber).
5. **Falhou** — **danger**, "Ver" (+ os outros dois no caso misto). O único vermelho da peça.
6. **Máximo simultâneo** — falhou + sessão expirada + pendente online = frase de falha e **três botões**.
   Este é o desenho que precisa provar que cabe em 390px.
7. **Sincronizando** — o "Sincronizar agora" em carregamento, largura estável, sem pular o layout.
8. **Foco de teclado** em cada um dos três controles (anel visível sobre o fundo tingido do alerta).
9. **Hover** e **pressionado** dos botões sobre `--tf-info-soft` e sobre `--tf-danger-soft`.
10. **Resolvido** — a fila zerou e a faixa **some**. Desenhe o "depois" (a lista sem a faixa) e diga o que o
    vendedor vê como confirmação de que o envio deu certo — hoje, nada.
11. **Chegada do [Ver]** — o card de destino precisa de um destaque de chegada, distinto do card aberto do
    mestre-detalhe (que já usa `--accent` + `--accent-soft`).

## Viewports
- **390px (mobile)** — obrigatório, é o uso principal (feira, celular, sinal ruim). Prancheta dedicada para
  o estado 6 (três botões) e para o estado 2 (frase longa).
- **1280px (desktop)** — o mestre-detalhe: aqui a faixa tem ~510px se ficar dentro da coluna da lista, ou
  ~1200px se ficar acima das duas colunas. Desenhe a posição que você defender e diga qual é.
- **1440px** — a coluna da lista trava em 520px; vale conferir se a decisão tomada em 1280 continua de pé.
  1920px segue a mesma regra de 1440 e não precisa de prancheta própria.

## Regras que o desenho não pode quebrar
- **Falha de rede nunca é vendida como falta de Premium, e sessão expirada nunca é chamada de conexão.**
  As palavras "conexão"/"online" são **proibidas** na frase de sessão expirada — foi um defeito real (016/A3).
- **Nunca um botão que não pode funcionar**: sem conexão não existe "Sincronizar agora".
- **O `danger` é só para "falhou"** — o único estado em que o servidor recusou o registro de vez. Premium
  pausado e sessão expirada não destruíram nada: o registro continua no aparelho, e dizer o contrário mente.
- **A faixa não vende Premium.** Ela informa; o convite mora no teaser da página, não aqui.
- Alvo de toque **≥44px** nos três botões, inclusive quando quebram para a segunda linha.
- Contraste do texto medido contra o fundo tingido real do alerta (`--tf-info-soft` / `--tf-danger-soft`),
  nunca contra o fundo da página.
- A frase honesta é **texto de verdade**: nunca placeholder, nunca truncada com reticências.

## Armadilhas já pagas neste projeto
- **Overflow horizontal medido**: no E6/T028 um botão nasceu **fora da viewport** e a página vazou 100,5px.
  Três botões `sm` somam ~334px mais 16px de espaçamento; a largura útil dentro do alerta em 390px é ~294px
  (390 − 32 de margem − 32 de padding do alerta − 20 do ícone − 12 do gap). **Não cabe.** O desenho resolve
  isso de propósito, em vez de entregar a decisão ao `flex-wrap`.
- **Texto ocluso passa em teste**: `toBeVisible` aprova um botão coberto; layout aqui se prova com caixas.
- **Placeholder que corta frase honesta** (016/PR-F): frase honesta mora em elemento de largura cheia.
- **Rolagem no eixo Y invisível em headless** (016/PR-B): a faixa não pode criar rolagem interna própria.
- O canvas do dono transcreveu a string do código de 2026-07-15 — ele **ratifica** o caso feliz, não o antecede.

## Entregável
Pranchetas em tema **escuro** (padrão) e **claro** (first-class, as mesmas pranchetas):
1. As cinco redações em 390px, empilhadas, para comparar peso visual entre elas.
2. O estado 6 (três botões) em 390px — o teste de carga da peça.
3. A faixa em 1280px na posição que você defender, com a lista e o detalhe atrás.
4. Foco / hover / pressionado / carregando, ampliados.
5. O antes-e-depois do [Ver]: a faixa, o rolar, o card de destino destacado.
6. A pilha real: banner sticky de sessão + faixa da fila + lista.

Reutilize os primitivos: `tf-alert` (`--info` e `--danger`, com o ícone que o tom já traz) para a faixa;
`tf-btn tf-btn--secondary` para os três controles (proponha o tamanho que atenda 44px em vez de criar um
botão novo); `tf-badge` para os selos dos cards; `tf-card` para os cards. **Atenção**: o `tf-alert--compact`
usado no canvas **não é um primitivo compartilhado** — ele mora hoje em
`features/calculator/shopee-warnings.css`. Se o desenho depender dele, diga isso explicitamente, para que
ele seja promovido em vez de copiado.

## Perguntas em aberto para o dono
1. **Estado misto**: com falhados **e** pendentes ao mesmo tempo, a faixa deve dizer as duas verdades (duas
   linhas) ou continuar dizendo só a mais grave? Hoje só a mais grave aparece — e sobra um botão sem frase
   que o explique.
2. **"{n} registro(s)"**: pode ser reescrito para "1 registro" / "12 registros"? A string está homologada
   desde 2026-07-15 e foi transcrita para o seu canvas, então a troca é decisão sua, não do desenho.
3. **Confirmação de sucesso**: quando o "Sincronizar agora" termina bem, o vendedor deve ver algo? A frase
   "Registro sincronizado." existe no código e **nunca é exibida**; hoje a faixa simplesmente desaparece.
4. **Posição no desktop**: largura cheia acima das duas colunas (como no seu canvas) ou dentro da coluna da
   lista (como o código faz hoje)? Isso muda quanto espaço os três botões têm.
